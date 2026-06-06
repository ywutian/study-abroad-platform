---
name: close-the-loop
description: Turn a recurring bug into a fix that CANNOT recur. Anti-pattern this kills — "I fixed the bug" shipping as patch N+1 on a file that's been fixed many times before. Forces the discipline: detect recurrence (git fix-churn) → name the structural root cause → add a GUARDRAIL (lint / test-or-invariant / abstraction-or-SSOT / type-level) → clear the worklist to 0 → PROVE the guardrail fires. Use before starting OR before calling done any fix to a hotspot, any bug that feels familiar, or any "fix it again" task. Not for genuine one-off bugs.
---

# Close the Loop

A fix is not done when the symptom disappears — it's done when the **same class of bug cannot come back**. This skill is the gate between a _patch_ (fixes today) and a _closure_ (fixes forever). It encodes exactly how the caching layer was finally closed in PR #339 after being "fixed many times."

The tell you need this: you're editing a file that has been fixed 3+ times, or the bug feels familiar, or you catch yourself writing "fix the X again."

## When to use

- About to fix a bug in a **fix-hotspot** (run the detector — see step 1).
- A bug that recurs / feels familiar / was "supposedly fixed before."
- Any task phrased as "fix X **again**", "still broken", "really fix", "round N".
- Right before marking any non-trivial fix done — as the closing check.

Do NOT use for: a genuine one-off (typo, a brand-new feature's first bug, a file with no fix history). Closure has a cost; spend it on classes that recur, not singletons. Step 1 tells you which.

## The closure gate

```
① detect recurrence → ② name the structural root cause → ③ choose the guardrail tier
   → ④ implement fix + guardrail, worklist→0 → ⑤ PROVE the guardrail fires → ⑥ document/index
```

A fix that skips ③–⑤ is a patch, not a closure. Don't claim "closed" without them.

### ① Detect recurrence (is this a class or a one-off?)

```bash
tsx scripts/check-recurrence.ts <file...>   # how many times was this fixed before?
tsx scripts/check-recurrence.ts             # assess your current working changes
tsx scripts/check-recurrence.ts --top       # the repo's recurring-bug map
```

- **fix-churn ≥ 3 (🔴 hotspot)** → recurring class → the rest of this skill is mandatory.
- **fix-churn 1–2** → judgment call; if the cause is structural, still close it.
- **fix-churn 0** → likely a one-off; a normal fix is fine. Stop here.

### ② Name the structural root cause (one sentence)

Not the symptom ("the panel was clipped") — the **structure** that let it happen. Almost every recurring class is one of:

| Root-cause shape              | Smell                                          | Example (this repo)                            |
| ----------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| **No enforcement**            | a rule exists only in docs / reviewers' heads  | overflow `min-w-0` rule documented, not linted |
| **No single source of truth** | the same value/logic duplicated across N files | TTLs scattered in 22 files (#339)              |
| **Observability blind spot**  | the failure is invisible until it's bad        | raw `getClient()` bypassing metrics (#274)     |
| **No abstraction**            | every caller re-implements the tricky part     | auth-ready guard hand-copied per page          |
| **Type allows the bad state** | the compiler can't catch it                    | nullable field defaulted to a fake enum        |

If you can't write the cause in one sentence, you haven't found it — keep digging. A patch that doesn't name the structure will reopen the loop.

### ③ Choose the guardrail tier (strongest that fits)

Docs do **not** close a loop — they're where closed loops go to be ignored. Pick a mechanism that _mechanically_ blocks recurrence:

| If the bug is…                                          | Guardrail                                                   | How it's enforced here                                                                                                           |
| ------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| a **pattern violation** (someone wrote the wrong shape) | **lint rule** at error level + `// @x-allowed` escape hatch | `apps/api/scripts/check-api-quality.ts`, `apps/web/scripts/check-code-quality.ts`, `apps/mobile/scripts/check-mobile-quality.ts` |
| a **behavior / contract** break                         | **test or invariant** that runs in CI                       | `*.spec.ts`; property/invariant sweeps (prediction); a CI gate job                                                               |
| **scattered duplication / drift**                       | **SSOT** (one source) + a lint that forbids bypassing it    | `REDIS_TTL` + `no-hardcoded-redis-ttl`; `qk` + `no-inline-list-query-key`                                                        |
| a **cross-layer / data-sync** gap                       | **a pipeline step / generated artifact** wired into CI      | closure-loop #300 (prod→JSON→CI)                                                                                                 |
| an **impossible-to-misuse** need                        | **type-level** — make the bad state unrepresentable         | discriminated unions, branded types, required args                                                                               |

Prefer lint+SSOT for "wrong shape" classes (cheap, immediate, local error message). Prefer tests/invariants for "wrong result" classes. Reach for types when you can make it un-writable.

### ④ Implement the fix + the guardrail, clear the worklist to 0

- Fix the instance **and** add the guardrail in the same change.
- **Clear existing violations to 0** so the rule can ship at **error** level (not a toothless warning). If you can't clear them now, ship as warning with a written worklist count and a dated promote-to-error plan (the proven #337→#338 pattern) — but warning-with-no-plan is how loops stay open.
- Keep an escape hatch (`// @x-allowed`) for the rare legitimate exception, so the rule is enforceable rather than worked-around.

### ⑤ PROVE the guardrail fires (the step everyone skips)

A guardrail that never triggers is theater. Demonstrate it catches the bug:

```bash
# lint rule: introduce one violation → confirm it's flagged → revert
#   (e.g. drop a hardcoded TTL into a service, run the linter, see the error, undo)
# test/invariant: assert the failing case is RED before your fix makes it GREEN
```

For a lint rule, the self-test is: add a temp violating file, run the linter, confirm the rule reports it at error, delete the temp file. Only after you've _seen it fire_ is the loop closed.

### ⑥ Document + index (only for architecture-level closures)

If the closure spans a subsystem, add a short doc and make it discoverable — don't rely on memory:

- Write/extend the relevant doc (e.g. `docs/CACHING_ARCHITECTURE.md`).
- Add a row to **Context Routing** in `CLAUDE.md` so the next session auto-reads it.
- Update rule counts in `apps/<app>/CLAUDE.md` + `.claude/rules/*.md` tables.

Per-fix closures (one lint rule + a cleared worklist) don't need a doc — the rule _is_ the documentation.

## Worked example — the caching closure (PR #339)

The model this skill generalizes:

1. **Recurrence**: `redis.service.ts` (10×), `BrowseTab.tsx` (15×), `ci.yml` (21×) — clearly a class.
2. **Root cause**: two structural shapes — an **observability blind spot** (raw `getClient()` bypassed metrics → quota burn invisible, #274) and **no SSOT** (TTLs in 22 files).
3. **Guardrails**: `withClient()` metered escape hatch + 3 error-level lint rules (`no-raw-redis-getclient`, `no-hardcoded-redis-ttl`, `no-redis-poll-without-backoff`); `REDIS_TTL` SSOT.
4. **Worklist→0**: migrated all 15 raw consumers; replaced all inline TTLs — rules shipped at error.
5. **Proved it fires**: dropped a temp `__lint_selftest__` service with violations, saw all 3 rules flag it, deleted it.
6. **Indexed**: `docs/CACHING_ARCHITECTURE.md` + Context Routing + rule-count bumps.

Result: a new `getClient()` or inline TTL now fails CI/pre-commit. The loop is closed.

## Discipline rules

- **No guardrail, not closed** — if your fix adds no lint/test/abstraction/type, you wrote a patch; say so honestly, don't call it closed.
- **Docs are not a guardrail** — a rule in `frontend.md` that isn't linted will be violated within a month.
- **Warning-level is half-closed** — a warning nobody is forced to read is barely better than a comment. Drive to error (clearing the worklist is the work).
- **Prove it fires** — an untested guardrail is a guess.
- **One escape hatch, not zero** — a rule with no suppression gets reverted under deadline pressure; a rule with `@x-allowed` survives.
- **Match the tier to the failure** — don't write a test for a wrong-shape bug (write a lint); don't lint a wrong-result bug (write an invariant).

## Anti-patterns

| Anti-pattern                                            | Why it reopens the loop                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| "Fixed it" (no guardrail)                               | The next person writes the same shape next week                    |
| Adding a docs/CLAUDE.md note as the "fix"               | Docs aren't enforced; the rule decays to folklore                  |
| Shipping the lint rule as warning with no worklist plan | Warnings accumulate; nobody is blocked; it never becomes error     |
| Lint rule that flags 0 things (never self-tested)       | A wrong regex / wrong scope silently protects nothing              |
| Guardrail with no escape hatch                          | Gets `// eslint-disable`-d or reverted at the first false positive |
| Closing a one-off                                       | Wasted ceremony — step ① exists to skip these                      |

## Quick reference

```bash
# Is this a recurring class?
tsx scripts/check-recurrence.ts <changed-file>
tsx scripts/check-recurrence.ts --top            # repo recurring-bug map

# Where guardrails live
apps/api/scripts/check-api-quality.ts            # backend lint rules
apps/web/scripts/check-code-quality.ts           # web lint rules
apps/mobile/scripts/check-mobile-quality.ts      # mobile lint rules
# tests: *.spec.ts (jest/vitest) · CI gates: .github/workflows/ci.yml

# Prove a new backend lint rule fires, then revert
#   add a temp violating .service.ts → pnpm --filter api lint:quality → see error → delete
```

## Related skills

- `/feedback-triage` — its stage 4 ("Verify = user-visible result, not code changed") should hand off to this skill to add the guardrail.
- `/review` — runs agents on changed files; use this skill when review finds a _recurring_ class.
- `/audit-drift` — finds docs/rules that drifted from code; complementary (it catches decayed guardrails).
- `/perf-loop` — same measure-then-act discipline, for performance instead of recurrence.
