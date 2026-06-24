---
name: run-readiness-review
description: Run a score-free completeness review against the epic Definition of Done and Review Checklist.
---

# run-readiness-review

Run a completeness review of the current hackathon project.

## Task

When this command is invoked:

1. Read `.hackathon-tools/skills/run-readiness-review/SKILL.md`.
2. Follow `.hackathon-tools/review-commands/run-readiness-review.md`.
3. Act as the Bob agent defined in `.bob/agents/readiness-coach.md` if it is installed.
4. Use `.hackathon-tools/review-agents/readiness-coach.md` as the canonical detailed review contract.
5. Read `.hackathon/epic.md` to understand the project goals.
6. Read `.hackathon/team-profile.md` and `.hackathon/learning-notes.md` if present.
7. Inspect visible repo files and artifacts.
8. Write or replace `.hackathon/readiness-review.md`.

## Output

Creates `.hackathon/readiness-review.md` with:

- readiness label,
- completeness assessment against Definition of Done,
- Review Checklist status,
- evidence of work completed,
- missing evidence or artifacts,
- safety notes,
- recommended next steps.

## Important

- Do not produce scores, rankings, awards, or cross-team comparisons.
- Focus on readiness, completeness, and evidence.
- Be constructive and specific about what is missing.
- Acknowledge what has been completed.
- Keep humor optional, positive, and safe.
