# ADR-0002: Prisma Migration Manual Resolve Strategy

- Status: accepted
- Date: 2026-02-07
- Decision-makers: Core Team
- Tags: database, prisma, migrations

## Context

During rapid development, the `Competition` model and `Award.competitionId` column were applied directly to the database via `prisma db push` without creating formal migration files. This caused a **schema drift**: the database was in sync with `schema.prisma`, but the `_prisma_migrations` table lacked the corresponding migration record.

Attempting `prisma migrate dev` triggered a **P3006 error** because the shadow database could not replay older migrations from scratch — earlier migrations referenced tables or enums that did not exist at that point in history.

This is a known limitation of projects that mix `db push` (for rapid iteration) with `migrate dev` (for formal migration tracking).

## Decision

Use the **manual resolve** approach:

1. Verify database-schema synchronization:

   ```bash
   prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel ./prisma/schema.prisma --script
   # Output: empty (database is already in sync)
   ```

2. Create the `migration_lock.toml` file (was missing):

   ```toml
   provider = "postgresql"
   ```

3. Manually author the migration SQL file:

   ```
   prisma/migrations/20260207_add_competition_model/migration.sql
   ```

4. Mark the migration as applied without executing it:
   ```bash
   prisma migrate resolve --applied 20260207_add_competition_model
   ```

This approach acknowledges the existing state without attempting to replay history.

## Consequences

### Positive

- Migration history is now consistent (`prisma migrate status` shows all migrations applied)
- The migration SQL is version-controlled and reviewable
- No destructive changes to the production database
- Future `prisma migrate deploy` will work correctly for new migrations

### Negative

- Shadow database still cannot replay the full migration history from scratch
- `prisma migrate dev` on a fresh database may fail; use `prisma migrate deploy` + `db push` for fresh setups
- Requires discipline to use `migrate dev --create-only` for future schema changes

### Neutral

- This approach is explicitly documented in the [Prisma migration troubleshooting guide](https://www.prisma.io/docs/guides/database/production-troubleshooting)
- Detailed steps are recorded in `docs/技术文档/数据库迁移记录.md`
