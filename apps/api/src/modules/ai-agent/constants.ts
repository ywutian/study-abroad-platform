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

// ===== Model catalog — SINGLE SOURCE OF TRUTH =====

export interface ModelSpec {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
  /** Max context in tokens. */
  contextWindow: number;
}

/**
 * Every per-model fact lives here. Prices are **USD per 1M tokens** — OpenAI's
 * own unit.
 *
 * This replaces four tables that had already drifted apart: `PRICING` in
 * llm.service (per 1M), `TOKEN_PRICES` here (per **1K** — a silent foot-gun
 * next to the per-1M one), `contextLimits` in token-tracker, and
 * `CONTEXT_WINDOWS` in openai.provider. They disagreed worst on unknown
 * models: one fell back to $0.15/$0.60 per 1M, the other to the equivalent of
 * $1000/$2000. Add a model here and every consumer picks it up.
 *
 * Verified against OpenAI published pricing 2026-07-24. Context windows are
 * rounded DOWN — understating a limit rejects early, overstating it fails at
 * the API.
 */
export const MODEL_CATALOG: Record<string, ModelSpec> = {
  // Current families. GPT-5.6 (Sol/Terra/Luna) went GA 2026-07-09.
  'gpt-5.6-sol': { input: 5.0, output: 30.0, contextWindow: 1_000_000 },
  'gpt-5.6-terra': { input: 2.5, output: 15.0, contextWindow: 1_000_000 },
  'gpt-5.6-luna': { input: 1.0, output: 6.0, contextWindow: 1_000_000 },
  'gpt-5.5': { input: 5.0, output: 30.0, contextWindow: 1_000_000 },
  'gpt-5.4': { input: 2.5, output: 15.0, contextWindow: 1_000_000 },
  'gpt-5.4-mini': { input: 0.75, output: 4.5, contextWindow: 400_000 },
  'gpt-5.4-nano': { input: 0.2, output: 1.25, contextWindow: 400_000 },

  // Legacy — off OpenAI's current pricing page, kept so historical usage rows
  // still cost out correctly.
  'gpt-4o': { input: 2.5, output: 10.0, contextWindow: 128_000 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, contextWindow: 128_000 },
  'gpt-4-turbo': { input: 10.0, output: 30.0, contextWindow: 128_000 },
  'gpt-4': { input: 30.0, output: 60.0, contextWindow: 8_192 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5, contextWindow: 16_385 },

  // Reached through the prod proxy.
  'deepseek-chat': { input: 0.14, output: 0.28, contextWindow: 64_000 },
  'deepseek-reasoner': { input: 0.55, output: 2.19, contextWindow: 64_000 },
};

/**
 * Pricing used when a model isn't in the catalog.
 *
 * Derived as the **most expensive rate in the catalog**, not hand-written. The
 * old code costed unknown models at gpt-4o-mini rates, which is exactly how
 * prod's `gpt-5.4-mini` spend got under-reported 5× on input and 7.5× on
 * output — the dashboard looked fine while the bill didn't. An unknown model
 * must over-report, never under-report, and deriving it means that stays true
 * as the catalog grows instead of drifting the way a literal would.
 *
 * Over-reporting is the point, not a bug: the accompanying log warning tells
 * you to add the model so the estimate becomes exact.
 */
export const UNKNOWN_MODEL_PRICING: { input: number; output: number } = {
  input: Math.max(...Object.values(MODEL_CATALOG).map((m) => m.input)),
  output: Math.max(...Object.values(MODEL_CATALOG).map((m) => m.output)),
};

/**
 * USD cost of one call. `known: false` means the estimate used the
 * conservative fallback above and the caller should say so out loud.
 */
export function estimateModelCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): { cost: number; known: boolean } {
  const spec = MODEL_CATALOG[model];
  const price = spec ?? UNKNOWN_MODEL_PRICING;
  return {
    cost:
      (promptTokens * price.input + completionTokens * price.output) /
      1_000_000,
    known: spec !== undefined,
  };
}
