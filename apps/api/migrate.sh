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
# JSON / TS payloads). Each step is fully idempotent (upsert / skip-if-exists).
#
# Default is fail-soft: a hiccup must not abort an otherwise-healthy code
# deploy — the next deploy retries. Failures surface as a loud WARNING line.
#
# Exception — SEED_FAIL_HARD_LABELS. These are the user-visible empty-page
# seeds (exam calendar, forum chips, Tindermatch pools, competition editions,
# testingPolicy). A throw or a missing .js used to print WARNING and leave
# the Cloud Run job green. They now fail the migrate job (exit 1). Do NOT
# dump the other ~20 seeds into this list — rankings scrapers and similar
# are still intentionally non-fatal.
#
# Order mirrors seed-orchestrator.ts so dev / staging / prod all behave
# the same. `prisma/seed.ts` itself (which contains demo / destructive
# seedTeamData) is intentionally NOT invoked here.
#
# Result assertions (counts, exit 42) run after every seed — see
# prisma/check-seed-result-assertions.ts. Fail-hard on the process is not
# enough: a seed that no-ops (unmatched schools, unknown abbreviations)
# still exits 0.
# ============================================================================

# Space-padded so `case` can match whole labels. Keep in sync with
# FAIL_HARD_SEED_LABELS in prisma/check-seed-result-assertions.ts
# (that file's --self-check / default mode verifies this list).
SEED_FAIL_HARD_LABELS=" testing-policy global-events competitions competition-data match-pools forum-communities "

seed_is_fail_hard() {
  case "$SEED_FAIL_HARD_LABELS" in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

run_seed() {
  local label="$1"
  local script="$2"
  shift 2
  echo "=== Seed: $label ==="
  if [ -f "$script" ]; then
    if node "$script" "$@"; then
      :
    else
      if seed_is_fail_hard "$label"; then
        echo "ERROR: $label seed failed — failing migrate so deploy does not go green on empty user-visible data."
        exit 1
      fi
      echo "WARNING: $label seed failed — non-fatal, will retry on next deploy"
    fi
  else
    if seed_is_fail_hard "$label"; then
      echo "ERROR: $script not found — $label is a fail-hard seed. Add it to the Dockerfile tsc compile list (check-seed-pipeline-parity)."
      exit 1
    fi
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
run_seed "testing-policy" ./prisma/seed-testing-policy-2026-07-25.js

# 18. Standardized-test calendar — GlobalEvent rows (SAT / ACT / AP dates
#     read off the official College Board / ACT pages). GlobalEvent had no
#     seed at all before this, which is why /timeline rendered an empty page
#     and the dashboard's event stream had nothing to subscribe to.
#     Idempotent upsert on the `slug` unique key.
run_seed "global-events" ./prisma/seeds/upsert-global-events.js

# 19. Team / Tindermatch reference data. All three were dev-seed-only, so prod
#     ran the whole recruitment surface off whatever partial Competition rows
#     happened to be there: 3 competition editions, and the one match pool that
#     existed served `entries: []`. Order matters — the last two resolve
#     competitions by abbreviation and both no-op (loudly) without step 19a.
#     19a: ~112 reference Competition rows (upsert on abbreviation).
run_seed "competitions" ./prisma/seed-competitions.js
#     19b: real, web-verified CompetitionEdition schedules + tracks. Every
#          record carries a sourceUrl; the script rejects any that doesn't.
#          Refreshed by the /competition-data-update skill, staleness-tracked
#          by scripts/check-seed-data-freshness.ts.
run_seed "competition-data" ./prisma/seeds/upsert-competition-data.js \
  ./prisma/seeds/competition-schedules-2026-2027.json
#     19c: the 9 public MatchPools + their ~62 official-competition entries.
#          Prod-safe slice of seed-teams.ts — see that file's header.
run_seed "match-pools" ./prisma/seed-match-pools.js

# 20. Forum communities — the 11 official ForumCommunity rows. Dev-seed-only
#     until now, so production had exactly ONE community: `debate`, created by
#     a user posting. That also starved F2's cold-start starter chips, which
#     are dealt from this table. Upserts on `slug` (so the existing `debate`
#     row is promoted to official rather than duplicated), backfills only posts
#     whose communityId is NULL, and recomputes post/follower counts from the
#     rows themselves. Display names are localised in the web client, not here
#     — `name` stays canonical English because create-post writes it into
#     `post.tags`. See apps/web/.../forum/_components/use-community-name.ts.
run_seed "forum-communities" ./prisma/seed-forum-communities.js

echo "=== All Seed Steps Complete ==="

# ----------------------------------------------------------------------------
# Result assertions. The gallery floor used to live inline here (exit 42).
# It is now one of several counts in prisma/check-seed-result-assertions.js
# — GlobalEvent future dates, official ForumCommunity, match-pool entries,
# CompetitionEdition, testingPolicy REQUIRED — same exit 42 on a miss.
#
# The compiled .js is produced by the Dockerfile tsc pass 2. Local runs that
# only have the .ts (no image build) fall back to tsx.
# ----------------------------------------------------------------------------
echo "=== Sanity check: seed result assertions ==="
if [ -f ./prisma/check-seed-result-assertions.js ]; then
  node ./prisma/check-seed-result-assertions.js --db
elif [ -f ./prisma/check-seed-result-assertions.ts ]; then
  npx tsx ./prisma/check-seed-result-assertions.ts --db
else
  echo "ERROR: prisma/check-seed-result-assertions.js missing from the image."
  echo "       Add it to the Dockerfile tsc compile list."
  exit 42
fi
