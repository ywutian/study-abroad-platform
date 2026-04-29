#!/bin/bash

# ╔══════════════════════════════════════════════╗
# ║  Lumni — 一键启动开发环境                    ║
# ║                                              ║
# ║  用法:                                       ║
# ║    ./dev.sh          快速启动                 ║
# ║    ./dev.sh --fresh  全量启动 (migrate+seed)  ║
# ║    ./dev.sh --kill   清理本项目端口占用          ║
# ╚══════════════════════════════════════════════╝

set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ─── 从 .env 动态读取端口 ───
API_PORT=$(grep -m1 '^PORT=' apps/api/.env 2>/dev/null | cut -d= -f2 || echo "3002")
WEB_PORT=4100
REDIS_URL=$(grep -m1 '^REDIS_URL=' apps/api/.env 2>/dev/null | cut -d'"' -f2 || echo "redis://localhost:6379")
REDIS_PORT=$(echo "$REDIS_URL" | grep -oE '[0-9]+$' || echo "6379")

# 从 DATABASE_URL 解析 PG 端口
DATABASE_URL=$(grep -m1 '^DATABASE_URL=' apps/api/.env 2>/dev/null | cut -d'"' -f2 || echo "")
DB_PORT=$(echo "$DATABASE_URL" | grep -oE ':([0-9]+)/' | tr -d ':/' || echo "5432")
[ -z "$DB_PORT" ] && DB_PORT=5432

# ─── 解析参数 ───
FRESH=false
KILL_ONLY=false
for arg in "$@"; do
  case $arg in
    --fresh) FRESH=true ;;
    --kill)  KILL_ONLY=true ;;
  esac
done

# ─── 端口检查 (仅提示，不自动杀) ───
check_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "  ⚠️  端口 $port 已被占用 (PID: $pids)"
    echo "     提示: 运行 ./dev.sh --kill 清理，或手动 kill"
  fi
}

# ─── 清理 Next.js / Turbo 等框架的 lock 文件 (安全：只删除无主 lock) ───
cleanup_lock_files() {
  local lock_file="$ROOT_DIR/apps/web/.next/dev/lock"
  if [ -f "$lock_file" ]; then
    # 检查是否有进程正在持有这个 lock 文件
    local lock_holder
    lock_holder=$(lsof -t "$lock_file" 2>/dev/null || true)
    if [ -z "$lock_holder" ]; then
      echo "  🧹 清理残留 Next.js lock 文件 (无进程持有)"
      rm -f "$lock_file"
    else
      echo "  ⚠️  Next.js lock 文件被 PID $lock_holder 持有，跳过"
      echo "     提示: 运行 ./dev.sh --kill 强制清理"
    fi
  fi
}

# ─── PostgreSQL 就绪检查 (兼容无 pg_isready 的环境) ───
check_pg() {
  local port=$1
  # 优先用 pg_isready (可能不在 PATH 中)
  local pg_isready_bin=""
  if command -v pg_isready > /dev/null 2>&1; then
    pg_isready_bin="pg_isready"
  elif [ -x "/opt/homebrew/opt/postgresql@16/bin/pg_isready" ]; then
    pg_isready_bin="/opt/homebrew/opt/postgresql@16/bin/pg_isready"
  elif [ -x "/opt/homebrew/opt/libpq/bin/pg_isready" ]; then
    pg_isready_bin="/opt/homebrew/opt/libpq/bin/pg_isready"
  fi

  if [ -n "$pg_isready_bin" ]; then
    "$pg_isready_bin" -h localhost -p "$port" > /dev/null 2>&1
    return $?
  fi

  # 退而用 nc 检测端口是否开放
  nc -z localhost "$port" 2>/dev/null
  return $?
}

# ─── --kill 模式: 清理本项目的端口 + lock 文件 ───
if $KILL_ONLY; then
  echo "🧹 清理本项目端口占用..."
  for port in "$API_PORT" "$WEB_PORT"; do
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    for pid in $pids; do
      cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
      if echo "$cmd" | grep -q "study-abroad-platform"; then
        echo "  ⚠️  端口 $port: 杀掉本项目进程 (PID $pid)"
        kill -9 "$pid" 2>/dev/null || true
      else
        echo "  ℹ️  端口 $port: 跳过非本项目进程 (PID $pid)"
      fi
    done
  done
  # 清理 Next.js lock 文件
  local_lock="$ROOT_DIR/apps/web/.next/dev/lock"
  if [ -f "$local_lock" ]; then
    echo "  🧹 清理 Next.js lock 文件"
    rm -f "$local_lock"
  fi
  echo "✅ 清理完成"
  exit 0
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Lumni — Dev Env                    ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── 1. 基础设施检查 ───
echo "🔍 [1/4] 检查基础设施..."

# --- PostgreSQL ---
pg_ready=false
if check_pg "$DB_PORT"; then
  echo "  ✅ PostgreSQL (端口 $DB_PORT)"
  pg_ready=true
fi

# --- Redis ---
redis_ready=false
if redis-cli -p "$REDIS_PORT" ping > /dev/null 2>&1; then
  echo "  ✅ Redis (端口 $REDIS_PORT)"
  redis_ready=true
else
  # Redis 可能没密码或在默认端口，再试一下
  if [ "$REDIS_PORT" != "6379" ] && redis-cli -p 6379 ping > /dev/null 2>&1; then
    echo "  ⚠️  Redis 在端口 6379 (非 .env 配置的 $REDIS_PORT)"
    echo "     提示: 修改 apps/api/.env 中 REDIS_URL 端口，或启动 Redis 在 $REDIS_PORT"
    redis_ready=true
  fi
fi

# --- 如果有服务未就绪，尝试 Docker 启动 ---
if [ "$pg_ready" = false ] || [ "$redis_ready" = false ]; then
  if ! docker info > /dev/null 2>&1; then
    echo ""
    echo "  ❌ 有服务未就绪且 Docker 未运行！"
    [ "$pg_ready" = false ] && echo "     - PostgreSQL 未就绪 (端口 $DB_PORT)"
    [ "$redis_ready" = false ] && echo "     - Redis 未就绪 (端口 $REDIS_PORT)"
    echo ""
    echo "  解决方案:"
    echo "    1) 启动 Docker Desktop，然后重新运行 ./dev.sh"
    echo "    2) 或用 Homebrew 启动服务:"
    [ "$pg_ready" = false ] && echo "       brew services start postgresql@16"
    [ "$redis_ready" = false ] && echo "       brew services start redis"
    exit 1
  fi

  services=""
  [ "$pg_ready" = false ] && services="$services db"
  [ "$redis_ready" = false ] && services="$services redis"
  echo "  🐳 Docker 启动:$services"
  docker compose up -d $services 2>&1 | grep -v "^WARN" || true

  # 等待 PostgreSQL 就绪
  if [ "$pg_ready" = false ]; then
    echo "  ⏳ 等待 PostgreSQL..."
    for i in $(seq 1 30); do
      # 用 docker 内部健康检查
      if docker exec study-abroad-db pg_isready -U postgres > /dev/null 2>&1; then
        echo "  ✅ PostgreSQL 已就绪 (Docker)"
        pg_ready=true
        break
      fi
      if [ "$i" -eq 30 ]; then
        echo "  ❌ PostgreSQL 启动超时 (30s)"
        echo "     运行 docker logs study-abroad-db 查看详情"
        exit 1
      fi
      sleep 1
    done
  fi

  # 等待 Redis 就绪
  if [ "$redis_ready" = false ]; then
    echo "  ⏳ 等待 Redis..."
    for i in $(seq 1 15); do
      if docker exec study-abroad-redis redis-cli -a redis_dev_password ping > /dev/null 2>&1; then
        echo "  ✅ Redis 已就绪 (Docker)"
        redis_ready=true
        break
      fi
      if [ "$i" -eq 15 ]; then
        echo "  ❌ Redis 启动超时 (15s)"
        exit 1
      fi
      sleep 1
    done
  fi
fi

# ─── 2. 端口检查 + lock 文件清理 ───
echo ""
echo "🔍 [2/4] 检查端口 & 清理残留..."
check_port "$API_PORT"
check_port "$WEB_PORT"
cleanup_lock_files
echo "  ✅ 检查完成"

# ─── 3. 可选: migrate + seed ───
if $FRESH; then
  echo ""
  echo "📦 [3/4] 数据库迁移 + 填充..."
  (cd apps/api && npx prisma migrate deploy 2>&1) || echo "  ⚠️  迁移跳过"
  (cd apps/api && npx prisma db seed 2>&1) || echo "  ⚠️  填充跳过"
else
  echo ""
  echo "⏭️  [3/4] 跳过 migrate/seed (用 --fresh 启用)"
fi

# ─── 4. 启动服务 ───
echo ""
echo "🚀 [4/4] 启动服务..."
echo ""
echo "  ┌──────────────────────────────────────────────┐"
echo "  │  API:     http://localhost:$API_PORT                  │"
echo "  │  Web:     http://localhost:$WEB_PORT                  │"
echo "  │  Swagger: http://localhost:$API_PORT/api/docs         │"
echo "  └──────────────────────────────────────────────┘"
echo ""
echo "  Ctrl+C 停止服务 (DB/Redis 继续在后台运行)"
echo ""

pnpm dev
