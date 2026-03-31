import { Test, TestingModule } from '@nestjs/testing';
import { PredictionStatisticalEngine } from './prediction-statistical-engine.service';
import { PredictionTransformerService } from './prediction-transformer.service';
import type { ProfileInput, SchoolInput } from './prediction.prompts';
import type { ProfileMetrics, SchoolMetrics } from './utils/score-calculator';

// Mock score-calculator utils
jest.mock('./utils/score-calculator', () => ({
  calculateOverallScoreDetailed: jest.fn(),
  calculateProbability: jest.fn(),
  normalizeGpa: jest.fn(),
}));

// Mock shared scoring
jest.mock('@study-abroad/shared/scoring', () => ({
  extractFeatureVector: jest.fn(),
  imputeFeatures: jest.fn(),
  featureVectorToArray: jest.fn(),
  predict: jest.fn(),
  predictGBDT: jest.fn(),
  explainPrediction: jest.fn(),
  resolveMajorToCip: jest.fn(),
  CIP_NAMES: {},
}));

import {
  calculateOverallScoreDetailed,
  calculateProbability,
  normalizeGpa,
} from './utils/score-calculator';

const mockCalculateOverallScoreDetailed =
  calculateOverallScoreDetailed as jest.Mock;
const mockCalculateProbability = calculateProbability as jest.Mock;
const mockNormalizeGpa = normalizeGpa as jest.Mock;

describe('PredictionStatisticalEngine', () => {
  let engine: PredictionStatisticalEngine;
  let transformer: PredictionTransformerService;

  const mockProfileMetrics: ProfileMetrics = {
    gpa: 3.85,
    gpaScale: 4,
    satScore: 1520,
    activityCount: 6,
    awardCount: 3,
    nationalAwardCount: 1,
    internationalAwardCount: 0,
  };

  const mockSchoolMetrics: SchoolMetrics = {
    acceptanceRate: 5,
    satAvg: 1540,
    usNewsRank: 3,
  };

  const baseProfile: ProfileInput = {
    gpa: 3.85,
    gpaScale: 4,
    testScores: [{ type: 'SAT', score: 1520 }],
    activities: [
      { category: 'RESEARCH', role: 'Lead' },
      { category: 'SPORTS', role: 'Captain' },
      { category: 'MUSIC', role: 'Member' },
      { category: 'DEBATE', role: 'President' },
      { category: 'VOLUNTEER', role: 'Organizer' },
      { category: 'CLUB', role: 'Founder' },
    ],
    awards: [
      { level: 'NATIONAL', name: 'Science Olympiad' },
      { level: 'STATE', name: 'Math League' },
      { level: 'SCHOOL', name: 'Honor Roll' },
    ],
  };

  const baseSchool: SchoolInput = {
    id: 'school-1',
    name: 'MIT',
    nameZh: '麻省理工',
    acceptanceRate: 5,
    satAvg: 1540,
    usNewsRank: 3,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionStatisticalEngine,
        {
          provide: PredictionTransformerService,
          useValue: {
            extractProfileMetrics: jest
              .fn()
              .mockReturnValue(mockProfileMetrics),
            extractSchoolMetrics: jest.fn().mockReturnValue(mockSchoolMetrics),
          },
        },
      ],
    }).compile();

    engine = module.get<PredictionStatisticalEngine>(
      PredictionStatisticalEngine,
    );
    transformer = module.get<PredictionTransformerService>(
      PredictionTransformerService,
    );

    // Default mocks
    mockCalculateOverallScoreDetailed.mockReturnValue({
      score: 75,
      hsConfidence: {
        level: 'none',
        hsImpactScale: 0,
        reason: 'no_hs_data',
        dimensionsAvailable: 0,
      },
      hsImpact: 1.0,
    });
    mockCalculateProbability.mockReturnValue(0.45);
    mockNormalizeGpa.mockReturnValue(3.85);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('predictWithStats', () => {
    it('should return probability, factors, comparison, and hsConfidence', () => {
      const result = engine.predictWithStats(baseProfile, baseSchool);

      expect(result.probability).toBe(0.45);
      expect(result.factors).toBeDefined();
      expect(Array.isArray(result.factors)).toBe(true);
      expect(result.comparison).toBeDefined();
      expect(result.hsConfidence).toBeDefined();
    });

    it('should call transformer to extract metrics', () => {
      engine.predictWithStats(baseProfile, baseSchool);

      expect(transformer.extractProfileMetrics).toHaveBeenCalledWith(
        baseProfile,
      );
      expect(transformer.extractSchoolMetrics).toHaveBeenCalledWith(baseSchool);
    });

    it('should call calculateOverallScoreDetailed with extracted metrics', () => {
      engine.predictWithStats(baseProfile, baseSchool, undefined, 'en');

      expect(mockCalculateOverallScoreDetailed).toHaveBeenCalledWith(
        mockProfileMetrics,
        mockSchoolMetrics,
        undefined,
      );
    });

    it('should pass historicalDistribution when provided', () => {
      const historicalDist = {
        sampleCount: 100,
        satValues: [1400, 1450, 1500],
        gpaValues: [3.5, 3.7, 3.9],
        toeflValues: [100, 105, 110],
      };
      engine.predictWithStats(baseProfile, baseSchool, historicalDist);

      expect(mockCalculateOverallScoreDetailed).toHaveBeenCalledWith(
        mockProfileMetrics,
        mockSchoolMetrics,
        historicalDist,
      );
    });

    it('should use intlAcceptanceRate for international students', () => {
      const intlProfile: ProfileInput = {
        ...baseProfile,
        isInternational: true,
      };
      const schoolWithIntl: SchoolInput = {
        ...baseSchool,
        intlAcceptanceRate: 3,
      };

      engine.predictWithStats(intlProfile, schoolWithIntl);

      expect(mockCalculateProbability).toHaveBeenCalledWith(
        75,
        mockSchoolMetrics,
        { useIntlRate: true, intlAcceptanceRate: 3 },
      );
    });

    it('should not use intlAcceptanceRate when student is domestic', () => {
      engine.predictWithStats(baseProfile, baseSchool);

      expect(mockCalculateProbability).toHaveBeenCalledWith(
        75,
        mockSchoolMetrics,
        undefined,
      );
    });
  });

  describe('GPA factor generation', () => {
    it('should generate positive GPA factor for high GPA (>= 3.7)', () => {
      mockNormalizeGpa.mockReturnValue(3.85);

      const result = engine.predictWithStats(baseProfile, baseSchool);
      const gpaFactor = result.factors.find((f) => f.name === 'GPA');

      expect(gpaFactor).toBeDefined();
      expect(gpaFactor!.impact).toBe('positive');
      expect(gpaFactor!.weight).toBe(0.3);
      expect(gpaFactor!.improvement).toBeUndefined();
    });

    it('should generate neutral GPA factor for moderate GPA (3.3-3.7)', () => {
      mockNormalizeGpa.mockReturnValue(3.5);

      const result = engine.predictWithStats(baseProfile, baseSchool);
      const gpaFactor = result.factors.find((f) => f.name === 'GPA');

      expect(gpaFactor!.impact).toBe('neutral');
      expect(gpaFactor!.improvement).toBeDefined();
    });

    it('should generate negative GPA factor for low GPA (< 3.3)', () => {
      mockNormalizeGpa.mockReturnValue(3.0);

      const result = engine.predictWithStats(baseProfile, baseSchool);
      const gpaFactor = result.factors.find((f) => f.name === 'GPA');

      expect(gpaFactor!.impact).toBe('negative');
      expect(gpaFactor!.improvement).toBeDefined();
    });

    it('should generate negative factor when GPA is missing', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        gpa: undefined,
      });

      const profileNoGpa: ProfileInput = {
        ...baseProfile,
        gpa: undefined,
      };
      const result = engine.predictWithStats(profileNoGpa, baseSchool);
      const gpaFactor = result.factors.find((f) => f.name === 'GPA');

      expect(gpaFactor!.impact).toBe('negative');
      expect(gpaFactor!.improvement).toBeDefined();
    });
  });

  describe('Standardized test factor generation', () => {
    it('should generate positive factor when SAT exceeds school average', () => {
      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const testFactor = result.factors.find(
        (f) => f.name === 'Standardized Test Scores',
      );

      // mockProfileMetrics.satScore = 1520, mockSchoolMetrics.satAvg = 1540
      // 1520 < 1540, so this should be negative
      expect(testFactor!.impact).toBe('negative');
    });

    it('should generate positive factor when SAT exceeds school average', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        satScore: 1560,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const testFactor = result.factors.find(
        (f) => f.name === 'Standardized Test Scores',
      );

      expect(testFactor!.impact).toBe('positive');
    });

    it('should generate negative factor when no test scores provided', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        satScore: undefined,
        actScore: undefined,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const testFactor = result.factors.find(
        (f) => f.name === 'Standardized Test Scores',
      );

      expect(testFactor!.impact).toBe('negative');
      expect(testFactor!.improvement).toBeDefined();
    });

    it('should skip test score factor when ACT is present but SAT is not', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        satScore: undefined,
        actScore: 34,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      // With SAT absent but ACT present, the "no scores" branch is not hit
      const noScoreFactor = result.factors.find(
        (f) => f.name === 'Standardized Test Scores' && f.impact === 'negative',
      );
      expect(noScoreFactor).toBeUndefined();
    });
  });

  describe('Activity factor generation', () => {
    it('should generate positive factor for 5+ activities', () => {
      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const actFactor = result.factors.find(
        (f) => f.name === 'Extracurricular Activities',
      );

      expect(actFactor!.impact).toBe('positive');
      expect(actFactor!.weight).toBe(0.25);
    });

    it('should generate neutral factor for 1-4 activities', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        activityCount: 3,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const actFactor = result.factors.find(
        (f) => f.name === 'Extracurricular Activities',
      );

      expect(actFactor!.impact).toBe('neutral');
      expect(actFactor!.improvement).toBeDefined();
    });

    it('should generate negative factor for 0 activities', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        activityCount: 0,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const actFactor = result.factors.find(
        (f) => f.name === 'Extracurricular Activities',
      );

      expect(actFactor!.impact).toBe('negative');
    });
  });

  describe('Award factor generation', () => {
    it('should generate positive factor for national/international awards', () => {
      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const awardFactor = result.factors.find(
        (f) => f.name === 'Awards & Honors',
      );

      expect(awardFactor!.impact).toBe('positive');
    });

    it('should generate neutral factor for awards without national level', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        awardCount: 2,
        nationalAwardCount: 0,
        internationalAwardCount: 0,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const awardFactor = result.factors.find(
        (f) => f.name === 'Awards & Honors',
      );

      expect(awardFactor!.impact).toBe('neutral');
      expect(awardFactor!.improvement).toBeDefined();
    });

    it('should generate negative factor for no awards', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        awardCount: 0,
        nationalAwardCount: 0,
        internationalAwardCount: 0,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const awardFactor = result.factors.find(
        (f) => f.name === 'Awards & Honors',
      );

      expect(awardFactor!.impact).toBe('negative');
    });
  });

  describe('Major competitiveness factor', () => {
    it('should use data-driven competitiveness when available', () => {
      const profileWithMajor: ProfileInput = {
        ...baseProfile,
        targetMajor: 'Computer Science',
        majorCompetitiveness: {
          name: 'Computer Science',
          level: 5,
          schoolEstimate: 3,
        },
      };

      const result = engine.predictWithStats(
        profileWithMajor,
        baseSchool,
        undefined,
        'en',
      );
      const majorFactor = result.factors.find(
        (f) => f.name === 'Major Competitiveness',
      );

      expect(majorFactor).toBeDefined();
      expect(majorFactor!.impact).toBe('negative'); // level 5 = highly competitive
      expect(majorFactor!.weight).toBe(0.1);
    });

    it('should use text-match fallback when majorCompetitiveness is absent', () => {
      const profileWithMajor: ProfileInput = {
        ...baseProfile,
        targetMajor: 'Computer Science',
      };

      const result = engine.predictWithStats(
        profileWithMajor,
        baseSchool,
        undefined,
        'en',
      );
      const majorFactor = result.factors.find(
        (f) => f.name === 'Target Major Competitiveness',
      );

      expect(majorFactor).toBeDefined();
      expect(majorFactor!.impact).toBe('neutral');
      expect(majorFactor!.weight).toBe(0.0);
    });

    it('should not add major factor for non-competitive major without data', () => {
      const profileWithMajor: ProfileInput = {
        ...baseProfile,
        targetMajor: 'Philosophy',
      };

      const result = engine.predictWithStats(
        profileWithMajor,
        baseSchool,
        undefined,
        'en',
      );
      const majorFactor = result.factors.find(
        (f) =>
          f.name === 'Major Competitiveness' ||
          f.name === 'Target Major Competitiveness',
      );

      expect(majorFactor).toBeUndefined();
    });
  });

  describe('International student factor', () => {
    it('should add international factor with negative impact when intl rate < overall', () => {
      const intlProfile: ProfileInput = {
        ...baseProfile,
        isInternational: true,
      };
      const schoolWithIntl: SchoolInput = {
        ...baseSchool,
        intlAcceptanceRate: 3,
        acceptanceRate: 5,
      };

      const result = engine.predictWithStats(
        intlProfile,
        schoolWithIntl,
        undefined,
        'en',
      );
      const intlFactor = result.factors.find(
        (f) => f.name === 'International Applicant',
      );

      expect(intlFactor).toBeDefined();
      expect(intlFactor!.impact).toBe('negative');
    });

    it('should add Need-Blind factor when school is need-blind for intl', () => {
      const intlProfile: ProfileInput = {
        ...baseProfile,
        isInternational: true,
      };
      const schoolNeedBlind: SchoolInput = {
        ...baseSchool,
        needBlindInternational: true,
      };

      const result = engine.predictWithStats(
        intlProfile,
        schoolNeedBlind,
        undefined,
        'en',
      );
      const nbFactor = result.factors.find(
        (f) => f.name === 'Need-Blind Policy',
      );

      expect(nbFactor).toBeDefined();
      expect(nbFactor!.impact).toBe('positive');
    });

    it('should not add international factor for domestic students', () => {
      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const intlFactor = result.factors.find(
        (f) => f.name === 'International Applicant',
      );

      expect(intlFactor).toBeUndefined();
    });
  });

  describe('High school background factor', () => {
    it('should generate positive factor for tier 4+ schools', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        highSchoolTier: 5,
        highSchoolRecognition: 5,
        highSchoolAcademicRigor: 5,
      });
      mockCalculateOverallScoreDetailed.mockReturnValue({
        score: 80,
        hsConfidence: {
          level: 'high',
          hsImpactScale: 1.0,
          reason: 'full_data',
          dimensionsAvailable: 5,
        },
        hsImpact: 1.05,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const hsFactor = result.factors.find(
        (f) => f.name === 'High School Background',
      );

      expect(hsFactor).toBeDefined();
      expect(hsFactor!.impact).toBe('positive');
      expect(hsFactor!.weight).toBe(0.08);
    });

    it('should generate neutral factor for tier 1-3 schools (never negative)', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        highSchoolTier: 2,
      });
      mockCalculateOverallScoreDetailed.mockReturnValue({
        score: 65,
        hsConfidence: {
          level: 'low',
          hsImpactScale: 0.5,
          reason: 'limited_data',
          dimensionsAvailable: 1,
        },
        hsImpact: 0.97,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const hsFactor = result.factors.find(
        (f) => f.name === 'High School Background',
      );

      // Tier 1-2 should never be marked as negative (immutable, causes anxiety)
      expect(hsFactor!.impact).toBe('neutral');
      expect(hsFactor!.weight).toBe(0.06);
    });

    it('should generate neutral factor when no HS data is provided', () => {
      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const hsFactor = result.factors.find(
        (f) => f.name === 'High School Background',
      );

      expect(hsFactor).toBeDefined();
      expect(hsFactor!.impact).toBe('neutral');
      expect(hsFactor!.weight).toBe(0.05);
      expect(hsFactor!.improvement).toBeDefined();
    });

    it('should include improvement tip for low/medium HS confidence', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        highSchoolTier: 3,
        highSchoolRecognition: 3,
        highSchoolAcademicRigor: 3,
      });
      mockCalculateOverallScoreDetailed.mockReturnValue({
        score: 70,
        hsConfidence: {
          level: 'medium',
          hsImpactScale: 0.7,
          reason: 'partial_data',
          dimensionsAvailable: 3,
        },
        hsImpact: 1.0,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const hsFactor = result.factors.find(
        (f) => f.name === 'High School Background',
      );

      expect(hsFactor!.improvement).toBeDefined();
      expect(hsFactor!.improvement).toContain('confidence');
    });
  });

  describe('Comparison percentile calculation', () => {
    it('should compute gpaPercentile capped at 99', () => {
      mockNormalizeGpa.mockReturnValue(4.0);

      const result = engine.predictWithStats(baseProfile, baseSchool);

      expect(result.comparison.gpaPercentile).toBeLessThanOrEqual(99);
    });

    it('should default gpaPercentile to 50 when GPA is missing', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        gpa: undefined,
      });

      const result = engine.predictWithStats(
        { ...baseProfile, gpa: undefined },
        baseSchool,
      );

      expect(result.comparison.gpaPercentile).toBe(50);
    });

    it('should clamp testScorePercentile between 1 and 99', () => {
      // SAT 1520: ((1520 - 1000) / 600) * 100 = 86.67 -> 87
      const result = engine.predictWithStats(baseProfile, baseSchool);

      expect(result.comparison.testScorePercentile).toBeGreaterThanOrEqual(1);
      expect(result.comparison.testScorePercentile).toBeLessThanOrEqual(99);
    });

    it('should default testScorePercentile to 50 when SAT is missing', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        satScore: undefined,
      });

      const result = engine.predictWithStats(baseProfile, baseSchool);

      expect(result.comparison.testScorePercentile).toBe(50);
    });

    it('should classify activityStrength as strong for 7+ activities', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        activityCount: 8,
      });

      const result = engine.predictWithStats(baseProfile, baseSchool);

      expect(result.comparison.activityStrength).toBe('strong');
    });

    it('should classify activityStrength as average for 4-6 activities', () => {
      const result = engine.predictWithStats(baseProfile, baseSchool);

      expect(result.comparison.activityStrength).toBe('average');
    });

    it('should classify activityStrength as weak for <4 activities', () => {
      (transformer.extractProfileMetrics as jest.Mock).mockReturnValue({
        ...mockProfileMetrics,
        activityCount: 2,
      });

      const result = engine.predictWithStats(baseProfile, baseSchool);

      expect(result.comparison.activityStrength).toBe('weak');
    });
  });

  describe('Locale (i18n) support', () => {
    it('should generate Chinese factor details when locale is zh', () => {
      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'zh',
      );
      const gpaFactor = result.factors.find((f) => f.name === 'GPA');

      expect(gpaFactor!.detail).toContain('GPA');
      expect(gpaFactor!.detail).toMatch(/竞争力|弥补/);
    });

    it('should generate English factor details when locale is en', () => {
      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );
      const gpaFactor = result.factors.find((f) => f.name === 'GPA');

      expect(gpaFactor!.detail).toContain('GPA');
      expect(gpaFactor!.detail).toMatch(/competitive|support/);
    });

    it('should default to zh locale when not specified', () => {
      const result = engine.predictWithStats(baseProfile, baseSchool);
      const gpaFactor = result.factors.find((f) => f.name === 'GPA');

      // Default locale is 'zh'
      expect(gpaFactor!.detail).toMatch(/竞争力|弥补|未提供/);
    });
  });

  describe('hsConfidence response', () => {
    it('should return none level with improvement tip when no HS data', () => {
      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );

      expect(result.hsConfidence!.level).toBe('none');
      expect(result.hsConfidence!.dimensionsAvailable).toBe(0);
      expect(result.hsConfidence!.improvementTip).toBeDefined();
    });

    it('should return high level without improvement tip for full HS data', () => {
      mockCalculateOverallScoreDetailed.mockReturnValue({
        score: 80,
        hsConfidence: {
          level: 'high',
          hsImpactScale: 1.0,
          reason: 'full_data',
          dimensionsAvailable: 5,
        },
        hsImpact: 1.05,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );

      expect(result.hsConfidence!.level).toBe('high');
      expect(result.hsConfidence!.dimensionsAvailable).toBe(5);
      expect(result.hsConfidence!.improvementTip).toBeUndefined();
    });

    it('should include improvement tip for medium confidence', () => {
      mockCalculateOverallScoreDetailed.mockReturnValue({
        score: 70,
        hsConfidence: {
          level: 'medium',
          hsImpactScale: 0.7,
          reason: 'partial',
          dimensionsAvailable: 3,
        },
        hsImpact: 1.0,
      });

      const result = engine.predictWithStats(
        baseProfile,
        baseSchool,
        undefined,
        'en',
      );

      expect(result.hsConfidence!.level).toBe('medium');
      expect(result.hsConfidence!.improvementTip).toBeDefined();
    });
  });
});
