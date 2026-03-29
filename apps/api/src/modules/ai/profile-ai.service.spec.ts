import { Test, TestingModule } from '@nestjs/testing';
import { ProfileAiService } from './profile-ai.service';
import { LLMService } from '../ai-agent/core/llm.service';

jest.mock('../../common/utils/llm-json.util', () => ({
  extractJsonFromLlm: jest.fn(),
}));

import { extractJsonFromLlm } from '../../common/utils/llm-json.util';

describe('ProfileAiService', () => {
  let service: ProfileAiService;
  let llmService: LLMService;

  const mockLLMService = {
    chatSimple: jest.fn(),
    chatSimpleGuarded: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileAiService,
        {
          provide: LLMService,
          useValue: mockLLMService,
        },
      ],
    }).compile();

    service = module.get<ProfileAiService>(ProfileAiService);
    llmService = module.get<LLMService>(LLMService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeProfileDetailed', () => {
    const mockRequest = {
      gpa: 3.8,
      gpaScale: 4.0,
      testScores: [{ type: 'SAT', score: 1500 }],
      activities: [
        { name: 'Debate Club', category: 'CLUB', role: 'President' },
      ],
      awards: [{ name: 'Math Olympiad', level: 'National' }],
      targetMajor: 'Computer Science',
    } as any;

    it('should return detailed analysis on success', async () => {
      const mockLlmResult = JSON.stringify({
        sections: {
          academic: {
            status: 'green',
            score: 8,
            feedback: 'Strong GPA',
            highlights: ['High GPA'],
            improvements: [],
          },
          testScores: {
            status: 'green',
            score: 9,
            feedback: 'Excellent SAT',
            highlights: ['1500 SAT'],
            improvements: [],
          },
          activities: {
            status: 'yellow',
            score: 6,
            feedback: 'Could diversify',
            highlights: ['Leadership'],
            improvements: ['Add more activities'],
          },
          awards: {
            status: 'green',
            score: 7,
            feedback: 'Good awards',
            highlights: ['National level'],
            improvements: [],
          },
        },
        overallScore: 75,
        tier: 'top30',
        suggestions: {
          majors: ['CS', 'Engineering'],
          competitions: ['USACO'],
          activities: ['Research'],
          summerPrograms: ['MIT PRIMES'],
          timeline: ['Apply early'],
        },
        summary: 'Strong profile overall.',
      });

      mockLLMService.chatSimpleGuarded.mockResolvedValue(mockLlmResult);
      (extractJsonFromLlm as jest.Mock).mockReturnValue(
        JSON.parse(mockLlmResult),
      );

      const result = await service.analyzeProfileDetailed(mockRequest, 'en');

      expect(mockLLMService.chatSimpleGuarded).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        { temperature: 0.4, maxTokens: 2500 },
      );
      expect(result.overallScore).toBe(75);
      expect(result.tier).toBe('top30');
      expect(result.sections.academic.status).toBe('green');
      expect(result.sections.academic.score).toBe(8);
      expect(result.suggestions.majors).toEqual(['CS', 'Engineering']);
    });

    it('should return default analysis when LLM call fails', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(
        new Error('LLM timeout'),
      );

      const result = await service.analyzeProfileDetailed(mockRequest, 'en');

      expect(result.overallScore).toBe(50);
      expect(result.tier).toBe('top50');
      expect(result.sections.academic.status).toBe('yellow');
      expect(result.sections.academic.score).toBe(5);
      expect(result.summary).toContain('incomplete');
    });

    it('should clamp scores to valid ranges', async () => {
      const parsedResult = {
        sections: {
          academic: {
            status: 'green',
            score: 15,
            feedback: 'Great',
            highlights: [],
            improvements: [],
          },
          testScores: {
            status: 'red',
            score: -5,
            feedback: 'Low',
            highlights: [],
            improvements: [],
          },
          activities: {
            status: 'yellow',
            score: 5,
            feedback: 'OK',
            highlights: [],
            improvements: [],
          },
          awards: {
            status: 'invalid',
            score: 'abc',
            feedback: null,
            highlights: null,
            improvements: null,
          },
        },
        overallScore: 150,
        tier: 'unknown',
        suggestions: {
          majors: null,
          competitions: 'not-array',
          activities: [],
          summerPrograms: [],
          timeline: [],
        },
        summary: 'Test',
      };

      mockLLMService.chatSimpleGuarded.mockResolvedValue('{}');
      (extractJsonFromLlm as jest.Mock).mockReturnValue(parsedResult);

      const result = await service.analyzeProfileDetailed(mockRequest, 'zh');

      expect(result.sections.academic.score).toBe(10); // clamped to max
      expect(result.sections.testScores.score).toBe(1); // clamped to min
      expect(result.sections.awards.status).toBe('yellow'); // invalid -> default
      expect(result.sections.awards.highlights).toEqual([]); // null -> []
      expect(result.overallScore).toBe(100); // clamped to max
      expect(result.tier).toBe('top50'); // invalid -> default
      expect(result.suggestions.majors).toEqual([]); // null -> []
    });

    it('should use zh locale for default analysis', async () => {
      mockLLMService.chatSimpleGuarded.mockRejectedValue(new Error('fail'));

      const result = await service.analyzeProfileDetailed(mockRequest);

      expect(result.summary).toContain('档案信息不完整');
    });
  });
});
