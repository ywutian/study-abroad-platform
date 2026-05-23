# Database Migration Baseline Approval Request Packet

Status: BLOCKED_BACKUP_EVIDENCE_NOT_READY

This is a read-only approval request packet. It does not approve a baseline decision, run Prisma resolve/deploy, restore SQL, or write to the database.

## Summary

- Baseline proposal: BASELINE_PROPOSAL_READY_REVIEW_REQUIRED
- Baseline resolution: BLOCKED_UNRECOVERABLE_MIGRATION_REQUIRED
- Backup evidence packet: BLOCKED_BACKUP_EVIDENCE_REQUIRED
- Target scope: local-existing
- Exact SQL artifact matches: 0
- Open migration blockers: 7
- Unrecoverable rows: 1
- Unresolved checksum mismatches: 0
- Backup evidence ready: false
- Missing approval inputs: 2

## Missing Approval Inputs

- external exact SQL artifact for unrecoverable migration history, or explicit baseline/resolve decision
- unrecoverable-migration-external-artifact-or-baseline-decision

## Approval Checklist

- exact-sql-exhausted: ready
- target-scope-cleared: ready
- backup-evidence-ready: blocked
- baseline-resolution-approval: operator-input-required

## Operator Handoff

- Required acknowledgement: APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE
- Audit-only command: pnpm --filter api audit:database-migration-baseline-resolution -- --checksum-review /tmp/database-migration-checksum-review-latest.json --external-artifact-packet /tmp/database-migration-external-artifact-packet-archive-latest.json --decision baseline-resolve-local-only --target-scope local-existing --approved-operator-workflow <approved workflow id> --operator-ack APPROVED_DATABASE_MIGRATION_BASELINE_RESOLVE --rationale "Exact SQL remains unrecovered after checksum review, variant analysis, local search, and archive-aware external artifact scan; target is local/staging scoped and backup evidence is attached for review." --backup-evidence "<backup evidence argument>"

