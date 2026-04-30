#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Lumni — Docker API + 本地 Web 热更新                         ║
# ║                                                              ║
# ║  用法:                                                       ║
# ║    ./dev-docker.sh          启动 db/redis/api 容器 + Next dev  ║
# ║                                                             ║
# ║  前置: 仓库根目录需有 .env（或导出 JWT_SECRET 等 compose 变量）  ║
# ║  说明: 勿与本机 `pnpm --filter api dev` 同时占用 4101          ║
# ╚══════════════════════════════════════════════════════════════╝

set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "❌ 未找到 docker compose / docker-compose"
  exit 1
fi

API_PORT=$(grep -m1 '^API_PORT=' .env 2>/dev/null | cut -d= -f2 || echo "4101")
API_PORT=$(echo "$API_PORT" | tr -d '"' | tr -d "'")

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Docker backend + local Web dev     ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "🐳 启动 db + redis + api 容器 (build)..."
$DC up -d --build db redis api

echo ""
echo "⏳ 等待 API 健康检查 http://localhost:${API_PORT}/health ..."
for i in $(seq 1 90); do
  if curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    echo "  ✅ API 已就绪"
    break
  fi
  if [ "$i" -eq 90 ]; then
    echo "  ❌ 超时：请查看日志  $DC logs api"
    exit 1
  fi
  sleep 1
done

echo ""
echo "  ┌──────────────────────────────────────────────┐"
echo "  │  API (Docker): http://localhost:${API_PORT}              │"
echo "  │  Swagger:      http://localhost:${API_PORT}/api/docs    │"
echo "  │  Web (本地):   下一步由 Turbo 启动 → :4100              │"
echo "  └──────────────────────────────────────────────┘"
echo ""
echo "  Ctrl+C 仅停止 Next；API/DB/Redis 容器继续运行"
echo "  停止容器: pnpm docker:down  或  $DC stop api"
echo ""

pnpm turbo dev --filter=web
