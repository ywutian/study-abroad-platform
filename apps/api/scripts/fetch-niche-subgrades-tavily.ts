/**
 * Fetch missing Niche sub-grades (safety, life, food) for schools that
 * already have an overall grade but are missing sub-grades.
 *
 * Uses targeted campus-life / safety subpage queries to find grades that
 * the main page search often misses.
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/fetch-niche-subgrades-tavily.ts
 *   pnpm --filter api exec tsx scripts/fetch-niche-subgrades-tavily.ts --dry-run
 *   pnpm --filter api exec tsx scripts/fetch-niche-subgrades-tavily.ts --limit=50
 *   pnpm --filter api exec tsx scripts/fetch-niche-subgrades-tavily.ts --field=nicheSafetyGrade
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  return ((data as any).results ?? []).map(
    (r: { url: string; content?: string }) => ({
      url: r.url,
      content: r.content ?? '',
    }),
  );
}

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
    const window = text.slice(Math.max(0, idx - 200), idx + 200);
    const matches = [...window.matchAll(GRADE_RE)];
    for (const m of matches) {
      if (VALID_GRADES.has(m[1])) return m[1];
    }
  }
  return null;
}

function extractGradeBroad(text: string, keywords: string[]): string | null {
  // Pattern 1: keyword followed closely by grade
  for (const kw of keywords) {
    const re = new RegExp(
      kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^A-Z]{0,30}([ABCDF][+-]?)',
      'i',
    );
    const m = text.match(re);
    if (m && VALID_GRADES.has(m[1])) return m[1];
  }
  // Pattern 2: "grade X+. Keyword" — Niche's format where grade precedes the label
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

  const safety =
    extractGrade(combined, [
      'safety grade',
      'campus safety',
      'crime & safety',
      'safety:',
      'safety\n',
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

  return { safety, life, food };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 999;
  const fieldArg = args.find((a) => a.startsWith('--field='));
  const targetField = fieldArg ? fieldArg.split('=')[1] : null;

  const keys = loadTavilyKeys();
  if (keys.length === 0) {
    console.error('No TAVILY_API_KEY found in env');
    process.exit(1);
  }
  console.log(`\n🎓 Niche Sub-Grades via Tavily (${keys.length} keys)`);
  console.log(
    `   Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'} | Limit: ${limit} | Field: ${targetField ?? 'any-missing'}\n`,
  );

  // Find schools that have overall grade but are missing sub-grades
  const whereCondition: Record<string, unknown> = {
    country: 'US',
    nicheOverallGrade: { not: null },
  };

  if (targetField === 'nicheSafetyGrade') {
    whereCondition.nicheSafetyGrade = null;
  } else if (targetField === 'nicheLifeGrade') {
    whereCondition.nicheLifeGrade = null;
  } else if (targetField === 'nicheFoodGrade') {
    whereCondition.nicheFoodGrade = null;
  } else {
    // Target schools missing any sub-grade
    whereCondition.OR = [
      { nicheSafetyGrade: null },
      { nicheLifeGrade: null },
      { nicheFoodGrade: null },
    ];
  }

  const schools = await prisma.school.findMany({
    where: whereCondition as any,
    select: {
      id: true,
      name: true,
      nicheOverallGrade: true,
      nicheSafetyGrade: true,
      nicheLifeGrade: true,
      nicheFoodGrade: true,
    },
    orderBy: [{ usNewsRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    take: limit,
  });

  console.log(`Found ${schools.length} schools to process\n`);

  const stats = { updated: 0, notFound: 0, errors: 0 };

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const missing = [
      !school.nicheSafetyGrade && 'safety',
      !school.nicheLifeGrade && 'life',
      !school.nicheFoodGrade && 'food',
    ]
      .filter(Boolean)
      .join(', ');
    const prefix = `[${i + 1}/${schools.length}] ${school.name} (missing: ${missing})`;

    try {
      // First query: campus-life page specifically for safety + life + food
      const query1 = `"${school.name}" niche campus life safety food grade`;
      const results1 = await tavilySearch(query1, nextKey(keys));
      const nicheResults1 = results1.filter((r) =>
        r.url.includes('niche.com/colleges/'),
      );

      let grades = extractAllGrades(nicheResults1);

      // Second query if still missing safety specifically (campus-life subpage)
      if (!grades.safety) {
        const query2 = `"${school.name}" niche campus safety grade crime`;
        const results2 = await tavilySearch(query2, nextKey(keys));
        const nicheResults2 = results2.filter((r) =>
          r.url.includes('niche.com/colleges/'),
        );
        if (nicheResults2.length > 0) {
          const g2 = extractAllGrades([...nicheResults1, ...nicheResults2]);
          grades = {
            safety: grades.safety ?? g2.safety,
            life: grades.life ?? g2.life,
            food: grades.food ?? g2.food,
          };
        }
      }

      const update: Record<string, string> = {};
      // Only set fields that are currently null
      if (!school.nicheSafetyGrade && grades.safety)
        update.nicheSafetyGrade = grades.safety;
      if (!school.nicheLifeGrade && grades.life)
        update.nicheLifeGrade = grades.life;
      if (!school.nicheFoodGrade && grades.food)
        update.nicheFoodGrade = grades.food;

      if (Object.keys(update).length === 0) {
        console.log(`  ○  ${prefix} → no grades found`);
        stats.notFound++;
      } else {
        const filled = Object.entries(update)
          .map(
            ([k, v]) => `${k.replace('niche', '').replace('Grade', '')}=${v}`,
          )
          .join(', ');

        if (!dryRun) {
          await prisma.school.update({
            where: { id: school.id },
            data: update,
          });
        }
        console.log(`  ✅ ${prefix} → ${filled}`);
        stats.updated++;
      }
    } catch (err: unknown) {
      console.error(
        `  ❌ ${prefix} → ${err instanceof Error ? err.message : String(err)}`,
      );
      stats.errors++;
    }

    // Rate limit: ~2 req/sec (2 queries per school max)
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log('\n=== RESULTS ===');
  console.log(`  Updated:   ${stats.updated}`);
  console.log(`  Not found: ${stats.notFound}`);
  console.log(`  Errors:    ${stats.errors}`);

  if (dryRun) {
    console.log(
      '\n⚠️  DRY-RUN: no DB writes. Re-run without --dry-run to apply.',
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
