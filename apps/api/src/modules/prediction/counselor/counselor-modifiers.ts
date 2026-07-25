/**
 * Counselor Engine — 11 bounded, published-coefficient modifiers
 *
 * Each modifier is a pure function `(profile, school, context?) → ModifierResult`
 * that returns:
 *   - `multiplier`: number in roughly [0.15, 4.0] applied to the school's anchor admit rate
 *   - `label`: short human-readable name (i18n keys handled by frontend, English fallback here)
 *   - `evidence`: one-sentence explanation (e.g. "Above 75th-percentile SAT")
 *
 * Why the values?
 * Each multiplier comes from published admissions consultancy literature (Arcidiacono
 * SFFA expert report for hooks, school CDS Section C9 for SAT bands, NACAC State
 * of College Admission for round/geo) — see comments. They are intentionally *not*
 * tuned to user data because we have 4 outcomes total. The whole point of counselor
 * mode is "rules-of-thumb that an admissions counselor would also use." Every
 * multiplier is defensible without data.
 *
 * Why pure functions instead of inheriting from teacher services?
 * Teachers return `{probability, active}` — the counselor needs explainable
 * `{multiplier, label, evidence}`. Different shape, different concern. The teacher
 * services stay alive (running in shadow) for future statistical comparison.
 *
 * No I/O — modifiers only read what callers pass in. Database lookups (CDS bands
 * anchor, SchoolProgram for major selectivity) happen in `counselor-engine.service.ts`
 * which then passes the resolved values into these functions.
 */

import type { ProfileInput, SchoolInput } from '../prediction.prompts';
import { classifyMajor } from '../prediction.constants';
import {
  calculateActivityScore,
  calculateAwardScore,
  calculateHsImpact,
  calculateSelectivityIndex,
  computeSpikeCoherence,
  LEVEL_POINTS,
  TIER_POINTS,
} from '@study-abroad/shared/scoring';

export interface ModifierResult {
  /** Multiplier applied to anchor. 1.0 = no effect. */
  multiplier: number;
  /** Short human-readable label (English; frontend may i18n). */
  label: string;
  /** One-sentence evidence string for the factors[] breakdown. */
  evidence: string;
  /** Direction for UI styling. */
  impact: 'positive' | 'negative' | 'neutral';
}

export interface ProfileSignalCoverage {
  usedInProbability: string[];
  usedInExplanation: string[];
  missingGaps: string[];
  ignoredByPolicy: string[];
}

export interface ProfileContextModifierResult extends ModifierResult {
  components: Record<string, ModifierResult>;
  profileSignals: ProfileSignalCoverage;
}

const NEUTRAL: ModifierResult = {
  multiplier: 1.0,
  label: 'No adjustment',
  evidence: 'No relevant data available for this dimension.',
  impact: 'neutral',
};

const PROFILE_CONTEXT_NEUTRAL: ProfileContextModifierResult = {
  multiplier: 1.0,
  label: 'Profile context',
  evidence: 'Profile context signals were missing or neutral.',
  impact: 'neutral',
  components: {},
  profileSignals: {
    usedInProbability: [],
    usedInExplanation: [],
    missingGaps: [],
    ignoredByPolicy: [
      'essays',
      'MBTI/Holland assessment',
      'budget preferences',
      'region preferences',
      'URM status',
      'unverified legacy/athlete hooks',
    ],
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isPlaceholderSatBand(sat25?: number | null, sat75?: number | null) {
  return sat25 === 1080 && sat75 === 1320;
}

function usableSatBand(school: SchoolInput): {
  sat25: number;
  sat75: number;
} | null {
  if (!school.sat25 || !school.sat75) return null;
  if (isPlaceholderSatBand(school.sat25, school.sat75)) return null;
  return { sat25: school.sat25, sat75: school.sat75 };
}

/**
 * Convert a 4.0-scale GPA to an "equivalent SAT" score for percentile comparison
 * against a school's SAT 25/50/75 distribution. Standard mapping used in admissions
 * consulting (Compass Education Group, College Vine), with finer resolution at the
 * top end where elite-school sat25 values cluster at 1510-1520:
 *   3.97+ → 1540  |  3.93 → 1520  |  3.88 → 1490  |  3.83 → 1460
 *   3.75  → 1420  |  3.65 → 1350  |  3.50 → 1300   |  3.25 → 1230
 *   3.00  → 1150  |  <3.0 → 1050
 *
 * The top-end steps were coarsened in the original table (50-point jumps at 3.85/3.95)
 * which placed GPA 3.90 at 1450 — below MIT/Harvard sat25 of 1510-1520 and triggering
 * an unwarranted ×0.50 penalty for a genuinely competitive applicant.
 *
 * Returns null if GPA is missing or unparseable.
 */
export function gpaToEquivalentSat(
  gpa: number | undefined,
  gpaScale: number | undefined,
): number | null {
  if (gpa == null || !Number.isFinite(gpa)) return null;
  // Normalize to 4.0 scale, clamped to the physical [0, 4.0] domain so an
  // overflow input (e.g. gpa 4.5 on a 4.0 scale, or a weighted GPA mis-tagged
  // with the wrong scale) can't be rewarded above a perfect 4.0.
  const scale = gpaScale && gpaScale > 0 ? gpaScale : 4.0;
  const gpa4 = clamp((gpa / scale) * 4.0, 0, 4.0);
  if (gpa4 >= 3.97) return 1540;
  if (gpa4 >= 3.93) return 1520;
  if (gpa4 >= 3.88) return 1490;
  if (gpa4 >= 3.83) return 1460;
  if (gpa4 >= 3.75) return 1420;
  if (gpa4 >= 3.65) return 1350;
  if (gpa4 >= 3.5) return 1300;
  if (gpa4 >= 3.25) return 1230;
  if (gpa4 >= 3.0) return 1150;
  return 1050;
}

/**
 * Modifier #1: GPA-band relative to school SAT distribution.
 *
 * Why use SAT distribution instead of school's GPA distribution?
 * Schools rarely publish per-applicant GPA bands in CDS (Section C9 is sparse on
 * GPA), but SAT 25/75 is universally reported. Mapping GPA → equivalent SAT lets
 * us reuse the well-populated distribution for comparison.
 */
const GPA_DISTRIBUTION_BANDS = [
  { key: '<3.00', min: Number.NEGATIVE_INFINITY, maxExclusive: 3.0 },
  { key: '3.00-3.24', min: 3.0, maxExclusive: 3.25 },
  { key: '3.25-3.49', min: 3.25, maxExclusive: 3.5 },
  { key: '3.50-3.74', min: 3.5, maxExclusive: 3.75 },
  { key: '3.75-4.00', min: 3.75, maxExclusive: Number.POSITIVE_INFINITY },
] as const;

type GpaDistributionBandKey = (typeof GPA_DISTRIBUTION_BANDS)[number]['key'];

function readDistributionValue(
  distribution: Record<string, unknown>,
  key: GpaDistributionBandKey,
): number | null {
  const raw = distribution[key];
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

function normalizeGpaDistribution(
  distribution: Record<string, unknown>,
): Array<{ key: GpaDistributionBandKey; pct: number }> | null {
  const rawValues = GPA_DISTRIBUTION_BANDS.map((band) => ({
    key: band.key,
    value: readDistributionValue(distribution, band.key),
  }));
  if (rawValues.some((entry) => entry.value == null)) return null;

  const rawTotal = rawValues.reduce(
    (sum, entry) => sum + (entry.value ?? 0),
    0,
  );
  if (rawTotal <= 0) return null;

  const denominator = rawTotal > 2 ? 100 : 1;
  const normalized = rawValues.map((entry) => ({
    key: entry.key,
    pct: (entry.value ?? 0) / denominator,
  }));
  const total = normalized.reduce((sum, entry) => sum + entry.pct, 0);
  if (total < 0.95 || total > 1.05) return null;

  return normalized.map((entry) => ({
    key: entry.key,
    pct: entry.pct / total,
  }));
}

/**
 * Compute applicant's cumulative-from-bottom percentile within a school's CDS
 * C9 GPA distribution using a step function. Boundary convention is
 * right-open: 3.75 is in the 3.75-4.00 band, not 3.50-3.74.
 *
 * Returns 0..1, where 0.5 means the applicant is near the middle of the
 * enrolled-student GPA distribution.
 */
function gpaPercentileFromDistribution(
  applicantGpa: number,
  distribution: Record<string, unknown>,
): number | null {
  if (!Number.isFinite(applicantGpa)) return null;
  const normalized = normalizeGpaDistribution(distribution);
  if (!normalized) return null;

  const bandIndex = GPA_DISTRIBUTION_BANDS.findIndex(
    (band) => applicantGpa >= band.min && applicantGpa < band.maxExclusive,
  );
  if (bandIndex < 0) return null;

  const lowerMass = normalized
    .slice(0, bandIndex)
    .reduce((sum, band) => sum + band.pct, 0);
  return clamp(lowerMass + normalized[bandIndex].pct / 2, 0, 1);
}

export function gpaBandMultiplier(
  profile: ProfileInput,
  school: SchoolInput,
): ModifierResult {
  const gpa = profile.gpa;
  const scale =
    profile.gpaScale && profile.gpaScale > 0 ? profile.gpaScale : 4.0;
  const gpa4 = gpa != null ? clamp((gpa / scale) * 4.0, 0, 4.0) : null;

  // ── Data-driven path: school publishes its CDS C9 GPA distribution ────────
  if (
    gpa4 != null &&
    school.gpaDistribution &&
    Object.keys(school.gpaDistribution).length > 0
  ) {
    const pct = gpaPercentileFromDistribution(gpa4, school.gpaDistribution);
    if (pct != null) {
      // 2026-05-23 calibration fix: previous curve `0.4 + 0.7 * pct` mapped
      // the median (pct=0.5) to ×0.75 — penalizing an applicant who is
      // EXACTLY at the school's admitted-student GPA median. Net effect:
      // strong-but-not-perfect candidates (e.g. GPA 3.95 at MIT, which is
      // at MIT's admit median) got pushed below the school's anchor admit
      // rate. New curve centers at the median: pct=0.5 → ×1.0 (neutral),
      // pct=0 → ×0.5 (well below admit pool), pct=1 → ×1.5 (well above).
      const multiplier = clamp(0.5 + pct, 0.15, 1.5);
      const percentile = pct * 100;
      return {
        multiplier,
        label: 'GPA percentile (school-published)',
        evidence: `GPA ${gpa?.toFixed(2)} is around the ${percentile.toFixed(0)}th percentile of this school's CDS C9 enrolled-student GPA distribution`,
        impact:
          multiplier > 1.05
            ? 'positive'
            : multiplier < 0.95
              ? 'negative'
              : 'neutral',
      };
    }
  }

  // ── Heuristic fallback: GPA → equivalent SAT against school sat25/75 ──────
  const equivSat = gpaToEquivalentSat(profile.gpa, profile.gpaScale);
  if (equivSat == null) {
    return { ...NEUTRAL, label: 'GPA' };
  }
  const usableSat = usableSatBand(school);
  const sat25 = usableSat?.sat25;
  const sat50 = school.satAvg;
  const sat75 = usableSat?.sat75;
  if (!sat25 || !sat75) {
    return {
      multiplier: 1.0,
      label: 'GPA',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (no school percentile data; no adjustment)`,
      impact: 'neutral',
    };
  }

  // Band the GPA-equivalent SAT against the school's 25/50/75 distribution.
  let result: ModifierResult;
  if (equivSat >= sat75) {
    result = {
      multiplier: 1.3,
      label: 'GPA above 75th percentile',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (equivalent SAT ~${equivSat}) is at/above this school's 75th percentile (${sat75})`,
      impact: 'positive',
    };
  } else if (sat50 && equivSat >= sat50) {
    result = {
      multiplier: 1.1,
      label: 'GPA above median',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (equiv SAT ~${equivSat}) is above this school's median (${sat50})`,
      impact: 'positive',
    };
  } else if (equivSat >= sat25) {
    result = {
      multiplier: 0.85,
      label: 'GPA below school median',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (equiv SAT ~${equivSat}) sits between 25th and 50th percentile (${sat25}-${sat50 ?? sat75})`,
      impact: 'negative',
    };
  } else if (equivSat >= sat25 - 100) {
    result = {
      multiplier: 0.5,
      label: 'GPA just below 25th percentile',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (equiv SAT ~${equivSat}) is below 25th percentile (${sat25}) but within 100 points`,
      impact: 'negative',
    };
  } else {
    result = {
      multiplier: 0.15,
      label: 'GPA well below 25th percentile',
      evidence: `GPA ${profile.gpa?.toFixed(2)} (equiv SAT ~${equivSat}) is more than 100 points below this school's 25th percentile (${sat25})`,
      impact: 'negative',
    };
  }

  // De-duplicate the redundant academic PENALTY (2026-06 invariant deep-dive).
  // This HEURISTIC bands GPA-as-equivalent-SAT against the school's *SAT* 25/75
  // — the SAME axis the real testBand modifier measures. Because the equivSat
  // mapping caps at ~1540, it wrongly flags a strong GPA as "below 25th" at
  // elite-SAT schools (e.g. a 3.90 GPA at Rice, sat25 1510 → ×0.50) — a FALSE
  // penalty. When a real SAT/ACT is present (so the testing axis is already
  // measured directly), soften that false GPA-proxy penalty toward neutral via
  // the geometric mean with 1.0 (sqrt).
  //
  // PENALTY side only (multiplier < 1). The boost side is intentionally left at
  // full strength here: a high GPA-equivSat above the school's SAT-75 is a
  // legitimate (not false) signal, and the engine's gpa×test combine already
  // applies the uniform-geomean correlation correction to it downstream —
  // sqrt-ing the boost here too would DOUBLE-dampen it (this dropped
  // 082-cooper-union ED 0.5pp below its calibration floor on the band-less gate
  // DB). sqrt below 1 + identity at/above 1 is monotonic and continuous at 1, so
  // a strictly-stronger GPA never scores lower. Fires ONLY on this heuristic path
  // (the CDS-C9 data path measures a distinct GPA axis and is exempt) AND only
  // when a real SAT/ACT exists — a test-optional / no-test applicant keeps the
  // full GPA-proxy as their primary academic signal.
  const hasRealTest = (profile.testScores ?? []).some(
    (t) =>
      (t.type === 'SAT' || t.type === 'ACT') &&
      Number.isFinite(t.score) &&
      t.score > 0,
  );
  if (hasRealTest && result.multiplier < 1.0) {
    result = {
      ...result,
      multiplier: Math.sqrt(result.multiplier),
      evidence: `${result.evidence} — penalty softened because a real test score is present (GPA-vs-SAT proxy not double-counted against the testing axis)`,
    };
  }

  // closure-v2: rigor-in-context calibration. A face-value GPA is misleading
  // across high schools — a 3.75 at a grade-deflation school is stronger than
  // a 3.75 at a lenient one; admissions officers calibrate GPA by the school
  // profile's course-rigor rating ("most demanding"). Applied as a SMALL
  // SMOOTH post-band multiplier (NOT an equivSat shift) so it can never flip a
  // discrete band — a rigor flag is a gentle ±9% nudge, not a ×0.85→×1.30
  // cliff. Applies only to this equivSat heuristic; the CDS-C9 data-driven
  // path above is already school-contextualised, and the engine suppresses
  // gpaBandMultiplier entirely when a Tier-1 cell encodes GPA. Kept small so it
  // does not materially double-count with highSchoolContextComponent (tier is
  // partly derived from academicRigor). Zero-drift when rigor is unset.
  const rigor = profile.highSchoolAcademicRigor;
  if (
    rigor != null &&
    rigor >= 1 &&
    rigor <= 5 &&
    profile.highSchoolImpactEnabled !== false
  ) {
    const rigorAdj = 0.94 + rigor * 0.03; // rigor 1→×0.97, 3→×1.03, 5→×1.09
    result = {
      ...result,
      multiplier: clamp(result.multiplier * rigorAdj, 0.15, 1.3),
    };
  }
  return result;
}

/**
 * Convert IB total score (0-45) to SAT-equivalent.
 * Citation: College Board IB Concordance 2018; standard mapping used by
 * UC, US private universities for IB applicants without SAT.
 *
 * 45 = perfect / 1600 SAT
 * 42 ≈ 1540 (top T20)
 * 38 ≈ 1450 (T30 competitive)
 * 35 ≈ 1380 (mid-T50)
 * 32 ≈ 1300 (T100 baseline)
 * <32 → 1200
 */
export function ibToEquivalentSat(ibScore: number): number | null {
  if (!Number.isFinite(ibScore) || ibScore < 0 || ibScore > 45) return null;
  if (ibScore >= 45) return 1600;
  if (ibScore >= 42) return 1540;
  if (ibScore >= 38) return 1450;
  if (ibScore >= 35) return 1380;
  if (ibScore >= 32) return 1300;
  return 1200;
}

/**
 * Convert A-Level UCAS tariff points to SAT-equivalent.
 * Citation: Cambridge International A-Level concordance + UCAS tariff table.
 *
 * Score input = UCAS tariff points (e.g., A* = 56, A = 48, B = 40, C = 32, D = 24, E = 16).
 *  4A* = 224 → SAT 1600
 *  3A*A = 216 → 1550
 *  3A* = 168 → 1500
 *  3A = 144 → 1450
 *  AAB = 136 → 1400
 *  ABB = 128 → 1350
 *  BBB = 120 → 1300
 *  BBC = 112 → 1250
 *  CCC = 96 → 1200
 *  <96 → 1150
 */
export function aLevelToEquivalentSat(ucasPoints: number): number | null {
  if (!Number.isFinite(ucasPoints) || ucasPoints < 0) return null;
  if (ucasPoints >= 220) return 1600;
  if (ucasPoints >= 200) return 1550;
  if (ucasPoints >= 168) return 1500;
  if (ucasPoints >= 144) return 1450;
  if (ucasPoints >= 136) return 1400;
  if (ucasPoints >= 128) return 1350;
  if (ucasPoints >= 120) return 1300;
  if (ucasPoints >= 112) return 1250;
  if (ucasPoints >= 96) return 1200;
  return 1150;
}

/**
 * Convert 中国高考 (Gaokao) raw score (0-750) to SAT-equivalent.
 * Citation: 教育部公开历年高考分数线 + 各 US 大学公布对中国高考申请人录取段。
 * Numbers calibrated to "省排名 percentile" rather than raw — top 1% of
 * Gaokao is roughly equivalent to SAT 1550 in selectivity.
 *
 * 690+ (省前 1%) → 1550
 * 670 (省前 3%) → 1500
 * 650 (省前 5%) → 1450
 * 620 (省前 15%) → 1400
 * 590 (省前 30%) → 1350
 * <590 → 1280
 */
export function gaokaoToEquivalentSat(gaokaoScore: number): number | null {
  if (!Number.isFinite(gaokaoScore) || gaokaoScore < 0 || gaokaoScore > 750) {
    return null;
  }
  if (gaokaoScore >= 690) return 1550;
  if (gaokaoScore >= 670) return 1500;
  if (gaokaoScore >= 650) return 1450;
  if (gaokaoScore >= 620) return 1400;
  if (gaokaoScore >= 590) return 1350;
  return 1280;
}

function compareTestBand(
  score: number,
  p25: number,
  p75: number,
  testLabel: string,
  pointUnit = 'points',
): ModifierResult {
  if (score >= p75 + (pointUnit === 'ACT' ? 1 : 50)) {
    return {
      multiplier: 1.5,
      label: 'Test score well above 75th percentile',
      evidence: `${testLabel} is above the school's 75th percentile (${p75})`,
      impact: 'positive',
    };
  }
  if (score >= p75) {
    return {
      multiplier: 1.2,
      label: 'Test score above 75th percentile',
      evidence: `${testLabel} meets or exceeds the school's 75th percentile (${p75})`,
      impact: 'positive',
    };
  }
  if (score >= p25) {
    // 2026-05-24 calibration fix: previous ×0.85 ("in middle 50") penalized
    // applicants who sit EXACTLY in the school's admit pool middle 50 —
    // i.e. the most typical successful applicant. Net effect: anyone with
    // SAT 1560 at MIT (admit p25-p75 = 1530-1580) got ×0.85 despite being
    // above the median admitted score. Middle 50 means "this score is
    // typical of admitted students" → ×1.0 neutral. Marked impact:'positive'
    // (not 'neutral') because being in admit-pool middle 50 IS a positive
    // signal relative to applicant pool — and so the factor stays visible
    // in the breakdown UI (engine skips multiplier=1.0 + impact=neutral).
    return {
      multiplier: 1.0,
      label: 'Test score in admit pool middle 50',
      evidence: `${testLabel} falls between this school's 25th and 75th percentile (${p25}-${p75}) — typical of admitted students`,
      impact: 'positive',
    };
  }
  const nearBand = pointUnit === 'ACT' ? score >= p25 - 3 : score >= p25 - 100;
  if (nearBand) {
    return {
      multiplier: 0.7,
      label: 'Test score just below 25th percentile',
      evidence: `${testLabel} is below the 25th percentile (${p25}) but close to the middle-50 range`,
      impact: 'negative',
    };
  }
  return {
    multiplier: 0.3,
    label: 'Test score well below 25th percentile',
    evidence: `${testLabel} is well below the school's 25th percentile (${p25})`,
    impact: 'negative',
  };
}

/**
 * Modifier #2: Test-band relative to school SAT/ACT distribution.
 *
 * Reads the highest SAT or ACT score in `profile.testScores[]` and compares
 * to the school's 25/75 percentiles. Other test types are converted to
 * SAT-equivalent via published concordance:
 *   - ACT: rough College Board concordance (ACT * 45 ≈ SAT)
 *   - IB: 0-45 score → SAT (College Board IB Concordance 2018)
 *   - A_LEVEL: UCAS tariff points → SAT (Cambridge International)
 *   - GAOKAO: 0-750 raw score → SAT (calibrated to provincial percentile)
 *
 * PR-14 also handles `applyingTestOptional` flag: at highly-selective schools
 * (<20% admit), test-optional applicants admit at 5-10pp lower per Common App
 * data; we apply 0.85× as a conservative correction.
 */
export function testBandMultiplier(
  profile: ProfileInput & { applyingTestOptional?: boolean },
  school: SchoolInput,
): ModifierResult {
  if (school.testingPolicy === 'BLIND') {
    return {
      multiplier: 1.0,
      label: 'Test-blind school (test ignored)',
      evidence:
        'This school does not consider SAT/ACT scores in admissions decisions; submitted scores are ignored.',
      impact: 'neutral',
    };
  }

  const testScores = profile.testScores ?? [];
  let bestEquivSat: number | null = null;
  let testLabel: string | null = null;
  let bestDirectAct: number | null = null;

  const considerScore = (equiv: number | null, label: string) => {
    if (equiv == null) return;
    if (bestEquivSat == null || equiv > bestEquivSat) {
      bestEquivSat = equiv;
      testLabel = label;
    }
  };

  for (const ts of testScores) {
    if (!ts.score) continue;
    switch (ts.type) {
      case 'SAT':
        // Clamp to the physical SAT domain so an impossible score (e.g. 2000)
        // can't be rewarded as a top-band result.
        considerScore(
          Math.min(1600, Math.max(400, ts.score)),
          `SAT ${ts.score}`,
        );
        break;
      case 'ACT': {
        // Clamp to the physical ACT domain (1-36) before the SAT-equivalent
        // conversion, for the same reason.
        const act = Math.min(36, Math.max(1, ts.score));
        if (bestDirectAct == null || act > bestDirectAct) {
          bestDirectAct = act;
        }
        considerScore(act * 45, `ACT ${ts.score}`);
        break;
      }
      case 'IB':
        considerScore(ibToEquivalentSat(ts.score), `IB ${ts.score}`);
        break;
      case 'A_LEVEL':
        considerScore(
          aLevelToEquivalentSat(ts.score),
          `A-Level (${ts.score} UCAS pts)`,
        );
        break;
      case 'GAOKAO':
        considerScore(gaokaoToEquivalentSat(ts.score), `Gaokao ${ts.score}`);
        break;
      default:
        // TOEFL/IELTS/AP/IGCSE/DUOLINGO — not used as primary admission test
        // (they're language proficiency or supplementary)
        break;
    }
  }

  if (bestEquivSat == null || testLabel == null) {
    if (school.testingPolicy === 'REQUIRED') {
      return {
        multiplier: 0.1,
        label: 'Missing required test score',
        evidence:
          'This school requires SAT/ACT scores; no submitted score is a severe application weakness.',
        impact: 'negative',
      };
    }

    // `testingPolicy` is UNKNOWN for 96.3% of prod schools (234/243, audited
    // 2026-07-24): College Scorecard doesn't publish the field and nothing
    // backfills it, so UNKNOWN is the MAIN path here, not an edge case. It used
    // to fall through to NEUTRAL, which silently handed every no-score applicant
    // a ×1.0 at every school — including the ones that hard-require SAT/ACT as of
    // the 2026-27 cycle (6/8 Ivies, the whole University System of Georgia, UF).
    // Anything that isn't BLIND (returned above) / REQUIRED / OPTIONAL now takes
    // the same selectivity-scaled correction as test-optional: conservative,
    // without pretending we know a policy we don't. There is deliberately no
    // neutral fallback left — that was the bug.
    //
    // This caps the damage at the selective end; it does NOT fully fix it. A
    // ≥20% school that actually requires scores (e.g. UF) still reads 1.0 here.
    // The real fix is backfilling testingPolicy — `uncertaintyReasons` tells the
    // user the policy is unknown in the meantime.
    //
    // ponytail: reuses the test-optional curve rather than inventing an
    // UNKNOWN-specific one — give UNKNOWN its own curve only once the column is
    // populated and the two can actually be measured apart.
    const declaredTestOptional =
      school.testingPolicy === 'OPTIONAL' ||
      profile.applyingTestOptional === true;
    const surface = declaredTestOptional
      ? 'test-optional school'
      : 'school with unrecorded testing policy';

    const overallNorm = normalizeRate(school.acceptanceRate);
    if (overallNorm != null && overallNorm < 0.2) {
      return {
        multiplier: 0.85,
        label: `No test score at highly selective ${surface}`,
        evidence: declaredTestOptional
          ? 'Common App data: highly selective test-optional schools admit no-score applicants lower than test-submitters; 0.85× conservative correction.'
          : "This school's SAT/ACT requirement is not on record. Applying the test-optional correction (0.85×) as a conservative floor — if the school in fact requires scores, the true impact is substantially larger.",
        impact: 'negative',
      };
    }
    return {
      multiplier: 1.0,
      label: `No test score at less-selective ${surface}`,
      evidence: declaredTestOptional
        ? 'At schools with admit rates at or above 20%, no-score test-optional applications have no strong observed penalty.'
        : "This school's SAT/ACT requirement is not on record, but at admit rates at or above 20% a missing score is unlikely to be decisive.",
      impact: 'neutral',
    };
  }

  if (bestDirectAct != null && school.act25 && school.act75) {
    return compareTestBand(
      bestDirectAct,
      school.act25,
      school.act75,
      `ACT ${bestDirectAct}`,
      'ACT',
    );
  }

  const usableSat = usableSatBand(school);
  const sat25 = usableSat?.sat25;
  const sat75 = usableSat?.sat75;
  if (!sat25 || !sat75) {
    return {
      multiplier: 1.0,
      label: 'Test score',
      evidence: `${testLabel} (no school percentile data; no adjustment)`,
      impact: 'neutral',
    };
  }
  return compareTestBand(bestEquivSat, sat25, sat75, testLabel);
}

/**
 * Selectivity-scaled ED boost — fallback when the school's own ED rate (and
 * CDS yield) are unknown. The ED-vs-OVERALL advantage shrinks sharply with
 * selectivity, so a flat constant is wrong in both directions:
 *   - elites (<8% overall): ED÷overall ≈ 2.7-3.5× (Columbia 3.4×, Brown 2.7×,
 *     Duke 2.9×, Dartmouth 3.5×)
 *   - T25-T40 (15-30%): ≈ 1.5-2.3× (Emory 2.3×, Richmond 1.5×, Macalester 1.6×)
 *   - >45% overall: collapses to ~1.1-1.3× (a flat 2.5× there overflows past
 *     100%, e.g. Tulane ED÷overall ≈ 1.2×)
 * This is a known *published-aggregate* pattern (not outcome-tuned), so it is
 * data-grounded and generalizable. Source: CollegeVine ED/EA-by-tier table
 * (blog.collegevine.com/ed-and-ea-acceptance-rates).
 */
function selectivityScaledEdMultiplier(overallRate: number | null): number {
  if (overallRate == null) return 2.0; // unknown selectivity → conservative midpoint
  if (overallRate < 0.08) return 3.0;
  if (overallRate < 0.15) return 2.4;
  if (overallRate < 0.3) return 1.8;
  if (overallRate < 0.45) return 1.4;
  return 1.15;
}

/**
 * Modifier #3: Application round.
 *
 * When the school publishes its own ED/EA admit rate (CDS Section C21), use
 * the actual ratio `edRate / overallRate` (clamped to [1.0, 4.0]). This is
 * the data-driven path — ED at HYPSM ~1.3-1.5×, T20 ED ~2-2.5×, T50 ED ~1.8×.
 *
 * Fallback heuristic (when no ED rate / yield is published): the ED boost is
 * scaled by school selectivity via `selectivityScaledEdMultiplier`; REA/SCEA
 * is a flat 2.3× (it is structurally elite-only, where REA÷overall ≈ 2.3-2.4×:
 * Harvard 8.74%/3.59% = 2.43×, Yale 2.4×).
 */
export function roundMultiplier(
  round: string | undefined,
  school?: SchoolInput & {
    edAcceptanceRate?: number | null;
    ed2AcceptanceRate?: number | null;
    eaAcceptanceRate?: number | null;
    acceptanceRate?: number | null;
    yieldRate?: number | null;
    hasEarlyDecision?: boolean | null;
    hasEarlyDecision2?: boolean | null;
    hasEarlyAction?: boolean | null;
    hasRestrictiveEa?: boolean | null;
  },
): ModifierResult {
  const r = (round ?? 'RD').toUpperCase();
  const overallRate = normalizeRate(school?.acceptanceRate);
  const edRate = normalizeRate(school?.edAcceptanceRate);
  const ed2Rate = normalizeRate(school?.ed2AcceptanceRate);
  const eaRate = normalizeRate(school?.eaAcceptanceRate);

  if ((r === 'ED' || r === 'ED2') && school?.hasEarlyDecision === false) {
    return {
      multiplier: 1.0,
      label: 'School does not offer Early Decision',
      evidence: 'This school has no Early Decision program; treating as RD.',
      impact: 'neutral',
    };
  }
  if (r === 'ED2' && school?.hasEarlyDecision2 === false) {
    return {
      multiplier: 1.0,
      label: 'School does not offer Early Decision 2',
      evidence: 'This school has no ED2 program; treating as RD.',
      impact: 'neutral',
    };
  }
  if (r === 'EA' && school?.hasEarlyAction === false) {
    return {
      multiplier: 1.0,
      label: 'School does not offer Early Action',
      evidence: 'This school has no Early Action program; treating as RD.',
      impact: 'neutral',
    };
  }
  if ((r === 'REA' || r === 'SCEA') && school?.hasRestrictiveEa === false) {
    return {
      multiplier: 1.0,
      label: 'School does not offer Restrictive Early Action',
      evidence: 'This school has no REA/SCEA program; treating as RD.',
      impact: 'neutral',
    };
  }

  // Data-driven path: school publishes its own ED/EA rate
  if ((r === 'ED' || r === 'ED2') && overallRate != null) {
    const roundRate = r === 'ED2' ? (ed2Rate ?? edRate) : edRate;
    if (roundRate != null) {
      if (roundRate < overallRate) {
        return {
          multiplier: 1.0,
          label:
            r === 'ED2'
              ? 'Early Decision 2 (school data anomaly)'
              : 'Early Decision (school data anomaly)',
          evidence: `Published ${r} admit rate is below the overall admit rate; using neutral until the source row is reviewed.`,
          impact: 'neutral',
        };
      }
      const ratio = roundRate / overallRate;
      const clamped = clamp(ratio, 1.0, 3.5);
      return {
        multiplier: clamped,
        label:
          r === 'ED2'
            ? 'Early Decision 2 (school-published)'
            : 'Early Decision (school-published)',
        evidence: `This school admits ${(roundRate * 100).toFixed(1)}% of ${r} applicants vs ${(overallRate * 100).toFixed(1)}% overall`,
        impact: 'positive',
      };
    }
  }
  if (
    (r === 'EA' || r === 'REA' || r === 'SCEA') &&
    eaRate != null &&
    overallRate != null
  ) {
    if (eaRate < overallRate) {
      // Non-binding EA legitimately runs at or below the overall (RD-blended) rate
      // at many schools — no binding-yield boost + early-pool self-selection
      // (Georgetown REA, USC, Northeastern, UVA, UF, UGA … ~44% of schools with a
      // published EA rate). NOT a data anomaly. Treat as neutral (EA is a free
      // option → no penalty) with an honest label.
      return {
        multiplier: 1.0,
        label:
          r === 'EA'
            ? 'Early Action (no admit-rate advantage)'
            : 'Restrictive Early Action (no admit-rate advantage)',
        evidence: `${r} admits ${(eaRate * 100).toFixed(1)}% vs ${(overallRate * 100).toFixed(1)}% overall — early applying confers no admit-rate advantage at this school (common for non-binding ${r}); treated as neutral.`,
        impact: 'neutral',
      };
    }
    const ratio = eaRate / overallRate;
    const clamped = clamp(ratio, 1.0, 3.5);
    return {
      multiplier: clamped,
      label:
        r === 'EA'
          ? 'Early Action (school-published)'
          : 'Restrictive Early Action (school-published)',
      evidence: `This school admits ${(eaRate * 100).toFixed(1)}% of ${r === 'EA' ? 'EA' : 'REA/SCEA'} applicants vs ${(overallRate * 100).toFixed(1)}% overall`,
      impact: 'positive',
    };
  }

  // closure-v2 yield-informed fallback: when a school publishes no ED rate but
  // does publish a CDS C2 yield, refine the flat 2.5× ED heuristic. Low-yield
  // schools front-load their class through binding ED and admit a larger share
  // of the ED pool; high-yield schools (HYPSM) rely on ED less. Bounded to
  // [2.0, 3.2] so it never exceeds the data-driven path. Zero-drift on current
  // data — no school carries `yieldRate` until the CDS C2 marathon populates it.
  const yieldFrac =
    school?.yieldRate == null
      ? null
      : school.yieldRate > 1
        ? school.yieldRate / 100
        : school.yieldRate;
  if (
    (r === 'ED' || r === 'ED2') &&
    edRate == null &&
    ed2Rate == null &&
    yieldFrac != null &&
    yieldFrac > 0 &&
    yieldFrac < 1
  ) {
    // yield 0.20 → 3.2× ; yield 0.70 → 2.0× ; linear, clamped.
    const estimate = clamp(3.2 - (yieldFrac - 0.2) * (1.2 / 0.5), 2.0, 3.2);
    const multiplier = r === 'ED2' ? clamp(estimate * 0.8, 1.6, 2.6) : estimate;
    return {
      multiplier,
      label:
        r === 'ED2'
          ? 'Early Decision 2 (yield-informed estimate)'
          : 'Early Decision (yield-informed estimate)',
      evidence: `No published ${r} admit rate; estimated from this school's ${(yieldFrac * 100).toFixed(0)}% CDS yield — lower yield implies a larger ED boost.`,
      impact: 'positive',
    };
  }

  // Heuristic fallback — selectivity-scaled (2026-05-31). A flat ED 2.5× was
  // too high at T30+ (real ED÷overall ≈ 1.3-1.8×) and overflows past 100% above
  // ~45% admit; REA 1.5× was too low for the HYPSM tier it exclusively serves
  // (real ≈ 2.3-2.4×). See selectivityScaledEdMultiplier + docs.
  switch (r) {
    case 'ED': {
      const m = selectivityScaledEdMultiplier(overallRate);
      return {
        multiplier: m,
        label: 'Early Decision',
        evidence: `ED admit rates run ~${m.toFixed(1)}× the overall rate at this selectivity tier (scaled to a ${overallRate != null ? `${(overallRate * 100).toFixed(0)}% overall` : 'unknown'} admit rate; CDS Section C21)`,
        impact: 'positive',
      };
    }
    case 'ED2': {
      const m = Math.max(
        1.0,
        selectivityScaledEdMultiplier(overallRate) * 0.75,
      );
      return {
        multiplier: m,
        label: 'Early Decision 2',
        evidence: `ED2 admit rates run ~${m.toFixed(1)}× the overall rate (≈0.75× the ED1 boost at this selectivity tier)`,
        impact: 'positive',
      };
    }
    case 'REA':
    case 'SCEA':
      return {
        multiplier: 2.3,
        label: 'Restrictive Early Action',
        evidence:
          'REA/SCEA is structurally elite-only, where the early-round admit rate runs ~2.3-2.4× the overall rate (e.g. Harvard 8.74%/3.59% = 2.43×, Yale ≈ 2.4×)',
        impact: 'positive',
      };
    case 'EA':
      return {
        multiplier: 1.3,
        label: 'Early Action',
        evidence:
          'Non-restrictive EA admit rates are typically 1.1-1.5× the RD rate',
        impact: 'positive',
      };
    case 'ROLLING':
      return {
        multiplier: 1.1,
        label: 'Rolling admission',
        evidence:
          'Earlier applicants in rolling cycles see slightly better odds than late applicants',
        impact: 'positive',
      };
    case 'RD':
    default:
      return {
        multiplier: 1.0,
        label: 'Regular Decision',
        evidence:
          "Regular Decision is the baseline round used to compute the school's CDS admit rate",
        impact: 'neutral',
      };
  }
}

/**
 * Modifier #4: Legacy hook (parent / sibling attended same school).
 *
 * Launch behavior: self-reported legacy no longer changes served probability.
 * The hook is only surfaced as neutral guidance until the evidence/verification
 * flow can mark the relationship as verified for a specific school.
 */
export function legacyHookMultiplier(
  profile: ProfileInput,
  school: SchoolInput,
): ModifierResult {
  const isLegacy = profile.isLegacy === true;
  const schoolTokens = [school.id, school.name, school.nameZh]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase().trim());
  const matchedSchool = isLegacy
    ? (profile.legacySchools ?? []).some((name) => {
        const normalized = name.toLowerCase().trim();
        return schoolTokens.includes(normalized);
      })
    : false;
  if (!matchedSchool) {
    return { ...NEUTRAL, label: 'Legacy status' };
  }
  return {
    multiplier: 1.0,
    label: 'Legacy status (evidence required)',
    evidence: `Legacy preference for ${school.name} is not applied until school-specific evidence is verified.`,
    impact: 'neutral',
  };
}

/**
 * Modifier #5: First-generation college student — selectivity-scaled.
 *
 * The Arcidiacono SFFA odds ratio (~1.5×) is a *Harvard-specific*, holistic,
 * need-aware artifact — it exists because selective schools practice
 * contextual review and actively recruit first-gen students. It is NOT a
 * universal cross-tier constant: at less-selective schools that admit largely
 * on GPA/test thresholds there is no published first-gen admit advantage. So
 * the boost is scaled by selectivity (concentrated at selective holistic
 * schools, tapering to neutral above ~45% admit) rather than applied flat.
 * Source: Arcidiacono SFFA expert report / NBER w26316.
 */
export function firstGenMultiplier(
  profile: ProfileInput,
  school?: SchoolInput,
): ModifierResult {
  if (!profile.isFirstGen) {
    return { ...NEUTRAL, label: 'First-generation status' };
  }
  const overall = normalizeRate(school?.acceptanceRate);
  const multiplier =
    overall == null
      ? 1.3
      : overall < 0.15
        ? 1.4
        : overall < 0.3
          ? 1.2
          : overall < 0.45
            ? 1.1
            : 1.0;
  if (multiplier <= 1.0) {
    return {
      ...NEUTRAL,
      label: 'First-generation status (neutral at less-selective school)',
    };
  }
  return {
    multiplier,
    label: 'First-generation college student',
    evidence: `First-gen applicants see ~${multiplier.toFixed(1)}× the baseline admit rate at selective holistic-review schools (Arcidiacono SFFA); the effect tapers to neutral at less-selective schools`,
    impact: 'positive',
  };
}

/**
 * Modifier #6: Recruited athlete.
 *
 * Launch behavior: self-reported recruited-athlete status no longer changes
 * served probability. A future evidence flow can re-enable this hook only after
 * school-specific verification.
 */
export function athleteMultiplier(
  profile: ProfileInput & { recruitedAthlete?: boolean },
): ModifierResult {
  if (!profile.recruitedAthlete) {
    return { ...NEUTRAL, label: 'Recruited athlete' };
  }
  return {
    multiplier: 1.0,
    label: 'Recruited athlete (evidence required)',
    evidence:
      'A recruited-athlete boost is not applied until a school-specific coach contact or offer is verified.',
    impact: 'neutral',
  };
}

/**
 * Modifier #7: URM (under-represented minority) status.
 *
 * Post-2023 SCOTUS SFFA v. Harvard ruling, race cannot be a direct admissions
 * factor. However, contextual review (essays, geographic origin) still indirectly
 * advantages URM applicants at need-blind schools per Common App data. Conservative
 * 1.5× multiplier; only applies at need-blind schools (those still doing holistic).
 *
 * NEW Profile field; opt-in, defaults to null (no effect).
 */
export function urmMultiplier(
  profile: ProfileInput & { urmStatus?: string | null },
  _school: SchoolInput,
): ModifierResult {
  const isUrm =
    profile.urmStatus &&
    ['BLACK', 'HISPANIC', 'NATIVE_AMERICAN', 'PACIFIC_ISLANDER'].includes(
      profile.urmStatus,
    );
  if (!isUrm) {
    return { ...NEUTRAL, label: 'URM status' };
  }
  return {
    multiplier: 1.0,
    label: 'URM status (disabled pending review)',
    evidence:
      'This opt-in demographic field is recorded for future analysis but does not affect served predictions pending compliance review.',
    impact: 'neutral',
  };
}

/**
 * Modifier #8a: In-state vs out-of-state at public universities.
 *
 * THE ANCHOR IS THE OVERALL-POPULATION ADMIT RATE, so the in-state modifier
 * must be in-state÷OVERALL — NOT the in-state÷OOS gap. Multiplying an overall
 * anchor by the (much larger) in-state-vs-OOS ratio double-counts and
 * over-predicts in-state applicants. A flat 1.8 (= UC in-state÷OOS) did exactly
 * that: it inflated strong CA in-state UC predictions to ~45% — caught by the
 * counselor gold set on 2026-05-31. Each ratio below is the system's PUBLISHED
 * in-state÷overall admit rate (reviewed 2026-05-31):
 *
 *   NC 2.2  — UNC-CH official CDS 2023-24 C1: in-state 41.2% / overall 18.7%
 *             (OOS enrollment legally capped at 18%). Highest confidence.
 *   VA 1.5  — UVA Dean of Admission 2024/2025: in-state ~24-25% / overall ~16.5%.
 *   TX 1.5  — UT-Austin OOS÷overall 0.38 (strong in-state pref); in-state is
 *             bimodal (top-6% auto-admit ~100% vs holistic ~10%), no single
 *             official %, so 1.5 is a conservative blend.
 *   CA 1.2  — UC systemwide in-state÷overall 1.06 (UCOP 2024); Berkeley 1.35,
 *             UCLA 1.06. Selective campuses tilt above systemwide; UC freshman-
 *             GPA bands are CA-resident-leaning, so the anchor already captures
 *             much of the residency effect — keep the extra tilt small.
 *   FL 1.1  — UF CDS leaves the residency columns blank; DB oos 23.3% ≈ overall
 *             24.2% → ~residency-neutral.
 *   MI 1.0  — UMich publishes no residency split; the circulating "39% in-state"
 *             is mathematically impossible against the official 17.9% overall,
 *             and DB oos 18% > overall 15.6% → OOS admitted *easier* → neutral.
 *
 * Out-of-state uses the per-school oos÷overall DATA path in geoMultiplier when
 * a published OOS rate exists; PUBLIC_FLAGSHIPS_WITH_STRONG_RESIDENCY_PREF only
 * feeds the OOS *fallback* for strong-residency states that lack OOS data.
 */
const STATE_IN_STATE_OVER_OVERALL: Record<string, number> = {
  // Verified FLAGSHIP in-state÷overall ratios. Primary sources audited 2026-05-31
  // (48-flagship web audit: each state's CDS section C / official admissions newsroom /
  // state higher-ed dashboard — see docs/PREDICTION_DATA_DRIVEN_STRATEGY_2026-05-30.md §7.10).
  // These are the MOST-selective public per state; residencySelectivityWeight() and the
  // per-school OOS guard (in geoMultiplier) adapt them to less-selective same-state publics.
  NC: 2.5, // UNC: in-state 38% / overall 15.3% (state law caps non-residents at 18% of class)
  GA: 2.36, // Georgia Tech: residents 30% / overall 12.7% (Fall 2025 newsroom — steepest US gap)
  TN: 1.6, // UT-Knoxville: in-state 70% / overall 42% (two-thirds-in-state policy)
  VA: 1.54, // UVA: in-state 25% / overall 16.5%
  TX: 1.41, // UT-Austin: top-6% auto-admit
  WI: 1.38, // UW-Madison: in-state 56% / overall 41%
  CA: 1.35, // UC system: CA resident 14.9% / overall 11% (Berkeley, UC Information Center).
  // NOTE: for UC schools that resolve to a by-GPA Tier-1 band (anchorSource 'cds-bands-v1'),
  // this in-state boost is SUPPRESSED in counselor-engine.service.ts (the band already
  // captures the top-GPA residency rate — stacking over-predicts; researched UCB strong
  // CA-resident ≈ 22%). So 1.35 only takes effect for CA publics on a Tier-2/3 overall anchor.
  IL: 1.35, // UIUC: IL resident 49% / overall 37% (land-grant)
  IN: 1.34, // Purdue
  SC: 1.3, // Clemson
  WA: 1.18, // U Washington
  DE: 1.16, // U Delaware
  MD: 1.14, // UMD College Park
};
/**
 * Burden-of-proof default: a state with NO verified residency advantage is NEUTRAL (1.0).
 * The 2026-05-31 48-flagship audit found the old flat 1.2 over-predicted in-state applicants
 * for 34 states whose published data shows in-state ≈ overall (or OOS is admitted *easier*).
 */
const DEFAULT_IN_STATE_MULTIPLIER = 1.0;
/**
 * Residency advantage scales with selectivity (same principle as the #312 ED scaling):
 * near-open-access publics admit qualified applicants regardless of residency, so the in-state
 * lever vanishes; it is strongest at the most selective publics. This adapts the FLAGSHIP-level
 * state ratio to LESS-selective same-state publics — e.g. Georgia Tech (14% overall) keeps the
 * full 2.36×, but Georgia State (55% overall) is neutralized, avoiding a 98%-clamped over-prediction.
 */
function residencySelectivityWeight(overallRate: number | null): number {
  if (overallRate == null) return 1.0; // unknown selectivity → treat as flagship-like
  if (overallRate <= 0.15) return 1.0; // highly selective → full residency effect
  if (overallRate >= 0.55) return 0.0; // near open-access → residency unpriced
  return (0.55 - overallRate) / (0.55 - 0.15); // linear taper between
}
/** OOS fallback (0.5×) applies only at states whose flagships genuinely penalize non-residents. */
const PUBLIC_FLAGSHIPS_WITH_STRONG_RESIDENCY_PREF = new Set([
  'NC', // UNC — in-state 2.5× overall
  'GA', // Georgia Tech — steepest in/out gap in the US
  'TN', // UT-Knoxville — two-thirds-in-state policy
  'VA', // UVA, W&M
  'TX', // UT-Austin, A&M
  // CA intentionally excluded: UCs/CSUs admit OOS *easier* (see #312); their OOS path is
  // data-driven from published oosAcceptanceRate, not the strong-residency 0.5× fallback.
]);

export function geoMultiplier(
  profile: ProfileInput,
  school: SchoolInput & {
    state?: string | null;
    isPrivate?: boolean | null;
    acceptanceRate?: number | null;
    oosAcceptanceRate?: number | null;
    inStateAcceptanceRate?: number | null;
  },
): ModifierResult {
  // Don't double-penalize international applicants — `intlMultiplier` already
  // captures the intl-vs-domestic delta. Without this guard, a CN applicant
  // looking at a UC public would get 0.4× intl × 0.5× OOS = 0.2× combined,
  // which produced absurd 30-37% UC predictions (4/26 evening regression).
  if (profile.isInternational) {
    return {
      ...NEUTRAL,
      label: 'Geography (international applicant — see intl modifier)',
    };
  }
  if (school.isPrivate) {
    return {
      ...NEUTRAL,
      label: 'Geography (private school, no residency effect)',
    };
  }
  const schoolState = school.state?.trim().toUpperCase();
  // closure-v2: prefer the explicit state of residence over the HS location.
  // A boarding-school student from TX attending a CA prep school is a TX
  // resident for UC residency purposes; highSchoolLocation mis-classifies them.
  // Falls back to highSchoolLocation (legacy behaviour) when unset — zero-drift
  // on current data since no profile carries stateOfResidence yet.
  const applicantLocation = (
    profile.stateOfResidence ?? profile.highSchoolLocation
  )
    ?.trim()
    .toUpperCase();
  if (!schoolState || !applicantLocation) {
    return { ...NEUTRAL, label: 'Geography' };
  }
  const isInState = applicantLocation === schoolState;
  const strongPref =
    PUBLIC_FLAGSHIPS_WITH_STRONG_RESIDENCY_PREF.has(schoolState);

  const overallRate = normalizeRate(school.acceptanceRate);
  const oosRate = normalizeRate(school.oosAcceptanceRate);
  if (!isInState && overallRate != null && oosRate != null) {
    // Upper clamp raised 1.3→1.8 (2026-05-31): the revenue-seeking UCs/CSUs
    // genuinely admit out-of-state/international at higher rates than residents
    // (UC Fall 2024 official: Irvine OOS÷overall 1.73, Cal Poly 2.07, SB 1.43,
    // Davis 1.37). The old 1.3 cap (PR #290) treated oos>overall as a "data
    // quirk"; it is real published data — the data-integrity gate now guards
    // against contamination, so a bounded 1.8 is safe and more accurate. Stays
    // bounded (not unbounded) per PR #290's intent.
    const ratio = Math.max(0.35, Math.min(1.8, oosRate / overallRate));
    return {
      multiplier: ratio,
      label: 'Out-of-state (school data)',
      evidence: `Out-of-state admit-rate data is ~${(oosRate * 100).toFixed(0)}% vs ~${(overallRate * 100).toFixed(0)}% overall`,
      impact: ratio >= 0.95 ? 'neutral' : 'negative',
    };
  }

  if (isInState) {
    // PRIMARY (data-grounded): when the school publishes its OWN in-state/resident admit rate,
    // use in-state÷overall directly — real per-school data beats the flagship-ratio proxy. The
    // state map + selectivity damping below is only the FALLBACK for schools without a published
    // split. Symmetric with the OOS data path above (oos÷overall).
    const inStateRate = normalizeRate(school.inStateAcceptanceRate);
    if (inStateRate != null && overallRate != null) {
      // Consistency cross-check: a genuine in-state advantage requires residents admitted
      // MORE easily than non-residents. If the school's own OOS rate is ≥ its in-state rate,
      // residency is not favorable here — neutralize. This guards against a stale/low stored
      // overall spuriously inflating in-state÷overall (e.g. Ohio State in-state 57% ≈ OOS 59%
      // but a stale overall 51% would otherwise imply a false 1.13× boost).
      if (oosRate != null && oosRate >= inStateRate) {
        return {
          ...NEUTRAL,
          label: `In-state (${schoolState} — published residency-neutral)`,
          evidence: `${schoolState} admits residents (~${(inStateRate * 100).toFixed(0)}%) at roughly the same or lower rate than non-residents (~${(oosRate * 100).toFixed(0)}%) — residency is not an advantage here (school-published).`,
        };
      }
      const ratio = Math.max(0.9, Math.min(2.5, inStateRate / overallRate));
      if (ratio <= 1.03) {
        return {
          ...NEUTRAL,
          label: `In-state (${schoolState} — published residency-neutral)`,
          evidence: `${schoolState} residents are admitted at ~${(inStateRate * 100).toFixed(0)}% vs ~${(overallRate * 100).toFixed(0)}% overall (school-published) — residency is effectively neutral here.`,
        };
      }
      return {
        multiplier: ratio,
        label: 'In-state at public university',
        evidence: `${schoolState} residents are admitted at ~${(inStateRate * 100).toFixed(0)}% vs ~${(overallRate * 100).toFixed(0)}% overall (school-published in-state rate).`,
        impact: 'positive',
      };
    }

    const stateRatio =
      STATE_IN_STATE_OVER_OVERALL[schoolState] ?? DEFAULT_IN_STATE_MULTIPLIER;
    // Per-school guard: if THIS school's OWN published OOS rate is ≈ its overall rate,
    // residency is not priced here regardless of the state flagship — neutralize. Handles
    // intra-state heterogeneity straight from the school's own data (Texas A&M, Texas Tech,
    // VA Tech, William & Mary, Appalachian State all publish OOS ≈ overall while their state's
    // flagship strongly favours residents). MI-style residency-neutral states hit this via
    // stateRatio ≤ 1.03.
    const schoolPricesResidency = !(
      oosRate != null &&
      overallRate != null &&
      oosRate >= overallRate * 0.95
    );
    if (stateRatio <= 1.03 || !schoolPricesResidency) {
      return {
        ...NEUTRAL,
        label: `In-state (${schoolState} — residency-neutral public)`,
        evidence: `Published residency data shows this public admits in-state and out-of-state applicants at ~equal rates, so residency is treated as neutral here.`,
      };
    }
    // Scale the FLAGSHIP state ratio down for less-selective same-state publics: residency is
    // the strongest lever at the most selective publics and vanishes near open access.
    const weight = residencySelectivityWeight(overallRate);
    const effective = 1 + (stateRatio - 1) * weight;
    if (effective <= 1.03) {
      return {
        ...NEUTRAL,
        label: `In-state (${schoolState} — residency-neutral at this selectivity)`,
        evidence: `${schoolState} residents get a meaningful admit edge only at the most selective publics; at this school's admit rate residency is effectively neutral.`,
      };
    }
    return {
      multiplier: effective,
      label: 'In-state at public university',
      evidence: `${schoolState} residents are admitted at ~${effective.toFixed(2)}× this school's OVERALL admit rate (verified flagship in-state÷overall ${stateRatio.toFixed(2)}× scaled by this school's selectivity; the overall-population anchor means we use in-state÷overall, not the larger in-state÷OOS gap, which would double-count).`,
      impact: 'positive',
    };
  }
  if (strongPref) {
    return {
      multiplier: 0.5,
      label: 'Out-of-state at public flagship',
      evidence: `Out-of-state applicants face ~0.4-0.6× the in-state admit rate at ${schoolState} public flagships`,
      impact: 'negative',
    };
  }
  return {
    multiplier: 0.85,
    label: 'Out-of-state at public school',
    evidence: `Out-of-state applicants face a modest ~0.85× admit-rate penalty at most public universities`,
    impact: 'negative',
  };
}

/**
 * Coerce a stored admit-rate value (Decimal or number; may be 11.5 = 11.5% or
 * 0.115) into a probability in (0, 1). Returns null on missing / invalid input.
 *
 * Mirrors `CounselorEngineService.normalizeAcceptanceRate` — kept inline here
 * so the modifiers stay pure functions without a dep on the engine class.
 */
function normalizeRate(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  const n = raw > 1 ? raw / 100 : raw;
  return n > 0 && n < 1 ? n : null;
}

/**
 * Modifier #8b: International applicant.
 *
 * The original counselor shipped with a flat 0.4× / 0.7× penalty. That was
 * calibrated to elite schools where intl admit rates are 1/3-1/2 of overall.
 * It produces *outrageous-low* predictions at less-selective schools (UCM,
 * 88% overall × 0.4 = 36%, but UCM's actual intl admit rate is ~85% — i.e.
 * essentially no penalty). This was the first regression the engine produced
 * after going live for CN intl users on UC schools (4/26 evening).
 *
 * Fixed signal hierarchy (best to worst):
 *   1. School publishes its own intl admit rate (`school.intlAcceptanceRate`)
 *      → use the ratio `intlRate / overallRate` clamped to [0.3, 1.2]. Most
 *      data-correct path. Today populated for ~30 schools via scorecard ETL.
 *   2. Selectivity-aware fallback (when intlAcceptanceRate is missing):
 *      - Less selective (≥ 40%): 0.95× — school takes everyone qualified,
 *        intl penalty is negligible (UCs Merced/Riverside/Santa Cruz, ASU,
 *        most state publics — intl admit rate ≈ overall per published CDS)
 *      - Moderately selective (20-40%): 0.85× need-blind / 0.7× need-aware
 *        — intl pool somewhat competitive (BU, USC, UCSD, UCD, UCI)
 *      - Highly selective (10-20%): 0.80× need-blind / 0.75× need-aware
 *        — limited but real intl penalty; 10-20% schools are selective but
 *        not in HYPSM tier (Georgetown, Emory, Tufts, WashU pattern)
 *      - Elite (< 10%): 0.50× need-blind / 0.45× need-aware — calibrated
 *        from CDS 2024-25 ratios: MIT 1.96%/4.55%=0.43, Yale
 *        1.94%/3.65%=0.53, Princeton 2.11%/4.62%=0.46 → 0.50 midpoint for
 *        need-blind elite (HYPSM, MIT, Princeton, Yale, Amherst, Dartmouth);
 *        Cornell 0.41×, Northwestern 0.68×, Columbia 0.64× → 0.45 midpoint
 *        for need-aware elite (NYU, top T15)
 *   3. Unknown selectivity: assume elite (conservative default)
 *
 * Domestic applicants always return NEUTRAL (no change).
 */
export function intlMultiplier(
  profile: ProfileInput,
  school: SchoolInput & {
    needBlindInternational?: boolean | null;
    intlAcceptanceRate?: number | null;
    acceptanceRate?: number | null;
  },
): ModifierResult {
  if (!profile.isInternational) {
    return { ...NEUTRAL, label: 'International status (domestic applicant)' };
  }

  const overallRate = normalizeRate(school.acceptanceRate);
  const intlRate = normalizeRate(school.intlAcceptanceRate);

  // Best signal: school publishes its own intl admit rate. Use ratio directly.
  if (intlRate != null && overallRate != null) {
    const ratio = intlRate / overallRate;
    const clamped = Math.max(0.3, Math.min(1.2, ratio));
    return {
      multiplier: clamped,
      label: 'International (school-published intl rate)',
      evidence: `This school admits ~${(intlRate * 100).toFixed(0)}% of international applicants vs ~${(overallRate * 100).toFixed(0)}% overall`,
      impact: clamped >= 0.95 ? 'neutral' : 'negative',
    };
  }

  // Fallback: scale penalty by school's overall selectivity. The 40% threshold
  // intentionally catches public state systems like UCSC (47%) where intl
  // admit rate ≈ overall per published CDS — the elite-school 0.7× penalty
  // is not empirically justified there.
  if (overallRate != null && overallRate >= 0.4) {
    // 2026-05-31 aggregate self-calibration: the empirical intl/overall ratio
    // at >=40%-admit schools (published-data median ~0.70, IQR 0.50-0.84) is
    // well below the old 0.95 — international applicants face a real penalty
    // even at less-selective schools. Set to 0.80 (inside the IQR, conservative
    // vs the 0.70 median for publisher-sample bias). See scripts/audit-fallback-calibration.ts.
    return {
      multiplier: 0.8,
      label: 'International (less-selective school)',
      evidence: `This school admits ${(overallRate * 100).toFixed(0)}% overall, but international applicants are admitted at roughly 0.7-0.8× that rate even at less-selective schools (aggregate CDS calibration)`,
      impact: 'negative',
    };
  }

  // 2026-05: `needBlindInternational` is `Boolean?` (tri-state).
  //   true  → verified need-blind (HYPSM, Amherst, Dartmouth, Bowdoin, Brown,
  //           Notre Dame, W&L — see seed-intl-schools.ts).
  //   false → verified need-aware (Stanford, Columbia, Cornell, Penn etc.).
  //   null  → unreviewed.
  // We keep all three states distinct in the fallback path:
  //   true        -> verified need-blind multiplier
  //   false       -> verified need-aware multiplier
  //   null/absent -> unreviewed midpoint between the two
  // Verified need-aware schools that publish CDS-based intlAcceptanceRate hit
  // the data-driven path earlier and bypass this fallback entirely.
  if (overallRate != null && overallRate >= 0.2) {
    if (school.needBlindInternational === true) {
      return {
        multiplier: 0.85,
        label: 'International (need-blind, moderately selective)',
        evidence:
          'International pool sees a moderate ~0.85× penalty at this need-blind moderately-selective school',
        impact: 'negative',
      };
    }
    if (school.needBlindInternational === false) {
      return {
        multiplier: 0.7,
        label: 'International (need-aware, moderately selective)',
        evidence:
          'International pool sees a stronger ~0.70x penalty at this verified need-aware moderately-selective school.',
        impact: 'negative',
      };
    }
    return {
      multiplier: 0.78,
      label:
        'International (moderately selective; need-blind status unverified)',
      evidence:
        'Need-blind-for-intl status unverified for this school; using a midpoint ~0.78× between need-blind (0.85×) and need-aware (0.70×) at moderately-selective schools.',
      impact: 'negative',
    };
  }

  // Highly selective (10-20% admit rate): differentiated from elite tier.
  // Schools like Georgetown, Emory, Tufts, WashU — meaningful intl penalty
  // but not as severe as the HYPSM/Cornell/Northwestern tier.
  if (overallRate != null && overallRate >= 0.1) {
    if (school.needBlindInternational === true) {
      return {
        multiplier: 0.8,
        label: 'International (need-blind, highly selective)',
        evidence:
          'International pool sees a ~0.8× penalty at this need-blind highly-selective school',
        impact: 'negative',
      };
    }
    if (school.needBlindInternational === false) {
      return {
        multiplier: 0.75,
        label: 'International (need-aware, highly selective)',
        evidence:
          'International pool sees a ~0.75x penalty at this verified need-aware highly-selective school.',
        impact: 'negative',
      };
    }
    return {
      multiplier: 0.78,
      label: 'International (highly selective; need-blind status unverified)',
      evidence:
        'Need-blind-for-intl status unverified for this school; using a midpoint ~0.78× between need-blind (0.80×) and need-aware (0.75×) at highly-selective schools.',
      impact: 'negative',
    };
  }

  // Elite (< 10% admit rate, or unknown selectivity).
  // Calibrated from actual CDS 2024-25 data:
  //   need-blind: MIT 1.96%/4.55%=0.43, Yale 1.94%/3.65%=0.53,
  //               Princeton 2.11%/4.62%=0.46 → 0.50 midpoint
  //   need-aware: Cornell 0.41×, Northwestern 0.68×, Columbia 0.64×
  //               → 0.45 conservative midpoint
  if (school.needBlindInternational === true) {
    return {
      multiplier: 0.5,
      label: 'International (need-blind, elite school)',
      evidence:
        'International pool sees ~0.5× the domestic admit rate at need-blind elite schools (calibrated from MIT 1.96%/4.55%=0.43, Yale 1.94%/3.65%=0.53, Princeton 2.11%/4.62%=0.46; covers HYPSM, MIT, Princeton, Yale, Amherst, Dartmouth)',
      impact: 'negative',
    };
  }
  if (school.needBlindInternational === false) {
    return {
      multiplier: 0.45,
      label: 'International (need-aware, elite school)',
      evidence:
        'International pool sees ~0.45x the domestic admit rate at verified need-aware elite schools (calibrated from Cornell 0.41x, Northwestern 0.68x, Columbia 0.64x).',
      impact: 'negative',
    };
  }
  return {
    multiplier: 0.48,
    label: 'International (elite school; need-blind status unverified)',
    evidence:
      'Need-blind-for-intl status unverified for this school; using a midpoint ~0.48× between need-blind (0.50×) and need-aware (0.45×) at elite schools (<10% admit rate).',
    impact: 'negative',
  };
}

function makeComponent(
  multiplier: number,
  label: string,
  evidence: string,
): ModifierResult {
  return {
    multiplier,
    label,
    evidence,
    impact:
      multiplier > 1.01
        ? 'positive'
        : multiplier < 0.99
          ? 'negative'
          : 'neutral',
  };
}

function gpaTrendComponent(profile: ProfileInput): ModifierResult {
  const trend = profile.gpaTrend;
  if (!trend || trend.direction === 'insufficient' || trend.delta == null) {
    return makeComponent(
      1.0,
      'GPA trend',
      'Grade-level GPA trend is unavailable; no probability adjustment applied.',
    );
  }
  const delta = trend.delta;
  if (delta >= 0.35) {
    return makeComponent(
      1.06,
      'Rising GPA trend',
      `${trend.evidence ?? 'GPA trend'} shows a strong upward trajectory.`,
    );
  }
  if (delta >= 0.2) {
    return makeComponent(
      1.03,
      'Rising GPA trend',
      `${trend.evidence ?? 'GPA trend'} shows a modest upward trajectory.`,
    );
  }
  if (delta <= -0.35) {
    return makeComponent(
      0.95,
      'Falling GPA trend',
      `${trend.evidence ?? 'GPA trend'} shows a meaningful downward trajectory.`,
    );
  }
  if (delta <= -0.2) {
    return makeComponent(
      0.97,
      'Falling GPA trend',
      `${trend.evidence ?? 'GPA trend'} shows a modest downward trajectory.`,
    );
  }
  return makeComponent(
    1.0,
    'GPA trend',
    `${trend.evidence ?? 'GPA trend'} is broadly stable.`,
  );
}

function activityStrengthComponent(profile: ProfileInput): ModifierResult {
  const activities = profile.activities ?? [];
  if (activities.length === 0) {
    return makeComponent(
      1.0,
      'Activity strength',
      'No activity records were provided; no probability adjustment applied.',
    );
  }

  const activityDetails = activities.map((activity) => ({
    category: activity.category ?? 'OTHER',
    role: activity.role ?? '',
    totalHours:
      activity.annualHours ??
      (activity.hoursPerWeek ?? 0) * (activity.weeksPerYear ?? 0),
    tier: activity.tier,
    yearsActive: activity.yearsActive,
  }));
  const targetMajorCategory = profile.targetMajor
    ? classifyMajor(profile.targetMajor)
    : undefined;
  const activityScore = calculateActivityScore({
    activityCount: activities.length,
    awardCount: 0,
    nationalAwardCount: 0,
    internationalAwardCount: 0,
    activityDetails,
    targetMajorCategory,
  });
  const coherence = clamp(
    computeSpikeCoherence(
      activityDetails.map((activity) => ({
        category: activity.category,
        tier: activity.tier,
      })),
      targetMajorCategory,
    ),
    0.95,
    1.1,
  );
  const highTierCount = activityDetails.filter(
    (activity) => activity.tier != null && activity.tier <= 2,
  ).length;
  const leadershipCount = activityDetails.filter((activity) =>
    /(president|founder|captain|lead|chair|director|主席|创始|队长|负责人)/i.test(
      activity.role,
    ),
  ).length;
  const strongSignal =
    highTierCount > 0 ||
    leadershipCount > 0 ||
    activityDetails.some((activity) => activity.totalHours >= 200);

  if (activityScore >= 70 && strongSignal) {
    // 2026-05-24 calibration fix: was capped at ×1.06 (effectively noise).
    // Raised modestly so high-tier + leadership + 200h+ profiles get a
    // visible but bounded reward. Outer profileContext cap further bounds
    // the cumulative influence to satisfy the prediction-gate p95 ≤ 2.5pp
    // / max ≤ 8pp regression check on profile-signal delta.
    return makeComponent(
      clamp(1.07 * coherence, 1.0, 1.12),
      'Activity strength',
      `Structured activities show depth, leadership, or high-tier involvement (score ${Math.round(activityScore)}/100).`,
    );
  }
  if (activityScore >= 55 && strongSignal) {
    return makeComponent(
      1.05,
      'Activity strength',
      `Structured activities show some depth or leadership (score ${Math.round(activityScore)}/100).`,
    );
  }
  return makeComponent(
    1.0,
    'Activity strength',
    `Activities are recorded but do not create a high-confidence probability adjustment (score ${Math.round(activityScore)}/100).`,
  );
}

function awardStrengthComponent(profile: ProfileInput): ModifierResult {
  const awards = profile.awards ?? [];
  if (awards.length === 0) {
    return makeComponent(
      1.0,
      'Award strength',
      'No award records were provided; no probability adjustment applied.',
    );
  }

  const awardTierScores = awards.map((award) => {
    if (award.tier != null) {
      return TIER_POINTS[award.tier] ?? LEVEL_POINTS[award.level] ?? 3;
    }
    return LEVEL_POINTS[award.level] ?? 3;
  });
  const awardScore = calculateAwardScore({
    activityCount: 0,
    awardCount: awards.length,
    nationalAwardCount: awards.filter((award) =>
      ['NATIONAL', 'National'].includes(String(award.level)),
    ).length,
    internationalAwardCount: awards.filter((award) =>
      ['INTERNATIONAL', 'International'].includes(String(award.level)),
    ).length,
    awardTierScores,
  });
  const hasTopAward = awards.some(
    (award) =>
      ['INTERNATIONAL', 'NATIONAL', 'International', 'National'].includes(
        String(award.level),
      ) ||
      (award.tier != null && award.tier >= 4),
  );
  if (hasTopAward && awardScore >= 25) {
    // 2026-05-24 calibration fix: was ×1.07 — far too small for national/
    // international competition winners. Per NACAC + Crimson estimates,
    // true admit lift is 1.3-1.6× for these winners. Compromise at ×1.13
    // (above noise floor, but bounded by outer profileContext cap so the
    // engine's prediction-gate p95/max delta gates still pass).
    return makeComponent(
      1.13,
      'Award strength',
      `Awards include national/international or high-tier recognition (score ${Math.round(awardScore)}/100).`,
    );
  }
  if (awardScore >= 12) {
    return makeComponent(
      1.05,
      'Award strength',
      `Awards provide a modest external-validation signal (score ${Math.round(awardScore)}/100).`,
    );
  }
  return makeComponent(
    1.0,
    'Award strength',
    `Awards are recorded but do not create a high-confidence probability adjustment (score ${Math.round(awardScore)}/100).`,
  );
}

function highSchoolContextComponent(
  profile: ProfileInput,
  school: SchoolInput,
): ModifierResult {
  if (profile.highSchoolImpactEnabled === false) {
    return makeComponent(
      1.0,
      'High school context',
      'High-school impact is disabled for this school record due to data quality.',
    );
  }
  if (!profile.highSchoolTier && !profile.highSchoolRecognition) {
    return makeComponent(
      1.0,
      'High school context',
      'No structured high-school context was available; no probability adjustment applied.',
    );
  }
  const selectivity = calculateSelectivityIndex({
    acceptanceRate: school.acceptanceRate,
    sat25: school.sat25,
    sat75: school.sat75,
    graduationRate: school.graduationRate,
    usNewsRank: school.usNewsRank,
  });
  const impact = calculateHsImpact(
    profile.highSchoolTier,
    profile.highSchoolRecognition,
    selectivity,
    profile.highSchoolPlacementRecord,
    1.0,
  );
  const multiplier = clamp(Math.max(1.0, impact), 1.0, 1.04);
  return makeComponent(
    multiplier,
    'High school context',
    `Structured high-school context is included conservatively (tier ${profile.highSchoolTier ?? 'unknown'}, recognition ${profile.highSchoolRecognition ?? 'unknown'}).`,
  );
}

function englishReadinessComponent(profile: ProfileInput): ModifierResult {
  if (!profile.isInternational) {
    return makeComponent(
      1.0,
      'English readiness',
      'Domestic applicant; English proficiency test is not used for probability.',
    );
  }
  const english = profile.englishProficiency;
  if (!english) {
    // 2026-05: international applicant with no English score gets a small
    // conservative penalty rather than neutral. Prior behavior treated missing
    // as "neutral / unknown", which let very-low-English profiles slip through
    // with no down-adjustment. We keep the penalty tiny (0.98×): absence of a
    // score is an incomplete-readiness signal, not evidence of weak English, and
    // the launch gate caps profile-signal sensitivity tightly.
    return makeComponent(
      0.98,
      'English readiness',
      'No TOEFL/IELTS/Duolingo score provided; applying a tiny conservative adjustment for international applicants.',
    );
  }
  if (english.normalized >= 0.93) {
    return makeComponent(
      1.03,
      'English readiness',
      `${english.type} ${english.score} indicates strong English readiness.`,
    );
  }
  if (english.normalized < 0.75) {
    return makeComponent(
      0.96,
      'English readiness',
      `${english.type} ${english.score} is below the conservative readiness threshold for international applicants.`,
    );
  }
  if (english.normalized < 0.875) {
    return makeComponent(
      0.97,
      'English readiness',
      `${english.type} ${english.score} is adequate but below the typical strong-readiness range.`,
    );
  }
  return makeComponent(
    1.0,
    'English readiness',
    `${english.type} ${english.score} is in the neutral readiness range.`,
  );
}

function financialAidContextComponent(
  profile: ProfileInput,
  school: SchoolInput,
): ModifierResult {
  if (!profile.isInternational || profile.needsFinancialAid !== true) {
    return makeComponent(
      1.0,
      'Financial aid context',
      'No international need-aware financial-aid signal applies.',
    );
  }
  if (school.needBlindInternational === true) {
    return makeComponent(
      1.0,
      'Financial aid context',
      'This school is need-blind for international applicants; no aid penalty applied.',
    );
  }
  // 2026-05: the column is tri-state. Verified need-aware schools receive the
  // full context penalty; unreviewed schools receive a half-strength hedge.
  const overallRate = normalizeRate(school.acceptanceRate);
  const isVerifiedNeedAware = school.needBlindInternational === false;
  let multiplier =
    overallRate != null && overallRate < 0.4
      ? isVerifiedNeedAware
        ? 0.95
        : 0.975
      : isVerifiedNeedAware
        ? 0.98
        : 0.99;

  // closure-v2: refine the coarse need-aware penalty by how much demonstrated
  // need the school actually meets (CDS Section H2). A need-aware school that
  // gaps applicants (low % need met) is both harder to be admitted to with aid
  // and harder to enrol at; one meeting ~full need is admission-friction only.
  // Bounded [0.90, 1.0] — this is a yield-side signal, never a positive boost.
  // Zero-drift when percentNeedMet is unset.
  let needMetNote = '';
  const rawPnm = school.percentNeedMet;
  if (rawPnm != null && Number.isFinite(rawPnm)) {
    const pnm = rawPnm <= 1 ? rawPnm * 100 : rawPnm; // tolerate fraction storage
    if (pnm < 90) {
      multiplier *= 0.97;
      needMetNote = ` It meets only ~${pnm.toFixed(0)}% of demonstrated need (gapping), compounding the aid friction.`;
    } else if (pnm < 98) {
      multiplier *= 0.99;
      needMetNote = ` It meets ~${pnm.toFixed(0)}% of demonstrated need.`;
    } else {
      needMetNote =
        ' It meets ~full demonstrated need once a student is admitted.';
    }
    multiplier = clamp(multiplier, 0.9, 1.0);
  }

  return makeComponent(
    multiplier,
    'Financial aid context',
    (isVerifiedNeedAware
      ? 'International applicant needs financial aid at a verified need-aware school; applying the full context adjustment.'
      : 'International applicant needs financial aid, but need-blind status is unreviewed; applying a half-strength context hedge.') +
      needMetNote,
  );
}

function buildProfileSignals(
  profile: ProfileInput,
  components: Record<string, ModifierResult>,
): ProfileSignalCoverage {
  const usedInProbability = Object.entries(components)
    .filter(([, component]) => component.multiplier !== 1.0)
    .map(([key]) => key);
  const usedInExplanation = Object.entries(components)
    .filter(([, component]) => component.multiplier === 1.0)
    .map(([key]) => key);
  const missingGaps: string[] = [];
  if (!profile.gpaTrend || profile.gpaTrend.direction === 'insufficient') {
    missingGaps.push('grade-level GPA trend');
  }
  if (!profile.activities?.length) missingGaps.push('activities');
  if (!profile.awards?.length) missingGaps.push('awards');
  if (!profile.highSchoolTier && !profile.highSchoolRecognition) {
    missingGaps.push('high school context');
  }
  if (profile.isInternational && !profile.englishProficiency) {
    missingGaps.push('English proficiency');
  }

  return {
    usedInProbability,
    usedInExplanation,
    missingGaps,
    ignoredByPolicy: [
      'essays',
      'MBTI/Holland assessment',
      'budget preferences',
      'region preferences',
      'URM status',
      'unverified legacy/athlete hooks',
    ],
  };
}

export function profileContextMultiplier(
  profile: ProfileInput,
  school: SchoolInput,
): ProfileContextModifierResult {
  const components: Record<string, ModifierResult> = {
    gpaTrend: gpaTrendComponent(profile),
    activityStrength: activityStrengthComponent(profile),
    awardStrength: awardStrengthComponent(profile),
    highSchoolContext: highSchoolContextComponent(profile, school),
    englishReadiness: englishReadinessComponent(profile),
    financialAidContext: financialAidContextComponent(profile, school),
  };
  const active = Object.values(components).filter(
    (component) => component.multiplier !== 1.0,
  );
  if (active.length === 0) {
    return {
      ...PROFILE_CONTEXT_NEUTRAL,
      components,
      profileSignals: buildProfileSignals(profile, components),
    };
  }
  const geometricMean = Math.pow(
    active.reduce((product, component) => product * component.multiplier, 1),
    1 / active.length,
  );
  // 2026-05-24 calibration fix: outer cap was [0.95, 1.08] — too tight to
  // ever reward strong-EC + strong-award profiles meaningfully even after
  // per-component caps were raised. New cap [0.90, 1.13] surfaces strong
  // signals (geometric mean of award ×1.13 + activity ×1.12 ≈ ×1.12 net)
  // while staying within the prediction-gate regression bounds (p95 ≤
  // 2.5pp / max ≤ 8pp delta between with-signal and without-signal runs).
  const multiplier = clamp(geometricMean, 0.9, 1.13);
  const labels = active.map((component) => component.label).join('; ');
  return {
    multiplier,
    label: 'Profile context',
    evidence: `Structured profile signals included conservatively: ${labels}.`,
    impact:
      multiplier > 1.01
        ? 'positive'
        : multiplier < 0.99
          ? 'negative'
          : 'neutral',
    components,
    profileSignals: buildProfileSignals(profile, components),
  };
}

/**
 * Modifier #8c: Major selectivity.
 *
 * For schools with `SchoolProgram` data (currently 25 schools × ~10 majors via
 * `seed-program-rates.ts`), use `acceptanceRateEstimate` to compute a multiplier:
 *   majorMultiplier = programAdmitRate / schoolAdmitRate
 * Clamped to [0.3, 1.5] to avoid extreme values. CS at top schools is typically
 * 0.4-0.6 (e.g. CMU CS 7% vs CMU overall 17% → 0.41×).
 *
 * Caller (counselor-engine.service.ts) supplies `programAcceptanceRate` after
 * a `SchoolProgram` lookup; this function just does the math.
 */
export function majorMultiplier(
  profile: ProfileInput,
  school: SchoolInput & { acceptanceRate?: number | null },
  programAcceptanceRate: number | null,
): ModifierResult {
  if (!profile.targetMajor) {
    return { ...NEUTRAL, label: 'Major selectivity' };
  }
  if (programAcceptanceRate == null) {
    return {
      ...NEUTRAL,
      label: `Major: ${profile.targetMajor} (no program-level data)`,
    };
  }
  const schoolRate = normalizeRate(school.acceptanceRate);
  if (!schoolRate) {
    return { ...NEUTRAL, label: 'Major selectivity' };
  }
  // Both should be in same units (decimal probability)
  const ratio = programAcceptanceRate / schoolRate;
  const clamped = Math.max(0.3, Math.min(1.5, ratio));
  if (clamped < 0.85) {
    return {
      multiplier: clamped,
      label: `Major: ${profile.targetMajor} (more selective)`,
      evidence: `${profile.targetMajor} at this school admits ~${(programAcceptanceRate * 100).toFixed(0)}% vs ${(schoolRate * 100).toFixed(0)}% overall`,
      impact: 'negative',
    };
  }
  if (clamped > 1.15) {
    return {
      multiplier: clamped,
      label: `Major: ${profile.targetMajor} (less selective)`,
      evidence: `${profile.targetMajor} at this school admits ~${(programAcceptanceRate * 100).toFixed(0)}% vs ${(schoolRate * 100).toFixed(0)}% overall`,
      impact: 'positive',
    };
  }
  return {
    multiplier: 1.0,
    label: `Major: ${profile.targetMajor}`,
    evidence: `${profile.targetMajor} at this school is roughly as selective as the school overall`,
    impact: 'neutral',
  };
}
