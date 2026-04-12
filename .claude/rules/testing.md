---
description: "Testing patterns and conventions"
globs: ["**/*.spec.ts", "**/*.test.ts", "**/*.test.tsx", "**/*.e2e-spec.ts"]
---

# Testing Rules

## Mock Patterns

- **Prisma mock**: New Prisma models require adding corresponding model mock to all `PrismaService` mocks
- **Zustand selector mock**: `jest.fn((selector) => selector ? selector(state) : state)`
- **Coverage thresholds**: New app starts at 3-5%, increase gradually

## Test File Conventions

- API: Jest (`*.spec.ts`)
- Web: Vitest (`*.test.ts`, `*.test.tsx`)
- E2E: Jest (`*.e2e-spec.ts`, requires Docker PG + Redis)

## E2E Tests

- API route renames/deletes: sync `apps/api/test/*.e2e-spec.ts`
- Uses `pgvector/pgvector:pg16` + `redis:7-alpine` service containers

## Verification Gate

```bash
npx tsx scripts/verify-gate.ts            # All uncommitted changes
npx tsx scripts/verify-gate.ts --staged   # Staged files only
npx tsx scripts/verify-gate.ts --verbose  # Show skipped checks
```
Auto-detects affected apps, runs only relevant typecheck + test + lint:routes + lint:i18n.
