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

/**
 * Persistent memory service for long-term storage of memories, conversations,
 * messages, and entities using PostgreSQL with pgvector for efficient vector
 * similarity search.
 *
 * All memory records include embedding vectors generated via the EmbeddingService.
 * Raw SQL is used for vector operations since Prisma does not natively support
 * the pgvector `vector` column type.
 */
@Injectable()
export class PersistentMemoryService {
  private readonly logger = new Logger(PersistentMemoryService.name);

  constructor(
    private prisma: PrismaService,
    private embedding: EmbeddingService,
  ) {}

  // ==================== 记忆管理 ====================

  /**
   * Create a single memory record with an embedding vector in PostgreSQL.
   *
   * Generates an embedding for the content text via the OpenAI API. If embedding
   * generation fails or is unavailable, the memory is stored without a vector
   * (falling back to Prisma ORM).
   *
   * @param userId - The user who owns the memory
   * @param input - Memory content, type, category, importance, and optional metadata/expiry
   * @returns The created memory record (without the raw embedding vector)
   */
  // 创建记忆（使用 pgvector）
  async createMemory(
    userId: string,
    input: MemoryInput,
  ): Promise<MemoryRecord> {
    const embeddingVector = await this.embedding.embed(input.content);

    if (embeddingVector.length > 0) {
      const row = await this.insertMemoryRaw(userId, input, embeddingVector);
      return this.toMemoryRecord(row);
    }

    this.logger.warn(
      `createMemory: embedding unavailable, storing without vector`,
    );
    // 无向量时使用 Prisma ORM
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

  /**
   * Generate a unique memory ID with a `mem_` prefix and UUID.
   *
   * @returns A unique string ID in the format `mem_{uuid}`
   */
  private generateId(): string {
    return `mem_${randomUUID()}`;
  }

  /**
   * Insert a memory record using raw SQL with a pgvector embedding column.
   *
   * The RETURNING clause intentionally excludes the `embedding` column to avoid
   * Prisma's vector deserialization errors.
   *
   * @param userId - The user who owns the memory
   * @param input - Memory content and metadata
   * @param embedding - The embedding vector (typically 1536 dimensions for text-embedding-3-small)
   * @returns The inserted row (without the embedding column)
   */
  // 原生 SQL 插入记忆（带 pgvector embedding）
  // RETURNING 中排除 embedding 列以避免反序列化错误
  private async insertMemoryRaw(
    userId: string,
    input: MemoryInput,
    embedding: number[],
  ): Promise<RawMemoryRow> {
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
    return result[0];
  }

  /**
   * Update a memory record using raw SQL, including re-generating the pgvector embedding.
   *
   * Uses COALESCE to preserve existing values for optional fields not provided in the update.
   *
   * @param memoryId - The ID of the memory to update
   * @param data - Fields to update (content is required; importance, metadata, category are optional)
   * @param embedding - The new embedding vector for the updated content
   * @returns The updated row (without the embedding column)
   */
  // 原生 SQL 更新记忆（带 pgvector embedding）
  private async updateMemoryRaw(
    memoryId: string,
    data: {
      content: string;
      importance?: number;
      metadata?: Record<string, any>;
      category?: string;
    },
    embedding: number[],
  ): Promise<RawMemoryRow> {
    const result = await this.prisma.$queryRaw<RawMemoryRow[]>(
      Prisma.sql`
      UPDATE "Memory" SET
        content = ${data.content},
        importance = COALESCE(${data.importance}, importance),
        metadata = COALESCE(${data.metadata ? JSON.stringify(data.metadata) : null}::jsonb, metadata),
        category = COALESCE(${data.category}, category),
        embedding = ${embedding}::vector,
        "updatedAt" = NOW()
      WHERE id = ${memoryId}
      RETURNING ${Prisma.raw(MEMORY_COLUMNS)}
    `,
    );
    return result[0];
  }

  /**
   * Create multiple memory records in sequence, generating embedding vectors in batch.
   *
   * Embedding generation is batched for efficiency, but individual insertions
   * are performed sequentially to handle per-record fallback logic.
   *
   * @param userId - The user who owns the memories
   * @param inputs - An array of memory inputs to create
   * @returns An array of created memory records (order matches inputs)
   */
  // 批量创建记忆（使用 pgvector）
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

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const embedding = embeddings[i];

      if (embedding && embedding.length > 0) {
        const row = await this.insertMemoryRaw(userId, input, embedding);
        results.push(this.toMemoryRecord(row));
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
   * Query memories using attribute-based filtering (type, category, importance, time range).
   *
   * Results are ordered by importance (desc) then creation date (desc).
   * Expired memories (past their expiresAt) are automatically excluded.
   *
   * @param userId - The user whose memories to query
   * @param query - Filter criteria including types, categories, minImportance, timeRange, and limit
   * @returns An array of matching memory records
   */
  // 检索记忆
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
   * Perform semantic similarity search on memories using pgvector's native
   * cosine distance operator (`<=>`).
   *
   * Generates an embedding vector for the query text, then finds the most
   * similar memories using an indexed vector search (O(log n) with IVFFlat/HNSW).
   * Falls back to case-insensitive keyword search if embedding generation fails.
   *
   * Similarity is computed as `1 - cosine_distance`, where 1.0 = identical vectors.
   *
   * @param userId - The user whose memories to search
   * @param queryText - Natural language query to find semantically similar memories
   * @param options - Search configuration
   * @param options.limit - Maximum number of results (default: 10)
   * @param options.minSimilarity - Minimum cosine similarity threshold in [0, 1] (default: 0.5)
   * @returns Matching memories with their similarity scores, ordered by similarity desc
   */
  // 语义检索记忆（使用 pgvector 原生向量搜索）
  // 性能：O(log n) vs 之前的 O(n)
  async searchMemories(
    userId: string,
    queryText: string,
    options: { limit?: number; minSimilarity?: number } = {},
  ): Promise<Array<MemoryRecord & { similarity: number }>> {
    const { limit = 10, minSimilarity = 0.5 } = options;

    // 生成查询向量
    const queryEmbedding = await this.embedding.embed(queryText);

    if (queryEmbedding.length === 0) {
      this.logger.warn(
        `searchMemories: embedding unavailable, falling back to keyword search`,
      );
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
   * Update a memory record. If the content is changed, a new embedding vector
   * is automatically generated and stored alongside the updated content.
   *
   * Importance values are clamped to [0, 1].
   *
   * @param memoryId - The ID of the memory to update
   * @param data - Fields to update; all are optional but at least one should be provided
   * @returns The updated memory record
   */
  // 更新记忆
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
        const row = await this.updateMemoryRaw(
          memoryId,
          { ...data, content: data.content },
          embeddingVector,
        );
        return this.toMemoryRecord(row);
      }
    }

    this.logger.warn(
      `updateMemory: embedding unavailable, updating without vector`,
    );
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
   * Update only the importance score of a memory, clamping to [0, 1].
   *
   * @param memoryId - The ID of the memory to update
   * @param importance - The new importance value (will be clamped to [0, 1])
   */
  // 更新记忆重要性
  async updateImportance(memoryId: string, importance: number): Promise<void> {
    await this.prisma.memory.update({
      where: { id: memoryId },
      data: { importance: Math.max(0, Math.min(1, importance)) },
    });
  }

  /**
   * Record a memory access event by incrementing the access counter and
   * updating the last accessed timestamp. Used to reinforce frequently
   * accessed memories against decay.
   *
   * @param memoryId - The ID of the memory that was accessed
   */
  // 记录记忆访问
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
   * Permanently delete a memory record and its embedding from the database.
   *
   * @param memoryId - The ID of the memory to delete
   * @throws {Prisma.PrismaClientKnownRequestError} If the memory ID does not exist
   */
  // 删除记忆
  async deleteMemory(memoryId: string): Promise<void> {
    await this.prisma.memory.delete({ where: { id: memoryId } });
  }

  /**
   * Delete all memories whose `expiresAt` timestamp is in the past.
   *
   * @returns The number of expired memories that were deleted
   */
  // 清理过期记忆
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
   * Create a new agent conversation record for a user.
   *
   * @param userId - The user who owns the conversation
   * @param title - Optional initial title for the conversation
   * @returns The created conversation record with messageCount initialized to 0
   */
  // 创建对话
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
   * Retrieve a conversation by ID, including a count of user/assistant messages.
   *
   * @param conversationId - The ID of the conversation to retrieve
   * @returns The conversation record, or null if not found
   */
  // 获取对话
  async getConversation(
    conversationId: string,
  ): Promise<ConversationRecord | null> {
    const conversation = await this.prisma.agentConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          select: { id: true },
          where: { role: { in: ['user', 'assistant'] } },
        },
      },
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
   * Retrieve a user's most recent conversations ordered by last update time.
   *
   * @param userId - The user whose conversations to retrieve
   * @param limit - Maximum number of conversations to return (default: 10)
   * @returns An array of conversation records with message counts
   */
  // 获取用户最近对话
  async getRecentConversations(
    userId: string,
    limit: number = 10,
  ): Promise<ConversationRecord[]> {
    const conversations = await this.prisma.agentConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        messages: {
          select: { id: true },
          where: { role: { in: ['user', 'assistant'] } },
        },
      },
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
   * Update conversation metadata (title, summary, or agent type).
   *
   * @param conversationId - The ID of the conversation to update
   * @param data - Fields to update; all are optional
   */
  // 更新对话
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
   * Archive a conversation by setting `archived: true` in its metadata JSON field.
   *
   * Note: The AgentConversation model lacks dedicated isArchived/archivedAt columns,
   * so archive state is stored in the metadata JSON as a workaround.
   *
   * @param conversationId - The ID of the conversation to archive
   */
  // 归档对话
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
   * Add a message to a conversation in the database.
   *
   * @param conversationId - The conversation to append the message to
   * @param input - Message data including role, content, agent type, tool calls, and metrics
   * @returns The persisted message record with generated ID and timestamp
   */
  // 添加消息
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
   * Retrieve messages for a conversation, ordered chronologically (asc).
   *
   * @param conversationId - The conversation whose messages to retrieve
   * @param options - Optional pagination: limit (default: 50) and before (cursor date)
   * @returns An array of message records in chronological order
   */
  // 获取对话消息
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
   * Create or update an entity using upsert semantics keyed on (userId, type, name).
   *
   * If the entity already exists, its description, attributes, and relations
   * are updated; otherwise a new entity record is created.
   *
   * Note: The Entity table does not have an embedding column (unlike Memory),
   * so Prisma ORM is always used instead of raw SQL. Future expansion may add
   * vector search capabilities to entities.
   *
   * @param userId - The user who owns the entity
   * @param input - Entity data including type, name, description, attributes, and relations
   * @returns The created or updated entity record
   */
  // 注意: Entity 表没有 embedding 列（与 Memory 不同），
  // 因此始终使用 Prisma ORM 而非 raw SQL。
  // 向量嵌入仅生成但不存储，未来可扩展 Entity 表添加 embedding 列。
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
   * Retrieve entities belonging to a user, optionally filtered by entity type.
   *
   * @param userId - The user whose entities to retrieve
   * @param options - Optional filters: entity types to include and result limit (default: 50)
   * @returns An array of entity records ordered by most recently updated
   */
  // 获取用户实体
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
   * Search entities by keyword matching on name and description fields.
   *
   * Since the Entity table lacks an embedding column, this uses case-insensitive
   * substring matching instead of vector similarity. All results are assigned
   * a fixed similarity score of 0.5.
   *
   * @param userId - The user whose entities to search
   * @param query - The search string to match against entity names and descriptions
   * @param options - Optional filters: entity types and result limit (default: 10)
   * @returns Matching entities with a fixed similarity of 0.5
   */
  // 注意: Entity 表没有 embedding 列，使用关键词匹配（name + description）
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
   * Retrieve user AI preferences, returning sensible defaults if no record exists.
   *
   * @param userId - The user whose preferences to fetch
   * @returns The user's AI preferences including communication style, language, and feature toggles
   */
  // 获取用户偏好
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
   * Create or update user AI preferences using upsert semantics.
   *
   * @param userId - The user whose preferences to update
   * @param updates - Partial preference fields to merge with existing values
   * @returns The full updated preferences object
   */
  // 更新用户偏好
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

  /**
   * Return default AI preferences for users without an existing preference record.
   *
   * @returns Default preferences: friendly style, moderate length, zh-CN language, memory and suggestions enabled
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      communicationStyle: 'friendly',
      responseLength: 'moderate',
      language: 'zh-CN',
      enableMemory: true,
      enableSuggestions: true,
    };
  }

  // ==================== 事务操作 ====================

  /**
   * Atomically save end-of-conversation data within a single database transaction.
   *
   * The transaction includes:
   * 1. Updating the conversation summary
   * 2. Creating extracted fact memories (without embeddings to avoid raw SQL complexity)
   * 3. Upserting extracted entities
   *
   * After the transaction commits successfully, embeddings are backfilled
   * asynchronously for the created memories (fire-and-forget).
   *
   * @param conversationId - The conversation being ended
   * @param userId - The user who owns the conversation
   * @param summary - The generated conversation summary text
   * @param facts - Extracted fact memories to persist
   * @param entities - Extracted entities to upsert
   */
  // 事务化保存对话结束数据（摘要 + 记忆 + 实体）
  // 记忆在事务内不含 embedding（避免 raw SQL 复杂性），
  // 事务成功后异步补充 embedding。
  async saveEndConversationData(
    conversationId: string,
    userId: string,
    summary: string,
    facts: MemoryInput[],
    entities: EntityInput[],
  ): Promise<void> {
    const createdMemoryIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      // 1. 更新对话摘要
      await tx.agentConversation.update({
        where: { id: conversationId },
        data: { summary },
      });

      // 2. 创建记忆（不含 embedding）
      for (const fact of facts) {
        const memory = await tx.memory.create({
          data: {
            userId,
            type: fact.type,
            category: fact.category,
            content: fact.content,
            importance: fact.importance ?? 0.5,
            metadata: fact.metadata as Prisma.InputJsonValue | undefined,
            expiresAt: fact.expiresAt,
          },
        });
        createdMemoryIds.push(memory.id);
      }

      // 3. Upsert 实体
      for (const entity of entities) {
        await tx.entity.upsert({
          where: {
            userId_type_name: {
              userId,
              type: entity.type,
              name: entity.name,
            },
          },
          update: {
            description: entity.description,
            attributes: entity.attributes as unknown as
              | Prisma.InputJsonValue
              | undefined,
            relations: entity.relations as unknown as
              | Prisma.InputJsonValue
              | undefined,
          },
          create: {
            userId,
            type: entity.type,
            name: entity.name,
            description: entity.description,
            attributes: entity.attributes as unknown as
              | Prisma.InputJsonValue
              | undefined,
            relations: entity.relations as unknown as
              | Prisma.InputJsonValue
              | undefined,
          },
        });
      }
    });

    // 事务成功后异步补充 embedding
    if (createdMemoryIds.length > 0) {
      this.backfillEmbeddings(createdMemoryIds, facts).catch((err) => {
        this.logger.warn(
          'Failed to backfill embeddings for end-conversation memories',
          err,
        );
      });
    }
  }

  /**
   * Asynchronously generate and store embedding vectors for memories that were
   * created without them (e.g., during a transaction). Uses batch embedding
   * generation and raw SQL UPDATE to set the vector column.
   *
   * @param memoryIds - IDs of the memories to backfill
   * @param facts - The original memory inputs (used to retrieve content text)
   */
  // 为已创建的记忆补充 embedding
  private async backfillEmbeddings(
    memoryIds: string[],
    facts: MemoryInput[],
  ): Promise<void> {
    const contents = facts.map((f) => f.content);
    const embeddings = await this.embedding.embedBatch(contents);

    for (let i = 0; i < memoryIds.length; i++) {
      const emb = embeddings[i];
      if (emb && emb.length > 0) {
        await this.prisma.$executeRaw`
          UPDATE "Memory"
          SET embedding = ${emb}::vector, "updatedAt" = NOW()
          WHERE id = ${memoryIds[i]}
        `;
      }
    }
  }

  // ==================== 统计 ====================

  /**
   * Compute aggregate memory statistics for a user, including total counts,
   * breakdown by memory type, and recent activity metrics (last 7 days).
   *
   * @param userId - The user whose statistics to compute
   * @returns Aggregated memory statistics
   */
  // 获取记忆统计
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

  /**
   * Convert a raw database row into a typed MemoryRecord, mapping null values to undefined.
   *
   * @param m - The raw memory row from Prisma or $queryRaw
   * @returns A normalized MemoryRecord
   */
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

  /**
   * Convert a raw message row into a typed MessageRecord.
   *
   * @param m - The raw message row from Prisma
   * @returns A normalized MessageRecord
   */
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

  /**
   * Convert a raw entity row into a typed EntityRecord.
   *
   * @param e - The raw entity row from Prisma
   * @returns A normalized EntityRecord
   */
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
