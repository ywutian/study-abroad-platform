/**
 * Agent 记忆服务 - 管理对话历史和用户上下文
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConversationState, Message, UserContext, ProfileSnapshot } from '../types';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  
  // 内存存储 (生产环境应使用 Redis)
  private conversations: Map<string, ConversationState> = new Map();
  private userContexts: Map<string, UserContext> = new Map();

  constructor(private prisma: PrismaService) {}

  // ==================== 对话管理 ====================

  /**
   * 获取或创建对话
   */
  async getOrCreateConversation(
    userId: string,
    conversationId?: string,
  ): Promise<ConversationState> {
    const id = conversationId || `conv_${userId}_${Date.now()}`;
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
  addMessage(conversation: ConversationState, message: Omit<Message, 'id' | 'timestamp'>): Message {
    const fullMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };
    
    conversation.messages.push(fullMessage);
    conversation.updatedAt = new Date();
    
    return fullMessage;
  }

  /**
   * 获取最近消息（用于构建 prompt）
   */
  getRecentMessages(conversation: ConversationState, limit: number = 20): Message[] {
    // 过滤掉工具消息中的详细数据，只保留关键信息
    return conversation.messages.slice(-limit).map(m => {
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
   * 简化工具结果（避免 context 过长）
   */
  private summarizeToolResult(data: any): any {
    if (Array.isArray(data)) {
      return data.slice(0, 5).map(item => 
        typeof item === 'object' ? this.pickKeys(item, 5) : item
      );
    }
    if (typeof data === 'object' && data !== null) {
      return this.pickKeys(data, 10);
    }
    return data;
  }

  private pickKeys(obj: Record<string, any>, maxKeys: number): Record<string, any> {
    const keys = Object.keys(obj).slice(0, maxKeys);
    const result: Record<string, any> = {};
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.pickKeys(value, 3);
      } else if (Array.isArray(value)) {
        result[key] = value.slice(0, 3);
      } else {
        result[key] = value;
      }
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
      for (const key of this.conversations.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.conversations.delete(key);
        }
      }
    }
  }

  // ==================== 用户上下文 ====================

  /**
   * 加载用户上下文
   */
  async loadUserContext(userId: string): Promise<UserContext> {
    // 先检查缓存
    const cached = this.userContexts.get(userId);
    if (cached) {
      return cached;
    }

    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        include: {
          testScores: true,
          activities: { take: 10 },
          awards: { take: 10 },
        },
      });

      const context: UserContext = {
        userId,
        profile: profile ? this.toProfileSnapshot(profile) : undefined,
      };

      this.userContexts.set(userId, context);
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
    const context = this.userContexts.get(userId) || { userId };
    Object.assign(context, updates);
    this.userContexts.set(userId, context);
  }

  /**
   * 转换为档案快照
   */
  private toProfileSnapshot(profile: any): ProfileSnapshot {
    return {
      gpa: profile.gpa ? Number(profile.gpa) : undefined,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      testScores: profile.testScores?.map((s: any) => ({
        type: s.type,
        score: s.score,
      })),
      activities: profile.activities?.map((a: any) => ({
        name: a.name,
        role: a.role,
        category: a.category,
      })),
      awards: profile.awards?.map((a: any) => ({
        name: a.name,
        level: a.level,
      })),
      targetMajor: profile.targetMajor || undefined,
      budgetTier: profile.budgetTier || undefined,
      grade: profile.grade || undefined,
    };
  }

  /**
   * 生成上下文摘要（用于 system prompt）
   */
  getContextSummary(context: UserContext): string {
    if (!context.profile) {
      return '用户档案为空';
    }

    const parts: string[] = [];
    const p = context.profile;

    if (p.gpa) {
      parts.push(`GPA: ${p.gpa}/${p.gpaScale || 4.0}`);
    }
    if (p.testScores?.length) {
      parts.push(`标化: ${p.testScores.map(s => `${s.type} ${s.score}`).join(', ')}`);
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

    return parts.length > 0 ? parts.join(' | ') : '档案信息不完整';
  }
}









