/**
 * 记忆评分服务 - 企业级多维评分系统
 *
 * 评分公式:
 * Score = (Importance × W_i) + (Freshness × W_f) + (Confidence × W_c) + AccessBonus
 *
 * 默认权重: W_i=0.4, W_f=0.3, W_c=0.3
 */

import { Injectable, Logger } from '@nestjs/common';
import { MemoryType } from '@prisma/client';

// ==================== 类型定义 ====================

export interface ScoringWeights {
  importance: number; // 重要性权重 (默认 0.4)
  freshness: number; // 新鲜度权重 (默认 0.3)
  confidence: number; // 置信度权重 (默认 0.3)
}

export interface ScoringConfig {
  weights: ScoringWeights;
  decayRate: number; // 衰减率 λ (默认 0.01)
  accessBoostRate: number; // 访问加成率 (默认 0.02)
  maxAccessBonus: number; // 最大访问加成 (默认 0.2)
}

export interface MemoryScoreInput {
  type: MemoryType;
  content: string;
  importance: number; // 基础重要性 [0, 1]
  confidence: number; // 提取置信度 [0, 1]
  createdAt: Date;
  accessCount?: number;
  lastAccessedAt?: Date;
  metadata?: Record<string, any>;
}

export interface MemoryScoreResult {
  totalScore: number; // 综合评分 [0, 1]
  components: {
    importanceScore: number;
    freshnessScore: number;
    confidenceScore: number;
    accessBonus: number;
  };
  tier: MemoryTier; // 推荐存储层级
  shouldDecay: boolean; // 是否应该衰减
  shouldArchive: boolean; // 是否应该归档
}

export enum MemoryTier {
  WORKING = 'WORKING', // L1: 工作记忆 (RAM)
  SHORT = 'SHORT', // L2: 短期记忆 (Redis)
  LONG = 'LONG', // L3: 长期记忆 (PostgreSQL)
  ARCHIVE = 'ARCHIVE', // L4: 归档 (冷存储)
}

// ==================== 重要性规则 ====================

interface ImportanceRule {
  base: number;
  boosts: Array<{
    condition: (input: MemoryScoreInput) => boolean;
    boost: number;
    description: string;
  }>;
}

const IMPORTANCE_RULES: Partial<Record<MemoryType, ImportanceRule>> = {
  // === 核心事实 (高重要性 0.85-1.0) ===
  [MemoryType.FACT]: {
    base: 0.8,
    boosts: [
      {
        condition: (input) => /GPA|绩点/i.test(input.content),
        boost: 0.1,
        description: 'GPA 相关',
      },
      {
        condition: (input) => /SAT|ACT/i.test(input.content),
        boost: 0.1,
        description: '标化成绩',
      },
      {
        condition: (input) => /TOEFL|IELTS|托福|雅思/i.test(input.content),
        boost: 0.05,
        description: '语言成绩',
      },
      {
        condition: (input) => /1[45]\d{2}|1600/.test(input.content), // SAT 1400+
        boost: 0.05,
        description: '高分成绩',
      },
      {
        condition: (input) => /3\.[89]|4\.0/.test(input.content), // GPA 3.8+
        boost: 0.05,
        description: '高 GPA',
      },
    ],
  },

  // === 偏好型 (中等重要性 0.5-0.7) ===
  [MemoryType.PREFERENCE]: {
    base: 0.6,
    boosts: [
      {
        condition: (input) => /明确|确定|决定/.test(input.content),
        boost: 0.1,
        description: '明确表态',
      },
      {
        condition: (input) => /ED|早申/.test(input.content),
        boost: 0.15,
        description: 'ED 相关',
      },
      {
        condition: (input) => /专业|major/i.test(input.content),
        boost: 0.1,
        description: '专业相关',
      },
    ],
  },

  // === 决策型 (高重要性 0.9-1.0) ===
  [MemoryType.DECISION]: {
    base: 0.9,
    boosts: [
      {
        condition: (input) => /ED|绑定/.test(input.content),
        boost: 0.1,
        description: 'ED 决定',
      },
      {
        condition: (input) => /最终|确定/.test(input.content),
        boost: 0.05,
        description: '最终决定',
      },
    ],
  },

  // === 摘要型 (中等重要性 0.6-0.7) ===
  [MemoryType.SUMMARY]: {
    base: 0.6,
    boosts: [
      {
        condition: (input) => (input.metadata?.messageCount || 0) > 20,
        boost: 0.1,
        description: '长对话摘要',
      },
    ],
  },

  // === 反馈型 (低重要性 0.4-0.5) ===
  [MemoryType.FEEDBACK]: {
    base: 0.4,
    boosts: [
      {
        condition: (input) => /非常|特别|很/.test(input.content),
        boost: 0.1,
        description: '强烈反馈',
      },
    ],
  },
};

// ==================== 服务实现 ====================

@Injectable()
export class MemoryScorerService {
  private readonly logger = new Logger(MemoryScorerService.name);
  private config: ScoringConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * 计算记忆综合评分
   */
  score(input: MemoryScoreInput): MemoryScoreResult {
    // 1. 计算重要性得分
    const importanceScore = this.calculateImportance(input);

    // 2. 计算新鲜度得分
    const freshnessScore = this.calculateFreshness(input.createdAt);

    // 3. 置信度得分
    const confidenceScore = Math.max(0, Math.min(1, input.confidence));

    // 4. 访问加成
    const accessBonus = this.calculateAccessBonus(input.accessCount || 0);

    // 5. 计算综合得分
    const { weights } = this.config;
    const totalScore = Math.min(
      1,
      importanceScore * weights.importance +
        freshnessScore * weights.freshness +
        confidenceScore * weights.confidence +
        accessBonus,
    );

    // 6. 确定存储层级
    const tier = this.determineTier(totalScore, input);

    // 7. 判断是否需要衰减/归档
    const shouldDecay = freshnessScore < 0.5 && importanceScore < 0.7;
    const shouldArchive = freshnessScore < 0.2 && totalScore < 0.3;

    return {
      totalScore,
      components: {
        importanceScore,
        freshnessScore,
        confidenceScore,
        accessBonus,
      },
      tier,
      shouldDecay,
      shouldArchive,
    };
  }

  /**
   * 批量评分
   */
  scoreBatch(inputs: MemoryScoreInput[]): MemoryScoreResult[] {
    return inputs.map((input) => this.score(input));
  }

  /**
   * 计算重要性得分
   */
  private calculateImportance(input: MemoryScoreInput): number {
    const rule = IMPORTANCE_RULES[input.type];

    if (!rule) {
      // 未定义规则的类型，使用输入的重要性
      return input.importance;
    }

    let importance = rule.base;

    // 应用加分规则
    for (const boost of rule.boosts) {
      if (boost.condition(input)) {
        importance += boost.boost;
        this.logger.debug(
          `Applied boost: ${boost.description} (+${boost.boost})`,
        );
      }
    }

    // 与输入重要性取平均（兼容旧系统）
    importance = (importance + input.importance) / 2;

    return Math.max(0, Math.min(1, importance));
  }

  /**
   * 计算新鲜度得分 (指数衰减)
   *
   * Freshness(t) = exp(-λ × t)
   * 其中 t 是距离创建的天数
   */
  private calculateFreshness(createdAt: Date): number {
    const now = new Date();
    const daysSinceCreation =
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // 指数衰减
    const freshness = Math.exp(-this.config.decayRate * daysSinceCreation);

    return Math.max(0, Math.min(1, freshness));
  }

  /**
   * 计算访问加成
   *
   * AccessBonus = min(accessCount × boostRate, maxBonus)
   */
  private calculateAccessBonus(accessCount: number): number {
    const bonus = accessCount * this.config.accessBoostRate;
    return Math.min(bonus, this.config.maxAccessBonus);
  }

  /**
   * 确定存储层级
   */
  private determineTier(score: number, input: MemoryScoreInput): MemoryTier {
    // 决策类型始终存长期
    if (input.type === MemoryType.DECISION) {
      return MemoryTier.LONG;
    }

    // 根据评分确定层级
    if (score >= 0.8) {
      return MemoryTier.LONG;
    } else if (score >= 0.5) {
      return MemoryTier.SHORT;
    } else if (score >= 0.2) {
      return MemoryTier.WORKING;
    } else {
      return MemoryTier.ARCHIVE;
    }
  }

  /**
   * 获取新鲜度（用于外部查询）
   */
  getFreshness(createdAt: Date): number {
    return this.calculateFreshness(createdAt);
  }

  /**
   * 预测记忆在未来某天的评分
   */
  predictFutureScore(input: MemoryScoreInput, daysFromNow: number): number {
    const futureDate = new Date(input.createdAt);
    futureDate.setDate(futureDate.getDate() + daysFromNow);

    const futureFreshness = Math.exp(-this.config.decayRate * daysFromNow);

    const importanceScore = this.calculateImportance(input);
    const accessBonus = this.calculateAccessBonus(input.accessCount || 0);

    const { weights } = this.config;
    return Math.min(
      1,
      importanceScore * weights.importance +
        futureFreshness * weights.freshness +
        input.confidence * weights.confidence +
        accessBonus,
    );
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.weights) {
      this.config.weights = { ...this.config.weights, ...config.weights };
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): ScoringConfig {
    return { ...this.config };
  }

  private getDefaultConfig(): ScoringConfig {
    return {
      weights: {
        importance: 0.4,
        freshness: 0.3,
        confidence: 0.3,
      },
      decayRate: 0.01, // 每天衰减约 1%
      accessBoostRate: 0.02, // 每次访问加 2%
      maxAccessBonus: 0.2, // 最大加成 20%
    };
  }
}
