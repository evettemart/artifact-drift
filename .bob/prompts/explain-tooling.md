---
name: explain-tooling-prompt
description: Reusable prompt for creating a participant-facing guide to automatic and manual hackathon tooling behavior.
---

# explain-tooling Prompt

```text
Create or update .hackathon/hackathon-tooling-guide.md.

Explain how the hackathon tooling works in this project and this harness.
Keep it short and participant-facing.

Include:
- what the harness will invoke or load automatically,
- what the team must run manually,
- when to run each tool,
- exactly how to invoke each manual tool in this harness,
- what each tool produces,
- what not to expect from the tooling.

If this is Bob and the .bob commands are installed, say that Bob exposes:
- /setup-hackathon
- /run-readiness-review
- /prepare-hackathon-submission

If the readiness-coach agent is installed, say Bob can use it automatically through /run-readiness-review or directly when asked.

If this is another harness without native slash commands, explain the manual prompt-based invocation pattern instead.

Do not include organizer-only workflows.
Do not include scores, rankings, awards, or cross-team comparison language.
```
