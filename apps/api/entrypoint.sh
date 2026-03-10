#!/bin/sh
echo "Starting application (NODE_ENV=$NODE_ENV)..."
exec node dist/main.js
