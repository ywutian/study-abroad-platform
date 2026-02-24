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

const prisma = new PrismaClient();

// Reddit API 配置
const REDDIT_BASE_URL = 'https://www.reddit.com';
const SUBREDDIT = 'collegeresults';
const USER_AGENT = 'StudyAbroadPlatform/1.0 (Educational Research)';

// 学校名称映射（Reddit 常见写法 -> 数据库标准名称）
const SCHOOL_NAME_MAP: Record<string, string> = {
  // Top 20
  MIT: 'Massachusetts Institute of Technology',
  Harvard: 'Harvard University',
  Stanford: 'Stanford University',
  Yale: 'Yale University',
  Princeton: 'Princeton University',
  Columbia: 'Columbia University',
  UPenn: 'University of Pennsylvania',
  Penn: 'University of Pennsylvania',
  Brown: 'Brown University',
  Dartmouth: 'Dartmouth College',
  Cornell: 'Cornell University',
  Duke: 'Duke University',
  Northwestern: 'Northwestern University',
  Caltech: 'California Institute of Technology',
  JHU: 'Johns Hopkins University',
  'Johns Hopkins': 'Johns Hopkins University',
  UChicago: 'University of Chicago',
  Chicago: 'University of Chicago',
  Rice: 'Rice University',
  Vanderbilt: 'Vanderbilt University',
  'Notre Dame': 'University of Notre Dame',
  WashU: 'Washington University in St. Louis',
  WUSTL: 'Washington University in St. Louis',
  Emory: 'Emory University',
  Georgetown: 'Georgetown University',
  // UC系列
  UCLA: 'University of California, Los Angeles',
  Berkeley: 'University of California, Berkeley',
  UCB: 'University of California, Berkeley',
  Cal: 'University of California, Berkeley',
  UCSD: 'University of California, San Diego',
  UCI: 'University of California, Irvine',
  UCSB: 'University of California, Santa Barbara',
  UCD: 'University of California, Davis',
  'UC Davis': 'University of California, Davis',
  UCR: 'University of California, Riverside',
  UCSC: 'University of California, Santa Cruz',
  'UC Santa Cruz': 'University of California, Santa Cruz',
  'UC Merced': 'University of California, Merced',
  USC: 'University of Southern California',
  // 其他热门
  CMU: 'Carnegie Mellon University',
  'Carnegie Mellon': 'Carnegie Mellon University',
  NYU: 'New York University',
  UMich: 'University of Michigan, Ann Arbor',
  Michigan: 'University of Michigan, Ann Arbor',
  UVA: 'University of Virginia',
  Virginia: 'University of Virginia',
  UNC: 'University of North Carolina at Chapel Hill',
  'Chapel Hill': 'University of North Carolina at Chapel Hill',
  'Georgia Tech': 'Georgia Institute of Technology',
  GT: 'Georgia Institute of Technology',
  GaTech: 'Georgia Institute of Technology',
  'UT Austin': 'University of Texas at Austin',
  Texas: 'University of Texas at Austin',
  UIUC: 'University of Illinois Urbana-Champaign',
  Illinois: 'University of Illinois Urbana-Champaign',
  UW: 'University of Washington',
  UDub: 'University of Washington',
  Purdue: 'Purdue University',
  OSU: 'Ohio State University',
  'Ohio State': 'Ohio State University',
  'Penn State': 'Penn State University',
  PSU: 'Penn State University',
  PennState: 'Penn State University',
  BU: 'Boston University',
  BC: 'Boston College',
  Tufts: 'Tufts University',
  NEU: 'Northeastern University',
  Northeastern: 'Northeastern University',
  UF: 'University of Florida',
  Florida: 'University of Florida',
  UGA: 'University of Georgia',
  // 新增学校
  Rochester: 'University of Rochester',
  Case: 'Case Western Reserve University',
  'Case Western': 'Case Western Reserve University',
  CWRU: 'Case Western Reserve University',
  Tulane: 'Tulane University',
  UMN: 'University of Minnesota, Twin Cities',
  Minnesota: 'University of Minnesota, Twin Cities',
  UConn: 'University of Connecticut',
  'Virginia Tech': 'Virginia Tech',
  VT: 'Virginia Tech',
  VaTech: 'Virginia Tech',
  Pepperdine: 'Pepperdine University',
  GWU: 'George Washington University',
  GW: 'George Washington University',
  SCU: 'Santa Clara University',
  'Santa Clara': 'Santa Clara University',
  Syracuse: 'Syracuse University',
  Cuse: 'Syracuse University',
  Pitt: 'University of Pittsburgh',
  Pittsburgh: 'University of Pittsburgh',
  Miami: 'University of Miami',
  RPI: 'Rensselaer Polytechnic Institute',
  Rensselaer: 'Rensselaer Polytechnic Institute',
  Stevens: 'Stevens Institute of Technology',
  IU: 'Indiana University Bloomington',
  Indiana: 'Indiana University Bloomington',
  MSU: 'Michigan State University',
  'Michigan State': 'Michigan State University',
  Iowa: 'University of Iowa',
  UDelaware: 'University of Delaware',
  Delaware: 'University of Delaware',
  'CU Boulder': 'University of Colorado Boulder',
  Boulder: 'University of Colorado Boulder',
  Baylor: 'Baylor University',
  Clemson: 'Clemson University',
  Fordham: 'Fordham University',
  'Stony Brook': 'Stony Brook University',
  SBU: 'Stony Brook University',
  AU: 'American University',
  American: 'American University',
  Marquette: 'Marquette University',
  UB: 'University at Buffalo',
  Buffalo: 'University at Buffalo',
  'NC State': 'North Carolina State University',
  NCSU: 'North Carolina State University',
  UMass: 'University of Massachusetts Amherst',
  'UMass Amherst': 'University of Massachusetts Amherst',
  Drexel: 'Drexel University',
  Temple: 'Temple University',
  WPI: 'Worcester Polytechnic Institute',
  Arizona: 'University of Arizona',
  UArizona: 'University of Arizona',
  Howard: 'Howard University',
  RIT: 'Rochester Institute of Technology',
  IIT: 'Illinois Institute of Technology',
  Brandeis: 'Brandeis University',
  SMU: 'Southern Methodist University',
  Denver: 'University of Denver',
  Mines: 'Colorado School of Mines',
  USD: 'University of San Diego',
  Gonzaga: 'Gonzaga University',
  Villanova: 'Villanova University',
  Nova: 'Villanova University',
  Rutgers: 'Rutgers University-New Brunswick',
  UMD: 'University of Maryland, College Park',
  Maryland: 'University of Maryland, College Park',
  Lehigh: 'Lehigh University',
  TAMU: 'Texas A&M University',
  'Texas A&M': 'Texas A&M University',
  'Wake Forest': 'Wake Forest University',
  Wake: 'Wake Forest University',
  Wisconsin: 'University of Wisconsin-Madison',
  'UW Madison': 'University of Wisconsin-Madison',
  UWisc: 'University of Wisconsin-Madison',
  LMU: 'Loyola Marymount University',
  SLU: 'Saint Louis University',
  // 101-150 排名学校
  Auburn: 'Auburn University',
  'South Carolina': 'University of South Carolina',
  Utah: 'University of Utah',
  DePaul: 'DePaul University',
  'Seton Hall': 'Seton Hall University',
  Oregon: 'University of Oregon',
  UO: 'University of Oregon',
  USF: 'University of San Francisco',
  Clarkson: 'Clarkson University',
  Kentucky: 'University of Kentucky',
  UK: 'University of Kentucky',
  Kansas: 'University of Kansas',
  KU: 'University of Kansas',
  SDSU: 'San Diego State University',
  'San Diego State': 'San Diego State University',
  'New School': 'The New School',
  Parsons: 'The New School',
  Alabama: 'University of Alabama',
  Bama: 'University of Alabama',
  Oklahoma: 'University of Oklahoma',
  OU: 'University of Oklahoma',
  ASU: 'Arizona State University',
  'Arizona State': 'Arizona State University',
  Mizzou: 'University of Missouri',
  Missouri: 'University of Missouri',
  'Loyola Chicago': 'Loyola University Chicago',
  'Iowa State': 'Iowa State University',
  ISU: 'Iowa State University',
  Tennessee: 'University of Tennessee',
  UTK: 'University of Tennessee',
  Nebraska: 'University of Nebraska-Lincoln',
  UNL: 'University of Nebraska-Lincoln',
  'Oregon State': 'Oregon State University',
  'OSU Oregon': 'Oregon State University',
  'New Hampshire': 'University of New Hampshire',
  UNH: 'University of New Hampshire',
  Cincinnati: 'University of Cincinnati',
  'UC Cincinnati': 'University of Cincinnati',
  'Colorado State': 'Colorado State University',
  CSU: 'Colorado State University',
  Vermont: 'University of Vermont',
  UVM: 'University of Vermont',
  GMU: 'George Mason University',
  'George Mason': 'George Mason University',
  LSU: 'Louisiana State University',
  'Louisiana State': 'Louisiana State University',
  Houston: 'University of Houston',
  UH: 'University of Houston',
  Arkansas: 'University of Arkansas',
  UArk: 'University of Arkansas',
  Hawaii: 'University of Hawaii at Manoa',
  'UH Manoa': 'University of Hawaii at Manoa',
  FSU: 'Florida State University',
  'Florida State': 'Florida State University',
  'Rhode Island': 'University of Rhode Island',
  URI: 'University of Rhode Island',
  'K-State': 'Kansas State University',
  'Kansas State': 'Kansas State University',
  'Missouri S&T': 'Missouri University of Science and Technology',
  Rolla: 'Missouri University of Science and Technology',
  WSU: 'Washington State University',
  Wazzu: 'Washington State University',
  'Washington State': 'Washington State University',
  // 141-200 排名学校
  Maine: 'University of Maine',
  UCF: 'University of Central Florida',
  'Central Florida': 'University of Central Florida',
  'Illinois State': 'Illinois State University',
  Hofstra: 'Hofstra University',
  Rowan: 'Rowan University',
  Adelphi: 'Adelphi University',
  Binghamton: 'SUNY Binghamton University',
  'SUNY Binghamton': 'SUNY Binghamton University',
  'Mississippi State': 'Mississippi State University',
  'Ohio U': 'Ohio University',
  'Kent State': 'Kent State University',
  'New Mexico': 'University of New Mexico',
  UNM: 'University of New Mexico',
  'Ball State': 'Ball State University',
  Wyoming: 'University of Wyoming',
  'West Virginia': 'West Virginia University',
  WVU: 'West Virginia University',
  'North Dakota': 'University of North Dakota',
  'South Dakota': 'University of South Dakota',
  'Montana State': 'Montana State University',
  UNR: 'University of Nevada, Reno',
  Reno: 'University of Nevada, Reno',
  'Portland State': 'Portland State University',
  'Texas Tech': 'Texas Tech University',
  TTU: 'Texas Tech University',
  Idaho: 'University of Idaho',
  'North Texas': 'University of North Texas',
  UNT: 'University of North Texas',
  UNLV: 'University of Nevada, Las Vegas',
  'Las Vegas': 'University of Nevada, Las Vegas',
  SJSU: 'San Jose State University',
  'San Jose State': 'San Jose State University',
  'Bowling Green': 'Bowling Green State University',
  BGSU: 'Bowling Green State University',
  CSUF: 'California State University, Fullerton',
  'Cal State Fullerton': 'California State University, Fullerton',
  CSULB: 'California State University, Long Beach',
  'Long Beach State': 'California State University, Long Beach',
  'Cal Poly': 'California Polytechnic State University, San Luis Obispo',
  'Cal Poly SLO': 'California Polytechnic State University, San Luis Obispo',
  NDSU: 'North Dakota State University',
  'SDSU State': 'South Dakota State University',
  Akron: 'University of Akron',
  Toledo: 'University of Toledo',
  'Wayne State': 'Wayne State University',
  'UMass Lowell': 'University of Massachusetts Lowell',
  'Oklahoma State': 'Oklahoma State University',
  OkState: 'Oklahoma State University',
  NMSU: 'New Mexico State University',
  CSUN: 'California State University, Northridge',
  'Southern Miss': 'University of Southern Mississippi',
  NIU: 'Northern Illinois University',
  EMU: 'Eastern Michigan University',
  UWM: 'University of Wisconsin-Milwaukee',
  'Western Michigan': 'Western Michigan University',
  'Idaho State': 'Idaho State University',
  UTA: 'University of Texas at Arlington',
  'UT Arlington': 'University of Texas at Arlington',
  Memphis: 'University of Memphis',
  UTSA: 'University of Texas at San Antonio',
  'UT San Antonio': 'University of Texas at San Antonio',
  'Cleveland State': 'Cleveland State University',
  FIU: 'Florida International University',
  'Georgia State': 'Georgia State University',
  GSU: 'Georgia State University',
  'UMass Boston': 'University of Massachusetts Boston',
  ODU: 'Old Dominion University',
  'Old Dominion': 'Old Dominion University',
  'Wright State': 'Wright State University',
  CMich: 'Central Michigan University',
  'Central Michigan': 'Central Michigan University',
  IUPUI: 'Indiana University-Purdue University Indianapolis',
  'Wichita State': 'Wichita State University',
  // 文理学院
  Williams: 'Williams College',
  Amherst: 'Amherst College',
  Swarthmore: 'Swarthmore College',
  Pomona: 'Pomona College',
  Wellesley: 'Wellesley College',
  Bowdoin: 'Bowdoin College',
  Middlebury: 'Middlebury College',
  Carleton: 'Carleton College',
  CMC: 'Claremont McKenna College',
  'Claremont McKenna': 'Claremont McKenna College',
  Hamilton: 'Hamilton College',
  Haverford: 'Haverford College',
  Vassar: 'Vassar College',
  Grinnell: 'Grinnell College',
  Colgate: 'Colgate University',
  Davidson: 'Davidson College',
  Smith: 'Smith College',
  'W&L': 'Washington and Lee University',
  'Washington and Lee': 'Washington and Lee University',
  Colby: 'Colby College',
  Bates: 'Bates College',
  Barnard: 'Barnard College',
  // 艺术院校
  RISD: 'Rhode Island School of Design',
  Pratt: 'Pratt Institute',
  SAIC: 'School of the Art Institute of Chicago',
  CalArts: 'California Institute of the Arts',
  ArtCenter: 'ArtCenter College of Design',
  SCAD: 'Savannah College of Art and Design',
  MICA: 'Maryland Institute College of Art',
  CCA: 'California College of the Arts',
  // 音乐学院
  Juilliard: 'The Juilliard School',
  Berklee: 'Berklee College of Music',
  Curtis: 'Curtis Institute of Music',
  NEC: 'New England Conservatory',
  MSM: 'Manhattan School of Music',
  // 工程名校
  'Harvey Mudd': 'Harvey Mudd College',
  HMC: 'Harvey Mudd College',
  'Rose-Hulman': 'Rose-Hulman Institute of Technology',
  'Rose Hulman': 'Rose-Hulman Institute of Technology',
  Cooper: 'Cooper Union',
  'Cooper Union': 'Cooper Union',
  Olin: 'Olin College of Engineering',
  // 更多大学
  'App State': 'Appalachian State University',
  JMU: 'James Madison University',
  UNCW: 'University of North Carolina Wilmington',
  GVSU: 'Grand Valley State University',
  Towson: 'Towson University',
  'Sac State': 'California State University, Sacramento',
  UTD: 'University of Texas at Dallas',
  'UT Dallas': 'University of Texas at Dallas',
  'USF Tampa': 'University of South Florida',
};

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
 * 模糊匹配学校名称
 */
function findSchoolMatch(rawName: string): string | null {
  const normalized = rawName.toLowerCase().trim();

  // 直接映射
  for (const [alias, fullName] of Object.entries(SCHOOL_NAME_MAP)) {
    if (
      normalized === alias.toLowerCase() ||
      normalized.includes(alias.toLowerCase())
    ) {
      return fullName;
    }
  }

  // 尝试部分匹配
  for (const [alias, fullName] of Object.entries(SCHOOL_NAME_MAP)) {
    if (alias.toLowerCase().includes(normalized) && normalized.length > 3) {
      return fullName;
    }
  }

  return null;
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
