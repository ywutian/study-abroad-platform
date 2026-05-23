# Database Migration Restore Candidate Bundle

Status: STAGED_RESTORE_CANDIDATES_WITH_BLOCKERS
Generated at: 2026-05-22T15:11:38.684Z
Bundle dir: apps/api/scripts/closure-reports/database-migration-restore-candidate-bundle-2026-05-22T15-11-38-634Z
Destructive DB write allowed: false
Writes to prisma/migrations: false

## Summary

- reconciliationMissingFromRepo: 5
- checksumMatchedRows: 4
- checksumMismatchRows: 0
- unrecoverableRows: 1
- baselineMigrationExists: true
- stagedRestoreCandidates: 4
- blockedRows: 1

## Recommended Sequence

1. Review the staged checksum-matched migration files in this bundle only; they have not been restored to prisma/migrations.
2. Continue exact SQL recovery for blocked rows, or create a non-production baseline/resolve review packet.
3. Do not copy staged files into prisma/migrations until the full migration-history path is approved.
4. After approval/restoration, rerun schema compatibility, migration reconciliation, checksum review, and schema alignment planning.

## Staged Candidates

- 20260504090000_add_school_historical_data_and_nullable_deadlines: da2b587c4ff1e65210a399271ae2802ac837a981a2a54ea2e3832930d5fc46cc (apps/api/scripts/closure-reports/database-migration-restore-candidate-bundle-2026-05-22T15-11-38-634Z/apps/api/prisma/migrations/20260504090000_add_school_historical_data_and_nullable_deadlines/migration.sql)
- 20260505120000_add_school_cds_importance_and_scorecard_snapshot: 3e69ee985fa0d5ecccd0fbd37c63445c1f49945e89e0b258abc0775b76fe9f1b (apps/api/scripts/closure-reports/database-migration-restore-candidate-bundle-2026-05-22T15-11-38-634Z/apps/api/prisma/migrations/20260505120000_add_school_cds_importance_and_scorecard_snapshot/migration.sql)
- 20260517040000_closure_v2_core_schema: 1d49bcec5812921376a0ee0577c59148511983d5ef8b15b1d9a4cbc99f6dead9 (apps/api/scripts/closure-reports/database-migration-restore-candidate-bundle-2026-05-22T15-11-38-634Z/apps/api/prisma/migrations/20260517040000_closure_v2_core_schema/migration.sql)
- 20260517050000_closure_v2_closure_target: 5e37c06efa28d017bc5e0841bc70e1d3782fecf572c3317db317d8185e16cb2d (apps/api/scripts/closure-reports/database-migration-restore-candidate-bundle-2026-05-22T15-11-38-634Z/apps/api/prisma/migrations/20260517050000_closure_v2_closure_target/migration.sql)

## Blocked Rows

- 20260428120000_add_mbti_and_personality_tags: No recoverable git spec is available for this migration. db=cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66 recovered=null

