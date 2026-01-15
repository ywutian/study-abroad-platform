import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EssayStatus, EssayType, SourceType } from '../../common/types/enums';
import { OfficialScrapeStrategy } from './strategies/official.strategy';
import { CollegeVineScrapeStrategy } from './strategies/collegevine.strategy';
import { AiValidatorService } from './ai-validator.service';
import { ScrapeResult } from './strategies/base.strategy';

export interface ScrapeJobResult {
  schoolName: string;
  success: boolean;
  essaysFound: number;
  error?: string;
}

@Injectable()
export class EssayScraperService {
  private readonly logger = new Logger(EssayScraperService.name);

  constructor(
    private prisma: PrismaService,
    private officialStrategy: OfficialScrapeStrategy,
    private collegevineStrategy: CollegeVineScrapeStrategy,
    private aiValidator: AiValidatorService,
  ) {}

  /**
   * 爬取单个学校的文书题目
   */
  async scrapeSchool(
    schoolName: string,
    year: number = new Date().getFullYear(),
    sources: SourceType[] = [SourceType.OFFICIAL, SourceType.COLLEGEVINE],
  ): Promise<ScrapeJobResult> {
    this.logger.log(`Starting scrape for ${schoolName}, year ${year}`);

    const results: ScrapeResult[] = [];

    // 从多个来源爬取
    for (const source of sources) {
      try {
        let result: ScrapeResult | null = null;

        switch (source) {
          case SourceType.OFFICIAL:
            result = await this.officialStrategy.scrape(schoolName, year);
            break;
          case SourceType.COLLEGEVINE:
            result = await this.collegevineStrategy.scrape(schoolName, year);
            break;
        }

        if (result && result.essays.length > 0) {
          results.push(result);
        }

        // 请求间隔
        await this.delay(2000);
      } catch (error) {
        this.logger.error(
          `Failed to scrape ${source} for ${schoolName}: ${error.message}`,
        );
      }
    }

    if (results.length === 0) {
      return {
        schoolName,
        success: false,
        essaysFound: 0,
        error: 'No data found from any source',
      };
    }

    // 合并多来源数据
    const mergedEssays = await this.aiValidator.compareMultipleSources(
      results.map((r) => ({ source: r.sourceUrl, essays: r.essays })),
    );

    // 保存到数据库
    const savedCount = await this.saveEssays(
      schoolName,
      year,
      mergedEssays,
      results,
    );

    return { schoolName, success: true, essaysFound: savedCount };
  }

  /**
   * 批量爬取所有配置的学校
   */
  async scrapeAllSchools(
    year: number = new Date().getFullYear(),
  ): Promise<ScrapeJobResult[]> {
    const schools = this.getConfiguredSchools();
    const results: ScrapeJobResult[] = [];

    this.logger.log(`Starting batch scrape for ${schools.length} schools`);

    for (const schoolName of schools) {
      const result = await this.scrapeSchool(schoolName, year);
      results.push(result);

      // 学校间隔
      await this.delay(3000);
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Batch scrape complete: ${successCount}/${schools.length} successful`,
    );

    return results;
  }

  /**
   * 保存文书到数据库
   */
  private async saveEssays(
    schoolName: string,
    year: number,
    essays: Array<{
      prompt: string;
      wordLimit?: number;
      type?: string;
      isRequired?: boolean;
      confidence?: number;
    }>,
    scrapeResults: ScrapeResult[],
  ): Promise<number> {
    // 查找学校
    const school = await this.prisma.school.findFirst({
      where: { name: schoolName },
    });

    if (!school) {
      this.logger.warn(`School not found: ${schoolName}`);
      return 0;
    }

    let savedCount = 0;

    for (let i = 0; i < essays.length; i++) {
      const essay = essays[i];

      try {
        // AI 验证和增强
        const validation = await this.aiValidator.validateAndEnhance(
          essay as any,
          schoolName,
        );

        if (!validation.isValid) {
          this.logger.warn(
            `Invalid essay skipped: ${essay.prompt.substring(0, 50)}...`,
          );
          continue;
        }

        // 检查是否已存在
        const existing = await this.prisma.essayPrompt.findFirst({
          where: {
            schoolId: school.id,
            year,
            prompt: essay.prompt,
          },
        });

        if (existing) {
          this.logger.debug(
            `Essay already exists, skipping: ${essay.prompt.substring(0, 50)}...`,
          );
          continue;
        }

        // 创建文书记录
        await this.prisma.essayPrompt.create({
          data: {
            schoolId: school.id,
            year,
            type: this.mapEssayType(essay.type),
            prompt: essay.prompt,
            promptZh: validation.promptZh,
            wordLimit: essay.wordLimit,
            isRequired: essay.isRequired ?? true,
            sortOrder: i,
            status:
              validation.confidence >= 0.8
                ? EssayStatus.VERIFIED
                : EssayStatus.PENDING,
            aiTips: validation.aiTips,
            aiCategory: validation.aiCategory,
            sources: {
              create: scrapeResults.map((r) => ({
                sourceType: this.getSourceType(r.sourceUrl),
                sourceUrl: r.sourceUrl,
                rawContent: r.rawContent,
                confidence: essay.confidence,
              })),
            },
          },
        });

        savedCount++;
      } catch (error) {
        this.logger.error(`Failed to save essay: ${error.message}`);
      }
    }

    return savedCount;
  }

  /**
   * 获取所有配置的学校
   */
  getConfiguredSchools(): string[] {
    const officialSchools = this.officialStrategy.getConfiguredSchools();
    const cvSchools = this.collegevineStrategy.getConfiguredSchools();
    return [...new Set([...officialSchools, ...cvSchools])];
  }

  private mapEssayType(type?: string): EssayType {
    switch (type?.toUpperCase()) {
      case 'WHY_US':
        return EssayType.WHY_US;
      case 'ACTIVITY':
        return EssayType.ACTIVITY;
      case 'SHORT_ANSWER':
        return EssayType.SHORT_ANSWER;
      case 'OPTIONAL':
        return EssayType.OPTIONAL;
      case 'COMMON_APP':
        return EssayType.COMMON_APP;
      default:
        return EssayType.SUPPLEMENT;
    }
  }

  private getSourceType(url: string): SourceType {
    if (url.includes('collegevine')) return SourceType.COLLEGEVINE;
    if (url.includes('prepscholar')) return SourceType.PREPSCHOLAR;
    if (url.includes('commonapp')) return SourceType.COMMON_APP;
    return SourceType.OFFICIAL;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
