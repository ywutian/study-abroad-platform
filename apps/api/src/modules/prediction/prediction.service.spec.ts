import { Test, TestingModule } from '@nestjs/testing';
import { PredictionService } from './prediction.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { RedisService } from '../../common/redis/redis.service';
import { MemoryManagerService } from '../ai-agent/memory';

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
}));

// Mock prompt-builder
jest.mock('./utils/prompt-builder', () => ({
  buildPredictionPrompt: jest.fn().mockReturnValue('Mock prediction prompt'),
}));

describe('PredictionService', () => {
  let service: PredictionService;
  let prisma: PrismaService;
  let aiService: AiService;
  let redis: RedisService;
  let memoryManager: MemoryManagerService;

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
    acceptanceRate: 0.04,
    satAvg: 1540,
    sat25: 1500,
    sat75: 1580,
    actAvg: 35,
    act25: 34,
    act75: 36,
    usNewsRank: 1,
    graduationRate: 95,
  };

  const mockAIResponse = JSON.stringify({
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
  });

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
            },
            predictionResult: {
              findMany: jest.fn().mockResolvedValue([]),
              upsert: jest.fn().mockResolvedValue({ id: 'pred-1' }),
            },
          },
        },
        {
          provide: AiService,
          useValue: {
            chat: jest.fn().mockResolvedValue(mockAIResponse),
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
          provide: MemoryManagerService,
          useValue: {
            recall: jest.fn().mockResolvedValue([]),
            remember: jest.fn().mockResolvedValue(undefined),
            recordEntity: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<PredictionService>(PredictionService);
    prisma = module.get<PrismaService>(PrismaService);
    aiService = module.get<AiService>(AiService);
    redis = module.get<RedisService>(RedisService);
    memoryManager = module.get<MemoryManagerService>(MemoryManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('predict', () => {
    beforeEach(() => {
      (prisma.profile.findUnique as jest.Mock).mockResolvedValue(mockProfile);
      (prisma.school.findMany as jest.Mock).mockResolvedValue([mockSchool]);
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
      (redis.getJSON as jest.Mock).mockResolvedValue(cachedResult);

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results).toHaveLength(1);
      expect(output.results[0].fromCache).toBe(true);
      // AI should NOT have been called since we got a cache hit
      expect(aiService.chat).not.toHaveBeenCalled();
    });

    it('should bypass prediction cache when forceRefresh is true', async () => {
      const output = await service.predict('profile-1', ['school-1'], true);

      // forceRefresh skips the prediction cache lookup, so predict should run engines
      expect(output.results).toHaveLength(1);
      // AI should have been called (not short-circuited by cache)
      expect(aiService.chat).toHaveBeenCalled();
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

    it('should include factor analysis', async () => {
      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results[0].factors).toBeDefined();
      expect(Array.isArray(output.results[0].factors)).toBe(true);
    });

    it('should cache prediction result in Redis', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(redis.setJSON).toHaveBeenCalledWith(
        expect.stringContaining('prediction:'),
        expect.any(Object),
        expect.any(Number),
      );
    });

    it('should persist prediction to database', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(prisma.predictionResult.upsert).toHaveBeenCalled();
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
      (aiService.chat as jest.Mock).mockRejectedValue(
        new Error('AI service timeout'),
      );

      const output = await service.predict('profile-1', ['school-1']);

      // Should still return results from stats engine
      expect(output.results).toHaveLength(1);
      expect(output.results[0].probability).toBeDefined();
    });

    it('should record predictions to memory system', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(memoryManager.remember).toHaveBeenCalled();
    });
  });

  describe('invalidateUserCache', () => {
    it('should delete all cached predictions for a profile', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([
        { schoolId: 'school-1' },
        { schoolId: 'school-2' },
      ]);

      await service.invalidateUserCache('profile-1');

      expect(redis.del).toHaveBeenCalledTimes(2);
    });

    it('should handle empty prediction history', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.invalidateUserCache('profile-1'),
      ).resolves.not.toThrow();
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('should not throw if cache deletion fails', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([
        { schoolId: 'school-1' },
      ]);
      (redis.del as jest.Mock).mockRejectedValue(new Error('Redis error'));

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
      (aiService.chat as jest.Mock).mockRejectedValue(new Error('AI failed'));
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue(
        [], // Less than 10 cases → no historical
      );

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results).toHaveLength(1);
      expect(output.results[0].engineScores?.fusionMethod).toBe('stats_only');
    });

    it('should use 2-engine fusion when AI succeeds but no historical data', async () => {
      (prisma.admissionCase.findMany as jest.Mock).mockResolvedValue([]);

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results).toHaveLength(1);
      // AI succeeded, but historical returned null
      const method = output.results[0].engineScores?.fusionMethod;
      expect(['weighted_ensemble_2_ai', 'stats_only']).toContain(method);
    });

    it('should clamp probability between 0.05 and 0.95', async () => {
      const { calculateProbability } = require('./utils/score-calculator');
      (calculateProbability as jest.Mock).mockReturnValue(0.99);

      const output = await service.predict('profile-1', ['school-1']);

      expect(output.results[0].probability).toBeLessThanOrEqual(0.95);
    });
  });

  describe('reportActualResult', () => {
    it('should update prediction result with actual outcome', async () => {
      const mockUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      (prisma.predictionResult as any).updateMany = mockUpdateMany;

      await service.reportActualResult('profile-1', 'school-1', 'ADMITTED');

      expect(mockUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { profileId: 'profile-1', schoolId: 'school-1' },
          data: expect.objectContaining({
            actualResult: 'ADMITTED',
          }),
        }),
      );
    });
  });

  describe('getPredictionHistory', () => {
    it('should return prediction history for a profile', async () => {
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pred-1',
          schoolId: 'school-1',
          probability: 0.45,
          tier: 'match',
          createdAt: new Date(),
          school: mockSchool,
        },
      ]);

      const results = await service.getPredictionHistory('profile-1');
      expect(results).toHaveLength(1);
    });
  });

  describe('getCalibrationData', () => {
    it('should return calibration statistics', async () => {
      const mockCount = jest
        .fn()
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20); // withResults
      (prisma.predictionResult as any).count = mockCount;
      (prisma.predictionResult.findMany as jest.Mock).mockResolvedValue([
        { probability: 0.6, actualResult: 'ADMITTED' },
        { probability: 0.3, actualResult: 'REJECTED' },
        { probability: 0.1, actualResult: 'REJECTED' },
      ]);

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
    });

    it('should retrieve memory context before prediction', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(memoryManager.recall).toHaveBeenCalled();
    });

    it('should record school entities after prediction', async () => {
      await service.predict('profile-1', ['school-1']);

      expect(memoryManager.recordEntity).toHaveBeenCalled();
    });

    it('should proceed without memory when manager is unavailable', async () => {
      // Create service without memory manager
      const moduleWithoutMemory: TestingModule = await Test.createTestingModule(
        {
          providers: [
            PredictionService,
            {
              provide: PrismaService,
              useValue: {
                profile: {
                  findUnique: jest.fn().mockResolvedValue(mockProfile),
                },
                school: { findMany: jest.fn().mockResolvedValue([mockSchool]) },
                admissionCase: { findMany: jest.fn().mockResolvedValue([]) },
                predictionResult: {
                  findMany: jest.fn().mockResolvedValue([]),
                  upsert: jest.fn().mockResolvedValue({ id: 'pred-1' }),
                },
              },
            },
            {
              provide: AiService,
              useValue: { chat: jest.fn().mockResolvedValue(mockAIResponse) },
            },
            {
              provide: RedisService,
              useValue: {
                getJSON: jest.fn().mockResolvedValue(null),
                setJSON: jest.fn(),
                del: jest.fn(),
                setNX: jest.fn().mockResolvedValue(true),
              },
            },
          ],
        },
      ).compile();

      const svcNoMem =
        moduleWithoutMemory.get<PredictionService>(PredictionService);
      const output = await svcNoMem.predict('profile-1', ['school-1']);

      expect(output.results).toHaveLength(1);
    });
  });
});
