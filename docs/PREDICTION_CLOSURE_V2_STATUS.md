# Closure v2 — Live Status & Resume Recipe

- Updated: 2026-05-17
- Branch: `closure-v2-foundation` · PR [#224](https://github.com/ywutian/study-abroad-platform/pull/224)
- Worktree used for build: `/tmp/closure-v2-work` (the assigned worktree)
- Plan of record: `.claude/plans/plan-v2-compiled-puddle.md`

## Where the engine stands

**Continuous Closure Engine is built and running on real data.**

- `ClosureTarget` work-queue table — **7293 targets** (comprehensive scope:
  240 schools × 26 fields + 165 HighSchools × 7 fields).
- Closure: **100.0%** (7293/7293 — 6298 CLOSED + 995 UNAVAILABLE; **0 PENDING,
  0 FAILED**). 10 collection waves, 45 Claude subagents. **MILESTONE: every
  ClosureTarget in the School+HighSchool scope is terminal.**
- All 33 tracked fields fully resolved (CLOSED with provenance, or UNAVAILABLE
  verified-not-published per methodology #1). Zero fabrication across all waves.
- FAILED cleanup done: Harvard transfer 0.71% + USM 95.36% were real CDS D2
  values wrongly range-gated → corrected to CLOSED; 15 CDS-auth-walled/unpublished
  → reclassified UNAVAILABLE (verified not publicly accessible = terminal).
- **Next**: (a) the cron-driven Tier-1 ClosureScheduler (plan Phase 0.5) for
  hands-off freshness re-checks; (b) full-platform scope expansion — grow
  HighSchool 165→2800 (NCES + CN HS import), AdmissionCase →5000 (case
  scraping); seeder cron auto-enqueues the new rows.
- The earlier "56.1%" measured only the 11 hardest fields; the 83.9% is the
  honest comprehensive figure (many School fields — acceptanceRate, SAT bands,
  descriptions, enrolment — were already populated pre-closure-v2).
- **1095 PENDING + 82 FAILED = 1177 targets remain** for the engine.
- Structural findings (engine self-learned, applied to batch selection):
  - `ed2AcceptanceRate` not derivable — CDS C21 never separates ED II → ~all UNAVAILABLE.
  - `gpaDistribution` (CDS C11) commonly blank even at research unis → regional/
    state universities are the productive targets.
  - ED/EA round rates: publics largely have no ED & publish no EA-round rate → UNAVAILABLE.
  - `needBlindInternational`: most schools never publish an explicit intl
    admission-review policy → many legitimately FAILED/UNAVAILABLE.
  - `yieldRate`: fully tractable — every batch ~100% CLOSED from CDS C2 / IPEDS.
- Known cleanup item: duplicate School rows (UMN Twin Cities, Penn State,
  Binghamton) — flagged by multiple agents; dedupe pass needed.
- FAILED-after-verification targets should be reclassified UNAVAILABLE.
- Collection wave 1 — 4 Claude subagents, real WebSearch+WebFetch+parse:
  - needBlindInternational: 8 resolved (cited official sources), 17 honest null
  - edAcceptanceRate: 30 UNAVAILABLE (verified no binding ED / no published rate)
  - eaAcceptanceRate: Harvard 8.74% + Yale 9.02% (REA); 28 UNAVAILABLE
  - yieldRate: 30/30 CLOSED (CDS/IR-sourced)
- Collection wave 2 — 2 more subagents:
  - needBlindInternational b2: 14 resolved (Georgetown/USC need-blind; 12 need-aware), 16 FAILED
  - gpaDistribution probe: 25 UNAVAILABLE (LACs/conservatories verified to leave CDS C11 blank)
- **Lesson learned**: gpaDistribution / ED / EA batches must target large public &
  private _research universities_ — selective LACs & conservatories systematically
  don't publish C11 or round-specific rates. Bias future batch selection accordingly.

Per-field closure: act25/75 100% · transferAcceptanceRate 85% · oosAcceptanceRate 81% ·
gpaDistribution 73% · edAcceptanceRate 40% · eaAcceptanceRate 17% · needBlindInternational 14% ·
yieldRate 12% · ed2AcceptanceRate / hasRestrictiveEa 0%.

## Commits on this branch (beyond PR #224's foundation)

1. closure-v2 research-pipeline feature flags
2. ClosureTarget schema + migration + seeder
3. closure-status reporter
4. seeder re-runnable as sync
5. closure wave 1 — real collected data (4 collector scripts)

## How the engine works

```
ClosureTarget (PENDING) --priority desc--> dispatch Claude subagent (batch ~30)
  -> real WebSearch + WebFetch + Claude parse (CDS PDF / newsroom / CN pages)
  -> 5 quality gates; unverifiable -> null + FAILED/UNAVAILABLE (never fabricate)
  -> write School field + metadata.provenance + ClosureTarget status
  -> seed-closure-targets.ts (re-run = sync) -> closure% rises monotonically
repeat until all fields >= threshold
```

## RESUME RECIPE — how to continue

```bash
cd /tmp/closure-v2-work/apps/api          # worktree on closure-v2-foundation
pnpm exec tsx scripts/closure-agents/closure-status.ts   # see current closure %
```

Then dispatch the next collection wave — one Claude subagent per (field, batch),
each with the prompt pattern in `collect-*.ts` headers:

1. claim a batch: `SELECT ... FROM "ClosureTarget" WHERE status='PENDING' AND field='<F>' ORDER BY priority DESC LIMIT 30`
2. real WebSearch + WebFetch per school; Claude parses
3. write School field + `metadata.provenance.<F>` (merge, never clobber) + update `ClosureTarget`
4. re-run `seed-closure-targets.ts` to sync, then `closure-status.ts`

Subagents run in `/Users/yitianwu/Documents/study-abroad-platform` (main repo —
has node_modules + DB); `ClosureTarget`/new fields are updated there via raw SQL
since that checkout's Prisma client predates them.

## Open refinements (apply when convenient)

- **Seeder eligibility**: only create `edAcceptanceRate` targets where
  `hasEarlyDecision=true`, `eaAcceptanceRate` where `hasEarlyAction=true`, so
  schools without those rounds start UNAVAILABLE instead of consuming a tick.
- **Priority tuning**: for ED/EA, rank-weight favoured elite/art schools that
  don't publish round rates — bias ED/EA batches toward mid-tier privates.
- **ClosureScheduler service** (BullMQ): wrap the dispatch loop as a repeatable
  job so the engine ticks without a session — plan §"持续执行闭环引擎".
- **Admin dashboard** `/admin/closure`: surface `closure-status --json`.
- **CDS-derived fields** (gpaDistribution remainder, ed2AcceptanceRate,
  hasRestrictiveEa): need CDS-PDF extraction subagents (Wave 6.1 orchestrator).

## Hard rules (never violate)

- Never fabricate a value. No authoritative source → null + FAILED/UNAVAILABLE.
- Every written value carries `sourceUrl` + `fetchedAt` + `verifiedBy` + `confidence`.
- cohort priors / feeder signals stay flag-off (ADR-0020 addendum).
- Engine modifier changes go through the Engine Safety Protocol.
