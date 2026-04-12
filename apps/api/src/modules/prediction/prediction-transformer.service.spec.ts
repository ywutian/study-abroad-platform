import { Test, TestingModule } from '@nestjs/testing';
import { PredictionTransformerService } from './prediction-transformer.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PredictionTransformerService', () => {
  let service: PredictionTransformerService;

  const mockPrisma = {
    essayAIResult: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionTransformerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PredictionTransformerService>(
      PredictionTransformerService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractProfileMetrics', () => {
    it('should extract SAT score from testScores', () => {
      const profile = {
        gpa: 3.9,
        gpaScale: 4.0,
        testScores: [
          { type: 'SAT', score: 1520 },
          { type: 'TOEFL', score: 110 },
        ],
        activities: [{ category: 'ACADEMIC', role: 'leader' }],
        awards: [{ level: 'NATIONAL', name: 'Math Olympiad' }],
      } as any;

      const result = service.extractProfileMetrics(profile);

      expect(result.satScore).toBe(1520);
      expect(result.toeflScore).toBe(110);
      expect(result.activityCount).toBe(1);
      expect(result.awardCount).toBe(1);
      expect(result.nationalAwardCount).toBe(1);
    });

    it('should handle empty profile data', () => {
      const profile = {
        testScores: [],
        activities: [],
        awards: [],
      } as any;

      const result = service.extractProfileMetrics(profile);

      expect(result.satScore).toBeUndefined();
      expect(result.activityCount).toBe(0);
      expect(result.awardCount).toBe(0);
    });
  });

  describe('extractSchoolMetrics', () => {
    it('should extract school metrics', () => {
      const school = {
        acceptanceRate: 5.5,
        satAvg: 1520,
        sat25: 1480,
        sat75: 1560,
        usNewsRank: 3,
        graduationRate: 98,
      } as any;

      const result = service.extractSchoolMetrics(school);

      expect(result.acceptanceRate).toBe(5.5);
      expect(result.satAvg).toBe(1520);
      expect(result.usNewsRank).toBe(3);
    });
  });

  describe('evaluateDataCompleteness', () => {
    it('should return low score for empty profile', () => {
      const profile = { testScores: [], activities: [], awards: [] } as any;
      const school = {} as any;

      const result = service.evaluateDataCompleteness(profile, school);

      expect(result).toBeLessThan(20);
    });

    it('should return higher score for complete profile', () => {
      const profile = {
        gpa: 3.9,
        gpaSystem: 'US_4_0',
        targetMajor: 'CS',
        highSchoolName: 'Top HS',
        testScores: [
          { type: 'SAT', score: 1520 },
          { type: 'TOEFL', score: 110 },
        ],
        activities: [{ name: 'Club' }],
        awards: [{ name: 'Award' }],
      } as any;
      const school = {
        acceptanceRate: 5,
        graduationRate: 98,
        satAvg: 1520,
        actAvg: 34,
      } as any;

      const result = service.evaluateDataCompleteness(profile, school);

      expect(result).toBeGreaterThan(70);
    });
  });

  describe('enrichWithEssayQuality', () => {
    it('should add essay quality score from AI result', async () => {
      mockPrisma.essayAIResult.findFirst.mockResolvedValue({
        output: JSON.stringify({ overallScore: 85 }),
      });

      const profile = { testScores: [], activities: [], awards: [] } as any;
      const result = await service.enrichWithEssayQuality(profile, 'prof-1');

      expect(result.essayQualityScore).toBe(85);
    });

    it('should not fail when no essay result exists', async () => {
      mockPrisma.essayAIResult.findFirst.mockResolvedValue(null);

      const profile = { testScores: [], activities: [], awards: [] } as any;
      const result = await service.enrichWithEssayQuality(profile, 'prof-1');

      expect(result.essayQualityScore).toBeUndefined();
    });
  });
});
