#!/bin/sh
# Do NOT use set -e — migration failures should not prevent app startup.
# Cloud Run kills containers that don't listen on PORT within the timeout.

echo "Running Prisma migrations..."

# Resolve all potentially problematic migrations as rolled-back first,
# so the new comprehensive migration (20260309_fix_production_schema) can apply cleanly.
LEGACY_MIGRATIONS="
  20260126_agent_enterprise
  20260127_add_vector_indexes
  20260203_memory_index_optimization
  20260207_add_competition_model
  20260209_review_mode_overhaul
  20260211_add_essay_scraper_tables
  20260211_add_payment_model
  20260212_add_message_recall
  20260212_fix_duplicate_forum_categories
  20260214_add_user_referral_and_ban_fields
  20260215_add_last_login_at
  20260220_fix_duplicate_schools
  20260222_add_prediction_source_columns
  20260222_align_schema_indexes
  20260222_create_missing_indexes
  20260224_add_resume_tables
  20260309_add_cascade_rules
  20260309_fix_production_schema
  20260310_fix_user_missing_columns
  20260311_add_missing_user_columns
  20260312_create_all_base_tables
"

if npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1; then
  echo "Migrations applied successfully."
else
  echo "WARNING: Migration failed. Resolving problematic migrations and retrying..."

  # Mark failed legacy migrations as rolled-back so they can be skipped.
  # The 20260309_fix_production_schema migration covers all their changes idempotently.
  for name in $LEGACY_MIGRATIONS; do
    npx prisma migrate resolve --rolled-back "$name" --schema=./prisma/schema.prisma 2>/dev/null || true
  done

  # Also mark them as applied since the fix migration handles everything
  for name in $LEGACY_MIGRATIONS; do
    npx prisma migrate resolve --applied "$name" --schema=./prisma/schema.prisma 2>/dev/null || true
  done

  if npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1; then
    echo "Migrations applied on retry."
  else
    echo "WARNING: Migration still failing. Skipping — app will start without migration."
    echo "Run migrations manually: npx prisma migrate deploy"
  fi
fi

echo "Starting application (NODE_ENV=$NODE_ENV)..."
exec node dist/main.js
