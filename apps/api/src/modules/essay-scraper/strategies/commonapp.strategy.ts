import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { SourceType } from '../../../common/types/enums';
import {
  BaseScrapeStrategy,
  ScrapeResult,
  ScrapedEssay,
} from './base.strategy';

/**
 * CommonApp 文书采集策略
 *
 * CommonApp 主文书适用于所有 CommonApp 成员学校。
 * 爬取一次即可链接到所有使用 CommonApp 的学校。
 */
@Injectable()
export class CommonAppScrapeStrategy extends BaseScrapeStrategy {
  readonly sourceType = SourceType.COMMON_APP;
  private openai: OpenAI | null = null;

  private readonly COMMON_APP_URL =
    'https://www.commonapp.org/apply/essay-prompts';

  constructor(private configService: ConfigService) {
    super('CommonAppScrapeStrategy');
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  async scrape(
    _schoolName: string,
    year: number,
  ): Promise<ScrapeResult | null> {
    try {
      this.logger.log(`Scraping CommonApp essay prompts for ${year}`);
      const html = await this.fetchPage(this.COMMON_APP_URL);
      const bodyText = this.extractBodyText(html);
      const essays = await this.llmExtract(bodyText, year);

      return {
        schoolName: 'CommonApp',
        year,
        essays: essays.map((e) => ({ ...e, type: 'COMMON_APP' })),
        sourceUrl: this.COMMON_APP_URL,
        rawContent: bodyText.substring(0, 5000),
      };
    } catch (error) {
      this.logger.error(`CommonApp scrape failed: ${error.message}`);
      return null;
    }
  }

  private extractBodyText(html: string): string {
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header').remove();
    return $('main, article, .content, body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async llmExtract(
    bodyText: string,
    year: number,
  ): Promise<ScrapedEssay[]> {
    if (!this.openai) {
      // Fallback: 返回已知的 CommonApp 固定格式题目
      return this.getKnownCommonAppPrompts(year);
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting Common Application essay prompts. Extract ALL main essay prompts for the ${year}-${year + 1} application cycle.

Return a JSON object with an "essays" array. Each essay object must have:
- prompt: the exact essay prompt text (the full question)
- wordLimit: number (Common App personal essay is typically 650 words)
- type: "COMMON_APP"
- isRequired: true (one of the prompts must be chosen)
- confidence: 0.0-1.0

The Common App typically has 7 essay prompt options. Extract all of them.`,
          },
          {
            role: 'user',
            content: `Extract Common App essay prompts from this page:\n\n${bodyText.substring(0, 8000)}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return this.getKnownCommonAppPrompts(year);

      const parsed = JSON.parse(content);
      const essays = (parsed.essays || []).filter(
        (e: ScrapedEssay) => e.prompt && e.prompt.length > 20,
      );

      return essays.length > 0 ? essays : this.getKnownCommonAppPrompts(year);
    } catch (error) {
      this.logger.error(`CommonApp LLM extraction failed: ${error.message}`);
      return this.getKnownCommonAppPrompts(year);
    }
  }

  /**
   * 已知的 CommonApp 题目作为 fallback
   * CommonApp 题目近年来变化不大
   */
  private getKnownCommonAppPrompts(_year: number): ScrapedEssay[] {
    return [
      {
        prompt:
          'Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.',
        wordLimit: 650,
        type: 'COMMON_APP',
        isRequired: true,
        confidence: 0.9,
      },
      {
        prompt:
          'The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?',
        wordLimit: 650,
        type: 'COMMON_APP',
        isRequired: true,
        confidence: 0.9,
      },
      {
        prompt:
          'Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?',
        wordLimit: 650,
        type: 'COMMON_APP',
        isRequired: true,
        confidence: 0.9,
      },
      {
        prompt:
          'Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?',
        wordLimit: 650,
        type: 'COMMON_APP',
        isRequired: true,
        confidence: 0.9,
      },
      {
        prompt:
          'Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.',
        wordLimit: 650,
        type: 'COMMON_APP',
        isRequired: true,
        confidence: 0.9,
      },
      {
        prompt:
          'Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?',
        wordLimit: 650,
        type: 'COMMON_APP',
        isRequired: true,
        confidence: 0.9,
      },
      {
        prompt:
          "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design.",
        wordLimit: 650,
        type: 'COMMON_APP',
        isRequired: true,
        confidence: 0.9,
      },
    ];
  }

  getConfiguredSchools(): string[] {
    return ['CommonApp'];
  }
}
