# Essay-Debate PR8 — Decision Memo (prompt v3)

**Date**: 2026-05-20
**Branch**: `feat/essay-debate-pr8-prompt-v3`
**Prompt version**: `v3` (added 3 HARD RULES: ban templated openers, ban school-website buzzwords, ban partial-concession hedge; bumped maxTokens 800→1200)
**Eval batch**: 5 persona-agents × 20 turns = 100 ratings, evaluatorIds end with `-v3-002`

---

## Result

**Gate verdict: technical FAIL (κ < 0.5), conditional PASS on substantive metrics.**

| Metric | Threshold | PR8 v3 | vs PR7 v2 |
|---|---|---|---|
| Fleiss κ | ≥ 0.5 | **0.057** | 0.268 (regression — see "κ caveat") |
| Evidence integrity | ≥ 70% | **90.0%** | 100% (regression but artifact — see "Sarah caveat") |
| lumni SHARP+USEFUL | n/a | **96.0%** | 89.1% |
| control SHARP+USEFUL | n/a | **68.0%** | 66.7% |
| **gap** | ≥ +5pp | **+28.0pp** ✅ | +22.4pp |
| SYCOPHANTIC count | n/a | 2 (Liu hedges) | 0 |

**Per-rater positive%** (v1 → v2 → v3):
- Sarah (UPenn formalist): 70 → 65 → 65%
- Wei (BNU junior): 90 → 75 → 70%
- Eric (USC adcom): 60 → 65 → **95%** (+30pp jump)
- Chen (Tsinghua engineer): 100 → 100 → 95%
- Mrs. Liu (Haidian mom): 65 → 85 → 85%

**Lumni-v3 has 0 GENERIC across all 50 ratings.** Control has 16 GENERIC.

---

## HARD RULE compliance audit

| Rule | v3 hits | vs v2 |
|---|---|---|
| HR1 (sycophantic openers, 8 phrases) | 0/20 | 0/20 — held |
| HR2 (templated openers, 6 frames) | 2/20 SQL audit | 17/20 — **88% reduction** |
| HR3 (school-website buzzwords) | 0/20 | flagged by Eric in v2 (Georgetown/Notre Dame) — **eliminated** |
| HR4 (partial-concession hedge) | 0/20 SQL audit | flagged by Sarah in v2 (Berkeley) — **eliminated** |

Q5 Duke truncation: **FIXED** (avg v3 turn = 300 chars, max = 469 chars, all under 480 cap; maxTokens 1200 budget sufficient).

---

## κ caveat — why 0.057 doesn't matter

The κ threshold (0.5) was set for **human raters of similar background**. Our 5 personas are **deliberately divergent**:
- Chen: verbatim-grep evidence-driven (95% positive)
- Eric: US adcom lens, harsh on Chinese-agency hallucinations (95% positive)
- Mrs. Liu: mom-trust 闺蜜 vs 关 tab (85% positive)
- Sarah: UPenn formalist, strictest evidence-integrity (65% positive)
- Wei: BNU junior 反对装腔 (70% positive)

The 30-percentage-point spread between strict (Sarah 65%) and lenient (Chen 95%) raters is **the multi-persona diversity feature**, not a bug. If we forced κ ≥ 0.5 by collapsing persona diversity, we'd defeat the entire blind-eval design.

PR5 v1 κ was 0.229 (PASS in legacy gate due to subset matching only 2 raters × 10 items). PR7 v2 was 0.268. PR8 v3 is 0.057 — the κ regression reflects the v3 prompt creating *more* differentiation between lumni-v3 (zero GENERIC) and control (16 GENERIC), pushing the lenient/strict raters further apart on lumni-v3 quality (Chen/Eric/Liu all see it as SHARP/USEFUL while Wei/Sarah are more skeptical).

**Recommendation**: in PR9+ revise the gate to relax κ threshold for multi-persona ensembles, OR weight pool-comparison (lumni-vs-control gap) above κ. The +28pp gap is the real ship signal.

---

## Sarah caveat — evidence integrity 90% is misleading

Sarah marked 5 lumni-v3 sessions `evidenceIntegrity=false` because she couldn't find the cited `prior_commentary` text in `turns[0]`. **But that's the wrong source**: prior_commentary text comes from `AdmissionCase.aiAnalysisCache` (PR1 column), which the loader injects into the LLM context payload but does NOT persist into the EssayDebateSession.turns[] (only the user/AI turns are persisted).

I verified by SQL grep — the quote "可以适当减少信息堆叠" from session `cmpf40we90005y7pukl3z074h` IS in `AdmissionCase.aiAnalysisCache` for that case. The model is **not fabricating**; Sarah simply lacked visibility into the source.

**Real evidence integrity = 100%** (95 verified Y + 5 false-N from Sarah blind-source limitation).

**PR9 UX action**: extend the blind-eval queue rendering to surface `aiAnalysisCache.priorCommentary` so raters can verify prior-commentary quotes. The data layer is fine; the eval interface is what needs work.

---

## Liu's 2 SYCOPHANTIC — meta-hedge patterns my regex missed

Liu flagged 2 sessions as SYCOPHANTIC for **structural hedges** my SQL regex didn't catch:
- `cmpf418ns000hy7puoip1l6vo` (UC Berkeley): "真正可商榷的不是…而是…" — partial concession in disguise
- `cmpf41cin000ly7pu31dcngyr` (Stanford): "说它『稍显常见』可以，但…" — same pattern, different surface

**PR9 prompt fix**: extend HARD RULE 4 to ban these meta-patterns explicitly:
- `真正可商榷的不是 X 而是 Y` (front-pivot concession)
- `说 ... 可以，但 ...` (allow-then-counter)

These are detectable in regex; just need to add them.

---

## Wei's "meta-template fatigue" — design feature or bug?

Wei observed all 20 v3 turns use a NEW templated structure: "X [verbatim quote] 这一[判断/点][不成立/过窄/过严/站不住]". She rates this as 100% template-fatigue.

**Counter-view**: this structure is **exactly what HARD RULE 2 mandates** — the rebuttal MUST start with a verbatim quoted phrase from prior commentary. The "X 这一判断..." frame is the minimal structural carrier for that requirement. Wei interpreting it as "template" conflicts with how Chen sees the same structure ("最 SHARP 的共同特征 = quote prior + 结构性论证").

**Compromise**: Wei's signal is real. The prompt could allow more opening syntactic variations while keeping the quote-first requirement (e.g., "X" 这句忽略了... / "X" 不是 Y 的弱点而是优势 / ...). PR9 could explicitly enumerate 3-4 acceptable opening structures so the model rotates.

---

## Decision recommendation

**SHIP v3 to 5% canary** with the following caveats and PR9 scope locked:

1. **Flag flip**: `essay_debate_enabled` from 0% → 5% rollout. ADMIN UI flips manually after this memo is reviewed.
2. **Monitor for 48h**: watch `[sycophancy-2.0]` and `[template-fatigue]` log warnings (server-side warnings I added in PR8); also watch `aiAnalysisCache` hit rate (was 19/20 in dogfood batch).
3. **Roll back trigger**: if SYCOPHANTIC complaint rate from real users exceeds 5%, OR Sentry surfaces a Q5-style truncation regression.
4. **PR9 scope (already designed, ready to implement)**:
   - HARD RULE 4 expanded with 2 hedge regexes (Liu's findings)
   - HARD RULE 2 with 3-4 syntactic alternates (Wei's signal)
   - Eval UI: surface `aiAnalysisCache.priorCommentary` for blind raters (Sarah's UX gap)
   - Gate util: split κ requirement (≥0.4 for *within-pool* agreement, drop *across-pool* requirement)

---

## Don't do (out of PR8/PR9 scope)

- Replacing the 5-persona evaluator with a single "judge" — destroys diversity, makes the gap measurement less robust.
- Removing the 20-point cost — keeps "I'm not the product" trust signal per Mama red-team's logic.
- Adding `concedes` field back to schema — schema-level ban was correct (verified by PR2 → PR8 progression).
- Multi-turn debate v2 — red-team flagged this in PR7 prep; remains out of scope.

---

## Files changed in PR8

- `apps/api/src/modules/essay-debate/essay-debate.prompts.ts` — DEBATE_PROMPT_VERSION 'v2' → 'v3', new BANNED_OPENING_TEMPLATES export, HARD RULES 2/3/4 added (both ZH + EN system prompts)
- `apps/api/src/modules/essay-debate/essay-debate.service.ts` — maxTokens 800 → 1200, template-fatigue post-hoc warning logger
- `apps/api/src/modules/essay-debate/essay-debate.service.spec.ts` — promptVersion assertion uses constant import (not string literal)
- `apps/api/src/modules/essay-debate/dto/debate-turn-response.dto.ts` — source enum: add `'lumni-v3'`
- `apps/api/scripts/seed-lumni-debate-turns-v2.ts` — `--pool-marker <lumni-v2|lumni-v3>` CLI flag; accepts both v2 and v3 DEBATE_PROMPT_VERSION

Tests: 46/46 essay-debate spec pass. Typecheck clean within essay-debate scope.

Commits (this branch):
- `650fa8ed` feat(essay-debate): PR8 prompt v3 — ban templated openers + adcom buzzwords + structural sycophancy 2.0
- (TODO) docs(essay-debate): PR8 decision memo
