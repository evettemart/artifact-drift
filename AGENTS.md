# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Overview

**Architecture Drift Copilot** is a TypeScript-based full-stack application that detects and analyzes infrastructure drift by comparing three sources:
1. **Intended Architecture** (YAML) - The approved design
2. **Terraform State** (JSON) - What Terraform manages
3. **AWS Resources** (SDK/Mock) - What's actually deployed

The system uses an **agent-based architecture** with 5 specialized agents that work together to detect drift deterministically, then optionally enhance findings with AI-powered reasoning.

### Core Technologies

**Backend:**
- Node.js 18+ with TypeScript
- Express.js for REST API
- Drizzle ORM with SQLite for persistence
- AWS SDK for resource inventory
- Anthropic Claude API for AI reasoning
- YAML parser for architecture files

**Frontend:**
- React 18 with TypeScript
- Vite for fast development
- TailwindCSS for styling
- React Query (TanStack Query) for data fetching
- React Flow for graph visualization
- Recharts for statistics charts

### Key Design Principles

1. **Security First**: Whitelist-based approach for LLM input, sensitive data redacted at ingestion
2. **Deterministic Core**: Only the ReasoningAgent uses AI; all drift detection is rule-based
3. **Graceful Degradation**: Works without AWS credentials (mock fallback) and without API keys (deterministic fallback)
4. **Single Responsibility**: Each agent has one clear purpose with clean interfaces
5. **Type Safety**: Strict TypeScript throughout with shared type definitions

## Architecture

### Agent Pipeline

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ DesignIntent    │  │ TerraformState  │  │ AWSInventory    │
│ Agent           │  │ Agent           │  │ Agent           │
│                 │  │ (+ Redaction)   │  │ (Mock Fallback) │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                     │
         │ NormalizedResource │ NormalizedResource  │
         │ (Intent)           │ (Terraform)         │ (AWS)
         │                    │                     │
         └────────────────────┼─────────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ DriftAnalysis        │
                   │ Agent                │
                   │ (Deterministic)      │
                   └──────────┬───────────┘
                              │
                              │ DriftFinding[]
                              │ (Whitelisted)
                              ▼
                   ┌──────────────────────┐
                   │ Reasoning            │
                   │ Agent                │
                   │ (LLM/Fallback)       │
                   └──────────┬───────────┘
                              │
                              │ ReasoningResult[]
                              ▼
                   ┌──────────────────────┐
                   │ Dashboard & Reports  │
                   └──────────────────────┘
```

### Project Structure

```
artifact-drift/
├── backend/                    # Node.js + Express API
│   ├── src/
│   │   ├── server.ts          # Express app entry point
│   │   ├── api/               # REST API routes
│   │   ├── db/                # Drizzle ORM schema & seed
│   │   ├── services/          # Business logic (analysis)
│   │   └── types/             # Shared TypeScript types
│   └── data/
│       ├── artifact-drift.db  # SQLite database
│       └── mock/              # Mock data for demo mode
│
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx            # Main app component
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components (Dashboard, Findings, Graph, Reports)
│   │   ├── lib/               # Utilities and API client
│   │   └── types/             # TypeScript types
│   └── index.html
│
├── examples/                   # Sample data files
│   ├── architecture.yaml      # Example architecture intent
│   ├── terraform-state.json   # Example Terraform state
│   └── aws-mock-inventory.json # Example AWS inventory
│
└── docs/                       # Documentation
    ├── agents/                # Agent specifications
    │   ├── README.md          # Agent architecture overview
    │   ├── shared-types.md    # Type definitions
    │   ├── design-intent-agent.md
    │   ├── terraform-state-agent.md
    │   ├── aws-inventory-agent.md
    │   ├── drift-analysis-agent.md
    │   └── reasoning-agent.md
    └── MOCK_DATA_SPEC.md      # Mock data specification
```

## Building and Running

### Prerequisites

- Node.js 18+ and npm/pnpm
- (Optional) AWS credentials for real inventory scanning
- (Optional) Anthropic API key for AI-powered reasoning

### Quick Start (Demo Mode)

```bash
# Install dependencies (from root)
npm install

# Terminal 1: Start backend in demo mode
cd backend
echo "DEMO_MODE=true" > .env
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Open browser to `http://localhost:5174`

### Development Commands

**Backend:**
```bash
npm run dev      # Start development server with hot reload
npm run build    # Compile TypeScript to JavaScript
npm run start    # Start production server
npm run test     # Run tests with Vitest
npm run lint     # Run ESLint
npm run format   # Format code with Prettier
```

**Frontend:**
```bash
npm run dev      # Start Vite dev server with HMR
npm run build    # Build for production
npm run preview  # Preview production build
```

### Environment Variables

**Backend (.env):**
```bash
PORT=3001                          # API server port (default: 3001)
DEMO_MODE=true                     # Use mock data (true/false)
ANTHROPIC_API_KEY=sk-ant-...      # Optional: For AI reasoning
```

**Frontend (.env):**
```bash
VITE_API_URL=http://localhost:3001/api  # Backend API URL
```

### Operating Modes

The app runs in one of two mutually exclusive modes via the backend `DEMO_MODE` env var. **Both modes expose the same UI, routes, and full feature set** — only the data source changes.

**Mock Mode (`DEMO_MODE=true`, default)**
- Uses pre-generated mock data **only**: no AWS SDK calls, no LLM/Anthropic calls, no Terraform CLI, no network dependencies.
- Data comes from `backend/data/mock/` (seeded into SQLite) and `examples/`.
- Every feature stays visible and working (dashboard, findings, graph, reports, filtering, download). Nothing is hidden or disabled in mock mode.
- Reasoning uses deterministic templates (`generatedBy: "deterministic"`).

**Live Mode (`DEMO_MODE=false`)**
- Uses real `architecture.yaml`, `terraform show -json` output, and AWS read-only SDK inventory (auto-falls back to mock inventory when no credentials).
- Uses the Anthropic API for reasoning when `ANTHROPIC_API_KEY` is set; otherwise degrades to deterministic templates.

> **Current implementation status:** The agent pipeline below describes the target architecture. Today the backend is **mock-backed** — endpoints serve data from `backend/data/mock/` and `services/analysis.ts`; the individual agents in `docs/agents/` are not yet implemented (see `STATUS.md`, Milestone 6).

## Development Conventions

### TypeScript Standards

- **Strict Mode**: All TypeScript is compiled with strict mode enabled
- **Type Safety**: Prefer explicit types over `any`; use `unknown` when type is truly unknown
- **Shared Types**: Common types are defined in `backend/src/types/shared.ts` and `frontend/src/types/api.ts`
- **Zod Validation**: Use Zod schemas for runtime validation of external data

### Code Organization

- **Single Responsibility**: Each file/module has one clear purpose
- **Agent Pattern**: Business logic is organized into specialized agents (see `docs/agents/`)
- **API Routes**: REST endpoints in `backend/src/api/` follow RESTful conventions
- **Component Structure**: React components use functional components with hooks

### Security Practices

**CRITICAL: LLM Input Whitelist**

The ReasoningAgent is the ONLY component that interacts with the LLM. It enforces a strict whitelist:

**Allowed Fields:**
- `driftType`, `resourceType`, `provider`, `region`, `logicalName`
- `type`, `cidrBlocks`, `ports`, `protocol`, `instanceType`
- `availabilityZones`, `tagKeys` (keys only, never values)
- `count`, `flags` (boolean flags only)

**NEVER Send to LLM:**
- ARNs, account IDs, resource IDs
- AWS credentials, API keys, secrets
- Connection strings, passwords
- Raw Terraform state
- Tag values (only keys)

**Redaction Strategy:**
- TerraformStateAgent redacts at ingestion time (before data enters memory)
- Pattern-based detection for keys, passwords, secrets, connection strings
- Field-name based detection (password, secret, token, etc.)
- Terraform-marked sensitive fields

### Database Schema

The application uses SQLite with Drizzle ORM. Three main tables:

1. **scans**: Stores scan metadata and results
   - `scanId`, `projectId`, `status`, `complianceScore`
   - JSON columns for statistics, sources, config

2. **findings**: Stores detected drift findings
   - `driftId`, `scanId`, `driftType`, `severity`, `status`
   - JSON columns for expected/observed values, reasoning

3. **resources**: Stores normalized resources from all sources
   - `resourceId`, `scanId`, `logicalName`, `type`, `source`
   - JSON columns for attributes, tags, relationships

### Testing Strategy

- **Unit Tests**: Each agent has comprehensive unit tests
- **Security Tests**: Critical for TerraformStateAgent and ReasoningAgent
  - Redaction effectiveness
  - Whitelist enforcement
  - Sensitive pattern detection
- **Integration Tests**: End-to-end data flow and agent interactions

### API Endpoints

**Core Endpoints:**
- `GET /api/health` - Health check
- `POST /api/analyze` - Run drift analysis scan
- `GET /api/findings?scanId={id}` - Get findings for a scan
- `GET /api/resources?scanId={id}&source={source}` - Get resources
- `GET /api/report?scanId={id}&format={format}` - Generate report (HTML/JSON)

## Key Features

### Drift Detection (8 Types)

1. **MISSING** - Resources in intent/Terraform but not in AWS
2. **UNMANAGED** - Resources in AWS but not in Terraform (shadow IT)
3. **CHANGED_OUTSIDE_TERRAFORM** - Manual changes to Terraform-managed resources
4. **ATTRIBUTE_MISMATCH** - Configuration differences between sources
5. **TAG_MISMATCH** - Missing or incorrect tags
6. **CONFIGURATION_DRIFT** - Complex configuration differences
7. **RELATIONSHIP_BROKEN** - Broken resource relationships
8. **VERSION_MISMATCH** - Version inconsistencies

### Compliance Score

Calculated as: `score = max(0, min(100, 100 + Σ(weight per drift)))`

**Default Weights:**
- Critical: -25
- High: -10
- Medium: -4
- Low: -1
- Info: 0

### AI-Powered Reasoning

When enabled (with Anthropic API key), the ReasoningAgent provides:
- Root cause analysis
- Impact assessment
- Terraform remediation code
- Deterministic fallback when API unavailable

## Working with This Codebase

### Adding New Resource Types

1. Update `ResourceType` enum in `backend/src/types/shared.ts`
2. Add parsing logic to relevant agents (DesignIntent, TerraformState, AWSInventory)
3. Update drift detection rules in DriftAnalysisAgent
4. Add to whitelist if needed for LLM reasoning

### Modifying Drift Detection

1. Edit `backend/src/services/analysis.ts` (DriftAnalysisAgent logic)
2. Ensure changes are deterministic (no LLM calls)
3. Update compliance score calculation if needed
4. Add tests for new drift scenarios

### Adding New Integrations

1. Create new agent following existing patterns (see `docs/agents/`)
2. Implement `NormalizedResource` output format
3. Add security redaction if handling sensitive data
4. Update orchestration in `backend/src/api/index.ts`

### Frontend Development

- **State Management**: Use React Query for server state
- **Styling**: TailwindCSS utility classes; avoid custom CSS
- **Components**: Reusable components in `frontend/src/components/`
- **Pages**: Full page components in `frontend/src/pages/`
- **API Calls**: Use `frontend/src/lib/api.ts` client

### Common Tasks

**Run a scan:**
```typescript
// POST /api/analyze
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId: 'default',
    config: { enableLLMReasoning: true }
  })
});
```

**Query findings:**
```typescript
// GET /api/findings?scanId=scan-123
const findings = await fetch('/api/findings?scanId=scan-123')
  .then(r => r.json());
```

**Generate report:**
```typescript
// GET /api/report?scanId=scan-123&format=html
window.open('/api/report?scanId=scan-123&format=html');
```

## Important Notes

### Demo Mode

- Set `DEMO_MODE=true` in backend `.env` to use mock data
- Mock files located in `backend/data/mock/`
- Demo never fails due to missing credentials
- Perfect for development and demonstrations

### Security Considerations

- **Never log sensitive data**: Use redaction utilities
- **Validate LLM input**: ReasoningAgent enforces whitelist at runtime
- **Read-only AWS**: Only `describe*` and `list*` APIs
- **No credential storage**: AWS credentials never persisted

### Performance

- SQLite is single-writer; avoid concurrent writes
- Large Terraform states: Consider streaming/pagination
- Graph rendering: React Flow handles virtualization
- LLM calls: Batch when possible, implement caching

### Troubleshooting

**Backend won't start:**
- Check port 3001 availability
- Verify Node.js version (18+)
- Ensure `.env` file exists

**Frontend connection errors:**
- Verify backend is running on port 3001
- Check CORS settings
- Verify `VITE_API_URL` in frontend `.env`

**No findings detected:**
- Verify mock data files exist in `backend/data/mock/`
- Check database was seeded
- Review backend logs for errors

## Documentation

For detailed information, see:
- `README.md` - Setup and quick start guide
- `PROJECT_SPEC.md` - Complete technical specification
- `BUILD_PLAN.md` - Implementation roadmap
- `docs/agents/` - Agent architecture and specifications
- `docs/MOCK_DATA_SPEC.md` - Mock data format

## Contributing

When making changes:
1. Follow existing code patterns and conventions
2. Maintain type safety with TypeScript
3. Add tests for new functionality
4. Update documentation as needed
5. Ensure security practices are followed (especially for LLM input)
6. Test in demo mode before committing

---

**Built with ❤️ for better infrastructure management**
