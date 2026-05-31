/**
 * Data-quality correction: null contaminated `School.intlAcceptanceRate`.
 *
 * Audit (2026-05-30, scripts/audit-intl-rate-quality.ts) found ~47 schools
 * where `intlAcceptanceRate >= overall acceptanceRate` — statistically
 * implausible, because an international admit rate is essentially always
 * LOWER than the overall rate at any selective school (the international pool
 * is more competitive). Root cause: international ENROLLMENT percentage
 * (`intlStudentPct`, which is 100%-covered and correctly stored elsewhere)
 * plus overall-rate relabels from aggregators leaked into the
 * `intlAcceptanceRate` column via an early metadata migration.
 *
 * Why it matters: the counselor engine's `intlMultiplier` reads
 * `ratio = intlRate / overallRate` clamped to [0.3, 1.2]. A contaminated
 * value (e.g. Yale "intl 11%" vs 4.8% overall) flips a correct ~×0.5
 * international penalty into a wrong ×1.2 BOOST — backwards, and on exactly
 * the elite schools international applicants care about most.
 *
 * Correction rule — null the value so the engine falls back to the correct
 * selectivity-tiered heuristic:
 *   1. intl >= overall - 0.5   (relabel or enrollment-% leak), OR
 *   2. intl < 1 && overall >= 1 (scale mismatch: fraction stored as percent)
 *
 * Nulling loses nothing: the real elite international admit rate is not public
 * data (verified 2026-05-30), and the enrollment % already lives in
 * `intlStudentPct`. For the few less-selective publics whose true intl rate is
 * genuinely ~overall, the intl fallback at overall >= 40% is ~×0.95
 * (near-neutral), so the prediction barely moves.
 *
 * Idempotent. Wired into the seed pipeline AFTER the intl-rate seeds so a
 * re-seed always converges to the invariant `intlAcceptanceRate < overall`.
 * Enforced by scripts/audit-intl-rate-quality.ts.
 *
 * Run standalone (also to apply against prod):
 *   npx tsx apps/api/prisma/seed-intl-rate-correction.ts
 *
 * See: docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md
 */
import { PrismaClient } from '@prisma/client';

const standalonePrisma = new PrismaClient();

export interface IntlCorrectionResult {
  scanned: number;
  nulled: Array<{
    name: string;
    intl: number;
    overall: number;
    reason: string;
  }>;
}

export async function correctIntlRates(
  prisma: PrismaClient = standalonePrisma,
): Promise<IntlCorrectionResult> {
  const schools = await prisma.school.findMany({
    where: { intlAcceptanceRate: { not: null } },
    select: {
      id: true,
      name: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
    },
  });

  const nulled: IntlCorrectionResult['nulled'] = [];
  for (const s of schools) {
    // Without an overall rate we cannot validate; leave the value untouched.
    if (s.acceptanceRate == null) continue;
    const overall = Number(s.acceptanceRate);
    const intl = Number(s.intlAcceptanceRate);

    let reason: string | null = null;
    if (intl < 1 && overall >= 1) {
      reason = 'scale-mismatch (fraction vs percent)';
    } else if (intl >= overall - 0.5) {
      reason = 'intl>=overall (relabel or enrollment-% leak)';
    }
    if (!reason) continue;

    await prisma.school.update({
      where: { id: s.id },
      data: { intlAcceptanceRate: null },
    });
    nulled.push({ name: s.name, intl, overall, reason });
  }

  return { scanned: schools.length, nulled };
}

async function main() {
  const { scanned, nulled } = await correctIntlRates();
  console.log(
    `🧹 intlAcceptanceRate correction: scanned ${scanned} with-intl school(s), nulled ${nulled.length} contaminated.`,
  );
  nulled
    .sort((a, b) => b.intl - b.overall - (a.intl - a.overall))
    .forEach((n) =>
      console.log(
        `  null  intl ${n.intl.toFixed(1)}% / overall ${n.overall.toFixed(1)}%  ${n.name}  [${n.reason}]`,
      ),
    );
  await standalonePrisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌ intl-rate correction failed:', (e as Error).message);
    process.exit(1);
  });
}
