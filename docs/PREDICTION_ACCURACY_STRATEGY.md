# Prediction Accuracy Strategy (No-Sample Era)

**Status**: active strategy
**Last reviewed**: 2026-05-14
**Authoritative decision**: [ADR-0020](adr/0020-prediction-no-sample-calibration.md)
**Implementation entry points**:

- [apps/api/src/modules/prediction/counselor/counselor-engine.service.ts](../apps/api/src/modules/prediction/counselor/counselor-engine.service.ts)
- [apps/api/src/modules/prediction/counselor/counselor-modifiers.ts](../apps/api/src/modules/prediction/counselor/counselor-modifiers.ts)
- [packages/shared/src/scoring/constants.ts](../packages/shared/src/scoring/constants.ts)

---

## 1. Why this document exists

The prediction system has reached a state where the dominant accuracy risk is not the algorithm; it's the **data the algorithm runs on** and **how we communicate uncertainty to users**. This document captures:

1. The strategic decision to _not_ use platform-user samples for calibration (rationale: see ADR-0020).
2. The data-and-uncertainty roadmap that replaces "more samples → better calibration."
3. The competitor and academic context that informed the decision.
4. A concrete execution plan with priorities, work estimates, and verification criteria.

This is intentionally a _strategy_ document, not an architecture spec. It governs _what_ we improve and in what order; the technical mechanics live in [docs/PREDICTION_SYSTEM.md](PREDICTION_SYSTEM.md) and the inline code comments.

---

## 2. The core principle

> **In the no-sample era, the served prediction is a transparent function of (school-level public data) × (literature-derived modifiers) — never of platform-user outcomes.**

Corollaries:

- **Anchor accuracy = public-data completeness.** Every gap in the school side of the data (`intlAcceptanceRate`, `oosAcceptanceRate`, `needBlindInternational`, `edAcceptanceRate`, SAT distribution staleness) directly translates to prediction error. School-data ETL maintenance is the highest-leverage accuracy investment.
- **Missing data → wider intervals, not aggressive defaults.** When we lack a signal, the model should hedge (midpoint multipliers, wider confidence ranges, explicit "unverified" labels in the UI) rather than assume the worse case.
- **Heuristic multipliers stay conservative.** Magic numbers without published-data backing should sit close to 1.0 and be clearly labeled in code as heuristic, not data-driven.
- **Verified outcomes are diagnostic, not training data.** They drive _human review_ of rules and _admin dashboards_; they do not feed back into per-school multipliers.

---

## 3. Competitor & literature context

This is a condensed digest of a longer competitor research pass conducted 2026-05-14. The findings shaped ADR-0020.

### 3.1 What competitors actually do

| Product                                                                       | Probability source                                          | Sample-bias handling                                                                        | Public methodology                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **CollegeVine**                                                               | ML model on ~75 features, trained on user-uploaded outcomes | Not addressed; admits "overestimates <20% schools" and "built for domestic applicants"      | Blog-level description; no calibration plot, no paper |
| **Niche**                                                                     | 2D scattergram (GPA + test) from self-reported users        | Not addressed                                                                               | One sentence; counselor community openly criticizes   |
| **Cappex / Appily / CollegeData**                                             | Scattergram from self-reported users                        | Not addressed                                                                               | Trivial                                               |
| **Naviance**                                                                  | Per-high-school historical scattergram                      | Partially mitigated (single-HS samples avoid cross-platform bias) but small N, time-shifted | Public method (scattergram), no probability           |
| **CollegeBoard BigFuture**                                                    | None — refuses to predict; shows school profiles only       | N/A                                                                                         | Authoritative, deliberately conservative              |
| **Crimson / AdmitYogi**                                                       | Black-box, marketing-language ML claim                      | Unknown (likely none)                                                                       | None                                                  |
| **Chinese agencies** (棕榈大道, 指南者, 新东方前途, 启德, 托普仕, 藤门, 学美) | Counselor + case lookup; no published probability algorithm | N/A — products avoid quoting a number                                                       | None                                                  |

**Common failure pattern**: products that use platform-user samples for calibration consistently break at high-selectivity schools (sub-20% admit rate) because their training pool is the subgroup most likely to submit profiles to chance-me tools. CollegeVine has acknowledged this on their support pages.

**Common defensive pattern**: CollegeBoard and most Chinese agencies _deliberately do not offer a single probability number_. This itself is a methodological statement: the field's most authoritative voices believe the number-quoting business is fraught.

### 3.2 What the academic literature says

| Paper / Source                                                                                                  | Key takeaway                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Lee, Kizilcec, Joachims (Cornell, 2023, L@S Best Paper)** — _Evaluating a Learned Admission-Prediction Model_ | 13k samples at a single selective university. The headline metric is calibration ("predicted rate matches actual rate by pool"), not individual accuracy. Sample size 13k is the floor before they claim calibrated. Below that, results are pool-level, not individual-level. |
| **Lee et al. 2024 (arXiv 2407.11199)**                                                                          | Removing race from a model _decreases_ top-pool diversity without raising academic merit — race in admissions models carried diversity signal, not "merit substitution." Implication: removing one variable doesn't sterilize the model; correlated proxies remain.            |
| **Bayesian hierarchical / BaCIS literature** (PMC 6546564)                                                      | When one subgroup dominates a sample, fitting a global model produces regressive bias for every other subgroup. Remedy: cluster then borrow strength. This requires N we don't have.                                                                                           |
| **Algorithmic College Admissions HCI 2025** (ACM 10.1145/3757550)                                               | Even with transparent methodology, users perceive algorithmic admissions tools as inaccurate and privacy-invasive. Transparency alone doesn't fix trust; expectation management matters more.                                                                                  |
| **Stanford CRJ SFFA FAQ (2023)**, **Brookings**, **UChicago Law Review**                                        | Post-SFFA, race-correlated proxies (ZIP, high school, name, language) are the next litigation focus. Models using platform-user data inherit demographic signal whether they intend to or not.                                                                                 |

### 3.3 What we conclude

1. The "use more user data → better calibration" path is empirically refuted (CollegeVine), statistically refuted (Bayesian hierarchical), and legally risky (SFFA proxy doctrine).
2. The "use full-applicant-pool public data + cite the sources" path is methodologically defensible, legally safer, and currently unoccupied in the competitive landscape.
3. The "give a single number" UX is a known trust trap — we should normalize ranges, tiers, and "data-sufficiency" badges.

---

## 4. What changed in this iteration (2026-05-14)

### 4.1 Code changes

| File                                                                                                                                                                     | Change                                                                                                                                                                                                                                | Reason                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [apps/api/prisma/seed-calibrations.ts](../apps/api/prisma/seed-calibrations.ts)                                                                                          | Emptied `calibrations` array; added long file-header explaining the rationale and a SQL snippet for production cleanup                                                                                                                | Removed 5 hand-tuned multipliers that had no full-pool data backing                                                                                                              |
| [apps/api/src/modules/prediction/counselor/counselor-modifiers.ts](../apps/api/src/modules/prediction/counselor/counselor-modifiers.ts) (`intlMultiplier`)               | Changed `if (school.needBlindInternational)` → `if (school.needBlindInternational === true)`; unverified branches now use midpoint between need-blind and need-aware multipliers (0.78×, 0.78×, 0.48× at the three selectivity tiers) | `Boolean @default(false)` made the column unable to distinguish "unreviewed" from "verified need-aware"; old code systematically penalized intl applicants at unreviewed schools |
| [apps/api/src/modules/prediction/counselor/counselor-modifiers.ts](../apps/api/src/modules/prediction/counselor/counselor-modifiers.ts) (`financialAidContextComponent`) | Same `=== true` change; unverified branches now apply half the previous aid penalty (0.975× / 0.99×)                                                                                                                                  | Same data-availability reasoning                                                                                                                                                 |
| [apps/api/src/modules/prediction/counselor/counselor-modifiers.ts](../apps/api/src/modules/prediction/counselor/counselor-modifiers.ts) (`englishReadinessComponent`)    | International applicant with no English score now returns 0.92× instead of 1.0×                                                                                                                                                       | Previously an intl applicant who didn't submit a TOEFL/IELTS got no down-adjustment — a clean miss                                                                               |
| [apps/api/src/modules/prediction/counselor/counselor-modifiers.spec.ts](../apps/api/src/modules/prediction/counselor/counselor-modifiers.spec.ts)                        | Added 4 regression tests (3 needBlind-unverified midpoints, 1 missing-English penalty)                                                                                                                                                | Locks in new behavior                                                                                                                                                            |

ED heuristic tightening (2.5× → 2.0× when school hasn't published an ED rate) was **considered and deferred**. The existing 2.5× is supported by NACAC peer-school averages, and a test (`annotates clamp activation when modifiers exceed bounds`) depends on a high-product scenario that breaks at 2.0×. Address that test alongside the ED change in a follow-up.

### 4.2 Production migration

After this change deploys, run a one-time cleanup against any environment that previously seeded the 5 hand-tuned rows:

```sql
DELETE FROM "SchoolCalibration"
WHERE "reason" LIKE 'Model %estimates%';
```

(Or use the admin UI at `/admin/calibrations` to clear them.)

---

## 5. Roadmap

Order is set by leverage on accuracy _without_ requiring user samples. Each phase is independently shippable.

### Phase A — Cleanup (shipped in this PR)

- [x] Remove 5 unverified `SchoolCalibration` seeds
- [x] `needBlindInternational` unverified → midpoint
- [x] `englishReadiness` missing → 0.92× for intl applicants
- [ ] (deferred) ED heuristic 2.5× → 2.0× — needs the clamp-annotation test updated first

### Phase B — Algorithm correctness (low cost, no data dependency)

- [ ] **GPA scale enforcement.** Change `gpaScale` from optional with 4.0 fallback to a required enum (`UNWEIGHTED_4_0 | WEIGHTED_4_3 | WEIGHTED_5_0 | PERCENT_100 | IB_7 | A_LEVEL | GAOKAO_750`). Front-end registration must require it. Without this, a UC-weighted 4.3 GPA is silently read as a 4.0-scale 4.0, costing the student a band.
- [ ] **SAT placeholder via metadata.** Replace the numeric heuristic `isPlaceholderSatBand(sat25, sat75) === sat25 === 1080 && sat75 === 1320` with a `School.metadata.provenance.sat25.source = 'PLACEHOLDER'` check.
- [ ] **Tier 4 soft handling for art/music conservatories.** Today they return "insufficient data" / no prediction. Consider a portfolio-quality-aware fallback or a clearer UI message ("portfolio review not modeled") rather than a hard refusal.

### Phase C — School metadata completeness (the highest accuracy leverage)

These are pure data tasks; they don't require code changes. Every entry replaces a heuristic with a measured value.

- [ ] **CDS Section C21 (ED / EA admit rates), Top 100 schools.** When present, `roundMultiplier` uses the measured ratio (clamped [1.0, 3.5]); when absent, falls back to the 2.5× / 2.0× / 1.5× / 1.3× heuristic.
- [ ] **CDS Section C7 (international admit rate), Top 200 schools.** This is the single highest-leverage data investment for Chinese applicants; it activates the "school-published intl rate" branch of `intlMultiplier` instead of the selectivity-tiered fallback.
- [ ] **`needBlindInternational` full review.** ~30 schools globally are need-blind for international applicants; reviewing the verified list once eliminates a major source of intl-applicant underestimation.
- [ ] **`oosAcceptanceRate` for public flagships.** Activates the data-driven branch of `geoMultiplier` for public schools; replaces the 1.8× / 0.5× heuristic for the "strong-preference state" set.
- [ ] **Staleness monitoring.** Surface in an admin dashboard: which school fields are >12 months stale or marked `PLACEHOLDER`; which are missing entirely. Each becomes a data-task for the operations team.

### Phase D — Uncertainty communication (front-end work)

- [ ] **Dynamic confidence intervals.** The current ±5% fixed band is wrong when school data is incomplete. Widen based on `SchoolPredictionDataQuality.heuristicFields.length + staleFields.length + missingFields.length`, up to ±20%.
- [ ] **"Data sourced" vs. "data inferred" chip on school cards.** The `dataSupportLevel` field in [prediction-public-explanation.ts](../apps/api/src/modules/prediction/prediction-public-explanation.ts) already exists; ground it in real school-data quality rather than just the engine's `confidence` enum.
- [ ] **Range-first UX, not single-percent.** Display "25–40% (likely)" rather than "32%". Align with Lee–Kizilcec–Joachims pool-level framing: "applicants with this profile are admitted ~30% of the time at this school," not "you have a 32% chance."

### Phase E — Diagnostic-only sample telemetry (no closed loop)

Per ADR-0020, verified outcomes are diagnostic, not training. Build the _signal_ layer without the _autoupdate_ layer.

- [ ] **Admin "drift" dashboard.** Aggregate predicted-vs-actual deltas (when verified outcomes exist) by school, by application round, by cohort. Surface the largest systematic deltas as candidates for human rule review. **No automatic multiplier writes.**
- [ ] **Per-engineer outlier feed.** When a prediction >80% is verified rejected (or <20% verified admitted), surface the case for engineer review. Outliers often expose missing modifiers; they should drive rule changes, not multiplier patches.
- [ ] **Quarterly counselor-review panel.** Invite 1-2 admissions experts to review 30 randomly-sampled predictions; collect their "this looks too high / too low / about right" judgments as a soft validation signal. Track over time.

### Phase F — Sanity gates (engineering hygiene)

- [ ] **Sanity e2e test suite.** Codify expectations that:
  - Top stats applicant (4.0 / 1600 / strong activities) at MIT → never >50%
  - Average intl applicant at >50% admit-rate school → never <30%
  - Domestic CA resident at UC → reasonable in-state range
  - Need-aware school + financial aid request → modest negative adjustment, not a cliff
  - Maximally data-missing scenario → wide interval, low confidence label

  Run on every PR touching `counselor/` or `scoring/`.

- [ ] **Known-public-case baseline.** Manually enter 20-30 publicly-reported admission cases (student blogs, Reddit results threads, college-counseling press) into the system, run predictions, snapshot the report. Re-run after every algorithm change to catch unintended shifts.

---

## 6. What's explicitly out of scope

This strategy intentionally does **not** include:

- Training an ML model on platform user outcomes (any cohort, any size, any architecture)
- Per-school calibration multipliers derived from platform observations
- Race / ethnicity as input variables, or any feature that would proxy them
- Auto-updating multipliers from `PredictionFeedback` signals
- Promising "X% probability" as a single number to end users

These remain out of scope until subgroup-conditioned calibration is designed and validated (see ADR-0020 §"Decision item 5"). At that point, this document and ADR-0020 should both be revisited.

---

## 7. How to verify accuracy improvements

Without sample-based backtesting, accuracy verification leans on:

1. **Phase F sanity tests** (continuous CI signal).
2. **Phase E diagnostic dashboards** (when verified outcomes exist, do the residuals trend toward zero after a change?).
3. **Manual review of public cases** (Phase F's known-case baseline).
4. **Counselor panel feedback** (Phase E item 3).

We avoid claiming "accuracy" in absolute terms. The claim is **methodological**: each modifier is traceable to a public data source or peer-reviewed reference; missing data is explicitly surfaced rather than papered over; and no platform-specific bias is silently amplified through global multipliers.

---

## 8. Decision log

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Author                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 2026-05-14 | Adopt no-sample-calibration policy; ship Phase A cleanup; record competitor and literature context                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Product owner, advised by deep-research pass |
| 2026-05-14 | Phase B-C kickoff: schema (needBlindInternational → nullable), need-blind seed expansion 5 → 10 verified + 16 explicit need-aware, intlAcceptanceRate seeded for 23 high/medium-confidence schools, admin data-health dashboard service + endpoint + page, operations SOP published                                                                                                                                                                                                                                                                                                     | Product owner                                |
| 2026-05-14 | Closed-loop hardening: wire new seeds into the main `prisma db:seed` entrypoint; align statistical-engine, hook-modifiers, counselor-backfill, and intl-pool-teacher to `=== true` / `!== true` so unreviewed (null) schools are no longer silently treated as verified need-aware; extend `BulkUpdateSchoolRatesDto` and `tryBooleanField` to accept explicit `null` as "clear back to unreviewed"; replace the Checkbox in the admin school edit dialog with a tri-state Select; align shared + web `School` types to `boolean \| null`; add regression tests for the null-clear path | Product owner                                |

---

## 9. Phase B-C shipped (2026-05-14)

This section records the concrete artifacts produced in the second round of work. It is _not_ an architecture description — that lives in inline code comments and ADR-0020.

### Code

- `apps/api/prisma/schema.prisma` — `needBlindInternational` migrated from `Boolean @default(false)` to `Boolean?` so "unreviewed" can be distinguished from "verified need-aware"
- `apps/api/prisma/migrations/20260514141500_need_blind_intl_nullable/` — migration + data backfill that resets all existing `false` rows to `null` (the only `true` rows came from the trusted seed and are preserved)
- `apps/api/prisma/seed-intl-schools.ts` — extended from 5 → 10 verified need-blind schools plus 16 explicitly-confirmed need-aware schools, each with a source URL
- `apps/api/prisma/seed-intl-acceptance-rates.ts` — new seed: 23 HIGH/MEDIUM-confidence `intlAcceptanceRate` rows with source provenance
- `apps/api/src/modules/admin/admin-school-data-health.service.ts` — new service that ranks schools by `(importanceWeight × gapWeight)` so operators can work top-down
- `apps/api/src/modules/admin/admin-school-data-pipeline.controller.ts` — new endpoint `GET /admin/schools/data-health`
- `apps/web/src/app/[locale]/(main)/admin/schools/data-health/page.tsx` — operator-facing dashboard with focus tabs (`all` / `intl` / `rounds` / `academic`)
- `apps/web/src/app/[locale]/(main)/admin/_components/admin-sidebar.tsx` — sidebar entry
- `apps/api/src/modules/prediction/counselor/counselor-modifiers.ts` — `intlMultiplier` and `financialAidContextComponent` now branch on `=== true` instead of truthy

### Tests

- `apps/api/src/modules/admin/admin-school-data-health.service.spec.ts` — 6 tests covering rank-weight ordering, gap-bucket weights, healthy-school exclusion, terminal-field handling, limit, unranked-school filter
- `apps/api/src/modules/prediction/counselor/counselor-modifiers.spec.ts` — regression tests for needBlind-unverified midpoints

### Docs

- [adr/0020-prediction-no-sample-calibration.md](adr/0020-prediction-no-sample-calibration.md) — decision record
- [SCHOOL_DATA_COLLECTION_SOP.md](SCHOOL_DATA_COLLECTION_SOP.md) — runbook for operators
