/**
 * Prediction data-integrity gate — the invariants every data-driven counselor
 * input MUST satisfy, restricted to contamination classes with NO legitimate
 * exceptions (so this can be a hard CI gate without false positives).
 *
 * HARD (exit 1):
 *   INTL  : intlAcceptanceRate < overall           (intl pool more competitive)
 *   ROUND : ed/ed2/ea >= 1%                         (no real early rate is <1%;
 *                                                    <1% = scale error)
 *   SAT   : sat25 < sat75, both within 400..1600    (ordering + range)
 *   GPA   : gpaDistribution has the 5 CDS-C9 bands and sums to ~100%
 *
 * SOFT (warn only):
 *   SAT 1080/1320 placeholder  — the engine already guards this via
 *   `isPlaceholderSatBand`, so it is reported but not failed.
 *
 * NOT checked (intentionally): ED/EA/OOS directionality. ED is *usually* easier
 * than overall and OOS *usually* harder at flagship publics, but both have real
 * exceptions (competitive REA; revenue-seeking UCs admit OOS easier), and the
 * roundMultiplier/geoMultiplier handle the data-driven values correctly either
 * way — so a directionality invariant here would be false-positive noise.
 *
 * Run:  npx tsx apps/api/scripts/audit-prediction-data-integrity.ts
 * Fix:  prisma/seed-intl-rate-correction.ts + prisma/seed-round-rate-correction.ts
 * See:  docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GPA_BANDS = ['<3.00', '3.00-3.24', '3.25-3.49', '3.50-3.74', '3.75-4.00'];

type Row = { name: string; rank: number; detail: string };

function report(title: string, rows: Row[], checked: number): number {
  const flag = rows.length === 0 ? '✅' : '❌';
  console.log(
    `\n${flag} [${title}] ${rows.length} violation(s) / ${checked} checked`,
  );
  rows
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 30)
    .forEach((r) =>
      console.log(
        `   ${r.detail}  | rank ${r.rank === 999 ? '-' : r.rank}  ${r.name}`,
      ),
    );
  if (rows.length > 30) console.log(`   … +${rows.length - 30} more`);
  return rows.length;
}

async function main() {
  const schools = await prisma.school.findMany({
    select: {
      name: true,
      usNewsRank: true,
      acceptanceRate: true,
      edAcceptanceRate: true,
      ed2AcceptanceRate: true,
      eaAcceptanceRate: true,
      intlAcceptanceRate: true,
      sat25: true,
      sat75: true,
      gpaDistribution: true,
    },
  });

  const num = (v: unknown): number | null =>
    v == null ? null : Number(v as never);
  let hard = 0;

  // INTL: must be more competitive than overall
  {
    const rows: Row[] = [];
    let checked = 0;
    for (const s of schools) {
      const overall = num(s.acceptanceRate);
      const intl = num(s.intlAcceptanceRate);
      if (intl == null || overall == null) continue;
      checked++;
      if (intl >= overall - 0.5)
        rows.push({
          name: s.name,
          rank: s.usNewsRank ?? 999,
          detail: `intl ${intl.toFixed(1)}% >= overall ${overall.toFixed(1)}%`,
        });
    }
    hard += report('INTL more-competitive', rows, checked);
  }

  // ROUND: no early rate below 1% (scale-error guard)
  {
    const rows: Row[] = [];
    let checked = 0;
    for (const s of schools) {
      for (const [f, v] of [
        ['ED', s.edAcceptanceRate],
        ['ED2', s.ed2AcceptanceRate],
        ['EA', s.eaAcceptanceRate],
      ] as const) {
        const n = num(v);
        if (n == null) continue;
        checked++;
        if (n < 1)
          rows.push({
            name: s.name,
            rank: s.usNewsRank ?? 999,
            detail: `${f} ${n}% < 1% (scale error)`,
          });
      }
    }
    hard += report('ROUND no sub-1% scale error', rows, checked);
  }

  // SAT: ordering + range (placeholder handled as a soft warning below)
  {
    const rows: Row[] = [];
    const placeholders: Row[] = [];
    let checked = 0;
    for (const s of schools) {
      const lo = s.sat25;
      const hi = s.sat75;
      if (lo == null || hi == null) continue;
      checked++;
      const row = { name: s.name, rank: s.usNewsRank ?? 999, detail: '' };
      if (lo === 1080 && hi === 1320) {
        placeholders.push({ ...row, detail: `SAT 1080/1320 placeholder` });
      } else if (lo >= hi) {
        rows.push({ ...row, detail: `SAT25 ${lo} >= SAT75 ${hi}` });
      } else if (lo < 400 || hi > 1600) {
        rows.push({ ...row, detail: `SAT out of range ${lo}-${hi}` });
      }
    }
    hard += report('SAT ordering + range', rows, checked);
    if (placeholders.length > 0) {
      console.log(
        `\n⚠️  [SAT placeholder — SOFT] ${placeholders.length} school(s) on the 1080/1320 placeholder (engine guards via isPlaceholderSatBand):`,
      );
      placeholders
        .sort((a, b) => a.rank - b.rank)
        .forEach((r) =>
          console.log(`   ${r.name} (rank ${r.rank === 999 ? '-' : r.rank})`),
        );
    }
  }

  // GPA distribution: 5 bands present, sums to ~100
  {
    const rows: Row[] = [];
    let checked = 0;
    for (const s of schools) {
      const dist = s.gpaDistribution as Record<string, unknown> | null;
      if (dist == null || typeof dist !== 'object') continue;
      checked++;
      const missing = GPA_BANDS.filter(
        (k) => !Number.isFinite(Number(dist[k])),
      );
      if (missing.length > 0) {
        rows.push({
          name: s.name,
          rank: s.usNewsRank ?? 999,
          detail: `gpaDist missing bands: ${missing.join(',')}`,
        });
        continue;
      }
      const sum = GPA_BANDS.reduce((a, k) => a + Number(dist[k]), 0);
      const norm = sum > 2 ? sum : sum * 100;
      if (norm < 90 || norm > 110)
        rows.push({
          name: s.name,
          rank: s.usNewsRank ?? 999,
          detail: `gpaDist sums to ${norm.toFixed(0)}% (expect ~100)`,
        });
    }
    hard += report('GPA distribution well-formed', rows, checked);
  }

  console.log(`\n──────────────────────────────────────`);
  await prisma.$disconnect();
  if (hard > 0) {
    console.error(
      `❌ FAIL: ${hard} hard violation(s). Run the correction seeds.`,
    );
    process.exit(1);
  }
  console.log('✅ PASS: all hard data-integrity invariants hold.');
}

main().catch((e) => {
  console.error('audit error:', (e as Error).message);
  process.exit(2);
});
