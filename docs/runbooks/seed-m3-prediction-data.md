# Runbook — Seed M3 Prediction Data to Production

## What this seeds

Two idempotent Prisma seed scripts that populate per-school hook % and
applicant-pool baselines required by the **M3 v2 Bayesian engine**:

| Seed                                    | Target                                                                                                                                                                                            | Rows                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `prisma/seed-hook-stats.ts`             | `School.{legacyClassPct,athleteClassPct,firstGenClassPct,legacyAdmitMultiplier,athleteAdmitMultiplier,admitProfileSource,admitProfileConfidenceTier,admitProfileUpdatedAt,admitProfileCycleYear}` | 101 schools (8 HIGH + 93 MEDIUM)                        |
| `prisma/seed-global-admit-baselines.ts` | `GlobalAdmitBaseline` table                                                                                                                                                                       | 5 rows (legacy/athlete/firstgen/intl/award apply rates) |

Without these seeds the M3 v2 engine falls back to global ×4 legacy / ×3
athlete multipliers, which heavily over-states Stanford-tier and
under-states need-blind STEM schools.

## Prerequisites

1. Schema migration `20260522180000_add_hook_ec_global_baseline` must be
   applied first (adds 14 columns on School + new GlobalAdmitBaseline table).
2. The 5 production scripts depend on School rows existing — they do
   `updateMany on name`, so missing schools are silently skipped (printed
   to stderr but not fatal).

## Applying to staging

Staging auto-pulls from `develop`. After merge to develop:

```bash
# 1. Wait for deploy-staging.yml to finish migrations + service rollout
# 2. Run seed manually via gcloud:

gcloud run jobs create study-abroad-seed-m3 \
  --image="us-central1-docker.pkg.dev/${GCP_PROJECT_ID}/study-abroad/api:latest" \
  --region=us-central1 \
  --service-account=github-actions-deploy@${GCP_PROJECT_ID}.iam.gserviceaccount.com \
  --vpc-connector=projects/${GCP_PROJECT_ID}/locations/us-central1/connectors/study-abroad-connector-staging \
  --vpc-egress=private-ranges-only \
  --task-timeout=300 \
  --max-retries=0 \
  --command="sh" \
  --args="-c,pnpm --filter api db:seed:m3-data" \
  --set-secrets="DATABASE_URL=database-url-staging:latest"

gcloud run jobs execute study-abroad-seed-m3 --region=us-central1 --wait
```

## Applying to production

After PR `product-workbench-rollup` merges to `main` and CI/CD deploys:

```bash
# 1. Confirm migration applied (Cloud Run job log)
gcloud run jobs logs read study-abroad-migrate --region=us-central1 --limit=20 \
  | grep "add_hook_ec_global_baseline"

# 2. Apply seed via one-shot Cloud Run job
gcloud run jobs create study-abroad-seed-m3-prod \
  --image="us-central1-docker.pkg.dev/${GCP_PROJECT_ID}/study-abroad/api:latest" \
  --region=us-central1 \
  --service-account=github-actions-deploy@${GCP_PROJECT_ID}.iam.gserviceaccount.com \
  --vpc-connector=projects/${GCP_PROJECT_ID}/locations/us-central1/connectors/study-abroad-connector \
  --vpc-egress=private-ranges-only \
  --task-timeout=300 \
  --max-retries=0 \
  --command="sh" \
  --args="-c,pnpm --filter api db:seed:m3-data" \
  --set-secrets="DATABASE_URL=database-url:latest"

gcloud run jobs execute study-abroad-seed-m3-prod --region=us-central1 --wait

# 3. Verify
gcloud run jobs executions logs read study-abroad-seed-m3-prod --region=us-central1 --limit=30
# Expected: "Summary: 101 updated, 0 skipped" + "5 inserted, 0 updated"
```

## Verification queries

After the seed runs, SSH (or use `gcloud sql connect`) and query:

```sql
-- Expect 96+ schools with hook data
SELECT COUNT(*) FROM "School"
WHERE "country" = 'US' AND "usNewsRank" <= 100
  AND "legacyClassPct" IS NOT NULL;
-- Expected: ≥ 96

-- Tier breakdown
SELECT "admitProfileConfidenceTier", COUNT(*)
FROM "School"
WHERE "admitProfileConfidenceTier" IS NOT NULL
GROUP BY "admitProfileConfidenceTier";
-- Expected: HIGH=8, MEDIUM=93

-- Global baselines
SELECT metric, value, "confidenceTier" FROM "GlobalAdmitBaseline";
-- Expected: 5 rows

-- Spot check Stanford (HIGH tier)
SELECT name, "legacyClassPct", "legacyAdmitMultiplier", "admitProfileConfidenceTier"
FROM "School" WHERE name = 'Stanford University';
-- Expected: 0.16 / 2.8 / HIGH
```

## Idempotency

Both seeds are safe to re-run:

- `seed-hook-stats.ts` uses `updateMany on name` — re-runs overwrite cleanly
- `seed-global-admit-baselines.ts` uses `findUnique` + update/create — upsert pattern

If a school is later added/renamed in production, the next seed run will
either pick it up (if the name matches) or print "NOT FOUND" to stderr.

## Rollback

To clear the seeded data (e.g. if a bad value shipped):

```sql
-- Clear hook fields on all schools
UPDATE "School" SET
  "legacyClassPct" = NULL,
  "athleteClassPct" = NULL,
  "firstGenClassPct" = NULL,
  "legacyAdmitMultiplier" = NULL,
  "athleteAdmitMultiplier" = NULL,
  "admitProfileSource" = NULL,
  "admitProfileConfidenceTier" = NULL,
  "admitProfileUpdatedAt" = NULL,
  "admitProfileCycleYear" = NULL;

-- Clear global baselines
TRUNCATE TABLE "GlobalAdmitBaseline";
```

M3 v2 engine will fall back to global averages (×4 legacy, ×3 athlete) —
predictions remain functional but less accurate.

## Data confidence note

- HIGH tier (8 schools) — from official CDS / SFFA case / school class profile pubs
- MEDIUM tier (93 schools) — Claude-inferred via 14 peer-school categorical buckets

MEDIUM-tier values are weighted at 0.7× in M3 v2 contributions (vs HIGH=1.0×).
Each row's `admitProfileSource` carries the reasoning chain for audit.

When real per-school data becomes available (e.g. a published CDS), update
the relevant entry in `seed-hook-stats.ts` `HIGH_TIER_SEEDS` and re-run the
seed — the existing MEDIUM row gets overwritten with the new HIGH value.
