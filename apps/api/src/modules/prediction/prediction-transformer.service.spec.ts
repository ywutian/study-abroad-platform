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
    const schoolWithAcceptanceRate = (
      provenance?: Record<string, unknown>,
    ): any => ({
      id: 'school-1',
      name: 'MIT',
      acceptanceRate: 4,
      metadata:
        provenance === undefined
          ? {}
          : {
              provenance: {
                acceptanceRate: provenance,
              },
            },
    });

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

    it('should pass official school anchor values with prediction weights', () => {
      const input = service.schoolToInput(
        schoolWithAcceptanceRate({
          tier: 'OFFICIAL',
          source: 'COLLEGE_SCORECARD',
          fetchedAt: '2026-04-01T00:00:00.000Z',
        }),
      );

      expect(input.acceptanceRate).toBe(4);
      expect(input.fieldTrustWeights?.acceptanceRate).toBe(1);
      expect(input.averagePredictionWeight).toBe(1);
    });

    it('should exclude school anchor values when provenance is missing', () => {
      const input = service.schoolToInput(schoolWithAcceptanceRate());

      expect(input.acceptanceRate).toBeUndefined();
      expect(input.fieldTrustWeights?.acceptanceRate).toBeUndefined();
    });

    it('should exclude inferred heuristic school anchor values', () => {
      const input = service.schoolToInput(
        schoolWithAcceptanceRate({
          tier: 'INFERRED',
          source: 'HEURISTIC:PR-15',
          fetchedAt: '2026-04-01T00:00:00.000Z',
          confidence: 0.55,
        }),
      );

      expect(input.acceptanceRate).toBeUndefined();
      expect(input.fieldTrustWeights?.acceptanceRate).toBeUndefined();
    });

    it('should exclude stale school anchor values', () => {
      const input = service.schoolToInput(
        schoolWithAcceptanceRate({
          tier: 'OFFICIAL',
          source: 'COLLEGE_SCORECARD',
          fetchedAt: '2024-01-01T00:00:00.000Z',
        }),
      );

      expect(input.acceptanceRate).toBeUndefined();
      expect(input.fieldTrustWeights?.acceptanceRate).toBeUndefined();
    });

    it('should exclude manual-review school anchor values', () => {
      const input = service.schoolToInput(
        schoolWithAcceptanceRate({
          tier: 'UNAVAILABLE',
          source: 'MANUAL_REVIEW:needs-source-check',
          fetchedAt: '2026-04-01T00:00:00.000Z',
          realDataStatus: 'MANUAL_REVIEW',
        }),
      );

      expect(input.acceptanceRate).toBeUndefined();
      expect(input.fieldTrustWeights?.acceptanceRate).toBeUndefined();
    });
  });

  describe('profileToInput profile signal hydration', () => {
    it('uses semester GPAs for runtime GPA and GPA trend when present', () => {
      const result = service.profileToInput({
        gpa: null,
        gpaScale: 4,
        gpa9: null,
        gpa10: null,
        gpa11: null,
        gpa12: null,
        currentSchoolType: 'PRIVATE_US',
        targetMajor: 'Computer Science',
        intendedMajor: null,
        nationality: 'US',
        countryOfResidence: 'US',
        citizenship: 'US',
        educationSystem: null,
        testScores: [],
        activities: [],
        awards: [],
        education: [],
        semesterGpas: [
          {
            semester: 'Fall 2024',
            year: 2024,
            gpa: 3.4,
            gpaScale: 4,
            credits: 4,
            order: 1,
          },
          {
            semester: 'Spring 2025',
            year: 2025,
            gpa: 3.8,
            gpaScale: 4,
            credits: 4,
            order: 2,
          },
        ],
      } as any);

      expect(result.gpa).toBe(3.6);
      expect(result.gpaTrend?.direction).toBe('rising');
      expect(result.gpaTrend?.delta).toBeCloseTo(0.4, 2);
      expect(result.gpaTrend?.evidence).toContain('Fall 2024');
    });

    it('falls back to currentSchool as highSchoolName when no linked education exists', () => {
      const result = service.profileToInput({
        gpa: 3.8,
        gpaScale: 4,
        currentSchool: 'Phillips Academy Andover',
        currentSchoolType: 'BOARDING_US',
        nationality: 'US',
        countryOfResidence: 'US',
        citizenship: 'US',
        educationSystem: null,
        testScores: [],
        activities: [],
        awards: [],
        education: [],
        semesterGpas: [],
      } as any);

      expect(result.highSchoolName).toBe('Phillips Academy Andover');
      expect(result.highSchoolType).toBe('BOARDING_US');
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
