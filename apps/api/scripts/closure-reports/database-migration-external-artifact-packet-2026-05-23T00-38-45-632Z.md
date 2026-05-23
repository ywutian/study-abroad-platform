# Database Migration External Artifact Packet

Status: BLOCKED_EXTERNAL_ARTIFACT_REQUIRED
Generated at: 2026-05-23T00:38:45.913Z

## Summary

- unresolvedMismatchRows: 0
- unrecoverableMigrationRows: 1
- unresolvedUnrecoverableRows: 1
- externalRequestRows: 1
- preexistingExactArtifactMatches: 0
- exactArtifactMatches: 0
- filesScanned: 1333
- filesSkippedLarge: 0
- filesSkippedUnreadable: 0
- archivesScanned: 0
- archivesSkippedLarge: 0
- archivesSkippedUnreadable: 0
- archiveEntriesScanned: 0

## Recommended Sequence

1. Send the external request packet to deployment artifact owners, backup owners, or teammates with older clones.
2. Place any candidate artifact in a local intake directory and rerun this script with --candidate-root <dir> before considering baseline fallback.
3. If exact SQL cannot be recovered, use audit:database-migration-baseline-resolution to create a non-production review packet.
4. Do not run prisma migrate resolve, migrate deploy, or db push against valuable data from this packet.

## Candidate Intake

- status: waiting_for_external_candidate_artifact
- suggested candidate root: apps/api/scripts/closure-reports/database-migration-external-candidate-intake
- accepted file names: migration.sql, <migration-name>/migration.sql
- accepted archive names: <artifact>.zip containing migration.sql, <artifact>.tar or <artifact>.tar.gz containing migration.sql, <artifact>.tgz containing migration.sql, <artifact>.sql.gz containing the exact SQL bytes
- verification command: pnpm --filter api audit:database-migration-external-artifact-packet -- --candidate-root apps/api/scripts/closure-reports/database-migration-external-candidate-intake --scan-archives
- guardrail: This intake is only for checksum verification; do not copy candidates into apps/api/prisma/migrations or run Prisma write commands from this packet.
- searched roots: apps/api/prisma/migrations, apps/api/scripts/closure-reports, apps/api/scripts/closure-reports/database-migration-external-candidate-intake
- verification checklist:
  - Place external candidates only under the suggested candidate root.
  - Keep original artifact packaging where possible; archive candidates are read-only scanned with --scan-archives.
  - Pass only if the packet reports exactArtifactMatches > 0 with the required SHA-256.
  - Do not restore, copy, resolve, deploy, or baseline from an unverified candidate.

### Candidate Intake Targets

- 20260428120000_add_mbti_and_personality_tags
  - subject: Recover exact migration SQL for 20260428120000_add_mbti_and_personality_tags
  - source kind: unrecoverable_migration
  - target path: apps/api/prisma/migrations/20260428120000_add_mbti_and_personality_tags/migration.sql
  - required SHA-256: cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66

## Requests

### 20260428120000_add_mbti_and_personality_tags

Source kind: unrecoverable_migration
Next action: request-external-exact-sql-artifact-or-approved-baseline-decision
DB checksum: cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66
Known mismatch SHA-256: null
Files scanned locally: 1333
Archives scanned locally: 0
Archive entries scanned locally: 0
Exact local matches: 0

Request:

Please locate the exact applied SQL for apps/api/prisma/migrations/20260428120000_add_mbti_and_personality_tags/migration.sql with SHA-256 cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66. No local git-recovered candidate exists for this DB-applied migration.

Acceptable evidence:

- A migration.sql file whose SHA-256 exactly equals cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66.
- A deployment artifact, CI artifact, backup, release bundle, or teammate clone that contains that exact file.
- A documented decision that exact SQL cannot be recovered plus an approved non-production baseline/resolve packet.

Rejected evidence:

- A reconstructed file with the right migration name but no exact checksum match.
- A manually edited migration file without checksum evidence.
- A production baseline/resolve decision; this packet does not approve production schema writes.

