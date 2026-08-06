/**
 * Reference data expires. Nothing was checking whether it had.
 *
 * `migrate.sh` converges the database to whatever the repo says on every
 * deploy — but it can only guarantee "the DB matches the repo", never "the repo
 * is still true". An exam calendar whose last date is in the past converges
 * perfectly and is worthless: /timeline would render a page of finished exams,
 * and the pipeline would report success the whole time.
 *
 * This is the same absence-reads-as-success shape as the rest of this repo's
 * guardrails, one level up: not "did the job run" but "is what it loaded still
 * worth loading".
 *
 * WHAT IT CHECKS: for each dated seed file, the LATEST date in it must be at
 * least `minMonthsAhead` in the future. That is the honest question — a
 * calendar is stale when it stops covering the planning horizon, not when its
 * oldest row ages.
 *
 * ponytail: a date scan over committed JSON, not a DB query. The repo is the
 * source of truth for this data, and a check that needs a database cannot run
 * in the Lint job.
 *
 *   tsx scripts/check-seed-data-freshness.ts
 *   tsx scripts/check-seed-data-freshness.ts --asof 2027-06-01   # what-if
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

interface DatedSeed {
  file: string;
  /** JSON field holding the date that defines coverage. */
  dateField: string;
  /** Fail when the latest date is nearer than this many months out. */
  minMonthsAhead: number;
  /** How to refresh it, printed on failure — a gate that cannot be acted on is noise. */
  refresh: string;
}

const SEEDS: DatedSeed[] = [
  {
    file: 'apps/api/prisma/seeds/global-events-2026-2027.json',
    dateField: 'eventDate',
    // Applicants pick an exam sitting roughly two terms out; below ~4 months of
    // remaining coverage the calendar stops answering "when can I still test?".
    minMonthsAhead: 4,
    refresh:
      'Re-read the official pages (satsuite.collegeboard.org/sat/dates-deadlines, ' +
      'act.org test-dates, apstudents.collegeboard.org/exam-calendar), write the next ' +
      'season into a new global-events-<years>.json with sourceUrl + fetchedAt on every ' +
      'record, and point migrate.sh at it. NEVER extrapolate dates — they move.',
  },
  {
    file: 'apps/api/prisma/seeds/competition-schedules-2026-2027.json',
    dateField: 'eventStartAt',
    minMonthsAhead: 4,
    refresh: 'Run the /competition-data-update skill, then /competition-data-audit.',
  },
];

const asofArg = process.argv.indexOf('--asof');
const now = asofArg !== -1 ? new Date(process.argv[asofArg + 1]) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error('❌ --asof is not a valid date');
  process.exit(1);
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    (to.getDate() >= from.getDate() ? 0 : -1)
  );
}

const problems: string[] = [];
const lines: string[] = [];

for (const seed of SEEDS) {
  const abs = path.join(ROOT, seed.file);
  if (!fs.existsSync(abs)) {
    // Not "fine" — a seed listed here and missing on disk means either the file
    // moved (this list is stale) or the pipeline lost its data. Either way, say so.
    problems.push(
      `${seed.file}: listed here but not on disk. Update this list, or restore the file.`
    );
    continue;
  }

  const records = JSON.parse(fs.readFileSync(abs, 'utf8')) as Array<Record<string, unknown>>;
  const dates = records
    .map((r) => r[seed.dateField])
    .filter((v): v is string => typeof v === 'string' && v !== '')
    .map((v) => new Date(v))
    .filter((d) => !Number.isNaN(d.getTime()));

  if (dates.length === 0) {
    problems.push(
      `${seed.file}: no parseable \`${seed.dateField}\` values — is the field named right?`
    );
    continue;
  }

  const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
  const monthsLeft = monthsBetween(now, latest);
  const name = path.basename(seed.file);

  if (monthsLeft < seed.minMonthsAhead) {
    problems.push(
      `${seed.file}\n` +
        `     latest ${seed.dateField}: ${latest.toISOString().slice(0, 10)} ` +
        `(${monthsLeft} month(s) out; needs >= ${seed.minMonthsAhead})\n` +
        `     → ${seed.refresh}`
    );
  } else {
    lines.push(
      `   ${name}: covered through ${latest.toISOString().slice(0, 10)} (${monthsLeft} months out)`
    );
  }
}

if (problems.length > 0) {
  console.error('\n❌ Seed data is going stale:\n');
  for (const p of problems) console.error(`   ${p}\n`);
  console.error(
    '   These files load successfully and would keep loading successfully —\n' +
      '   the pipeline cannot tell you the data stopped being useful. That is\n' +
      '   what this check is for.\n'
  );
  process.exitCode = 1;
} else {
  console.log('✅ Dated seed data still covers the planning horizon:');
  for (const l of lines) console.log(l);
}
