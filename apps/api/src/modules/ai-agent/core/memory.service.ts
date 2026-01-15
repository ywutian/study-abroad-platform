/**
 * Agent 记忆服务 - 管理对话历史和用户上下文
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ConversationState,
  Message,
  UserContext,
  ProfileSnapshot,
  TimelineSummary,
} from '../types';
import {
  ProfileData,
  TestScoreData,
  ActivityData,
  AwardData,
  ToolResultSummary,
} from './types';

// 用户上下文缓存条目（带时间戳）
interface ContextCacheEntry {
  data: UserContext;
  timestamp: number;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  // 内存存储 (生产环境应使用 Redis)
  private conversations: Map<string, ConversationState> = new Map();
  private userContexts: Map<string, ContextCacheEntry> = new Map();

  // 上下文缓存TTL：5分钟
  private readonly CONTEXT_TTL_MS = 5 * 60 * 1000;

  constructor(private prisma: PrismaService) {}

  // ==================== 对话管理 ====================

  /**
   * 获取或创建对话
   */
  async getOrCreateConversation(
    userId: string,
    conversationId?: string,
  ): Promise<ConversationState> {
    const id = conversationId || `conv_${randomUUID()}`;
    const key = `${userId}:${id}`;

    let conversation = this.conversations.get(key);

    if (!conversation) {
      const context = await this.loadUserContext(userId);

      conversation = {
        id,
        userId,
        messages: [],
        context,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.conversations.set(key, conversation);
    }

    return conversation;
  }

  /**
   * 添加消息
   */
  addMessage(
    conversation: ConversationState,
    message: Omit<Message, 'id' | 'timestamp'>,
  ): Message {
    const fullMessage: Message = {
      ...message,
      id: `msg_${randomUUID()}`,
      timestamp: new Date(),
    };

    conversation.messages.push(fullMessage);
    conversation.updatedAt = new Date();

    return fullMessage;
  }

  /**
   * 获取最近消息（用于构建 prompt）
   */
  getRecentMessages(
    conversation: ConversationState,
    limit: number = 20,
  ): Message[] {
    // 过滤掉工具消息中的详细数据，只保留关键信息
    return conversation.messages.slice(-limit).map((m) => {
      if (m.role === 'tool') {
        try {
          const data = JSON.parse(m.content);
          // 简化工具返回数据
          return {
            ...m,
            content: JSON.stringify(this.summarizeToolResult(data)),
          };
        } catch {
          return m;
        }
      }
      return m;
    });
  }

  /**
   * 简化工具结果（避免 context 过长，同时保留关键信息）
   *
   * 策略：保留更多数据并添加数量标注，让 LLM 知道完整数据已获取
   */
  private summarizeToolResult(data: unknown): unknown {
    if (Array.isArray(data)) {
      const total = data.length;
      const shown = Math.min(total, 8); // 从 5 提升到 8
      const items = data
        .slice(0, shown)
        .map((item) =>
          typeof item === 'object' && item !== null
            ? this.pickKeys(item as Record<string, unknown>, 8)
            : item,
        );
      // 标注总数，让 LLM 知道数据是完整获取的
      if (total > shown) {
        return {
          _summary: true,
          _totalCount: total,
          _shownCount: shown,
          items,
        };
      }
      return items;
    }
    if (typeof data === 'object' && data !== null) {
      return this.pickKeys(data as Record<string, unknown>, 15);
    }
    return data;
  }

  private pickKeys(
    obj: Record<string, unknown>,
    maxKeys: number,
  ): Record<string, unknown> {
    const keys = Object.keys(obj).slice(0, maxKeys);
    const result: Record<string, unknown> = {};
    const totalKeys = Object.keys(obj).length;

    for (const key of keys) {
      const value = obj[key];
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        result[key] = this.pickKeys(value as Record<string, unknown>, 5);
      } else if (Array.isArray(value)) {
        result[key] = value.slice(0, 5);
        if (value.length > 5) {
          result[`_${key}_total`] = value.length;
        }
      } else {
        result[key] = value;
      }
    }

    // 标注是否有被截断的 key
    if (totalKeys > maxKeys) {
      result['_truncated'] = true;
      result['_totalKeys'] = totalKeys;
    }

    return result;
  }

  /**
   * 清除对话
   */
  clearConversation(userId: string, conversationId?: string) {
    if (conversationId) {
      this.conversations.delete(`${userId}:${conversationId}`);
    } else {
      // 清除用户所有对话
      const keysToDelete: string[] = [];
      this.conversations.forEach((_, key) => {
        if (key.startsWith(`${userId}:`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => this.conversations.delete(key));
    }
  }

  // ==================== 用户上下文 ====================

  /**
   * 加载用户上下文（带TTL缓存）
   */
  async loadUserContext(userId: string): Promise<UserContext> {
    // 检查缓存是否存在且未过期
    const cached = this.userContexts.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CONTEXT_TTL_MS) {
      return cached.data;
    }

    try {
      const [profile, timelines, personalEvents] = await Promise.all([
        this.prisma.profile.findUnique({
          where: { userId },
          include: {
            testScores: true,
            activities: { take: 10 },
            awards: { take: 10 },
          },
        }),
        this.prisma.applicationTimeline.findMany({
          where: { userId },
          select: {
            schoolName: true,
            deadline: true,
            status: true,
            round: true,
          },
          orderBy: { deadline: 'asc' },
          take: 10,
        }),
        this.prisma.personalEvent.findMany({
          where: { userId },
          select: {
            title: true,
            category: true,
            deadline: true,
            eventDate: true,
            status: true,
          },
          orderBy: { deadline: 'asc' },
          take: 10,
        }),
      ]);

      // 构建时间线摘要
      const now = new Date();
      const upcoming: TimelineSummary['upcoming'] = [];

      for (const tl of timelines) {
        if (tl.deadline && tl.deadline > now && tl.status !== 'SUBMITTED') {
          upcoming.push({
            title: tl.schoolName,
            type: 'school',
            deadline: tl.deadline.toISOString().split('T')[0],
            status: tl.status,
          });
        }
      }

      for (const pe of personalEvents) {
        const d = pe.deadline || pe.eventDate;
        if (d && d > now && pe.status !== 'COMPLETED') {
          upcoming.push({
            title: pe.title,
            type: 'personal',
            category: pe.category,
            deadline: d.toISOString().split('T')[0],
            status: pe.status,
          });
        }
      }

      // 按截止日期排序，取前 8 个
      upcoming.sort((a, b) =>
        (a.deadline || '').localeCompare(b.deadline || ''),
      );
      const topUpcoming = upcoming.slice(0, 8);

      const context: UserContext = {
        userId,
        profile: profile
          ? this.toProfileSnapshot({
              id: profile.id,
              userId: profile.userId,
              gpa: profile.gpa ? Number(profile.gpa) : undefined,
              gpaScale: profile.gpaScale ? Number(profile.gpaScale) : undefined,
              targetMajor: profile.targetMajor || undefined,
              budgetTier: profile.budgetTier || undefined,
              grade: profile.grade || undefined,
              testScores: profile.testScores?.map((s) => ({
                type: s.type,
                score: s.score,
              })),
              activities: profile.activities?.map((a) => ({
                name: a.name,
                role: a.role || '参与者',
                category: a.category,
              })),
              awards: profile.awards?.map((a) => ({
                name: a.name,
                level: a.level,
              })),
            })
          : undefined,
        timelineSummary: {
          schoolApps: timelines.length,
          personalEvents: personalEvents.length,
          upcoming: topUpcoming,
        },
      };

      // 带时间戳缓存
      this.userContexts.set(userId, { data: context, timestamp: Date.now() });
      return context;
    } catch (error) {
      this.logger.error('Failed to load user context', error);
      return { userId };
    }
  }

  /**
   * 刷新用户上下文
   */
  async refreshUserContext(userId: string): Promise<UserContext> {
    this.userContexts.delete(userId);
    return this.loadUserContext(userId);
  }

  /**
   * 更新上下文中的特定字段
   */
  updateContext(userId: string, updates: Partial<UserContext>) {
    const cached = this.userContexts.get(userId);
    const context = cached?.data || { userId };
    Object.assign(context, updates);
    this.userContexts.set(userId, { data: context, timestamp: Date.now() });
  }

  /**
   * 转换为档案快照
   */
  private toProfileSnapshot(profile: ProfileData): ProfileSnapshot {
    return {
      gpa: profile.gpa ? Number(profile.gpa) : undefined,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      testScores: profile.testScores?.length
        ? profile.testScores.map((s: TestScoreData) => ({
            type: s.type,
            score: s.score,
          }))
        : [],
      activities: profile.activities?.length
        ? profile.activities.map((a: ActivityData) => ({
            name: a.name,
            role: a.role || '参与者',
            category: a.category,
          }))
        : [],
      awards: profile.awards?.length
        ? profile.awards.map((a: AwardData) => ({
            name: a.name,
            level: a.level,
          }))
        : [],
      targetMajor: profile.targetMajor || undefined,
      budgetTier: profile.budgetTier || undefined,
      grade: profile.grade || undefined,
    };
  }

  /**
   * 生成上下文摘要（用于 system prompt）
   */
  getContextSummary(context: UserContext): string {
    const parts: string[] = [];

    // 档案摘要
    if (context.profile) {
      const p = context.profile;
      if (p.gpa) {
        parts.push(`GPA: ${p.gpa}/${p.gpaScale || 4.0}`);
      }
      if (p.testScores?.length) {
        parts.push(
          `标化: ${p.testScores.map((s) => `${s.type} ${s.score}`).join(', ')}`,
        );
      }
      if (p.targetMajor) {
        parts.push(`目标专业: ${p.targetMajor}`);
      }
      if (p.activities?.length) {
        parts.push(`活动: ${p.activities.length}项`);
      }
      if (p.awards?.length) {
        parts.push(`奖项: ${p.awards.length}项`);
      }
    }

    // 时间线摘要
    const ts = context.timelineSummary;
    if (ts && (ts.schoolApps > 0 || ts.personalEvents > 0)) {
      const tlParts: string[] = [];
      if (ts.schoolApps > 0) tlParts.push(`${ts.schoolApps}所学校申请`);
      if (ts.personalEvents > 0) tlParts.push(`${ts.personalEvents}项个人事件`);
      parts.push(`时间线: ${tlParts.join(', ')}`);

      if (ts.upcoming.length > 0) {
        const deadlineStr = ts.upcoming
          .slice(0, 3)
          .map((u) => {
            const label =
              u.type === 'school' ? u.title : `${u.title}(${u.category})`;
            return `${label} ${u.deadline}`;
          })
          .join('; ');
        parts.push(`近期截止: ${deadlineStr}`);
      }
    }

    return parts.length > 0 ? parts.join(' | ') : '用户档案为空';
  }
}
