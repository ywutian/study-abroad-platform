# Database Migration Baseline Resolution

Status: BLOCKED_UNRECOVERABLE_MIGRATION_REQUIRED
Generated at: 2026-05-23T01:12:54.818Z
Decision: continue-external-search
Target scope: none
Required ack: APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE

## Summary

- Checksum review: PASS
- External artifact packet: not provided
- Unrecoverable artifact search: UNRECOVERABLE_ARTIFACT_SEARCH_READY_NO_MATCH
- Mismatches/unresolved/checksum-review exact/external exact/combined exact: 0/0/0/0/0
- Unrecoverable migration rows/unresolved/exact matches: 1/1/0
- Approval ready: false
- Missing required fields: 1
- DB writes allowed by this artifact: false

## Required Fields

- external exact SQL artifact for unrecoverable migration history, or explicit baseline/resolve decision

## Operator Inputs

- external-exact-sql-or-baseline-decision
  - required: false
  - provided: false
  - expected: exact SQL artifact match, restore-exact-sql decision, or baseline-resolve-local-only decision
  - actual: continue-external-search
- unrecoverable-migration-external-artifact-or-baseline-decision
  - required: true
  - provided: false
  - expected: exact SQL artifact for unrecoverable migration, restore-exact-sql decision, or baseline-resolve-local-only decision
  - actual: continue-external-search
- target-scope
  - required: false
  - provided: false
  - expected: local-existing|local-disposable|staging-clone
  - actual: none
- approved-operator-workflow
  - required: false
  - provided: false
  - expected: approved workflow id
  - actual: none
- operator-ack
  - required: false
  - provided: false
  - expected: APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE
  - actual: none
- rationale
  - required: false
  - provided: false
  - expected: operator rationale
  - actual: none
- backup-evidence
  - required: false
  - provided: false
  - expected: backup, disposable DB, or staging clone evidence
  - actual: none

## Guardrails

- Mode: read-only
- Production scope allowed: false
- Destructive DB write allowed by this artifact: false
- Supported baseline scopes: local-existing, local-disposable, staging-clone
- Omitted write commands: prisma migrate resolve, prisma migrate deploy, prisma db push, SQL restore, migration-directory writes

## Unresolved Mismatches


## Recommended Sequence

1. Continue external artifact/backup lookup for the exact applied SQL, or choose an explicit baseline resolve path.
2. For baseline resolve, rerun with --decision baseline-resolve-local-only --target-scope <local-existing|local-disposable|staging-clone> --approved-operator-workflow <id> --operator-ack APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE --rationale <text> --backup-evidence <text>.
3. Do not apply schema migrations to valuable data until this decision artifact is approved.

## Recommended Next Step

- external-artifact-or-baseline-approval: continue external exact SQL recovery or obtain explicit non-production baseline approval
- Audit-only command: pnpm --filter api audit:database-migration-baseline-resolution -- --checksum-review scripts/closure-reports/database-migration-checksum-review-2026-05-23T01-12-36-694Z.json --unrecoverable-artifact-search scripts/closure-reports/database-migration-unrecoverable-artifact-search-2026-05-23T01-12-36-695Z.json --decision baseline-resolve-local-only --target-scope <local-existing|local-disposable|staging-clone> --approved-operator-workflow <id> --operator-ack APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE --rationale <text> --backup-evidence <text>

