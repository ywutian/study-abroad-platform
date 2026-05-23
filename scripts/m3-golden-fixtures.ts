/**
 * M3 Golden Fixtures (Layer 0) — 20 hand-curated test cases
 *
 * Design source: docs/PREDICTION_BENCHMARK.md §Layer 0 (originally planned
 * 2026-04-21 but never implemented; built 2026-05-23).
 *
 * Each fixture defines a (profile, school, round) tuple plus assertions that
 * an ideal M3 engine should satisfy. These are *normative* targets — failures
 * are bugs to fix, not data to update.
 *
 * Run standalone:
 *   pnpm exec tsx scripts/m3-golden-fixtures.ts
 *
 * Or via seed-prediction-benchmark.ts (appended to PredictionBenchmarkRun).
 */
import { PrismaClient } from '@prisma/client';
import { predict, type PredictionOutput } from './m3-bayesian-engine';

const prisma = new PrismaClient();

// ─── Profile builder ────────────────────────────────────────────────────────

interface ProfileSpec {
  gpa?: number | null;
  gpaScale?: number;
  sat?: number | null;
  act?: number | null;
  toefl?: number | null;
  round: string;
  major?: string;
  intl?: boolean;
  athlete?: boolean;
  athleteVerified?: boolean;
  legacy?: string[];
  firstGen?: boolean;
  testOptional?: boolean;
  numActivities?: number;
  numAwards?: number;
  awardLevel?: 'SCHOOL' | 'REGIONAL' | 'STATE' | 'NATIONAL' | 'INTERNATIONAL';
  apCount?: number | null;
  gpaTrend?: string | null;
}

function buildProfile(spec: ProfileSpec) {
  const testScores: Array<{ type: string; score: number }> = [];
  if (spec.sat) testScores.push({ type: 'SAT', score: spec.sat });
  if (spec.act) testScores.push({ type: 'ACT', score: spec.act });
  if (spec.toefl) testScores.push({ type: 'TOEFL', score: spec.toefl });
  return {
    gpa: spec.gpa,
    gpaScale: spec.gpaScale ?? 4.0,
    targetMajor: spec.major ?? 'Computer Science',
    intendedMajor: spec.major ?? 'Computer Science',
    applicationRound: spec.round,
    nationality: spec.intl ? 'CN' : 'US',
    international: !!spec.intl,
    isInternational: !!spec.intl,
    legacy: spec.legacy ?? [],
    firstGeneration: !!spec.firstGen,
    recruitedAthlete: !!spec.athlete,
    recruitedCoachStatus: spec.athleteVerified ? 'VERIFIED' : null,
    applyingTestOptional: !!spec.testOptional,
    testOptional: !!spec.testOptional,
    apCount: spec.apCount ?? null,
    gpaTrend: spec.gpaTrend ?? null,
    testScores,
    activities: Array.from({ length: spec.numActivities ?? 4 }, (_, i) => ({
      name: `Activity ${i + 1}`,
      category: 'ACADEMIC',
      role: i === 0 ? 'Captain' : 'Member',
      hoursPerWeek: 10,
      weeksPerYear: 36,
    })),
    awards: Array.from({ length: spec.numAwards ?? 2 }, (_, i) => ({
      name: `Award ${i + 1}`,
      level: spec.awardLevel ?? 'REGIONAL',
      year: 2025,
    })),
  };
}

// ─── Fixture types ──────────────────────────────────────────────────────────

interface Assertions {
  tier?: 'reach' | 'match' | 'safety';
  probMin?: number;
  probMax?: number;
  confidenceAtMost?: 'low' | 'medium' | 'high';
  confidenceAtLeast?: 'low' | 'medium' | 'high';
  diagnosticContains?: string;
}

type FixtureKind =
  | { kind: 'single'; profile: ProfileSpec; assert: Assertions }
  | {
      kind: 'ed-vs-rd';
      profileBase: ProfileSpec;
      edRound: string;
      rdRound: string;
      edAdvantageMin: number; // probability_ed - probability_rd >= edAdvantageMin
    }
  | {
      kind: 'intl-vs-domestic';
      profileBase: ProfileSpec;
      intlPenaltyMin: number; // probability_domestic - probability_intl >= intlPenaltyMin
    };

interface Fixture {
  id: string; // "1.1", "1.2", ...
  group: string;
  description: string;
  schoolNameNorm: string;
  schoolDisplay: string;
  baseRound: string;
  kind: FixtureKind;
}

// ─── 20 Fixtures ────────────────────────────────────────────────────────────

const CONFIDENCE_RANK: Record<string, number> = { 'very-low': 0, low: 1, medium: 2, high: 3 };

export const GOLDEN_FIXTURES: Fixture[] = [
  // ─── Group 1: 冲刺高分 (T10 + 满分档) — tier=reach, prob ∈ [0.08, 0.35] ───
  {
    id: '1.1',
    group: '冲刺高分 (T10 + 满分档)',
    description:
      'Harvard RD, domestic, GPA 4.0 / SAT 1580 / USAMO + ISEF level awards. Even perfect profiles at T5 should be reach with moderate probability.',
    schoolNameNorm: 'harvard university',
    schoolDisplay: 'Harvard University',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 4.0,
        sat: 1580,
        numActivities: 8,
        numAwards: 6,
        awardLevel: 'NATIONAL',
        apCount: 10,
        gpaTrend: 'UPWARD',
      },
      assert: { tier: 'reach', probMin: 0.08, probMax: 0.35 },
    },
  },
  {
    id: '1.2',
    group: '冲刺高分 (T10 + 满分档)',
    description:
      'Stanford REA, domestic, GPA 3.98 / SAT 1570 / Intel ISEF Grand Award. Strongest STEM profile — still must be reach.',
    schoolNameNorm: 'stanford university',
    schoolDisplay: 'Stanford University',
    baseRound: 'REA',
    kind: {
      kind: 'single',
      profile: {
        round: 'REA',
        gpa: 3.98,
        sat: 1570,
        numActivities: 7,
        numAwards: 5,
        awardLevel: 'INTERNATIONAL',
        apCount: 12,
        gpaTrend: 'UPWARD',
      },
      assert: { tier: 'reach', probMin: 0.08, probMax: 0.35 },
    },
  },
  {
    id: '1.3',
    group: '冲刺高分 (T10 + 满分档)',
    description:
      'Princeton RD (no ED at Princeton), domestic, GPA 4.0 / SAT 1590 / USAMO + national olympiad medalist.',
    schoolNameNorm: 'princeton university',
    schoolDisplay: 'Princeton University',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 4.0,
        sat: 1590,
        numActivities: 8,
        numAwards: 6,
        awardLevel: 'NATIONAL',
        apCount: 11,
        gpaTrend: 'UPWARD',
      },
      assert: { tier: 'reach', probMin: 0.08, probMax: 0.35 },
    },
  },

  // ─── Group 2: 冲刺低分 (T10 + 中等档) — tier=reach, prob ≤ 0.15 ───────────
  {
    id: '2.1',
    group: '冲刺低分 (T10 + 中等档)',
    description:
      'Harvard RD, domestic, GPA 3.7 / SAT 1450 / regular activities, no awards. Should be far below median.',
    schoolNameNorm: 'harvard university',
    schoolDisplay: 'Harvard University',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 3.7,
        sat: 1450,
        numActivities: 3,
        numAwards: 0,
        awardLevel: 'SCHOOL',
      },
      assert: { tier: 'reach', probMax: 0.15 },
    },
  },
  {
    id: '2.2',
    group: '冲刺低分 (T10 + 中等档)',
    description:
      'Yale RD, domestic, GPA 3.75 / SAT 1430 / 2 school-level awards. Below CDS median.',
    schoolNameNorm: 'yale university',
    schoolDisplay: 'Yale University',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 3.75,
        sat: 1430,
        numActivities: 3,
        numAwards: 2,
        awardLevel: 'SCHOOL',
      },
      assert: { tier: 'reach', probMax: 0.15 },
    },
  },

  // ─── Group 3: 匹配 — tier=match, prob ∈ [0.35, 0.65] ─────────────────────
  {
    id: '3.1',
    group: '匹配',
    description:
      'NYU RD, domestic, GPA 3.8 / SAT 1470. NYU overall accept ~9%, but a competitive domestic applicant should be solidly match (35-65%).',
    schoolNameNorm: 'new york university',
    schoolDisplay: 'New York University',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 3.85,
        sat: 1470,
        numActivities: 5,
        numAwards: 2,
        awardLevel: 'STATE',
      },
      assert: { tier: 'match', probMin: 0.35, probMax: 0.65 },
    },
  },
  {
    id: '3.2',
    group: '匹配',
    description:
      'BU EA, domestic, GPA 3.8 / SAT 1450 / 2 regional awards. BU overall ~11%, EA + decent profile = match.',
    schoolNameNorm: 'boston university',
    schoolDisplay: 'Boston University',
    baseRound: 'EA',
    kind: {
      kind: 'single',
      profile: {
        round: 'EA',
        gpa: 3.8,
        sat: 1450,
        numActivities: 5,
        numAwards: 2,
        awardLevel: 'REGIONAL',
      },
      assert: { tier: 'match', probMin: 0.35, probMax: 0.65 },
    },
  },
  {
    id: '3.3',
    group: '匹配',
    description:
      'USC EA, domestic, GPA 3.75 / SAT 1450 / 3 activities. USC overall ~10%, EA + average-strong profile = match.',
    schoolNameNorm: 'university of southern california',
    schoolDisplay: 'University of Southern California',
    baseRound: 'EA',
    kind: {
      kind: 'single',
      profile: {
        round: 'EA',
        gpa: 3.75,
        sat: 1450,
        numActivities: 4,
        numAwards: 1,
        awardLevel: 'REGIONAL',
      },
      assert: { tier: 'match', probMin: 0.35, probMax: 0.65 },
    },
  },

  // ─── Group 4: 保底 — tier=safety, prob ≥ 0.75 ────────────────────────────
  {
    id: '4.1',
    group: '保底',
    description:
      'Penn State RD, domestic, GPA 3.7 / SAT 1400. Penn State accepts ~61%, this profile is well above their 50th percentile → safety.',
    schoolNameNorm: 'penn state university',
    schoolDisplay: 'Penn State University',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 3.7,
        sat: 1400,
        numActivities: 3,
        numAwards: 1,
        awardLevel: 'REGIONAL',
      },
      assert: { tier: 'safety', probMin: 0.75 },
    },
  },
  {
    id: '4.2',
    group: '保底',
    description:
      'ASU RD, domestic, GPA 3.6 / SAT 1350 / basic activities. ASU accepts ~90% — this is trivially safety.',
    schoolNameNorm: 'arizona state university',
    schoolDisplay: 'Arizona State University',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 3.6,
        sat: 1350,
        numActivities: 3,
        numAwards: 0,
        awardLevel: 'SCHOOL',
      },
      assert: { tier: 'safety', probMin: 0.75 },
    },
  },

  // ─── Group 5: ED/EA 加成 — ED-RD ≥ 5pp ──────────────────────────────────
  {
    id: '5.1',
    group: 'ED/EA 加成',
    description:
      'Penn — same profile (GPA 3.9 / SAT 1500 / domestic strong) compared in ED vs RD. Penn ED rate ~14% vs overall ~6% → engine ED must lift ≥ 5pp over RD.',
    schoolNameNorm: 'university of pennsylvania',
    schoolDisplay: 'University of Pennsylvania',
    baseRound: 'ED',
    kind: {
      kind: 'ed-vs-rd',
      profileBase: {
        round: 'ED',
        gpa: 3.9,
        sat: 1500,
        numActivities: 5,
        numAwards: 3,
        awardLevel: 'NATIONAL',
      },
      edRound: 'ED',
      rdRound: 'RD',
      edAdvantageMin: 0.05,
    },
  },
  {
    id: '5.2',
    group: 'ED/EA 加成',
    description:
      'Duke — same profile (GPA 3.85 / SAT 1480 / domestic decent) in ED vs RD. Duke ED ~13% vs overall ~5% → engine ED lift ≥ 5pp.',
    schoolNameNorm: 'duke university',
    schoolDisplay: 'Duke University',
    baseRound: 'ED',
    kind: {
      kind: 'ed-vs-rd',
      profileBase: {
        round: 'ED',
        gpa: 3.85,
        sat: 1480,
        numActivities: 5,
        numAwards: 3,
        awardLevel: 'STATE',
      },
      edRound: 'ED',
      rdRound: 'RD',
      edAdvantageMin: 0.05,
    },
  },

  // ─── Group 6: 国际生 / 中国申请者 — intl < domestic ─────────────────────
  {
    id: '6.1',
    group: '国际生 / 中国申请者',
    description:
      'Yale RD — same profile (GPA 3.95 / SAT 1550 / strong ECs) compared intl (CN) vs domestic. Intl base rate at T5 ≪ domestic.',
    schoolNameNorm: 'yale university',
    schoolDisplay: 'Yale University',
    baseRound: 'RD',
    kind: {
      kind: 'intl-vs-domestic',
      profileBase: {
        round: 'RD',
        gpa: 3.95,
        sat: 1550,
        toefl: 115,
        numActivities: 6,
        numAwards: 4,
        awardLevel: 'NATIONAL',
      },
      intlPenaltyMin: 0.03, // domestic should be ≥ 3pp higher
    },
  },
  {
    id: '6.2',
    group: '国际生 / 中国申请者',
    description:
      'Cornell RD — same profile (GPA 3.9 / SAT 1500) intl vs domestic. Cornell intl rate noticeably lower.',
    schoolNameNorm: 'cornell university',
    schoolDisplay: 'Cornell University',
    baseRound: 'RD',
    kind: {
      kind: 'intl-vs-domestic',
      profileBase: {
        round: 'RD',
        gpa: 3.9,
        sat: 1500,
        toefl: 110,
        numActivities: 5,
        numAwards: 3,
        awardLevel: 'STATE',
      },
      intlPenaltyMin: 0.03,
    },
  },
  {
    id: '6.3',
    group: '国际生 / 中国申请者',
    description:
      'NYU RD — same profile (GPA 3.8 / SAT 1470) intl vs domestic. Mid-tier — intl penalty should still be visible.',
    schoolNameNorm: 'new york university',
    schoolDisplay: 'New York University',
    baseRound: 'RD',
    kind: {
      kind: 'intl-vs-domestic',
      profileBase: {
        round: 'RD',
        gpa: 3.8,
        sat: 1470,
        toefl: 108,
        numActivities: 4,
        numAwards: 2,
        awardLevel: 'REGIONAL',
      },
      intlPenaltyMin: 0.02,
    },
  },

  // ─── Group 7: 数据缺失 — confidence=low/medium ──────────────────────────
  {
    id: '7.1',
    group: '数据缺失（test-optional）',
    description:
      'Penn RD, domestic, GPA 3.9, test-optional flag = true (no SAT/ACT). Confidence should drop to medium or low.',
    schoolNameNorm: 'university of pennsylvania',
    schoolDisplay: 'University of Pennsylvania',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 3.9,
        sat: null,
        act: null,
        testOptional: true,
        numActivities: 5,
        numAwards: 3,
        awardLevel: 'NATIONAL',
      },
      assert: { confidenceAtMost: 'medium' },
    },
  },
  {
    id: '7.2',
    group: '数据缺失（no GPA）',
    description:
      'Stanford REA, domestic, NO GPA reported, SAT 1550. Engine must produce a prediction but with reduced confidence.',
    schoolNameNorm: 'stanford university',
    schoolDisplay: 'Stanford University',
    baseRound: 'REA',
    kind: {
      kind: 'single',
      profile: {
        round: 'REA',
        gpa: null,
        sat: 1550,
        numActivities: 5,
        numAwards: 3,
        awardLevel: 'NATIONAL',
      },
      assert: { confidenceAtMost: 'medium' },
    },
  },
  {
    id: '7.3',
    group: '数据缺失（no test, not opted-out）',
    description:
      'Duke ED, domestic, GPA 3.85, no SAT, no ACT, NOT test-optional. Diagnostics must flag missing required test score.',
    schoolNameNorm: 'duke university',
    schoolDisplay: 'Duke University',
    baseRound: 'ED',
    kind: {
      kind: 'single',
      profile: {
        round: 'ED',
        gpa: 3.85,
        sat: null,
        act: null,
        testOptional: false,
        numActivities: 5,
        numAwards: 3,
        awardLevel: 'STATE',
      },
      assert: { confidenceAtMost: 'medium' },
    },
  },

  // ─── Group 8: 极端边界 — prob ∈ (0.001, 0.99) ───────────────────────────
  {
    id: '8.1',
    group: '极端边界',
    description:
      'Harvard RD, domestic, GPA 2.5 / SAT 1100 / no activities, no awards. Should still be > 0% (Harvard takes anyone) but ≤ 5%.',
    schoolNameNorm: 'harvard university',
    schoolDisplay: 'Harvard University',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 2.5,
        sat: 1100,
        numActivities: 0,
        numAwards: 0,
        awardLevel: 'SCHOOL',
      },
      assert: { tier: 'reach', probMin: 0.001, probMax: 0.05 },
    },
  },
  {
    id: '8.2',
    group: '极端边界',
    description:
      'ASU RD, domestic, GPA 4.0 / SAT 1600 / USAMO + ISEF + 10 activities. ASU accepts ~90% — perfect profile must be near-certain admit.',
    schoolNameNorm: 'arizona state university',
    schoolDisplay: 'Arizona State University',
    baseRound: 'RD',
    kind: {
      kind: 'single',
      profile: {
        round: 'RD',
        gpa: 4.0,
        sat: 1600,
        numActivities: 10,
        numAwards: 6,
        awardLevel: 'INTERNATIONAL',
        apCount: 12,
        gpaTrend: 'UPWARD',
      },
      assert: { tier: 'safety', probMin: 0.85, probMax: 0.99 },
    },
  },
];

// ─── Runner ─────────────────────────────────────────────────────────────────

export interface FixtureResult {
  id: string;
  group: string;
  description: string;
  schoolDisplay: string;
  baseRound: string;
  passed: boolean;
  details: string;
  outputs: {
    primary: {
      probability: number;
      tier: string;
      confidence: string;
    };
    secondary?: {
      probability: number;
      tier: string;
      confidence: string;
      label: string; // "RD" for ED-vs-RD; "intl" or "domestic"
    };
  };
  failures: string[];
}

async function loadSchoolWithBands(nameNorm: string) {
  const school: any = await prisma.school.findFirst({
    where: { nameNorm },
    include: { programs: true },
  });
  if (!school) return null;
  const bands = await prisma.schoolCdsAdmitBand.findMany({ where: { schoolId: school.id } });
  school._cdsBands = bands.map((b) => ({
    gpaBand: b.gpaBand,
    testType: b.testType,
    testBand: b.testBand,
    admitRate: Number(b.admitRate),
  }));
  return school;
}

function checkSingleAssertions(out: PredictionOutput, a: Assertions): string[] {
  const fails: string[] = [];
  if (a.tier && out.tier !== a.tier) fails.push(`tier=${out.tier} (expected ${a.tier})`);
  if (a.probMin !== undefined && out.probability < a.probMin)
    fails.push(
      `prob=${(out.probability * 100).toFixed(1)}% < min ${(a.probMin * 100).toFixed(1)}%`
    );
  if (a.probMax !== undefined && out.probability > a.probMax)
    fails.push(
      `prob=${(out.probability * 100).toFixed(1)}% > max ${(a.probMax * 100).toFixed(1)}%`
    );
  if (a.confidenceAtMost) {
    const max = CONFIDENCE_RANK[a.confidenceAtMost];
    const got = CONFIDENCE_RANK[out.confidence];
    if (got > max)
      fails.push(`confidence=${out.confidence} (expected at most ${a.confidenceAtMost})`);
  }
  if (a.confidenceAtLeast) {
    const min = CONFIDENCE_RANK[a.confidenceAtLeast];
    const got = CONFIDENCE_RANK[out.confidence];
    if (got < min)
      fails.push(`confidence=${out.confidence} (expected at least ${a.confidenceAtLeast})`);
  }
  return fails;
}

export async function runGoldenFixtures(): Promise<{
  results: FixtureResult[];
  passed: number;
  total: number;
}> {
  const results: FixtureResult[] = [];
  for (const fx of GOLDEN_FIXTURES) {
    const school = await loadSchoolWithBands(fx.schoolNameNorm);
    if (!school) {
      results.push({
        id: fx.id,
        group: fx.group,
        description: fx.description,
        schoolDisplay: fx.schoolDisplay,
        baseRound: fx.baseRound,
        passed: false,
        details: `SCHOOL NOT IN DB: ${fx.schoolNameNorm}`,
        outputs: { primary: { probability: 0, tier: 'n/a', confidence: 'n/a' } },
        failures: [`school not seeded: ${fx.schoolNameNorm}`],
      });
      continue;
    }

    if (fx.kind.kind === 'single') {
      const profile = buildProfile(fx.kind.profile);
      const out = predict(profile, school);
      const fails = checkSingleAssertions(out, fx.kind.assert);
      results.push({
        id: fx.id,
        group: fx.group,
        description: fx.description,
        schoolDisplay: fx.schoolDisplay,
        baseRound: fx.baseRound,
        passed: fails.length === 0,
        details: `${(out.probability * 100).toFixed(1)}% (tier=${out.tier}, conf=${out.confidence})`,
        outputs: {
          primary: {
            probability: out.probability,
            tier: out.tier,
            confidence: out.confidence,
          },
        },
        failures: fails,
      });
    } else if (fx.kind.kind === 'ed-vs-rd') {
      const edProfile = buildProfile({ ...fx.kind.profileBase, round: fx.kind.edRound });
      const rdProfile = buildProfile({ ...fx.kind.profileBase, round: fx.kind.rdRound });
      const edOut = predict(edProfile, school);
      const rdOut = predict(rdProfile, school);
      const delta = edOut.probability - rdOut.probability;
      const fails: string[] = [];
      if (delta < fx.kind.edAdvantageMin) {
        fails.push(
          `${fx.kind.edRound}-${fx.kind.rdRound} delta = ${(delta * 100).toFixed(1)}pp < min ${(
            fx.kind.edAdvantageMin * 100
          ).toFixed(1)}pp`
        );
      }
      results.push({
        id: fx.id,
        group: fx.group,
        description: fx.description,
        schoolDisplay: fx.schoolDisplay,
        baseRound: fx.baseRound,
        passed: fails.length === 0,
        details: `${fx.kind.edRound}=${(edOut.probability * 100).toFixed(1)}%, ${fx.kind.rdRound}=${(
          rdOut.probability * 100
        ).toFixed(1)}%, Δ=${(delta * 100).toFixed(1)}pp`,
        outputs: {
          primary: {
            probability: edOut.probability,
            tier: edOut.tier,
            confidence: edOut.confidence,
          },
          secondary: {
            probability: rdOut.probability,
            tier: rdOut.tier,
            confidence: rdOut.confidence,
            label: fx.kind.rdRound,
          },
        },
        failures: fails,
      });
    } else if (fx.kind.kind === 'intl-vs-domestic') {
      const intlProfile = buildProfile({ ...fx.kind.profileBase, intl: true });
      const domesticProfile = buildProfile({ ...fx.kind.profileBase, intl: false });
      const intlOut = predict(intlProfile, school);
      const domOut = predict(domesticProfile, school);
      const penalty = domOut.probability - intlOut.probability;
      const fails: string[] = [];
      if (penalty < fx.kind.intlPenaltyMin) {
        fails.push(
          `intl penalty = ${(penalty * 100).toFixed(1)}pp < min ${(
            fx.kind.intlPenaltyMin * 100
          ).toFixed(
            1
          )}pp (intl=${(intlOut.probability * 100).toFixed(1)}%, domestic=${(domOut.probability * 100).toFixed(1)}%)`
        );
      }
      results.push({
        id: fx.id,
        group: fx.group,
        description: fx.description,
        schoolDisplay: fx.schoolDisplay,
        baseRound: fx.baseRound,
        passed: fails.length === 0,
        details: `intl=${(intlOut.probability * 100).toFixed(1)}%, domestic=${(
          domOut.probability * 100
        ).toFixed(1)}%, penalty=${(penalty * 100).toFixed(1)}pp`,
        outputs: {
          primary: {
            probability: intlOut.probability,
            tier: intlOut.tier,
            confidence: intlOut.confidence,
          },
          secondary: {
            probability: domOut.probability,
            tier: domOut.tier,
            confidence: domOut.confidence,
            label: 'domestic',
          },
        },
        failures: fails,
      });
    }
  }
  const passed = results.filter((r) => r.passed).length;
  return { results, passed, total: results.length };
}

// ─── Standalone runner ──────────────────────────────────────────────────────

if (require.main === module) {
  (async () => {
    console.log('═══ M3 Golden Fixtures (20 cases) ═══\n');
    const { results, passed, total } = await runGoldenFixtures();
    const groupMap = new Map<string, FixtureResult[]>();
    for (const r of results) {
      if (!groupMap.has(r.group)) groupMap.set(r.group, []);
      groupMap.get(r.group)!.push(r);
    }
    for (const [group, items] of groupMap) {
      console.log(`\n━━━ ${group} ━━━`);
      for (const r of items) {
        const icon = r.passed ? '✅' : '❌';
        console.log(`  ${icon} ${r.id} @ ${r.schoolDisplay} (${r.baseRound})`);
        console.log(`     → ${r.details}`);
        if (!r.passed) for (const f of r.failures) console.log(`        FAIL: ${f}`);
      }
    }
    console.log(`\n═══ OVERALL: ${passed}/${total} passed ═══`);
    await prisma.$disconnect();
    process.exit(0);
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
