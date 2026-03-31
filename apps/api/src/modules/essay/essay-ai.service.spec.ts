import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EssayAiService } from './essay-ai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { CaseIncentiveService } from '../points/incentive.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

jest.mock('../../common/utils/llm-json.util', () => ({
  extractJsonFromLlm: jest.fn(),
}));

jest.mock('../points/refund.helper', () => ({
  safeRefund: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../common/utils/async.util', () => ({
  fireAndForget: jest.fn(),
}));

import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import { safeRefund } from '../points/refund.helper';

describe('EssayAiService', () => {
  let service: EssayAiService;

  const mockPrisma = {
    essay: {
      findUnique: jest.fn(),
    },
    profile: {
      findFirst: jest.fn(),
    },
    essayAIResult: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    school: {
      findFirst: jest.fn(),
    },
  };

  const mockLLMService = {
    chatSimple: jest.fn(),
    chatSimpleGuarded: jest.fn(),
  };

  const mockIncentiveService = {
    charge: jest.fn().mockResolvedValue({ newBalance: 100 }),
  };

  const mockMemoryManager = {
    remember: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayAiService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: LLMService, useValue: mockLLMService },
        { provide: CaseIncentiveService, useValue: mockIncentiveService },
        { provide: MemoryManagerService, useValue: mockMemoryManager },
      ],
    }).compile();

    service = module.get<EssayAiService>(EssayAiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reviewEssay', () => {
    const userId = 'user-1';
    const dto = { essayId: 'essay-1', schoolName: 'MIT', major: 'CS' };

    it('should return review result on success', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue({
        id: 'essay-1',
        profileId: 'profile-1',
        content: 'My essay content',
        prompt: 'Why this school?',
      });
      mockPrisma.profile.findFirst.mockResolvedValue({ id: 'profile-1' });
      mockPrisma.school.findFirst.mockResolvedValue({
        name: 'MIT',
        usNewsRank: 1,
        acceptanceRate: 3.5,
        testOptional: false,
      });

      const parsedResult = {
        overallScore: 8,
        scores: { content: 8, structure: 7, voice: 9 },
        strengths: ['Clear voice'],
        weaknesses: ['Could add more detail'],
        suggestions: ['Expand on research experience'],
        verdict: 'Strong essay',
      };

      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);
      mockPrisma.essayAIResult.create.mockResolvedValue({
        id: 'result-1',
        tokenUsed: 100,
      });

      const result = await service.reviewEssay(userId, dto, 'en');

      expect(mockIncentiveService.charge).toHaveBeenCalledWith(
        userId,
        'AI_ESSAY_REVIEW',
      );
      expect(result.overallScore).toBe(8);
      expect(result.strengths).toEqual(['Clear voice']);
      expect(result.id).toBe('result-1');
    });

    it('should throw NotFoundException when essay not found', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue(null);

      await expect(service.reviewEssay(userId, dto, 'en')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when user does not own essay', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue({
        id: 'essay-1',
        profileId: 'profile-1',
        content: 'content',
      });
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      await expect(service.reviewEssay(userId, dto, 'en')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should refund points and throw when LLM fails', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue({
        id: 'essay-1',
        profileId: 'profile-1',
        content: 'content',
        prompt: 'prompt',
      });
      mockPrisma.profile.findFirst.mockResolvedValue({ id: 'profile-1' });
      mockPrisma.school.findFirst.mockResolvedValue(null);
      mockLLMService.chatSimpleGuarded.mockRejectedValue(
        new Error('LLM error'),
      );

      await expect(service.reviewEssay(userId, dto, 'en')).rejects.toThrow(
        BadRequestException,
      );
      expect(safeRefund).toHaveBeenCalled();
    });
  });

  describe('brainstormIdeas', () => {
    const userId = 'user-1';
    const dto = {
      prompt: 'Describe a challenge you overcame',
      school: 'Stanford',
      major: 'CS',
      background: 'I love coding',
    };

    it('should return brainstorm ideas on success', async () => {
      mockPrisma.school.findFirst.mockResolvedValue({
        usNewsRank: 3,
        acceptanceRate: 3.7,
        testOptional: true,
      });

      const parsedResult = {
        ideas: [
          { title: 'Coding Journey', description: 'Your path to CS' },
          { title: 'Overcoming Bugs', description: 'Debugging as metaphor' },
        ],
        overallAdvice: 'Focus on personal growth.',
      };

      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);

      const result = await service.brainstormIdeas(userId, dto, 'en');

      expect(result.ideas).toHaveLength(2);
      expect(result.overallAdvice).toBe('Focus on personal growth.');
      expect(mockIncentiveService.charge).toHaveBeenCalledWith(
        userId,
        'AI_ESSAY_BRAINSTORM',
      );
    });

    it('should refund points and throw when LLM fails', async () => {
      mockPrisma.school.findFirst.mockResolvedValue(null);
      mockLLMService.chatSimpleGuarded.mockRejectedValue(new Error('timeout'));

      await expect(service.brainstormIdeas(userId, dto, 'en')).rejects.toThrow(
        BadRequestException,
      );
      expect(safeRefund).toHaveBeenCalled();
    });
  });

  describe('getEssayAIHistory', () => {
    const userId = 'user-1';

    it('should return AI history for owned essay', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue({
        id: 'essay-1',
        profileId: 'profile-1',
        profile: {},
      });
      mockPrisma.profile.findFirst.mockResolvedValue({ id: 'profile-1' });
      mockPrisma.essayAIResult.findMany.mockResolvedValue([
        { id: 'r1', type: 'review' },
        { id: 'r2', type: 'polish' },
      ]);

      const result = await service.getEssayAIHistory(userId, 'essay-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.essayAIResult.findMany).toHaveBeenCalledWith({
        where: { essayId: 'essay-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    });

    it('should throw NotFoundException when essay not found', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue(null);

      await expect(
        service.getEssayAIHistory(userId, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user does not own essay', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue({
        id: 'essay-1',
        profileId: 'profile-1',
      });
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      await expect(
        service.getEssayAIHistory(userId, 'essay-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rewriteParagraph', () => {
    it('should return rewritten versions on success', async () => {
      const parsedResult = {
        versions: [
          { text: 'Version 1', style: 'Formal' },
          { text: 'Version 2', style: 'Vivid' },
        ],
      };
      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);

      const result = await service.rewriteParagraph(
        'Some text',
        undefined,
        'en',
      );

      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].style).toBe('Formal');
    });

    it('should throw BadRequestException when LLM fails', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(new Error('fail'));

      await expect(
        service.rewriteParagraph('text', undefined, 'en'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('analyzeEssayParagraphs', () => {
    it('should return default analysis for empty content', async () => {
      const result = await service.analyzeEssayParagraphs(
        'short',
        undefined,
        undefined,
        'en',
      );

      expect(result.paragraphs).toEqual([]);
      expect(result.overallScore).toBe(0);
      expect(result.summary).toContain('too short');
    });

    it('should return paragraph analysis on success', async () => {
      const content =
        'This is a long enough paragraph to pass the filter and be analyzed by the LLM.';
      const parsedResult = {
        paragraphs: [
          {
            paragraphIndex: 0,
            score: 7,
            status: 'good',
            comment: 'Decent paragraph',
            highlights: ['Good flow'],
            suggestions: ['Add specifics'],
          },
        ],
        overallScore: 70,
        structure: {
          hasStrongOpening: true,
          hasClarity: true,
          hasGoodConclusion: false,
          feedback: 'Needs better conclusion',
        },
        summary: 'Overall decent essay.',
      };

      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);

      const result = await service.analyzeEssayParagraphs(
        content,
        'Test prompt',
        'MIT',
        'en',
      );

      expect(result.paragraphs).toHaveLength(1);
      expect(result.overallScore).toBe(70);
      expect(result.structure.hasStrongOpening).toBe(true);
    });
  });

  describe('polishEssay', () => {
    const userId = 'user-1';
    const dto = { essayId: 'essay-1', style: 'formal' as any };

    it('should polish essay and save result', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue({
        id: 'essay-1',
        profileId: 'profile-1',
        content: 'Original essay text',
      });
      mockPrisma.profile.findFirst.mockResolvedValue({ id: 'profile-1' });

      const polishResult = {
        polished: 'Polished essay text',
        changes: [
          {
            original: 'Original',
            revised: 'Polished',
            reason: 'Better word choice',
          },
        ],
      };

      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(polishResult);
      mockPrisma.essayAIResult.create.mockResolvedValue({
        id: 'result-1',
        tokenUsed: 50,
      });

      const result = await service.polishEssay(userId, dto, 'en');

      expect(result.polished).toBe('Polished essay text');
      expect(result.changes).toHaveLength(1);
      expect(mockIncentiveService.charge).toHaveBeenCalledWith(
        userId,
        'AI_ESSAY_POLISH',
      );
    });

    it('should throw NotFoundException when essay not found', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue(null);

      await expect(service.polishEssay(userId, dto, 'en')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when user does not own essay', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue({
        id: 'essay-1',
        profileId: 'profile-1',
        content: 'text',
      });
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      await expect(service.polishEssay(userId, dto, 'en')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should refund points when LLM call fails', async () => {
      mockPrisma.essay.findUnique.mockResolvedValue({
        id: 'essay-1',
        profileId: 'profile-1',
        content: 'text',
      });
      mockPrisma.profile.findFirst.mockResolvedValue({ id: 'profile-1' });
      mockLLMService.chatSimpleGuarded.mockRejectedValue(
        new Error('LLM timeout'),
      );

      await expect(service.polishEssay(userId, dto, 'en')).rejects.toThrow();
      expect(safeRefund).toHaveBeenCalled();
    });
  });

  describe('continueWriting', () => {
    it('should return continuation and suggestions on success', async () => {
      const parsedResult = {
        continuation: 'The next paragraph continues...',
        suggestions: ['Expand on theme', 'Add a conclusion'],
      };
      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);

      const result = await service.continueWriting(
        'My essay so far...',
        'Why this school?',
        undefined,
        'en',
      );

      expect(result.continuation).toBe('The next paragraph continues...');
      expect(result.suggestions).toHaveLength(2);
    });

    it('should throw BadRequestException when LLM fails', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(new Error('fail'));

      await expect(
        service.continueWriting('text', undefined, undefined, 'en'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateOpening', () => {
    it('should return opening suggestions on success', async () => {
      const parsedResult = {
        openings: [
          { text: 'It was a cold morning...', style: 'Scene setting' },
          { text: '"Why not?" she asked.', style: 'Dialogue' },
        ],
      };
      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);

      const result = await service.generateOpening(
        'Describe a challenge',
        'I play piano',
        'en',
      );

      expect(result.openings).toHaveLength(2);
      expect(result.openings[0].style).toBe('Scene setting');
    });

    it('should throw BadRequestException when LLM fails', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(new Error('fail'));

      await expect(
        service.generateOpening('prompt', undefined, 'en'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
