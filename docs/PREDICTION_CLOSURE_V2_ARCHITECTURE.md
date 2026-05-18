# Prediction Closure v2 — Architecture

- Updated: 2026-05-17
- Branch: `closure-v2-foundation` · PR [#224](https://github.com/ywutian/study-abroad-platform/pull/224)
- Live status: `docs/PREDICTION_CLOSURE_V2_STATUS.md`
- Plan of record: `.claude/plans/plan-v2-compiled-puddle.md`

## TL;DR — one command

```bash
pnpm --filter api closure:update                 # full update: sync + status + next actions
pnpm --filter api closure:update --reopen-stale  # also re-open data past the freshness window
pnpm --filter api closure:update --json          # machine-readable summary
pnpm --filter api closure:status                 # read-only status report
```

`closure:update` is the **single entry point**. It brings the closure queue
fully current and tells you exactly what (if anything) still needs collection.

## What the system is

The **Continuous Closure Engine** keeps the prediction-input data for every
School and HighSchool complete. It models closure as a **work queue**, not a
one-shot task: each (entity, field) pair is one `ClosureTarget` row that the
engine drives to a terminal state.

```
                    ┌─────────────────────────────────────────┐
                    │            ClosureTarget queue          │
                    │   one row per (entity, field)           │
                    │   PENDING → CLOSED | UNAVAILABLE | …     │
                    └─────────────────────────────────────────┘
                          ▲                       │
            sync / seed   │                       │  status / report
                          │                       ▼
   ┌──────────────────────┴───────┐   ┌───────────────────────────┐
   │  School / HighSchool tables  │   │  closure-status reporter  │
   │  (the real prediction data)  │   └───────────────────────────┘
   └──────────────────────────────┘
                          ▲
            write field + provenance
                          │
   ┌──────────────────────┴─────────────────────────────────────┐
   │  COLLECTION  — Claude agents: WebSearch + WebFetch + parse  │
   │  real CDS PDF / IR page / newsroom; 5 quality gates;        │
   │  never fabricate — unverifiable → UNAVAILABLE / FAILED      │
   └────────────────────────────────────────────────────────────┘
```

## Components

| Component                 | Path                                                          | Role                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`ClosureTarget` table** | `prisma/schema.prisma`                                        | Work queue. One row per (entityType, entityId, field). `status`: PENDING → CLOSED / UNAVAILABLE / FAILED / NEEDS_REVIEW. `priority`, `tier`, `sourceUrl`, `confidence`. Migration `20260517050000_closure_v2_closure_target`. |
| **Seeder / sync**         | `scripts/closure-agents/seed-closure-targets.ts`              | Scans live School+HighSchool, upserts a target per (entity, field). Re-runnable: flips PENDING→CLOSED when a field gains a value.                                                                                             |
| **Status reporter**       | `scripts/closure-agents/closure-status.ts`                    | Read-only closure % overall / per-wave / per-field. `--json`.                                                                                                                                                                 |
| **One-command updater**   | `scripts/closure-agents/closure-update.ts`                    | Orchestrates sync → reopen-stale → status → next-actions. The canonical entry point.                                                                                                                                          |
| **Tier-1 scheduler**      | `src/modules/prediction/closure/closure-scheduler.service.ts` | In-API non-pausing `setInterval` loop — runs sync + reopen-stale + stats automatically. Gated by `CLOSURE_ENGINE_ENABLED`.                                                                                                    |
| **Collectors**            | `scripts/closure-agents/collect-*.ts` (44 files)              | Per-field collection artifacts produced by Claude agents — carry the resolved values + cited source URLs (also serve as the reproducible cycle payload / audit trail).                                                        |
| **Engine consumers**      | `src/modules/prediction/counselor/counselor-modifiers.ts`     | The prediction engine reads the closed School/HighSchool fields.                                                                                                                                                              |

## Closure model — what "100%" means

A target is **terminal** when it is:

- **CLOSED** — a real value was found, written with `provenance` (sourceUrl + fetchedAt + verifiedBy + confidence + tier).
- **UNAVAILABLE** — verified that the data is genuinely not publicly published (e.g. CDS Section C21 never separates ED II; US publics don't publish citizenship-split admit rates; UC/CSU are test-blind). This is a _success_ state, not a gap.

`FAILED` (retryable) and `NEEDS_REVIEW` are non-terminal. "Closure 100%" = every
target is CLOSED or UNAVAILABLE. **Never fabricate** — no source ⇒ UNAVAILABLE/FAILED.

## Three-tier execution (the never-pause design)

| Tier  | Mechanism                                             | Pausing?                             | Role                                                                                                 |
| ----- | ----------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **1** | `ClosureSchedulerService` — in-API `setInterval` tick | No (cron-like, runs where the DB is) | Sync queue, re-open stale data, log closure %. The maintenance backbone.                             |
| **2** | Scheduled Claude routine (daily)                      | No (cron-triggered)                  | Collect hard cases — gated PDFs, CN-language sources, NEEDS_REVIEW.                                  |
| **3** | Session burst — parallel Claude subagents             | Yes (session-bound)                  | Fast bulk collection when a human is driving (how the first 100% was reached). Optional accelerator. |

A chat session pauses; Tier 1+2 (cron-driven) do not. Note: a _remote_ scheduled
agent cannot run the engine — the DB is local; Tier 1 must run in-API where
Prisma connects.

## Running an update

**Programmatic (one command)** — `pnpm --filter api closure:update`. Does
sync + status + prints next actions. If PENDING > 0 it lists the fields and the
dispatch recipe.

**Collection (when PENDING > 0)** — dispatch one Claude collection agent per
field. Each agent: claims a batch from `ClosureTarget WHERE status='PENDING'`,
does real WebSearch/WebFetch/CDS parsing, writes the School/HighSchool field +
`metadata.provenance` + ClosureTarget status. Pattern: any `collect-*.ts` header.
Then re-run `closure:update` to sync.

**Automatic** — set `CLOSURE_ENGINE_ENABLED=true`; `ClosureSchedulerService`
runs sync + reopen-stale every `CLOSURE_ENGINE_INTERVAL_MS` (default 30 min).

## Extending

- **New field**: add it to `SCHOOL_FIELDS` / `HS_FIELDS` in _both_
  `seed-closure-targets.ts` and `closure-scheduler.service.ts` (keep them in
  sync). Next `closure:update` enqueues a target per entity.
- **New entity type** (e.g. AdmissionCase): add a block to `seed-closure-targets.ts`
  - `syncQueue()`. The plan's full scope grows HighSchool 165→2800 and
    AdmissionCase →5000 — once imported, `closure:update` auto-enqueues them.
- **Engine modifier** consuming a newly-closed field: change
  `counselor-modifiers.ts` behind the Engine Safety Protocol (snapshot/compare).

## Compliance

- ADR-0020: cohort priors / feeder signals stay behind disabled feature flags
  (`prediction-cohort-priors`, `prediction-feeder-signals`) — research-only,
  not consumed by the served engine. See `docs/adr/0020-addendum-research-pipeline.md`.
- Every CLOSED value carries provenance. UNAVAILABLE carries the verification note.
