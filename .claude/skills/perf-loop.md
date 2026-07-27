---
name: perf-loop
description: Iterate on a performance problem with measurable methodology — measure first (OTel traces / Chrome DevTools MCP trace / Prisma query log), name one specific bottleneck, measure the ceiling before building machinery, fix smallest-possible scope, benchmark before/after with the same query, document in PR. Also covers the traps — "no improvement" can mean your harness cannot test the hypothesis, and a fixed bottleneck un-masks the next one. Use when "the app feels slow" or a specific endpoint exceeded SLO; not for code-style cleanup.
---

# Perf Loop

A measurable methodology for performance work. Anti-pattern: "I refactored this for perf." This skill forces measure-fix-measure with the same query so you know what actually moved.

## When to use

- Specific endpoint exceeds SLO (p95 > 500ms for API; LCP > 2.5s for frontend; LLM call > 10s)
- User-reported "this is slow" — even if vague (you'll narrow it via measurement)
- Pre-deploy regression check after a significant feature ships
- DB connection pool saturating

Do NOT use for: code aesthetics, "I think this would be faster," speculative micro-optimization, "modernize this loop" tasks. Without a measured baseline, you can't know if a change helped or hurt.

## The 5-step loop

```
① measure baseline → ② hypothesise ONE bottleneck → ③ minimal fix → ④ benchmark same query → ⑤ commit with numbers
```

### ① Measure baseline (the step everyone skips)

Pick the right tool for the layer:

| Layer          | Tool                                                 | What it shows                                                     |
| -------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| HTTP endpoint  | OpenTelemetry traces (`apps/api/src/tracing.ts`)     | Span breakdown: HTTP → Express → Prisma → external                |
| DB query       | Prisma logger (`log: ['query']`) + `EXPLAIN ANALYZE` | Query plan, sequential scans, missing indexes                     |
| Frontend page  | Chrome DevTools MCP `performance_start_trace`        | LCP + its 4 phases, CLS, render-blocking, network dependency tree |
| LLM call       | TokenTrackerService + ResilienceService logs         | Token count, model latency, retry count                           |
| Bundle size    | `pnpm --filter web build` output + bundle-analyzer   | Per-route chunk sizes                                             |
| Cache hit rate | Redis `MONITOR` or feature-specific logs             | Hit/miss ratio                                                    |

**Output of step ①**: a single number or trace screenshot with timestamp. Save it.

```bash
# Example: API endpoint baseline
curl -w '\n%{time_total}s\n' http://localhost:4101/api/v1/predictions/me
# Or for Prisma query timing:
DEBUG='prisma:query' pnpm --filter api dev
```

### ② Hypothesise ONE bottleneck

Look at the baseline trace. Pick the SINGLE biggest contributor — not "all the things":

| Observation              | Likely bottleneck                                                |
| ------------------------ | ---------------------------------------------------------------- |
| Prisma span 80% of total | Missing index / N+1 query / unbounded select                     |
| External LLM span 90%    | Model choice / streaming opportunity / cache opportunity         |
| Hydration time 2s        | Large bundle / unused dependency / RSC boundary wrong            |
| Frontend LCP 3s          | Image not optimized / CSS render-blocking / API on critical path |
| Memory growth over time  | Listener leak / forgotten interval / large object retention      |

**Write the hypothesis as one sentence**: "I believe Prisma `findMany` on School with nested rankings is doing N+1 and accounts for 700ms of the 900ms total."

If you can't write it in one sentence, you don't have a hypothesis — go back to ①.

### ②½ Measure the CEILING before building anything

When the fix needs real machinery (a new route, a config system, a route→namespace map),
spend **one build** proving how much is even on the table. Break the thing on purpose —
the experiment only has to run, not to be shippable — and measure.

```
"If I deleted 158 of the 160 colour palettes (breaks the app), how fast does it get?"
   → LCP 1,453 → 1,137 ms. That is the ceiling for ANY theme-CSS change.
   → The real, shippable fix landed at 1,154 ms — 98% of the ceiling.
   → Conclusion: no reason to squeeze further, and no reason to over-engineer it.
```

Two outcomes, both valuable:

- **Ceiling is big** → you now know what "done" looks like, and can stop when you're near it.
- **Ceiling is small** → you just saved yourself building the machinery. Say the number and move on.

Do this _before_ step ③ whenever the fix would take more than ~3 files. Revert the destructive
patch immediately after measuring (`git checkout --`) — it exists to produce one number.

### ③ Minimal fix (don't refactor while fixing)

Cardinal rule: **change exactly what the hypothesis predicts will help**. Resist the urge to also tidy.

| Hypothesis                 | Minimal fix shape                                                     |
| -------------------------- | --------------------------------------------------------------------- |
| N+1                        | Add `include` or batched `groupBy`                                    |
| Missing index              | One `@@index([col])` in schema + migration                            |
| Unbounded select           | Add `take` / pagination / shared `*_SELECT` constant                  |
| Cache miss                 | Add Redis layer with appropriate TTL + invalidation                   |
| Bundle bloat               | Lazy-load via `dynamic()` or remove dep                               |
| LLM latency                | Switch to streaming OR reduce maxTokens OR cache by promptVersion key |
| Connection pool saturation | Lower `connection_limit` OR add transaction batching                  |

The fix should touch ≤ 3 files. If it touches more, you're refactoring, not fixing.

### ④ Benchmark same query

Run the EXACT same measurement you did in step ①. Same URL, same params, same browser, same time of day if possible. Save the new number.

```bash
# Same curl, same env
curl -w '\n%{time_total}s\n' http://localhost:4101/api/v1/predictions/me
```

Compare:

- **<10% improvement**: three possible causes — see below. Don't default to the first one.
- **10–50% improvement**: real but modest. Worth shipping; document.
- **>50% improvement**: confirm by running 5× and averaging — outliers happen.
- **Regression**: revert immediately. Hypothesis was inverted.

#### "No improvement" has THREE causes, not two

| Cause                                        | How to tell                                                                        | What to do                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Hypothesis wrong                             | The thing you changed shows up unchanged in the trace                              | Re-hypothesise                                       |
| Fix missed the bottleneck                    | Trace phase you targeted didn't shrink                                             | Same fix, right place                                |
| **Your harness cannot test this hypothesis** | **The bottleneck differs between your harness and the environment you care about** | **Say so. Do NOT conclude the hypothesis is wrong.** |

The third one is the trap. Real case (2026-07, landing page i18n scoping): cutting the client
dictionary to 6 namespaces shrank the document **111 KB → 38.6 KB brotli (−65%)**, yet local
throttled LCP did not move at all (1,281 ms vs 1,154/1,293 baseline). Reading the band literally
says "hypothesis wrong". It wasn't — **locally** the bottleneck was render-blocking CSS and the
LCP element was _text_, so the trace had **no `load delay` phase at all**; in production the LCP
element was an image and `load delay` was 80% of LCP. The harness had no way to show the win.

**Check before concluding**: is the phase you're trying to shrink even present, and dominant, in
your harness's trace? If the production breakdown and the local breakdown disagree about which
phase dominates, your local number cannot falsify the hypothesis — and it cannot confirm it either.
Ship it only if you can measure it where it matters, or park it and say what's missing.

### ⑤ Commit with numbers (the discipline)

PR title + commit message MUST cite numbers:

```
perf(prediction): batch School ranking lookup — p95 920ms → 410ms (-55%)

Before: GET /api/v1/predictions/me p95 = 920ms (n=20, local dev DB,
        4-school target list)
After:  GET /api/v1/predictions/me p95 = 410ms (n=20, same)
Root cause: N+1 — each school triggered a SchoolRanking findMany.
Fix: added `include: { rankings: ... }` to the parent query; one
     extra JOIN replaces 4 separate queries.
Trace screenshots: docs/perf/2026-05-21-prediction-batch.png
```

Without numbers, you're shipping a refactor. With numbers, you're shipping a perf fix.

## Required tooling (already in repo)

- **OpenTelemetry**: enabled when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; zero overhead off
- **Prisma query logging**: `DEBUG='prisma:query' pnpm api`
- **Chrome DevTools MCP**: `performance_start_trace` / `performance_analyze_insight`.
  There is **no Lighthouse in this repo** — an earlier version of this skill told you to
  run `pnpm lighthouse`, which does not exist (no script, no dependency in `apps/web`).
- **Bundle analyzer**: `pnpm --filter web build:analyze`
- **Memory profile**: `--inspect` flag on Node for heap snapshot

## Discipline rules

- **One bottleneck per loop iteration** — fixing 3 things at once means you don't know which one worked
- **Re-measure the insights after every fix — a fixed bottleneck un-masks the next one.** On the
  landing page, DevTools' `RenderBlocking` insight estimated **0 ms** of savings before the hero
  fix and **936 ms** after it: nobody was waiting on CSS while everybody was waiting on JS.
  Priorities computed from a pre-fix report are stale the moment the fix lands
- **Insight tools have blind spots — know their scope.** `RenderBlocking` counts _requests_, so an
  inline `<style>` is invisible to it no matter how large. Don't read "0 ms savings" as "not a
  problem"; read it as "not a problem _of this shape_"
- **Don't trust a trace's TTFB for server-render time.** On the same production page DevTools
  reported 21 ms while `curl -w '%{time_starttransfer}'` measured a median of 289 ms over 10 runs.
  Measure server think-time yourself, and separate it from transfer time
- **Same query before and after** — different params = invalid comparison
- **Average ≥ 5 runs** for variable measurements — single curl run has noise
- **Document baseline** — even if perf was "fine before," capture it; you may need to defend the fix later
- **Don't refactor while fixing** — keep change ≤ 3 files; aesthetic cleanup is a separate PR
- **Revert immediately on regression** — sunk-cost trap; revert clean and re-hypothesise

## Common bottleneck reference

| Symptom                                    | Probable cause                                                                   | Diagnostic                                                                                                                                                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API endpoint slow                          | N+1 query                                                                        | Prisma query log shows repeated similar queries                                                                                                                                                                                                    |
| DB CPU high                                | Missing index                                                                    | `EXPLAIN ANALYZE` shows Seq Scan on large table                                                                                                                                                                                                    |
| Frontend slow first load                   | Bundle too big                                                                   | `pnpm build:analyze` shows >250KB main chunk                                                                                                                                                                                                       |
| FCP looks fine but the page reads as blank | **Above-the-fold content server-rendered at `opacity:0`, waiting for hydration** | `curl -s <url> \| grep -c 'style="opacity:0'` — the content is already in the HTML, just painted invisible. Framer-motion `initial={{opacity:0}}` does this. Only the containers **above the fold** are bugs; `whileInView` ones below are correct |
| LCP image fetch starts late                | Not necessarily discovery — check first                                          | Read `NetworkDependencyTree`. If _every_ subresource starts at the same late timestamp, they were all waiting on the **document**, not on discovery                                                                                                |
| Frontend slow after first load             | Re-render on every state                                                         | React DevTools Profiler shows component count > 1k                                                                                                                                                                                                 |
| LLM slow                                   | Synchronous full response                                                        | Check if streaming endpoint exists                                                                                                                                                                                                                 |
| Mobile slow scroll                         | FlashList unrecycled                                                             | Check `keyExtractor` returns stable strings                                                                                                                                                                                                        |
| WebSocket lag                              | Backpressure                                                                     | OTel span on WS handler > 100ms means blocked event loop                                                                                                                                                                                           |

## Anti-patterns

| Anti-pattern                              | Why it fails                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "I refactored for perf"                   | Without measurement, you don't know if you helped                                                                                                                                                                                                                                                                                     |
| Fix 5 things in one PR                    | Can't attribute the improvement                                                                                                                                                                                                                                                                                                       |
| `console.time` only, no baseline saved    | Comparison evaporates after the dev session                                                                                                                                                                                                                                                                                           |
| "It feels faster"                         | Cognitive bias — keep numbers                                                                                                                                                                                                                                                                                                         |
| Optimizing dev-mode timings               | Dev != prod; benchmark against prod-mode build                                                                                                                                                                                                                                                                                        |
| Assuming a local prod build == production | Only true for code the _framework_ runs. Anything the **platform** provides is a different implementation: `images.minimumCacheTTL` behaved correctly under `next start` and did nothing on Vercel, whose Image Optimization derives the browser `Cache-Control` from the upstream file instead. Local green proved the wrong runtime |
| Reasoning about byte cost from parse cost | Parsing 1.9 MB of CSS (320 rules) measured **6 ms**. The same bytes cost hundreds of ms because they sat _in front of the LCP element_ in a `no-store` document. Byte **position** and **cacheability**, not parse time                                                                                                               |
| Premature memoization                     | `useMemo`/`React.memo` everywhere causes more re-renders than it prevents — measure first                                                                                                                                                                                                                                             |
| Index on every column                     | Indexes cost insert time; only add what `EXPLAIN ANALYZE` proves is needed                                                                                                                                                                                                                                                            |

## Quick reference

```bash
# Backend latency
DEBUG='prisma:query' pnpm api &
curl -w '\n%{time_total}s\n' http://localhost:4101/api/v1/<endpoint>

# Frontend LCP — Chrome DevTools MCP, against a PRODUCTION build
#   emulate  { viewport: '390x844x3,mobile,touch', networkConditions: 'Slow 4G', cpuThrottlingRate: 4 }
#   navigate_page → performance_start_trace { reload: true }
#   performance_analyze_insight { insightName: 'LCPBreakdown' | 'NetworkDependencyTree' | 'RenderBlocking' }
# Server-render time is NOT the trace's TTFB reading — measure it yourself:
curl -sS --compressed -o /dev/null <url> -w '%{time_starttransfer} %{time_total} %{size_download}\n'

# Bundle size
cd apps/web && ANALYZE=true pnpm build

# DB query plan
psql -c "EXPLAIN ANALYZE <your-query>;"

# Redis cache hit/miss
redis-cli MONITOR | grep <key-prefix>
```

## Related skills

- `/canary-rollout` — if perf regression triggers Stage rollback
- `/iterate-prompt-with-blind-eval` — for LLM-specific quality+latency trade-offs (model swap, maxTokens tuning)
