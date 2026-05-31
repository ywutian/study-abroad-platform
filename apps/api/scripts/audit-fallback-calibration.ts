/**
 * Aggregate self-calibration audit (2026-05-31).
 *
 * The counselor engine's data-driven paths use each school's PUBLISHED ratio
 * (ed/overall, oos/overall, intl/overall) when available; a hand-set FALLBACK
 * multiplier fires otherwise. This tool validates those fallback constants
 * against the EMPIRICAL ratio computed from the schools that DO publish the
 * data — i.e. "does the literature-set fallback reproduce what the aggregate
 * published rates actually show?". Zero individual outcomes — pure aggregate
 * calibration (the data-grounded, generalizable check from
 * docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md §3/§7.2).
 *
 * Informational (exit 0): a fallback constant legitimately differs from any
 * single school's ratio; this reports whether the constant sits inside the
 * empirical interquartile range of its tier. A constant far outside the IQR is
 * a calibration flag worth reviewing.
 *
 * Run: npx tsx apps/api/scripts/audit-fallback-calibration.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const num = (v: unknown): number | null =>
  v == null ? null : Number(v as never);

function stats(xs: number[]) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, p25: q(0.25), median: q(0.5), p75: q(0.75) };
}

function line(label: string, fallback: number, st: ReturnType<typeof stats>) {
  if (!st) {
    console.log(
      `  ${label.padEnd(26)} fallback ×${fallback.toFixed(2)}   (no published data)`,
    );
    return;
  }
  const inIqr = fallback >= st.p25 - 0.05 && fallback <= st.p75 + 0.05;
  const flag = inIqr ? '✅' : '⚠️ ';
  console.log(
    `  ${label.padEnd(26)} fallback ×${fallback.toFixed(2)}  vs empirical median ×${st.median.toFixed(2)} [${st.p25.toFixed(2)}–${st.p75.toFixed(2)}] n=${st.n}  ${flag}`,
  );
}

async function main() {
  const schools = await prisma.school.findMany({
    select: {
      name: true,
      acceptanceRate: true,
      edAcceptanceRate: true,
      eaAcceptanceRate: true,
      oosAcceptanceRate: true,
      intlAcceptanceRate: true,
      state: true,
      isPrivate: true,
    },
  });
  const rows = schools.map((s) => ({
    ovr: num(s.acceptanceRate),
    ed: num(s.edAcceptanceRate),
    ea: num(s.eaAcceptanceRate),
    oos: num(s.oosAcceptanceRate),
    intl: num(s.intlAcceptanceRate),
    st: s.state,
    priv: s.isPrivate,
  }));

  console.log(
    '=== Aggregate self-calibration: fallback constants vs published-data ratios ===\n',
  );

  // ED fallback (selectivityScaledEdMultiplier) — ratio ed/overall by overall band
  console.log(
    'ED fallback (ratio = published ED rate / overall), by selectivity band:',
  );
  const edBands: Array<[string, number, (o: number) => boolean]> = [
    ['overall <8%', 3.0, (o) => o < 8],
    ['overall 8-15%', 2.4, (o) => o >= 8 && o < 15],
    ['overall 15-30%', 1.8, (o) => o >= 15 && o < 30],
    ['overall 30-45%', 1.4, (o) => o >= 30 && o < 45],
    ['overall ≥45%', 1.15, (o) => o >= 45],
  ];
  for (const [label, fb, pred] of edBands) {
    const ratios = rows
      .filter(
        (r) => r.ovr != null && r.ed != null && r.ed > r.ovr! && pred(r.ovr!),
      )
      .map((r) => r.ed! / r.ovr!);
    line(label, fb, stats(ratios));
  }

  // geo OOS fallback — ratio oos/overall, strong-pref vs other publics
  console.log(
    '\ngeo OOS (ratio = published OOS rate / overall), public schools:',
  );
  const STRONG = new Set(['CA', 'MI', 'NC', 'VA', 'TX', 'FL']);
  const oosStrong = rows
    .filter(
      (r) =>
        !r.priv && r.ovr != null && r.oos != null && r.st && STRONG.has(r.st),
    )
    .map((r) => r.oos! / r.ovr!);
  const oosOther = rows
    .filter(
      (r) =>
        !r.priv && r.ovr != null && r.oos != null && r.st && !STRONG.has(r.st),
    )
    .map((r) => r.oos! / r.ovr!);
  line('strong-pref state (fb 0.5)', 0.5, stats(oosStrong));
  line('other public (fb 0.85)', 0.85, stats(oosOther));
  console.log(
    '  NOTE: engine clamps the data-path ratio to [0.35, 1.8]; many strong-pref UCs admit OOS *easier* (ratio >1), confirming §7.6.',
  );

  // intl fallback — ratio intl/overall by selectivity band
  console.log(
    '\nintl fallback (ratio = published intl rate / overall), by selectivity band:',
  );
  const intlBands: Array<[string, number, (o: number) => boolean]> = [
    ['overall <10% (fb ~0.48)', 0.48, (o) => o < 10],
    ['overall 10-20% (fb ~0.78)', 0.78, (o) => o >= 10 && o < 20],
    ['overall 20-40% (fb ~0.78)', 0.78, (o) => o >= 20 && o < 40],
    ['overall ≥40% (fb 0.80)', 0.8, (o) => o >= 40],
  ];
  for (const [label, fb, pred] of intlBands) {
    const ratios = rows
      .filter((r) => r.ovr != null && r.intl != null && pred(r.ovr!))
      .map((r) => r.intl! / r.ovr!);
    line(label, fb, stats(ratios));
  }

  console.log('\n──────────────────────────────────────');
  console.log(
    '✅ = fallback sits inside the empirical IQR of its tier (well-calibrated to aggregate data).',
  );
  console.log(
    '⚠️  = fallback outside the IQR — review (but a literature-set fallback may legitimately differ).',
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('calibration error:', (e as Error).message);
  process.exit(2);
});
