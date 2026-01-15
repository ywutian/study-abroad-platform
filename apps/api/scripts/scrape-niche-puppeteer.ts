/**
 * Niche.com Grade Scraper - Puppeteer Stealth 版本
 *
 * 使用 Puppeteer + Stealth 插件模拟真实浏览器访问
 *
 * 用法:
 *   npx ts-node scripts/scrape-niche-puppeteer.ts --limit=20
 *   npx ts-node scripts/scrape-niche-puppeteer.ts --school="Harvard University"
 */

import { PrismaClient } from '@prisma/client';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

// 启用 Stealth 插件
puppeteer.use(StealthPlugin());

const prisma = new PrismaClient();

interface NicheGrades {
  nicheSafetyGrade: string | null;
  nicheLifeGrade: string | null;
  nicheFoodGrade: string | null;
  nicheOverallGrade: string | null;
}

// 转换学校名称为 Niche URL slug
function schoolNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// 解析评分字母
function parseGrade(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.trim().match(/^([ABCDF][+-]?)$/);
  return match ? match[1] : null;
}

// 随机延迟 (模拟人类行为)
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// 使用 Puppeteer 爬取 Niche 页面
async function scrapeNicheWithPuppeteer(
  browser: Browser,
  schoolName: string,
): Promise<NicheGrades | null> {
  const slug = schoolNameToSlug(schoolName);
  const url = `https://www.niche.com/colleges/${slug}/`;

  console.log(`  📥 Fetching: ${url}`);

  let page: Page | null = null;

  try {
    page = await browser.newPage();

    // 设置更真实的浏览器指纹
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 });

    // 设置额外的 HTTP 头
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // 访问页面
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    if (!response || response.status() === 404) {
      console.log(`  ⚠️ School not found on Niche: ${schoolName}`);
      return null;
    }

    if (response.status() === 403) {
      console.log(`  ⚠️ Access denied (403)`);
      return null;
    }

    // 等待页面加载
    await randomDelay(1000, 2000);

    // 滚动页面触发懒加载
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await randomDelay(500, 1000);

    // 提取评分数据
    const grades = await page.evaluate(() => {
      const result: NicheGrades = {
        nicheSafetyGrade: null,
        nicheLifeGrade: null,
        nicheFoodGrade: null,
        nicheOverallGrade: null,
      };

      // 方法1: 查找评分卡片
      const gradeCards = document.querySelectorAll(
        '[class*="grade"], [class*="Grade"], [data-testid*="grade"]',
      );

      gradeCards.forEach((card) => {
        const text = card.textContent?.toLowerCase() || '';
        const gradeMatch = text.match(/([ABCDF][+-]?)/);
        const grade = gradeMatch ? gradeMatch[1] : null;

        if (grade) {
          if (
            (text.includes('safety') || text.includes('crime')) &&
            !result.nicheSafetyGrade
          ) {
            result.nicheSafetyGrade = grade;
          } else if (
            (text.includes('campus') ||
              text.includes('student life') ||
              text.includes('party')) &&
            !result.nicheLifeGrade
          ) {
            result.nicheLifeGrade = grade;
          } else if (
            (text.includes('food') || text.includes('dining')) &&
            !result.nicheFoodGrade
          ) {
            result.nicheFoodGrade = grade;
          } else if (
            text.includes('overall') &&
            !text.includes('academics') &&
            !result.nicheOverallGrade
          ) {
            result.nicheOverallGrade = grade;
          }
        }
      });

      // 方法2: 从页面文本提取
      const bodyText = document.body.innerText;

      const safetyMatch = bodyText.match(/Safety[:\s]*([ABCDF][+-]?)/i);
      const lifeMatch = bodyText.match(
        /(?:Campus Life|Student Life|Party Scene)[:\s]*([ABCDF][+-]?)/i,
      );
      const foodMatch = bodyText.match(/(?:Food|Dining)[:\s]*([ABCDF][+-]?)/i);
      const overallMatch = bodyText.match(
        /Overall Niche Grade[:\s]*([ABCDF][+-]?)/i,
      );

      if (safetyMatch && !result.nicheSafetyGrade)
        result.nicheSafetyGrade = safetyMatch[1];
      if (lifeMatch && !result.nicheLifeGrade)
        result.nicheLifeGrade = lifeMatch[1];
      if (foodMatch && !result.nicheFoodGrade)
        result.nicheFoodGrade = foodMatch[1];
      if (overallMatch && !result.nicheOverallGrade)
        result.nicheOverallGrade = overallMatch[1];

      return result;
    });

    return grades;
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  } finally {
    if (page) {
      await page.close();
    }
  }
}

// 更新数据库
async function updateSchoolGrades(
  schoolId: string,
  grades: NicheGrades,
): Promise<boolean> {
  const updateData: Record<string, string | null> = {};

  if (grades.nicheSafetyGrade)
    updateData.nicheSafetyGrade = grades.nicheSafetyGrade;
  if (grades.nicheLifeGrade) updateData.nicheLifeGrade = grades.nicheLifeGrade;
  if (grades.nicheFoodGrade) updateData.nicheFoodGrade = grades.nicheFoodGrade;
  if (grades.nicheOverallGrade)
    updateData.nicheOverallGrade = grades.nicheOverallGrade;

  if (Object.keys(updateData).length > 0) {
    await prisma.school.update({
      where: { id: schoolId },
      data: updateData,
    });
    console.log(`  ✅ Updated:`, updateData);
    return true;
  } else {
    console.log(`  ⚠️ No grades found to update`);
    return false;
  }
}

// 主函数
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 解析参数
  let limit = 20;
  let schoolFilter: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--school=')) {
      schoolFilter = arg.split('=')[1].replace(/"/g, '');
    }
  }

  console.log('🎓 Niche Grade Scraper (Puppeteer 版本)');
  console.log('='.repeat(60));
  console.log(`📊 Limit: ${limit} schools`);
  if (schoolFilter) console.log(`🔍 Filter: ${schoolFilter}`);
  console.log('');

  // 启动浏览器
  console.log('🚀 启动浏览器...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });

  try {
    // 获取学校列表
    const whereClause: Record<string, unknown> = {};

    if (schoolFilter) {
      whereClause.name = { contains: schoolFilter, mode: 'insensitive' };
    }

    // 优先处理没有 Niche 评分的学校
    const schools = await prisma.school.findMany({
      where: {
        ...whereClause,
        OR: [
          { nicheSafetyGrade: null },
          { nicheLifeGrade: null },
          { nicheFoodGrade: null },
        ],
      },
      orderBy: { usNewsRank: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        usNewsRank: true,
        nicheSafetyGrade: true,
        nicheLifeGrade: true,
        nicheFoodGrade: true,
      },
    });

    console.log(`📋 Found ${schools.length} schools to process\n`);

    let updated = 0;
    let failed = 0;

    for (const school of schools) {
      console.log(`\n🏫 ${school.name} (Rank: ${school.usNewsRank || 'N/A'})`);

      const grades = await scrapeNicheWithPuppeteer(browser, school.name);

      if (
        grades &&
        (grades.nicheSafetyGrade ||
          grades.nicheLifeGrade ||
          grades.nicheFoodGrade)
      ) {
        const success = await updateSchoolGrades(school.id, grades);
        if (success) {
          updated++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }

      // 随机延迟避免被检测
      await randomDelay(3000, 6000);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📋 Total: ${schools.length}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

// 运行
main().catch(console.error);
