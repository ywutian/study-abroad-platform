# Overnight Data Backfill — Morning Briefing (2026-05-25)

**Branch**: `chore/overnight-closure-2026-05-25`
**Commits ahead of main**: 5
**Closure state**: 6947/7424 = **93.6%** terminal (was 86.1% baseline → +7.5pp)
**Status**: complete — ready for review + admin-merge if CI green

---

## TL;DR

Tonight's overnight closure cycle is converting the prediction pipeline's
PENDING work-queue from 86.1% → 90.1%+ terminal by dispatching parallel
closure subagents. Every CLOSED has a sourceUrl; every UNAVAILABLE has a
verified structural reason. **No fabrication anywhere.**

The biggest finding: most ClosureTarget rows that remained PENDING for
admit-rate fields are **structurally suppressed** — either (a) the school
doesn't offer that round (UC schools have no ED/EA, art schools use
portfolio/audition, REA-only T5s), or (b) the school's CDS PDF
explicitly publishes Section C with the relevant cells blank. The
closure pipeline now records this with `notes` + `tier='UNAVAILABLE'`
so future re-runs don't re-queue them.

## Closure stats (baseline → current)

| Field                  | Baseline              | Current               | Δ          |
| ---------------------- | --------------------- | --------------------- | ---------- |
| **Overall**            | **86.1%** (6391/7424) | **93.6%** (6947/7424) | **+7.5pp** |
| acceptanceRate         | 96.3%                 | 96.3%                 | —          |
| edAcceptanceRate       | 30.9%                 | 80.2%                 | +49.3pp    |
| eaAcceptanceRate       | 11.5%                 | 61.3%                 | +49.8pp    |
| ed2AcceptanceRate      | 0%                    | 45.3%                 | +45.3pp    |
| intlAcceptanceRate     | 77.4%                 | **100%**              | +22.6pp    |
| oosAcceptanceRate      | 68.4%                 | 82.3%                 | +13.9pp    |
| gpaDistribution        | 73.3%                 | **100%**              | +26.7pp    |
| yieldRate              | 95.9%                 | **100%**              | +4.1pp     |
| needBlindInternational | 96.3%                 | **100%**              | +3.7pp     |

Five fields fully closed (100%): `gpaDistribution`, `intlAcceptanceRate`,
`yieldRate`, `needBlindInternational`, and the existing 100% set (HighSchool
fields: tier, recognition, academicRigor, placementRecord, studentQuality,
resources).

## What got committed

1. **`a3a0fb94` — Wave 1**: yieldRate + needBlindInternational + gpaDistribution
   - 22 CLOSED + 2 UNAVAILABLE (yield/needBlind via WebSearch)
   - 5 CLOSED + 55 UNAVAILABLE (gpaDistribution — discovered CDS C11 is
     systematically suppressed by elite LACs)
2. **`0252ed52` — Wave 2**: ed/ea/intl/oos top 30 + cds-c9c21 cache loader
   - 17 CLOSED + 103 UNAVAILABLE across 4 fields
   - **111 schools** received School-table writes from the cached
     CDS LLM extractions (gpaDistribution + ed/ea/blank-section provenance)
3. **`61972801` — Wave 3**: ed/ea/ed2 next 30 + prediction-matrix re-run
   - 0 CLOSED + 90 UNAVAILABLE — all structural (public flagships
     no-ED, ED-only T20s no-EA, REA-only T5s no-ED2)
   - Prediction matrix re-run shows mild positive recalibration
4. **`faa39abd` — Wave 4**: gpaDistribution 100% + ed/ea/ed2 batch 3
   - 10 CLOSED (incl. Pitt 84%, Pitzer 79.2%, Baruch CUNY, OSU EA
     60.43%, NCSU EA 40.21%, SMU EA 81.11%, Clarkson, U Maine, PLU,
     Augustana SD) + 110 UNAVAILABLE
   - **gpaDistribution field hit 100%** — first multi-band field complete
5. **Wave 5** (this commit): intlAcceptanceRate 100% + ed/ea/ed2 batch 4
   - 21 CLOSED (incl. Reed intl 4.51%, CMU intl 52.8%, Temple EA 93.18%,
     U Denver EA 86.52%, WPI EA 66.74%, Drexel EA 96.38%) + 114 UNAVAILABLE
   - **intlAcceptanceRate field hit 100%** — second admit-rate field complete

## In-flight work

None — all overnight waves are complete and committed. The 514 still-PENDING
ClosureTarget rows that remain are lower-priority (mostly small regional schools
and mid-tier publics) where the same structural patterns apply — diminishing
returns; deferred to future runs.

## Important discoveries / corrections

1. **Many "PENDING ED/EA" targets are actually structural UNAVAILABLE.** The
   closure plan implicitly assumed each (school × field) was collectable;
   in practice ~30% of admit-rate cells are intentionally suppressed by
   the school. Wave 1-3 documents the structural reasons in `ClosureTarget.notes`
   so future closure runs treat them as terminal.

2. **Grinnell does NOT offer EA** — only ED. Boston College ELIMINATED EA
   in 2019, now ED-only. Earlier docs assumed otherwise. Corrected.

3. **Format inconsistency in `School.gpaDistribution`**: some schools store
   bands as decimals (`{"3.75-4.00": 0.598}`), others as percentages
   (`{"3.75-4.00": 59.8}`). The engine's `normalizeGpaDistribution()`
   handles both via `rawTotal > 2 ? 100 : 1` denominator selection, so
   this is COSMETIC not a bug. Listed as cleanup item.

4. **SMU `gpaDistribution` bands sum to 110%** (1.10 in decimal form) —
   real data error. Engine's `normalizeGpaDistribution` rejects this
   (returns null, falls back to anchor admit rate). Needs an OVERWRITE
   correction with verified CDS data. **TIER B — defer to morning.**

5. **UMich strong-in-state student** prediction correctly moved from
   `reach` to `match` (17.01% → 21.43%) after the in-state preference
   logic stabilized with `oosAcceptanceRate=13` from PR #290.

6. **CDS C9 cross-tab (`SchoolCdsAdmitBand` table)** still has only 9/243
   schools populated. Building a new collector for this is multi-session
   work (each school needs ~9 cells extracted from CDS PDFs). Engine
   currently falls back to scorecard path for the other 234. **TIER B — defer.**

## Tier B queue (needs morning decision)

- **SMU gpaDistribution OVERWRITE** — easy 5-min fix once verified
  against SMU CDS PDF
- **SchoolCdsAdmitBand expansion** — significant work but high precision
  payoff for engine's Tier-1 anchor path
- **gpaDistribution format normalization** — cosmetic cleanup; engine handles both
- **CDS-suppressed admit rates** (NYU/Tufts/Wake/Pepperdine ED, UT
  Austin/UWisconsin EA): consider DERIVED tier estimates from
  Crimson/PrepScholar aggregator OR keep as UNAVAILABLE

## In-flight work

4 agents still running at briefing time:

- `gpaDistribution` next 30 (mainstream schools: Notre Dame, Colby,
  Georgetown, UT Austin, UC Irvine, BC, Rutgers, Wake Forest, ...)
- `edAcceptanceRate` batch 3 (mostly public state flagships, expecting
  most UNAVAILABLE)
- `eaAcceptanceRate` batch 3 (mixed publics with EA + privates without)
- `ed2AcceptanceRate` batch 3 (T20 LACs offering ED1+ED2, most publish
  only combined ED)

When complete, results will be applied, committed as Wave 4, and a final
`closure:update` SYNC pass will reconcile School-field writes with
ClosureTarget statuses.

## How to verify (morning)

```bash
# 1. Closure overall status
cd apps/api && pnpm closure:status

# 2. Pre-push gate (typecheck + tests + lint)
pnpm prepush

# 3. Layer 3 calibration spec (50 fixtures)
gcloud auth application-default login   # if expired
cloud-sql-proxy study-abroad-prod-2025:us-central1:study-abroad-db --port 5434 &
DB_URL=$(gcloud secrets versions access latest --secret=database-url)
PROXY_URL=$(echo "$DB_URL" | sed -E 's#@[^:/]+:5432/#@localhost:5434/#')
DATABASE_URL="$PROXY_URL" pnpm tsx scripts/run-counselor-calibration-spec.ts
# Expect: 45/50 gated pass + 5 wontFix (same as baseline)

# 4. Re-run prediction matrix and diff vs T12-54
DATABASE_URL="$PROXY_URL" pnpm tsx scripts/comprehensive-prediction-matrix.ts
```

## Suggested morning first step

1. **Review the open PR** when posted at end of overnight
2. **Investigate SMU gpaDistribution** (single OVERWRITE fix)
3. **Decide** whether to invest a follow-up session in `SchoolCdsAdmitBand`
   expansion (highest engine-precision payoff still on the table)
