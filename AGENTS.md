# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Structure

Frontend-only React + TypeScript application using Vite. Backend is mocked with MSW (Mock Service Worker).

## Commands

All commands run from `frontend/` directory:
- `npm run dev` - Start dev server (port 5173, auto-opens browser)
- `npm run build` - Type check + production build
- `npm run typecheck` - Run TypeScript compiler without emitting
- `npm run lint` - ESLint check

## Non-Obvious Patterns

**MSW Mock Layer**: The app runs entirely on mock data via MSW. Toggle with `VITE_USE_MOCKS=true` in `.env.development`. MSW worker must be in `public/` directory (configured in package.json `msw.workerDirectory`). Bootstrap in `main.tsx` conditionally starts the worker before rendering React.

**API Client Seam**: `src/api/client.ts` is the single integration point. MSW intercepts these calls in dev; production would hit real FastAPI. All API calls use the typed `api` object (get/post/put/patch methods).

**Path Alias**: `@/` maps to `src/` (configured in both `vite.config.ts` and `tsconfig.json`). Always use `@/` imports, never relative paths across feature boundaries.

**Severity System**: Severity colors are defined in `tailwind.config.ts` as custom theme colors (`severity.critical`, etc.) AND in `src/lib/severity.ts` as metadata with hex values. The hex values are for charts/graphs that can't use Tailwind classes. Keep both in sync.

**Layer Labels**: The three architecture layers (`intent`, `terraform`, `runtime`) have human-facing names defined in `src/lib/layers.ts`. Always use `layerLabel()` function for display, never hardcode labels.

**Mock Store Mutations**: `src/mocks/store.ts` uses Zustand. Mock handlers in `src/mocks/handlers.ts` mutate this store with `mockStore.update()`. New scans clone existing records to maintain deterministic drift patterns.

**Tailwind Merge**: Use `cn()` utility from `src/lib/cn.ts` for conditional classes. It merges with `clsx` and resolves Tailwind conflicts via `tailwind-merge`.

**Type Safety**: DTOs in `src/api/types.ts` mirror backend Pydantic schemas. This is the contract both mock layer and future backend must satisfy. Never add frontend-only fields to these types.