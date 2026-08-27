import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MemoryType } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/common/redis/redis.service';
import { EmbeddingService } from '../src/modules/ai-agent/memory/embedding.service';
import { EmbeddingAcceptanceService } from '../src/modules/ai-agent/memory/embedding-acceptance.service';
import { PersistentMemoryService } from '../src/modules/ai-agent/memory/persistent-memory.service';

/** Real pgvector/FTS integration; external model traffic is stubbed in CI. */
describe('Embedding memory persistence (e2e)', () => {
  const prisma = new PrismaService();
  const userIds: string[] = [];
  let service: EmbeddingAcceptanceService;
  let memory: PersistentMemoryService;
  let fetchMock: jest.SpyInstance;
  beforeAll(async () => {
    await prisma.$connect();
    for (const offset of [0, 1000]) {
      const stamp = new Date(Date.now() + offset)
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14);
      const user = await prisma.user.create({
        data: {
          email: `agent-harness-${stamp}@example.invalid`,
          passwordHash: 'synthetic-not-a-login-hash',
        },
      });
      userIds.push(user.id);
    }
    const config = new ConfigService({
      OPENAI_API_KEY: 'synthetic-fixture-only',
      OPENAI_BASE_URL: 'https://embedding.synthetic.invalid/v1',
      EMBEDDING_MODEL: 'text-embedding-3-small',
      AI_AGENT_HARNESS_V1: 'true',
      AI_AGENT_ACCEPTANCE_V1: 'true',
    });
    const entries = new Map<string, string>();
    const redisFixture = {
      get: async (key: string) => entries.get(key) ?? null,
      withClient: async (
        _mode: string,
        _key: string,
        callback: (client: {
          set: (key: string, value: string) => Promise<void>;
        }) => unknown,
      ) =>
        callback({
          set: async (key, value) => {
            entries.set(key, value);
          },
        }),
    };
    const module = await Test.createTestingModule({
      providers: [{ provide: RedisService, useValue: redisFixture }],
    }).compile();
    const redis = module.get(RedisService);
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async (_url, init) => {
        if (typeof init?.body !== 'string')
          throw new Error('fixture_body_missing');
        const body = JSON.parse(init.body) as {
          model: string;
          input: string[];
        };
        return new Response(
          JSON.stringify({
            model: body.model,
            data: body.input.map((text, index) => ({
              index,
              embedding: Array.from({ length: 1536 }, (_, i) =>
                i === 0 ? (/baking|weather/.test(text) ? -1 : 1) : 0,
              ),
            })),
          }),
        );
      });
    const embedding = new EmbeddingService(redis, config);
    memory = new PersistentMemoryService(prisma, embedding);
    service = new EmbeddingAcceptanceService(
      config,
      prisma,
      redis,
      embedding,
      memory,
    );
  }, 30000);

  it('clears a stale vector atomically when updated content cannot be embedded', async () => {
    const created = await memory.createMemory(userIds[0], {
      type: MemoryType.FACT,
      content: 'Synthetic original academic goal',
    });
    const unavailable = new EmbeddingService(
      {} as RedisService,
      new ConfigService({ OPENAI_API_KEY: '' }),
    );
    const fallback = new PersistentMemoryService(prisma, unavailable);
    await expect(
      fallback.updateMemory(
        created.id,
        { content: 'Synthetic replacement' },
        userIds[1],
      ),
    ).rejects.toThrow();
    await fallback.updateMemory(
      created.id,
      { content: 'Synthetic replacement' },
      userIds[0],
    );
    const stored = await prisma.$queryRaw<
      Array<{ absent: boolean; content: string }>
    >`
      SELECT embedding IS NULL AS absent, content FROM "Memory" WHERE id = ${created.id}
    `;
    expect(stored).toEqual([
      { absent: true, content: 'Synthetic replacement' },
    ]);
    await prisma.memory.deleteMany({
      where: { id: created.id, userId: userIds[0] },
    });
  });
  afterAll(async () => {
    fetchMock?.mockRestore();
    if (userIds.length) {
      await prisma.memory.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.auditLog.deleteMany({
        where: { userId: { in: userIds }, action: 'AI_EMBEDDING_ACCEPTANCE' },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });
  it('stores pgvector, recalls across wording, isolates tenants, falls back to FTS and cleans every fixture', async () => {
    const result = await service.run(userIds[0], userIds[0], userIds[1]);
    expect(result).toEqual({
      singleVector: true,
      batchVectors: true,
      cacheConsistent: true,
      vectorStored: true,
      semanticRecall: true,
      semanticOrdering: true,
      userIsolation: true,
      fallbackStored: true,
      fallbackRecall: true,
      fixtureCleanup: true,
      pass: true,
    });
    expect(
      await prisma.memory.count({ where: { userId: { in: userIds } } }),
    ).toBe(0);
  }, 30000);
});
