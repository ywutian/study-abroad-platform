/**
 * 一亩三分地录取汇报爬虫
 *
 * 目标版块：
 * - 本科申请 https://www.1point3acres.com/bbs/forum-82-1.html
 * - 研究生录取 https://www.1point3acres.com/bbs/forum-27-1.html
 *
 * 注意：需要登录后的 Cookie
 *
 * 使用方法：
 * 1. 在浏览器登录一亩三分地
 * 2. 复制 Cookie 到 .env 的 ACRES_COOKIE
 * 3. 运行 npx ts-node scripts/scrape-1point3acres.ts
 */

import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// 从环境变量获取 Cookie
const COOKIE = process.env.ACRES_COOKIE || '';

interface RawCase {
  school: string;
  program: string;
  degree: string; // MS/PhD/BS
  result: 'AD' | 'REJ' | 'WL' | 'Offer';
  gpa: string;
  toefl?: string;
  gre?: string;
  background?: string;
  year: number;
  url: string;
}

// 解析录取汇报帖子
function parsePost(html: string, url: string): RawCase | null {
  const $ = cheerio.load(html);

  // 一亩三分地录取汇报有固定格式
  const content = $('.t_f').first().text();

  // 提取关键信息
  const schoolMatch = content.match(/学校[：:]\s*(.+?)[\n,]/);
  const programMatch = content.match(/项目[：:]\s*(.+?)[\n,]/);
  const resultMatch = content.match(/(AD|Offer|REJ|WL|Reject|Waitlist)/i);
  const gpaMatch = content.match(/GPA[：:\s]*([0-9.]+)/i);
  const toeflMatch =
    content.match(/TOEFL[：:\s]*(\d+)/i) || content.match(/托福[：:\s]*(\d+)/i);
  const greMatch = content.match(/GRE[：:\s]*(\d+)/i);

  if (!schoolMatch || !resultMatch) return null;

  const resultMap: Record<string, 'AD' | 'REJ' | 'WL' | 'Offer'> = {
    ad: 'AD',
    offer: 'Offer',
    rej: 'REJ',
    reject: 'REJ',
    wl: 'WL',
    waitlist: 'WL',
  };

  return {
    school: schoolMatch[1].trim(),
    program: programMatch?.[1]?.trim() || 'Unknown',
    degree: content.includes('PhD')
      ? 'PhD'
      : content.includes('本科')
        ? 'BS'
        : 'MS',
    result: resultMap[resultMatch[1].toLowerCase()] || 'AD',
    gpa: gpaMatch?.[1] || '',
    toefl: toeflMatch?.[1],
    gre: greMatch?.[1],
    year: new Date().getFullYear(),
    url,
  };
}

// 映射结果到数据库枚举
function mapResult(result: string): 'ADMITTED' | 'REJECTED' | 'WAITLISTED' {
  switch (result) {
    case 'AD':
    case 'Offer':
      return 'ADMITTED';
    case 'REJ':
      return 'REJECTED';
    case 'WL':
      return 'WAITLISTED';
    default:
      return 'ADMITTED';
  }
}

async function fetchWithCookie(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Cookie: COOKIE,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });
  return res.text();
}

async function scrapeForumPage(
  forumUrl: string,
  page: number,
): Promise<string[]> {
  const url = forumUrl.replace('-1.html', `-${page}.html`);
  const html = await fetchWithCookie(url);
  const $ = cheerio.load(html);

  // 提取帖子链接
  const links: string[] = [];
  $('a.s.xst').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      links.push(
        href.startsWith('http')
          ? href
          : `https://www.1point3acres.com/bbs/${href}`,
      );
    }
  });

  return links;
}

async function main() {
  if (!COOKIE) {
    console.log(`
⚠️  需要设置 ACRES_COOKIE 环境变量

操作步骤：
1. 浏览器登录 https://www.1point3acres.com
2. 打开开发者工具 → Network → 刷新页面
3. 点击任意请求 → Headers → Cookie
4. 复制整个 Cookie 值
5. 设置环境变量：export ACRES_COOKIE="你的cookie"
6. 重新运行此脚本

或者在 .env 文件中添加：
ACRES_COOKIE=你的cookie值
    `);

    console.log('\n--- 备选方案：手动导入 ---');
    console.log('你也可以手动整理数据到 CSV，然后导入：');
    console.log('格式：school,program,result,gpa,toefl,gre,year');
    return;
  }

  console.log('🚀 开始爬取一亩三分地录取汇报...\n');

  // 本科申请版块
  const undergradForum = 'https://www.1point3acres.com/bbs/forum-82-1.html';
  // 研究生录取版块
  const gradForum = 'https://www.1point3acres.com/bbs/forum-27-1.html';

  const allCases: RawCase[] = [];

  // 爬取前5页
  for (let page = 1; page <= 5; page++) {
    console.log(`📄 爬取第 ${page} 页...`);

    const links = await scrapeForumPage(undergradForum, page);
    console.log(`  找到 ${links.length} 个帖子`);

    for (const link of links.slice(0, 10)) {
      // 每页处理10个
      await new Promise((r) => setTimeout(r, 1000)); // 限速

      try {
        const html = await fetchWithCookie(link);
        const parsed = parsePost(html, link);
        if (parsed) {
          allCases.push(parsed);
          console.log(`  ✅ ${parsed.school} - ${parsed.result}`);
        }
      } catch (e) {
        console.log(`  ❌ 解析失败: ${link}`);
      }
    }
  }

  console.log(`\n📊 共解析 ${allCases.length} 条案例`);

  // 保存到数据库
  // ... 实现数据库写入逻辑
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
