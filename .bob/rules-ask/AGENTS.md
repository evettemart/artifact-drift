# Ask Mode Rules

## Non-Obvious Documentation Context

**Frontend-Only Project**: Despite the name "artifact-drift", this is currently ONLY a frontend application. There is no backend code in this repository. The backend is entirely mocked via MSW (Mock Service Worker).

**Mock Data Location**: All mock data and API handlers are in `frontend/src/mocks/`. This is NOT test data - it's the actual data layer for the application. The `handlers.ts` file implements the complete API contract.

**Three-Layer Architecture**: The app visualizes drift across three layers, but these are conceptual:
- `intent` - Planned architecture (from design docs)
- `terraform` - IaC state
- `runtime` - Deployed infrastructure

These layers don't correspond to directories or modules. They're data attributes on nodes/edges in the graph.

**Feature-Based Organization**: `src/features/` contains complete feature modules (dashboard, drift, graph, integrations, reports, methodology). Each feature is self-contained with its own components, hooks, and logic. NOT organized by technical layer (components/hooks/utils).

**API Types Contract**: `src/api/types.ts` defines the contract between frontend and (future) backend. These mirror Pydantic schemas that don't exist yet. Comments in the file explicitly state this is the contract "the mock layer and the real FastAPI backend both satisfy."

**MSW Worker Directory**: The MSW service worker MUST be in `public/` directory (configured in package.json `msw.workerDirectory`). This is non-standard - many projects put it in `src/`. Moving it will break the mock layer.

**Severity vs Status**: Drift records have BOTH `severity` (critical/high/medium/low/info) and `status` (open/acknowledged/resolved/suppressed). Severity is immutable (from detection), status is user-controlled (workflow state).

**Graph Visualization**: Uses ReactFlow library. The graph layout is computed via Dagre algorithm in `src/features/graph/layout.ts`. Node positions are calculated, not stored in data.