/**
 * Migrate intlAcceptanceRate from metadata JSON → dedicated column,
 * and seed intlStudentPct for top schools from known CDS data.
 *
 * Run standalone:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-intl-rates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Known intlStudentPct from Common Data Set reports (approximate) */
export const INTL_STUDENT_PCT: Record<string, number> = {
  'massachusetts institute of technology': 11.0,
  'stanford university': 12.0,
  'harvard university': 12.0,
  'princeton university': 12.0,
  'yale university': 11.5,
  'california institute of technology': 9.0,
  'columbia university': 18.0,
  'university of chicago': 15.0,
  'university of pennsylvania': 13.0,
  'duke university': 10.0,
  'northwestern university': 10.0,
  'johns hopkins university': 11.0,
  'brown university': 12.0,
  'cornell university': 11.0,
  'rice university': 12.0,
  'dartmouth college': 9.0,
  'vanderbilt university': 8.0,
  'university of notre dame': 6.0,
  'carnegie mellon university': 22.0,
  'new york university': 27.0,
  'university of southern california': 24.0,
  'boston university': 25.0,
  'university of illinois urbana-champaign': 23.0,
  'purdue university': 20.0,
  'georgia institute of technology': 12.0,
  'university of michigan, ann arbor': 7.0,
  'university of california, berkeley': 14.0,
  'university of california, los angeles': 13.0,
  'university of california, san diego': 22.0,
  'university of washington': 16.0,
};

export async function seedIntlRates(
  prismaClient: PrismaClient = prisma,
): Promise<{
  migratedFromMetadata: number;
  seededIntlPct: number;
  backfilledFromMetric: number;
}> {
  let migratedFromMetadata = 0;
  let seededIntlPct = 0;
  let backfilledFromMetric = 0;

  // Step 1: Migrate metadata.intlAcceptanceRate → School.intlAcceptanceRate
  const schools = await prismaClient.school.findMany({
    where: { metadata: { not: undefined } },
    select: {
      id: true,
      nameNorm: true,
      metadata: true,
      intlAcceptanceRate: true,
    },
  });

  for (const school of schools) {
    const meta = school.metadata as Record<string, unknown> | null;
    if (!meta) continue;

    const intlRate = meta.intlAcceptanceRate;
    if (intlRate != null && school.intlAcceptanceRate == null) {
      await prismaClient.school.update({
        where: { id: school.id },
        data: { intlAcceptanceRate: Number(intlRate) },
      });
      migratedFromMetadata++;
    }
  }

  // Step 2: Seed intlStudentPct from known CDS data
  for (const [nameNorm, pct] of Object.entries(INTL_STUDENT_PCT)) {
    const result = await prismaClient.school.updateMany({
      where: {
        nameNorm,
        intlStudentPct: null,
      },
      data: { intlStudentPct: pct },
    });
    seededIntlPct += result.count;
  }

  // Step 3: Backfill from SchoolMetric (intl_student_pct) where School.intlStudentPct is null
  const metrics = await prismaClient.schoolMetric.findMany({
    where: { metricKey: 'intl_student_pct' },
    orderBy: { year: 'desc' },
    distinct: ['schoolId'],
    select: { schoolId: true, value: true },
  });

  for (const m of metrics) {
    const result = await prismaClient.school.updateMany({
      where: { id: m.schoolId, intlStudentPct: null },
      data: { intlStudentPct: Number(m.value) },
    });
    backfilledFromMetric += result.count;
  }

  return { migratedFromMetadata, seededIntlPct, backfilledFromMetric };
}

// Run standalone
if (require.main === module) {
  seedIntlRates()
    .then((r) => {
      console.log('seed-intl-rates complete:', r);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
