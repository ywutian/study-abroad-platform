# ADR-0020: No Per-Sample Calibration for Prediction (No-Sample Era)

- Status: accepted
- Date: 2026-05-14
- Decision-makers: Product owner
- Tags: prediction, calibration, statistics, bias, methodology
- Related: [ADR-0016 Prediction ML-Primary Architecture](0016-prediction-ml-primary-architecture.md), [ADR-0017 School Data Provenance](0017-school-data-provenance.md)
- See also: [docs/PREDICTION_ACCURACY_STRATEGY.md](../PREDICTION_ACCURACY_STRATEGY.md)

## Context

Our prediction system targets Chinese students applying to US undergraduate and graduate programs. As of 2026-05 the system has:

- 100% rollout of the rule-based **counselor-v2** engine ([counselor-engine.service.ts](../../apps/api/src/modules/prediction/counselor/counselor-engine.service.ts))
- A `SchoolCalibration.multiplier` layer originally intended to apply per-school Platt scaling from verified admission outcomes
- A `PredictionOutcomeLabelRecord` pipeline to collect verified outcomes (status flow: `SELF_REPORTED → COUNSELOR_VERIFIED | DOCUMENT_VERIFIED`)
- A `seed-calibrations.ts` script that seeded 5 hand-tuned multipliers (BU 1.18, NEU 1.10, UW-Madison 1.08, Penn State 1.12, Purdue 1.10) without underlying samples

Two facts forced a re-evaluation of how the calibration layer should work:

1. **The verified-outcome pool is effectively empty.** `prediction-calibration.service.ts` requires ≥50 verified samples to fit Platt parameters; 99% of schools have multiplier=1.0; the 5 hand-tuned seeds were the only multipliers ever in production.
2. **Even with a much larger sample pool, the data would still be biased.** The platform's user base is heavily Chinese applicants who self-select to use the product, then self-select again to upload outcomes (with strong survivorship bias toward admits). Calibrating a _global_ multiplier from this subgroup corrupts predictions for any non-overlapping subgroup (e.g. domestic applicants, applicants who didn't upload).

Competitor research (see [docs/PREDICTION_ACCURACY_STRATEGY.md §3](../PREDICTION_ACCURACY_STRATEGY.md#3-competitor--literature-context)) confirms that the "use platform users' outcomes to calibrate a global model" pattern has reliably failed:

- CollegeVine publicly admits "well-calibrated overall but overestimates at <20% admit-rate schools" — their training pool is heavily self-selected.
- Niche, Cappex, AdmitYogi, CollegeData all use scattergrams from self-reported data and are repeatedly criticized by counselors for misleading users.
- College Board's BigFuture (an authoritative source) deliberately _does not_ offer chance prediction at all.

The Bayesian-hierarchical literature on small-sample subgroup analysis (cited in the accuracy-strategy doc) is explicit: when one subgroup dominates the sample, fitting a global model produces regressive shrinkage that systematically mis-predicts every other subgroup. The remedy is "cluster first, then borrow strength," which requires sample sizes we do not have and may not be ethical to demand from users.

## Decision

**We will not use platform-user outcomes (`AdmissionCase`, `PredictionOutcomeLabelRecord`, `PredictionFeedback`) to calibrate prediction probabilities — neither now nor at any sample volume — until we have a subgroup-conditioned design that can separate "this platform's user pool" from "the full applicant pool."**

Specifically:

1. **Prediction anchors and modifiers come from full-applicant-pool sources only.** Acceptable sources:
   - College Scorecard / IPEDS (federal, full pool)
   - Common Data Set (school-published, full pool)
   - Manually-reviewed school data (e.g. `needBlindInternational`, `intlAcceptanceRate` from CDS Section C)
   - Peer-reviewed academic literature (Arcidiacono SFFA, NACAC, Lee–Kizilcec–Joachims 2023)

2. **`SchoolCalibration.multiplier` is reserved for entries with full-pool data backing.** The 5 hand-tuned seed entries are removed. Future entries require a citation to a full-pool source in the `reason` field. Multipliers derived from platform-user observations are explicitly forbidden.

3. **Verified-outcome data is collected but used only as a diagnostic signal**, not a calibration input:
   - Admin dashboards may aggregate predicted-vs-actual deltas by school/round/cohort to surface systematic bias for human review.
   - Engineers may use individual case mismatches to identify rule bugs (e.g. "5 students predicted >80% were rejected — what's the missing modifier?").
   - These signals motivate _rule changes_ (which are then applied globally), not _per-school multipliers_.

4. **Uncertainty replaces precision in the no-sample era.** Because we cannot validate predictions empirically, we widen confidence intervals when school metadata is incomplete and surface a `dataSupportLevel` chip in the UI so users see "this prediction is based on inferred data" vs. "this prediction is based on the school's published intl admit rate."

5. **The decision is reversible once subgroup-conditioned calibration is built.** When the platform supports per-subgroup `SchoolCalibration` rows (e.g. `(schoolId, applicantCohort) → multiplier`) and has ≥500 verified outcomes _per relevant subgroup_, this ADR may be superseded.

## Consequences

### Positive

- **No silent bias amplification.** Removing the 5 unverified seeds prevents the system from applying a +8% to +18% boost to schools (BU, NEU, Penn State, Purdue, UW-Madison) where the original "underestimates" judgment was filtered through a Chinese-applicant sample but applied globally.
- **Defensible methodology.** Every probability in the served path can be traced to a public source (CDS, Scorecard, academic paper). This stands up to SFFA-era scrutiny about race-correlated proxies in admissions algorithms.
- **Aligns with academic best practice.** Lee–Kizilcec–Joachims (2023) and Bayesian hierarchical literature support "use a strong prior, don't fit a weak global model."
- **Competitive differentiation.** None of the surveyed competitors (CollegeVine, Niche, Naviance, AdmitYogi, Chinese agencies) publish methodology. A documented "we use full-pool data, here's the source for every modifier" stance is uniquely defensible.

### Negative

- **No automatic correction of systematic errors.** Without the closed-loop, errors discovered by users persist until a human engineer changes a rule. The diagnostic dashboard (Phase E in the accuracy strategy doc) must be built to compensate.
- **Lower accuracy ceiling than a hypothetical perfect-calibration system.** Theoretically, if we had 100k unbiased verified outcomes per school, sample-driven calibration would beat rule-based prediction. We accept this gap; that hypothetical is not reachable in our actual data environment.
- **More dependence on school-data quality.** With no sample-based fallback, the accuracy of every prediction is bounded by how complete and current the school's CDS / Scorecard fields are. This makes school-data ETL maintenance a Tier-1 priority (see strategy doc §2).

### Neutral

- The `PredictionOutcomeLabelRecord` / `PredictionFeedback` schemas are retained as-is; they just feed dashboards and bug reports instead of training pipelines.
- `prediction-calibration.service.ts` Platt scaling code is retained but currently inert (returns identity sigmoid because no school reaches the 50-sample threshold). It is not removed because re-enabling under a subgroup-conditioned design is the future path.
- The 5 hand-tuned seeds are removed from `seed-calibrations.ts`; production environments that already have them in the `SchoolCalibration` table need a one-time cleanup (script documented in the seed file header).

## Implementation Notes

Concrete code changes shipping with this ADR:

- [apps/api/prisma/seed-calibrations.ts](../../apps/api/prisma/seed-calibrations.ts) — calibrations array emptied; file header documents the rationale and the production cleanup SQL.
- [apps/api/src/modules/prediction/counselor/counselor-modifiers.ts](../../apps/api/src/modules/prediction/counselor/counselor-modifiers.ts) — `intlMultiplier` now preserves all three states: verified need-blind (`true`), verified need-aware (`false`), and unreviewed (`null`/missing midpoint). Same tri-state distinction applies in `financialAidContextComponent`. International applicants with no English score now get 0.92× instead of neutral.
- [apps/api/src/modules/prediction/counselor/counselor-modifiers.spec.ts](../../apps/api/src/modules/prediction/counselor/counselor-modifiers.spec.ts) — new regression tests for both behaviors.

Future work (tracked in [docs/PREDICTION_ACCURACY_STRATEGY.md](../PREDICTION_ACCURACY_STRATEGY.md)):

- Consider migrating `School.needBlindInternational` from nullable Boolean to an enum `{ UNKNOWN, NEED_AWARE, NEED_BLIND }` if future policy states need more than the current three values.
- Build the diagnostic dashboard (admin/calibrations/drift) for surfacing systematic bias without feeding it back to the model.
- Backfill CDS Section C7 (international admit rate) for Top 200 schools.
