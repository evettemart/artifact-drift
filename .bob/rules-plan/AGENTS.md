# Plan Mode Rules

## Non-Obvious Architecture Constraints

**Mock-First Architecture**: The entire application is designed around MSW (Mock Service Worker) as the data layer. This is NOT a temporary testing setup - it's the Phase 2 architecture. The backend will be added later, but the mock layer defines the API contract.

**State Management Split**: Two separate state systems:
1. **TanStack Query** - Server state (API data, caching, refetching)
2. **Zustand** - Mock store only (`src/mocks/store.ts`)
Do NOT use Zustand for UI state. It's exclusively for the mock data layer.

**Feature Isolation**: Features in `src/features/` are intentionally isolated. Each feature has its own hooks, components, and logic. Cross-feature dependencies should go through `src/api/` or `src/lib/`, never direct imports between features.

**Graph Data Model**: The graph uses a canonical node/edge model where:
- Nodes/edges have `uid` (unique identifier across all layers)
- Nodes/edges have `layer` attribute (intent/terraform/runtime)
- Drift is represented by `drifted` boolean and `driftSeverity` on nodes/edges
- Graph snapshots are layer-specific (one snapshot per layer)

**Drift Detection Model**: Drift records compare TWO layers (base vs target). The comparison is asymmetric:
- `missing` - in base, not in target
- `unexpected` - in target, not in base
- `attribute_mismatch` - in both, but attributes differ
- `edge_drift` - relationship differences

**Compliance Scoring**: The `complianceScore` (0-100) on drift runs is deterministic, calculated from severity counts. It's NOT stored - it's computed. The algorithm is in `src/lib/scoring.ts`.

**Integration Layer Mapping**: Integrations are layer-specific. An AWS integration maps to `runtime` layer, Terraform to `terraform` layer, Confluence/Draw.io to `intent` layer. This mapping is NOT configurable - it's part of the integration kind definition.

**Report Generation**: Reports are generated FROM drift runs, not standalone. A report always references a `runId` and includes sections with citations to specific drift records. The citation system grounds the report in actual detected drift.