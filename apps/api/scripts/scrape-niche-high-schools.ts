/**
 * Niche.com High School Scraper
 *
 * Fetches high school data from Niche.com's K-12 rankings:
 * - Best Private High Schools in America
 * - Best Boarding Schools in America
 * - Best Public High Schools (select states)
 *
 * Also scrapes international school directories for non-US schools.
 *
 * Usage:
 *   npx ts-node scripts/scrape-niche-high-schools.ts [--category=boarding|private|public] [--limit=50] [--dry-run]
 *
 * Output: JSON file at scripts/data/scraped-high-schools.json
 *
 * Note: Web scraping may violate Terms of Service.
 * For production use, consider Niche's data partnerships.
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Types
// ============================================

interface ScrapedHighSchool {
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  city?: string;
  type: string; // HighSchoolType enum value
  website?: string;
  nicheGrade?: string;
  nicheUrl?: string;
  source: string;
}

// ============================================
// Niche URL Builders
// ============================================

const NICHE_CATEGORIES: Record<
  string,
  { url: string; type: string; pages: number }
> = {
  boarding: {
    url: 'https://www.niche.com/k12/search/best-boarding-schools/',
    type: 'BOARDING_US',
    pages: 3,
  },
  private: {
    url: 'https://www.niche.com/k12/search/best-private-high-schools/',
    type: 'PRIVATE_US',
    pages: 5,
  },
  'public-ca': {
    url: 'https://www.niche.com/k12/search/best-public-high-schools/s/california/',
    type: 'PUBLIC_US',
    pages: 2,
  },
  'public-ny': {
    url: 'https://www.niche.com/k12/search/best-public-high-schools/s/new-york/',
    type: 'PUBLIC_US',
    pages: 2,
  },
  'public-ma': {
    url: 'https://www.niche.com/k12/search/best-public-high-schools/s/massachusetts/',
    type: 'PUBLIC_US',
    pages: 2,
  },
  'public-nj': {
    url: 'https://www.niche.com/k12/search/best-public-high-schools/s/new-jersey/',
    type: 'PUBLIC_US',
    pages: 2,
  },
  'public-ct': {
    url: 'https://www.niche.com/k12/search/best-public-high-schools/s/connecticut/',
    type: 'PUBLIC_US',
    pages: 1,
  },
  'public-va': {
    url: 'https://www.niche.com/k12/search/best-public-high-schools/s/virginia/',
    type: 'PUBLIC_US',
    pages: 1,
  },
  'public-il': {
    url: 'https://www.niche.com/k12/search/best-public-high-schools/s/illinois/',
    type: 'PUBLIC_US',
    pages: 1,
  },
  'public-tx': {
    url: 'https://www.niche.com/k12/search/best-public-high-schools/s/texas/',
    type: 'PUBLIC_US',
    pages: 1,
  },
};

// State abbreviation extraction
const US_STATES: Record<string, string> = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY',
  'District of Columbia': 'DC',
};

function extractState(locationText: string): string | undefined {
  // Format: "City, ST" or "City, State Name"
  const parts = locationText.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const stateText = parts[parts.length - 1];
    // Check if it's already an abbreviation
    if (stateText.length === 2 && stateText === stateText.toUpperCase()) {
      return stateText;
    }
    // Look up full name
    return US_STATES[stateText] ?? undefined;
  }
  return undefined;
}

function extractCity(locationText: string): string | undefined {
  const parts = locationText.split(',').map((s) => s.trim());
  return parts[0] || undefined;
}

// ============================================
// HTTP Fetch with Rate Limiting
// ============================================

async function fetchWithRetry(
  url: string,
  retries = 3,
): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          Referer: 'https://www.niche.com/',
        },
      });

      if (response.status === 429) {
        console.log(`  ⏳ Rate limited, waiting ${attempt * 10}s...`);
        await sleep(attempt * 10_000);
        continue;
      }

      if (response.status === 403) {
        console.log(
          `  🚫 Access denied (403). Niche may be blocking scrapers.`,
        );
        return null;
      }

      if (!response.ok) {
        console.log(`  ⚠️ HTTP ${response.status} for ${url}`);
        return null;
      }

      return await response.text();
    } catch (error) {
      console.log(
        `  ❌ Attempt ${attempt}/${retries} failed:`,
        (error as Error).message,
      );
      if (attempt < retries) await sleep(3000);
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Niche HTML Parsers
// ============================================

function parseNicheListPage(html: string, type: string): ScrapedHighSchool[] {
  const $ = cheerio.load(html);
  const schools: ScrapedHighSchool[] = [];

  // Niche search results use .search-result cards
  $(
    '.search-result, [class*="search-result"], .search-result__title, li[class*="result"]',
  ).each((_, elem) => {
    const $el = $(elem);

    // Try multiple selectors for school name
    const nameEl = $el
      .find(
        'a.search-result__title, h2 a, .search-result__title a, a[href*="/k12/"]',
      )
      .first();
    const name = nameEl.text().trim();
    if (!name) return;

    // Extract Niche URL
    const href = nameEl.attr('href');
    const nicheUrl = href?.startsWith('http')
      ? href
      : href
        ? `https://www.niche.com${href}`
        : undefined;

    // Location
    const locationEl = $el
      .find(
        '.search-result__subtitle, .search-result__location, [class*="subtitle"]',
      )
      .first();
    const location = locationEl.text().trim();

    // Grade
    const gradeEl = $el
      .find('.niche__grade, [class*="grade"], .search-result__grade')
      .first();
    const grade = gradeEl
      .text()
      .trim()
      .match(/^([ABCDF][+-]?)$/)?.[1];

    const school: ScrapedHighSchool = {
      name: cleanSchoolName(name),
      country: 'US',
      state: extractState(location),
      city: extractCity(location),
      type,
      nicheGrade: grade,
      nicheUrl,
      source: 'niche',
    };

    schools.push(school);
  });

  // Alternative: Try the newer Niche layout with different selectors
  if (schools.length === 0) {
    $('a[href*="/k12/"]').each((_, elem) => {
      const $el = $(elem);
      const href = $el.attr('href') ?? '';
      // Only school detail links (not category links)
      if (!href.match(/\/k12\/[^/]+\/$/)) return;

      const name = $el.text().trim();
      if (!name || name.length < 3 || name.length > 200) return;

      const parent = $el.closest('li, div[class*="result"], article');
      const locationText = parent
        .find('[class*="subtitle"], [class*="location"]')
        .text()
        .trim();

      schools.push({
        name: cleanSchoolName(name),
        country: 'US',
        state: extractState(locationText),
        city: extractCity(locationText),
        type,
        nicheUrl: `https://www.niche.com${href}`,
        source: 'niche',
      });
    });
  }

  return schools;
}

function cleanSchoolName(name: string): string {
  return name
    .replace(/\s*#\d+\s*/, '') // Remove rank number
    .replace(/^\d+\.\s*/, '') // Remove leading number
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

// ============================================
// Hard-Coded International School Lists
// ============================================

/**
 * International schools that aren't on Niche — curated from public rankings
 * and well-known school directories. These fill the gaps identified in coverage.
 */
function getInternationalSchools(): ScrapedHighSchool[] {
  return [
    // === Switzerland ===
    {
      name: 'Institut Le Rosey',
      nameZh: '萝实学院',
      country: 'CH',
      city: 'Rolle',
      type: 'PRIVATE_OTHER',
      website: 'https://www.rosey.ch',
      source: 'curated',
    },
    {
      name: 'Aiglon College',
      nameZh: '艾格隆学院',
      country: 'CH',
      city: 'Chesières',
      type: 'PRIVATE_OTHER',
      website: 'https://www.aiglon.ch',
      source: 'curated',
    },
    {
      name: 'Collège du Léman',
      nameZh: '莱蒙学院',
      country: 'CH',
      city: 'Versoix',
      type: 'PRIVATE_OTHER',
      website: 'https://www.cdl.ch',
      source: 'curated',
    },
    {
      name: 'Institut Montana Zugerberg',
      nameZh: '蒙塔纳学院',
      country: 'CH',
      city: 'Zug',
      type: 'PRIVATE_OTHER',
      website: 'https://www.montana-zug.ch',
      source: 'curated',
    },
    {
      name: 'Leysin American School',
      nameZh: '莱辛美国学校',
      country: 'CH',
      city: 'Leysin',
      type: 'PRIVATE_OTHER',
      website: 'https://www.las.ch',
      source: 'curated',
    },
    {
      name: 'TASIS The American School in Switzerland',
      nameZh: '瑞士美国学校',
      country: 'CH',
      city: 'Lugano',
      type: 'PRIVATE_OTHER',
      website: 'https://www.tasis.ch',
      source: 'curated',
    },

    // === Australia ===
    {
      name: 'Geelong Grammar School',
      nameZh: '吉朗文法学校',
      country: 'AU',
      city: 'Corio',
      state: 'VIC',
      type: 'PRIVATE_OTHER',
      website: 'https://www.ggs.vic.edu.au',
      source: 'curated',
    },
    {
      name: 'Scotch College Melbourne',
      nameZh: '墨尔本苏格兰学院',
      country: 'AU',
      city: 'Melbourne',
      state: 'VIC',
      type: 'PRIVATE_OTHER',
      website: 'https://www.scotch.vic.edu.au',
      source: 'curated',
    },
    {
      name: "The King's School Parramatta",
      nameZh: '国王学校',
      country: 'AU',
      city: 'Sydney',
      state: 'NSW',
      type: 'PRIVATE_OTHER',
      website: 'https://www.kings.edu.au',
      source: 'curated',
    },
    {
      name: 'Sydney Grammar School',
      nameZh: '悉尼文法学校',
      country: 'AU',
      city: 'Sydney',
      state: 'NSW',
      type: 'PRIVATE_OTHER',
      website: 'https://www.sydgram.nsw.edu.au',
      source: 'curated',
    },
    {
      name: 'Melbourne Grammar School',
      nameZh: '墨尔本文法学校',
      country: 'AU',
      city: 'Melbourne',
      state: 'VIC',
      type: 'PRIVATE_OTHER',
      website: 'https://www.mgs.vic.edu.au',
      source: 'curated',
    },
    {
      name: 'Cranbrook School',
      nameZh: '克兰布鲁克学校',
      country: 'AU',
      city: 'Sydney',
      state: 'NSW',
      type: 'PRIVATE_OTHER',
      website: 'https://www.cranbrook.nsw.edu.au',
      source: 'curated',
    },
    {
      name: 'Brisbane Grammar School',
      nameZh: '布里斯班文法学校',
      country: 'AU',
      city: 'Brisbane',
      state: 'QLD',
      type: 'PRIVATE_OTHER',
      website: 'https://www.brisbanegrammar.com',
      source: 'curated',
    },

    // === UK (additional to existing 8) ===
    {
      name: 'Oundle School',
      nameZh: '昂德尔学校',
      country: 'GB',
      city: 'Oundle',
      type: 'PRIVATE_OTHER',
      website: 'https://www.oundleschool.org.uk',
      source: 'curated',
    },
    {
      name: 'Uppingham School',
      nameZh: '阿平汉学校',
      country: 'GB',
      city: 'Uppingham',
      type: 'PRIVATE_OTHER',
      website: 'https://www.uppingham.co.uk',
      source: 'curated',
    },
    {
      name: 'Cheltenham College',
      nameZh: '切尔滕纳姆学院',
      country: 'GB',
      city: 'Cheltenham',
      type: 'PRIVATE_OTHER',
      website: 'https://www.cheltenhamcollege.org',
      source: 'curated',
    },
    {
      name: 'Tonbridge School',
      nameZh: '汤布里奇学校',
      country: 'GB',
      city: 'Tonbridge',
      type: 'PRIVATE_OTHER',
      website: 'https://www.tonbridge-school.co.uk',
      source: 'curated',
    },
    {
      name: 'Dulwich College',
      nameZh: '德威公学',
      country: 'GB',
      city: 'London',
      type: 'PRIVATE_OTHER',
      website: 'https://www.dulwich.org.uk',
      source: 'curated',
    },
    {
      name: 'Wycombe Abbey',
      nameZh: '威克姆阿贝学校',
      country: 'GB',
      city: 'High Wycombe',
      type: 'PRIVATE_OTHER',
      website: 'https://www.wycombeabbey.com',
      source: 'curated',
    },
    {
      name: 'Brighton College',
      nameZh: '布莱顿学院',
      country: 'GB',
      city: 'Brighton',
      type: 'PRIVATE_OTHER',
      website: 'https://www.brightoncollege.org.uk',
      source: 'curated',
    },
    {
      name: 'Haileybury',
      nameZh: '黑利伯瑞学校',
      country: 'GB',
      city: 'Hertford',
      type: 'PRIVATE_OTHER',
      website: 'https://www.haileybury.com',
      source: 'curated',
    },

    // === China (additional to existing 25) ===
    {
      name: '上海协和双语高级中学',
      country: 'CN',
      city: 'Shanghai',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '上海惠灵顿国际学校',
      country: 'CN',
      city: 'Shanghai',
      type: 'INTL_CN',
      website: 'https://www.wellingtoncollege.cn',
      source: 'curated',
    },
    {
      name: '上海包玉刚实验学校',
      country: 'CN',
      city: 'Shanghai',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '上海星河湾双语学校',
      country: 'CN',
      city: 'Shanghai',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '上海领科教育',
      country: 'CN',
      city: 'Shanghai',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '北京乐成国际学校',
      country: 'CN',
      city: 'Beijing',
      type: 'INTL_CN',
      website: 'https://www.bcis.cn',
      source: 'curated',
    },
    {
      name: '北京王府学校',
      country: 'CN',
      city: 'Beijing',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '北京海嘉国际双语学校',
      country: 'CN',
      city: 'Beijing',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '广东碧桂园学校',
      country: 'CN',
      city: 'Foshan',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '深圳外国语学校国际部',
      country: 'CN',
      city: 'Shenzhen',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '深圳万科梅沙书院',
      country: 'CN',
      city: 'Shenzhen',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '重庆南开中学国际部',
      country: 'CN',
      city: 'Chongqing',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '郑州外国语学校国际部',
      country: 'CN',
      city: 'Zhengzhou',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '济南外国语学校国际部',
      country: 'CN',
      city: 'Jinan',
      type: 'INTL_CN',
      source: 'curated',
    },
    {
      name: '天津南开中学国际部',
      country: 'CN',
      city: 'Tianjin',
      type: 'INTL_CN',
      source: 'curated',
    },
    // CN Public (gaokao track, but significant international applicants)
    {
      name: '北京四中',
      country: 'CN',
      city: 'Beijing',
      type: 'PUBLIC_CN',
      source: 'curated',
    },
    {
      name: '华东师大二附中',
      country: 'CN',
      city: 'Shanghai',
      type: 'PUBLIC_CN',
      source: 'curated',
    },
    {
      name: '复旦附中',
      country: 'CN',
      city: 'Shanghai',
      type: 'PUBLIC_CN',
      source: 'curated',
    },
    {
      name: '南京师范大学附属中学',
      country: 'CN',
      city: 'Nanjing',
      type: 'PUBLIC_CN',
      source: 'curated',
    },
    {
      name: '华南师范大学附属中学',
      country: 'CN',
      city: 'Guangzhou',
      type: 'PUBLIC_CN',
      source: 'curated',
    },
    {
      name: '深圳实验学校高中部',
      country: 'CN',
      city: 'Shenzhen',
      type: 'PUBLIC_CN',
      source: 'curated',
    },

    // === Malaysia ===
    {
      name: 'Harrow International School Malaysia',
      nameZh: '马来西亚哈罗公学',
      country: 'MY',
      city: 'Iskandar Puteri',
      type: 'INTL_OTHER',
      source: 'curated',
    },
    {
      name: 'Marlborough College Malaysia',
      nameZh: '马来西亚马尔堡学院',
      country: 'MY',
      city: 'Iskandar Puteri',
      type: 'INTL_OTHER',
      source: 'curated',
    },

    // === Thailand ===
    {
      name: 'Shrewsbury International School Bangkok',
      nameZh: '曼谷什鲁斯伯里国际学校',
      country: 'TH',
      city: 'Bangkok',
      type: 'INTL_OTHER',
      source: 'curated',
    },
    {
      name: 'Harrow International School Bangkok',
      nameZh: '曼谷哈罗国际学校',
      country: 'TH',
      city: 'Bangkok',
      type: 'INTL_OTHER',
      source: 'curated',
    },

    // === South Korea ===
    {
      name: 'Seoul Foreign School',
      nameZh: '首尔外国人学校',
      country: 'KR',
      city: 'Seoul',
      type: 'INTL_OTHER',
      source: 'curated',
    },
    {
      name: 'Korea International School',
      nameZh: '韩国国际学校',
      country: 'KR',
      city: 'Seoul',
      type: 'INTL_OTHER',
      source: 'curated',
    },
    {
      name: 'Chadwick International School',
      nameZh: '查德威克国际学校',
      country: 'KR',
      city: 'Incheon',
      type: 'INTL_OTHER',
      source: 'curated',
    },

    // === Japan ===
    {
      name: 'American School in Japan',
      nameZh: '日本美国学校',
      country: 'JP',
      city: 'Tokyo',
      type: 'INTL_OTHER',
      source: 'curated',
    },

    // === UAE ===
    {
      name: 'Dubai College',
      nameZh: '迪拜学院',
      country: 'AE',
      city: 'Dubai',
      type: 'INTL_OTHER',
      source: 'curated',
    },
    {
      name: 'GEMS World Academy Dubai',
      nameZh: 'GEMS世界学院',
      country: 'AE',
      city: 'Dubai',
      type: 'INTL_OTHER',
      source: 'curated',
    },

    // === Taiwan ===
    {
      name: 'Taipei American School',
      nameZh: '台北美国学校',
      country: 'TW',
      city: 'Taipei',
      type: 'INTL_OTHER',
      website: 'https://www.tas.edu.tw',
      source: 'curated',
    },
    {
      name: 'Taipei European School',
      nameZh: '台北欧洲学校',
      country: 'TW',
      city: 'Taipei',
      type: 'INTL_OTHER',
      source: 'curated',
    },

    // === Vietnam ===
    {
      name: 'Saigon South International School',
      nameZh: '西贡南方国际学校',
      country: 'VN',
      city: 'Ho Chi Minh City',
      type: 'INTL_OTHER',
      source: 'curated',
    },
    {
      name: 'British International School Ho Chi Minh City',
      nameZh: '胡志明市英国国际学校',
      country: 'VN',
      city: 'Ho Chi Minh City',
      type: 'INTL_OTHER',
      source: 'curated',
    },

    // === Philippines ===
    {
      name: 'International School Manila',
      nameZh: '马尼拉国际学校',
      country: 'PH',
      city: 'Manila',
      type: 'INTL_OTHER',
      source: 'curated',
    },
  ];
}

// ============================================
// De-duplication
// ============================================

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['''`]/g, "'")
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function deduplicate(schools: ScrapedHighSchool[]): ScrapedHighSchool[] {
  const seen = new Map<string, ScrapedHighSchool>();

  for (const school of schools) {
    const key = `${normalizeName(school.name)}|${school.country}`;
    if (!seen.has(key)) {
      seen.set(key, school);
    }
  }

  return Array.from(seen.values());
}

// ============================================
// Main
// ============================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 500;
  const categoryArg = args.find((a) => a.startsWith('--category='));
  const categoryFilter = categoryArg?.split('=')[1];

  console.log('🏫 Niche High School Scraper');
  console.log('='.repeat(50));
  console.log(`  Limit: ${limit}`);
  console.log(`  Category: ${categoryFilter ?? 'all'}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log('');

  const allSchools: ScrapedHighSchool[] = [];

  // 1. Scrape Niche categories
  const categories = categoryFilter
    ? Object.entries(NICHE_CATEGORIES).filter(([k]) =>
        k.startsWith(categoryFilter),
      )
    : Object.entries(NICHE_CATEGORIES);

  for (const [catName, config] of categories) {
    console.log(`\n📂 Category: ${catName} (${config.type})`);

    for (let page = 1; page <= config.pages; page++) {
      const url = page === 1 ? config.url : `${config.url}?page=${page}`;
      console.log(`  📄 Page ${page}/${config.pages}: ${url}`);

      const html = await fetchWithRetry(url);
      if (!html) {
        console.log(`  ⚠️ Failed to fetch page ${page}, skipping`);
        continue;
      }

      const schools = parseNicheListPage(html, config.type);
      console.log(`  ✅ Found ${schools.length} schools`);
      allSchools.push(...schools);

      // Rate limit between pages
      if (page < config.pages) {
        await sleep(3000 + Math.random() * 2000);
      }
    }

    // Rate limit between categories
    await sleep(5000 + Math.random() * 3000);
  }

  // 2. Add curated international schools
  console.log('\n📂 Adding curated international schools...');
  const intlSchools = getInternationalSchools();
  console.log(`  ✅ ${intlSchools.length} international schools`);
  allSchools.push(...intlSchools);

  // 3. Deduplicate
  const unique = deduplicate(allSchools);
  console.log(
    `\n📊 Total scraped: ${allSchools.length}, unique: ${unique.length}`,
  );

  // 4. Limit
  const final = unique.slice(0, limit);

  // 5. Output
  const outputDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'scraped-high-schools.json');
  fs.writeFileSync(outputPath, JSON.stringify(final, null, 2));
  console.log(`\n💾 Saved ${final.length} schools to ${outputPath}`);

  // Print summary
  const byCountry: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const s of final) {
    byCountry[s.country] = (byCountry[s.country] ?? 0) + 1;
    byType[s.type] = (byType[s.type] ?? 0) + 1;
  }

  console.log('\n📊 Summary by country:');
  for (const [country, count] of Object.entries(byCountry).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${country}: ${count}`);
  }

  console.log('\n📊 Summary by type:');
  for (const [type, count] of Object.entries(byType).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${type}: ${count}`);
  }
}

main().catch(console.error);
