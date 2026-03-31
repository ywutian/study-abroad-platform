/**
 * PersistentMemoryService 单元测试
 *
 * 测试消息查询排序（Bug A 修复验证）、游标分页
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PersistentMemoryService } from './persistent-memory.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

describe('PersistentMemoryService', () => {
  let service: PersistentMemoryService;
  let prisma: {
    agentMessage: { findMany: jest.Mock };
    agentConversation: { findUnique: jest.Mock };
    $queryRawUnsafe: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      agentMessage: { findMany: jest.fn().mockResolvedValue([]) },
      agentConversation: { findUnique: jest.fn() },
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersistentMemoryService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EmbeddingService,
          useValue: {
            embed: jest.fn(),
            embedBatch: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PersistentMemoryService>(PersistentMemoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMessages', () => {
    const now = new Date('2026-03-26T12:00:00Z');

    // Helper: create N mock messages with ascending timestamps
    const makeMockMessages = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `msg_${i + 1}`,
        conversationId: 'conv_1',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        agentType: null,
        toolCalls: null,
        tokensUsed: null,
        latencyMs: null,
        createdAt: new Date(now.getTime() + i * 60_000),
      }));

    it('should query with DESC order and reverse to return chronological results', async () => {
      // Simulate DB returning newest-first (DESC)
      const dbRows = makeMockMessages(3).reverse(); // [msg_3, msg_2, msg_1]
      prisma.agentMessage.findMany.mockResolvedValue(dbRows);

      const result = await service.getMessages('conv_1');

      // Verify query uses DESC ordering
      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      );

      // Result should be chronological (oldest first after reverse)
      expect(result[0].id).toBe('msg_1');
      expect(result[1].id).toBe('msg_2');
      expect(result[2].id).toBe('msg_3');
    });

    it('should return the newest N messages when limit < total', async () => {
      // DB has 100 messages; we ask for 3
      // DESC + take 3 returns the 3 newest (msg_100, msg_99, msg_98)
      const newest3Desc = [
        { ...makeMockMessages(1)[0], id: 'msg_100', content: 'Message 100' },
        { ...makeMockMessages(1)[0], id: 'msg_99', content: 'Message 99' },
        { ...makeMockMessages(1)[0], id: 'msg_98', content: 'Message 98' },
      ];
      prisma.agentMessage.findMany.mockResolvedValue(newest3Desc);

      const result = await service.getMessages('conv_1', { limit: 3 });

      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );

      // After reverse: chronological order (msg_98, msg_99, msg_100)
      expect(result[0].id).toBe('msg_98');
      expect(result[1].id).toBe('msg_99');
      expect(result[2].id).toBe('msg_100');
    });

    it('should support before cursor for pagination', async () => {
      const beforeDate = new Date('2026-03-26T12:05:00Z');
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.getMessages('conv_1', { limit: 10, before: beforeDate });

      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            conversationId: 'conv_1',
            createdAt: { lt: beforeDate },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      );
    });

    it('should return empty array when no messages exist', async () => {
      prisma.agentMessage.findMany.mockResolvedValue([]);

      const result = await service.getMessages('conv_1');

      expect(result).toEqual([]);
    });

    it('should use default limit of 50', async () => {
      prisma.agentMessage.findMany.mockResolvedValue([]);

      await service.getMessages('conv_1');

      expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should map raw rows to MessageRecord format', async () => {
      const rawRow = {
        id: 'msg_1',
        conversationId: 'conv_1',
        role: 'assistant',
        content: 'Hello',
        agentType: 'orchestrator',
        toolCalls: [{ id: 'tc_1', name: 'search', arguments: '{}' }],
        tokensUsed: 150,
        latencyMs: 200,
        createdAt: now,
      };
      prisma.agentMessage.findMany.mockResolvedValue([rawRow]);

      const result = await service.getMessages('conv_1');

      expect(result[0]).toEqual({
        id: 'msg_1',
        conversationId: 'conv_1',
        role: 'assistant',
        content: 'Hello',
        agentType: 'orchestrator',
        toolCalls: [{ id: 'tc_1', name: 'search', arguments: '{}' }],
        tokensUsed: 150,
        latencyMs: 200,
        createdAt: now,
      });
    });
  });
});
