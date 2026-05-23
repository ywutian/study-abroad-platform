# Database Migration Unrecoverable Artifact Search

Status: UNRECOVERABLE_ARTIFACT_SEARCH_READY_NO_MATCH
Generated at: 2026-05-22T13:41:30.403Z

## Summary

- unrecoverableRows: 1
- exactArtifactMatches: 0
- filesScanned: 0
- filesSkippedLarge: 0
- filesSkippedUnreadable: 0
- archivesScanned: 32
- archivesSkippedLarge: 8
- archivesSkippedUnreadable: 0
- archiveEntriesScanned: 3

## Recommended Sequence

1. Send the migration name and DB checksum to deployment artifact owners, backup owners, or teammates with older clones.
2. Place any candidate artifact in a local directory and rerun this script with --candidate-root <dir>.
3. If exact SQL cannot be recovered, use the existing baseline-resolution flow to create an approved non-production review packet.
4. Do not run prisma migrate resolve, migrate deploy, db push, SQL restore, or migration-directory writes from this packet.

## Rows

### 20260428120000_add_mbti_and_personality_tags

DB checksum: cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66
Next action: request-external-artifact-or-nonproduction-baseline-review
Files scanned: 0
Archives scanned: 32
Archive entries scanned: 3
Exact matches: 0

