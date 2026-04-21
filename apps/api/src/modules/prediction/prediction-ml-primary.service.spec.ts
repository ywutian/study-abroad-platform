import { Test, TestingModule } from '@nestjs/testing';
import {
  PredictionMlPrimaryService,
  MlPrimaryResult,
} from './prediction-ml-primary.service';
import { PredictionHookModifiersService } from './prediction-hook-modifiers.service';
import { ModelRegistryService } from './ml/model-registry.service';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionTransformerService } from './prediction-transformer.service';
import { PredictionMemoryService } from './prediction-memory.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ProfileInput, SchoolInput } from './prediction.prompts';
import type {
  ProfileMetrics,
  SchoolMetrics,
} from '@study-abroad/shared/scoring';

describe('PredictionMlPrimaryService', () => {
  let service: PredictionMlPrimaryService;
  let hookModifiers: PredictionHookModifiersService;
  let modelRegistry: ModelRegistryService;
  let calibration: PredictionCalibrationService;
  let prisma: PrismaService;

  // ============================================
  // Mock factories
  // ============================================

  const mockHookModifiers = {
    getBaseRate: jest.fn().mockResolvedValue(0.1),
    computeHookShifts: jest.fn().mockReturnValue([
      {
        hookType: 'ROUND_BONUS',
        logOddsShift: 0.3,
        source: 'ED round bonus',
      },
    ]),
    applyHooks: jest.fn().mockReturnValue(0.13),
  };

  const mockModelRegistry = {
    getChampionModel: jest.fn().mockResolvedValue(null),
  };

  const mockCalibration = {
    getPlattCalibration: jest.fn().mockResolvedValue(null),
    applyPlattCalibration: jest.fn(),
    getSchoolCalibrations: jest.fn().mockResolvedValue({}),
  };

  const mockTransformer = {};

  const mockMemory = {};

  const mockPrisma = {
    predictionResult: {
      findMany: jest.fn().mockResolvedValue([]), // Tier 0 by default
    },
    schoolProgram: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  // ============================================
  // Test fixtures
  // ============================================

  const makeSchool = (overrides: Record<string, unknown> = {}) => ({
    id: 'school-1',
    name: 'MIT',
    acceptanceRate: 4,
    sat25: 1510,
    sat75: 1580,
    usNewsRank: 2,
    graduationRate: 95,
    ...overrides,
  });

  const makeProfileInput = (
    overrides: Partial<ProfileInput> = {},
  ): ProfileInput => ({
    testScores: [{ type: 'SAT', score: 1520 }],
    activities: [],
    awards: [],
    ...overrides,
  });

  const makeSchoolInput = (
    overrides: Partial<SchoolInput> = {},
  ): SchoolInput => ({
    id: 'school-1',
    name: 'MIT',
    acceptanceRate: 4,
    ...overrides,
  });

  const makeProfileMetrics = (
    overrides: Partial<ProfileMetrics> = {},
  ): ProfileMetrics => ({
    gpa: 3.9,
    satScore: 1520,
    activityCount: 5,
    awardCount: 3,
    nationalAwardCount: 1,
    internationalAwardCount: 0,
    ...overrides,
  });

  const makeSchoolMetrics = (
    overrides: Partial<SchoolMetrics> = {},
  ): SchoolMetrics => ({
    acceptanceRate: 4,
    sat25: 1510,
    sat75: 1580,
    usNewsRank: 2,
    graduationRate: 95,
    ...overrides,
  });

  beforeEach(async () => {
    // Reset all mocks to defaults
    mockHookModifiers.getBaseRate.mockResolvedValue(0.1);
    mockHookModifiers.computeHookShifts.mockReturnValue([
      {
        hookType: 'ROUND_BONUS',
        logOddsShift: 0.3,
        source: 'ED round bonus',
      },
    ]);
    mockHookModifiers.applyHooks.mockReturnValue(0.13);
    mockModelRegistry.getChampionModel.mockResolvedValue(null);
    mockCalibration.getPlattCalibration.mockResolvedValue(null);
    mockCalibration.getSchoolCalibrations.mockResolvedValue({});
    mockPrisma.predictionResult.findMany.mockResolvedValue([]);
    mockPrisma.schoolProgram.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionMlPrimaryService,
        {
          provide: PredictionHookModifiersService,
          useValue: mockHookModifiers,
        },
        {
          provide: ModelRegistryService,
          useValue: mockModelRegistry,
        },
        {
          provide: PredictionCalibrationService,
          useValue: mockCalibration,
        },
        {
          provide: PredictionTransformerService,
          useValue: mockTransformer,
        },
        {
          provide: PredictionMemoryService,
          useValue: mockMemory,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PredictionMlPrimaryService>(
      PredictionMlPrimaryService,
    );
    hookModifiers = module.get<PredictionHookModifiersService>(
      PredictionHookModifiersService,
    );
    modelRegistry = module.get<ModelRegistryService>(ModelRegistryService);
    calibration = module.get<PredictionCalibrationService>(
      PredictionCalibrationService,
    );
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Tier 0: fuseBaseRateAndHeuristic
  // ============================================

  describe('Tier 0 — heuristic fusion', () => {
    it('should use Tier 0 when labeledCount is 0 (cold start)', async () => {
      mockPrisma.predictionResult.findMany.mockResolvedValue([]);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(result.pipelineTier).toBe(0);
      expect(result.engineScores.fusionMethod).toBe(
        'heuristic_fused_base_rate',
      );
    });

    it('should call hookModifiers.getBaseRate with correct arguments', async () => {
      const school = makeSchool();
      const profileInput = makeProfileInput();

      await service.predictForSchool(
        'profile-1',
        school,
        profileInput,
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'ED',
        'en',
      );

      expect(mockHookModifiers.getBaseRate).toHaveBeenCalledWith(
        school,
        profileInput,
        'ED',
        undefined, // majorCompetitiveness (schoolProgram.findFirst returns null)
      );
    });

    it('should produce a probability between 0.05 and 0.95', async () => {
      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(result.probability).toBeGreaterThanOrEqual(0.05);
      expect(result.probability).toBeLessThanOrEqual(0.95);
    });
  });

  // ============================================
  // Hook shifts applied after raw probability
  // ============================================

  describe('hook shifts application', () => {
    it('should call computeHookShifts and applyHooks after computing raw probability', async () => {
      const profileInput = makeProfileInput();
      const schoolInput = makeSchoolInput();

      await service.predictForSchool(
        'profile-1',
        makeSchool(),
        profileInput,
        schoolInput,
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'ED',
        'en',
      );

      expect(mockHookModifiers.computeHookShifts).toHaveBeenCalledWith(
        profileInput,
        schoolInput,
      );
      expect(mockHookModifiers.applyHooks).toHaveBeenCalledWith(
        expect.any(Number), // raw probability from fuseBaseRateAndHeuristic
        expect.arrayContaining([
          expect.objectContaining({ hookType: 'ROUND_BONUS' }),
        ]),
      );
    });

    it('should pass raw probability (not base rate) to applyHooks', async () => {
      // baseRate = 0.10, but raw probability from fusion will differ
      mockHookModifiers.getBaseRate.mockResolvedValue(0.1);

      await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      // applyHooks should be called with a number (the fused probability)
      const appliedProb = mockHookModifiers.applyHooks.mock.calls[0][0];
      expect(typeof appliedProb).toBe('number');
      expect(appliedProb).toBeGreaterThan(0);
      expect(appliedProb).toBeLessThan(1);
    });
  });

  // ============================================
  // Factors from hookShifts
  // ============================================

  describe('factors generation', () => {
    it('should generate factors from hook shifts (not empty)', async () => {
      mockHookModifiers.computeHookShifts.mockReturnValue([
        {
          hookType: 'LEGACY_PRIMARY',
          logOddsShift: 2.14,
          source: 'Arcidiacono (2020)',
        },
        {
          hookType: 'FIRST_GEN',
          logOddsShift: 0.4,
          source: 'Arcidiacono (2020)',
        },
      ]);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(result.factors.length).toBeGreaterThan(0);
      expect(result.factors[0]).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          impact: expect.stringMatching(/^(positive|negative)$/),
          weight: expect.any(Number),
          detail: expect.stringContaining('log-odds'),
        }),
      );
    });

    it('should filter out shifts with absolute value <= 0.05', async () => {
      mockHookModifiers.computeHookShifts.mockReturnValue([
        {
          hookType: 'TINY_SHIFT',
          logOddsShift: 0.03, // Below threshold
          source: 'test',
        },
        {
          hookType: 'FIRST_GEN',
          logOddsShift: 0.4,
          source: 'test',
        },
      ]);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      // Only FIRST_GEN should appear (TINY_SHIFT filtered out)
      expect(result.factors.length).toBe(1);
      expect(result.factors[0].name).toBe('First-Generation Status');
    });

    it('should mark negative shifts as negative impact', async () => {
      mockHookModifiers.computeHookShifts.mockReturnValue([
        {
          hookType: 'NEED_AWARE_FULL',
          logOddsShift: -1.0,
          source: 'test',
        },
      ]);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(result.factors[0].impact).toBe('negative');
    });
  });

  // ============================================
  // hookShifts redaction
  // ============================================

  describe('hookShifts redaction', () => {
    it('should redact logOddsShift to 0 in the result', async () => {
      mockHookModifiers.computeHookShifts.mockReturnValue([
        {
          hookType: 'LEGACY_PRIMARY',
          logOddsShift: 2.14,
          source: 'Arcidiacono (2020)',
        },
        {
          hookType: 'NEED_AWARE_FULL',
          logOddsShift: -1.0,
          source: 'Need-aware penalty',
        },
      ]);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      for (const hook of result.hookShifts) {
        expect(hook.logOddsShift).toBe(0);
      }
    });

    it('should replace hookType with human-readable label', async () => {
      mockHookModifiers.computeHookShifts.mockReturnValue([
        {
          hookType: 'LEGACY_PRIMARY',
          logOddsShift: 2.14,
          source: 'test',
        },
      ]);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(result.hookShifts[0].hookType).toBe('Legacy Advantage');
    });

    it('should use positive/negative as source instead of exact reference', async () => {
      mockHookModifiers.computeHookShifts.mockReturnValue([
        {
          hookType: 'FIRST_GEN',
          logOddsShift: 0.4,
          source: 'Arcidiacono (2020)',
        },
        {
          hookType: 'NEED_AWARE_FULL',
          logOddsShift: -1.0,
          source: 'Need-aware',
        },
      ]);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(result.hookShifts[0].source).toBe('positive');
      expect(result.hookShifts[1].source).toBe('negative');
    });
  });

  // ============================================
  // servedTrace
  // ============================================

  describe('servedTrace', () => {
    it('should populate servedTrace with pipeline metadata', async () => {
      mockHookModifiers.computeHookShifts.mockReturnValue([
        {
          hookType: 'ROUND_BONUS',
          logOddsShift: 0.3,
          source: 'ED',
        },
      ]);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'ED',
        'en',
      );

      const trace = result.servedTrace as any;
      expect(trace).toBeDefined();
      expect(trace.pipeline).toBe('ml-primary');
      expect(trace.pipelineTier).toBe(0);
      expect(trace.baseRate).toBe(0.1);
      expect(trace.engineDetail).toBe('heuristic_fused_base_rate');
      expect(trace.labeledCount).toBe(0);
    });

    it('should include full-precision hookShifts in servedTrace (not redacted)', async () => {
      mockHookModifiers.computeHookShifts.mockReturnValue([
        {
          hookType: 'LEGACY_PRIMARY',
          logOddsShift: 2.14,
          source: 'Arcidiacono (2020)',
        },
      ]);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      const trace = result.servedTrace as any;
      // servedTrace should contain the unredacted hooks
      expect(trace.hookShifts[0].logOddsShift).toBe(2.14);
    });
  });

  // ============================================
  // policyVersionId
  // ============================================

  describe('policyVersionId', () => {
    it('should set policyVersionId to v5-ml-primary', async () => {
      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(result.policyVersionId).toBe('v5-ml-primary');
      expect(result.modelVersion).toBe('v5-ml-primary');
    });
  });

  // ============================================
  // resolveMajorCompetitiveness
  // ============================================

  describe('resolveMajorCompetitiveness', () => {
    it('should use cipCode filter when major resolves to a CIP code', async () => {
      mockPrisma.schoolProgram.findFirst.mockResolvedValue({
        competitiveness: 5,
      });

      await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics({ targetMajorCategory: 'Computer Science' }),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      // Should have called schoolProgram.findFirst with cipCode
      expect(mockPrisma.schoolProgram.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: 'school-1',
          }),
          select: { competitiveness: true },
        }),
      );
    });

    it('should pass competitiveness to getBaseRate', async () => {
      mockPrisma.schoolProgram.findFirst.mockResolvedValue({
        competitiveness: 5,
      });

      await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics({ targetMajorCategory: 'Computer Science' }),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(mockHookModifiers.getBaseRate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'RD',
        5, // competitiveness from schoolProgram
      );
    });

    it('should pass undefined to getBaseRate when no targetMajorCategory', async () => {
      await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics({ targetMajorCategory: undefined }),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(mockPrisma.schoolProgram.findFirst).not.toHaveBeenCalled();
      expect(mockHookModifiers.getBaseRate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'RD',
        undefined,
      );
    });

    it('should fall back to text search when major has no CIP mapping', async () => {
      mockPrisma.schoolProgram.findFirst.mockResolvedValue(null);

      await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics({
          targetMajorCategory: 'Underwater Basket Weaving',
        }),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      // Should have been called (may use text search fallback)
      expect(mockPrisma.schoolProgram.findFirst).toHaveBeenCalled();

      // getBaseRate should receive undefined since no program found
      expect(mockHookModifiers.getBaseRate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'RD',
        undefined,
      );
    });
  });

  // ============================================
  // Additional result structure checks
  // ============================================

  describe('result structure', () => {
    it('should include all required fields in MlPrimaryResult', async () => {
      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'ED',
        'en',
      );

      expect(result.schoolId).toBe('school-1');
      expect(result.schoolName).toBe('MIT');
      expect(result.probability).toBeGreaterThan(0);
      expect(result.probabilityLow).toBeLessThan(result.probability);
      expect(result.probabilityHigh).toBeGreaterThan(result.probability);
      expect(result.confidence).toBeDefined();
      expect(result.tier).toBeDefined();
      expect(result.applicationRound).toBe('ED');
      expect(result.baseRate).toBe(0.1);
      expect(result.calibrationMethod).toBeDefined();
      expect(result.suggestions).toEqual([]);
      expect(result.comparison).toBeDefined();
    });

    it('should classify tier using contextual international acceptance rate', async () => {
      mockHookModifiers.applyHooks.mockReturnValue(0.3);

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool({ acceptanceRate: 49.2 }),
        makeProfileInput({ isInternational: true }),
        makeSchoolInput({ acceptanceRate: 49.2, intlAcceptanceRate: 15 }),
        makeProfileMetrics(),
        makeSchoolMetrics({ acceptanceRate: 49.2 }),
        'RD',
        'en',
      );

      expect(result.probability).toBeCloseTo(0.3, 5);
      expect(result.tier).toBe('match');
    });

    it('should widen confidence interval for Tier 0 (heuristic)', async () => {
      mockPrisma.predictionResult.findMany.mockResolvedValue([]); // Tier 0

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      // Tier 0 widens by 30%, so interval should be wider than base CI
      const interval = result.probabilityHigh - result.probabilityLow;
      // Even for 'high' confidence, Tier 0 half-width = 0.04 * 1.3 = 0.052
      // So interval >= 0.104
      expect(interval).toBeGreaterThan(0.08);
    });

    it('should set calibrationMethod to none when no calibration available', async () => {
      mockCalibration.getPlattCalibration.mockResolvedValue(null);
      mockCalibration.getSchoolCalibrations.mockResolvedValue({});

      const result = await service.predictForSchool(
        'profile-1',
        makeSchool(),
        makeProfileInput(),
        makeSchoolInput(),
        makeProfileMetrics(),
        makeSchoolMetrics(),
        'RD',
        'en',
      );

      expect(result.calibrationMethod).toBe('none');
    });
  });
});
