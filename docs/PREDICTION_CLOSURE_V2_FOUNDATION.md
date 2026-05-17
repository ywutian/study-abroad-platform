# Prediction Closure v2 — Foundation

- Date: 2026-05-17
- Status: foundation shipped; data-collection waves are follow-up
- Plan of record: `plan-v2` (`.claude/plans/plan-v2-compiled-puddle.md`)
- Related: [ADR-0020](adr/0020-prediction-no-sample-calibration.md) ·
  [ADR-0020 Addendum](adr/0020-addendum-research-pipeline.md) ·
  [PREDICTION_ACCURACY_STRATEGY.md](PREDICTION_ACCURACY_STRATEGY.md)

## Why

The first CDS closure cycle (2026-05-16) closed 7 School fields across 224
schools. A deeper audit found the counselor engine consumes far more — ~19
School fields, the whole `HighSchool` dimension, and platform data (verified
`AdmissionCase`, resume evidence, yield, feeder patterns) that prediction never
reads. `closure-v2` is the programme to collect and close that data.

This document records the **foundation** delivered ahead of the data-collection
waves: the schema and the zero-drift engine readiness that the waves write into.

## What shipped in this PR

### 1. Schema — `20260517040000_closure_v2_core_schema`

All additions are nullable or defaulted (zero-downtime, additive only).

| Model        | Added                                                                                                                                                                                                                                                                                                       | Purpose                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `School`     | `yieldRate`, `ed2AcceptanceRate`, `hasRestrictiveEa`                                                                                                                                                                                                                                                        | CDS C2/C21 early-round refinements           |
| `Profile`    | `stateOfResidence`, `applicationCycleYear`, `applicantType`, `recruitedSport`, `recruitedDivision`, `recruitedCoachStatus`, `highSchoolId` (FK→HighSchool)                                                                                                                                                  | geo / lifecycle / recruiting context         |
| `HighSchool` | `curriculumSystem`, `ncesId`, `apOfferings`, `ibOfferings`, `classSize`, `schoolProfilePdfUrl`, `schoolProfileExtractedFields`, + 8 Chinese-HS fields (`cnHsCategory`, `cnHsCityTier`, `cnHsProvince`, `cnHsAlternativeNames`, `gpaConversionTable`, `hasGaokaoTrack`, `hasIntlTrack`, `intlAdmissionList`) | curriculum + reference data + CN HS taxonomy |
| enums        | `ApplicantType`, `RecruitStatus`, `CnHsCategory`; `EducationSystem` += `AP_AND_GAOKAO`, `IB_AND_GAOKAO`, `A_LEVEL_AND_GAOKAO`, `DSE`, `MIXED`                                                                                                                                                               | —                                            |

`HighSchool.curriculumSystem` deliberately **reuses the existing
`EducationSystem` enum** (extended with hybrid values) rather than introducing a
parallel `HighSchoolCurriculum` enum.

### 2. Engine — counselor-modifiers (zero-drift)

Two additive, **zero-drift-by-construction** modifier changes
(`apps/api/src/modules/prediction/counselor/counselor-modifiers.ts`):

- **`geoMultiplier`** now prefers `profile.stateOfResidence` over
  `profile.highSchoolLocation` for the in-state / out-of-state determination,
  falling back to `highSchoolLocation` when unset. A boarding-school student
  from TX at a CA prep school is correctly treated as a TX resident.
- **`roundMultiplier`** adds a yield-informed ED fallback: when a school
  publishes no ED rate but does publish CDS C2 yield, the flat 2.5× heuristic is
  refined to a `[2.0, 3.2]`-bounded estimate (lower yield → larger ED boost).

Both branches activate **only** when the new nullable fields are populated. No
`Profile` row carries `stateOfResidence` and no `School` row carries
`yieldRate` yet, so served predictions are byte-identical to pre-PR behaviour.
The unit tests `falls back to highSchoolLocation when stateOfResidence is unset`
and `falls back to the flat 2.5x ED heuristic when no yield is known` are the
zero-drift proof. `counselor-modifiers.spec.ts`: 35/35 pass (6 new).

### 3. ADR-0020 compliance

The closure-v2 plan's cohort-priors / feeder-signals work is reframed as a
**research-only pipeline** (flags `prediction-cohort-priors` /
`prediction-feeder-signals`, both default-off). See the ADR-0020 addendum. No
cohort prior or feeder signal is computed or consumed in this PR.

## What is NOT in this PR — remaining waves

The data-collection waves are genuine multi-day live-web operations (Tavily /
Scorecard / NCES scraping of ~2800 high schools, ~5000 admission cases,
multi-year CDS PDFs). They are follow-up work, not completable in a single
session without fabricating data:

- Wave 1/2/6 — CDS field closure marathon (`gpaDistribution`, `needBlind`,
  ACT provenance, Tier-1 bands, yield/ED2/REA values, deadlines).
- Wave 5 — HighSchool reference DB (NCES + Niche + 800 Chinese HS).
- Wave 6.3 — external case + essay scraping (4 sources) + BullMQ cron.
- Wave 3 — cohort priors / feeder signals (research-only, per addendum).
- Wave 8/9/10 — reference-data seeds, policy depth, AI-evaluation corpora.

The schema and engine readiness in this PR are the prerequisite those waves
write into.
