/**
 * Token 追踪与配额管理
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// Token 价格 (USD per 1K tokens) - GPT-4o-mini 为例
const TOKEN_PRICES = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  default: { input: 0.001, output: 0.002 },
};

// 默认配额
const DEFAULT_QUOTAS = {
  dailyTokens: 100000,      // 日 Token 限额
  monthlyTokens: 2000000,   // 月 Token 限额
  dailyCost: 5.0,           // 日成本限额 (USD)
  monthlyCost: 100.0,       // 月成本限额 (USD)
};

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  model: string;
}

export interface UsageStats {
  today: {
    tokens: number;
    cost: number;
    calls: number;
  };
  thisMonth: {
    tokens: number;
    cost: number;
    calls: number;
  };
  quota: {
    dailyTokens: number;
    monthlyTokens: number;
    dailyCost: number;
    monthlyCost: number;
  };
  remaining: {
    dailyTokens: number;
    monthlyTokens: number;
    dailyCost: number;
    monthlyCost: number;
  };
}

@Injectable()
export class TokenTrackerService {
  private readonly logger = new Logger(TokenTrackerService.name);
  
  // 内存缓存 (生产环境应使用 Redis)
  private usageCache: Map<string, {
    daily: { tokens: number; cost: number; calls: number; date: string };
    monthly: { tokens: number; cost: number; calls: number; month: string };
  }> = new Map();

  constructor(private prisma: PrismaService) {}

  /**
   * 记录 Token 使用
   */
  async trackUsage(
    userId: string,
    usage: TokenUsage,
    metadata?: {
      conversationId?: string;
      agentType?: string;
      toolName?: string;
    },
  ): Promise<void> {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const monthKey = dateKey.substring(0, 7);

    // 更新内存缓存
    const cache = this.getOrCreateCache(userId);
    
    // 检查日期是否需要重置
    if (cache.daily.date !== dateKey) {
      cache.daily = { tokens: 0, cost: 0, calls: 0, date: dateKey };
    }
    if (cache.monthly.month !== monthKey) {
      cache.monthly = { tokens: 0, cost: 0, calls: 0, month: monthKey };
    }

    // 累加使用量
    cache.daily.tokens += usage.totalTokens;
    cache.daily.cost += usage.estimatedCost;
    cache.daily.calls += 1;
    cache.monthly.tokens += usage.totalTokens;
    cache.monthly.cost += usage.estimatedCost;
    cache.monthly.calls += 1;

    // 异步持久化到数据库
    this.persistUsage(userId, usage, metadata, now).catch(err => {
      this.logger.error('Failed to persist usage', err);
    });

    // 检查配额警告
    this.checkQuotaWarning(userId, cache);
  }

  /**
   * 检查是否超出配额
   */
  async checkQuota(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    usage: UsageStats;
  }> {
    const stats = await this.getUsageStats(userId);
    const quota = await this.getUserQuota(userId);

    // 检查各项限制
    if (stats.today.tokens >= quota.dailyTokens) {
      return {
        allowed: false,
        reason: `已达到每日 Token 限额 (${quota.dailyTokens.toLocaleString()})`,
        usage: stats,
      };
    }

    if (stats.today.cost >= quota.dailyCost) {
      return {
        allowed: false,
        reason: `已达到每日成本限额 ($${quota.dailyCost})`,
        usage: stats,
      };
    }

    if (stats.thisMonth.tokens >= quota.monthlyTokens) {
      return {
        allowed: false,
        reason: `已达到每月 Token 限额 (${quota.monthlyTokens.toLocaleString()})`,
        usage: stats,
      };
    }

    if (stats.thisMonth.cost >= quota.monthlyCost) {
      return {
        allowed: false,
        reason: `已达到每月成本限额 ($${quota.monthlyCost})`,
        usage: stats,
      };
    }

    return { allowed: true, usage: stats };
  }

  /**
   * 获取使用统计
   */
  async getUsageStats(userId: string): Promise<UsageStats> {
    const cache = this.getOrCreateCache(userId);
    const quota = await this.getUserQuota(userId);
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const monthKey = dateKey.substring(0, 7);

    // 检查缓存是否过期
    const daily = cache.daily.date === dateKey 
      ? cache.daily 
      : { tokens: 0, cost: 0, calls: 0 };
    const monthly = cache.monthly.month === monthKey 
      ? cache.monthly 
      : { tokens: 0, cost: 0, calls: 0 };

    return {
      today: daily,
      thisMonth: monthly,
      quota,
      remaining: {
        dailyTokens: Math.max(0, quota.dailyTokens - daily.tokens),
        monthlyTokens: Math.max(0, quota.monthlyTokens - monthly.tokens),
        dailyCost: Math.max(0, quota.dailyCost - daily.cost),
        monthlyCost: Math.max(0, quota.monthlyCost - monthly.cost),
      },
    };
  }

  /**
   * 估算 Token 数量
   */
  estimateTokens(text: string): number {
    // 粗略估算: 英文约 4 字符/token, 中文约 2 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 计算成本
   */
  calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const prices = TOKEN_PRICES[model as keyof typeof TOKEN_PRICES] || TOKEN_PRICES.default;
    return (
      (promptTokens / 1000) * prices.input +
      (completionTokens / 1000) * prices.output
    );
  }

  /**
   * 从 API 响应解析 Token 使用
   */
  parseUsageFromResponse(response: any, model: string): TokenUsage {
    const usage = response.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost: this.calculateCost(model, promptTokens, completionTokens),
      model,
    };
  }

  // ==================== 私有方法 ====================

  private getOrCreateCache(userId: string) {
    if (!this.usageCache.has(userId)) {
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const monthKey = dateKey.substring(0, 7);
      this.usageCache.set(userId, {
        daily: { tokens: 0, cost: 0, calls: 0, date: dateKey },
        monthly: { tokens: 0, cost: 0, calls: 0, month: monthKey },
      });
    }
    return this.usageCache.get(userId)!;
  }

  private async getUserQuota(userId: string): Promise<typeof DEFAULT_QUOTAS> {
    // TODO: 从数据库获取用户自定义配额
    // const userSettings = await this.prisma.userSettings.findUnique({ where: { userId } });
    // return userSettings?.aiQuota || DEFAULT_QUOTAS;
    return DEFAULT_QUOTAS;
  }

  private async persistUsage(
    userId: string,
    usage: TokenUsage,
    metadata: any,
    timestamp: Date,
  ): Promise<void> {
    // 持久化到数据库（需要添加 TokenUsage 表）
    // await this.prisma.tokenUsage.create({
    //   data: {
    //     userId,
    //     model: usage.model,
    //     promptTokens: usage.promptTokens,
    //     completionTokens: usage.completionTokens,
    //     totalTokens: usage.totalTokens,
    //     cost: usage.estimatedCost,
    //     conversationId: metadata?.conversationId,
    //     agentType: metadata?.agentType,
    //     createdAt: timestamp,
    //   },
    // });
    
    this.logger.debug(
      `Token usage: user=${userId}, tokens=${usage.totalTokens}, cost=$${usage.estimatedCost.toFixed(4)}`,
    );
  }

  private checkQuotaWarning(
    userId: string,
    cache: ReturnType<typeof this.getOrCreateCache>,
  ): void {
    const quota = DEFAULT_QUOTAS;
    
    // 80% 警告
    if (cache.daily.tokens > quota.dailyTokens * 0.8) {
      this.logger.warn(`User ${userId} approaching daily token limit: ${cache.daily.tokens}/${quota.dailyTokens}`);
    }
    if (cache.daily.cost > quota.dailyCost * 0.8) {
      this.logger.warn(`User ${userId} approaching daily cost limit: $${cache.daily.cost.toFixed(2)}/$${quota.dailyCost}`);
    }
  }
}

// 配额超限错误
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}


