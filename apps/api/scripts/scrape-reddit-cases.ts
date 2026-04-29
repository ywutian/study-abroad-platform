/**
 * 爬取 Reddit r/collegeresults 录取案例
 *
 * 数据来源: https://www.reddit.com/r/collegeresults/
 * 用户公开分享的录取结果，格式相对规范
 *
 * 使用方法:
 * pnpm exec ts-node --transpile-only scripts/scrape-reddit-cases.ts
 */

import { PrismaClient, AdmissionResult, Visibility } from '@prisma/client';
import { findSchoolByAlias } from '../src/common/constants/school-aliases';

const prisma = new PrismaClient();

// Reddit API 配置
const REDDIT_BASE_URL = 'https://www.reddit.com';
const SUBREDDIT = 'collegeresults';
const USER_AGENT = 'Lumni/1.0 (Educational Research)';

// School name aliases are now centralized in common/constants/school-aliases.ts

interface RedditPost {
  title: string;
  selftext: string;
  created_utc: number;
  author: string;
  permalink: string;
  id: string;
}

interface ParsedCase {
  schoolName: string;
  result: AdmissionResult;
  year: number;
  round?: string;
  major?: string;
  gpaRange?: string;
  satRange?: string;
  actRange?: string;
  toeflRange?: string;
  tags: string[];
}

/**
 * 从 Reddit 获取帖子
 */
async function fetchRedditPosts(
  after?: string,
  limit: number = 100,
  sort: string = 'new',
): Promise<{ posts: RedditPost[]; after: string | null }> {
  const url = new URL(`${REDDIT_BASE_URL}/r/${SUBREDDIT}/${sort}.json`);
  url.searchParams.set('limit', String(limit));
  if (sort === 'top') {
    url.searchParams.set('t', 'all'); // 全部时间
  }
  if (after) {
    url.searchParams.set('after', after);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }

  const data = await response.json();
  const posts = data.data.children.map(
    (child: any) => child.data as RedditPost,
  );
  const nextAfter = data.data.after;

  return { posts, after: nextAfter };
}

/**
 * 解析帖子内容，提取录取信息
 */
function parsePost(post: RedditPost): ParsedCase[] {
  const cases: ParsedCase[] = [];
  const text = post.selftext.toLowerCase();
  const title = post.title.toLowerCase();

  // 提取年份
  const yearMatch =
    title.match(/class of (\d{4})/i) || text.match(/class of (\d{4})/i);
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  // 提取 GPA
  let gpaRange: string | undefined;
  const gpaMatch =
    text.match(/gpa[:\s]*(\d+\.?\d*)\s*[/\\]?\s*(\d+\.?\d*)?/i) ||
    text.match(/(\d+\.?\d*)\s*uw/i);
  if (gpaMatch) {
    gpaRange = gpaMatch[1];
    if (gpaMatch[2]) {
      gpaRange = `${gpaMatch[1]}/${gpaMatch[2]}`;
    }
  }

  // 提取 SAT
  let satRange: string | undefined;
  const satMatch = text.match(/sat[:\s]*(\d{3,4})/i);
  if (
    satMatch &&
    parseInt(satMatch[1]) >= 400 &&
    parseInt(satMatch[1]) <= 1600
  ) {
    satRange = satMatch[1];
  }

  // 提取 ACT
  let actRange: string | undefined;
  const actMatch = text.match(/act[:\s]*(\d{1,2})/i);
  if (actMatch && parseInt(actMatch[1]) >= 1 && parseInt(actMatch[1]) <= 36) {
    actRange = actMatch[1];
  }

  // 提取标签
  const tags: string[] = [];
  if (text.includes('international') || text.includes('intl'))
    tags.push('international');
  if (text.includes('first-gen') || text.includes('first gen'))
    tags.push('first-gen');
  if (text.includes('legacy')) tags.push('legacy');
  if (text.includes('athlete') || text.includes('recruited'))
    tags.push('athlete');
  if (text.includes('research')) tags.push('research');
  if (text.includes('stem')) tags.push('STEM');
  if (text.includes('cs') || text.includes('computer science')) tags.push('CS');
  if (text.includes('business') || text.includes('finance'))
    tags.push('business');
  if (text.includes('engineering')) tags.push('engineering');
  if (text.includes('premed') || text.includes('pre-med')) tags.push('pre-med');

  // 解析录取结果
  // 常见格式: "Acceptances: MIT, Harvard, Stanford" 或 "Accepted: MIT"
  const resultPatterns = [
    {
      pattern: /accept(?:ed|ances?)?[:\s]+([^.!?\n]+)/gi,
      result: AdmissionResult.ADMITTED,
    },
    {
      pattern: /admit(?:ted)?[:\s]+([^.!?\n]+)/gi,
      result: AdmissionResult.ADMITTED,
    },
    {
      pattern: /reject(?:ed|ions?)?[:\s]+([^.!?\n]+)/gi,
      result: AdmissionResult.REJECTED,
    },
    { pattern: /denied[:\s]+([^.!?\n]+)/gi, result: AdmissionResult.REJECTED },
    {
      pattern: /waitlist(?:ed)?[:\s]+([^.!?\n]+)/gi,
      result: AdmissionResult.WAITLISTED,
    },
    {
      pattern: /defer(?:red)?[:\s]+([^.!?\n]+)/gi,
      result: AdmissionResult.DEFERRED,
    },
  ];

  for (const { pattern, result } of resultPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const schoolsText = match[1];

      // 分割多个学校（逗号或 and 分隔）
      const schoolNames = schoolsText.split(/,|and|&/).map((s) => s.trim());

      for (const rawName of schoolNames) {
        // 清理学校名称
        const cleanName = rawName
          .replace(/\(.*?\)/g, '') // 移除括号内容
          .replace(/[^a-zA-Z\s]/g, '') // 只保留字母和空格
          .trim();

        if (cleanName.length < 2) continue;

        // 尝试匹配学校
        const matchedSchool = findSchoolMatch(cleanName);
        if (matchedSchool) {
          // 提取轮次（如果在括号中）
          let round: string | undefined;
          const roundMatch = rawName.match(/\((ea|ed|rd|rea|ed2|ed1)\)/i);
          if (roundMatch) {
            round = roundMatch[1].toUpperCase();
          }

          cases.push({
            schoolName: matchedSchool,
            result,
            year,
            round,
            gpaRange,
            satRange,
            actRange,
            tags,
          });
        }
      }
    }
  }

  return cases;
}

/**
 * 模糊匹配学校名称 — delegates to shared alias map
 */
function findSchoolMatch(rawName: string): string | null {
  return findSchoolByAlias(rawName);
}

/**
 * 保存案例到数据库
 */
async function saveCase(
  parsedCase: ParsedCase,
  sourceUrl: string,
): Promise<boolean> {
  // 查找学校
  const school = await prisma.school.findFirst({
    where: { name: parsedCase.schoolName },
  });

  if (!school) {
    console.log(`  ⚠️ 学校未找到: ${parsedCase.schoolName}`);
    return false;
  }

  // 查找或创建系统用户（用于存储爬取的案例）
  let systemUser = await prisma.user.findUnique({
    where: { email: 'system@studyabroad.internal' },
  });

  if (!systemUser) {
    const bcrypt = await import('bcrypt');
    systemUser = await prisma.user.create({
      data: {
        email: 'system@studyabroad.internal',
        passwordHash: await bcrypt.hash('SystemUser2024!', 10),
        emailVerified: true,
        role: 'USER',
      },
    });
  }

  // 检查是否已存在类似案例（避免重复）
  const existing = await prisma.admissionCase.findFirst({
    where: {
      schoolId: school.id,
      year: parsedCase.year,
      result: parsedCase.result,
      gpaRange: parsedCase.gpaRange,
      satRange: parsedCase.satRange,
    },
  });

  if (existing) {
    return false;
  }

  // 创建案例
  await prisma.admissionCase.create({
    data: {
      userId: systemUser.id,
      schoolId: school.id,
      year: parsedCase.year,
      round: parsedCase.round,
      result: parsedCase.result,
      major: parsedCase.major,
      gpaRange: parsedCase.gpaRange,
      satRange: parsedCase.satRange,
      actRange: parsedCase.actRange,
      toeflRange: parsedCase.toeflRange,
      tags: parsedCase.tags,
      visibility: Visibility.ANONYMOUS, // 匿名公开
      isVerified: false, // 未验证
      source: 'reddit',
      reviewStatus: 'PENDING_REVIEW',
      qualityScore: 0,
    },
  });

  return true;
}

async function fetchWithSort(sort: string, maxPages: number) {
  let totalPosts = 0;
  let totalCases = 0;
  let savedCases = 0;
  let after: string | null = null;

  console.log(`\n📂 排序方式: ${sort}`);

  for (let page = 0; page < maxPages; page++) {
    console.log(`📄 获取第 ${page + 1} 页...`);

    try {
      const { posts, after: nextAfter } = await fetchRedditPosts(
        after ?? undefined,
        100,
        sort,
      );
      after = nextAfter;
      totalPosts += posts.length;

      for (const post of posts) {
        const cases = parsePost(post);
        totalCases += cases.length;

        for (const parsedCase of cases) {
          const saved = await saveCase(
            parsedCase,
            `${REDDIT_BASE_URL}${post.permalink}`,
          );
          if (saved) {
            savedCases++;
            console.log(
              `  ✅ ${parsedCase.schoolName} - ${parsedCase.result} (${parsedCase.year})`,
            );
          }
        }
      }

      if (!after) {
        console.log('  已到达最后一页');
        break;
      }

      // 避免请求过快
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error: any) {
      console.error(`  ❌ 错误: ${error.message}`);
      if (error.message.includes('429')) {
        console.log('  ⏳ 请求过于频繁，等待 30 秒...');
        await new Promise((resolve) => setTimeout(resolve, 30000));
        page--; // 重试当前页
      }
    }
  }

  return { totalPosts, totalCases, savedCases };
}

async function main() {
  console.log('🔍 开始爬取 Reddit r/collegeresults ...');

  const sortMethods = ['new', 'hot', 'top'];
  const pagesPerSort = 15;

  let grandTotalPosts = 0;
  let grandTotalCases = 0;
  let grandSavedCases = 0;

  for (const sort of sortMethods) {
    const { totalPosts, totalCases, savedCases } = await fetchWithSort(
      sort,
      pagesPerSort,
    );
    grandTotalPosts += totalPosts;
    grandTotalCases += totalCases;
    grandSavedCases += savedCases;

    // 排序方式之间等待一下
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 爬取完成:`);
  console.log(`   处理帖子: ${grandTotalPosts}`);
  console.log(`   识别案例: ${grandTotalCases}`);
  console.log(`   保存案例: ${grandSavedCases}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
