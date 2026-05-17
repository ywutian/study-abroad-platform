# ADR-0020 Addendum: Cohort Priors & Feeder Signals as a Research-Only Pipeline

- Status: accepted
- Date: 2026-05-17
- Decision-makers: Product owner
- Tags: prediction, calibration, cohort-priors, feeder-signals, closure-v2
- Amends: [ADR-0020 No Per-Sample Calibration for Prediction](0020-prediction-no-sample-calibration.md)

## Context

The `closure-v2` data-collection programme (see `plan-v2`) proposes, among many
data-collection waves:

- **Cohort priors** — aggregating verified `AdmissionCase` outcomes into
  `SchoolCohortRoundPrior` rows (`(schoolId, round, cohortKey) → priorRate`).
- **Feeder signals** — aggregating `(highSchool, targetSchool)` admit patterns
  into `SchoolRelationshipSignal` rows.

An earlier draft of the closure-v2 plan cited "ADR-0020 §2.5" as explicit
approval for consuming cohort-level priors in the served prediction engine.
**That section does not exist.** ADR-0020 does not approve cohort-level
calibration. Its Decision §2 item 5 states the no-calibration decision is
reversible _only_ once:

> the platform supports per-subgroup `SchoolCalibration` rows … **and has ≥500
> verified outcomes per relevant subgroup**.

As of 2026-05 the verified-outcome pool is ~99 `AdmissionCase` rows total —
roughly two orders of magnitude short of that bar, and subject to the same
survivorship and self-selection bias ADR-0020 describes.

## Decision

Cohort priors and feeder signals **may be built as a research-only pipeline**
but **must not influence served predictions** until the ADR-0020 bar is met.

Concretely:

1. The pipelines write to `SchoolCohortRoundPrior` / `SchoolRelationshipSignal`
   (schema already exists). Writing data is permitted — it is observation, not
   calibration.
2. Two feature flags gate consumption: `prediction-cohort-priors` and
   `prediction-feeder-signals`. **Both default to disabled.**
3. The counselor engine reads these tables **only when the corresponding flag
   is enabled**. With the flags off — their default — the served prediction
   path is byte-identical to today's behaviour.
4. Promotion (enabling a flag for served traffic) requires a _new_ ADR that
   demonstrates the ADR-0020 bar is met for the relevant subgroup
   (≥500 verified outcomes, subgroup-conditioned calibration design).

## Consequences

- **Positive** — closure-v2 can collect and analyse cohort/feeder data, build
  the verified-outcome diagnostic dashboard, and study predictive lift, without
  any compliance risk or served-prediction drift.
- **Positive** — the served engine remains fully ADR-0020-compliant; no
  per-sample or biased-subgroup multiplier reaches users.
- **Neutral** — the flag-gated consumption code adds a small dormant branch to
  the counselor engine. It is exercised only by tests and offline research.
- **Negative** — the predictive value of cohort/feeder data is deferred until a
  future ADR; this is the intended trade-off.

## Status of the closure-v2 foundation (this PR)

The `closure_v2_core_schema` migration and the engine-modifier groundwork
shipped in this PR are **schema + zero-drift engine readiness only**. No cohort
prior or feeder signal is computed or consumed yet. The flag-gated consumption
code and the data pipelines are follow-up work governed by this addendum.
