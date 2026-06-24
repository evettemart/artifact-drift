#!/usr/bin/env python3
"""Validate hackathon review JSON artifacts against local schemas."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


SCHEMA_BY_KIND = {
    "evidence-manifest": "evidence-manifest.schema.json",
    "repo-summary": "repo-summary.schema.json",
    "submission-review": "submission-review.schema.json",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind", choices=sorted(SCHEMA_BY_KIND))
    parser.add_argument("json_file", type=Path)
    parser.add_argument(
        "--schema-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "schemas",
    )
    args = parser.parse_args()

    try:
        import jsonschema
    except ImportError:
        print("jsonschema is not installed; run `python -m pip install jsonschema`.", file=sys.stderr)
        return 2

    schema_path = args.schema_dir / SCHEMA_BY_KIND[args.kind]
    with schema_path.open("r", encoding="utf-8") as f:
        schema = json.load(f)
    with args.json_file.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.path))
    if errors:
        for error in errors:
            path = ".".join(str(part) for part in error.path) or "<root>"
            print(f"{path}: {error.message}", file=sys.stderr)
        return 1

    print(f"ok: {args.json_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
