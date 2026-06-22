# Artifact Drift

Architecture drift detection and visualization platform. Compares intended architecture (design docs, IaC) against deployed infrastructure to identify configuration drift, missing resources, and unexpected changes.

## Overview

Frontend-only React application with mock backend (MSW). Visualizes drift across three architecture layers:
- **Intent**: Planned architecture from design documents
- **Terraform**: Infrastructure as Code state
- **Runtime**: Actual deployed resources

## Features

- **Dashboard**: Compliance scoring, severity breakdown, recent drift runs
- **Drift Detection**: Compare any two layers, filter by severity/status/type
- **Graph Visualization**: Interactive architecture graph with drift highlighting
- **Reports**: Generate HTML/PDF/JSON reports from drift runs
- **Integrations**: Connect to AWS, Terraform, Confluence, Draw.io (mocked)
- **Copilot**: AI assistant grounded in drift records (mocked)

## Getting Started

```bash
cd frontend
npm install
npm run dev
```

Opens browser at http://localhost:5173 with mock data enabled.

## Development

**Commands** (run from `frontend/`):
```bash
npm run dev        # Start dev server
npm run build      # Type check + production build
npm run typecheck  # TypeScript validation
npm run lint       # ESLint check
```

**Mock Data**: Controlled by `VITE_USE_MOCKS=true` in `.env.development`. MSW intercepts API calls and serves deterministic mock responses. See `src/mocks/` for handlers and fixtures.

**Architecture**:
- `src/api/` - API client and type definitions
- `src/features/` - Feature-based modules (dashboard, drift, graph, etc.)
- `src/components/` - Shared UI components
- `src/lib/` - Utilities (severity, layers, formatting, scoring)
- `src/mocks/` - MSW handlers and mock data store

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** - Build tool
- **TanStack Query** - Server state management
- **Zustand** - Client state (mock store)
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **ReactFlow** - Graph visualization
- **Recharts** - Charts
- **MSW** - API mocking

## License

MIT License - see [LICENSE](LICENSE)