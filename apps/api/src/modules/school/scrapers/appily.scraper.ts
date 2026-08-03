import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as cheerio from 'cheerio';
import { BaseSchoolScraper } from './base-school-scraper';
import { getAppilySlug } from './slug-mapper';
import { DataSource } from '../school-data-merger';
import { PrismaService } from '../../../prisma/prisma.service';
import { SchoolDataMerger } from '../school-data-merger';
import {
  AuditLogService,
  AuditAction,
} from '../../../common/services/audit-log.service';
import { SchoolWriteService } from '../school-write.service';

/**
 * Appily (原 Cappex) 爬虫
 *
 * URL: https://www.appily.com/colleges/{slug}
 * 渲染: Drupal SSR + Schema.org JSON-LD 结构化数据
 * 反爬: 无
 *
 * 独占数据:
 * - Average net price (扣除助学金后实际费用)
 * - Average salary 6yr post-grad (毕业后薪资)
 * - Loan default rate (贷款违约率)
 * - Monthly loan payment (月还款额)
 * - Countries represented (国际生来源国数量)
 * - Student orgs count (社团数量)
 * - Housing, meal plan, and campus safety service signals
 */

export class AppilyParser extends BaseSchoolScraper {
  readonly source = DataSource.APPILY;
  readonly baseUrl = 'https://www.appily.com';
  readonly requestDelay = 2000;

  buildUrl(school: {
    id: string;
    name: string;
    metadata?: Record<string, unknown> | null;
  }): string | null {
    const slug = getAppilySlug(school.name, school.metadata);
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

    // 1. Try Schema.org JSON-LD first (most structured)
    this.parseJsonLd($, data, metadata);

    // 2. Fall back to HTML parsing
    this.parseHtml($, data, metrics, metadata);

    if (Object.keys(data).length === 0 && Object.keys(metadata).length === 0) {
      return null;
    }

    return { data, metrics, metadata };
  }

  /**
   * Parse Schema.org JSON-LD structured data
   */
  private parseJsonLd(
    $: cheerio.CheerioAPI,
    data: Record<string, unknown>,
    metadata: Record<string, unknown>,
  ): void {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '');
        if (!json) return;

        // CollegeOrUniversity schema
        if (
          json['@type'] === 'CollegeOrUniversity' ||
          json['@type'] === 'EducationalOrganization'
        ) {
          if (json.address?.addressLocality) {
            data.city = json.address.addressLocality;
          }
          if (json.address?.addressRegion) {
            data.state = json.address.addressRegion;
          }
          if (json.url) {
            data.website = json.url;
          }
          if (json.description) {
            metadata.appilyDescription = json.description;
          }
          if (json.image) {
            metadata.appilyImage = json.image;
          }
        }
      } catch {
        // Invalid JSON-LD, skip
      }
    });
  }

  /**
   * Parse HTML content for data points
   */
  private parseHtml(
    $: cheerio.CheerioAPI,
    data: Record<string, unknown>,
    metrics: Array<{ key: string; value: number }>,
    _metadata: Record<string, unknown>,
  ): void {
    const pageText = $('body').text();

    // Average net price (Appily unique)
    const netPriceMatch = pageText.match(
      /(?:average\s*)?net\s*price[:\s]*\$?([\d,]+)/i,
    );
    if (netPriceMatch) {
      data.averageNetPrice = parseInt(netPriceMatch[1].replace(/,/g, ''));
    }

    // Average salary post-graduation (Appily unique)
    // Matches: "Salary 6 Years After: $52,000", "Median Earnings: $65,000",
    // "Average Earnings After School: $48,000", "Salary After Graduation: $55,000"
    const salaryMatch = pageText.match(
      /(?:median|average)?\s*(?:salary|earnings?|income)\s*(?:6\s*years?\s*(?:after|post).*?|after\s*(?:6|six)\s*years?.*?|after\s*(?:school|graduation).*?)?[:\s]*\$?([\d,]+)/i,
    );
    if (salaryMatch) {
      const salary = parseInt(salaryMatch[1].replace(/,/g, ''));
      if (salary > 10000 && salary < 500000) {
        data.avgSalary = salary;
        data.salary6YrPostGrad = salary;
      }
    }

    // Loan default rate (Appily unique)
    const loanDefaultMatch = pageText.match(
      /(?:loan\s*)?default\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    );
    if (loanDefaultMatch) {
      data.loanDefaultRate = parseFloat(loanDefaultMatch[1]);
      metrics.push({
        key: 'loan_default_rate',
        value: parseFloat(loanDefaultMatch[1]),
      });
    }

    // Monthly loan payment (Appily unique)
    const loanPaymentMatch = pageText.match(
      /(?:average\s*)?monthly\s*(?:loan\s*)?payment[:\s]*\$?([\d,]+)/i,
    );
    if (loanPaymentMatch) {
      data.monthlyLoanPayment = parseInt(loanPaymentMatch[1].replace(/,/g, ''));
    }

    // Acceptance rate
    const acceptMatch = pageText.match(
      /(?:acceptance|admission)\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    );
    if (acceptMatch) {
      data.acceptanceRate = parseFloat(acceptMatch[1]);
    }

    // Graduation rate
    const gradMatch = pageText.match(
      /(?:4[\s-]*year\s*)?graduation\s*rate[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    );
    if (gradMatch) {
      data.graduationRate = parseFloat(gradMatch[1]);
    }

    // Tuition
    const tuitionMatch = pageText.match(
      /(?:out[\s-]*of[\s-]*state\s*)?tuition(?:\s*(?:and|&)\s*fees)?[:\s]*\$?([\d,]+)/i,
    );
    if (tuitionMatch) {
      const tuition = parseInt(tuitionMatch[1].replace(/,/g, ''));
      if (tuition > 1000) {
        data.tuition = tuition;
      }
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

    // Student-faculty ratio
    const ratioMatch = pageText.match(
      /student[\s-]*(?:to[\s-]*)?faculty\s*ratio[:\s]*(\d+)[:\s]*(?:to[:\s]*)?1/i,
    );
    if (ratioMatch) {
      data.studentFacultyRatio = parseInt(ratioMatch[1]);
    }

    // Countries represented (Appily unique)
    const countriesMatch = pageText.match(/(\d+)\s*countries?\s*represented/i);
    if (countriesMatch) {
      data.countriesRepresented = parseInt(countriesMatch[1]);
    }

    // Student organizations (Appily unique)
    const orgsMatch = pageText.match(
      /(\d+)\s*(?:student\s*)?(?:organizations?|clubs?)/i,
    );
    if (orgsMatch) {
      data.studentOrgsCount = parseInt(orgsMatch[1]);
    }

    // Room and board
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
    if (data.housingAvailable != null) {
      campusLifeSummary.housingAvailable = data.housingAvailable;
    }
    if (data.housingRequiredYears != null) {
      campusLifeSummary.housingRequiredYears = data.housingRequiredYears;
    }
    if (data.percentLivingOnCampus != null) {
      campusLifeSummary.percentLivingOnCampus = data.percentLivingOnCampus;
    }
    if (data.mealPlanCost != null) {
      campusLifeSummary.mealPlanCost = data.mealPlanCost;
    }
    if (Array.isArray(data.campusSafetyServices)) {
      campusLifeSummary.campusSafetyServices = data.campusSafetyServices;
    }
    if (Object.keys(campusLifeSummary).length > 0) {
      data.campusLifeSummary = campusLifeSummary;
    }

    // Average aid
    const aidMatch = pageText.match(
      /average\s*(?:financial\s*)?aid[:\s]*\$?([\d,]+)/i,
    );
    if (aidMatch) {
      data.averageAidPackage = parseInt(aidMatch[1].replace(/,/g, ''));
    }
  }
}

@Injectable()
export class AppilyScrapeService {
  private readonly scraper: AppilyParser;

  constructor(
    private readonly prisma: PrismaService,
    private readonly merger: SchoolDataMerger,
    private readonly schoolWriteService: SchoolWriteService,
    private readonly auditLogService: AuditLogService,
  ) {
    this.scraper = new AppilyParser('AppilyScraper');
  }

  /**
   * 爬取指定学校列表的 Appily 数据
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
              { studentOrgsCount: null },
              { countriesRepresented: null },
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
          DataSource.APPILY,
          {
            sourceUrl: result.url,
            extractionMethod: 'APPILY_HTML',
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

      // Store Appily-specific metadata
      if (Object.keys(result.metadata).length > 0) {
        // governance: system-scope — School / SchoolMetric / HighSchool / SchoolMediaAsset / SchoolDeadline and the scraper tables are published institution data with no User relation. The auditLog writes in the schedulers record a system action — action/resource/metadata, no user actor
        const school = await this.prisma.school.findUnique({
          where: { id: result.schoolId },
          select: { metadata: true },
        });
        await this.schoolWriteService.update(result.schoolId, {
          metadataPatch: {
            appily: {
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
          action: 'APPILY_SCRAPE',
          dryRun: Boolean(options.dryRun),
          onlyMissingCampusLife: Boolean(options.onlyMissingCampusLife),
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
