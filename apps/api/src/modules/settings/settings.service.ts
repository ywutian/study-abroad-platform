import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { isProtectedPointSettingKey } from './protected-point-settings';
import { SETTING_KEYS } from './setting-keys';

export { SETTING_KEYS } from './setting-keys';

// Default setting values
const DEFAULT_SETTINGS: Record<
  string,
  { value: string; description: string; category: string }
> = {
  [SETTING_KEYS.ADMIN_EMAIL]: {
    value: '',
    description: 'Admin email for receiving system notifications',
    category: 'notification',
  },
  [SETTING_KEYS.SITE_NAME]: {
    value: 'Lumni',
    description: 'Site name',
    category: 'general',
  },
  [SETTING_KEYS.SUPPORT_EMAIL]: {
    value: '',
    description: 'Customer support email',
    category: 'notification',
  },
  [SETTING_KEYS.NOTIFICATION_ENABLED]: {
    value: 'true',
    description: 'Whether email notifications are enabled',
    category: 'notification',
  },
  [SETTING_KEYS.IPEDS_MONITOR_ENABLED]: {
    value: 'true',
    description: 'Whether IPEDS data update monitoring is enabled',
    category: 'notification',
  },
  // Points system defaults
  [SETTING_KEYS.POINTS_ENABLED]: {
    value: 'false',
    description: 'Whether the points system is enabled',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_SUBMIT_CASE]: {
    value: '50',
    description: 'Points rewarded for submitting an admission case',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_CASE_VERIFIED]: {
    value: '100',
    description: 'Points rewarded when a case passes verification',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_CASE_HELPFUL]: {
    value: '10',
    description: 'Points rewarded when a case is marked as helpful',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_COMPLETE_PROFILE]: {
    value: '30',
    description: 'Points rewarded for completing profile',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_REFER_USER]: {
    value: '50',
    description: 'Points rewarded for successfully referring a new user',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_VIEW_CASE_DETAIL]: {
    value: '-20',
    description: 'Points consumed for viewing case details',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ANALYSIS]: {
    value: '-30',
    description: 'Points consumed for AI analysis',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_MESSAGE_VERIFIED]: {
    value: '-10',
    description: 'Points consumed for messaging a verified user',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_VERIFICATION_APPROVED]: {
    value: '100',
    description: 'Points rewarded when identity verification is approved',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_SWIPE_CORRECT]: {
    value: '5',
    description: 'Base points rewarded for a correct swipe guess',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_SUBMIT_REVIEW]: {
    value: '20',
    description: 'Points rewarded for publishing a hall review',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_REVIEW_HELPFUL]: {
    value: '10',
    description: 'Points rewarded when a hall review is marked helpful',
    category: 'points',
  },
  // Hall refactor Phase 1 — Tinder review + challenge + application-progress incentives
  [SETTING_KEYS.POINTS_ACTION_REVIEW_SWIPE_COMPLETE]: {
    value: '10',
    description:
      'Points for completing a Tinder-style 4-dim swipe review (≥5 char rationale)',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_REVIEW_HELPFUL_RECEIVED]: {
    value: '5',
    description:
      'Points when a swipe review is marked helpful (capped at 20 per review)',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_REVIEWER_LEVEL_UP]: {
    value: '50',
    description: 'Points for passing the L2 reviewer qualification quiz',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_CHALLENGE_COMPLETE]: {
    value: '20',
    description: 'Points for completing one community challenge (1/day)',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_CASE_STUDY_COMPLETE]: {
    value: '5',
    description: 'Points for completing one case study (with reflection note)',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_PROFILE_RESEARCHED_5_SCHOOLS]: {
    value: '30',
    description: 'Application progress: researched 5 target schools (bronze)',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_ESSAY_DRAFT_COMPLETE]: {
    value: '50',
    description: 'Application progress: completed one essay draft (gold)',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_ED_SUBMITTED]: {
    value: '100',
    description: 'Application progress: submitted ED application (diamond)',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_RANKING_ANALYZED]: {
    value: '0',
    description:
      'Points consumed for AI ranking analysis (rollout default 0; tune to -10 after stable)',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_REVIEW_REPORTED]: {
    value: '-20',
    description: 'Points deducted when a review is reported and confirmed',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_POLISH]: {
    value: '-20',
    description: 'Points consumed for AI essay polishing',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_REVIEW]: {
    value: '-30',
    description: 'Points consumed for AI essay review',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_BRAINSTORM]: {
    value: '-15',
    description: 'Points consumed for AI essay brainstorming',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_GALLERY]: {
    value: '-20',
    description: 'Points consumed for essay gallery analysis',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_GALLERY_ASK]: {
    value: '-5',
    description: 'Points consumed for asking a question about a gallery essay',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_COMPARE]: {
    value: '-15',
    description:
      'Points consumed for comparing a user essay with a gallery essay',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_SCHOOL_RECOMMENDATION]: {
    value: '-25',
    description: 'Points consumed for AI school recommendation',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ACTIVITY_REFINE]: {
    value: '-15',
    description: 'Points consumed for AI activity description refinement',
    category: 'points',
  },
  [SETTING_KEYS.POINTS_ACTION_AI_ESSAY_DEBATE_TURN]: {
    value: '0',
    description:
      'Points consumed per essay debate turn (Phase 2 V1 PR1 skeleton — PR2 will tune after measuring real token cost)',
    category: 'points',
  },
  // Subscription pricing defaults
  [SETTING_KEYS.SUBSCRIPTION_PRO_PRICE]: {
    value: '99',
    description: 'PRO monthly price (CNY)',
    category: 'subscription',
  },
  [SETTING_KEYS.SUBSCRIPTION_PREMIUM_PRICE]: {
    value: '299',
    description: 'PREMIUM monthly price (CNY)',
    category: 'subscription',
  },
  [SETTING_KEYS.SUBSCRIPTION_YEARLY_DISCOUNT]: {
    value: '10',
    description: 'Yearly discount months (pay this many months for 12 months)',
    category: 'subscription',
  },
  // AI quota defaults
  [SETTING_KEYS.AI_QUOTA_DEFAULT_DAILY]: {
    value: '100000',
    description: 'Free user daily token quota',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_DEFAULT_MONTHLY]: {
    value: '2000000',
    description: 'Free user monthly token quota',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_PRO_DAILY]: {
    value: '300000',
    description: 'PRO user daily token quota',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_PRO_MONTHLY]: {
    value: '6000000',
    description: 'PRO user monthly token quota',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_PREMIUM_DAILY]: {
    value: '1000000',
    description: 'PREMIUM user daily token quota',
    category: 'ai_quota',
  },
  [SETTING_KEYS.AI_QUOTA_PREMIUM_MONTHLY]: {
    value: '20000000',
    description: 'PREMIUM user monthly token quota',
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

const CACHE_TTL = REDIS_TTL.SETTINGS;
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
   * Get a single setting value
   */
  async get(key: string): Promise<string | null> {
    const normalizedKey = this.normalizeKey(key);

    // 1. Try cache
    const cached = await this.redis.get(`${CACHE_PREFIX}${normalizedKey}`);
    if (cached !== null) {
      return cached;
    }

    // 2. Query database
    // governance: system-scope — SystemSetting is the platform-wide config table (feature toggles, point values, prices) — no User or Profile relation; writes come from admin controllers
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
   * Get a setting value and parse it to the specified type
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
   * Set a value (admin only)
   */
  async set(key: string, value: string, description?: string): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    const defaultSetting = DEFAULT_SETTINGS[normalizedKey];

    // governance: system-scope — SystemSetting is the platform-wide config table (feature toggles, point values, prices) — no User or Profile relation; writes come from admin controllers
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

  isProtectedPointSetting(key: string): boolean {
    return isProtectedPointSettingKey(this.normalizeKey(key));
  }

  /**
   * Set multiple values in batch
   */
  async setMany(
    settings: Array<{ key: string; value: string }>,
  ): Promise<void> {
    for (const { key, value } of settings) {
      await this.set(key, value);
    }
  }

  /**
   * Get all settings (grouped by category)
   */
  async getAll(): Promise<
    Array<{
      key: string;
      value: string;
      description: string | null;
      category: string;
    }>
  > {
    // governance: system-scope — SystemSetting is the platform-wide config table (feature toggles, point values, prices) — no User or Profile relation; writes come from admin controllers
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
   * Get settings by category
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
   * Delete a setting (revert to default)
   */
  async delete(key: string): Promise<void> {
    const normalizedKey = this.normalizeKey(key);

    await this.prisma.systemSetting
      .delete({
        where: { key: normalizedKey },
      })
      .catch((error) => {
        if (error?.code !== 'P2025') throw error;
      });

    await this.redis.del(`${CACHE_PREFIX}${normalizedKey}`);
  }

  /**
   * Initialize default settings
   */
  async initializeDefaults(): Promise<void> {
    for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
      // governance: system-scope — SystemSetting is the platform-wide config table (feature toggles, point values, prices) — no User or Profile relation; writes come from admin controllers
      const exists = await this.prisma.systemSetting.findUnique({
        where: { key },
      });

      if (!exists) {
        // governance: system-scope — SystemSetting is the platform-wide config table (feature toggles, point values, prices) — no User or Profile relation; writes come from admin controllers
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
