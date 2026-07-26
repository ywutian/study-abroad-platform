#!/usr/bin/env tsx
/**
 * Counselor Engine Invariant Sweep — property-based CI gate for cold-start prediction.
 *
 * Where gold/calibration cases test SPECIFIC (school, profile) points, this sweep
 * tests the structural PROPERTIES the engine must satisfy EVERYWHERE — across the
 * full school population × many profiles × rounds. It is the regression guard that
 * keeps the "no nonsense" guarantees (monotonicity, bounded range, conservatism,
 * determinism) from silently rotting under future changes.
 *
 * Born from the 2026-06 invariant deep-dive (docs/PREDICTION_INVARIANT_DEEPDIVE_2026-06-01.md):
 * that sweep found and fixed real non-monotonicities (#319 geomean, #320 isotonic,
 * #321 GPA-proxy de-dup) but was run ad-hoc and discarded. This persists it so the
 * same class of bug is caught pre-merge, not in prod.
 *
 * Invariants (must hold for ALL schools / a strictly-better applicant must never lose):
 *   1.  Range          — prob ∈ (0, 0.98], finite (portfolio-admission schools exempt: they
 *                        intentionally return tier-4 / 0 because academic stats can't predict them)
 *   2.  GPA-monotonic  — holding test fixed, higher GPA ⇒ prob non-decreasing
 *   3.  Test-monotonic — holding GPA fixed, higher SAT ⇒ prob non-decreasing
 *   4.  Dominance      — A ≥ B on BOTH GPA and test ⇒ prob(A) ≥ prob(B)
 *   5.  Round ED≥RD    — early decision never lower than RD for the same profile
 *   6.  Round EA≥RD    — early action never lower than RD for the same profile
 *   7.  First-gen      — first-gen hook never lowers the probability
 *   8.  Athlete        — recruited-athlete flag never lowers the probability
 *   9.  URM-neutral    — URM flag is EXACTLY neutral (disabled pending compliance review)
 *   10. Legacy-neutral — legacy flag is EXACTLY neutral (disabled pending evidence verification)
 *   11. Determinism    — identical input ⇒ identical output
 *   12. Clamp-bounds   — a predictable result stays within [anchor×0.1, min(0.98, anchor×2.5)]
 *   13. Hooks-combine  — stacking hooks (first-gen + athlete) never scores below either alone
 *   14. ECs-never-hurt — a strong-activity/award profile ⇒ prob ≥ the bare profile
 *   15. Submit≥TO      — submitting a strong (above-75th) test never scores below test-optional
 *   16. GPA-monotonic (intl) — GPA-monotonicity also holds for international applicants
 *
 * Exit codes: 0 = all invariants hold, 2 = at least one violation.
 *
 * RUN THIS LOCALLY against the full prod-representative seed:
 *     pnpm --filter api db:seed   # orchestrator: complete CDS band ladders + gpaDistribution
 *     pnpm --filter api invariants:counselor          # 0 violations on prod-like data
 *     pnpm --filter api invariants:counselor --limit 60   # fast subset
 *
 * WIRED INTO CI as of 2026-07-25 (ci.yml, prediction-gate job).
 *
 * It was excluded before that on the grounds that the gate DB, being partially seeded, produces
 * TIER-CROSSING artifacts — a 3.8 GPA matching a lone low Tier-1 band scoring below a 3.5 that
 * falls through to the higher Tier-2 overall rate. That reasoning was never re-measured after the
 * gate's seed sequence changed. Reproducing this job's DB exactly (migrate deploy → db seed →
 * closure overlay → EA/ED2 backfill → the five correction seeds) on 2026-07-25 gave 241 schools,
 * 9,342 checks and 0 violations, all 16 invariants green. The artifact requires PARTIAL band
 * coverage, and that DB seeds ZERO `SchoolCdsAdmitBand` rows — there is no Tier-1 to cross into.
 *
 * Turning it on then exposed the real cause of the artifact the exclusion had been blaming on
 * the gate. Loading the band payload made the sweep red — 6 violations, all University of
 * California, Merced — because `prisma/seeds/data/cds-admit-bands.json` was merging a starter
 * FIXTURE alongside the real UC Information Center extract. The fixture gave Merced only a
 * `3.75-4.00` rung, so a 4.0 applicant matched it and anchored at 0.88 while a 3.5 matched
 * nothing, fell through to Tier-2 and anchored on the school's overall rate of ~0.89 — the
 * stronger applicant scoring lower. `isotonicBandRate` could not repair it: it clamps against
 * LOWER rungs in the same ladder and there were none.
 *
 * migrate.sh step 54 loaded that same payload, so prod was serving two UC campuses Tier-1
 * anchors derived from test data. Fixture removed from the payload builder 2026-07-25; the
 * sweep is green again WITH bands loaded, and the CI job now seeds them.
 *
 * The lesson worth keeping: the exclusion note blamed the gate's data for years, and the
 * artifact was in the payload prod ships. An excluded check cannot tell you which.
 * See docs/PREDICTION_INVARIANT_DEEPDIVE_2026-06-01.md.
 */

import { NestFactory } from '@nestjs/core';
import { CounselorEngineModule } from '../src/modules/prediction/counselor/counselor-engine.module';
import { CounselorEngineService } from '../src/modules/prediction/counselor/counselor-engine.service';
import { PrismaService } from '../src/prisma/prisma.service';

const EPS = 1e-6;
const PORTFOLIO = new Set(['ART_DESIGN', 'MUSIC_CONSERVATORY']);
const num = (v: unknown): number | undefined =>
  v == null ? undefined : Number(v);

// Optional --limit N for fast local runs (default: full population).
const limitArg = process.argv.indexOf('--limit');
const LIMIT =
  limitArg >= 0 ? Number(process.argv[limitArg + 1]) : Number.POSITIVE_INFINITY;

type SchoolRow = Record<string, unknown>;
const toInput = (s: SchoolRow) => ({
  id: s.id,
  name: s.name,
  acceptanceRate: num(s.acceptanceRate),
  sat25: s.sat25,
  sat75: s.sat75,
  act25: s.act25,
  act75: s.act75,
  isPrivate: s.isPrivate,
  state: s.state,
  testingPolicy: s.testingPolicy,
  institutionType: s.institutionType,
  oosAcceptanceRate: num(s.oosAcceptanceRate),
  inStateAcceptanceRate: num(s.inStateAcceptanceRate),
  intlAcceptanceRate: num(s.intlAcceptanceRate),
  gpaDistribution: s.gpaDistribution,
});

const mkProfile = (over: Record<string, unknown> = {}) =>
  ({
    gpa: 3.8,
    gpaScale: 4,
    testScores: [{ type: 'SAT', score: 1400 }],
    activities: [],
    awards: [],
    highSchoolLocation: 'NY',
    stateOfResidence: 'NY',
    isInternational: false,
    nationality: 'US',
    ...over,
  }) as never;

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(
    CounselorEngineModule,
    {
      logger: ['error'],
    },
  );
  const eng = app.get(CounselorEngineService);
  const prisma = app.get(PrismaService);

  const run = async (
    profile: unknown,
    school: unknown,
    round = 'RD',
  ): Promise<number> =>
    (await eng.compute(profile as never, school as never, round as never))
      .probability;

  const allRows: SchoolRow[] = await prisma.school.findMany({
    where: { country: 'US', acceptanceRate: { not: null } },
    orderBy: { usNewsRank: 'asc' },
  });
  const all = allRows.map(toInput).filter((_, i) => i < LIMIT);
  // Statistically-predictable schools (portfolio/audition schools are exempt from range —
  // they intentionally return insufficient-data because academic stats can't predict them).
  const stat = all.filter(
    (s) => !PORTFOLIO.has(String(s.institutionType ?? '')),
  );
  const withSat = stat.filter(
    (s) => s.sat25 && s.sat75 && (s.sat75 as number) > (s.sat25 as number),
  );

  const violations: Record<string, string[]> = {};
  let checks = 0;
  const ck = (inv: string, ok: boolean, detail: () => string) => {
    checks++;
    if (!ok) (violations[inv] ??= []).push(detail());
  };

  // I1 — Range (excl. portfolio schools)
  for (const s of stat) {
    for (const [tag, p] of [
      [
        'strong',
        mkProfile({ gpa: 3.95, testScores: [{ type: 'SAT', score: 1550 }] }),
      ],
      [
        'weak',
        mkProfile({ gpa: 3.2, testScores: [{ type: 'SAT', score: 1120 }] }),
      ],
    ] as const) {
      const pr = await run(p, s);
      ck(
        '1 range (0,0.98]',
        Number.isFinite(pr) && pr > 0 && pr <= 0.9801,
        () => `${String(s.name)} [${tag}] => ${pr}`,
      );
    }
  }

  // I2 — GPA-monotonic; I3 — test-monotonic; I4 — dominance (need SAT bands)
  for (const s of withSat) {
    const s25 = s.sat25 as number;
    const s75 = s.sat75 as number;
    const mid = Math.round(s25 + (s75 - s25) * 0.5);
    let prev = -1;
    for (let g = 3.0; g <= 4.001; g += 0.1) {
      const pr = await run(
        mkProfile({
          gpa: +g.toFixed(2),
          testScores: [{ type: 'SAT', score: mid }],
        }),
        s,
      );
      ck(
        '2 GPA-monotonic',
        pr >= prev - EPS,
        () =>
          `${String(s.name)}: gpa ${g.toFixed(2)} => ${pr.toFixed(4)} < prev ${prev.toFixed(4)}`,
      );
      prev = Math.max(prev, pr);
    }
    prev = -1;
    for (let sat = s25 - 80; sat <= s75 + 80; sat += 30) {
      const pr = await run(
        mkProfile({
          gpa: 3.7,
          testScores: [
            { type: 'SAT', score: Math.max(800, Math.min(1600, sat)) },
          ],
        }),
        s,
      );
      ck(
        '3 test-monotonic',
        pr >= prev - EPS,
        () =>
          `${String(s.name)}: sat ${sat} => ${pr.toFixed(4)} < prev ${prev.toFixed(4)}`,
      );
      prev = Math.max(prev, pr);
    }
    const lo = Math.max(800, s25 - 60);
    const hi = Math.min(1600, s75 + 40);
    const pa = await run(
      mkProfile({ gpa: 3.9, testScores: [{ type: 'SAT', score: hi }] }),
      s,
    );
    const pb = await run(
      mkProfile({ gpa: 3.5, testScores: [{ type: 'SAT', score: lo }] }),
      s,
    );
    ck(
      '4 dominance',
      pa >= pb - EPS,
      () =>
        `${String(s.name)}: (3.9/${hi})=${pa.toFixed(4)} < (3.5/${lo})=${pb.toFixed(4)}`,
    );
  }

  // I5-I11 — round, hooks, compliance-neutral, determinism (all schools)
  for (const s of stat) {
    const top = (s.sat75 as number) ?? 1400;
    const p = mkProfile({
      gpa: 3.8,
      testScores: [{ type: 'SAT', score: top }],
    });
    const [rd, ed, ea] = await Promise.all([
      run(p, s, 'RD'),
      run(p, s, 'ED'),
      run(p, s, 'EA'),
    ]);
    ck(
      '5 round ED>=RD',
      ed >= rd - EPS,
      () => `${String(s.name)}: ED ${ed.toFixed(4)} < RD ${rd.toFixed(4)}`,
    );
    ck(
      '6 round EA>=RD',
      ea >= rd - EPS,
      () => `${String(s.name)}: EA ${ea.toFixed(4)} < RD ${rd.toFixed(4)}`,
    );

    const base = mkProfile({
      gpa: 3.7,
      testScores: [{ type: 'SAT', score: 1350 }],
    });
    const b = await run(base, s);
    const fg = await run({ ...(base as object), isFirstGen: true }, s);
    const ath = await run({ ...(base as object), recruitedAthlete: true }, s);
    const urm = await run({ ...(base as object), urmStatus: 'BLACK' }, s);
    const leg = await run(
      { ...(base as object), isLegacy: true, legacySchools: [s.name] },
      s,
    );
    ck(
      '7 first-gen>=base',
      fg >= b - EPS,
      () => `${String(s.name)}: fg ${fg.toFixed(4)} < base ${b.toFixed(4)}`,
    );
    ck(
      '8 athlete>=base',
      ath >= b - EPS,
      () => `${String(s.name)}: ath ${ath.toFixed(4)} < base ${b.toFixed(4)}`,
    );
    ck(
      '9 URM-neutral',
      Math.abs(urm - b) <= EPS,
      () => `${String(s.name)}: urm ${urm.toFixed(6)} != base ${b.toFixed(6)}`,
    );
    ck(
      '10 legacy-neutral',
      Math.abs(leg - b) <= EPS,
      () =>
        `${String(s.name)}: legacy ${leg.toFixed(6)} != base ${b.toFixed(6)}`,
    );

    const dp = mkProfile({
      gpa: 3.81,
      testScores: [{ type: 'SAT', score: 1410 }],
      isFirstGen: true,
    });
    const [d1, d2] = await Promise.all([run(dp, s, 'ED'), run(dp, s, 'ED')]);
    ck('11 determinism', d1 === d2, () => `${String(s.name)}: ${d1} != ${d2}`);

    // I12 — anchored clamp exactness: a predictable result stays within
    // [anchor×0.1, min(0.98, anchor×2.5)] (no modifier stack escapes the clamp).
    const baseRes = await eng.compute(base as never, s as never, 'RD' as never);
    if (baseRes.tier !== 4 && baseRes.anchor > 0) {
      const loB = baseRes.anchor * 0.1 - EPS;
      const hiB = Math.min(0.98, baseRes.anchor * 2.5) + EPS;
      ck(
        '12 clamp-bounds',
        baseRes.probability >= loB && baseRes.probability <= hiB,
        () =>
          `${String(s.name)}: ${baseRes.probability.toFixed(4)} outside [${loB.toFixed(4)}, ${hiB.toFixed(4)}] (anchor ${baseRes.anchor.toFixed(3)})`,
      );
    }

    // I13 — hook-combo monotonicity: stacking hooks never scores below either alone.
    const fgAth = await run(
      { ...(base as object), isFirstGen: true, recruitedAthlete: true },
      s,
    );
    ck(
      '13 hooks-combine',
      fgAth >= fg - EPS && fgAth >= ath - EPS,
      () =>
        `${String(s.name)}: fg+ath ${fgAth.toFixed(4)} < fg ${fg.toFixed(4)} / ath ${ath.toFixed(4)}`,
    );

    // I14 — ECs/awards never hurt: a strong-activity profile >= the bare profile.
    const withEcs = await run(
      {
        ...(base as object),
        activities: [
          {
            name: 'Research',
            category: 'RESEARCH',
            role: 'Lead Researcher',
            hoursPerWeek: 10,
            weeksPerYear: 40,
            yearsActive: 3,
            tier: 1,
          },
        ],
        awards: [{ name: 'National Award', level: 'NATIONAL', year: 2025 }],
      },
      s,
    );
    ck(
      '14 ECs-never-hurt',
      withEcs >= b - EPS,
      () =>
        `${String(s.name)}: with-ECs ${withEcs.toFixed(4)} < bare ${b.toFixed(4)}`,
    );
  }

  // I15 — test-optional never beats submitting a STRONG (above-75th) test.
  for (const s of withSat) {
    const strong = Math.min(1600, (s.sat75 as number) + 30);
    const submit = await run(
      mkProfile({ gpa: 3.7, testScores: [{ type: 'SAT', score: strong }] }),
      s,
    );
    const toHide = await run(
      mkProfile({ gpa: 3.7, testScores: [], applyingTestOptional: true }),
      s,
    );
    ck(
      '15 submit-strong>=TO',
      submit >= toHide - EPS,
      () =>
        `${String(s.name)}: submit-strong ${submit.toFixed(4)} < test-optional ${toHide.toFixed(4)}`,
    );
  }

  // I16 — GPA-monotonic ALSO holds for international applicants (profile diversity).
  for (const s of withSat) {
    const s25 = s.sat25 as number;
    const s75 = s.sat75 as number;
    const mid = Math.round(s25 + (s75 - s25) * 0.5);
    let prev = -1;
    for (let g = 3.0; g <= 4.001; g += 0.2) {
      const pr = await run(
        mkProfile({
          gpa: +g.toFixed(2),
          testScores: [{ type: 'SAT', score: mid }],
          isInternational: true,
          nationality: 'CN',
          highSchoolLocation: 'CN',
          stateOfResidence: undefined,
        }),
        s,
      );
      ck(
        '16 GPA-monotonic (intl)',
        pr >= prev - EPS,
        () =>
          `${String(s.name)} [intl]: gpa ${g.toFixed(2)} => ${pr.toFixed(4)} < prev ${prev.toFixed(4)}`,
      );
      prev = Math.max(prev, pr);
    }
  }

  // ---- Report ----
  const invNames = [
    '1 range (0,0.98]',
    '2 GPA-monotonic',
    '3 test-monotonic',
    '4 dominance',
    '5 round ED>=RD',
    '6 round EA>=RD',
    '7 first-gen>=base',
    '8 athlete>=base',
    '9 URM-neutral',
    '10 legacy-neutral',
    '11 determinism',
    '12 clamp-bounds',
    '13 hooks-combine',
    '14 ECs-never-hurt',
    '15 submit-strong>=TO',
    '16 GPA-monotonic (intl)',
  ];
  console.log(`\n═══ Counselor Invariant Sweep ═══`);
  console.log(
    `Population: ${all.length} US schools (${all.length - stat.length} portfolio exempt from range) | ${withSat.length} w/ SAT bands\n`,
  );
  let total = 0;
  for (const inv of invNames) {
    const f = violations[inv] ?? [];
    total += f.length;
    console.log(
      `${f.length === 0 ? '✅' : '❌'} ${inv.padEnd(20)} ${f.length === 0 ? 'PASS' : `${f.length} VIOLATION(S)`}`,
    );
    f.slice(0, 5).forEach((m) => console.log(`     · ${m}`));
    if (f.length > 5) console.log(`     · …and ${f.length - 5} more`);
  }
  console.log(
    `\nTotal checks: ${checks.toLocaleString()} | Violations: ${total}\n`,
  );

  await app.close();
  process.exit(total === 0 ? 0 : 2);
}

main().catch((err) => {
  console.error('❌ Invariant sweep crashed:', err);
  process.exit(1);
});
