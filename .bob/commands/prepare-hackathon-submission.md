---
name: prepare-hackathon-submission
description: Prepare the final hackathon submission by creating metadata, evidence files, and a sanitized review bundle.
---

# prepare-hackathon-submission

Prepare the final hackathon submission bundle.

## Task

When this command is invoked:

1. Read `.hackathon-tools/skills/prepare-hackathon-submission/SKILL.md`.
2. Follow `.hackathon-tools/review-commands/prepare-hackathon-submission.md`.
3. Use `.hackathon-tools/templates/hackathon/team-profile.md`.
4. Use `.hackathon-tools/templates/hackathon/learning-notes.md`.
5. Create or update `.hackathon/team-profile.md`.
6. Create or update `.hackathon/learning-notes.md`.
7. Generate `.hackathon/evidence-manifest.json`.
8. Generate `.hackathon/repo-summary.json` and `.hackathon/changed-files.txt`.
9. Validate generated JSON with `.hackathon-tools/scripts/validate-review-json.py` when possible.
10. Export the bundle to `~/dev/hackathon-submissions/team-slug__epic-slug/`.

## Output

Creates a submission bundle containing:

- `epic.md`
- `team-profile.md`
- `learning-notes.md`
- `evidence-manifest.json`
- `repo-summary.json`
- `changed-files.txt`
- `review-criteria-concern.md`, only if present

## Important

- Do not include `.hackathon/private/` in the export.
- Do not copy arbitrary project artifacts by default.
- Do not include `diff.patch`.
- Do not ask for AI session transcripts.
- Use fake data only.
- Record verification commands honestly as passed, failed, or not run.
- Validate JSON files before export when possible.
