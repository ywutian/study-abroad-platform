import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourceType } from '../../../common/types/enums';
import {
  BaseScrapeStrategy,
  ScrapeResult,
  ScrapedEssay,
} from './base.strategy';

/**
 * 学校官网爬虫策略
 */
@Injectable()
export class OfficialScrapeStrategy extends BaseScrapeStrategy {
  readonly sourceType = SourceType.OFFICIAL;

  // 学校官网 URL 配置
  private readonly SCHOOL_URLS: Record<string, { essays: string }> = {
    'Stanford University': {
      essays: 'https://admission.stanford.edu/apply/freshman/essays.html',
    },
    'Harvard University': {
      essays:
        'https://college.harvard.edu/admissions/apply/application-requirements',
    },
    'Massachusetts Institute of Technology': {
      essays:
        'https://mitadmissions.org/apply/firstyear/essays-activities-academics/',
    },
    'Yale University': {
      essays: 'https://admissions.yale.edu/essay',
    },
    'Princeton University': {
      essays: 'https://admission.princeton.edu/apply/what-we-look-for',
    },
    'Columbia University': {
      essays:
        'https://undergrad.admissions.columbia.edu/apply/first-year/essays',
    },
    'University of Pennsylvania': {
      essays:
        'https://admissions.upenn.edu/admissions-and-financial-aid/preparing-for-admission/essay',
    },
    'Duke University': {
      essays: 'https://admissions.duke.edu/apply/essays/',
    },
    'Northwestern University': {
      essays:
        'https://admissions.northwestern.edu/apply/application-process.html',
    },
    'California Institute of Technology': {
      essays:
        'https://www.admissions.caltech.edu/apply/first-year-freshman-applicants/essays',
    },
  };

  constructor() {
    super('OfficialScrapeStrategy');
  }

  async scrape(schoolName: string, year: number): Promise<ScrapeResult | null> {
    const config = this.SCHOOL_URLS[schoolName];
    if (!config) {
      this.logger.warn(`No URL config for ${schoolName}`);
      return null;
    }

    try {
      this.logger.log(`Scraping official site: ${schoolName}`);
      const html = await this.fetchPage(config.essays);
      const essays = this.parseEssays(html, schoolName);

      return {
        schoolName,
        year,
        essays,
        sourceUrl: config.essays,
        rawContent: html.substring(0, 5000), // 保存部分原始内容用于校验
      };
    } catch (error) {
      this.logger.error(`Failed to scrape ${schoolName}: ${error.message}`);
      return null;
    }
  }

  private parseEssays(html: string, schoolName: string): ScrapedEssay[] {
    const $ = cheerio.load(html);
    const essays: ScrapedEssay[] = [];

    // 文书题目的常见模式
    const essayPatterns = [
      /(?:tell us|describe|reflect|share|explain|discuss|write about).*?(?:\.|$)/gi,
      /(?:why.*?(?:college|university|school|stanford|harvard|mit|yale|princeton)).*?(?:\.|$)/gi,
      /(?:what.*?(?:meaningful|important|significant|matters)).*?(?:\.|$)/gi,
    ];

    // 常见的文书容器选择器
    const selectors = [
      '.essay-prompt',
      '.application-essay',
      '[class*="essay"]',
      '[class*="prompt"]',
      'article p',
      '.content p',
      'main p',
      'li',
    ];

    const seenPrompts = new Set<string>();

    for (const selector of selectors) {
      $(selector).each((_, elem) => {
        const text = $(elem).text().trim();

        // 检查是否像文书题目
        if (text.length > 50 && text.length < 800) {
          for (const pattern of essayPatterns) {
            pattern.lastIndex = 0; // 重置正则
            if (pattern.test(text)) {
              // 去重
              const normalized = text.toLowerCase().substring(0, 100);
              if (!seenPrompts.has(normalized)) {
                seenPrompts.add(normalized);
                essays.push({
                  prompt: text,
                  wordLimit: this.extractWordLimit(text),
                  type: this.classifyEssayType(text),
                  isRequired: !text.toLowerCase().includes('optional'),
                  confidence: 0.7, // 官网来源置信度较高
                });
              }
              break;
            }
          }
        }
      });
    }

    return essays.slice(0, 10); // 最多返回10个
  }

  getConfiguredSchools(): string[] {
    return Object.keys(this.SCHOOL_URLS);
  }
}
