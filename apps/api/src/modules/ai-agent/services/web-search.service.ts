/**
 * Web 搜索服务 - 双引擎（Google Custom Search + Tavily）
 *
 * 特性:
 * - Google Custom Search: 通用搜索（中英文质量高、免费额度大）
 * - Tavily: 学校官网深度搜索（include_domains + search_depth: advanced）
 * - Redis 缓存（降级为内存缓存）
 * - 弹性保护（重试 + 熔断 + 超时）
 * - 互为降级备份
 * - API Key 未配置时静默禁用
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/redis/redis.service';
import { ResilienceService } from '../core/resilience.service';
import * as crypto from 'crypto';

// ==================== 类型定义 ====================

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  content?: string; // Tavily 深度搜索时可用
  date?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  source: 'google' | 'tavily' | 'cache';
  query: string;
  cached: boolean;
}

export interface SearchOptions {
  topic?: 'general' | 'news';
  maxResults?: number;
}

export interface SchoolSearchOptions {
  maxResults?: number;
}

// ==================== 学校域名映射 ====================

const SCHOOL_DOMAIN_MAP: Record<string, string> = {
  // Top 20
  mit: 'mit.edu',
  stanford: 'stanford.edu',
  harvard: 'harvard.edu',
  caltech: 'caltech.edu',
  princeton: 'princeton.edu',
  yale: 'yale.edu',
  columbia: 'columbia.edu',
  upenn: 'upenn.edu',
  penn: 'upenn.edu',
  chicago: 'uchicago.edu',
  uchicago: 'uchicago.edu',
  duke: 'duke.edu',
  northwestern: 'northwestern.edu',
  'johns hopkins': 'jhu.edu',
  jhu: 'jhu.edu',
  dartmouth: 'dartmouth.edu',
  brown: 'brown.edu',
  cornell: 'cornell.edu',
  rice: 'rice.edu',
  vanderbilt: 'vanderbilt.edu',
  'notre dame': 'nd.edu',
  // Top 21-50
  georgetown: 'georgetown.edu',
  emory: 'emory.edu',
  'carnegie mellon': 'cmu.edu',
  cmu: 'cmu.edu',
  uva: 'virginia.edu',
  virginia: 'virginia.edu',
  'wake forest': 'wfu.edu',
  michigan: 'umich.edu',
  umich: 'umich.edu',
  unc: 'unc.edu',
  'north carolina': 'unc.edu',
  nyu: 'nyu.edu',
  tufts: 'tufts.edu',
  ucsb: 'ucsb.edu',
  'santa barbara': 'ucsb.edu',
  ufl: 'ufl.edu',
  florida: 'ufl.edu',
  'boston college': 'bc.edu',
  rochester: 'rochester.edu',
  'georgia tech': 'gatech.edu',
  gatech: 'gatech.edu',
  // UC 系统
  ucla: 'ucla.edu',
  ucsd: 'ucsd.edu',
  uci: 'uci.edu',
  ucdavis: 'ucdavis.edu',
  berkeley: 'berkeley.edu',
  ucb: 'berkeley.edu',
  // 其他常见
  usc: 'usc.edu',
  bu: 'bu.edu',
  'boston university': 'bu.edu',
  purdue: 'purdue.edu',
  'ohio state': 'osu.edu',
  osu: 'osu.edu',
  'penn state': 'psu.edu',
  psu: 'psu.edu',
  illinois: 'illinois.edu',
  uiuc: 'illinois.edu',
  washington: 'washington.edu',
  uw: 'washington.edu',
  wisconsin: 'wisc.edu',
  texas: 'utexas.edu',
  ut: 'utexas.edu',
  'texas a&m': 'tamu.edu',
  tamu: 'tamu.edu',
  brandeis: 'brandeis.edu',
  lehigh: 'lehigh.edu',
  northeastern: 'northeastern.edu',
  tulane: 'tulane.edu',
  'case western': 'case.edu',
  'william and mary': 'wm.edu',
  'william & mary': 'wm.edu',
};

// ==================== 缓存配置 ====================

const CACHE_TTL = {
  general: 6 * 3600, // 6 小时
  news: 2 * 3600, // 2 小时
  school: 24 * 3600, // 24 小时
};

// ==================== 弹性配置 ====================

const SEARCH_RETRY_CONFIG = {
  maxAttempts: 2,
  baseDelayMs: 500,
  maxDelayMs: 3000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

const SEARCH_TIMEOUT_MS = 10000; // 10 秒

// ==================== 内存缓存（Redis 降级用） ====================

interface MemoryCacheEntry {
  data: SearchResponse;
  expiresAt: number;
}

// ==================== 服务实现 ====================

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  // API 配置
  private readonly googleApiKey: string | undefined;
  private readonly googleSearchEngineId: string | undefined;
  private readonly tavilyApiKey: string | undefined;

  // 引擎可用状态
  private readonly googleEnabled: boolean;
  private readonly tavilyEnabled: boolean;

  // 内存降级缓存
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly resilience?: ResilienceService,
  ) {
    // 读取配置
    this.googleApiKey = this.config.get<string>('GOOGLE_SEARCH_API_KEY');
    this.googleSearchEngineId = this.config.get<string>(
      'GOOGLE_SEARCH_ENGINE_ID',
    );
    this.tavilyApiKey = this.config.get<string>('TAVILY_API_KEY');

    // 判断引擎可用性
    this.googleEnabled = !!(this.googleApiKey && this.googleSearchEngineId);
    this.tavilyEnabled = !!this.tavilyApiKey;

    // 启动日志
    this.logger.log(
      `WebSearchService initialized - Google: ${this.googleEnabled ? 'enabled' : 'disabled'}, Tavily: ${this.tavilyEnabled ? 'enabled' : 'disabled'}`,
    );

    if (!this.googleEnabled && !this.tavilyEnabled) {
      this.logger.warn(
        'No search API keys configured. Search tools will be unavailable.',
      );
    }
  }

  /**
   * 是否有任何搜索引擎可用
   */
  isAvailable(): boolean {
    return this.googleEnabled || this.tavilyEnabled;
  }

  /**
   * 获取可用的搜索引擎列表
   */
  getAvailableEngines(): string[] {
    const engines: string[] = [];
    if (this.googleEnabled) engines.push('google');
    if (this.tavilyEnabled) engines.push('tavily');
    return engines;
  }

  // ==================== 通用搜索 ====================

  /**
   * 通用 Web 搜索（主引擎：Google，降级：Tavily）
   */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResponse> {
    if (!this.isAvailable()) {
      return {
        results: [],
        source: 'google',
        query,
        cached: false,
      };
    }

    const { topic = 'general', maxResults = 5 } = options;

    // 1. 检查缓存
    const cacheKey = this.buildCacheKey('web', query, options);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true, source: 'cache' };
    }

    // 2. 调用搜索引擎（带降级）
    let response: SearchResponse;

    try {
      if (this.googleEnabled) {
        // 主路径：Google
        response = await this.executeWithResilience('google-search', () =>
          this.googleSearch(query, maxResults, topic),
        );
      } else if (this.tavilyEnabled) {
        // Google 未配置，直接用 Tavily
        response = await this.executeWithResilience('tavily-search', () =>
          this.tavilySearch(query, maxResults, topic),
        );
      } else {
        return { results: [], source: 'google', query, cached: false };
      }
    } catch (googleError) {
      // Google 失败，降级到 Tavily
      this.logger.warn(
        `Primary search failed, trying fallback: ${googleError}`,
      );

      if (this.tavilyEnabled && this.googleEnabled) {
        try {
          response = await this.executeWithResilience('tavily-search', () =>
            this.tavilySearch(query, maxResults, topic),
          );
        } catch (tavilyError) {
          this.logger.error(`All search engines failed: ${tavilyError}`);
          return {
            results: [],
            source: 'google',
            query,
            cached: false,
          };
        }
      } else {
        return { results: [], source: 'google', query, cached: false };
      }
    }

    // 3. 缓存结果
    const ttl = topic === 'news' ? CACHE_TTL.news : CACHE_TTL.general;
    await this.setToCache(cacheKey, response, ttl);

    return response;
  }

  // ==================== 学校官网定向搜索 ====================

  /**
   * 学校官网搜索（主引擎：Tavily，降级：Google）
   */
  async searchSchoolWebsite(
    schoolName: string,
    query: string,
    options: SchoolSearchOptions = {},
  ): Promise<SearchResponse> {
    if (!this.isAvailable()) {
      return {
        results: [],
        source: 'tavily',
        query: `${schoolName} ${query}`,
        cached: false,
      };
    }

    const { maxResults = 5 } = options;
    const domain = this.resolveSchoolDomain(schoolName);
    const fullQuery = `${schoolName} ${query}`;

    // 1. 检查缓存
    const cacheKey = this.buildCacheKey('school', fullQuery, { domain });
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return { ...cached, cached: true, source: 'cache' };
    }

    // 2. 调用搜索引擎（带降级）
    let response: SearchResponse;

    try {
      if (this.tavilyEnabled) {
        // 主路径：Tavily（深度搜索 + 域名限定）
        response = await this.executeWithResilience('tavily-search', () =>
          this.tavilySchoolSearch(fullQuery, domain, maxResults),
        );
      } else if (this.googleEnabled) {
        // Tavily 未配置，直接用 Google
        response = await this.executeWithResilience('google-search', () =>
          this.googleSchoolSearch(fullQuery, domain, maxResults),
        );
      } else {
        return {
          results: [],
          source: 'tavily',
          query: fullQuery,
          cached: false,
        };
      }
    } catch (primaryError) {
      // 主引擎失败，降级到备用引擎
      this.logger.warn(
        `Primary school search failed, trying fallback: ${primaryError}`,
      );

      if (this.googleEnabled && this.tavilyEnabled) {
        try {
          response = await this.executeWithResilience('google-search', () =>
            this.googleSchoolSearch(fullQuery, domain, maxResults),
          );
        } catch (fallbackError) {
          this.logger.error(
            `All search engines failed for school search: ${fallbackError}`,
          );
          return {
            results: [],
            source: 'tavily',
            query: fullQuery,
            cached: false,
          };
        }
      } else {
        return {
          results: [],
          source: 'tavily',
          query: fullQuery,
          cached: false,
        };
      }
    }

    // 3. 缓存结果
    await this.setToCache(cacheKey, response, CACHE_TTL.school);

    return response;
  }

  // ==================== Google Custom Search ====================

  private async googleSearch(
    query: string,
    maxResults: number,
    topic: string,
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      key: this.googleApiKey!,
      cx: this.googleSearchEngineId!,
      q: query,
      num: String(Math.min(maxResults, 10)),
    });

    // 新闻搜索
    if (topic === 'news') {
      params.set('sort', 'date');
      params.set('dateRestrict', 'm1'); // 最近一个月
    }

    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;

    const res = await fetch(url);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Google Search API error ${res.status}: ${errorBody}`);
    }

    const data = await res.json();
    const items = data.items || [];

    return {
      results: items.map((item: any) => ({
        title: item.title || '',
        snippet: item.snippet || '',
        url: item.link || '',
        date:
          item.pagemap?.metatags?.[0]?.['article:published_time'] || undefined,
      })),
      source: 'google',
      query,
      cached: false,
    };
  }

  private async googleSchoolSearch(
    query: string,
    domain: string | null,
    maxResults: number,
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      key: this.googleApiKey!,
      cx: this.googleSearchEngineId!,
      q: query,
      num: String(Math.min(maxResults, 10)),
    });

    // 限定学校域名
    if (domain) {
      params.set('siteSearch', domain);
      params.set('siteSearchFilter', 'i'); // include
    }

    const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;

    const res = await fetch(url);

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Google Search API error ${res.status}: ${errorBody}`);
    }

    const data = await res.json();
    const items = data.items || [];

    return {
      results: items.map((item: any) => ({
        title: item.title || '',
        snippet: item.snippet || '',
        url: item.link || '',
        content: item.snippet || '',
      })),
      source: 'google',
      query,
      cached: false,
    };
  }

  // ==================== Tavily Search ====================

  private async tavilySearch(
    query: string,
    maxResults: number,
    topic: string,
  ): Promise<SearchResponse> {
    const body = {
      api_key: this.tavilyApiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
      topic: topic === 'news' ? 'news' : 'general',
      include_answer: false,
    };

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Tavily API error ${res.status}: ${errorBody}`);
    }

    const data = await res.json();
    const results = data.results || [];

    return {
      results: results.map((item: any) => ({
        title: item.title || '',
        snippet: item.content?.substring(0, 300) || '',
        url: item.url || '',
        content: item.content || '',
      })),
      source: 'tavily',
      query,
      cached: false,
    };
  }

  private async tavilySchoolSearch(
    query: string,
    domain: string | null,
    maxResults: number,
  ): Promise<SearchResponse> {
    const body: Record<string, any> = {
      api_key: this.tavilyApiKey,
      query,
      max_results: maxResults,
      search_depth: 'advanced', // 深度搜索，提取完整页面内容
      include_answer: false,
    };

    // 限定学校域名
    if (domain) {
      body.include_domains = [domain];
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Tavily API error ${res.status}: ${errorBody}`);
    }

    const data = await res.json();
    const results = data.results || [];

    return {
      results: results.map((item: any) => ({
        title: item.title || '',
        snippet: item.content?.substring(0, 300) || '',
        url: item.url || '',
        content: item.content || '',
      })),
      source: 'tavily',
      query,
      cached: false,
    };
  }

  // ==================== 学校域名解析 ====================

  /**
   * 根据学校名称解析域名
   */
  resolveSchoolDomain(schoolName: string): string | null {
    const normalized = schoolName.toLowerCase().trim();

    // 直接匹配
    if (SCHOOL_DOMAIN_MAP[normalized]) {
      return SCHOOL_DOMAIN_MAP[normalized];
    }

    // 模糊匹配
    for (const [key, domain] of Object.entries(SCHOOL_DOMAIN_MAP)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return domain;
      }
    }

    // 推断：University of X → x.edu 或 uX.edu
    const uniOfMatch = normalized.match(/university\s+of\s+(\w+)/i);
    if (uniOfMatch) {
      const name = uniOfMatch[1].toLowerCase();
      return `${name}.edu`;
    }

    // 推断：X University → x.edu
    const xUniMatch = normalized.match(/^(\w+)\s+university/i);
    if (xUniMatch) {
      const name = xUniMatch[1].toLowerCase();
      return `${name}.edu`;
    }

    // 无法解析时返回 null（不限定域名）
    this.logger.debug(`Could not resolve domain for school: ${schoolName}`);
    return null;
  }

  // ==================== 弹性执行 ====================

  private async executeWithResilience<T>(
    serviceName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (this.resilience) {
      return this.resilience.execute(serviceName, fn, {
        retry: SEARCH_RETRY_CONFIG,
        timeoutMs: SEARCH_TIMEOUT_MS,
      });
    }

    // ResilienceService 不可用时直接执行
    return fn();
  }

  // ==================== 缓存操作 ====================

  private buildCacheKey(
    type: string,
    query: string,
    options: Record<string, any> = {},
  ): string {
    const raw = JSON.stringify({
      type,
      query: query.toLowerCase().trim(),
      ...options,
    });
    const hash = crypto.createHash('md5').update(raw).digest('hex');
    return `search:${hash}`;
  }

  private async getFromCache(key: string): Promise<SearchResponse | null> {
    // 优先 Redis
    if (this.redis?.connected) {
      try {
        const raw = await this.redis.get(key);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (err) {
        this.logger.debug(`Redis cache read failed: ${err}`);
      }
    }

    // 降级到内存缓存
    const entry = this.memoryCache.get(key);
    if (entry && Date.now() < entry.expiresAt) {
      return entry.data;
    }

    if (entry) {
      this.memoryCache.delete(key); // 过期清理
    }

    return null;
  }

  private async setToCache(
    key: string,
    data: SearchResponse,
    ttlSeconds: number,
  ): Promise<void> {
    // 优先 Redis
    if (this.redis?.connected) {
      try {
        await this.redis.set(key, JSON.stringify(data), ttlSeconds);
        return;
      } catch (err) {
        this.logger.debug(`Redis cache write failed: ${err}`);
      }
    }

    // 降级到内存缓存
    this.memoryCache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    // 简单的内存缓存大小限制
    if (this.memoryCache.size > 200) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }
  }

  // ==================== 统计 ====================

  getStats(): {
    googleEnabled: boolean;
    tavilyEnabled: boolean;
    memoryCacheSize: number;
  } {
    return {
      googleEnabled: this.googleEnabled,
      tavilyEnabled: this.tavilyEnabled,
      memoryCacheSize: this.memoryCache.size,
    };
  }
}
