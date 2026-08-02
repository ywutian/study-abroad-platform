import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SchoolScraperService } from './school-scraper.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 学校数据爬虫定时任务
 *
 * 更新频率:
 * - 文书题目: 每年 8 月 (申请季开始前)
 * - 截止日期: 每年 7 月 + 11 月 (申请季前后)
 * - 录取要求: 每季度
 */
@Injectable()
export class SchoolScraperScheduler {
  private readonly logger = new Logger(SchoolScraperScheduler.name);

  constructor(
    private scraperService: SchoolScraperService,
    private prisma: PrismaService,
  ) {}

  /**
   * 每年 8 月 1 日凌晨更新 (申请季前)
   *
   * 更新内容: 文书题目、截止日期、录取要求
   */
  @Cron('0 3 1 8 *')
  async annualUpdateBeforeApplicationSeason() {
    this.logger.log('📅 年度更新: 申请季前数据同步');
    await this.runScraper('ANNUAL_PRE_SEASON');
  }

  /**
   * 每年 11 月 15 日更新 (ED/EA 截止后)
   *
   * 更新内容: RD 截止日期确认
   */
  @Cron('0 3 15 11 *')
  async updateAfterEarlyDeadlines() {
    this.logger.log('📅 更新: ED/EA 截止后同步');
    await this.runScraper('POST_EARLY_DEADLINE');
  }

  /**
   * 每季度第一天更新录取要求
   */
  @Cron('0 4 1 1,4,7,10 *')
  async quarterlyUpdate() {
    this.logger.log('📅 季度更新: 录取要求同步');
    await this.runScraper('QUARTERLY');
  }

  /**
   * 执行爬虫并记录日志
   */
  private async runScraper(trigger: string) {
    try {
      const result = await this.scraperService.scrapeAllSchools();

      // 记录审计日志
      // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
      await this.prisma.auditLog.create({
        data: {
          action: 'SCHOOL_SCRAPE',
          resource: 'school',
          metadata: {
            trigger,
            success: result.success.length,
            failed: result.failed.length,
            total: result.total,
            failedSchools: result.failed,
            timestamp: new Date().toISOString(),
          },
        },
      });

      this.logger.log(`✅ 爬取完成: ${result.success.length}/${result.total}`);
    } catch (error: unknown) {
      this.logger.error(
        '❌ 爬取失败',
        error instanceof Error ? error.message : String(error),
      );

      // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
      await this.prisma.auditLog.create({
        data: {
          action: 'SCHOOL_SCRAPE_ERROR',
          resource: 'school',
          metadata: {
            trigger,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          },
        },
      });
    }
  }
}
