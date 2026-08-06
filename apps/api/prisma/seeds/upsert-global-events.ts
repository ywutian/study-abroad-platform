/**
 * Ingest real, web-verified standardized-test dates into `GlobalEvent`.
 *
 * WHY THIS EXISTS: `GlobalEvent` had no seed at all. The table was empty in
 * production, which is why `/timeline` renders a bare list of "Generate
 * Timeline" buttons and nothing else — the feedback item that read "这里不太
 * 确定是啥" was a data gap, not a UI problem.
 *
 * Contract, mirrored from `upsert-competition-data.ts`:
 *  - every record MUST carry a `sourceUrl`. A record with no source is a
 *    fabrication and is rejected.
 *  - absent dates stay null. A null `registrationDeadline` means "not
 *    published", never "unknown-so-guess".
 *  - upserts by `slug`, so re-running is idempotent and an updated official
 *    schedule overwrites rather than duplicates.
 *
 * Unlike the competition script, this one CREATES rows: `Competition` is a
 * curated SSOT that a seed must not invent members of, whereas the exam
 * calendar IS the data.
 *
 *   pnpm --filter api db:seed:global-events                      # default file
 *   pnpm --filter api db:seed:global-events <path/to/records.json>
 *   pnpm --filter api db:seed:global-events --check              # validate only, no DB
 */
import { PrismaClient, GlobalEventCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

export interface GlobalEventRecord {
  slug: string; // stable business key, e.g. "sat-2026-11-07"
  title: string;
  titleZh?: string;
  category: keyof typeof GlobalEventCategory;
  eventDate: string; // ISO 8601 — required; a dateless event is not an event
  registrationDeadline?: string | null;
  lateDeadline?: string | null;
  resultDate?: string | null;
  description?: string;
  descriptionZh?: string;
  url?: string;
  sourceUrl: string; // REQUIRED provenance — no source ⇒ rejected
  fetchedAt: string;
  verifiedBy?: string;
  confidence?: 'high' | 'medium' | 'low';
}

const DEFAULT_FILE = path.join(__dirname, 'global-events-2026-2027.json');

function parseDate(
  value: string | null | undefined,
  field: string,
): Date | null {
  if (value == null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime()))
    throw new Error(`${field}: invalid date "${value}"`);
  return d;
}

/** Rejects the whole batch rather than silently skipping — a partial import of
 *  dates people plan around is worse than a loud failure. */
export function validate(records: GlobalEventRecord[]): void {
  const seen = new Set<string>();
  records.forEach((r, i) => {
    const at = `record ${i} (${r.slug ?? 'no slug'})`;
    if (!r.slug) throw new Error(`${at}: missing slug`);
    if (seen.has(r.slug)) throw new Error(`${at}: duplicate slug`);
    seen.add(r.slug);
    if (!r.title) throw new Error(`${at}: missing title`);
    if (!r.sourceUrl) {
      throw new Error(
        `${at}: missing sourceUrl. A record with no source is a fabrication; ` +
          `these dates are what people book flights and exam seats around.`,
      );
    }
    if (!(r.category in GlobalEventCategory)) {
      throw new Error(`${at}: unknown category "${r.category}"`);
    }
    if (!parseDate(r.eventDate, `${at}.eventDate`)) {
      throw new Error(`${at}: eventDate is required`);
    }
    parseDate(r.registrationDeadline, `${at}.registrationDeadline`);
    parseDate(r.lateDeadline, `${at}.lateDeadline`);
    parseDate(r.resultDate, `${at}.resultDate`);
    parseDate(r.fetchedAt, `${at}.fetchedAt`);
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const file = args.find((a) => !a.startsWith('--')) ?? DEFAULT_FILE;

  const records = JSON.parse(
    fs.readFileSync(file, 'utf8'),
  ) as GlobalEventRecord[];
  validate(records);
  console.log(
    `✅ ${records.length} record(s) valid, every one carries a sourceUrl.`,
  );

  if (checkOnly) {
    console.log('   --check: nothing written.');
    return;
  }

  const prisma = new PrismaClient();
  let created = 0;
  let updated = 0;
  try {
    for (const r of records) {
      // Provenance lives in the description so it survives into the UI and the
      // admin editor — GlobalEvent has no dedicated provenance columns, and
      // adding four for this would be a schema change the data does not need.
      const provenance =
        `\n\n[source: ${r.sourceUrl} · fetched ${r.fetchedAt}` +
        `${r.verifiedBy ? ` · ${r.verifiedBy}` : ''}` +
        `${r.confidence ? ` · confidence: ${r.confidence}` : ''}]`;

      const eventDate = parseDate(r.eventDate, 'eventDate')!;
      const data = {
        title: r.title,
        titleZh: r.titleZh ?? null,
        category: GlobalEventCategory[r.category],
        eventDate,
        // Required by the model and derived here rather than asked of the seed
        // file: `year` is a fact about eventDate, so letting a record state a
        // different one would only create a way for them to disagree.
        year: eventDate.getUTCFullYear(),
        registrationDeadline: parseDate(
          r.registrationDeadline,
          'registrationDeadline',
        ),
        lateDeadline: parseDate(r.lateDeadline, 'lateDeadline'),
        resultDate: parseDate(r.resultDate, 'resultDate'),
        description: (r.description ?? '') + provenance,
        descriptionZh: r.descriptionZh ? r.descriptionZh + provenance : null,
        url: r.url ?? r.sourceUrl,
        isActive: true,
      };

      const existing = await prisma.globalEvent.findUnique({
        where: { slug: r.slug },
        select: { id: true },
      });
      if (existing) {
        await prisma.globalEvent.update({ where: { slug: r.slug }, data });
        updated++;
      } else {
        await prisma.globalEvent.create({ data: { ...data, slug: r.slug } });
        created++;
      }
    }
    console.log(
      `✅ GlobalEvent in sync: ${created} created, ${updated} updated.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
