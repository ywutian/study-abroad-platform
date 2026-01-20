// 订阅计划 — 前后端单一数据源

export enum SubscriptionPlan {
  FREE = 'FREE',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM',
}

export type BillingPeriod = 'monthly' | 'yearly' | 'lifetime';

export interface PlanConfig {
  id: SubscriptionPlan;
  /** i18n lookup key: `subscription.plans.${key}.*` */
  key: 'free' | 'pro' | 'premium';
  price: number;
  currency: string;
  period: BillingPeriod;
  /** Number of feature items (for rendering loops with i18n) */
  featureCount: number;
  popular?: boolean;
}

/** 年付折扣：付 10 个月享 12 个月 */
export const YEARLY_DISCOUNT_MULTIPLIER = 10;

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, PlanConfig> = {
  [SubscriptionPlan.FREE]: {
    id: SubscriptionPlan.FREE,
    key: 'free',
    price: 0,
    currency: 'CNY',
    period: 'lifetime',
    featureCount: 4,
  },
  [SubscriptionPlan.PRO]: {
    id: SubscriptionPlan.PRO,
    key: 'pro',
    price: 99,
    currency: 'CNY',
    period: 'monthly',
    featureCount: 6,
    popular: true,
  },
  [SubscriptionPlan.PREMIUM]: {
    id: SubscriptionPlan.PREMIUM,
    key: 'premium',
    price: 299,
    currency: 'CNY',
    period: 'monthly',
    featureCount: 6,
  },
} as const;

/** Ordered list for iteration (e.g., rendering plan cards) */
export const SUBSCRIPTION_PLAN_LIST: readonly PlanConfig[] = [
  SUBSCRIPTION_PLANS[SubscriptionPlan.FREE],
  SUBSCRIPTION_PLANS[SubscriptionPlan.PRO],
  SUBSCRIPTION_PLANS[SubscriptionPlan.PREMIUM],
] as const;
