/**
 * Fetch "percent of need met" from CollegeBoard BigFuture for all US schools missing it.
 *
 * BigFuture (bigfuture.collegeboard.org) shows "Percent of Need Met: X%"
 * in the tuition-and-costs page for each college. Tavily reliably indexes it.
 *
 * Valid range: 20% – 110% (schools can meet 100%+ with grants over EFC).
 *
 * Usage:
 *   pnpm --filter api exec tsx scripts/fetch-percent-need-met-niche.ts
 *   pnpm --filter api exec tsx scripts/fetch-percent-need-met-niche.ts --dry-run
 *   pnpm --filter api exec tsx scripts/fetch-percent-need-met-niche.ts --limit=50
 *   pnpm --filter api exec tsx scripts/fetch-percent-need-met-niche.ts --all   # overwrite existing
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Tavily key rotation (same pattern as other scripts) ──────────────────────
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
  includeDomains: string[],
): Promise<{ url: string; content: string }[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: 5,
      search_depth: 'advanced',
      include_domains: includeDomains,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 432 = quota exceeded on this key — rotate silently
    if (res.status !== 432) {
      console.warn(`  ⚠️  Tavily ${res.status}: ${body.slice(0, 80)}`);
    }
    return [];
  }
  const data = await res.json();
  return ((data as any).results ?? []).map(
    (r: { url: string; content?: string }) => ({
      url: r.url,
      content: r.content ?? '',
    }),
  );
}

// ── Extraction patterns ──────────────────────────────────────────────────────
// BigFuture format:  "Percent of Need Met\n\n100%"
// Niche/other:       "meets 100% of demonstrated financial need"
//                    "100% of need met"
const PATTERNS: RegExp[] = [
  /percent\s+of\s+need\s+met[:\s\n]+(\d{1,3})\s*%/i, // BigFuture primary
  /meets?\s+(\d{1,3})\s*%\s+of\s+(?:demonstrated\s+)?(?:financial\s+)?need/i,
  /(\d{1,3})\s*%\s+of\s+(?:demonstrated\s+)?(?:financial\s+)?need\s+(?:is\s+)?met/i,
  /(?:average\s+)?(?:percent|%)\s+of\s+need\s+met[:\s]+(\d{1,3})/i,
  /need\s+met[:\s]+(\d{1,3})\s*%/i,
  /financial\s+need\s+met[:\s]+(\d{1,3})\s*%/i,
  /avg\.?\s+%\s+of\s+need\s+met[:\s]+(\d{1,3})/i,
];

const MIN_VALID = 20;
const MAX_VALID = 110; // some schools offer aid over 100% EFC

function extractPercentNeedMet(
  results: { url: string; content: string }[],
): number | null {
  const combined = results.map((r) => r.content).join('\n\n');

  for (const pattern of PATTERNS) {
    const m = combined.match(pattern);
    if (m) {
      const value = parseInt(m[1], 10);
      if (value >= MIN_VALID && value <= MAX_VALID) {
        return value;
      }
    }
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const overwriteAll = args.includes('--all');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 999;

  const keys = loadTavilyKeys();
  if (keys.length === 0) {
    console.error('No TAVILY_API_KEY found in env');
    process.exit(1);
  }
  console.log(
    `\n💰 Percent-Need-Met via BigFuture/Tavily (${keys.length} keys)`,
  );
  console.log(
    `   Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'} | Limit: ${limit} | Overwrite: ${overwriteAll}\n`,
  );

  const where = overwriteAll
    ? { country: 'US' }
    : { country: 'US', percentNeedMet: null };

  const schools = await prisma.school.findMany({
    where: where as any,
    select: {
      id: true,
      name: true,
      percentNeedMet: true,
      acceptanceRate: true,
    },
    orderBy: [{ usNewsRank: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }],
    take: limit,
  });

  console.log(`Found ${schools.length} schools to process\n`);

  const stats = { updated: 0, notFound: 0, errors: 0 };

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const prefix = `[${i + 1}/${schools.length}] ${school.name}`;

    try {
      // Query 1: BigFuture tuition-and-costs page (most reliable — shows "Percent of Need Met: X%")
      const query1 = `"${school.name}" bigfuture "percent of need met" tuition costs financial aid`;
      const results1 = await tavilySearch(query1, nextKey(keys), [
        'bigfuture.collegeboard.org',
      ]);

      let value = extractPercentNeedMet(results1);

      // Query 2 fallback: broader search across CollegeBoard + appily + niche
      if (value === null) {
        const query2 = `"${school.name}" "percent of need met" financial aid`;
        const results2 = await tavilySearch(query2, nextKey(keys), [
          'bigfuture.collegeboard.org',
          'appily.com',
          'niche.com',
        ]);
        value = extractPercentNeedMet([...results1, ...results2]);
      }

      if (value === null) {
        console.log(`  ○  ${prefix} → not found`);
        stats.notFound++;
      } else {
        if (!dryRun) {
          await prisma.school.update({
            where: { id: school.id },
            data: { percentNeedMet: value },
          });
        }
        const existing = school.percentNeedMet
          ? ` (was ${school.percentNeedMet}%)`
          : '';
        console.log(`  ✅ ${prefix} → ${value}%${existing}`);
        stats.updated++;
      }
    } catch (err: unknown) {
      console.error(
        `  ❌ ${prefix} → ${err instanceof Error ? err.message : String(err)}`,
      );
      stats.errors++;
    }

    // Rate limit: ~2 req/sec (2 Tavily calls per school max)
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log('\n=== RESULTS ===');
  console.log(`  Updated:   ${stats.updated}`);
  console.log(`  Not found: ${stats.notFound}`);
  console.log(`  Errors:    ${stats.errors}`);
  const pct =
    schools.length > 0
      ? ((stats.updated / schools.length) * 100).toFixed(1)
      : '0.0';
  console.log(`  Hit rate:  ${pct}%`);

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
