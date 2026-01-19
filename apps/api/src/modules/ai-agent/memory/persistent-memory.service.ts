/**
 * 持久化记忆服务 - 长期记忆存储（PostgreSQL + pgvector）
 *
 * 使用 pgvector 进行高效向量相似度搜索
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { MemoryType, EntityType, Prisma } from '@prisma/client';
import {
  MemoryInput,
  MemoryRecord,
  MemoryQuery,
  EntityInput,
  EntityRecord,
  ConversationRecord,
  MessageInput,
  MessageRecord,
  UserPreferences,
  MemoryStats,
  MemoryMetadata,
  EntityAttributes,
  EntityRelation,
} from './types';
import {
  RawMemoryRow,
  RawEntityRow,
  RawMessageRow,
  MemoryWhereInput,
} from './prisma-types';
import { EmbeddingService } from './embedding.service';

// pgvector 列无法被 Prisma $queryRaw 反序列化，因此在 RETURNING / SELECT 中排除 embedding 列
const MEMORY_COLUMNS = `
  id, "userId", type, category, content, importance,
  "accessCount", "lastAccessedAt", metadata, "expiresAt", "createdAt", "updatedAt"
`;

const ENTITY_COLUMNS = `
  id, "userId", type, name, description, attributes, relations, "createdAt", "updatedAt"
`;

@Injectable()
export class PersistentMemoryService {
  private readonly logger = new Logger(PersistentMemoryService.name);

  constructor(
    private prisma: PrismaService,
    private embedding: EmbeddingService,
  ) {}

  // ==================== 记忆管理 ====================

  /**
   * 创建记忆（使用 pgvector）
   */
  async createMemory(
    userId: string,
    input: MemoryInput,
  ): Promise<MemoryRecord> {
    // 生成向量嵌入
    const embeddingVector = await this.embedding.embed(input.content);

    // 使用原生 SQL 插入向量（RETURNING 中排除 embedding 避免 vector 反序列化错误）
    if (embeddingVector.length > 0) {
      const result = await this.prisma.$queryRaw<RawMemoryRow[]>(
        Prisma.sql`
        INSERT INTO "Memory" (
          id, "userId", type, category, content, importance, 
          embedding, metadata, "expiresAt", "createdAt", "updatedAt"
        ) VALUES (
          ${this.generateId()},
          ${userId},
          ${input.type}::"MemoryType",
          ${input.category},
          ${input.content},
          ${input.importance ?? 0.5},
          ${embeddingVector}::vector,
          ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
          ${input.expiresAt},
          NOW(),
          NOW()
        )
        RETURNING ${Prisma.raw(MEMORY_COLUMNS)}
      `,
      );
      return this.toMemoryRecord(result[0]);
    }

    // 无向量时使用 Prisma
    const memory = await this.prisma.memory.create({
      data: {
        userId,
        type: input.type,
        category: input.category,
        content: input.content,
        importance: input.importance ?? 0.5,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        expiresAt: input.expiresAt,
      },
    });

    return this.toMemoryRecord(memory as unknown as RawMemoryRow);
  }

  private generateId(): string {
    return `mem_${randomUUID()}`;
  }

  /**
   * 批量创建记忆（使用 pgvector）
   */
  async createMemories(
    userId: string,
    inputs: MemoryInput[],
  ): Promise<MemoryRecord[]> {
    if (inputs.length === 0) return [];

    // 批量生成向量
    const embeddings = await this.embedding.embedBatch(
      inputs.map((i) => i.content),
    );

    const results: MemoryRecord[] = [];

    // 逐个插入（带向量的需要原生 SQL）
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const embedding = embeddings[i];

      if (embedding && embedding.length > 0) {
        const result = await this.prisma.$queryRaw<RawMemoryRow[]>(
          Prisma.sql`
          INSERT INTO "Memory" (
            id, "userId", type, category, content, importance,
            embedding, metadata, "expiresAt", "createdAt", "updatedAt"
          ) VALUES (
            ${this.generateId()},
            ${userId},
            ${input.type}::"MemoryType",
            ${input.category},
            ${input.content},
            ${input.importance ?? 0.5},
            ${embedding}::vector,
            ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
            ${input.expiresAt},
            NOW(),
            NOW()
          )
          RETURNING ${Prisma.raw(MEMORY_COLUMNS)}
        `,
        );
        results.push(this.toMemoryRecord(result[0]));
      } else {
        const memory = await this.prisma.memory.create({
          data: {
            userId,
            type: input.type,
            category: input.category,
            content: input.content,
            importance: input.importance ?? 0.5,
            metadata: input.metadata as Prisma.InputJsonValue | undefined,
            expiresAt: input.expiresAt,
          },
        });
        results.push(this.toMemoryRecord(memory as unknown as RawMemoryRow));
      }
    }

    return results;
  }

  /**
   * 检索记忆
   */
  async queryMemories(
    userId: string,
    query: MemoryQuery,
  ): Promise<MemoryRecord[]> {
    const where: Prisma.MemoryWhereInput = {
      userId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    if (query.types?.length) {
      where.type = { in: query.types };
    }

    if (query.categories?.length) {
      where.category = { in: query.categories };
    }

    if (query.minImportance !== undefined) {
      where.importance = { gte: query.minImportance };
    }

    if (query.timeRange?.start) {
      where.createdAt = {
        ...((where.createdAt as Record<string, unknown>) ?? {}),
        gte: query.timeRange.start,
      };
    }

    if (query.timeRange?.end) {
      where.createdAt = {
        ...((where.createdAt as Record<string, unknown>) ?? {}),
        lte: query.timeRange.end,
      };
    }

    const memories = await this.prisma.memory.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: query.limit ?? 20,
    });

    return memories.map((m) =>
      this.toMemoryRecord(m as unknown as RawMemoryRow),
    );
  }

  /**
   * 语义检索记忆（使用 pgvector 原生向量搜索）
   *
   * 性能：O(log n) vs 之前的 O(n)
   */
  async searchMemories(
    userId: string,
    queryText: string,
    options: { limit?: number; minSimilarity?: number } = {},
  ): Promise<Array<MemoryRecord & { similarity: number }>> {
    const { limit = 10, minSimilarity = 0.5 } = options;

    // 生成查询向量
    const queryEmbedding = await this.embedding.embed(queryText);

    if (queryEmbedding.length === 0) {
      // 回退到关键词搜索
      const memories = await this.prisma.memory.findMany({
        where: {
          userId,
          content: { contains: queryText, mode: 'insensitive' },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { importance: 'desc' },
        take: limit,
      });
      return memories.map((m) => ({
        ...this.toMemoryRecord(m as unknown as RawMemoryRow),
        similarity: 0.5,
      }));
    }

    // 使用 pgvector 原生向量搜索（排除 embedding 列避免反序列化错误）
    // 1 - (a <=> b) 将距离转换为相似度（余弦距离 → 余弦相似度）
    const results = await this.prisma.$queryRaw<RawMemoryRow[]>(
      Prisma.sql`
      SELECT 
        m.id, m."userId", m.type, m.category, m.content, m.importance,
        m."accessCount", m."lastAccessedAt", m.metadata, m."expiresAt",
        m."createdAt", m."updatedAt",
        1 - (m.embedding <=> ${queryEmbedding}::vector) AS similarity
      FROM "Memory" m
      WHERE 
        m."userId" = ${userId}
        AND m.embedding IS NOT NULL
        AND (m."expiresAt" IS NULL OR m."expiresAt" > NOW())
        AND 1 - (m.embedding <=> ${queryEmbedding}::vector) >= ${minSimilarity}
      ORDER BY m.embedding <=> ${queryEmbedding}::vector
      LIMIT ${limit}
    `,
    );

    return results.map((r) => ({
      ...this.toMemoryRecord(r),
      similarity: Number(r.similarity),
    }));
  }

  /**
   * 更新记忆
   */
  async updateMemory(
    memoryId: string,
    data: {
      content?: string;
      importance?: number;
      metadata?: Record<string, any>;
      category?: string;
    },
  ): Promise<MemoryRecord> {
    // 如果内容更新，需要重新生成向量
    if (data.content) {
      const embeddingVector = await this.embedding.embed(data.content);

      if (embeddingVector.length > 0) {
        const result = await this.prisma.$queryRaw<RawMemoryRow[]>(
          Prisma.sql`
          UPDATE "Memory" SET
            content = ${data.content},
            importance = COALESCE(${data.importance}, importance),
            metadata = COALESCE(${data.metadata ? JSON.stringify(data.metadata) : null}::jsonb, metadata),
            category = COALESCE(${data.category}, category),
            embedding = ${embeddingVector}::vector,
            "updatedAt" = NOW()
          WHERE id = ${memoryId}
          RETURNING ${Prisma.raw(MEMORY_COLUMNS)}
        `,
        );
        return this.toMemoryRecord(result[0]);
      }
    }

    const updated = await this.prisma.memory.update({
      where: { id: memoryId },
      data: {
        ...(data.content ? { content: data.content } : {}),
        ...(data.importance !== undefined
          ? { importance: Math.max(0, Math.min(1, data.importance)) }
          : {}),
        ...(data.metadata
          ? { metadata: data.metadata as Prisma.InputJsonValue }
          : {}),
        ...(data.category ? { category: data.category } : {}),
      },
    });

    return this.toMemoryRecord(updated as unknown as RawMemoryRow);
  }

  /**
   * 更新记忆重要性
   */
  async updateImportance(memoryId: string, importance: number): Promise<void> {
    await this.prisma.memory.update({
      where: { id: memoryId },
      data: { importance: Math.max(0, Math.min(1, importance)) },
    });
  }

  /**
   * 记录记忆访问
   */
  async recordAccess(memoryId: string): Promise<void> {
    await this.prisma.memory.update({
      where: { id: memoryId },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    });
  }

  /**
   * 删除记忆
   */
  async deleteMemory(memoryId: string): Promise<void> {
    await this.prisma.memory.delete({ where: { id: memoryId } });
  }

  /**
   * 清理过期记忆
   */
  async cleanupExpiredMemories(): Promise<number> {
    const result = await this.prisma.memory.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  // ==================== 对话管理 ====================

  /**
   * 创建对话
   */
  async createConversation(
    userId: string,
    title?: string,
  ): Promise<ConversationRecord> {
    const conversation = await this.prisma.agentConversation.create({
      data: { userId, title },
    });

    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title || undefined,
      summary: conversation.summary || undefined,
      agentType: conversation.agentType || undefined,
      messageCount: 0,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * 获取对话
   */
  async getConversation(
    conversationId: string,
  ): Promise<ConversationRecord | null> {
    const conversation = await this.prisma.agentConversation.findUnique({
      where: { id: conversationId },
      include: { messages: { select: { id: true } } },
    });

    if (!conversation) return null;

    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title || undefined,
      summary: conversation.summary || undefined,
      agentType: conversation.agentType || undefined,
      messageCount: conversation.messages.length,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * 获取用户最近对话
   */
  async getRecentConversations(
    userId: string,
    limit: number = 10,
  ): Promise<ConversationRecord[]> {
    const conversations = await this.prisma.agentConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { messages: { select: { id: true } } },
    });

    return conversations.map((c) => ({
      id: c.id,
      userId: c.userId,
      title: c.title || undefined,
      summary: c.summary || undefined,
      agentType: c.agentType || undefined,
      messageCount: c.messages.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  /**
   * 更新对话
   */
  async updateConversation(
    conversationId: string,
    data: { title?: string; summary?: string; agentType?: string },
  ): Promise<void> {
    await this.prisma.agentConversation.update({
      where: { id: conversationId },
      data,
    });
  }

  /**
   * 归档对话
   */
  async archiveConversation(conversationId: string): Promise<void> {
    // Note: AgentConversation model lacks isArchived/archivedAt columns;
    // storing archive state in the metadata JSON field as a workaround.
    await this.prisma.agentConversation.update({
      where: { id: conversationId },
      data: {
        metadata: {
          archived: true,
          archivedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  // ==================== 消息管理 ====================

  /**
   * 添加消息
   */
  async addMessage(
    conversationId: string,
    input: MessageInput,
  ): Promise<MessageRecord> {
    const message = await this.prisma.agentMessage.create({
      data: {
        conversationId,
        role: input.role,
        content: input.content,
        agentType: input.agentType,
        toolCalls: input.toolCalls as any,
        tokensUsed: input.tokensUsed,
        latencyMs: input.latencyMs,
      },
    });

    return this.toMessageRecord(message);
  }

  /**
   * 获取对话消息
   */
  async getMessages(
    conversationId: string,
    options: { limit?: number; before?: Date } = {},
  ): Promise<MessageRecord[]> {
    const { limit = 50, before } = options;

    const messages = await this.prisma.agentMessage.findMany({
      where: {
        conversationId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages.map((m) => this.toMessageRecord(m));
  }

  // ==================== 实体管理 ====================

  /**
   * 创建或更新实体
   *
   * 注意: Entity 表没有 embedding 列（与 Memory 不同），
   * 因此始终使用 Prisma ORM 而非 raw SQL。
   * 向量嵌入仅生成但不存储，未来可扩展 Entity 表添加 embedding 列。
   */
  async upsertEntity(
    userId: string,
    input: EntityInput,
  ): Promise<EntityRecord> {
    // 使用 Prisma ORM upsert（Entity 表无 embedding 列）
    const entity = await this.prisma.entity.upsert({
      where: {
        userId_type_name: {
          userId,
          type: input.type,
          name: input.name,
        },
      },
      update: {
        description: input.description,
        attributes: input.attributes as unknown as
          | Prisma.InputJsonValue
          | undefined,
        relations: input.relations as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
      create: {
        userId,
        type: input.type,
        name: input.name,
        description: input.description,
        attributes: input.attributes as unknown as
          | Prisma.InputJsonValue
          | undefined,
        relations: input.relations as unknown as
          | Prisma.InputJsonValue
          | undefined,
      },
    });

    return this.toEntityRecord(entity as unknown as RawEntityRow);
  }

  /**
   * 获取用户实体
   */
  async getEntities(
    userId: string,
    options: { types?: EntityType[]; limit?: number } = {},
  ): Promise<EntityRecord[]> {
    const { types, limit = 50 } = options;

    const entities = await this.prisma.entity.findMany({
      where: {
        userId,
        ...(types?.length ? { type: { in: types } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return entities.map((e) =>
      this.toEntityRecord(e as unknown as RawEntityRow),
    );
  }

  /**
   * 搜索实体
   *
   * 注意: Entity 表没有 embedding 列，使用关键词匹配（name + description）
   */
  async searchEntities(
    userId: string,
    query: string,
    options: { types?: EntityType[]; limit?: number } = {},
  ): Promise<Array<EntityRecord & { similarity: number }>> {
    const { types, limit = 10 } = options;

    // Entity 表无 embedding 列，使用名称和描述关键词匹配
    const entities = await this.prisma.entity.findMany({
      where: {
        userId,
        ...(types?.length ? { type: { in: types } } : {}),
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return entities.map((e) => ({
      ...this.toEntityRecord(e as unknown as RawEntityRow),
      similarity: 0.5, // 关键词匹配固定相似度
    }));
  }

  // ==================== 用户偏好 ====================

  /**
   * 获取用户偏好
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    const prefs = await this.prisma.userAIPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      return this.getDefaultPreferences();
    }

    return {
      communicationStyle: prefs.communicationStyle as any,
      responseLength: prefs.responseLength as any,
      language: prefs.language,
      schoolPreferences: prefs.schoolPreferences as any,
      essayPreferences: prefs.essayPreferences as any,
      enableMemory: prefs.enableMemory,
      enableSuggestions: prefs.enableSuggestions,
    };
  }

  /**
   * 更新用户偏好
   */
  async updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const prefs = await this.prisma.userAIPreference.upsert({
      where: { userId },
      create: {
        userId,
        communicationStyle: updates.communicationStyle || 'friendly',
        responseLength: updates.responseLength || 'moderate',
        language: updates.language || 'zh-CN',
        schoolPreferences: updates.schoolPreferences as
          | Prisma.InputJsonValue
          | undefined,
        essayPreferences: updates.essayPreferences as
          | Prisma.InputJsonValue
          | undefined,
        enableMemory: updates.enableMemory ?? true,
        enableSuggestions: updates.enableSuggestions ?? true,
      },
      update: {
        ...(updates.communicationStyle
          ? { communicationStyle: updates.communicationStyle }
          : {}),
        ...(updates.responseLength
          ? { responseLength: updates.responseLength }
          : {}),
        ...(updates.language ? { language: updates.language } : {}),
        ...(updates.schoolPreferences
          ? {
              schoolPreferences:
                updates.schoolPreferences as Prisma.InputJsonValue,
            }
          : {}),
        ...(updates.essayPreferences
          ? {
              essayPreferences:
                updates.essayPreferences as Prisma.InputJsonValue,
            }
          : {}),
        ...(updates.enableMemory !== undefined
          ? { enableMemory: updates.enableMemory }
          : {}),
        ...(updates.enableSuggestions !== undefined
          ? { enableSuggestions: updates.enableSuggestions }
          : {}),
      },
    });

    return {
      communicationStyle: prefs.communicationStyle as any,
      responseLength: prefs.responseLength as any,
      language: prefs.language,
      schoolPreferences: prefs.schoolPreferences as any,
      essayPreferences: prefs.essayPreferences as any,
      enableMemory: prefs.enableMemory,
      enableSuggestions: prefs.enableSuggestions,
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      communicationStyle: 'friendly',
      responseLength: 'moderate',
      language: 'zh-CN',
      enableMemory: true,
      enableSuggestions: true,
    };
  }

  // ==================== 统计 ====================

  /**
   * 获取记忆统计
   */
  async getStats(userId: string): Promise<MemoryStats> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalMemories,
      totalConversations,
      totalMessages,
      totalEntities,
      memoryByType,
      recentConversations,
      recentMessages,
    ] = await Promise.all([
      this.prisma.memory.count({ where: { userId } }),
      this.prisma.agentConversation.count({ where: { userId } }),
      this.prisma.agentMessage.count({
        where: { conversation: { userId } },
      }),
      this.prisma.entity.count({ where: { userId } }),
      this.prisma.memory.groupBy({
        by: ['type'],
        where: { userId },
        _count: true,
      }),
      this.prisma.agentConversation.count({
        where: { userId, createdAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.agentMessage.count({
        where: {
          conversation: { userId },
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    return {
      totalMemories,
      totalConversations,
      totalMessages,
      totalEntities,
      memoryByType: Object.fromEntries(
        memoryByType.map((m) => [m.type, m._count]),
      ),
      recentActivity: {
        conversationsLast7Days: recentConversations,
        messagesLast7Days: recentMessages,
      },
    };
  }

  // ==================== 辅助方法 ====================

  private toMemoryRecord(m: RawMemoryRow): MemoryRecord {
    return {
      id: m.id,
      userId: m.userId,
      type: m.type,
      category: m.category || undefined,
      content: m.content,
      importance: m.importance,
      accessCount: m.accessCount,
      lastAccessedAt: m.lastAccessedAt || undefined,
      embedding: m.embedding || undefined,
      metadata: m.metadata || undefined,
      createdAt: m.createdAt,
    };
  }

  private toMessageRecord(m: RawMessageRow): MessageRecord {
    return {
      id: m.id,
      conversationId: m.conversationId,
      role: m.role,
      content: m.content,
      agentType: m.agentType || undefined,
      toolCalls: m.toolCalls as MessageRecord['toolCalls'],
      tokensUsed: m.tokensUsed || undefined,
      latencyMs: m.latencyMs || undefined,
      createdAt: m.createdAt,
    };
  }

  private toEntityRecord(e: RawEntityRow): EntityRecord {
    return {
      id: e.id,
      userId: e.userId,
      type: e.type,
      name: e.name,
      description: e.description || undefined,
      attributes: e.attributes || undefined,
      relations: e.relations || undefined,
      createdAt: e.createdAt,
    };
  }
}
