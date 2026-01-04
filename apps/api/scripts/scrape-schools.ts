/**
 * 学校官网数据爬虫脚本
 * 
 * 用法: npx ts-node scripts/scrape-schools.ts [school_name]
 * 
 * 示例:
 * - npx ts-node scripts/scrape-schools.ts          # 爬取所有配置学校
 * - npx ts-node scripts/scrape-schools.ts Stanford # 只爬取 Stanford
 */

import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// 学校 URL 配置
const SCHOOL_URLS: Record<string, SchoolUrls> = {
  'Stanford University': {
    deadlines: 'https://admission.stanford.edu/apply/deadlines.html',
    essays: 'https://admission.stanford.edu/apply/freshman/essays.html',
  },
  'Harvard University': {
    deadlines: 'https://college.harvard.edu/admissions/apply/application-requirements',
  },
  'Massachusetts Institute of Technology': {
    deadlines: 'https://mitadmissions.org/apply/firstyear/deadlines-requirements/',
    essays: 'https://mitadmissions.org/apply/firstyear/essays-activities-academics/',
  },
  'Yale University': {
    deadlines: 'https://admissions.yale.edu/dates-deadlines',
    essays: 'https://admissions.yale.edu/essay',
  },
  'Princeton University': {
    deadlines: 'https://admission.princeton.edu/apply/deadlines',
  },
};

interface SchoolUrls {
  deadlines?: string;
  essays?: string;
}

interface ScrapedData {
  deadlines: Record<string, string>;
  essays: string[];
  requirements: Record<string, unknown>;
}

async function fetchPage(url: string): Promise<string> {
  console.log(`  📥 获取: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function parseDeadlines(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const text = $('body').text();
  const deadlines: Record<string, string> = {};

  // 常见日期模式
  const patterns = [
    { key: 'rea', pattern: /restrictive\s*early\s*action[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i },
    { key: 'ea', pattern: /early\s*action[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i },
    { key: 'ed', pattern: /early\s*decision[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i },
    { key: 'rd', pattern: /regular\s*decision[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i },
    { key: 'rd', pattern: /regular\s*deadline[:\s]*([A-Za-z]+\.?\s*\d{1,2})/i },
  ];

  for (const { key, pattern } of patterns) {
    const match = text.match(pattern);
    if (match && !deadlines[key]) {
      deadlines[key] = match[1].trim();
    }
  }

  // 如果没找到，尝试表格解析
  $('table tr, .deadline, [class*="date"]').each((_, elem) => {
    const rowText = $(elem).text().toLowerCase();
    
    if (rowText.includes('november') || rowText.includes('january')) {
      if (rowText.includes('early') && !deadlines.ea && !deadlines.ed) {
        const dateMatch = rowText.match(/(november|january)\s*\d{1,2}/i);
        if (dateMatch) {
          if (rowText.includes('decision')) {
            deadlines.ed = dateMatch[0];
          } else {
            deadlines.ea = dateMatch[0];
          }
        }
      }
      if (rowText.includes('regular') && !deadlines.rd) {
        const dateMatch = rowText.match(/(january|february)\s*\d{1,2}/i);
        if (dateMatch) {
          deadlines.rd = dateMatch[0];
        }
      }
    }
  });

  return deadlines;
}

function parseEssays(html: string): string[] {
  const $ = cheerio.load(html);
  const essays: string[] = [];

  // 查找可能包含文书题目的元素
  const selectors = [
    'li',
    'p',
    '.essay-prompt',
    '[class*="prompt"]',
    'article p',
  ];

  const seen = new Set<string>();

  for (const selector of selectors) {
    $(selector).each((_, elem) => {
      const text = $(elem).text().trim();
      
      // 文书题目通常是问句或以动词开头的指令
      const isPrompt = 
        (text.length > 30 && text.length < 500) &&
        (
          text.includes('?') ||
          /^(tell|describe|reflect|share|explain|discuss|what|why|how)/i.test(text)
        ) &&
        !text.includes('click') &&
        !text.includes('visit') &&
        !seen.has(text);

      if (isPrompt) {
        seen.add(text);
        essays.push(text);
      }
    });
  }

  return essays.slice(0, 5);
}

async function scrapeSchool(schoolName: string, urls: SchoolUrls): Promise<ScrapedData> {
  const data: ScrapedData = {
    deadlines: {},
    essays: [],
    requirements: {},
  };

  // 爬取截止日期
  if (urls.deadlines) {
    try {
      const html = await fetchPage(urls.deadlines);
      data.deadlines = parseDeadlines(html);
      console.log(`  📅 截止日期:`, data.deadlines);
    } catch (e: any) {
      console.log(`  ⚠️ 截止日期获取失败: ${e.message}`);
    }
    await delay(2000);
  }

  // 爬取文书题目
  if (urls.essays) {
    try {
      const html = await fetchPage(urls.essays);
      data.essays = parseEssays(html);
      console.log(`  📝 文书题目: ${data.essays.length} 个`);
    } catch (e: any) {
      console.log(`  ⚠️ 文书题目获取失败: ${e.message}`);
    }
    await delay(2000);
  }

  return data;
}

async function saveToDatabase(schoolName: string, data: ScrapedData) {
  const school = await prisma.school.findFirst({
    where: { name: schoolName },
  });

  if (!school) {
    console.log(`  ⚠️ 数据库中未找到: ${schoolName}`);
    return;
  }

  const currentMetadata = (school.metadata as Record<string, unknown>) || {};

  await prisma.school.update({
    where: { id: school.id },
    data: {
      metadata: {
        ...currentMetadata,
        scrapedDeadlines: data.deadlines,
        scrapedEssays: data.essays,
        lastScraped: new Date().toISOString(),
      },
    },
  });

  console.log(`  💾 已保存到数据库`);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const targetSchool = process.argv[2];
  
  console.log('🚀 学校官网数据爬虫\n');
  console.log('=' .repeat(50));

  const schools = targetSchool 
    ? { [targetSchool]: SCHOOL_URLS[targetSchool] }
    : SCHOOL_URLS;

  if (targetSchool && !SCHOOL_URLS[targetSchool]) {
    console.log(`❌ 未找到学校配置: ${targetSchool}`);
    console.log(`\n可用学校: ${Object.keys(SCHOOL_URLS).join(', ')}`);
    return;
  }

  let success = 0;
  let failed = 0;

  for (const [schoolName, urls] of Object.entries(schools)) {
    if (!urls) continue;
    
    console.log(`\n📚 ${schoolName}`);
    
    try {
      const data = await scrapeSchool(schoolName, urls);
      await saveToDatabase(schoolName, data);
      success++;
    } catch (e: any) {
      console.log(`  ❌ 失败: ${e.message}`);
      failed++;
    }

    await delay(3000); // 学校之间等待 3 秒
  }

  console.log('\n' + '=' .repeat(50));
  console.log(`✅ 完成: ${success} 成功, ${failed} 失败`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());




