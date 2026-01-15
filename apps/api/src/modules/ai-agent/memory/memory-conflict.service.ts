/**
 * 记忆冲突处理服务 - 去重与冲突解决
 *
 * 功能:
 * 1. 检测记忆冲突
 * 2. 根据策略解决冲突
 * 3. 合并相似记忆
 * 4. 管理去重键
 */

import { Injectable, Logger } from '@nestjs/common';
import { MemoryType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

// ==================== 类型定义 ====================

/**
 * 冲突解决策略
 */
export enum ConflictStrategy {
  KEEP_LATEST = 'KEEP_LATEST', // 保留最新
  KEEP_HIGHEST = 'KEEP_HIGHEST', // 保留最高值（分数类）
  KEEP_OLDEST = 'KEEP_OLDEST', // 保留最旧
  MERGE = 'MERGE', // 合并内容
  KEEP_BOTH = 'KEEP_BOTH', // 都保留
  ASK_USER = 'ASK_USER', // 需要用户确认
}

/**
 * 去重规则
 */
export interface DedupeRule {
  type: MemoryType;
  category?: string;
  keyGenerator: (memory: MemoryInput) => string;
  strategy: ConflictStrategy;
  description: string;
}

/**
 * 记忆输入
 */
export interface MemoryInput {
  id?: string;
  userId: string;
  type: MemoryType;
  category?: string;
  content: string;
  importance: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

/**
 * 冲突检测结果
 */
export interface ConflictDetectionResult {
  hasConflict: boolean;
  existingMemory?: MemoryInput;
  conflictType?: 'exact' | 'semantic' | 'key';
  similarity?: number;
  suggestedStrategy: ConflictStrategy;
  dedupeKey?: string;
}

/**
 * 冲突解决结果
 */
export interface ConflictResolutionResult {
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'MERGE' | 'PENDING';
  memory: MemoryInput;
  reason: string;
  mergedFrom?: string[];
  requiresConfirmation?: boolean;
}

// ==================== 去重规则定义 ====================

const DEDUPE_RULES: DedupeRule[] = [
  // === 学术成绩 ===
  {
    type: MemoryType.FACT,
    category: 'academic',
    keyGenerator: (m) => {
      if (/GPA|绩点/i.test(m.content)) return `${m.userId}:gpa`;
      if (/排名|rank/i.test(m.content)) return `${m.userId}:rank`;
      return '';
    },
    strategy: ConflictStrategy.KEEP_LATEST,
    description: 'GPA/排名只保留最新',
  },

  // === 标化成绩 ===
  {
    type: MemoryType.FACT,
    category: 'test_score',
    keyGenerator: (m) => {
      if (/SAT/i.test(m.content)) return `${m.userId}:sat`;
      if (/ACT/i.test(m.content)) return `${m.userId}:act`;
      if (/TOEFL|托福/i.test(m.content)) return `${m.userId}:toefl`;
      if (/IELTS|雅思/i.test(m.content)) return `${m.userId}:ielts`;
      return '';
    },
    strategy: ConflictStrategy.KEEP_HIGHEST,
    description: '标化成绩保留最高分',
  },

  // === ED 决定 ===
  {
    type: MemoryType.DECISION,
    category: 'decision',
    keyGenerator: (m) => {
      if (/ED|早申|绑定/i.test(m.content)) return `${m.userId}:ed_decision`;
      return '';
    },
    strategy: ConflictStrategy.KEEP_LATEST,
    description: 'ED 决定只保留最新',
  },

  // === 专业偏好 ===
  {
    type: MemoryType.PREFERENCE,
    category: 'preference',
    keyGenerator: (m) => {
      if (/专业|major/i.test(m.content)) return `${m.userId}:major_pref`;
      return '';
    },
    strategy: ConflictStrategy.KEEP_LATEST,
    description: '专业偏好保留最新',
  },

  // === 学校偏好 ===
  {
    type: MemoryType.PREFERENCE,
    category: 'school',
    keyGenerator: (m) => {
      // 提取学校名称作为去重键
      const schoolMatch = m.content.match(
        /(MIT|Stanford|Harvard|Yale|Princeton|Berkeley|UCLA|Columbia|CMU|NYU|Duke)/i,
      );
      if (schoolMatch) {
        return `${m.userId}:school:${schoolMatch[1].toLowerCase()}`;
      }
      return '';
    },
    strategy: ConflictStrategy.MERGE,
    description: '同一学校偏好合并',
  },

  // === 对话摘要 ===
  {
    type: MemoryType.SUMMARY,
    keyGenerator: (m) => {
      const convId = m.metadata?.conversationId;
      if (convId) return `conv:${convId}:summary`;
      return '';
    },
    strategy: ConflictStrategy.KEEP_LATEST,
    description: '对话摘要只保留最新',
  },
];

// ==================== 服务实现 ====================

@Injectable()
export class MemoryConflictService {
  private readonly logger = new Logger(MemoryConflictService.name);
  private readonly semanticThreshold = 0.9; // 语义相似度阈值

  constructor(
    private prisma: PrismaService,
    private embedding: EmbeddingService,
  ) {}

  // ==================== 冲突检测 ====================

  /**
   * 检测新记忆是否与已有记忆冲突
   */
  async detectConflict(
    newMemory: MemoryInput,
  ): Promise<ConflictDetectionResult> {
    // 1. 检查去重键冲突
    const keyConflict = await this.checkKeyConflict(newMemory);
    if (keyConflict.hasConflict) {
      return keyConflict;
    }

    // 2. 检查精确内容匹配
    const exactConflict = await this.checkExactMatch(newMemory);
    if (exactConflict.hasConflict) {
      return exactConflict;
    }

    // 3. 检查语义相似性冲突（相似度 > 90%）
    const semanticConflict = await this.checkSemanticSimilarity(newMemory);
    if (semanticConflict.hasConflict) {
      return semanticConflict;
    }

    return {
      hasConflict: false,
      suggestedStrategy: ConflictStrategy.KEEP_BOTH,
    };
  }

  /**
   * 检查去重键冲突
   */
  private async checkKeyConflict(
    memory: MemoryInput,
  ): Promise<ConflictDetectionResult> {
    const rule = this.findMatchingRule(memory);
    if (!rule) {
      return {
        hasConflict: false,
        suggestedStrategy: ConflictStrategy.KEEP_BOTH,
      };
    }

    const dedupeKey = rule.keyGenerator(memory);
    if (!dedupeKey) {
      return {
        hasConflict: false,
        suggestedStrategy: ConflictStrategy.KEEP_BOTH,
      };
    }

    // 查找已有记忆
    const existing = await this.prisma.memory.findFirst({
      where: {
        userId: memory.userId,
        type: memory.type,
        metadata: {
          path: ['dedupeKey'],
          equals: dedupeKey,
        },
      },
    });

    if (existing) {
      return {
        hasConflict: true,
        existingMemory: {
          id: existing.id,
          userId: existing.userId,
          type: existing.type,
          category: existing.category || undefined,
          content: existing.content,
          importance: existing.importance,
          metadata: existing.metadata as Record<string, any>,
          createdAt: existing.createdAt,
        },
        conflictType: 'key',
        suggestedStrategy: rule.strategy,
        dedupeKey,
      };
    }

    return {
      hasConflict: false,
      suggestedStrategy: ConflictStrategy.KEEP_BOTH,
      dedupeKey, // 返回 key 以便存储时使用
    };
  }

  /**
   * 检查精确内容匹配
   */
  private async checkExactMatch(
    memory: MemoryInput,
  ): Promise<ConflictDetectionResult> {
    const existing = await this.prisma.memory.findFirst({
      where: {
        userId: memory.userId,
        type: memory.type,
        content: memory.content,
      },
    });

    if (existing) {
      return {
        hasConflict: true,
        existingMemory: {
          id: existing.id,
          userId: existing.userId,
          type: existing.type,
          category: existing.category || undefined,
          content: existing.content,
          importance: existing.importance,
          metadata: existing.metadata as Record<string, any>,
          createdAt: existing.createdAt,
        },
        conflictType: 'exact',
        similarity: 1.0,
        suggestedStrategy: ConflictStrategy.KEEP_LATEST,
      };
    }

    return {
      hasConflict: false,
      suggestedStrategy: ConflictStrategy.KEEP_BOTH,
    };
  }

  /**
   * 检查语义相似性
   */
  private async checkSemanticSimilarity(
    memory: MemoryInput,
  ): Promise<ConflictDetectionResult> {
    // 获取新记忆的向量
    const newEmbedding = await this.embedding.embed(memory.content);
    if (newEmbedding.length === 0) {
      return {
        hasConflict: false,
        suggestedStrategy: ConflictStrategy.KEEP_BOTH,
      };
    }

    // 使用 pgvector 查找相似记忆（排除 embedding 列避免 vector 反序列化错误）
    const similarMemories = await this.prisma.$queryRaw<any[]>`
      SELECT 
        m.id, m."userId", m.type, m.category, m.content, m.importance,
        m."accessCount", m."lastAccessedAt", m.metadata, m."expiresAt",
        m."createdAt", m."updatedAt",
        1 - (m.embedding <=> ${newEmbedding}::vector) AS similarity
      FROM "Memory" m
      WHERE 
        m."userId" = ${memory.userId}
        AND m.type = ${memory.type}::"MemoryType"
        AND m.embedding IS NOT NULL
        AND 1 - (m.embedding <=> ${newEmbedding}::vector) >= ${this.semanticThreshold}
      ORDER BY m.embedding <=> ${newEmbedding}::vector
      LIMIT 1
    `;

    if (similarMemories.length > 0) {
      const similar = similarMemories[0];
      return {
        hasConflict: true,
        existingMemory: {
          id: similar.id,
          userId: similar.userId,
          type: similar.type,
          category: similar.category || undefined,
          content: similar.content,
          importance: Number(similar.importance),
          metadata: similar.metadata,
          createdAt: similar.createdAt,
        },
        conflictType: 'semantic',
        similarity: Number(similar.similarity),
        suggestedStrategy: ConflictStrategy.MERGE,
      };
    }

    return {
      hasConflict: false,
      suggestedStrategy: ConflictStrategy.KEEP_BOTH,
    };
  }

  // ==================== 冲突解决 ====================

  /**
   * 解决记忆冲突
   */
  async resolveConflict(
    newMemory: MemoryInput,
    detection: ConflictDetectionResult,
    strategyOverride?: ConflictStrategy,
  ): Promise<ConflictResolutionResult> {
    const strategy = strategyOverride || detection.suggestedStrategy;
    const existingMemory = detection.existingMemory;

    if (!existingMemory) {
      return {
        action: 'CREATE',
        memory: this.addDedupeKey(newMemory, detection.dedupeKey),
        reason: '无冲突，直接创建',
      };
    }

    switch (strategy) {
      case ConflictStrategy.KEEP_LATEST:
        return this.resolveKeepLatest(
          newMemory,
          existingMemory,
          detection.dedupeKey,
        );

      case ConflictStrategy.KEEP_HIGHEST:
        return this.resolveKeepHighest(
          newMemory,
          existingMemory,
          detection.dedupeKey,
        );

      case ConflictStrategy.KEEP_OLDEST:
        return this.resolveKeepOldest(newMemory, existingMemory);

      case ConflictStrategy.MERGE:
        return this.resolveMerge(
          newMemory,
          existingMemory,
          detection.dedupeKey,
        );

      case ConflictStrategy.KEEP_BOTH:
        return {
          action: 'CREATE',
          memory: newMemory,
          reason: '策略允许保留多条',
        };

      case ConflictStrategy.ASK_USER:
        return {
          action: 'PENDING',
          memory: newMemory,
          reason: '需要用户确认',
          requiresConfirmation: true,
        };

      default:
        return {
          action: 'CREATE',
          memory: newMemory,
          reason: '未知策略，默认创建',
        };
    }
  }

  /**
   * 保留最新
   */
  private resolveKeepLatest(
    newMemory: MemoryInput,
    existingMemory: MemoryInput,
    dedupeKey?: string,
  ): ConflictResolutionResult {
    return {
      action: 'UPDATE',
      memory: {
        ...newMemory,
        id: existingMemory.id,
        metadata: {
          ...newMemory.metadata,
          dedupeKey,
          previousContent: existingMemory.content,
          updatedAt: new Date().toISOString(),
        },
      },
      reason: `保留最新记忆，替换旧记忆: "${existingMemory.content.slice(0, 50)}..."`,
    };
  }

  /**
   * 保留最高值
   */
  private resolveKeepHighest(
    newMemory: MemoryInput,
    existingMemory: MemoryInput,
    dedupeKey?: string,
  ): ConflictResolutionResult {
    const newValue = this.extractNumericValue(newMemory.content);
    const existValue = this.extractNumericValue(existingMemory.content);

    this.logger.debug(
      `Comparing values: new=${newValue}, existing=${existValue}`,
    );

    if (newValue > existValue) {
      return {
        action: 'UPDATE',
        memory: {
          ...newMemory,
          id: existingMemory.id,
          metadata: {
            ...newMemory.metadata,
            dedupeKey,
            previousValue: existValue,
            updatedAt: new Date().toISOString(),
          },
        },
        reason: `新值 ${newValue} > 旧值 ${existValue}，更新记忆`,
      };
    }

    return {
      action: 'SKIP',
      memory: existingMemory,
      reason: `旧值 ${existValue} >= 新值 ${newValue}，保留旧记忆`,
    };
  }

  /**
   * 保留最旧
   */
  private resolveKeepOldest(
    newMemory: MemoryInput,
    existingMemory: MemoryInput,
  ): ConflictResolutionResult {
    return {
      action: 'SKIP',
      memory: existingMemory,
      reason: '保留最早的记忆',
    };
  }

  /**
   * 合并记忆
   */
  private resolveMerge(
    newMemory: MemoryInput,
    existingMemory: MemoryInput,
    dedupeKey?: string,
  ): ConflictResolutionResult {
    // 合并内容（避免重复）
    const mergedContent = this.mergeContents(
      existingMemory.content,
      newMemory.content,
    );

    return {
      action: 'MERGE',
      memory: {
        ...existingMemory,
        content: mergedContent,
        importance: Math.max(existingMemory.importance, newMemory.importance),
        metadata: {
          ...existingMemory.metadata,
          ...newMemory.metadata,
          dedupeKey,
          mergedAt: new Date().toISOString(),
          mergeCount:
            ((existingMemory.metadata?.mergeCount as number) || 0) + 1,
        },
      },
      reason: '合并两条记忆内容',
      mergedFrom: [existingMemory.id!, newMemory.id || 'new'],
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * 查找匹配的去重规则
   */
  private findMatchingRule(memory: MemoryInput): DedupeRule | undefined {
    return DEDUPE_RULES.find((rule) => {
      if (rule.type !== memory.type) return false;
      if (rule.category && rule.category !== memory.category) return false;
      const key = rule.keyGenerator(memory);
      return key !== '';
    });
  }

  /**
   * 添加去重键到记忆
   */
  private addDedupeKey(memory: MemoryInput, dedupeKey?: string): MemoryInput {
    if (!dedupeKey) return memory;

    return {
      ...memory,
      metadata: {
        ...memory.metadata,
        dedupeKey,
      },
    };
  }

  /**
   * 提取数值（用于比较成绩）
   */
  private extractNumericValue(content: string): number {
    // SAT 分数 (400-1600)
    const satMatch = content.match(/(\d{3,4})\s*(?:分|分数)?/);
    if (satMatch) {
      const score = parseInt(satMatch[1]);
      if (score >= 400 && score <= 1600) return score;
    }

    // GPA (0-5)
    const gpaMatch = content.match(/(\d+\.?\d*)\s*(?:\/\s*\d+\.?\d*)?/);
    if (gpaMatch) {
      const gpa = parseFloat(gpaMatch[1]);
      if (gpa >= 0 && gpa <= 5) return gpa * 100; // 放大便于比较
    }

    // ACT (1-36)
    const actMatch = content.match(/(\d{1,2})\s*(?:分)?/);
    if (actMatch) {
      const score = parseInt(actMatch[1]);
      if (score >= 1 && score <= 36) return score * 10; // 放大便于比较
    }

    return 0;
  }

  /**
   * 合并内容
   */
  private mergeContents(existing: string, newContent: string): string {
    // 如果内容相同，直接返回
    if (existing === newContent) return existing;

    // 如果新内容是旧内容的子集，返回旧内容
    if (existing.includes(newContent)) return existing;

    // 如果旧内容是新内容的子集，返回新内容
    if (newContent.includes(existing)) return newContent;

    // 合并
    return `${existing}; ${newContent}`;
  }

  /**
   * 获取所有去重规则
   */
  getDedupeRules(): DedupeRule[] {
    return [...DEDUPE_RULES];
  }

  /**
   * 检查用户是否有待确认的冲突
   */
  async getPendingConflicts(userId: string): Promise<MemoryInput[]> {
    const memories = await this.prisma.memory.findMany({
      where: {
        userId,
        metadata: {
          path: ['pendingConflict'],
          equals: true,
        },
      },
    });

    return memories.map((m) => ({
      id: m.id,
      userId: m.userId,
      type: m.type,
      category: m.category || undefined,
      content: m.content,
      importance: m.importance,
      metadata: m.metadata as Record<string, any>,
      createdAt: m.createdAt,
    }));
  }
}
