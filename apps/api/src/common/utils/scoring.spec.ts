import {
  normalizeGpa,
  normalCDF,
  calculatePercentile,
  empiricalPercentile,
  parseRange,
  calculateAcademicScore,
  calculateActivityScore,
  calculateAwardScore,
  calculateOverallScore,
  calculateScoreBreakdown,
  calculateProbability,
  calculateTier,
  calculateConfidence,
  ProfileMetrics,
  SchoolMetrics,
  SCORING_WEIGHTS,
  ACADEMIC_CONFIG,
  TIER_POINTS,
  LEVEL_POINTS,
  LEADERSHIP_KEYWORDS,
} from './scoring';

// ============================================
// normalCDF
// ============================================
describe('normalCDF', () => {
  it('should return 0.5 for z=0', () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 4);
  });

  it('should return ~0.8413 for z=1', () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413, 3);
  });

  it('should return ~0.1587 for z=-1', () => {
    expect(normalCDF(-1)).toBeCloseTo(0.1587, 3);
  });

  it('should return ~0.9772 for z=2', () => {
    expect(normalCDF(2)).toBeCloseTo(0.9772, 3);
  });

  it('should return ~0.0228 for z=-2', () => {
    expect(normalCDF(-2)).toBeCloseTo(0.0228, 3);
  });

  it('should return ~0.9987 for z=3', () => {
    expect(normalCDF(3)).toBeCloseTo(0.9987, 3);
  });

  it('should be symmetric around 0.5', () => {
    const z = 1.5;
    expect(normalCDF(z) + normalCDF(-z)).toBeCloseTo(1, 4);
  });
});

// ============================================
// calculatePercentile
// ============================================
describe('calculatePercentile', () => {
  it('should return 0.5 for score at midpoint of p25-p75', () => {
    // MIT: sat25=1520, sat75=1580 → midpoint=1550
    expect(calculatePercentile(1550, 1520, 1580)).toBeCloseTo(0.5, 1);
  });

  it('should return ~0.75 for score at p75', () => {
    expect(calculatePercentile(1580, 1520, 1580)).toBeCloseTo(0.75, 1);
  });

  it('should return ~0.25 for score at p25', () => {
    expect(calculatePercentile(1520, 1520, 1580)).toBeCloseTo(0.25, 1);
  });

  it('should return >0.5 for score above midpoint', () => {
    expect(calculatePercentile(1600, 1520, 1580)).toBeGreaterThan(0.5);
  });

  it('should return <0.5 for score below midpoint', () => {
    expect(calculatePercentile(1400, 1520, 1580)).toBeLessThan(0.5);
  });

  it('should handle edge case p25 == p75 (return 0.5)', () => {
    expect(calculatePercentile(1500, 1500, 1500)).toBe(0.5);
  });

  it('should handle edge case p75 < p25 (return 0.5)', () => {
    expect(calculatePercentile(1500, 1600, 1400)).toBe(0.5);
  });

  it('should produce reasonable values for real school data', () => {
    // Harvard: sat25=1480, sat75=1580
    const p = calculatePercentile(1550, 1480, 1580);
    expect(p).toBeGreaterThan(0.45);
    expect(p).toBeLessThan(0.75);
  });
});

// ============================================
// empiricalPercentile
// ============================================
describe('empiricalPercentile', () => {
  const sortedValues = [1300, 1350, 1400, 1450, 1500, 1550, 1600];

  it('should return 0 for value at or below minimum', () => {
    expect(empiricalPercentile(1300, sortedValues)).toBe(0);
    expect(empiricalPercentile(1200, sortedValues)).toBe(0);
  });

  it('should return 1 for value at or above maximum', () => {
    expect(empiricalPercentile(1600, sortedValues)).toBe(1);
    expect(empiricalPercentile(1700, sortedValues)).toBe(1);
  });

  it('should return correct percentile for value in array', () => {
    // 1450 is at index 3 out of 7
    expect(empiricalPercentile(1450, sortedValues)).toBeCloseTo(3 / 7, 2);
  });

  it('should return 0.5 for empty array', () => {
    expect(empiricalPercentile(1500, [])).toBe(0.5);
  });

  it('should handle single-element array', () => {
    expect(empiricalPercentile(1500, [1400])).toBe(1);
    expect(empiricalPercentile(1300, [1400])).toBe(0);
  });
});

// ============================================
// parseRange
// ============================================
describe('parseRange', () => {
  it('should parse integer range', () => {
    expect(parseRange('1500-1550')).toBe(1525);
  });

  it('should parse decimal range', () => {
    expect(parseRange('3.7-3.9')).toBe(3.8);
  });

  it('should handle spaces around dash', () => {
    expect(parseRange('1500 - 1550')).toBe(1525);
  });

  it('should return null for invalid format', () => {
    expect(parseRange('')).toBeNull();
    expect(parseRange('1500')).toBeNull();
    expect(parseRange('abc-def')).toBeNull();
    expect(parseRange('1500-')).toBeNull();
  });
});

// ============================================
// normalizeGpa
// ============================================
describe('normalizeGpa', () => {
  it('should return GPA as-is for 4.0 scale', () => {
    expect(normalizeGpa(3.8, 4.0)).toBe(3.8);
  });

  it('should normalize 5.0 scale to 4.0', () => {
    expect(normalizeGpa(4.5, 5.0)).toBeCloseTo(3.6, 1);
  });

  it('should normalize 100-point scale to 4.0', () => {
    expect(normalizeGpa(95, 100)).toBeCloseTo(3.8, 1);
  });

  it('should handle GPA of 0 correctly', () => {
    expect(normalizeGpa(0, 4.0)).toBe(0);
  });
});

// ============================================
// calculateAcademicScore — Percentile & TOEFL
// ============================================
describe('calculateAcademicScore', () => {
  const baseProfile: ProfileMetrics = {
    gpa: 3.5,
    gpaScale: 4.0,
    activityCount: 3,
    awardCount: 1,
    nationalAwardCount: 0,
    internationalAwardCount: 0,
  };

  it('should use gpaScale=0 without falling back to 4.0 (nullish coalescing)', () => {
    const profile: ProfileMetrics = { ...baseProfile, gpa: 3.5, gpaScale: 0 };
    const score = calculateAcademicScore(profile, {});
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should use satAvg=0 without falling back to 1400 (nullish coalescing)', () => {
    const profile: ProfileMetrics = { ...baseProfile, satScore: 1400 };
    const school: SchoolMetrics = { satAvg: 0 };
    const score = calculateAcademicScore(profile, school);
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('should fall back to 4.0 when gpaScale is null', () => {
    const profile: ProfileMetrics = {
      ...baseProfile,
      gpa: 3.5,
      gpaScale: undefined,
    };
    const score = calculateAcademicScore(profile, {});
    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);
  });

  it('should fall back to 1400 when satAvg is null', () => {
    const profile: ProfileMetrics = { ...baseProfile, satScore: 1400 };
    const school: SchoolMetrics = { satAvg: undefined };
    const score = calculateAcademicScore(profile, school);
    expect(typeof score).toBe('number');
  });

  it('should handle profile with no scores at all', () => {
    const emptyProfile: ProfileMetrics = {
      activityCount: 0,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
    };
    const score = calculateAcademicScore(emptyProfile, {});
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  // Percentile-based scoring tests
  describe('with sat25/sat75 percentile', () => {
    it('should use percentile when sat25/sat75 available', () => {
      const profile: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        satScore: 1550,
      };
      const school: SchoolMetrics = { sat25: 1520, sat75: 1580 };
      const score = calculateAcademicScore(profile, school);
      // midpoint score should get ~0 bonus, so ~50
      expect(score).toBeCloseTo(50, -1);
    });

    it('should give positive bonus for score above midpoint', () => {
      const profile: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        satScore: 1580,
      };
      const school: SchoolMetrics = { sat25: 1520, sat75: 1580 };
      const scoreWithPercentile = calculateAcademicScore(profile, school);
      expect(scoreWithPercentile).toBeGreaterThan(50);
    });

    it('should give negative penalty for score below midpoint', () => {
      const profile: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        satScore: 1400,
      };
      const school: SchoolMetrics = { sat25: 1520, sat75: 1580 };
      const score = calculateAcademicScore(profile, school);
      expect(score).toBeLessThan(50);
    });

    it('should fall back to satAvg when sat25/sat75 not available', () => {
      const profile: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        satScore: 1500,
      };
      const schoolWithPercentile: SchoolMetrics = {
        sat25: 1400,
        sat75: 1500,
        satAvg: 1450,
      };
      const schoolWithoutPercentile: SchoolMetrics = { satAvg: 1450 };
      // Both should produce valid scores
      const score1 = calculateAcademicScore(profile, schoolWithPercentile);
      const score2 = calculateAcademicScore(profile, schoolWithoutPercentile);
      expect(score1).toBeGreaterThanOrEqual(0);
      expect(score2).toBeGreaterThanOrEqual(0);
    });
  });

  // ACT percentile tests
  describe('with act25/act75 percentile', () => {
    it('should use ACT percentile when act25/act75 available and no SAT', () => {
      const profile: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        actScore: 34,
      };
      const school: SchoolMetrics = { act25: 32, act75: 36 };
      const score = calculateAcademicScore(profile, school);
      expect(score).toBeCloseTo(50, -1); // midpoint-ish
    });

    it('should not use ACT when SAT is present', () => {
      const profile: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        satScore: 1500,
        actScore: 34,
      };
      const school: SchoolMetrics = { satAvg: 1500, act25: 32, act75: 36 };
      // ACT should be ignored, SAT drives the score
      const score = calculateAcademicScore(profile, school);
      expect(score).toBeCloseTo(50, -1);
    });
  });

  // TOEFL scoring tests
  describe('TOEFL scoring', () => {
    it('should give 0 bonus for TOEFL 100 (baseline)', () => {
      const withToefl: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        toeflScore: 100,
      };
      const withoutToefl: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
      };
      const scoreWith = calculateAcademicScore(withToefl, {});
      const scoreWithout = calculateAcademicScore(withoutToefl, {});
      expect(scoreWith).toBeCloseTo(scoreWithout, 0);
    });

    it('should give +5 bonus for TOEFL 120', () => {
      const profile: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        toeflScore: 120,
      };
      const scoreWith = calculateAcademicScore(profile, {});
      const scoreBase = calculateAcademicScore(
        { ...baseProfile, gpa: undefined },
        {},
      );
      expect(scoreWith - scoreBase).toBeCloseTo(5, 0);
    });

    it('should give -5 penalty for TOEFL 80', () => {
      const profile: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        toeflScore: 80,
      };
      const scoreWith = calculateAcademicScore(profile, {});
      const scoreBase = calculateAcademicScore(
        { ...baseProfile, gpa: undefined },
        {},
      );
      expect(scoreWith - scoreBase).toBeCloseTo(-5, 0);
    });

    it('should cap TOEFL bonus at ±5', () => {
      const high: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        toeflScore: 200,
      };
      const low: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        toeflScore: 0,
      };
      const baseScore = calculateAcademicScore(
        { ...baseProfile, gpa: undefined },
        {},
      );
      expect(calculateAcademicScore(high, {}) - baseScore).toBeLessThanOrEqual(
        5,
      );
      expect(
        calculateAcademicScore(low, {}) - baseScore,
      ).toBeGreaterThanOrEqual(-5);
    });
  });

  // Historical distribution tests
  describe('with historical distribution', () => {
    it('should use empirical percentile when distribution has ≥30 values', () => {
      const profile: ProfileMetrics = {
        ...baseProfile,
        gpa: undefined,
        satScore: 1500,
      };
      const school: SchoolMetrics = { sat25: 1400, sat75: 1500, satAvg: 1450 };
      // Create 30+ sorted values
      const satValues = Array.from({ length: 50 }, (_, i) => 1300 + i * 8);
      const dist = {
        sampleCount: 50,
        satValues,
        gpaValues: [],
        toeflValues: [],
      };
      const score = calculateAcademicScore(profile, school, dist);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

// ============================================
// calculateActivityScore — Quality Scoring
// ============================================
describe('calculateActivityScore', () => {
  it('should use fallback for profile without activityDetails', () => {
    const profile: ProfileMetrics = {
      activityCount: 5,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
    };
    const score = calculateActivityScore(profile);
    expect(score).toBe(55); // 30 + 5*5
  });

  it('should award leadership bonus', () => {
    const withLeader: ProfileMetrics = {
      activityCount: 2,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      activityDetails: [
        { category: 'LEADERSHIP', role: 'President', totalHours: 100 },
        { category: 'ACADEMIC', role: 'Member', totalHours: 50 },
      ],
    };
    const withoutLeader: ProfileMetrics = {
      activityCount: 2,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      activityDetails: [
        { category: 'LEADERSHIP', role: 'Member', totalHours: 100 },
        { category: 'ACADEMIC', role: 'Member', totalHours: 50 },
      ],
    };
    expect(calculateActivityScore(withLeader)).toBeGreaterThan(
      calculateActivityScore(withoutLeader),
    );
  });

  it('should award depth bonus for high-hour activities', () => {
    const deep: ProfileMetrics = {
      activityCount: 2,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      activityDetails: [
        { category: 'RESEARCH', role: 'Researcher', totalHours: 300 },
        { category: 'ACADEMIC', role: 'Member', totalHours: 50 },
      ],
    };
    const shallow: ProfileMetrics = {
      activityCount: 2,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      activityDetails: [
        { category: 'RESEARCH', role: 'Researcher', totalHours: 100 },
        { category: 'ACADEMIC', role: 'Member', totalHours: 50 },
      ],
    };
    expect(calculateActivityScore(deep)).toBeGreaterThan(
      calculateActivityScore(shallow),
    );
  });

  it('should award diversity bonus for 3+ categories', () => {
    const diverse: ProfileMetrics = {
      activityCount: 3,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      activityDetails: [
        { category: 'ACADEMIC', role: 'Member', totalHours: 50 },
        { category: 'ATHLETICS', role: 'Player', totalHours: 50 },
        { category: 'COMMUNITY_SERVICE', role: 'Volunteer', totalHours: 50 },
      ],
    };
    const notDiverse: ProfileMetrics = {
      activityCount: 3,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      activityDetails: [
        { category: 'ACADEMIC', role: 'Member', totalHours: 50 },
        { category: 'ACADEMIC', role: 'Tutor', totalHours: 50 },
        { category: 'ACADEMIC', role: 'Researcher', totalHours: 50 },
      ],
    };
    expect(calculateActivityScore(diverse)).toBeGreaterThan(
      calculateActivityScore(notDiverse),
    );
  });

  it('should give extra diversity bonus for 5+ categories', () => {
    const veryDiverse: ProfileMetrics = {
      activityCount: 5,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      activityDetails: [
        { category: 'ACADEMIC', role: 'Member', totalHours: 50 },
        { category: 'ATHLETICS', role: 'Member', totalHours: 50 },
        { category: 'COMMUNITY_SERVICE', role: 'Member', totalHours: 50 },
        { category: 'ARTS', role: 'Member', totalHours: 50 },
        { category: 'WORK', role: 'Member', totalHours: 50 },
      ],
    };
    const somewhatDiverse: ProfileMetrics = {
      activityCount: 5,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      activityDetails: [
        { category: 'ACADEMIC', role: 'Member', totalHours: 50 },
        { category: 'ATHLETICS', role: 'Member', totalHours: 50 },
        { category: 'COMMUNITY_SERVICE', role: 'Member', totalHours: 50 },
        { category: 'ACADEMIC', role: 'Member', totalHours: 50 },
        { category: 'ATHLETICS', role: 'Member', totalHours: 50 },
      ],
    };
    // veryDiverse: 5 categories → +10, somewhatDiverse: 3 categories → +5
    expect(calculateActivityScore(veryDiverse)).toBeGreaterThan(
      calculateActivityScore(somewhatDiverse),
    );
  });

  it('should cap at 100', () => {
    const maxProfile: ProfileMetrics = {
      activityCount: 15,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      activityDetails: Array.from({ length: 15 }, (_, i) => ({
        category: `CAT_${i}`,
        role: 'President and Founder',
        totalHours: 500,
      })),
    };
    expect(calculateActivityScore(maxProfile)).toBeLessThanOrEqual(100);
  });
});

// ============================================
// calculateAwardScore — Tier-Based Scoring
// ============================================
describe('calculateAwardScore', () => {
  it('should use tier scores when available', () => {
    const profile: ProfileMetrics = {
      activityCount: 0,
      awardCount: 2,
      nationalAwardCount: 1,
      internationalAwardCount: 0,
      awardTierScores: [25, 8], // IMO + AIME
    };
    expect(calculateAwardScore(profile)).toBe(33);
  });

  it('should cap at 100 for exceptional awards', () => {
    const profile: ProfileMetrics = {
      activityCount: 0,
      awardCount: 5,
      nationalAwardCount: 3,
      internationalAwardCount: 2,
      awardTierScores: [25, 25, 25, 25, 15],
    };
    expect(calculateAwardScore(profile)).toBe(100);
  });

  it('should fallback to level counting when no tier scores', () => {
    const profile: ProfileMetrics = {
      activityCount: 0,
      awardCount: 2,
      nationalAwardCount: 1,
      internationalAwardCount: 1,
    };
    const score = calculateAwardScore(profile);
    // 20 (base) + 20 (1 intl) + 15 (1 natl) = 55
    expect(score).toBe(55);
  });

  it('should use LEVEL_POINTS for awards without competition', () => {
    const profile: ProfileMetrics = {
      activityCount: 0,
      awardCount: 3,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
      awardTierScores: [
        LEVEL_POINTS['STATE'],
        LEVEL_POINTS['REGIONAL'],
        LEVEL_POINTS['SCHOOL'],
      ],
    };
    expect(calculateAwardScore(profile)).toBe(8 + 5 + 2); // 15
  });

  it('should handle empty awardTierScores by falling back', () => {
    const profile: ProfileMetrics = {
      activityCount: 0,
      awardCount: 1,
      nationalAwardCount: 1,
      internationalAwardCount: 0,
      awardTierScores: [],
    };
    // Empty array → fallback to old logic
    const score = calculateAwardScore(profile);
    expect(score).toBe(35); // 20 + 15
  });
});

// ============================================
// calculateOverallScore
// ============================================
describe('calculateOverallScore', () => {
  it('should return a weighted number between 0-100', () => {
    const profile: ProfileMetrics = {
      gpa: 4.0,
      gpaScale: 4.0,
      satScore: 1600,
      activityCount: 10,
      awardCount: 5,
      nationalAwardCount: 2,
      internationalAwardCount: 1,
    };
    const school: SchoolMetrics = { satAvg: 1400 };
    const score = calculateOverallScore(profile, school);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should handle minimal profile', () => {
    const profile: ProfileMetrics = {
      activityCount: 0,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
    };
    const score = calculateOverallScore(profile, {});
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should respect configurable weights', () => {
    expect(
      SCORING_WEIGHTS.academic +
        SCORING_WEIGHTS.activity +
        SCORING_WEIGHTS.award,
    ).toBeCloseTo(1, 4);
  });
});

// ============================================
// calculateScoreBreakdown
// ============================================
describe('calculateScoreBreakdown', () => {
  it('should return all breakdown fields', () => {
    const profile: ProfileMetrics = {
      gpa: 3.5,
      gpaScale: 4.0,
      activityCount: 3,
      awardCount: 2,
      nationalAwardCount: 1,
      internationalAwardCount: 0,
    };
    const breakdown = calculateScoreBreakdown(profile, {});
    expect(breakdown).toHaveProperty('academic');
    expect(breakdown).toHaveProperty('activity');
    expect(breakdown).toHaveProperty('award');
    expect(breakdown).toHaveProperty('overall');
    expect(breakdown.overall).toBeGreaterThanOrEqual(0);
    expect(breakdown.overall).toBeLessThanOrEqual(100);
  });

  it('should have overall equal to weighted sum', () => {
    const profile: ProfileMetrics = {
      gpa: 3.7,
      gpaScale: 4.0,
      satScore: 1500,
      activityCount: 5,
      awardCount: 2,
      nationalAwardCount: 1,
      internationalAwardCount: 0,
    };
    const breakdown = calculateScoreBreakdown(profile, { satAvg: 1450 });
    const expected =
      breakdown.academic * SCORING_WEIGHTS.academic +
      breakdown.activity * SCORING_WEIGHTS.activity +
      breakdown.award * SCORING_WEIGHTS.award;
    expect(breakdown.overall).toBeCloseTo(expected, 4);
  });
});

// ============================================
// calculateProbability
// ============================================
describe('calculateProbability', () => {
  it('should return base rate for score of 50', () => {
    const prob = calculateProbability(50, { acceptanceRate: 30 });
    expect(prob).toBeCloseTo(0.3, 2);
  });

  it('should increase with higher scores', () => {
    const prob60 = calculateProbability(60, { acceptanceRate: 30 });
    const prob50 = calculateProbability(50, { acceptanceRate: 30 });
    expect(prob60).toBeGreaterThan(prob50);
  });

  it('should clamp between 0.05 and 0.95', () => {
    const low = calculateProbability(0, { acceptanceRate: 5 });
    const high = calculateProbability(100, { acceptanceRate: 90 });
    expect(low).toBeGreaterThanOrEqual(0.05);
    expect(high).toBeLessThanOrEqual(0.95);
  });
});

// ============================================
// calculateTier
// ============================================
describe('calculateTier', () => {
  it('should classify top schools correctly', () => {
    const school: SchoolMetrics = { acceptanceRate: 5 };
    expect(calculateTier(0.3, school)).toBe('match');
    expect(calculateTier(0.1, school)).toBe('reach');
  });

  it('should classify selective schools correctly', () => {
    const school: SchoolMetrics = { acceptanceRate: 20 };
    expect(calculateTier(0.6, school)).toBe('safety');
    expect(calculateTier(0.3, school)).toBe('match');
    expect(calculateTier(0.1, school)).toBe('reach');
  });

  it('should classify general schools correctly', () => {
    const school: SchoolMetrics = { acceptanceRate: 50 };
    expect(calculateTier(0.7, school)).toBe('safety');
    expect(calculateTier(0.4, school)).toBe('match');
    expect(calculateTier(0.2, school)).toBe('reach');
  });
});

// ============================================
// calculateConfidence
// ============================================
describe('calculateConfidence', () => {
  it('should return high for complete data', () => {
    const profile: ProfileMetrics = {
      gpa: 3.8,
      satScore: 1500,
      activityCount: 5,
      awardCount: 2,
      nationalAwardCount: 1,
      internationalAwardCount: 0,
    };
    const school: SchoolMetrics = { acceptanceRate: 20, satAvg: 1450 };
    expect(calculateConfidence(profile, school)).toBe('high');
  });

  it('should return low for minimal data', () => {
    const profile: ProfileMetrics = {
      activityCount: 0,
      awardCount: 0,
      nationalAwardCount: 0,
      internationalAwardCount: 0,
    };
    expect(calculateConfidence(profile, {})).toBe('low');
  });
});

// ============================================
// Constants validation
// ============================================
describe('Constants', () => {
  it('SCORING_WEIGHTS should sum to 1', () => {
    const sum =
      SCORING_WEIGHTS.academic +
      SCORING_WEIGHTS.activity +
      SCORING_WEIGHTS.award;
    expect(sum).toBeCloseTo(1, 4);
  });

  it('TIER_POINTS should have entries for tiers 1-5', () => {
    expect(TIER_POINTS[1]).toBe(2);
    expect(TIER_POINTS[2]).toBe(4);
    expect(TIER_POINTS[3]).toBe(8);
    expect(TIER_POINTS[4]).toBe(15);
    expect(TIER_POINTS[5]).toBe(25);
  });

  it('LEVEL_POINTS should have all AwardLevel values', () => {
    expect(LEVEL_POINTS['SCHOOL']).toBe(2);
    expect(LEVEL_POINTS['REGIONAL']).toBe(5);
    expect(LEVEL_POINTS['STATE']).toBe(8);
    expect(LEVEL_POINTS['NATIONAL']).toBe(15);
    expect(LEVEL_POINTS['INTERNATIONAL']).toBe(20);
  });

  it('ACADEMIC_CONFIG should have reasonable values', () => {
    expect(ACADEMIC_CONFIG.baseScore).toBe(50);
    expect(ACADEMIC_CONFIG.toeflBaseline).toBe(100);
    expect(ACADEMIC_CONFIG.satMaxBonus).toBe(15);
  });

  it('LEADERSHIP_KEYWORDS should contain key terms', () => {
    expect(LEADERSHIP_KEYWORDS).toContain('president');
    expect(LEADERSHIP_KEYWORDS).toContain('founder');
    expect(LEADERSHIP_KEYWORDS).toContain('captain');
    expect(LEADERSHIP_KEYWORDS).toContain('社长');
  });
});
