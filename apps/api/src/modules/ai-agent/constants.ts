/**
 * AI Agent 集中配置常量
 *
 * 频率限制、Token 配额、Token 价格的单一定义点
 * 被 rate-limiter.service / token-tracker.service / config.service 引用
 */

// ===== Rate Limits =====

export interface RateLimitConfig {
  windowMs: number; // 时间窗口 (毫秒)
  maxRequests: number; // 窗口内最大请求数
}

export const RATE_LIMIT_WINDOW_MS = 60_000; // 1 分钟

// 默认限流配置（普通用户）
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  user: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 10 },
  conversation: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 20 },
  ip: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 30 },
  agent: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 50 },
  tool: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 100 },
};

// VIP 用户限流配置
export const VIP_RATE_LIMITS: Record<string, RateLimitConfig> = {
  user: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 30 },
  conversation: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 60 },
  ip: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 100 },
  agent: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 150 },
  tool: { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: 300 },
};

// ===== Token Quotas =====

export interface TokenQuota {
  readonly dailyTokens: number;
  readonly monthlyTokens: number;
  readonly dailyCost: number;
  readonly monthlyCost: number;
}

export const DEFAULT_TOKEN_QUOTAS: TokenQuota = {
  dailyTokens: 100_000,
  monthlyTokens: 2_000_000,
  dailyCost: 5.0, // USD
  monthlyCost: 100.0, // USD
} as const;

export const PRO_TOKEN_QUOTAS: TokenQuota = {
  dailyTokens: 300_000,
  monthlyTokens: 6_000_000,
  dailyCost: 15.0,
  monthlyCost: 300.0,
} as const;

export const PREMIUM_TOKEN_QUOTAS: TokenQuota = {
  dailyTokens: 1_000_000,
  monthlyTokens: 20_000_000,
  dailyCost: 50.0,
  monthlyCost: 1000.0,
} as const;

// ===== Token Prices (USD per 1K tokens) =====

export const TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  default: { input: 0.001, output: 0.002 },
};
