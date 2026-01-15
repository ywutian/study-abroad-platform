import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * IPEDS 数据服务
 *
 * 数据源: NCES (National Center for Education Statistics)
 * 下载地址: https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx
 *
 * IPEDS 比 College Scorecard 更详细，包含:
 * - 国际生比例
 * - 各专业招生人数
 * - 教职工数据
 * - 财务详情
 */
@Injectable()
export class IpedsDataService {
  private readonly logger = new Logger(IpedsDataService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * IPEDS 数据需要下载 CSV 后导入
   * 下载链接: https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx
   *
   * 常用数据文件:
   * - HD (Directory Information) - 学校基本信息
   * - IC (Institutional Characteristics) - 申请截止日期、录取要求
   * - ADM (Admissions) - 录取数据
   * - EF (Fall Enrollment) - 国际生数据
   * - C (Completions) - 各专业毕业人数
   */

  /**
   * 导入国际生数据
   * 数据来源: IPEDS EF (Enrollment) 表
   */
  async importInternationalStudentData(data: InternationalStudentData[]) {
    this.logger.log(`导入 ${data.length} 条国际生数据`);

    for (const item of data) {
      const school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: item.schoolName },
            { metadata: { path: ['ipedsId'], equals: item.unitId } },
          ],
        },
      });

      if (school) {
        await this.prisma.schoolMetric.upsert({
          where: {
            schoolId_year_metricKey: {
              schoolId: school.id,
              year: item.year,
              metricKey: 'intl_student_pct',
            },
          },
          update: { value: item.internationalPct },
          create: {
            schoolId: school.id,
            year: item.year,
            metricKey: 'intl_student_pct',
            value: item.internationalPct,
          },
        });
      }
    }

    this.logger.log('国际生数据导入完成');
  }

  /**
   * 导入申请截止日期
   * 数据来源: IPEDS IC (Institutional Characteristics)
   */
  async importAdmissionDeadlines(data: AdmissionDeadlineData[]) {
    this.logger.log(`导入 ${data.length} 条申请截止日期`);

    for (const item of data) {
      const school = await this.prisma.school.findFirst({
        where: {
          OR: [
            { name: item.schoolName },
            { metadata: { path: ['ipedsId'], equals: item.unitId } },
          ],
        },
      });

      if (school) {
        await this.prisma.school.update({
          where: { id: school.id },
          data: {
            metadata: {
              ...((school.metadata as object) || {}),
              ipedsId: item.unitId,
              rdDeadline: item.regularDeadline,
              edDeadline: item.earlyDeadline,
              applicationFee: item.applicationFee,
            },
          },
        });
      }
    }

    this.logger.log('申请截止日期导入完成');
  }

  /**
   * 从 IPEDS CSV 文件解析数据
   *
   * 下载步骤:
   * 1. 访问 https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx
   * 2. 选择年份和数据表 (如 ADM, EF, IC)
   * 3. 下载 CSV 文件
   * 4. 调用此方法导入
   */
  async parseIpedsCsv(
    csvContent: string,
    type: 'ADM' | 'EF' | 'IC',
  ): Promise<any[]> {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
      if (values.length !== headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => (row[h] = values[idx]));
      data.push(row);
    }

    return data;
  }
}

interface InternationalStudentData {
  unitId: string;
  schoolName: string;
  year: number;
  internationalPct: number;
}

interface AdmissionDeadlineData {
  unitId: string;
  schoolName: string;
  regularDeadline: string | null;
  earlyDeadline: string | null;
  applicationFee: number | null;
}
