---
name: prepare-submission-prompt
description: Reusable prompt for preparing the participant submission bundle in Bob.
---

# prepare-hackathon-submission Prompt

```text
Run /prepare-hackathon-submission.

Use the project-local hackathon tools under .hackathon-tools/.
Show existing team-profile and learning-notes values before changing them.
Generate evidence-manifest.json, repo-summary.json, and changed-files.txt.
Validate generated JSON when possible.
Export the bundle to ~/dev/hackathon-submissions/team-slug__epic-slug/.
Do not include .hackathon/private/.
Do not include diff.patch.
Do not ask for AI session transcripts.
Record verification commands honestly as passed, failed, or not run.
```
