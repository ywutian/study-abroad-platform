/**
 * Import global admit baselines into GlobalAdmitBaseline table.
 * These are P(category|apply) baselines from NACAC / Common App / industry reports
 * used as denominators in Bayesian update.
 *
 * Run: cd apps/api && pnpm exec tsx scripts/cds-collection-2026-05-22/import-global-baselines.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface SourceEntry {
  value: number;
  tier?: string;
  source?: string;
  note?: string;
  range?: string;
}

async function main() {
  const filePath = path.resolve(__dirname, 'global-admit-aggregates.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const hooks = data.hookPrevalenceInApplicantPool as Record<
    string,
    SourceEntry
  >;

  const records: Array<{
    metric: string;
    value: number;
    source: string;
    cycleYear: number;
    confidenceTier: string;
    note: string;
  }> = [];

  const mapping: Array<{ key: keyof typeof hooks; metric: string }> = [
    { key: 'legacy', metric: 'legacy_apply_rate' },
    { key: 'recruitedAthlete', metric: 'athlete_apply_rate' },
    { key: 'firstGen', metric: 'firstgen_apply_rate' },
    { key: 'international', metric: 'intl_apply_rate' },
    { key: 'nationalLevelAward', metric: 'national_award_apply_rate' },
  ];

  for (const { key, metric } of mapping) {
    const entry = hooks[key];
    if (!entry || entry.value === undefined) continue;
    records.push({
      metric,
      value: entry.value,
      source:
        entry.source ??
        'Common App End-of-Season Report 2023-24 + industry estimates',
      cycleYear: 2024,
      confidenceTier: entry.tier ?? 'LOW',
      note: entry.note ?? entry.range ?? '',
    });
  }

  let inserted = 0;
  let updated = 0;
  for (const r of records) {
    const existing = await prisma.globalAdmitBaseline.findUnique({
      where: { metric: r.metric },
    });
    if (existing) {
      await prisma.globalAdmitBaseline.update({
        where: { metric: r.metric },
        data: {
          value: r.value,
          source: r.source,
          cycleYear: r.cycleYear,
          confidenceTier: r.confidenceTier,
          note: r.note,
        },
      });
      updated++;
    } else {
      await prisma.globalAdmitBaseline.create({ data: r });
      inserted++;
    }
    console.log(`  ✓ ${r.metric}: ${r.value} (${r.confidenceTier})`);
  }

  console.log(
    `\nSummary: ${inserted} inserted, ${updated} updated, ${records.length} total`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
