---
name: hackathon-participant-flow
description: End-to-end participant workflow for setting up, reviewing, and preparing a hackathon submission.
steps:
  - set-up-bob-project-files
  - setup-hackathon
  - build-first-slice
  - run-readiness-review
  - prepare-hackathon-submission
---

# Hackathon Participant Flow

Use this workflow after the team has opened its project in Bob and copied the tools pack into `.hackathon-tools/`.

## 1. Set Up Bob Project Files

Copy or refresh the hackathon-managed `.bob/` directories from `.hackathon-tools/.bob/` into the project root `.bob/` folder. This workflow file is reference context for Bob, not a slash command.

Do this idempotently: repeat setup should refresh the same managed directories, not append duplicate files or create nested copies. Do not require Python, npm, or another runtime just to install these files.

If `.gitignore` exists, ask for approval to add `.hackathon/` and `.hackathon-tools/` when either entry is missing. If this setup created `.bob/` only for hackathon tooling, ask approval to add `.bob/` too. Do not create `.gitignore` solely for this setup step.

Read:

- `.hackathon-tools/AGENTS.md`
- `.hackathon-tools/.bob/context/hackathon-overview.md`
- `.hackathon-tools/.bob/context/file-map.md`

## 2. Set Up Epic Context

Run:

```text
/setup-hackathon
```

Expected output:

- `.hackathon/epic.md`
- `.hackathon/private/scratch.md`
- `.hackathon/hackathon-tooling-guide.md`
- `.gitignore` updated with `.hackathon/` and `.hackathon-tools/` when approved

## 3. Build First Slice

Ask Bob to propose a small first slice based on `.hackathon/epic.md`.

Prefer a small, inspectable artifact over broad unfinished work.

## 4. Run Readiness Review

Run:

```text
/run-readiness-review
```

Use the output as a working checklist.

## 5. Prepare Submission

Near the end, run:

```text
/prepare-hackathon-submission
```

Expected export:

```text
~/dev/hackathon-submissions/team-slug__epic-slug/
```
