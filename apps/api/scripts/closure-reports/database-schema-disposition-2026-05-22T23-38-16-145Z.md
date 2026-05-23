# Database Schema Disposition Packet

Status: DATABASE_SCHEMA_DISPOSITION_READY
Generated at: 2026-05-22T23:38:16.151Z

## Summary

- Total rows: 37
- Block-release rows: 2
- Review rows: 34
- Conflict rows: 1
- Recoverable migration rows: 4
- Unrecoverable migration rows: 1

## Contract

- This packet is read-only and performs no DB or migration writes.
- Block-release rows remain blockers until an approved operator workflow acts.
- Checksum-matched restore candidates are evidence only.

## Dispositions

| Disposition | Rows |
| --- | ---: |
| block_release_apply_repo_migration_after_operator_approval | 2 |
| review_unrecoverable_migration_history_external_or_baseline_required | 1 |
| review_restore_checksum_matched_migration_candidate | 4 |
| review_extra_db_object_schema_drift | 30 |
