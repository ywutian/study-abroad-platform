# Prediction Launch Runbook

Last updated: 2026-05-10

## Purpose

Use this runbook to verify the counselor-primary closed-loop prediction system before launch or after any prediction data import.

## Served Architecture

- Counselor is the only served probability path.
- Tier 1-3 predictions persist numeric `PredictionResult` / `PredictionSnapshot` rows.
- Tier 4 returns `probability: null`, `tier: 'unavailable'`, and does not persist numeric history.
- Legacy `engineScores`, `crossEngineConsistency`, and `servedTrace.shadow` are optional and absent in new counselor responses.
- Self-reported outcomes are collected, but accuracy and calibration gates use verified labels only.

## Required Commands

Run from the repository root:

```bash
pg_isready -h localhost -p 5433
pnpm --filter api build
pnpm --filter api test -- prediction
pnpm --filter api test -- counselor
pnpm --filter api gold:counselor
pnpm --filter api verify:counselor-coverage
pnpm --filter api verify:counselor-data-quality
pnpm --filter api verify:prediction-launch
pnpm --filter api verify:profile-signal-coverage
pnpm --filter api audit:counselor-vs-cases
pnpm --filter web build
pnpm --filter study-abroad-mobile typecheck
```

CI runs the same prediction launch gates in the `prediction-gate` job after
the test database is migrated and seeded. The job uploads
`verification-report/launch/` and `verification-report/profile-signals/` as
artifacts, so a broken verifier or unclassified anomaly blocks PRs instead of
being discovered only during a manual release.

Expected launch reports:

```text
verification-report/launch/coverage.json
verification-report/launch/data-quality.json
verification-report/launch/tier4.json
verification-report/launch/outcome-inventory.json
verification-report/launch/contract.json
verification-report/launch/manual-review.json
verification-report/profile-signals/coverage.json
verification-report/profile-signals/delta-vs-baseline.json
verification-report/profile-signals/case-hindcast.json
verification-report/profile-signals/manual-review.json
```

## Profile Signal Gate

Profile context may affect probability only through the conservative
`profileContext` modifier. Missing profile fields must lower confidence or
appear in gap reporting, not directly lower probability.

Before launch, confirm:

- `verify:profile-signal-coverage` passes with zero uncovered profile signals.
- `delta-vs-baseline.json` has p95 absolute delta `<= 0.025`.
- `delta-vs-baseline.json` has max absolute delta `<= 0.08`.
- Any `(school, archetype)` delta above `0.05` is manually reviewed before launch.
- `audit:counselor-vs-cases` does not lower admitted soft-label cases by more
  than 2pp on average or raise rejected soft-label cases by more than 2pp on
  average.

## Data QA Review

`verify:counselor-data-quality` blocks on:

- unexpected US Tier 4 rows
- invalid GPA distributions
- impossible acceptance-rate anchors
- invalid ACT bands
- uncleaned or unclassified SAT/ACT placeholder bands
- unclassified ED/EA outliers or round rates below overall admit rate

Every blocking row must be fixed in source data or classified in `manual-review.json` before launch. `UNREVIEWED` and `DATA_FIX_REQUIRED` rows block launch.

## Outcome Loop Check

1. Run a numeric prediction for a Tier 1-3 school.
2. Submit `PATCH /predictions/:schoolId/result` with `result`, optional `round`, `isFinal`, `notes`, and `evidenceUrl`.
3. Confirm a `PredictionOutcomeLabelRecord` with `status='SELF_REPORTED'` exists.
4. Confirm prediction history exposes `latestOutcomeLabel`.
5. Confirm `prediction:accuracy` / calibration jobs count verified labels only.

Admin review statuses are:

- `SELF_REPORTED`: user submitted, not calibration truth
- `REQUEST_EVIDENCE`: reviewer needs supporting evidence
- `COUNSELOR_VERIFIED` / `DOCUMENT_VERIFIED`: verified labels eligible for calibration when result is `ADMITTED` or `REJECTED`
- `REJECTED`, `CONFLICTED`, `CENSORED`: not calibration truth

## Tier 4 Check

Use `pnpm --filter api verify:prediction-launch`. The Tier 4 report should show:

- engine sentinel `tier=4`
- API contract `probability=null`
- `predictionMethod='insufficient_data'`
- numeric persistence skipped

## Accuracy Claim Check

`outcome-inventory.json` must keep:

- `calibrationPromotionAllowed=false` until `verifiedCount >= 50`
- `externalAccuracyClaimAllowed=false` until `verifiedCount >= 200`

Self-reported labels are useful for acquisition and counselor follow-up, but they are not verified truth for public accuracy claims.

## Rollback

If launch gates fail because of code regression:

```bash
git revert <merge-sha>
```

If data QA fails after a data import:

1. Revert or patch the imported source rows.
2. Rerun `verify:counselor-data-quality`.
3. Rerun `verify:counselor-coverage`.

Do not promote calibrators, ML, or LLM numeric probability paths until verified outcome counts meet the configured threshold.
