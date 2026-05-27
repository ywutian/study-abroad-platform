---
name: perf-loop
description: Iterate on a performance problem with measurable methodology — measure first (OTel traces / Lighthouse / Prisma query log), name one specific bottleneck, fix smallest-possible scope, benchmark before/after with same query, document in PR. Use when "the app feels slow" or a specific endpoint exceeded SLO; not for code-style cleanup.
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

| Layer | Tool | What it shows |
|---|---|---|
| HTTP endpoint | OpenTelemetry traces (`apps/api/src/tracing.ts`) | Span breakdown: HTTP → Express → Prisma → external |
| DB query | Prisma logger (`log: ['query']`) + `EXPLAIN ANALYZE` | Query plan, sequential scans, missing indexes |
| Frontend page | Lighthouse + Chrome DevTools Performance | LCP, TTI, hydration time, bundle size |
| LLM call | TokenTrackerService + ResilienceService logs | Token count, model latency, retry count |
| Bundle size | `pnpm --filter web build` output + bundle-analyzer | Per-route chunk sizes |
| Cache hit rate | Redis `MONITOR` or feature-specific logs | Hit/miss ratio |

**Output of step ①**: a single number or trace screenshot with timestamp. Save it.

```bash
# Example: API endpoint baseline
curl -w '\n%{time_total}s\n' http://localhost:4101/api/v1/predictions/me
# Or for Prisma query timing:
DEBUG='prisma:query' pnpm --filter api dev
```

### ② Hypothesise ONE bottleneck

Look at the baseline trace. Pick the SINGLE biggest contributor — not "all the things":

| Observation | Likely bottleneck |
|---|---|
| Prisma span 80% of total | Missing index / N+1 query / unbounded select |
| External LLM span 90% | Model choice / streaming opportunity / cache opportunity |
| Hydration time 2s | Large bundle / unused dependency / RSC boundary wrong |
| Frontend LCP 3s | Image not optimized / CSS render-blocking / API on critical path |
| Memory growth over time | Listener leak / forgotten interval / large object retention |

**Write the hypothesis as one sentence**: "I believe Prisma `findMany` on School with nested rankings is doing N+1 and accounts for 700ms of the 900ms total."

If you can't write it in one sentence, you don't have a hypothesis — go back to ①.

### ③ Minimal fix (don't refactor while fixing)

Cardinal rule: **change exactly what the hypothesis predicts will help**. Resist the urge to also tidy.

| Hypothesis | Minimal fix shape |
|---|---|
| N+1 | Add `include` or batched `groupBy` |
| Missing index | One `@@index([col])` in schema + migration |
| Unbounded select | Add `take` / pagination / shared `*_SELECT` constant |
| Cache miss | Add Redis layer with appropriate TTL + invalidation |
| Bundle bloat | Lazy-load via `dynamic()` or remove dep |
| LLM latency | Switch to streaming OR reduce maxTokens OR cache by promptVersion key |
| Connection pool saturation | Lower `connection_limit` OR add transaction batching |

The fix should touch ≤ 3 files. If it touches more, you're refactoring, not fixing.

### ④ Benchmark same query

Run the EXACT same measurement you did in step ①. Same URL, same params, same browser, same time of day if possible. Save the new number.

```bash
# Same curl, same env
curl -w '\n%{time_total}s\n' http://localhost:4101/api/v1/predictions/me
```

Compare:
- **<10% improvement**: hypothesis wrong, OR fix didn't address the bottleneck. Revert and re-hypothesise.
- **10–50% improvement**: real but modest. Worth shipping; document.
- **>50% improvement**: confirm by running 5× and averaging — outliers happen.
- **Regression**: revert immediately. Hypothesis was inverted.

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
- **Lighthouse CI**: in `apps/web` package scripts
- **Bundle analyzer**: `pnpm --filter web build:analyze`
- **Memory profile**: `--inspect` flag on Node for heap snapshot

## Discipline rules

- **One bottleneck per loop iteration** — fixing 3 things at once means you don't know which one worked
- **Same query before and after** — different params = invalid comparison
- **Average ≥ 5 runs** for variable measurements — single curl run has noise
- **Document baseline** — even if perf was "fine before," capture it; you may need to defend the fix later
- **Don't refactor while fixing** — keep change ≤ 3 files; aesthetic cleanup is a separate PR
- **Revert immediately on regression** — sunk-cost trap; revert clean and re-hypothesise

## Common bottleneck reference

| Symptom | Probable cause | Diagnostic |
|---|---|---|
| API endpoint slow | N+1 query | Prisma query log shows repeated similar queries |
| DB CPU high | Missing index | `EXPLAIN ANALYZE` shows Seq Scan on large table |
| Frontend slow first load | Bundle too big | `pnpm build:analyze` shows >250KB main chunk |
| Frontend slow after first load | Re-render on every state | React DevTools Profiler shows component count > 1k |
| LLM slow | Synchronous full response | Check if streaming endpoint exists |
| Mobile slow scroll | FlashList unrecycled | Check `keyExtractor` returns stable strings |
| WebSocket lag | Backpressure | OTel span on WS handler > 100ms means blocked event loop |

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| "I refactored for perf" | Without measurement, you don't know if you helped |
| Fix 5 things in one PR | Can't attribute the improvement |
| `console.time` only, no baseline saved | Comparison evaporates after the dev session |
| "It feels faster" | Cognitive bias — keep numbers |
| Optimizing dev-mode timings | Dev != prod; benchmark against prod-mode build |
| Premature memoization | `useMemo`/`React.memo` everywhere causes more re-renders than it prevents — measure first |
| Index on every column | Indexes cost insert time; only add what `EXPLAIN ANALYZE` proves is needed |

## Quick reference

```bash
# Backend latency
DEBUG='prisma:query' pnpm api &
curl -w '\n%{time_total}s\n' http://localhost:4101/api/v1/<endpoint>

# Frontend Lighthouse
cd apps/web && pnpm lighthouse <url>

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
