import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EssayScraperService } from './essay-scraper.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';
import { runWithCronLock } from '../../common/redis/cron-lock.util';

const ESSAY_SCRAPER_LOCK_KEY = 'essay-scraper:cron-lock';

/**
 * 文书采集定时调度器
 *
 * 更新频率:
 * - 8 月 1 日: 申请季前全量采集（新一年文书题目发布）
 * - 1 月 15 日: RD 截止后验证（确认 RD 截止前的题目仍然有效）
 */
@Injectable()
export class EssayScraperScheduler {
  private readonly logger = new Logger(EssayScraperScheduler.name);

  constructor(
    private scraperService: EssayScraperService,
    private prisma: PrismaService,
    @Optional() private redis?: RedisService,
  ) {}

  /**
   * 每年 8 月 1 日凌晨 3 点 — 申请季前全量采集
   * CommonApp + 各校 supplement + 变化检测
   *
   * Single-flight across replicas — without it every Cloud Run instance runs the
   * full scrape, and the scraper's non-atomic findFirst-then-create races to
   * insert DUPLICATE EssayPrompt rows. The lock guards the scheduled path only
   * (manual runPipeline / admin invocation is unaffected).
   */
  @Cron('0 3 1 8 *')
  async annualPreSeasonScrape() {
    await runWithCronLock(
      this.redis,
      ESSAY_SCRAPER_LOCK_KEY,
      REDIS_TTL.ESSAY_SCRAPER_CRON_LOCK,
      async () => {
        this.logger.log('Scheduled: Pre-season essay scrape starting');
        await this.runPipeline('SCHEDULED_PRE_SEASON');
      },
      this.logger,
    );
  }

  /**
   * 每年 1 月 15 日凌晨 3 点 — RD 截止后验证采集
   */
  @Cron('0 3 15 1 *')
  async postRdDeadlineVerify() {
    await runWithCronLock(
      this.redis,
      ESSAY_SCRAPER_LOCK_KEY,
      REDIS_TTL.ESSAY_SCRAPER_CRON_LOCK,
      async () => {
        this.logger.log(
          'Scheduled: Post-RD deadline verification scrape starting',
        );
        await this.runPipeline('SCHEDULED_POST_RD');
      },
      this.logger,
    );
  }

  /**
   * 执行管道并记录运行状态
   */
  async runPipeline(trigger: string, operatorId?: string): Promise<string> {
    const year = this.getCurrentApplicationYear();

    // governance: system-scope — EssayPipelineRun is scraper bookkeeping, not user data
    const run = await this.prisma.essayPipelineRun.create({
      data: {
        trigger,
        year,
        status: 'RUNNING',
        operatorId: operatorId || null,
      },
    });

    // 异步执行，不阻塞调度器
    this.executePipeline(run.id, year).catch((err) => {
      this.logger.error(`Pipeline ${run.id} failed: ${err.message}`);
    });

    return run.id;
  }

  private async executePipeline(runId: string, year: number) {
    const schools = await this.scraperService.getConfiguredSchools();

    // governance: system-scope — EssayPipelineRun is scraper bookkeeping, not user data
    await this.prisma.essayPipelineRun.update({
      where: { id: runId },
      data: { totalSchools: schools.length },
    });

    let successCount = 0;
    let failedCount = 0;
    let newPrompts = 0;
    const changedPrompts = 0;
    const details: any[] = [];

    // 1. CommonApp 先采集
    try {
      const caResult = await this.scraperService.scrapeAndLinkCommonApp(year);
      if (caResult.success) {
        successCount++;
        newPrompts += caResult.essaysFound;
      }
      details.push(caResult);
    } catch (e: unknown) {
      details.push({
        schoolName: 'CommonApp',
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // 2. 逐校采集 supplement
    for (const schoolName of schools) {
      try {
        const result = await this.scraperService.scrapeSchool(schoolName, year);
        if (result.success) {
          successCount++;
          newPrompts += result.essaysFound;
        } else {
          failedCount++;
        }
        details.push(result);
      } catch (e: unknown) {
        failedCount++;
        details.push({
          schoolName,
          success: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // governance: system-scope — EssayPipelineRun is scraper bookkeeping, not user data
    await this.prisma.essayPipelineRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        successCount,
        failedCount,
        newPrompts,
        changedPrompts,
        details,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `Pipeline ${runId} completed: ${successCount} success, ${failedCount} failed, ${newPrompts} new prompts`,
    );
  }

  private getCurrentApplicationYear(): number {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  }
}
