import { Test, TestingModule } from '@nestjs/testing';
import { EssayAiService } from './essay-ai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { CaseIncentiveService } from '../case/case-incentive.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('EssayAiService', () => {
  let service: EssayAiService;
  let prisma: PrismaService;
  let aiService: AiService;
  let caseIncentive: CaseIncentiveService;

  const mockEssay = {
    id: 'essay-1',
    profileId: 'profile-1',
    content: 'This is my college essay about overcoming challenges.',
    prompt: 'Tell us about a challenge you overcame',
    profile: { userId: 'user-1' },
  };

  const mockProfile = {
    id: 'profile-1',
    userId: 'user-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayAiService,
        {
          provide: PrismaService,
          useValue: {
            essay: {
              findUnique: jest.fn(),
            },
            profile: {
              findFirst: jest.fn(),
            },
            school: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            essayAIResult: {
              create: jest.fn().mockResolvedValue({
                id: 'result-1',
                tokenUsed: 500,
              }),
            },
          },
        },
        {
          provide: AiService,
          useValue: {
            polishEssay: jest.fn().mockResolvedValue({
              polished: 'Polished essay content',
              changes: [{ original: 'old', revised: 'new' }],
            }),
            chat: jest.fn().mockResolvedValue(
              JSON.stringify({
                overallScore: 7.5,
                scores: {
                  clarity: 8,
                  uniqueness: 7,
                  storytelling: 8,
                  fit: 7,
                  language: 8,
                },
                strengths: ['Good structure'],
                weaknesses: ['Needs more detail'],
                suggestions: ['Add specific examples'],
                verdict: 'Solid essay with room for improvement',
              }),
            ),
            brainstorm: jest.fn().mockResolvedValue({
              ideas: [
                { title: 'Idea 1', content: 'desc 1' },
                { title: 'Idea 2', content: 'desc 2' },
              ],
              overallAdvice: 'Focus on personal growth',
            }),
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
          },
        },
      ],
    }).compile();

    service = module.get<EssayAiService>(EssayAiService);
    prisma = module.get<PrismaService>(PrismaService);
    aiService = module.get<AiService>(AiService);
    caseIncentive = module.get<CaseIncentiveService>(CaseIncentiveService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('polishEssay', () => {
    const dto = { essayId: 'essay-1', style: 'formal' as any };

    it('should polish an essay successfully', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(mockEssay);
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.polishEssay('user-1', dto);

      expect(result.polished).toBe('Polished essay content');
      expect(result.changes).toHaveLength(1);
      expect(caseIncentive.charge).toHaveBeenCalled();
      expect(aiService.polishEssay).toHaveBeenCalled();
    });

    it('should throw NotFoundException if essay does not exist', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.polishEssay('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user does not own the essay', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(mockEssay);
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.polishEssay('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should refund points if AI service fails', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(mockEssay);
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);
      (aiService.polishEssay as jest.Mock).mockRejectedValue(
        new Error('AI failure'),
      );

      await expect(service.polishEssay('user-1', dto)).rejects.toThrow();
      expect(caseIncentive.refund).toHaveBeenCalled();
    });

    it('should use provided content over essay content', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(mockEssay);
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      await service.polishEssay('user-1', {
        ...dto,
        content: 'Custom content to polish',
      } as any);

      expect(aiService.polishEssay).toHaveBeenCalledWith(
        'Custom content to polish',
        dto.style,
        'zh',
      );
    });

    it('should save AI result to database', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(mockEssay);
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      await service.polishEssay('user-1', dto);

      expect(prisma.essayAIResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            essayId: 'essay-1',
            type: 'polish',
          }),
        }),
      );
    });
  });

  describe('reviewEssay', () => {
    const dto = {
      essayId: 'essay-1',
      schoolName: 'MIT',
      major: 'Computer Science',
    };

    it('should review an essay successfully', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(mockEssay);
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);

      const result = await service.reviewEssay('user-1', dto);

      expect(result.overallScore).toBe(7.5);
      expect(result.scores).toBeDefined();
      expect(result.strengths).toHaveLength(1);
      expect(result.weaknesses).toHaveLength(1);
      expect(result.suggestions).toHaveLength(1);
      expect(caseIncentive.charge).toHaveBeenCalled();
    });

    it('should throw NotFoundException if essay does not exist', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.reviewEssay('user-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if user does not own the essay', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(mockEssay);
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.reviewEssay('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should refund points if review fails', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(mockEssay);
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);
      (aiService.chat as jest.Mock).mockRejectedValue(new Error('AI failure'));

      await expect(service.reviewEssay('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(caseIncentive.refund).toHaveBeenCalled();
    });

    it('should return fallback values if AI returns non-JSON response', async () => {
      (prisma.essay.findUnique as jest.Mock).mockResolvedValue(mockEssay);
      (prisma.profile.findFirst as jest.Mock).mockResolvedValue(mockProfile);
      (aiService.chat as jest.Mock).mockResolvedValue(
        'This is not valid JSON at all',
      );

      const result = await service.reviewEssay('user-1', dto);

      // extractJsonFromLlm returns a fallback object instead of throwing,
      // so the service returns default/undefined values for missing fields
      expect(result).toBeDefined();
      expect(result.overallScore).toBeUndefined();
      expect(result.strengths).toEqual([]);
      expect(result.weaknesses).toEqual([]);
      expect(result.suggestions).toEqual([]);
      expect(result.verdict).toBe('');
      expect(caseIncentive.refund).not.toHaveBeenCalled();
    });
  });
});
