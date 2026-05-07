# Module: prediction

## Purpose

Counselor-primary admission probability prediction. Industry-standard rules-of-thumb anchored on CDS admit bands; falls back to AR+SAT bands then AR-only when CDS is unavailable.

## Key Files

- `prediction.controller.ts` — predict / history / dashboard / school detail / report result / calibration
- `prediction.service.ts` — orchestrates sub-services; primary path is `counselor/CounselorEngineService` when feature flag is enabled
- `prediction-calibration.service.ts` — Platt scaling for legacy fusion path; `prediction-policy.service.ts` — feature flag gates

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

## Served Probability

- Default served probability is the v3 fusion result after local major, feeder, round, and Platt calibration adjustments.
- When `prediction-compliant-distillation-v1` is live-eligible and enabled, `CompliantDistillationService` applies the weighted teacher blend before Platt; Scorecard remains one teacher signal inside that blend.
- There is no post-blend Scorecard-only override. With compliant live blend off, served output stays fusion-only (`modelVersion: v3-enterprise`).

## Gotchas

- Counselor mode is the primary served path; legacy fusion runs only when the counselor flag is disabled
- `servedTrace` and internal policy gates must NOT be exposed to regular users
- Points charged before prediction; refunded on failure via `safeRefund`
- ML platform layer (ml/, benchmark/, prediction-ml-primary, diagnostic-ingest) was removed 2026-05-07; restore via `git log --diff-filter=D` if real ML training resumes
