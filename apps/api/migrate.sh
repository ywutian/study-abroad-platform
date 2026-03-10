#!/bin/sh
set -e

echo "=== Prisma Migrate Deploy ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Show current migration status (informational, non-blocking)
npx prisma migrate status --schema=./prisma/schema.prisma 2>&1 || true

# Apply pending migrations (exits non-zero on failure)
npx prisma migrate deploy --schema=./prisma/schema.prisma

echo "=== Migration Complete ==="
