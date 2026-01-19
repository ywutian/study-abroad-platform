#!/bin/sh

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "Warning: Migration failed, continuing startup..."

echo "Starting application..."
exec node dist/main.js
