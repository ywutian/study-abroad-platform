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
} as const;

// 默认设置值
const DEFAULT_SETTINGS: Record<string, { value: string; description: string; category: string }> = {
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
};

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'setting:';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * 获取单个设置值
   */
  async get(key: string): Promise<string | null> {
    // 1. Try cache
    const cached = await this.redis.get(`${CACHE_PREFIX}${key}`);
    if (cached !== null) {
      return cached;
    }

    // 2. Query database
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });

    if (setting) {
      await this.redis.set(`${CACHE_PREFIX}${key}`, setting.value, CACHE_TTL);
      return setting.value;
    }

    // 3. Return default if exists
    const defaultSetting = DEFAULT_SETTINGS[key];
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
    const defaultSetting = DEFAULT_SETTINGS[key];

    await this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, description },
      create: {
        key,
        value,
        description: description ?? defaultSetting?.description ?? '',
        category: defaultSetting?.category ?? 'general',
      },
    });

    // Invalidate cache
    await this.redis.del(`${CACHE_PREFIX}${key}`);
    this.logger.log(`Setting updated: ${key}`);
  }

  /**
   * 批量设置
   */
  async setMany(settings: Array<{ key: string; value: string }>): Promise<void> {
    for (const { key, value } of settings) {
      await this.set(key, value);
    }
  }

  /**
   * 获取所有设置（按分类）
   */
  async getAll(): Promise<Array<{
    key: string;
    value: string;
    description: string | null;
    category: string;
  }>> {
    const dbSettings = await this.prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Merge with defaults
    const result = new Map<string, {
      key: string;
      value: string;
      description: string | null;
      category: string;
    }>();

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
  async getByCategory(category: string): Promise<Array<{
    key: string;
    value: string;
    description: string | null;
  }>> {
    const all = await this.getAll();
    return all.filter(s => s.category === category);
  }

  /**
   * 删除设置（恢复默认）
   */
  async delete(key: string): Promise<void> {
    await this.prisma.systemSetting.delete({
      where: { key },
    }).catch(() => {
      // Ignore if not exists
    });

    await this.redis.del(`${CACHE_PREFIX}${key}`);
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


