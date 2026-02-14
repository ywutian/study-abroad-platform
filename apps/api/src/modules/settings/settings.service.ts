import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

// 系统设置键名常量
export const SETTING_KEYS = {
  ADMIN_EMAIL: 'admin_email',
  SITE_NAME: 'site_name',
  SUPPORT_EMAIL: 'support_email',
  NOTIFICATION_ENABLED: 'notification_enabled',
  IPEDS_MONITOR_ENABLED: 'ipeds_monitor_enabled',
  // Points system
  POINTS_ENABLED: 'points_enabled',
  POINTS_ACTION_SUBMIT_CASE: 'points_action_SUBMIT_CASE',
  POINTS_ACTION_CASE_VERIFIED: 'points_action_CASE_VERIFIED',
  POINTS_ACTION_CASE_HELPFUL: 'points_action_CASE_HELPFUL',
  POINTS_ACTION_COMPLETE_PROFILE: 'points_action_COMPLETE_PROFILE',
  POINTS_ACTION_REFER_USER: 'points_action_REFER_USER',
  POINTS_ACTION_VIEW_CASE_DETAIL: 'points_action_VIEW_CASE_DETAIL',
  POINTS_ACTION_AI_ANALYSIS: 'points_action_AI_ANALYSIS',
  POINTS_ACTION_MESSAGE_VERIFIED: 'points_action_MESSAGE_VERIFIED',
  POINTS_ACTION_VERIFICATION_APPROVED: 'points_action_VERIFICATION_APPROVED',
  POINTS_ACTION_SWIPE_CORRECT: 'points_action_SWIPE_CORRECT',
  POINTS_ACTION_AI_ESSAY_POLISH: 'points_action_AI_ESSAY_POLISH',
  POINTS_ACTION_AI_ESSAY_REVIEW: 'points_action_AI_ESSAY_REVIEW',
  POINTS_ACTION_AI_ESSAY_BRAINSTORM: 'points_action_AI_ESSAY_BRAINSTORM',
  POINTS_ACTION_AI_ESSAY_GALLERY: 'points_action_AI_ESSAY_GALLERY',
  POINTS_ACTION_AI_SCHOOL_RECOMMENDATION:
    'points_action_AI_SCHOOL_RECOMMENDATION',
  // Subscription pricing
  SUBSCRIPTION_PRO_PRICE: 'subscription_pro_price',
  SUBSCRIPTION_PREMIUM_PRICE: 'subscription_premium_price',
  SUBSCRIPTION_YEARLY_DISCOUNT: 'subscription_yearly_discount',
  // AI quotas
  AI_QUOTA_DEFAULT_DAILY: 'ai_quota_default_daily',
  AI_QUOTA_DEFAULT_MONTHLY: 'ai_quota_default_monthly',
  AI_QUOTA_PRO_DAILY: 'ai_quota_pro_daily',
  AI_QUOTA_PRO_MONTHLY: 'ai_quota_pro_monthly',
  AI_QUOTA_PREMIUM_DAILY: 'ai_quota_premium_daily',
  AI_QUOTA_PREMIUM_MONTHLY: 'ai_quota_premium_monthly',
} as const;

// 默认设置值
const DEFAULT_SETTINGS: Record<
  string,
  { value: string; description: string; category: string }
> = {
  [SETTING_KEYS.ADMIN_EMAIL]: {
    value: '',
    description: '管理员邮箱，用于接收系统通知',
    category: 'notification',
  },
  [SETTING_KEYS.SITE_NAME]: {
    value: '留学申请平台',
    description: '网站名称',
    category: 'general',
  },
  [SETTING_KEYS.SUPPORT_EMAIL]: {
    value: '',
    description: '客服支持邮箱',
    category: 'notification',
  },
  [SETTING_KEYS.NOTIFICATION_ENABLED]: {
    value: 'true',
    description: '是否启用邮件通知',
    category: 'notification',
  },
  [SETTING_KEYS.IPEDS_MONITOR_ENABLED]: {
    value: 'true',
    description: '是否启用 IPEDS 数据更新监控',
    category: 'notification',
  },
  // Points system defaults
  [SETTING_KEYS.POINTS_ENABLED]: {
    value: 'false',
    description: '是否启用积分系统',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_SUBMIT_CASE]: {
    value: '50',
    description: '提交录取案例奖励积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_CASE_VERIFIED]: {
    value: '100',
    description: '案例通过验证奖励积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_CASE_HELPFUL]: {
    value: '10',
    description: '案例被标记有帮助奖励积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_COMPLETE_PROFILE]: {
    value: '30',
    description: '完善个人档案奖励积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_REFER_USER]: {
    value: '50',
    description: '成功邀请新用户奖励积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_VIEW_CASE_DETAIL]: {
    value: '-20',
    description: '查看案例详情消耗积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ANALYSIS]: {
    value: '-30',
    description: 'AI智能分析消耗积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_MESSAGE_VERIFIED]: {
    value: '-10',
    description: '私信认证用户消耗积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_VERIFICATION_APPROVED]: {
    value: '100',
    description: '身份认证通过奖励积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_SWIPE_CORRECT]: {
    value: '5',
    description: '滑动猜测正确基础积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_POLISH]: {
    value: '-20',
    description: '文书润色消耗积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_REVIEW]: {
    value: '-30',
    description: '文书评审消耗积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_BRAINSTORM]: {
    value: '-15',
    description: '文书头脑风暴消耗积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_GALLERY]: {
    value: '-20',
    description: '文书范例分析消耗积分',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_SCHOOL_RECOMMENDATION]: {
    value: '-25',
    description: 'AI选校推荐消耗积分',
    category: 'points',
  },
  // Subscription pricing defaults
  [SETTING_KEYS.SUBSCRIPTION_PRO_PRICE]: {
    value: '99',
    description: 'PRO 月度价格 (CNY)',
    category: 'subscription',
  },
  [SETTING_KEYS.SUBSCRIPTION_PREMIUM_PRICE]: {
    value: '299',
    description: 'PREMIUM 月度价格 (CNY)',
    category: 'subscription',
  },
  [SETTING_KEYS.SUBSCRIPTION_YEARLY_DISCOUNT]: {
    value: '10',
    description: '年付折扣月数（付此月数享12个月）',
    category: 'subscription',
  },
  // AI quota defaults
  [SETTING_KEYS.AI_QUOTA_DEFAULT_DAILY]: {
    value: '100000',
    description: '免费用户每日 Token 配额',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_DEFAULT_MONTHLY]: {
    value: '2000000',
    description: '免费用户每月 Token 配额',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_PRO_DAILY]: {
    value: '300000',
    description: 'PRO 用户每日 Token 配额',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_PRO_MONTHLY]: {
    value: '6000000',
    description: 'PRO 用户每月 Token 配额',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_PREMIUM_DAILY]: {
    value: '1000000',
    description: 'PREMIUM 用户每日 Token 配额',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_PREMIUM_MONTHLY]: {
    value: '20000000',
    description: 'PREMIUM 用户每月 Token 配额',
    category: 'ai_quota',
  },
};

// Allow API clients to pass either actual key values (subscription_pro_price)
// or enum-like aliases (SUBSCRIPTION_PRO_PRICE).
const SETTING_KEY_ALIASES: Record<string, string> = Object.entries(
  SETTING_KEYS,
).reduce<Record<string, string>>((acc, [alias, value]) => {
  acc[alias] = value;
  return acc;
}, {});

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'setting:';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private normalizeKey(key: string): string {
    return SETTING_KEY_ALIASES[key] ?? key;
  }

  /**
   * 获取单个设置值
   */
  async get(key: string): Promise<string | null> {
    const normalizedKey = this.normalizeKey(key);

    // 1. Try cache
    const cached = await this.redis.get(`${CACHE_PREFIX}${normalizedKey}`);
    if (cached !== null) {
      return cached;
    }

    // 2. Query database
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: normalizedKey },
    });

    if (setting) {
      await this.redis.set(
        `${CACHE_PREFIX}${normalizedKey}`,
        setting.value,
        CACHE_TTL,
      );
      return setting.value;
    }

    // 3. Return default if exists
    const defaultSetting = DEFAULT_SETTINGS[normalizedKey];
    return defaultSetting?.value ?? null;
  }

  /**
   * 获取设置值并解析为指定类型
   */
  async getTyped<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get(key);
    if (value === null) return defaultValue;

    try {
      // Handle boolean
      if (typeof defaultValue === 'boolean') {
        return (value === 'true') as T;
      }
      // Handle number
      if (typeof defaultValue === 'number') {
        return Number(value) as T;
      }
      // Handle object/array (JSON)
      if (typeof defaultValue === 'object') {
        return JSON.parse(value) as T;
      }
      return value as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * 设置值（仅管理员）
   */
  async set(key: string, value: string, description?: string): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    const defaultSetting = DEFAULT_SETTINGS[normalizedKey];

    await this.prisma.systemSetting.upsert({
      where: { key: normalizedKey },
      update: { value, description },
      create: {
        key: normalizedKey,
        value,
        description: description ?? defaultSetting?.description ?? '',
        category: defaultSetting?.category ?? 'general',
      },
    });

    // Invalidate cache
    await this.redis.del(`${CACHE_PREFIX}${normalizedKey}`);
    this.logger.log(`Setting updated: ${normalizedKey}`);
  }

  /**
   * 批量设置
   */
  async setMany(
    settings: Array<{ key: string; value: string }>,
  ): Promise<void> {
    for (const { key, value } of settings) {
      await this.set(key, value);
    }
  }

  /**
   * 获取所有设置（按分类）
   */
  async getAll(): Promise<
    Array<{
      key: string;
      value: string;
      description: string | null;
      category: string;
    }>
  > {
    const dbSettings = await this.prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Merge with defaults
    const result = new Map<
      string,
      {
        key: string;
        value: string;
        description: string | null;
        category: string;
      }
    >();

    // Add defaults first
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      result.set(key, {
        key,
        value: def.value,
        description: def.description,
        category: def.category,
      });
    }

    // Override with database values
    for (const setting of dbSettings) {
      result.set(setting.key, {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        category: setting.category,
      });
    }

    return Array.from(result.values());
  }

  /**
   * 获取指定分类的设置
   */
  async getByCategory(category: string): Promise<
    Array<{
      key: string;
      value: string;
      description: string | null;
    }>
  > {
    const all = await this.getAll();
    return all.filter((s) => s.category === category);
  }

  /**
   * 删除设置（恢复默认）
   */
  async delete(key: string): Promise<void> {
    const normalizedKey = this.normalizeKey(key);

    await this.prisma.systemSetting
      .delete({
        where: { key: normalizedKey },
      })
      .catch(() => {
        // Ignore if not exists
      });

    await this.redis.del(`${CACHE_PREFIX}${normalizedKey}`);
  }

  /**
   * 初始化默认设置
   */
  async initializeDefaults(): Promise<void> {
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      const exists = await this.prisma.systemSetting.findUnique({
        where: { key },
      });

      if (!exists) {
        await this.prisma.systemSetting.create({
          data: {
            key,
            value: def.value,
            description: def.description,
            category: def.category,
          },
        });
      }
    }

    this.logger.log('Default settings initialized');
  }
}
