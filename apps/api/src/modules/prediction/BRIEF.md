# Module: prediction

## Purpose

ML-powered admission probability prediction using multi-engine fusion (statistical, AI, historical case-matching).

## Key Files

- `prediction.controller.ts` — Endpoints: predict, history, dashboard, school detail, report result, calibration
- `prediction.service.ts` — Orchestrates 13 sub-services into v3-enterprise ensemble pipeline
- `prediction-statistical-engine.service.ts` / `prediction-ai-engine.service.ts` — Two primary engines
- `prediction-fusion-engine.service.ts` — Merges engine outputs into final probability
- `prediction-ml-primary.service.ts` — v5 shadow/served pipeline
- `prediction-calibration.service.ts` — Platt recalibration using actual outcomes
- `prediction-policy.service.ts` — Policy gates and version tracking

## Data Model

- `PredictionResult` — Per-profile-per-school latest (unique: profileId+schoolId)
- `PredictionSnapshot` — Historical snapshots for trend tracking
- `PredictionOutcomeLabel` — User-reported outcomes for calibration

## Business Rules

- UC selection auto-expands to all 9 campuses; probability anchored ±15pp of statistical baseline
- Confidence intervals: high ±4%, medium ±7%, low ±11%
- Quick-match never overwrites higher-quality versions (v3/v2)
- Calibration admin-only; result reporting uses @ThrottleSensitive

## Gotchas

- 18+ service files — largest module in the codebase; thin facade pattern
- v5 ML-primary may be in shadow mode; school agent must serve the actually-served result
- `servedTrace` and internal policy gates must NOT be exposed to regular users
- Points charged before prediction; refunded on failure via `safeRefund`
