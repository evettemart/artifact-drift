---
name: readiness-review-prompt
description: Reusable prompt for running a score-free readiness review in Bob.
---

# run-readiness-review Prompt

```text
Run /run-readiness-review.

Use the readiness-coach agent behavior.
Compare the current repo against .hackathon/epic.md.
Inspect visible artifacts, README files, examples, tests, generated outputs, and relevant source files.
Write or replace .hackathon/readiness-review.md.
Do not produce a score, ranking, award, winner, loser, or cross-team comparison.
Be specific about missing evidence and next actions.
```
