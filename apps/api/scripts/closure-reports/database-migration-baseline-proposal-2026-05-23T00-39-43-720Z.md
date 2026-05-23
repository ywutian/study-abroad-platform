# Database Migration Baseline Proposal Packet

Status: BASELINE_PROPOSAL_READY_REVIEW_REQUIRED

This is a read-only proposal packet. It does not restore migration files, run Prisma resolve/deploy, or write to the database.

## Summary

- Schema worklist: BLOCKED (37 rows)
- Missing tables/columns: 1/0
- Unapplied repo migrations: 1
- DB-applied migrations missing from repo: 5
- Open migration blockers: 7
- Reconciliation: BLOCKED_UNRECOVERABLE_MIGRATION_HISTORY; checksum matches/mismatches: 4/0
- Unrecoverable migration rows: 1
- Restore bundle: STAGED_RESTORE_CANDIDATES_WITH_BLOCKERS; staged/blocked: 4/1
- Checksum review: PASS; unresolved mismatches: 0
- Checksum variant analysis: PASS_NO_CHECKSUM_MISMATCH; checks=0; exact variant matches=0
- Unrecoverable artifact search: UNRECOVERABLE_ARTIFACT_SEARCH_READY_NO_MATCH; exact matches=0; archives=0; archive entries=0
- Local/external exact SQL matches: 0
- Baseline resolution: BLOCKED_UNRECOVERABLE_MIGRATION_REQUIRED; decision=continue-external-search; approvalReady=false; missingInputs=1; dbWriteAllowed=false
- Baseline scope preflight: BLOCKED_DATABASE_UNAVAILABLE; target=local-existing; missingInputs=2; backupEvidence=false
- Backup evidence packet: BLOCKED_BACKUP_EVIDENCE_REQUIRED; ready=false; missingInputs=1; artifactExists=false
- Baseline approval request: BLOCKED_BACKUP_EVIDENCE_NOT_READY; ready=false; missingInputs=2

## External Candidate Intake

- Status: waiting_for_external_candidate_artifact
- Suggested candidate root: apps/api/scripts/closure-reports/database-migration-external-candidate-intake
- Accepted file names: migration.sql, <migration-name>/migration.sql
- Accepted archive names: <artifact>.zip containing migration.sql, <artifact>.tar or <artifact>.tar.gz containing migration.sql, <artifact>.tgz containing migration.sql, <artifact>.sql.gz containing the exact SQL bytes
- Verification command: pnpm --filter api audit:database-migration-external-artifact-packet -- --candidate-root apps/api/scripts/closure-reports/database-migration-external-candidate-intake --scan-archives
- Guardrail: This intake is only for checksum verification; do not copy candidates into apps/api/prisma/migrations or run Prisma write commands from this packet.
- Searched roots: apps/api/prisma/migrations, apps/api/scripts/closure-reports, apps/api/scripts/closure-reports/database-migration-external-candidate-intake
- Verification checklist:
  - Place external candidates only under the suggested candidate root.
  - Keep original artifact packaging where possible; archive candidates are read-only scanned with --scan-archives.
  - Pass only if the packet reports exactArtifactMatches > 0 with the required SHA-256.
  - Do not restore, copy, resolve, deploy, or baseline from an unverified candidate.

### Candidate Intake Targets

- Migration: 20260428120000_add_mbti_and_personality_tags
  - Request subject: Recover exact migration SQL for 20260428120000_add_mbti_and_personality_tags
  - Source kind: unrecoverable_migration
  - Target path: apps/api/prisma/migrations/20260428120000_add_mbti_and_personality_tags/migration.sql
  - Required SHA-256: cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66

## Open Migration History Rows

- 20260428120000_add_mbti_and_personality_tags: dbChecksum=cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66, recoveredSha=unknown, disposition=unrecoverable
- 20260504090000_add_school_historical_data_and_nullable_deadlines: dbChecksum=da2b587c4ff1e65210a399271ae2802ac837a981a2a54ea2e3832930d5fc46cc, recoveredSha=da2b587c4ff1e65210a399271ae2802ac837a981a2a54ea2e3832930d5fc46cc, disposition=recoverable-from-git
- 20260505120000_add_school_cds_importance_and_scorecard_snapshot: dbChecksum=3e69ee985fa0d5ecccd0fbd37c63445c1f49945e89e0b258abc0775b76fe9f1b, recoveredSha=3e69ee985fa0d5ecccd0fbd37c63445c1f49945e89e0b258abc0775b76fe9f1b, disposition=recoverable-from-git
- 20260517040000_closure_v2_core_schema: dbChecksum=1d49bcec5812921376a0ee0577c59148511983d5ef8b15b1d9a4cbc99f6dead9, recoveredSha=1d49bcec5812921376a0ee0577c59148511983d5ef8b15b1d9a4cbc99f6dead9, disposition=recoverable-from-git
- 20260517050000_closure_v2_closure_target: dbChecksum=5e37c06efa28d017bc5e0841bc70e1d3782fecf572c3317db317d8185e16cb2d, recoveredSha=5e37c06efa28d017bc5e0841bc70e1d3782fecf572c3317db317d8185e16cb2d, disposition=recoverable-from-git

## Unresolved Checksum Mismatches

- None

## Baseline Decision Handoff

- Status: BLOCKED_UNRECOVERABLE_MIGRATION_REQUIRED
- Approval ready: false
- DB writes allowed by this proposal: false
- Decision: continue-external-search
- Missing required fields: 1
- Recommended next step: external-artifact-or-baseline-approval - continue external exact SQL recovery or obtain explicit non-production baseline approval
- Guardrail omitted write commands: prisma migrate resolve, prisma migrate deploy, prisma db push, SQL restore, migration-directory writes
- Operator input external-exact-sql-or-baseline-decision
  - required: false
  - provided: false
  - expected: exact SQL artifact match, restore-exact-sql decision, or baseline-resolve-local-only decision
  - actual: continue-external-search
- Operator input unrecoverable-migration-external-artifact-or-baseline-decision
  - required: true
  - provided: false
  - expected: exact SQL artifact for unrecoverable migration, restore-exact-sql decision, or baseline-resolve-local-only decision
  - actual: continue-external-search
- Operator input target-scope
  - required: false
  - provided: false
  - expected: local-existing|local-disposable|staging-clone
  - actual: none
- Operator input approved-operator-workflow
  - required: false
  - provided: false
  - expected: approved workflow id
  - actual: none
- Operator input operator-ack
  - required: false
  - provided: false
  - expected: APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE
  - actual: none
- Operator input rationale
  - required: false
  - provided: false
  - expected: operator rationale
  - actual: none
- Operator input backup-evidence
  - required: false
  - provided: false
  - expected: backup, disposable DB, or staging clone evidence
  - actual: none

## Required Human Inputs

- --decision baseline-resolve-local-only
- --target-scope <local-existing|local-disposable|staging-clone>
- --approved-operator-workflow <approved workflow id>
- --operator-ack APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE
- --rationale <why exact SQL cannot be recovered and why this target may be resolved>
- --backup-evidence <backup, disposable DB, or staging clone evidence>

## Recommended Sequence

- Request the exact applied SQL from deployment artifacts, backups, or teammate clones.
- If exact SQL remains unrecoverable, obtain an explicit non-production baseline/resolve approval using the required acknowledgement and backup evidence.
- Only after an external restore or approved resolve decision, rerun the DB compatibility chain and platform closure audit.
