import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SchoolDataService } from './school-data.service';
import { PrismaService } from '../../prisma/prisma.service';

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
    private prisma: PrismaService,
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
   * 每季度检查 IPEDS 更新 (3月、6月、9月、12月 1日)
   */
  @Cron('0 4 1 3,6,9,12 *')
  async checkIpedsUpdates() {
    this.logger.log('🔄 检查 IPEDS 数据更新...');

    // IPEDS 需要手动下载，这里只发送提醒
    // 实际生产中可以:
    // 1. 检查 IPEDS 网站的 RSS/更新页面
    // 2. 发送邮件/Slack 通知管理员
    // 3. 如果有预下载的文件，自动导入

    this.logger.log(
      '📧 IPEDS 更新检查完成，请手动检查 https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx',
    );

    await this.logSync('IPEDS_CHECK', 0, 0, 'Manual check required');
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
      } catch (err) {
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

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) return;

    const metadata = (school.metadata as Record<string, unknown>) || {};

    if (row['APPLFEEU']) {
      metadata.applicationFee = parseInt(row['APPLFEEU']);
    }
    if (row['ROOM'] && row['BOARD']) {
      metadata.roomAndBoard = parseInt(row['ROOM']) + parseInt(row['BOARD']);
    }

    await this.prisma.school.update({
      where: { id: schoolId },
      data: { metadata: metadata as any },
    });
  }
}
