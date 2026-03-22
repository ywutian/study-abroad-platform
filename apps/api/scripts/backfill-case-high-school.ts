/**
 * Backfill script: Populate AdmissionCase.highSchoolId from user profile Education records.
 *
 * For each AdmissionCase with highSchoolId = null, looks up the case owner's Profile
 * Education records where schoolType = 'HIGH_SCHOOL' and highSchoolId is set,
 * then copies that highSchoolId to the case.
 *
 * Usage:
 *   npx tsx scripts/backfill-case-high-school.ts             # Dry-run (preview)
 *   npx tsx scripts/backfill-case-high-school.ts --apply      # Apply changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function backfill(dryRun: boolean) {
  const stats = {
    total: 0,
    matched: 0,
    noMatch: 0,
  };

  // Count cases with no highSchoolId
  const totalCount = await prisma.admissionCase.count({
    where: { highSchoolId: null },
  });
  stats.total = totalCount;
  console.log(`Found ${totalCount} AdmissionCases with highSchoolId = null`);

  if (totalCount === 0) {
    console.log('Nothing to backfill.');
    return stats;
  }

  let cursor: string | undefined;

  while (true) {
    const cases = await prisma.admissionCase.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: { highSchoolId: null },
      orderBy: { id: 'asc' },
      select: { id: true, userId: true },
    });

    if (cases.length === 0) break;
    cursor = cases[cases.length - 1].id;

    for (const c of cases) {
      // Find user's HIGH_SCHOOL education record with a highSchoolId
      const education = await prisma.education.findFirst({
        where: {
          profile: { userId: c.userId },
          schoolType: 'HIGH_SCHOOL',
          highSchoolId: { not: null },
        },
        select: { highSchoolId: true },
      });

      if (education?.highSchoolId) {
        if (!dryRun) {
          await prisma.admissionCase.update({
            where: { id: c.id },
            data: { highSchoolId: education.highSchoolId },
          });
        }
        stats.matched++;
      } else {
        stats.noMatch++;
      }
    }

    console.log(
      `Processed ${stats.matched + stats.noMatch}/${totalCount} (matched: ${stats.matched}, no match: ${stats.noMatch})`,
    );
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  if (dryRun) {
    console.log('=== DRY RUN MODE (use --apply to write changes) ===\n');
  } else {
    console.log('=== APPLY MODE — writing changes to database ===\n');
  }

  try {
    const stats = await backfill(dryRun);

    console.log('\n=== Backfill Summary ===');
    console.log(`Total cases (highSchoolId = null): ${stats.total}`);
    console.log(`Cases with match:                  ${stats.matched}`);
    console.log(`Cases without match:               ${stats.noMatch}`);

    if (dryRun) {
      console.log(
        '\n(Dry run — no changes written. Run with --apply to commit.)',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
