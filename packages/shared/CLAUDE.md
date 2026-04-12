# Shared Package

## What lives here

- `src/types/` — Shared TypeScript types (AgentType, StreamEvent, PredictionResult, etc.)
- `src/constants/` — API route constants, enums
- `src/utils/` — Scoring algorithms, shared utilities

## Build

After changes: `pnpm --filter @study-abroad/shared build`
Mobile CI depends on `dist/` output.

## package.json exports

- `types` + `import` -> `.ts` source (tsc uses)
- `default` -> `dist/*.js` (Metro/Node uses)
- Do NOT point `default` to `.ts` or `types` to `dist/`
