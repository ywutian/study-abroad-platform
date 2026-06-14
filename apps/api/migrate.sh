#!/bin/sh
set -e

echo "=== Prisma Migrate Deploy ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Show current migration status (informational, non-blocking)
npx prisma migrate status --schema=./prisma/schema.prisma 2>&1 || true

# Apply pending migrations (exits non-zero on failure)
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "=== Migration Complete ==="

# ============================================================================
# Data-only seed steps from prisma/seed-orchestrator.ts (committed offline
# JSON / TS payloads). Each step is fully idempotent (upsert / skip-if-exists)
# and fail-soft: a hiccup must not abort an otherwise-healthy code deploy —
# the next deploy retries. Failures surface as a loud WARNING line.
#
# Order mirrors seed-orchestrator.ts so dev / staging / prod all behave
# the same. `prisma/seed.ts` itself (which contains demo / destructive
# seedTeamData) is intentionally NOT invoked here.
# ============================================================================

run_seed() {
  local label="$1"
  local script="$2"
  shift 2
  echo "=== Seed: $label ==="
  if [ -f "$script" ]; then
    node "$script" "$@" \
      || echo "WARNING: $label seed failed — non-fatal, will retry on next deploy"
  else
    echo "WARNING: $script not found — skipping $label"
  fi
}

# 1. Prediction closure — School / HighSchool CDS fields (closure-v2 payload).
run_seed "prediction-closure" ./prisma/seeds/seed-prediction-closure.js

# 2. Essay prompts (top-50, EssayPrompt rows).
run_seed "essay-prompts-v2" ./prisma/seed-essay-prompts-v2.js

# 3. Top-school admission cases (~933 AdmissionCase rows from top50-cases.json).
run_seed "top-cases" ./prisma/seeds/load-top-cases.js

# 4. Public-archive essay gallery (~185 AdmissionCase rows w/ essayContent —
#    JHU / Hamilton / MIT / Harvard / PrepMaven / CollegeVine / Stanford /
#    USC / CollegeEssayGuy / Shemmassian).
run_seed "essay-harvest" ./prisma/seeds/essay-harvest/import-essays.js

# 5. CDS admit bands (SchoolCdsAdmitBand rows from cds-admit-bands.json).
run_seed "cds-admit-bands" ./prisma/seeds/load-cds-bands.js \
  --file ./prisma/seeds/data/cds-admit-bands.json --apply

# 6. School programs — broad-discipline SchoolProgram fallback rows.
run_seed "school-programs" ./prisma/seeds/seed-school-programs.js --all

# 7. High schools (~150 reference HighSchool rows).
run_seed "high-schools" ./prisma/seed-high-schools.js

# 8. Activity templates (ActivityTemplate rows).
run_seed "activity-templates" ./prisma/seed-activity-templates.js

# 9. Closure targets — scan DB to (re-)seed ClosureTarget rows.
run_seed "closure-targets" ./prisma/seeds/closure-agents/seed-closure-targets.js

# 10. World rankings — QS / THE / ARWU / FORBES / WSJ (SchoolRanking).
run_seed "school-rankings" ./prisma/seeds/closure-agents/collect-school-rankings.js

# 11. US_NEWS ranking-list backfill (SchoolRanking).
run_seed "ranking-lists-backfill" ./prisma/seeds/backfill-school-ranking-lists.js

# 12. Assessment question banks — MBTI / HOLLAND / STRENGTH (Assessment).
run_seed "assessment-banks" ./prisma/seed-assessment.js

# 13. M3 Bayesian engine priors — per-school hook % (legacy/athlete/first-gen)
#     on School table. Idempotent updateMany. Used by dimLegacy / dimAthlete.
run_seed "m3-hook-stats" ./prisma/seed-hook-stats.js

# 14. M3 Bayesian engine global baselines — GlobalAdmitBaseline table
#     (P(category | apply) priors used as Bayesian denominators).
#     Idempotent upsert on unique metric column.
run_seed "m3-global-baselines" ./prisma/seed-global-admit-baselines.js

# 15. hasEarlyAction / hasEarlyDecision2 boolean backfill — fills the schema
#     columns added in migration 20260526000000_add_has_ea_ed2 (PR #295).
#     Without this, fresh DB / restored backups leave both columns NULL,
#     which the engine reads as falsy → ED-offering schools silently return
#     ED ≡ RD (Layer 3 fixtures 105/107/108/109 + 111 break). Script is
#     idempotent (skips if value already set), so safe to re-run.
run_seed "ea-ed2-backfill" ./prisma/seeds/backfill-has-ea-ed2.js --apply

# 16. Data-integrity corrections — null only SCALE errors (intl <1% / >100%,
#     early-round <1%) so the counselor falls back instead of using a corrupt
#     multiplier. MUST run LAST (after the closure overlay re-applies raw values).
#     intl >= overall is KEPT (verified real revenue-public rates, not leaks).
#     Enforced by scripts/audit-prediction-data-integrity.ts (CI prediction gate).
run_seed "intl-rate-correction" ./prisma/seed-intl-rate-correction.js
run_seed "round-rate-correction" ./prisma/seed-round-rate-correction.js

# 17. Published-source data corrections — set REAL verified rates (unlike step 16
#     which only NULLs scale errors). MUST run after step 1 (closure overlay) so
#     the overlay's raw values don't re-override these; mirrors seed.ts order
#     (intl→round→audit→instate). Without these two, prod served the WRONG anchor
#     for ~25 schools (audit-corrections, e.g. CU Boulder 18.47%→80.5%) and a NULL
#     inStateAcceptanceRate for every public (geo modifier's PRIMARY input → prod
#     silently fell back to the state-map proxy). seed.ts/CI applied them; prod did
#     not — closing that seed-fidelity gap. Parity enforced by
#     scripts/check-seed-pipeline-parity.ts (each .js here needs a compiled .ts).
run_seed "audit-corrections" ./prisma/seed-audit-corrections-2026-05-31.js
run_seed "instate-rates" ./prisma/seed-instate-rate-2026-05-31.js

echo "=== All Seed Steps Complete ==="

# ----------------------------------------------------------------------------
# Final sanity check: count essay-gallery-visible cases. If the essay-harvest
# step truly inserted, this should be >= 150. If it's still in the single
# digits (the original demo seed set), we want the migrate-job to EXIT
# NON-ZERO so the workflow surfaces a clear failure rather than the deploy
# silently proceeding — even though the underlying Cloud Run job stdout is
# not readable by the deploy SA (which lacks logging.viewer).
# ----------------------------------------------------------------------------
echo "=== Sanity check: gallery-visible admission cases ==="
GALLERY_COUNT=$(node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const n = await p.admissionCase.count({where:{
    visibility:{in:['PUBLIC','ANONYMOUS']},
    essayContent:{not:null},
    reviewStatus:{in:['AUTO_APPROVED','APPROVED']},
  }});
  console.log(n);
  await p.\$disconnect();
})().catch(e=>{console.error('count failed:',e.message);process.exit(1)});
" 2>&1 | tail -n1)
echo "Gallery-visible admission cases: ${GALLERY_COUNT}"
if [ "${GALLERY_COUNT}" -lt 50 ] 2>/dev/null; then
  echo "ERROR: gallery count ${GALLERY_COUNT} is below threshold (50)."
  echo "       The essay-harvest seed step likely failed silently."
  echo "       See above seed step output for the root cause."
  exit 42
fi
echo "✓ Gallery count OK (>= 50)."

# ----------------------------------------------------------------------------
# Sanity check: School.acceptanceRate coverage. The counselor prediction engine
# returns insufficient_data ("数据不足") for any school without a CDS band OR a
# non-null acceptanceRate. If this count collapses, the closure overlay (step 1)
# didn't populate the catalog's rates and the prediction page shows 数据不足 for
# almost every school. WARNING-only for now (does not block an otherwise-healthy
# deploy); flip to a hard exit once the catalog-rate seeding is guaranteed.
# ----------------------------------------------------------------------------
echo "=== Sanity check: schools with acceptanceRate ==="
RATE_COUNT=$(node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const total = await p.school.count();
  const rated = await p.school.count({where:{acceptanceRate:{not:null}}});
  console.log(rated + '/' + total);
  await p.\$disconnect();
})().catch(e=>{console.error('count failed:',e.message);process.exit(0)});
" 2>&1 | tail -n1)
echo "Schools with acceptanceRate: ${RATE_COUNT}"
RATED_ONLY=$(echo "${RATE_COUNT}" | cut -d/ -f1)
if [ "${RATED_ONLY}" -lt 150 ] 2>/dev/null; then
  echo "WARNING: only ${RATE_COUNT} schools have acceptanceRate (expected >= 150)."
  echo "         The prediction page will show 数据不足 for most schools — the closure"
  echo "         overlay did not populate the catalog's rates on this DB."
else
  echo "✓ acceptanceRate coverage OK (${RATE_COUNT})."
fi
