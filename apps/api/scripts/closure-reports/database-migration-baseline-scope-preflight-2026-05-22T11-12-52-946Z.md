# Database Migration Baseline Scope Preflight

Status: BLOCKED_BACKUP_EVIDENCE_REQUIRED

This is read-only. It does not approve a baseline, restore migration files, dump data, or run Prisma resolve/deploy.

## Summary

- Schema worklist: BLOCKED
- Baseline proposal: BASELINE_PROPOSAL_READY_REVIEW_REQUIRED
- Inferred target scope: local-existing (DATABASE_URL host is local)
- Effective target scope: local-existing
- DB readable: true
- Data bearing: true
- Public tables / estimated rows: 150/13
- Backup evidence provided: false
- Production signal count: 0
- Missing required inputs: 1

## Missing Required Inputs

- backup-or-disposable-target-evidence: expected backup path, disposable DB note, or staging clone evidence; actual missing

## Recommended Sequence

- Attach backup evidence, disposable DB evidence, or staging clone evidence.
- Then rerun this preflight and the baseline-resolution gate with explicit operator approval inputs.
