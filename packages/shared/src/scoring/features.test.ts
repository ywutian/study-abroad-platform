import { describe, expect, it } from 'vitest';

import {
  FEATURE_NAMES_BASIC,
  FEATURE_NAMES_FULL,
  computeFeatureMedians,
  extractFeatureVector,
  extractFeaturesFromCase,
  featureVectorToArray,
  imputeFeatures,
  type CaseRecord,
  type FeatureVector,
} from './features';
import type { ProfileMetrics, SchoolMetrics } from './types';

// A baseline strong applicant with most fields present.
function baseProfile(overrides: Partial<ProfileMetrics> = {}): ProfileMetrics {
  return {
    gpa: 4.0,
    gpaScale: 4.0,
    satScore: 1500,
    actScore: 33,
    toeflScore: 110,
    activityCount: 6,
    awardCount: 3,
    nationalAwardCount: 1,
    internationalAwardCount: 1,
    ...overrides,
  };
}

// A school with full published stats (acceptance rate is a 0..100 percentage).
function baseSchool(overrides: SchoolMetrics = {}): SchoolMetrics {
  return {
    acceptanceRate: 20,
    satAvg: 1450,
    sat25: 1400,
    sat75: 1550,
    graduationRate: 95,
    usNewsRank: 25,
    ...overrides,
  };
}

describe('extractFeatureVector — normalization contract', () => {
  it('normalizes a 4.0 GPA on a 4.0 scale to gpa4 === 1.0', () => {
    const fv = extractFeatureVector(baseProfile({ gpa: 4.0, gpaScale: 4.0 }), baseSchool());
    expect(fv.gpa4).toBeCloseTo(1.0, 6);
  });

  it('normalizes SAT against 1600 and ACT against 36', () => {
    const fv = extractFeatureVector(baseProfile({ satScore: 1600, actScore: 36 }), baseSchool());
    expect(fv.satNorm).toBeCloseTo(1.0, 6);
    expect(fv.actNorm).toBeCloseTo(1.0, 6);
  });

  it('uses raw toeflScore/120 when englishProficiencyScore is absent', () => {
    const fv = extractFeatureVector(
      baseProfile({ toeflScore: 120, englishProficiencyScore: undefined }),
      baseSchool()
    );
    expect(fv.toeflNorm).toBeCloseTo(1.0, 6);
  });

  it('prefers the already-normalized englishProficiencyScore over raw toeflScore', () => {
    const fv = extractFeatureVector(
      baseProfile({ toeflScore: 80, englishProficiencyScore: 0.9 }),
      baseSchool()
    );
    // englishProficiencyScore is taken verbatim, NOT 80/120.
    expect(fv.toeflNorm).toBe(0.9);
  });

  it('caps activityCount at 15 (normalized to 1.0) and awardCount at 10', () => {
    const fv = extractFeatureVector(
      baseProfile({ activityCount: 30, awardCount: 25 }),
      baseSchool()
    );
    expect(fv.activityCount).toBe(1); // min(30,15)/15
    expect(fv.awardCount).toBe(1); // min(25,10)/10
  });

  it('sets has* missingness flags correctly for a sparse profile', () => {
    const sparse: ProfileMetrics = {
      gpa: undefined,
      satScore: undefined,
      actScore: undefined,
      toeflScore: undefined,
      activityCount: 0,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
    };
    const fv = extractFeatureVector(sparse, baseSchool());
    expect(fv.hasTestScore).toBe(0);
    expect(fv.hasToefl).toBe(0);
    expect(fv.hasActivities).toBe(0);
    expect(fv.hasIntlAward).toBe(0);
    expect(fv.hasNatlAward).toBe(0);
    // Missing numeric academics surface as NaN (encoding missingness).
    expect(Number.isNaN(fv.gpa4)).toBe(true);
    expect(Number.isNaN(fv.satNorm)).toBe(true);
    expect(Number.isNaN(fv.actNorm)).toBe(true);
    expect(Number.isNaN(fv.toeflNorm)).toBe(true);
    expect(fv.testCompleteness).toBe(0);
  });
});

describe('extractFeatureVector — test-blind handling', () => {
  it('zeroes out SAT/ACT (NaN) and hasTestScore for a test-blind school', () => {
    const blind = baseSchool({ testingPolicy: 'BLIND' });
    const fv = extractFeatureVector(baseProfile({ satScore: 1550, actScore: 35 }), blind);
    expect(fv.isTestBlindSchool).toBe(1);
    expect(Number.isNaN(fv.satNorm)).toBe(true);
    expect(Number.isNaN(fv.actNorm)).toBe(true);
    expect(fv.hasTestScore).toBe(0);
    // TOEFL is still applicable at a test-blind school.
    expect(fv.hasToefl).toBe(1);
  });

  it('keeps SAT/ACT for a non-blind (REQUIRED/OPTIONAL) school', () => {
    const fv = extractFeatureVector(
      baseProfile({ satScore: 1500 }),
      baseSchool({ testingPolicy: 'OPTIONAL' })
    );
    expect(fv.isTestBlindSchool).toBe(0);
    expect(fv.satNorm).toBeCloseTo(1500 / 1600, 6);
    expect(fv.hasTestScore).toBe(1);
  });
});

describe('extractFeatureVector — bounds & derived feature invariants', () => {
  it('keeps probability-like and normalized features within sane bounds', () => {
    const fv = extractFeatureVector(baseProfile(), baseSchool());
    // selectivity, acceptanceRate, heuristicProb, scores are 0..1.
    expect(fv.selectivity).toBeGreaterThanOrEqual(0);
    expect(fv.selectivity).toBeLessThanOrEqual(1);
    expect(fv.acceptanceRate).toBeCloseTo(0.2, 6); // 20% -> 0.20
    expect(fv.heuristicProb).toBeGreaterThanOrEqual(0);
    expect(fv.heuristicProb).toBeLessThanOrEqual(1);
    expect(fv.overallScore).toBeGreaterThanOrEqual(0);
    expect(fv.overallScore).toBeLessThanOrEqual(1);
    expect(fv.academicIndex).toBeGreaterThanOrEqual(0);
    expect(fv.academicIndex).toBeLessThanOrEqual(1);
  });

  it('computes satMidNorm from the sat25/sat75 midpoint over 1600', () => {
    const fv = extractFeatureVector(baseProfile(), baseSchool({ sat25: 1400, sat75: 1500 }));
    // midpoint 1450 / 1600
    expect(fv.satMidNorm).toBeCloseTo(1450 / 1600, 6);
  });

  it('maxAwardTier normalizes the top tier score by 25 and clamps to 1', () => {
    const lowTier = extractFeatureVector(baseProfile({ awardTierScores: [5, 8] }), baseSchool());
    expect(lowTier.maxAwardTier).toBeCloseTo(8 / 25, 6);

    const topTier = extractFeatureVector(baseProfile({ awardTierScores: [25, 40] }), baseSchool());
    expect(topTier.maxAwardTier).toBe(1); // min(40/25, 1)

    const noTier = extractFeatureVector(baseProfile({ awardTierScores: [] }), baseSchool());
    expect(noTier.maxAwardTier).toBe(0);
  });

  it('maps high-school tier 1..5 to (tier-1)/4 and defaults to 0.5 when absent', () => {
    expect(
      extractFeatureVector(baseProfile({ highSchoolTier: 1 }), baseSchool()).highSchoolTierNorm
    ).toBe(0);
    expect(
      extractFeatureVector(baseProfile({ highSchoolTier: 5 }), baseSchool()).highSchoolTierNorm
    ).toBe(1);
    expect(
      extractFeatureVector(baseProfile({ highSchoolTier: undefined }), baseSchool())
        .highSchoolTierNorm
    ).toBe(0.5);
  });
});

describe('extractFeatureVector — options (round / year / major / school cost)', () => {
  it('one-hot encodes the application round (ED vs EA vs neither)', () => {
    const ed = extractFeatureVector(baseProfile(), baseSchool(), { round: 'ed' });
    expect(ed.roundED).toBe(1);
    expect(ed.roundEA).toBe(0);

    const ea = extractFeatureVector(baseProfile(), baseSchool(), { round: 'SCEA' });
    expect(ea.roundEA).toBe(1);
    expect(ea.roundED).toBe(0);

    const rd = extractFeatureVector(baseProfile(), baseSchool(), { round: 'RD' });
    expect(rd.roundED).toBe(0);
    expect(rd.roundEA).toBe(0);
  });

  it('normalizes year via (year-2020)/10 clamped to [-0.5, 1.5]', () => {
    expect(
      extractFeatureVector(baseProfile(), baseSchool(), { year: 2025 }).applicationYear
    ).toBeCloseTo(0.5, 6);
    expect(extractFeatureVector(baseProfile(), baseSchool(), { year: 2010 }).applicationYear).toBe(
      -0.5
    ); // clamped
    expect(extractFeatureVector(baseProfile(), baseSchool(), {}).applicationYear).toBe(0); // absent
  });

  it('flags hasMajorDeclared only for a non-empty major string', () => {
    expect(
      extractFeatureVector(baseProfile(), baseSchool(), { major: 'CS' }).hasMajorDeclared
    ).toBe(1);
    expect(extractFeatureVector(baseProfile(), baseSchool(), { major: '' }).hasMajorDeclared).toBe(
      0
    );
    expect(extractFeatureVector(baseProfile(), baseSchool(), {}).hasMajorDeclared).toBe(0);
  });

  it('normalizes usNewsRank as 1 - rank/300 (clamped) and tuition by /80000', () => {
    const ranked = extractFeatureVector(baseProfile(), baseSchool(), {
      usNewsRank: 30,
      tuition: 40000,
    });
    expect(ranked.usNewsRankNorm).toBeCloseTo(1 - 30 / 300, 6);
    expect(ranked.tuitionNorm).toBeCloseTo(0.5, 6);

    // usNewsRank defaults to 0 (not NaN) when absent; tuition defaults to NaN.
    const bare = extractFeatureVector(baseProfile(), baseSchool(), {});
    expect(bare.usNewsRankNorm).toBe(0);
    expect(Number.isNaN(bare.tuitionNorm)).toBe(true);
  });

  it('marks isPrivate only when isPrivateSchool option is truthy', () => {
    expect(
      extractFeatureVector(baseProfile(), baseSchool(), { isPrivateSchool: true }).isPrivate
    ).toBe(1);
    expect(
      extractFeatureVector(baseProfile(), baseSchool(), { isPrivateSchool: false }).isPrivate
    ).toBe(0);
  });
});

describe('extractFeatureVector — activityDetails aggregation', () => {
  const details = [
    { category: 'CLUB', role: 'President', totalHours: 300 }, // leader + deep
    { category: 'VOLUNTEER', role: 'Member', totalHours: 50 }, // volunteer
    { category: 'SPORTS', role: 'Member', totalHours: 250 }, // deep only
    { category: 'CLUB', role: 'Member', totalHours: 10 }, // neither (duplicate category)
  ];

  it('derives leadership / deep-engagement / volunteer ratios from details', () => {
    const fv = extractFeatureVector(baseProfile(), baseSchool(), { activityDetails: details });
    expect(fv.leadershipRatio).toBeCloseTo(1 / 4, 6); // only President
    expect(fv.deepEngagementRatio).toBeCloseTo(2 / 4, 6); // 300h and 250h are > 200
    expect(fv.volunteerRatio).toBeCloseTo(1 / 4, 6); // VOLUNTEER category
  });

  it('normalizes category diversity by min(uniqueCategories,8)/8', () => {
    const fv = extractFeatureVector(baseProfile(), baseSchool(), { activityDetails: details });
    // unique categories: CLUB, VOLUNTEER, SPORTS = 3
    expect(fv.categoryDiversity).toBeCloseTo(3 / 8, 6);
  });

  it('leaves detail-derived ratios at 0 when no activityDetails supplied', () => {
    const fv = extractFeatureVector(baseProfile(), baseSchool());
    expect(fv.leadershipRatio).toBe(0);
    expect(fv.deepEngagementRatio).toBe(0);
    expect(fv.categoryDiversity).toBe(0);
    expect(fv.volunteerRatio).toBe(0);
    expect(fv.activityTierScore).toBe(0);
  });
});

describe('FEATURE_NAMES lists & featureVectorToArray', () => {
  it('exposes 21 basic and 46 full feature names', () => {
    expect(FEATURE_NAMES_BASIC.length).toBe(21);
    expect(FEATURE_NAMES_FULL.length).toBe(46);
  });

  it('maps a vector to a numeric array preserving feature-name order', () => {
    const fv = extractFeatureVector(baseProfile(), baseSchool());
    const arr = featureVectorToArray(fv, FEATURE_NAMES_FULL);
    expect(arr.length).toBe(FEATURE_NAMES_FULL.length);
    // gpa4 is first in the FULL list — array[0] must equal fv.gpa4.
    expect(arr[0]).toBe(fv.gpa4);
    // selectivity appears in the FULL list — value must match.
    const selIdx = FEATURE_NAMES_FULL.indexOf('selectivity');
    expect(arr[selIdx]).toBe(fv.selectivity);
  });
});

describe('imputeFeatures', () => {
  it('replaces NaN entries with the provided median, leaving present values intact', () => {
    const fv = extractFeatureVector(
      baseProfile({ satScore: undefined, actScore: undefined }),
      baseSchool()
    );
    expect(Number.isNaN(fv.satNorm)).toBe(true);
    const imputed = imputeFeatures(fv, { satNorm: 0.88 });
    expect(imputed.satNorm).toBe(0.88);
    expect(imputed.gpa4).toBe(fv.gpa4); // non-NaN preserved
  });

  it('falls back to 0 for a NaN feature with no median supplied', () => {
    const fv = extractFeatureVector(
      baseProfile({ satScore: undefined, actScore: undefined }),
      baseSchool()
    );
    const imputed = imputeFeatures(fv, {}); // no medians
    expect(imputed.satNorm).toBe(0);
    expect(imputed.actNorm).toBe(0);
  });
});

describe('computeFeatureMedians', () => {
  it('returns default medians for an empty vector set', () => {
    const medians = computeFeatureMedians([]);
    // Default median fixture has known anchor values.
    expect(medians.hasTestScore).toBe(1);
    expect(medians.gpa4).toBeCloseTo(0.88, 6);
    expect(medians.selectivity).toBeCloseTo(0.5, 6);
  });

  it('computes the per-key median ignoring NaN values (odd count)', () => {
    const mk = (gpa4: number): FeatureVector =>
      ({ ...extractFeatureVector(baseProfile(), baseSchool()), gpa4 }) as FeatureVector;
    const medians = computeFeatureMedians([mk(0.7), mk(0.9), mk(0.8)]);
    expect(medians.gpa4).toBeCloseTo(0.8, 6); // median of [0.7, 0.8, 0.9]
  });

  it('averages the two middle values for an even count', () => {
    const mk = (gpa4: number): FeatureVector =>
      ({ ...extractFeatureVector(baseProfile(), baseSchool()), gpa4 }) as FeatureVector;
    const medians = computeFeatureMedians([mk(0.6), mk(0.8), mk(0.7), mk(0.9)]);
    // sorted [0.6,0.7,0.8,0.9] -> (0.7+0.8)/2 = 0.75
    expect(medians.gpa4).toBeCloseTo(0.75, 6);
  });

  it('returns 0 for a key whose values are all NaN', () => {
    const allNaN = {
      ...extractFeatureVector(
        baseProfile({ satScore: undefined, actScore: undefined }),
        baseSchool({ testingPolicy: 'BLIND' })
      ),
    } as FeatureVector;
    // satNorm is NaN for a test-blind school.
    expect(Number.isNaN(allNaN.satNorm)).toBe(true);
    const medians = computeFeatureMedians([allNaN, allNaN]);
    expect(medians.satNorm).toBe(0);
  });
});

describe('extractFeaturesFromCase', () => {
  function caseRecord(overrides: Partial<CaseRecord> = {}): CaseRecord {
    return {
      gpaRange: '3.8-4.0',
      satRange: '1500-1550',
      tags: [],
      result: 'REJECTED',
      ...overrides,
    };
  }

  it('labels ADMITTED as 1 and everything else as 0', () => {
    const admitted = extractFeaturesFromCase(caseRecord({ result: 'ADMITTED' }), baseSchool());
    const rejected = extractFeaturesFromCase(caseRecord({ result: 'REJECTED' }), baseSchool());
    const waitlisted = extractFeaturesFromCase(caseRecord({ result: 'WAITLISTED' }), baseSchool());
    expect(admitted.label).toBe(1);
    expect(rejected.label).toBe(0);
    expect(waitlisted.label).toBe(0);
  });

  it('parses GPA/SAT ranges to their midpoints in the feature vector', () => {
    const { features } = extractFeaturesFromCase(
      caseRecord({ gpaRange: '3.8-4.0', satRange: '1500-1600' }),
      baseSchool({ testingPolicy: 'REQUIRED' })
    );
    // GPA midpoint 3.9 on a 4.0 scale -> gpa4 = 3.9/4
    expect(features.gpa4).toBeCloseTo(3.9 / 4, 6);
    // SAT midpoint 1550 / 1600
    expect(features.satNorm).toBeCloseTo(1550 / 1600, 6);
  });

  it('weights cases with >=2 academic ranges at 1.0, sparse ones at 0.5', () => {
    const rich = extractFeaturesFromCase(
      caseRecord({ gpaRange: '3.8-4.0', satRange: '1500-1550' }),
      baseSchool()
    );
    const sparse = extractFeaturesFromCase(
      caseRecord({ gpaRange: '3.8-4.0', satRange: null, actRange: null, toeflRange: null }),
      baseSchool()
    );
    expect(rich.weight).toBe(1.0);
    expect(sparse.weight).toBe(0.5);
  });

  it('infers higher activity/award presence from tags', () => {
    const withTags = extractFeaturesFromCase(
      caseRecord({ tags: ['strong_activities', 'international_award'] }),
      baseSchool()
    );
    const withoutTags = extractFeaturesFromCase(caseRecord({ tags: [] }), baseSchool());
    // strong_activities -> 8 activities, plain -> 4: normalized 8/15 > 4/15.
    expect(withTags.features.activityCount).toBeGreaterThan(withoutTags.features.activityCount);
    expect(withTags.features.hasIntlAward).toBe(1);
    expect(withoutTags.features.hasIntlAward).toBe(0);
  });
});
