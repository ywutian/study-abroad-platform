import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { PointsService } from '../points/incentive.service';
import { MemoryManagerService } from '../ai-agent/memory';
import { BadRequestException } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { PredictionHistoricalService } from '../prediction/prediction-historical.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: PrismaService;
  let historical: PredictionHistoricalService;
  let llmService: LLMService;
  let pointsSvc: PointsService;

  const mockProfile = {
    id: 'profile-1',
    userId: 'user-1',
    gpa: '3.8',
    gpaScale: 4,
    targetDegree: 'MASTER',
    targetMajor: 'Computer Science',
    testScores: [
      { type: 'GRE', total: 330, score: 330 },
      { type: 'TOEFL', total: 110, score: 110 },
    ],
    activities: [{ name: 'Research Lab', type: 'RESEARCH' }],
    awards: [{ name: 'Dean List', competition: { level: 'SCHOOL' } }],
    education: [{ school: 'Top University', degree: 'BACHELOR' }],
  };

  const mockSchool = {
    id: 'school-1',
    name: 'MIT',
    nameZh: '麻省理工',
    aliases: ['Massachusetts Institute of Technology'],
    usNewsRank: 1,
    acceptanceRate: 4,
    city: 'Cambridge',
    state: 'MA',
    tuition: 55000,
    isPrivate: true,
    testOptional: true,
    hasEarlyDecision: true,
    retentionRate: 98.5,
    logoUrl: 'https://img.logo.dev/mit.edu',
    website: 'https://mit.edu',
    scorecardId: null,
    ipedsId: null,
    transferAcceptanceRate: null,
    rankings: [],
  };

  const mockAIResponseJson = {
    recommendations: [
      {
        schoolName: 'MIT',
        tier: 'reach',
        estimatedProbability: 20,
        fitScore: 90,
        reasons: ['Strong CS program'],
        concerns: ['Very competitive'],
      },
      {
        schoolName: 'Georgia Tech',
        tier: 'match',
        estimatedProbability: 55,
        fitScore: 82,
        reasons: ['Good match'],
        concerns: [],
      },
    ],
    analysis: {
      strengths: ['Strong GPA', 'Good test scores'],
      weaknesses: ['Limited research experience'],
      improvementTips: ['Publish a paper'],
    },
    summary: 'Overall good profile with competitive chances.',
  };

  const mockAIResponse = JSON.stringify(mockAIResponseJson);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationService,
        {
          provide: PrismaService,
          useValue: {
            profile: {
              findFirst: jest.fn(),
            },
            school: {
              findFirst: jest.fn(),
              findMany: jest.fn().mockResolvedValue([mockSchool]),
            },
            schoolRecommendation: {
              create: jest.fn().mockResolvedValue({
                id: 'rec-1',
                userId: 'user-1',
                createdAt: new Date(),
              }),
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn(),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ points: 100 }),
            },
            essayPrompt: {
              groupBy: jest.fn().mockResolvedValue([]),
              findMany: jest.fn().mockResolvedValue([]),
            },
            assessmentResult: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            // The user's target schools, which drive the historical
            // case-comparison context. Empty by default so the existing tests
            // exercise the path without asserting on it.
            schoolListItem: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        // Previously absent, which is why nothing noticed that this whole
        // branch was unreachable: `historicalService` is @Optional(), so with
        // no provider the block never ran and no test could reach the bug
        // inside it.
        {
          provide: PredictionHistoricalService,
          useValue: {
            getCaseComparison: jest.fn().mockResolvedValue(null),
            getNationalityStats: jest.fn().mockResolvedValue(null),
            getSchoolDistribution: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue(mockAIResponse),
            chatSimpleGuarded: jest.fn().mockResolvedValue(mockAIResponse),
          },
        },
        {
          provide: PointsService,
          useValue: {
            charge: jest.fn().mockResolvedValue(undefined),
            refund: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MemoryManagerService,
          useValue: {
            remember: jest.fn().mockResolvedValue(undefined),
            recall: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: RedisService,
          useValue: {
            setNX: jest.fn().mockResolvedValue(true),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<RecommendationService>(RecommendationService);
    prisma = module.get<PrismaService>(PrismaService);
    llmService = module.get<LLMService>(LLMService);
    pointsSvc = module.get<PointsService>(PointsService);
    historical = module.get<PredictionHistoricalService>(
      PredictionHistoricalService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateRecommendation', () => {
    const dto = {
      schoolCount: 15,
      preferredRegions: ['Northeast'],
      preferredMajors: ['CS'],
    };

    it('should charge points before generating recommendation', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      await service.generateRecommendation('user-1', dto);

      expect(pointsSvc.charge).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
    });

    it('should generate AI recommendation with profile data', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.generateRecommendation('user-1', dto);

      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(llmService.chatSimpleGuarded).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          maxTokens: 3000,
          timeoutMs: 90000,
        }),
      );
    });

    it('should throw NotFoundException and refund if profile not found', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.generateRecommendation('user-1', dto as any),
      ).rejects.toThrow();
      expect(pointsSvc.refund).toHaveBeenCalled();
    });

    it('should refund points if AI service fails', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);
      (llmService.chatSimpleGuarded as jest.Mock).mockRejectedValue(
        new Error('AI service timeout'),
      );

      await expect(
        service.generateRecommendation('user-1', dto as any),
      ).rejects.toThrow(BadRequestException);
      expect(pointsSvc.refund).toHaveBeenCalled();
    });

    it('should return structured recommendation with analysis', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.generateRecommendation('user-1', dto);

      expect(result.analysis).toBeDefined();
      expect(result.analysis.strengths).toBeDefined();
      expect(result.analysis.weaknesses).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should save recommendation to database', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      await service.generateRecommendation('user-1', dto);

      expect(prisma.schoolRecommendation.create).toHaveBeenCalled();
    });

    it('should match school IDs from database', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      await service.generateRecommendation('user-1', dto);

      // matchSchoolIds calls prisma.school.findMany
      expect(prisma.school.findMany).toHaveBeenCalled();
    });

    it('should hide recommendation schoolMeta anchor fields without provenance', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.generateRecommendation('user-1', dto);

      expect(result.recommendations[0].schoolMeta).toEqual(
        expect.objectContaining({
          acceptanceRate: undefined,
          retentionRate: undefined,
          weakFields: expect.objectContaining({
            acceptanceRate: 'hidden_until_field_provenance_exists',
            retentionRate: 'hidden_until_field_provenance_exists',
          }),
        }),
      );
      expect(prisma.school.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            acceptanceRate: true,
            metadata: true,
            updatedAt: true,
          }),
        }),
      );
    });

    it('should enrich recommendation essay counts from source-backed verified prompts only', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      await service.generateRecommendation('user-1', dto);

      expect(prisma.essayPrompt.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: { in: ['school-1'] },
            isActive: true,
            status: 'VERIFIED',
            sources: { some: { sourceUrl: { not: null } } },
          }),
        }),
      );
      expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: { in: ['school-1'] },
            isActive: true,
            status: 'VERIFIED',
            sources: { some: { sourceUrl: { not: null } } },
            type: 'WHY_SCHOOL',
          }),
          distinct: ['schoolId'],
        }),
      );
    });

    /**
     * The evidence-based recommendation path.
     *
     * This block was written against `profile.targetSchools`, which `Profile`
     * has never had, so it read `undefined` and never ran — while
     * CaseComparisonSummary.tsx, the i18n strings, the shared type and the DTO
     * field all sat waiting for data that could not arrive. Target schools come
     * from SchoolListItem. These two tests are what stops it going quiet again:
     * the first proves the context reaches the prompt, the second proves the
     * structured data reaches the response the frontend renders.
     */
    describe('historical case comparison', () => {
      const comparison = {
        schoolId: 'school-1',
        totalCases: 12,
        admitted: { count: 7, gpaMedian: 3.9, satMedian: 1540 },
        rejected: { count: 5, gpaMedian: 3.6, satMedian: 1450 },
      };

      const withTargetSchool = () => {
        (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);
        (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([
          { school: { id: 'school-1', name: 'MIT' } },
        ]);
        (historical.getCaseComparison as jest.Mock).mockResolvedValue(
          comparison,
        );
      };

      it("reads target schools from the user's school list", async () => {
        withTargetSchool();
        await service.generateRecommendation('user-1', {} as never);

        expect(prisma.schoolListItem.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ where: { userId: 'user-1' } }),
        );
        expect(historical.getCaseComparison).toHaveBeenCalledWith(
          'school-1',
          undefined,
        );
      });

      it('attaches the comparison to the matching recommendation', async () => {
        withTargetSchool();
        const result = await service.generateRecommendation(
          'user-1',
          {} as never,
        );

        const mit = result.recommendations.find(
          (r) => r.schoolId === 'school-1',
        );
        expect(mit?.caseComparison).toEqual(comparison);

        // The other recommendation has no target-list entry, so no comparison —
        // asserted so a change that attaches the same object to everything
        // cannot pass.
        const other = result.recommendations.find(
          (r) => r.schoolId !== 'school-1',
        );
        expect(other?.caseComparison).toBeUndefined();
      });

      it('stays quiet when the user has no target schools', async () => {
        (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);
        (prisma.schoolListItem.findMany as jest.Mock).mockResolvedValue([]);

        await service.generateRecommendation('user-1', {} as never);

        expect(historical.getCaseComparison).not.toHaveBeenCalled();
      });
    });

    /**
     * `isInternational` reached the prompt builder as `undefined` on every call
     * — it was read off `Profile`, which has no such column, through a cast.
     * The branch it gates is the instruction to weigh a school's friendliness
     * toward this nationality, its international-student share and its history
     * with that nationality, so that instruction had never been sent on a
     * platform whose applicants are overwhelmingly international.
     */
    describe('international applicant context', () => {
      const promptText = () =>
        JSON.stringify(
          (llmService.chatSimpleGuarded as jest.Mock).mock.calls[0][0],
        );

      it('asks the model to weigh nationality fit for an international applicant', async () => {
        (prisma.profile.findFirst as jest.Mock).mockResolvedValue({
          ...mockProfile,
          nationality: 'CN',
        });

        await service.generateRecommendation('user-1', dto);

        expect(promptText()).toContain('CN');
        expect(promptText()).toMatch(/友好度|friendliness/);
      });

      it('sends neither for a domestic applicant', async () => {
        (prisma.profile.findFirst as jest.Mock).mockResolvedValue({
          ...mockProfile,
          nationality: 'US',
          countryOfResidence: 'US',
          citizenship: 'US',
        });

        await service.generateRecommendation('user-1', dto);

        // Nationality still goes out; the international-fit instruction does
        // not. Asserted so "always international" cannot pass either.
        expect(promptText()).not.toMatch(/友好度|friendliness/);
      });

      it('omits the whole block when nationality is unknown', async () => {
        (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

        await service.generateRecommendation('user-1', dto);

        expect(promptText()).not.toMatch(/友好度|friendliness/);
      });
    });

    it('should refund and throw on non-JSON AI response', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);
      (llmService.chatSimpleGuarded as jest.Mock).mockResolvedValue(
        'This is not valid JSON',
      );

      await expect(
        service.generateRecommendation('user-1', dto as any),
      ).rejects.toThrow(BadRequestException);
      expect(pointsSvc.refund).toHaveBeenCalled();
    });
  });

  describe('getRecommendationHistory', () => {
    it('should return user recommendation history', async () => {
      (prisma.schoolRecommendation.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rec-1',
          recommendations: [],
          analysis: { strengths: [], weaknesses: [], improvementTips: [] },
          summary: 'test',
          tokenUsed: 100,
          createdAt: new Date(),
        },
      ]);

      const result = await service.getRecommendationHistory('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rec-1');
    });

    it('should return empty array when user has no history', async () => {
      (prisma.schoolRecommendation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getRecommendationHistory('user-no-recs');
      expect(result).toEqual([]);
    });
  });

  describe('getRecommendationById', () => {
    it('should return a specific recommendation by id', async () => {
      (prisma.schoolRecommendation.findFirst as jest.Mock).mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
        recommendations: [{ schoolName: 'MIT', tier: 'reach' }],
        analysis: {
          strengths: ['Strong GPA'],
          weaknesses: [],
          improvementTips: [],
        },
        summary: 'Good profile',
        tokenUsed: 200,
        createdAt: new Date(),
      });

      const result = await service.getRecommendationById('user-1', 'rec-1');

      expect(result.id).toBe('rec-1');
      expect(result.recommendations).toHaveLength(1);
    });

    it('should throw NotFoundException when recommendation not found', async () => {
      (prisma.schoolRecommendation.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.getRecommendationById('user-1', 'nonexistent'),
      ).rejects.toThrow();
    });
  });

  describe('checkPreflight', () => {
    it('should return canGenerate=true when profile is complete and has points', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ points: 100 });
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue({
        gpa: 3.8,
        targetMajor: 'CS',
        testScores: [{ id: 'ts-1' }],
        activities: [{ id: 'act-1' }],
      });
      (pointsSvc as any).canPerformAction = jest.fn().mockResolvedValue(true);

      const result = await service.checkPreflight('user-1');

      expect(result.canGenerate).toBe(true);
      expect(result.profileComplete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('should return missing fields when profile is incomplete', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ points: 100 });
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue({
        gpa: null,
        targetMajor: null,
        testScores: [],
        activities: [],
      });
      (pointsSvc as any).canPerformAction = jest.fn().mockResolvedValue(true);

      const result = await service.checkPreflight('user-1');

      expect(result.canGenerate).toBe(false);
      expect(result.missingFields).toContain('gpa');
      expect(result.missingFields).toContain('testScores');
      expect(result.missingFields).toContain('activities');
      expect(result.missingFields).toContain('targetMajor');
    });

    it('should return canGenerate=false when no profile exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ points: 100 });
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(null);
      (pointsSvc as any).canPerformAction = jest.fn().mockResolvedValue(true);

      const result = await service.checkPreflight('user-1');

      expect(result.canGenerate).toBe(false);
      expect(result.missingFields).toContain('profile');
    });
  });

  describe('deleteRecommendation', () => {
    it('should delete recommendation owned by user', async () => {
      (prisma.schoolRecommendation.findFirst as jest.Mock).mockResolvedValue({
        id: 'rec-1',
        userId: 'user-1',
      });
      (prisma.schoolRecommendation as any).delete = jest
        .fn()
        .mockResolvedValue({});

      await service.deleteRecommendation('user-1', 'rec-1');

      expect((prisma.schoolRecommendation as any).delete).toHaveBeenCalledWith({
        where: { id: 'rec-1' },
      });
    });

    it('should throw NotFoundException when recommendation not found', async () => {
      (prisma.schoolRecommendation.findFirst as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.deleteRecommendation('user-1', 'nonexistent'),
      ).rejects.toThrow();
    });
  });

  describe('idempotency lock', () => {
    it('should reject concurrent duplicate requests', async () => {
      const redis = {
        setNX: jest.fn().mockResolvedValue(false),
        del: jest.fn(),
      };
      // Access the redis mock from the module
      const module = await Test.createTestingModule({
        providers: [
          RecommendationService,
          {
            provide: PrismaService,
            useValue: prisma,
          },
          { provide: LLMService, useValue: llmService },
          { provide: PointsService, useValue: pointsSvc },
          {
            provide: MemoryManagerService,
            useValue: { remember: jest.fn(), recall: jest.fn() },
          },
          { provide: RedisService, useValue: redis },
        ],
      }).compile();

      const svc = module.get<RecommendationService>(RecommendationService);

      await expect(
        svc.generateRecommendation('user-1', { schoolCount: 10 } as any),
      ).rejects.toThrow();
    });
  });
});
