import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { REDIS_TTL } from '../redis/redis-ttl.constants';

interface FeatureFlagRules {
  roles?: string[];
  userIds?: string[];
  percentage?: number;
}

interface EvaluationContext {
  userId?: string;
  role?: string;
}

const CACHE_PREFIX = 'ff:';
const CACHE_TTL_SECONDS = REDIS_TTL.FEATURE_FLAG;

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Check if a feature flag is enabled for the given context.
   *
   * Evaluation order:
   * 1. Look up flag (Redis cache → DB fallback)
   * 2. If flag not found or disabled → false
   * 3. If enabled and no rules → true (global rollout)
   * 4. Evaluate rules: roles → userIds → percentage
   */
  async isEnabled(key: string, context?: EvaluationContext): Promise<boolean> {
    const flag = await this.getFlag(key);

    if (!flag || !flag.enabled) {
      return false;
    }

    const rules = flag.rules as FeatureFlagRules | null;

    // No rules + enabled = globally enabled
    if (!rules) {
      return true;
    }

    // Role whitelist
    if (rules.roles?.length && context?.role) {
      if (rules.roles.includes(context.role)) {
        return true;
      }
    }

    // User ID whitelist
    if (rules.userIds?.length && context?.userId) {
      if (rules.userIds.includes(context.userId)) {
        return true;
      }
    }

    // Percentage-based gradual rollout (deterministic hash on userId)
    if (
      typeof rules.percentage === 'number' &&
      rules.percentage > 0 &&
      context?.userId
    ) {
      const hash = this.simpleHash(context.userId);
      const bucket = hash % 100;
      if (bucket < rules.percentage) {
        return true;
      }
    }

    // No rules matched
    return false;
  }

  /**
   * Get all flags (for admin listing).
   */
  async findAll() {
    return this.prisma.featureFlag.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single flag by ID.
   */
  async findById(id: string) {
    return this.prisma.featureFlag.findUnique({ where: { id } });
  }

  /**
   * Create a new feature flag.
   */
  async create(data: {
    key: string;
    description?: string;
    enabled?: boolean;
    rules?: Prisma.InputJsonValue;
  }) {
    const flag = await this.prisma.featureFlag.create({
      data: {
        key: data.key,
        description: data.description,
        enabled: data.enabled ?? false,
        rules: data.rules ?? undefined,
      },
    });
    await this.invalidateCache(flag.key);
    return flag;
  }

  /**
   * Update an existing feature flag.
   */
  async update(
    id: string,
    data: {
      key?: string;
      description?: string;
      enabled?: boolean;
      rules?: Prisma.InputJsonValue;
    },
  ) {
    // Get old key for cache invalidation
    const old = await this.prisma.featureFlag.findUnique({ where: { id } });

    const flag = await this.prisma.featureFlag.update({
      where: { id },
      data,
    });

    // Invalidate both old and new keys if key changed
    if (old && old.key !== flag.key) {
      await this.invalidateCache(old.key);
    }
    await this.invalidateCache(flag.key);

    return flag;
  }

  /**
   * Delete a feature flag.
   */
  async remove(id: string) {
    const flag = await this.prisma.featureFlag.delete({ where: { id } });
    await this.invalidateCache(flag.key);
    return flag;
  }

  /**
   * Invalidate the Redis cache for a specific flag key.
   */
  async invalidateCache(key: string): Promise<void> {
    try {
      await this.redis.del(`${CACHE_PREFIX}${key}`);
    } catch {
      // Redis degradation — cache will expire naturally
    }
  }

  /**
   * Fetch a flag by key with Redis caching and DB fallback.
   */
  private async getFlag(key: string) {
    const cacheKey = `${CACHE_PREFIX}${key}`;

    // Try Redis cache first
    try {
      const cached = await this.redis.getJSON<{
        enabled: boolean;
        rules: FeatureFlagRules | null;
      }>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    } catch {
      // Redis unavailable — fall through to DB
    }

    // Query database
    const flag = await this.prisma.featureFlag.findUnique({
      where: { key },
      select: { enabled: true, rules: true },
    });

    if (!flag) {
      return null;
    }

    // Cache the result
    try {
      await this.redis.setJSON(
        cacheKey,
        { enabled: flag.enabled, rules: flag.rules },
        CACHE_TTL_SECONDS,
      );
    } catch {
      // Redis unavailable — continue without caching
    }

    return flag;
  }

  /**
   * Simple deterministic hash for percentage-based rollout.
   * Produces a consistent number for the same userId.
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
