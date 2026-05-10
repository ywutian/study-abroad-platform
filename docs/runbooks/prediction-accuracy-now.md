# How to Improve Prediction Accuracy Now

Last updated: 2026-05-09

## The honest constraint

The prediction system today is **counselor-cold-start-v1.7-launch** — a deterministic heuristic with explicit cold-start rules. It is structurally complete but has a known accuracy ceiling because:

1. **No verified outcomes** — `verifiedCount = 0`, so calibration cannot run
2. **CDS data is at structural ceiling** — every public field has been exhaustively searched (April 2026 LLM extract + May 2026 Tavily recheck both confirm OFFICIAL_BLANK_SECTION for the schools that don't publish)
3. **Counselor weights are hand-tuned** — they encode prior knowledge, not data fitting

This means **"more accurate" has different meanings depending on time horizon**.

| Horizon     | What "accurate" can mean                    | Path                                   |
| ----------- | ------------------------------------------- | -------------------------------------- |
| This week   | More transparent + admin fixes outliers     | Sections 1–3 below                     |
| 3 months    | Profile completion drives per-user accuracy | Section 4                              |
| 6–12 months | Verified outcomes unlock real calibration   | See `outcome-verification-pipeline.md` |

This document covers the **this-week / 3-month** horizon. Anything claiming faster is bypassing data discipline.

---

## 1. Soft-label sanity check using existing 99 AdmissionCases

**What this does**: even though only 8 of the 99 AdmissionCases are verified, all 99 are real admit/reject outcomes. They give a directional signal. We can:

1. Run Counselor on each (profile, school, applicationRound) pair
2. Compare predicted probability to actual outcome
3. Flag schools where Counselor is consistently wrong

This is not calibration — it's **outlier detection**. A school where 5/5 admitted users got predicted < 10% probability is mis-anchored, regardless of verification status.

### Implementation

A new script `apps/api/scripts/audit-counselor-vs-cases.ts` would:

- Pull all `AdmissionCase` rows (filter by `reviewStatus IN ('AUTO_APPROVED', 'VERIFIED')` for higher signal)
- For each, build a synthetic `ProfileInput` from case fields, run `CounselorEngineService.compute`
- Group by (school, applicationRound), compute:
  - For ADMITTED cases: `meanPredicted` should ideally be ≥ 30%
  - For REJECTED cases: `meanPredicted` should ideally be ≤ 50%
- Output schools where the gap exceeds 30pp

### Expected yield

99 cases concentrated in Top 30 schools. Realistically this catches maybe 3–6 schools where Counselor's anchor or modifiers are obviously off — those become candidate `SchoolCalibration` overrides.

### Caveats

- Sample bias: who self-submits a case is non-random
- 99 is small even before cohort-stratifying
- This finds **outliers**, not systematic bias. Only verified outcomes can do that.

---

## 2. SchoolCalibration manual overrides

**What this does**: when section 1 finds a mis-anchored school, an admin sets a multiplier (e.g. `1.5x` to lift Counselor's output by 50%) until the next data refresh.

### Existing infrastructure (verified to be in place)

- DB model: `SchoolCalibration` (1:1 with `School`)
- Already has `multiplier` (Decimal) and `reason` (String) fields
- `prediction-calibration.service.ts` already reads it (verified earlier in the session — gets multiplied at the end of compute)

### Workflow

```
Section 1 audit script
  → finds outlier school (e.g. Brown ED: 5 admits all predicted < 10%)
  → admin reviews case data + Counselor breakdown
  → admin sets SchoolCalibration { multiplier: 1.6, reason: "5/5 ED admits underpredicted; investigate Counselor's edAcceptanceRate fallback" }
  → predictions for this school × ED round lift by 60%
  → noted in calibration audit log
```

### What this is NOT

- This is **not** calibration in the statistical sense. It's a hand-corrected sticker over a known wrong heuristic.
- These overrides should be **temporary** — replaced when Section 1 data accumulates, or when verified outcomes enable real calibration.
- Every override should have a `reason` traceable to specific case evidence.

### Required to-do

- [ ] Build `audit-counselor-vs-cases.ts` (Section 1)
- [ ] Build admin UI for `SchoolCalibration` CRUD (or restore the one removed during the worktree purge — it existed previously)
- [ ] Add an "evidence" field to `SchoolCalibration.reason` linking to the specific cases that drove the override

---

## 3. Honest UI — show ranges, not point estimates

**This does not change accuracy.** It changes the gap between what the system claims and what users believe.

### The problem

Today the prediction returns `probability: 0.17` and the UI renders "17%". A user reads that as "I have a 1-in-6 chance" — a precise belief.

The system's actual confidence is closer to "in the 10–30% range, depending on factors we can't measure". Showing 17% is overclaiming precision.

### The fix

For Tier 2/3 predictions, render a band based on:

- Counselor `tier` (1/2/3)
- Counselor `factors[]` array (number of high-impact missing modifiers)
- Profile completeness score

Display logic:

| Confidence                          | Display                            |
| ----------------------------------- | ---------------------------------- |
| Tier 1 anchor + complete profile    | `17%` (point)                      |
| Tier 1 anchor + incomplete profile  | `12% – 22%`                        |
| Tier 2 anchor (Scorecard estimate)  | `10% – 30%`                        |
| Tier 3 anchor (overall AR fallback) | `5% – 35%`                         |
| Tier 4                              | `Insufficient data` (already done) |

### Why this matters

- Reduces overconfidence in the user
- Reduces blow-back when prediction is "wrong" (because the band always covered the actual outcome)
- Makes the system's epistemic state visible to the user
- Aligns with current `predictionMethod: 'counselor'` and `tier` data — no new model work needed

### Required to-do

- [ ] Define band-width function: `getBandWidth(tier, factorsConfidence, profileCompleteness)` → `{ lo, hi }` returning relative offsets from point estimate
- [ ] Update `PredictionResultCard` web component to render `[lo%, hi%]` when bandWidth > 5pp
- [ ] Update mobile equivalent
- [ ] Add a tooltip/popover explaining "why a range and not a single number"
- [ ] Update i18n keys (zh/en)

---

## 4. Profile completion drives per-user accuracy

This is the **biggest near-term lever**. Completeness data:

| Field               | Today        | Effect on prediction if missing                                           |
| ------------------- | ------------ | ------------------------------------------------------------------------- |
| `gpa`               | 41/169 (24%) | 70% of predictions skip the GPA modifier — **largest single signal lost** |
| `applicationRound`  | 33/169 (20%) | ED/EA bumps not applied; school anchor used as RD                         |
| `nationality`       | 55/169 (33%) | International student detection fails → wrong AR fallback                 |
| Activity tier links | 6/69 (9%)    | Counselor activity-quality modifier degrades to count-based               |
| Award tier links    | 13/63 (21%)  | Same for awards                                                           |
| `SemesterGpa` rows  | 0            | Trajectory bonus never fires                                              |

### Why this matters more than tweaking the model

A user with GPA filled gets predictions that use 5 active modifiers. A user without GPA gets predictions that use 2-3 modifiers and falls back to school AR. The accuracy gap between these two users **dwarfs** any tweak we could make to weights.

### Existing infrastructure (some restored, some lost in worktree purge)

- `PredictionGapsBanner` web component — exists, surfaces missing fields with deep-links (verified in current code)
- `ActivityFuzzyMatcher` and `CompetitionFuzzyMatcher` — were previously built but **lost when worktree was deleted**; need to rebuild if we want auto-bind

### Required to-do

- [ ] Audit which gap-filling helpers survived the worktree purge (e.g. is `PredictionGapsBanner` still wired in `prediction/page.tsx`?)
- [ ] Rebuild Activity → ActivityTemplate fuzzy matcher (was at 0% link rate; even raising to 30% is a big win)
- [ ] Rebuild Award → Competition fuzzy matcher (same)
- [ ] Add a `SemesterGpa` input flow that's actually visible (UI exists but discoverability is poor)
- [ ] Make `applicationRound` mandatory at the school-level, not profile-level (per-school selection)

---

## 5. What CANNOT improve accuracy now

Listed for honesty:

- **Tweaking Counselor weights** — without verified outcomes there's no signal to tune against. Tweaking based on intuition produces apparent improvement on synthetic eval (which is itself self-confirming) and no real gain.
- **Adding more CDS data fields** — already at structural ceiling (see audit dated 2026-05-09).
- **Switching prediction model** (logit vs multiplicative vs piecewise) — without verified outcomes, model selection is methodologically unjustified.
- **External benchmarks** (CollegeVine API, etc.) — paid + ToS issues, also no public access.
- **More schools' admit-by-band data** — UC system has it. Other 230 don't publish it. No path to expand.
- **More LLM-based "intelligence"** — LLMs don't know admit decisions; they hallucinate confidence.

---

## Recommended sequence (this week → next month)

### Week 1

1. Build `audit-counselor-vs-cases.ts` (Section 1) — measures where Counselor is wrong against the 99 cases
2. Re-build `SchoolCalibration` admin UI (it existed; was deleted with worktree)
3. Apply 3-5 manual overrides for the worst outliers found in step 1

**Effect**: removes the most egregious mispredictions for the most common schools. ~80% of users will see the change.

### Week 2-3

4. Implement honest-range UI (Section 3)
5. Audit which `PredictionGapsBanner` integrations survived worktree purge

**Effect**: reduces overconfidence in user-facing numbers; aligns claimed precision with actual capability.

### Week 4+

6. Rebuild fuzzy matchers (Section 4) for Activity / Competition links
7. Push profile completion via `PredictionGapsBanner` deep-links
8. Begin building `outcome-verification-pipeline.md` (Plan A) — long horizon

---

## Honest summary

**Today the system is "approximately correct on average, very imprecise per case"**. The above improvements move it to **"approximately correct on average, less overconfident per case, and admin-correctable for known outliers"**. That's it.

**Real accuracy gain happens when verified outcomes accumulate** (see `outcome-verification-pipeline.md`). Until then, every "make it more accurate now" claim is bounded by what hand-tuning can do without data.

The most useful frame for users right now is:

- "This is our best heuristic given the data we have"
- "Here's why we think so"
- "Here's what would change the answer"
- "We're collecting outcomes to calibrate this for real"

That frame is honest, fits the architecture, and gives users actionable feedback. Everything in this doc serves that frame.
