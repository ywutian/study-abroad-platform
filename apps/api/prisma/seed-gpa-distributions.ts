/**
 * Seed `School.gpaDistribution` (JSON) from the 2026-05 research pass.
 *
 * `gpaDistribution` is a JSON record matching the buckets the counselor
 * engine consumes in `counselor-modifiers.gpaBandMultiplier`:
 *
 *   {
 *     "3.75-4.00": percent,
 *     "3.50-3.74": percent,
 *     "3.25-3.49": percent,
 *     "3.00-3.24": percent,
 *     "<3.00": percent
 *   }
 *
 * The aggregator (nextgenadmit) typically reports only the top 2-3
 * buckets at high-selectivity schools. Seed rows may store compressed lower
 * buckets as "<3.25" or leave lower buckets unknown; before writing, we expand
 * every row into the five canonical buckets so the launch data-quality gate and
 * counselor engine consume the same complete shape.
 *
 * Sources are nextgenadmit (CDS Section C9 aggregator) and each school's
 * CDS PDF where directly available. Confidence is MEDIUM unless the
 * school's own CDS PDF was the direct source.
 *
 * Run standalone:
 *   npx tsx apps/api/prisma/seed-gpa-distributions.ts
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GpaSeed {
  nameNorm: string;
  /** Compressed CDS C9 buckets. Percentages should approximately sum to 100. */
  distribution: {
    '3.75-4.00': number;
    '3.50-3.74': number | null;
    '3.25-3.49': number | null;
    '<3.25': number | null;
  };
  dataYear: string;
  source: string;
  notes?: string;
}

type CanonicalGpaDistribution = {
  '<3.00': number;
  '3.00-3.24': number;
  '3.25-3.49': number;
  '3.50-3.74': number;
  '3.75-4.00': number;
};

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function toCanonicalDistribution(
  distribution: GpaSeed['distribution'],
): CanonicalGpaDistribution {
  const top = distribution['3.75-4.00'];
  let high = distribution['3.50-3.74'] ?? 0;
  let mid = distribution['3.25-3.49'] ?? 0;
  let low = distribution['<3.25'] ?? 0;
  const below = 0;

  if (distribution['<3.25'] == null) {
    const known =
      top + (distribution['3.50-3.74'] ?? 0) + (distribution['3.25-3.49'] ?? 0);
    const residual = Math.max(0, roundPercent(100 - known));

    // When source data only publishes upper buckets, assign the residual to
    // the nearest lower canonical band instead of dropping it. This keeps the
    // distribution complete while preserving the source's "lower buckets
    // compressed / unpublished" meaning.
    if (distribution['3.50-3.74'] == null) {
      high = residual;
    } else if (distribution['3.25-3.49'] == null) {
      mid = residual;
    } else {
      low = residual;
    }
  }

  const total = top + high + mid + low + below;
  const drift = roundPercent(100 - total);
  if (drift >= 0) {
    low = roundPercent(low + drift);
  } else {
    let remaining = roundPercent(-drift);
    const lowAdjustment = Math.min(low, remaining);
    low = roundPercent(low - lowAdjustment);
    remaining = roundPercent(remaining - lowAdjustment);

    const midAdjustment = Math.min(mid, remaining);
    mid = roundPercent(mid - midAdjustment);
    remaining = roundPercent(remaining - midAdjustment);

    const highAdjustment = Math.min(high, remaining);
    high = roundPercent(high - highAdjustment);
  }

  return {
    '<3.00': below,
    '3.00-3.24': roundPercent(low),
    '3.25-3.49': roundPercent(mid),
    '3.50-3.74': roundPercent(high),
    '3.75-4.00': roundPercent(top),
  };
}

export const GPA_DISTRIBUTION_SEEDS: ReadonlyArray<GpaSeed> = [
  {
    nameNorm: 'princeton university',
    distribution: {
      '3.75-4.00': 96.0,
      '3.50-3.74': 3.0,
      '3.25-3.49': 1.0,
      '<3.25': 0.0,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/princeton-admission-statistics/',
  },
  {
    nameNorm: 'university of pennsylvania',
    distribution: {
      '3.75-4.00': 90.0,
      '3.50-3.74': 7.0,
      '3.25-3.49': 2.0,
      '<3.25': 1.0,
    },
    dataYear: 'Class of 2029',
    source:
      'https://nextgenadmit.com/university-of-pennsylvania-admission-statistics/',
  },
  {
    nameNorm: 'duke university',
    distribution: {
      '3.75-4.00': 64.5,
      '3.50-3.74': 18.5,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/duke-admission-statistics/',
    notes: '64.5% combined 4.0+3.75-3.99; finer breakdown not published',
  },
  {
    nameNorm: 'university of chicago',
    distribution: {
      '3.75-4.00': 88.5,
      '3.50-3.74': 6.85,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2028',
    source:
      'https://nextgenadmit.com/university-of-chicago-admission-statistics/',
  },
  {
    nameNorm: 'johns hopkins university',
    distribution: {
      '3.75-4.00': 91.45,
      '3.50-3.74': 5.53,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/johns-hopkins-admission-statistics/',
  },
  {
    nameNorm: 'vanderbilt university',
    distribution: {
      '3.75-4.00': 89.0,
      '3.50-3.74': 7.2,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/vanderbilt-admission-statistics/',
  },
  {
    nameNorm: 'washington university in st. louis',
    distribution: {
      '3.75-4.00': 89.0,
      '3.50-3.74': 7.0,
      '3.25-3.49': 4.0,
      '<3.25': 0.0,
    },
    dataYear: 'Class of 2029',
    source:
      'https://nextgenadmit.com/washington-university-in-st-louis-admission-statistics/',
  },
  {
    nameNorm: 'university of southern california',
    distribution: {
      '3.75-4.00': 78.1,
      '3.50-3.74': 15.3,
      '3.25-3.49': 4.0,
      '<3.25': 2.6,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/usc-admission-statistics/',
  },
  {
    nameNorm: 'new york university',
    distribution: {
      '3.75-4.00': 71.9,
      '3.50-3.74': 21.4,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source:
      'https://nextgenadmit.com/new-york-university-admission-statistics/',
  },
  {
    nameNorm: 'carnegie mellon university',
    distribution: {
      '3.75-4.00': 85.6,
      '3.50-3.74': 10.9,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/carnegie-mellon-admission-statistics/',
  },
  {
    nameNorm: 'emory university',
    distribution: {
      '3.75-4.00': 77.0,
      '3.50-3.74': 21.0,
      '3.25-3.49': 2.0,
      '<3.25': 0.0,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/emory-admission-statistics/',
  },
  {
    nameNorm: 'university of michigan, ann arbor',
    distribution: {
      '3.75-4.00': 93.9,
      '3.50-3.74': null,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source:
      'https://nextgenadmit.com/university-of-michigan-admission-statistics/',
    notes: 'Likely weighted GPA (UMich convention)',
  },
  {
    nameNorm: 'boston university',
    distribution: {
      '3.75-4.00': 72.0,
      '3.50-3.74': 27.0,
      '3.25-3.49': 1.0,
      '<3.25': 0.0,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/boston-university-admission-statistics/',
  },
  {
    nameNorm: 'northeastern university',
    distribution: {
      '3.75-4.00': 94.42,
      '3.50-3.74': 3.95,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/northeastern-admission-statistics/',
  },
  {
    nameNorm: 'university of california, berkeley',
    distribution: {
      '3.75-4.00': 89.9,
      '3.50-3.74': 8.1,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/uc-berkeley-admission-statistics/',
    notes: 'Likely weighted (UC convention)',
  },
  {
    nameNorm: 'university of california, san diego',
    distribution: {
      '3.75-4.00': 85.0,
      '3.50-3.74': 13.0,
      '3.25-3.49': 2.0,
      '<3.25': 0.0,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/uc-san-diego-admission-statistics/',
    notes: 'Likely weighted (UC convention)',
  },
  {
    nameNorm: 'university of california, davis',
    distribution: {
      '3.75-4.00': 89.22,
      '3.50-3.74': 8.4,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/uc-davis-admission-statistics/',
    notes: 'Likely weighted (UC convention)',
  },
  {
    nameNorm: 'university of california, santa barbara',
    distribution: {
      '3.75-4.00': 96.83,
      '3.50-3.74': 2.58,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/uc-santa-barbara-admission-statistics/',
    notes: 'Likely weighted (UC convention)',
  },
  {
    nameNorm: 'university of north carolina at chapel hill',
    distribution: {
      '3.75-4.00': 99.5,
      '3.50-3.74': null,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2028',
    source: 'https://nextgenadmit.com/unc-chapel-hill-admission-statistics/',
  },
  {
    nameNorm: 'purdue university',
    distribution: {
      '3.75-4.00': 71.0,
      '3.50-3.74': null,
      '3.25-3.49': null,
      '<3.25': null,
    },
    dataYear: 'Class of 2029',
    source: 'https://nextgenadmit.com/purdue-university-admission-statistics/',
  },
];

export async function seedGpaDistributions(
  prismaClient: PrismaClient = prisma,
): Promise<{ updated: number; notFound: string[] }> {
  let updated = 0;
  const notFound: string[] = [];

  for (const row of GPA_DISTRIBUTION_SEEDS) {
    const result = await prismaClient.school.updateMany({
      where: { nameNorm: row.nameNorm },
      data: {
        gpaDistribution: toCanonicalDistribution(
          row.distribution,
        ) as unknown as Prisma.InputJsonValue,
      },
    });
    if (result.count === 0) {
      notFound.push(row.nameNorm);
    } else {
      updated += result.count;
    }
  }

  return { updated, notFound };
}

async function main() {
  console.log('📊 Seeding gpaDistribution from research data...\n');
  const { updated, notFound } = await seedGpaDistributions();
  console.log(`✅ Updated ${updated} school(s)`);
  if (notFound.length > 0) {
    console.warn(`⚠ ${notFound.length} school(s) not in DB:`, notFound);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
