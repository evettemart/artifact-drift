# Architecture Drift Copilot - Project Specification

## Executive Summary

**Architecture Drift Copilot** is a TypeScript-based dashboard application that detects and explains infrastructure drift by comparing approved architecture intent against Terraform state and live AWS resources. The system uses deterministic drift detection with optional LLM-powered reasoning to provide actionable, Terraform-focused remediation guidance.

**Hackathon Theme**: Agentic AI  
**Core Technology Focus**: HashiCorp Terraform  
**Target Audience**: Platform engineers, DevOps teams, infrastructure architects

---

## Project Goals

### Primary Goal
Build a working MVP that demonstrates end-to-end drift detection and reporting:
1. Parse three sources: architecture intent (YAML), Terraform state (JSON), AWS resources (SDK/mock)
2. Detect drift deterministically across all three sources
3. Generate human-readable explanations with severity and remediation steps
4. Present findings in an interactive dashboard with downloadable reports

### Success Criteria
- ✅ Demo runs without AWS credentials (mock fallback)
- ✅ Demo runs without LLM API key (deterministic fallback)
- ✅ Clear visualization of drift with actionable remediation
- ✅ Compliance score calculation
- ✅ Downloadable reports (HTML + JSON minimum)

---

## Non-Negotiable Constraints

### 1. TypeScript Everywhere
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + TypeScript + Express
- **No Python**: Single language end-to-end for simplicity

### 2. AWS Read-Only
- Only `describe*` and `list*` APIs
- Auto-fallback to mock inventory when no credentials
- Demo must never fail due to missing AWS access

### 3. LLM Input Whitelist (Security Critical)
- ReasoningAgent receives ONLY whitelisted fields
- No raw Terraform state, secrets, credentials, ARNs, or account IDs
- Whitelist enforcement, not blocklist redaction
- See `SECURITY.md` for complete whitelist specification

### 4. Local Files First
- Read `architecture.yaml`, Terraform JSON, AWS mock from disk
- Confluence/HCP/Slack are placeholder connectors only (MVP)

### 5. Reports Generated On-Demand
- Store findings and metadata in SQLite
- Generate report artifacts (HTML/JSON/PDF) on request
- Never persist generated reports

### 6. Deterministic Core
- Drift detection is pure code (no LLM)
- LLM used only for explanation/narrative after detection
- Graceful degradation to deterministic templates

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                      │
│  Dashboard │ Graph View │ Drift List │ Reports │ Settings       │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────┴────────────────────────────────────┐
│                   Backend (Node.js + Express)                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Agent Orchestrator                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────┬───────────┴───────────┬──────────────┐       │
│  │              │                       │              │       │
│  │ DesignIntent │  TerraformState      │ AWSInventory │       │
│  │ Agent        │  Agent               │ Agent        │       │
│  │              │  (Redaction)         │ (Mock OK)    │       │
│  └──────┬───────┴───────────┬───────────┴──────┬───────┘       │
│         │                   │                  │               │
│         └───────────────────┼──────────────────┘               │
│                             │                                    │
│                    ┌────────┴─────────┐                         │
│                    │ DriftAnalysis    │                         │
│                    │ Agent            │                         │
│                    │ (Deterministic)  │                         │
│                    └────────┬─────────┘                         │
│                             │                                    │
│                    ┌────────┴─────────┐                         │
│                    │ Reasoning        │                         │
│                    │ Agent            │                         │
│                    │ (LLM/Fallback)   │                         │
│                    └──────────────────┘                         │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    SQLite Database                       │   │
│  │  Scans │ Findings │ Resources │ Metadata                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘

External:
  - architecture.yaml (local file)
  - terraform.json (local file or CLI)
  - aws-mock-inventory.json (fallback)
  - AWS SDK (optional, read-only)
  - Claude API (optional, for reasoning)
```

### Data Flow

```
1. INPUT COLLECTION
   architecture.yaml → DesignIntentAgent → NormalizedResource[] (Intent)
   terraform.json    → TerraformStateAgent → NormalizedResource[] (Terraform)
   AWS/Mock          → AWSInventoryAgent   → NormalizedResource[] (AWS)

2. DRIFT DETECTION (Deterministic)
   3x NormalizedResource[] → DriftAnalysisAgent → DriftFinding[]
                                                 → Statistics
                                                 → ComplianceScore

3. REASONING (LLM or Fallback)
   DriftFinding[] → WhitelistedFinding[] → ReasoningAgent → ReasoningResult[]

4. PRESENTATION
   DriftFinding[] + ReasoningResult[] → Dashboard
                                       → Graph (React Flow)
                                       → Reports (HTML/JSON/PDF)
```

---

## Scope Definition

### MVP Scope (Demo-Critical)

**Must Have for Demo:**

1. **Single Project, Single Scan**
   - One hardcoded project
   - Run scan on demand
   - Three input sources working

2. **Drift Detection**
   - All 8 drift types detected
   - Deterministic comparison logic
   - Compliance score calculation

3. **Dashboard**
   - Latest scan statistics
   - Drift count by severity
   - Drift count by type
   - Resource summary

4. **Graph Visualization**
   - Three views: Planned / Terraform / Deployed
   - Interactive nodes (React Flow)
   - Visual drift indicators

5. **Drift List**
   - Filterable by severity/type
   - Detail panels for each finding
   - Reasoning display

6. **Reports**
   - HTML export
   - JSON export
   - Download functionality

7. **Demo Data**
   - Example architecture.yaml
   - Example terraform.json
   - Example aws-mock-inventory.json
   - Clear drift scenarios

### Stretch Goals (Post-MVP)

**Nice to Have:**

1. **Multi-Project Management**
   - Create/edit projects
   - Project settings
   - Multiple scans per project

2. **Integrations CRUD**
   - Configure architecture source
   - Configure Terraform backend
   - Configure AWS regions

3. **Drift Workflow**
   - Edit drift status (open/acknowledged/resolved/suppressed)
   - Add notes to findings
   - Track resolution history

4. **Advanced Features**
   - User-editable severity weights
   - PDF export
   - draw.io XML parsing
   - Confluence connector
   - HCP Terraform connector
   - Slack notifications

### Explicitly Out of Scope

**Will Not Build:**

- PNG/JPEG diagram parsing (no OCR/vision)
- GCP or Azure providers
- Autonomous/looping agents
- Real-time monitoring
- Auto-remediation execution
- User authentication (single-user MVP)
- Multi-tenancy

---

## Technical Specifications

### Technology Stack

#### Frontend
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **State Management**: React Query (TanStack Query)
- **Routing**: React Router v6
- **Graph Visualization**: React Flow
- **Charts**: Recharts
- **HTTP Client**: Axios

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: SQLite with better-sqlite3
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **LLM Client**: @anthropic-ai/sdk
- **AWS SDK**: @aws-sdk/client-ec2, @aws-sdk/client-elastic-load-balancing-v2

#### Development Tools
- **Package Manager**: pnpm
- **Linting**: ESLint + Prettier
- **Type Checking**: TypeScript strict mode
- **Testing**: Vitest + React Testing Library
- **API Testing**: Supertest

### Project Structure

```
architecture-drift-copilot/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── dashboard/
│   │   │   ├── graph/
│   │   │   ├── drift/
│   │   │   ├── reports/
│   │   │   └── ui/            # shadcn/ui components
│   │   ├── pages/             # Page components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities
│   │   ├── types/             # TypeScript types
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # Node.js + Express backend
│   ├── src/
│   │   ├── agents/            # Agent implementations
│   │   │   ├── design-intent-agent.ts
│   │   │   ├── terraform-state-agent.ts
│   │   │   ├── aws-inventory-agent.ts
│   │   │   ├── drift-analysis-agent.ts
│   │   │   └── reasoning-agent.ts
│   │   ├── api/               # Express routes
│   │   │   ├── health.ts
│   │   │   ├── analyze.ts
│   │   │   ├── findings.ts
│   │   │   ├── reports.ts
│   │   │   └── resources.ts
│   │   ├── db/                # Database
│   │   │   ├── schema.ts      # Drizzle schema
│   │   │   └── client.ts
│   │   ├── services/          # Business logic
│   │   ├── utils/             # Utilities
│   │   ├── types/             # Shared types
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
│
├── examples/                    # Demo data
│   ├── architecture.yaml
│   ├── terraform-state.json
│   └── aws-mock-inventory.json
│
├── docs/                        # Documentation
│   ├── agents/                 # Agent specifications
│   │   ├── README.md
│   │   ├── shared-types.md
│   │   ├── design-intent-agent.md
│   │   ├── terraform-state-agent.md
│   │   ├── aws-inventory-agent.md
│   │   ├── drift-analysis-agent.md
│   │   └── reasoning-agent.md
│   └── architecture.md         # Mermaid diagrams
│
├── README.md                    # Setup + demo script
├── PROJECT_SPEC.md             # This file
├── BUILD_PLAN.md               # Implementation plan
├── SECURITY.md                 # Security documentation
├── package.json                # Root workspace config
└── pnpm-workspace.yaml         # pnpm workspace config
```

---

## Data Models

### Normalized Resource Schema

```typescript
interface NormalizedResource {
  id: string;                    // Unique identifier
  logicalName: string;           // Human-readable name (not ARN)
  type: ResourceType;            // vpc, subnet, ec2_instance, etc.
  provider: Provider;            // aws, gcp, azure
  region: string;                // AWS region
  source: ResourceSource;        // intent, terraform, aws
  attributes: Record<string, any>; // Non-sensitive attributes
  tags: Record<string, string>;  // Resource tags
  relationships: ResourceRelationship[];
  sensitiveRedacted: boolean;    // Flag if redaction occurred
  metadata: ResourceMetadata;    // Source tracking
}
```

### Drift Finding Schema

```typescript
interface DriftFinding {
  driftId: string;               // Unique drift identifier
  driftType: DriftType;          // missing, unmanaged, changed, etc.
  severity: Severity;            // critical, high, medium, low, info
  status: DriftStatus;           // open, acknowledged, resolved, suppressed
  resourceType: ResourceType;
  provider: Provider;
  region: string;
  logicalName: string;
  expected: Partial<NormalizedResource> | null;
  observed: Partial<NormalizedResource> | null;
  diffSummary: string;           // Pre-computed, redacted
  attributeDiffs: AttributeDiff[];
  detectedAt: string;            // ISO timestamp
  scanId: string;
  reasoning?: ReasoningResult;   // From ReasoningAgent
}
```

### Whitelisted Finding (LLM Input)

```typescript
interface WhitelistedFinding {
  findingId: string;
  driftType: DriftType;
  resourceType: ResourceType;
  provider: Provider;
  region: string;
  logicalName: string;           // NEVER physical IDs or ARNs
  expected: WhitelistedAttributes;
  observed: WhitelistedAttributes;
  diffSummary: string;           // Pre-computed, redacted
}

interface WhitelistedAttributes {
  type?: string;
  region?: string;
  cidrBlocks?: string[];
  ports?: number[];
  protocol?: string;
  instanceType?: string;
  availabilityZones?: string[];
  tagKeys?: string[];            // Keys only, never values
  count?: number;
  flags?: Record<string, boolean>;
  // NO ARNs, IDs, secrets, credentials, connection strings
}
```

### Scan Result Schema

```typescript
interface ScanResult {
  scanId: string;
  projectId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  complianceScore: number;       // 0-100
  findings: DriftFinding[];
  statistics: ScanStatistics;
  sources: SourceMetadata;
  config: ScanConfig;
}
```

---

## API Specification

### REST Endpoints

#### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-23T10:00:00Z",
  "version": "1.0.0"
}
```

#### `POST /api/analyze`
Run a drift analysis scan.

**Request Body:**
```json
{
  "projectId": "default",
  "config": {
    "enableLLMReasoning": true,
    "regions": ["us-east-1"],
    "detectUnmanaged": true
  }
}
```

**Response:**
```json
{
  "scanId": "scan-123",
  "status": "completed",
  "complianceScore": 75,
  "findingsCount": 12,
  "durationMs": 5432
}
```

#### `GET /api/findings?scanId={scanId}`
Get findings for a scan.

**Query Parameters:**
- `scanId` (required): Scan identifier
- `severity` (optional): Filter by severity
- `type` (optional): Filter by drift type

**Response:**
```json
{
  "scanId": "scan-123",
  "findings": [
    {
      "driftId": "drift-456",
      "driftType": "changed_outside_terraform",
      "severity": "high",
      "resourceType": "security_group",
      "logicalName": "web-sg",
      "diffSummary": "Port 22 added to security group",
      "reasoning": {
        "summary": "SSH port opened manually",
        "likelyCause": "Manual change in AWS console",
        "terraformRemediation": "Update security group rules in Terraform"
      }
    }
  ]
}
```

#### `GET /api/resources?scanId={scanId}&source={source}`
Get resources for a scan.

**Query Parameters:**
- `scanId` (required): Scan identifier
- `source` (optional): Filter by source (intent, terraform, aws)

**Response:**
```json
{
  "scanId": "scan-123",
  "source": "terraform",
  "resources": [
    {
      "id": "terraform-vpc-main",
      "logicalName": "main-vpc",
      "type": "vpc",
      "region": "us-east-1",
      "attributes": {
        "cidrBlock": "10.0.0.0/16"
      }
    }
  ]
}
```

#### `GET /api/report?scanId={scanId}&format={format}`
Generate and download a report.

**Query Parameters:**
- `scanId` (required): Scan identifier
- `format` (required): html | json | pdf

**Response:**
- HTML: Returns HTML document
- JSON: Returns JSON report
- PDF: Returns PDF file (stretch goal)

---

## Security Specifications

### Threat Model

**Assets to Protect:**
1. AWS credentials and access keys
2. Terraform state (may contain secrets)
3. Database connection strings
4. API keys and tokens
5. Private keys and certificates

**Attack Vectors:**
1. LLM prompt injection with sensitive data
2. Accidental logging of secrets
3. Database exposure
4. Report generation leaking secrets

### Security Controls

#### 1. Ingestion-Time Redaction
- TerraformStateAgent redacts before data enters memory
- Pattern-based detection (keys, passwords, connection strings)
- Field-name based detection (password, secret, token, etc.)
- Terraform-marked sensitive fields

#### 2. Whitelist Enforcement
- ReasoningAgent validates input at runtime
- Only whitelisted fields accepted
- Rejects any additional fields
- Checks for sensitive patterns

#### 3. No Secret Persistence
- SQLite stores only redacted data
- Reports generated on-demand
- No caching of sensitive data

#### 4. Read-Only AWS
- Only describe/list APIs
- No modify/delete operations
- Mock fallback for demos

### Compliance Score Formula

```
score = max(0, min(100, 100 + Σ(weight per drift)))

Default Weights:
- critical: -25
- high: -10
- medium: -4
- low: -1
- info: 0

Example:
2 critical + 3 high + 5 medium = 100 + (2×-25 + 3×-10 + 5×-4) = 100 - 100 = 0
1 high + 2 medium = 100 + (1×-10 + 2×-4) = 100 - 18 = 82
```

---

## Deliverables

### Code Deliverables
1. ✅ Working frontend application
2. ✅ Working backend API
3. ✅ Agent implementations
4. ✅ Database schema and migrations
5. ✅ Example data files

### Documentation Deliverables
1. ✅ README.md with setup instructions
2. ✅ PROJECT_SPEC.md (this file)
3. ✅ BUILD_PLAN.md with milestones
4. ✅ SECURITY.md with whitelist specification
5. ✅ Agent specifications (docs/agents/)
6. ✅ Mermaid architecture diagrams

### Demo Deliverables
1. ✅ Example architecture.yaml
2. ✅ Example terraform-state.json
3. ✅ Example aws-mock-inventory.json
4. ✅ Example generated report
5. ✅ Demo script

---

## Demo Story

### Demo Flow (5-7 minutes)

1. **Show Approved Architecture** (1 min)
   - Display architecture.yaml
   - Explain expected infrastructure

2. **Show Terraform State** (1 min)
   - Display terraform-state.json
   - Highlight managed resources

3. **Show AWS Runtime** (1 min)
   - Display aws-mock-inventory.json
   - Show actual deployed resources

4. **Run Analysis** (1 min)
   - Click "Run Scan" button
   - Show progress indicator
   - Display compliance score

5. **Show Drift** (2 min)
   - Dashboard with statistics
   - Graph visualization with drift indicators
   - Drill into specific findings
   - Show LLM-generated reasoning

6. **Generate Report** (1 min)
   - Download HTML report
   - Show formatted findings
   - Highlight Terraform remediation steps

7. **Explain Future** (1 min)
   - Confluence integration for architecture
   - HCP Terraform for state
   - Live AWS scanning
   - Slack notifications

### Key Demo Points

**Emphasize:**
- ✅ Works without AWS credentials (mock fallback)
- ✅ Works without LLM key (deterministic fallback)
- ✅ Security-first design (whitelist enforcement)
- ✅ Terraform-focused remediation
- ✅ Actionable insights, not just detection

**Avoid:**
- ❌ Technical implementation details
- ❌ Code walkthrough
- ❌ Database schema
- ❌ API endpoints

---

## Success Metrics

### Technical Metrics
- ✅ All 8 drift types detected correctly
- ✅ Compliance score calculation accurate
- ✅ No secrets in LLM input (validated by tests)
- ✅ Demo runs in < 5 seconds
- ✅ Reports generate in < 2 seconds

### User Experience Metrics
- ✅ Dashboard loads in < 1 second
- ✅ Graph renders smoothly (60 FPS)
- ✅ Findings filterable and searchable
- ✅ Reports are readable and actionable

### Demo Metrics
- ✅ Setup time < 5 minutes
- ✅ Demo runs without errors
- ✅ Drift clearly visible
- ✅ Remediation steps clear

---

## Risks and Mitigations

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| LLM API rate limits | High | Medium | Implement batching, caching, fallback |
| Large Terraform state parsing | Medium | High | Stream parsing, pagination |
| Graph rendering performance | Medium | Medium | Virtualization, lazy loading |
| SQLite concurrency | Low | Low | Single-writer pattern |

### Demo Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| No internet for LLM | High | Low | Deterministic fallback |
| No AWS credentials | High | Low | Mock inventory fallback |
| Demo data not showing drift | High | Low | Carefully crafted examples |
| Performance issues | Medium | Low | Pre-run scan, cache results |

### Schedule Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Scope creep | High | High | Strict MVP focus |
| Integration complexity | Medium | Medium | Incremental testing |
| UI polish time | Low | High | Use component library |

---

## Future Roadmap

### Phase 2 (Post-Hackathon)
- Multi-project management
- Drift workflow (status editing)
- User-editable severity weights
- PDF export
- Confluence integration

### Phase 3 (Production)
- User authentication
- Multi-tenancy
- Real-time monitoring
- Auto-remediation suggestions
- Drift trends and analytics

### Phase 4 (Enterprise)
- GCP and Azure support
- Custom drift rules
- Compliance frameworks (SOC2, HIPAA)
- Audit logging
- RBAC

---

## Appendix

### Glossary

- **Drift**: Divergence between expected and actual infrastructure state
- **Intent**: Approved architecture design (architecture.yaml)
- **Normalized Resource**: Canonical internal representation
- **Whitelisted Finding**: Security-filtered drift data for LLM
- **Compliance Score**: 0-100 metric based on drift severity

### References

- [Terraform Documentation](https://www.terraform.io/docs)
- [AWS SDK for JavaScript](https://docs.aws.amazon.com/sdk-for-javascript/)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [React Flow Documentation](https://reactflow.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)

### Version History

- v1.0.0 (2026-06-23): Initial specification