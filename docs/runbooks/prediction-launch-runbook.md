# Prediction Launch Runbook

Last updated: 2026-05-08

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
pnpm --filter api build
pnpm --filter api test -- prediction
pnpm --filter api test -- counselor
pnpm --filter api gold:counselor
pnpm --filter api verify:counselor-coverage
pnpm --filter api verify:counselor-data-quality
pnpm --filter api verify:prediction-launch
pnpm --filter web build
pnpm --filter study-abroad-mobile typecheck
```

Expected launch reports:

```text
verification-report/launch/coverage.json
verification-report/launch/data-quality.json
verification-report/launch/tier4.json
verification-report/launch/outcome-inventory.json
verification-report/launch/contract.json
```

## Data QA Review

`verify:counselor-data-quality` blocks on:

- unexpected US Tier 4 rows
- invalid GPA distributions
- impossible acceptance-rate anchors
- invalid ACT bands
- unclassified ED/EA outliers or round rates below overall admit rate

Every blocking row must be fixed in source data or classified in a manual review report before launch.

## Outcome Loop Check

1. Run a numeric prediction for a Tier 1-3 school.
2. Submit `PATCH /predictions/:schoolId/result` with `result`, optional `round`, `isFinal`, `notes`, and `evidenceUrl`.
3. Confirm a `PredictionOutcomeLabelRecord` with `status='SELF_REPORTED'` exists.
4. Confirm prediction history exposes `latestOutcomeLabel`.
5. Confirm `prediction:accuracy` / calibration jobs count verified labels only.

## Tier 4 Check

Use `pnpm --filter api verify:prediction-launch`. The Tier 4 report should show:

- engine sentinel `tier=4`
- API contract `probability=null`
- `predictionMethod='insufficient_data'`
- numeric persistence skipped

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
