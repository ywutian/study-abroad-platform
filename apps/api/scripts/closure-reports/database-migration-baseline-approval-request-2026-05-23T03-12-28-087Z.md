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

## External Exact SQL Candidate Intake

- Status: waiting_for_external_candidate_artifact
- Suggested candidate root: apps/api/scripts/closure-reports/database-migration-external-candidate-intake
- Machine-readable target manifest: apps/api/scripts/closure-reports/database-migration-external-candidate-intake/TARGETS.json
- Target manifest digest sidecar: apps/api/scripts/closure-reports/database-migration-external-candidate-intake/TARGETS.sha256
- Target manifest SHA-256: 5f1b682aaece9b7c12ce8b0463c017a6ebb525911fa245923261d6640a3ba5a5
- Target manifest size bytes: 2523
- Manifest source report: apps/api/scripts/closure-reports/database-migration-external-artifact-packet-2026-05-23T03-12-19-663Z.json
- Manifest source Markdown: apps/api/scripts/closure-reports/database-migration-external-artifact-packet-2026-05-23T03-12-19-663Z.md
- Accepted archive names: <artifact>.zip containing migration.sql, <artifact>.tar or <artifact>.tar.gz containing migration.sql, <artifact>.tgz containing migration.sql, <artifact>.sql.gz containing the exact SQL bytes
- Verification command: pnpm --filter api audit:database-migration-external-artifact-packet -- --candidate-root apps/api/scripts/closure-reports/database-migration-external-candidate-intake --scan-archives
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

