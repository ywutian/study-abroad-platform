/**
 * Data-quality correction: null SCALE-ERROR `School.intlAcceptanceRate` values.
 *
 * History: a 2026-05-30 audit nulled every `intlAcceptanceRate >= overall` on the
 * theory that intl admit is always < overall (intl pool more competitive) and the
 * column had enrollment-% leaks. **That theory was DISPROVEN (2026-06):** web
 * research verified 6/6 of the intl>=overall schools (UC Davis 50.7%, Ohio State
 * 72%, U Minnesota 82%, Rutgers 70.7%, Virginia Tech 66%, U Florida 32.5%) against
 * PUBLISHED international admit rates — all REAL, 0/6 matching the intl ENROLLMENT
 * %. intl >= overall is the genuine **revenue-seeking large-public** pattern, not
 * contamination. The old directionality rule was destroying real, high-value signal
 * on exactly the schools international applicants care about.
 *
 * Current rule — null ONLY unambiguous scale errors (engine then falls back to its
 * selectivity-tiered heuristic):
 *   intl < 1%  (a fraction stored as percent — e.g. UCSC/UCM 0.81 = the fraction 81%)
 *   intl > 100% (impossible)
 * Everything in [1, 100] is KEPT — including legitimate intl >= overall publics.
 *
 * The counselor `intlMultiplier` reads `ratio = intlRate / overallRate` clamped to
 * [0.3, 1.2], so a kept real rate (e.g. UC Davis 50.7 / 41.8 ≈ 1.2) correctly gives
 * intl applicants the data-driven signal; a nulled scale error falls back safely.
 *
 * Idempotent. Run AFTER the intl-rate seeds + closure overlay (which re-applies raw
 * values). Enforced by scripts/audit-prediction-data-integrity.ts (same scale-only
 * invariant).
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
    const intl = Number(s.intlAcceptanceRate);

    // SCALE-only correction. The former `intl >= overall` (directionality) rule
    // was REMOVED: web research verified 6/6 of the intl>=overall schools (UC Davis
    // 50.7%, Ohio State 72%, UMN 82%, Rutgers 70.7%, Virginia Tech 66%, UF 32.5%)
    // against PUBLISHED international admit rates — all REAL, 0/6 matching the intl
    // ENROLLMENT %. So intl>=overall is the genuine revenue-seeking-public pattern,
    // NOT the enrollment-% leak #310 assumed; nulling it destroyed real signal on
    // exactly the schools intl applicants care about. Null ONLY unambiguous scale
    // errors — a real international admit rate is never <1% (fraction stored as
    // percent, e.g. UCSC/UCM 0.81) and never >100%. Matches audit-prediction-data-integrity.
    if (intl >= 1 && intl <= 100) continue;

    await prisma.school.update({
      where: { id: s.id },
      data: { intlAcceptanceRate: null },
    });
    nulled.push({
      name: s.name,
      intl,
      overall: Number(s.acceptanceRate ?? 0),
      reason: 'scale error (intl <1% or >100% — fraction stored as percent)',
    });
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
