/**
 * Seed `GlobalAdmitBaseline` table with applicant-pool priors.
 *
 * These P(category | apply) baselines are used as denominators in the
 * M3 v2 Bayesian sequential update engine (see PREDICTION_V2_DESIGN.md §4).
 *
 * Example: a Bayesian update for legacy at Princeton uses
 *   LR = P(legacy | admit) / P(legacy | apply)
 *      = School.legacyClassPct / GlobalAdmitBaseline.legacy_apply_rate
 *
 * Idempotent — uses upsert on the unique `metric` column.
 *
 * Run standalone:
 *   pnpm --filter api exec tsx prisma/seed-global-admit-baselines.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW';

interface BaselineSeed {
  metric: string;
  value: number;
  source: string;
  cycleYear: number;
  confidenceTier: ConfidenceTier;
  note?: string;
}

export const GLOBAL_ADMIT_BASELINE_SEEDS: ReadonlyArray<BaselineSeed> = [
  {
    metric: 'legacy_apply_rate',
    value: 0.05,
    cycleYear: 2024,
    confidenceTier: 'LOW',
    source: 'Common App End-of-Season Report 2023-24 + industry estimates',
    note: 'Range 0.05-0.07. At selective schools applicants pool has higher legacy concentration; at non-selective ~0.05.',
  },
  {
    metric: 'athlete_apply_rate',
    value: 0.015,
    cycleYear: 2024,
    confidenceTier: 'LOW',
    source: 'NCAA + Common App aggregate estimate',
    note: 'Range 0.01-0.02. Recruited athletes filtered upstream; in general pool quite rare.',
  },
  {
    metric: 'firstgen_apply_rate',
    value: 0.2,
    cycleYear: 2024,
    confidenceTier: 'MEDIUM',
    source: 'Common App End-of-Season Report 2023-24',
    note: 'First-gen ~20% of applicants. Range 0.18-0.22.',
  },
  {
    metric: 'intl_apply_rate',
    value: 0.13,
    cycleYear: 2024,
    confidenceTier: 'MEDIUM',
    source: 'Common App international applicants statistics',
    note: '~13% of applicants international, varies by school selectivity.',
  },
  {
    metric: 'national_award_apply_rate',
    value: 0.08,
    cycleYear: 2024,
    confidenceTier: 'LOW',
    source: 'Cornell L@S 2023 paper + Common App leadership reporting',
    note: 'Estimate — national+ awards ~8% of selective school applicants.',
  },
];

async function main() {
  let inserted = 0;
  let updated = 0;
  for (const seed of GLOBAL_ADMIT_BASELINE_SEEDS) {
    const existing = await prisma.globalAdmitBaseline.findUnique({
      where: { metric: seed.metric },
    });
    if (existing) {
      await prisma.globalAdmitBaseline.update({
        where: { metric: seed.metric },
        data: {
          value: seed.value,
          source: seed.source,
          cycleYear: seed.cycleYear,
          confidenceTier: seed.confidenceTier,
          note: seed.note ?? null,
        },
      });
      updated++;
    } else {
      await prisma.globalAdmitBaseline.create({ data: seed });
      inserted++;
    }
    console.log(`  ✓ ${seed.metric}: ${seed.value} [${seed.confidenceTier}]`);
  }
  console.log(
    `\nSummary: ${inserted} inserted, ${updated} updated, ${GLOBAL_ADMIT_BASELINE_SEEDS.length} total`,
  );
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
