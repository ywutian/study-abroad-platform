# Database Schema Operator Handoff

Status: DATABASE_SCHEMA_OPERATOR_HANDOFF_READY_WITH_BLOCKERS
Generated at: 2026-05-23T01:44:14.359Z

## Summary

- Total rows: 37
- Blocking rows: 3
- Restore candidate rows: 4
- Unrecoverable migration rows: 1
- Current repo apply rows: 2
- Baseline proposal next campaign: database_migration_external_exact_sql_recovery
- External candidate intake: waiting_for_external_candidate_artifact
- External candidate root: apps/api/scripts/closure-reports/database-migration-external-candidate-intake
- External candidate target manifest: apps/api/scripts/closure-reports/database-migration-external-candidate-intake/TARGETS.json
- External candidate verification command: pnpm --filter api audit:database-migration-external-artifact-packet -- --candidate-root apps/api/scripts/closure-reports/database-migration-external-candidate-intake --scan-archives
- External candidate accepted archive names: <artifact>.zip containing migration.sql, <artifact>.tar or <artifact>.tar.gz containing migration.sql, <artifact>.tgz containing migration.sql, <artifact>.sql.gz containing the exact SQL bytes
- External candidate searched roots: apps/api/prisma/migrations, apps/api/scripts/closure-reports, apps/api/scripts/closure-reports/database-migration-external-candidate-intake
- Exact SQL artifact matches: 0
- Local artifact search: BLOCKED_EXACT_SQL_NOT_FOUND
- External artifact packet: BLOCKED_EXTERNAL_ARTIFACT_REQUIRED
- External candidate verification checklist:
  - Place external candidates only under the suggested candidate root.
  - Keep original artifact packaging where possible; archive candidates are read-only scanned with --scan-archives.
  - Pass only if the packet reports exactArtifactMatches > 0 with the required SHA-256.
  - Do not restore, copy, resolve, deploy, or baseline from an unverified candidate.
- External candidate target rows:
  - 20260428120000_add_mbti_and_personality_tags: path=apps/api/prisma/migrations/20260428120000_add_mbti_and_personality_tags/migration.sql; requiredSha256=cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66

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
