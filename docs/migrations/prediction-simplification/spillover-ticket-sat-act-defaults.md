# Spillover Ticket: 33 Schools with Seed-Default SAT/ACT Bands

**Source**: Discovered during Phase C manual review (2026-05-06).
See [`phase-c-manual-review-2026-05-06.md`](phase-c-manual-review-2026-05-06.md) §"Bucket 1".

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

### Option A: Scorecard sync (preferred, automated)

```bash
# Start Docker DB if not running
pnpm docker:up

# Generate Prisma client if needed
pnpm --filter api db:generate

# Re-run the comprehensive Scorecard sync, only for missing fields
COLLEGE_SCORECARD_API_KEY=<key> \
  pnpm --filter api exec tsx scripts/sync-scorecard-comprehensive.ts --only-missing
```

The Scorecard sync also pulls SAT/ACT band data; for schools where Scorecard has data, this should overwrite the placeholders with real values.

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
