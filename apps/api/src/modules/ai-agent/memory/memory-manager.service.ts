/**
 * 记忆管理器 - 企业级 Agent 记忆系统核心
 *
 * 集成短期记忆（Redis）、长期记忆（PostgreSQL）、语义检索（Embedding）
 *
 * Phase 1 增强:
 * - 记忆评分服务
 * - 记忆衰减机制
 * - 冲突检测与解决
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MemoryType, EntityType } from '@prisma/client';
import { RedisCacheService } from './redis-cache.service';
import { PersistentMemoryService } from './persistent-memory.service';
import { EmbeddingService } from './embedding.service';
import { SummarizerService } from './summarizer.service';
import { MemoryScorerService, MemoryScoreInput } from './memory-scorer.service';
import { MemoryDecayService } from './memory-decay.service';
import {
  MemoryConflictService,
  ConflictStrategy,
} from './memory-conflict.service';
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
  MemoryTier,
  DecayResult,
  EnhancedMemoryStats,
} from './types';

@Injectable()
export class MemoryManagerService {
  private readonly logger = new Logger(MemoryManagerService.name);

  constructor(
    private cache: RedisCacheService,
    private persistent: PersistentMemoryService,
    private embedding: EmbeddingService,
    private summarizer: SummarizerService,
    @Optional() private scorer?: MemoryScorerService,
    @Optional() private decay?: MemoryDecayService,
    @Optional() private conflict?: MemoryConflictService,
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
      this.extractAndSaveMemory(conversationId, message).catch((err) => {
        this.logger.error('Failed to extract memory', err);
      });
    }

    // 异步提取工具结果中的关键决策记忆
    if (input.role === 'tool' && input.content) {
      this.extractToolResultMemory(conversationId, message).catch((err) => {
        this.logger.error('Failed to extract tool result memory', err);
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
    const messages = await this.persistent.getMessages(conversationId, {
      limit,
    });

    // 回填缓存
    for (const msg of messages) {
      await this.cache.cacheMessage(conversationId, msg);
    }

    return messages;
  }

  /**
   * 获取对话消息（Gateway 用）
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
  ): Promise<MessageRecord[]> {
    return this.persistent.getMessages(conversationId, { limit });
  }

  /**
   * 获取最近对话列表（Gateway 用）
   */
  async getRecentConversations(
    userId: string,
    limit: number = 10,
  ): Promise<ConversationRecord[]> {
    return this.persistent.getRecentConversations(userId, limit);
  }

  /**
   * 清除对话（Gateway 用）
   */
  async clearConversation(conversationId: string): Promise<void> {
    // 先结束对话（生成摘要）
    await this.endConversation(conversationId);
  }

  /**
   * 结束对话（生成摘要）
   */
  async endConversation(conversationId: string): Promise<void> {
    const messages = await this.persistent.getMessages(conversationId, {
      limit: 100,
    });

    if (this.summarizer.shouldSummarize(messages)) {
      const summary = await this.summarizer.summarizeConversation(messages);

      // 保存摘要
      await this.persistent.updateConversation(conversationId, {
        summary: summary.summary,
      });

      // 保存提取的记忆
      const conversation =
        await this.persistent.getConversation(conversationId);
      if (conversation) {
        if (summary.extractedFacts.length > 0) {
          await this.persistent.createMemories(
            conversation.userId,
            summary.extractedFacts,
          );
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
   * 记住信息（增强版：含冲突检测与评分）
   */
  async remember(
    userId: string,
    input: MemoryInput,
    options?: {
      skipConflictCheck?: boolean;
      strategyOverride?: ConflictStrategy;
    },
  ): Promise<MemoryRecord | null> {
    // 1. 冲突检测
    if (this.conflict && !options?.skipConflictCheck) {
      const memoryWithUser = {
        userId,
        ...input,
        importance: input.importance ?? 0.5,
      };
      const detection = await this.conflict.detectConflict(memoryWithUser);

      if (detection.hasConflict) {
        const resolution = await this.conflict.resolveConflict(
          memoryWithUser,
          detection,
          options?.strategyOverride,
        );

        this.logger.debug(
          `Memory conflict resolved: ${resolution.action} - ${resolution.reason}`,
        );

        switch (resolution.action) {
          case 'SKIP':
            return null; // 不保存

          case 'UPDATE':
            // 更新已有记忆
            if (resolution.memory.id) {
              const updated = await this.persistent.updateMemory(
                resolution.memory.id,
                {
                  content: resolution.memory.content,
                  importance: resolution.memory.importance,
                  metadata: resolution.memory.metadata,
                },
              );
              return updated;
            }
            break;

          case 'MERGE':
            // 合并记忆
            if (resolution.memory.id) {
              const merged = await this.persistent.updateMemory(
                resolution.memory.id,
                {
                  content: resolution.memory.content,
                  importance: resolution.memory.importance,
                  metadata: resolution.memory.metadata,
                },
              );
              return merged;
            }
            break;

          case 'PENDING':
            // 标记为待确认
            input = {
              ...input,
              metadata: {
                ...input.metadata,
                pendingConflict: true,
                conflictWith: detection.existingMemory?.id,
              },
            };
            break;

          case 'CREATE':
          default:
            // 继续创建
            input = {
              ...input,
              metadata: resolution.memory.metadata,
            };
            break;
        }
      }
    }

    // 2. 评分（确定存储层级和重要性）
    if (this.scorer) {
      const scoreInput: MemoryScoreInput = {
        type: input.type,
        content: input.content,
        importance: input.importance || 0.5,
        confidence: (input.metadata?.confidence as number) || 0.8,
        createdAt: new Date(),
      };

      const scoreResult = this.scorer.score(scoreInput);

      this.logger.debug(
        `Memory scored: total=${scoreResult.totalScore.toFixed(2)}, ` +
          `tier=${scoreResult.tier}`,
      );

      // 根据评分调整重要性
      input = {
        ...input,
        importance: scoreResult.components.importanceScore,
        metadata: {
          ...input.metadata,
          scoreTier: scoreResult.tier,
          scoreDetails: scoreResult.components,
        },
      };

      // 低分记忆直接跳过
      if (
        scoreResult.totalScore < 0.1 &&
        scoreResult.tier === MemoryTier.ARCHIVE
      ) {
        this.logger.debug('Memory score too low, skipping');
        return null;
      }
    }

    // 3. 持久化
    return this.persistent.createMemory(userId, input);
  }

  /**
   * 回忆相关信息（增强版：记录访问）
   */
  async recall(
    userId: string,
    options: RecallOptions = {},
  ): Promise<MemoryRecord[]> {
    const { query, useSemanticSearch = true, limit = 10 } = options;

    let memories: MemoryRecord[];

    // 如果有查询且启用语义搜索
    if (query && useSemanticSearch) {
      memories = await this.persistent.searchMemories(userId, query, {
        limit,
        minSimilarity: 0.5,
      });
    } else {
      // 普通检索
      memories = await this.persistent.queryMemories(userId, {
        types: options.types,
        categories: options.categories,
        minImportance: options.minImportance,
        limit,
      });
    }

    // 记录访问（强化记忆）
    if (this.decay && memories.length > 0) {
      this.decay.recordAccessBatch(memories.map((m) => m.id)).catch((err) => {
        this.logger.error('Failed to record memory access', err);
      });
    }

    return memories;
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
    const [recentMessages, relevantMemories, preferences, entities] =
      await Promise.all([
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
      entities: entities.map((e) => ({
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
      const schools = context.entities.filter((e) => e.type === 'SCHOOL');
      if (schools.length > 0) {
        parts.push(`\n关注的学校: ${schools.map((s) => s.name).join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  // ==================== 实体管理 ====================

  /**
   * 记录实体
   */
  async recordEntity(
    userId: string,
    input: EntityInput,
  ): Promise<EntityRecord> {
    return this.persistent.upsertEntity(userId, input);
  }

  /**
   * 获取实体
   */
  async getEntities(
    userId: string,
    options?: { types?: EntityType[]; limit?: number },
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
   * 获取增强统计（含衰减信息）
   */
  async getEnhancedStats(userId: string): Promise<EnhancedMemoryStats> {
    const basic = await this.persistent.getStats(userId);

    const result: EnhancedMemoryStats = { ...basic };

    // 衰减统计
    if (this.decay) {
      result.decay = await this.decay.getDecayStats(userId);
    }

    // 评分统计
    if (this.scorer) {
      const memories = await this.persistent.queryMemories(userId, {
        limit: 100,
      });
      const scores = memories.map((m) =>
        this.scorer!.score({
          type: m.type,
          content: m.content,
          importance: m.importance,
          confidence: 0.8,
          createdAt: m.createdAt,
          accessCount: (m.metadata as any)?.accessCount || 0,
        }),
      );

      const tierDistribution: Record<string, number> = {};
      let totalScore = 0;

      for (const score of scores) {
        totalScore += score.totalScore;
        tierDistribution[score.tier] = (tierDistribution[score.tier] || 0) + 1;
      }

      result.scoring = {
        averageScore: scores.length > 0 ? totalScore / scores.length : 0,
        tierDistribution,
      };
    }

    return result;
  }

  /**
   * 清理过期记忆（每小时自动执行）
   */
  @Cron('0 * * * *')
  async cleanup(): Promise<{ expiredMemories: number }> {
    const expiredMemories = await this.persistent.cleanupExpiredMemories();
    return { expiredMemories };
  }

  /**
   * 手动触发记忆衰减
   */
  async triggerDecay(): Promise<{ success: boolean; result?: DecayResult }> {
    if (!this.decay) {
      return { success: false };
    }

    const result = await this.decay.triggerDecay();
    return { success: true, result };
  }

  /**
   * 获取待确认的冲突
   */
  async getPendingConflicts(userId: string): Promise<any[]> {
    if (!this.conflict) {
      return [];
    }
    return this.conflict.getPendingConflicts(userId);
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

    const { memories, entities } =
      await this.summarizer.extractFromMessage(message);

    // 保存记忆
    if (memories.length > 0) {
      await this.persistent.createMemories(conversation.userId, memories);
    }

    // 保存实体
    for (const entity of entities) {
      await this.persistent.upsertEntity(conversation.userId, entity);
    }
  }

  /**
   * 从工具执行结果中提取记忆（时间线、个人事件等关键决策）
   */
  private async extractToolResultMemory(
    conversationId: string,
    message: MessageRecord,
  ): Promise<void> {
    const conversation = await this.persistent.getConversation(conversationId);
    if (!conversation) return;

    try {
      const data = JSON.parse(message.content);
      if (!data || typeof data !== 'object') return;

      const memories: MemoryInput[] = [];
      const entities: EntityInput[] = [];

      // 创建个人事件的结果
      if (data.success && data.event) {
        const ev = data.event;
        const categoryLabels: Record<string, string> = {
          COMPETITION: '竞赛',
          TEST: '标化考试',
          SUMMER_PROGRAM: '夏校',
          INTERNSHIP: '实习',
          ACTIVITY: '课外活动',
          MATERIAL: '材料准备',
        };
        const label = categoryLabels[ev.category] || ev.category;

        memories.push({
          type: MemoryType.DECISION,
          category: 'timeline',
          content: `创建了${label}事件: ${ev.title}`,
          importance: 0.75,
          metadata: {
            source: 'tool_result',
            eventId: ev.id,
            category: ev.category,
          },
        });

        entities.push({
          type: EntityType.EVENT,
          name: ev.title,
          description: `${label} - 用户创建的个人事件`,
          attributes: { category: ev.category, eventId: ev.id },
        });
      }

      // 学校推荐结果（已有 schools 数组）
      if (Array.isArray(data) && data.length > 0 && data[0]?.schoolName) {
        const schoolNames = data
          .slice(0, 3)
          .map((s: any) => s.schoolName)
          .filter(Boolean);
        if (schoolNames.length > 0) {
          memories.push({
            type: MemoryType.FACT,
            category: 'school',
            content: `查询了学校信息: ${schoolNames.join(', ')}`,
            importance: 0.5,
            metadata: { source: 'tool_result' },
          });
        }
      }

      // 时间线创建结果
      if (data.timeline && (Array.isArray(data.timeline) || data.keyDates)) {
        memories.push({
          type: MemoryType.DECISION,
          category: 'timeline',
          content: '生成了申请时间线规划',
          importance: 0.7,
          metadata: { source: 'tool_result' },
        });
      }

      // 个人事件列表查询
      if (
        Array.isArray(data) &&
        data.length > 0 &&
        data[0]?.category &&
        data[0]?.tasks
      ) {
        const categories = [...new Set(data.map((e: any) => e.category))];
        memories.push({
          type: MemoryType.FACT,
          category: 'timeline',
          content: `当前有 ${data.length} 项个人事件，涉及: ${categories.join(', ')}`,
          importance: 0.4,
          metadata: { source: 'tool_result', transient: true },
        });
      }

      // 保存
      if (memories.length > 0) {
        await this.persistent.createMemories(conversation.userId, memories);
      }
      for (const entity of entities) {
        await this.persistent.upsertEntity(conversation.userId, entity);
      }
    } catch {
      // JSON 解析失败则跳过
    }
  }
}
