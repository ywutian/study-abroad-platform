/**
 * One-time DB audit: find and fix acceptanceRate / graduationRate values > 100.
 * These are likely double-conversions (e.g. 2470 should be 24.7).
 *
 * Usage: npx ts-node apps/api/scripts/audit-fix-rates.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE FIX'}\n`);

  const schools = await prisma.school.findMany({
    where: {
      OR: [{ acceptanceRate: { gt: 100 } }, { graduationRate: { gt: 100 } }],
    },
    select: {
      id: true,
      name: true,
      acceptanceRate: true,
      graduationRate: true,
    },
  });

  console.log(`Found ${schools.length} schools with rate > 100:\n`);

  for (const school of schools) {
    const ar = school.acceptanceRate ? Number(school.acceptanceRate) : null;
    const gr = school.graduationRate ? Number(school.graduationRate) : null;

    const fixedAr = ar && ar > 100 && ar <= 10000 ? Math.round(ar) / 100 : ar;
    const fixedGr = gr && gr > 100 && gr <= 10000 ? Math.round(gr) / 100 : gr;

    console.log(
      `  ${school.name}: acceptanceRate ${ar} -> ${fixedAr}, graduationRate ${gr} -> ${fixedGr}`,
    );

    if (!isDryRun) {
      await prisma.school.update({
        where: { id: school.id },
        data: {
          ...(fixedAr !== ar ? { acceptanceRate: fixedAr } : {}),
          ...(fixedGr !== gr ? { graduationRate: fixedGr } : {}),
        },
      });
    }
  }

  console.log(
    `\nDone. ${isDryRun ? 'No changes made (dry run).' : `Fixed ${schools.length} schools.`}`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
