import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EssayScraperService } from './essay-scraper.service';
import { PrismaService } from '../../prisma/prisma.service';

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
  ) {}

  /**
   * 每年 8 月 1 日凌晨 3 点 — 申请季前全量采集
   * CommonApp + 各校 supplement + 变化检测
   */
  @Cron('0 3 1 8 *')
  async annualPreSeasonScrape() {
    this.logger.log('Scheduled: Pre-season essay scrape starting');
    await this.runPipeline('SCHEDULED_PRE_SEASON');
  }

  /**
   * 每年 1 月 15 日凌晨 3 点 — RD 截止后验证采集
   */
  @Cron('0 3 15 1 *')
  async postRdDeadlineVerify() {
    this.logger.log('Scheduled: Post-RD deadline verification scrape starting');
    await this.runPipeline('SCHEDULED_POST_RD');
  }

  /**
   * 执行管道并记录运行状态
   */
  async runPipeline(trigger: string, operatorId?: string): Promise<string> {
    const year = this.getCurrentApplicationYear();

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
    } catch (e) {
      details.push({
        schoolName: 'CommonApp',
        success: false,
        error: e.message,
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
      } catch (e) {
        failedCount++;
        details.push({ schoolName, success: false, error: e.message });
      }
    }

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
