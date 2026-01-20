import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EssayStatus, EssayType, SourceType } from '../../common/types/enums';
import { OfficialScrapeStrategy } from './strategies/official.strategy';
import { CollegeVineScrapeStrategy } from './strategies/collegevine.strategy';
import { LlmScrapeStrategy } from './strategies/llm.strategy';
import { CommonAppScrapeStrategy } from './strategies/commonapp.strategy';
import { AiValidatorService } from './ai-validator.service';
import { ScrapeResult, ScrapedEssay } from './strategies/base.strategy';

export interface ScrapeJobResult {
  schoolName: string;
  success: boolean;
  essaysFound: number;
  error?: string;
}

export interface TestScrapeResult {
  school: string;
  schoolId?: string;
  source: string;
  scrapeGroup: string;
  year: number;
  essays: Array<
    ScrapedEssay & {
      promptZh?: string;
      changeType?: string;
      aiTips?: string;
      aiCategory?: string;
    }
  >;
  rawContentPreview: string;
}

@Injectable()
export class EssayScraperService {
  private readonly logger = new Logger(EssayScraperService.name);

  constructor(
    private prisma: PrismaService,
    private officialStrategy: OfficialScrapeStrategy,
    private collegevineStrategy: CollegeVineScrapeStrategy,
    private llmStrategy: LlmScrapeStrategy,
    private commonAppStrategy: CommonAppScrapeStrategy,
    private aiValidator: AiValidatorService,
  ) {}

  // ============ Core Scraping ============

  /**
   * 爬取单个学校的文书题目（LLM 优先 + fallback）
   */
  async scrapeSchool(
    schoolName: string,
    year: number = this.getCurrentApplicationYear(),
    sources: SourceType[] = [SourceType.OFFICIAL, SourceType.COLLEGEVINE],
  ): Promise<ScrapeJobResult> {
    this.logger.log(`Starting scrape for ${schoolName}, year ${year}`);

    // 1. 尝试 LLM 策略（从 DB 查询配置）
    try {
      const llmResult = await this.llmStrategy.scrape(schoolName, year);
      if (llmResult && llmResult.essays.length > 0) {
        const mergedEssays = await this.aiValidator.compareMultipleSources([
          { source: llmResult.sourceUrl, essays: llmResult.essays },
        ]);
        const savedCount = await this.saveEssays(
          schoolName,
          year,
          mergedEssays,
          [llmResult],
        );
        return { schoolName, success: true, essaysFound: savedCount };
      }
    } catch (error) {
      this.logger.warn(
        `LLM strategy failed for ${schoolName}, falling back: ${error.message}`,
      );
    }

    // 2. Fallback 到现有 regex 策略
    const results: ScrapeResult[] = [];

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

    const mergedEssays = await this.aiValidator.compareMultipleSources(
      results.map((r) => ({ source: r.sourceUrl, essays: r.essays })),
    );

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
    year: number = this.getCurrentApplicationYear(),
  ): Promise<ScrapeJobResult[]> {
    const schools = await this.getConfiguredSchools();
    const results: ScrapeJobResult[] = [];

    this.logger.log(`Starting batch scrape for ${schools.length} schools`);

    // 先采集 CommonApp
    try {
      const commonAppResult = await this.scrapeAndLinkCommonApp(year);
      results.push(commonAppResult);
    } catch (error) {
      this.logger.error(`CommonApp scrape failed: ${error.message}`);
    }

    // 逐校采集 supplement
    for (const schoolName of schools) {
      const result = await this.scrapeSchool(schoolName, year);
      results.push(result);
      await this.delay(3000);
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Batch scrape complete: ${successCount}/${results.length} successful`,
    );

    return results;
  }

  // ============ CommonApp Integration ============

  /**
   * 采集 CommonApp 主文书并链接到所有使用 CommonApp 的学校
   */
  async scrapeAndLinkCommonApp(year: number): Promise<ScrapeJobResult> {
    const result = await this.commonAppStrategy.scrape('CommonApp', year);
    if (!result || result.essays.length === 0) {
      return {
        schoolName: 'CommonApp',
        success: false,
        essaysFound: 0,
        error: 'No CommonApp prompts found',
      };
    }

    // 查找所有 COMMON_APP 分组的学校
    const commonAppSources = await this.prisma.schoolEssaySource.findMany({
      where: { scrapeGroup: 'COMMON_APP', isActive: true },
      include: { school: { select: { id: true, name: true } } },
    });

    let totalSaved = 0;
    for (const source of commonAppSources) {
      const saved = await this.saveEssays(
        source.school.name,
        year,
        result.essays,
        [result],
      );
      totalSaved += saved;
    }

    return {
      schoolName: 'CommonApp',
      success: true,
      essaysFound: totalSaved,
    };
  }

  // ============ Test Scrape (Preview) ============

  /**
   * 测试采集：执行完整流程但不写入 DB
   */
  async testScrapeSchool(
    schoolName: string,
    year: number = this.getCurrentApplicationYear(),
  ): Promise<TestScrapeResult> {
    // 查找学校和 source 配置
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { name: { equals: schoolName, mode: 'insensitive' } },
          { name: { contains: schoolName, mode: 'insensitive' } },
          { aliases: { has: schoolName } },
        ],
      },
      include: {
        essaySources: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
      },
    });

    const source = school?.essaySources?.[0];
    const scrapeGroup = source?.scrapeGroup || 'GENERIC';

    // 执行采集
    let scrapeResult: ScrapeResult | null = null;

    // 尝试 LLM 策略
    if (source) {
      const config = (source.scrapeConfig as any) || undefined;
      scrapeResult = await this.llmStrategy.scrapeWithConfig(
        schoolName,
        year,
        source.url,
        config,
      );
    }

    // Fallback 到现有策略
    if (!scrapeResult || scrapeResult.essays.length === 0) {
      scrapeResult = await this.officialStrategy.scrape(schoolName, year);
    }
    if (!scrapeResult || scrapeResult.essays.length === 0) {
      scrapeResult = await this.collegevineStrategy.scrape(schoolName, year);
    }

    if (!scrapeResult || scrapeResult.essays.length === 0) {
      return {
        school: schoolName,
        schoolId: school?.id,
        source: source?.url || 'none',
        scrapeGroup,
        year,
        essays: [],
        rawContentPreview: '',
      };
    }

    // AI 验证增强（但不保存）
    const enhancedEssays = [];
    for (const essay of scrapeResult.essays) {
      const validation = await this.aiValidator.validateAndEnhance(
        essay,
        schoolName,
      );
      if (validation.isValid) {
        // 变化检测
        const changeInfo = school
          ? await this.detectSingleChange(school.id, year, essay.prompt)
          : { changeType: 'NEW' };

        enhancedEssays.push({
          ...essay,
          promptZh: validation.promptZh,
          aiTips: validation.aiTips,
          aiCategory: validation.aiCategory,
          confidence: validation.confidence,
          changeType: changeInfo.changeType,
        });
      }
    }

    return {
      school: schoolName,
      schoolId: school?.id,
      source: scrapeResult.sourceUrl,
      scrapeGroup,
      year,
      essays: enhancedEssays,
      rawContentPreview: (scrapeResult.rawContent || '').substring(0, 500),
    };
  }

  /**
   * 确认保存测试采集的结果
   */
  async confirmSave(
    data: TestScrapeResult,
    selectedIndices?: number[],
  ): Promise<number> {
    const essays =
      selectedIndices && selectedIndices.length > 0
        ? data.essays.filter((_, i) => selectedIndices.includes(i))
        : data.essays;

    if (essays.length === 0) return 0;

    const school = data.schoolId
      ? await this.prisma.school.findUnique({ where: { id: data.schoolId } })
      : await this.prisma.school.findFirst({
          where: { name: { contains: data.school, mode: 'insensitive' } },
        });

    if (!school) return 0;

    let savedCount = 0;
    for (let i = 0; i < essays.length; i++) {
      const essay = essays[i];
      try {
        // 去重检查
        const existing = await this.prisma.essayPrompt.findFirst({
          where: {
            schoolId: school.id,
            year: data.year,
            prompt: { startsWith: essay.prompt.substring(0, 50) },
          },
        });

        if (existing) continue;

        await this.prisma.essayPrompt.create({
          data: {
            schoolId: school.id,
            year: data.year,
            type: this.mapEssayType(essay.type),
            prompt: essay.prompt,
            promptZh: essay.promptZh || null,
            wordLimit: essay.wordLimit,
            isRequired: essay.isRequired ?? true,
            sortOrder: i,
            status:
              (essay.confidence || 0) >= 0.8
                ? EssayStatus.VERIFIED
                : EssayStatus.PENDING,
            aiTips: essay.aiTips || null,
            aiCategory: essay.aiCategory || null,
            changeType: essay.changeType || 'NEW',
            sources: {
              create: {
                sourceType: this.getSourceType(data.source),
                sourceUrl: data.source,
                rawContent: data.rawContentPreview,
                confidence: essay.confidence,
              },
            },
          },
        });
        savedCount++;
      } catch (error) {
        this.logger.error(`Failed to save confirmed essay: ${error.message}`);
      }
    }

    return savedCount;
  }

  // ============ Year-over-Year Change Detection ============

  /**
   * 检测单个题目的年度变化
   */
  private async detectSingleChange(
    schoolId: string,
    year: number,
    newPrompt: string,
  ): Promise<{ changeType: string; previousPromptId?: string }> {
    const priorPrompts = await this.prisma.essayPrompt.findMany({
      where: {
        schoolId,
        year: year - 1,
        status: EssayStatus.VERIFIED,
        isActive: true,
      },
      select: { id: true, prompt: true },
    });

    if (priorPrompts.length === 0) return { changeType: 'NEW' };

    // 简单字符串相似度检查
    for (const prior of priorPrompts) {
      const similarity = this.textSimilarity(
        newPrompt.toLowerCase(),
        prior.prompt.toLowerCase(),
      );
      if (similarity > 0.9) {
        return { changeType: 'UNCHANGED', previousPromptId: prior.id };
      }
      if (similarity > 0.5) {
        return { changeType: 'MODIFIED', previousPromptId: prior.id };
      }
    }

    return { changeType: 'NEW' };
  }

  /**
   * 批量变化检测（用 LLM 做语义匹配）
   */
  async detectChanges(
    schoolId: string,
    year: number,
    newEssays: ScrapedEssay[],
  ): Promise<
    Array<ScrapedEssay & { changeType: string; previousPromptId?: string }>
  > {
    const priorPrompts = await this.prisma.essayPrompt.findMany({
      where: {
        schoolId,
        year: year - 1,
        status: EssayStatus.VERIFIED,
        isActive: true,
      },
      select: { id: true, prompt: true },
    });

    if (priorPrompts.length === 0) {
      return newEssays.map((e) => ({ ...e, changeType: 'NEW' }));
    }

    // 对每个新题目用简单文本相似度匹配
    return newEssays.map((essay) => {
      let bestMatch = { similarity: 0, id: '', changeType: 'NEW' };

      for (const prior of priorPrompts) {
        const sim = this.textSimilarity(
          essay.prompt.toLowerCase(),
          prior.prompt.toLowerCase(),
        );
        if (sim > bestMatch.similarity) {
          bestMatch = {
            similarity: sim,
            id: prior.id,
            changeType:
              sim > 0.9 ? 'UNCHANGED' : sim > 0.5 ? 'MODIFIED' : 'NEW',
          };
        }
      }

      return {
        ...essay,
        changeType: bestMatch.changeType,
        previousPromptId:
          bestMatch.changeType !== 'NEW' ? bestMatch.id : undefined,
      };
    });
  }

  // ============ Save & DB Operations ============

  /**
   * 保存文书到数据库
   */
  async saveEssays(
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
    const school = await this.prisma.school.findFirst({
      where: {
        OR: [
          { name: schoolName },
          { name: { contains: schoolName, mode: 'insensitive' } },
        ],
      },
    });

    if (!school) {
      this.logger.warn(`School not found: ${schoolName}`);
      return 0;
    }

    // 变化检测
    const essaysWithChanges = await this.detectChanges(
      school.id,
      year,
      essays as ScrapedEssay[],
    );

    let savedCount = 0;

    for (let i = 0; i < essaysWithChanges.length; i++) {
      const essay = essaysWithChanges[i];

      try {
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

        // 去重检查
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
            changeType: essay.changeType,
            previousYearPromptId: essay.previousPromptId,
            sources: {
              create: scrapeResults.map((r) => ({
                sourceType: this.getSourceType(r.sourceUrl),
                sourceUrl: r.sourceUrl,
                rawContent: (r.rawContent || '').substring(0, 5000),
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

  // ============ Configuration ============

  /**
   * 从 DB 获取所有配置了采集源的学校
   */
  async getConfiguredSchools(): Promise<string[]> {
    const schools = await this.prisma.schoolEssaySource.findMany({
      where: { isActive: true },
      select: { school: { select: { name: true } } },
      distinct: ['schoolId'],
    });

    const dbSchools = schools.map((s) => s.school.name);

    // 合并旧策略中硬编码的学校（兼容）
    const officialSchools = this.officialStrategy.getConfiguredSchools();
    const cvSchools = this.collegevineStrategy.getConfiguredSchools();

    return [...new Set([...dbSchools, ...officialSchools, ...cvSchools])];
  }

  // ============ Utilities ============

  private mapEssayType(type?: string): EssayType {
    switch (type?.toUpperCase()) {
      case 'WHY_US':
      case 'WHY_SCHOOL':
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

  private getSourceType(url: string): string {
    if (url.includes('collegevine')) return SourceType.COLLEGEVINE;
    if (url.includes('prepscholar')) return SourceType.PREPSCHOLAR;
    if (url.includes('commonapp')) return SourceType.COMMON_APP;
    return SourceType.OFFICIAL;
  }

  private getCurrentApplicationYear(): number {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  }

  private textSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;

    // Jaccard similarity on word sets
    const wordsA = new Set(a.split(/\s+/).filter(Boolean));
    const wordsB = new Set(b.split(/\s+/).filter(Boolean));
    const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
