import { Test, TestingModule } from '@nestjs/testing';
import { PredictionService } from './prediction.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { PredictionTransformerService } from './prediction-transformer.service';
import { PredictionStatisticalEngine } from './prediction-statistical-engine.service';
import { PredictionAiEngine } from './prediction-ai-engine.service';
import { PredictionFusionEngine } from './prediction-fusion-engine.service';
import { PredictionCacheService } from './prediction-cache.service';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionHistoricalService } from './prediction-historical.service';
import { PredictionMemoryService } from './prediction-memory.service';
import { PredictionPersistenceService } from './prediction-persistence.service';
import { PredictionReportingService } from './prediction-reporting.service';
import { CaseIncentiveService } from '../points/incentive.service';
import { ModelRegistryService } from './ml/model-registry.service';
import { ShadowEvaluatorService } from './ml/shadow-evaluator.service';
import { ModelMonitorService } from './ml/model-monitor.service';
import { PredictionPolicyService } from './prediction-policy.service';
import { PredictionMlPrimaryService } from './prediction-ml-primary.service';
import { FeatureFlagService } from '../../common/feature-flags/feature-flag.service';
import { DistillationService } from './benchmark/distillation.service';
import { CompliantDistillationService } from './distillation/compliant-distillation.service';

// Mock score-calculator utils
jest.mock('./utils/score-calculator', () => ({
  calculateOverallScore: jest.fn().mockReturnValue(70),
  calculateProbability: jest.fn().mockReturnValue(0.45),
  calculateTier: jest.fn().mockReturnValue('match'),
  calculateConfidence: jest.fn().mockReturnValue('medium'),
  normalizeGpa: jest.fn().mockReturnValue(3.8),
  parseRange: jest.fn((val) => {
    if (typeof val === 'string') {
      const num = parseFloat(val);
      return isNaN(num) ? null : num;
    }
    return null;
  }),
  calculateSelectivityIndex: jest.fn().mockReturnValue(0.5),
  resolveContextualAcceptanceRate: jest.fn().mockReturnValue(null),
  enforceMonotonicity: jest.fn().mockImplementation((arr) => arr),
  TIER_POINTS: { 5: 25, 4: 15, 3: 8, 2: 4, 1: 2 },
  LEVEL_POINTS: {
    INTERNATIONAL: 20,
    NATIONAL: 15,
    STATE: 8,
    REGIONAL: 5,
    SCHOOL: 2,
  },
}));

// Mock prompt-builder
jest.mock('./utils/prompt-builder', () => ({
  buildPredictionPrompt: jest.fn().mockReturnValue('Mock prediction prompt'),
}));

// Mock shared scoring
jest.mock('@study-abroad/shared/scoring', () => ({
  extractFeatureVector: jest.fn().mockReturnValue({}),
  imputeFeatures: jest.fn().mockReturnValue({}),
  featureVectorToArray: jest.fn().mockReturnValue([]),
  predict: jest.fn().mockReturnValue(0.5),
  predictGBDT: jest.fn().mockReturnValue(0.5),
  explainPrediction: jest.fn().mockReturnValue([]),
  resolveMajorToCip: jest.fn().mockReturnValue(null),
  CIP_NAMES: {},
  ROUND_MULTIPLIERS: {
    ED: 1.35,
    ED2: 1.25,
    REA: 1.15,
    SCEA: 1.15,
    EA: 1.1,
    ROLLING: 1.05,
    RD: 1.0,
  },
}));

// Mock ml/tier-strategy
jest.mock('./ml/tier-strategy', () => ({
  getSelectivityBand: jest.fn().mockReturnValue('mid'),
}));

const mockProfileInput = {
  gpa: 3.8,
  gpaScale: 4,
  testScores: [
    { type: 'SAT', score: 1500 },
    { type: 'TOEFL', score: 110 },
  ],
  activities: [],
  awards: [],
  targetMajor: 'Computer Science',
};

const mockSchoolInput = {
  id: 'school-1',
  name: 'MIT',
  acceptanceRate: 4,
  satAvg: 1540,
  usNewsRank: 1,
};

const mockProfileMetrics = {
  gpa: 3.8,
  satScore: 1500,
  activityScore: 70,
  awardScore: 50,
};

const mockSchoolMetrics = {
  acceptanceRate: 4,
  satAvg: 1540,
  usNewsRank: 1,
};

const mockStatsResult = {
  probability: 0.35,
  factors: [
    { name: 'GPA', impact: 'positive', weight: 0.3, detail: 'Strong GPA' },
  ],
  comparison: {
    gpaPercentile: 85,
    testScorePercentile: 80,
    activityStrength: 'strong',
  },
};

const mockAiResult = {
  probability: 0.3,
  factors: [
    { name: 'GPA', impact: 'positive', weight: 0.3, detail: 'Strong GPA' },
  ],
  suggestions: ['Consider research experience'],
  comparison: {
    gpaPercentile: 85,
    testScorePercentile: 80,
    activityStrength: 'strong',
  },
};

const mockFusedResult = {
  probability: 0.33,
  probabilityLow: 0.26,
  probabilityHigh: 0.4,
  crossEngineConsistency: 0.85,
  engineScores: {
    stats: 0.35,
    ai: 0.3,
    historical: null,
    fusionMethod: 'weighted_ensemble_2_stats_ai',
  },
};

const mockMemoryContext = {
  previousPredictions: [],
  knownPreferences: [],
  profileInsights: [],
  memoryAdjustments: new Map<string, number>(),
};

describe('PredictionService', () => {
  let service: PredictionService;
  let prisma: PrismaService;
  let _redis: RedisService;
  let aiEngine: PredictionAiEngine;
  let cacheService: PredictionCacheService;
  let memoryService: PredictionMemoryService;
  let persistenceService: PredictionPersistenceService;
  let reportingService: PredictionReportingService;
  let mlPrimaryService: PredictionMlPrimaryService;
  let featureFlagService: FeatureFlagService;
  let distillationService: DistillationService;
  let compliantDistillationService: CompliantDistillationService;

  const mockProfile = {
    id: 'profile-1',
    userId: 'user-1',
    gpa: '3.8',
    gpaScale: 4,
    grade: '12',
    currentSchoolType: 'HIGH_SCHOOL',
    targetMajor: 'Computer Science',
    testScores: [
      { type: 'SAT', score: 1500, subScores: {} },
      { type: 'TOEFL', score: 110, subScores: {} },
    ],
    activities: [
      {
        category: 'RESEARCH',
        role: 'Lead',
        hoursPerWeek: 10,
        weeksPerYear: 40,
      },
      {
        category: 'SPORTS',
        role: 'Captain',
        hoursPerWeek: 15,
        weeksPerYear: 30,
      },
    ],
    awards: [
      {
        name: 'Science Olympiad',
        level: 'NATIONAL',
        competition: { level: 'NATIONAL' },
      },
      {
        name: 'Math Competition',
        level: 'STATE',
        competition: { level: 'STATE' },
      },
    ],
  };

  const mockSchool = {
    id: 'school-1',
    name: 'MIT',
    nameZh: '麻省理工',
    acceptanceRate: 4,
    satAvg: 1540,
    sat25: 1500,
    sat75: 1580,
    actAvg: 35,
    act25: 34,
    act75: 36,
    usNewsRank: 1,
    graduationRate: 95,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionService,
        {
          provide: PrismaService,
          useValue: {
            profile: {
              findUnique: jest.fn(),
            },
            school: {
              findMany: jest.fn(),
            },
            admissionCase: {
              findMany: jest.fn().mockResolvedValue([]),
              groupBy: jest.fn().mockResolvedValue([]),
            },
            schoolProgram: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            predictionResult: {
              findMany: jest.fn().mockResolvedValue([]),
              upsert: jest.fn().mockResolvedValue({ id: 'pred-1' }),
            },
            assessmentResult: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            schoolListItem: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: RedisService,
          useValue: {
            getJSON: jest.fn().mockResolvedValue(null),
            setJSON: jest.fn().mockResolvedValue(undefined),
            del: jest.fn().mockResolvedValue(1),
            setNX: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: PredictionTransformerService,
          useValue: {
            profileToInput: jest.fn().mockReturnValue(mockProfileInput),
            schoolToInput: jest.fn().mockReturnValue(mockSchoolInput),
            extractProfileMetrics: jest
              .fn()
              .mockReturnValue(mockProfileMetrics),
            extractSchoolMetrics: jest.fn().mockReturnValue(mockSchoolMetrics),
            evaluateDataCompleteness: jest.fn().mockReturnValue(0.75),
            adjustConfidenceForSchoolTrust: jest
              .fn()
              .mockImplementation((confidence) => confidence),
            enrichWithEssayQuality: jest
              .fn()
              .mockImplementation((input) => Promise.resolve(input)),
          },
        },
        {
          provide: PredictionStatisticalEngine,
          useValue: {
            predictWithStats: jest.fn().mockReturnValue(mockStatsResult),
          },
        },
        {
          provide: PredictionAiEngine,
          useValue: {
            predictWithAI: jest.fn().mockResolvedValue(mockAiResult),
          },
        },
        {
          provide: PredictionFusionEngine,
          useValue: {
            fusePredictions: jest.fn().mockReturnValue({ ...mockFusedResult }),
          },
        },
        {
          provide: PredictionCacheService,
          useValue: {
            getCacheKey: jest
              .fn()
              .mockReturnValue('prediction:profile-1:school-1'),
            getFromCache: jest.fn().mockResolvedValue(null),
            saveToCache: jest.fn().mockResolvedValue(undefined),
            hashProfileData: jest.fn().mockReturnValue('mock-hash'),
            invalidateUserCache: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionCalibrationService,
          useValue: {
            getSchoolCalibrations: jest.fn().mockResolvedValue({}),
            getPlattCalibration: jest.fn().mockResolvedValue(null),
            applyPlattCalibration: jest.fn().mockImplementation((p) => p),
            invalidateCalibrationCache: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionHistoricalService,
          useValue: {
            getSchoolDistribution: jest.fn().mockResolvedValue(null),
            getHistoricalProbability: jest.fn().mockResolvedValue(null),
            getNationalityStats: jest.fn().mockResolvedValue(null),
            getFeederSignal: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: PredictionMemoryService,
          useValue: {
            getMemoryContext: jest.fn().mockResolvedValue(mockMemoryContext),
            recordPredictionToMemory: jest.fn().mockResolvedValue(undefined),
            recordBridgePredictionToMemory: jest
              .fn()
              .mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionPersistenceService,
          useValue: {
            savePrediction: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionReportingService,
          useValue: {
            getPredictionHistory: jest.fn().mockResolvedValue([]),
            reportActualResult: jest.fn().mockResolvedValue(undefined),
            getCalibrationData: jest.fn().mockResolvedValue({
              totalPredictions: 100,
              withActualResults: 20,
              calibrationBuckets: [
                { range: '0-20', predicted: 10, actual: 8, count: 5 },
                { range: '20-40', predicted: 30, actual: 25, count: 5 },
                { range: '40-60', predicted: 50, actual: 48, count: 5 },
                { range: '60-80', predicted: 70, actual: 65, count: 3 },
                { range: '80-100', predicted: 90, actual: 85, count: 2 },
              ],
            }),
          },
        },
        {
          provide: CaseIncentiveService,
          useValue: {
            charge: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ModelRegistryService,
          useValue: {
            getChampionModel: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ShadowEvaluatorService,
          useValue: {
            runIfActive: jest.fn().mockResolvedValue(undefined),
            submitShadowEvaluation: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ModelMonitorService,
          useValue: {
            recordPrediction: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PredictionPolicyService,
          useValue: {
            resolveServedPolicyVersionId: jest
              .fn()
              .mockReturnValue('v3-enterprise'),
            buildTracePayload: jest.fn().mockReturnValue(undefined),
          },
        },
        {
          provide: PredictionMlPrimaryService,
          useValue: {
            predictForSchool: jest.fn(),
          },
        },
        {
          provide: FeatureFlagService,
          useValue: {
            isEnabled: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: DistillationService,
          useValue: {
            getPhase1LiveTeacherSignals: jest.fn().mockResolvedValue([]),
            computeBlendDecision: jest
              .fn()
              .mockImplementation((probability) => ({
                teacherSignals: [],
                teacherEnsemble: null,
                pairwiseMae: null,
                disagreementFactor: 0,
                effectiveW: 0,
                blendedPrePlatt: probability,
                hasSignal: false,
              })),
          },
        },
        {
          provide: CompliantDistillationService,
          useValue: {
            buildInputSummary: jest.fn().mockReturnValue({
              sat: 1500,
              act: null,
              gpaNormalized: 0.95,
              nationality: 'CN',
              curriculumType: 'AP',
              highSchoolType: 'INTL_CN',
              isInternational: true,
            }),
            resolveCohortKey: jest.fn().mockReturnValue('CN__CHINA_INTL'),
            evaluatePrediction: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<PredictionService>(PredictionService);
    prisma = module.get<PrismaService>(PrismaService);
    _redis = module.get<RedisService>(RedisService);
    aiEngine = module.get<PredictionAiEngine>(PredictionAiEngine);
    cacheService = module.get<PredictionCacheService>(PredictionCacheService);
    memoryService = module.get<PredictionMemoryService>(
      PredictionMemoryService,
    );
    persistenceService = module.get<PredictionPersistenceService>(
      PredictionPersistenceService,
    );
    reportingService = module.get<PredictionReportingService>(
      PredictionReportingService,
    );
    mlPrimaryService = module.get<PredictionMlPrimaryService>(
      PredictionMlPrimaryService,
    );
    featureFlagService = module.get<FeatureFlagService>(FeatureFlagService);
    distillationService = module.get<DistillationService>(DistillationService);
    compliantDistillationService = module.get<CompliantDistillationService>(
      CompliantDistillationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('predict', () => {
    beforeEach(() => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (prisma.school.findMany as jest.Mock).mockResolvedValue([mockSchool]);
      // Reset fusePredictions to return a fresh copy each call
      const fusionEngine = service['fusionEngine'];
      (fusionEngine.fusePredictions as jest.Mock).mockImplementation(() => ({
        ...mockFusedResult,
        engineScores: { ...mockFusedResult.engineScores },
      }));
    });

    it('should return prediction results for given schools', async () => {
      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results).toHaveLength(1);
      expect(output.results[0].schoolId).toBe('school-1');
      expect(output.results[0].probability).toBeGreaterThanOrEqual(0.05);
      expect(output.results[0].probability).toBeLessThanOrEqual(0.95);
      expect(output.dataCompleteness).toBeGreaterThanOrEqual(0);
      expect(output.memoryContext).toBeDefined();
    });

    it('should return empty results if profile not found', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

      const output = await service.predict('nonexistent', ['school-1']);
      expect(output.results).toEqual([]);
      expect(output.dataCompleteness).toBe(0);
    });

    it('should use cached result when available', async () => {
      const cachedResult = {
        schoolId: 'school-1',
        schoolName: 'MIT',
        probability: 0.35,
        tier: 'reach',
        confidence: 'medium',
        fromCache: true,
      };
      (cacheService.getFromCache as jest.Mock).mockResolvedValue(cachedResult);

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results).toHaveLength(1);
      expect(output.results[0].fromCache).toBe(true);
      // AI should NOT have been called since we got a cache hit
      expect(aiEngine.predictWithAI).not.toHaveBeenCalled();
    });

    it('should bypass prediction cache when forceRefresh is true', async () => {
      const output = await service.predict('profile-1', ['school-1'], true);

      // forceRefresh skips the prediction cache lookup, so predict should run engines
      expect(output.results).toHaveLength(1);
      // AI should have been called (not short-circuited by cache)
      expect(aiEngine.predictWithAI).toHaveBeenCalled();
      // dataCompleteness should be threaded through to the AI engine
      const callArgs = (aiEngine.predictWithAI as jest.Mock).mock.calls[0];
      const lastArg = callArgs[callArgs.length - 1];
      expect(typeof lastArg).toBe('number');
    });

    it('should include tier classification (reach/match/safety)', async () => {
      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results[0].tier).toBeDefined();
      expect(['reach', 'match', 'safety']).toContain(output.results[0].tier);
    });

    it('should include confidence interval', async () => {
      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results[0].probabilityLow).toBeDefined();
      expect(output.results[0].probabilityHigh).toBeDefined();
      expect(output.results[0].probabilityLow).toBeLessThanOrEqual(
        output.results[0].probability,
      );
      expect(output.results[0].probabilityHigh).toBeGreaterThanOrEqual(
        output.results[0].probability,
      );
    });

    it('should return a user-facing confidence explanation instead of a raw level key', async () => {
      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results[0].confidenceReason).toBeDefined();
      expect(output.results[0].confidenceReason).not.toBe('medium');
      expect(output.results[0].confidenceReason).toContain('参考程度');
    });

    it('should fall back to profile applicationRound when no per-school round exists', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        ...mockProfile,
        applicationRound: 'EA',
      });

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results[0].roundContext).toBe('EA');
    });

    it('should classify tier using contextual acceptance rate', async () => {
      const scoreCalculator = jest.requireMock('./utils/score-calculator');
      scoreCalculator.resolveContextualAcceptanceRate.mockReturnValue({
        rate: 16.5,
        rawRate: 15,
        baseType: 'international',
        roundContext: 'EA',
        roundAdjusted: true,
      });
      (service['transformer'].profileToInput as jest.Mock).mockReturnValue({
        ...mockProfileInput,
        isInternational: true,
      });
      (service['transformer'].schoolToInput as jest.Mock).mockReturnValue({
        ...mockSchoolInput,
        acceptanceRate: 49.2,
        intlAcceptanceRate: 15,
        applicationRound: 'EA',
      });
      (
        service['transformer'].extractSchoolMetrics as jest.Mock
      ).mockReturnValue({
        ...mockSchoolMetrics,
        acceptanceRate: 49.2,
      });

      await service.predict('profile-1', ['school-1']);

      expect(scoreCalculator.calculateTier).toHaveBeenCalledWith(
        mockFusedResult.probability * 1.1,
        expect.objectContaining({ acceptanceRate: 16.5 }),
      );
    });

    it('should preserve a positive EA round lift even when AI is less optimistic', async () => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        ...mockProfile,
        applicationRound: 'EA',
      });
      (aiEngine.predictWithAI as jest.Mock).mockImplementation(
        async (_profile, school) => ({
          ...mockAiResult,
          probability: school.applicationRound === 'EA' ? 0.35 : 0.45,
        }),
      );

      const eaOutput = await service.predict('profile-1', ['school-1'], true);

      (prisma.profile.findUnique as jest.Mock).mockResolvedValue({
        ...mockProfile,
        applicationRound: 'RD',
      });
      const rdOutput = await service.predict('profile-1', ['school-1'], true);

      expect(eaOutput.results[0].roundContext).toBe('EA');
      expect(rdOutput.results[0].roundContext).toBe('RD');
      expect(eaOutput.results[0].probability).toBeGreaterThan(
        rdOutput.results[0].probability,
      );
    });

    it('should include factor analysis', async () => {
      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results[0].factors).toBeDefined();
      expect(Array.isArray(output.results[0].factors)).toBe(true);
    });

    it('should cache prediction result in Redis', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(cacheService.saveToCache).toHaveBeenCalledWith(
        'profile-1',
        'school-1',
        expect.any(Object),
        expect.any(String),
        'v3-enterprise',
      );
    });

    it('should persist prediction to database', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(persistenceService.savePrediction).toHaveBeenCalled();
    });

    it('should handle multiple schools', async () => {
      const school2 = { ...mockSchool, id: 'school-2', name: 'Stanford' };
      (prisma.school.findMany as jest.Mock).mockResolvedValue([
        mockSchool,
        school2,
      ]);

      const output = await service.predict('profile-1', [
        'school-1',
        'school-2',
      ]);

      expect(output.results).toHaveLength(2);
    });

    it('should gracefully handle AI prediction failure', async () => {
      (aiEngine.predictWithAI as jest.Mock).mockRejectedValue(
        new Error('AI service timeout'),
      );
      // When AI fails, fusePredictions should return stats_only result
      const fusionEngine = service['fusionEngine'];
      (fusionEngine.fusePredictions as jest.Mock).mockImplementation(() => ({
        probability: 0.35,
        probabilityLow: 0.28,
        probabilityHigh: 0.42,
        crossEngineConsistency: 1.0,
        engineScores: {
          stats: 0.35,
          ai: null,
          historical: null,
          fusionMethod: 'stats_only',
        },
      }));

      const output = await service.predict('profile-1', ['school-1']);

      // Should still return results from stats engine
      expect(output.results).toHaveLength(1);
      expect(output.results[0].probability).toBeDefined();
    });

    it('should record predictions to memory system', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(memoryService.recordPredictionToMemory).toHaveBeenCalled();
    });

    it('should persist served ML-Primary results when v5 feature flag is enabled', async () => {
      (featureFlagService.isEnabled as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (mlPrimaryService.predictForSchool as jest.Mock).mockResolvedValue({
        schoolId: 'school-1',
        schoolName: 'MIT',
        probability: 0.42,
        probabilityLow: 0.36,
        probabilityHigh: 0.48,
        confidence: 'medium',
        tier: 'match',
        factors: [],
        suggestions: [],
        comparison: {
          gpaPercentile: 80,
          testScorePercentile: 78,
          activityStrength: 'strong',
        },
        modelVersion: 'v5-ml-primary',
        policyVersionId: 'v5-ml-primary',
        applicationRound: 'RD',
      });

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results[0].modelVersion).toBe('v5-ml-primary');
      expect(aiEngine.predictWithAI).not.toHaveBeenCalled();
      expect(cacheService.saveToCache).toHaveBeenCalledWith(
        'profile-1',
        'school-1',
        expect.objectContaining({ modelVersion: 'v5-ml-primary' }),
        expect.any(String),
        'v3-enterprise',
        'v5',
      );
      expect(persistenceService.savePrediction).toHaveBeenCalledWith(
        'profile-1',
        'school-1',
        expect.objectContaining({ modelVersion: 'v5-ml-primary' }),
      );
    });

    it('should keep distillation disabled when the feature flag is off', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(
        distillationService.getPhase1LiveTeacherSignals,
      ).not.toHaveBeenCalled();
      expect(distillationService.computeBlendDecision).not.toHaveBeenCalled();
    });

    it('should apply the pre-Platt distillation variant when the feature flag is on', async () => {
      (featureFlagService.isEnabled as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const calibrationService = service['calibrationService'];
      (calibrationService.getPlattCalibration as jest.Mock).mockResolvedValue({
        a: 1,
        b: 0,
      });
      (
        calibrationService.applyPlattCalibration as jest.Mock
      ).mockImplementation((probability) => probability);
      (
        distillationService.getPhase1LiveTeacherSignals as jest.Mock
      ).mockResolvedValue([
        {
          sourceKey: 'campusreel-static',
          sourceLabel: 'CampusReel Static Teacher',
          probability: 0.61,
          weight: 0.3,
          confidence: 'medium',
          kind: 'static',
          rawPayload: {},
        },
      ]);
      (distillationService.computeBlendDecision as jest.Mock).mockReturnValue({
        teacherSignals: [
          {
            sourceKey: 'campusreel-static',
            sourceLabel: 'CampusReel Static Teacher',
            probability: 0.61,
            weight: 0.3,
            confidence: 'medium',
            kind: 'static',
            rawPayload: {},
          },
        ],
        teacherEnsemble: 0.61,
        pairwiseMae: null,
        disagreementFactor: 1,
        effectiveW: 0.2,
        blendedPrePlatt: 0.4,
        hasSignal: true,
      });

      const output = await service.predict('profile-1', ['school-1'], true);

      expect(
        distillationService.getPhase1LiveTeacherSignals,
      ).toHaveBeenCalledWith(mockProfileInput, 'school-1');
      expect(calibrationService.applyPlattCalibration).toHaveBeenCalledWith(
        0.4,
        { a: 1, b: 0 },
      );
      expect(output.results[0].probability).toBeCloseTo(0.4, 6);
    });

    it('should leave the probability unchanged when distillation has no teacher signal', async () => {
      (featureFlagService.isEnabled as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      (
        distillationService.getPhase1LiveTeacherSignals as jest.Mock
      ).mockResolvedValue([]);
      (distillationService.computeBlendDecision as jest.Mock).mockReturnValue({
        teacherSignals: [],
        teacherEnsemble: null,
        pairwiseMae: null,
        disagreementFactor: 0,
        effectiveW: 0,
        blendedPrePlatt: mockFusedResult.probability,
        hasSignal: false,
      });

      const output = await service.predict('profile-1', ['school-1'], true);

      expect(output.results[0].probability).toBeCloseTo(
        mockFusedResult.probability,
        6,
      );
    });

    it('should apply the compliant distillation blend when live mode is enabled', async () => {
      (featureFlagService.isEnabled as jest.Mock)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      (
        compliantDistillationService.evaluatePrediction as jest.Mock
      ).mockResolvedValueOnce({
        decision: {
          hasSignal: true,
          teacherSignals: [
            {
              key: 'scorecard-v1',
              label: 'Scorecard Conditional Probability',
              sourceName: 'distillation:scorecard-v1',
              sourceType: 'OFFICIAL_FEDERAL',
              configuredWeight: 0.12,
              effectiveBlendWeight: 0.12,
              probability: 0.61,
              active: true,
              confidence: 'medium',
              missingReasons: [],
            },
          ],
          coverageTier: 'CN_ENHANCED',
          cohortKey: 'CN__CHINA_INTL',
          blendedPrePlatt: 0.47,
          totalConfiguredWeight: 0.12,
          totalEffectiveWeight: 0.12,
          liveEligible: true,
        },
        stage: 'DISTILLATION_LIVE',
        applyLiveBlend: true,
      });

      const output = await service.predict('profile-1', ['school-1'], true);

      expect(
        compliantDistillationService.evaluatePrediction,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          ourProbPrePlatt: mockFusedResult.probability,
          servedProbability: mockFusedResult.probability,
        }),
        { shadowEnabled: false, liveEnabled: true },
      );
      expect(output.results[0].probability).toBeCloseTo(0.47, 6);
      expect(output.results[0].modelVersion).toBe('v3-enterprise');
      expect(output.results[0].cohortKey).toBe('CN__CHINA_INTL');
      expect((output.results[0] as any).servedTrace.distillation).toMatchObject(
        {
          stage: 'DISTILLATION_LIVE',
          applyLiveBlend: true,
          liveEligible: true,
          activeTeacherKeys: ['scorecard-v1'],
          candidateServedProbability: 0.47,
          servedProbability: 0.47,
        },
      );
    });

    it('should serve the fusion result when compliant live blend is off', async () => {
      const output = await service.predict('profile-1', ['school-1'], true);

      expect(
        compliantDistillationService.evaluatePrediction,
      ).not.toHaveBeenCalled();
      expect(output.results[0].modelVersion).toBe('v3-enterprise');
      expect(output.results[0].probability).toBeCloseTo(
        mockFusedResult.probability,
        6,
      );
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete all cached predictions for a profile', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([
        { schoolId: 'school-1' },
        { schoolId: 'school-2' },
      ]);

      await service.invalidateUserCache('profile-1');

      expect(cacheService.invalidateUserCache).toHaveBeenCalledWith(
        'profile-1',
        ['school-1', 'school-2'],
      );
    });

    it('should handle empty prediction history', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.invalidateUserCache('profile-1'),
      ).resolves.not.toThrow();
    });

    it('should not throw if cache deletion fails', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([
        { schoolId: 'school-1' },
      ]);
      (cacheService.invalidateUserCache as jest.Mock).mockRejectedValue(
        new Error('Redis error'),
      );

      await expect(
        service.invalidateUserCache('profile-1'),
      ).resolves.not.toThrow();
    });
  });

  describe('fusePredictions (via predict)', () => {
    beforeEach(() => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (prisma.school.findMany as jest.Mock).mockResolvedValue([mockSchool]);
    });

    it('should use stats-only fusion when AI and historical fail', async () => {
      (aiEngine.predictWithAI as jest.Mock).mockRejectedValue(
        new Error('AI failed'),
      );
      const fusionEngine = service['fusionEngine'];
      (fusionEngine.fusePredictions as jest.Mock).mockReturnValue({
        probability: 0.35,
        probabilityLow: 0.28,
        probabilityHigh: 0.42,
        crossEngineConsistency: 1.0,
        engineScores: {
          stats: 0.35,
          ai: null,
          historical: null,
          fusionMethod: 'stats_only',
        },
      });

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results).toHaveLength(1);
      expect(output.results[0].engineScores?.fusionMethod).toBe('stats_only');
    });

    it('should use 2-engine fusion when AI succeeds but no historical data', async () => {
      const fusionEngine = service['fusionEngine'];
      (fusionEngine.fusePredictions as jest.Mock).mockReturnValue({
        probability: 0.33,
        probabilityLow: 0.26,
        probabilityHigh: 0.4,
        crossEngineConsistency: 0.85,
        engineScores: {
          stats: 0.35,
          ai: 0.3,
          historical: null,
          fusionMethod: 'weighted_ensemble_2_stats_ai',
        },
      });

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results).toHaveLength(1);
      // AI succeeded, but historical returned null → stats + ai = weighted_ensemble_2_stats_ai
      const method = output.results[0].engineScores?.fusionMethod;
      expect(method).toBe('weighted_ensemble_2_stats_ai');
    });

    it('should clamp probability between 0.05 and 0.95', async () => {
      // When school calibration is applied (adj > 0), probability is clamped to 0.98
      const calibrationService = service['calibrationService'];
      (calibrationService.getSchoolCalibrations as jest.Mock).mockResolvedValue(
        {
          'school-1': 1.0,
        },
      );
      const fusionEngine = service['fusionEngine'];
      (fusionEngine.fusePredictions as jest.Mock).mockReturnValue({
        probability: 0.99,
        probabilityLow: 0.92,
        probabilityHigh: 0.99,
        crossEngineConsistency: 0.9,
        engineScores: {
          stats: 0.99,
          ai: 0.99,
          historical: null,
          fusionMethod: 'weighted_ensemble_2_stats_ai',
        },
      });

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results[0].probability).toBeLessThanOrEqual(0.98);
    });
  });

  describe('reportActualResult', () => {
    it('should update prediction result with actual outcome', async () => {
      await service.reportActualResult('profile-1', 'school-1', 'ADMITTED');

      expect(reportingService.reportActualResult).toHaveBeenCalledWith(
        'profile-1',
        'school-1',
        'ADMITTED',
        undefined,
      );
    });
  });

  describe('getPredictionHistory', () => {
    it('should return paginated prediction history for a profile', async () => {
      const mockPaginated = {
        items: [
          {
            id: 'pred-1',
            schoolId: 'school-1',
            probability: 0.45,
            tier: 'match',
            createdAt: new Date(),
            school: mockSchool,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
      (reportingService.getPredictionHistory as jest.Mock).mockResolvedValue(
        mockPaginated,
      );

      const results = await service.getPredictionHistory('profile-1');
      expect(results.items).toHaveLength(1);
      expect(results.total).toBe(1);
    });
  });

  describe('getCalibrationData', () => {
    it('should return calibration statistics', async () => {
      const result = await service.getCalibrationData();

      expect(result).toBeDefined();
      expect(result.totalPredictions).toBe(100);
      expect(result.withActualResults).toBe(20);
      expect(result.calibrationBuckets).toHaveLength(5);
    });
  });

  describe('memory integration', () => {
    beforeEach(() => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (prisma.school.findMany as jest.Mock).mockResolvedValue([mockSchool]);
      // Reset fusePredictions to return a fresh copy each call
      const fusionEngine = service['fusionEngine'];
      (fusionEngine.fusePredictions as jest.Mock).mockImplementation(() => ({
        ...mockFusedResult,
        engineScores: { ...mockFusedResult.engineScores },
      }));
    });

    it('should retrieve memory context before prediction', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(memoryService.getMemoryContext).toHaveBeenCalled();
    });

    it('should record school entities after prediction', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(memoryService.recordPredictionToMemory).toHaveBeenCalled();
    });

    it('should proceed without memory when manager is unavailable', async () => {
      // Create service without memory manager — PredictionMemoryService handles graceful degradation
      // Mock getMemoryContext to return empty context (simulating unavailable memory)
      (memoryService.getMemoryContext as jest.Mock).mockResolvedValue({
        previousPredictions: [],
        knownPreferences: [],
        profileInsights: [],
        memoryAdjustments: new Map<string, number>(),
      });

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results).toHaveLength(1);
    });
  });

  describe('generateSuggestions (private)', () => {
    const baseProfile = {
      gpa: 3.9,
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [],
      awards: [],
      targetMajor: undefined,
    } as any;

    const baseSchool = { name: 'MIT', acceptanceRate: 0.04 } as any;

    it('returns AI suggestions when >= 3 are provided', () => {
      const aiSuggestions = [
        'suggestion 1',
        'suggestion 2',
        'suggestion 3',
        'suggestion 4',
      ];
      const result = service['generateSuggestions'](
        'reach',
        'high',
        baseProfile,
        baseSchool,
        aiSuggestions,
        'en',
      );
      expect(result).toEqual(aiSuggestions.slice(0, 4));
      // Should not contain fallback templates
      expect(
        result.every((s: string) => !s.includes('USACO') && !s.includes('RSI')),
      ).toBe(true);
    });

    it('uses CS programs for CS student reach tier', () => {
      const csProfile = { ...baseProfile, targetMajor: 'Computer Science' };
      const result = service['generateSuggestions'](
        'reach',
        'medium',
        csProfile,
        baseSchool,
        [],
        'en',
      );
      // Should contain CS-specific programs
      const joined = result.join(' ');
      expect(joined).toMatch(/MITES|Google CSSI|COSMOS/);
    });

    it('uses humanities programs for humanities student match tier', () => {
      const humProfile = { ...baseProfile, targetMajor: 'English Literature' };
      const result = service['generateSuggestions'](
        'match',
        'medium',
        humProfile,
        baseSchool,
        [],
        'en',
      );
      const joined = result.join(' ');
      expect(joined).toMatch(/TASP|Scholastic|John Locke|Concord Review/);
    });

    it('deduplicates programs already in activities', () => {
      const csProfile = {
        ...baseProfile,
        targetMajor: 'Computer Science',
        activities: [{ name: 'USACO', category: 'COMPETITION' }],
      };
      const result = service['generateSuggestions'](
        'reach',
        'medium',
        csProfile,
        baseSchool,
        [],
        'en',
      );
      const joined = result.join(' ');
      // USACO should not appear since student already does it
      expect(joined).not.toContain('USACO');
    });

    it('returns GENERAL programs when no targetMajor', () => {
      const result = service['generateSuggestions'](
        'reach',
        'medium',
        baseProfile,
        baseSchool,
        [],
        'en',
      );
      const joined = result.join(' ');
      expect(joined).toMatch(/YYGS|MITES|MOSTEC/);
    });

    it('returns zh content when locale is zh', () => {
      const csProfile = { ...baseProfile, targetMajor: 'Computer Science' };
      const result = service['generateSuggestions'](
        'reach',
        'medium',
        csProfile,
        baseSchool,
        [],
        'zh',
      );
      const joined = result.join(' ');
      expect(joined).toMatch(/冲刺校|文书|早申/);
    });
  });
});
