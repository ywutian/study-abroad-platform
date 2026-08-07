#!/usr/bin/env tsx
/**
 * seed-match-pools.ts
 *
 * The production-safe slice of `prisma/seed-teams.ts`: the 9 public MatchPools
 * and their ~62 OFFICIAL_COMPETITION entries, and nothing else.
 *
 * seed-teams.ts as a whole is NOT prod-safe — it also mints mock users, teams
 * and recruitment cards, and calls `teamMembership.deleteMany`. `seedMatchPools`
 * is the one part that touches only MatchPool / MatchPoolEntry, so it gets its
 * own entry point rather than a `--pools-only` flag on the demo seed: the
 * safety boundary should be a separate file, not an argument someone forgets.
 *
 * Why this exists: production had the pool shell with zero entries —
 * `GET /teams/match-pools/:id` returned `entries: []`, i.e. a browsable pool
 * with nothing in it. The pools were only ever created by the dev seed, which
 * migrate.sh deliberately does not run.
 *
 * Idempotent: pools are matched by name and updated in place; a pool's entries
 * are replaced wholesale on each run.
 *
 * MUST run after seed-competitions — entries resolve competitions by
 * abbreviation / name / nameZh and `resolveCompetition` throws on a miss.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx prisma/seed-match-pools.ts
 */
import { PrismaClient } from '@prisma/client';
import { buildCompetitionLookup, seedMatchPools } from './seed-teams';

const prisma = new PrismaClient();

async function main() {
  const competitions = await prisma.competition.findMany({
    where: { isActive: true },
  });

  // Loud rather than fail-soft: with an empty lookup every blueprint alias
  // misses and we would recreate exactly the bug this seed exists to fix —
  // 9 pools, 0 entries.
  if (competitions.length === 0) {
    throw new Error(
      'no active Competition rows — run prisma/seed-competitions.js first',
    );
  }

  const poolCount = await seedMatchPools(
    prisma,
    buildCompetitionLookup(competitions),
  );
  const entryCount = await prisma.matchPoolEntry.count();
  console.log(
    `✅ Match pools synced: ${poolCount} pools, ${entryCount} entries`,
  );
}

main()
  .catch((error) => {
    console.error('❌', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
