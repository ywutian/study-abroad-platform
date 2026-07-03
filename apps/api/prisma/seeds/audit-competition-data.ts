/**
 * Deterministic structural audit for fetched competition-schedule records — the
 * cheap first gate of the `/competition-data-audit` skill (the adversarial
 * re-fetch-the-source pass is the skill's LLM step; this catches the mechanical
 * hallucination tells before you spend a subagent on them).
 *
 * Flags: wrong season, dates out of order, dates implausibly far from "now"
 * (a fabricated 2019 or 2035 deadline), insane team sizes, malformed sourceUrl.
 *
 * Usage:
 *   pnpm --filter api ts-node prisma/seeds/audit-competition-data.ts <records.json> [--season 2026-2027] [--out passed.json]
 *   pnpm --filter api ts-node prisma/seeds/audit-competition-data.ts --check
 *
 * Exit 1 if any record is flagged, so it gates a pipeline. Absent dates are fine
 * (a null deadline = "not published"); this audits what IS present.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export interface AuditRecord {
  abbreviation: string;
  seasonLabel: string;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  eventStartAt?: string | null;
  eventEndAt?: string | null;
  tracks?: Array<{ name: string; minTeamSize: number; maxTeamSize: number }>;
  sourceUrl?: string;
}

const MS_PER_DAY = 86_400_000;

/** Returns the list of problems for one record (empty array = passes). Pure. */
export function auditRecord(
  rec: AuditRecord,
  targetSeason: string,
  now: Date,
): string[] {
  const p: string[] = [];
  if (rec.seasonLabel !== targetSeason) {
    p.push(`season "${rec.seasonLabel}" != target "${targetSeason}"`);
  }
  if (!rec.sourceUrl || !/^https?:\/\/.+/.test(rec.sourceUrl)) {
    p.push('missing/malformed sourceUrl');
  }

  const fields: Array<[string, string | null | undefined]> = [
    ['registrationOpenAt', rec.registrationOpenAt],
    ['registrationCloseAt', rec.registrationCloseAt],
    ['eventStartAt', rec.eventStartAt],
    ['eventEndAt', rec.eventEndAt],
  ];
  const parsed: Array<{ name: string; d: Date }> = [];
  for (const [name, raw] of fields) {
    if (raw == null || raw === '') continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      p.push(`${name}: unparseable "${raw}"`);
      continue;
    }
    parsed.push({ name, d });
    // Plausibility: a real current/next-season date sits within ~[now-6mo, now+18mo].
    const days = (d.getTime() - now.getTime()) / MS_PER_DAY;
    if (days < -185 || days > 550) {
      p.push(
        `${name}: ${d.toISOString().slice(0, 10)} implausibly far from now (likely fabricated)`,
      );
    }
  }
  // Ordering: open ≤ close ≤ eventStart ≤ eventEnd (only across present dates).
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].d.getTime() < parsed[i - 1].d.getTime()) {
      p.push(
        `${parsed[i - 1].name} is after ${parsed[i].name} (dates out of order)`,
      );
    }
  }
  for (const t of rec.tracks ?? []) {
    if (!(
      t.minTeamSize >= 1 &&
      t.maxTeamSize >= t.minTeamSize &&
      t.maxTeamSize <= 50
    )) {
      p.push(
        `track "${t.name}": implausible team size ${t.minTeamSize}-${t.maxTeamSize}`,
      );
    }
  }
  return p;
}

function currentSeason(now: Date): string {
  const y = now.getFullYear();
  return `${y}-${y + 1}`;
}

function run() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file)
    throw new Error(
      'usage: audit-competition-data <records.json> [--season …] [--out …]',
    );
  const now = new Date();
  const seasonIdx = args.indexOf('--season');
  const season = seasonIdx >= 0 ? args[seasonIdx + 1] : currentSeason(now);
  const outIdx = args.indexOf('--out');

  const records = JSON.parse(readFileSync(file, 'utf8')) as AuditRecord[];
  const passed: AuditRecord[] = [];
  let flagged = 0;
  for (const rec of records) {
    const problems = auditRecord(rec, season, now);
    if (problems.length === 0) {
      passed.push(rec);
      console.log(`  ✅ ${rec.abbreviation}`);
    } else {
      flagged += 1;
      console.log(`  🚩 ${rec.abbreviation}: ${problems.join('; ')}`);
    }
  }
  console.log(
    `\nStructural audit (season ${season}): ${passed.length} pass, ${flagged} flagged of ${records.length}.`,
  );
  console.log(
    'Note: passing here means "not obviously fabricated" — still needs the adversarial re-fetch pass before upsert.',
  );
  if (outIdx >= 0) {
    writeFileSync(args[outIdx + 1], JSON.stringify(passed, null, 2));
    console.log(
      `Wrote ${passed.length} structurally-valid record(s) → ${args[outIdx + 1]}`,
    );
  }
  if (flagged > 0) process.exit(1);
}

function check() {
  const now = new Date('2026-07-02T00:00:00Z');
  const ok: AuditRecord = {
    abbreviation: 'HMMT',
    seasonLabel: '2026-2027',
    registrationCloseAt: '2026-10-15T00:00:00Z',
    eventStartAt: '2026-11-14T00:00:00Z',
    sourceUrl: 'https://www.hmmt.org',
    tracks: [{ name: 'November', minTeamSize: 4, maxTeamSize: 6 }],
  };
  const must = (rec: AuditRecord, expectProblem: boolean, label: string) => {
    const probs = auditRecord(rec, '2026-2027', now);
    if (expectProblem !== probs.length > 0) {
      throw new Error(
        `${label}: expected ${expectProblem ? 'flag' : 'pass'}, got ${JSON.stringify(probs)}`,
      );
    }
  };
  must(ok, false, 'clean record passes');
  must({ ...ok, seasonLabel: '2025-2026' }, true, 'wrong season flagged');
  must(
    { ...ok, eventStartAt: '2019-11-14T00:00:00Z' },
    true,
    'ancient date flagged',
  );
  must(
    { ...ok, eventStartAt: '2035-11-14T00:00:00Z' },
    true,
    'far-future date flagged',
  );
  must(
    { ...ok, registrationCloseAt: '2026-12-01T00:00:00Z' },
    true,
    'reg-close after event flagged (out of order)',
  );
  must({ ...ok, sourceUrl: 'not-a-url' }, true, 'bad url flagged');
  must(
    { ...ok, tracks: [{ name: 'T', minTeamSize: 9, maxTeamSize: 2 }] },
    true,
    'bad team size flagged',
  );
  console.log('✅ audit-competition-data self-check passed (7 cases)');
}

if (process.argv.includes('--check')) {
  check();
} else {
  run();
}
