# Module: prediction

## Purpose

ML-powered admission probability prediction using multi-engine fusion (statistical, AI, historical case-matching).

## Key Files

- `prediction.controller.ts` — predict / history / dashboard / school detail / report result / calibration
- `prediction.service.ts` — orchestrates 13 sub-services; engines: statistical + ai + fusion
- `prediction-ml-primary.service.ts` — v5 shadow/served; `prediction-calibration.service.ts` — Platt; `prediction-policy.service.ts` — gates

## Data Model

- `PredictionResult` / `PredictionSnapshot` — both carry `authority: PredictionAuthority?` (AUTHORITATIVE | PREVIEW)
- `PredictionOutcomeLabel` — user-reported outcomes for calibration

## Authority invariant

Two writers share these tables; `authority` prevents cross-writer collisions.

- `AUTHORITATIVE` — full pipeline via `PredictionPersistenceService`
- `PREVIEW` — `SchoolListService.syncQuickMatchToPrediction`

PREVIEW must never overwrite AUTHORITATIVE. Enforced at: (1) `school-list.service.ts` skip-on-authority-match; (2) `check-integration.ts` rule `prediction-write-must-declare-authority`; (3) persistence/school-list/chinese-outcome-teacher specs.

Consumer rule: any read feeding stats / training / distillation / UI trend **must** filter `authority: 'AUTHORITATIVE'`. PREVIEW never writes `PredictionSnapshot` (no snapshot pollution).

## Business Rules

- UC selection auto-expands to all 9 campuses; probability anchored ±15pp of statistical baseline
- Confidence intervals: high ±4%, medium ±7%, low ±11%
- Calibration admin-only; result reporting uses @ThrottleSensitive

## Gotchas

- v5 ML-primary may be in shadow mode; school agent must serve the actually-served result
- `servedTrace` and internal policy gates must NOT be exposed to regular users
- Points charged before prediction; refunded on failure via `safeRefund`
