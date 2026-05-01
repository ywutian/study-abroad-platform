/**
 * Fetch Niche grades for all US schools via Tavily search
 *
 * Tavily has indexed niche.com — search returns snippets with grade letters.
 * Much more reliable than direct scraping (no 403, no bot detection).
 *
 * Fields filled:
 *   nicheOverallGrade, nicheSafetyGrade, nicheLifeGrade, nicheFoodGrade
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/fetch-niche-grades-tavily.ts
 *   pnpm --filter api exec tsx scripts/fetch-niche-grades-tavily.ts --dry-run
 *   pnpm --filter api exec tsx scripts/fetch-niche-grades-tavily.ts --limit=50
 */

import 'dotenv/config';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Load Tavily keys (same rotation as other scripts)
function loadTavilyKeys(): string[] {
  const keys: string[] = [];
  if (process.env.TAVILY_API_KEY) keys.push(process.env.TAVILY_API_KEY);
  for (let i = 1; i <= 99; i++) {
    const k = process.env[`TAVILY_API_KEY_${i}`];
    if (k) keys.push(k);
  }
  return [...new Set(keys)];
}

let keyIndex = 0;
function nextKey(keys: string[]): string {
  const k = keys[keyIndex % keys.length];
  keyIndex++;
  return k;
}

async function tavilySearch(
  query: string,
  key: string,
): Promise<{ url: string; content: string }[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: 5,
      search_depth: 'advanced',
      include_domains: ['niche.com'],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const results: { url: string; content: string }[] = (data.results ?? []).map(
    (r: { url: string; content?: string }) => ({
      url: r.url,
      content: r.content ?? '',
    }),
  );
  // Prefer main college page over subpages — sort so /colleges/slug/ (no trailing path) comes first
  results.sort((a, b) => {
    const aMain = /\/colleges\/[^/]+\/?$/.test(a.url) ? 0 : 1;
    const bMain = /\/colleges\/[^/]+\/?$/.test(b.url) ? 0 : 1;
    return aMain - bMain;
  });
  return results;
}

// Extract grade letter from text: looks for "A+", "A", "A-", "B+", etc.
// near keyword context
const GRADE_RE = /\b([ABCDF][+-]?)\b/g;
const VALID_GRADES = new Set([
  'A+',
  'A',
  'A-',
  'B+',
  'B',
  'B-',
  'C+',
  'C',
  'C-',
  'D+',
  'D',
  'D-',
  'F',
]);

function extractGrade(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    // Look at 200 chars AFTER and 200 chars BEFORE the keyword for a grade
    const window = text.slice(Math.max(0, idx - 200), idx + 200);
    const matches = [...window.matchAll(GRADE_RE)];
    for (const m of matches) {
      if (VALID_GRADES.has(m[1])) return m[1];
    }
  }
  return null;
}

// Broad extraction: scan the entire combined text for grade-adjacent patterns
function extractGradeBroad(text: string, keywords: string[]): string | null {
  // Pattern 1: keyword followed closely by grade, e.g. "Overall Grade A+" or "Safety: A"
  for (const kw of keywords) {
    const re = new RegExp(
      kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^A-Z]{0,30}([ABCDF][+-]?)',
      'i',
    );
    const m = text.match(re);
    if (m && VALID_GRADES.has(m[1])) return m[1];
  }
  // Pattern 2: "grade X+. Keyword" — Niche's structured format where grade precedes the label
  // e.g. "grade A+. Overall Grade" or "grade B. Safety"
  for (const kw of keywords) {
    const re = new RegExp(
      'grade\\s+([ABCDF][+-]?)\\.?\\s*' +
        kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i',
    );
    const m = text.match(re);
    if (m && VALID_GRADES.has(m[1])) return m[1];
  }
  return null;
}

function extractAllGrades(results: { url: string; content: string }[]) {
  const combined = results.map((r) => r.content).join('\n');

  const overall =
    extractGrade(combined, [
      'overall niche grade',
      'overall grade',
      'niche grade',
      'overall:',
    ]) ?? extractGradeBroad(combined, ['overall', 'niche grade']);
  const safety =
    extractGrade(combined, [
      'safety grade',
      'campus safety',
      'crime & safety',
      'safety:',
    ]) ?? extractGradeBroad(combined, ['safety', 'crime']);
  const life =
    extractGrade(combined, [
      'student life grade',
      'student life',
      'campus life',
      'life:',
    ]) ?? extractGradeBroad(combined, ['student life', 'campus life']);
  const food =
    extractGrade(combined, ['food grade', 'campus food', 'dining', 'food:']) ??
    extractGradeBroad(combined, ['food', 'dining']);

  return { overall, safety, life, food };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 999;
  const onlyMissing = !args.includes('--all');

  const keys = loadTavilyKeys();
  if (keys.length === 0) {
    console.error('No TAVILY_API_KEY found in env');
    process.exit(1);
  }
  console.log(`\n🎓 Niche Grades via Tavily (${keys.length} keys)`);
  console.log(
    `   Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'} | Limit: ${limit} | Only-missing: ${onlyMissing}\n`,
  );

  const where = onlyMissing
    ? { country: 'US', nicheOverallGrade: null }
    : { country: 'US' };

  const schools = await prisma.school.findMany({
    where,
    select: { id: true, name: true, nicheOverallGrade: true },
    orderBy: [{ usNewsRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    take: limit,
  });

  console.log(`Found ${schools.length} schools to process\n`);

  const stats = { found: 0, updated: 0, notFound: 0, errors: 0 };

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const prefix = `[${i + 1}/${schools.length}] ${school.name}`;

    try {
      const query = `${school.name} niche grades overall safety food student life`;
      const results = await tavilySearch(query, nextKey(keys));

      // Filter to niche.com college pages only
      const nicheResults = results.filter((r) =>
        r.url.includes('niche.com/colleges/'),
      );

      if (nicheResults.length === 0) {
        console.log(`  ○  ${prefix} → no niche.com result`);
        stats.notFound++;
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      let grades = extractAllGrades(nicheResults);

      // Fallback: if no grades found, try a more targeted query that pulls the academics subpage
      // (Niche formats grades as "grade A+. Overall Grade" on subpages — Tavily sometimes only returns main page)
      if (!grades.overall && !grades.safety && !grades.life && !grades.food) {
        const fallbackQuery = `"${school.name}" site:niche.com/colleges overall grade academics`;
        const fallbackResults = await tavilySearch(
          fallbackQuery,
          nextKey(keys),
        );
        const fallbackNiche = fallbackResults.filter((r) =>
          r.url.includes('niche.com/colleges/'),
        );
        if (fallbackNiche.length > 0) {
          grades = extractAllGrades([...nicheResults, ...fallbackNiche]);
        }
      }

      if (!grades.overall && !grades.safety && !grades.life && !grades.food) {
        console.log(
          `  ⚠️  ${prefix} → found page but no grades extracted (${nicheResults[0].url})`,
        );
        stats.notFound++;
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      const update: Record<string, string | null> = {};
      if (grades.overall) update.nicheOverallGrade = grades.overall;
      if (grades.safety) update.nicheSafetyGrade = grades.safety;
      if (grades.life) update.nicheLifeGrade = grades.life;
      if (grades.food) update.nicheFoodGrade = grades.food;

      const filled = Object.entries(update)
        .map(([k, v]) => `${k.replace('niche', '').replace('Grade', '')}=${v}`)
        .join(', ');

      if (!dryRun) {
        await prisma.school.update({ where: { id: school.id }, data: update });
      }

      console.log(`  ✅ ${prefix} → ${filled}`);
      stats.found++;
      stats.updated++;
    } catch (err: unknown) {
      console.error(
        `  ❌ ${prefix} → ${err instanceof Error ? err.message : String(err)}`,
      );
      stats.errors++;
    }

    // Rate limit: ~2/sec
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\n=== RESULTS ===');
  console.log(`  Found:    ${stats.found}`);
  console.log(`  Updated:  ${stats.updated}`);
  console.log(`  Not found: ${stats.notFound}`);
  console.log(`  Errors:   ${stats.errors}`);

  if (dryRun)
    console.log(
      '\n⚠️  DRY-RUN: no DB writes. Re-run without --dry-run to apply.',
    );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
