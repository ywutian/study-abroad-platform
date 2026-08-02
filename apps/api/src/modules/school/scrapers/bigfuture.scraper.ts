import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as cheerio from 'cheerio';
import { BaseSchoolScraper } from './base-school-scraper';
import { getBigFutureSlug } from './slug-mapper';
import { DataSource } from '../school-data-merger';
import { PrismaService } from '../../../prisma/prisma.service';
import { SchoolDataMerger } from '../school-data-merger';
import {
  AuditLogService,
  AuditAction,
} from '../../../common/services/audit-log.service';
import { SchoolWriteService } from '../school-write.service';

/**
 * College Board BigFuture 爬虫
 *
 * URL: https://bigfuture.collegeboard.org/colleges/{slug}
 * 渲染: Next.js SSR (可直接 Cheerio 解析)
 * 反爬: 无
 *
 * 独占数据 (Scorecard/IPEDS 没有的):
 * - % of need met (助学金慷慨度)
 * - Application types (Common App / Coalition)
 * - Fee waiver availability
 * - Retention rate
 * - College Board code
 * - Housing, meal plan, and campus safety service signals
 */

class BigFutureParser extends BaseSchoolScraper {
  readonly source = DataSource.BIGFUTURE;
  readonly baseUrl = 'https://bigfuture.collegeboard.org';
  readonly requestDelay = 2000; // 2 seconds — be respectful

  buildUrl(school: {
    id: string;
    name: string;
    metadata?: Record<string, unknown> | null;
  }): string | null {
    const slug = getBigFutureSlug(school.name, school.metadata);
    if (!slug) return null;
    return `${this.baseUrl}/colleges/${slug}`;
  }

  parseSchoolData(
    html: string,
    _school: { id: string; name: string },
  ): {
    data: Record<string, unknown>;
    metrics: Array<{ key: string; value: number }>;
    metadata: Record<string, unknown>;
  } | null {
    const $ = cheerio.load(html);
    const data: Record<string, unknown> = {};
    const metrics: Array<{ key: string; value: number }> = [];
    const metadata: Record<string, unknown> = {};

    // Parse page text for key data points
    const pageText = $('body').text();

    // Acceptance rate
    const acceptMatch = pageText.match(
      /(?:acceptance|admission)\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    );
    if (acceptMatch) {
      data.acceptanceRate = parseFloat(acceptMatch[1]);
    }

    // Retention rate (BigFuture unique)
    const retentionMatch = pageText.match(
      /(?:retention|freshman\s*return)\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    );
    if (retentionMatch) {
      data.retentionRate = parseFloat(retentionMatch[1]);
      metrics.push({
        key: 'retention_rate',
        value: parseFloat(retentionMatch[1]),
      });
    }

    // Student-faculty ratio
    const ratioMatch = pageText.match(
      /student[\s-]*(?:to[\s-]*)?faculty\s*ratio[:\s]*(\d+)[:\s]*(?:to[:\s]*)?1/i,
    );
    if (ratioMatch) {
      data.studentFacultyRatio = parseInt(ratioMatch[1]);
    }

    // Total enrollment
    const enrollMatch = pageText.match(
      /(?:total\s*)?(?:undergraduate\s*)?enrollment[:\s]*([\d,]+)/i,
    );
    if (enrollMatch) {
      const enrollment = parseInt(enrollMatch[1].replace(/,/g, ''));
      if (enrollment > 0) {
        data.totalEnrollment = enrollment;
      }
    }

    // % of need met (BigFuture unique — from CDS data)
    const needMetMatch = pageText.match(
      /(?:average\s*)?(?:%|percent)\s*(?:of\s*)?need\s*met[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    );
    if (!needMetMatch) {
      const needMetAlt = pageText.match(
        /(\d+(?:\.\d+)?)\s*%\s*(?:of\s*)?(?:average\s*)?need\s*(?:is\s*)?met/i,
      );
      if (needMetAlt) {
        data.percentNeedMet = parseFloat(needMetAlt[1]);
      }
    } else {
      data.percentNeedMet = parseFloat(needMetMatch[1]);
    }

    // Average financial aid
    const aidMatch = pageText.match(
      /average\s*(?:financial\s*)?aid\s*(?:package|award)[:\s]*\$?([\d,]+)/i,
    );
    if (aidMatch) {
      data.averageAidPackage = parseInt(aidMatch[1].replace(/,/g, ''));
    }

    // Graduation rate
    const gradMatch = pageText.match(
      /(?:4[\s-]*year\s*)?graduation\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    );
    if (gradMatch) {
      data.graduationRate = parseFloat(gradMatch[1]);
    }

    // Application fee
    const feeMatch = pageText.match(/application\s*fee[:\s]*\$?(\d+)/i);
    if (feeMatch) {
      data.applicationFee = parseInt(feeMatch[1]);
    }

    // Fee waiver
    if (/fee\s*waiver\s*(?:is\s*)?available/i.test(pageText)) {
      data.feeWaiverAvailable = true;
    }

    // Application types
    if (/common\s*app/i.test(pageText)) {
      data.acceptsCommonApp = true;
    }
    if (/coalition/i.test(pageText)) {
      data.acceptsCoalition = true;
    }

    if (
      /on[-\s]*campus\s+housing|residence\s+halls?|dormitor(?:y|ies)|campus\s+housing/i.test(
        pageText,
      )
    ) {
      data.housingAvailable = true;
    }

    const requiredHousingMatch =
      pageText.match(
        /(?:required|must)\s+(?:to\s+)?live\s+on\s+campus\s+(?:for\s+)?(\d+)\s+years?/i,
      ) ??
      pageText.match(
        /(\d+)\s+years?\s+of\s+(?:required\s+)?(?:on[-\s]*)?campus\s+housing/i,
      );
    if (requiredHousingMatch) {
      data.housingRequiredYears = parseInt(requiredHousingMatch[1]);
      data.housingAvailable = true;
    } else if (
      /freshmen\s+(?:are\s+)?(?:required|must)\s+(?:to\s+)?live\s+on\s+campus/i.test(
        pageText,
      )
    ) {
      data.housingRequiredYears = 1;
      data.housingAvailable = true;
    }

    const livingOnCampusMatch =
      pageText.match(
        /(\d+(?:\.\d+)?)\s*%\s+(?:of\s+)?students\s+live\s+on\s+campus/i,
      ) ??
      pageText.match(
        /students\s+living\s+on\s+campus[:\s]*(\d+(?:\.\d+)?)\s*%/i,
      );
    if (livingOnCampusMatch) {
      data.percentLivingOnCampus = parseFloat(livingOnCampusMatch[1]);
    }

    const roomMatch = pageText.match(
      /room\s*(?:and|&)\s*board[:\s]*\$?([\d,]+)/i,
    );
    if (roomMatch) {
      data.roomAndBoard = parseInt(roomMatch[1].replace(/,/g, ''));
    }

    const mealPlanMatch = pageText.match(
      /meal\s*plan(?:\s*cost)?[:\s]*\$?([\d,]+)/i,
    );
    if (mealPlanMatch) {
      const mealPlanCost = parseInt(mealPlanMatch[1].replace(/,/g, ''));
      if (mealPlanCost > 500 && mealPlanCost < 30000) {
        data.mealPlanCost = mealPlanCost;
      }
    }

    const safetyServicePatterns: Array<[RegExp, string]> = [
      [/24[-\s]*hour\s+(?:security|patrol)/i, '24-hour security patrol'],
      [
        /campus\s+police|public\s+safety\s+office/i,
        'campus police/public safety office',
      ],
      [/emergency\s+(?:phones?|call\s+boxes?)/i, 'emergency phones'],
      [
        /late[-\s]*night\s+(?:transport|escort|shuttle)/i,
        'late-night transport or escort',
      ],
      [
        /controlled\s+(?:dormitory|residence\s+hall)\s+access/i,
        'controlled residence access',
      ],
      [/security\s+camera|video\s+surveillance/i, 'security cameras'],
    ];
    const campusSafetyServices = safetyServicePatterns
      .filter(([pattern]) => pattern.test(pageText))
      .map(([, label]) => label);
    if (campusSafetyServices.length > 0) {
      data.campusSafetyServices = [...new Set(campusSafetyServices)];
    }

    const campusLifeSummary: Record<string, unknown> = {};
    for (const key of [
      'housingAvailable',
      'housingRequiredYears',
      'percentLivingOnCampus',
      'roomAndBoard',
      'mealPlanCost',
      'campusSafetyServices',
    ]) {
      if (data[key] != null) campusLifeSummary[key] = data[key];
    }
    if (Object.keys(campusLifeSummary).length > 0) {
      data.campusLifeSummary = campusLifeSummary;
    }

    // SAT/ACT scores (as backup, Scorecard has priority)
    const satMatch = pageText.match(/SAT.*?(\d{3,4})\s*[-–]\s*(\d{3,4})/);
    if (satMatch) {
      const low = parseInt(satMatch[1]);
      const high = parseInt(satMatch[2]);
      if (low >= 400 && high <= 1600) {
        data.sat25 = low;
        data.sat75 = high;
      }
    }

    const actMatch = pageText.match(/ACT.*?(\d{1,2})\s*[-–]\s*(\d{1,2})/);
    if (actMatch) {
      const low = parseInt(actMatch[1]);
      const high = parseInt(actMatch[2]);
      if (low >= 1 && high <= 36) {
        data.act25 = low;
        data.act75 = high;
      }
    }

    if (Object.keys(data).length === 0 && Object.keys(metadata).length === 0) {
      return null;
    }

    return { data, metrics, metadata };
  }
}

@Injectable()
export class BigFutureScrapeService {
  private readonly scraper: BigFutureParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly merger: SchoolDataMerger,
    private readonly schoolWriteService: SchoolWriteService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.scraper = new BigFutureParser('BigFutureScraper');
  }

  /**
   * 爬取指定学校列表的 BigFuture 数据
   */
  async scrapeSchools(
    limit = 100,
    userId?: string,
    options: {
      dryRun?: boolean;
      onlyMissingCampusLife?: boolean;
    } = {},
  ): Promise<{
    scraped: number;
    updated: number;
    failed: number;
    skipped: number;
    dryRun: boolean;
  }> {
    const where: Prisma.SchoolWhereInput = {
      country: 'US',
      ...(options.onlyMissingCampusLife
        ? {
            OR: [
              { roomAndBoard: null },
              { housingAvailable: null },
              { housingRequiredYears: null },
              { percentLivingOnCampus: null },
              { mealPlanCost: null },
              { campusSafetyServices: { isEmpty: true } },
              { campusLifeSummary: { equals: Prisma.DbNull } },
              { campusLifeSummary: { equals: Prisma.JsonNull } },
            ],
          }
        : {}),
    };

    // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
    const schools = await this.prisma.school.findMany({
      where,
      select: { id: true, name: true, website: true, metadata: true },
      take: Math.min(limit, 500),
      orderBy: { usNewsRank: { sort: 'asc', nulls: 'last' } },
    });

    let updated = 0;
    const year = new Date().getFullYear();

    this.scraper.onSchoolScraped = async (result) => {
      // Merge school fields
      if (Object.keys(result.data).length > 0) {
        if (options.dryRun) {
          updated++;
          return;
        }

        const mergeResult = await this.merger.merge(
          result.schoolId,
          result.data,
          DataSource.BIGFUTURE,
          {
            sourceUrl: result.url,
            extractionMethod: 'BIGFUTURE_HTML',
          },
        );
        if (mergeResult.updatedFields.length > 0) updated++;
      }

      if (options.dryRun) return;

      // Write metrics
      for (const metric of result.metrics) {
        // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
        await this.prisma.schoolMetric.upsert({
          where: {
            schoolId_year_metricKey: {
              schoolId: result.schoolId,
              year,
              metricKey: metric.key,
            },
          },
          create: {
            schoolId: result.schoolId,
            year,
            metricKey: metric.key,
            value: metric.value,
          },
          update: { value: metric.value },
        });
      }

      // Store BigFuture-specific metadata
      if (Object.keys(result.metadata).length > 0) {
        // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
        const school = await this.prisma.school.findUnique({
          where: { id: result.schoolId },
          select: { metadata: true },
        });
        await this.schoolWriteService.update(result.schoolId, {
          metadataPatch: {
            bigfuture: {
              ...result.metadata,
              lastScrapedAt: new Date().toISOString(),
              sourceUrl: result.url,
            },
          },
          provenance: {},
          existingMetadata: school?.metadata,
        });
      }
    };

    const batchResult = await this.scraper.scrapeAll(
      schools as Array<{
        id: string;
        name: string;
        website?: string | null;
        metadata?: Record<string, unknown> | null;
      }>,
    );

    // Audit log
    if (userId) {
      await this.auditLogService.log({
        userId,
        action: AuditAction.ADMIN_ACTION,
        resource: 'schools',
        resourceId: '',
        metadata: {
          action: 'BIGFUTURE_SCRAPE',
          ...batchResult,
          updated,
        },
      });
    }

    return {
      scraped: batchResult.scraped,
      updated,
      failed: batchResult.failed,
      skipped: batchResult.skipped,
      dryRun: Boolean(options.dryRun),
    };
  }
}
