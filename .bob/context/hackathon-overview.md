---
name: hackathon-overview
description: Shared participant context for the RTS AI Hackathon tools.
---

# RTS AI Hackathon Context

This project uses the RTS AI Hackathon participant tooling.

The tooling is intentionally project-local. In a team project, the pack should live at:

```text
.hackathon-tools/
```

Bob-specific commands and agents should be installed into the project root:

```text
.bob/commands/
.bob/agents/
```

Install or refresh those files by copying the hackathon-managed directories from `.hackathon-tools/.bob/` into root `.bob/`. Repeat setup should refresh those same directories without creating duplicates or requiring Python/npm.

## Participant Workflows

- `/setup-hackathon`: create or update `.hackathon/epic.md`.
- `/run-readiness-review`: run a score-free readiness review and update `.hackathon/readiness-review.md`.
- `/prepare-hackathon-submission`: create final metadata and export a sanitized review bundle.

## Participant Boundaries

The participant tooling does not perform organizer review.

Do not produce:

- scores,
- rankings,
- awards,
- winners or losers,
- cross-team comparisons,
- organizer-only chronicle content.

## Safety

- Use fake data.
- Do not expose customer data.
- Do not expose secrets.
- Do not ask teams for AI session transcripts.
- Record verification commands honestly.
- Treat missing evidence as missing; do not invent evidence.
