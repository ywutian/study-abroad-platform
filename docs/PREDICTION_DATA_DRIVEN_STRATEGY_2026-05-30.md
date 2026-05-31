# Prediction: Data-Driven & Generalizable Strategy — 2026-05-30

> **Decision record.** Captures (1) what the served prediction engine actually is today, (2) whether it is "CDS-data-driven" (answer: no), (3) the strategic framing the user chose — _以数据为准 + 普适 (data-grounded + generalizable)_, (4) external research that validates it, (5) the real current data coverage, and (6) the resulting execution program.
>
> Related: `PREDICTION_SYSTEM.md` (served architecture), `PREDICTION_DATA_INVENTORY_2026-05-22.md`, `PREDICTION_DATA_CEILING.md`, `cds-data-coverage-2026-04-30.md`, memory `feedback_do_not_tune_coefficients.md`.

## 1. What the served engine actually is (today)

Served path = the **deterministic Counselor engine** (`counselor/`), not ML, not the 3-engine fusion (which is fallback-only), not v5 (deleted 2026-05-07). Rule version `counselor-cold-start-v1.7-launch`.

Final probability:

```
probability = clip( anchor × ∏(modifiers),  lower = anchor × 0.1,  upper = min(0.98, anchor × 2.5) )
```

- **anchor** = (Tier 1) CDS admit-band rate for the applicant's GPA×test cell — **only 9 UC campuses exist** — else (Tier 2/3, ~96% of schools) the school's **overall published acceptance rate**.
- **modifiers** = 8 core + a profile-context composite, each a hand-authored multiplier with a cited source (`counselor-modifiers.ts`): gpaBand, testBand (geo-mean combined), round (ED/EA), firstGen ×1.4, geo (in/out-state), intl (selectivity-tiered), major, + soft profile-context capped to ×[0.90, 1.13]. Legacy/athlete/URM are **disabled** (evidence-required). Several modifiers have a "data-driven path" (use the school's _published_ ED/intl/OOS/major ratio) that fires only when that field is populated; otherwise a hardcoded fallback multiplier.

The modifier constants are **set from admissions literature, not learned** (the engine has ~4 verified outcomes; Platt calibration needs ≥50 and is therefore effectively inactive). The patch history in `counselor-modifiers.ts` shows the constants are tuned against **eyeball regression tests**, not outcome data.

## 2. Is it "CDS-data-driven"? — No.

- It is **data-anchored on marginals** (real published overall admit rate + SAT/ACT distributions) and uses **real per-school ratios where they exist** (ED/intl/OOS/major).
- It is **not** driven by the CDS _joint_ conditional `P(admit | GPA, test)`. That data is `SchoolCdsAdmitBand` = **38 cells across 9 schools, all University of California** (Berkeley, Davis, Irvine, LA, Merced, Riverside, SD, SB, SC). For ~96% of schools the Tier-1 path never fires → anchor falls back to the overall rate.
- It is **not** learned from outcomes (no closed calibration loop at current sample size).

**Net: "data-informed, not data-driven"** — and specifically **not** CDS-band-driven, because that data essentially does not exist outside UC (see §5).

## 3. The strategic framing (user's chosen direction)

User's thesis: _"以数据为准，因为案例和 ML 都偏向个例、不具普适性。"_ This is statistically correct, sharpened into **two independent axes**:

- **Data axis:** aggregate/population (CDS/IPEDS marginals — generalizes ✅) ↔ individual cases (forum reports, single outcomes — overfits ❌).
- **Model axis:** low-capacity structural (few params, strong priors — generalizes ✅) ↔ high-capacity memorizing (large ML — memorizes individuals ❌).

"Cases and ML both overfit to individuals" = forum cases sit at the data-axis bad end; small-sample ML sits at _both_ bad ends. **The fix is both axes' good end: aggregate data + structural model.** The current engine is already on the correct end of the data axis; its weaknesses are (a) marginal coverage gaps and (b) hand-set rather than aggregate-_calibrated_ multipliers.

## 4. External research — validates the direction

| Evidence                                                                                                                                                                                                                                                                    | Implication                                                               | Source                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| **CollegeVine** (largest ML/individual chancing tool) validates only on **aggregate calibration** (pred 50%→48%, 80%→82%, 95%→94%) and **systematically over-predicts at selective schools** (66–78% for UCLA, actual ~15%); admits it can't model essays/hooks/ED/legacy   | The "偏个例" overfitting failure, reproduced in the market leader         | blog.collegevine.com/is-collegevine-chancing-accurate |
| **Naviance/Scoir scattergrams** (pure individual cases): small n (suppressed <5–10), self-report bias, invisible hooks; **PNAS 2023** measured ~50% drop in elite-school applications (undermatching)                                                                       | Individual-case data is not just noisy — measurably harmful               | pnas.org/doi/10.1073/pnas.2306017120                  |
| **College Board BigFuture** (most authoritative tool) = **CDS-anchored aggregate**                                                                                                                                                                                          | The aggregate route is the authoritative route                            | bigfuture.collegeboard.org                            |
| Academic admission-ML: single-institution, **no demonstrated cross-school generalization**; logistic regression competitive with deep nets                                                                                                                                  | "Use ML" buys per-school overfit, not generalization                      | arxiv.org/pdf/2401.11698                              |
| Stats (Riley et al.): at small/biased n, overfitting → **over-extreme miscalibration**; remedy = low capacity + **shrinkage + recalibration to aggregate base rate**; calibration is recoverable by anchoring to aggregates, discrimination from relative-position features | The user's instinct = the textbook small-sample answer                    | pmc.ncbi.nlm.nih.gov/articles/PMC6519266              |
| Counterpoint: double-descent — over-parameterized models _can_ generalize                                                                                                                                                                                                   | "Simple wins" is **regime-specific** (low-data, biased labels), not a law | arxiv.org/pdf/2002.11328                              |

## 5. Data landscape — the joint ceiling is physical

- **CDS / IPEDS / College Scorecard** publish only **marginals**: overall admit rate, SAT/ACT 25–75 (enrolled), enrolled-GPA distribution, ED/EA rates, yield, % need met. They **never** cross GPA×test into an admit rate. No federal source even collects applicant GPA.
- The **only** public admit-by-GPA grids are the **UC system's** (coarse, capped GPA, officially disclaimed as non-predictive). UT/CSU publish eligibility _formulas_, not rate grids. This is exactly why `SchoolCdsAdmitBand` = 9 UC schools and nothing else; the 2026-05-27 research (30 flagships → 0 yield) was structural, not effort.
- Machine-readable at scale: **College Scorecard JSON API + bulk CSV** (overall admit rate + test ranges, ~6.5k schools, public domain) is the best entry point. ED/EA + enrolled-GPA distribution require **per-school CDS scraping** (PDF, voluntary, heterogeneous).
- Sources: collegescorecard.ed.gov/data/api · nces.ed.gov/ipeds · commondataset.org · universityofcalifornia.edu/about-us/information-center.

**Verdict:** marginals are obtainable at scale; the joint `P(admit | profile)` is **not** clean public data anywhere except UC. A generalizable model must _synthesize_ the joint from marginals (current heuristic) or buy biased self-report (rejected).

## 6. Current data coverage (audit 2026-05-25, 243 US schools)

| Field                      | Coverage        | Feeds which path             | Status                   |
| -------------------------- | --------------- | ---------------------------- | ------------------------ |
| `acceptanceRate` (anchor)  | ~100%           | base of ~all predictions     | ✅                       |
| SAT/ACT bands              | 94–100%         | gpaBand / testBand baseline  | ✅                       |
| `gpaDistribution` (CDS C9) | 76%             | gpaBand **data-driven** path | ✅                       |
| `intlAcceptanceRate`       | 77%             | intl **data-driven** path    | ✅                       |
| `oosAcceptanceRate`        | 54%             | geo data-driven path         | 🟡                       |
| `edAcceptanceRate`         | **28%**         | round data-driven path       | 🔴 72% on hardcoded ×2.5 |
| `eaAcceptanceRate`         | **9–12%**       | round data-driven path       | 🔴 88% on hardcoded ×1.3 |
| CDS admit-bands (joint)    | **4% (all UC)** | Tier-1 real anchor           | ⛔ physically capped     |

Two findings: (1) **marginals are already well-covered** — the old "data scarcity" framing was wrong for marginals (`gpaDistribution` is 76%, not 3/23). (2) **The fillable gaps are ED / EA / OOS**, and the **selective tier is the thinnest** (Harvard/Stanford/MIT/Yale all miss ED rate + CDS bands) — i.e., data is weakest exactly where prediction is hardest.

## 7. Program (the execution plan)

1. **Fill the marginals (highest ROI, fully feasible, zero individual data).** Backfill `edAcceptanceRate` / `eaAcceptanceRate` / `oosAcceptanceRate` from CDS C21 / school IR, prioritized by the gap worklist, selective tier first. Each fill converts a hardcoded `×2.5`/`×1.3` into a real `roundRate/overallRate` ratio. Persist with provenance through the existing seed pipeline.
2. **Aggregate self-calibration (makes the _bridge_ data-driven, zero individual data).** Validate/calibrate the engine so its predicted mean for a school's subgroup matches that school's _published_ subgroup rate (e.g. mean predicted intl probability for school X ≈ X's published intl admit rate; ED-group mean ≈ published ED rate). This recalibrates to aggregate base rates without any outcome labels.
3. **Accept the resolution ceiling honestly.** At <20% admit-rate schools, emit **wide uncertainty around the base rate**, not false-precision point probabilities. The joint-conditional signal (hooks/essays/fit) is not publicly obtainable; any non-overfit method is bounded here.
4. **Demote individual-case + small-sample ML to shadow.** Forum-case corpus and case-derived teachers (chinese-case/feeder-hs/ib/ap/activity) stay shadow/offline; official-aggregate teachers (scorecard/ipeds/cds/ed-boost/intl-pool/geo/major) align with the strategy.

## 7.5 Executed 2026-05-30 (this pass)

**Marginal backfill — ED/EA early-round rates.** Researched 36 selective schools missing the round data-driven path; **22 yielded primary-sourced (CDS C21) rates**, added to `seed-ed-ea-rates.ts` (27→49). 14 were structural misses (Princeton/Stanford/Caltech stopped disclosing REA; Wake Forest/NYU/Tufts/Colby blank their CDS C21; 7 publics publish no EA counts) — confirming §5. Effect: those schools' early-round predictions now use the real `roundRate/overall` ratio instead of the hardcoded ×2.5 / ×1.3.

**intl-rate backfill — blocked (structural).** Researched 11 selective schools missing `intlAcceptanceRate`; **0 yielded** — the international admit rate is structurally absent from CDS (only enrollment is reported) and only U.S. News's paid survey carries it. Aggregators (College Transitions) surface the _overall_ rate mislabeled as "international." Confirms §5; nothing written.

**intlAcceptanceRate data-quality incident (found + fixed).** Auditing the _existing_ 77% coverage (`scripts/audit-intl-rate-quality.ts`) found **56 contaminated values**: `intl >= overall` (statistically impossible at selective schools) or a fraction-vs-percent scale mismatch. Root cause: international ENROLLMENT % (`intlStudentPct`, separately 100%-covered) and overall-rate relabels leaked into the admit-rate column via an early metadata migration. Impact: the counselor `intlMultiplier` (`ratio = intl/overall`, clamped [0.3, 1.2]) turned a correct ~×0.5 international _penalty_ into a wrong **×1.2 boost** at elite schools (Yale 11%/4.8%, Caltech 9%/2.6%, Stanford 8%/3.8%, Dartmouth, Northwestern …) — telling international applicants their odds were _higher_ than domestic, on exactly their dream schools. Fix: `prisma/seed-intl-rate-correction.ts` nulls contaminated values (→ engine falls back to the correct selectivity heuristic), wired into the seed pipeline after the intl writers; `scripts/audit-intl-rate-quality.ts` is the regression gate (exit 1 on any `intl >= overall`). Local DB: **194 → 138 clean intl rates, gate PASS**. Apply to prod by running the correction standalone. This is the canonical example of why "data-grounded" requires _auditing_ the data, not just having it.

## 7.6 Modifier-constant correctness pass (2026-05-31)

After the data fixes, an evidence-backed audit of the counselor's hand-set _fallback_ multipliers (used when a school's own published rate is absent) found several that were selectivity-_blind_ where the real pattern scales with selectivity. These are correctness fixes against **published aggregate data** (like the intl fix), NOT outcome-tuning — each is grounded in a known cross-tier relationship, so it stays generalizable (`counselor-modifiers.ts`).

| Constant              | Was                     | Now                                                                                | Evidence                                                                                                                 |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **ED fallback**       | flat ×2.5               | selectivity-scaled: 3.0 (<8%) / 2.4 (<15%) / 1.8 (<30%) / 1.4 (<45%) / 1.15 (≥45%) | ED÷overall ranges 3.5× (Dartmouth) → 1.2× (Tulane); flat 2.5 over-boosted T30+ and overflowed past 100% above ~50% admit |
| **REA/SCEA fallback** | ×1.5                    | ×2.3                                                                               | Harvard 8.74%/3.59% = 2.43×, Yale ≈2.4× (REA is structurally elite-only)                                                 |
| **ED2 fallback**      | flat ×2.0               | 0.75× the scaled ED                                                                | proportional to the ED1 boost                                                                                            |
| **first-gen**         | flat ×1.4 (all schools) | selectivity-scaled: 1.4 (<15%) → 1.0 (≥45%)                                        | Arcidiacono SFFA ~1.5 OR is a Harvard-specific holistic artifact; ~neutral at non-holistic schools                       |
| **geo OOS clamp**     | ≤1.3                    | ≤1.8                                                                               | revenue-seeking UCs admit OOS _easier_ (UC 2024: Irvine 1.73×, Cal Poly 2.07×); 1.3 under-predicted real data            |

Deep-confirmation nuances (why this is _not_ a blanket "raise the constants"):

- **geo is the lowest-value change for this platform**: it only affects DOMESTIC applicants (intl users get NEUTRAL geo), and the 1.3 clamp was a _deliberate, tested_ PR #290 safety decision — so it was raised only modestly (→1.8, still bounded), with the data-integrity gate as the contamination guard.
- The ×0.5 OOS-penalty fallback was **left as-is**: it rarely fires (nearly all these publics have a real `oosAcceptanceRate` → the data path handles them) and is correct for the genuine OOS-harder flagships (UNC 0.43×, UT-Austin 0.38×).
- **EA (×1.3) left unchanged** — empirically defensible (MIT EA ≈ 1.16×).

Verification: **668/668 prediction tests pass** (incl. the behavioral matrix + the geo/ED regression tests, updated with documented rationale); data-integrity gate PASS. No served data changed — only the fallback logic for schools without a published per-round/residency rate.

## 8. Honest limits

- Marginal-only ⇒ the model cannot distinguish two applicants with identical marginals; that delta lives in unobtainable joint data. This is a _feature_ (no false precision), not a bug to engineer away.
- The hand-set multiplier constants remain literature-derived until aggregate self-calibration (§7.2) or a real verified-outcome volume (≥50) exists.
- "Aggregate + structural" is the optimum **for this data regime**; if a large unbiased individual-outcome set ever appears, the calculus shifts toward higher capacity.
