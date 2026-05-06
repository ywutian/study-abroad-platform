/**
 * Fetch intlStudentPct from College Scorecard for US schools missing it.
 *
 * Uses: 2023.student.demographics.race_ethnicity.non_resident_alien
 * (fraction of enrolled students who are non-resident aliens = international)
 *
 * Two lookup strategies:
 *   1. Schools with ipedsId → batch query by unitid
 *   2. Schools without ipedsId → search by name (returns top match)
 *
 * Stores as a percentage (e.g. 0.1226 → 12.26).
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/fetch-intl-student-pct-scorecard.ts
 *   pnpm --filter api exec tsx scripts/fetch-intl-student-pct-scorecard.ts --dry-run
 *   pnpm --filter api exec tsx scripts/fetch-intl-student-pct-scorecard.ts --all   # overwrite existing
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SCORECARD_KEY = process.env.COLLEGE_SCORECARD_API_KEY ?? '';
const FIELD = '2023.student.demographics.race_ethnicity.non_resident_alien';
const BATCH_SIZE = 100;

function toPercent(raw: number | null): number | null {
  if (raw === null) return null;
  const pct = raw <= 1 ? raw * 100 : raw;
  return Math.round(pct * 100) / 100;
}

/** Batch lookup by unitid (reliable exact match) */
async function fetchByIds(
  unitids: number[],
): Promise<Record<number, number | null>> {
  const ids = unitids.join(',');
  const url = `https://api.data.gov/ed/collegescorecard/v1/schools.json?api_key=${SCORECARD_KEY}&id=${ids}&fields=id,school.name,${FIELD}&per_page=${BATCH_SIZE}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ⚠️  Scorecard HTTP ${res.status}`);
    return {};
  }
  const data = (await res.json()) as any;
  const out: Record<number, number | null> = {};
  for (const row of data.results ?? []) {
    out[row['id']] = toPercent(row[FIELD] ?? null);
  }
  return out;
}

/** Single name search — returns top match (only undergraduate 4-year) */
async function fetchByName(
  name: string,
): Promise<{ unitid: number; pct: number | null } | null> {
  // Encode name for URL, search only 4-year schools
  const encoded = encodeURIComponent(name);
  const url = `https://api.data.gov/ed/collegescorecard/v1/schools.json?api_key=${SCORECARD_KEY}&school.name=${encoded}&school.degrees_awarded.highest=4&fields=id,school.name,${FIELD}&per_page=3`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const rows: any[] = data.results ?? [];
  if (rows.length === 0) return null;

  // Take closest name match
  const nameLower = name.toLowerCase();
  rows.sort((a: any, b: any) => {
    const aMatch = a['school.name']
      ?.toLowerCase()
      .includes(nameLower.split(' ')[0])
      ? 0
      : 1;
    const bMatch = b['school.name']
      ?.toLowerCase()
      .includes(nameLower.split(' ')[0])
      ? 0
      : 1;
    return aMatch - bMatch;
  });

  const top = rows[0];
  return { unitid: top['id'], pct: toPercent(top[FIELD] ?? null) };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const overwriteAll = args.includes('--all');

  if (!SCORECARD_KEY) {
    console.error('COLLEGE_SCORECARD_API_KEY not set in .env');
    process.exit(1);
  }

  console.log(`\n🌍 intlStudentPct via College Scorecard`);
  console.log(
    `   Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'} | Overwrite: ${overwriteAll}\n`,
  );

  const where = overwriteAll
    ? { country: 'US' }
    : { country: 'US', intlStudentPct: null };

  const schools = await prisma.school.findMany({
    where: where as any,
    select: { id: true, name: true, ipedsId: true, intlStudentPct: true },
    orderBy: [{ usNewsRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
  });

  console.log(`Found ${schools.length} schools missing intlStudentPct\n`);

  const stats = { updated: 0, notFound: 0, errors: 0 };

  // Phase A: batch lookup by ipedsId
  const withId = schools.filter((s) => s.ipedsId);
  if (withId.length > 0) {
    console.log(
      `Phase A: ${withId.length} schools have ipedsId — batch lookup`,
    );
    for (let i = 0; i < withId.length; i += BATCH_SIZE) {
      const batch = withId.slice(i, i + BATCH_SIZE);
      const unitids = batch
        .map((s) => parseInt(s.ipedsId!, 10))
        .filter((n) => !isNaN(n));
      try {
        const scores = await fetchByIds(unitids);
        for (const school of batch) {
          const unitid = parseInt(school.ipedsId!, 10);
          const pct = scores[unitid] ?? null;
          if (pct === null) {
            stats.notFound++;
            continue;
          }
          if (!dryRun) {
            await prisma.school.update({
              where: { id: school.id },
              data: { intlStudentPct: pct },
            });
          }
          console.log(`  ✅ ${school.name} → ${pct}% (id=${unitid})`);
          stats.updated++;
        }
      } catch (err: unknown) {
        console.error(
          `  ❌ Batch error: ${err instanceof Error ? err.message : String(err)}`,
        );
        stats.errors++;
      }
      if (i + BATCH_SIZE < withId.length)
        await new Promise((r) => setTimeout(r, 300));
    }
    console.log('');
  }

  // Phase B: name-based lookup for schools without ipedsId
  const withoutId = schools.filter((s) => !s.ipedsId);
  if (withoutId.length > 0) {
    console.log(
      `Phase B: ${withoutId.length} schools without ipedsId — name search`,
    );
    for (let i = 0; i < withoutId.length; i++) {
      const school = withoutId[i];
      const prefix = `[${i + 1}/${withoutId.length}] ${school.name}`;
      try {
        const result = await fetchByName(school.name);
        if (!result || result.pct === null) {
          console.log(`  ○  ${prefix} → not found`);
          stats.notFound++;
        } else {
          if (!dryRun) {
            // Try to also store the discovered ipedsId, but skip if it conflicts
            try {
              await prisma.school.update({
                where: { id: school.id },
                data: {
                  intlStudentPct: result.pct,
                  ipedsId: String(result.unitid),
                },
              });
            } catch {
              // ipedsId conflict — just update pct without writing ipedsId
              await prisma.school.update({
                where: { id: school.id },
                data: { intlStudentPct: result.pct },
              });
            }
          }
          console.log(`  ✅ ${prefix} → ${result.pct}% (id=${result.unitid})`);
          stats.updated++;
        }
      } catch (err: unknown) {
        console.error(
          `  ❌ ${prefix} → ${err instanceof Error ? err.message : String(err)}`,
        );
        stats.errors++;
      }
      // 1 name search per 300ms = ~3 req/sec
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log('\n=== RESULTS ===');
  console.log(`  Updated:   ${stats.updated}`);
  console.log(`  Not found: ${stats.notFound}`);
  console.log(`  Errors:    ${stats.errors}`);
  if (schools.length > 0) {
    console.log(
      `  Hit rate:  ${((stats.updated / schools.length) * 100).toFixed(1)}%`,
    );
  }

  if (dryRun) console.log('\n⚠️  DRY-RUN: no DB writes.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
