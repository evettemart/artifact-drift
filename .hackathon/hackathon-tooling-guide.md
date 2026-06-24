# Hackathon Tooling Guide

## Harness

- **Harness:** IBM Bob
- **Setup status:** Complete
- **Commands available:** `/setup-hackathon`, `/run-readiness-review`, `/prepare-hackathon-submission`
- **Agents available:** `readiness-coach`

## What Happens Automatically

Bob automatically loads and exposes hackathon tooling from the project's `.bob/` directory:

- **Slash commands** from `.bob/commands/` are available for direct invocation
- **Agent personas** from `.bob/agents/` can be used (e.g., "Use the readiness-coach agent to check my progress")
- **Context files** from `.bob/context/` provide shared hackathon context
- **Prompts** from `.bob/prompts/` support workflow execution
- **Templates** from `.bob/templates/` are used by commands
- **Schemas** from `.bob/schemas/` validate generated JSON
- **Scripts** from `.bob/scripts/` provide helper utilities
- **Workflows** from `.bob/workflows/` are passive reference files (not slash commands)
- **Mode-specific rules** from `.bob/rules-*` guide Bob's behavior in different modes

## What You Run Manually

You must manually choose when to run each hackathon workflow:

| When | Tool | How To Run | What It Produces |
|---|---|---|---|
| After choosing an epic | setup-hackathon | `/setup-hackathon` | `.hackathon/epic.md`, `.hackathon/private/scratch.md` |
| During build work | run-readiness-review | `/run-readiness-review` | `.hackathon/readiness-review.md` |
| Near the end | prepare-hackathon-submission | `/prepare-hackathon-submission` | Team metadata, evidence manifest, review bundle |

## Recommended Flow

1. **Initial Setup:** Run `/setup-hackathon` to choose your epic and create the project context
2. **Development:** Build your solution, referring to `.hackathon/epic.md` for requirements
3. **Progress Checks:** Run `/run-readiness-review` periodically to assess completeness (no scores, just readiness feedback)
4. **Final Submission:** Run `/prepare-hackathon-submission` to generate review evidence and export the submission bundle

## Notes

- Use fake data for all demonstrations and testing
- Do not expose customer data, secrets, tokens, or credentials
- Do not include AI session transcripts in submissions
- Participant-facing outputs are score-free and focused on readiness, completeness, and learning
- The `.hackathon/` and `.hackathon-tools/` directories should be added to `.gitignore` (you'll be prompted during `/setup-hackathon`)
- Files under `.bob/workflows/` are reference context, not executable slash commands