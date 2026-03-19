import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { CaseIncentiveService } from '../points/incentive.service';
import { MemoryManagerService } from '../ai-agent/memory';
import { BadRequestException } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: PrismaService;
  let llmService: LLMService;
  let caseIncentive: CaseIncentiveService;

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
          },
        },
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue(mockAIResponse),
          },
        },
        {
          provide: CaseIncentiveService,
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
    caseIncentive = module.get<CaseIncentiveService>(CaseIncentiveService);
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

      await service.generateRecommendation('user-1', dto as any);

      expect(caseIncentive.charge).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
    });

    it('should generate AI recommendation with profile data', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.generateRecommendation('user-1', dto as any);

      expect(result).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(llmService.chatSimple).toHaveBeenCalled();
    });

    it('should throw NotFoundException and refund if profile not found', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.generateRecommendation('user-1', dto as any),
      ).rejects.toThrow();
      expect(caseIncentive.refund).toHaveBeenCalled();
    });

    it('should refund points if AI service fails', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);
      (llmService.chatSimple as jest.Mock).mockRejectedValue(
        new Error('AI service timeout'),
      );

      await expect(
        service.generateRecommendation('user-1', dto as any),
      ).rejects.toThrow(BadRequestException);
      expect(caseIncentive.refund).toHaveBeenCalled();
    });

    it('should return structured recommendation with analysis', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.generateRecommendation('user-1', dto as any);

      expect(result.analysis).toBeDefined();
      expect(result.analysis.strengths).toBeDefined();
      expect(result.analysis.weaknesses).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    it('should save recommendation to database', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      await service.generateRecommendation('user-1', dto as any);

      expect(prisma.schoolRecommendation.create).toHaveBeenCalled();
    });

    it('should match school IDs from database', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      await service.generateRecommendation('user-1', dto as any);

      // matchSchoolIds calls prisma.school.findMany
      expect(prisma.school.findMany).toHaveBeenCalled();
    });

    it('should refund and throw on non-JSON AI response', async () => {
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);
      (llmService.chatSimple as jest.Mock).mockResolvedValue(
        'This is not valid JSON',
      );

      await expect(
        service.generateRecommendation('user-1', dto as any),
      ).rejects.toThrow(BadRequestException);
      expect(caseIncentive.refund).toHaveBeenCalled();
    });
  });

  describe('getRecommendationHistory', () => {
    it('should return user recommendation history', async () => {
      (prisma.schoolRecommendation.findMany as jest.Mock).mockResolvedValue([
        { id: 'rec-1', createdAt: new Date() },
      ]);

      const result = await service.getRecommendationHistory('user-1');
      expect(result).toHaveLength(1);
    });
  });
});
