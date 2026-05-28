# Prediction data ceiling — 2026-05-27

> **TL;DR for future sessions / agents**: do not try to improve the prediction
> engine by tuning per-axis multipliers (gpaBand / testBand / geoMultiplier /
> roundMultiplier) from outcome data or by scraping more "CDS-like" public
> sources. Both paths were exhausted on 2026-05-26/27 with concrete negative
> findings. Until federal ACTS lands (2027+) or we acquire a commercial data
> source, the engine's hand-tuned multipliers ARE the ceiling for non-UC
> schools.
>
> **2026-05-28 update — case-gathering attempt**: dispatched 4 parallel agents
> across Chinese forums (一亩三分地 / 知乎 / 小红书), English forums (Reddit
> r/A2C / College Confidential), and consultancy / boarding / journalist
> sources. Net yield: **84 structured cases + 8 aggregate-rate cells**, far
> below the "10K-100K Chinese-source" hope. The volume that would move the
> needle lives behind login walls (知乎 403, 1point3acres score-walls),
> JS-SPA databases (Offer多多), and crawler blocks (Reddit) that WebSearch /
> WebFetch cannot penetrate. Reachable only via authenticated headless-browser
> automation, which raises ToS questions. The pipeline to ingest such data is
> built (`merge-external-admit-cases.ts`) and ready when/if the volume arrives.

## Why this doc exists

Across two sessions (PR #299 / #300 / #302 / #304 / #305) we built four
diagnostic instruments — Brier / log-loss empirical scorer, 40-test
monotonicity suite, descriptive per-cell lift analysis with bootstrap CIs,
ridge logistic regression on residual log-odds — and used them to argue
that engine's hand-tuned multipliers are mis-calibrated against real
AdmissionCase outcomes. We then attempted to LEARN better multipliers from
the data. That attempt was structurally limited by **selection bias**
(self-reported pool skews prestige-admit) and **sample size** (n=1076 over
20 features). Ridge shrunk half the coefficients to 0.

Looking for a structurally cleaner path, we attempted to expand the
`SchoolCdsAdmitBand` Tier 1 anchor table (PR #283, "biggest precision win")
from 9 UC schools to ~30 public flagships, then to state-level transparency
reports, then to academic / journalistic data sources. **Every path yielded
0 new usable rows.**

This doc captures _why_ and what the actually-actionable forward paths are,
so the next session / agent doesn't burn another two days repeating the same
investigation.

## What we investigated and what we found

### Path 1: outcome-data ML on `AdmissionCase` pool

| Pipeline step        | What we built                                     | What it told us                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empirical scorer     | PR #299 `calibration-empirical-scorer.ts`         | n=990, Brier 0.302, log-loss 1.09, AUC 0.66. Engine miscalibrated at 0.9-1.0 bucket (-24.8pp over-prediction) — only direction NOT explained by sample bias.                                                 |
| Per-cell descriptive | PR #302 / #304 `learn-prediction-coefficients.ts` | After methodology fixes (geo bucket, log-odds saturation, bootstrap-CI bracketing): high-confidence cell `above_75 × above_75 × private × RD` (n=34): observed 72.9% vs engine 13.3% (Δ +59.6pp).            |
| Ridge regression     | PR #305 `fit-residual-regression.ts`              | IRLS converges, CV λ=1, train log-loss 0.409. Learned `sat.above_75 = 5.06×` vs hand-tuned 1.30×; `round.ED = 0.59×` vs hand-tuned 2.50× (engine double-counts when anchor already uses `edAcceptanceRate`). |

**Why this isn't ground truth**: `AdmissionCase` is self-reported. Admits at
prestige schools self-report at ~10× the rate rejections do. Per-tier
propensity correction is a blunt instrument (popP/sampP capped [0.05, 5]).
Even at n=1076 across 20 features, ridge shrunk hook coefficients
(legacy / athlete / first-gen) to 0 — Arcidiacono OR=8.5 for legacy came
from 100K+ Harvard lawsuit data, which our pool cannot replicate.

The learned coefficients ARE useful as diagnostic signals (engine over- or
under-credits a feature) but they are NOT usable as direct replacement
values for the served path.

### Path 2: expand `SchoolCdsAdmitBand` via per-school CDS PDFs

Prod has 9 schools with CDS bands populated (all UC system, sourced from
the UC Office of the President Information Center). Dispatched 3 parallel
research agents to investigate ~30 more public flagships (T15-T100):

- **Group 1** (T15-T30, e.g. UMich, UNC, UVA, GA Tech, UF, UT Austin, W&M, UW Madison, UIUC, UW Seattle): **0 / 10 yielded data**
- **Group 2** (T30-T60, e.g. UMD, Penn State, Ohio State, Purdue, Michigan State, VT, Rutgers, NCSU, UMass Amherst, IU Bloomington): **0 / 10 yielded data**
- **Group 3** (T60-T100, e.g. UDel, UConn, Pitt, Auburn, Clemson, USC SC, UTK, U Iowa, Iowa State, Texas A&M): **0 / 10 yielded data**

**Why every school failed**: the Common Data Set standard only requires
section C11 — _enrolled_ student GPA distribution. It does NOT require the
applicant-side cross-tab (admit rate by GPA band). Schools that publish
CDS publish C11 (enrolled distribution) and call it a day. Third-party blogs
that cite "90.5% of UVA admits had 4.0 GPA" are mislabeling CDS C11 — that
is the _enrolled_ composition, not the per-band admit rate.

Auburn / NCSU / UTK get _close_ (per-(GPA × ACT) enrolled distribution) but
still publish enrolled-only, not admit-rate-by-band.

### Path 3: state-level transparency reports

Dispatched a 4th agent against 22 state higher-ed agencies looking for
UC-style state-mandated transparency dashboards: SUNY, THECB (TX),
UW System, Florida BOG, UNC System, CSU, ABOR (AZ), USG (GA), ICHE (IN),
MA DHE, Oregon HECC, Washington WSAC, Ohio ODHE, Illinois IBHE, SCHEV (VA),
TN THEC, USM IRIS (MD), Iowa Regents, Minnesota OHE, Connecticut CSCU,
Hawaii UH, Colorado CDHE, Missouri DHE.

**Yield: 0 / 22.**

Most state systems publish:

- **policy thresholds** (auto-admit GPA, freshman-index formula like UGA's
  `500 × HS_GPA + 1.06 × SAT - 74`, Iowa RAI, Ohio OGA, Connecticut CAAP,
  Illinois One-Click) — these are _prescriptive_, not _descriptive_. They
  tell you "GPA ≥ X gets you in" but not the admit rate at X−0.1, X−0.5.
- **percentile aggregates** (mid-50% GPA of admits) — the inverse of what we
  need. Tells you GPA distribution conditional on admission, not admit rate
  conditional on GPA.

Auto-admit policies and freshman-index thresholds cannot be encoded as
`SchoolCdsAdmitBand` rows without misleading semantics — they impose 100%
admit at the threshold but tell us nothing about admit rate below it.

### Path 4: academic / journalist data sources

Investigated Selingo book, Cornell GBDT paper, CAPS, Arcidiacono SFFA papers,
NACAC State of College Admission, Common App reports, NCES IPEDS, Education
Trust / Hechinger, FiveThirtyEight, Niche / CollegeVine / RoboCollege,
Opportunity Insights (Chetty / Friedman / Deming).

**Yield: 1 school (Harvard) with major caveats.**

Harvard's SFFA lawsuit released court documents with admit rates by
"Academic Index decile" (a composite of SAT + SAT II + HS GPA) × race ×
hook status, pooled 2014-2019. Useful for:

- **Hook coefficients** (ALDC admit 43.6% vs 5.5% baseline → log-odds shift
  +2.5, validates Arcidiacono OR=8.5 we already use)
- **Race interaction** at high SAT (Black-vs-Asian admit ratio 4.65× at SAT
  math ≥ 740)

NOT useful for per-school admit rate at (GPA × SAT) cells because:

- Academic Index decile is composite, not pure GPA or SAT band
- Harvard only (single school)
- Pooled 2014-2019, post-SFFA dynamics shifted

Selingo / Cornell / CAPS / NCES / NACAC / Common App / Niche / CollegeVine
all confirmed either AGGREGATE_ONLY, PROPRIETARY, or NOT_FOUND.

## Why UC is structurally unique

The UC Information Center publishes fall applicants × admits × enrolled
**cross-tabbed by HS GPA range** per campus. Three things together produce
this — no other US system has all three:

1. **California state transparency law** requires UC publish applicant-side
   data, not just admits-side (UC Regents accountability mandate).
2. **Centralized institutional research** at UC Office of the President
   (UCOP IRAP) operating as a single source across all campuses. State
   systems with decentralized IR cannot produce a comparable cross-tab.
3. **Self-normalized GPA**: UC computes its own weighted-capped HS GPA from
   application data (10th-11th grade A-G coursework, up to 8 honors
   semesters). No other state agency standardizes HS GPA across applications
   — they delegate to the applicant or school, making cross-tabulation
   meaningless across schools.

Other states either delegate GPA computation (so cross-tabs would be
apples-to-oranges) or are blocked by FERPA-style aggregation rules at the
system level.

## What this means operationally

### Don't do (will not help, despite seeming intuitive)

- ❌ **Don't ML-learn per-axis multipliers** from `AdmissionCase` outcomes
  to replace hand-tuned values. Selection bias and small sample dominate.
  Diagnostic use OK; serving use will be worse than current hand-tuned.
- ❌ **Don't expand `SchoolCdsAdmitBand`** by scraping more CDS PDFs. The
  data structurally does not exist outside UC. We checked T15-T100 publics.
- ❌ **Don't write a "transfer-from-UC" model** that imputes non-UC bands
  from UC ground truth + each school's CDS C11. UC is structurally
  different (test-blind, public, CA-centric); transfer assumption is too
  risky for serving path. Diagnostic toy OK but don't ship.
- ❌ **Don't scrape r/ApplyingToCollege / CollegeConfidential**. Same
  selection bias as our pool, just larger volume — bias dominates n.
- ❌ **Don't trust third-party blogs** that cite "X% of admits had Y GPA"
  as if those were admit rates. They're typically mislabeled CDS C11
  (enrolled distribution).

### Do (actually-actionable)

- ✅ **Keep the diagnostic instruments** — Brier scorer (PR #299),
  monotonicity suite (PR #299), per-cell lift (PR #302/304), residual
  regression (PR #305). All useful for surfacing engine drift after data
  changes; just don't use their outputs as direct replacement values.
- ✅ **Keep the closure-loop infrastructure** (PR #300) — every closure
  correction now propagates from prod to CI on next export. This is the
  structural fix that has been keeping engine well-aligned to prod data.
- ✅ **For UC schools (9 covered)**: engine uses Tier 1 CDS-band lookup
  directly. This path is correct and complete.
- ✅ **For non-UC schools**: engine uses anchor + hand-tuned multiplier
  composition. This is the ceiling for now. Treat it as "best-effort
  heuristic; expect drift at reach schools".
- ✅ **Product framing**: prediction's value for reach schools is tier
  assignment (reach / match / safety) and qualitative explanation, not
  exact percentage. The 5% vs 13% vs 25% question doesn't change the
  user's decision (still reach, still write essays, still configure
  match/safety).

### Watch for

- 🔭 **Federal ACTS proposal** — Department of Education's "Admissions and
  Consumer Transparency Supplement" would mandate UC-equivalent data
  (applied / admitted / enrolled cross-tabbed by HS-GPA quintile and
  test-score quintile) for all selective 4-year institutions, with
  retrospective coverage 2020-21 through 2025-26. As of 2026-05-27:
  proposed, not yet collecting. If implemented (uncertain — possibly 2027+),
  this single regulatory change unlocks the entire path that 4 agents over
  60 schools could not unlock. Worth re-investigating annually.
- 💰 **Commercial data acquisition** — Naviance / Scoir / Maia / CollegeVine /
  Crimson have proprietary aggregated data. Workload to acquire +
  integrate is significant; ongoing cost; potential copyright risk on
  scraped data. Not recommended until the ACTS path is definitively dead.
- 🎓 **University data sharing agreements** — formal FERPA agreements with
  individual schools would unlock their internal data. Not scalable but
  could yield 1-2 case studies for high-value partner schools.

## Forward links

- Pipeline tools to keep maintaining:
  - `apps/api/scripts/calibration-empirical-scorer.ts` (Brier / log-loss)
  - `apps/api/scripts/test-engine-monotonicity.ts` (direction tests)
  - `apps/api/scripts/learn-prediction-coefficients.ts` (per-cell lift, v2)
  - `apps/api/scripts/fit-residual-regression.ts` (ridge logistic, step 2)
- Memory entries documenting this finding:
  - `~/.claude/projects/-Users-yitianwu-Documents-study-abroad-platform/memory/feedback_do_not_tune_coefficients.md`
  - Indexed from `MEMORY.md`
- PRs covering this investigation:
  - #299 — empirical scorer, monotonicity, regression fixtures
  - #300 — closure-loop fix
  - #302 — descriptive lift v1
  - #304 — methodology fixes + bootstrap CI + invariants
  - #305 — ridge logistic regression
- Prior research that should have prevented this re-investigation but
  didn't track to a single doc:
  - PR #283 — Wave 3 SchoolCdsAdmitBand (Tier 1 anchor — biggest precision win)
  - `docs/adr/0016-prediction-ml-primary-architecture.md` (ML-Primary deferred)
  - ADR 0016 marked SUPERSEDED 2026-05-08 because "verified outcome sample
    size is insufficient". This was always going to be the limit.
