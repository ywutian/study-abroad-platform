/**
 * Token 追踪与配额管理
 *
 * 使用 Redis 存储使用统计，支持跨实例共享
 * Redis 不可用时降级为内存 LRU 缓存
 *
 * Token 计算：使用 tiktoken 精确计算
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { ChatCompletionResponse, TokenUsageMetadata } from './types';
import { getEncoding, Tiktoken, TiktokenEncoding } from 'js-tiktoken';
import { LRUCache } from 'lru-cache';

// 模型到编码的映射
const MODEL_ENCODING_MAP: Record<string, TiktokenEncoding> = {
  // GPT-4o 系列使用 o200k_base
  'gpt-4o': 'o200k_base',
  'gpt-4o-mini': 'o200k_base',
  'gpt-4o-2024-05-13': 'o200k_base',
  'gpt-4o-2024-08-06': 'o200k_base',
  'gpt-4o-mini-2024-07-18': 'o200k_base',

  // GPT-4 和 GPT-3.5 使用 cl100k_base
  'gpt-4': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4-turbo-preview': 'cl100k_base',
  'gpt-4-0125-preview': 'cl100k_base',
  'gpt-4-1106-preview': 'cl100k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  'gpt-3.5-turbo-0125': 'cl100k_base',
  'gpt-3.5-turbo-1106': 'cl100k_base',

  // Embedding 模型
  'text-embedding-ada-002': 'cl100k_base',
  'text-embedding-3-small': 'cl100k_base',
  'text-embedding-3-large': 'cl100k_base',
};

// Chat 消息格式开销（OpenAI 官方规范）
const CHAT_MESSAGE_OVERHEAD: Record<
  string,
  { perMessage: number; perName: number; reply: number }
> = {
  'gpt-4o': { perMessage: 3, perName: 1, reply: 3 },
  'gpt-4o-mini': { perMessage: 3, perName: 1, reply: 3 },
  'gpt-4': { perMessage: 3, perName: 1, reply: 3 },
  'gpt-4-turbo': { perMessage: 3, perName: 1, reply: 3 },
  'gpt-3.5-turbo': { perMessage: 4, perName: -1, reply: 3 }, // 3.5 略有不同
  default: { perMessage: 3, perName: 1, reply: 3 },
};

import {
  DEFAULT_TOKEN_QUOTAS,
  PRO_TOKEN_QUOTAS,
  PREMIUM_TOKEN_QUOTAS,
  TOKEN_PRICES,
} from '../constants';

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

// LRU 缓存类型
interface UsageCacheEntry {
  daily: { tokens: number; cost: number; calls: number; date: string };
  monthly: { tokens: number; cost: number; calls: number; month: string };
}

// LRU 缓存配置
const USAGE_CACHE_CONFIG = {
  max: 1000, // 最多 1000 个用户
  ttl: 60 * 60 * 1000, // 1 小时 TTL
  updateAgeOnGet: false, // 不更新年龄，确保 TTL 后真正过期
  updateAgeOnHas: false,
  allowStale: false,
};

@Injectable()
export class TokenTrackerService implements OnModuleInit {
  private readonly logger = new Logger(TokenTrackerService.name);

  // Tiktoken encoders（按编码类型缓存）
  private encoders: Map<TiktokenEncoding, Tiktoken> = new Map();
  private encoderReady = false;

  // 内存降级缓存 - 使用 LRU 防止内存泄漏
  private fallbackCache: LRUCache<string, UsageCacheEntry>;

  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {
    // 初始化 LRU 缓存
    this.fallbackCache = new LRUCache<string, UsageCacheEntry>(
      USAGE_CACHE_CONFIG,
    );
  }

  /**
   * 模块初始化时预加载常用 encoders
   */
  onModuleInit() {
    try {
      // 预加载两种常用编码
      this.encoders.set('cl100k_base', getEncoding('cl100k_base'));
      this.encoders.set('o200k_base', getEncoding('o200k_base'));
      this.encoderReady = true;
      this.logger.log(
        'Tiktoken encoders initialized (cl100k_base, o200k_base)',
      );
    } catch (err) {
      this.logger.warn(
        `Failed to initialize tiktoken encoders: ${err}. Using fallback estimation.`,
      );
      this.encoderReady = false;
    }
  }

  /**
   * 获取模型对应的 encoder
   */
  private getEncoder(model: string): Tiktoken | null {
    if (!this.encoderReady) return null;

    const encoding = MODEL_ENCODING_MAP[model] || 'cl100k_base';
    return this.encoders.get(encoding) || null;
  }

  /**
   * 记录 Token 使用
   */
  async trackUsage(
    userId: string,
    usage: TokenUsage,
    metadata?: TokenUsageMetadata,
  ): Promise<void> {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const monthKey = dateKey.substring(0, 7);

    const client = this.redis.getClient();

    if (client && this.redis.connected) {
      try {
        // 使用 Redis pipeline 原子操作
        const pipeline = client.pipeline();

        // 日统计
        const dailyKey = `token:daily:${userId}:${dateKey}`;
        pipeline.hincrby(dailyKey, 'tokens', usage.totalTokens);
        pipeline.hincrbyfloat(dailyKey, 'cost', usage.estimatedCost);
        pipeline.hincrby(dailyKey, 'calls', 1);
        pipeline.expire(dailyKey, 86400 * 2); // 2天过期

        // 月统计
        const monthlyKey = `token:monthly:${userId}:${monthKey}`;
        pipeline.hincrby(monthlyKey, 'tokens', usage.totalTokens);
        pipeline.hincrbyfloat(monthlyKey, 'cost', usage.estimatedCost);
        pipeline.hincrby(monthlyKey, 'calls', 1);
        pipeline.expire(monthlyKey, 86400 * 35); // 35天过期

        await pipeline.exec();
      } catch (err) {
        this.logger.debug(`Redis trackUsage failed, using fallback: ${err}`);
        this.trackUsageFallback(userId, usage, dateKey, monthKey);
      }
    } else {
      this.trackUsageFallback(userId, usage, dateKey, monthKey);
    }

    // 异步持久化到数据库
    this.persistUsage(userId, usage, metadata, now).catch((err) => {
      this.logger.error('Failed to persist usage', err);
    });

    // 检查配额警告
    this.checkQuotaWarningAsync(userId);
  }

  /**
   * 内存降级追踪
   */
  private trackUsageFallback(
    userId: string,
    usage: TokenUsage,
    dateKey: string,
    monthKey: string,
  ): void {
    const cache = this.getOrCreateFallbackCache(userId);

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
    const quota = await this.getUserQuota(userId);
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const monthKey = dateKey.substring(0, 7);

    const client = this.redis.getClient();

    let daily = { tokens: 0, cost: 0, calls: 0 };
    let monthly = { tokens: 0, cost: 0, calls: 0 };

    if (client && this.redis.connected) {
      try {
        const [dailyData, monthlyData] = await Promise.all([
          client.hgetall(`token:daily:${userId}:${dateKey}`),
          client.hgetall(`token:monthly:${userId}:${monthKey}`),
        ]);

        daily = {
          tokens: parseInt(dailyData.tokens || '0'),
          cost: parseFloat(dailyData.cost || '0'),
          calls: parseInt(dailyData.calls || '0'),
        };
        monthly = {
          tokens: parseInt(monthlyData.tokens || '0'),
          cost: parseFloat(monthlyData.cost || '0'),
          calls: parseInt(monthlyData.calls || '0'),
        };
      } catch (err) {
        this.logger.debug(`Redis getUsageStats failed, using fallback: ${err}`);
        return this.getUsageStatsFallback(userId, quota);
      }
    } else {
      return this.getUsageStatsFallback(userId, quota);
    }

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
   * 内存降级获取统计
   */
  private getUsageStatsFallback(
    userId: string,
    quota: typeof DEFAULT_TOKEN_QUOTAS,
  ): UsageStats {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const monthKey = dateKey.substring(0, 7);

    const cache = this.fallbackCache.get(userId);

    const daily =
      cache?.daily.date === dateKey
        ? cache.daily
        : { tokens: 0, cost: 0, calls: 0 };
    const monthly =
      cache?.monthly.month === monthKey
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
   * 精确计算 Token 数量（使用 tiktoken）
   *
   * @param text 要计算的文本
   * @param model 模型名称（可选，用于选择正确的编码）
   */
  countTokens(text: string, model: string = 'gpt-4o-mini'): number {
    const encoder = this.getEncoder(model);
    if (encoder) {
      try {
        return encoder.encode(text).length;
      } catch (err) {
        this.logger.debug(`Tiktoken encode failed, using fallback: ${err}`);
      }
    }
    return this.estimateTokensFallback(text);
  }

  /**
   * 估算 Token 数量（兼容旧接口）
   */
  estimateTokens(text: string): number {
    return this.countTokens(text);
  }

  /**
   * 降级估算（当 tiktoken 不可用时）
   */
  private estimateTokensFallback(text: string): number {
    // 粗略估算: 英文约 4 字符/token, 中文约 1.5 字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 精确计算 Chat Completion 消息的 Token 数量
   *
   * 基于 OpenAI 官方规范：
   * https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb
   */
  countChatTokens(
    messages: Array<{ role: string; content: string; name?: string }>,
    model: string = 'gpt-4o-mini',
  ): number {
    const encoder = this.getEncoder(model);
    const overhead =
      CHAT_MESSAGE_OVERHEAD[model] || CHAT_MESSAGE_OVERHEAD['default'];

    let total = 0;

    for (const msg of messages) {
      // 每条消息的基础开销
      total += overhead.perMessage;

      // role token
      total += encoder ? encoder.encode(msg.role).length : 1;

      // content tokens
      total += encoder
        ? encoder.encode(msg.content).length
        : this.estimateTokensFallback(msg.content);

      // name token（如果存在）
      if (msg.name) {
        total += overhead.perName;
        total += encoder
          ? encoder.encode(msg.name).length
          : msg.name.length / 4;
      }
    }

    // assistant 回复的起始开销
    total += overhead.reply;

    return total;
  }

  /**
   * 计算消息列表的 Token 数量（兼容旧接口）
   */
  countMessagesTokens(
    messages: Array<{ role: string; content: string }>,
    model: string = 'gpt-4o-mini',
  ): number {
    return this.countChatTokens(messages, model);
  }

  /**
   * 预估完整请求的 Token 数量（用于配额检查）
   */
  estimateRequestTokens(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      model?: string;
      maxResponseTokens?: number;
    },
  ): { promptTokens: number; estimatedTotal: number } {
    const model = options?.model || 'gpt-4o-mini';
    const maxResponseTokens = options?.maxResponseTokens || 1000;

    // 构建完整消息列表（包含 system prompt）
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const promptTokens = this.countChatTokens(fullMessages, model);

    return {
      promptTokens,
      estimatedTotal: promptTokens + maxResponseTokens,
    };
  }

  /**
   * 检查请求是否会超出上下文窗口
   */
  checkContextWindow(
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    model: string = 'gpt-4o-mini',
  ): {
    withinLimit: boolean;
    tokenCount: number;
    limit: number;
    remaining: number;
  } {
    const contextLimits: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16385,
    };

    const limit = contextLimits[model] || 128000;
    const tokenCount = this.estimateRequestTokens(systemPrompt, messages, {
      model,
    }).promptTokens;
    const remaining = limit - tokenCount;

    return {
      withinLimit: tokenCount < limit,
      tokenCount,
      limit,
      remaining,
    };
  }

  /**
   * 计算成本
   */
  calculateCost(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const prices =
      TOKEN_PRICES[model as keyof typeof TOKEN_PRICES] || TOKEN_PRICES.default;
    return (
      (promptTokens / 1000) * prices.input +
      (completionTokens / 1000) * prices.output
    );
  }

  /**
   * 从 API 响应解析 Token 使用
   */
  parseUsageFromResponse(
    response: ChatCompletionResponse,
    model: string,
  ): TokenUsage {
    const usage = response.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
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

  private getOrCreateFallbackCache(userId: string): UsageCacheEntry {
    let entry = this.fallbackCache.get(userId);
    if (!entry) {
      const now = new Date();
      const dateKey = now.toISOString().split('T')[0];
      const monthKey = dateKey.substring(0, 7);
      entry = {
        daily: { tokens: 0, cost: 0, calls: 0, date: dateKey },
        monthly: { tokens: 0, cost: 0, calls: 0, month: monthKey },
      };
      this.fallbackCache.set(userId, entry);
    }
    return entry;
  }

  /**
   * 获取缓存统计信息（用于监控）
   */
  getCacheStats(): { size: number; max: number } {
    return {
      size: this.fallbackCache.size,
      max: USAGE_CACHE_CONFIG.max,
    };
  }

  private async getUserQuota(
    userId: string,
  ): Promise<typeof DEFAULT_TOKEN_QUOTAS> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      if (user?.role === 'ADMIN') return PREMIUM_TOKEN_QUOTAS;
      if (user?.role === 'VERIFIED') return PRO_TOKEN_QUOTAS;
    } catch {
      // 查询失败时用默认配额，不阻塞主流程
    }
    return DEFAULT_TOKEN_QUOTAS;
  }

  private async persistUsage(
    userId: string,
    usage: TokenUsage,
    metadata: TokenUsageMetadata | undefined,
    timestamp: Date,
  ): Promise<void> {
    try {
      // 持久化到数据库
      await this.prisma.$executeRaw`
        INSERT INTO "AgentTokenUsage" (
          id, "userId", "conversationId", "agentType", model,
          "promptTokens", "completionTokens", "totalTokens", cost,
          "toolName", metadata, "createdAt"
        ) VALUES (
          ${`usage_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
          ${userId},
          ${metadata?.conversationId || null},
          ${metadata?.agentType || null},
          ${usage.model},
          ${usage.promptTokens},
          ${usage.completionTokens},
          ${usage.totalTokens},
          ${usage.estimatedCost},
          ${metadata?.toolName || null},
          ${JSON.stringify(metadata || {})}::jsonb,
          ${timestamp}
        )
      `;
    } catch (err) {
      // 数据库写入失败不影响主流程
      this.logger.error(`Failed to persist usage to DB: ${err}`);
    }

    this.logger.debug(
      `Token usage: user=${userId}, tokens=${usage.totalTokens}, cost=$${usage.estimatedCost.toFixed(4)}`,
    );
  }

  private async checkQuotaWarningAsync(userId: string): Promise<void> {
    try {
      const stats = await this.getUsageStats(userId);
      const quota = DEFAULT_TOKEN_QUOTAS;

      // 80% 警告
      if (stats.today.tokens > quota.dailyTokens * 0.8) {
        this.logger.warn(
          `User ${userId} approaching daily token limit: ${stats.today.tokens}/${quota.dailyTokens}`,
        );
      }
      if (stats.today.cost > quota.dailyCost * 0.8) {
        this.logger.warn(
          `User ${userId} approaching daily cost limit: $${stats.today.cost.toFixed(2)}/$${quota.dailyCost}`,
        );
      }
    } catch (err) {
      // 忽略警告检查错误
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
