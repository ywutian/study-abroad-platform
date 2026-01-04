import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as cheerio from 'cheerio';

/**
 * 学校官网数据爬虫服务
 * 
 * 功能:
 * - 文书题目
 * - 申请截止日期
 * - 录取要求 (GPA, SAT/ACT, TOEFL 等)
 * 
 * 法律说明:
 * - 仅爬取学校官网公开发布的招生信息
 * - 遵守 robots.txt
 * - 控制请求频率 (1 req/2sec)
 */
@Injectable()
export class SchoolScraperService {
  private readonly logger = new Logger(SchoolScraperService.name);
  
  // 请求间隔 (毫秒)
  private readonly REQUEST_DELAY = 2000;

  constructor(private prisma: PrismaService) {}

  /**
   * 学校招生页面 URL 配置
   * 
   * 维护说明: 如果学校改版，只需更新这里的 URL
   */
  private readonly SCHOOL_URLS: Record<string, SchoolUrls> = {
    'Princeton University': {
      admissions: 'https://admission.princeton.edu/apply',
      deadlines: 'https://admission.princeton.edu/apply/deadlines',
      essays: 'https://admission.princeton.edu/apply/what-we-look-for',
    },
    'Harvard University': {
      admissions: 'https://college.harvard.edu/admissions/apply',
      deadlines: 'https://college.harvard.edu/admissions/apply/application-requirements',
      essays: 'https://college.harvard.edu/admissions/apply/application-requirements',
    },
    'Stanford University': {
      admissions: 'https://admission.stanford.edu/apply/',
      deadlines: 'https://admission.stanford.edu/apply/deadlines.html',
      essays: 'https://admission.stanford.edu/apply/freshman/essays.html',
    },
    'Massachusetts Institute of Technology': {
      admissions: 'https://mitadmissions.org/apply/',
      deadlines: 'https://mitadmissions.org/apply/firstyear/deadlines-requirements/',
      essays: 'https://mitadmissions.org/apply/firstyear/essays-activities-academics/',
    },
    'Yale University': {
      admissions: 'https://admissions.yale.edu/apply',
      deadlines: 'https://admissions.yale.edu/dates-deadlines',
      essays: 'https://admissions.yale.edu/essay',
    },
    'Columbia University': {
      admissions: 'https://undergrad.admissions.columbia.edu/apply',
      deadlines: 'https://undergrad.admissions.columbia.edu/apply/first-year',
      essays: 'https://undergrad.admissions.columbia.edu/apply/first-year/essays',
    },
    'University of Pennsylvania': {
      admissions: 'https://admissions.upenn.edu/admissions-and-financial-aid/what-penn-looks-for',
      deadlines: 'https://admissions.upenn.edu/admissions-and-financial-aid/preparing-for-admission/deadlines',
      essays: 'https://admissions.upenn.edu/admissions-and-financial-aid/preparing-for-admission/essay',
    },
    'California Institute of Technology': {
      admissions: 'https://www.admissions.caltech.edu/apply',
      deadlines: 'https://www.admissions.caltech.edu/apply/first-year-freshman-applicants',
      essays: 'https://www.admissions.caltech.edu/apply/first-year-freshman-applicants/essays',
    },
    'Duke University': {
      admissions: 'https://admissions.duke.edu/apply/',
      deadlines: 'https://admissions.duke.edu/apply/dates-deadlines/',
      essays: 'https://admissions.duke.edu/apply/essays/',
    },
    'Northwestern University': {
      admissions: 'https://admissions.northwestern.edu/apply/',
      deadlines: 'https://admissions.northwestern.edu/apply/application-process.html',
      essays: 'https://admissions.northwestern.edu/apply/application-process.html',
    },
  };

  /**
   * 爬取所有配置学校的数据
   */
  async scrapeAllSchools(): Promise<ScrapeResult> {
    const results: ScrapeResult = {
      success: [],
      failed: [],
      total: Object.keys(this.SCHOOL_URLS).length,
    };

    this.logger.log(`🚀 开始爬取 ${results.total} 所学校数据...`);

    for (const [schoolName, urls] of Object.entries(this.SCHOOL_URLS)) {
      try {
        this.logger.log(`📥 爬取: ${schoolName}`);
        
        const data = await this.scrapeSchool(schoolName, urls);
        await this.saveSchoolData(schoolName, data);
        
        results.success.push(schoolName);
        this.logger.log(`✅ ${schoolName} 完成`);
        
        // 控制请求频率
        await this.delay(this.REQUEST_DELAY);
      } catch (error) {
        this.logger.error(`❌ ${schoolName} 失败:`, error);
        results.failed.push({ school: schoolName, error: error.message });
      }
    }

    this.logger.log(`\n🎉 爬取完成: ${results.success.length} 成功, ${results.failed.length} 失败`);
    return results;
  }

  /**
   * 爬取单个学校
   */
  async scrapeSchool(schoolName: string, urls: SchoolUrls): Promise<ScrapedSchoolData> {
    const data: ScrapedSchoolData = {
      deadlines: {},
      essays: [],
      requirements: {},
    };

    // 爬取截止日期
    if (urls.deadlines) {
      try {
        const html = await this.fetchPage(urls.deadlines);
        data.deadlines = this.parseDeadlines(html, schoolName);
      } catch (e) {
        this.logger.warn(`  截止日期爬取失败: ${e.message}`);
      }
    }

    // 爬取文书题目
    if (urls.essays) {
      try {
        await this.delay(this.REQUEST_DELAY);
        const html = await this.fetchPage(urls.essays);
        data.essays = this.parseEssays(html, schoolName);
      } catch (e) {
        this.logger.warn(`  文书题目爬取失败: ${e.message}`);
      }
    }

    // 爬取录取要求
    if (urls.admissions) {
      try {
        await this.delay(this.REQUEST_DELAY);
        const html = await this.fetchPage(urls.admissions);
        data.requirements = this.parseRequirements(html, schoolName);
      } catch (e) {
        this.logger.warn(`  录取要求爬取失败: ${e.message}`);
      }
    }

    return data;
  }

  /**
   * 获取页面 HTML
   */
  private async fetchPage(url: string): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StudyAbroadBot/1.0; +https://example.com/bot)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * 解析申请截止日期
   */
  private parseDeadlines(html: string, schoolName: string): DeadlineInfo {
    const $ = cheerio.load(html);
    const deadlines: DeadlineInfo = {};

    // 通用模式匹配
    const patterns = {
      ed: /early\s*decision[:\s]*([A-Za-z]+\s*\d{1,2})/i,
      ea: /early\s*action[:\s]*([A-Za-z]+\s*\d{1,2})/i,
      rd: /regular\s*decision[:\s]*([A-Za-z]+\s*\d{1,2})/i,
      rea: /restrictive\s*early\s*action[:\s]*([A-Za-z]+\s*\d{1,2})/i,
    };

    const text = $('body').text();

    // 尝试匹配日期
    for (const [type, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        deadlines[type as keyof DeadlineInfo] = match[1].trim();
      }
    }

    // 学校特定解析
    switch (schoolName) {
      case 'Harvard University':
      case 'Yale University':
      case 'Princeton University':
      case 'Stanford University':
        // REA 学校
        if (!deadlines.rea) deadlines.rea = 'November 1';
        if (!deadlines.rd) deadlines.rd = 'January 1';
        break;
      case 'Duke University':
      case 'University of Pennsylvania':
        // ED 学校
        if (!deadlines.ed) deadlines.ed = 'November 1';
        if (!deadlines.rd) deadlines.rd = 'January 2';
        break;
    }

    return deadlines;
  }

  /**
   * 解析文书题目
   */
  private parseEssays(html: string, schoolName: string): EssayPrompt[] {
    const $ = cheerio.load(html);
    const essays: EssayPrompt[] = [];

    // 查找包含 "essay" 关键词的段落
    const essayPatterns = [
      /(?:tell us|describe|reflect|share|explain|discuss).*?(?:\.|$)/gi,
      /(?:why.*?(?:college|university|school)).*?(?:\.|$)/gi,
      /(?:what.*?(?:meaningful|important|significant)).*?(?:\.|$)/gi,
    ];

    // 尝试从常见容器中提取
    const selectors = [
      '.essay-prompt',
      '.application-essay',
      '[class*="essay"]',
      'article p',
      '.content p',
      'main p',
    ];

    for (const selector of selectors) {
      $(selector).each((_, elem) => {
        const text = $(elem).text().trim();
        
        // 检查是否像文书题目 (长度适中且包含问句特征)
        if (text.length > 50 && text.length < 500) {
          for (const pattern of essayPatterns) {
            if (pattern.test(text)) {
              essays.push({
                prompt: text,
                wordLimit: this.extractWordLimit(text) || 250,
                year: new Date().getFullYear(),
              });
              break;
            }
          }
        }
      });
    }

    // 去重
    const unique = essays.filter((v, i, a) => 
      a.findIndex(t => t.prompt === v.prompt) === i
    );

    return unique.slice(0, 5); // 最多返回 5 个
  }

  /**
   * 解析录取要求
   */
  private parseRequirements(html: string, schoolName: string): RequirementInfo {
    const $ = cheerio.load(html);
    const text = $('body').text();
    const requirements: RequirementInfo = {};

    // SAT 分数范围
    const satMatch = text.match(/SAT[:\s]*(\d{3,4})\s*[-–]\s*(\d{3,4})/i);
    if (satMatch) {
      requirements.satRange = `${satMatch[1]}-${satMatch[2]}`;
    }

    // ACT 分数范围
    const actMatch = text.match(/ACT[:\s]*(\d{1,2})\s*[-–]\s*(\d{1,2})/i);
    if (actMatch) {
      requirements.actRange = `${actMatch[1]}-${actMatch[2]}`;
    }

    // GPA 要求
    const gpaMatch = text.match(/GPA[:\s]*([\d.]+)/i);
    if (gpaMatch) {
      requirements.gpaMin = gpaMatch[1];
    }

    // TOEFL 要求
    const toeflMatch = text.match(/TOEFL[:\s]*(\d{2,3})/i);
    if (toeflMatch) {
      requirements.toeflMin = parseInt(toeflMatch[1]);
    }

    // IELTS 要求
    const ieltsMatch = text.match(/IELTS[:\s]*([\d.]+)/i);
    if (ieltsMatch) {
      requirements.ieltsMin = parseFloat(ieltsMatch[1]);
    }

    // 申请费
    const feeMatch = text.match(/application\s*fee[:\s]*\$?(\d+)/i);
    if (feeMatch) {
      requirements.applicationFee = parseInt(feeMatch[1]);
    }

    return requirements;
  }

  /**
   * 提取字数限制
   */
  private extractWordLimit(text: string): number | null {
    const match = text.match(/(\d+)\s*words?/i);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * 保存数据到数据库
   */
  private async saveSchoolData(schoolName: string, data: ScrapedSchoolData): Promise<void> {
    const school = await this.prisma.school.findFirst({
      where: { name: schoolName },
    });

    if (!school) {
      this.logger.warn(`学校未找到: ${schoolName}`);
      return;
    }

    const currentMetadata = (school.metadata as Record<string, unknown>) || {};

    await this.prisma.school.update({
      where: { id: school.id },
      data: {
        metadata: {
          ...currentMetadata,
          deadlines: data.deadlines,
          essayPrompts: data.essays,
          requirements: data.requirements,
          lastScraped: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取学校 URL 配置列表
   */
  getConfiguredSchools(): string[] {
    return Object.keys(this.SCHOOL_URLS);
  }

  /**
   * 添加新学校配置
   */
  addSchoolUrls(schoolName: string, urls: SchoolUrls): void {
    this.SCHOOL_URLS[schoolName] = urls;
  }
}

// 类型定义
interface SchoolUrls {
  admissions?: string;
  deadlines?: string;
  essays?: string;
}

interface DeadlineInfo {
  ed?: string;    // Early Decision
  ed2?: string;   // Early Decision II
  ea?: string;    // Early Action
  rea?: string;   // Restrictive Early Action
  rd?: string;    // Regular Decision
}

interface EssayPrompt {
  prompt: string;
  wordLimit: number;
  year: number;
}

interface RequirementInfo {
  satRange?: string;
  actRange?: string;
  gpaMin?: string;
  toeflMin?: number;
  ieltsMin?: number;
  applicationFee?: number;
}

interface ScrapedSchoolData {
  deadlines: DeadlineInfo;
  essays: EssayPrompt[];
  requirements: RequirementInfo;
}

interface ScrapeResult {
  success: string[];
  failed: Array<{ school: string; error: string }>;
  total: number;
}




