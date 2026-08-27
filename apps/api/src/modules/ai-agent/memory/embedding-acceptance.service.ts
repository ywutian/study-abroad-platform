import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { EmbeddingService } from './embedding.service';
import { PersistentMemoryService } from './persistent-memory.service';
import { isEmbeddingVector } from './embedding-contract';

@Injectable()
export class EmbeddingAcceptanceService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly embedding: EmbeddingService,
    private readonly memory: PersistentMemoryService,
  ) {}

  async run(adminId: string, targetUserId: string, isolationUserId: string) {
    if (
      this.config.get('AI_AGENT_HARNESS_V1') !== 'true' ||
      this.config.get('AI_AGENT_ACCEPTANCE_V1') !== 'true'
    ) {
      throw new ForbiddenException('embedding_acceptance_disabled');
    }
    if (targetUserId === isolationUserId)
      throw new BadRequestException('distinct_synthetic_users_required');
    const users = await this.prisma.user.findMany({
      where: { id: { in: [targetUserId, isolationUserId] }, deletedAt: null },
      select: { id: true, email: true },
    });
    if (
      users.length !== 2 ||
      users.some(
        (user) => !/^agent-harness-\d{14}@example\.invalid$/.test(user.email),
      )
    ) {
      throw new BadRequestException('synthetic_users_required');
    }
    const category = `embedding-acceptance-${randomUUID()}`;
    const scope = { userId: { in: [targetUserId, isolationUserId] }, category };
    const result = {
      singleVector: false,
      batchVectors: false,
      cacheConsistent: false,
      vectorStored: false,
      semanticRecall: false,
      semanticOrdering: false,
      userIsolation: false,
      fallbackStored: false,
      fallbackRecall: false,
      fixtureCleanup: false,
      pass: false,
    };
    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'AI_EMBEDDING_ACCEPTANCE',
        resource: 'ai-agent-harness',
        metadata: { scenario: 'embedding_memory' },
      },
    });
    try {
      const content = `Synthetic fixture ${category}. My academic goal is studying computer science at a university in Canada.`;
      const unrelated = `Synthetic fixture ${category}. I enjoy baking chocolate cakes and sourdough bread.`;
      const single = await this.embedding.embed(content);
      result.singleVector = isEmbeddingVector(single);
      const batch = await this.embedding.embedBatch([
        unrelated,
        `Synthetic fixture ${category}. The weather forecast predicts rain.`,
      ]);
      result.batchVectors =
        batch.length === 2 && batch.every(isEmbeddingVector);
      if (!result.singleVector || !result.batchVectors) {
        throw new ServiceUnavailableException(
          'embedding_probe_contract_failed',
        );
      }
      const cached = await this.embedding.embed(content);
      result.cacheConsistent =
        result.singleVector &&
        single.length === cached.length &&
        single.every((n, i) => n === cached[i]);
      const expiresAt = new Date(Date.now() + 10 * 60_000);
      const first = await this.memory.createMemory(targetUserId, {
        type: MemoryType.FACT,
        content,
        category,
        expiresAt,
      });
      await this.memory.createMemory(targetUserId, {
        type: MemoryType.FACT,
        content: unrelated,
        category,
        expiresAt,
      });
      const other = await this.memory.createMemory(isolationUserId, {
        type: MemoryType.FACT,
        content,
        category,
        expiresAt,
      });
      const stored = await this.prisma.$queryRaw<
        Array<{ valid: boolean }>
      >(Prisma.sql`
        SELECT (embedding IS NOT NULL AND vector_dims(embedding) = 1536) AS valid
        FROM "Memory" WHERE id = ${first.id} AND "userId" = ${targetUserId}
      `);
      result.vectorStored = stored.length === 1 && stored[0].valid === true;
      const query =
        'Which country and computing subject do I want to pursue for higher education?';
      const queryVector = await this.embedding.embed(query);
      result.semanticOrdering =
        isEmbeddingVector(queryVector) &&
        result.singleVector &&
        result.batchVectors &&
        this.embedding.cosineSimilarity(queryVector, single) >
          this.embedding.cosineSimilarity(queryVector, batch[0]);
      const recalled = await this.memory.searchMemories(targetUserId, query, {
        limit: 20,
        minSimilarity: 0,
      });
      result.semanticRecall =
        result.vectorStored &&
        result.semanticOrdering &&
        recalled[0]?.id === first.id;
      const isolated = await this.memory.searchMemories(
        isolationUserId,
        query,
        { limit: 20, minSimilarity: 0 },
      );
      result.userIsolation =
        recalled.length > 0 &&
        isolated.some((row) => row.id === other.id) &&
        recalled.every((row) => row.userId === targetUserId) &&
        isolated.every((row) => row.userId === isolationUserId);

      // Request-local missing-key adapter exercises the existing failure path;
      // never mutate the singleton provider, environment, or real-user data.
      const unavailable = new EmbeddingService(
        this.redis,
        new ConfigService({ OPENAI_API_KEY: '' }),
      );
      const fallbackMemory = new PersistentMemoryService(
        this.prisma,
        unavailable,
      );
      const fallbackWord = `syntheticfallback${randomUUID().replace(/-/g, '')}`;
      const fallback = await fallbackMemory.createMemory(targetUserId, {
        type: MemoryType.FACT,
        content: fallbackWord,
        category,
        expiresAt,
      });
      const withoutVector = await this.prisma.$queryRaw<
        Array<{ absent: boolean }>
      >(Prisma.sql`
        SELECT (embedding IS NULL) AS absent FROM "Memory" WHERE id = ${fallback.id} AND "userId" = ${targetUserId}
      `);
      result.fallbackStored =
        withoutVector.length === 1 && withoutVector[0].absent === true;
      const fallbackRows = await fallbackMemory.searchMemories(
        targetUserId,
        fallbackWord,
      );
      const foreignRows = await fallbackMemory.searchMemories(
        isolationUserId,
        fallbackWord,
      );
      result.fallbackRecall =
        fallbackRows.some((row) => row.id === fallback.id) &&
        foreignRows.length === 0;
    } catch {
      // Boolean evidence only: no upstream exception, content, IDs or vectors.
    } finally {
      try {
        await this.prisma.memory.deleteMany({ where: scope });
        result.fixtureCleanup =
          (await this.prisma.memory.count({ where: scope })) === 0;
      } catch {
        result.fixtureCleanup = false;
      }
    }
    result.pass = Object.entries(result).every(
      ([key, value]) => key === 'pass' || value === true,
    );
    return result;
  }
}
