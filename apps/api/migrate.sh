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

echo "=== All Seed Steps Complete ==="
