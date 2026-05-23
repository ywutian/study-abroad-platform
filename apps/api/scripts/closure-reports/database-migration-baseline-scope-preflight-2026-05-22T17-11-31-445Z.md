# Database Migration Baseline Scope Preflight

Status: BLOCKED_DATABASE_UNAVAILABLE

This is read-only. It does not approve a baseline, restore migration files, dump data, or run Prisma resolve/deploy.

## Summary

- Schema worklist: BLOCKED
- Baseline proposal: BASELINE_PROPOSAL_READY_REVIEW_REQUIRED
- Inferred target scope: local-existing (DATABASE_URL host is local)
- Effective target scope: local-existing
- DB readable: false
- Data bearing: false
- Public tables / estimated rows: 0/0
- Backup evidence provided: false
- Production signal count: 0
- Missing required inputs: 2

## Missing Required Inputs

- readable-database-fingerprint: expected read-only pg_catalog fingerprint; actual unavailable
- backup-or-disposable-target-evidence: expected backup path, disposable DB note, or staging clone evidence; actual missing

## Recommended Sequence

- Make the target database reachable before a baseline scope can be evaluated.
- Rerun this preflight before any baseline-resolution approval attempt.
