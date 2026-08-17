/**
 * Post-seed result assertions for the migrate/deploy path.
 *
 * `lint:seed-parity` only proves each migrate.sh seed is compiled into the
 * image. The gallery count in migrate.sh was the only *result* assertion, and
 * every other user-visible table could stay empty while the Cloud Run job
 * stayed green (`node script || echo WARNING`).
 *
 * This file is the result gate. Failure exits 42 (same code the gallery
 * check used) so the migrate job — and therefore deploy — goes red.
 *
 * Modes
 * -----
 *   (default)     Static self-check only. No DATABASE_URL. Safe to run
 *                 locally / in lint; does not belong in `lint:all` (the DB
 *                 half needs Postgres). Verifies documented thresholds still
 *                 match the seed sources, and that fail-hard labels are
 *                 actually wired in migrate.sh.
 *   --db          Also query Postgres. Requires DATABASE_URL. This is what
 *                 migrate.sh runs after the seed steps.
 *
 *   tsx apps/api/prisma/check-seed-result-assertions.ts
 *   tsx apps/api/prisma/check-seed-result-assertions.ts --db
 *   tsx scripts/assert-seed-results.ts                 # same, from repo root
 *
 * Falsify
 * -------
 *   Static: delete one name from OFFICIAL_COMMUNITIES, or drop a
 *           `run_seed "global-events"` line, then run without --db → must
 *           exit 1.
 *   DB:     `DELETE FROM "GlobalEvent";` (or skip the seed) then --db →
 *           must exit 42.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

/** Same exit code migrate.sh used for the gallery floor. */
const EXIT_ASSERTION = 42;

const HERE = __dirname;
const API_ROOT = path.join(HERE, '..');

/**
 * Fail-hard migrate.sh labels. User-visible empty-page seeds: exam calendar,
 * forum chips, Tindermatch pools, competition editions, testingPolicy.
 * Rankings scrapers and similar stay fail-soft on purpose — do not dump every
 * seed into this list.
 */
export const FAIL_HARD_SEED_LABELS = [
  'testing-policy',
  'global-events',
  'competitions',
  'competition-data',
  'match-pools',
  'forum-communities',
] as const;

/**
 * Thresholds, counted from committed sources on 2026-08-16. Self-check
 * re-counts the same files at runtime so a seed edit that forgets to update
 * a magic number cannot silently lower the floor.
 *
 *   GlobalEvent future dates — `prisma/seeds/global-events-2026-2027.json`
 *     has 17 records; as of 2026-08-16 all 17 have eventDate >= today
 *     (earliest sat-2026-08-22). Live threshold = count of JSON rows with
 *     eventDate >= start of today UTC. 0 future dates in the file is itself
 *     a failure (stale calendar; see check-seed-data-freshness.ts).
 *     We count RAW eventDate, not the timeline recurring roll-forward:
 *     a rolled 2025 SAT would hide a seed that never ran this season.
 *
 *   ForumCommunity official — `OFFICIAL_COMMUNITIES` in
 *     seed-forum-communities.ts is 11 names. Assert isOfficial+isActive
 *     rows covering those slugs >= 11. (Prod bug was 1 user-created
 *     `debate` row.)
 *
 *   MatchPoolEntry — MATCH_POOL_BLUEPRINTS alias-group counts in
 *     seed-teams.ts: 8+9+8+8+7+6+5+5+6 = 62. Floor 62. Prod bug was
 *     9 pools with entries: [].
 *
 *   CompetitionEdition — `competition-schedules-2026-2027.json` is a
 *     12-element array. Floor 12 (prod had 3 leftovers). Status ACTIVE
 *     is what GET /teams editions lists.
 *
 *   School.testingPolicy REQUIRED — `policy: 'REQUIRED'` appears 21 times
 *     in seed-testing-policy-2026-07-25.ts (11 in the <20% batch + 10 in
 *     the 2026-08-04 ≥20% sweep).
 *
 *   Gallery — keep the existing floor of 50 (harvest is ~185; 50 means
 *     "not the original demo set of ~5").
 */
const MIN_GALLERY_VISIBLE = 50;
const DOCUMENTED_OFFICIAL_COMMUNITIES = 11;
const DOCUMENTED_MATCH_POOL_ENTRIES = 62;
const DOCUMENTED_COMPETITION_SCHEDULES = 12;
const DOCUMENTED_TESTING_POLICY_REQUIRED = 21;
const DOCUMENTED_GLOBAL_EVENT_RECORDS = 17;

function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function read(relFromPrisma: string): string {
  const abs = path.join(HERE, relFromPrisma);
  if (!fs.existsSync(abs)) {
    throw new Error(`missing ${relFromPrisma} (looked at ${abs})`);
  }
  return fs.readFileSync(abs, 'utf8');
}

function parseQuotedStringsInConstArray(
  src: string,
  constName: string,
): string[] {
  const start = src.indexOf(`const ${constName} = [`);
  if (start < 0) throw new Error(`missing const ${constName}`);
  const open = src.indexOf('[', start);
  const close = src.indexOf('];', open);
  if (open < 0 || close < 0) throw new Error(`unclosed const ${constName}`);
  return [...src.slice(open, close).matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function slugify(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'general';
}

function countMatchPoolAliasGroups(src: string): number {
  const start = src.indexOf('const MATCH_POOL_BLUEPRINTS');
  const end = src.indexOf('export async function seedTeamData', start);
  if (start < 0 || end < 0) {
    throw new Error('could not locate MATCH_POOL_BLUEPRINTS in seed-teams.ts');
  }
  const block = src.slice(start, end);
  const groups = [...block.matchAll(/\['[^'\]]+'(?:\s*,\s*'[^']+')*\]/g)];
  return groups.length;
}

function jsonArrayLength(relFromPrisma: string): number {
  const parsed: unknown = JSON.parse(read(relFromPrisma));
  if (!Array.isArray(parsed)) {
    throw new Error(`${relFromPrisma} is not a JSON array`);
  }
  return parsed.length;
}

function futureGlobalEventCountInJson(now = new Date()): {
  total: number;
  future: number;
} {
  const parsed: unknown = JSON.parse(
    read('seeds/global-events-2026-2027.json'),
  );
  if (!Array.isArray(parsed)) {
    throw new Error('global-events JSON is not an array');
  }
  const today = startOfUtcDay(now).getTime();
  let future = 0;
  for (const row of parsed) {
    const eventDate =
      row && typeof row === 'object' && 'eventDate' in row
        ? new Date(String((row as { eventDate: unknown }).eventDate))
        : new Date(NaN);
    if (!Number.isNaN(eventDate.getTime()) && eventDate.getTime() >= today) {
      future += 1;
    }
  }
  return { total: parsed.length, future };
}

export interface SourceThresholds {
  officialCommunities: number;
  officialCommunitySlugs: string[];
  matchPoolEntries: number;
  competitionSchedules: number;
  testingPolicyRequired: number;
  globalEventRecords: number;
  globalEventFuture: number;
}

export function readSourceThresholds(now = new Date()): SourceThresholds {
  const communityNames = parseQuotedStringsInConstArray(
    read('seed-forum-communities.ts'),
    'OFFICIAL_COMMUNITIES',
  );
  const testingSrc = read('seed-testing-policy-2026-07-25.ts');
  const required =
    testingSrc.match(/policy: 'REQUIRED'/g)?.length ??
    testingSrc.match(/policy: "REQUIRED"/g)?.length ??
    0;
  const events = futureGlobalEventCountInJson(now);
  return {
    officialCommunities: communityNames.length,
    officialCommunitySlugs: communityNames.map(slugify),
    matchPoolEntries: countMatchPoolAliasGroups(read('seed-teams.ts')),
    competitionSchedules: jsonArrayLength(
      'seeds/competition-schedules-2026-2027.json',
    ),
    testingPolicyRequired: required,
    globalEventRecords: events.total,
    globalEventFuture: events.future,
  };
}

function assertEq(label: string, actual: number, expected: number): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: source count ${actual} !== documented ${expected}. ` +
        `Update the documented constant in check-seed-result-assertions.ts ` +
        `AND the comment that cites the source.`,
    );
  }
}

/**
 * No-DB half. Confirms the numbers this file will demand of Postgres still
 * match the seed sources, and that migrate.sh still fail-hards the named
 * labels. Exit 1 on drift (not 42 — 42 is reserved for a live DB miss).
 */
export function runSelfCheck(now = new Date()): SourceThresholds {
  const src = readSourceThresholds(now);
  assertEq(
    'OFFICIAL_COMMUNITIES length',
    src.officialCommunities,
    DOCUMENTED_OFFICIAL_COMMUNITIES,
  );
  assertEq(
    'MATCH_POOL_BLUEPRINTS alias groups',
    src.matchPoolEntries,
    DOCUMENTED_MATCH_POOL_ENTRIES,
  );
  assertEq(
    'competition-schedules-2026-2027.json length',
    src.competitionSchedules,
    DOCUMENTED_COMPETITION_SCHEDULES,
  );
  assertEq(
    "testing-policy policy: 'REQUIRED' rows",
    src.testingPolicyRequired,
    DOCUMENTED_TESTING_POLICY_REQUIRED,
  );
  assertEq(
    'global-events-2026-2027.json length',
    src.globalEventRecords,
    DOCUMENTED_GLOBAL_EVENT_RECORDS,
  );
  if (src.globalEventFuture < 1) {
    throw new Error(
      'global-events JSON has 0 dates on/after today — the calendar is stale. ' +
        'Refresh via the process in scripts/check-seed-data-freshness.ts; ' +
        'do not lower this floor.',
    );
  }

  const migrate = fs.readFileSync(path.join(API_ROOT, 'migrate.sh'), 'utf8');
  if (!migrate.includes('SEED_FAIL_HARD_LABELS=')) {
    throw new Error(
      'migrate.sh is missing SEED_FAIL_HARD_LABELS — fail-hard wiring drifted.',
    );
  }
  for (const label of FAIL_HARD_SEED_LABELS) {
    if (!migrate.includes(` "${label}" `) && !migrate.includes(`"${label}"`)) {
      throw new Error(
        `migrate.sh has no run_seed "${label}" — cannot fail-hard a seed that is not invoked.`,
      );
    }
    // The space-padded list is `" foo bar "` so a substring match with spaces
    // cannot hit a prefix of another label.
    if (!migrate.includes(` ${label} `)) {
      throw new Error(
        `migrate.sh SEED_FAIL_HARD_LABELS does not contain "${label}". ` +
          `A throw in that seed would print WARNING and leave deploy green.`,
      );
    }
  }

  const forumPosts = read('seed-forum-posts.ts');
  if (
    /viewCount:\s*randomView\(|likeCount:\s*randomLike\(|Math\.random\(\)\s*\*\s*2000|Math\.random\(\)\s*\*\s*100/.test(
      forumPosts,
    )
  ) {
    throw new Error(
      'seed-forum-posts.ts still plants random like/view counts. Seed heat must be 0.',
    );
  }

  console.log('✓ Seed-result assertion sources match documented thresholds:');
  console.log(
    `    official ForumCommunity names: ${src.officialCommunities} (slugs: ${src.officialCommunitySlugs.join(', ')})`,
  );
  console.log(`    match-pool alias groups: ${src.matchPoolEntries}`);
  console.log(`    competition schedule records: ${src.competitionSchedules}`);
  console.log(`    testingPolicy REQUIRED rows: ${src.testingPolicyRequired}`);
  console.log(
    `    global-events records: ${src.globalEventRecords} (${src.globalEventFuture} on/after today UTC)`,
  );
  console.log(`    fail-hard labels: ${FAIL_HARD_SEED_LABELS.join(', ')}`);
  return src;
}

interface DbCheck {
  label: string;
  actual: number;
  minimum: number;
  ok: boolean;
}

async function runDbAssertions(
  src: SourceThresholds,
  now = new Date(),
): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      '--db requires DATABASE_URL (migrate.sh / deploy only; local lint should omit --db)',
    );
  }

  const prisma = new PrismaClient();
  const today = startOfUtcDay(now);
  const checks: DbCheck[] = [];
  try {
    const [
      gallery,
      officialCovered,
      poolEntries,
      activePools,
      emptyPools,
      editions,
      activeEditions,
      requiredPolicy,
      futureEvents,
    ] = await Promise.all([
      prisma.admissionCase.count({
        where: {
          visibility: { in: ['PUBLIC', 'ANONYMOUS'] },
          essayContent: { not: null },
          reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
        },
      }),
      prisma.forumCommunity.count({
        where: {
          isOfficial: true,
          isActive: true,
          slug: { in: src.officialCommunitySlugs },
        },
      }),
      prisma.matchPoolEntry.count({ where: { isActive: true } }),
      prisma.matchPool.count({ where: { isActive: true } }),
      prisma.matchPool.count({
        where: { isActive: true, entries: { none: { isActive: true } } },
      }),
      prisma.competitionEdition.count(),
      prisma.competitionEdition.count({ where: { status: 'ACTIVE' } }),
      prisma.school.count({ where: { testingPolicy: 'REQUIRED' } }),
      prisma.globalEvent.count({
        where: { isActive: true, eventDate: { gte: today } },
      }),
    ]);

    checks.push(
      {
        label: 'gallery-visible AdmissionCase',
        actual: gallery,
        minimum: MIN_GALLERY_VISIBLE,
        ok: gallery >= MIN_GALLERY_VISIBLE,
      },
      {
        label: 'official ForumCommunity slugs present',
        actual: officialCovered,
        minimum: src.officialCommunities,
        ok: officialCovered >= src.officialCommunities,
      },
      {
        label: 'active MatchPoolEntry',
        actual: poolEntries,
        minimum: src.matchPoolEntries,
        ok: poolEntries >= src.matchPoolEntries,
      },
      {
        label: 'active MatchPool (9 blueprints)',
        actual: activePools,
        minimum: 9,
        ok: activePools >= 9,
      },
      {
        label: 'active MatchPool with zero active entries (must be 0)',
        actual: emptyPools,
        minimum: 0,
        ok: emptyPools === 0,
      },
      {
        label: 'CompetitionEdition rows',
        actual: editions,
        minimum: src.competitionSchedules,
        ok: editions >= src.competitionSchedules,
      },
      {
        label: 'ACTIVE CompetitionEdition rows',
        actual: activeEditions,
        minimum: src.competitionSchedules,
        ok: activeEditions >= src.competitionSchedules,
      },
      {
        label: 'School.testingPolicy = REQUIRED',
        actual: requiredPolicy,
        minimum: src.testingPolicyRequired,
        ok: requiredPolicy >= src.testingPolicyRequired,
      },
      {
        label: 'active GlobalEvent with eventDate >= today UTC',
        actual: futureEvents,
        minimum: src.globalEventFuture,
        ok: futureEvents >= src.globalEventFuture,
      },
    );
  } finally {
    await prisma.$disconnect();
  }

  console.log('=== Sanity check: seed result assertions ===');
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? '✓' : '✗';
    const bound = c.label.includes('must be 0') ? '== 0' : `>= ${c.minimum}`;
    console.log(`  ${mark} ${c.label}: ${c.actual} (${bound})`);
    if (!c.ok) failed += 1;
  }

  if (failed > 0) {
    console.error(`ERROR: ${failed} seed-result assertion(s) below threshold.`);
    console.error(
      '       A fail-hard seed step likely skipped or no-op’d. See seed output above.',
    );
    process.exit(EXIT_ASSERTION);
  }
  console.log('✓ Seed result assertions OK.');
}

async function main(): Promise<void> {
  const wantDb = process.argv.includes('--db');
  const src = runSelfCheck();
  if (!wantDb) {
    console.log(
      'Skipping DB counts (pass --db / migrate.sh to query Postgres).',
    );
    return;
  }
  await runDbAssertions(src);
}

if (require.main === module) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ seed-result assertions: ${message}`);
    process.exit(process.argv.includes('--db') ? 1 : 1);
  });
}
