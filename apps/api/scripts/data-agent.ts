#!/usr/bin/env npx ts-node
/**
 * 数据采集 Agent
 *
 * 全自动运行，持续爬取、验证、清洗数据
 *
 * 使用方法:
 *   npx ts-node scripts/data-agent.ts
 *   npx ts-node scripts/data-agent.ts --hours=8   # 运行8小时
 *   npx ts-node scripts/data-agent.ts --target=5000  # 目标5000条
 */

import { PrismaClient, AdmissionResult, Visibility } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

// ============ 配置 ============
interface AgentConfig {
  maxHours: number; // 最大运行时间（小时）
  targetCount: number; // 目标数据量
  scrapePages: number; // 每轮爬取页数
  syntheticBatch: number; // 每轮生成合成数据数量
  intervalMinutes: number; // 循环间隔（分钟）
  subreddits: string[]; // Reddit 来源
  searchKeywords: string[]; // 搜索关键词
  fetchComments: boolean; // 是否抓取评论
}

const DEFAULT_CONFIG: AgentConfig = {
  maxHours: 12,
  targetCount: 100000,
  scrapePages: 5,
  syntheticBatch: 100,
  intervalMinutes: 3,
  subreddits: [
    'collegeresults',
    'ApplyingToCollege',
    'chanceme',
    'CollegeAdmissions',
  ],
  searchKeywords: [
    'accepted MIT',
    'accepted Stanford',
    'accepted Harvard',
    'accepted Yale',
    'rejected MIT',
    'rejected Stanford',
    'rejected Harvard',
    'college results',
    'decision results',
    'admission results',
    'ivy league results',
    'T20 results',
    'top 20 results',
    'international student accepted',
    'international admitted',
    'waitlisted',
    'deferred',
    'early decision results',
    'ED results',
    'early action results',
    'EA results',
    'regular decision',
    'class of 2025',
    'class of 2026',
    'class of 2027',
    'class of 2028',
    'GPA SAT accepted',
    'stats accepted',
    'profile admitted',
    'Chinese student admitted',
    'Indian student admitted',
    'first gen admitted',
    'legacy admitted',
    'UC Berkeley admitted',
    'UCLA admitted',
    'CMU admitted',
    'Northwestern admitted',
    'Duke admitted',
    'UPenn admitted',
  ],
  fetchComments: true,
};

// ============ 统计 ============
interface AgentStats {
  startTime: Date;
  rounds: number;
  scraped: number;
  generated: number;
  verified: number;
  deleted: number;
  errors: number;
}

const stats: AgentStats = {
  startTime: new Date(),
  rounds: 0,
  scraped: 0,
  generated: 0,
  verified: 0,
  deleted: 0,
  errors: 0,
};

// ============ 日志 ============
function log(level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', message: string) {
  const time = new Date().toLocaleTimeString('zh-CN');
  const icons = { INFO: '📋', WARN: '⚠️', ERROR: '❌', SUCCESS: '✅' };
  console.log(`[${time}] ${icons[level]} ${message}`);
}

function logStats() {
  const runTime = Math.round(
    (Date.now() - stats.startTime.getTime()) / 1000 / 60,
  );
  console.log('\n' + '─'.repeat(50));
  console.log(`📊 运行统计 (${runTime} 分钟)`);
  console.log('─'.repeat(50));
  console.log(`  轮次: ${stats.rounds}`);
  console.log(`  爬取: +${stats.scraped}`);
  console.log(`  生成: +${stats.generated}`);
  console.log(`  核验: ${stats.verified}`);
  console.log(`  删除: ${stats.deleted}`);
  console.log(`  错误: ${stats.errors}`);
  console.log('─'.repeat(50) + '\n');
}

// ============ Reddit 爬取 ============
const schoolMap: Record<string, string> = {
  mit: 'Massachusetts Institute of Technology',
  stanford: 'Stanford University',
  harvard: 'Harvard University',
  yale: 'Yale University',
  princeton: 'Princeton University',
  columbia: 'Columbia University',
  upenn: 'University of Pennsylvania',
  penn: 'University of Pennsylvania',
  brown: 'Brown University',
  dartmouth: 'Dartmouth College',
  cornell: 'Cornell University',
  duke: 'Duke University',
  northwestern: 'Northwestern University',
  uchicago: 'University of Chicago',
  caltech: 'California Institute of Technology',
  jhu: 'Johns Hopkins University',
  'johns hopkins': 'Johns Hopkins University',
  rice: 'Rice University',
  vanderbilt: 'Vanderbilt University',
  'notre dame': 'University of Notre Dame',
  washu: 'Washington University in St. Louis',
  emory: 'Emory University',
  georgetown: 'Georgetown University',
  berkeley: 'University of California, Berkeley',
  ucb: 'University of California, Berkeley',
  ucla: 'University of California, Los Angeles',
  usc: 'University of Southern California',
  cmu: 'Carnegie Mellon University',
  'carnegie mellon': 'Carnegie Mellon University',
  nyu: 'New York University',
  umich: 'University of Michigan, Ann Arbor',
  michigan: 'University of Michigan, Ann Arbor',
  uva: 'University of Virginia',
  unc: 'University of North Carolina at Chapel Hill',
  gatech: 'Georgia Institute of Technology',
  'georgia tech': 'Georgia Institute of Technology',
  'ut austin': 'University of Texas at Austin',
  texas: 'University of Texas at Austin',
  uiuc: 'University of Illinois Urbana-Champaign',
  illinois: 'University of Illinois Urbana-Champaign',
  purdue: 'Purdue University',
  wisconsin: 'University of Wisconsin-Madison',
  osu: 'Ohio State University',
  'ohio state': 'Ohio State University',
  'penn state': 'Pennsylvania State University',
  psu: 'Pennsylvania State University',
  bu: 'Boston University',
  bc: 'Boston College',
  tufts: 'Tufts University',
  northeastern: 'Northeastern University',
  umd: 'University of Maryland, College Park',
  maryland: 'University of Maryland, College Park',
  rutgers: 'Rutgers University-New Brunswick',
  ucsd: 'University of California, San Diego',
  uci: 'University of California, Irvine',
  ucsb: 'University of California, Santa Barbara',
  ucsc: 'University of California, Santa Cruz',
  ucd: 'University of California, Davis',
  ucr: 'University of California, Riverside',
  uf: 'University of Florida',
  uw: 'University of Washington',
  indiana: 'Indiana University Bloomington',
  msu: 'Michigan State University',
  asu: 'Arizona State University',
  arizona: 'University of Arizona',
  colorado: 'University of Colorado Boulder',
  oregon: 'University of Oregon',
  iowa: 'University of Iowa',
  pitt: 'University of Pittsburgh',
  rochester: 'University of Rochester',
  'case western': 'Case Western Reserve University',
  tulane: 'Tulane University',
  smu: 'Southern Methodist University',
  baylor: 'Baylor University',
  miami: 'University of Miami',
  gwu: 'George Washington University',
  syracuse: 'Syracuse University',
  fordham: 'Fordham University',
  villanova: 'Villanova University',
  lehigh: 'Lehigh University',
  'wake forest': 'Wake Forest University',
  brandeis: 'Brandeis University',
  rpi: 'Rensselaer Polytechnic Institute',
  stevens: 'Stevens Institute of Technology',
  drexel: 'Drexel University',
  clemson: 'Clemson University',
  vt: 'Virginia Tech',
  'virginia tech': 'Virginia Tech',
  ncsu: 'North Carolina State University',
  tamu: 'Texas A&M University',
  'texas a&m': 'Texas A&M University',
  'cu boulder': 'University of Colorado Boulder',
  uconn: 'University of Connecticut',
  umass: 'University of Massachusetts Amherst',
  'stony brook': 'Stony Brook University',
  buffalo: 'University at Buffalo',
  binghamton: 'Binghamton University',
  'william & mary': 'William & Mary',
  'william and mary': 'William & Mary',
  wm: 'William & Mary',
  // LACs
  williams: 'Williams College',
  amherst: 'Amherst College',
  swarthmore: 'Swarthmore College',
  pomona: 'Pomona College',
  wellesley: 'Wellesley College',
  bowdoin: 'Bowdoin College',
  middlebury: 'Middlebury College',
  carleton: 'Carleton College',
  'claremont mckenna': 'Claremont McKenna College',
  cmc: 'Claremont McKenna College',
  haverford: 'Haverford College',
  vassar: 'Vassar College',
  colgate: 'Colgate University',
  hamilton: 'Hamilton College',
  wesleyan: 'Wesleyan University',
  grinnell: 'Grinnell College',
  davidson: 'Davidson College',
  colby: 'Colby College',
  barnard: 'Barnard College',
  oberlin: 'Oberlin College',
  'harvey mudd': 'Harvey Mudd College',
  hmc: 'Harvey Mudd College',
};

async function fetchWithRetry(
  url: string,
  retries = 3,
): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 DataAgent/1.0' },
      });
      if (response.ok) return response;
      if (response.status === 429 || response.status === 403) {
        const wait = Math.pow(2, i + 1) * 1000;
        log('WARN', `限流，等待 ${wait / 1000}s...`);
        await sleep(wait);
      }
    } catch (e) {
      log('WARN', `请求失败: ${(e as Error).message}`);
      await sleep(2000);
    }
  }
  return null;
}

async function scrapeReddit(subreddit: string, pages: number): Promise<number> {
  log('INFO', `爬取 r/${subreddit} (${pages} 页)...`);

  let after = '';
  let imported = 0;
  const existingSchools = await getExistingSchools();
  const systemUser = await getOrCreateSystemUser();

  for (let page = 0; page < pages; page++) {
    const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=25${after ? '&after=' + after : ''}`;
    const response = await fetchWithRetry(url);
    if (!response) break;

    const data = await response.json();
    const posts = data?.data?.children || [];
    if (posts.length === 0) break;

    for (const post of posts) {
      const { title, selftext, id: postId } = post.data;

      // 解析帖子内容
      const cases = parseRedditPost(title, selftext, existingSchools);

      for (const caseData of cases) {
        try {
          await prisma.admissionCase.create({
            data: {
              ...caseData,
              userId: systemUser.id,
              tags: [...(caseData.tags || []), `source:reddit:${subreddit}`],
            },
          });
          imported++;
        } catch (e) {
          // 忽略重复等错误
        }
      }

      // 抓取评论区
      if (DEFAULT_CONFIG.fetchComments && cases.length > 0) {
        const commentCases = await fetchPostComments(
          subreddit,
          postId,
          existingSchools,
        );
        for (const caseData of commentCases) {
          try {
            await prisma.admissionCase.create({
              data: {
                ...caseData,
                userId: systemUser.id,
                tags: [
                  ...(caseData.tags || []),
                  `source:reddit:${subreddit}:comment`,
                ],
              },
            });
            imported++;
          } catch (e) {}
        }
      }
    }

    after = data?.data?.after;
    if (!after) break;
    await sleep(2000);
  }

  log('SUCCESS', `r/${subreddit} 导入 ${imported} 条`);
  return imported;
}

// 抓取帖子评论
async function fetchPostComments(
  subreddit: string,
  postId: string,
  existingSchools: Map<string, string>,
): Promise<any[]> {
  const url = `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?limit=50`;
  const response = await fetchWithRetry(url);
  if (!response) return [];

  try {
    const data = await response.json();
    const comments = data[1]?.data?.children || [];
    const cases: any[] = [];

    for (const comment of comments) {
      if (comment.kind !== 't1') continue;
      const body = comment.data?.body || '';
      if (body.length < 50) continue; // 跳过太短的评论

      const parsedCases = parseRedditPost('', body, existingSchools);
      cases.push(...parsedCases);
    }

    return cases;
  } catch (e) {
    return [];
  }
}

// 使用关键词搜索 Reddit
async function searchReddit(
  keyword: string,
  limit: number = 25,
): Promise<number> {
  log('INFO', `搜索: "${keyword}"...`);

  const existingSchools = await getExistingSchools();
  const systemUser = await getOrCreateSystemUser();

  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&limit=${limit}&sort=relevance&t=year`;
  const response = await fetchWithRetry(url);
  if (!response) return 0;

  let imported = 0;

  try {
    const data = await response.json();
    const posts = data?.data?.children || [];

    for (const post of posts) {
      const { title, selftext, subreddit, id: postId } = post.data;

      // 只处理相关 subreddit
      const relevantSubs = [
        'collegeresults',
        'applyingtocollege',
        'chanceme',
        'collegeadmissions',
        'a2c',
      ];
      if (!relevantSubs.includes(subreddit.toLowerCase())) continue;

      const cases = parseRedditPost(title, selftext, existingSchools);

      for (const caseData of cases) {
        try {
          await prisma.admissionCase.create({
            data: {
              ...caseData,
              userId: systemUser.id,
              tags: [
                ...(caseData.tags || []),
                `source:reddit:search:${keyword.slice(0, 20)}`,
              ],
            },
          });
          imported++;
        } catch (e) {}
      }

      // 也抓取评论
      if (DEFAULT_CONFIG.fetchComments && cases.length > 0) {
        const commentCases = await fetchPostComments(
          subreddit,
          postId,
          existingSchools,
        );
        for (const caseData of commentCases) {
          try {
            await prisma.admissionCase.create({
              data: {
                ...caseData,
                userId: systemUser.id,
                tags: [
                  ...(caseData.tags || []),
                  `source:reddit:search:comment`,
                ],
              },
            });
            imported++;
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    log('WARN', `搜索失败: ${(e as Error).message}`);
  }

  if (imported > 0) {
    log('SUCCESS', `搜索 "${keyword}" 导入 ${imported} 条`);
  }
  return imported;
}

function parseRedditPost(
  title: string,
  content: string,
  existingSchools: Map<string, string>,
): any[] {
  const cases: any[] = [];
  const fullText = `${title}\n${content}`.toLowerCase();

  // 提取年份
  const yearMatch = fullText.match(/class of (\d{4})|20(\d{2})/);
  const year = yearMatch
    ? parseInt(yearMatch[1] || '20' + yearMatch[2])
    : new Date().getFullYear();

  // 提取 GPA
  const gpaMatch =
    fullText.match(/gpa[:\s]*([0-9.]+)/i) ||
    fullText.match(/([0-9]\.[0-9]{1,2})\/4/);
  const gpa = gpaMatch ? gpaMatch[1] : null;

  // 提取 SAT
  const satMatch =
    fullText.match(/sat[:\s]*(\d{3,4})/i) || fullText.match(/(\d{4})\/1600/);
  const sat = satMatch ? satMatch[1] : null;

  // 提取 ACT
  const actMatch = fullText.match(/act[:\s]*(\d{2})/i);
  const act = actMatch ? actMatch[1] : null;

  // 提取国际生标签
  const tags: string[] = [];
  if (
    /international|intl|china|chinese|india|korean|vietnamese/i.test(fullText)
  ) {
    tags.push('international');
  }
  if (/first[- ]?gen/i.test(fullText)) tags.push('first_gen');
  if (/legacy/i.test(fullText)) tags.push('legacy');
  if (/athlete|recruited/i.test(fullText)) tags.push('athlete');

  // 匹配学校和结果
  const resultPatterns = [
    { pattern: /accepted|admitted/gi, result: 'ADMITTED' },
    { pattern: /rejected|denied/gi, result: 'REJECTED' },
    { pattern: /waitlisted|waitlist/gi, result: 'WAITLISTED' },
    { pattern: /deferred/gi, result: 'DEFERRED' },
  ];

  for (const [abbr, fullName] of Object.entries(schoolMap)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    if (regex.test(fullText)) {
      const schoolId = existingSchools.get(fullName);
      if (!schoolId) continue;

      for (const { pattern, result } of resultPatterns) {
        // 检查这个学校名附近是否有这个结果
        const schoolIndex = fullText.search(regex);
        const resultIndex = fullText.search(pattern);
        if (resultIndex !== -1 && Math.abs(schoolIndex - resultIndex) < 200) {
          cases.push({
            schoolId,
            year,
            round: /ea|early action/i.test(fullText)
              ? 'EA'
              : /ed|early decision/i.test(fullText)
                ? 'ED'
                : /rea/i.test(fullText)
                  ? 'REA'
                  : 'RD',
            result: result as AdmissionResult,
            gpaRange: gpa,
            satRange: sat,
            actRange: act,
            tags,
            visibility: Visibility.ANONYMOUS,
            isVerified: false,
          });
          break; // 每个学校只记录一次
        }
      }
    }
  }

  return cases;
}

// ============ 合成数据生成 ============
const majorsList = [
  'Computer Science',
  'Economics',
  'Biology',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Engineering',
  'Business',
  'Political Science',
  'Psychology',
  'English',
  'History',
  'Philosophy',
  'Neuroscience',
  'Statistics',
  'Data Science',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Chemical Engineering',
  'Biomedical Engineering',
  'Aerospace Engineering',
  'Civil Engineering',
  'Finance',
  'Marketing',
  'International Relations',
];

const tagSets = [
  ['PUBLIC_US', 'research'],
  ['PUBLIC_US', 'leadership'],
  ['PRIVATE_US', 'research', 'olympiad'],
  ['international', 'CHINA_INTL', 'research'],
  ['international', 'OTHER_INTL', 'volunteer'],
  ['first_gen', 'urm'],
  ['legacy'],
  ['athlete', 'recruited'],
  ['research', 'olympiad', 'USAMO_qualifier'],
  ['entrepreneur', 'startup'],
];

async function generateSyntheticData(count: number): Promise<number> {
  log('INFO', `生成 ${count} 条合成数据...`);

  const schools = await prisma.school.findMany({
    where: { usNewsRank: { not: null, lte: 100 } },
    select: { id: true, usNewsRank: true },
  });

  if (schools.length === 0) {
    log('WARN', '无学校数据');
    return 0;
  }

  const systemUser = await getOrCreateSystemUser();
  let generated = 0;

  for (let i = 0; i < count; i++) {
    const school = schools[Math.floor(Math.random() * schools.length)];
    const rank = school.usNewsRank || 50;

    // 根据排名生成合理的成绩
    const baseGpa = rank <= 20 ? 3.85 : rank <= 50 ? 3.7 : 3.5;
    const gpa = (baseGpa + Math.random() * 0.15).toFixed(2);

    const baseSat = rank <= 20 ? 1500 : rank <= 50 ? 1400 : 1300;
    const sat = Math.round(baseSat + Math.random() * 100).toString();

    // 根据成绩决定录取结果
    const gpaNum = parseFloat(gpa);
    const satNum = parseInt(sat);
    let result: AdmissionResult;

    if (gpaNum >= 3.9 && satNum >= 1550) {
      result =
        Math.random() < 0.6
          ? AdmissionResult.ADMITTED
          : Math.random() < 0.5
            ? AdmissionResult.WAITLISTED
            : AdmissionResult.REJECTED;
    } else if (gpaNum >= 3.7 && satNum >= 1450) {
      result =
        Math.random() < 0.35
          ? AdmissionResult.ADMITTED
          : Math.random() < 0.4
            ? AdmissionResult.WAITLISTED
            : AdmissionResult.REJECTED;
    } else {
      result =
        Math.random() < 0.15
          ? AdmissionResult.ADMITTED
          : Math.random() < 0.3
            ? AdmissionResult.WAITLISTED
            : AdmissionResult.REJECTED;
    }

    const tags = tagSets[Math.floor(Math.random() * tagSets.length)];
    const major = majorsList[Math.floor(Math.random() * majorsList.length)];
    const year = 2023 + Math.floor(Math.random() * 3);
    const rounds = ['EA', 'ED', 'RD', 'REA'];
    const round = rounds[Math.floor(Math.random() * rounds.length)];

    try {
      await prisma.admissionCase.create({
        data: {
          schoolId: school.id,
          userId: systemUser.id,
          year,
          round,
          result,
          major,
          gpaRange: gpa,
          satRange: sat,
          tags: [...tags, 'source:synthetic'],
          visibility: Visibility.ANONYMOUS,
          isVerified: false,
        },
      });
      generated++;
    } catch (e) {
      // 忽略
    }
  }

  log('SUCCESS', `生成 ${generated} 条合成数据`);
  return generated;
}

// ============ 数据核验 ============
const invalidSchoolNames = new Set([
  'Take',
  'They',
  'Yes,',
  'Unless',
  'Applied',
  'STEM,',
  'Note',
  'TOEFL',
  'IELTS,',
  'Bioethics',
  'Environmental',
  'Sociology',
  'Anthropology',
  'Pathobiology',
  'Africana',
  'DREAM',
  'Local',
  'Committed',
  'stats:',
  'Bryn',
  'Additional',
  'Getting',
  'None',
]);

function isInvalidSchoolName(name: string): boolean {
  if (invalidSchoolNames.has(name)) return true;
  if (name.length < 3) return true;
  if (/^\d+\./.test(name)) return true;
  if (/^Acceptances/.test(name)) return true;
  if (/^Here's/.test(name)) return true;
  if (/^&gt;/.test(name)) return true;
  if (/^\(USC/.test(name)) return true;
  if (/^EA:|^ED:|^RD:|^REA:/.test(name)) return true;
  return false;
}

async function verifyAndClean(): Promise<{
  verified: number;
  deleted: number;
}> {
  log('INFO', '核验数据...');

  const cases = await prisma.admissionCase.findMany({
    where: { isVerified: false },
    include: { school: { select: { name: true, usNewsRank: true } } },
  });

  let verified = 0;
  let deleted = 0;

  for (const c of cases) {
    let shouldDelete = false;
    const rank = c.school.usNewsRank || 999;

    // 解析数值
    function parseValue(val: string | null): number | null {
      if (!val) return null;
      const match = val.match(/([0-9.]+)/);
      return match ? parseFloat(match[1]) : null;
    }

    const gpa = parseValue(c.gpaRange);
    const sat = parseValue(c.satRange);
    const act = parseValue(c.actRange);

    // 严格的删除规则
    if (isInvalidSchoolName(c.school.name)) shouldDelete = true;
    if (c.gpaRange === '.') shouldDelete = true;
    if (gpa !== null && (gpa > 5.0 || gpa < 0)) shouldDelete = true;
    if (sat !== null && (sat > 1600 || sat < 400)) shouldDelete = true;
    if (act !== null && (act > 36 || act < 1)) shouldDelete = true;

    // Top10 极端异常值
    if (rank <= 10 && c.result === 'ADMITTED') {
      if (gpa !== null && gpa < 2.5) shouldDelete = true;
      if (sat !== null && sat < 1100) shouldDelete = true;
    }

    if (shouldDelete) {
      try {
        await prisma.admissionCase.delete({ where: { id: c.id } });
        deleted++;
      } catch (e) {}
    } else {
      try {
        await prisma.admissionCase.update({
          where: { id: c.id },
          data: { isVerified: true, verifiedAt: new Date() },
        });
        verified++;
      } catch (e) {}
    }
  }

  log('SUCCESS', `核验 ${verified} 条，删除 ${deleted} 条`);
  return { verified, deleted };
}

// ============ 工具函数 ============
async function getExistingSchools(): Promise<Map<string, string>> {
  const schools = await prisma.school.findMany({
    select: { id: true, name: true },
  });
  return new Map(schools.map((s) => [s.name, s.id]));
}

async function getOrCreateSystemUser() {
  let user = await prisma.user.findUnique({
    where: { email: 'system@studyabroad.ai' },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'system@studyabroad.ai',
        passwordHash: 'system-no-login',
      },
    });
  }
  return user;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ 主循环 ============
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);
  const getArg = (name: string, def: number) => {
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg ? parseInt(arg.split('=')[1]) : def;
  };

  const config: AgentConfig = {
    ...DEFAULT_CONFIG,
    maxHours: getArg('hours', DEFAULT_CONFIG.maxHours),
    targetCount: getArg('target', DEFAULT_CONFIG.targetCount),
  };

  console.log('\n' + '═'.repeat(50));
  console.log('🤖 数据采集 Agent 启动');
  console.log('═'.repeat(50));
  console.log(`⏰ 最大运行: ${config.maxHours} 小时`);
  console.log(`🎯 目标数量: ${config.targetCount}`);
  console.log(`⏱️  循环间隔: ${config.intervalMinutes} 分钟`);
  console.log('═'.repeat(50) + '\n');

  const startTime = Date.now();
  const maxRuntime = config.maxHours * 60 * 60 * 1000;
  let subredditIndex = 0;
  let keywordIndex = 0;

  while (true) {
    // 检查停止条件
    const runTime = Date.now() - startTime;
    if (runTime > maxRuntime) {
      log('INFO', '达到最大运行时间，停止');
      break;
    }

    const currentCount = await prisma.admissionCase.count();
    if (currentCount >= config.targetCount) {
      log('INFO', `达到目标数量 ${config.targetCount}，停止`);
      break;
    }

    stats.rounds++;
    console.log('\n' + '═'.repeat(50));
    console.log(`🔄 第 ${stats.rounds} 轮 (当前: ${currentCount} 条)`);
    console.log('═'.repeat(50));

    try {
      // 1. 爬取 Reddit（按时间）
      const subreddit =
        config.subreddits[subredditIndex % config.subreddits.length];
      subredditIndex++;
      const scraped = await scrapeReddit(subreddit, config.scrapePages);
      stats.scraped += scraped;

      // 2. 关键词搜索（轮流使用不同关键词）
      const keyword =
        config.searchKeywords[keywordIndex % config.searchKeywords.length];
      keywordIndex++;
      const searchedCount = await searchReddit(keyword, 25);
      stats.scraped += searchedCount;

      await sleep(2000); // 避免限流

      // 再搜索一个关键词
      const keyword2 =
        config.searchKeywords[keywordIndex % config.searchKeywords.length];
      keywordIndex++;
      const searchedCount2 = await searchReddit(keyword2, 25);
      stats.scraped += searchedCount2;

      // 3. 生成合成数据
      const generated = await generateSyntheticData(config.syntheticBatch);
      stats.generated += generated;

      // 4. 核验数据
      const { verified, deleted } = await verifyAndClean();
      stats.verified += verified;
      stats.deleted += deleted;
    } catch (e) {
      stats.errors++;
      log('ERROR', (e as Error).message);
    }

    // 输出统计
    logStats();

    // 等待下一轮
    log('INFO', `等待 ${config.intervalMinutes} 分钟...`);
    await sleep(config.intervalMinutes * 60 * 1000);
  }

  // 最终报告
  console.log('\n' + '═'.repeat(50));
  console.log('📊 最终报告');
  console.log('═'.repeat(50));
  const finalCount = await prisma.admissionCase.count();
  const verifiedCount = await prisma.admissionCase.count({
    where: { isVerified: true },
  });
  console.log(`总数据: ${finalCount}`);
  console.log(`已核验: ${verifiedCount}`);
  console.log(
    `运行时长: ${Math.round((Date.now() - startTime) / 1000 / 60)} 分钟`,
  );
  console.log('═'.repeat(50));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
