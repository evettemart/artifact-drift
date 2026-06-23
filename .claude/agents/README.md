# Agent Specifications

This directory contains detailed specifications for all agents in the Architecture Drift Copilot system. Each agent has a specific responsibility in the drift detection and analysis pipeline.

## Overview

The system uses five specialized agents plus a shared types definition:

1. **DesignIntentAgent** - Parses approved architecture intent
2. **TerraformStateAgent** - Parses Terraform state with security redaction
3. **AWSInventoryAgent** - Fetches AWS resources (live or mock)
4. **DriftAnalysisAgent** - Deterministic drift detection engine
5. **ReasoningAgent** - LLM-powered reasoning (with deterministic fallback)

## Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Architecture Drift Copilot                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ DesignIntent     │  │ TerraformState   │  │ AWSInventory     │
│ Agent            │  │ Agent            │  │ Agent            │
│                  │  │                  │  │                  │
│ Parses           │  │ Parses TF JSON   │  │ Fetches AWS      │
│ architecture.yaml│  │ + Redacts        │  │ (live or mock)   │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                      │
         │  NormalizedResource │  NormalizedResource  │
         │  (Intent)           │  (Terraform)         │  (AWS)
         │                     │                      │
         └─────────────────────┼──────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ DriftAnalysis        │
                    │ Agent                │
                    │                      │
                    │ Deterministic        │
                    │ Comparison           │
                    └──────────┬───────────┘
                               │
                               │ DriftFinding[]
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Reasoning            │
                    │ Agent                │
                    │                      │
                    │ LLM Analysis         │
                    │ (Whitelisted Input)  │
                    └──────────────────────┘
                               │
                               │ ReasoningResult[]
                               ▼
                    ┌──────────────────────┐
                    │ Dashboard & Reports  │
                    └──────────────────────┘
```

## File Descriptions

### [shared-types.md](./shared-types.md)
**Foundation for all agents**

Defines all shared TypeScript interfaces, types, and enums:
- `NormalizedResource` - Canonical resource representation
- `DriftFinding` - Detected drift structure
- `WhitelistedFinding` - Security-critical LLM input
- `ReasoningResult` - LLM output structure
- Enums: `ResourceType`, `DriftType`, `Severity`, `Provider`, etc.
- Security utilities and redaction patterns

**Key Principle**: Single source of truth for all type definitions.

### [design-intent-agent.md](./design-intent-agent.md)
**Input: architecture.yaml → Output: NormalizedResource[]**

Responsibilities:
- Parse and validate `architecture.yaml` files
- Normalize architecture definitions into internal schema
- Extract resource relationships
- Placeholder for Confluence integration

**Key Features**:
- Deterministic parsing (no LLM)
- Strict schema validation
- Relationship extraction
- Checksum tracking for audit trail

**Security**: No sensitive data in architecture files by design.

### [terraform-state-agent.md](./terraform-state-agent.md)
**Input: terraform show -json → Output: NormalizedResource[]**

Responsibilities:
- Parse Terraform JSON output
- **Redact sensitive values at ingestion time** (CRITICAL)
- Normalize Terraform resources
- Track Terraform metadata

**Key Features**:
- Security-first redaction (before data enters memory)
- Support for CLI execution or file input
- Handles nested modules
- Version-aware parsing

**Security**: 
- Redacts passwords, keys, secrets, connection strings
- Uses field name patterns + value patterns + Terraform markers
- Whitelist approach for safe attributes

### [aws-inventory-agent.md](./aws-inventory-agent.md)
**Input: AWS SDK / Mock File → Output: NormalizedResource[]**

Responsibilities:
- Fetch AWS resources via read-only APIs
- Auto-fallback to mock inventory when no credentials
- Normalize AWS resources
- Handle multi-region queries

**Key Features**:
- Graceful degradation (never fails demo)
- Read-only operations only
- Pagination and rate limiting
- Account ID redaction

**Security**:
- Only describe/list APIs
- Redact account IDs from ARNs
- Mock fallback for credential-less demos

### [drift-analysis-agent.md](./drift-analysis-agent.md)
**Input: 3x NormalizedResource[] → Output: DriftFinding[]**

Responsibilities:
- Compare Intent vs Terraform vs AWS
- Detect 8 types of drift deterministically
- Generate whitelisted findings for LLM
- Calculate compliance scores

**Drift Types Detected**:
1. Missing resources
2. Unexpected resources
3. Unmanaged resources (shadow IT)
4. Changed outside Terraform
5. Attribute mismatches
6. Tag mismatches
7. Security group mismatches
8. Region mismatches

**Key Features**:
- Deterministic (no LLM)
- Efficient indexing for large resource sets
- Pre-computed, redacted diff summaries
- Compliance score calculation

**Security**:
- Generates whitelisted findings only
- Never exposes raw data to LLM
- Redacted diff summaries

### [reasoning-agent.md](./reasoning-agent.md)
**Input: WhitelistedFinding → Output: ReasoningResult**

Responsibilities:
- **ONLY agent that calls an LLM** (Claude)
- Accept ONLY whitelisted findings (security-critical)
- Generate human-readable explanations
- Assign severity and recommend remediation
- Provide deterministic fallback

**Key Features**:
- Strict whitelist validation (runtime enforcement)
- Claude API integration
- Deterministic templates for fallback
- Terraform-focused remediation
- Batch processing support

**Security** (CRITICAL):
- Validates input against strict whitelist
- Rejects any non-whitelisted fields
- Checks for sensitive patterns (keys, ARNs, credentials)
- Never accepts raw Terraform state or AWS responses
- Fail-secure on validation errors

## Data Flow

### 1. Resource Collection Phase
```
architecture.yaml → DesignIntentAgent → NormalizedResource[] (Intent)
terraform.json    → TerraformStateAgent → NormalizedResource[] (Terraform)
AWS APIs/Mock     → AWSInventoryAgent   → NormalizedResource[] (AWS)
```

### 2. Analysis Phase
```
3x NormalizedResource[] → DriftAnalysisAgent → DriftFinding[]
                                              → Statistics
                                              → ComplianceScore
```

### 3. Reasoning Phase
```
DriftFinding[] → WhitelistedFinding[] → ReasoningAgent → ReasoningResult[]
                 (Security Transform)    (LLM or Fallback)
```

### 4. Output Phase
```
DriftFinding[] + ReasoningResult[] → Dashboard
                                   → Reports (HTML/JSON/PDF)
                                   → Graph Visualization
```

## Security Architecture

### Defense in Depth

1. **Layer 1: Ingestion Redaction**
   - TerraformStateAgent redacts at parse time
   - AWSInventoryAgent redacts account IDs
   - DesignIntentAgent validates schema

2. **Layer 2: Normalized Schema**
   - Only safe attributes in NormalizedResource
   - Sensitive fields marked and tracked
   - No raw provider data

3. **Layer 3: Whitelist Enforcement**
   - DriftAnalysisAgent generates whitelisted findings
   - Only approved fields included
   - Pre-computed, redacted summaries

4. **Layer 4: LLM Input Validation**
   - ReasoningAgent validates whitelist at runtime
   - Rejects non-whitelisted fields
   - Checks for sensitive patterns
   - Fail-secure on violations

### Security Checklist

Before any data reaches the LLM:
- [ ] Redacted at ingestion (TerraformStateAgent)
- [ ] Normalized to safe schema (all agents)
- [ ] Whitelisted fields only (DriftAnalysisAgent)
- [ ] Runtime validation (ReasoningAgent)
- [ ] No ARNs with account IDs
- [ ] No AWS keys or secrets
- [ ] No connection strings
- [ ] No raw Terraform state

## Key Design Principles

### 1. Deterministic Core
- Only ReasoningAgent calls LLM
- All other agents are deterministic
- Drift detection is rule-based, not AI-based

### 2. Security First
- Whitelist approach (not blocklist)
- Redaction at ingestion time
- Multiple validation layers
- Fail-secure on violations

### 3. Graceful Degradation
- Mock fallback for AWS (no credentials needed)
- Deterministic fallback for reasoning (no API key needed)
- Demo never fails

### 4. Single Responsibility
- Each agent has one clear purpose
- Clean interfaces between agents
- Testable in isolation

### 5. Type Safety
- Strict TypeScript types throughout
- Shared type definitions
- Runtime validation where needed

## Testing Strategy

### Unit Tests
Each agent has comprehensive unit tests:
- Input validation
- Core logic
- Error handling
- Edge cases

### Security Tests
Critical for TerraformStateAgent and ReasoningAgent:
- Redaction effectiveness
- Whitelist enforcement
- Sensitive pattern detection
- Fail-secure behavior

### Integration Tests
- End-to-end data flow
- Agent interactions
- Real file parsing
- API mocking

## Usage Example

```typescript
import {
  DesignIntentAgent,
  TerraformStateAgent,
  AWSInventoryAgent,
  DriftAnalysisAgent,
  ReasoningAgent,
} from './agents';

// 1. Collect resources
const intentAgent = new DesignIntentAgent({ /* config */ });
const terraformAgent = new TerraformStateAgent({ /* config */ });
const awsAgent = new AWSInventoryAgent({ /* config */ });

const intentResult = await intentAgent.parseArchitecture();
const terraformResult = await terraformAgent.parseTerraformState();
const awsResult = await awsAgent.fetchInventory();

// 2. Analyze drift
const analysisAgent = new DriftAnalysisAgent({ /* config */ });
const driftResult = await analysisAgent.analyzeDrift({
  intentResources: intentResult.data,
  terraformResources: terraformResult.data.resources,
  awsResources: awsResult.data.resources,
  config: analysisAgent.config,
});

// 3. Generate reasoning
const reasoningAgent = new ReasoningAgent({ /* config */ });
const whitelistedFindings = driftResult.data.findings.map(f =>
  analysisAgent.generateWhitelistedFinding(f)
);

const reasoningResult = await reasoningAgent.analyzeFindings(
  whitelistedFindings
);

// 4. Combine results
const enrichedFindings = driftResult.data.findings.map((finding, i) => ({
  ...finding,
  reasoning: reasoningResult.data[i],
}));

// 5. Generate report
console.log(`Compliance Score: ${driftResult.data.complianceScore}/100`);
console.log(`Total Drifts: ${enrichedFindings.length}`);
```

## Dependencies

### External Libraries
- `yaml` - YAML parsing (DesignIntentAgent)
- `@aws-sdk/client-ec2` - AWS EC2 API (AWSInventoryAgent)
- `@aws-sdk/client-elastic-load-balancing-v2` - AWS ELB API (AWSInventoryAgent)
- `@anthropic-ai/sdk` - Claude API (ReasoningAgent)

### Internal Dependencies
All agents depend on `shared-types.md` for type definitions.

## Future Enhancements

### Short Term
1. Additional resource types (RDS, Lambda, S3)
2. Confluence integration (DesignIntentAgent)
3. HCP Terraform integration (TerraformStateAgent)
4. PDF report generation

### Long Term
1. Multi-cloud support (GCP, Azure)
2. Custom drift detection rules
3. Auto-remediation code generation
4. Drift prediction and trends
5. Machine learning for pattern detection

## Contributing

When adding new agents or modifying existing ones:

1. **Update shared-types.md first** if new types are needed
2. **Follow security principles** - whitelist approach, redaction at ingestion
3. **Maintain deterministic core** - only ReasoningAgent calls LLM
4. **Add comprehensive tests** - unit, security, and integration
5. **Document thoroughly** - follow existing agent.md format
6. **Update this README** - keep architecture diagram and descriptions current

## Questions?

For questions about:
- **Type definitions**: See [shared-types.md](./shared-types.md)
- **Security architecture**: See security sections in each agent.md
- **Data flow**: See architecture diagram above
- **Implementation details**: See individual agent.md files