/**
 * 增强版学校爬虫 - 使用 Puppeteer 处理 JavaScript 渲染
 *
 * 用法: npx ts-node scripts/scrape-schools-puppeteer.ts
 */

import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// 学校配置 (包含备用数据)
const SCHOOLS_CONFIG: SchoolConfig[] = [
  {
    name: 'Stanford University',
    urls: {
      deadlines: 'https://admission.stanford.edu/apply/deadlines.html',
      essays: 'https://admission.stanford.edu/apply/freshman/essays.html',
    },
    // 备用数据 (如果爬取失败则使用)
    fallback: {
      deadlines: { rea: 'November 1', rd: 'January 2' },
      essayCount: 3,
    },
  },
  {
    name: 'Harvard University',
    urls: {
      deadlines:
        'https://college.harvard.edu/admissions/apply/application-requirements',
    },
    fallback: {
      deadlines: { rea: 'November 1', rd: 'January 1' },
      essayCount: 5,
    },
  },
  {
    name: 'Massachusetts Institute of Technology',
    urls: {
      deadlines:
        'https://mitadmissions.org/apply/firstyear/deadlines-requirements/',
      essays:
        'https://mitadmissions.org/apply/firstyear/essays-activities-academics/',
    },
    fallback: {
      deadlines: { ea: 'November 1', rd: 'January 4' },
      essayCount: 5,
    },
  },
  {
    name: 'Yale University',
    urls: {
      deadlines: 'https://admissions.yale.edu/dates-deadlines',
      essays: 'https://admissions.yale.edu/essay',
    },
    fallback: {
      deadlines: { rea: 'November 1', rd: 'January 2' },
      essayCount: 3,
    },
  },
  {
    name: 'Princeton University',
    urls: {
      deadlines: 'https://admission.princeton.edu/apply/deadlines',
    },
    fallback: {
      deadlines: { rea: 'November 1', rd: 'January 1' },
      essayCount: 4,
    },
  },
  {
    name: 'Columbia University',
    urls: {
      deadlines: 'https://undergrad.admissions.columbia.edu/apply/first-year',
    },
    fallback: {
      deadlines: { ed: 'November 1', rd: 'January 1' },
      essayCount: 4,
    },
  },
  {
    name: 'University of Pennsylvania',
    urls: {
      deadlines:
        'https://admissions.upenn.edu/admissions-and-financial-aid/preparing-for-admission/deadlines',
    },
    fallback: {
      deadlines: { ed: 'November 1', rd: 'January 5' },
      essayCount: 2,
    },
  },
  {
    name: 'Duke University',
    urls: {
      deadlines: 'https://admissions.duke.edu/apply/dates-deadlines/',
    },
    fallback: {
      deadlines: { ed: 'November 1', rd: 'January 3' },
      essayCount: 2,
    },
  },
  {
    name: 'California Institute of Technology',
    urls: {
      deadlines:
        'https://www.admissions.caltech.edu/apply/first-year-freshman-applicants',
    },
    fallback: {
      deadlines: { rea: 'November 1', rd: 'January 3' },
      essayCount: 4,
    },
  },
  {
    name: 'Northwestern University',
    urls: {
      deadlines:
        'https://admissions.northwestern.edu/apply/application-process.html',
    },
    fallback: {
      deadlines: { ed: 'November 1', rd: 'January 3' },
      essayCount: 1,
    },
  },
];

interface SchoolConfig {
  name: string;
  urls: { deadlines?: string; essays?: string };
  fallback: {
    deadlines: Record<string, string>;
    essayCount: number;
  };
}

interface ScrapedData {
  deadlines: Record<string, string>;
  essays: string[];
}

async function scrapeWithPuppeteer(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    );

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // 等待页面完全加载
    await page.waitForSelector('body', { timeout: 10000 });

    // 滚动页面触发懒加载
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await new Promise((r) => setTimeout(r, 2000));

    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

function parseDeadlines(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const deadlines: Record<string, string> = {};

  // 更全面的日期模式
  const patterns = [
    {
      key: 'rea',
      patterns: [
        /restrictive\s*early\s*action[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
        /REA[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
      ],
    },
    {
      key: 'ea',
      patterns: [
        /early\s*action[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
        /EA[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
      ],
    },
    {
      key: 'ed',
      patterns: [
        /early\s*decision\s*(?:I\s*)?[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
        /ED\s*(?:I\s*)?[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
      ],
    },
    {
      key: 'ed2',
      patterns: [
        /early\s*decision\s*II[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
        /ED\s*II[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
      ],
    },
    {
      key: 'rd',
      patterns: [
        /regular\s*decision[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
        /RD[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
        /regular\s*deadline[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i,
      ],
    },
  ];

  for (const { key, patterns: patternList } of patterns) {
    for (const pattern of patternList) {
      const match = text.match(pattern);
      if (match && !deadlines[key]) {
        deadlines[key] = match[1].trim();
        break;
      }
    }
  }

  // 尝试从表格/列表中提取
  $('table tr, li, dt, dd').each((_, elem) => {
    const elemText = $(elem).text().toLowerCase();

    // 查找包含日期的行
    const dateMatch = elemText.match(
      /(november|january|february|december)\s*\d{1,2}/i,
    );
    if (!dateMatch) return;

    const date = dateMatch[0];

    if (elemText.includes('early decision') && !deadlines.ed) {
      deadlines.ed = date;
    } else if (elemText.includes('early action') && !deadlines.ea) {
      deadlines.ea = date;
    } else if (elemText.includes('restrictive') && !deadlines.rea) {
      deadlines.rea = date;
    } else if (elemText.includes('regular') && !deadlines.rd) {
      deadlines.rd = date;
    }
  });

  return deadlines;
}

function parseEssays(html: string): string[] {
  const $ = cheerio.load(html);
  const essays: string[] = [];
  const seen = new Set<string>();

  // 更多选择器
  const selectors = [
    'li',
    'p',
    '.essay',
    '[class*="prompt"]',
    '[class*="essay"]',
    'article li',
    'main li',
    'ol li',
  ];

  for (const selector of selectors) {
    $(selector).each((_, elem) => {
      let text = $(elem).text().trim();

      // 清理文本
      text = text.replace(/\s+/g, ' ').trim();

      // 判断是否是文书题目
      const isPrompt =
        text.length > 40 &&
        text.length < 600 &&
        (text.includes('?') ||
          /^(tell|describe|reflect|share|explain|discuss|what|why|how|we)/i.test(
            text,
          )) &&
        !/click|visit|learn more|read more|download/i.test(text) &&
        !seen.has(text);

      if (isPrompt) {
        seen.add(text);
        essays.push(text);
      }
    });
  }

  return essays.slice(0, 6);
}

async function scrapeSchool(config: SchoolConfig): Promise<ScrapedData> {
  const data: ScrapedData = {
    deadlines: {},
    essays: [],
  };

  // 爬取截止日期
  if (config.urls.deadlines) {
    try {
      console.log(`  📥 截止日期: ${config.urls.deadlines}`);
      const html = await scrapeWithPuppeteer(config.urls.deadlines);
      data.deadlines = parseDeadlines(html);

      if (Object.keys(data.deadlines).length === 0) {
        console.log(`  ⚠️ 使用备用截止日期`);
        data.deadlines = config.fallback.deadlines;
      }
    } catch (e: any) {
      console.log(`  ⚠️ 爬取失败，使用备用数据: ${e.message}`);
      data.deadlines = config.fallback.deadlines;
    }
  } else {
    data.deadlines = config.fallback.deadlines;
  }

  console.log(`  📅 截止日期:`, data.deadlines);

  // 爬取文书题目
  if (config.urls.essays) {
    try {
      console.log(`  📥 文书题目: ${config.urls.essays}`);
      await new Promise((r) => setTimeout(r, 2000));
      const html = await scrapeWithPuppeteer(config.urls.essays);
      data.essays = parseEssays(html);
    } catch (e: any) {
      console.log(`  ⚠️ 文书爬取失败: ${e.message}`);
    }
  }

  console.log(`  📝 文书题目: ${data.essays.length} 个`);

  return data;
}

async function saveToDatabase(name: string, data: ScrapedData) {
  const school = await prisma.school.findFirst({
    where: { name },
  });

  if (!school) {
    console.log(`  ⚠️ 数据库未找到: ${name}`);
    return;
  }

  const meta = (school.metadata as Record<string, unknown>) || {};

  await prisma.school.update({
    where: { id: school.id },
    data: {
      metadata: {
        ...meta,
        deadlines: data.deadlines,
        essayPrompts: data.essays.map((prompt, i) => ({
          id: i + 1,
          prompt,
          year: new Date().getFullYear(),
        })),
        lastScraped: new Date().toISOString(),
      },
    },
  });

  console.log(`  💾 已保存`);
}

async function main() {
  console.log('🚀 学校数据爬虫 (Puppeteer 版)\n');
  console.log('='.repeat(60));

  let success = 0;
  let failed = 0;

  for (const config of SCHOOLS_CONFIG) {
    console.log(`\n📚 ${config.name}`);

    try {
      const data = await scrapeSchool(config);
      await saveToDatabase(config.name, data);
      success++;
    } catch (e: any) {
      console.log(`  ❌ 失败: ${e.message}`);
      failed++;

      // 即使失败也保存备用数据
      try {
        await saveToDatabase(config.name, {
          deadlines: config.fallback.deadlines,
          essays: [],
        });
        console.log(`  💾 已保存备用数据`);
      } catch {}
    }

    // 学校之间等待
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ 完成: ${success} 成功, ${failed} 失败`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
