---
name: competition-data-update
description: Refresh REAL competition schedule data (current-season registration/event dates + tracks + eligibility) for the Teams/Tindermatch recruitment feature, via Claude-intelligence collection — subagents that genuinely WebSearch + WebFetch each competition's official site, NOT a scraper and NOT fabricated. The twin of closure-update, but for `Competition`/`CompetitionEdition`/`CompetitionTrack` instead of prediction/CDS data. Use each season rollover, before launching Teams to prod, or when edition dates are stale/synthetic (sourceMeta null). Hard rule: never invent a date — no published source ⇒ leave it null.
---

# /competition-data-update — Real competition schedule refresh

The Teams "Tindermatch" recruitment deck groups teams by **official competition
contexts** (e.g. "HMMT / November", "USACO / Platinum"). Those come from
`Competition` → `CompetitionEdition` → `CompetitionTrack`. The competition _list_
(112 rows, real names + official websites) is curated in `seed-competitions.ts`,
but the **per-season dates** are currently synthetic (`seed-teams.ts` fabricates
them with `buildEditionSchedule(now, index)`). This skill replaces those with
**real, web-verified** dates — so a student sees the actual registration deadline
for this year's edition, not a placeholder.

Data is acquired by **Claude intelligence** (subagents that WebSearch + WebFetch

- read official pages), exactly like `closure-update` — **never a scraper, never
  fabricated.**

## When to use

- **Season rollover** (a new `YYYY-YYYY` season) — editions need this year's dates.
- **Before launching Teams to prod** — synthetic dates aren't launch-credible.
- **Stale check** — editions whose `sourceMeta` is null (never web-verified) or old.

Do NOT use to invent teams/users — that's demo seed data (`seed-teams.ts`), a
different concern. This skill only touches _competition reference schedules_.

## Procedure

### 1. Orient

- Branch off `main`. Ensure a DB is reachable (`DATABASE_URL` set; local Docker
  Postgres is fine). Competitions must already be seeded: `pnpm --filter api db:seed:competitions`.
- Compute the target season: `const s = new Date().getFullYear(); const season = \`${s}-${s + 1}\``.

### 2. Find what's pending

List active competitions whose current-season edition is missing or unverified:

```sql
SELECT c.abbreviation, c.name, c.website, c.tier
FROM "Competition" c
LEFT JOIN "CompetitionEdition" e
  ON e."competitionId" = c.id AND e."seasonLabel" = '<season>'
WHERE c."isActive" = true AND (e.id IS NULL OR e."sourceMeta" IS NULL)
ORDER BY c.tier DESC;   -- do the flagship, highest-signal competitions first
```

If empty → report "all current-season editions web-verified", stop.

### 3. Dispatch Claude-intelligence collection (the core — NOT a scraper)

Fan out **background general-purpose subagents**, ≤8 concurrent, each owning a
batch of ~10 competitions. Each subagent, per competition:

1. **Real WebSearch + WebFetch** the official site (the `website` column) + its
   "dates"/"rules"/"eligibility" pages. Claude _reads and understands_ the page
   — messy tables, PDFs, CN pages — to extract for the **current season**:
   - `registrationOpenAt` / `registrationCloseAt` / `eventStartAt` / `eventEndAt` (ISO 8601)
   - `tracks[]`: real divisions/rounds (e.g. USACO Bronze/Silver/Gold/Platinum;
     HMMT November/February) with sane `minTeamSize`/`maxTeamSize`
2. **Never fabricate.** A date not published for this season yet ⇒ leave it
   `null` (that is a valid, honest "not announced"). A whole competition with no
   findable current-season info ⇒ omit its record entirely.
3. Emit one JSON record per competition it _did_ verify (shape below), with the
   `sourceUrl` it actually read + `fetchedAt` + `confidence`.

Return each batch's records; the parent concatenates them into one JSON array file.

### 4. Ingest (idempotent, provenance-checked)

```bash
pnpm --filter api db:seed:competition-data /abs/path/records.json
```

`prisma/seeds/upsert-competition-data.ts` upserts editions (dates + `sourceMeta`
provenance) + tracks by their unique keys. It **rejects any record without a
`sourceUrl`** (the anti-fabrication gate) and skips unknown abbreviations (add
those to `seed-competitions.ts` first — the curated list is the SSOT). Re-runnable.

### 5. Verify + commit

- `SELECT count(*) FROM "CompetitionEdition" WHERE "seasonLabel"='<season>' AND "sourceMeta" IS NOT NULL;` — the newly-verified count.
- Spot-check 2-3 against their `sourceUrl`.
- Commit (one coherent commit; message = season + how many editions verified + "no fabrication"). The migration `..._competition_edition_source_meta` (adds `sourceMeta`) must be in the tree.

### 6. Report

Verified count this run, per-tier coverage, and any competitions left `null`
(unpublished/undeterminable) — those are honest gaps, not failures.

## The JSON record shape

```jsonc
{
  "abbreviation": "HMMT", // must match Competition.abbreviation
  "seasonLabel": "2026-2027",
  "registrationCloseAt": "2026-10-15T23:59:00Z", // omit/null if unpublished
  "eventStartAt": "2026-11-14T09:00:00Z",
  "tracks": [{ "name": "November", "minTeamSize": 4, "maxTeamSize": 6 }],
  "sourceUrl": "https://www.hmmt.org", // REQUIRED — the page you actually read
  "fetchedAt": "2026-07-02T00:00:00Z",
  "confidence": "high", // high | medium | low
}
```

## Hard rules

- **Never fabricate a date.** Unpublished ⇒ `null`. No source ⇒ omit the record.
- **Every written value carries provenance** (`sourceMeta.sourceUrl` + `fetchedAt`).
  Synthetic seed dates keep `sourceMeta = null` so consumers can tell them apart.
- **The 112-competition list is the SSOT.** This skill fills _schedules_; to add a
  new competition, edit `seed-competitions.ts` first.
- Don't chase 100% — many competitions announce next-season dates late. Coverage
  of the flagship/high-tier ones is what makes the deck credible.
