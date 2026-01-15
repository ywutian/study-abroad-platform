import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourceType } from '../../../common/types/enums';
import {
  BaseScrapeStrategy,
  ScrapeResult,
  ScrapedEssay,
} from './base.strategy';

/**
 * CollegeVine 爬虫策略
 * CollegeVine 整理了各学校的文书题目
 */
@Injectable()
export class CollegeVineScrapeStrategy extends BaseScrapeStrategy {
  readonly sourceType = SourceType.COLLEGEVINE;

  // 学校名到 CollegeVine slug 的映射
  private readonly SCHOOL_SLUGS: Record<string, string> = {
    'Stanford University': 'stanford-university',
    'Harvard University': 'harvard-university',
    'Massachusetts Institute of Technology':
      'massachusetts-institute-of-technology',
    'Yale University': 'yale-university',
    'Princeton University': 'princeton-university',
    'Columbia University': 'columbia-university',
    'University of Pennsylvania': 'university-of-pennsylvania',
    'Duke University': 'duke-university',
    'Northwestern University': 'northwestern-university',
    'California Institute of Technology': 'california-institute-of-technology',
    'Brown University': 'brown-university',
    'Cornell University': 'cornell-university',
    'Dartmouth College': 'dartmouth-college',
    'University of Chicago': 'university-of-chicago',
    'Johns Hopkins University': 'johns-hopkins-university',
    'Rice University': 'rice-university',
    'Vanderbilt University': 'vanderbilt-university',
    'University of Notre Dame': 'university-of-notre-dame',
    'Georgetown University': 'georgetown-university',
    'Carnegie Mellon University': 'carnegie-mellon-university',
  };

  constructor() {
    super('CollegeVineScrapeStrategy');
  }

  async scrape(schoolName: string, year: number): Promise<ScrapeResult | null> {
    const slug = this.SCHOOL_SLUGS[schoolName];
    if (!slug) {
      this.logger.warn(`No CollegeVine slug for ${schoolName}`);
      return null;
    }

    const url = `https://www.collegevine.com/schools/${slug}/essays`;

    try {
      this.logger.log(`Scraping CollegeVine: ${schoolName}`);
      const html = await this.fetchPage(url);
      const essays = this.parseEssays(html);

      return {
        schoolName,
        year,
        essays,
        sourceUrl: url,
        rawContent: html.substring(0, 5000),
      };
    } catch (error) {
      this.logger.error(
        `Failed to scrape CollegeVine for ${schoolName}: ${error.message}`,
      );
      return null;
    }
  }

  private parseEssays(html: string): ScrapedEssay[] {
    const $ = cheerio.load(html);
    const essays: ScrapedEssay[] = [];

    // CollegeVine 的文书通常在特定容器中
    const selectors = [
      '.essay-prompt-text',
      '[class*="EssayPrompt"]',
      '.prompt-content',
      'article section p',
    ];

    for (const selector of selectors) {
      $(selector).each((_, elem) => {
        const text = $(elem).text().trim();

        if (text.length > 30 && text.length < 1000) {
          // 检查是否包含问句特征
          if (
            text.includes('?') ||
            /^(describe|tell|explain|share|reflect|what|why|how)/i.test(text)
          ) {
            essays.push({
              prompt: text,
              wordLimit: this.extractWordLimit(text),
              type: this.classifyEssayType(text),
              isRequired: !text.toLowerCase().includes('optional'),
              confidence: 0.8, // CollegeVine 数据较准确
            });
          }
        }
      });
    }

    // 去重
    const unique = essays.filter(
      (v, i, a) =>
        a.findIndex(
          (t) => t.prompt.substring(0, 50) === v.prompt.substring(0, 50),
        ) === i,
    );

    return unique.slice(0, 10);
  }

  getConfiguredSchools(): string[] {
    return Object.keys(this.SCHOOL_SLUGS);
  }
}
