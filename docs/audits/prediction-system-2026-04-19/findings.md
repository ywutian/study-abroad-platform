# 审计发现

## P0 - Legacy calibration consumes unverified SELF_REPORTED outcomes via PredictionResult.actualResult

- 影响: Calibration and drift suggestions can be trained on contaminated truth while training-data and monitoring paths use verified-only outcomes. This creates conflicting truth regimes inside the same prediction system.
- 建议: Gate all calibration/drift inputs through canonical verified outcome records only. Stop using PredictionResult.actualResult as calibration truth unless its provenance is verified.
- 证据: apps/api/src/modules/prediction/prediction-reporting.service.ts:176；apps/api/src/modules/prediction/prediction-reporting.service.ts:64；apps/api/src/modules/prediction/prediction-calibration.service.ts:112；apps/api/src/modules/prediction/ml/training-data.service.ts:200；docs/PREDICTION_CLOSED_LOOP_SOP.md

## P1 - Served probability is modified after Platt calibration

- 影响: The number shown to users is no longer the same quantity that was calibrated if later major, feeder, round, and school multipliers materially move it.
- 建议: Either calibrate the final served probability after all deterministic adjustments, or move post-calibration modifiers into the calibratable model input space.
- 证据: apps/api/src/modules/prediction/prediction.service.ts:1177；apps/api/src/modules/prediction/prediction.service.ts:1196；apps/api/src/modules/prediction/prediction.service.ts:1234；apps/api/src/modules/prediction/prediction.service.ts:1262；apps/api/src/modules/prediction/prediction.service.ts:841

## P1 - Outward-facing 95% accuracy claim conflicts with current verified baseline and SOP

- 影响: The current claim exposes the product to trust and governance risk because the repo baseline shows zero verified ADMITTED/REJECTED outcomes in the last 365 days.
- 建议: Immediately replace marketing copy with non-quantified language until prediction gate passes with verified sample threshold support.
- 证据: apps/web/src/messages/zh.json:579；apps/web/src/messages/en.json:579；apps/web/src/messages/zh.json:3460；docs/PREDICTION_CLOSED_LOOP_SOP.md

## P1 - Quick-match writes v1-stats rows into PredictionResult and can be mixed into accuracy reporting

- 影响: Without explicit source segmentation, the audit can combine a heuristic quick-match branch with the main prediction workflow and produce misleading aggregate metrics.
- 建议: Split formal reporting by source and modelVersion, and exclude quick-match from any headline prediction accuracy number.
- 证据: apps/api/src/modules/school-list/school-list.service.ts:609；apps/api/src/modules/school-list/school-list.service.ts:608；scripts/prediction-accuracy-report.ts:270

## P2 - Admin overallAccuracy is an unweighted bucket-midpoint proxy

- 影响: The metric can be visually compelling but statistically misleading, especially at low sample counts or when bucket sizes differ materially.
- 建议: Relabel the widget as approximate calibration fit, or replace it with Brier/ECE/verified-sample-aware metrics.
- 证据: apps/web/src/app/[locale]/(main)/admin/calibrations/\_components/overview-tab.tsx:94

## P2 - SCORING_SYSTEM probability formula is stale and blurs base-rate vs personal-chance logic

- 影响: When internal docs describe an outdated probability formula, product copy and operator explanations can drift away from the real scoring implementation.
- 建议: Rewrite the probability section to match the current logistic formula and clearly separate school-wide rates from profile-conditioned personal estimates.
- 证据: docs/SCORING_SYSTEM.md:205；packages/shared/src/scoring/score.ts:560
