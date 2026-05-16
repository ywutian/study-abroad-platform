# Prisma Seeds

One-off + recurring data seeds. Distinct from `prisma/seed.ts` which is the project-wide initial dataset.

## prediction-closure

**What it is**: a snapshot of the 7 prediction-critical fields + provenance for all 240 US schools, captured after the 2026-05-16 closure pipeline run. Replays cleanly against any DB.

**Why**: the closure pipeline (`apps/api/scripts/check-closure.ts` + `apps/api/scripts/closure-agents/`) ran ~227 per-school updates over Tavily + 3 Claude subagents to bring every school's prediction-critical fields to `OFFICIAL` (or `UNAVAILABLE`-terminal) provenance tier. That work happened in dev DB; this seed ports the result to staging / production deterministically.

### Files

| File                                      | Purpose                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| `seed-prediction-closure.ts`              | Runner. Reads payload, UPSERTs into target DB. Idempotent.                            |
| `build-prediction-closure-payload.ts`     | Dumper. Reads current DB and writes a new payload JSON. Run after each closure cycle. |
| `data/prediction-closure-YYYY-MM-DD.json` | Payload. 240 entries, ~1.8 MB. Field values + slim provenance per school.             |

### Match strategy across environments

Schools are matched (in order):

1. `scorecardId` (federal, stable across DBs) — ~95% hit rate
2. `ipedsId` (federal, stable across DBs) — secondary fallback
3. Exact `name` (last resort)

If a school is in the payload but not in the target DB, it's reported as `unmatched` and exit code is 2 — no partial writes.

### What the seed touches

Per matched school, the seed UPSERTs:

- `acceptanceRate`, `sat25`, `sat75`, `intlAcceptanceRate`, `oosAcceptanceRate`, `edAcceptanceRate`, `eaAcceptanceRate`
- `hasEarlyDecision` (corrected ~80 schools where it was stale)
- `institutionType` (only ArtCenter College of Design reclass to `ART_DESIGN`)
- `dataReviewStatus` (3 duplicate rows set to `REJECTED`)
- `metadata.provenance.<field>` for the 7 fields (deep-merged with existing)
- `lastDataReviewAt = now()`

It does NOT touch: any other column, other schools, other provenance fields.

### Usage

**Build a new payload from current DB** (run after each closure cycle):

```bash
pnpm --filter api db:seed:prediction-closure:build
```

Writes a new `data/prediction-closure-YYYY-MM-DD.json` with today's date.

**Dry-run against target DB** (preview changes, no writes):

```bash
DATABASE_URL=postgres://... pnpm --filter api db:seed:prediction-closure:dry
```

**Apply to target DB**:

```bash
DATABASE_URL=postgres://... pnpm --filter api db:seed:prediction-closure
```

The runner uses the **latest** payload JSON by default. To pin a specific cycle:

```bash
tsx prisma/seeds/seed-prediction-closure.ts --file=prisma/seeds/data/prediction-closure-2026-05-16.json
```

### Production deploy workflow

1. **Build** payload from staging DB after closure cycle (`db:seed:prediction-closure:build`)
2. **Commit** the new `data/prediction-closure-*.json` to the branch
3. Open PR → review JSON diff (field-level changes are visible in diff)
4. After merge:
   - **Staging**: run `db:seed:prediction-closure:dry` in CI → review log → run `db:seed:prediction-closure` if clean
   - **Production**: same gate, ideally with manual approval step

### Idempotency

Safe to re-run. The runner:

- Skips schools where all fields + provenance already match (counts as `unchanged`)
- Only updates schools with differences
- Returns exit 0 on success, 2 on unmatched entries, 1 on fatal error

A second run immediately after the first will report `Unchanged: 240`.

### Related artifacts

- Closure pipeline: `apps/api/scripts/closure-agents/` (227 per-school update scripts kept as audit trail)
- Final report: `docs/PREDICTION_CLOSURE_FINAL_REPORT_2026-05-16.md`
- Closure check: `apps/api/scripts/check-closure.ts` (`pnpm --filter api predict:check-closure`)
- ADR-0020 (no per-sample calibration): all values trace to official CDS / Scorecard / IPEDS — never user-uploaded outcomes
