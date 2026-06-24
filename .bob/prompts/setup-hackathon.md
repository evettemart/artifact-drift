---
name: setup-hackathon-prompt
description: Reusable prompt for starting hackathon setup in Bob.
---

# setup-hackathon Prompt

Use this prompt after copying `.hackathon-tools/` into a team project and installing Bob commands and agents.

```text
Run /setup-hackathon using the project-local hackathon tools.

Use .hackathon-tools/ as the tooling source.
If .hackathon/epic.md already exists, show current values and let us keep or update them.
If this is a custom epic, interview us for the missing fields and map our story descriptions into the required structure.
When updating .gitignore, add .hackathon/ and also .hackathon-tools/ if that folder exists.
Do not create transcript folders.
```
