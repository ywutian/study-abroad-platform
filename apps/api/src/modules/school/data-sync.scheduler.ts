import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SchoolDataService } from './school-data.service';
import { UrbanInstituteDataService } from './urban-institute-data.service';
import { BigFutureScrapeService } from './scrapers/bigfuture.scraper';
import { AppilyScrapeService } from './scrapers/appily.scraper';
import { PrismaService } from '../../prisma/prisma.service';
import { buildFieldProvenanceRecord } from './school-provenance.helpers';
import { SchoolWriteService } from './school-write.service';

/**
 * 数据自动同步调度器
 *
 * 更新策略:
 * - College Scorecard: 每月 1 日凌晨 (数据每年更新)
 * - IPEDS: 每季度检查 (3月、6月、9月、12月)
 * - 排名数据: 每年 9 月 (US News 发布新排名)
 */
@Injectable()
export class DataSyncScheduler {
  private readonly logger = new Logger(DataSyncScheduler.name);

  constructor(
    private schoolDataService: SchoolDataService,
    private urbanInstituteService: UrbanInstituteDataService,
    private bigFutureService: BigFutureScrapeService,
    private appilyService: AppilyScrapeService,
    private prisma: PrismaService,
    private schoolWriteService: SchoolWriteService,
  ) {}

  /**
   * 每月 1 日凌晨 3 点同步 College Scorecard
   */
  @Cron('0 3 1 * *')
  async syncCollegeScorecard() {
    this.logger.log('🔄 开始月度 College Scorecard 同步...');

    try {
      const result =
        await this.schoolDataService.syncSchoolsFromScorecard(2000);
      this.logger.log(`✅ College Scorecard 同步完成: ${result.synced} 所学校`);

      // 记录同步日志
      await this.logSync('COLLEGE_SCORECARD', result.synced, result.errors);
    } catch (error: unknown) {
      this.logger.error(
        '❌ College Scorecard 同步失败',
        error instanceof Error ? error.message : String(error),
      );
      await this.logSync(
        'COLLEGE_SCORECARD',
        0,
        1,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 每季度从 Urban Institute API 同步 IPEDS 数据 (1月、4月、7月、10月)
   */
  @Cron('0 4 1 1,4,7,10 *')
  async syncUrbanInstitute() {
    this.logger.log('Starting quarterly Urban Institute IPEDS sync...');

    try {
      const result = await this.urbanInstituteService.syncAll(undefined, 500);
      this.logger.log(
        `Urban Institute sync completed: ${result.total.synced} synced`,
      );
      await this.logSync(
        'URBAN_INSTITUTE',
        result.total.synced,
        result.total.errors,
      );
    } catch (error: unknown) {
      this.logger.error(
        'Urban Institute sync failed',
        error instanceof Error ? error.message : String(error),
      );
      await this.logSync(
        'URBAN_INSTITUTE',
        0,
        1,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 每季度爬取 BigFuture 数据 (1月、4月、7月、10月 5:00)
   */
  @Cron('0 5 1 1,4,7,10 *')
  async scrapeBigFuture() {
    this.logger.log('Starting quarterly BigFuture scrape...');

    try {
      const result = await this.bigFutureService.scrapeSchools(200);
      this.logger.log(
        `BigFuture scrape completed: ${result.scraped} scraped, ${result.updated} updated`,
      );
      await this.logSync('BIGFUTURE', result.scraped, result.failed);
    } catch (error: unknown) {
      this.logger.error(
        'BigFuture scrape failed',
        error instanceof Error ? error.message : String(error),
      );
      await this.logSync(
        'BIGFUTURE',
        0,
        1,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 每季度爬取 Appily 数据 (1月、4月、7月、10月 6:00)
   */
  @Cron('0 6 1 1,4,7,10 *')
  async scrapeAppily() {
    this.logger.log('Starting quarterly Appily scrape...');

    try {
      const result = await this.appilyService.scrapeSchools(200);
      this.logger.log(
        `Appily scrape completed: ${result.scraped} scraped, ${result.updated} updated`,
      );
      await this.logSync('APPILY', result.scraped, result.failed);
    } catch (error: unknown) {
      this.logger.error(
        'Appily scrape failed',
        error instanceof Error ? error.message : String(error),
      );
      await this.logSync(
        'APPILY',
        0,
        1,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 每季度检查 IPEDS CSV 更新 (3月、6月、9月、12月 — 备份渠道)
   */
  @Cron('0 4 1 3,6,9,12 *')
  async checkIpedsUpdates() {
    this.logger.log('Checking IPEDS CSV updates (backup channel)...');

    this.logger.log(
      'IPEDS CSV check completed. Urban Institute API is primary sync source.',
    );

    await this.logSync('IPEDS_CHECK', 0, 0, 'Manual check — backup channel');
  }

  /**
   * 每年 9 月 15 日更新排名 (US News 通常 9 月发布)
   */
  @Cron('0 5 15 9 *')
  async updateRankings() {
    this.logger.log('🔄 提醒: US News 新排名已发布，请更新数据');

    // 排名数据需要手动更新
    // 这里发送提醒

    await this.logSync('RANKINGS_REMINDER', 0, 0, 'Manual update required');
  }

  /**
   * 记录同步日志
   */
  private async logSync(
    source: string,
    successCount: number,
    errorCount: number,
    message?: string,
  ) {
    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    await this.prisma.auditLog.create({
      data: {
        action: 'DATA_SYNC',
        resource: source,
        metadata: {
          successCount,
          errorCount,
          message,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }
}

/**
 * 手动触发同步的 Service
 */
@Injectable()
export class ManualSyncService {
  private readonly logger = new Logger(ManualSyncService.name);

  constructor(
    private schoolDataService: SchoolDataService,
    private prisma: PrismaService,
    private schoolWriteService: SchoolWriteService,
  ) {}

  /**
   * 从 IPEDS CSV 文件导入数据
   *
   * 使用方法:
   * 1. 下载 IPEDS 数据: https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx
   * 2. 上传 CSV 文件到服务器
   * 3. 调用此方法导入
   */
  async importIpedsCsv(filePath: string, dataType: 'ADM' | 'EF' | 'IC') {
    const fs = await import('fs');
    const content = fs.readFileSync(filePath, 'utf-8');

    this.logger.log(`📥 开始导入 IPEDS ${dataType} 数据...`);

    const lines = content.split('\n');
    const headers = this.parseCsvLine(lines[0]);

    let imported = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      try {
        const values = this.parseCsvLine(lines[i]);
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => (row[h] = values[idx] || ''));

        await this.processIpedsRow(row, dataType);
        imported++;

        if (imported % 100 === 0) {
          this.logger.log(`  已导入 ${imported} 条...`);
        }
      } catch {
        errors++;
      }
    }

    this.logger.log(
      `✅ IPEDS ${dataType} 导入完成: ${imported} 成功, ${errors} 失败`,
    );
    return { imported, errors };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  private async processIpedsRow(row: Record<string, string>, dataType: string) {
    const unitId = row['UNITID'] || row['unitid'];
    const instnm = row['INSTNM'] || row['instnm'];

    if (!unitId || !instnm) return;

    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { name: instnm },
          { metadata: { path: ['ipedsId'], equals: unitId } },
        ],
      },
    });

    if (!school) return;

    // 根据数据类型更新不同字段
    switch (dataType) {
      case 'ADM': // Admissions data
        await this.updateAdmissionsData(school.id, row);
        break;
      case 'EF': // Enrollment data (国际生)
        await this.updateEnrollmentData(school.id, row);
        break;
      case 'IC': // Institutional Characteristics (截止日期)
        await this.updateInstitutionalData(school.id, row);
        break;
    }
  }

  private async updateAdmissionsData(
    schoolId: string,
    row: Record<string, string>,
  ) {
    // IPEDS ADM 表字段
    // APPLCN - 申请人数
    // ADMSSN - 录取人数
    // ENRLT - 入学人数
    // SATNUM - SAT 提交人数
    // SATPCT - SAT 提交比例
    // ACTNUM - ACT 提交人数

    const year = parseInt(
      row['YEAR'] || row['year'] || new Date().getFullYear().toString(),
    );

    if (row['APPLCN'] && row['ADMSSN']) {
      const applications = parseInt(row['APPLCN']);
      const admissions = parseInt(row['ADMSSN']);
      if (applications > 0) {
        // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
        await this.prisma.schoolMetric.upsert({
          where: {
            schoolId_year_metricKey: {
              schoolId,
              year,
              metricKey: 'applications',
            },
          },
          update: { value: applications },
          create: {
            schoolId,
            year,
            metricKey: 'applications',
            value: applications,
          },
        });
        // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
        await this.prisma.schoolMetric.upsert({
          where: {
            schoolId_year_metricKey: {
              schoolId,
              year,
              metricKey: 'admissions',
            },
          },
          update: { value: admissions },
          create: {
            schoolId,
            year,
            metricKey: 'admissions',
            value: admissions,
          },
        });
      }
    }
  }

  private async updateEnrollmentData(
    schoolId: string,
    row: Record<string, string>,
  ) {
    // IPEDS EF 表字段
    // EFNRALT - 非居民外国学生总数
    // EFTOTLT - 学生总数

    const year = parseInt(
      row['YEAR'] || row['year'] || new Date().getFullYear().toString(),
    );
    const intlStudents = parseInt(row['EFNRALT'] || '0');
    const totalStudents = parseInt(row['EFTOTLT'] || '0');

    if (totalStudents > 0 && intlStudents >= 0) {
      const intlPct = (intlStudents / totalStudents) * 100;

      // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
      await this.prisma.schoolMetric.upsert({
        where: {
          schoolId_year_metricKey: {
            schoolId,
            year,
            metricKey: 'intl_student_pct',
          },
        },
        update: { value: intlPct },
        create: {
          schoolId,
          year,
          metricKey: 'intl_student_pct',
          value: intlPct,
        },
      });

      // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
      await this.prisma.schoolMetric.upsert({
        where: {
          schoolId_year_metricKey: {
            schoolId,
            year,
            metricKey: 'intl_student_count',
          },
        },
        update: { value: intlStudents },
        create: {
          schoolId,
          year,
          metricKey: 'intl_student_count',
          value: intlStudents,
        },
      });
    }
  }

  private async updateInstitutionalData(
    schoolId: string,
    row: Record<string, string>,
  ) {
    // IPEDS IC 表字段
    // APPLFEEU - 本科申请费
    // ROOM, BOARD - 食宿费用

    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) return;

    const fetchedAt = new Date().toISOString();
    const fields: Record<string, unknown> = {};
    const provenanceFields: string[] = [];

    if (row['APPLFEEU']) {
      fields.applicationFee = parseInt(row['APPLFEEU']);
      provenanceFields.push('applicationFee');
    }
    if (row['ROOM'] && row['BOARD']) {
      fields.roomAndBoard = parseInt(row['ROOM']) + parseInt(row['BOARD']);
      provenanceFields.push('roomAndBoard');
    }

    if (provenanceFields.length === 0) {
      return;
    }

    await this.schoolWriteService.update(schoolId, {
      fields,
      provenance: buildFieldProvenanceRecord(provenanceFields, {
        source: 'IPEDS',
        fetchedAt,
      }),
      existingMetadata: school.metadata,
    });
  }
}
