import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { EmbeddingAcceptanceService } from './embedding-acceptance.service';
import { EmbeddingService } from './embedding.service';
import { PersistentMemoryService } from './persistent-memory.service';

describe('Embedding synthetic acceptance', () => {
  const vector = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
  const create = (enabled = true) => {
    const row = (id: string, userId = 'a') => ({
      id,
      userId,
      type: 'FACT',
      content: 'synthetic',
      importance: 0.5,
      accessCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', email: 'agent-harness-20260827120000@example.invalid' },
          { id: 'b', email: 'agent-harness-20260827120001@example.invalid' },
        ]),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      memory: {
        create: jest.fn().mockResolvedValue(row('fallback')),
        deleteMany: jest.fn().mockResolvedValue({ count: 4 }),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ valid: true }])
        .mockResolvedValueOnce([{ absent: true }])
        .mockResolvedValueOnce([{ ...row('fallback'), similarity: 1 }])
        .mockResolvedValueOnce([]),
    };
    const embedding = {
      embed: jest.fn().mockResolvedValue(vector),
      embedBatch: jest.fn().mockResolvedValue([vector.map((n) => -n), vector]),
      cosineSimilarity: EmbeddingService.prototype.cosineSimilarity,
    };
    const memory = {
      createMemory: jest
        .fn()
        .mockResolvedValueOnce(row('a1'))
        .mockResolvedValueOnce(row('a2'))
        .mockResolvedValueOnce(row('b1', 'b')),
      searchMemories: jest
        .fn()
        .mockResolvedValueOnce([row('a1'), row('a2')])
        .mockResolvedValueOnce([row('b1', 'b')]),
    };
    const config = new ConfigService({
      AI_AGENT_HARNESS_V1: String(enabled),
      AI_AGENT_ACCEPTANCE_V1: String(enabled),
    });
    const service = new EmbeddingAcceptanceService(
      config,
      prisma as unknown as PrismaService,
      {} as RedisService,
      embedding as unknown as EmbeddingService,
      memory as unknown as PersistentMemoryService,
    );
    return { service, prisma, memory, embedding };
  };
  it('rejects disabled acceptance before any lookup or provider call', async () => {
    const { service, prisma, embedding } = create(false);
    await expect(service.run('admin', 'a', 'b')).rejects.toThrow(
      'embedding_acceptance_disabled',
    );
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(embedding.embed).not.toHaveBeenCalled();
  });
  it('requires distinct users', async () => {
    await expect(create().service.run('admin', 'a', 'a')).rejects.toThrow(
      'distinct_synthetic_users_required',
    );
  });
  it('rejects real-user accounts before any writes', async () => {
    const { service, prisma, memory } = create();
    prisma.user.findMany.mockResolvedValue([
      { id: 'a', email: 'real@example.com' },
      { id: 'b', email: 'real2@example.com' },
    ]);
    await expect(service.run('admin', 'a', 'b')).rejects.toThrow(
      'synthetic_users_required',
    );
    expect(memory.createMemory).not.toHaveBeenCalled();
    expect(prisma.memory.deleteMany).not.toHaveBeenCalled();
  });
  it('checks storage, semantic recall, both isolation paths and scoped cleanup', async () => {
    const { service, prisma } = create();
    const result = await service.run('admin', 'a', 'b');
    expect(Object.values(result).every((value) => value === true)).toBe(true);
    expect(prisma.memory.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: { in: ['a', 'b'] },
        category: expect.stringMatching(/^embedding-acceptance-/),
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'admin' }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('synthetic');
  });
  it('does not mistake FTS storage for vector success', async () => {
    const { service, prisma } = create();
    prisma.$queryRaw.mockReset().mockResolvedValue([{ valid: false }]);
    expect((await service.run('admin', 'a', 'b')).pass).toBe(false);
  });
  it('detects foreign memory leakage', async () => {
    const { service, memory } = create();
    memory.searchMemories
      .mockReset()
      .mockResolvedValue([{ id: 'b1', userId: 'b' }]);
    expect((await service.run('admin', 'a', 'b')).userIsolation).toBe(false);
  });
  it('cleans partial writes and returns only bounded evidence after failure', async () => {
    const { service, memory, prisma } = create();
    memory.createMemory
      .mockReset()
      .mockRejectedValue(new Error('PRIVATE_BODY'));
    const result = await service.run('admin', 'a', 'b');
    expect(result.pass).toBe(false);
    expect(result.fixtureCleanup).toBe(true);
    expect(prisma.memory.deleteMany).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_BODY');
  });
  it('fails closed when cleanup fails or leaves rows', async () => {
    const { service, prisma } = create();
    prisma.memory.count.mockResolvedValue(1);
    const result = await service.run('admin', 'a', 'b');
    expect(result.fixtureCleanup).toBe(false);
    expect(result.pass).toBe(false);
  });
});
