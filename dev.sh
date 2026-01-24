#!/bin/bash

# 🚀 一键启动开发环境脚本
# 功能：确保 PostgreSQL + Redis 就绪，然后启动所有应用

set -e

echo "🔍 检查基础设施..."

# 检查 PostgreSQL
pg_ready=false
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo "✅ PostgreSQL 已在运行 (端口 5432)"
  pg_ready=true
elif pg_isready -h localhost -p 5433 > /dev/null 2>&1; then
  echo "✅ PostgreSQL 已在运行 (端口 5433)"
  pg_ready=true
fi

# 检查 Redis
redis_ready=false
if redis-cli ping > /dev/null 2>&1; then
  echo "✅ Redis 已在运行 (端口 6379)"
  redis_ready=true
fi

# 如果有服务未运行，尝试通过 Docker 启动
if [ "$pg_ready" = false ] || [ "$redis_ready" = false ]; then
  if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker 未运行，且部分服务缺失！请先启动 Docker Desktop 或手动启动缺失的服务"
    [ "$pg_ready" = false ] && echo "   - PostgreSQL 未运行"
    [ "$redis_ready" = false ] && echo "   - Redis 未运行"
    exit 1
  fi

  echo ""
  echo "🐘 通过 Docker 启动缺失的服务..."

  services=""
  [ "$pg_ready" = false ] && services="$services db"
  [ "$redis_ready" = false ] && services="$services redis"

  docker-compose up -d $services 2>&1 | grep -v "WARN" || true

  if [ "$pg_ready" = false ]; then
    echo "⏳ 等待数据库就绪..."
    timeout=30
    counter=0
    until docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; do
      counter=$((counter + 1))
      if [ $counter -gt $timeout ]; then
        echo "❌ 数据库启动超时"
        exit 1
      fi
      sleep 1
    done
    echo "✅ PostgreSQL 已就绪"
  fi
fi

echo ""
echo "📦 Running database migrations..."
(cd apps/api && npx prisma migrate deploy) || echo "⚠️  Migration skipped (may already be up to date)"

echo "🌱 Seeding database..."
(cd apps/api && npx prisma db seed) || echo "⚠️  Seed skipped"

echo ""
echo "🚀 启动应用程序..."
echo "   - API: http://localhost:3006"
echo "   - Web: http://localhost:3000"
echo ""

pnpm dev
