#!/bin/sh

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "Warning: Migration failed, continuing startup..."

echo "ENV check: VAULT_ENCRYPTION_KEY length = $(echo -n "$VAULT_ENCRYPTION_KEY" | wc -c)"
echo "ENV check: NODE_ENV = $NODE_ENV"
echo "Starting application..."
exec node dist/main.js
