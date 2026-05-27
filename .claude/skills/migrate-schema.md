---
name: migrate-schema
description: Safely change the Prisma schema with zero-downtime guarantee, full consumer-scan, and pre-push migration-safety gate. Covers nullable-or-default rule, db:generate before typecheck, mock updates across all PrismaService tests, BRIEF.md sync, and pre-push hook compliance. Use for any change to apps/api/prisma/schema.prisma.
---

# Migrate Schema

A repeatable procedure for changing the Prisma schema without breaking deploys or downstream consumers. The schema is ~3725 lines with 117 models — silent breakage is easy if you don't follow the steps.

## When to use

Any change to `apps/api/prisma/schema.prisma`:
- Add column / model / enum
- Rename column / model
- Change column type
- Add index / foreign key
- Drop column / model (extra-strict — see "Destructive changes" below)

Do NOT use for: `db:push` (dev-only, forbidden in staging/prod), data-only changes (seed scripts), schema-equivalent refactors with no migration file.

## The five-step procedure

```
plan → write migration → consumer scan → verify → commit
```

### ① Plan: nullable-or-default rule

**Every new column** must be one of:
- `Type?` (nullable) — preferred for soft-launch
- `Type @default(value)` (default) — only when default is universally valid
- `Type @default(now())` — for timestamps
- Two-phase if neither works: add nullable first → backfill → make required in next migration

**Never** add a `NOT NULL` column without `@default` in a single migration — locks the table on a live DB and breaks rolling deploys.

### ② Write migration

```bash
cd apps/api
pnpm --filter api db:migrate -- --name <descriptive_name>
# Examples:
#   add_essay_debate_session
#   add_user_role_counselor
#   add_admission_case_source_archive_columns
```

Inspect the generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`:
- Does it match what you expected?
- For ALTER TABLE: is it `IF EXISTS`-safe / online-safe?
- For DROP: is the data backed up or confirmed disposable?

### ③ Consumer scan (the step most often skipped)

For every changed model/column, grep ALL of:

```bash
# 1. Prisma selects (shared constants)
grep -rn "<ColumnName>" apps/api/src/common/constants/prisma-selects.ts
# 2. DTOs
grep -rn "<ColumnName>" apps/api/src/modules/*/dto/
# 3. Mappers (where field is renamed/projected to API response)
grep -rn "<ColumnName>" apps/api/src/modules/*/*.constants.ts
# 4. Admin UI (frequently missed)
grep -rn "<ColumnName>" apps/web/src/app/\[locale\]/\(main\)/admin/
# 5. Mobile app (if cross-platform contract)
grep -rn "<ColumnName>" apps/mobile/src/
# 6. Shared types
grep -rn "<ColumnName>" packages/shared/src/
# 7. Test mocks (PrismaService mocks)
grep -rn "<ModelName>" apps/api/src/**/*.spec.ts
```

For each hit, mark in the PR description:
- `[updated]` — code was changed to handle the new shape
- `[N/A: reason]` — explicitly explain why no change needed

**Hidden landmine**: when adding a new model, every PrismaService mock in every `*.spec.ts` may need that model added (or tests crash on `prisma.newModel.findMany is not a function`).

### ④ Verify locally

```bash
# Always run db:generate after schema change — never skip this step
pnpm --filter api db:generate

# Typecheck the whole API; new TS errors usually mean a consumer missed step ③
cd apps/api && npx tsc --noEmit

# Run relevant module tests
pnpm --filter api test src/modules/<changed-module>

# If the schema change touches a feature with frontend usage:
cd apps/web && pnpm typecheck

# Migration safety check (CI runs this in pre-push hook)
npx tsx scripts/check-migration-safety.ts --new-only
```

Pre-push hook also enforces:
- NOT NULL without DEFAULT → BLOCK
- DROP TABLE without explicit `// destructive-ok: <reason>` comment → BLOCK
- Renamed column without migration ALTER step → BLOCK

### ⑤ Commit & sync docs

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/<...>
# Also add consumer updates from step ③
git add apps/api/src/modules/<...> apps/web/src/<...> apps/mobile/src/<...>
git commit -m "feat(<module>): add <columns> for <reason>"
```

If a module's data model changed materially, update its `BRIEF.md`:
- `apps/api/src/modules/<module>/BRIEF.md` should mention the new fields if they affect public contract
- Don't document private internal state

## Destructive changes (DROP / rename)

A second-level protocol:
1. **Stage 1 (this PR)**: rename `oldField` to `oldField_deprecated`, add new `newField`, dual-write code
2. **Stage 2 (next PR after deploy)**: stop writing `oldField_deprecated`
3. **Stage 3 (one release later)**: drop `oldField_deprecated`

Never combine all three in one migration on a live DB — rolling deploys see both old and new code temporarily.

## Mock checklist (Prisma model mocks in tests)

When adding a new model `Foo`:

```typescript
// In every PrismaService mock across the test suite:
const mockPrisma = {
  // ...existing models
  foo: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
};
```

Run `pnpm --filter api test` after — if anything breaks with "is not a function" on `prisma.foo.*`, that test needs the mock added.

## CI gate behavior

- `prisma migrate deploy` runs automatically before service update
- Migration files are append-only — never edit a previously committed migration
- Production CI gate: `check-migration-safety.ts` blocks risky migrations

## Quick reference table

| Change | Stage-1 migration shape | Notes |
|---|---|---|
| Add column nullable | `colName Type?` | Safest; no backfill needed |
| Add column with default | `colName Type @default(v)` | Default must be safe for existing rows |
| Add NOT NULL column | Two-phase: nullable + backfill + tighten | Never one-shot on live DB |
| Add enum value | `enum E { existing, NEW_VALUE }` | Forward-safe in Postgres ≥ 9.1 |
| Rename column | `@map("old_name")` first, then physical rename | Code uses new name, DB stays old |
| Drop column | Three-PR staged process | See "Destructive changes" |
| Add index | `@@index([col])` | Concurrent-friendly in Postgres |
| Add foreign key | `references` clause | Check NULL behavior on parent delete |

## Anti-patterns

| Anti-pattern | Why bad | Fix |
|---|---|---|
| `db:push` to staging | Bypasses migration history | `db:migrate` always |
| Editing committed migration SQL | Hash mismatch on next deploy | New migration file |
| NOT NULL without DEFAULT | Locks table, breaks rolling deploy | Nullable first, tighten later |
| Skipping `db:generate` | TypeScript out of sync | Always after schema change |
| Single-PR DROP COLUMN | Rolling deploy sees inconsistent state | 3-PR destructive protocol |
| Missing test mock | Tests crash silently in CI | Grep `mockPrisma` across all specs |
| No consumer scan | Frontend/mobile breaks at runtime | Step ③ is mandatory |
