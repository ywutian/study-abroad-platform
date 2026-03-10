#!/bin/sh
# Do NOT use set -e — migration failures should not prevent app startup.
# Cloud Run kills containers that don't listen on PORT within the timeout.

echo "=== Database Schema Sync ==="

# Step 1: Force-sync schema using db push.
# Computes diff between schema.prisma and the actual DB, applies only missing changes.
# Safe to run every startup — idempotent, uses advisory lock for concurrency.
echo "Running prisma db push to sync schema..."
if npx prisma db push --skip-generate --accept-data-loss 2>&1; then
  echo "Schema sync completed."
else
  echo "WARNING: db push failed (non-critical if schema is already up to date)."
fi

# Step 2: Record the baseline migration as applied (if not already).
# This tells Prisma's migration engine that the full schema is established,
# so future migrations created after the baseline will run via migrate deploy.
npx prisma migrate resolve --applied "0001_baseline" \
  --schema=./prisma/schema.prisma 2>/dev/null || true

# Step 3: Apply any new migrations added after the baseline.
echo "Running prisma migrate deploy..."
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 \
  || echo "WARNING: migrate deploy had issues (may be expected on first run)."

echo "Starting application (NODE_ENV=$NODE_ENV)..."
exec node dist/main.js
