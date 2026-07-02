/**
 * Ingest real, web-verified competition schedule data into the DB.
 *
 * This is the machine-readable sink for the `/competition-data-update` skill:
 * its subagents WebSearch/WebFetch each competition's official site, extract the
 * CURRENT season's real registration/event dates + track structure, and emit a
 * JSON array of records. This script upserts them — idempotently, with
 * provenance, and WITHOUT fabricating anything.
 *
 * Contract (mirrors closure-update): every record MUST carry a `sourceUrl`.
 * A record with no source is a fabrication and is rejected. Absent dates stay
 * null (a null deadline means "not published", not "unknown-so-guess").
 *
 * Usage:
 *   pnpm --filter api db:seed:competition-data <path/to/records.json>
 *   pnpm --filter api db:seed:competition-data --check      # self-test, no DB
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

export interface CompetitionTrackInput {
  name: string;
  minTeamSize: number;
  maxTeamSize: number;
  rolePresets?: string[];
  languages?: string[];
}

export interface CompetitionDataRecord {
  abbreviation: string; // must match an existing Competition.abbreviation
  seasonLabel: string; // e.g. "2026-2027"
  registrationOpenAt?: string | null; // ISO 8601
  registrationCloseAt?: string | null;
  eventStartAt?: string | null;
  eventEndAt?: string | null;
  tracks?: CompetitionTrackInput[];
  sourceUrl: string; // REQUIRED provenance — no source ⇒ rejected
  fetchedAt: string; // ISO 8601
  verifiedBy?: string; // e.g. "claude/websearch"
  confidence?: 'high' | 'medium' | 'low';
}

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

/** Validate one record, throwing on anything that would be a fabrication or malformed. */
export function validateRecord(rec: CompetitionDataRecord): void {
  if (!rec.abbreviation?.trim()) throw new Error('record missing abbreviation');
  const tag = rec.abbreviation;
  if (!rec.seasonLabel?.trim()) throw new Error(`${tag}: missing seasonLabel`);
  // Provenance is mandatory — this is the anti-fabrication gate.
  if (!rec.sourceUrl?.trim())
    throw new Error(`${tag}: missing sourceUrl (never fabricate)`);
  if (!rec.fetchedAt?.trim()) throw new Error(`${tag}: missing fetchedAt`);
  // Dates must parse if present.
  parseDate(rec.registrationOpenAt, `${tag}.registrationOpenAt`);
  parseDate(rec.registrationCloseAt, `${tag}.registrationCloseAt`);
  parseDate(rec.eventStartAt, `${tag}.eventStartAt`);
  parseDate(rec.eventEndAt, `${tag}.eventEndAt`);
  // Must carry SOME value — a source with no dates and no tracks is noise.
  const hasDate =
    rec.registrationOpenAt ||
    rec.registrationCloseAt ||
    rec.eventStartAt ||
    rec.eventEndAt;
  if (!hasDate && !(rec.tracks && rec.tracks.length > 0)) {
    throw new Error(`${tag}: no dates and no tracks — nothing to write`);
  }
  for (const t of rec.tracks ?? []) {
    if (!t.name?.trim()) throw new Error(`${tag}: track missing name`);
    if (!(t.maxTeamSize >= t.minTeamSize && t.minTeamSize >= 1)) {
      throw new Error(
        `${tag}/${t.name}: bad team size ${t.minTeamSize}-${t.maxTeamSize}`,
      );
    }
  }
}

/** Build the edition date+provenance payload (shared by create & update). */
export function toEditionPayload(rec: CompetitionDataRecord) {
  return {
    status: 'ACTIVE' as const,
    registrationOpenAt: parseDate(rec.registrationOpenAt, 'registrationOpenAt'),
    registrationCloseAt: parseDate(
      rec.registrationCloseAt,
      'registrationCloseAt',
    ),
    eventStartAt: parseDate(rec.eventStartAt, 'eventStartAt'),
    eventEndAt: parseDate(rec.eventEndAt, 'eventEndAt'),
    sourceMeta: {
      sourceUrl: rec.sourceUrl,
      fetchedAt: rec.fetchedAt,
      verifiedBy: rec.verifiedBy ?? 'claude/websearch',
      confidence: rec.confidence ?? 'medium',
    },
  };
}

async function run(recordsPath: string) {
  const raw = JSON.parse(readFileSync(recordsPath, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('records file must be a JSON array');
  const records = raw as CompetitionDataRecord[];
  records.forEach(validateRecord);

  const prisma = new PrismaClient();
  let editions = 0;
  let tracks = 0;
  const notFound: string[] = [];
  try {
    for (const rec of records) {
      const competition = await prisma.competition.findUnique({
        where: { abbreviation: rec.abbreviation },
        select: { id: true },
      });
      if (!competition) {
        notFound.push(rec.abbreviation);
        continue; // never invent a Competition — the curated list is the SSOT
      }
      const payload = toEditionPayload(rec);
      const edition = await prisma.competitionEdition.upsert({
        where: {
          competitionId_seasonLabel: {
            competitionId: competition.id,
            seasonLabel: rec.seasonLabel,
          },
        },
        create: {
          competitionId: competition.id,
          seasonLabel: rec.seasonLabel,
          ...payload,
        },
        update: payload,
      });
      editions += 1;

      for (const t of rec.tracks ?? []) {
        await prisma.competitionTrack.upsert({
          where: {
            competitionEditionId_name: {
              competitionEditionId: edition.id,
              name: t.name,
            },
          },
          create: {
            competitionEditionId: edition.id,
            name: t.name,
            minTeamSize: t.minTeamSize,
            maxTeamSize: t.maxTeamSize,
            rolePresets: t.rolePresets ?? [],
            languages: t.languages ?? [],
            isActive: true,
          },
          update: {
            minTeamSize: t.minTeamSize,
            maxTeamSize: t.maxTeamSize,
            ...(t.rolePresets ? { rolePresets: t.rolePresets } : {}),
            ...(t.languages ? { languages: t.languages } : {}),
            isActive: true,
          },
        });
        tracks += 1;
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    `✅ Upserted ${editions} edition(s), ${tracks} track(s) from ${records.length} record(s).`,
  );
  if (notFound.length) {
    console.warn(
      `⚠️  ${notFound.length} unknown competition abbreviation(s) skipped (add to seed-competitions.ts first): ${notFound.join(', ')}`,
    );
  }
}

/** assert-based self-test — no DB, runnable in CI. */
function check() {
  const good: CompetitionDataRecord = {
    abbreviation: 'HMMT',
    seasonLabel: '2026-2027',
    registrationCloseAt: '2026-10-15T23:59:00Z',
    eventStartAt: '2026-11-14T09:00:00Z',
    sourceUrl: 'https://www.hmmt.org',
    fetchedAt: '2026-07-02T00:00:00Z',
    tracks: [{ name: 'November', minTeamSize: 4, maxTeamSize: 6 }],
  };
  validateRecord(good); // must not throw
  const p = toEditionPayload(good);
  if (p.registrationCloseAt?.toISOString() !== '2026-10-15T23:59:00.000Z')
    throw new Error('date parse');
  if (
    (p.sourceMeta as { sourceUrl: string }).sourceUrl !== 'https://www.hmmt.org'
  )
    throw new Error('provenance');

  const mustThrow = (rec: Partial<CompetitionDataRecord>, why: string) => {
    try {
      validateRecord(rec as CompetitionDataRecord);
    } catch {
      return;
    }
    throw new Error(`should have rejected: ${why}`);
  };
  mustThrow({ ...good, sourceUrl: '' }, 'no sourceUrl = fabrication');
  mustThrow(
    {
      abbreviation: 'X',
      seasonLabel: '2026-2027',
      sourceUrl: 'u',
      fetchedAt: 't',
    },
    'no dates + no tracks',
  );
  mustThrow({ ...good, eventStartAt: 'not-a-date' }, 'invalid date');
  mustThrow(
    { ...good, tracks: [{ name: 'T', minTeamSize: 5, maxTeamSize: 2 }] },
    'max < min team size',
  );
  console.log('✅ upsert-competition-data self-check passed (5 cases)');
}

const arg = process.argv[2];
if (arg === '--check') {
  check();
} else if (arg) {
  run(arg).catch((e) => {
    console.error('❌', e instanceof Error ? e.message : e);
    process.exit(1);
  });
} else {
  console.error('usage: upsert-competition-data <records.json> | --check');
  process.exit(1);
}
