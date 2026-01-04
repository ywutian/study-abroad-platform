/**
 * Agent 请求限流服务
 * 
 * 使用滑动窗口算法实现精确限流
 */

import { Injectable, Logger } from '@nestjs/common';

interface RateLimitConfig {
  windowMs: number;      // 时间窗口 (毫秒)
  maxRequests: number;   // 窗口内最大请求数
}

interface WindowEntry {
  timestamp: number;
  count: number;
}

// 默认限流配置
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  // 用户级别 - 每分钟 10 次
  user: { windowMs: 60000, maxRequests: 10 },
  // 对话级别 - 每分钟 20 次
  conversation: { windowMs: 60000, maxRequests: 20 },
  // IP 级别 - 每分钟 30 次
  ip: { windowMs: 60000, maxRequests: 30 },
  // Agent 调用 - 每分钟 50 次
  agent: { windowMs: 60000, maxRequests: 50 },
  // Tool 调用 - 每分钟 100 次
  tool: { windowMs: 60000, maxRequests: 100 },
};

// VIP 用户限流配置
const VIP_LIMITS: Record<string, RateLimitConfig> = {
  user: { windowMs: 60000, maxRequests: 30 },
  conversation: { windowMs: 60000, maxRequests: 60 },
  ip: { windowMs: 60000, maxRequests: 100 },
  agent: { windowMs: 60000, maxRequests: 150 },
  tool: { windowMs: 60000, maxRequests: 300 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;  // 重置时间 (毫秒)
  limit: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  
  // 滑动窗口存储 (生产环境应使用 Redis)
  private windows: Map<string, WindowEntry[]> = new Map();
  
  // 自定义限流配置
  private customLimits: Map<string, RateLimitConfig> = new Map();

  /**
   * 检查并消费配额
   */
  async checkLimit(
    key: string,
    type: keyof typeof DEFAULT_LIMITS = 'user',
    isVip: boolean = false,
  ): Promise<RateLimitResult> {
    const config = this.getConfig(type, isVip);
    const fullKey = `${type}:${key}`;
    const now = Date.now();

    // 获取或创建窗口
    let window = this.windows.get(fullKey) || [];
    
    // 清理过期条目
    window = window.filter(entry => now - entry.timestamp < config.windowMs);

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
    this.windows.set(fullKey, window);

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
    checks: Array<{ key: string; type: keyof typeof DEFAULT_LIMITS }>,
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
  getStatus(
    key: string,
    type: keyof typeof DEFAULT_LIMITS = 'user',
    isVip: boolean = false,
  ): RateLimitResult {
    const config = this.getConfig(type, isVip);
    const fullKey = `${type}:${key}`;
    const now = Date.now();

    let window = this.windows.get(fullKey) || [];
    window = window.filter(entry => now - entry.timestamp < config.windowMs);

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
  reset(key: string, type: keyof typeof DEFAULT_LIMITS = 'user'): void {
    const fullKey = `${type}:${key}`;
    this.windows.delete(fullKey);
    this.logger.debug(`Rate limit reset: ${fullKey}`);
  }

  /**
   * 设置自定义限流配置
   */
  setCustomLimit(key: string, config: RateLimitConfig): void {
    this.customLimits.set(key, config);
  }

  /**
   * 清理过期窗口（定期调用）
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, window] of this.windows.entries()) {
      const filtered = window.filter(entry => {
        const config = this.getConfigForKey(key);
        return now - entry.timestamp < config.windowMs;
      });

      if (filtered.length === 0) {
        this.windows.delete(key);
        cleaned++;
      } else if (filtered.length !== window.length) {
        this.windows.set(key, filtered);
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired rate limit windows`);
    }
  }

  // ==================== 私有方法 ====================

  private getConfig(
    type: keyof typeof DEFAULT_LIMITS,
    isVip: boolean,
  ): RateLimitConfig {
    const limits = isVip ? VIP_LIMITS : DEFAULT_LIMITS;
    return limits[type] || DEFAULT_LIMITS.user;
  }

  private getConfigForKey(fullKey: string): RateLimitConfig {
    const [type] = fullKey.split(':');
    // 检查自定义配置
    if (this.customLimits.has(fullKey)) {
      return this.customLimits.get(fullKey)!;
    }
    return DEFAULT_LIMITS[type as keyof typeof DEFAULT_LIMITS] || DEFAULT_LIMITS.user;
  }
}

// 限流错误
export class RateLimitExceededError extends Error {
  public readonly retryAfter: number;

  constructor(type: string, retryAfter: number) {
    super(`Rate limit exceeded for ${type}. Retry after ${Math.ceil(retryAfter / 1000)}s`);
    this.name = 'RateLimitExceededError';
    this.retryAfter = retryAfter;
  }
}


