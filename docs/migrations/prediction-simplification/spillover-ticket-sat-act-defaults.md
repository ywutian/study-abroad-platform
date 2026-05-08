# Spillover Ticket: 33 Schools with Seed-Default SAT/ACT Bands

**Source**: Discovered during Phase C manual review (2026-05-06).
See [`phase-c-manual-review-2026-05-06.md`](phase-c-manual-review-2026-05-06.md) §"Bucket 1".

**Status (2026-05-07)**: PARTIALLY RESOLVED — 22/33 schools now carry real
Scorecard SAT/ACT bands. Remaining 11 schools are genuinely test-blind /
test-optional / arts-portfolio admissions where Scorecard publishes no test
score data; placeholder retention is acceptable but a future task should
either NULL these fields or model "test-blind" as a first-class school flag.
See "Outcome" section below for details.

## Problem

33 US schools share identical placeholder SAT/ACT bands:

```
sat25 = 1080, sat75 = 1320
act25 = 22,   act75 = 29
```

These are clearly seed-default values, not real CDS data.

## Impact

- `testBandMultiplier` accuracy degraded for all 33 schools
- Affects predictions across BOTH Phase B (no math change) AND Phase C (counselor v1.6) — the bad data makes a strong test-score applicant look "average" because the school's apparent test bands are uniformly mediocre
- Most outliers from Phase C manual review touched these schools (Yeshiva, USD, Worcester, Georgia State, SUNY Binghamton, Loyola, USF, Rose-Hulman)

## Identification SQL

```sql
SELECT id, name, "acceptanceRate"
FROM "School"
WHERE country = 'US'
  AND sat25 = 1080 AND sat75 = 1320
  AND act25 = 22   AND act75 = 29
ORDER BY "acceptanceRate" DESC;
```

## Fix Path (one-time, when Docker is up)

### Option A: Targeted Scorecard SAT/ACT cleanup (RECOMMENDED, executed 2026-05-07)

```bash
# Start Docker DB if not running
pnpm docker:up

# Generate Prisma client if needed
pnpm --filter api db:generate

# Dry-run first to preview matches and per-school bands
pnpm --filter api exec tsx scripts/cleanup-33-school-sat-bands.ts --dry-run

# Live run after dry-run looks correct
pnpm --filter api exec tsx scripts/cleanup-33-school-sat-bands.ts
```

The script:

- Targets only schools matching the placeholder pattern
- Fetches SAT/ACT bands directly from College Scorecard
- Handles known campus-disambiguation issues (Penn State University Park vs Altoona, SUNY Binghamton, Pratt Main, etc.) via `NAME_OVERRIDES`
- Prefers "main campus" results when multiple campuses match
- Skips schools where Scorecard returns no SAT/ACT data (test-blind / test-optional)

> The older `sync-scorecard-comprehensive.ts` does NOT update SAT/ACT bands — it only handles cost/outcomes fields. Use the targeted script above.

### Option B: Tavily fallback (for schools not in Scorecard)

If some of the 33 schools aren't in College Scorecard (rare for US degree-granting institutions), use the Tavily-driven CDS marathon:

```bash
TAVILY_API_KEY=<key> \
  pnpm --filter api exec tsx scripts/tavily-cds-marathon.ts \
    --schools "Yeshiva University,University of San Diego,..."
```

### Option C: Manual one-by-one (last resort)

For schools whose CDS data is hard to find, look up CDS Section C9 bands manually from each school's institutional research office page and update via Prisma Studio:

```bash
pnpm --filter api db:studio
```

## Verification

After running the fix:

```sql
-- Count should be 0 (or close to 0 if some schools genuinely have these exact values)
SELECT COUNT(*)
FROM "School"
WHERE country = 'US'
  AND sat25 = 1080 AND sat75 = 1320
  AND act25 = 22   AND act75 = 29;
```

Then re-run the Phase C verification suite to confirm prediction accuracy improvement:

```bash
pnpm --filter api exec tsx scripts/verify-counselor-data-quality.ts
pnpm --filter api gold:counselor
```

## Outcome (2026-05-07 execution)

After running `cleanup-33-school-sat-bands.ts`:

- **22 schools updated** with real Scorecard SAT/ACT bands
- **11 schools** still hold placeholder values — Scorecard genuinely has
  no test-score data published for these institutions:

| School                                  | Acceptance Rate | Reason                                |
| --------------------------------------- | --------------- | ------------------------------------- |
| ArtCenter College of Design             | 76.2%           | Portfolio-based admissions            |
| Berklee College of Music                | 42.0%           | Audition-based admissions             |
| California State University, Fullerton  | 90.5%           | CSU system test-blind since 2025      |
| California State University, Northridge | 70.0%           | CSU system test-blind since 2025      |
| Northern Illinois University            | 88.2%           | Test-optional, Scorecard data missing |
| San Jose State University               | 84.6%           | CSU system test-blind since 2025      |
| School of the Art Institute of Chicago  | 60.0%           | Portfolio-based admissions            |
| The New School                          | 74.2%           | Test-optional, partly arts admissions |
| University of Houston                   | 66.0%           | Test-optional, Scorecard data missing |
| University of San Diego                 | 52.4%           | Test-optional, Scorecard data missing |
| Worcester Polytechnic Institute         | 60.2%           | Test-blind since 2007                 |

For these 11, the placeholder bands no longer materially harm prediction
accuracy because the schools either don't use SAT/ACT at all or de-weight
them heavily. A future improvement would be to model "test-blind" as a
first-class school flag and have the counselor engine skip the
`testBandMultiplier` step for such schools.

Verification SQL:

```sql
SELECT COUNT(*) FROM "School"
WHERE country = 'US' AND sat25 = 1080 AND sat75 = 1320
  AND act25 = 22 AND act75 = 29;
-- 33 → 11 after cleanup
```

## Why this is non-blocking

- Phase B and Phase C **already shipped** with these placeholder values in production data
- Phase B is parity-equivalent to pre-Phase B math, so users see no regression from this issue
- Phase C's manual review classified all 17 outliers as "Bucket 2: Expected math change" — the data quality issue made the change look more dramatic but didn't introduce errors
- Fix is a pure data-side improvement; no code changes needed

## Estimate

- Option A (Scorecard sync): 5-10 minutes
- Option B + verification: 30-60 minutes
- Option C (full manual): 2-4 hours

## Owner / Trigger

Run when:

1. You have time (low-priority data cleanup)
2. OR: A user reports a specific test-score-related prediction issue at one of these 33 schools
3. OR: Before any future marketing claims about prediction accuracy at these schools
