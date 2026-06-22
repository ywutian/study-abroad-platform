import { describe, expect, it } from 'vitest';

import {
  logit,
  invLogit,
  adjustInLogOdds,
  getMajorSelectivityMultiplier,
  calculateAcademicScore,
  calculateActivityScore,
  calculateAwardScore,
  computeTierFromDimensions,
  getGpaWeight,
  calculateHsImpact,
  calculateOverallScore,
  calculateOverallScoreDetailed,
  calculateScoreBreakdown,
  calculateSelectivityIndex,
  calculateProbability,
  calculateTier,
  calculateConfidence,
  enforceMonotonicity,
  TIER_THRESHOLDS,
} from './score';
import type { ProfileMetrics, SchoolMetrics } from './types';

// A minimal but complete ProfileMetrics — the interface requires these counts.
function baseProfile(overrides: Partial<ProfileMetrics> = {}): ProfileMetrics {
  return {
    activityCount: 0,
    awardCount: 0,
    nationalAwardCount: 0,
    internationalAwardCount: 0,
    ...overrides,
  };
}

// ============================================
// Log-odds utilities
// ============================================

describe('logit / invLogit', () => {
  it('logit(0.5) is 0 and invLogit(0) is 0.5 (inverse at the midpoint)', () => {
    expect(logit(0.5)).toBeCloseTo(0, 12);
    expect(invLogit(0)).toBeCloseTo(0.5, 12);
  });

  it('logit and invLogit round-trip for an interior probability', () => {
    expect(invLogit(logit(0.3))).toBeCloseTo(0.3, 10);
    expect(invLogit(logit(0.85))).toBeCloseTo(0.85, 10);
  });

  it('logit clamps extreme inputs to avoid ±Infinity', () => {
    // 0 and 1 are clamped to 0.001 / 0.999 — finite, symmetric.
    expect(Number.isFinite(logit(0))).toBe(true);
    expect(Number.isFinite(logit(1))).toBe(true);
    expect(logit(0)).toBeCloseTo(-logit(1), 10);
    // Anything below the clamp collapses to the same value as the clamp.
    expect(logit(-5)).toBe(logit(0));
    expect(logit(5)).toBe(logit(1));
  });

  it('invLogit is bounded in (0,1) and monotonic increasing', () => {
    expect(invLogit(-50)).toBeGreaterThanOrEqual(0);
    expect(invLogit(50)).toBeLessThanOrEqual(1);
    expect(invLogit(-2)).toBeLessThan(invLogit(2));
  });
});

describe('adjustInLogOdds', () => {
  it('a zero shift leaves an interior probability unchanged', () => {
    expect(adjustInLogOdds(0.4, 0)).toBeCloseTo(0.4, 10);
  });

  it('a positive shift raises probability, a negative shift lowers it', () => {
    expect(adjustInLogOdds(0.3, 1)).toBeGreaterThan(0.3);
    expect(adjustInLogOdds(0.3, -1)).toBeLessThan(0.3);
  });

  it('never escapes [0,1] even for a huge boost (unlike p*multiplier)', () => {
    expect(adjustInLogOdds(0.9, 10)).toBeLessThanOrEqual(1);
    expect(adjustInLogOdds(0.9, 10)).toBeGreaterThan(0.9);
    expect(adjustInLogOdds(0.1, -10)).toBeGreaterThanOrEqual(0);
  });
});

describe('getMajorSelectivityMultiplier', () => {
  it('maps each competitiveness level to its reference multiplier', () => {
    expect(getMajorSelectivityMultiplier(5)).toBe(0.3);
    expect(getMajorSelectivityMultiplier(4)).toBe(0.5);
    expect(getMajorSelectivityMultiplier(3)).toBe(1.0);
    expect(getMajorSelectivityMultiplier(2)).toBe(1.3);
    expect(getMajorSelectivityMultiplier(1)).toBe(1.5);
  });

  it('falls back to 1.0 for an unknown level', () => {
    expect(getMajorSelectivityMultiplier(0)).toBe(1.0);
    expect(getMajorSelectivityMultiplier(99)).toBe(1.0);
  });

  it('is monotonic: more competitive major → lower multiplier', () => {
    expect(getMajorSelectivityMultiplier(5)).toBeLessThan(getMajorSelectivityMultiplier(3));
    expect(getMajorSelectivityMultiplier(3)).toBeLessThan(getMajorSelectivityMultiplier(1));
  });
});

// ============================================
// getGpaWeight
// ============================================

describe('getGpaWeight', () => {
  it('returns the neutral default (0.5/0.5, adj 1.0) with no inputs', () => {
    const { gpaWeight, testWeight, gpaAdjustment } = getGpaWeight();
    expect(gpaWeight).toBe(0.5);
    expect(testWeight).toBe(0.5);
    expect(gpaAdjustment).toBe(1.0);
  });

  it('gpaWeight + testWeight always sum to 1.0', () => {
    const a = getGpaWeight(5, 5, 'deflation');
    expect(a.gpaWeight + a.testWeight).toBeCloseTo(1.0, 12);
    const b = getGpaWeight(1);
    expect(b.gpaWeight + b.testWeight).toBeCloseTo(1.0, 12);
  });

  it('recognition drives gpaWeight: 5 → 0.35 + 5*0.05 = 0.6', () => {
    expect(getGpaWeight(5).gpaWeight).toBeCloseTo(0.6, 10);
    expect(getGpaWeight(1).gpaWeight).toBeCloseTo(0.4, 10);
  });

  it('academicRigor adjusts GPA value: 5 → 0.94 + 5*0.03 = 1.09', () => {
    expect(getGpaWeight(undefined, 5).gpaAdjustment).toBeCloseTo(1.09, 10);
    expect(getGpaWeight(undefined, 1).gpaAdjustment).toBeCloseTo(0.97, 10);
  });

  it('gradeInflation fine-tunes independently of recognition/rigor', () => {
    // deflation bumps +0.03, inflation discounts -0.03 — works alone.
    expect(getGpaWeight(undefined, undefined, 'deflation').gpaAdjustment).toBeCloseTo(1.03, 10);
    expect(getGpaWeight(undefined, undefined, 'inflation').gpaAdjustment).toBeCloseTo(0.97, 10);
  });
});

// ============================================
// calculateAcademicScore
// ============================================

describe('calculateAcademicScore', () => {
  it('GPA-only reference: 3.0/4.0 → base 45 + (0.75*36) - 18 = 54', () => {
    const score = calculateAcademicScore(baseProfile({ gpa: 3.0 }), {});
    expect(score).toBeCloseTo(54, 6);
  });

  it('a 4.0 GPA scores higher than a 3.0 GPA (monotonic in GPA)', () => {
    const low = calculateAcademicScore(baseProfile({ gpa: 3.0 }), {});
    const high = calculateAcademicScore(baseProfile({ gpa: 4.0 }), {});
    expect(high).toBeGreaterThan(low);
  });

  it('result is always clamped to [0,100]', () => {
    const high = calculateAcademicScore(
      baseProfile({ gpa: 4.0, satScore: 1600, englishProficiencyScore: 1, apCount: 12 }),
      { sat25: 1400, sat75: 1500 }
    );
    expect(high).toBeLessThanOrEqual(100);
    expect(high).toBeGreaterThanOrEqual(0);
  });

  it('ignores SAT when the school is test-blind', () => {
    const profile = baseProfile({ gpa: 3.5, satScore: 1600 });
    const withSat = calculateAcademicScore(profile, { sat25: 1300, sat75: 1450 });
    const blind = calculateAcademicScore(profile, {
      sat25: 1300,
      sat75: 1450,
      testingPolicy: 'BLIND',
    });
    // A strong SAT lifts the score; under BLIND it must be ignored.
    expect(withSat).toBeGreaterThan(blind);
  });

  it('a high SAT vs the school band raises the score above GPA-only', () => {
    const gpaOnly = calculateAcademicScore(baseProfile({ gpa: 3.5 }), {});
    const withSat = calculateAcademicScore(baseProfile({ gpa: 3.5, satScore: 1550 }), {
      sat25: 1300,
      sat75: 1450,
    });
    expect(withSat).toBeGreaterThan(gpaOnly);
  });

  it('a sub-90 TOEFL incurs the hard penalty (legacy raw path)', () => {
    const passing = calculateAcademicScore(baseProfile({ gpa: 3.5, toeflScore: 105 }), {});
    const failing = calculateAcademicScore(baseProfile({ gpa: 3.5, toeflScore: 80 }), {});
    expect(failing).toBeLessThan(passing);
  });

  it('IB curriculum adds +3 over an otherwise identical profile', () => {
    const plain = calculateAcademicScore(baseProfile({ gpa: 3.5 }), {});
    const ib = calculateAcademicScore(baseProfile({ gpa: 3.5, educationSystem: 'IB' }), {});
    expect(ib - plain).toBeCloseTo(3, 6);
  });

  it('8+ APs add +2; 5-7 APs add +1', () => {
    const plain = calculateAcademicScore(baseProfile({ gpa: 3.5 }), {});
    const fiveAp = calculateAcademicScore(baseProfile({ gpa: 3.5, apCount: 5 }), {});
    const eightAp = calculateAcademicScore(baseProfile({ gpa: 3.5, apCount: 8 }), {});
    expect(fiveAp - plain).toBeCloseTo(1, 6);
    expect(eightAp - plain).toBeCloseTo(2, 6);
  });

  it('with no GPA at all, score stays at the base (45) absent other signals', () => {
    expect(calculateAcademicScore(baseProfile(), {})).toBeCloseTo(45, 6);
  });
});

// ============================================
// calculateActivityScore
// ============================================

describe('calculateActivityScore', () => {
  it('count-based fallback: 0 activities → base 25', () => {
    expect(calculateActivityScore(baseProfile({ activityCount: 0 }))).toBe(25);
  });

  it('count-based fallback reference: 10 activities → 25 + 40 + 8 + 7 = 80', () => {
    expect(calculateActivityScore(baseProfile({ activityCount: 10 }))).toBe(80);
  });

  it('count-based fallback is monotonic non-decreasing in activityCount', () => {
    const c3 = calculateActivityScore(baseProfile({ activityCount: 3 }));
    const c6 = calculateActivityScore(baseProfile({ activityCount: 6 }));
    const c10 = calculateActivityScore(baseProfile({ activityCount: 10 }));
    expect(c6).toBeGreaterThanOrEqual(c3);
    expect(c10).toBeGreaterThanOrEqual(c6);
  });

  it('detailed path: a tier-1 leadership activity outscores a generic one', () => {
    const generic = calculateActivityScore(
      baseProfile({
        activityCount: 1,
        activityDetails: [{ category: 'CLUB', role: 'member', totalHours: 10, tier: 4 }],
      })
    );
    const elite = calculateActivityScore(
      baseProfile({
        activityCount: 1,
        activityDetails: [
          { category: 'RESEARCH', role: 'President', totalHours: 400, tier: 1, yearsActive: 4 },
        ],
      })
    );
    expect(elite).toBeGreaterThan(generic);
  });

  it('detailed path: spike alignment with target major adds points', () => {
    const details = [
      { category: 'RESEARCH', role: 'member', totalHours: 50, tier: 3 },
      { category: 'ACADEMIC', role: 'member', totalHours: 50, tier: 3 },
    ];
    const unaligned = calculateActivityScore(
      baseProfile({ activityCount: 2, activityDetails: details })
    );
    const aligned = calculateActivityScore(
      baseProfile({ activityCount: 2, activityDetails: details, targetMajorCategory: 'STEM' })
    );
    expect(aligned).toBeGreaterThan(unaligned);
  });

  it('result is clamped to [0,100] even with many strong activities', () => {
    const details = Array.from({ length: 12 }, (_, i) => ({
      category: ['ACADEMIC', 'RESEARCH', 'INTERNSHIP', 'CLUB', 'ARTS'][i % 5],
      role: 'President',
      totalHours: 500,
      tier: 1,
      yearsActive: 4,
    }));
    const score = calculateActivityScore(
      baseProfile({ activityCount: 12, activityDetails: details, targetMajorCategory: 'STEM' })
    );
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// calculateAwardScore
// ============================================

describe('calculateAwardScore', () => {
  it('count-based fallback: no awards → base 20', () => {
    expect(calculateAwardScore(baseProfile())).toBe(20);
  });

  it('count-based reference: 1 international award → 20 + 20 = 40', () => {
    const score = calculateAwardScore(baseProfile({ awardCount: 1, internationalAwardCount: 1 }));
    expect(score).toBe(40);
  });

  it('tier-score path sums tier points and clamps to 100', () => {
    expect(calculateAwardScore(baseProfile({ awardTierScores: [25, 15] }))).toBe(40);
    expect(calculateAwardScore(baseProfile({ awardTierScores: [60, 60, 60] }))).toBe(100);
  });

  it('international awards weigh more than national, national more than other', () => {
    const intl = calculateAwardScore(baseProfile({ awardCount: 1, internationalAwardCount: 1 }));
    const natl = calculateAwardScore(baseProfile({ awardCount: 1, nationalAwardCount: 1 }));
    const other = calculateAwardScore(baseProfile({ awardCount: 1 }));
    expect(intl).toBeGreaterThan(natl);
    expect(natl).toBeGreaterThan(other);
  });
});

// ============================================
// computeTierFromDimensions
// ============================================

describe('computeTierFromDimensions', () => {
  it('returns the weighted rounded tier for a full evaluation', () => {
    // All 5s → tier 5; all 1s → tier 1.
    expect(computeTierFromDimensions(5, 5, 5, 5, 5)).toBe(5);
    expect(computeTierFromDimensions(1, 1, 1, 1, 1)).toBe(1);
  });

  it('a mixed mid evaluation lands in the middle of the 1-5 range', () => {
    const tier = computeTierFromDimensions(3, 3, 3, 3, 3);
    expect(tier).toBe(3);
  });
});

// ============================================
// calculateHsImpact
// ============================================

describe('calculateHsImpact', () => {
  it('returns a neutral 1.0 when tier is missing', () => {
    expect(calculateHsImpact(undefined, 5, 0.9, 5)).toBe(1.0);
  });

  it('a top-tier HS boosts above 1.0 at a selective school', () => {
    expect(calculateHsImpact(5, 5, 1.0, 5)).toBeGreaterThan(1.0);
  });

  it('a bottom-tier HS drags below 1.0', () => {
    expect(calculateHsImpact(1, undefined, 0.9)).toBeLessThan(1.0);
  });

  it('the effect is stronger at more selective schools (selectivity scaling)', () => {
    const lowSel = calculateHsImpact(5, 5, 0.2, 5);
    const highSel = calculateHsImpact(5, 5, 0.95, 5);
    // Both above 1.0, but the high-selectivity boost is larger.
    expect(highSel - 1.0).toBeGreaterThan(lowSel - 1.0);
  });

  it('hsConfidenceScale attenuates the deviation from 1.0', () => {
    const full = calculateHsImpact(5, 5, 0.9, 5, 1.0);
    const half = calculateHsImpact(5, 5, 0.9, 5, 0.5);
    const none = calculateHsImpact(5, 5, 0.9, 5, 0.0);
    expect(none).toBe(1.0);
    // Half confidence → exactly half the deviation from neutral.
    expect(half - 1.0).toBeCloseTo((full - 1.0) / 2, 10);
  });
});

// ============================================
// calculateSelectivityIndex
// ============================================

describe('calculateSelectivityIndex', () => {
  it('returns the neutral prior 0.5 with no signals', () => {
    expect(calculateSelectivityIndex({})).toBe(0.5);
  });

  it('output is bounded in [0,1]', () => {
    const elite = calculateSelectivityIndex({
      acceptanceRate: 4,
      sat25: 1500,
      sat75: 1570,
      graduationRate: 98,
      usNewsRank: 1,
    });
    expect(elite).toBeLessThanOrEqual(1);
    expect(elite).toBeGreaterThanOrEqual(0);
  });

  it('a lower acceptance rate → higher selectivity (monotonic)', () => {
    const elite = calculateSelectivityIndex({ acceptanceRate: 5 });
    const open = calculateSelectivityIndex({ acceptanceRate: 80 });
    expect(elite).toBeGreaterThan(open);
  });

  it('accepts acceptanceRate as a fraction (<1) and as a percentage', () => {
    // 0.05 fraction and 5 percent should both mean 5% → same selectivity.
    expect(calculateSelectivityIndex({ acceptanceRate: 0.05 })).toBeCloseTo(
      calculateSelectivityIndex({ acceptanceRate: 5 }),
      10
    );
  });

  it('region competitiveness multiplier increases selectivity', () => {
    const school: SchoolMetrics = { acceptanceRate: 20 };
    const base = calculateSelectivityIndex(school);
    const china = calculateSelectivityIndex(school, { applicantRegion: 'CN' });
    expect(china).toBeGreaterThan(base);
    expect(china).toBeLessThanOrEqual(1);
  });
});

// ============================================
// calculateProbability
// ============================================

describe('calculateProbability', () => {
  it('output is bounded between the dynamic floor (AR*0.02) and 0.97', () => {
    const school: SchoolMetrics = { acceptanceRate: 40 };
    const weak = calculateProbability(0, school);
    const strong = calculateProbability(100, school);
    expect(weak).toBeGreaterThanOrEqual((40 / 100) * 0.02);
    expect(strong).toBeLessThanOrEqual(0.97);
  });

  it('a stronger applicant gets a higher probability at the same school', () => {
    const school: SchoolMetrics = { acceptanceRate: 30, sat25: 1300, sat75: 1500 };
    expect(calculateProbability(85, school)).toBeGreaterThan(calculateProbability(60, school));
  });

  it('an easier school (higher AR) yields higher probability for the same score', () => {
    const easy: SchoolMetrics = { acceptanceRate: 70 };
    const hard: SchoolMetrics = { acceptanceRate: 5 };
    expect(calculateProbability(70, easy)).toBeGreaterThan(calculateProbability(70, hard));
  });

  it('a neutral-threshold student is anchored near the acceptance rate', () => {
    // threshold = 30 + 0.5*45 = 52.5 when selectivity is the 0.5 prior (no school data).
    // At z=0 the probability ≈ AR. AR defaults to 30 → 0.30 when no rate provided.
    const p = calculateProbability(52.5, {});
    expect(p).toBeCloseTo(0.3, 2);
  });
});

// ============================================
// calculateTier
// ============================================

describe('calculateTier', () => {
  it('classifies by the shared thresholds', () => {
    expect(calculateTier(0.05, {})).toBe('reach');
    expect(calculateTier(TIER_THRESHOLDS.MATCH_MIN, {})).toBe('match');
    expect(calculateTier(0.4, {})).toBe('match');
    expect(calculateTier(TIER_THRESHOLDS.SAFETY_MIN, {})).toBe('safety');
    expect(calculateTier(0.9, {})).toBe('safety');
  });

  it('the boundaries are inclusive at MATCH_MIN and SAFETY_MIN', () => {
    expect(TIER_THRESHOLDS.MATCH_MIN).toBe(0.1);
    expect(TIER_THRESHOLDS.SAFETY_MIN).toBe(0.6);
    expect(calculateTier(0.0999, {})).toBe('reach');
    expect(calculateTier(0.5999, {})).toBe('match');
  });
});

// ============================================
// calculateConfidence
// ============================================

describe('calculateConfidence', () => {
  it('low when there is barely any data', () => {
    expect(calculateConfidence(baseProfile(), {})).toBe('low');
  });

  it('high when 5+ data points are present', () => {
    const profile = baseProfile({
      gpa: 3.8,
      satScore: 1500,
      activityCount: 5,
      awardCount: 2,
    });
    const school: SchoolMetrics = { acceptanceRate: 10, satAvg: 1450 };
    expect(calculateConfidence(profile, school)).toBe('high');
  });

  it('medium for an intermediate amount of data', () => {
    const profile = baseProfile({ gpa: 3.8, satScore: 1500, activityCount: 3 });
    expect(calculateConfidence(profile, {})).toBe('medium');
  });
});

// ============================================
// Overall score composition
// ============================================

describe('calculateOverallScore / Detailed / Breakdown', () => {
  const profile = baseProfile({
    gpa: 3.8,
    satScore: 1500,
    activityCount: 8,
    awardCount: 2,
    internationalAwardCount: 1,
  });
  const school: SchoolMetrics = { acceptanceRate: 15, sat25: 1400, sat75: 1550 };

  it('overall equals the weighted academic/activity/award when HS impact is neutral (no HS data)', () => {
    const breakdown = calculateScoreBreakdown(profile, school);
    // No HS data → hsImpact 1.0 → overall = 0.5*A + 0.3*Act + 0.2*Award.
    const expected = breakdown.academic * 0.5 + breakdown.activity * 0.3 + breakdown.award * 0.2;
    expect(breakdown.overall).toBeCloseTo(expected, 6);
  });

  it('calculateOverallScore matches the .score of the detailed result', () => {
    expect(calculateOverallScore(profile, school)).toBeCloseTo(
      calculateOverallScoreDetailed(profile, school).score,
      10
    );
  });

  it('detailed result surfaces hsConfidence and hsImpact metadata', () => {
    const detailed = calculateOverallScoreDetailed(profile, school);
    // No HS data → confidence "none", impact neutral.
    expect(detailed.hsConfidence.level).toBe('none');
    expect(detailed.hsImpact).toBe(1.0);
  });

  it('strong HS data with a tier scales the overall away from the no-HS baseline', () => {
    const withHs = baseProfile({
      ...profile,
      highSchoolTier: 5,
      highSchoolRecognition: 5,
      highSchoolAcademicRigor: 5,
      highSchoolPlacementRecord: 5,
      highSchoolStudentQuality: 5,
      highSchoolResources: 5,
    });
    const eliteSchool: SchoolMetrics = { acceptanceRate: 4, sat25: 1500, sat75: 1570 };
    const detailed = calculateOverallScoreDetailed(withHs, eliteSchool);
    expect(detailed.hsConfidence.level).toBe('high');
    expect(detailed.hsImpact).toBeGreaterThan(1.0);
  });
});

// ============================================
// enforceMonotonicity (PAV)
// ============================================

interface PredRow {
  probability: number;
  tier: 'reach' | 'match' | 'safety';
  schoolMeta?: { acceptanceRate?: number };
}

describe('enforceMonotonicity', () => {
  it('is a no-op when fewer than 2 rows carry selectivity data', () => {
    const rows: PredRow[] = [
      { probability: 0.2, tier: 'match', schoolMeta: { acceptanceRate: 30 } },
    ];
    enforceMonotonicity(rows);
    expect(rows[0].probability).toBe(0.2);
  });

  it('repairs a violation: the easier school must not end up below the harder one', () => {
    // Easy school (AR 60) wrongly has a lower probability than the hard one (AR 5).
    const easy: PredRow = { probability: 0.2, tier: 'match', schoolMeta: { acceptanceRate: 60 } };
    const hard: PredRow = { probability: 0.5, tier: 'match', schoolMeta: { acceptanceRate: 5 } };
    enforceMonotonicity([easy, hard]);
    // After PAV the easier (less selective) school's probability must be >= the harder one.
    expect(easy.probability).toBeGreaterThanOrEqual(hard.probability);
  });

  it('leaves an already-monotonic set essentially unchanged', () => {
    const easy: PredRow = { probability: 0.5, tier: 'match', schoolMeta: { acceptanceRate: 60 } };
    const hard: PredRow = { probability: 0.2, tier: 'match', schoolMeta: { acceptanceRate: 5 } };
    enforceMonotonicity([easy, hard]);
    // Order already correct (easier > harder) → values preserved.
    expect(easy.probability).toBeCloseTo(0.5, 6);
    expect(hard.probability).toBeCloseTo(0.2, 6);
  });
});
