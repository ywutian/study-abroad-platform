#!/bin/sh
# Do NOT use set -e — migration failures should not prevent app startup.
# Cloud Run kills containers that don't listen on PORT within the timeout.

echo "Running Prisma migrations..."
if npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1; then
  echo "Migrations applied successfully."
else
  echo "WARNING: Migration failed (likely connection exhaustion or already applied)."
  echo "Attempting resolve + retry..."
  for name in 20260127_add_vector_indexes 20260126_agent_enterprise 20260207_add_competition_model 20260209_review_mode_overhaul 20260211_add_essay_scraper_tables 20260211_add_payment_model 20260212_add_message_recall 20260212_fix_duplicate_forum_categories 20260214_add_user_referral_and_ban_fields 20260215_add_last_login_at; do
    npx prisma migrate resolve --rolled-back "$name" --schema=./prisma/schema.prisma 2>/dev/null || true
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
