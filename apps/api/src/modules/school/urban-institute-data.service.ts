import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SchoolDataMerger, DataSource } from './school-data-merger';
import { normalizePercentRate } from '../../common/utils/percent.util';
import {
  AuditLogService,
  AuditAction,
} from '../../common/services/audit-log.service';

/**
 * Urban Institute Education Data Portal — IPEDS API 数据同步服务
 *
 * 免费 REST API，无需 API Key
 * 文档: https://educationdata.urban.org/documentation/
 * 端点: https://educationdata.urban.org/api/v1/college-university/ipeds/
 *
 * 与 College Scorecard 互补，提供:
 * - 国际生按来源国分布
 * - CIP 6 位码专业完成率
 * - 财务援助详情
 * - 更细粒度的入学数据
 */

const BASE_URL =
  'https://educationdata.urban.org/api/v1/college-university/ipeds';

/** Rate limit: 500ms between requests (be respectful) */
const REQUEST_DELAY = 500;

/** Maximum schools per sync batch */
const MAX_BATCH_SIZE = 2000;

interface UrbanApiResponse {
  results: Record<string, unknown>[];
  next?: string | null;
  count?: number;
}

export interface SyncResult {
  synced: number;
  updated: number;
  errors: number;
  notFound: number;
  source: string;
}

@Injectable()
export class UrbanInstituteDataService {
  private readonly logger = new Logger(UrbanInstituteDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly merger: SchoolDataMerger,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * 全量同步入口：按数据类型分批同步
   */
  async syncAll(
    year?: number,
    limit = MAX_BATCH_SIZE,
    userId?: string,
  ): Promise<{
    admissions: SyncResult;
    enrollment: SyncResult;
    characteristics: SyncResult;
    total: { synced: number; errors: number };
  }> {
    const targetYear = year || new Date().getFullYear() - 1; // IPEDS 数据有 1 年延迟
    const cap = Math.min(Math.max(1, limit), MAX_BATCH_SIZE);

    this.logger.log(
      `Starting Urban Institute sync for year ${targetYear}, limit ${cap}`,
    );

    const admissions = await this.syncAdmissions(targetYear, cap);
    const enrollment = await this.syncEnrollment(targetYear, cap);
    const characteristics = await this.syncCharacteristics(targetYear, cap);

    const total = {
      synced: admissions.synced + enrollment.synced + characteristics.synced,
      errors: admissions.errors + enrollment.errors + characteristics.errors,
    };

    // Audit log
    if (userId) {
      await this.auditLogService.log({
        userId,
        action: AuditAction.ADMIN_ACTION,
        resource: 'schools',
        resourceId: '',
        metadata: {
          action: 'URBAN_INSTITUTE_SYNC',
          year: targetYear,
          admissions,
          enrollment,
          characteristics,
          total,
        },
      });
    }

    this.logger.log(
      `Urban Institute sync completed: ${total.synced} synced, ${total.errors} errors`,
    );

    return { admissions, enrollment, characteristics, total };
  }

  /** Refresh only the requested local schools, using their promoted IPEDS ids. */
  async syncSchoolsByIds(
    schoolIds: string[],
    year?: number,
  ): Promise<{
    admissions: SyncResult;
    enrollment: SyncResult;
    characteristics: SyncResult;
    total: { synced: number; errors: number };
  }> {
    const uniqueSchoolIds = [...new Set(schoolIds)].filter(Boolean);
    // governance: system-scope — School / SchoolMetric are published institution data with no User relation; this scheduler resolves only promoted external ids for a bounded public-data refresh
    const schools = await this.prisma.school.findMany({
      where: { id: { in: uniqueSchoolIds } },
      select: { ipedsId: true },
    });
    const ipedsIds = schools
      .map((school) => school.ipedsId)
      .filter((id): id is string => Boolean(id));
    const targetYear = year || new Date().getFullYear() - 1;

    if (ipedsIds.length === 0) {
      this.logger.warn('No IPEDS ids found for stale local schools');
      const empty = (source: string): SyncResult => ({
        synced: 0,
        updated: 0,
        errors: 0,
        notFound: 0,
        source,
      });
      return {
        admissions: empty('admissions'),
        enrollment: empty('enrollment'),
        characteristics: empty('characteristics'),
        total: { synced: 0, errors: 0 },
      };
    }

    const admissions = await this.syncAdmissions(
      targetYear,
      Number.MAX_SAFE_INTEGER,
      ipedsIds,
    );
    const enrollment = await this.syncEnrollment(
      targetYear,
      Number.MAX_SAFE_INTEGER,
      ipedsIds,
    );
    const characteristics = await this.syncCharacteristics(
      targetYear,
      Number.MAX_SAFE_INTEGER,
      ipedsIds,
    );
    return {
      admissions,
      enrollment,
      characteristics,
      total: {
        synced: admissions.synced + enrollment.synced + characteristics.synced,
        errors: admissions.errors + enrollment.errors + characteristics.errors,
      },
    };
  }

  /**
   * 同步录取数据 (admissions-enrollment)
   * 数据: 申请人数、录取人数、录取率
   */
  async syncAdmissions(
    year: number,
    limit: number,
    ipedsIds?: string[],
  ): Promise<SyncResult> {
    const endpoint = `${BASE_URL}/admissions-enrollment/${year}`;
    return this.syncEndpoint(
      endpoint,
      'admissions',
      limit,
      (row) => {
        const applicants = this.toNum(row['number_applied']);
        const admitted = this.toNum(row['number_admitted']);

        const data: Record<string, unknown> = {};

        if (applicants && admitted && applicants > 0) {
          data.acceptanceRate = normalizePercentRate(admitted / applicants);
        }

        return {
          unitid: this.toText(row['unitid']),
          data,
          metrics:
            applicants && admitted
              ? [
                  { key: 'applications', value: applicants },
                  { key: 'admissions', value: admitted },
                ]
              : [],
        };
      },
      ipedsIds,
    );
  }

  /**
   * 同步入学数据 (fall-enrollment/residence)
   * 数据: 国际生比例、总入学人数
   */
  async syncEnrollment(
    year: number,
    limit: number,
    ipedsIds?: string[],
  ): Promise<SyncResult> {
    // Use residence endpoint for international student data
    const endpoint = `${BASE_URL}/fall-enrollment/residence/${year}`;
    return this.syncEndpoint(
      endpoint,
      'enrollment',
      limit,
      (row) => {
        const levelOfStudy = this.toNum(row['level_of_study']);
        // level_of_study: 1 = undergraduate, 2 = graduate, 99 = total
        if (levelOfStudy !== 99) return null; // Only total

        const total = this.toNum(row['enrollment_fall']);
        const intl = this.toNum(row['enrollment_nonresident']);

        const data: Record<string, unknown> = {};
        if (total && total > 0) {
          data.totalEnrollment = total;
          if (intl != null) {
            data.intlStudentPct = normalizePercentRate(intl / total);
          }
        }

        return {
          unitid: this.toText(row['unitid']),
          data,
          metrics:
            total && intl != null
              ? [
                  { key: 'intl_student_count', value: intl },
                  { key: 'intl_student_pct', value: (intl / total) * 100 },
                ]
              : [],
        };
      },
      ipedsIds,
    );
  }

  /**
   * 同步院校特征 (institutional-characteristics)
   * 数据: 公立/私立、校园面积
   */
  async syncCharacteristics(
    year: number,
    limit: number,
    ipedsIds?: string[],
  ): Promise<SyncResult> {
    const endpoint = `${BASE_URL}/institutional-characteristics/${year}`;
    return this.syncEndpoint(
      endpoint,
      'characteristics',
      limit,
      (row) => {
        const control = this.toNum(row['inst_control']);
        // inst_control: 1 = public, 2 = private nonprofit, 3 = private for-profit

        const data: Record<string, unknown> = {};
        if (control === 2 || control === 3) {
          data.isPrivate = true;
        } else if (control === 1) {
          data.isPrivate = false;
        }

        const tuitionOutOfState = this.toNum(row['tuition_fees_out_of_state']);
        if (tuitionOutOfState && tuitionOutOfState > 0) {
          data.tuition = tuitionOutOfState;
        }

        return {
          unitid: this.toText(row['unitid']),
          data,
          metrics: [],
        };
      },
      ipedsIds,
    );
  }

  /**
   * 通用同步端点处理器
   */
  private async syncEndpoint(
    endpoint: string,
    label: string,
    limit: number,
    mapper: (row: Record<string, unknown>) => {
      unitid: string;
      data: Record<string, unknown>;
      metrics: Array<{ key: string; value: number }>;
    } | null,
    ipedsIds?: string[],
  ): Promise<SyncResult> {
    let synced = 0;
    let updated = 0;
    let errors = 0;
    let notFound = 0;
    const params = new URLSearchParams();
    if (ipedsIds?.length) params.set('unitid', ipedsIds.join(','));
    let nextUrl =
      params.size > 0 ? `${endpoint}?${params.toString()}` : endpoint;

    try {
      while (synced < limit && nextUrl) {
        const url = nextUrl;
        this.logger.debug(`Fetching ${label}: ${url}`);

        const response = await fetch(url, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          this.logger.error(
            `Urban Institute API error: ${response.status} for ${url}`,
          );
          break;
        }

        const body: UrbanApiResponse = await response.json();
        const rows = body.results || [];

        if (rows.length === 0) break;

        for (const row of rows) {
          if (synced >= limit) break;

          try {
            const mapped = mapper(row);
            if (!mapped || !mapped.unitid) continue;
            if (
              Object.keys(mapped.data).length === 0 &&
              mapped.metrics.length === 0
            )
              continue;

            // Find school by ipedsId
            const school = await this.findSchoolByIpedsId(mapped.unitid);
            if (!school) {
              notFound++;
              continue;
            }

            // Merge school fields via merger (respects priority)
            if (Object.keys(mapped.data).length > 0) {
              const result = await this.merger.merge(
                school.id,
                mapped.data,
                DataSource.URBAN_INSTITUTE,
              );
              if (result.updatedFields.length > 0) updated++;
            }

            // Write metrics
            const year = this.extractYearFromEndpoint(endpoint);
            for (const metric of mapped.metrics) {
              await this.upsertMetric(
                school.id,
                year,
                metric.key,
                metric.value,
              );
            }

            synced++;
          } catch (err) {
            errors++;
            this.logger.warn(`Failed to process row: ${String(err)}`);
          }
        }

        // The Urban endpoint currently returns the complete filtered result set
        // and rejects the old page=0/per_page query. Retain `next` support if
        // the provider adds a real continuation URL later.
        nextUrl = body.next || '';

        // Rate limiting
        if (nextUrl && synced < limit) await this.delay(REQUEST_DELAY);
      }
    } catch (err) {
      this.logger.error(`Sync ${label} failed: ${String(err)}`);
    }

    this.logger.log(
      `Urban Institute [${label}]: ${synced} synced, ${updated} updated, ${notFound} not found, ${errors} errors`,
    );

    return { synced, updated, errors, notFound, source: label };
  }

  /**
   * 按 IPEDS UNITID 查找学校
   * 先查 ipedsId 字段，再回退到 metadata.ipedsId
   */
  private async findSchoolByIpedsId(
    unitid: string,
  ): Promise<{ id: string; name: string } | null> {
    // Try ipedsId column first (indexed)
    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    const byColumn = await this.prisma.school.findUnique({
      where: { ipedsId: unitid },
      select: { id: true, name: true },
    });
    if (byColumn) return byColumn;

    // Fallback: metadata.ipedsId
    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    const byMetadata = await this.prisma.school.findFirst({
      where: { metadata: { path: ['ipedsId'], equals: unitid } },
      select: { id: true, name: true },
    });
    return byMetadata;
  }

  /**
   * Upsert a metric entry for a school-year-key combo
   */
  private async upsertMetric(
    schoolId: string,
    year: number,
    metricKey: string,
    value: number,
  ): Promise<void> {
    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    await this.prisma.schoolMetric.upsert({
      where: {
        schoolId_year_metricKey: { schoolId, year, metricKey },
      },
      create: { schoolId, year, metricKey, value },
      update: { value },
    });
  }

  /**
   * Extract year from endpoint URL
   */
  private extractYearFromEndpoint(endpoint: string): number {
    const match = endpoint.match(/\/(\d{4})(?:\?|$)/);
    return match ? parseInt(match[1]) : new Date().getFullYear() - 1;
  }

  private toNum(val: unknown): number | null {
    if (val == null) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  }

  private toText(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
