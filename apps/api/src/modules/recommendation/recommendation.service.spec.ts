import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { PointsService } from '../points/incentive.service';
import { MemoryManagerService } from '../ai-agent/memory';
import { BadRequestException } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: PrismaService;
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
      (pointsSvc as any).canPerformAction = jest
        .fn()
        .mockResolvedValue(true);

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
      (pointsSvc as any).canPerformAction = jest
        .fn()
        .mockResolvedValue(true);

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
      (pointsSvc as any).canPerformAction = jest
        .fn()
        .mockResolvedValue(true);

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
