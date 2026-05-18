#!/bin/sh
set -e

echo "=== Prisma Migrate Deploy ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Show current migration status (informational, non-blocking)
npx prisma migrate status --schema=./prisma/schema.prisma 2>&1 || true

# Apply pending migrations (exits non-zero on failure)
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "=== Migration Complete ==="

# Apply the closure-v2 prediction-closure seed payload.
# Idempotent + additive: only writes fields present in the payload, merges
# closure-v2 provenance, never deletes. Compiled to JS at build time.
# Fail-soft: a seed hiccup must not abort an otherwise-healthy code deploy —
# the next deploy retries (idempotent). Failures surface as a loud WARNING.
echo "=== Prediction Closure Seed ==="
if [ -f ./prisma/seeds/seed-prediction-closure.js ]; then
  node ./prisma/seeds/seed-prediction-closure.js \
    || echo "WARNING: prediction-closure seed failed — non-fatal, will retry on next deploy"
else
  echo "prediction-closure seed script not found, skipping"
fi
echo "=== Closure Seed Complete ==="
