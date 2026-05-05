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

  describe('schoolToInput', () => {
    it('should include trust weights for prediction-eligible provenance fields', () => {
      const input = service.schoolToInput({
        id: 'school-1',
        name: 'MIT',
        acceptanceRate: 4,
        satAvg: 1540,
        metadata: {
          provenance: {
            acceptanceRate: {
              tier: 'OFFICIAL',
              source: 'COLLEGE_SCORECARD',
              fetchedAt: '2026-04-01T00:00:00.000Z',
            },
            satAvg: {
              tier: 'OFFICIAL',
              source: 'COLLEGE_SCORECARD',
              fetchedAt: '2026-04-01T00:00:00.000Z',
            },
          },
        },
      } as any);

      expect(input.fieldTrustWeights).toEqual(
        expect.objectContaining({
          acceptanceRate: expect.any(Number),
          satAvg: expect.any(Number),
        }),
      );
      expect(input.averagePredictionWeight).toBeCloseTo(
        (input.fieldTrustWeights!.acceptanceRate +
          input.fieldTrustWeights!.satAvg) /
          2,
      );
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
    it('should add essay quality score from AI result (normalize 0-100 to 0-10)', async () => {
      mockPrisma.essayAIResult.findFirst.mockResolvedValue({
        output: JSON.stringify({ overallScore: 85 }),
      });

      const profile = { testScores: [], activities: [], awards: [] } as any;
      const result = await service.enrichWithEssayQuality(profile, 'prof-1');

      // 85/100 normalized to 8.5/10 scale (transformer normalizes for downstream
      // ProfileMetrics/ProfileInput consumers which expect the 0-10 range)
      expect(result.essayQualityScore).toBe(8.5);
    });

    it('should accept already-normalized 0-10 scores unchanged', async () => {
      mockPrisma.essayAIResult.findFirst.mockResolvedValue({
        output: JSON.stringify({ overallScore: 7.5 }),
      });

      const profile = { testScores: [], activities: [], awards: [] } as any;
      const result = await service.enrichWithEssayQuality(profile, 'prof-1');

      expect(result.essayQualityScore).toBe(7.5);
    });

    it('should not fail when no essay result exists', async () => {
      mockPrisma.essayAIResult.findFirst.mockResolvedValue(null);

      const profile = { testScores: [], activities: [], awards: [] } as any;
      const result = await service.enrichWithEssayQuality(profile, 'prof-1');

      expect(result.essayQualityScore).toBeUndefined();
    });
  });

  describe('adjustConfidenceForSchoolTrust', () => {
    it('should downgrade to low when average prediction weight is below the low threshold', () => {
      const result = service.adjustConfidenceForSchoolTrust('high', {
        averagePredictionWeight: 0.5,
      } as any);

      expect(result).toBe('low');
    });

    it('should downgrade one level when average prediction weight is in the middle band', () => {
      const result = service.adjustConfidenceForSchoolTrust('high', {
        averagePredictionWeight: 0.7,
      } as any);

      expect(result).toBe('medium');
    });

    it('should keep confidence unchanged when trust is high', () => {
      const result = service.adjustConfidenceForSchoolTrust('medium', {
        averagePredictionWeight: 0.95,
      } as any);

      expect(result).toBe('medium');
    });
  });
});
