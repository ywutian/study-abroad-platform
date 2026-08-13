/**
 * Search Tools Service
 *
 * Tools: WEB_SEARCH, SEARCH_SCHOOL_WEBSITE
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { WebSearchService } from '../services/web-search.service';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class SearchToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(SearchToolsService.name);

  constructor(@Optional() private webSearchService?: WebSearchService) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map([
      [
        'web_search',
        (args, _userId, _ctx, locale) =>
          this.webSearch(args.query ?? '', args.topic, locale),
      ],
      [
        'search_school_website',
        (args, _userId, _ctx, locale) =>
          this.searchSchoolWebsite(
            args.schoolName ?? '',
            args.query ?? '',
            locale,
          ),
      ],
    ]);
  }

  async webSearch(query: string, topic?: string, locale = 'zh') {
    const isZh = locale === 'zh';
    if (!this.webSearchService || !this.webSearchService.isAvailable()) {
      return {
        error: isZh
          ? '搜索功能未配置，请联系管理员配置搜索 API Key'
          : 'Search not configured. Please contact admin to set up the search API key.',
      };
    }

    try {
      const response = await this.webSearchService.search(query, {
        topic: (topic as 'general' | 'news') || 'general',
        maxResults: 5,
      });

      if (!response.results.length) {
        return {
          message: isZh
            ? '未找到相关搜索结果'
            : 'No relevant search results found',
          query,
        };
      }

      return {
        count: response.results.length,
        source: response.source,
        cached: response.cached,
        results: response.results.map((r) => ({
          title: r.title,
          snippet: r.snippet,
          url: r.url,
          ...(r.date ? { date: r.date } : {}),
        })),
      };
    } catch (error) {
      this.logger.error('Web search failed', error);
      return {
        error: isZh
          ? '搜索服务暂时不可用，已使用现有数据库信息回答'
          : 'Search service temporarily unavailable. Using existing database information.',
      };
    }
  }

  async searchSchoolWebsite(schoolName: string, query: string, locale = 'zh') {
    const isZh = locale === 'zh';
    if (!this.webSearchService || !this.webSearchService.isAvailable()) {
      return {
        error: isZh
          ? '搜索功能未配置，请联系管理员配置搜索 API Key'
          : 'Search not configured. Please contact admin to set up the search API key.',
      };
    }

    if (!schoolName) {
      return { error: isZh ? '请提供学校名称' : 'Please provide school name' };
    }

    try {
      const response = await this.webSearchService.searchSchoolWebsite(
        schoolName,
        query,
        { maxResults: 5 },
      );

      if (!response.results.length) {
        return {
          message: isZh
            ? `未在 ${schoolName} 官网找到相关信息`
            : `No relevant information found on ${schoolName}'s website`,
          query: `${schoolName} ${query}`,
        };
      }

      return {
        school: schoolName,
        count: response.results.length,
        source: response.source,
        cached: response.cached,
        results: response.results.map((r) => ({
          title: r.title,
          snippet: r.snippet,
          url: r.url,
          ...(r.content ? { content: r.content } : {}),
        })),
      };
    } catch (error) {
      this.logger.error('School website search failed', error);
      return {
        error: isZh
          ? '学校官网搜索暂时不可用，已使用现有数据库信息回答'
          : 'School website search temporarily unavailable. Using existing database information.',
      };
    }
  }
}
