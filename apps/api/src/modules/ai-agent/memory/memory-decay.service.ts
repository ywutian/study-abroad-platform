/**
 * 记忆衰减服务 - 管理记忆的生命周期衰减
 *
 * 功能:
 * 1. 定时衰减任务
 * 2. 访问强化
 * 3. 过期清理
 * 4. 归档管理
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { Prisma } from '@prisma/client';
import { MemoryScorerService, MemoryTier } from './memory-scorer.service';

// ==================== 类型定义 ====================

export interface DecayConfig {
  enabled: boolean; // 是否启用衰减
  decayRate: number; // 每日衰减率 (默认 0.01)
  minImportance: number; // 最低重要性阈值 (默认 0.1)
  accessBoost: number; // 访问加成 (默认 0.05)
  maxAccessBoost: number; // 最大访问加成 (默认 0.3)

  // 归档配置
  archiveThreshold: number; // 归档阈值 (默认 0.2)
  archiveAfterDays: number; // N天后归档 (默认 180)
  deleteAfterDays: number; // N天后删除 (默认 365)

  // 批处理配置
  batchSize: number; // 每批处理数量 (默认 100)
}

export interface DecayResult {
  processed: number; // 处理数量
  decayed: number; // 衰减数量
  archived: number; // 归档数量
  deleted: number; // 删除数量
  boosted: number; // 强化数量
  errors: number; // 错误数量
  durationMs: number; // 耗时
}

export interface MemoryDecayStats {
  totalMemories: number;
  byTier: Record<MemoryTier, number>;
  averageImportance: number;
  averageFreshness: number;
  scheduledForArchive: number;
  scheduledForDelete: number;
}

// ==================== 服务实现 ====================

@Injectable()
export class MemoryDecayService implements OnModuleInit {
  private readonly logger = new Logger(MemoryDecayService.name);
  private config: DecayConfig;
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private scorer: MemoryScorerService,
    private redis: RedisService,
  ) {
    this.config = this.getDefaultConfig();
  }

  onModuleInit() {
    this.logger.log(
      `Memory decay service initialized (enabled: ${this.config.enabled})`,
    );
  }

  // ==================== 定时任务 ====================

  /**
   * 每天凌晨 3 点执行衰减任务
   */
  private static readonly DECAY_LOCK_KEY = 'memory:decay:lock';
  private static readonly LOCK_TTL = 600; // 10 minutes

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDailyDecay(): Promise<DecayResult> {
    if (!this.config.enabled) {
      this.logger.debug('Decay is disabled, skipping');
      return this.emptyResult();
    }

    // 分布式锁（Redis 不可用时降级到内存锁）
    const client = this.redis.getClient();
    const useRedisLock = !!(client && this.redis.connected);

    if (useRedisLock) {
      const locked = await client.set(
        MemoryDecayService.DECAY_LOCK_KEY,
        '1',
        'EX',
        MemoryDecayService.LOCK_TTL,
        'NX',
      );
      if (locked !== 'OK') {
        this.logger.warn('Decay lock held by another instance, skipping');
        return this.emptyResult();
      }
    } else if (this.isRunning) {
      this.logger.warn('Decay task already running, skipping');
      return this.emptyResult();
    }

    this.isRunning = true;
    const startTime = Date.now();
    const result: DecayResult = {
      processed: 0,
      decayed: 0,
      archived: 0,
      deleted: 0,
      boosted: 0,
      errors: 0,
      durationMs: 0,
    };

    try {
      this.logger.log('Starting daily memory decay task');

      // 1. 执行衰减
      const decayResult = await this.executeDecay();
      result.processed += decayResult.processed;
      result.decayed += decayResult.decayed;
      result.errors += decayResult.errors;

      // 2. 执行归档
      const archiveResult = await this.executeArchive();
      result.archived += archiveResult.archived;
      result.errors += archiveResult.errors;

      // 3. 执行删除
      const deleteResult = await this.executeDelete();
      result.deleted += deleteResult.deleted;
      result.errors += deleteResult.errors;

      result.durationMs = Date.now() - startTime;

      this.logger.log(
        `Daily decay completed: processed=${result.processed}, ` +
          `decayed=${result.decayed}, archived=${result.archived}, ` +
          `deleted=${result.deleted}, errors=${result.errors}, ` +
          `duration=${result.durationMs}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error('Daily decay task failed', error);
      result.errors++;
      return result;
    } finally {
      this.isRunning = false;
      if (useRedisLock) {
        await client.del(MemoryDecayService.DECAY_LOCK_KEY).catch(() => {});
      }
    }
  }

  // ==================== 核心方法 ====================

  /**
   * 执行衰减
   *
   * 对所有记忆应用时间衰减，降低重要性
   */
  private async executeDecay(): Promise<{
    processed: number;
    decayed: number;
    errors: number;
  }> {
    let processed = 0;
    let decayed = 0;
    let errors = 0;
    let offset = 0;

    while (true) {
      // 批量获取记忆
      const memories = await this.prisma.memory.findMany({
        where: {
          importance: { gt: this.config.minImportance },
        },
        select: {
          id: true,
          importance: true,
          createdAt: true,
          accessCount: true,
        },
        orderBy: { createdAt: 'asc' },
        skip: offset,
        take: this.config.batchSize,
      });

      if (memories.length === 0) break;

      for (const memory of memories) {
        try {
          processed++;

          // 计算新鲜度
          const freshness = this.scorer.getFreshness(memory.createdAt);

          // 计算新的重要性 = 原重要性 × (1 - 衰减率 × (1 - 新鲜度))
          // 新鲜度越低，衰减越快
          const decayFactor = this.config.decayRate * (1 - freshness);
          const newImportance = Math.max(
            this.config.minImportance,
            memory.importance * (1 - decayFactor),
          );

          // 只有当重要性变化显著时才更新
          if (Math.abs(newImportance - memory.importance) > 0.001) {
            await this.prisma.memory.update({
              where: { id: memory.id },
              data: { importance: newImportance },
            });
            decayed++;
          }
        } catch (error) {
          this.logger.error(`Failed to decay memory ${memory.id}`, error);
          errors++;
        }
      }

      offset += this.config.batchSize;

      // 防止无限循环
      if (offset > 100000) break;
    }

    return { processed, decayed, errors };
  }

  /**
   * 执行归档
   *
   * 将低重要性、长时间未访问的记忆移至归档
   */
  private async executeArchive(): Promise<{
    archived: number;
    errors: number;
  }> {
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - this.config.archiveAfterDays);

    try {
      // 标记为归档（合并到 metadata，不覆盖已有字段）
      const archiveMetadata = JSON.stringify({
        archived: true,
        archivedAt: new Date().toISOString(),
      });

      const result = await this.prisma.$executeRaw`
        UPDATE "Memory"
        SET metadata = COALESCE(metadata, '{}'::jsonb) || ${archiveMetadata}::jsonb,
            "updatedAt" = NOW()
        WHERE importance < ${this.config.archiveThreshold}
          AND "createdAt" < ${archiveDate}
          AND (metadata IS NULL OR NOT (metadata ? 'archived'))
      `;

      return { archived: result as number, errors: 0 };
    } catch (error) {
      this.logger.error('Failed to archive memories', error);
      return { archived: 0, errors: 1 };
    }
  }

  /**
   * 执行删除
   *
   * 删除过期的归档记忆
   */
  private async executeDelete(): Promise<{ deleted: number; errors: number }> {
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() - this.config.deleteAfterDays);

    try {
      const result = await this.prisma.memory.deleteMany({
        where: {
          createdAt: { lt: deleteDate },
          importance: { lt: this.config.minImportance },
        },
      });

      return { deleted: result.count, errors: 0 };
    } catch (error) {
      this.logger.error('Failed to delete expired memories', error);
      return { deleted: 0, errors: 1 };
    }
  }

  // ==================== 访问强化 ====================

  /**
   * 记录记忆访问，强化重要性
   */
  async recordAccess(memoryId: string): Promise<void> {
    try {
      const memory = await this.prisma.memory.findUnique({
        where: { id: memoryId },
        select: { importance: true, accessCount: true },
      });

      if (!memory) return;

      // 计算访问加成
      const currentBoost = Math.min(
        memory.accessCount * this.config.accessBoost,
        this.config.maxAccessBoost,
      );
      const newBoost = Math.min(
        (memory.accessCount + 1) * this.config.accessBoost,
        this.config.maxAccessBoost,
      );
      const boostDelta = newBoost - currentBoost;

      // 更新记忆
      await this.prisma.memory.update({
        where: { id: memoryId },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date(),
          // 小幅提升重要性
          importance: Math.min(1, memory.importance + boostDelta * 0.1),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record access for memory ${memoryId}`,
        error,
      );
    }
  }

  /**
   * 批量记录访问
   */
  async recordAccessBatch(memoryIds: string[]): Promise<void> {
    await Promise.all(memoryIds.map((id) => this.recordAccess(id)));
  }

  // ==================== 统计方法 ====================

  /**
   * 获取衰减统计信息
   */
  async getDecayStats(userId?: string): Promise<MemoryDecayStats> {
    const where = userId ? { userId } : {};

    const [totalMemories, avgStats, lowImportanceCount, oldMemoriesCount] =
      await Promise.all([
        this.prisma.memory.count({ where }),
        this.prisma.memory.aggregate({
          where,
          _avg: { importance: true },
        }),
        this.prisma.memory.count({
          where: {
            ...where,
            importance: { lt: this.config.archiveThreshold },
          },
        }),
        this.prisma.memory.count({
          where: {
            ...where,
            createdAt: {
              lt: new Date(
                Date.now() - this.config.archiveAfterDays * 24 * 60 * 60 * 1000,
              ),
            },
          },
        }),
      ]);

    // 计算各层级分布
    const tierDistribution = await this.calculateTierDistribution(where);

    // 计算平均新鲜度
    const memories = await this.prisma.memory.findMany({
      where,
      select: { createdAt: true },
      take: 1000, // 采样
    });

    const avgFreshness =
      memories.length > 0
        ? memories.reduce(
            (sum, m) => sum + this.scorer.getFreshness(m.createdAt),
            0,
          ) / memories.length
        : 0;

    return {
      totalMemories,
      byTier: tierDistribution,
      averageImportance: avgStats._avg.importance || 0,
      averageFreshness: avgFreshness,
      scheduledForArchive: lowImportanceCount,
      scheduledForDelete: oldMemoriesCount,
    };
  }

  private async calculateTierDistribution(
    where: Prisma.MemoryWhereInput,
  ): Promise<Record<MemoryTier, number>> {
    const [longCount, shortCount, archiveCount] = await Promise.all([
      this.prisma.memory.count({
        where: { ...where, importance: { gte: 0.7 } },
      }),
      this.prisma.memory.count({
        where: {
          ...where,
          importance: { gte: 0.3, lt: 0.7 },
        },
      }),
      this.prisma.memory.count({
        where: { ...where, importance: { lt: 0.3 } },
      }),
    ]);

    return {
      [MemoryTier.WORKING]: 0, // 工作记忆在 RAM，不统计
      [MemoryTier.SHORT]: shortCount,
      [MemoryTier.LONG]: longCount,
      [MemoryTier.ARCHIVE]: archiveCount,
    };
  }

  // ==================== 配置管理 ====================

  /**
   * 更新配置
   */
  updateConfig(config: Partial<DecayConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log(`Decay config updated: ${JSON.stringify(config)}`);
  }

  /**
   * 获取当前配置
   */
  getConfig(): DecayConfig {
    return { ...this.config };
  }

  /**
   * 手动触发衰减（用于测试）
   */
  async triggerDecay(): Promise<DecayResult> {
    return this.runDailyDecay();
  }

  private getDefaultConfig(): DecayConfig {
    return {
      enabled: true,
      decayRate: 0.01, // 每天衰减 1%
      minImportance: 0.1, // 最低重要性 10%
      accessBoost: 0.02, // 每次访问加 2%
      maxAccessBoost: 0.3, // 最大加成 30%
      archiveThreshold: 0.2, // 低于 20% 归档
      archiveAfterDays: 180, // 180 天后归档
      deleteAfterDays: 365, // 365 天后删除
      batchSize: 100, // 每批 100 条
    };
  }

  private emptyResult(): DecayResult {
    return {
      processed: 0,
      decayed: 0,
      archived: 0,
      deleted: 0,
      boosted: 0,
      errors: 0,
      durationMs: 0,
    };
  }
}
