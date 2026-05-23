# Database Schema Operator Handoff

Status: DATABASE_SCHEMA_OPERATOR_HANDOFF_READY_WITH_BLOCKERS
Generated at: 2026-05-22T15:42:35.700Z

## Summary

- Total rows: 37
- Blocking rows: 3
- Restore candidate rows: 4
- Unrecoverable migration rows: 1
- Current repo apply rows: 2
- Baseline proposal next campaign: database_migration_external_exact_sql_recovery
- External candidate intake: waiting_for_external_candidate_artifact
- External candidate root: apps/api/scripts/closure-reports/database-migration-external-candidate-intake
- External candidate verification command: pnpm --filter api audit:database-migration-external-artifact-packet -- --candidate-root apps/api/scripts/closure-reports/database-migration-external-candidate-intake --scan-archives
- Exact SQL artifact matches: 0
- Local artifact search: BLOCKED_EXACT_SQL_NOT_FOUND
- External artifact packet: BLOCKED_EXTERNAL_ARTIFACT_REQUIRED

## Guardrails

- Codex may do: Generate read-only evidence, review packets, checksums, and operator handoff artifacts.
- Codex must not do: Do not run prisma migrate deploy/dev/resolve, db push, pg_restore, SQL restore, or copy staged migrations into prisma/migrations without explicit operator approval.

## Phases

| Phase | Rows |
| --- | ---: |
| 04_apply_current_repo_migration_after_history_closed | 2 |
| 02_external_artifact_or_baseline_review | 1 |
| 01_review_checksum_matched_restore_candidate | 4 |
| 03_review_extra_db_object_drift | 30 |
