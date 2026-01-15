/**
 * Niche.com Grade Scraper Script
 *
 * Fetches Safety, Campus Life (Happiness), and Food grades from Niche.com
 * for schools in the database.
 *
 * Usage: npx ts-node scripts/scrape-niche-grades.ts [--limit=N] [--school="School Name"]
 *
 * Note: Web scraping Niche.com may violate their Terms of Service.
 * Consider using their official API or data partnerships for production use.
 */

import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

interface NicheGrades {
  nicheSafetyGrade: string | null;
  nicheLifeGrade: string | null;
  nicheFoodGrade: string | null;
  nicheOverallGrade: string | null;
}

// Convert school name to Niche URL slug
function schoolNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Build Niche URL for a school
function getNicheUrl(schoolName: string): string {
  const slug = schoolNameToSlug(schoolName);
  return `https://www.niche.com/colleges/${slug}/`;
}

// Parse grade from Niche HTML
function parseGrade(gradeText: string | undefined): string | null {
  if (!gradeText) return null;

  // Extract grade letter (A+, A, A-, B+, etc.)
  const gradeMatch = gradeText.trim().match(/^([ABCDF][+-]?)$/);
  if (gradeMatch) {
    return gradeMatch[1];
  }

  return null;
}

// Fetch and parse Niche grades for a school
async function fetchNicheGrades(
  schoolName: string,
): Promise<NicheGrades | null> {
  const url = getNicheUrl(schoolName);

  console.log(`  📥 Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`  ⚠️ School not found on Niche: ${schoolName}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const grades: NicheGrades = {
      nicheSafetyGrade: null,
      nicheLifeGrade: null,
      nicheFoodGrade: null,
      nicheOverallGrade: null,
    };

    // Try to find grade cards/sections
    // Niche typically displays grades in card format with the category name and grade letter

    // Method 1: Look for grade sections
    $('[class*="grade"], [class*="Grade"]').each((_, elem) => {
      const text = $(elem).text().toLowerCase();
      const gradeElem = $(elem)
        .find('[class*="niche__grade"], .grade-letter, [class*="grade"]')
        .first();
      const gradeText =
        gradeElem.text().trim() ||
        $(elem)
          .text()
          .match(/[ABCDF][+-]?/)?.[0];

      if (text.includes('safety') || text.includes('crime')) {
        grades.nicheSafetyGrade =
          parseGrade(gradeText) || grades.nicheSafetyGrade;
      } else if (
        text.includes('campus') ||
        text.includes('student life') ||
        text.includes('happiness')
      ) {
        grades.nicheLifeGrade = parseGrade(gradeText) || grades.nicheLifeGrade;
      } else if (text.includes('food') || text.includes('dining')) {
        grades.nicheFoodGrade = parseGrade(gradeText) || grades.nicheFoodGrade;
      } else if (text.includes('overall') && !text.includes('academics')) {
        grades.nicheOverallGrade =
          parseGrade(gradeText) || grades.nicheOverallGrade;
      }
    });

    // Method 2: Look for data attributes
    $('[data-grade]').each((_, elem) => {
      const category =
        $(elem).attr('data-category') || $(elem).text().toLowerCase();
      const grade = $(elem).attr('data-grade');

      if (category.includes('safety')) {
        grades.nicheSafetyGrade = parseGrade(grade) || grades.nicheSafetyGrade;
      } else if (category.includes('campus') || category.includes('life')) {
        grades.nicheLifeGrade = parseGrade(grade) || grades.nicheLifeGrade;
      } else if (category.includes('food')) {
        grades.nicheFoodGrade = parseGrade(grade) || grades.nicheFoodGrade;
      }
    });

    // Method 3: Search for specific text patterns
    const bodyText = $('body').text();

    // Pattern: "Safety: A+" or "Campus Life A-"
    const safetyMatch = bodyText.match(/Safety[:\s]+([ABCDF][+-]?)/i);
    const lifeMatch = bodyText.match(
      /(?:Campus Life|Student Life)[:\s]+([ABCDF][+-]?)/i,
    );
    const foodMatch = bodyText.match(/(?:Food|Dining)[:\s]+([ABCDF][+-]?)/i);
    const overallMatch = bodyText.match(/Overall[:\s]+([ABCDF][+-]?)/i);

    if (safetyMatch && !grades.nicheSafetyGrade) {
      grades.nicheSafetyGrade = safetyMatch[1];
    }
    if (lifeMatch && !grades.nicheLifeGrade) {
      grades.nicheLifeGrade = lifeMatch[1];
    }
    if (foodMatch && !grades.nicheFoodGrade) {
      grades.nicheFoodGrade = foodMatch[1];
    }
    if (overallMatch && !grades.nicheOverallGrade) {
      grades.nicheOverallGrade = overallMatch[1];
    }

    return grades;
  } catch (error) {
    console.error(`  ❌ Error fetching ${schoolName}:`, error);
    return null;
  }
}

// Update school in database with Niche grades
async function updateSchoolGrades(
  schoolId: string,
  grades: NicheGrades,
): Promise<void> {
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
    console.log(`  ✅ Updated grades:`, updateData);
  } else {
    console.log(`  ⚠️ No grades found to update`);
  }
}

// Main function
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Parse arguments
  let limit = 10;
  let schoolFilter: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--school=')) {
      schoolFilter = arg.split('=')[1].replace(/"/g, '');
    }
  }

  console.log('🎓 Niche Grade Scraper');
  console.log('='.repeat(50));
  console.log(`📊 Limit: ${limit} schools`);
  if (schoolFilter) console.log(`🔍 Filter: ${schoolFilter}`);
  console.log('');

  try {
    // Get schools from database
    const whereClause: Record<string, unknown> = {};

    if (schoolFilter) {
      whereClause.name = { contains: schoolFilter, mode: 'insensitive' };
    }

    // Prioritize schools without Niche grades
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

      const grades = await fetchNicheGrades(school.name);

      if (
        grades &&
        (grades.nicheSafetyGrade ||
          grades.nicheLifeGrade ||
          grades.nicheFoodGrade)
      ) {
        await updateSchoolGrades(school.id, grades);
        updated++;
      } else {
        failed++;
      }

      // Rate limiting: wait 2 seconds between requests
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📋 Total: ${schools.length}`);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run
main().catch(console.error);
