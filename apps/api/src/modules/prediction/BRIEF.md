# Module: prediction

## Purpose

Counselor-primary admission probability prediction. Industry-standard rules-of-thumb anchored on CDS admit bands; falls back to AR+SAT bands then AR-only when CDS is unavailable.

## Key Files

- `prediction.controller.ts` — predict / history / dashboard / school detail / report result / calibration
- `prediction.service.ts` — orchestrates sub-services; primary served path is `counselor/CounselorEngineService`
- `prediction-calibration.service.ts` — calibration analytics for verified outcomes; `prediction-policy.service.ts` — policy and trace metadata

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

- Default served probability is counselor-primary: an anchor from CDS bands / acceptance rate, deterministic modifiers, and the anchor clamp.
- Tier 4 returns `probability: null`, `tier: 'unavailable'`, `predictionMethod: 'insufficient_data'`, and is not persisted as a numeric history row.
- Legacy `engineScores`, `crossEngineConsistency`, and `servedTrace.shadow` are optional and absent from new counselor responses.
- Fusion, ML, and distillation are deprecated for served probability. They may be used only for historical analysis or explicitly guarded fallback.
- Accuracy and calibration promotion must use verified outcome labels only; self-reported labels are collected for the closed loop but are not verified truth.

## Gotchas

- Counselor is the primary served path; legacy fusion must not be called by the counselor-primary response path
- `servedTrace` and internal policy gates must NOT be exposed to regular users
- Points charged before prediction; refunded on failure via `safeRefund`
- ML platform layer (ml/, benchmark/, prediction-ml-primary, diagnostic-ingest) was removed 2026-05-07; restore via `git log --diff-filter=D` if real ML training resumes
