#!/usr/bin/env tsx
/**
 * Seed SchoolRanking table from existing School.usNewsRank field.
 *
 * Phase A (zero cost): bulk insert ~220 national university rankings from usNewsRank.
 * Phase B (~30 Tavily): specialist rankings (CS, Business, Engineering) from US News pages.
 *
 * Usage:
 *   npx tsx scripts/seed-school-rankings.ts
 *   npx tsx scripts/seed-school-rankings.ts --dry-run
 *   npx tsx scripts/seed-school-rankings.ts --phase=A   (zero cost only)
 *   npx tsx scripts/seed-school-rankings.ts --phase=B   (specialist only)
 */

import 'dotenv/config';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Tavily key rotation
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
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: 5,
        search_depth: 'advanced',
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((r: { url: string; content?: string }) => ({
      url: r.url,
      content: r.content ?? '',
    }));
  } catch {
    return [];
  }
}

// Parse a ranking list from Tavily content snippets
// Looks for patterns like "1. Harvard" or "#1 Harvard" or "Rank 1: Harvard"
function parseRankings(
  content: string,
  schoolNames: string[],
): Map<string, number> {
  const result = new Map<string, number>();
  const normMap = new Map<string, string>();
  for (const name of schoolNames) {
    normMap.set(name.toLowerCase().replace(/[^a-z0-9 ]/g, ''), name);
  }

  // Try to find rank+name pairs in text
  const lines = content.split('\n');
  for (const line of lines) {
    // Match "1. University Name" or "#1 University Name" or "1 University Name"
    const m = line.match(/^#?(\d{1,3})[\.\):\s]+(.+)$/);
    if (!m) continue;
    const rank = parseInt(m[1]);
    const rawName = m[2]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '');

    // Find closest matching school
    for (const [normName, origName] of normMap) {
      if (
        rawName.includes(normName) ||
        normName.includes(rawName.substring(0, 20))
      ) {
        if (!result.has(origName)) {
          result.set(origName, rank);
        }
        break;
      }
    }
  }
  return result;
}

async function phaseA(dryRun: boolean): Promise<number> {
  console.log(
    '\n📊 Phase A: Seeding national university rankings from usNewsRank...',
  );

  const schools = await prisma.school.findMany({
    where: { country: 'US', usNewsRank: { not: null } },
    select: { id: true, name: true, usNewsRank: true },
    orderBy: { usNewsRank: 'asc' },
  });

  console.log(`  Found ${schools.length} schools with usNewsRank`);

  if (dryRun) {
    console.log(
      `  [DRY RUN] Would insert ${schools.length} SchoolRanking rows`,
    );
    return schools.length;
  }

  const data = schools.map((s) => ({
    schoolId: s.id,
    source: 'US_NEWS' as const,
    list: 'NATIONAL_UNIVERSITY' as const,
    rank: s.usNewsRank!,
    year: 2025,
    sourceUrl:
      'https://www.usnews.com/best-colleges/rankings/national-universities',
  }));

  const result = await prisma.schoolRanking.createMany({
    data,
    skipDuplicates: true,
  });
  console.log(`  ✅ Inserted ${result.count} SchoolRanking rows`);
  return result.count;
}

interface RankingSpec {
  label: string;
  list: string;
  query: string;
}

async function phaseB(dryRun: boolean, tavilyKeys: string[]): Promise<number> {
  if (tavilyKeys.length === 0) {
    console.log('\n⚠️  Phase B skipped: no Tavily keys');
    return 0;
  }

  console.log('\n🔍 Phase B: Fetching specialist rankings via Tavily...');

  const allSchools = await prisma.school.findMany({
    where: { country: 'US' },
    select: { id: true, name: true, nameNorm: true },
  });
  const schoolNames = allSchools.map((s) => s.name);

  const specs: RankingSpec[] = [
    {
      label: 'CS Graduate',
      list: 'CS_GRADUATE',
      query:
        'US News best computer science graduate programs rankings 2024 site:usnews.com',
    },
    {
      label: 'Engineering Graduate',
      list: 'ENGINEERING_GRADUATE',
      query:
        'US News best engineering graduate schools rankings 2024 site:usnews.com',
    },
    {
      label: 'Business MBA',
      list: 'MBA',
      query: 'US News best MBA business programs rankings 2024 site:usnews.com',
    },
  ];

  let totalInserted = 0;

  for (const spec of specs) {
    console.log(`  Searching: ${spec.label}...`);
    const key = nextKey(tavilyKeys);
    const results = await tavilySearch(spec.query, key);
    const combinedContent = results.map((r) => r.content).join('\n');

    const rankings = parseRankings(combinedContent, schoolNames);
    console.log(`    Found ${rankings.size} rankings`);

    if (rankings.size === 0) continue;

    const nameToId = new Map(allSchools.map((s) => [s.name, s.id]));
    const data: {
      schoolId: string;
      source: string;
      list: string;
      rank: number;
      year: number;
      sourceUrl: string;
    }[] = [];

    for (const [name, rank] of rankings) {
      const schoolId = nameToId.get(name);
      if (!schoolId) continue;
      data.push({
        schoolId,
        source: 'US_NEWS',
        list: spec.list,
        rank,
        year: 2024,
        sourceUrl: results[0]?.url ?? 'https://www.usnews.com',
      });
    }

    if (!dryRun && data.length > 0) {
      const inserted = await prisma.schoolRanking.createMany({
        data: data as any,
        skipDuplicates: true,
      });
      console.log(`    ✅ ${spec.label}: inserted ${inserted.count} rows`);
      totalInserted += inserted.count;
    } else if (dryRun) {
      console.log(`    [DRY RUN] Would insert ${data.length} rows`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return totalInserted;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const phaseArg = args.find((a) => a.startsWith('--phase='))?.split('=')[1];

  console.log('🚀 School Rankings Seeder');
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  const existing = await prisma.schoolRanking.count();
  if (existing > 200 && !args.includes('--force')) {
    console.log(
      `\n✅ Already have ${existing} ranking rows — skipping (use --force to override)`,
    );
    await prisma.$disconnect();
    return;
  }

  const tavilyKeys = loadTavilyKeys();
  let total = 0;

  if (!phaseArg || phaseArg === 'A') {
    total += await phaseA(dryRun);
  }

  if (!phaseArg || phaseArg === 'B') {
    total += await phaseB(dryRun, tavilyKeys);
  }

  console.log(`\n📈 Total inserted: ${total}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
