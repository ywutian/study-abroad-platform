/**
 * Data-quality correction: null implausibly-tiny early-round admit rates.
 *
 * A real ED / ED2 / EA / REA admit rate is never below ~1% (even the most
 * selective restrictive-EA schools sit around 8%). A stored value < 1% is a
 * scale error (a fraction got stored as a percent, or a bad extract). The
 * 2026-05-30 data-integrity sweep found:
 *   - University of Chicago: edAcceptanceRate 0.2%, eaAcceptanceRate 0.1%
 *   - University of Michigan, Ann Arbor: eaAcceptanceRate 0.2%
 *
 * Effect of leaving them: the counselor `roundMultiplier` sees
 * `roundRate < overallRate`, trips its "school data anomaly" branch, and
 * returns a neutral x1.0 instead of the correct early-round boost — i.e. the
 * applicant silently loses the ED/EA advantage. Nulling lets the engine fall
 * back to the heuristic (ED x2.5 / EA x1.3) instead.
 *
 * Idempotent. Wired into the seed pipeline after the round-rate seeds.
 * Enforced by scripts/audit-prediction-data-integrity.ts.
 *
 * Run standalone (also to apply against prod):
 *   npx tsx apps/api/prisma/seed-round-rate-correction.ts
 *
 * See: docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md
 */
import { PrismaClient } from '@prisma/client';

const standalonePrisma = new PrismaClient();

const ROUND_FIELDS = [
  'edAcceptanceRate',
  'ed2AcceptanceRate',
  'eaAcceptanceRate',
] as const;

export interface RoundRateCorrectionResult {
  scanned: number;
  nulled: Array<{ name: string; fixes: string[] }>;
}

export async function correctRoundRateScaleErrors(
  prisma: PrismaClient = standalonePrisma,
): Promise<RoundRateCorrectionResult> {
  const schools = await prisma.school.findMany({
    where: {
      OR: [
        { edAcceptanceRate: { not: null } },
        { ed2AcceptanceRate: { not: null } },
        { eaAcceptanceRate: { not: null } },
      ],
    },
    select: {
      id: true,
      name: true,
      edAcceptanceRate: true,
      ed2AcceptanceRate: true,
      eaAcceptanceRate: true,
    },
  });

  const nulled: RoundRateCorrectionResult['nulled'] = [];
  for (const s of schools) {
    const data: Record<string, null> = {};
    const fixes: string[] = [];
    for (const field of ROUND_FIELDS) {
      const raw = s[field];
      if (raw == null) continue;
      const value = Number(raw);
      // < 1% is implausible for any real early-round rate → scale error.
      if (value < 1) {
        data[field] = null;
        fixes.push(`${field}=${value}%`);
      }
    }
    if (fixes.length > 0) {
      await prisma.school.update({ where: { id: s.id }, data });
      nulled.push({ name: s.name, fixes });
    }
  }

  return { scanned: schools.length, nulled };
}

async function main() {
  const { scanned, nulled } = await correctRoundRateScaleErrors();
  console.log(
    `🧹 round-rate scale-error correction: scanned ${scanned}, nulled ${nulled.length} school(s).`,
  );
  nulled.forEach((n) =>
    console.log(`  null  ${n.name}  [${n.fixes.join(', ')}]`),
  );
  await standalonePrisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌ round-rate correction failed:', (e as Error).message);
    process.exit(1);
  });
}
