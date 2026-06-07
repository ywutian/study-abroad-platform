---
description: "Testing patterns and conventions"
globs: ["**/*.spec.ts", "**/*.test.ts", "**/*.test.tsx", "**/*.e2e-spec.ts"]
---

# Testing Rules

## Mock Patterns

- **Prisma mock**: New Prisma models require adding corresponding model mock to all `PrismaService` mocks
- **Zustand selector mock**: `jest.fn((selector) => selector ? selector(state) : state)`
- **Coverage thresholds — one-way ratchet**: per-app `coverageThreshold` (jest) / `thresholds` (vitest) must stay **≥** `scripts/coverage-thresholds.baseline.json`. `pnpm lint:coverage-ratchet` (in `lint:all`) blocks silent lowering; raise freely, and after adding tests run `pnpm lint:coverage-ratchet --update` to lock the higher floor. Lowering requires editing the baseline in the same PR (explicit + reviewed). Never re-add `--passWithNoTests` to a CI jest run — it lets a zero-test run pass and neuters the floor.

## Test File Conventions

- API: Jest (`*.spec.ts`)
- Web: Vitest (`*.test.ts`, `*.test.tsx`)
- E2E: Jest (`*.e2e-spec.ts`, requires Docker PG + Redis)

## E2E Tests

- API route renames/deletes: sync `apps/api/test/*.e2e-spec.ts`
- Uses `pgvector/pgvector:pg16` + `redis:7-alpine` service containers

## Deep Dive

- Full testing checklist & patterns: `docs/TESTING_CHECKLIST.md`

## Verification Gate

```bash
npx tsx scripts/verify-gate.ts            # All uncommitted changes
npx tsx scripts/verify-gate.ts --staged   # Staged files only
npx tsx scripts/verify-gate.ts --verbose  # Show skipped checks
```
Auto-detects affected apps, runs only relevant typecheck + test + lint:routes + lint:i18n.
