/**
 * Reddit 爬虫 - 支持多个 subreddit
 *
 * 支持的 subreddit：
 * - r/collegeresults - 录取结果帖子，格式规范
 * - r/ApplyingToCollege - 申请讨论，部分有结果
 * - r/chanceme - 概率评估，部分有结果
 *
 * 使用方法：
 * npx ts-node scripts/scrape-reddit-results.ts [options]
 *
 * 选项：
 * --subreddit <name>  指定 subreddit（默认 collegeresults）
 * --pages <number>    抓取页数（默认 10，每页约 100 帖）
 * --delay <ms>        请求间隔毫秒（默认 2000）
 * --retry <number>    重试次数（默认 3）
 *
 * 示例：
 * npx ts-node scripts/scrape-reddit-results.ts --subreddit collegeresults --pages 50
 * npx ts-node scripts/scrape-reddit-results.ts --subreddit ApplyingToCollege --pages 30
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 解析命令行参数
const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

const CONFIG = {
  subreddit: getArg('subreddit', 'collegeresults'),
  pages: parseInt(getArg('pages', '10')),
  delay: parseInt(getArg('delay', '2000')),
  retry: parseInt(getArg('retry', '3')),
};

interface ParsedResult {
  school: string;
  result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED';
  major?: string;
}

interface ParsedPost {
  title: string;
  gpa?: string;
  sat?: string;
  act?: string;
  toefl?: string;
  isInternational: boolean;
  intendedMajor?: string;
  results: ParsedResult[];
  year: number;
  tags: string[];
  highSchoolType?:
    | 'PUBLIC_US'
    | 'PRIVATE_US'
    | 'CHINA_INTL'
    | 'CHINA_PUBLIC'
    | 'OTHER_INTL';
  state?: string;
  hooks?: string[]; // legacy, athlete, first_gen, urm
}

// 学校名称标准化映射
const schoolMap: Record<string, string> = {
  mit: 'Massachusetts Institute of Technology',
  stanford: 'Stanford University',
  harvard: 'Harvard University',
  yale: 'Yale University',
  princeton: 'Princeton University',
  columbia: 'Columbia University',
  upenn: 'University of Pennsylvania',
  penn: 'University of Pennsylvania',
  duke: 'Duke University',
  northwestern: 'Northwestern University',
  caltech: 'California Institute of Technology',
  uchicago: 'University of Chicago',
  chicago: 'University of Chicago',
  jhu: 'Johns Hopkins University',
  'johns hopkins': 'Johns Hopkins University',
  cornell: 'Cornell University',
  brown: 'Brown University',
  dartmouth: 'Dartmouth College',
  rice: 'Rice University',
  vanderbilt: 'Vanderbilt University',
  'notre dame': 'University of Notre Dame',
  washu: 'Washington University in St. Louis',
  wustl: 'Washington University in St. Louis',
  emory: 'Emory University',
  georgetown: 'Georgetown University',
  ucb: 'University of California, Berkeley',
  berkeley: 'University of California, Berkeley',
  'uc berkeley': 'University of California, Berkeley',
  ucla: 'University of California, Los Angeles',
  'uc la': 'University of California, Los Angeles',
  usc: 'University of Southern California',
  nyu: 'New York University',
  cmu: 'Carnegie Mellon University',
  'carnegie mellon': 'Carnegie Mellon University',
  umich: 'University of Michigan',
  michigan: 'University of Michigan',
  gatech: 'Georgia Institute of Technology',
  'georgia tech': 'Georgia Institute of Technology',
  uiuc: 'University of Illinois Urbana-Champaign',
  illinois: 'University of Illinois Urbana-Champaign',
  purdue: 'Purdue University',
  'ut austin': 'University of Texas at Austin',
  texas: 'University of Texas at Austin',
  uw: 'University of Washington',
  washington: 'University of Washington',
  bu: 'Boston University',
  'boston u': 'Boston University',
  bc: 'Boston College',
  'boston college': 'Boston College',
  neu: 'Northeastern University',
  northeastern: 'Northeastern University',
  tufts: 'Tufts University',
  uva: 'University of Virginia',
  virginia: 'University of Virginia',
  unc: 'University of North Carolina at Chapel Hill',
  'chapel hill': 'University of North Carolina at Chapel Hill',
  'wake forest': 'Wake Forest University',
  umd: 'University of Maryland',
  maryland: 'University of Maryland',
  ucsd: 'University of California, San Diego',
  'uc san diego': 'University of California, San Diego',
  ucsb: 'University of California, Santa Barbara',
  'uc santa barbara': 'University of California, Santa Barbara',
  uci: 'University of California, Irvine',
  'uc irvine': 'University of California, Irvine',
  ucd: 'University of California, Davis',
  'uc davis': 'University of California, Davis',
  ucsc: 'University of California, Santa Cruz',
  ucr: 'University of California, Riverside',
  williams: 'Williams College',
  amherst: 'Amherst College',
  pomona: 'Pomona College',
  swarthmore: 'Swarthmore College',
  wellesley: 'Wellesley College',
  bowdoin: 'Bowdoin College',
  middlebury: 'Middlebury College',
  carleton: 'Carleton College',
  'claremont mckenna': 'Claremont McKenna College',
  cmc: 'Claremont McKenna College',
  'harvey mudd': 'Harvey Mudd College',
  colby: 'Colby College',
  hamilton: 'Hamilton College',
  haverford: 'Haverford College',
  vassar: 'Vassar College',
  grinnell: 'Grinnell College',
  davidson: 'Davidson College',
  colgate: 'Colgate University',
  barnard: 'Barnard College',
  'nyu stern': 'New York University',
  wharton: 'University of Pennsylvania',
  ross: 'University of Michigan',
  // 更多学校映射
  osu: 'Ohio State University',
  'ohio state': 'Ohio State University',
  psu: 'Penn State University',
  'penn state': 'Penn State University',
  rutgers: 'Rutgers University',
  'uw madison': 'University of Wisconsin-Madison',
  wisconsin: 'University of Wisconsin-Madison',
  uf: 'University of Florida',
  florida: 'University of Florida',
  fsu: 'Florida State University',
  gmu: 'George Mason University',
  gwu: 'George Washington University',
  'george washington': 'George Washington University',
  american: 'American University',
  fordham: 'Fordham University',
  villanova: 'Villanova University',
  lehigh: 'Lehigh University',
  'case western': 'Case Western Reserve University',
  cwru: 'Case Western Reserve University',
  rochester: 'University of Rochester',
  brandeis: 'Brandeis University',
  tulane: 'Tulane University',
  rpi: 'Rensselaer Polytechnic Institute',
  stevens: 'Stevens Institute of Technology',
  wpi: 'Worcester Polytechnic Institute',
  rit: 'Rochester Institute of Technology',
  drexel: 'Drexel University',
  syracuse: 'Syracuse University',
  iu: 'Indiana University Bloomington',
  indiana: 'Indiana University Bloomington',
  msu: 'Michigan State University',
  'michigan state': 'Michigan State University',
  asu: 'Arizona State University',
  'arizona state': 'Arizona State University',
  ua: 'University of Arizona',
  'cu boulder': 'University of Colorado Boulder',
  colorado: 'University of Colorado Boulder',
  uconn: 'University of Connecticut',
  connecticut: 'University of Connecticut',
  umass: 'University of Massachusetts Amherst',
  'umass amherst': 'University of Massachusetts Amherst',
  'stony brook': 'Stony Brook University',
  'suny stony brook': 'Stony Brook University',
  buffalo: 'University at Buffalo',
  bing: 'Binghamton University',
  binghamton: 'Binghamton University',
  baruch: 'Baruch College',
  hunter: 'Hunter College',
  pitt: 'University of Pittsburgh',
  pittsburgh: 'University of Pittsburgh',
  miami: 'University of Miami',
  'u miami': 'University of Miami',
  smu: 'Southern Methodist University',
  tcu: 'Texas Christian University',
  baylor: 'Baylor University',
  'a&m': 'Texas A&M University',
  'texas a&m': 'Texas A&M University',
  uga: 'University of Georgia',
  georgia: 'University of Georgia',
  clemson: 'Clemson University',
  vt: 'Virginia Tech',
  'virginia tech': 'Virginia Tech',
  ncsu: 'North Carolina State University',
  'nc state': 'North Carolina State University',
  usf: 'University of South Florida',
  ucf: 'University of Central Florida',
  // LAC 补充
  wesleyan: 'Wesleyan University',
  oberlin: 'Oberlin College',
  macalester: 'Macalester College',
  reed: 'Reed College',
  'colorado college': 'Colorado College',
  kenyon: 'Kenyon College',
  bates: 'Bates College',
  scripps: 'Scripps College',
  'bryn mawr': 'Bryn Mawr College',
  smith: 'Smith College',
  'mt holyoke': 'Mount Holyoke College',
};

function normalizeSchoolName(name: string): string {
  const lower = name
    .toLowerCase()
    .trim()
    .replace(/^the /, '')
    .replace(/university$/, '')
    .replace(/college$/, '')
    .trim();

  return schoolMap[lower] || name.trim();
}

function parseResult(
  text: string,
): 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | null {
  const lower = text.toLowerCase();
  if (
    lower.includes('accepted') ||
    lower.includes('admitted') ||
    lower.includes('✅') ||
    lower.includes('🎉')
  ) {
    return 'ADMITTED';
  }
  if (
    lower.includes('rejected') ||
    lower.includes('denied') ||
    lower.includes('❌')
  ) {
    return 'REJECTED';
  }
  if (
    lower.includes('waitlisted') ||
    lower.includes('waitlist') ||
    lower.includes('🟡')
  ) {
    return 'WAITLISTED';
  }
  if (lower.includes('deferred')) {
    return 'DEFERRED';
  }
  return null;
}

function parsePostContent(title: string, content: string): ParsedPost | null {
  const post: ParsedPost = {
    title,
    isInternational: false,
    results: [],
    year: new Date().getFullYear(),
    tags: [],
  };

  // 检测国际学生
  if (
    /international|非美国|china|chinese|india|indian|korea|korean/i.test(
      content,
    )
  ) {
    post.isInternational = true;
    post.tags.push('international');
  }

  // 提取 GPA
  const gpaMatch =
    content.match(/(?:unweighted\s*)?gpa[:\s]*([0-9.]+)/i) ||
    content.match(/([0-9]\.[0-9]{1,2})\s*(?:uw|unweighted)/i);
  if (gpaMatch) {
    post.gpa = gpaMatch[1];
  }

  // 提取 SAT
  const satMatch =
    content.match(/sat[:\s]*(\d{3,4})/i) || content.match(/(\d{4})\s*sat/i);
  if (
    satMatch &&
    parseInt(satMatch[1]) >= 400 &&
    parseInt(satMatch[1]) <= 1600
  ) {
    post.sat = satMatch[1];
  }

  // 提取 ACT
  const actMatch =
    content.match(/act[:\s]*(\d{2})/i) || content.match(/(\d{2})\s*act/i);
  if (actMatch && parseInt(actMatch[1]) >= 1 && parseInt(actMatch[1]) <= 36) {
    post.act = actMatch[1];
  }

  // 提取 TOEFL
  const toeflMatch =
    content.match(/toefl[:\s]*(\d{2,3})/i) || content.match(/(\d{3})\s*toefl/i);
  if (
    toeflMatch &&
    parseInt(toeflMatch[1]) >= 60 &&
    parseInt(toeflMatch[1]) <= 120
  ) {
    post.toefl = toeflMatch[1];
  }

  // 提取专业
  const majorMatch =
    content.match(/(?:intended\s*)?major[:\s]*([^\n,]+)/i) ||
    content.match(/applying\s*(?:for|to)[:\s]*([^\n,]+)/i);
  if (majorMatch) {
    post.intendedMajor = majorMatch[1].trim();
  }

  // 提取录取结果
  // 匹配格式: "School Name - Accepted/Rejected/Waitlisted" 或 "✅ School Name" 等
  const resultPatterns = [
    /^[\s*-]*([^-\n]+?)\s*[-–—:]\s*(accepted|rejected|waitlisted|admitted|denied|deferred)/gim,
    /^[\s*-]*(✅|❌|🟡)\s*([^\n]+)/gm,
    /^[\s*-]*([^\n]+?)\s*[:\-]\s*(✅|❌|🟡)/gm,
  ];

  for (const pattern of resultPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let schoolName: string;
      let result: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | null;

      if (match[1] === '✅' || match[1] === '❌' || match[1] === '🟡') {
        schoolName = match[2];
        result =
          match[1] === '✅'
            ? 'ADMITTED'
            : match[1] === '❌'
              ? 'REJECTED'
              : 'WAITLISTED';
      } else if (match[2] === '✅' || match[2] === '❌' || match[2] === '🟡') {
        schoolName = match[1];
        result =
          match[2] === '✅'
            ? 'ADMITTED'
            : match[2] === '❌'
              ? 'REJECTED'
              : 'WAITLISTED';
      } else {
        schoolName = match[1];
        result = parseResult(match[2]);
      }

      if (result && schoolName.length > 2 && schoolName.length < 100) {
        const normalizedSchool = normalizeSchoolName(schoolName);
        // 避免重复
        if (!post.results.find((r) => r.school === normalizedSchool)) {
          post.results.push({
            school: normalizedSchool,
            result,
            major: post.intendedMajor,
          });
        }
      }
    }
  }

  // 如果没解析到结果，尝试从 Acceptances/Rejections 分段解析
  if (post.results.length === 0) {
    const sections = content.split(/\n(?=acceptances|rejections|waitlists)/i);
    for (const section of sections) {
      let sectionResult: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | null = null;
      if (/^acceptances/i.test(section)) sectionResult = 'ADMITTED';
      else if (/^rejections/i.test(section)) sectionResult = 'REJECTED';
      else if (/^waitlists/i.test(section)) sectionResult = 'WAITLISTED';

      if (sectionResult) {
        const schoolMatches = section.match(/[-*]\s*([A-Z][^\n-*]+)/g);
        if (schoolMatches) {
          for (const m of schoolMatches) {
            const schoolName = m.replace(/^[-*]\s*/, '').trim();
            if (schoolName.length > 2 && schoolName.length < 100) {
              const normalizedSchool = normalizeSchoolName(schoolName);
              if (!post.results.find((r) => r.school === normalizedSchool)) {
                post.results.push({
                  school: normalizedSchool,
                  result: sectionResult,
                  major: post.intendedMajor,
                });
              }
            }
          }
        }
      }
    }
  }

  // 提取高中类型
  if (/private\s*school|boarding\s*school|prep\s*school/i.test(content)) {
    post.highSchoolType = 'PRIVATE_US';
  } else if (/public\s*school|public\s*high/i.test(content)) {
    post.highSchoolType = 'PUBLIC_US';
  } else if (
    /international\s*school|IB\s*school/i.test(content) &&
    post.isInternational
  ) {
    post.highSchoolType = post.isInternational ? 'OTHER_INTL' : 'PRIVATE_US';
  } else if (/china|chinese|beijing|shanghai|shenzhen/i.test(content)) {
    post.highSchoolType = /international/i.test(content)
      ? 'CHINA_INTL'
      : 'CHINA_PUBLIC';
  }

  // 提取州/地区
  const stateMatch = content.match(
    /(?:from|in|live\s*in|located\s*in)\s+([A-Z]{2}|California|Texas|New York|Florida|Massachusetts|Virginia|Georgia|Illinois|Pennsylvania|Ohio|North Carolina|Michigan|Washington|Arizona|Colorado)/i,
  );
  if (stateMatch) {
    post.state = stateMatch[1];
  }

  // 提取 hooks
  post.hooks = [];
  if (/legacy/i.test(content)) post.hooks.push('legacy');
  if (/athlete|recruited\s*athlete|varsity/i.test(content))
    post.hooks.push('athlete');
  if (/first.?gen|first\s*generation/i.test(content))
    post.hooks.push('first_gen');
  if (
    /urm|underrepresented|african.?american|hispanic|latino|native/i.test(
      content,
    )
  )
    post.hooks.push('urm');
  if (/recruited/i.test(content)) post.hooks.push('recruited');

  // 添加标签
  if (/first.?gen/i.test(content)) post.tags.push('first-gen');
  if (/research/i.test(content)) post.tags.push('research');
  if (/olympiad|usamo|usaco|usabo|usnco/i.test(content))
    post.tags.push('olympiad');
  if (/legacy/i.test(content)) post.tags.push('legacy');
  if (/athlete|recruited/i.test(content)) post.tags.push('athlete');
  if (/cs|computer\s*science/i.test(content)) post.tags.push('CS');
  if (/pre.?med|biology|biochem/i.test(content)) post.tags.push('pre-med');
  if (/business|finance|econ/i.test(content)) post.tags.push('business');
  if (/engineering/i.test(content)) post.tags.push('STEM');
  if (post.highSchoolType) post.tags.push(post.highSchoolType);

  if (post.results.length === 0) return null;
  return post;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  url: string,
  retries: number = CONFIG.retry,
): Promise<Response | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        return res;
      }

      if (res.status === 429 || res.status === 403) {
        const waitTime = Math.pow(2, i + 1) * 5000; // 指数退避: 10s, 20s, 40s
        console.log(
          `⏳ 限流 (${res.status})，等待 ${waitTime / 1000}s 后重试 (${i + 1}/${retries})...`,
        );
        await sleep(waitTime);
        continue;
      }

      console.error(`❌ HTTP ${res.status}: ${res.statusText}`);
      return null;
    } catch (e: any) {
      console.error(`❌ 请求失败: ${e.message}`);
      if (i < retries - 1) {
        await sleep(5000);
      }
    }
  }
  return null;
}

async function fetchRedditPosts(
  subreddit: string,
  pages: number = 10,
): Promise<any[]> {
  const posts: any[] = [];
  let after = '';
  let page = 0;

  console.log(`\n🎯 目标: r/${subreddit}, ${pages} 页\n`);

  while (page < pages) {
    const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=100${after ? `&after=${after}` : ''}`;

    console.log(`📥 [${page + 1}/${pages}] Fetching...`);

    const res = await fetchWithRetry(url);

    if (!res) {
      console.log('⚠️ 获取失败，跳过...');
      break;
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      console.error('❌ JSON 解析失败');
      break;
    }

    const children = data.data?.children || [];

    if (children.length === 0) {
      console.log('📭 没有更多帖子');
      break;
    }

    const newPosts = children.map((c: any) => c.data);
    posts.push(...newPosts);
    console.log(`   ✅ 获取 ${newPosts.length} 个帖子 (总计: ${posts.length})`);

    after = data.data?.after;
    page++;

    if (!after) {
      console.log('📭 已到达最后一页');
      break;
    }

    // 限速 - 可配置
    await sleep(CONFIG.delay);
  }

  console.log(`\n📊 共获取 ${posts.length} 个帖子\n`);
  return posts;
}

async function main() {
  console.log('═'.repeat(50));
  console.log('🚀 Reddit 爬虫启动');
  console.log('═'.repeat(50));
  console.log(`📌 Subreddit: r/${CONFIG.subreddit}`);
  console.log(`📄 目标页数: ${CONFIG.pages}`);
  console.log(`⏱️  请求间隔: ${CONFIG.delay}ms`);
  console.log(`🔄 重试次数: ${CONFIG.retry}`);
  console.log('═'.repeat(50));

  // 获取帖子
  const posts = await fetchRedditPosts(CONFIG.subreddit, CONFIG.pages);

  // 获取或创建导入用户
  let importUser = await prisma.user.findFirst({
    where: { email: 'reddit-import@system.local' },
  });

  if (!importUser) {
    importUser = await prisma.user.create({
      data: {
        email: 'reddit-import@system.local',
        passwordHash: 'imported',
        role: 'USER',
      },
    });
  }

  let imported = 0;
  let skipped = 0;

  for (const post of posts) {
    const content = post.selftext || '';
    const title = post.title || '';

    if (content.length < 100) {
      skipped++;
      continue;
    }

    const parsed = parsePostContent(title, content);
    if (!parsed || parsed.results.length === 0) {
      skipped++;
      continue;
    }

    console.log(`\n📝 ${title.slice(0, 60)}...`);
    console.log(
      `   GPA: ${parsed.gpa || '-'}, SAT: ${parsed.sat || '-'}, TOEFL: ${parsed.toefl || '-'}`,
    );
    console.log(
      `   高中: ${parsed.highSchoolType || '-'}, Hooks: ${parsed.hooks?.join(',') || '-'}`,
    );
    console.log(`   结果: ${parsed.results.length} 个`);

    for (const result of parsed.results) {
      try {
        // 查找学校
        let school = await prisma.school.findFirst({
          where: {
            OR: [
              { name: { equals: result.school, mode: 'insensitive' } },
              {
                name: {
                  contains: result.school.split(' ')[0],
                  mode: 'insensitive',
                },
              },
            ],
          },
        });

        if (!school) {
          // 创建学校
          school = await prisma.school.create({
            data: {
              name: result.school,
              country: 'US',
            },
          });
        }

        // 检查是否已存在相似案例
        const existing = await prisma.admissionCase.findFirst({
          where: {
            schoolId: school.id,
            gpaRange: parsed.gpa || null,
            satRange: parsed.sat || null,
            result: result.result,
          },
        });

        if (existing) continue;

        // 合并 tags（包含 highSchoolType、hooks 和来源）
        const allTags = [
          ...parsed.tags,
          ...(parsed.hooks || []),
          ...(parsed.state ? [`state:${parsed.state}`] : []),
          `source:reddit:${CONFIG.subreddit}`,
        ];

        // 创建案例
        await prisma.admissionCase.create({
          data: {
            userId: importUser.id,
            schoolId: school.id,
            year: parsed.year,
            round: 'RD',
            result: result.result,
            major: result.major || parsed.intendedMajor || null,
            gpaRange: parsed.gpa || null,
            satRange: parsed.sat || null,
            actRange: parsed.act || null,
            toeflRange: parsed.toefl || null,
            tags: [...new Set(allTags)], // 去重
            visibility: 'ANONYMOUS',
          },
        });

        imported++;
        console.log(`   ✅ ${result.school} - ${result.result}`);
      } catch (e: any) {
        // 忽略错误继续
      }
    }
  }

  console.log(`\n========== 爬取完成 ==========`);
  console.log(`✅ 导入案例: ${imported}`);
  console.log(`⏭️  跳过帖子: ${skipped}`);

  // 最终统计
  const total = await prisma.admissionCase.count();
  const intl = await prisma.admissionCase.count({
    where: { tags: { has: 'international' } },
  });
  console.log(`\n📊 数据库总案例: ${total}`);
  console.log(`🌍 国际学生案例: ${intl}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
