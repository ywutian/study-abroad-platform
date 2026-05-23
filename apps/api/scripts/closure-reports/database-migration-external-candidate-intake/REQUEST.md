# Database Migration Exact SQL Recovery Request

Status: waiting_for_external_candidate_artifact
Generated at: 2026-05-23T05:14:02.064Z
Candidate root: apps/api/scripts/closure-reports/database-migration-external-candidate-intake
Target manifest: apps/api/scripts/closure-reports/database-migration-external-candidate-intake/TARGETS.json
Target manifest digest sidecar: apps/api/scripts/closure-reports/database-migration-external-candidate-intake/TARGETS.sha256
Target manifest SHA-256: 82eee3b9a752d50ff6a87b721f8149040716b95540cd99640258b0c6c7c67d4d
Target manifest size bytes: 2523

## Request

### Recover exact migration SQL for 20260428120000_add_mbti_and_personality_tags

Please locate the exact applied SQL for apps/api/prisma/migrations/20260428120000_add_mbti_and_personality_tags/migration.sql with SHA-256 cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66. No local git-recovered candidate exists for this DB-applied migration.

- migration: 20260428120000_add_mbti_and_personality_tags
- source kind: unrecoverable_migration
- target path: apps/api/prisma/migrations/20260428120000_add_mbti_and_personality_tags/migration.sql
- required SHA-256: cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66
- known mismatch SHA-256: none
- next action: request-external-exact-sql-artifact-or-approved-baseline-decision

Acceptable evidence:
- A migration.sql file whose SHA-256 exactly equals cedbe8993cf570c0011ffcc3a5769445fe55c69285939873710d73bffeaffa66.
- A deployment artifact, CI artifact, backup, release bundle, or teammate clone that contains that exact file.
- A documented decision that exact SQL cannot be recovered plus an approved non-production baseline/resolve packet.

Rejected evidence:
- A reconstructed file with the right migration name but no exact checksum match.
- A manually edited migration file without checksum evidence.
- A production baseline/resolve decision; this packet does not approve production schema writes.

## Candidate Shapes

- migration.sql
- <migration-name>/migration.sql
- <artifact>.zip containing migration.sql
- <artifact>.tar or <artifact>.tar.gz containing migration.sql
- <artifact>.tgz containing migration.sql
- <artifact>.sql.gz containing the exact SQL bytes

## Verification

```bash
pnpm --filter api audit:database-migration-external-artifact-packet -- --candidate-root apps/api/scripts/closure-reports/database-migration-external-candidate-intake --scan-archives
```

This intake is only for checksum verification; do not copy candidates into apps/api/prisma/migrations or run Prisma write commands from this packet.

Verification checklist:
- Place external candidates only under the suggested candidate root.
- Keep original artifact packaging where possible; archive candidates are read-only scanned with --scan-archives.
- Pass only if the packet reports exactArtifactMatches > 0 with the required SHA-256.
- Do not restore, copy, resolve, deploy, or baseline from an unverified candidate.

Prohibited before exact match:
- copy into apps/api/prisma/migrations
- prisma migrate resolve
- prisma migrate deploy
- prisma db push
- SQL restore
- baseline fallback approval
