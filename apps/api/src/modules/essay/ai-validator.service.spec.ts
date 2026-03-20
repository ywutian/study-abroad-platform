import { Test, TestingModule } from '@nestjs/testing';
import { AiValidatorService } from './ai-validator.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { ScrapedEssay } from './strategies/base.strategy';

jest.mock('../../common/utils/llm-json.util', () => ({
  extractJsonFromLlm: jest.fn(),
}));

import { extractJsonFromLlm } from '../../common/utils/llm-json.util';

const mockExtractJsonFromLlm = extractJsonFromLlm as jest.MockedFunction<
  typeof extractJsonFromLlm
>;

describe('AiValidatorService', () => {
  let service: AiValidatorService;

  const mockLlmService = {
    chatSimple: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiValidatorService,
        { provide: LLMService, useValue: mockLlmService },
      ],
    }).compile();

    service = module.get<AiValidatorService>(AiValidatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAndEnhance', () => {
    const baseEssay: ScrapedEssay = {
      prompt: 'Tell us about a time you overcame a challenge.',
      wordLimit: 650,
      type: 'COMMON_APP',
      confidence: 0.8,
    };

    it('should return enhanced validation result from LLM', async () => {
      const llmResult = {
        isValid: true,
        confidence: 0.95,
        promptZh: '请告诉我们你克服挑战的经历。',
        aiTips: '聚焦个人成长与反思',
        aiCategory: '个人成长',
        issues: [],
      };

      mockLlmService.chatSimple.mockResolvedValue('{"some":"json"}');
      mockExtractJsonFromLlm.mockReturnValue(llmResult);

      const result = await service.validateAndEnhance(baseEssay, 'MIT');

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.95);
      expect(result.promptZh).toBe('请告诉我们你克服挑战的经历。');
      expect(result.aiTips).toBe('聚焦个人成长与反思');
      expect(result.aiCategory).toBe('个人成长');
      expect(result.issues).toEqual([]);
      expect(mockLlmService.chatSimple).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({
          maxTokens: 500,
          providerOptions: { response_format: { type: 'json_object' } },
        }),
      );
    });

    it('should use default values when LLM returns partial result', async () => {
      mockLlmService.chatSimple.mockResolvedValue('{}');
      mockExtractJsonFromLlm.mockReturnValue({});

      const result = await service.validateAndEnhance(baseEssay, 'Stanford');

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.7);
      expect(result.promptZh).toBeUndefined();
      expect(result.aiTips).toBeUndefined();
    });

    it('should return invalid result when LLM detects issues', async () => {
      const llmResult = {
        isValid: false,
        confidence: 0.3,
        promptZh: '无效文本',
        aiTips: '这不是有效的文书题目',
        aiCategory: undefined,
        issues: ['Not a valid essay prompt', 'Appears to be navigation text'],
      };

      mockLlmService.chatSimple.mockResolvedValue('{"some":"json"}');
      mockExtractJsonFromLlm.mockReturnValue(llmResult);

      const result = await service.validateAndEnhance(baseEssay, 'Harvard');

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe(0.3);
      expect(result.issues).toHaveLength(2);
    });

    it('should gracefully degrade when LLM throws an error', async () => {
      mockLlmService.chatSimple.mockRejectedValue(
        new Error('LLM service timeout'),
      );

      const result = await service.validateAndEnhance(baseEssay, 'MIT');

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.8);
      expect(result.promptZh).toBeUndefined();
      expect(result.aiTips).toBeUndefined();
    });

    it('should gracefully degrade when extractJsonFromLlm throws', async () => {
      mockLlmService.chatSimple.mockResolvedValue('not valid json');
      mockExtractJsonFromLlm.mockImplementation(() => {
        throw new Error('Failed to extract JSON');
      });

      const result = await service.validateAndEnhance(baseEssay, 'MIT');

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.8);
    });

    it('should use essay confidence as fallback when LLM is unavailable', async () => {
      // Create service without LLMService
      const module: TestingModule = await Test.createTestingModule({
        providers: [AiValidatorService],
      }).compile();

      const serviceWithoutLlm =
        module.get<AiValidatorService>(AiValidatorService);

      const result = await serviceWithoutLlm.validateAndEnhance(
        baseEssay,
        'MIT',
      );

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(0.8);
      expect(mockLlmService.chatSimple).not.toHaveBeenCalled();
    });

    it('should default confidence to 0.5 when essay has no confidence and LLM unavailable', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [AiValidatorService],
      }).compile();

      const serviceWithoutLlm =
        module.get<AiValidatorService>(AiValidatorService);
      const essayNoConfidence: ScrapedEssay = {
        prompt: 'Some prompt',
      };

      const result = await serviceWithoutLlm.validateAndEnhance(
        essayNoConfidence,
        'MIT',
      );

      expect(result.confidence).toBe(0.5);
    });

    it('should include school name and essay details in LLM prompt', async () => {
      mockLlmService.chatSimple.mockResolvedValue('{}');
      mockExtractJsonFromLlm.mockReturnValue({});

      await service.validateAndEnhance(baseEssay, 'Stanford University');

      const callArgs = mockLlmService.chatSimple.mock.calls[0];
      const userMessage = callArgs[0][1].content as string;

      expect(userMessage).toContain('Stanford University');
      expect(userMessage).toContain(baseEssay.prompt);
      expect(userMessage).toContain('650');
    });
  });

  describe('batchTranslate', () => {
    it('should translate multiple prompts via LLM', async () => {
      const prompts = [
        'Tell us about yourself.',
        'Why this school?',
        'Describe a challenge you faced.',
      ];
      const translations = [
        '请介绍你自己。',
        '为什么选择这所学校？',
        '描述你面对的一个挑战。',
      ];

      mockLlmService.chatSimple.mockResolvedValue('{"translations":[...]}');
      mockExtractJsonFromLlm.mockReturnValue({ translations });

      const result = await service.batchTranslate(prompts);

      expect(result).toEqual(translations);
      expect(result).toHaveLength(3);
      expect(mockLlmService.chatSimple).toHaveBeenCalledTimes(1);
      expect(mockLlmService.chatSimple).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
        expect.objectContaining({
          maxTokens: 2000,
        }),
      );
    });

    it('should return empty strings when LLM returns no translations', async () => {
      mockLlmService.chatSimple.mockResolvedValue('{}');
      mockExtractJsonFromLlm.mockReturnValue({});

      const result = await service.batchTranslate(['Prompt 1', 'Prompt 2']);

      expect(result).toEqual(['', '']);
    });

    it('should return empty strings when prompts array is empty', async () => {
      const result = await service.batchTranslate([]);

      expect(result).toEqual([]);
      expect(mockLlmService.chatSimple).not.toHaveBeenCalled();
    });

    it('should return empty strings when LLM throws an error', async () => {
      mockLlmService.chatSimple.mockRejectedValue(
        new Error('API rate limit exceeded'),
      );

      const result = await service.batchTranslate([
        'Prompt 1',
        'Prompt 2',
        'Prompt 3',
      ]);

      expect(result).toEqual(['', '', '']);
    });

    it('should return empty strings when LLM is unavailable', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [AiValidatorService],
      }).compile();

      const serviceWithoutLlm =
        module.get<AiValidatorService>(AiValidatorService);

      const result = await serviceWithoutLlm.batchTranslate([
        'Prompt 1',
        'Prompt 2',
      ]);

      expect(result).toEqual(['', '']);
    });

    it('should include all prompts in the LLM request', async () => {
      const prompts = ['First prompt', 'Second prompt'];
      mockLlmService.chatSimple.mockResolvedValue('{}');
      mockExtractJsonFromLlm.mockReturnValue({ translations: ['一', '二'] });

      await service.batchTranslate(prompts);

      const callArgs = mockLlmService.chatSimple.mock.calls[0];
      const userMessage = callArgs[0][1].content as string;

      expect(userMessage).toContain('1. First prompt');
      expect(userMessage).toContain('2. Second prompt');
    });
  });

  describe('compareMultipleSources', () => {
    it('should merge essays from multiple sources', async () => {
      const sources = [
        {
          source: 'official',
          essays: [
            { prompt: 'Tell us about yourself.', confidence: 0.9 },
            { prompt: 'Why this school?', confidence: 0.8 },
          ] as ScrapedEssay[],
        },
        {
          source: 'community',
          essays: [
            { prompt: 'Describe a challenge.', confidence: 0.7 },
          ] as ScrapedEssay[],
        },
      ];

      const result = await service.compareMultipleSources(sources);

      expect(result).toHaveLength(3);
    });

    it('should deduplicate essays with same prompt prefix (case-insensitive)', async () => {
      const sources = [
        {
          source: 'official',
          essays: [
            { prompt: 'Tell us about yourself.', confidence: 0.9 },
          ] as ScrapedEssay[],
        },
        {
          source: 'community',
          essays: [
            { prompt: 'tell us about yourself.', confidence: 0.7 },
          ] as ScrapedEssay[],
        },
      ];

      const result = await service.compareMultipleSources(sources);

      expect(result).toHaveLength(1);
    });

    it('should keep higher-confidence essay when deduplicating', async () => {
      const sources = [
        {
          source: 'community',
          essays: [
            { prompt: 'Tell us about yourself.', confidence: 0.6 },
          ] as ScrapedEssay[],
        },
        {
          source: 'official',
          essays: [
            { prompt: 'Tell us about yourself.', confidence: 0.95 },
          ] as ScrapedEssay[],
        },
      ];

      const result = await service.compareMultipleSources(sources);

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.95);
    });

    it('should not replace higher-confidence essay with lower one', async () => {
      const sources = [
        {
          source: 'official',
          essays: [
            { prompt: 'Tell us about yourself.', confidence: 0.95 },
          ] as ScrapedEssay[],
        },
        {
          source: 'community',
          essays: [
            { prompt: 'Tell us about yourself.', confidence: 0.6 },
          ] as ScrapedEssay[],
        },
      ];

      const result = await service.compareMultipleSources(sources);

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.95);
    });

    it('should handle empty sources', async () => {
      const result = await service.compareMultipleSources([]);

      expect(result).toEqual([]);
    });

    it('should handle sources with empty essay arrays', async () => {
      const sources = [
        { source: 'official', essays: [] },
        { source: 'community', essays: [] },
      ];

      const result = await service.compareMultipleSources(sources);

      expect(result).toEqual([]);
    });

    it('should treat essays with undefined confidence as 0', async () => {
      const sources = [
        {
          source: 'community',
          essays: [{ prompt: 'Tell us about yourself.' } as ScrapedEssay],
        },
        {
          source: 'official',
          essays: [
            { prompt: 'Tell us about yourself.', confidence: 0.8 },
          ] as ScrapedEssay[],
        },
      ];

      const result = await service.compareMultipleSources(sources);

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.8);
    });

    it('should deduplicate based on first 80 chars of lowercase prompt', async () => {
      const longPromptBase = 'A'.repeat(80);
      const sources = [
        {
          source: 'source1',
          essays: [
            {
              prompt: longPromptBase + ' extra text from source 1',
              confidence: 0.7,
            },
          ] as ScrapedEssay[],
        },
        {
          source: 'source2',
          essays: [
            {
              prompt: longPromptBase + ' different extra text',
              confidence: 0.9,
            },
          ] as ScrapedEssay[],
        },
      ];

      const result = await service.compareMultipleSources(sources);

      // Both share the same first 80 chars, so they are treated as duplicates
      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.9);
    });
  });
});
