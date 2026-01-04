/**
 * 记忆管理器 - 企业级 Agent 记忆系统核心
 * 
 * 集成短期记忆（Redis）、长期记忆（PostgreSQL）、语义检索（Embedding）
 */

import { Injectable, Logger } from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { RedisCacheService } from './redis-cache.service';
import { PersistentMemoryService } from './persistent-memory.service';
import { EmbeddingService } from './embedding.service';
import { SummarizerService } from './summarizer.service';
import {
  MemoryInput,
  MemoryRecord,
  MessageInput,
  MessageRecord,
  ConversationRecord,
  EntityInput,
  EntityRecord,
  RetrievalContext,
  RecallOptions,
  UserPreferences,
  MemoryStats,
} from './types';

@Injectable()
export class MemoryManagerService {
  private readonly logger = new Logger(MemoryManagerService.name);

  constructor(
    private cache: RedisCacheService,
    private persistent: PersistentMemoryService,
    private embedding: EmbeddingService,
    private summarizer: SummarizerService,
  ) {}

  // ==================== 对话管理 ====================

  /**
   * 获取或创建对话
   */
  async getOrCreateConversation(
    userId: string,
    conversationId?: string,
  ): Promise<ConversationRecord> {
    if (conversationId) {
      // 尝试从缓存获取
      const cached = await this.cache.getConversationMeta(conversationId);
      if (cached?.id) {
        return cached as ConversationRecord;
      }

      // 从数据库获取
      const existing = await this.persistent.getConversation(conversationId);
      if (existing) {
        await this.cache.cacheConversation(conversationId, existing);
        return existing;
      }
    }

    // 检查用户是否有活跃对话
    const activeId = await this.cache.getActiveConversation(userId);
    if (activeId && !conversationId) {
      const active = await this.persistent.getConversation(activeId);
      if (active) {
        return active;
      }
    }

    // 创建新对话
    const newConversation = await this.persistent.createConversation(userId);
    await this.cache.cacheConversation(newConversation.id, newConversation);
    await this.cache.setActiveConversation(userId, newConversation.id);

    return newConversation;
  }

  /**
   * 添加消息到对话
   */
  async addMessage(
    conversationId: string,
    input: MessageInput,
  ): Promise<MessageRecord> {
    // 写入数据库
    const message = await this.persistent.addMessage(conversationId, input);

    // 写入缓存
    await this.cache.cacheMessage(conversationId, message);

    // 异步提取记忆（用户消息）
    if (input.role === 'user') {
      this.extractAndSaveMemory(conversationId, message).catch(err => {
        this.logger.error('Failed to extract memory', err);
      });
    }

    return message;
  }

  /**
   * 获取对话历史
   */
  async getConversationHistory(
    conversationId: string,
    limit: number = 20,
  ): Promise<MessageRecord[]> {
    // 先尝试缓存
    const cached = await this.cache.getConversationMessages(conversationId);
    if (cached.length > 0) {
      return cached.slice(-limit);
    }

    // 从数据库获取
    const messages = await this.persistent.getMessages(conversationId, { limit });
    
    // 回填缓存
    for (const msg of messages) {
      await this.cache.cacheMessage(conversationId, msg);
    }

    return messages;
  }

  /**
   * 结束对话（生成摘要）
   */
  async endConversation(conversationId: string): Promise<void> {
    const messages = await this.persistent.getMessages(conversationId, { limit: 100 });

    if (this.summarizer.shouldSummarize(messages)) {
      const summary = await this.summarizer.summarizeConversation(messages);

      // 保存摘要
      await this.persistent.updateConversation(conversationId, {
        summary: summary.summary,
      });

      // 保存提取的记忆
      const conversation = await this.persistent.getConversation(conversationId);
      if (conversation) {
        if (summary.extractedFacts.length > 0) {
          await this.persistent.createMemories(conversation.userId, summary.extractedFacts);
        }

        for (const entity of summary.extractedEntities) {
          await this.persistent.upsertEntity(conversation.userId, entity);
        }
      }
    }

    // 清理缓存
    await this.cache.deleteConversation(conversationId);
  }

  // ==================== 记忆管理 ====================

  /**
   * 记住信息
   */
  async remember(userId: string, input: MemoryInput): Promise<MemoryRecord> {
    return this.persistent.createMemory(userId, input);
  }

  /**
   * 回忆相关信息
   */
  async recall(
    userId: string,
    options: RecallOptions = {},
  ): Promise<MemoryRecord[]> {
    const { query, useSemanticSearch = true, limit = 10 } = options;

    // 如果有查询且启用语义搜索
    if (query && useSemanticSearch) {
      const semanticResults = await this.persistent.searchMemories(userId, query, {
        limit,
        minSimilarity: 0.5,
      });
      return semanticResults;
    }

    // 普通检索
    return this.persistent.queryMemories(userId, {
      types: options.types,
      categories: options.categories,
      minImportance: options.minImportance,
      limit,
    });
  }

  /**
   * 遗忘记忆
   */
  async forget(memoryId: string): Promise<void> {
    await this.persistent.deleteMemory(memoryId);
  }

  // ==================== 上下文构建 ====================

  /**
   * 获取完整的检索上下文
   */
  async getRetrievalContext(
    userId: string,
    currentMessage: string,
    conversationId?: string,
  ): Promise<RetrievalContext> {
    const [
      recentMessages,
      relevantMemories,
      preferences,
      entities,
    ] = await Promise.all([
      // 获取最近对话
      conversationId
        ? this.getConversationHistory(conversationId, 10)
        : Promise.resolve([]),

      // 语义检索相关记忆
      this.recall(userId, {
        query: currentMessage,
        useSemanticSearch: true,
        limit: 5,
      }),

      // 获取用户偏好
      this.persistent.getPreferences(userId),

      // 搜索相关实体
      this.persistent.searchEntities(userId, currentMessage, { limit: 5 }),
    ]);

    return {
      recentMessages,
      relevantMemories,
      preferences,
      entities: entities.map(e => ({
        id: e.id,
        userId: e.userId,
        type: e.type,
        name: e.name,
        description: e.description,
        attributes: e.attributes,
        relations: e.relations,
        createdAt: e.createdAt,
      })),
      meta: {
        conversationId,
        messageCount: recentMessages.length,
        memoryCount: relevantMemories.length,
      },
    };
  }

  /**
   * 构建上下文摘要（用于 system prompt）
   */
  buildContextSummary(context: RetrievalContext): string {
    const parts: string[] = [];

    // 用户偏好
    if (context.preferences) {
      parts.push(`沟通风格: ${context.preferences.communicationStyle}`);
      parts.push(`回复详细度: ${context.preferences.responseLength}`);
    }

    // 相关记忆
    if (context.relevantMemories.length > 0) {
      parts.push('\n## 相关记忆');
      for (const mem of context.relevantMemories.slice(0, 3)) {
        parts.push(`- [${mem.type}] ${mem.content}`);
      }
    }

    // 相关实体
    if (context.entities.length > 0) {
      const schools = context.entities.filter(e => e.type === 'SCHOOL');
      if (schools.length > 0) {
        parts.push(`\n关注的学校: ${schools.map(s => s.name).join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  // ==================== 实体管理 ====================

  /**
   * 记录实体
   */
  async recordEntity(userId: string, input: EntityInput): Promise<EntityRecord> {
    return this.persistent.upsertEntity(userId, input);
  }

  /**
   * 获取实体
   */
  async getEntities(
    userId: string,
    options?: { types?: any[]; limit?: number },
  ): Promise<EntityRecord[]> {
    return this.persistent.getEntities(userId, options);
  }

  // ==================== 用户偏好 ====================

  /**
   * 获取用户偏好
   */
  async getPreferences(userId: string): Promise<UserPreferences> {
    return this.persistent.getPreferences(userId);
  }

  /**
   * 更新用户偏好
   */
  async updatePreferences(
    userId: string,
    updates: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    return this.persistent.updatePreferences(userId, updates);
  }

  // ==================== 统计与维护 ====================

  /**
   * 获取记忆统计
   */
  async getStats(userId: string): Promise<MemoryStats> {
    return this.persistent.getStats(userId);
  }

  /**
   * 清理过期记忆
   */
  async cleanup(): Promise<{ expiredMemories: number }> {
    const expiredMemories = await this.persistent.cleanupExpiredMemories();
    return { expiredMemories };
  }

  // ==================== 私有方法 ====================

  /**
   * 从消息中提取并保存记忆
   */
  private async extractAndSaveMemory(
    conversationId: string,
    message: MessageRecord,
  ): Promise<void> {
    const conversation = await this.persistent.getConversation(conversationId);
    if (!conversation) return;

    const { memories, entities } = await this.summarizer.extractFromMessage(message);

    // 保存记忆
    if (memories.length > 0) {
      await this.persistent.createMemories(conversation.userId, memories);
    }

    // 保存实体
    for (const entity of entities) {
      await this.persistent.upsertEntity(conversation.userId, entity);
    }
  }
}




