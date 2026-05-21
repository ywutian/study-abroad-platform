---
name: multi-agent-debate
description: Tackle a large, ambiguous, or high-stakes change by orchestrating parallel multi-agent debate — separate planning agents from acceptance agents, synthesize conflicts into decisive calls, batch the work, verify each step. Use for redesigns, cross-cutting refactors, or any change where "what to build" is not yet obvious.
---

# Multi-Agent Debate Workflow

A repeatable process for big/ambiguous changes. The core idea: **don't let one
agent (or one perspective) decide — run several specialized agents in parallel,
let their disagreement surface the real trade-offs, then synthesize into a
decisive plan.** Proven on the 2026-05 dashboard redesign (PR #235).

## When to use

- A redesign or cross-cutting refactor (many files, several modules)
- "What to build" is not yet obvious — the problem is open-ended
- High-stakes / hard-to-reverse changes
- Feedback that mixes confirmed bugs with product-strategy questions

Do NOT use for: a single-file fix, a well-specified task, or a one-line change.

## The five phases

```
problem → ① design debate → ② batch it → ③ [per batch: plan debate → implement → acceptance debate] → ④ deferred-item decisions → ⑤ ship
```

### ① Design debate — "should we, and what shape?"

- Launch 6–10 agents **in parallel** (one message, multiple Agent calls), each a
  different type so they bring different lenses. Pick from: `study-abroad-expert`,
  `applicant-simulator`, `architect`, `design-reviewer`, `user-journey-auditor`,
  `ai-prompt-engineer`, `security-reviewer`, `data-model-reviewer`, `i18n-specialist`.
- Give every agent **real grounding**: exact file paths and current code state.
  An ungrounded agent hallucinates.
- Ask the same open question; let them answer independently.
- **Synthesize** (see "Orchestrator duties") into one decisive direction.

### ② Batch it

Split the change into 3–5 independently shippable batches, ordered
**low-risk → high-risk** (e.g. declutter → layout → content logic).
Each batch must be commit-able and verifiable on its own.

### ③ Per-batch loop (the heart of it)

For **every** batch, three steps:

1. **Plan debate** — multiple agents turn "what" into "how": exact files,
   function signatures, breakpoints, i18n keys, contract changes, test changes.
2. **Implement** — synthesize the plans into one spec, then write the code.
   Run typecheck + tests + lint **before** committing.
3. **Acceptance debate** — a *different* set of agents (planners do not review
   their own work) audits the written code. Triage findings by severity:
   `BLOCK` (must fix) / `WARN` (evaluate) / `CONSIDER` (fix or record as known).
   Fix what's needed, then commit.

### ④ Deferred-item decisions

Explicitly separate **"confirmed, ship it"** from **"needs product sign-off."**
For the latter: run an *analysis* debate (multiple agents weigh each option),
present the synthesis to the user as a choice, then — once chosen — run a
*plan* debate before building. Never silently make a product call.

### ⑤ Ship

PR with a description that lists what each batch did AND the still-deferred
items. Let the user review/merge.

## Orchestrator duties (you)

1. **Ground every agent** — real file paths + current state, or it invents.
2. **Synthesize, don't average** — on a conflict, judge *which agent has
   authority over that dimension* (ai-system compliance → `ai-prompt-engineer`;
   emotional UX → `applicant-simulator`; contract/scope → `architect`).
3. **Make the decisive call** — debate produces views; you must converge them
   into one executable plan. No hedging.
4. **Keep the discipline** (below).

## Discipline rules

- **Parallel, not serial** — dispatch agents in one message.
- **Planners ≠ reviewers** — the agent that wrote a plan does not accept it.
- **Disagreement is a feature** — a real conflict exposes a real trade-off;
  resolving it usually yields a better answer than either side proposed.
- **Verify before commit** — typecheck + relevant tests + lint every batch.
- **Worktree hygiene** — if working in a git worktree, tell every agent the
  exact worktree path and to ignore sibling worktrees. Agents *do* read the
  wrong directory; the redundancy of multiple agents catches it — cross-check
  and re-dispatch the one that strayed.
- **Product decisions go back to the user** — don't bury a strategy call inside
  a "polish" batch.

## Why the redundancy pays off

On PR #235, one acceptance agent reviewed the wrong directory and returned a
false FAIL. Because two other agents in the same round read the correct
worktree, the contradiction was obvious immediately — re-dispatched with an
explicit path, got the real verdict. One agent can be wrong silently; a panel
cannot.
