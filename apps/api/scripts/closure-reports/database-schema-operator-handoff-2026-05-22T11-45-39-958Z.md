# Database Schema Operator Handoff

Status: DATABASE_SCHEMA_OPERATOR_HANDOFF_READY_WITH_BLOCKERS
Generated at: 2026-05-22T11:45:39.962Z

## Summary

- Total rows: 37
- Blocking rows: 3
- Restore candidate rows: 4
- Unrecoverable migration rows: 1
- Current repo apply rows: 2

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
