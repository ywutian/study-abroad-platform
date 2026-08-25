/**
 * SummarizerService 单元测试
 *
 * 覆盖 extractFromMessage 和 parseSummaryResponse 的
 * extractJsonFromLlm 分支及结构校验
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SummarizerService } from './summarizer.service';
import { LLMService } from '../core/llm.service';
import { MemoryType, EntityType } from '@prisma/client';

describe('SummarizerService', () => {
  let service: SummarizerService;
  let mockLLMService: { chatSimple: jest.Mock };

  beforeEach(async () => {
    mockLLMService = {
      chatSimple: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SummarizerService,
        { provide: LLMService, useValue: mockLLMService },
      ],
    }).compile();

    service = module.get<SummarizerService>(SummarizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractFromMessage', () => {
    const makeMessage = (content: string) => ({
      id: 'msg-1',
      conversationId: 'conv-1',
      role: 'user' as const,
      content,
      createdAt: new Date(),
    });

    it('should return empty for non-user messages', async () => {
      const result = await service.extractFromMessage({
        ...makeMessage('some content here for testing'),
        role: 'assistant',
      });

      expect(result).toEqual({ memories: [], entities: [] });
      expect(mockLLMService.chatSimple).not.toHaveBeenCalled();
    });

    it('should return empty for short messages', async () => {
      const result = await service.extractFromMessage(makeMessage('Hi'));

      expect(result).toEqual({ memories: [], entities: [] });
      expect(mockLLMService.chatSimple).not.toHaveBeenCalled();
    });

    it('should extract memories and entities from valid LLM response', async () => {
      mockLLMService.chatSimple.mockResolvedValue(
        JSON.stringify({
          memories: [
            {
              type: 'FACT',
              category: 'academic',
              content: 'GPA 3.9',
              importance: 0.8,
            },
          ],
          entities: [
            {
              type: 'SCHOOL',
              name: 'Stanford',
              description: '目标学校',
            },
          ],
        }),
      );

      const result = await service.extractFromMessage(
        makeMessage('我的 GPA 是 3.9，目标是 Stanford University'),
      );

      expect(result.memories).toHaveLength(1);
      expect(result.memories[0]).toEqual(
        expect.objectContaining({
          type: MemoryType.FACT,
          content: 'GPA 3.9',
          importance: 0.8,
        }),
      );
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]).toEqual(
        expect.objectContaining({
          type: EntityType.SCHOOL,
          name: 'Stanford',
        }),
      );
    });

    it('should return empty when LLM returns non-JSON', async () => {
      mockLLMService.chatSimple.mockResolvedValue(
        'Sorry, I cannot extract any information.',
      );

      const result = await service.extractFromMessage(
        makeMessage('我的 GPA 是 3.9，目标是 Stanford University'),
      );

      expect(result).toEqual({ memories: [], entities: [] });
    });

    it('should return empty when memories is not an array', async () => {
      mockLLMService.chatSimple.mockResolvedValue(
        JSON.stringify({
          memories: 'not an array',
          entities: [],
        }),
      );

      const result = await service.extractFromMessage(
        makeMessage('我的 GPA 是 3.9，目标是 Stanford University'),
      );

      expect(result).toEqual({ memories: [], entities: [] });
    });

    it('should handle entities being non-array gracefully', async () => {
      mockLLMService.chatSimple.mockResolvedValue(
        JSON.stringify({
          memories: [{ type: 'FACT', content: 'GPA 3.9', importance: 0.8 }],
          entities: 'not an array',
        }),
      );

      const result = await service.extractFromMessage(
        makeMessage('我的 GPA 是 3.9，目标是 Stanford University'),
      );

      expect(result.memories).toHaveLength(1);
      expect(result.entities).toEqual([]);
    });

    it('should return empty on LLM error', async () => {
      mockLLMService.chatSimple.mockRejectedValue(new Error('LLM timeout'));

      const result = await service.extractFromMessage(
        makeMessage('我的 GPA 是 3.9，目标是 Stanford University'),
      );

      expect(result).toEqual({ memories: [], entities: [] });
    });
  });

  describe('summarizeConversation', () => {
    it('should return empty summary for no messages', async () => {
      const result = await service.summarizeConversation([]);

      expect(result.summary).toBe('');
      expect(result.keyTopics).toEqual([]);
      expect(mockLLMService.chatSimple).not.toHaveBeenCalled();
    });

    it('should parse valid summary response', async () => {
      mockLLMService.chatSimple.mockResolvedValue(
        JSON.stringify({
          summary: '讨论了选校策略',
          keyTopics: ['选校', 'GPA'],
          decisions: ['申请 Stanford'],
          nextSteps: ['准备文书'],
          facts: [{ type: 'FACT', content: 'GPA 3.9', importance: 0.8 }],
          entities: [{ type: 'SCHOOL', name: 'Stanford', description: '目标' }],
        }),
      );

      const result = await service.summarizeConversation([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: '帮我选校，我 GPA 3.9',
          createdAt: new Date(),
        },
      ]);

      expect(result.summary).toBe('讨论了选校策略');
      expect(result.keyTopics).toEqual(['选校', 'GPA']);
      expect(result.decisions).toEqual(['申请 Stanford']);
      expect(result.nextSteps).toEqual(['准备文书']);
      expect(result.extractedFacts).toHaveLength(1);
      expect(result.extractedFacts[0].type).toBe(MemoryType.FACT);
      expect(result.extractedEntities).toHaveLength(1);
      expect(result.extractedEntities[0].type).toBe(EntityType.SCHOOL);
    });

    it('should use deterministic fallback when summary is not a string', async () => {
      mockLLMService.chatSimple.mockResolvedValue(
        JSON.stringify({
          summary: 123, // wrong type
          keyTopics: ['test'],
        }),
      );

      const result = await service.summarizeConversation([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: '帮我选校',
          createdAt: new Date(),
        },
      ]);

      expect(result.summary).toContain('1 条消息');
      expect(result.keyTopics).toEqual([]);
    });

    it('should use deterministic fallback when the LLM response is not JSON', async () => {
      mockLLMService.chatSimple.mockResolvedValue('not-json');

      const result = await service.summarizeConversation([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: '帮我看看学校和文书',
          createdAt: new Date(),
        },
      ]);

      expect(result.summary).toContain('1 条消息');
      expect(result.summary).toContain('学校、文书');
    });

    it('should degrade non-array fields to empty arrays', async () => {
      mockLLMService.chatSimple.mockResolvedValue(
        JSON.stringify({
          summary: '讨论了选校',
          keyTopics: 'not array',
          decisions: null,
          nextSteps: 42,
          facts: 'string',
          entities: undefined,
        }),
      );

      const result = await service.summarizeConversation([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: '帮我选校',
          createdAt: new Date(),
        },
      ]);

      expect(result.summary).toBe('讨论了选校');
      expect(result.keyTopics).toEqual([]);
      expect(result.decisions).toEqual([]);
      expect(result.nextSteps).toEqual([]);
      expect(result.extractedFacts).toEqual([]);
      expect(result.extractedEntities).toEqual([]);
    });

    it('should use fallback on LLM error', async () => {
      mockLLMService.chatSimple.mockRejectedValue(new Error('timeout'));

      const result = await service.summarizeConversation([
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: '帮我看看学校和文书',
          createdAt: new Date(),
        },
      ]);

      expect(result.summary).toContain('1 条消息');
      expect(result.keyTopics.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('shouldSummarize', () => {
    it('should return false for few short messages', () => {
      const messages = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        conversationId: 'conv-1',
        role: 'user' as const,
        content: '短消息',
        createdAt: new Date(),
      }));

      expect(service.shouldSummarize(messages)).toBe(false);
    });

    it('should return true for more than 20 messages', () => {
      const messages = Array.from({ length: 21 }, (_, i) => ({
        id: `msg-${i}`,
        conversationId: 'conv-1',
        role: 'user' as const,
        content: '消息',
        createdAt: new Date(),
      }));

      expect(service.shouldSummarize(messages)).toBe(true);
    });

    it('should return true when total content exceeds 10000 chars', () => {
      const messages = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user' as const,
          content: 'x'.repeat(10001),
          createdAt: new Date(),
        },
      ];

      expect(service.shouldSummarize(messages)).toBe(true);
    });
  });
});
