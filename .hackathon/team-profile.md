# Team Profile

- Team name: Artifact Drift Team
- Team slug: artifact-drift-team
- Primary contact: Adrian Mora Lopez
- Team members: Adrian Mora Lopez, Valerio, Evette Martinez
- Epic selected: ARCH-002 — Infrastructure State Reconciliation System
- Epic source: Custom
- Products / areas touched: Terraform, AWS, Infrastructure as Code, AI-powered drift analysis
- Project repo: Labs/AI/artifact-drift
- Branch: main
- Preferred review path: Live demo
- Reuse/release interest: Yes

## Team Context

- AI experience mix: Mostly advanced
- Primary tools used: IBM Bob (agent mode), Claude 3.5 Sonnet (vision + analysis), AWS SDK, Anthropic SDK
- Primary goal for the hackathon: Build an end-to-end infrastructure drift detection tool that compares architecture intent (static diagrams), Terraform state, and live AWS inventory — with a polished web UI for visualizing and triaging findings
- Biggest constraint: Wiring all three data sources (image/LLM, Terraform state file, AWS SDK) into a single coherent scan pipeline while keeping mock fallbacks for demo reliability

## Safety And Data

- Real customer data used: No
- Real secrets used: No
- Any sensitive data concerns: The SQLite database (`backend/data/artifact-drift.db`) is in `.gitignore` and is not committed. All examples use synthetic/mock data. The `backend/.env` file with AWS credentials is in `.gitignore`. Integration `credentialsJson` is only stored locally in the dev database and is never logged or committed.

## Notes For Reviewers

The application runs fully in `DEMO_MODE=true` with no credentials required — all UI features (Graph, Drift, Dashboard, Reports) are functional with pre-generated mock data. To see live mode, set `DEMO_MODE=false` in `backend/.env` and optionally provide `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (falls back to mock inventory if absent) and `BOB_API_KEY`+`BOB_BASE_URL` or `ANTHROPIC_API_KEY` for the static-image LLM interpretation. All 8 drift types are detectable; a typical live scan against the mock inventory produces 45–64 structured findings. The three-layer graph (Planned / Terraform State / AWS Runtime) is the visual centrepiece and was the key integration challenge.
