# Database Schema Alignment Plan

Status: BLOCKED_DIVERGENT_MIGRATION_HISTORY
Generated at: 2026-05-22T11:11:49.876Z
Source worklist: scripts/closure-reports/database-schema-compatibility-worklist-2026-05-22T11-11-39-418Z.json

## Summary

- Rows: 37
- Missing tables: 1
- Missing columns: 0
- Unapplied repo migrations: 1
- Applied migrations missing from repo: 5
- Missing objects without repo migration signal: 0
- Last common migration: 20260515143000_chat_workbench_foundation

## Risk Assessment

- Destructive DB write allowed by this plan: false
- Decision: Resolve or explicitly review blockers before DB-backed data closure can proceed.
- Blocker: The target database has applied migrations that are absent from the repo migration directory.
- Blocker: 1 repo migrations are not recorded as applied in the target database.
- Risk: Blindly running migrate deploy against a valuable database could compound a divergent migration history.
- Risk: Last common migration: 20260515143000_chat_workbench_foundation.

## Recommended Sequence

1. Confirm the target database is the intended local/staging database, not production.
2. Create a backup or disposable clone before any schema write.
3. Restore or review the DB-applied migration files that are missing from the repo, or document an explicit baseline/resolve decision.
4. Do not run migrate deploy against valuable data until migration history divergence is resolved.
5. After reconciliation, rerun audit:database-schema-compatibility and this alignment plan.

## Verification Commands

- `pnpm --filter api audit:database-schema-compatibility -- --out /tmp/database-schema-compatibility.json --db-timeout-ms 8000`
- `pnpm --filter api audit:database-schema-alignment-plan -- --worklist /Users/yitianwu/Documents/study-abroad-platform/apps/api/scripts/closure-reports/database-schema-compatibility-worklist-2026-05-22T11-11-39-418Z.json --out /tmp/database-schema-alignment-plan.json`
- `pnpm --filter api audit:platform-data-closure -- --out /tmp/platform-data-closure.json --db-timeout-ms 8000`
- `pnpm --filter api audit:profile-readiness-worklist -- --out /tmp/profile-readiness-worklist.json --limit 3000`

## Top Migration History Rows

- Unapplied repo migration: 20260520191100_add_user_notification_preferences
- Applied DB migration missing from repo: 20260428120000_add_mbti_and_personality_tags
- Applied DB migration missing from repo: 20260504090000_add_school_historical_data_and_nullable_deadlines
- Applied DB migration missing from repo: 20260505120000_add_school_cds_importance_and_scorecard_snapshot
- Applied DB migration missing from repo: 20260517040000_closure_v2_core_schema
- Applied DB migration missing from repo: 20260517050000_closure_v2_closure_target

