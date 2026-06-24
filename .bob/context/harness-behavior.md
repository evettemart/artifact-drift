---
name: harness-behavior
description: How to explain automatic versus manual hackathon tooling behavior for different agent harnesses.
---

# Harness Behavior

Create `.hackathon/hackathon-tooling-guide.md` so the team knows how the tooling works in the active harness.

## Bob

If Bob commands are installed under project-root `.bob/commands/`, Bob should expose:

- `/setup-hackathon`
- `/run-readiness-review`
- `/prepare-hackathon-submission`

If Bob agents are installed under project-root `.bob/agents/`, Bob should be able to use:

- `readiness-coach`

Bob may also load project-specific support from:

- `.bob/context/`
- `.bob/prompts/`
- `.bob/workflows/` as passive reference context, not slash commands
- `.bob/templates/`
- `.bob/schemas/`
- `.bob/scripts/`
- `.bob/rules-*`

Install or refresh these files by copying the hackathon-managed directories from `.hackathon-tools/.bob/` into root `.bob/`. Repeat setup should refresh those same directories without creating duplicates or requiring Python/npm.

If `.gitignore` exists during Bob setup, Bob should ask for approval to add `.hackathon/` and `.hackathon-tools/` if either entry is missing. If Bob creates `.bob/` only for hackathon tooling, ask approval to add `.bob/` too. If `.bob/` already existed for the real project, do not add it unless the operator confirms it is only for hackathon tooling. If `.gitignore` does not exist, Bob should not create one only for harness setup.

Teams still manually choose when to run the three participant workflow commands.

## GitHub Copilot

Use only the project-root `.github/copilot-instructions.md` file for Copilot-specific guidance. If this adapter is installed, Copilot should automatically load that instruction file as project context.

Teams manually invoke the workflows by asking Copilot to run them using `.hackathon-tools/`.

## Claude Code

If `.claude/commands/` is installed from `harnesses/claude-code/.claude/commands/`, Claude Code may expose project-local slash commands:

- `/setup-hackathon`
- `/run-readiness-review`
- `/prepare-hackathon-submission`

If slash commands are not available, teams manually invoke the workflows by asking Claude Code to read `.hackathon-tools/AGENTS.md` and run the workflow by name.

## Codex

Use root `AGENTS.md` guidance, merged from `harnesses/codex/AGENTS.md` when needed. Codex workflows are manually invoked by asking Codex to run the workflow using `.hackathon-tools/`.

Do not require a global Codex skill install.

## Generic Harnesses

If the harness does not expose native slash commands, teams can still use the tooling by asking the agent to read the relevant files under `.hackathon-tools/`:

- `.hackathon-tools/skills/<workflow>/SKILL.md`
- `.hackathon-tools/review-commands/<workflow>.md`
- `.hackathon-tools/review-agents/readiness-coach.md`

Manual invocation examples:

```text
Run the project-local setup-hackathon workflow using .hackathon-tools/.
```

```text
Run the project-local run-readiness-review workflow using .hackathon-tools/.
```

```text
Run the project-local prepare-hackathon-submission workflow using .hackathon-tools/.
```

## Participant Boundaries

Do not include organizer-only workflows in the team guide.

Do not describe scores, rankings, awards, or cross-team comparisons as participant tooling.
