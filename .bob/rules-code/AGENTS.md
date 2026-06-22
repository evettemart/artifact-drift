# Code Mode Rules

## Non-Obvious Coding Patterns

**MSW Handler Mutations**: When adding new API endpoints, mock handlers in `src/mocks/handlers.ts` MUST use `mockStore.update()` for state changes, not direct mutations. The store is Zustand-based and requires the update wrapper.

**Scan Cloning Pattern**: New drift scans clone records from existing runs with matching layer pairs. This maintains deterministic drift patterns. See `POST /scans` handler - it finds a template run and clones its records with new IDs.

**Severity Dual Definition**: Severity colors exist in TWO places that must stay in sync:
1. `tailwind.config.ts` - Tailwind theme colors for CSS classes
2. `src/lib/severity.ts` - Hex values for charts/ReactFlow nodes
Never update one without the other.

**API Client Error Handling**: `src/api/client.ts` throws `ApiError` with status codes. Always catch and handle these specifically, not generic Error. The error message is extracted from response JSON `error` field if present.

**Type Contract**: `src/api/types.ts` DTOs are the contract between frontend and backend. Never add frontend-only fields here. Use separate types in feature modules for UI-specific state.

**Path Imports**: ALWAYS use `@/` alias for imports, never `../` across feature boundaries. Only use relative imports within the same feature directory.

**Mock Latency**: `src/mocks/latency.ts` adds artificial delays to simulate network. Use `await latency()` in handlers. Some operations (scans, tests) use longer delays via `latency(min, max)`.

**Graph Node UIDs**: In graph data, node/edge `uid` fields are the canonical identifiers. The `id` field on GraphSnapshot is the snapshot ID, not node ID. Drift records reference nodes via `nodeUid` or `edgeUid`.

**Bootstrap Sequence**: `main.tsx` conditionally starts MSW worker BEFORE rendering React. This is critical - if MSW starts after React, initial API calls will fail. Always await `startMockWorker()`.