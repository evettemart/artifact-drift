#!/usr/bin/env python3
"""Generate hackathon repo-summary.json and changed-files.txt artifacts."""

from __future__ import annotations

import argparse
from collections import defaultdict
import json
from pathlib import Path
import subprocess
import sys


NOISY_DIRS = {
    ".git",
    ".hackathon/private",
    "node_modules",
    "vendor",
    "dist",
    "build",
    ".venv",
    "__pycache__",
    ".pytest_cache",
}

LANG_BY_EXT = {
    ".go": "Go",
    ".py": "Python",
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".jsx": "JavaScript",
    ".md": "Markdown",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".toml": "TOML",
    ".hcl": "HCL",
    ".tf": "Terraform",
    ".sh": "Shell",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path.cwd())
    parser.add_argument("--out", type=Path, default=Path(".hackathon/repo-summary.json"))
    parser.add_argument("--changed-files-out", type=Path, default=Path(".hackathon/changed-files.txt"))
    parser.add_argument("--base-ref", default="", help="Optional base ref for changed-file and line-stat calculation.")
    parser.add_argument("--head-ref", default="", help="Optional head ref for changed-file and line-stat calculation.")
    parser.add_argument(
        "--primary-path",
        action="append",
        default=[],
        help="Primary artifact path to check for missing/ignored status. May be repeated.",
    )
    parser.add_argument(
        "--verification-command",
        action="append",
        default=[],
        help="Command to run and record. May be repeated.",
    )
    args = parser.parse_args()

    repo = args.repo.resolve()
    git_available = is_git_repo(repo)
    files = git_files(repo) if git_available else walked_files(repo)
    head_ref = args.head_ref or (git_output(repo, ["rev-parse", "--abbrev-ref", "HEAD"]) if git_available else "")
    changed_files = git_changed_files(repo, args.base_ref, head_ref) if git_available and args.base_ref else files
    line_stats = git_line_stats(repo, args.base_ref, head_ref) if git_available else (0, 0)
    warnings = primary_path_warnings(repo, args.primary_path, git_available)
    verification = run_verification(repo, args.verification_command)
    if not args.verification_command and any(is_test_file(f) for f in files):
        warnings.append("Test files are present, but no verification command was recorded.")

    summary = {
        "schema_version": "2026-06-18",
        "git": {
            "available": git_available,
            "repo_root": str(repo),
            "branch": git_output(repo, ["rev-parse", "--abbrev-ref", "HEAD"]) if git_available else "",
            "base_ref": args.base_ref if git_available else "",
            "head_ref": head_ref if git_available else "",
        },
        "counts": counts(repo, files, changed_files, line_stats),
        "languages": languages(repo, files),
        "top_level_modules": top_level_modules(files),
        "changed_files": changed_files,
        "signals": signals(files),
        "verification": verification,
        "warnings": warnings + [f"Verification command failed: {cmd}" for cmd in verification.get("commands_failed", [])],
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    args.changed_files_out.parent.mkdir(parents=True, exist_ok=True)
    args.changed_files_out.write_text("\n".join(changed_files) + ("\n" if changed_files else ""), encoding="utf-8")
    return 0


def run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=cwd, text=True, capture_output=True, check=False)


def is_git_repo(repo: Path) -> bool:
    return run(["git", "rev-parse", "--is-inside-work-tree"], repo).returncode == 0


def git_output(repo: Path, args: list[str]) -> str:
    result = run(["git", *args], repo)
    return result.stdout.strip() if result.returncode == 0 else ""


def git_files(repo: Path) -> list[str]:
    result = run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], repo)
    if result.returncode != 0:
        return []
    return sorted(line for line in result.stdout.splitlines() if line and not is_noisy(line))


def walked_files(repo: Path) -> list[str]:
    files: list[str] = []
    for path in repo.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(repo).as_posix()
        if not is_noisy(rel):
            files.append(rel)
    return sorted(files)


def git_changed_files(repo: Path, base_ref: str, head_ref: str) -> list[str]:
    rev = f"{base_ref}..{head_ref or 'HEAD'}"
    result = run(["git", "diff", "--name-only", "--diff-filter=ACMRT", rev], repo)
    if result.returncode != 0:
        return []
    return sorted(line for line in result.stdout.splitlines() if line and not is_noisy(line))


def git_line_stats(repo: Path, base_ref: str = "", head_ref: str = "") -> tuple[int, int]:
    if base_ref:
        rev = f"{base_ref}..{head_ref or 'HEAD'}"
        result = run(["git", "diff", "--numstat", "--no-renames", rev], repo)
    else:
        result = run(["git", "log", "--numstat", "--pretty=tformat:", "--no-renames"], repo)
    if result.returncode != 0:
        return 0, 0
    added = deleted = 0
    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) != 3:
            continue
        try:
            added += int(parts[0])
            deleted += int(parts[1])
        except ValueError:
            continue
    return added, deleted


def is_noisy(rel: str) -> bool:
    parts = rel.split("/")
    if parts and parts[0] in NOISY_DIRS:
        return True
    return any(rel == noisy or rel.startswith(noisy + "/") for noisy in NOISY_DIRS)


def counts(repo: Path, files: list[str], changed_files: list[str], line_stats: tuple[int, int]) -> dict[str, int]:
    added, deleted = line_stats
    return {
        "files_total": len(files),
        "files_changed": len(changed_files),
        "lines_added": added,
        "lines_deleted": deleted,
        "test_files": sum(1 for f in files if is_test_file(f)),
        "docs_files": sum(1 for f in files if is_doc_file(f)),
        "config_files": sum(1 for f in files if is_config_file(f)),
        "prompt_files": sum(1 for f in files if is_prompt_file(f)),
        "notebook_files": sum(1 for f in files if f.endswith(".ipynb")),
    }


def languages(repo: Path, files: list[str]) -> dict[str, dict[str, int]]:
    stats: dict[str, dict[str, int]] = defaultdict(lambda: {"files": 0, "lines": 0})
    for rel in files:
        lang = LANG_BY_EXT.get(Path(rel).suffix.lower())
        if not lang:
            continue
        stats[lang]["files"] += 1
        stats[lang]["lines"] += line_count(repo / rel)
    return dict(sorted(stats.items()))


def line_count(path: Path) -> int:
    try:
        with path.open("r", encoding="utf-8") as f:
            return sum(1 for _ in f)
    except UnicodeDecodeError:
        return 0


def top_level_modules(files: list[str]) -> list[str]:
    modules = sorted({f.split("/", 1)[0] for f in files if "/" in f and not f.startswith(".")})
    return modules


def signals(files: list[str]) -> dict[str, object]:
    has_tests = any(is_test_file(f) for f in files)
    has_docs = any(is_doc_file(f) for f in files)
    has_prompts = any(is_prompt_file(f) for f in files)
    has_notebooks = any(f.endswith(".ipynb") for f in files)
    has_ui = any(f.startswith(("web/", "ui/", "frontend/", "src/components/", "app/")) for f in files)
    has_infra = any(Path(f).suffix.lower() in {".tf", ".hcl"} or f.startswith(("deploy/", "infra/")) for f in files)
    has_security = any(
        token in rel.lower()
        for rel in files
        for token in ("vault", "boundary", "secret", "policy", "auth", "credential")
    )
    return {
        "has_tests": has_tests,
        "has_docs": has_docs,
        "has_prompts": has_prompts,
        "has_notebooks": has_notebooks,
        "has_ui_changes": has_ui,
        "has_infra_changes": has_infra,
        "has_security_sensitive_changes": has_security,
        "likely_primary_work_type": likely_work_type(files, has_prompts, has_notebooks),
    }


def likely_work_type(files: list[str], has_prompts: bool, has_notebooks: bool) -> str:
    code_files = [f for f in files if Path(f).suffix.lower() in {".go", ".py", ".js", ".ts", ".tsx", ".jsx"}]
    doc_files = [f for f in files if is_doc_file(f)]
    if has_notebooks:
        return "Notebook"
    if has_prompts and not code_files:
        return "Prompt pack"
    if code_files and (doc_files or has_prompts):
        return "Mixed"
    if code_files:
        return "Code"
    if doc_files:
        return "Docs"
    return "Unknown"


def is_test_file(rel: str) -> bool:
    name = Path(rel).name.lower()
    return "test" in name or rel.startswith("tests/")


def is_doc_file(rel: str) -> bool:
    return rel.lower().endswith(".md") or rel.startswith("docs/")


def is_config_file(rel: str) -> bool:
    name = Path(rel).name.lower()
    return name in {"go.mod", "package.json", "pyproject.toml", ".gitignore"} or Path(rel).suffix.lower() in {
        ".yaml",
        ".yml",
        ".toml",
    }


def is_prompt_file(rel: str) -> bool:
    return rel.startswith("prompts/") or "prompt" in Path(rel).name.lower()


def primary_path_warnings(repo: Path, paths: list[str], git_available: bool) -> list[str]:
    warnings: list[str] = []
    tracked = set(git_files(repo)) if git_available else set()
    for rel in paths:
        path = repo / rel
        if not path.exists():
            warnings.append(f"Primary path is missing: {rel}")
            continue
        if git_available and rel not in tracked and not any(item.startswith(rel.rstrip('/') + "/") for item in tracked):
            ignored = run(["git", "check-ignore", "-q", rel], repo).returncode == 0
            state = "ignored by Git" if ignored else "not tracked by Git"
            warnings.append(f"Primary path is {state}: {rel}")
    return warnings


def run_verification(repo: Path, commands: list[str]) -> dict[str, object]:
    commands_run = []
    commands_failed = []
    for command in commands:
        result = subprocess.run(command, cwd=repo, shell=True, text=True, capture_output=True, check=False)
        status = "passed" if result.returncode == 0 else "failed"
        notes = (result.stdout.strip() or result.stderr.strip()).splitlines()
        note = notes[0] if notes else ""
        commands_run.append({"command": command, "status": status, "notes": note})
        if result.returncode != 0:
            commands_failed.append(command)
    return {
        "commands_run": commands_run,
        "commands_failed": commands_failed,
        "notes": "Verification commands recorded by generate-repo-summary.py." if commands else "No verification commands recorded.",
    }


if __name__ == "__main__":
    raise SystemExit(main())
