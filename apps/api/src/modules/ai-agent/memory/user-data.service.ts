/**
 * 用户数据管理服务
 *
 * 提供用户记忆、对话、实体的 CRUD 操作和数据导出
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MemoryType, EntityType, Prisma } from '@prisma/client';
import {
  QueryMemoriesDto,
  MemoryListResponseDto,
  MemoryItemDto,
  QueryConversationsDto,
  ConversationListResponseDto,
  ConversationDetailDto,
  QueryEntitiesDto,
  EntityListResponseDto,
  AIPreferencesDto,
  AIPreferencesResponseDto,
  DataExportRequestDto,
  DataExportResponseDto,
  MemoryStatsDto,
  BatchDeleteResponseDto,
  ClearDataDto,
  ClearDataResponseDto,
} from '../dto';
import { RawMemoryRow } from './prisma-types';
import { SanitizerService, SanitizeLevel } from './sanitizer.service';

@Injectable()
export class UserDataService {
  private readonly logger = new Logger(UserDataService.name);

  constructor(
    private prisma: PrismaService,
    private sanitizer: SanitizerService,
  ) {}

  // ==================== 记忆管理 ====================

  /**
   * 获取用户记忆列表
   */
  async getMemories(
    userId: string,
    query: QueryMemoriesDto,
  ): Promise<MemoryListResponseDto> {
    const { types, category, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.MemoryWhereInput = { userId };

    if (types?.length) {
      where.type = { in: types };
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.memory.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          type: true,
          category: true,
          content: true,
          importance: true,
          accessCount: true,
          lastAccessedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.memory.count({ where }),
    ]);

    return {
      items: items.map(this.toMemoryItem),
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    };
  }

  /**
   * 获取单条记忆详情
   */
  async getMemory(
    userId: string,
    memoryId: string,
  ): Promise<MemoryItemDto | null> {
    const memory = await this.prisma.memory.findFirst({
      where: { id: memoryId, userId },
    });

    return memory ? this.toMemoryItem(memory) : null;
  }

  /**
   * 删除单条记忆
   */
  async deleteMemory(userId: string, memoryId: string): Promise<boolean> {
    const result = await this.prisma.memory.deleteMany({
      where: { id: memoryId, userId },
    });

    return result.count > 0;
  }

  /**
   * 批量删除记忆
   */
  async deleteMemories(
    userId: string,
    ids: string[],
  ): Promise<BatchDeleteResponseDto> {
    const result = await this.prisma.memory.deleteMany({
      where: { id: { in: ids }, userId },
    });

    return {
      deleted: result.count,
      failed: ids.length - result.count,
    };
  }

  /**
   * 清除所有记忆
   */
  async clearAllMemories(userId: string): Promise<number> {
    const result = await this.prisma.memory.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  // ==================== 对话管理 ====================

  /**
   * 获取对话列表
   */
  async getConversations(
    userId: string,
    query: QueryConversationsDto,
  ): Promise<ConversationListResponseDto> {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.agentConversation.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.agentConversation.count({ where: { userId } }),
    ]);

    return {
      items: items.map((conv) => ({
        id: conv.id,
        title: conv.title ?? undefined,
        summary: conv.summary ?? undefined,
        agentType: conv.agentType ?? undefined,
        messageCount: conv._count.messages,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    };
  }

  /**
   * 获取对话详情（含消息）
   */
  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationDetailDto | null> {
    const conv = await this.prisma.agentConversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            agentType: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conv) return null;

    return {
      id: conv.id,
      title: conv.title ?? undefined,
      summary: conv.summary ?? undefined,
      agentType: conv.agentType ?? undefined,
      messageCount: conv.messages.length,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messages: conv.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        agentType: msg.agentType ?? undefined,
        createdAt: msg.createdAt,
      })),
    };
  }

  /**
   * 删除对话
   */
  async deleteConversation(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const result = await this.prisma.agentConversation.deleteMany({
      where: { id: conversationId, userId },
    });

    return result.count > 0;
  }

  /**
   * 清除所有对话
   */
  async clearAllConversations(userId: string): Promise<number> {
    const result = await this.prisma.agentConversation.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  // ==================== 实体管理 ====================

  /**
   * 获取实体列表
   */
  async getEntities(
    userId: string,
    query: QueryEntitiesDto,
  ): Promise<EntityListResponseDto> {
    const { types, search, page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.EntityWhereInput = { userId };

    if (types?.length) {
      where.type = { in: types };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.entity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          name: true,
          description: true,
          createdAt: true,
        },
      }),
      this.prisma.entity.count({ where }),
    ]);

    return {
      items: items.map((e) => ({
        id: e.id,
        type: e.type as any,
        name: e.name,
        description: e.description ?? undefined,
        createdAt: e.createdAt,
      })),
      total,
    };
  }

  /**
   * 删除实体
   */
  async deleteEntity(userId: string, entityId: string): Promise<boolean> {
    const result = await this.prisma.entity.deleteMany({
      where: { id: entityId, userId },
    });

    return result.count > 0;
  }

  /**
   * 清除所有实体
   */
  async clearAllEntities(userId: string): Promise<number> {
    const result = await this.prisma.entity.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  // ==================== 偏好设置 ====================

  /**
   * 获取 AI 偏好设置
   */
  async getPreferences(userId: string): Promise<AIPreferencesResponseDto> {
    let prefs = await this.prisma.userAIPreference.findUnique({
      where: { userId },
    });

    // 如果不存在，创建默认设置
    if (!prefs) {
      prefs = await this.prisma.userAIPreference.create({
        data: {
          userId,
          communicationStyle: 'friendly',
          responseLength: 'moderate',
          language: 'zh',
          enableMemory: true,
          enableSuggestions: true,
        },
      });
    }

    return {
      communicationStyle: prefs.communicationStyle as any,
      responseLength: prefs.responseLength as any,
      language: prefs.language,
      schoolPreferences: prefs.schoolPreferences as any,
      essayPreferences: prefs.essayPreferences as any,
      enableMemory: prefs.enableMemory,
      enableSuggestions: prefs.enableSuggestions,
      createdAt: prefs.createdAt,
      updatedAt: prefs.updatedAt,
    };
  }

  /**
   * 更新 AI 偏好设置
   */
  async updatePreferences(
    userId: string,
    data: AIPreferencesDto,
  ): Promise<AIPreferencesResponseDto> {
    const prefs = await this.prisma.userAIPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });

    return {
      communicationStyle: prefs.communicationStyle as any,
      responseLength: prefs.responseLength as any,
      language: prefs.language,
      schoolPreferences: prefs.schoolPreferences as any,
      essayPreferences: prefs.essayPreferences as any,
      enableMemory: prefs.enableMemory,
      enableSuggestions: prefs.enableSuggestions,
      createdAt: prefs.createdAt,
      updatedAt: prefs.updatedAt,
    };
  }

  /**
   * 重置偏好设置为默认值
   */
  async resetPreferences(userId: string): Promise<boolean> {
    await this.prisma.userAIPreference.upsert({
      where: { userId },
      create: {
        userId,
        communicationStyle: 'friendly',
        responseLength: 'moderate',
        language: 'zh',
        enableMemory: true,
        enableSuggestions: true,
      },
      update: {
        communicationStyle: 'friendly',
        responseLength: 'moderate',
        language: 'zh',
        schoolPreferences: null,
        essayPreferences: null,
        enableMemory: true,
        enableSuggestions: true,
      },
    });

    return true;
  }

  // ==================== 数据导出 ====================

  /**
   * 导出用户所有 AI 数据
   */
  async exportData(
    userId: string,
    options: DataExportRequestDto,
  ): Promise<DataExportResponseDto> {
    const result: DataExportResponseDto = {
      exportedAt: new Date(),
      userId,
      stats: {
        totalMemories: 0,
        totalConversations: 0,
        totalMessages: 0,
        totalEntities: 0,
      },
    };

    // 导出记忆
    if (options.includeMemories) {
      const memories = await this.prisma.memory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      result.memories = memories.map((m) => {
        const item = this.toMemoryItem(m as unknown as RawMemoryRow);
        // 导出时进行脱敏处理
        return {
          ...item,
          content: this.sanitizer.sanitize(item.content, {
            level: SanitizeLevel.MODERATE,
          }),
        };
      });
      result.stats.totalMemories = memories.length;
    }

    // 导出对话
    if (options.includeConversations) {
      const conversations = await this.prisma.agentConversation.findMany({
        where: { userId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      result.conversations = conversations.map((conv) => ({
        id: conv.id,
        title: conv.title ?? undefined,
        summary: conv.summary
          ? this.sanitizer.sanitize(conv.summary, {
              level: SanitizeLevel.MODERATE,
            })
          : undefined,
        agentType: conv.agentType ?? undefined,
        messageCount: conv.messages.length,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messages: conv.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          // 导出时对消息内容进行脱敏
          content: this.sanitizer.sanitize(msg.content, {
            level: SanitizeLevel.MODERATE,
          }),
          agentType: msg.agentType ?? undefined,
          createdAt: msg.createdAt,
        })),
      }));

      result.stats.totalConversations = conversations.length;
      result.stats.totalMessages = conversations.reduce(
        (sum, c) => sum + c.messages.length,
        0,
      );
    }

    // 导出实体
    if (options.includeEntities) {
      const entities = await this.prisma.entity.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      result.entities = entities.map((e) => ({
        id: e.id,
        type: e.type,
        name: e.name,
        // 脱敏实体描述
        description: e.description
          ? this.sanitizer.sanitize(e.description, {
              level: SanitizeLevel.MODERATE,
            })
          : undefined,
        createdAt: e.createdAt,
      }));

      result.stats.totalEntities = entities.length;
    }

    // 导出偏好
    if (options.includePreferences) {
      const prefs = await this.getPreferences(userId);
      result.preferences = prefs;
    }

    return result;
  }

  // ==================== 统计信息 ====================

  /**
   * 获取用户数据统计
   */
  async getStats(userId: string): Promise<MemoryStatsDto> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalMemories,
      totalConversations,
      totalMessages,
      totalEntities,
      memoryByType,
      conversationsLast7Days,
      messagesLast7Days,
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

    const typeCount: Record<string, number> = {};
    for (const item of memoryByType) {
      typeCount[item.type] = item._count;
    }

    return {
      totalMemories,
      totalConversations,
      totalMessages,
      totalEntities,
      memoryByType: typeCount,
      recentActivity: {
        conversationsLast7Days,
        messagesLast7Days,
      },
      storageUsed: {
        memoriesCount: totalMemories,
        conversationsCount: totalConversations,
      },
    };
  }

  // ==================== 批量清除 ====================

  /**
   * 批量清除数据
   */
  async clearData(
    userId: string,
    options: ClearDataDto,
  ): Promise<ClearDataResponseDto> {
    const result: ClearDataResponseDto = {
      cleared: {
        memories: 0,
        conversations: 0,
        entities: 0,
        preferencesReset: false,
      },
      timestamp: new Date(),
    };

    if (options.clearMemories) {
      result.cleared.memories = await this.clearAllMemories(userId);
    }

    if (options.clearConversations) {
      result.cleared.conversations = await this.clearAllConversations(userId);
    }

    if (options.clearEntities) {
      result.cleared.entities = await this.clearAllEntities(userId);
    }

    if (options.resetPreferences) {
      await this.resetPreferences(userId);
      result.cleared.preferencesReset = true;
    }

    this.logger.log(
      `User ${userId} cleared data: ${JSON.stringify(result.cleared)}`,
    );

    return result;
  }

  // ==================== 私有方法 ====================

  private toMemoryItem(memory: RawMemoryRow): MemoryItemDto {
    return {
      id: memory.id,
      type: memory.type,
      category: memory.category ?? undefined,
      content: memory.content,
      importance: memory.importance,
      accessCount: memory.accessCount,
      lastAccessedAt: memory.lastAccessedAt ?? undefined,
      createdAt: memory.createdAt,
    };
  }
}
