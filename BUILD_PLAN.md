# Architecture Drift Copilot - Build Plan

## Overview

This document outlines the step-by-step implementation plan for building the Architecture Drift Copilot MVP. The plan is organized into milestones that should be completed sequentially, with each milestone producing a working, testable increment.

**Total Estimated Time**: 3-4 days for MVP  
**Approach**: Demo-first with mock data, then integrate real components  
**Testing**: Test each milestone before proceeding

**Key Strategy Change**: Build the demo environment with mock data FIRST to enable rapid iteration and testing without external dependencies (AWS credentials, LLM API keys, etc.).

---

## Milestone 0: Demo Environment Setup (2 hours)

**Goal**: Create a complete demo environment with mock data that demonstrates all drift types before building any agents.

### Why Demo-First?

1. **Faster Feedback**: See the end result immediately
2. **No Dependencies**: Works without AWS credentials or LLM API keys
3. **Clear Requirements**: Mock data defines exact agent outputs needed
4. **Parallel Development**: Frontend and backend can work independently
5. **Demo-Ready**: Always have a working demo to show

### Tasks

#### 0.1 Project Initialization (20 minutes)

```bash
# 1. Initialize project
mkdir architecture-drift-copilot
cd architecture-drift-copilot

# 2. Initialize pnpm workspace
pnpm init
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'frontend'
  - 'backend'
EOF

# 3. Create frontend
pnpm create vite frontend -- --template react-ts
cd frontend
pnpm install
cd ..

# 4. Create backend
mkdir backend
cd backend
pnpm init
pnpm add express cors dotenv
pnpm add -D typescript @types/node @types/express @types/cors tsx nodemon
npx tsc --init
cd ..

# 5. Install root dependencies
pnpm add -D prettier eslint

# 6. Create directory structure
mkdir -p backend/src/{api,db,services,utils,types}
mkdir -p backend/data/mock
mkdir -p frontend/src/{components,pages,hooks,lib,types}
mkdir -p examples docs/agents
```

#### 0.2 Create Mock Data Files (40 minutes)

**Create comprehensive mock data that demonstrates all 8 drift types:**

```bash
# examples/architecture.yaml
```

**Implement:**
- [ ] VPC with CIDR 10.0.0.0/16
- [ ] Public subnet in us-east-1a
- [ ] Private subnet in us-east-1b
- [ ] Security group "web-sg" with ports 80, 443
- [ ] EC2 instance "web-server" (t3.medium)
- [ ] Application Load Balancer "web-alb"
- [ ] Tags: Environment=production, ManagedBy=terraform

```bash
# examples/terraform-state.json
```

**Implement:**
- [ ] Same VPC, subnets, security group
- [ ] EC2 instance present
- [ ] ALB present
- [ ] **Missing**: One subnet (to demonstrate MISSING drift)
- [ ] **Different**: Instance type is t3.small (to demonstrate ATTRIBUTE_MISMATCH)
- [ ] Tags match architecture

```bash
# examples/aws-mock-inventory.json
```

**Implement:**
- [ ] Same VPC, subnets
- [ ] Security group with **extra port 22** (to demonstrate CHANGED_OUTSIDE_TERRAFORM)
- [ ] EC2 instance with **wrong instance type** t3.large (to demonstrate ATTRIBUTE_MISMATCH)
- [ ] **Extra security group** "debug-sg" not in Terraform (to demonstrate UNMANAGED)
- [ ] **Missing tag** Environment on VPC (to demonstrate TAG_MISMATCH)
- [ ] ALB present but with different attributes

**Drift Scenarios to Demonstrate:**
1. ✅ MISSING - Subnet in intent/terraform but not in AWS
2. ✅ UNMANAGED - Security group in AWS but not in Terraform
3. ✅ CHANGED_OUTSIDE_TERRAFORM - Port 22 added to security group
4. ✅ ATTRIBUTE_MISMATCH - Instance type differs between sources
5. ✅ TAG_MISMATCH - Missing Environment tag on VPC
6. ✅ CONFIGURATION_DRIFT - ALB attributes differ
7. ✅ RELATIONSHIP_BROKEN - (Optional) Subnet not attached to VPC
8. ✅ VERSION_MISMATCH - (Optional) Different Terraform provider versions

#### 0.3 Create Mock API Responses (30 minutes)

```bash
# backend/data/mock/scan-result.json
```

**Implement:**
- [ ] Complete scan result with all findings
- [ ] Pre-computed compliance score (e.g., 68/100)
- [ ] Statistics (12 findings: 2 critical, 3 high, 5 medium, 2 low)
- [ ] Reasoning results for each finding (deterministic templates)

```bash
# backend/data/mock/findings.json
```

**Implement:**
- [ ] Array of 12 drift findings
- [ ] Each finding has:
  - driftId, driftType, severity, status
  - resourceType, logicalName, region
  - diffSummary (human-readable)
  - reasoning (summary, likelyCause, terraformRemediation)

```bash
# backend/data/mock/resources.json
```

**Implement:**
- [ ] Three arrays: intentResources, terraformResources, awsResources
- [ ] Each resource normalized to same schema
- [ ] Clear differences visible for drift detection

#### 0.4 Basic Express Server with Mock Endpoints (30 minutes)

```bash
# backend/src/server.ts
```

**Implement:**
- [ ] Express app setup with CORS
- [ ] Health check endpoint
- [ ] Mock endpoints that return pre-generated data:
  - `POST /api/analyze` → returns mock scan-result.json
  - `GET /api/findings` → returns mock findings.json
  - `GET /api/resources` → returns mock resources.json
  - `GET /api/scans` → returns mock scan list
  - `GET /api/report` → generates report from mock data

**Test:**
```bash
cd backend
pnpm dev
curl http://localhost:3001/api/health
curl -X POST http://localhost:3001/api/analyze
curl http://localhost:3001/api/findings?scanId=mock-scan-1
```

**Deliverable**: Working backend serving mock data, complete demo data files showing all drift types.

---

## Milestone 1: Foundation & Types (3 hours)

**Goal**: Set up project structure, shared types, and database schema.

### Tasks

#### 1.1 Shared Types (1 hour)

```bash
# backend/src/types/shared.ts
```

**Implement:**
- [ ] Copy type definitions from `docs/agents/shared-types.md`
- [ ] Create enums: `ResourceType`, `DriftType`, `Severity`, `Provider`, `DriftStatus`
- [ ] Define interfaces: `NormalizedResource`, `DriftFinding`, `WhitelistedFinding`, `ReasoningResult`
- [ ] Add utility types: `Result<T, E>`, `ValidationError`

**Test:**
```typescript
// backend/src/types/shared.test.ts
import { describe, it, expect } from 'vitest';
import { ResourceType, Severity } from './shared';

describe('Shared Types', () => {
  it('should have all resource types', () => {
    expect(ResourceType.VPC).toBe('vpc');
    expect(ResourceType.EC2_INSTANCE).toBe('ec2_instance');
  });
});
```

#### 1.2 Database Setup (1.5 hours)

```bash
# backend/src/db/schema.ts
```

**Implement:**
- [ ] Install Drizzle ORM: `pnpm add drizzle-orm better-sqlite3`
- [ ] Install dev deps: `pnpm add -D drizzle-kit @types/better-sqlite3`
- [ ] Define schema: `scans`, `findings`, `resources` tables
- [ ] Create database client
- [ ] Add migration script

**Schema:**
```typescript
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const scans = sqliteTable('scans', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  durationMs: integer('duration_ms'),
  complianceScore: real('compliance_score'),
  status: text('status').notNull(), // running, completed, failed
  config: text('config'), // JSON
  metadata: text('metadata'), // JSON
});

export const findings = sqliteTable('findings', {
  id: text('id').primaryKey(),
  scanId: text('scan_id').notNull(),
  driftType: text('drift_type').notNull(),
  severity: text('severity').notNull(),
  status: text('status').notNull(),
  resourceType: text('resource_type').notNull(),
  logicalName: text('logical_name').notNull(),
  region: text('region').notNull(),
  diffSummary: text('diff_summary'),
  reasoning: text('reasoning'), // JSON
  detectedAt: text('detected_at').notNull(),
});

export const resources = sqliteTable('resources', {
  id: text('id').primaryKey(),
  scanId: text('scan_id').notNull(),
  source: text('source').notNull(), // intent, terraform, aws
  logicalName: text('logical_name').notNull(),
  type: text('type').notNull(),
  region: text('region').notNull(),
  attributes: text('attributes'), // JSON
  tags: text('tags'), // JSON
});
```

**Test:**
```bash
pnpm drizzle-kit generate:sqlite
pnpm drizzle-kit push:sqlite
```

#### 1.3 Update Mock API to Use Database (30 minutes)

**Implement:**
- [ ] Load mock data into database on startup
- [ ] Update endpoints to query database instead of JSON files
- [ ] Keep mock data files as seed data

**Deliverable**: Working server with database, shared types defined, mock data loaded.

---

## Milestone 2: Frontend Foundation (4 hours)

**Goal**: Build the UI with mock data to visualize the complete user experience.

### Tasks

#### 2.1 Project Setup (1 hour)

```bash
cd frontend
```

**Install dependencies:**
```bash
pnpm add react-router-dom @tanstack/react-query axios
pnpm add -D @types/react-router-dom
pnpm add tailwindcss postcss autoprefixer
pnpm add class-variance-authority clsx tailwind-merge
pnpm add lucide-react recharts reactflow
```

**Setup Tailwind:**
```bash
npx tailwindcss init -p
```

**Configure:**
- [ ] Tailwind config
- [ ] React Query provider
- [ ] Axios instance pointing to mock API
- [ ] Router setup

#### 2.2 UI Components (1.5 hours)

```bash
# Use shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card badge table tabs
```

**Create custom components:**
- [ ] `Layout` - App shell with navigation
- [ ] `StatCard` - Dashboard statistics
- [ ] `DriftBadge` - Severity badge with colors
- [ ] `LoadingSpinner` - Loading state
- [ ] `ErrorAlert` - Error display

#### 2.3 Dashboard Page (1.5 hours)

```bash
# frontend/src/pages/Dashboard.tsx
```

**Implement:**
- [ ] "Run Scan" button (calls mock API)
- [ ] Latest scan statistics display
- [ ] Compliance score with visual indicator
- [ ] Drift count by severity (bar chart with Recharts)
- [ ] Drift count by type (pie chart)
- [ ] Resource summary table

**Components:**
- [ ] `ComplianceScoreCard` - Large circular score display
- [ ] `DriftSeverityChart` - Bar chart showing severity distribution
- [ ] `DriftTypeChart` - Pie chart showing drift types
- [ ] `ResourceSummary` - Table comparing intent/terraform/aws counts

**Test:**
- [ ] Click "Run Scan" and see mock data populate
- [ ] Verify charts render correctly
- [ ] Check responsive design

**Deliverable**: Working dashboard displaying all mock data with charts and statistics.

---

## Milestone 3: Drift List & Details (3 hours)

**Goal**: Implement the drift findings list with filtering and detail views.

### Tasks

#### 3.1 Drift List Page (2 hours)

```bash
# frontend/src/pages/DriftList.tsx
```

**Implement:**
- [ ] Filterable table (severity, type, status)
- [ ] Search by resource name
- [ ] Sortable columns
- [ ] Click to expand detail panel
- [ ] Pagination (if > 20 findings)

**Components:**
- [ ] `DriftTable` - Main table with mock data
- [ ] `DriftFilters` - Filter controls (dropdowns, search)
- [ ] `DriftRow` - Table row with expand button

#### 3.2 Drift Detail Panel (1 hour)

```bash
# frontend/src/components/drift/DriftDetail.tsx
```

**Implement:**
- [ ] Resource information display
- [ ] Expected vs Observed comparison
- [ ] Diff summary with syntax highlighting
- [ ] Reasoning card with:
  - Summary
  - Likely cause
  - Terraform remediation steps (code block)
- [ ] Status change buttons (mock actions)

**Components:**
- [ ] `ReasoningCard` - LLM reasoning display
- [ ] `AttributeComparison` - Side-by-side attribute diff
- [ ] `RemediationSteps` - Formatted Terraform code

**Deliverable**: Complete drift list with filtering, search, and detailed views of each finding.

---

## Milestone 4: Graph Visualization (4 hours)

**Goal**: Implement interactive graph showing three views with drift indicators.

### Tasks

#### 4.1 Graph Data Preparation (1 hour)

```bash
# frontend/src/lib/graph-utils.ts
```

**Implement:**
- [ ] Convert mock resources to React Flow nodes
- [ ] Generate edges from relationships
- [ ] Add drift indicators to nodes
- [ ] Layout algorithm (dagre or manual positioning)

**Node structure:**
```typescript
interface GraphNode {
  id: string;
  type: 'vpc' | 'subnet' | 'instance' | 'sg' | 'alb';
  data: {
    label: string;
    resourceType: string;
    hasDrift: boolean;
    driftSeverity?: Severity;
    attributes: Record<string, any>;
  };
  position: { x: number; y: number };
}
```

#### 4.2 Custom Node Components (1.5 hours)

```bash
# frontend/src/components/graph/nodes/
```

**Implement:**
- [ ] `VPCNode` - VPC visualization with CIDR
- [ ] `SubnetNode` - Subnet with AZ indicator
- [ ] `InstanceNode` - EC2 instance with type
- [ ] `SecurityGroupNode` - Security group with port list
- [ ] `ALBNode` - Load balancer icon

**Features:**
- [ ] Color coding by drift severity
- [ ] Hover tooltips with details
- [ ] Click to show detail panel
- [ ] Visual indicators (warning icons, etc.)

#### 4.3 Graph Page (1.5 hours)

```bash
# frontend/src/pages/GraphView.tsx
```

**Implement:**
- [ ] Three tabs: Planned / Terraform / Deployed
- [ ] React Flow canvas for each view
- [ ] Zoom/pan controls
- [ ] Minimap
- [ ] Resource detail sidebar (opens on node click)
- [ ] Drift highlighting (red borders, warning icons)

**Test:**
- [ ] Switch between three views
- [ ] Click nodes to see details
- [ ] Verify drift indicators visible
- [ ] Check performance with mock data

**Deliverable**: Interactive graph with three views showing all resources and drift indicators.

---

## Milestone 5: Reports (2 hours)

**Goal**: Implement report generation and download from mock data.

### Tasks

#### 5.1 Report Service (1 hour)

```bash
# backend/src/services/report-service.ts
```

**Implement:**
- [ ] HTML report template with embedded CSS
- [ ] JSON report structure
- [ ] Report data aggregation from database
- [ ] Handlebars or template literals for HTML

**HTML template sections:**
- [ ] Executive summary (compliance score, total drifts)
- [ ] Drift breakdown by severity
- [ ] Drift breakdown by type
- [ ] Detailed findings list with reasoning
- [ ] Remediation steps for each finding
- [ ] Resource inventory comparison

#### 5.2 Report Page (1 hour)

```bash
# frontend/src/pages/Reports.tsx
```

**Implement:**
- [ ] Report preview (iframe or rendered HTML)
- [ ] Download buttons (HTML, JSON)
- [ ] Format selection dropdown
- [ ] Scan selection dropdown
- [ ] Generate button

**Test:**
- [ ] Generate HTML report from mock data
- [ ] Download and verify formatting
- [ ] Generate JSON report
- [ ] Verify all findings included

**Deliverable**: Working report generation with HTML and JSON downloads.

---

## Milestone 6: Agent Implementation (8 hours)

**Goal**: Replace mock data with real agent implementations.

**Note**: At this point, we have a fully working demo with mock data. Now we implement the real agents one by one, testing against the mock data to ensure they produce the same results.

### Tasks

#### 6.1 DesignIntentAgent (1.5 hours)

```bash
# backend/src/agents/design-intent-agent.ts
```

**Implement:**
- [ ] YAML parsing with `yaml` library
- [ ] Schema validation with Zod
- [ ] Normalization to `NormalizedResource[]`
- [ ] Relationship extraction

**Test:**
```typescript
describe('DesignIntentAgent', () => {
  it('should parse architecture.yaml and match mock data', async () => {
    const agent = new DesignIntentAgent({
      architectureFilePath: './examples/architecture.yaml',
    });
    const result = await agent.parseArchitecture();
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject(mockIntentResources);
  });
});
```

#### 6.2 TerraformStateAgent (2 hours)

```bash
# backend/src/agents/terraform-state-agent.ts
```

**Implement:**
- [ ] JSON parsing
- [ ] **Redaction logic** (critical security feature)
- [ ] Resource extraction from nested modules
- [ ] Normalization to `NormalizedResource[]`

**Test:**
```typescript
describe('TerraformStateAgent', () => {
  it('should redact sensitive values', () => {
    const resource = {
      values: {
        password: 'secret123',
        db_connection: 'postgresql://user:pass@host/db',
      },
    };
    const redacted = agent.redactSensitiveValues(resource);
    expect(redacted.values.password).toBe('[REDACTED]');
    expect(redacted.values.db_connection).toBe('[REDACTED]');
  });
  
  it('should match mock terraform resources', async () => {
    const result = await agent.parseTerraformState();
    expect(result.data).toMatchObject(mockTerraformResources);
  });
});
```

#### 6.3 AWSInventoryAgent (2 hours)

```bash
# backend/src/agents/aws-inventory-agent.ts
```

**Implement:**
- [ ] AWS SDK client setup
- [ ] Credential detection
- [ ] Mock file loading (fallback)
- [ ] Auto-fallback logic
- [ ] Normalization to `NormalizedResource[]`

**Test:**
```typescript
describe('AWSInventoryAgent', () => {
  it('should use mock when no credentials', async () => {
    const agent = new AWSInventoryAgent({
      regions: ['us-east-1'],
      mockInventoryPath: './examples/aws-mock-inventory.json',
    });
    const result = await agent.fetchInventory();
    expect(result.success).toBe(true);
    expect(result.data.metadata.source).toBe('mock');
    expect(result.data.resources).toMatchObject(mockAwsResources);
  });
});
```

#### 6.4 DriftAnalysisAgent (2 hours)

```bash
# backend/src/agents/drift-analysis-agent.ts
```

**Implement:**
- [ ] Resource indexing by logical name
- [ ] Comparison logic for all 8 drift types
- [ ] Diff summary generation
- [ ] Whitelisted finding generation
- [ ] Compliance score calculation

**Test:**
```typescript
describe('DriftAnalysisAgent', () => {
  it('should detect all drift types from mock data', async () => {
    const result = await agent.analyzeDrift({
      intentResources: mockIntentResources,
      terraformResources: mockTerraformResources,
      awsResources: mockAwsResources,
      config: agent.config,
    });
    
    expect(result.data.findings).toHaveLength(12);
    expect(result.data.complianceScore).toBe(68);
    
    // Verify each drift type is detected
    const driftTypes = result.data.findings.map(f => f.driftType);
    expect(driftTypes).toContain(DriftType.MISSING);
    expect(driftTypes).toContain(DriftType.UNMANAGED);
    expect(driftTypes).toContain(DriftType.CHANGED_OUTSIDE_TERRAFORM);
  });
});
```

#### 6.5 ReasoningAgent (1.5 hours)

```bash
# backend/src/agents/reasoning-agent.ts
```

**Implement:**
- [ ] Whitelist validation (critical security)
- [ ] Claude API integration
- [ ] Deterministic fallback templates
- [ ] Batch processing

**Test:**
```typescript
describe('ReasoningAgent', () => {
  it('should reject non-whitelisted fields', () => {
    const maliciousInput = {
      findingId: '123',
      arn: 'arn:aws:...',  // NOT ALLOWED
    };
    
    expect(() => agent.validateWhitelistedInput(maliciousInput))
      .toThrow(SecurityError);
  });
  
  it('should use deterministic fallback when no API key', async () => {
    const agent = new ReasoningAgent({ apiKey: undefined });
    const result = await agent.analyzeFinding(validFinding);
    expect(result.data.generatedBy).toBe('deterministic');
    expect(result.data.summary).toBeDefined();
  });
});
```

**Deliverable**: All agents implemented and tested, producing results matching mock data.

---

## Milestone 7: Integration & Orchestration (3 hours)

**Goal**: Wire up real agents to replace mock endpoints.

### Tasks

#### 7.1 Analysis Service (2 hours)

```bash
# backend/src/services/analysis-service.ts
```

**Implement:**
- [ ] Orchestrate all agents in sequence
- [ ] Save scan to database
- [ ] Save findings to database
- [ ] Save resources to database
- [ ] Error handling and rollback
- [ ] Progress tracking

**Flow:**
```typescript
async function runAnalysis(config: AnalysisConfig): Promise<ScanResult> {
  // 1. Create scan record
  const scan = await db.insert(scans).values({...});
  
  // 2. Run agents
  const intentResult = await designIntentAgent.parseArchitecture();
  const terraformResult = await terraformStateAgent.parseTerraformState();
  const awsResult = await awsInventoryAgent.fetchInventory();
  
  // 3. Analyze drift
  const driftResult = await driftAnalysisAgent.analyzeDrift({...});
  
  // 4. Generate reasoning
  const whitelisted = driftResult.data.findings.map(f => 
    driftAnalysisAgent.generateWhitelistedFinding(f)
  );
  const reasoningResult = await reasoningAgent.analyzeFindings(whitelisted);
  
  // 5. Combine and save
  const enrichedFindings = driftResult.data.findings.map((f, i) => ({
    ...f,
    reasoning: reasoningResult.data[i],
  }));
  
  await db.insert(findings).values(enrichedFindings);
  
  // 6. Update scan
  await db.update(scans).set({ completedAt, complianceScore });
  
  return scanResult;
}
```

#### 7.2 Update API Routes (1 hour)

```bash
# backend/src/api/*.ts
```

**Implement:**
- [ ] Replace mock data with real service calls
- [ ] Keep mock fallback for demo mode
- [ ] Add environment variable `DEMO_MODE=true/false`
- [ ] Update all endpoints to use analysis service

**Test:**
```bash
# Test with real agents
DEMO_MODE=false pnpm dev
curl -X POST http://localhost:3001/api/analyze

# Test with mock data
DEMO_MODE=true pnpm dev
curl -X POST http://localhost:3001/api/analyze
```

**Deliverable**: Complete integration with real agents, mock mode still available.

---

## Milestone 8: Polish & Demo Prep (3 hours)

**Goal**: Final polish, error handling, and demo preparation.

### Tasks

#### 8.1 UI Polish (1.5 hours)

- [ ] Loading states for all async operations
- [ ] Error handling with user-friendly messages
- [ ] Empty states (no scans, no findings)
- [ ] Responsive design (mobile-friendly)
- [ ] Accessibility (ARIA labels, keyboard navigation)
- [ ] Smooth transitions and animations
- [ ] Toast notifications for actions

#### 8.2 Documentation (1 hour)

- [ ] README.md with setup instructions
- [ ] Demo script with talking points
- [ ] SECURITY.md with whitelist specification
- [ ] Architecture diagram (Mermaid)
- [ ] Example report (pre-generated)

**README structure:**
```markdown
# Architecture Drift Copilot

## Quick Start
1. Clone repo
2. Install dependencies: `pnpm install`
3. Start backend: `cd backend && pnpm dev`
4. Start frontend: `cd frontend && pnpm dev`
5. Open http://localhost:5173

## Demo Mode
Set `DEMO_MODE=true` in backend/.env to use mock data

## Configuration
- Optional: Add ANTHROPIC_API_KEY to backend/.env
- Optional: Configure AWS credentials
```

#### 8.3 Demo Preparation (30 minutes)

- [ ] Pre-run one scan to cache results
- [ ] Verify all drift types visible
- [ ] Test report download
- [ ] Practice demo flow (5 minutes)
- [ ] Prepare backup screenshots
- [ ] Test on clean environment

**Deliverable**: Polished, demo-ready application with complete documentation.

---

## Testing Strategy

### Unit Tests (Throughout Development)

```bash
# Backend
cd backend
pnpm add -D vitest @vitest/ui
pnpm test

# Frontend
cd frontend
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
pnpm test
```

**Coverage targets:**
- Agents: 80%+ (critical security code)
- Services: 70%+
- API routes: 60%+
- Components: 50%+

### Integration Tests (Milestone 7)

```bash
# backend/tests/integration/analysis.test.ts
```

**Test scenarios:**
- [ ] End-to-end analysis flow
- [ ] Database persistence
- [ ] API endpoints
- [ ] Error handling

---

## Timeline Summary

| Milestone | Duration | Cumulative | Description |
|-----------|----------|------------|-------------|
| 0. Demo Environment | 2h | 2h | Mock data and demo API |
| 1. Foundation | 3h | 5h | Types and database |
| 2. Frontend Foundation | 4h | 9h | UI with mock data |
| 3. Drift List | 3h | 12h | Findings list and details |
| 4. Graph | 4h | 16h | Interactive visualization |
| 5. Reports | 2h | 18h | Report generation |
| 6. Agents | 8h | 26h | Real agent implementation |
| 7. Integration | 3h | 29h | Wire up real agents |
| 8. Polish | 3h | 32h | Final polish and demo prep |

**Total: ~32 hours (4 days @ 8 hours/day)**

**Key Advantage**: After Milestone 5 (18 hours), you have a fully working demo with mock data. The remaining time is spent replacing mock data with real implementations.

---

## Daily Breakdown (Recommended)

### Day 1: Demo Environment & Foundation
- Morning: Milestone 0 (Demo Environment)
- Afternoon: Milestone 1 (Foundation & Types)
- Evening: Test mock API and database
- **End of Day**: Working demo API with mock data

### Day 2: Frontend with Mock Data
- Morning: Milestone 2 (Frontend Foundation)
- Afternoon: Milestone 3 (Drift List)
- Evening: UI testing
- **End of Day**: Complete UI showing mock data

### Day 3: Visualization & Real Agents
- Morning: Milestone 4 (Graph Visualization)
- Afternoon: Milestone 5 (Reports) + Start Milestone 6
- Evening: Continue agent implementation
- **End of Day**: Working demo + some real agents

### Day 4: Integration & Polish
- Morning: Complete Milestone 6 (Agents)
- Afternoon: Milestone 7 (Integration)
- Evening: Milestone 8 (Polish & Demo Prep)
- **End of Day**: Production-ready demo

---

## Risk Mitigation

### Technical Risks

**Risk: LLM API fails during demo**
- Mitigation: Deterministic fallback always available
- Test: Disable API key and verify fallback works
- Demo mode uses pre-generated reasoning

**Risk: Large Terraform state causes timeout**
- Mitigation: Use small example files
- Test: Limit example to 10-20 resources
- Stream parsing for large files

**Risk: Graph rendering is slow**
- Mitigation: Limit nodes to 50 in demo
- Test: Profile with React DevTools
- Virtualization for large graphs

### Demo Risks

**Risk: No internet for LLM**
- Mitigation: Demo mode with pre-generated data
- Action: Always have DEMO_MODE=true as backup

**Risk: No AWS credentials**
- Mitigation: Mock inventory fallback
- Action: Demo uses mock data by default

**Risk: Demo data not showing drift**
- Mitigation: Carefully crafted examples with all 8 types
- Action: Verify mock data before demo

---

## Success Criteria

### Must Have (MVP)
- ✅ All 8 drift types detected
- ✅ Dashboard with statistics
- ✅ Drift list with reasoning
- ✅ Graph visualization
- ✅ Report download (HTML + JSON)
- ✅ Works without AWS credentials (mock fallback)
- ✅ Works without LLM API key (deterministic fallback)
- ✅ Demo completes in < 5 minutes

### Nice to Have (Stretch)
- ⭐ PDF export
- ⭐ Drift status editing
- ⭐ Multiple scans
- ⭐ Settings page

### Demo Success
- ✅ Setup in < 5 minutes
- ✅ No errors during demo
- ✅ Drift clearly visible
- ✅ Remediation steps clear
- ✅ Audience understands value

---

## Appendix: Command Reference

### Development Commands

```bash
# Install all dependencies
pnpm install

# Start backend dev server
cd backend && pnpm dev

# Start frontend dev server
cd frontend && pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Database migrations
cd backend && pnpm db:generate && pnpm db:push

# Lint and format
pnpm lint
pnpm format
```

### Demo Commands

```bash
# Reset database
rm backend/data/drift.db
cd backend && pnpm db:push

# Run analysis (demo mode)
DEMO_MODE=true pnpm dev
curl -X POST http://localhost:3001/api/analyze

# Run analysis (real mode)
DEMO_MODE=false pnpm dev
curl -X POST http://localhost:3001/api/analyze
```

---

## Notes

- **Demo-First Approach**: Build the complete UI with mock data first, then replace with real implementations
- **Always Demo-Ready**: After Milestone 5, you always have a working demo
- **Parallel Development**: Frontend and backend can work independently using mock data
- **Test Continuously**: Each agent is tested against mock data to ensure consistency
- **Security First**: Never compromise on whitelist enforcement
- **Graceful Degradation**: Always have fallbacks (mock data, deterministic reasoning)

**Remember**: A working, demoable MVP with mock data is better than an incomplete app with real integrations.