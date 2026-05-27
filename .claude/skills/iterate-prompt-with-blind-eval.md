---
name: iterate-prompt-with-blind-eval
description: Iteratively improve an LLM prompt that has subjective quality concerns (sycophancy, template fatigue, hallucination patterns) using a 5-persona AI blind-eval loop. Use when a prompt needs measurable improvement and "looks right to me" is not enough — typical case is a user-facing LLM feature where bad output is hard to define precisely. Proven on the essay-debate feature (PR5–PR9, sycophancy 9 → 1, lumni-vs-control gap −2pp → +28pp).
---

# Iterate Prompt with Blind Eval

A repeatable loop for measurably improving an LLM prompt. Core idea: **don't iterate on prompts by vibes — define a measurable A-vs-B test against the unwrapped baseline (raw GPT/Claude), run 5 deliberately-divergent persona agents as blind raters, and let the data drive each prompt revision.**

Proven on essay-debate (PR5 → PR9, 4 iterations, ~$3.50 LLM cost total, gate went from FAIL to PASS).

## When to use

- Prompt produces subjectively bad output (sycophancy, template fatigue, hallucination, school-buzzword regurgitation)
- "Bad" is hard to define precisely — you need multiple perspectives
- Real human raters too expensive (¥1000/round for 5 counselors) or too slow
- Stakes are high enough to justify ~30min of agent compute per iteration

Do NOT use for: deterministic prompts (extractors, classifiers — use unit tests instead); single-edit prompt tweaks; prompts without a clear "control" baseline to compare against.

## The five-phase loop

```
problem → ① design 5 personas + control → ② seed N case pairs → ③ blind-rate × M iterations → ④ gate decides ship/iterate → ⑤ canary rollout
```

### ① Design 5 personas + control baseline

Pick **5 personas with intentionally divergent rating philosophies** — the diversity IS the feature. Anchor each to a real archetype so the prompts stay grounded:

| Persona shape | Lens | Catches |
|---|---|---|
| Strict formalist | Verbatim evidence verification | fabrication |
| Junior skeptic | Anti-装腔 / anti-GRE | template overuse |
| US adcom voice | "would I admit this?" | school-marketing buzzwords |
| Engineer-strict | Verbatim grep, can reconstruct logic? | evidence drift |
| Parent-trust | "推闺蜜 vs 关 tab" | feels-evasive patterns |

**Control** = same input through the unwrapped raw model. Without a control, you measure "is it good in absolute terms" — which is impossible to know; with a control, you measure "is the wrapper worth shipping over baseline."

### ② Seed N case pairs (typically N=20)

For each iteration version v_k, write a seed script that:

1. Takes a fixed set of N domain cases (the dogfood set; keep stable across iterations)
2. Generates **lumni-v_k turn** for each case via the live service (real LLM, real validation)
3. Generates **control turn** for each case via raw model (no wrapper, same input)
4. **Stamps a pool marker** in the persisted JSON (`turns[].source = 'lumni-v_k' | 'control'`) so the gate can reverse-decode after blind rating

**Budget guard**: per-turn cost cap × N ≤ $1; refuse to run if exceeded.

**Pool marker convention** (this is the secret weapon):
```typescript
// In the persisted EvaluationSession.turns JSONB:
turns[lastIdx].source = 'lumni-v3'   // or 'lumni-v4', 'control', etc.
turns[lastIdx].promptVersion = 'v3'  // audit trail
```

### ③ Blind-rate × M raters (M=5)

Dispatch all 5 raters **in parallel via the Agent tool** (single message, 5 calls). Each agent:

- Receives ONLY the 20 sessionIds, sees no pool labels in their queue
- Writes ratings to `EvaluationRow` table with `isChatGptControl=false` (no leakage)
- Returns a structured report (distribution + HARD RULE audit + 3 best / 3 worst sessionIds)

**Critical**: every agent must be told NOT to read `turns[].source` or `turns[].promptVersion` (those leak pool ground truth). Inline the queue rows directly in the agent prompt to avoid worktree-isolation issues with shared files.

After all raters finish, **reverse-decode** the true pool labels:
```sql
UPDATE EvaluationRow eval
SET isChatGptControl = true
WHERE evaluatorId LIKE 'agent-%-v_k-%'
  AND EXISTS (
    SELECT 1 FROM EvaluationSession s
    WHERE s.id = eval.sessionId
      AND s.turns::jsonb @> '[{"source": "control"}]'::jsonb
  );
```

### ④ Multi-persona gate decides

Run a 3-threshold gate **with multi-persona override**:

```typescript
// Default thresholds for 2-rater human mode:
//   κ ≥ 0.5, evidence ≥ 70%, lumni ≥ control
// Override when raterCount ≥ 4 (you're in 5-persona mode):
//   κ ≥ 0.05 (deliberate divergence is the feature)
//   evidence ≥ 70%
//   lumni-vs-control gap ≥ 5pp (substantive ship signal)
```

The κ ≥ 0.5 threshold assumes "raters of similar background" — that's a false-negative for 5 personas chosen for diversity. Gap is the real ship metric.

If gate **FAILS**: read each persona's verbatim findings, identify the most common new pattern (e.g. "17/20 turns use this template opener"), write that into the next prompt version's HARD RULES, bump prompt version, loop back to ②.

If gate **PASSES**: write a decision memo (template below), recommend flag flip.

### ⑤ Canary rollout

`feature_flag` 0% → 5% → 25% → 100% over ~14 days. Monitor server-side warn logs:
- `[sycophancy-2.0]` (banned opener appeared)
- `[template-fatigue]` (templated frame appeared)
- `[hedge-sycophancy]` (hedge pattern appeared)

Each iteration adds new post-hoc warning loggers — they're non-blocking signals, not validators.

## Required infrastructure

- **Versioned prompt constant** (`PROMPT_VERSION = 'v3'`) — bump every change; logged per turn
- **Pool marker field** (`turns[].source`) — JSONB marker for reverse-decode
- **Evaluation table** with `(sessionId, turnIndex, evaluatorId)` unique constraint
- **Gate util** as pure function (testable without DB) + thin CLI wrapper
- **Parameterized seed script** (`--pool-marker <name>`) so the same script ships v_k+1

## Decision memo template

`<module>/PR<n>_DECISION.md`:
1. Verdict (PASS/FAIL/iterate) + key numbers (gap, evidence, κ)
2. Per-rater comparison table v_k-1 → v_k
3. HARD RULE compliance audit (SQL grep counts)
4. Caveats found (not ship-blocking, listed for next PR)
5. Recommendation (flag flip / iterate / both)
6. Rollback triggers
7. Files changed manifest

## Discipline rules

- **5 raters, 5 personas, 5 different rating philosophies** — copying one rater 5× gives κ=1 but tells you nothing
- **Pool markers in JSONB, not in evaluation rows** — keeps blind eval truly blind
- **Reverse-decode via SQL after rating, not before** — agents can't see ground truth even by accident
- **Inline the queue in agent prompts** — shared queue files create worktree-isolation failures; inline rows always work
- **Same N=20 cases across iterations** — apples-to-apples; only the wrapper changes
- **Document misjudgments** — when a rater marks something wrong (e.g. Sarah's 5 false-N's from blind-source UX gap), record it; the *eval UI itself* needs fixing
- **Never modify rater data post-hoc** — if a rater scored wrong, log it in the decision memo as a known limitation; don't tamper with audit trail

## What this skill is NOT for

- Replacing real user A/B tests — 5 agents ≠ 100 real users
- Validating factual accuracy (use deterministic eval / golden sets)
- Single-pass prompt grading (skill is the *loop*, not the verdict)
- High-stakes decisions like flag-flip without human review (this skill gets you to a memo; humans sign off)

## Cost & time benchmark

Per iteration (5 agents × 20 turns):
- LLM cost: ~$0.80 seed + ~$1.50 5-agent eval = **$2.30**
- Wall time: ~5min seed + ~25min agent eval (parallel) + ~5min synthesis = **~35min**
- Human review: ~10min reading agent reports + signing off memo

essay-debate took 4 iterations (PR6 → PR9) = ~$10 LLM + ~3 hours wall time to go from FAIL gate → PASS gate.

## Anti-patterns I avoided

| Anti-pattern | What I did instead |
|---|---|
| One "judge" agent | 5 divergent personas — diversity is the signal |
| κ ≥ 0.5 as hard gate | Multi-persona mode: gap is primary, κ floor lowered |
| Make AI feature free to win | Kept 20-point cost (mama red-team: free = "I'm the product") |
| Add `concedes` schema field | Schema-level ban forces prose-level honesty (verified across 4 versions) |
| Fix the rater when rater is wrong | Fix the eval UI (Sarah's 5 false-N's → priorCommentary surface) |
| Iterate prompt to chase κ up | Iterate the gate util — κ measurement was the bug, not the prompt |
