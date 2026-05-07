/**
 * Spillover Phase C cleanup: 33-school SAT/ACT seed-default purge.
 *
 * Replaces placeholder bands (sat25=1080, sat75=1320, act25=22, act75=29)
 * for US schools where College Scorecard has real data.
 *
 * Per docs/migrations/prediction-simplification/spillover-ticket-sat-act-defaults.md
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/cleanup-33-school-sat-bands.ts --dry-run
 *   pnpm --filter api exec tsx scripts/cleanup-33-school-sat-bands.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';

const API_KEY = process.env.COLLEGE_SCORECARD_API_KEY;
if (!API_KEY) {
  console.error(
    'COLLEGE_SCORECARD_API_KEY missing from apps/api/.env. Get one at https://api.data.gov/signup/',
  );
  process.exit(1);
}

const BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';

const PLACEHOLDER = {
  sat25: 1080,
  sat75: 1320,
  act25: 22,
  act75: 29,
};

// DB name → preferred Scorecard search query. Used to fix campus
// disambiguation and known naming quirks (Scorecard uses different
// canonical forms than our DB for some institutions).
const NAME_OVERRIDES: Record<string, string> = {
  'Penn State University': 'Pennsylvania State University-Main Campus',
  'SUNY Binghamton University': 'Binghamton University',
  'ArtCenter College of Design': 'Art Center College of Design',
  'University of San Diego': 'University of San Diego',
  // Schools where the bare name produced wrong-campus matches; require
  // explicit "main campus" disambiguation.
};

// Schools whose Scorecard data is suspect (campus ambiguity, multi-system
// naming) — keep the placeholder until manually resolved via CDS lookup.
const SKIP_LIST = new Set<string>([
  // (none currently — all suspects handled via NAME_OVERRIDES)
]);

interface ScorecardResult {
  'school.name'?: string;
  'latest.admissions.sat_scores.25th_percentile.critical_reading'?: number;
  'latest.admissions.sat_scores.75th_percentile.critical_reading'?: number;
  'latest.admissions.sat_scores.25th_percentile.math'?: number;
  'latest.admissions.sat_scores.75th_percentile.math'?: number;
  'latest.admissions.act_scores.25th_percentile.cumulative'?: number;
  'latest.admissions.act_scores.75th_percentile.cumulative'?: number;
}

async function fetchScorecard(
  schoolName: string,
): Promise<ScorecardResult | null> {
  const fields = [
    'school.name',
    'latest.admissions.sat_scores.25th_percentile.critical_reading',
    'latest.admissions.sat_scores.75th_percentile.critical_reading',
    'latest.admissions.sat_scores.25th_percentile.math',
    'latest.admissions.sat_scores.75th_percentile.math',
    'latest.admissions.act_scores.25th_percentile.cumulative',
    'latest.admissions.act_scores.75th_percentile.cumulative',
  ].join(',');

  const overrideQuery = NAME_OVERRIDES[schoolName];
  // Search with override first if available, then bare name, then variants
  const queries = [
    overrideQuery,
    schoolName,
    schoolName.replace(/,.*$/, '').trim(),
    schoolName.replace(/^The /i, '').replace(/,.*$/, '').trim(),
  ].filter((q): q is string => Boolean(q));

  for (const q of [...new Set(queries)]) {
    const url = `${BASE_URL}?api_key=${API_KEY}&school.name=${encodeURIComponent(
      q,
    )}&fields=${fields}&per_page=5`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = (await res.json()) as { results?: ScorecardResult[] };
    const results = data.results ?? [];
    if (!results.length) continue;

    // Prefer exact name match against the queried form
    const exact = results.find(
      (r) =>
        (r['school.name'] ?? '').toLowerCase().trim() ===
        q.toLowerCase().trim(),
    );
    if (exact) return exact;
    // Fallback: prefer results that look like the main campus (avoid
    // Altoona/Brandywine etc. for Penn State-style matches)
    const mainCampus = results.find((r) => {
      const n = (r['school.name'] ?? '').toLowerCase();
      return (
        n.includes('main campus') || (!n.includes('-') && !n.includes(','))
      );
    });
    if (mainCampus) return mainCampus;
    return results[0];
  }
  return null;
}

interface UpdatePayload {
  sat25?: number;
  sat75?: number;
  act25?: number;
  act75?: number;
  satReading25?: number;
  satReading75?: number;
  satMath25?: number;
  satMath75?: number;
}

function buildUpdate(stats: ScorecardResult): UpdatePayload {
  const out: UpdatePayload = {};
  const sr25 =
    stats['latest.admissions.sat_scores.25th_percentile.critical_reading'];
  const sr75 =
    stats['latest.admissions.sat_scores.75th_percentile.critical_reading'];
  const sm25 = stats['latest.admissions.sat_scores.25th_percentile.math'];
  const sm75 = stats['latest.admissions.sat_scores.75th_percentile.math'];
  const a25 = stats['latest.admissions.act_scores.25th_percentile.cumulative'];
  const a75 = stats['latest.admissions.act_scores.75th_percentile.cumulative'];

  if (sr25 != null) out.satReading25 = sr25;
  if (sr75 != null) out.satReading75 = sr75;
  if (sm25 != null) out.satMath25 = sm25;
  if (sm75 != null) out.satMath75 = sm75;
  if (sr25 != null && sm25 != null) out.sat25 = sr25 + sm25;
  if (sr75 != null && sm75 != null) out.sat75 = sr75 + sm75;
  if (a25 != null) out.act25 = a25;
  if (a75 != null) out.act75 = a75;

  return out;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n🧹 33-school SAT/ACT placeholder cleanup`);
  console.log(`   Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(
    `   Placeholder pattern: sat25=${PLACEHOLDER.sat25}, sat75=${PLACEHOLDER.sat75}, act25=${PLACEHOLDER.act25}, act75=${PLACEHOLDER.act75}\n`,
  );

  const prisma = new PrismaClient();
  try {
    const schools = await prisma.school.findMany({
      where: {
        country: 'US',
        sat25: PLACEHOLDER.sat25,
        sat75: PLACEHOLDER.sat75,
        act25: PLACEHOLDER.act25,
        act75: PLACEHOLDER.act75,
      },
      orderBy: { acceptanceRate: 'desc' },
    });

    console.log(`📊 Found ${schools.length} placeholder schools\n`);

    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const school of schools) {
      try {
        if (SKIP_LIST.has(school.name)) {
          console.log(`  ⏭️  ${school.name}: SKIP (manual review required)`);
          unchanged++;
          continue;
        }
        const stats = await fetchScorecard(school.name);
        if (!stats) {
          console.log(`  ⚠️  ${school.name}: no Scorecard match`);
          failed++;
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        const update = buildUpdate(stats);

        // Bail if Scorecard's data is itself the placeholder pattern (extremely
        // unlikely but worth guarding against)
        if (
          update.sat25 === PLACEHOLDER.sat25 &&
          update.sat75 === PLACEHOLDER.sat75 &&
          update.act25 === PLACEHOLDER.act25 &&
          update.act75 === PLACEHOLDER.act75
        ) {
          console.log(
            `  ⏭️  ${school.name}: Scorecard returns same placeholder; skipping`,
          );
          unchanged++;
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }

        const writeKeys = Object.keys(update) as (keyof UpdatePayload)[];
        if (writeKeys.length === 0) {
          console.log(
            `  ⏭️  ${school.name}: Scorecard returned no SAT/ACT fields`,
          );
          unchanged++;
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }

        const summary = [
          update.sat25 != null && update.sat75 != null
            ? `SAT ${update.sat25}-${update.sat75}`
            : null,
          update.act25 != null && update.act75 != null
            ? `ACT ${update.act25}-${update.act75}`
            : null,
        ]
          .filter(Boolean)
          .join(' | ');

        console.log(
          `  ${dryRun ? '🔍' : '✅'} ${school.name}: ${summary} (matched: "${stats['school.name']}")`,
        );

        if (!dryRun) {
          await prisma.school.update({
            where: { id: school.id },
            data: update,
          });
        }
        updated++;
        await new Promise((r) => setTimeout(r, 300)); // rate limiting
      } catch (err) {
        console.log(
          `  ❌ ${school.name}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        failed++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(
      `📊 ${dryRun ? '[DRY-RUN] Would update' : 'Updated'}: ${updated}, unchanged: ${unchanged}, failed: ${failed}`,
    );
    if (dryRun) {
      console.log(
        '\n⚠️  DRY-RUN: no DB writes made. Re-run without --dry-run to apply.',
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
