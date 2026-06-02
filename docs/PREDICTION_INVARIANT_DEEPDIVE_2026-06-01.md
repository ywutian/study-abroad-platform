# Prediction Engine — Invariant Deep-Dive & Closed-Loop Disposition (2026-06-01)

A 5-agent parallel deep-dive (magnitude realism, data coherence, international
handling, input-robustness fuzz, domain/coefficient audit) probed the served
**Counselor engine** beyond the structural invariant battery. Every finding was
**adversarially re-verified** by re-running the engine before being recorded here
(several agent claims were over-stated and are corrected below).

This document is the **closed loop**: each finding has a disposition — `FIXED` (this
PR), `DATA-AUDIT` (needs a research-backed data correction), `PRODUCT-DECISION`
(needs an explicit product call), or `BY-DESIGN` (verified-correct, no action).

## Method note — why not "fix everything in code"

The deep analysis showed that **most findings are NOT unilateral code bugs**: they are
either deliberate design choices, real-but-surprising data, data corrections that need
ground-truth research (which I cannot fabricate), or product decisions that change
user-facing behavior. Forcing code "fixes" for those would contradict prior deliberate
decisions or the standing **no-coefficient-tuning** rule. So the code PR is deliberately
narrow (the two clear structural bugs); everything else is dispositioned with an owner.

---

## FIXED (this PR)

### F1 — GPA recast as "fake SAT" double-counts the testing axis `[HIGH]`

**Verified:** Rice (no CDS-C9 `gpaDistribution`, sat25 1510) scored a **3.90 GPA → gpaBand ×0.50**
("below 25th percentile"), because the heuristic maps GPA→equivalent-SAT and bands it against the
school's **SAT** 25/75 — the same axis `testBand` already measures from the _real_ SAT. A 3.90 GPA
should never be a "below 25th" penalty. Vanderbilt (same SAT bands but _has_ gpaDistribution) gave
the same 3.90 → ×1.05, a 2× swing purely from data coverage.

**Fix:** in `gpaBandMultiplier`'s heuristic path, when a real SAT/ACT is present, dampen the
GPA-proxy toward neutral via the geometric mean with 1.0 (`sqrt`) — the same correlation-correction
the engine applies to the gpa×test combine. Fires **only** on the heuristic path (CDS-C9 path is a
distinct GPA axis, exempt) and **only** when a real test exists (test-optional applicants keep the
full GPA-proxy). `sqrt` is monotonic → no inversion. Rice 3.90/1500: gpaBand ×0.50 → ×0.707, prob
4.7% → 5.6%; the false ×0.5-on-a-3.9 artifact is gone.

### F2 — No input-domain clamp on SAT/ACT/GPA `[LOW robustness]`

**Verified:** SAT 9999 / ACT 50 / GPA 5.0-on-a-4.0-scale were treated as top-band (rewarded like a
perfect legit score). Never breached 0.98 (the `anchor×2.5` cap held; 0 crashes in 1530 fuzz calls),
but it's a garbage-in gap. **Fix:** clamp SAT→[400,1600], ACT→[1,36], normalized gpa4→[0,4.0] at the
band-mapping entry points. (Note: the two duplicated `gpaToBands` copies in
`anchor-resolver`/`counselor-engine` still need the same clamp — folded into the dedup-refactor chip.)

---

## DATA-AUDIT (needs a research-backed correction; I have no prod DB access)

### D1 — `oosAcceptanceRate` >> overall at ~43 publics `[was flagged HIGH; downgraded]`

**Corrected:** an agent called `oos > overall` "structurally impossible." It is **not** — `overall`
is a weighted average of in-state and oos, so `oos > overall` simply means in-state < overall, which
is **real** for revenue-seeking publics (UC Irvine OOS÷overall 1.73, Cal Poly 2.07 — official, and
the geo modifier's 1.8 cap was _deliberately_ set for exactly these). San Diego State's
oos 87% / overall 36% / in-state 31% is even **mathematically self-consistent** if ~90% of applicants
are in-state (plausible for a CSU). So this is **not a code bug** and the 1.8 clamp must not be
lowered (it would break the legitimate UC OOS path).
**Action:** research the true OOS rate for the extreme cases (SDSU 87%, Binghamton 79%, Eastern
Michigan 100%) and correct the data if wrong. Until then the 1.8 clamp bounds the impact. Owner: data
pass (closure-update skill) / user.

### D2 — Decimal-scale anomalies & duplicate rows `[MED]`

- `University of Georgia` `inStateAcceptanceRate=0.47` and `Pomona` `oosAcceptanceRate=0.06` — look
  like 100× decimal slips, **but** the engine's `normalizeRate` (`raw>1 ? raw/100 : raw`) treats 0.47
  as a 47% fraction, so the served prediction is correct _by luck of the heuristic_. Latent risk: the
  residency columns mix percent (47) and fraction (0.47) conventions in the same column.
- Duplicate row confirmed: `Binghamton University` + `SUNY Binghamton University` (Minnesota dup
  **not** confirmed — only one row exists; agent over-claimed).
- 15 private schools carry a non-null `oosAcceptanceRate` (meaningless for privates; inert because
  geo returns neutral for privates, so no prediction impact — data cleanliness only).
  **Action:** one-time data hygiene pass — normalize the residency-column convention, de-dup Binghamton,
  null residency rates on private schools. Needs careful FK-safe surgery + deploy. Owner: data pass / user.

---

## PRODUCT-DECISION (changes user-facing behavior; needs an explicit call)

### P1 — Exceptional ECs/awards are flattened to ≤ ×1.13 `[HIGH realism]`

**Verified (code comment confirms):** `profileContextMultiplier` caps the EC/award composite at
`[0.90, 1.13]`, and the award comment literally says _"true admit lift is 1.3-1.6× for these winners.
Compromise at ×1.13"_. So an ISEF/IMO/Regeneron-level spike — the single strongest non-hook
differentiator in holistic admissions, and often _the_ separator for the high-stats CN applicant pool
— moves a Harvard prediction only ~3.6%→~4.1%. Deliberate (anti-noise regression gate), but it means
the engine **systematically under-represents the strongest holistic applicants** at their reach schools.
**Decision needed:** add a _verified-spike lane_ (evidence-gated, allowed a larger ceiling, parallel to
how legacy/athlete are evidence-gated) vs. accept the conservative flat cap. NOT a coefficient tweak —
an architecture decision.

### P2 — Major competitiveness has no fallback prior `[MED realism]`

`majorMultiplier` is data-driven (`programAdmitRate/schoolAdmitRate`) but `SchoolProgram` data exists
for only ~25 schools. Everywhere else, a CS/Nursing/direct-admit-Business applicant (CS = the modal CN
target) is treated as no harder than the school overall. **Decision needed:** add a selectivity-scaled
prior for known-hard buckets when per-school data is absent (the same "literature-grounded fallback"
pattern ED/intl/geo already use), vs. leave neutral. Owner: product + a difficulty-prior source.

### P3 — Recruited-athlete / legacy / URM disabled (×1.0) `[BY-DESIGN, UI gap]`

The disable is **correct** (unverified hooks must not move served probability; URM is post-SFFA legally
safe). The only gap: a genuinely recruited athlete gets a far-too-low number with no signal. The engine
already records this in the `ignoredByPolicy` audit array. **Action (UI, not engine):** confirm the
user-facing layer surfaces "this prediction does not yet account for your recruitment/legacy/…".

---

## INTERNATIONAL (mixed: one BY-DESIGN-sound, real gaps need a scoped project)

### I1 — `intlMultiplier` / `needBlindInternational` / geo-neutralization `[BY-DESIGN, sound]`

**Verified sound** — school-published `intlRate÷overall` clamped [0.3,1.2] (MIT 0.43, Yale 0.53…), a
selectivity-scaled need-aware fallback, and correct geo-neutralization for intl. An agent's "3× channel
divergence BLOCK" was **over-stated** — re-running showed 3.3% vs 2.6% (≈1.3×), and ~3% is realistic for
an intl applicant to Berkeley. No action on the multiplier.

### I2 — Non-US GPA scale semantics `[MED → scoped project]`

**Verified real:** (a) gaokao students **cannot store a 750-scale GPA** (`profile.dto` `@IsIn([4,5,6,45,100])`
excludes 750) → forced into the `testScores` channel → **dropped at test-blind UC schools**; (b) an
inverted-scale **German Abitur** (1.2 = top) is mis-banded as failing (→2.4%) because `gpaToBands` assumes
higher=better and there is no education-system tag to detect inversion; (c) gaokao/IB/percentage GPAs are
linearly rescaled (crude but not catastrophic); (d) `education.dto` lacks the `@IsIn` guard that
`profile.dto` has.
**Decision needed (scoped project, not a quick fix):** route non-US credentials through the existing
`gaokao/IB/A-level` concordances regardless of input channel; add an `educationSystem`/orientation tag so
inverted scales are detected; align the DTO validators. Touches DTOs + transformer + engine + needs intl
test fixtures. Owner: a dedicated intl-prediction PR.

---

## Disposition summary

| ID  | Finding                                     | Severity     | Disposition                            |
| --- | ------------------------------------------- | ------------ | -------------------------------------- |
| F1  | GPA-as-fake-SAT double-count                | HIGH         | **FIXED** (this PR)                    |
| F2  | No SAT/ACT/GPA input clamp                  | LOW          | **FIXED** (this PR)                    |
| D1  | oos >> overall at publics                   | (downgraded) | DATA-AUDIT (1.8 clamp bounds impact)   |
| D2  | decimal slips + dup row + private residency | MED          | DATA-AUDIT                             |
| P1  | EC/award spikes capped at ×1.13             | HIGH         | PRODUCT-DECISION (verified-spike lane) |
| P2  | major competitiveness no fallback prior     | MED          | PRODUCT-DECISION                       |
| P3  | recruited-athlete/legacy/URM disabled       | —            | BY-DESIGN (UI flag only)               |
| I1  | intlMultiplier                              | —            | BY-DESIGN (sound; agent over-stated)   |
| I2  | non-US GPA scale semantics                  | MED          | scoped intl PR                         |

**Engine invariant status after this PR:** GPA-monotonic 0 violations, joint-dominance 0, gold 39/39,
calibration gate unchanged, 154 unit tests, full invariant battery clean.
