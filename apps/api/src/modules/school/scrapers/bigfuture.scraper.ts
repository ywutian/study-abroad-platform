import { Injectable } from '@nestjs/common';
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
  ): Promise<{
    scraped: number;
    updated: number;
    failed: number;
    skipped: number;
  }> {
    const schools = await this.prisma.school.findMany({
      where: { country: 'US' },
      select: { id: true, name: true, website: true, metadata: true },
      take: Math.min(limit, 500),
      orderBy: { usNewsRank: { sort: 'asc', nulls: 'last' } },
    });

    let updated = 0;
    const year = new Date().getFullYear();

    this.scraper.onSchoolScraped = async (result) => {
      // Merge school fields
      if (Object.keys(result.data).length > 0) {
        const mergeResult = await this.merger.merge(
          result.schoolId,
          result.data,
          DataSource.BIGFUTURE,
        );
        if (mergeResult.updatedFields.length > 0) updated++;
      }

      // Write metrics
      for (const metric of result.metrics) {
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
        const school = await this.prisma.school.findUnique({
          where: { id: result.schoolId },
          select: { metadata: true },
        });
        const existingMeta =
          (school?.metadata as Record<string, unknown>) || {};
        await this.prisma.school.update({
          where: { id: result.schoolId },
          data: {
            metadata: {
              ...existingMeta,
              bigfuture: {
                ...result.metadata,
                lastScrapedAt: new Date().toISOString(),
                sourceUrl: result.url,
              },
            } as any,
          },
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
    };
  }
}
