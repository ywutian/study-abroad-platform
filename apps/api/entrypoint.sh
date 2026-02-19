#!/bin/sh
set -e

echo "Running Prisma migrations..."
if ! npx prisma migrate deploy --schema=./prisma/schema.prisma; then
  echo "ERROR: Database migration failed. Aborting startup."
  exit 1
fi

echo "Starting application (NODE_ENV=$NODE_ENV)..."
exec node dist/main.js
