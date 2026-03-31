import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ResumeAiService } from './resume-ai.service';
import { LLMService } from '../ai-agent/core/llm.service';

jest.mock('../../common/utils/llm-json.util', () => ({
  extractJsonFromLlm: jest.fn(),
}));

import { extractJsonFromLlm } from '../../common/utils/llm-json.util';

describe('ResumeAiService', () => {
  let service: ResumeAiService;

  const mockLLMService = {
    chatSimple: jest.fn(),
    chatSimpleGuarded: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeAiService,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
      ],
    }).compile();

    service = module.get<ResumeAiService>(ResumeAiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reviewResume', () => {
    const mockResumeData = {
      sections: [
        {
          id: 's1',
          type: 'EDUCATION',
          title: 'Education',
          content: { items: [{ degree: 'BS', school: 'MIT' }] },
        },
        {
          id: 's2',
          type: 'ACTIVITIES',
          title: 'Activities',
          content: {
            items: [
              {
                name: 'Debate',
                role: 'Captain',
                bullets: ['Led team to nationals'],
              },
            ],
          },
        },
      ],
      templateId: 'jake-classic',
      resumeType: 'COLLEGE_APPLICATION',
    };

    it('should return parsed review result on success', async () => {
      const parsedResult = {
        dimensions: [
          {
            name: 'content',
            score: 70,
            feedback: 'Good content',
            criteria: [
              { key: 'depth', name: 'Depth', score: 7, detail: 'Good depth' },
            ],
            improvements: ['Add more detail'],
          },
        ],
        sectionFeedback: [
          {
            sectionType: 'EDUCATION',
            sectionTitle: 'Education',
            issues: [
              {
                type: 'too_vague',
                severity: 'medium',
                original: 'BS at MIT',
                suggestion: 'Add GPA',
                reason: 'Missing quantification',
              },
            ],
          },
        ],
        contentGaps: [
          {
            sectionType: 'SKILLS',
            description: 'Missing skills section',
            priority: 'high',
          },
        ],
        bulletQuality: {
          actionVerbUsage: 80,
          quantificationRate: 60,
          averageLength: 15,
        },
        summary: 'Solid resume with room for improvement.',
      };

      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);

      const result = await service.reviewResume(
        mockResumeData,
        { targetSchool: 'MIT' },
        'en',
      );

      expect(result.version).toBe(2);
      expect(result.dimensions).toHaveLength(1);
      expect(result.dimensions[0].name).toBe('content');
      expect(result.sectionFeedback).toHaveLength(1);
      expect(result.sectionFeedback[0].sectionId).toBe('s1'); // mapped via sectionType
      expect(result.bulletQuality.actionVerbUsage).toBe(80);
      expect(result.summary).toBe('Solid resume with room for improvement.');
      expect(mockLLMService.chatSimpleGuarded).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        { temperature: 0.3, maxTokens: 4000 },
      );
    });

    it('should throw BadRequestException when LLM call fails', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(
        new Error('API error'),
      );

      await expect(
        service.reviewResume(mockResumeData, {}, 'en'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle missing fields in parsed result gracefully', async () => {
      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue({});

      const result = await service.reviewResume(mockResumeData, {}, 'zh');

      expect(result.version).toBe(2);
      expect(result.dimensions).toEqual([]);
      expect(result.sectionFeedback).toEqual([]);
      expect(result.contentGaps).toEqual([]);
      expect(result.overallScore).toBe(50); // fallback
    });
  });

  describe('optimizeResumeBullets', () => {
    it('should return optimized bullets on success', async () => {
      const parsedResult = {
        optimized: [
          {
            original: 'Helped team win',
            improved: 'Spearheaded team strategy resulting in 1st place finish',
            reason: 'Added action verb and quantification',
          },
        ],
        newSuggestions: ['Consider adding leadership bullet'],
      };

      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);

      const result = await service.optimizeResumeBullets(
        ['Helped team win'],
        { sectionType: 'ACTIVITIES', role: 'Captain' },
        'en',
      );

      expect(result.optimized).toHaveLength(1);
      expect(result.optimized[0].improved).toContain('Spearheaded');
      expect(result.newSuggestions).toHaveLength(1);
    });

    it('should throw BadRequestException when LLM call fails', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(new Error('timeout'));

      await expect(
        service.optimizeResumeBullets(
          ['bullet1'],
          { sectionType: 'WORK_EXPERIENCE' },
          'zh',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('suggestSectionContent', () => {
    it('should return suggestions on success', async () => {
      const parsedResult = {
        suggestions: [
          {
            text: 'Add a research project',
            category: 'new_item',
            priority: 'high',
          },
        ],
        tips: ['Focus on STEM activities'],
        exampleBullets: ['Led research on ML models'],
      };

      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);

      const result = await service.suggestSectionContent(
        'ACTIVITIES',
        { existingContent: {}, resumeType: 'COLLEGE_APPLICATION' },
        'en',
      );

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].priority).toBe('high');
      expect(result.tips).toHaveLength(1);
      expect(result.exampleBullets).toHaveLength(1);
    });

    it('should throw BadRequestException when LLM call fails', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(new Error('fail'));

      await expect(
        service.suggestSectionContent(
          'SKILLS',
          { existingContent: {}, resumeType: 'INTERNSHIP' },
          'en',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle empty parsed result gracefully', async () => {
      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue({});

      const result = await service.suggestSectionContent(
        'AWARDS',
        { existingContent: {}, resumeType: 'GRADUATE_CV' },
        'zh',
      );

      expect(result.suggestions).toEqual([]);
      expect(result.tips).toEqual([]);
      expect(result.exampleBullets).toBeUndefined();
    });
  });
});
