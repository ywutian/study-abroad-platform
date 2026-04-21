import { Injectable, Logger } from '@nestjs/common';
import { DataReviewStatus } from '@prisma/client';
import type { SchoolProvenance } from '@study-abroad/shared';
import { normalizeSchoolProvenance } from '@study-abroad/shared/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeSchoolName } from '../../common/utils/school-name.util';
import { createFieldProvenance, toRecord } from './school-provenance.helpers';
import { SchoolWriteService } from './school-write.service';

/**
 * 数据来源定义
 * 优先级从高到低（priority 越低越优先）
 */
export enum DataSource {
  MANUAL_ADMIN = 'MANUAL_ADMIN', // 管理员手动设置
  SEED = 'SEED', // 人工整理的种子数据
  COLLEGE_SCORECARD = 'COLLEGE_SCORECARD', // College Scorecard API
  URBAN_INSTITUTE = 'URBAN_INSTITUTE', // Urban Institute IPEDS API
  BIGFUTURE = 'BIGFUTURE', // College Board BigFuture 爬虫
  APPILY = 'APPILY', // Appily (原 Cappex) 爬虫
  IPEDS = 'IPEDS', // IPEDS CSV 导入（保留备份）
  SCRAPER = 'SCRAPER', // 通用网页爬虫
}

const SOURCE_PRIORITY: Record<DataSource, number> = {
  [DataSource.COLLEGE_SCORECARD]: 1,
  [DataSource.URBAN_INSTITUTE]: 2,
  [DataSource.IPEDS]: 3,
  [DataSource.MANUAL_ADMIN]: 4,
  [DataSource.SEED]: 5,
  [DataSource.BIGFUTURE]: 6,
  [DataSource.APPILY]: 7,
  [DataSource.SCRAPER]: 8,
};

export const VERIFIED_SCHOOL_DATA_SOURCES = new Set<DataSource>([
  DataSource.COLLEGE_SCORECARD,
  DataSource.URBAN_INSTITUTE,
  DataSource.IPEDS,
]);

export type ProvenanceRecord = SchoolProvenance;

/**
 * 可合并的学校数据字段
 */
export const MERGEABLE_FIELDS = [
  'name',
  'nameZh',
  'state',
  'city',
  'website',
  'acceptanceRate',
  'satAvg',
  'sat25',
  'sat75',
  'satMath25',
  'satMath75',
  'satReading25',
  'satReading75',
  'actAvg',
  'act25',
  'act75',
  'tuition',
  'studentCount',
  'graduationRate',
  'avgSalary',
  'totalEnrollment',
  'isPrivate',
  'description',
  'descriptionZh',
  'logoUrl',
  'usNewsRank',
  'qsRank',
  'nicheSafetyGrade',
  'nicheLifeGrade',
  'nicheFoodGrade',
  'nicheOverallGrade',
  // Promoted from metadata (Phase 1)
  'retentionRate',
  'studentFacultyRatio',
  'percentNeedMet',
  'averageAidPackage',
  'averageNetPrice',
  'roomAndBoard',
  'applicationFee',
  'feeWaiverAvailable',
  'acceptsCommonApp',
  'acceptsCoalition',
  'testOptional',
  'testingPolicy',
  'hasEarlyDecision',
  'salary6YrPostGrad',
  'loanDefaultRate',
  'monthlyLoanPayment',
  'countriesRepresented',
  'studentOrgsCount',
] as const;

export type MergeableField = (typeof MERGEABLE_FIELDS)[number];

export function isMergeableSchoolField(field: string): field is MergeableField {
  return (MERGEABLE_FIELDS as readonly string[]).includes(field);
}

/** 1 year in ms — stale threshold for allowing lower-priority source to override */
const STALE_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class SchoolDataMerger {
  private readonly logger = new Logger(SchoolDataMerger.name);

  constructor(
    private prisma: PrismaService,
    private schoolWriteService: SchoolWriteService,
  ) {}

  /**
   * 合并数据到指定学校
   *
   * 合并规则：
   * 1. 低优先级源不能覆盖高优先级源的非空值（除非已超过 1 年未更新）
   * 2. null/undefined 值永远不会覆盖已有的非空值
   * 3. 所有写入都记录 provenance
   *
   * @param schoolId - 目标学校 ID
   * @param incomingData - 要合并的字段数据（key-value）
   * @param source - 数据来源
   * @returns 实际写入的字段列表
   */
  async merge(
    schoolId: string,
    incomingData: Partial<Record<MergeableField, unknown>>,
    source: DataSource,
  ): Promise<{ updatedFields: string[]; skippedFields: string[] }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      this.logger.warn(`School not found: ${schoolId}`);
      return { updatedFields: [], skippedFields: [] };
    }

    const metadata = toRecord(school.metadata);
    const provenance = normalizeSchoolProvenance(metadata.provenance);
    const now = new Date().toISOString();

    const updateData: Record<string, unknown> = {};
    const updatedFields: string[] = [];
    const skippedFields: string[] = [];

    for (const field of MERGEABLE_FIELDS) {
      const incomingValue = incomingData[field];

      // Skip fields not in incoming data or with null/undefined value
      if (incomingValue == null || incomingValue === undefined) continue;

      const currentValue = (school as Record<string, unknown>)[field];
      const fieldProv = provenance[field];

      // Decide whether to write
      if (currentValue != null && currentValue !== '') {
        // Field already has a value — check provenance priority
        if (fieldProv) {
          const existingPriority =
            SOURCE_PRIORITY[fieldProv.source as DataSource] ?? 99;
          const incomingPriority = SOURCE_PRIORITY[source];

          // Lower-priority source cannot overwrite higher-priority source...
          if (incomingPriority > existingPriority) {
            // ...unless the existing value is stale (> 1 year old)
            const existingAge =
              Date.now() - new Date(fieldProv.fetchedAt).getTime();
            if (existingAge < STALE_THRESHOLD_MS) {
              skippedFields.push(field);
              continue;
            }
            // Stale — allow override
          }
        }
        // Same or higher priority, or no provenance recorded — allow override
      }

      // Write the field
      updateData[field] = incomingValue;
      updatedFields.push(field);
      provenance[field] = createFieldProvenance({
        source,
        fetchedAt: now,
      });
    }

    // Only update if there's something to write
    if (updatedFields.length > 0) {
      await this.schoolWriteService.update(schoolId, {
        fields: updateData,
        metadataPatch: metadata,
        provenance,
        reviewStatus: DataReviewStatus.AUTO_APPROVED,
        touchReviewTimestamp: true,
        existingMetadata: metadata,
      });
    }

    return { updatedFields, skippedFields };
  }

  /**
   * 按学校名称合并（先查找再合并）
   */
  async mergeByName(
    name: string,
    incomingData: Partial<Record<MergeableField, unknown>>,
    source: DataSource,
  ): Promise<{ updatedFields: string[]; skippedFields: string[] } | null> {
    const nameNorm = normalizeSchoolName(name);
    const school = await this.prisma.school.findUnique({
      where: { nameNorm },
    });

    if (!school) {
      this.logger.warn(`School not found by name: ${name}`);
      return null;
    }

    return this.merge(school.id, incomingData, source);
  }

  /**
   * 获取某学校的 provenance 记录
   */
  async getProvenance(schoolId: string): Promise<ProvenanceRecord | null> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { metadata: true },
    });

    if (!school) return null;

    const metadata = toRecord(school.metadata);
    return normalizeSchoolProvenance(metadata.provenance);
  }

  /**
   * 批量合并多所学校的数据
   */
  async batchMerge(
    entries: Array<{
      name: string;
      data: Partial<Record<MergeableField, unknown>>;
    }>,
    source: DataSource,
  ): Promise<{ processed: number; updated: number; notFound: number }> {
    let processed = 0;
    let updated = 0;
    let notFound = 0;

    for (const entry of entries) {
      processed++;
      const result = await this.mergeByName(entry.name, entry.data, source);
      if (result === null) {
        notFound++;
      } else if (result.updatedFields.length > 0) {
        updated++;
      }
    }

    this.logger.log(
      `Batch merge [${source}]: ${processed} processed, ${updated} updated, ${notFound} not found`,
    );

    return { processed, updated, notFound };
  }
}
