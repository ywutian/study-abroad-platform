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
- **modifiers** = 8 core + a profile-context composite, each a hand-authored multiplier with a cited source (`counselor-modifiers.ts`): gpaBand, testBand (geo-mean combined), round (ED/EA, selectivity-scaled fallback — §7.6), firstGen (selectivity-scaled — §7.6), geo (in/out-state), intl (selectivity-tiered), major, + soft profile-context capped to ×[0.90, 1.13]. Legacy/athlete/URM are **disabled** (evidence-required). Several modifiers have a "data-driven path" (use the school's _published_ ED/intl/OOS/major ratio) that fires only when that field is populated; otherwise a hardcoded fallback multiplier.

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

## 7.7 Intelligent data audit (2026-05-31)

The automated gates (§7.5) catch structural contamination classes but not "plausible-but-wrong" values. A **41-agent workflow** (2.95M tokens) verified ALL 241 US schools' prediction fields against each school's published CDS / IPEDS / College Scorecard. It found **76 discrepancies (28 high, 30 medium, 18 low)**:

- **Stale / wrong anchors (~25)** — worst: **University of Colorado Boulder stored 18.47% for an ~80% school** (mislabeled field) → every CU Boulder prediction was a catastrophic false "reach". Others: Texas Tech 84.6→72.6, Nevada-Reno 73.7→85.3, Mississippi State 62→77.6 (stale 7 yrs), Ohio State 60.6→50.8, Pratt 44.9→73.3, SAIC 60→77, Manhattan SoM 78.9→40.
- **Mislabeled `intl` fields (~16)** — an enrollment % / unrelated number stored as the intl admit rate (Rose-Hulman 68.9%, Texas A&M 56.5%, Clarkson 64.9%…). These **passed the `intl<overall` gate** (they sit below the high overall rate) yet are still wrong → nulled (engine uses its selectivity fallback).
- **Mislabeled OOS** (MIT's overall rate copied into the OOS slot; Cleveland State's in-state share in OOS…) and **fabricated rounds** (Amherst "EA 61%" — Amherst has no EA) → nulled. **Stale ED/EA** (Colgate, Case Western, RPI) → set.

Fix: `prisma/seed-audit-corrections-2026-05-31.ts` — **48 primary-sourced school field-sets**, wired into the seed pipeline after the rate seeds; integrity gate re-checked PASS. **This is why "data-grounded" requires intelligent verification, not just structural invariants** — the gate is necessary but not sufficient.

## 7.8 Aggregate self-calibration (2026-05-31)

The capstone of the data-grounded program (§3, §7.2): `scripts/audit-fallback-calibration.ts` validates the engine's hand-set **fallback** multipliers against the **empirical** ratio computed from the schools that DO publish the data (ed/overall, oos/overall, intl/overall) — pure aggregate calibration, **zero individual outcomes**.

Findings (on the post-audit clean data):

- **ED fallback ✅ all 5 tiers** — the §7.6 selectivity-scaled ED (3.0/2.4/1.8/1.4/1.15) sits inside the empirical IQR of every band (medians 2.53 / 2.30 / 1.68 / 1.28 / 1.38). **The published aggregate ED data confirms the scaling was right** — strong independent validation of the #312 change.
- **intl ≥40% ⚠️→✅ (fixed)** — the fallback was 0.95 but the empirical intl/overall median at high-accept schools is **0.70** (IQR 0.50-0.84, n=72): international applicants face a real penalty even at less-selective schools. Lowered to **0.80** (inside the IQR, conservative for publisher-sample bias). intl <10% (0.48 vs 0.52) was already ✅.
- **Left, documented:** the geo OOS fallback (×0.5 vs empirical ~1.0 — **confirms §7.6**; domestic-only + the data-path covers nearly all schools) and intl 10-20% / 20-40% (0.78 vs ~0.55; very wide IQRs + literature-grounded need-blind/need-aware splits → a candidate for refinement once more intl data accrues, not a confident fix today).

This **closes the loop**: the engine's fallbacks are now validated against — and where clearly off, calibrated to — the published aggregate data, not just admissions literature. It is the concrete realization of the §7.2 unlock (make the bridge data-driven without any individual outcomes).

## 7.9 Gold-set validation → per-state geo recalibration (2026-05-31)

Ran the user-authored **counselor gold set** (`pnpm gold:counselor`, 31 cases asserting `compute()` lands in an empirical band) against the post-audit engine: **27/31**, down from 31/31 on 2026-05-10. All 4 regressions were one segment — **strong CA in-state → UC flagships, all over-predicting** (UCB 0.45 vs gold [0.15, 0.32]).

**Root cause (a reference-frame data bug, same class as the intl/ED fixes):** the in-state modifier applied a flat **1.8×** (= UC in-state÷OOS, ~17%/9%) to the **overall-population** CDS-band anchor. But in-state÷OVERALL is only ~1.06–1.35 for UC — multiplying an overall anchor by the in-state-vs-OOS gap double-counts. The flat constant also contradicted the engine's own #312 evidence that UCs admit OOS _easier_.

**Fix — per-state in-state÷overall map** (`STATE_IN_STATE_OVER_OVERALL` in `counselor-modifiers.ts`), each value the system's PUBLISHED in-state÷overall (research deliverable, official CDS where available):

| state      | ratio | source / confidence                                                                                           |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| NC (UNC)   | 2.2   | official CDS 2023-24 (in-state 41.2% / overall 18.7%); OOS capped 18% — highest confidence                    |
| VA (UVA)   | 1.5   | Dean of Admission 2024/25 (~25%/16.5%)                                                                        |
| TX (UT)    | 1.5   | OOS÷overall 0.38; in-state bimodal (top-6% auto-admit) — conservative blend                                   |
| CA (UC)    | 1.2   | UCOP systemwide 1.06, Berkeley 1.35 — selective campuses tilt up                                              |
| FL (UF)    | 1.1   | CDS residency blank; DB oos≈overall → ~neutral                                                                |
| MI (UMich) | 1.0   | no official split (circulating 39% is impossible vs 17.9% overall); DB oos>overall → OOS easier → **neutral** |

OOS is untouched — already per-school data-driven (`oos/overall`). This captures contrasts a flat constant never could: UNC in-state 0.37 vs OOS 0.07; UMich in-state 0.17 ≈ OOS 0.20 (correctly no boost).

**Avoiding test-set overfitting (the user's core principle):** a naive flat 1.25 would have fixed the UC-heavy gold set but **under-predicted UNC/UT in-state** (uncovered by gold). So the fix is per-published-data, and the **gold set was expanded 31→36** with non-UC in-state cases — UNC (NC), UVA (VA), UT (TX), and a **UMich "no-boost" sentinel** (upper bound 0.25 catches any flat-boost regression) + a UNC in-state/OOS contrast pair. Result: **36/36 green**, 685 prediction unit tests green, analysis gold 50/50.

## 7.10 All-48-state in-state audit + selectivity damping (2026-05-31)

§7.9 fixed only the 6 states the gold set covered, leaving a flat **`DEFAULT_IN_STATE_MULTIPLIER = 1.2`** on the other 42 public-flagship states — the same flat-constant bug, just unaudited. An **8-agent workflow** web-verified each state flagship's published **in-state÷overall** (primary CDS section C / official admissions newsroom / state higher-ed dashboard; 48 flagships, ~758K tokens). The finding: **the flat 1.2 was wrong for 30 of 48 states.**

- **24 over-boosted** (1.2 → ~1.0): most flagships barely price residency (Ohio State in 57.3% ≈ OOS 59.0%; Minnesota, Maryland, Arizona, UMass… all publish in-state ≈ overall, several OOS-_favored_ like Binghamton 0.78 and Rutgers).
- **6 under-boosted** (1.2 was too low): **GA Tech 2.36** (residents 30% vs 9% overall 12.7% — steepest US gap), **TN 1.6** (two-thirds-in-state law), NC 2.2→**2.5**, CA 1.2→**1.35**, IL→1.35, WI→1.38.
- **2 data bugs:** "Connecticut College" (private LAC mislabeled `isPrivate=false`; the real CT flagship is UConn — fixed by migration `20260531190000`); NY flagship Binghamton admits residents _harder_ than OOS.

**The verified map** (`STATE_IN_STATE_OVER_OVERALL`, 13 states with a real effect) is now FLAGSHIP-level, and **`DEFAULT_IN_STATE_MULTIPLIER = 1.0`** (burden of proof: no published residency advantage → neutral). Two mechanisms resolve **intra-state heterogeneity** (a single state value can't fit GA Tech _and_ UGA _and_ Georgia State):

1. **`residencySelectivityWeight(overall)`** — residency advantage is strongest at the most selective publics and ~0 near open access (same principle as the #312 ED scaling). The flagship ratio applies in full ≤15% overall, tapers linearly to 0 by ≥55%. So GA Tech (14%) keeps 2.36×, UGA (38%) damps to ~1.58×, Georgia State (55%) → neutral.
2. **Per-school OOS guard** — if a school's _own_ published OOS ≈ its overall (≥0.95×), residency isn't priced there regardless of the state flagship → neutral. Catches Texas A&M, Texas Tech, VA Tech, William & Mary, Appalachian State from their own data.

Validated against published numbers: **UNC in-state 38.2%** (published 38%), **UC Berkeley 14.9%** (published CA-resident 14.9%) — exact. **CA removed from the strong-residency OOS-penalty set** (UCs admit OOS easier, #312); UC OOS now uses each campus's published `oos/overall` instead of a flat 0.5× guess.

**Gold set expanded 36→39** with intra-state heterogeneity sentinels: GA Tech (full boost) + UGA (same state, damped — a two-sided trap: flat-2.36 → 0.95 caught above, neutral → 0.53 caught below) + Ohio State (residency-neutral default). 5 UC gold cases + 1 Layer-3 calibration case (Penn State) updated to the data-grounded values (each rationale cites the published basis). Result: **gold 39/39, calibration spec back to its pre-change baseline, 141 counselor unit tests green.**

## 8. Honest limits

- Marginal-only ⇒ the model cannot distinguish two applicants with identical marginals; that delta lives in unobtainable joint data. This is a _feature_ (no false precision), not a bug to engineer away.
- The hand-set multiplier constants remain literature-derived until aggregate self-calibration (§7.2) or a real verified-outcome volume (≥50) exists.
- "Aggregate + structural" is the optimum **for this data regime**; if a large unbiased individual-outcome set ever appears, the calculus shifts toward higher capacity.
