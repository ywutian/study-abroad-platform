#!/usr/bin/env tsx

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  CATALOG_RANKING_LISTS,
  getInstitutionTypeForRankingList,
  getPrivateDefaultForRankingList,
  getRankingListSourceUrl,
  isCatalogRankingList,
  resolveFallbackRankingList,
  type CatalogRankingList,
} from '../src/modules/school/school-ranking-catalog';

const prisma = new PrismaClient();

const CATALOG_RANKING_LIST_SET = new Set<string>(CATALOG_RANKING_LISTS);
const RANKING_SOURCE = 'US_NEWS';
const RANKING_YEAR = 2025;

function hasArg(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = hasArg('--dry-run');
  const limitArg = process.argv
    .find((arg) => arg.startsWith('--limit='))
    ?.split('=')[1];
  const limit = limitArg ? Number(limitArg) : undefined;

  console.log('School ranking list backfill');
  console.log(`Mode: ${dryRun ? 'dry run' : 'live'}`);

  const schools = await prisma.school.findMany({
    where: { country: 'US', usNewsRank: { not: null } },
    select: {
      id: true,
      name: true,
      usNewsRank: true,
      institutionType: true,
      rankings: {
        where: { source: RANKING_SOURCE, year: RANKING_YEAR },
        select: { list: true },
      },
    },
    orderBy: [{ usNewsRank: 'asc' }, { name: 'asc' }],
    take: limit,
  });

  let updated = 0;
  let pruned = 0;
  const byList = new Map<CatalogRankingList, number>();

  for (const school of schools) {
    const list = resolveFallbackRankingList(school);
    const institutionType = getInstitutionTypeForRankingList(list);
    const isPrivate = getPrivateDefaultForRankingList(list);
    const schoolPatch =
      isPrivate === null ? { institutionType } : { institutionType, isPrivate };
    const conflictingLists = school.rankings
      .map((ranking) => ranking.list)
      .filter(
        (existingList) =>
          existingList !== list && isCatalogRankingList(existingList),
      );

    byList.set(list, (byList.get(list) ?? 0) + 1);

    if (dryRun) {
      if (conflictingLists.length > 0) pruned += conflictingLists.length;
      updated++;
      console.log(
        `[dry] ${school.name}: ${RANKING_SOURCE}/${list} #${school.usNewsRank} (${institutionType})`,
      );
      continue;
    }

    await prisma.$transaction([
      prisma.schoolRanking.deleteMany({
        where: {
          schoolId: school.id,
          source: RANKING_SOURCE,
          year: RANKING_YEAR,
          list: { in: Array.from(CATALOG_RANKING_LIST_SET), not: list },
        },
      }),
      prisma.schoolRanking.upsert({
        where: {
          schoolId_source_list_year: {
            schoolId: school.id,
            source: RANKING_SOURCE,
            list,
            year: RANKING_YEAR,
          },
        },
        update: {
          rank: school.usNewsRank!,
          sourceUrl: getRankingListSourceUrl(list),
        },
        create: {
          schoolId: school.id,
          source: RANKING_SOURCE,
          list,
          rank: school.usNewsRank!,
          year: RANKING_YEAR,
          sourceUrl: getRankingListSourceUrl(list),
        },
      }),
      prisma.school.update({
        where: { id: school.id },
        data: schoolPatch,
      }),
    ]);

    pruned += conflictingLists.length;
    updated++;
  }

  console.log(`Processed: ${updated}`);
  console.log(`Conflicting catalog rows pruned: ${pruned}`);
  console.log('By list:');
  for (const list of CATALOG_RANKING_LISTS) {
    console.log(`  ${list}: ${byList.get(list) ?? 0}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
