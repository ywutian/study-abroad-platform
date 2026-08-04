import { Injectable, Optional } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../../common/utils/llm-json.util';
import { normalizeSchoolName } from '../../../common/utils/school-name.util';
import { SourceType } from '../../../common/types/enums';
import {
  BaseScrapeStrategy,
  ScrapeResult,
  ScrapedEssay,
} from './base.strategy';

interface ScrapeConfig {
  cssSelectors?: string[];
  removeSelectors?: string[];
  llmHint?: string;
  maxContentLength?: number;
}

@Injectable()
export class LlmScrapeStrategy extends BaseScrapeStrategy {
  readonly sourceType = SourceType.OFFICIAL;

  constructor(
    private prisma: PrismaService,
    @Optional() private llmService?: LLMService,
  ) {
    super('LlmScrapeStrategy');
  }

  /**
   * 从 DB 查询学校配置并爬取
   */
  async scrapeWithConfig(
    schoolName: string,
    year: number,
    url: string,
    config?: ScrapeConfig,
  ): Promise<ScrapeResult | null> {
    if (!this.llmService) {
      this.logger.warn('LLMService not available, LLM strategy unavailable');
      return null;
    }

    try {
      this.logger.log(`LLM scraping: ${schoolName} from ${url}`);
      const html = await this.fetchPage(url);
      const bodyText = this.extractBodyText(html, config);
      const essays = await this.llmExtract(bodyText, schoolName, year, config);

      return {
        schoolName,
        year,
        essays,
        sourceUrl: url,
        rawContent: bodyText.substring(0, 5000),
      };
    } catch (error: unknown) {
      this.logger.error(
        `LLM scrape failed for ${schoolName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * 兼容 BaseScrapeStrategy 接口（无自定义配置时使用）
   */
  async scrape(schoolName: string, year: number): Promise<ScrapeResult | null> {
    // 从 DB 查找该校的 source 配置
    // governance: system-scope — School / SchoolEssaySource lookups feeding the scraper
    const school = await this.prisma.school.findUnique({
      where: { nameNorm: normalizeSchoolName(schoolName) },
      include: {
        essaySources: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
      },
    });

    if (!school || school.essaySources.length === 0) {
      this.logger.warn(`No essay source configured for ${schoolName}`);
      return null;
    }

    // 尝试每个配置的 source
    for (const source of school.essaySources) {
      const config = (source.scrapeConfig as ScrapeConfig) || undefined;
      const result = await this.scrapeWithConfig(
        schoolName,
        year,
        source.url,
        config,
      );

      if (result && result.essays.length > 0) {
        // 更新采集状态
        // governance: system-scope — School / SchoolEssaySource lookups feeding the scraper
        await this.prisma.schoolEssaySource.update({
          where: { id: source.id },
          data: {
            lastScrapedAt: new Date(),
            lastStatus: 'SUCCESS',
            lastError: null,
          },
        });
        return result;
      }
    }

    return null;
  }

  /**
   * 从 HTML 提取正文文本
   */
  private extractBodyText(html: string, config?: ScrapeConfig): string {
    const $ = cheerio.load(html);

    // 移除无关元素
    const defaultRemove = [
      'script',
      'style',
      'nav',
      'footer',
      'header',
      '[role="navigation"]',
      '.cookie-banner',
      '#cookie-consent',
    ];
    const removeSelectors = config?.removeSelectors
      ? [...defaultRemove, ...config.removeSelectors]
      : defaultRemove;

    removeSelectors.forEach((sel) => $(sel).remove());

    // 如果有自定义 CSS 选择器，只提取匹配内容
    if (config?.cssSelectors && config.cssSelectors.length > 0) {
      const texts: string[] = [];
      for (const selector of config.cssSelectors) {
        $(selector).each((_, elem) => {
          texts.push($(elem).text().trim());
        });
      }
      if (texts.length > 0) {
        return texts.join('\n\n').replace(/\s+/g, ' ').trim();
      }
    }

    // 默认：提取 main/article/body
    return $('main, article, .content, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 用 GPT-4o-mini 提取结构化文书数据
   */
  private async llmExtract(
    bodyText: string,
    schoolName: string,
    year: number,
    config?: ScrapeConfig,
  ): Promise<ScrapedEssay[]> {
    if (!this.llmService) return [];

    const maxLength = config?.maxContentLength || 8000;
    const truncatedText = bodyText.substring(0, maxLength);

    const llmHint = config?.llmHint
      ? `\nPage structure hint: ${config.llmHint}`
      : '';

    try {
      const content = await this.llmService.chatSimpleGuarded(
        [
          {
            role: 'system',
            content: `You are an expert at extracting college application essay prompts from web page text. Extract ALL essay prompts for ${schoolName} for the ${year}-${year + 1} application cycle.${llmHint}

Return a JSON object with an "essays" array. Each essay object must have:
- prompt: the exact English essay prompt text
- wordLimit: number or null
- type: one of COMMON_APP, SUPPLEMENTAL, WHY_SCHOOL, SHORT_ANSWER, ACTIVITY, OPTIONAL
- isRequired: boolean
- confidence: 0.0-1.0 how certain this is a real essay prompt

If no prompts are found, return {"essays":[]}.
Only include actual essay prompts, not instructions, tips, or general admissions info.`,
          },
          {
            role: 'user',
            content: `Extract essay prompts from this page text:\n\n${truncatedText}`,
          },
        ],
        {
          // gpt-5/o-series reasoning models consume completion tokens on hidden
          // reasoning; a low budget truncates JSON output. Keep this generous.
          maxTokens: 8000,
          temperature: 0.1,
          providerOptions: { response_format: { type: 'json_object' } },
        },
      );

      const parsed =
        extractJsonFromLlm<{ essays?: ScrapedEssay[] }>(content) ?? {};
      return (parsed.essays || []).filter(
        (e: ScrapedEssay) => e.prompt && e.prompt.length > 20,
      );
    } catch (error: unknown) {
      this.logger.error(
        `LLM extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  getConfiguredSchools(): string[] {
    // LLM 策略从 DB 获取配置，此方法仅为兼容
    return [];
  }
}
