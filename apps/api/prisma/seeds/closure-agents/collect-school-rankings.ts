#!/usr/bin/env tsx
/**
 * collect-school-rankings.ts
 *
 * Multi-source school-ranking applier. Reads the committed, Claude-collected
 * published ranking tables from `prisma/seeds/data/world-rankings/*.json`,
 * matches each entry to a `School` row by name, and idempotently upserts
 * `SchoolRanking` rows.
 *
 * This script is BOTH the dev-time collection persister AND the prod-time
 * applier — it is fully deterministic (no network), name-matched, and safe to
 * re-run. The raw JSON files ARE the versioned payload.
 *
 * Sources: US_NEWS stays managed by seed-school-rankings.ts; this script adds
 * QS / THE / ARWU / FORBES / WSJ.
 *
 * Each data file is one ranking list:
 *   { "source": "QS", "list": "QS_WORLD", "year": 2026,
 *     "sourceUrl": "https://...", "entries": [ { "name": "...", "rank": 1 } ] }
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx scripts/closure-agents/collect-school-rankings.ts
 *   ... --dry-run     # match + report, no writes
 */
// Fail-soft dotenv: dev only. See load-top-cases.ts for rationale.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv/config');
} catch {
  /* dotenv absent in prod runner — skip */
}
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, '../data/world-rankings');

interface RankingEntry {
  name: string;
  rank: number;
  banded?: boolean;
}
interface RankingFile {
  source: string;
  list: string;
  year: number;
  sourceUrl?: string;
  entries: RankingEntry[];
}

/** Loose name normalization for fuzzy school matching. */
function loose(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents: José -> Jose
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ') // drop parentheticals e.g. "(MIT)", "(UCLA)"
    .replace(/[–—-]/g, ' ') // dashes -> space
    .replace(/[,/]/g, ' ') // commas / slashes -> space
    .replace(/&/g, ' and ')
    .replace(/\./g, '') // "St." -> "St"
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w !== 'the' && w !== 'at')
    .join(' ')
    .trim();
}

/** Trailing campus/qualifier tokens safe to drop when a full match fails. */
const SUFFIX_QUALIFIERS = new Set([
  'suny',
  'seattle',
  'raleigh',
  'norman',
  'columbus',
  'bloomington',
  'amherst',
  'tempe',
  'park',
  'campus',
  'main',
  'station',
  'college',
  'lafayette',
  'west',
  'baton',
  'rouge',
  'twin',
  'cities',
]);

/**
 * Explicit aliases: loose(rankingName) -> loose(dbName).
 * Only for cases the loose normalizer cannot resolve on its own.
 */
const ALIASES: Record<string, string> = {
  'penn state': 'pennsylvania state university',
  'penn state university park': 'pennsylvania state university',
  'pennsylvania state university university park':
    'pennsylvania state university',
  'suny binghamton': 'binghamton university',
  'state university of new york binghamton': 'binghamton university',
  'suny buffalo': 'university buffalo',
  'university buffalo suny': 'university buffalo',
  'suny stony brook': 'stony brook university',
  'state university of new york stony brook': 'stony brook university',
  ucla: 'university of california los angeles',
  'uc berkeley': 'university of california berkeley',
  'uc san diego': 'university of california san diego',
  'uc davis': 'university of california davis',
  'uc irvine': 'university of california irvine',
  'uc santa barbara': 'university of california santa barbara',
  'uc santa cruz': 'university of california santa cruz',
  'uc riverside': 'university of california riverside',
  'university of michigan': 'university of michigan ann arbor',
  'university of michigan ann arbor': 'university of michigan ann arbor',
  'university of minnesota': 'university of minnesota twin cities',
  'university of wisconsin': 'university of wisconsin madison',
  'university of illinois urbana champaign':
    'university of illinois urbana champaign',
  'university of illinois': 'university of illinois urbana champaign',
  'rutgers university': 'rutgers university new brunswick',
  'rutgers the state university of new jersey':
    'rutgers university new brunswick',
  'texas a m university': 'texas a and m university',
  'william and mary': 'william and mary',
  'college of william and mary': 'william and mary',
  'university of hawaii manoa': 'university of hawaii at manoa',
  'university of hawaii at manoa': 'university of hawaii at manoa',
  'indiana university': 'indiana university bloomington',
  'ohio state university': 'ohio state university',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(
    `🏆 collect-school-rankings — mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`,
  );

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Data directory not found: ${DATA_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error(
      '❌ No ranking JSON files found. Run the collection agents first.',
    );
    process.exit(1);
  }

  // Build school lookup: loose name -> schoolId (collision-aware).
  const schools = await prisma.school.findMany({
    select: { id: true, name: true, nameNorm: true },
  });
  const byLoose = new Map<string, string[]>();
  for (const s of schools) {
    for (const key of [loose(s.name), loose(s.nameNorm)]) {
      if (!key) continue;
      const ids = byLoose.get(key) ?? [];
      if (!ids.includes(s.id)) ids.push(s.id);
      byLoose.set(key, ids);
    }
  }

  function resolveSchoolId(rawName: string): string | null {
    const key = loose(rawName);
    const aliased = ALIASES[key] ?? key;
    const direct = byLoose.get(aliased) ?? byLoose.get(key);
    if (direct && direct.length > 0) return direct[0];

    // Fallback: drop trailing campus/qualifier tokens (e.g.
    // "university of washington seattle" -> "university of washington").
    // Accept only a UNIQUE match to avoid cross-campus false positives.
    const tokens = key.split(' ');
    for (let drop = 1; drop <= 2 && tokens.length - drop >= 2; drop++) {
      const tail = tokens[tokens.length - drop];
      if (!SUFFIX_QUALIFIERS.has(tail)) break;
      const trimmed = tokens.slice(0, tokens.length - drop).join(' ');
      const hit = byLoose.get(trimmed);
      if (hit && hit.length === 1) return hit[0];
    }
    return null;
  }

  let totalUpserts = 0;
  const unmatchedBySource: Record<string, string[]> = {};

  for (const file of files.sort()) {
    const raw = JSON.parse(
      fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'),
    ) as RankingFile;
    if (!raw.source || !raw.list || !raw.year || !Array.isArray(raw.entries)) {
      console.warn(`  ⚠️  ${file}: malformed — skipped`);
      continue;
    }

    let matched = 0;
    const unmatched: string[] = [];
    for (const entry of raw.entries) {
      if (!entry?.name || !Number.isFinite(entry.rank) || entry.rank <= 0)
        continue;
      const schoolId = resolveSchoolId(entry.name);
      if (!schoolId) {
        unmatched.push(entry.name);
        continue;
      }
      matched++;
      if (dryRun) continue;
      await prisma.schoolRanking.upsert({
        where: {
          schoolId_source_list_year: {
            schoolId,
            source: raw.source,
            list: raw.list,
            year: raw.year,
          },
        },
        create: {
          schoolId,
          source: raw.source,
          list: raw.list,
          rank: Math.round(entry.rank),
          year: raw.year,
          sourceUrl: raw.sourceUrl ?? null,
        },
        update: {
          rank: Math.round(entry.rank),
          sourceUrl: raw.sourceUrl ?? null,
        },
      });
    }
    totalUpserts += matched;
    unmatchedBySource[raw.source] = (
      unmatchedBySource[raw.source] ?? []
    ).concat(unmatched);
    console.log(
      `  ${file}: ${raw.source}/${raw.list} ${raw.year} — ${matched} matched / ${raw.entries.length} entries`,
    );
  }

  console.log(`\n📈 Total ${dryRun ? 'matched' : 'upserted'}: ${totalUpserts}`);
  for (const [source, names] of Object.entries(unmatchedBySource)) {
    if (names.length === 0) continue;
    console.log(
      `\n🔎 ${source}: ${names.length} unmatched (not in our 240-school roster — expected for global rankings):`,
    );
    names.slice(0, 40).forEach((n) => console.log(`   - ${n}`));
    if (names.length > 40) console.log(`   ... +${names.length - 40} more`);
  }

  if (!dryRun) {
    const bySource = await prisma.schoolRanking.groupBy({
      by: ['source'],
      _count: true,
    });
    console.log('\n✅ SchoolRanking rows by source:');
    bySource.forEach((r) => console.log(`   ${r.source}: ${r._count}`));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
