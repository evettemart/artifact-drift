# Build Prompt: Architecture Drift Copilot

## Role
You are a senior full-stack engineer and AI architect helping me build a hackathon MVP. Prioritize a clean, demoable, explainable app over completeness or cleverness.

## Goal
Build a working dashboard that compares **approved architecture intent** against **Terraform state/plan** and **live (or mocked) AWS resources**. The app detects architecture drift, explains the likely cause, assigns severity, and produces a downloadable report with recommended, Terraform-focused actions.

The hackathon theme is Agentic AI, but the core story stays centered on **HashiCorp Terraform**.

---

## Non-negotiable constraints (read first)

1. **Language: TypeScript everywhere.** React + TypeScript + Vite frontend; Node.js + TypeScript backend. Do **not** introduce Python. One language end-to-end.
2. **AWS is strictly read-only.** Only describe/list APIs. If no credentials are present, fall back to a mock inventory file automatically — the demo must never hard-fail.
3. **LLM input is a strict whitelist, not a blocklist.** The ReasoningAgent (Claude) may receive *only* a predefined, normalized drift-finding object (fields enumerated below). Raw Terraform state, secrets, credentials, access keys, connection strings, or full resource attributes must **never** reach the LLM. A whitelist is the enforcement mechanism, not after-the-fact redaction.
4. **Local files first.** Read `architecture.yaml`, Terraform JSON, and AWS mock inventory from disk. Confluence/HCP/Slack are placeholder connectors only.
5. **Reports are generated on the fly and never stored.** Store findings and run metadata in SQLite; regenerate report artifacts (PDF/HTML/JSON) on request.
6. **Deterministic where accuracy matters.** Drift *detection* is deterministic code. The LLM is used *only after* detection, for explanation/severity narrative/remediation prose. If no LLM key is present, degrade to a deterministic template summary.
7. **Two explicit modes, identical UI.** The app runs in **Mock Mode** (`DEMO_MODE=true`, default) or **Live Mode** (`DEMO_MODE=false`), and both expose the exact same screens and full feature set.
   - **Mock Mode uses pre-generated mock data only** — no AWS SDK calls, no LLM calls, no Terraform CLI, no network dependencies. All functionality (dashboard, findings, graph, reports, filtering, download) must remain visible and fully working.
   - **Live Mode** reads the real `architecture.yaml`, Terraform JSON, and AWS read-only inventory (with automatic mock-inventory fallback), and uses the LLM when a key is present. Switching modes changes only the data source, never the available features.

---

## Step 0: Plan before coding (do this first)

Before writing any application code, produce a short implementation plan covering:
- recommended architecture
- folder structure
- libraries (with rationale)
- exact setup commands
- MVP milestones (ordered)
- risks and trade-offs

Pause after the plan so I can confirm or adjust. Then build incrementally, milestone by milestone.

---

## Scope split

### MVP (demo-critical — build this first, end to end)
The narrative thread that must work for the demo:
1. One project, one scan, three sources (architecture intent, Terraform, AWS).
2. Normalize all three into one internal schema.
3. Deterministic drift detection across the three.
4. LLM (or deterministic fallback) reasoning over each finding.
5. Dashboard + drift list + interactive graph.
6. Generate and download a report (start with HTML + JSON; PDF if time allows).
7. Seed demo data that clearly shows Terraform and AWS diverging from the approved design.

### Stretch (only after MVP works end to end)
- Multi-project / multi-scan management UI (create projects, configure per-scan integrations in Settings).
- Integrations CRUD (architecture diagram source, infra provider, state backend selection).
- Drift status workflow (open / acknowledged / resolved / suppressed) editable in UI.
- User-editable severity weights.
- PDF export (if not done in MVP), draw.io XML parsing.
- Placeholder connectors: Confluence, HCP Terraform, Slack.

### Explicitly out of scope
- Deriving architecture from PNG/JPEG diagrams (no vision/OCR). draw.io **XML** parsing only, and only as stretch.
- GCP or any non-AWS provider beyond the schema leaving room for it.
- Autonomous/looping agents. The "agents" are modules; only ReasoningAgent calls an LLM, once per finding (or batched).

---

## Input sources

**1. Approved architecture intent**
- Primary: `architecture.yaml` describing expected VPCs, subnets, security groups, EC2 instances, ALBs, tags, regions, ownership.
- Placeholder Confluence connector (stub interface, returns the local file in MVP).

**2. Terraform source**
- Read `terraform show -json` output from a local file.
- Optionally, if Terraform CLI is available, run `terraform plan -refresh-only -out=tfplan` then `terraform show -json tfplan`.
- Parse only the fields needed for comparison; redact sensitive values at parse time, before they enter app state.

**3. AWS source**
- AWS SDK read-only APIs for EC2, VPC, ELBv2, IAM where practical.
- `aws-mock-inventory.json` for demo mode; auto-used when no credentials.
- Normalize into the same internal schema as the other two sources.

---

## Agents (modules/classes — deterministic unless noted)

- **DesignIntentAgent** — `architecture.yaml` → normalized desired-architecture objects.
- **TerraformStateAgent** — Terraform JSON → normalized Terraform-managed objects.
- **AWSInventoryAgent** — live/mock AWS inventory → normalized runtime objects.
- **DriftAnalysisAgent** — deterministic comparison of intent vs Terraform vs AWS. Detects:
  - missing resource in Terraform
  - missing resource in AWS
  - unmanaged AWS resource (in AWS, not in Terraform)
  - Terraform-managed resource changed outside Terraform
  - tag mismatch
  - security group rule mismatch
  - region mismatch
  - resource exists but does not match approved design
- **ReasoningAgent** — Claude, called only on the whitelisted finding object. Produces: plain-English summary, severity (low/medium/high/critical), likely cause, recommended action, Terraform-focused remediation, business impact. Falls back to a deterministic template if no API key.

### ReasoningAgent input whitelist (the ONLY fields sent to the LLM)
```
{
  findingId, driftType, resourceType, provider, region,
  logicalName,            // not raw ARNs/IDs
  expected: { <non-sensitive normalized fields> },
  observed: { <non-sensitive normalized fields> },
  diffSummary: string     // pre-computed, redacted
}
```
No raw state, no ARNs/account IDs, no tag *values* that may contain secrets, no attribute blobs.

---

## Data model (normalized resource schema)
`id`, `logicalName`, `type`, `provider`, `region`, `source` (intent|terraform|aws), `attributes`, `tags`, `relationships`, `sensitiveRedacted` (bool).

---

## Drift model
- **severity:** critical | high | medium | low
- **type:** missing | unexpected | attribute | edge | other
- **status:** open | acknowledged | resolved | suppressed (editable in UI — stretch)
- Each drift has: stable `driftId`, identified resource, expected-vs-observed diff, detail view in UI.

---

## Scan & scoring
- A scan uses one or more integrations of a project, runs detection, and returns a **compliance score**.
- **Default severity weights:** critical `-25`, high `-10`, medium `-4`, low `-1`, info/none `0`. (Name the fifth class explicitly in code, e.g. `info`.)
- **Score formula (state explicitly, don't improvise):**
  `score = max(0, 100 + Σ(weight per drift))`, clamped to 0–100.
- Scan records: id, start time, finish time, duration, list of drifts, score.
- Weights user-editable (stretch).

---

## Graph
- Generate a graph model per source (Planned Architecture, Terraform State, Deployed Infrastructure), stored as JSON, linked to a scan id.
- Render interactively with **React Flow** (click a node → resource details + drift info). Use **Mermaid only for static docs/README**, not the interactive view.
- Resources with detected drift are visually flagged in the diagram.

---

## Frontend sections
- **Dashboard** (default view): stats for latest scan — total resources, matched, drifted, unmanaged, missing; chart of drifts per severity; chart of drifts per class (security, network, …).
- **Graph:** three views (Planned / Terraform / Deployed), clickable nodes.
- **Drift:** filterable list with detail panels; status editing (stretch).
- **Integrations:** configure sources (stretch CRUD).
- **Reports:** per-scan graph + drifts, with download.
- **Settings:** project/scan creation, severity-weight editing (stretch).

---

## Backend API
- `GET /api/health`
- `POST /api/analyze` — run a scan
- `GET /api/findings`
- `GET /api/report` — generate on the fly (`?format=html|json|pdf`)
- `GET /api/resources`

---

## Storage (SQLite)
Persist: analysis run id, timestamp, input source versions/checksums, findings, scan metadata/score. **Do not persist raw secrets or generated reports.**

---

## Security (include `SECURITY.md`)
- Never persist raw secrets.
- Redact token/password/private-key/access-key/connection-string-shaped values at ingestion.
- LLM receives only the whitelisted finding object — document the whitelist in `SECURITY.md`.
- Read-only AWS; mock fallback.

---

## Deliverables
- Working app + seed demo data.
- `README.md` with setup + demo script.
- `PROJECT_SPEC.md`.
- `SECURITY.md`.
- Mermaid architecture diagram (docs).
- Example `architecture.yaml`, example Terraform JSON, example `aws-mock-inventory.json`.
- Example generated report.

---

## Demo story
1. Show approved architecture. 2. Show Terraform state. 3. Show AWS runtime. 4. Run analysis. 5. Show Terraform and AWS diverging from the approved LLD. 6. Generate a report explaining what drifted and what to fix. 7. Explain future integration with Confluence, HCP Terraform, AWS, and Slack.

---

**Begin with Step 0 (the plan). Do not write application code until I confirm the plan.**