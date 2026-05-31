/**
 * Regression gate: every `School.intlAcceptanceRate` must be a plausible
 * international ADMIT rate — i.e. meaningfully LOWER than the school's overall
 * acceptance rate. A value >= overall (or a fraction-vs-percent scale
 * mismatch) means an enrollment-% / overall-rate relabel leaked into the
 * column, which makes the counselor `intlMultiplier` emit a wrong BOOST for
 * international applicants at selective schools.
 *
 * Run:    npx tsx apps/api/scripts/audit-intl-rate-quality.ts
 * Fix:    npx tsx apps/api/prisma/seed-intl-rate-correction.ts
 *
 * Exit 0 = clean; exit 1 = contamination found (use in CI / pre-push).
 * See: docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    where: { intlAcceptanceRate: { not: null }, acceptanceRate: { not: null } },
    select: {
      name: true,
      acceptanceRate: true,
      intlAcceptanceRate: true,
      usNewsRank: true,
    },
  });

  const rows = schools.map((s) => ({
    name: s.name,
    rank: s.usNewsRank ?? 999,
    overall: Number(s.acceptanceRate),
    intl: Number(s.intlAcceptanceRate),
  }));

  const bad = rows.filter(
    (r) => r.intl >= r.overall - 0.5 || (r.intl < 1 && r.overall >= 1),
  );

  console.log(
    `intl-rate quality: ${rows.length} schools with intl + overall, ${bad.length} contaminated (intl >= overall).`,
  );
  bad
    .sort((a, b) => a.rank - b.rank)
    .forEach((r) =>
      console.log(
        `  ❌ intl ${r.intl.toFixed(1)}% vs overall ${r.overall.toFixed(1)}%  | rank ${r.rank === 999 ? '-' : r.rank}  ${r.name}`,
      ),
    );

  await prisma.$disconnect();

  if (bad.length > 0) {
    console.error(
      `\n❌ FAIL: ${bad.length} contaminated intlAcceptanceRate value(s). Run prisma/seed-intl-rate-correction.ts.`,
    );
    process.exit(1);
  }
  console.log('\n✅ PASS: every intlAcceptanceRate is below its overall rate.');
}

main().catch((e) => {
  console.error('audit error:', (e as Error).message);
  process.exit(2);
});
