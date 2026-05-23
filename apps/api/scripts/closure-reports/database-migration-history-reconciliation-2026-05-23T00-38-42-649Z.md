# Database Migration History Reconciliation

Status: BLOCKED_UNRECOVERABLE_MIGRATION_HISTORY
Generated at: 2026-05-23T00:38:42.904Z
Source worklist: scripts/closure-reports/database-schema-compatibility-worklist-2026-05-23T00-38-36-371Z.json

## Summary

- appliedMigrationsMissingFromRepo: 5
- recoverableFromGit: 4
- checksumMatches: 4
- checksumMismatches: 0
- unrecoverable: 1
- alreadyPresent: 0
- baselineMigrationExists: true

## Risk Assessment

- Destructive DB write allowed by this plan: false
- Can auto-restore without review: false
- Likely squashed history: true
- Decision: At least one missing migration cannot be recovered or checksum-matched; manual migration-history recovery is required.

## Recommended Sequence

1. Manually locate unrecoverable migration SQL from backups, teammates, or deployment artifacts.
2. Do not run migrate deploy against valuable data.
3. After restoring or resolving missing history, rerun schema compatibility and reconciliation.

## Missing Migration Rows

- 20260428120000_add_mbti_and_personality_tags: unrecoverable
  - recoveredFrom: none
  - checksumMatchesDb: null
  - lines: unknown
- 20260504090000_add_school_historical_data_and_nullable_deadlines: recoverable-from-git
  - recoveredFrom: e378c63ad67428d97db612da990fb8d222ed6f83:apps/api/prisma/migrations/20260504090000_add_school_historical_data_and_nullable_deadlines/migration.sql
  - checksumMatchesDb: true
  - lines: 37
- 20260505120000_add_school_cds_importance_and_scorecard_snapshot: recoverable-from-git
  - recoveredFrom: 374b061145c6d2a28c8cb797aab34c6361e6cd45:apps/api/prisma/migrations/20260505120000_add_school_cds_importance_and_scorecard_snapshot/migration.sql
  - checksumMatchesDb: true
  - lines: 7
- 20260517040000_closure_v2_core_schema: recoverable-from-git
  - recoveredFrom: 758a28a5710215ddffbfe3b6f52446ec45ab2963:apps/api/prisma/migrations/20260517040000_closure_v2_core_schema/migration.sql
  - checksumMatchesDb: true
  - lines: 64
- 20260517050000_closure_v2_closure_target: recoverable-from-git
  - recoveredFrom: bacab9220fd8fcd275dadd1f91ddcf4b07eb0c2a:apps/api/prisma/migrations/20260517050000_closure_v2_closure_target/migration.sql
  - checksumMatchesDb: true
  - lines: 38

