/**
 * Agent 请求限流服务
 *
 * 使用 Redis ZSET 实现分布式滑动窗口限流
 * Redis 不可用时自动降级为内存限流
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../../../common/redis/redis.service';
import {
  RateLimitConfig,
  DEFAULT_RATE_LIMITS,
  VIP_RATE_LIMITS,
} from '../constants';

interface WindowEntry {
  timestamp: number;
  count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // 重置时间 (毫秒)
  limit: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  // 内存降级存储 (Redis 不可用时使用)
  private fallbackWindows: Map<string, WindowEntry[]> = new Map();

  // 自定义限流配置
  private customLimits: Map<string, RateLimitConfig> = new Map();

  constructor(private readonly redis: RedisService) {}

  /**
   * 检查并消费配额
   * 优先使用 Redis，不可用时降级为内存
   */
  async checkLimit(
    key: string,
    type: keyof typeof DEFAULT_RATE_LIMITS = 'user',
    isVip: boolean = false,
  ): Promise<RateLimitResult> {
    const config = this.getConfig(type, isVip);
    const fullKey = `ratelimit:${type}:${key}`;

    // 优先使用 Redis
    const client = this.redis.getClient();
    if (client && this.redis.connected) {
      return this.checkLimitRedis(fullKey, config);
    }

    // 降级为内存限流
    this.logger.debug(
      'Redis unavailable, using memory fallback for rate limiting',
    );
    return this.checkLimitMemory(fullKey, config);
  }

  /**
   * Redis 实现 - 使用 ZSET 滑动窗口
   */
  private async checkLimitRedis(
    fullKey: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const client = this.redis.getClient()!;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // 使用 Lua 脚本保证原子性
      const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local windowStart = tonumber(ARGV[2])
        local maxRequests = tonumber(ARGV[3])
        local windowMs = tonumber(ARGV[4])
        
        -- 移除过期条目
        redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
        
        -- 获取当前窗口请求数
        local currentCount = redis.call('ZCARD', key)
        
        if currentCount >= maxRequests then
          -- 获取最早请求时间计算重置时间
          local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
          local resetIn = windowMs
          if #oldest > 1 then
            resetIn = windowMs - (now - tonumber(oldest[2]))
          end
          return {0, 0, resetIn, maxRequests}
        end
        
        -- 添加当前请求
        redis.call('ZADD', key, now, now .. ':' .. math.random())
        redis.call('PEXPIRE', key, windowMs)
        
        local remaining = maxRequests - currentCount - 1
        return {1, remaining, windowMs, maxRequests}
      `;

      const result = (await client.eval(
        luaScript,
        1,
        fullKey,
        now.toString(),
        windowStart.toString(),
        config.maxRequests.toString(),
        config.windowMs.toString(),
      )) as number[];

      return {
        allowed: result[0] === 1,
        remaining: result[1],
        resetIn: result[2],
        limit: result[3],
      };
    } catch (error) {
      this.logger.warn(
        `Redis rate limit error: ${error}, falling back to memory`,
      );
      return this.checkLimitMemory(fullKey, config);
    }
  }

  /**
   * 内存实现 - 降级方案
   */
  private checkLimitMemory(
    fullKey: string,
    config: RateLimitConfig,
  ): RateLimitResult {
    const now = Date.now();

    // 获取或创建窗口
    let window = this.fallbackWindows.get(fullKey) || [];

    // 清理过期条目
    window = window.filter((entry) => now - entry.timestamp < config.windowMs);

    // 计算当前窗口内的请求数
    const currentCount = window.reduce((sum, entry) => sum + entry.count, 0);

    // 检查是否超限
    if (currentCount >= config.maxRequests) {
      const oldestEntry = window[0];
      const resetIn = oldestEntry
        ? config.windowMs - (now - oldestEntry.timestamp)
        : config.windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetIn,
        limit: config.maxRequests,
      };
    }

    // 添加新请求
    window.push({ timestamp: now, count: 1 });
    this.fallbackWindows.set(fullKey, window);

    return {
      allowed: true,
      remaining: config.maxRequests - currentCount - 1,
      resetIn: config.windowMs,
      limit: config.maxRequests,
    };
  }

  /**
   * 批量检查多个限流条件
   */
  async checkMultipleLimits(
    checks: Array<{ key: string; type: keyof typeof DEFAULT_RATE_LIMITS }>,
    isVip: boolean = false,
  ): Promise<{
    allowed: boolean;
    failedCheck?: { key: string; type: string; result: RateLimitResult };
    results: Map<string, RateLimitResult>;
  }> {
    const results = new Map<string, RateLimitResult>();

    for (const check of checks) {
      const result = await this.checkLimit(check.key, check.type, isVip);
      results.set(`${check.type}:${check.key}`, result);

      if (!result.allowed) {
        return {
          allowed: false,
          failedCheck: { key: check.key, type: check.type, result },
          results,
        };
      }
    }

    return { allowed: true, results };
  }

  /**
   * 获取当前限流状态（不消费配额）
   */
  async getStatus(
    key: string,
    type: keyof typeof DEFAULT_RATE_LIMITS = 'user',
    isVip: boolean = false,
  ): Promise<RateLimitResult> {
    const config = this.getConfig(type, isVip);
    const fullKey = `ratelimit:${type}:${key}`;
    const now = Date.now();

    const client = this.redis.getClient();
    if (client && this.redis.connected) {
      try {
        const windowStart = now - config.windowMs;
        await client.zremrangebyscore(fullKey, '-inf', windowStart);
        const currentCount = await client.zcard(fullKey);
        const oldest = await client.zrange(fullKey, 0, 0, 'WITHSCORES');

        const resetIn =
          oldest.length > 1
            ? config.windowMs - (now - parseInt(oldest[1]))
            : config.windowMs;

        return {
          allowed: currentCount < config.maxRequests,
          remaining: Math.max(0, config.maxRequests - currentCount),
          resetIn,
          limit: config.maxRequests,
        };
      } catch {
        // 降级到内存
      }
    }

    // 内存实现
    let window = this.fallbackWindows.get(fullKey) || [];
    window = window.filter((entry) => now - entry.timestamp < config.windowMs);

    const currentCount = window.reduce((sum, entry) => sum + entry.count, 0);
    const oldestEntry = window[0];
    const resetIn = oldestEntry
      ? config.windowMs - (now - oldestEntry.timestamp)
      : config.windowMs;

    return {
      allowed: currentCount < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - currentCount),
      resetIn,
      limit: config.maxRequests,
    };
  }

  /**
   * 重置指定 key 的限流
   */
  async reset(
    key: string,
    type: keyof typeof DEFAULT_RATE_LIMITS = 'user',
  ): Promise<void> {
    const fullKey = `ratelimit:${type}:${key}`;

    // 清理 Redis
    const client = this.redis.getClient();
    if (client && this.redis.connected) {
      try {
        await client.del(fullKey);
      } catch (error) {
        this.logger.warn(`Failed to reset Redis rate limit: ${error}`);
      }
    }

    // 清理内存
    this.fallbackWindows.delete(fullKey);
    this.logger.debug(`Rate limit reset: ${fullKey}`);
  }

  /**
   * 设置自定义限流配置
   */
  setCustomLimit(key: string, config: RateLimitConfig): void {
    this.customLimits.set(key, config);
  }

  /**
   * 清理过期内存窗口（每分钟自动执行）
   */
  @Cron('*/1 * * * *')
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, window] of this.fallbackWindows.entries()) {
      const filtered = window.filter((entry) => {
        const config = this.getConfigForKey(key);
        return now - entry.timestamp < config.windowMs;
      });

      if (filtered.length === 0) {
        this.fallbackWindows.delete(key);
        cleaned++;
      } else if (filtered.length !== window.length) {
        this.fallbackWindows.set(key, filtered);
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired rate limit windows`);
    }
  }

  // ==================== 私有方法 ====================

  private getConfig(
    type: keyof typeof DEFAULT_RATE_LIMITS,
    isVip: boolean,
  ): RateLimitConfig {
    const limits = isVip ? VIP_RATE_LIMITS : DEFAULT_RATE_LIMITS;
    return limits[type] || DEFAULT_RATE_LIMITS.user;
  }

  private getConfigForKey(fullKey: string): RateLimitConfig {
    const [, type] = fullKey.split(':');
    // 检查自定义配置
    if (this.customLimits.has(fullKey)) {
      return this.customLimits.get(fullKey)!;
    }
    return DEFAULT_RATE_LIMITS[type] || DEFAULT_RATE_LIMITS.user;
  }
}

// 限流错误
export class RateLimitExceededError extends Error {
  public readonly retryAfter: number;

  constructor(type: string, retryAfter: number) {
    super(
      `Rate limit exceeded for ${type}. Retry after ${Math.ceil(retryAfter / 1000)}s`,
    );
    this.name = 'RateLimitExceededError';
    this.retryAfter = retryAfter;
  }
}
