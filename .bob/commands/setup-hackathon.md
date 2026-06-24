---
name: setup-hackathon
description: Initialize or update the hackathon project by creating .hackathon/epic.md from an official or custom epic.
---

# setup-hackathon

Initialize or update the team's hackathon epic context.

## Task

When this command is invoked:

1. Read `.hackathon-tools/skills/setup-hackathon/SKILL.md`.
2. Follow `.hackathon-tools/review-commands/setup-hackathon.md`.
3. Use `.hackathon-tools/templates/hackathon/epic.md`.
4. For RTS epics, use source files under `.hackathon-tools/epics/rts/`.
5. For EnterpriseOS epics, use source files under `.hackathon-tools/epics/enterpriseos/`.
6. Create or update `.hackathon/epic.md` in the team project.
7. Create `.hackathon/private/scratch.md` if missing.
8. Create or update `.hackathon/hackathon-tooling-guide.md` using `.hackathon-tools/templates/hackathon/hackathon-tooling-guide.md`.
9. In the tooling guide, explain what Bob exposes automatically and what the team must run manually.
10. Ask before adding `.hackathon/` to `.gitignore`; default yes.
11. If `.hackathon-tools/` exists in the project, add `.hackathon-tools/` to `.gitignore` at the same time unless it is already present.
12. Keep the workflow idempotent.

## Output

Creates or updates:

- `.hackathon/epic.md`: the team's epic definition.
- `.hackathon/private/scratch.md`: private working notes.
- `.hackathon/hackathon-tooling-guide.md`: harness-specific usage guide.
- `.hackathon/review-criteria-concern.md`: only if the team disputes the Review Checklist.
- `.gitignore`: adds `.hackathon/` and, when present, `.hackathon-tools/` if approved.

## Important

- Show existing values when updating.
- Let the operator keep existing values.
- Do not create duplicate sections.
- Never create transcript folders.
- Do not ask teams to save or share AI session transcripts.
- For custom epics, interview for all required fields.
- Generate stretch goals and a Review Checklist.
- If the team disputes the Review Checklist, create `.hackathon/review-criteria-concern.md`.
