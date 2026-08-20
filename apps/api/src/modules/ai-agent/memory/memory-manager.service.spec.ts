/**
 * MemoryManagerService 单元测试
 *
 * 测试记忆存取、向量搜索、上下文检索
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MemoryManagerService } from './memory-manager.service';
import { RedisService } from '../../../common/redis/redis.service';
import { RedisCacheService } from './redis-cache.service';
import { PersistentMemoryService } from './persistent-memory.service';
import { EmbeddingService } from './embedding.service';
import { SummarizerService } from './summarizer.service';
import { MemoryScorerService } from './memory-scorer.service';
import { MemoryDecayService } from './memory-decay.service';
import { MemoryConflictService } from './memory-conflict.service';
import { MemoryType, EntityType } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

describe('MemoryManagerService', () => {
  let service: MemoryManagerService;
  let cache: jest.Mocked<RedisCacheService>;
  let persistent: jest.Mocked<PersistentMemoryService>;
  let embedding: jest.Mocked<EmbeddingService>;
  let summarizer: jest.Mocked<SummarizerService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryManagerService,
        {
          provide: RedisCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            delete: jest.fn(),
            getConversationMeta: jest.fn().mockResolvedValue(null),
            cacheConversation: jest.fn().mockResolvedValue(undefined),
            getActiveConversation: jest.fn().mockResolvedValue(null),
            setActiveConversation: jest.fn().mockResolvedValue(undefined),
            cacheMessage: jest.fn().mockResolvedValue(undefined),
            getConversationMessages: jest.fn().mockResolvedValue([]),
            deleteConversation: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PersistentMemoryService,
          useValue: {
            createConversation: jest.fn(),
            getConversation: jest.fn(),
            updateConversation: jest.fn().mockResolvedValue(undefined),
            addMessage: jest.fn(),
            getMessages: jest.fn().mockResolvedValue([]),
            getRecentConversations: jest.fn().mockResolvedValue([]),
            createMemory: jest.fn(),
            createMemories: jest.fn().mockResolvedValue([]),
            searchMemories: jest.fn().mockResolvedValue([]),
            queryMemories: jest.fn().mockResolvedValue([]),
            updateMemory: jest.fn(),
            deleteMemory: jest.fn().mockResolvedValue(undefined),
            upsertEntity: jest.fn().mockResolvedValue(undefined),
            getEntities: jest.fn().mockResolvedValue([]),
            searchEntities: jest.fn().mockResolvedValue([]),
            getPreferences: jest.fn().mockResolvedValue(null),
            updatePreferences: jest.fn().mockResolvedValue(undefined),
            getStats: jest.fn(),
            cleanupExpiredMemories: jest.fn(),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            embed: jest.fn(),
            embedBatch: jest.fn(),
            cosineSimilarity: jest.fn(),
            findMostSimilar: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              set: jest.fn().mockResolvedValue('OK'),
            }),
            connected: true,
            setNXStrict: jest.fn().mockResolvedValue(true),
            del: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: SummarizerService,
          useValue: {
            summarizeConversation: jest.fn(),
            extractFromMessage: jest.fn(),
            shouldSummarize: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: MemoryScorerService,
          useValue: {
            score: jest.fn().mockReturnValue(0.5),
            calculateImportance: jest.fn().mockReturnValue(0.5),
          },
        },
        {
          provide: MemoryDecayService,
          useValue: {
            applyDecay: jest.fn().mockResolvedValue(undefined),
            getDecayedScore: jest.fn().mockReturnValue(0.5),
            recordAccess: jest.fn().mockResolvedValue(undefined),
            recordAccessBatch: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MemoryConflictService,
          useValue: {
            detectConflicts: jest.fn().mockResolvedValue([]),
            resolveConflict: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<MemoryManagerService>(MemoryManagerService);
    cache = module.get(RedisCacheService);
    persistent = module.get(PersistentMemoryService);
    embedding = module.get(EmbeddingService);
    summarizer = module.get(SummarizerService);
    config = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateConversation', () => {
    it('should return cached conversation if exists', async () => {
      const cachedConversation = {
        id: 'conv_1',
        userId: 'user_1',
        messageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      cache.getConversationMeta.mockResolvedValue(cachedConversation);

      const result = await service.getOrCreateConversation('user_1', 'conv_1');

      expect(cache.getConversationMeta).toHaveBeenCalledWith('conv_1');
      expect(result.id).toBe('conv_1');
    });

    it('returns real Dates from cache, not the strings JSON gives back', async () => {
      // The cache is written with setJSON/JSON.stringify, so a hit hands back
      // ISO strings — not the Date objects the test above mocks. Feeding the
      // mock the round-tripped shape is the only way this path is exercised
      // the way production runs it.
      const live = {
        id: 'conv_1',
        userId: 'user_1',
        messageCount: 5,
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
        updatedAt: new Date('2026-01-02T03:04:05.000Z'),
      };
      cache.getConversationMeta.mockResolvedValue(
        JSON.parse(JSON.stringify(live)),
      );

      const result = await service.getOrCreateConversation('user_1', 'conv_1');

      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(result.createdAt.toISOString()).toBe('2026-01-02T03:04:05.000Z');
    });

    it('should reject when cached conversation belongs to another user', async () => {
      cache.getConversationMeta.mockResolvedValue({
        id: 'conv_victim',
        userId: 'user_victim',
        messageCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.getOrCreateConversation('user_attacker', 'conv_victim'),
      ).rejects.toThrow('Conversation not found');
      expect(persistent.getConversation).not.toHaveBeenCalled();
    });

    it('should fall back to DB when cache has id but no userId', async () => {
      cache.getConversationMeta.mockResolvedValue({
        id: 'conv_1',
        title: 'partial meta',
      });
      persistent.getConversation.mockResolvedValue({
        id: 'conv_1',
        userId: 'user_1',
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getOrCreateConversation('user_1', 'conv_1');

      expect(persistent.getConversation).toHaveBeenCalledWith('conv_1');
      expect(result.userId).toBe('user_1');
      expect(cache.cacheConversation).toHaveBeenCalled();
    });

    it('should reject when DB conversation belongs to another user', async () => {
      cache.getConversationMeta.mockResolvedValue(null);
      persistent.getConversation.mockResolvedValue({
        id: 'conv_victim',
        userId: 'user_victim',
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.getOrCreateConversation('user_attacker', 'conv_victim'),
      ).rejects.toThrow('Conversation not found');
    });

    it('should create new conversation if not exists', async () => {
      cache.getConversationMeta.mockResolvedValue(null);
      cache.getActiveConversation.mockResolvedValue(null);
      persistent.createConversation.mockResolvedValue({
        id: 'conv_new',
        userId: 'user_1',
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const _result = await service.getOrCreateConversation('user_1');

      expect(persistent.createConversation).toHaveBeenCalled();
      expect(cache.cacheConversation).toHaveBeenCalled();
    });
  });

  describe('addMessage', () => {
    it('should add message to cache and persistent storage', async () => {
      const messageInput = {
        role: 'user' as const,
        content: '帮我选校',
      };

      persistent.addMessage.mockResolvedValue({
        id: 'msg_1',
        conversationId: 'conv_1',
        role: 'user',
        content: '帮我选校',
        createdAt: new Date(),
      });

      summarizer.extractFromMessage.mockResolvedValue({
        memories: [],
        entities: [],
      });

      const _result = await service.addMessage('conv_1', messageInput);

      expect(persistent.addMessage).toHaveBeenCalled();
      expect(cache.cacheMessage).toHaveBeenCalled();
    });

    it('should extract and save memories from user messages', async () => {
      const messageInput = {
        role: 'user' as const,
        content: '我的 GPA 是 3.9，目标是 Stanford',
      };

      persistent.addMessage.mockResolvedValue({
        id: 'msg_1',
        conversationId: 'conv_1',
        role: 'user',
        content: messageInput.content,
        createdAt: new Date(),
      });

      summarizer.extractFromMessage.mockResolvedValue({
        memories: [
          { type: MemoryType.FACT, content: 'GPA 3.9', importance: 0.8 },
          {
            type: MemoryType.PREFERENCE,
            content: '目标 Stanford',
            importance: 0.9,
          },
        ],
        entities: [
          {
            type: EntityType.SCHOOL,
            name: 'Stanford',
            description: '目标学校',
          },
        ],
      });

      // Mock getConversation to return userId
      persistent.getConversation.mockResolvedValue({
        id: 'conv_1',
        userId: 'user_1',
        messageCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.addMessage('conv_1', messageInput);
      await new Promise((resolve) => setImmediate(resolve));

      // 应该调用 extractFromMessage 提取记忆
      expect(summarizer.extractFromMessage).toHaveBeenCalled();
    });
  });

  describe('recall', () => {
    it('should search memories by query using semantic search', async () => {
      persistent.searchMemories.mockResolvedValue([
        {
          id: 'mem_1',
          userId: 'user_1',
          type: MemoryType.FACT,
          content: 'GPA 3.9',
          importance: 0.8,
          accessCount: 1,
          createdAt: new Date(),
          similarity: 0.95,
        },
      ]);

      const result = await service.recall('user_1', {
        query: 'GPA',
        useSemanticSearch: true,
      });

      expect(persistent.searchMemories).toHaveBeenCalledWith(
        'user_1',
        'GPA',
        expect.objectContaining({ limit: 20 }),
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by memory types', async () => {
      persistent.queryMemories.mockResolvedValue([
        {
          id: 'mem_1',
          userId: 'user_1',
          type: MemoryType.PREFERENCE,
          content: '喜欢城市学校',
          importance: 0.7,
          accessCount: 0,
          createdAt: new Date(),
        },
      ]);

      const _result = await service.recall('user_1', {
        types: [MemoryType.PREFERENCE],
      });

      expect(persistent.queryMemories).toHaveBeenCalledWith(
        'user_1',
        expect.objectContaining({ types: [MemoryType.PREFERENCE] }),
      );
    });
  });

  describe('getRetrievalContext', () => {
    it('should build complete retrieval context', async () => {
      // Mock recent messages
      cache.getConversationMessages.mockResolvedValue([
        {
          id: 'msg_1',
          conversationId: 'conv_1',
          role: 'user',
          content: '你好',
          createdAt: new Date(),
        },
      ]);

      // Mock relevant memories
      persistent.searchMemories.mockResolvedValue([
        {
          id: 'mem_1',
          userId: 'user_1',
          type: MemoryType.FACT,
          content: 'GPA 3.9',
          importance: 0.8,
          accessCount: 1,
          createdAt: new Date(),
          similarity: 0.9,
        },
      ]);

      // Mock entities
      persistent.searchEntities.mockResolvedValue([
        {
          id: 'ent_1',
          userId: 'user_1',
          type: EntityType.SCHOOL,
          name: 'Stanford',
          createdAt: new Date(),
          similarity: 0.85,
        },
      ]);

      // Mock user preferences
      persistent.getPreferences.mockResolvedValue({
        communicationStyle: 'friendly',
        responseLength: 'moderate',
        language: 'zh',
        enableMemory: true,
        enableSuggestions: true,
      });

      embedding.embed.mockResolvedValue(new Array(1536).fill(0.1));

      const context = await service.getRetrievalContext(
        'user_1',
        '帮我分析录取概率',
        'conv_1',
      );

      expect(context).toHaveProperty('recentMessages');
      expect(context).toHaveProperty('relevantMemories');
      expect(context).toHaveProperty('preferences');
      expect(context).toHaveProperty('entities');
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired memories', async () => {
      persistent.cleanupExpiredMemories.mockResolvedValue(5);

      const result = await service.cleanup();

      expect(persistent.cleanupExpiredMemories).toHaveBeenCalled();
      expect(result.expiredMemories).toBe(5);
    });
  });

  describe('getConversation', () => {
    it('should delegate to persistent.getConversation', async () => {
      const mockConversation = {
        id: 'conv_1',
        userId: 'user_1',
        messageCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      persistent.getConversation.mockResolvedValue(mockConversation);

      const result = await service.getConversation('conv_1');

      expect(persistent.getConversation).toHaveBeenCalledWith('conv_1');
      expect(result).toEqual(mockConversation);
    });

    it('should return null for non-existent conversation', async () => {
      persistent.getConversation.mockResolvedValue(null);

      const result = await service.getConversation('conv_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getMessages (Gateway)', () => {
    it('should delegate to persistent.getMessages with limit', async () => {
      const mockMessages = [
        {
          id: 'msg_1',
          conversationId: 'conv_1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];
      persistent.getMessages.mockResolvedValue(mockMessages);

      const result = await service.getMessages('conv_1', 20);

      expect(persistent.getMessages).toHaveBeenCalledWith('conv_1', {
        limit: 20,
      });
      expect(result).toEqual(mockMessages);
    });

    it('should use default limit of 50', async () => {
      persistent.getMessages.mockResolvedValue([]);

      await service.getMessages('conv_1');

      expect(persistent.getMessages).toHaveBeenCalledWith('conv_1', {
        limit: 50,
      });
    });
  });

  describe('getStats', () => {
    it('should return memory statistics', async () => {
      persistent.getStats.mockResolvedValue({
        totalMemories: 100,
        totalConversations: 20,
        totalMessages: 500,
        totalEntities: 50,
        memoryByType: {
          [MemoryType.FACT]: 40,
          [MemoryType.PREFERENCE]: 30,
          [MemoryType.DECISION]: 20,
          [MemoryType.SUMMARY]: 10,
        },
        recentActivity: {
          conversationsLast7Days: 5,
          messagesLast7Days: 50,
        },
      });

      const stats = await service.getStats('user_1');

      expect(stats.totalMemories).toBe(100);
      expect(stats.totalConversations).toBe(20);
    });
  });

  describe('memory preference boundary', () => {
    it('persists conversation messages but skips extraction when disabled', async () => {
      persistent.addMessage.mockResolvedValue({
        id: 'message-1',
        conversationId: 'conversation-1',
        role: 'user',
        content: 'A sufficiently long user message that would be extracted',
        createdAt: new Date(),
      });
      persistent.getConversation.mockResolvedValue({
        id: 'conversation-1',
        userId: 'user-1',
        messageCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      persistent.getPreferences.mockResolvedValue({
        communicationStyle: 'friendly',
        responseLength: 'moderate',
        language: 'zh-CN',
        enableMemory: false,
        enableSuggestions: true,
      });

      await service.addMessage('conversation-1', {
        role: 'user',
        content: 'A sufficiently long user message that would be extracted',
      });

      expect(persistent.addMessage).toHaveBeenCalled();
      expect(summarizer.extractFromMessage).not.toHaveBeenCalled();
    });

    it('skips memory and entity retrieval when disabled', async () => {
      persistent.getPreferences.mockResolvedValue({
        communicationStyle: 'friendly',
        responseLength: 'moderate',
        language: 'zh-CN',
        enableMemory: false,
        enableSuggestions: true,
      });

      const context = await service.getRetrievalContext(
        'user-1',
        'current question',
      );

      expect(context.meta.memoryEnabled).toBe(false);
      expect(context.relevantMemories).toEqual([]);
      expect(context.entities).toEqual([]);
      expect(persistent.searchMemories).not.toHaveBeenCalled();
      expect(persistent.searchEntities).not.toHaveBeenCalled();
    });
  });

  describe('conversation context compression', () => {
    const conversation = {
      id: 'conversation-1',
      userId: 'user-1',
      messageCount: 21,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const messages = Array.from({ length: 21 }, (_, index) => ({
      id: `message-${index}`,
      conversationId: 'conversation-1',
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message ${index}`,
      createdAt: new Date(index * 1000),
    }));

    it('stores a structured summary and keeps only recent messages', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'AI_AGENT_HARNESS_V1') return 'true';
        if (key === 'AI_AGENT_CONTEXT_V1') return 'true';
        if (key === 'AI_AGENT_CONTEXT_RECENT_MESSAGES') return 10;
        return undefined;
      });
      persistent.getConversation.mockResolvedValue(conversation);
      persistent.getMessages.mockResolvedValue(messages);
      summarizer.shouldSummarize.mockReturnValue(true);
      summarizer.summarizeConversation.mockResolvedValue({
        summary: 'The user selected a school list.',
        keyTopics: ['schools'],
        decisions: ['Keep three target schools'],
        nextSteps: ['Compare deadlines'],
        extractedFacts: [],
        extractedEntities: [],
      });

      const result =
        await service.getCompressedConversationContext('conversation-1');

      expect(result.recentMessages).toHaveLength(10);
      expect(result.summary?.throughMessageId).toBe('message-10');
      expect(persistent.updateConversation).toHaveBeenCalledWith(
        'conversation-1',
        expect.objectContaining({
          summary: 'The user selected a school list.',
        }),
      );
    });

    it('retains the last valid summary when compression fails', async () => {
      config.get.mockImplementation((key: string) =>
        key === 'AI_AGENT_HARNESS_V1' || key === 'AI_AGENT_CONTEXT_V1'
          ? 'true'
          : key === 'AI_AGENT_CONTEXT_RECENT_MESSAGES'
            ? 10
            : undefined,
      );
      persistent.getConversation.mockResolvedValue({
        ...conversation,
        metadata: {
          conversationContextSummaryV1: {
            version: 1,
            summary: 'Last valid summary',
            keyTopics: [],
            decisions: [],
            nextSteps: [],
            throughMessageId: 'message-0',
            sourceMessageCount: 1,
            updatedAt: new Date(0).toISOString(),
          },
        },
      });
      persistent.getMessages.mockResolvedValue(messages);
      summarizer.shouldSummarize.mockReturnValue(true);
      summarizer.summarizeConversation.mockRejectedValue(
        new Error('LLM unavailable'),
      );

      const result =
        await service.getCompressedConversationContext('conversation-1');

      expect(result.summary?.summary).toBe('Last valid summary');
      expect(persistent.updateConversation).not.toHaveBeenCalled();
    });
  });
});
