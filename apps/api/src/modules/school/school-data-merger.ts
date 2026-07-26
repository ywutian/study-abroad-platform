import { Injectable, Logger } from '@nestjs/common';
import { DataReviewStatus } from '@prisma/client';
import type { RealDataStatus, SchoolProvenance } from '@study-abroad/shared';
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
  NICHE_TAVILY = 'SCRAPER:TAVILY_NICHE', // Tavily 搜索索引里的 Niche 页面片段
}

/**
 * Source of a provenance entry that carries no `source` field of its own.
 * `deriveProvenanceSource` (packages/shared) stamps closure-v2 collected data
 * with this, so it has to be rankable here.
 */
export const CLOSURE_V2_SOURCE = 'CLOSURE_V2';

/**
 * Values read directly off a school's own admissions page and recorded with
 * the URL and the wording they came from (e.g. the 2026-07-25 testing-policy
 * collection). Same character as closure-v2: a primary document, not a bulk
 * feed. It would be protected by UNKNOWN_SOURCE_PRIORITY anyway; ranked here
 * explicitly so the protection is stated rather than inherited.
 */
export const OFFICIAL_PAGE_SOURCE = 'OFFICIAL_ADMISSIONS_PAGE';

/**
 * Write priority — LOWER number wins. This table used to be **inverted against
 * the enum declared right above it**, which documents the intended order as
 * "优先级从高到低" starting at MANUAL_ADMIN: it put COLLEGE_SCORECARD at 1 and
 * MANUAL_ADMIN/SEED at 4/5, so every bulk sync outranked every hand-verified
 * value.
 *
 * Combined with the `?? 99` fallback below, that was a loaded gun. closure-v2
 * entries derive the source `CLOSURE_V2`, which is not a `DataSource` member,
 * so they scored 99 — and `incomingPriority > existingPriority` (1 > 99) is
 * false, meaning the overwrite was permitted outright. The first Scorecard
 * sync to run against prod would silently revert the whole 2026-05-31 audit
 * (SJSU 84.61, Hawaii 86.6, CU Boulder 80.5, ~20 anchors) to values that lag
 * roughly two years. `MERGEABLE_FIELDS` includes `acceptanceRate`, i.e. the
 * prediction anchor itself. Nothing today fires it only because the prod
 * deploy has no COLLEGE_SCORECARD_API_KEY — adding that key is all it takes.
 *
 * Ordering principle: read from the school's own published source beats a bulk
 * federal aggregator. closure-v2 and admin edits are checked against a primary
 * document; Scorecard/IPEDS are convenient but stale by construction.
 */
const SOURCE_PRIORITY: Record<string, number> = {
  [CLOSURE_V2_SOURCE]: 1, // agent-verified against the school's own CDS/IR page
  [OFFICIAL_PAGE_SOURCE]: 1, // read off the school's own admissions page, URL recorded
  [DataSource.MANUAL_ADMIN]: 2, // deliberate human override
  [DataSource.SEED]: 3, // curated + audited seed corrections
  [DataSource.COLLEGE_SCORECARD]: 4,
  [DataSource.URBAN_INSTITUTE]: 5,
  [DataSource.IPEDS]: 6,
  [DataSource.BIGFUTURE]: 7,
  [DataSource.APPILY]: 8,
  [DataSource.NICHE_TAVILY]: 9,
  [DataSource.SCRAPER]: 10,
};

/**
 * Priority for an existing value whose source we don't recognize.
 *
 * Fails SAFE (treated as top priority) rather than the old 99. An unknown
 * source is far more likely to be verified data written by a pipeline this
 * table hasn't caught up with than it is to be junk — that is precisely how
 * closure-v2 got clobbered. The staleness valve below still lets genuinely
 * old values be replaced, so this protects rather than freezes.
 */
const UNKNOWN_SOURCE_PRIORITY = 1;

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
  'needBlindInternational',
  'intlStudentPct',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'transferAcceptanceRate',
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
  'housingAvailable',
  'housingRequiredYears',
  'percentLivingOnCampus',
  'mealPlanCost',
  'campusSafetyServices',
  'campusLifeSummary',
] as const;

export type MergeableField = (typeof MERGEABLE_FIELDS)[number];

export interface MergeProvenanceOptions {
  sourceUrl?: string;
  cycleYear?: number;
  notes?: string;
  confidence?: number;
  extractionMethod?: string;
}

export interface TerminalProvenanceOptions {
  sourceUrl?: string;
  notes?: string;
  confidence?: number;
  extractionMethod?: string;
  realDataStatus?: RealDataStatus;
  reason?: string;
}

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
    provenanceOptions: MergeProvenanceOptions = {},
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
            SOURCE_PRIORITY[fieldProv.source] ?? UNKNOWN_SOURCE_PRIORITY;
          const incomingPriority =
            SOURCE_PRIORITY[source] ?? UNKNOWN_SOURCE_PRIORITY;

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
        ...provenanceOptions,
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

  async markFieldsUnavailable(
    schoolId: string,
    fields: Iterable<string>,
    source: string,
    options: TerminalProvenanceOptions = {},
  ): Promise<{ markedFields: string[]; skippedFields: string[] }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      this.logger.warn(`School not found: ${schoolId}`);
      return { markedFields: [], skippedFields: [] };
    }

    const metadata = toRecord(school.metadata);
    const provenance = normalizeSchoolProvenance(metadata.provenance);
    const now = new Date().toISOString();
    const markedFields: string[] = [];
    const skippedFields: string[] = [];

    for (const field of fields) {
      if (!isMergeableSchoolField(field)) {
        skippedFields.push(field);
        continue;
      }

      const currentValue = (school as Record<string, unknown>)[field];
      if (currentValue != null && currentValue !== '') {
        skippedFields.push(field);
        continue;
      }

      provenance[field] = createFieldProvenance({
        source,
        fetchedAt: now,
        realDataStatus: options.realDataStatus ?? 'NO_PUBLIC_REAL_DATA',
        permanent: true,
        ...options,
      });
      markedFields.push(field);
    }

    if (markedFields.length > 0) {
      await this.schoolWriteService.update(schoolId, {
        metadataPatch: metadata,
        provenance,
        reviewStatus: DataReviewStatus.AUTO_APPROVED,
        touchReviewTimestamp: true,
        existingMetadata: metadata,
      });
    }

    return { markedFields, skippedFields };
  }

  /**
   * 按学校名称合并（先查找再合并）
   */
  async mergeByName(
    name: string,
    incomingData: Partial<Record<MergeableField, unknown>>,
    source: DataSource,
    provenanceOptions: MergeProvenanceOptions = {},
  ): Promise<{ updatedFields: string[]; skippedFields: string[] } | null> {
    const nameNorm = normalizeSchoolName(name);
    const school = await this.prisma.school.findUnique({
      where: { nameNorm },
    });

    if (!school) {
      this.logger.warn(`School not found by name: ${name}`);
      return null;
    }

    return this.merge(school.id, incomingData, source, provenanceOptions);
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
