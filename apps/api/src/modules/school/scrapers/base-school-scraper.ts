import { Logger } from '@nestjs/common';
import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';
import { DataSource } from '../school-data-merger';

const dnsLookup = promisify(dns.lookup);

/**
 * SSRF 防护: 阻止请求内部/私有 IP
 * 复用 essay-scraper 的安全逻辑
 */
function isPrivateIP(ip: string): boolean {
  if (ip === '::1') return true;
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd'))
    return true;
  if (!net.isIPv4(ip)) return false;

  const parts = ip.split('.').map(Number);
  const [a, b] = parts;
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

async function validateUrlNotPrivate(url: string): Promise<void> {
  const parsed = new URL(url);
  const hostname = parsed.hostname;

  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new Error('SSRF blocked: URL resolves to a private IP address');
    }
    return;
  }

  const { address } = await dnsLookup(hostname);
  if (isPrivateIP(address)) {
    throw new Error('SSRF blocked: URL resolves to a private IP address');
  }
}

/**
 * 爬取单个学校的结果
 */
export interface SchoolScrapeResult {
  schoolId: string;
  schoolName: string;
  data: Record<string, unknown>;
  metrics: Array<{ key: string; value: number }>;
  metadata: Record<string, unknown>;
  url: string;
}

/**
 * 批量爬取汇总结果
 */
export interface BatchScrapeResult {
  source: string;
  total: number;
  scraped: number;
  updated: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * 学校数据爬虫基类
 *
 * 提供:
 * - SSRF 防护
 * - 限速 (configurable REQUEST_DELAY)
 * - 带 User-Agent 的 HTTP 请求
 * - 批量爬取框架 (scrapeAll)
 */
export abstract class BaseSchoolScraper {
  protected readonly logger: Logger;

  /** 数据来源标识 */
  abstract readonly source: DataSource;

  /** 目标网站基础 URL */
  abstract readonly baseUrl: string;

  /** 请求间隔 (ms) */
  abstract readonly requestDelay: number;

  constructor(name: string) {
    this.logger = new Logger(name);
  }

  /**
   * 构建学校详情页 URL
   * 返回 null 表示无法为该学校生成 URL（缺少 slug 等）
   */
  abstract buildUrl(school: {
    id: string;
    name: string;
    website?: string | null;
    metadata?: Record<string, unknown> | null;
  }): string | null;

  /**
   * 解析 HTML 页面，提取学校数据
   */
  abstract parseSchoolData(
    html: string,
    school: { id: string; name: string },
  ): {
    data: Record<string, unknown>;
    metrics: Array<{ key: string; value: number }>;
    metadata: Record<string, unknown>;
  } | null;

  /**
   * 获取页面 HTML（带 SSRF 防护和 User-Agent）
   */
  protected async fetchPage(url: string, maxRetries = 2): Promise<string> {
    await validateUrlNotPrivate(url);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * 2 ** attempt, 10000);
          this.logger.warn(
            `Retry ${attempt + 1}/${maxRetries} for ${url} after ${backoff}ms`,
          );
          await this.delay(backoff);
        }
      }
    }
    throw lastError!;
  }

  /**
   * 批量爬取学校列表
   */
  async scrapeAll(
    schools: Array<{
      id: string;
      name: string;
      website?: string | null;
      metadata?: Record<string, unknown> | null;
    }>,
  ): Promise<BatchScrapeResult> {
    const result: BatchScrapeResult = {
      source: this.source,
      total: schools.length,
      scraped: 0,
      updated: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    for (const school of schools) {
      const url = this.buildUrl(school);
      if (!url) {
        result.skipped++;
        continue;
      }

      try {
        const html = await this.fetchPage(url);
        const parsed = this.parseSchoolData(html, school);
        if (!parsed || Object.keys(parsed.data).length === 0) {
          result.skipped++;
          continue;
        }

        result.scraped++;

        // Emit result for caller to merge via SchoolDataMerger
        // (caller handles DB writes — keeps this class pure scraping logic)
        await this.onSchoolScraped?.({
          schoolId: school.id,
          schoolName: school.name,
          data: parsed.data,
          metrics: parsed.metrics,
          metadata: parsed.metadata,
          url,
        });
      } catch (err) {
        result.failed++;
        const msg = `${school.name}: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(msg);
        this.logger.warn(`Scrape failed for ${school.name}: ${msg}`);
      }

      // Rate limiting
      await this.delay(this.requestDelay);
    }

    this.logger.log(
      `[${this.source}] Scrape complete: ${result.scraped}/${result.total} scraped, ${result.failed} failed, ${result.skipped} skipped`,
    );

    return result;
  }

  /**
   * 回调: 每成功爬取一个学校后触发
   * 由调用方设置，用于将数据写入 DB
   */
  onSchoolScraped?: (result: SchoolScrapeResult) => void | Promise<void>;

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
