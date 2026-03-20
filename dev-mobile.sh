#!/bin/bash

# ╔══════════════════════════════════════════════╗
# ║  Study Abroad Platform — Mobile 开发环境       ║
# ║                                              ║
# ║  用法:                                       ║
# ║    ./dev-mobile.sh              iOS 真机      ║
# ║    ./dev-mobile.sh android      Android 真机  ║
# ║    ./dev-mobile.sh sim          iOS 模拟器     ║
# ║    ./dev-mobile.sh start        仅 Metro      ║
# ║    ./dev-mobile.sh --clean      清理重建       ║
# ╚══════════════════════════════════════════════╝

set -e
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
cd "$MOBILE_DIR"

# ─── 颜色 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── 解析参数 ───
TARGET="${1:-ios}"
CLEAN=false
for arg in "$@"; do
  case $arg in
    --clean) CLEAN=true ;;
  esac
done

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Study Abroad — Mobile Dev Env     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── 1. 环境检查 ───
echo -e "${BLUE}🔍 [1/4] 环境检查...${NC}"

# Node
node_version=$(node -v 2>/dev/null || echo "none")
echo -e "  Node:  ${GREEN}$node_version${NC}"

# pnpm
pnpm_version=$(pnpm -v 2>/dev/null || echo "none")
echo -e "  pnpm:  ${GREEN}$pnpm_version${NC}"

# .env
if [ -f "$MOBILE_DIR/.env" ]; then
  API_URL=$(grep -m1 'EXPO_PUBLIC_API_URL' "$MOBILE_DIR/.env" | cut -d= -f2)
  echo -e "  API:   ${GREEN}$API_URL${NC}"
else
  echo -e "  ${RED}❌ .env 文件不存在！${NC}"
  echo -e "  ${YELLOW}创建 apps/mobile/.env 并设置 EXPO_PUBLIC_API_URL${NC}"
  exit 1
fi

# 检测连接的设备
echo ""
echo -e "${BLUE}🔍 [2/4] 检测设备...${NC}"

if [ "$TARGET" = "ios" ] || [ "$TARGET" = "sim" ]; then
  # iOS 设备
  ios_devices=$(xcrun xctrace list devices 2>/dev/null | grep -v "Simulator" | grep -E "^\w+" | tail -n +2 || true)
  ios_sims=$(xcrun simctl list devices available 2>/dev/null | grep -E "iPhone|iPad" || true)

  if [ -n "$ios_devices" ]; then
    echo -e "  ${GREEN}📱 iOS 真机:${NC}"
    echo "$ios_devices" | head -3 | while IFS= read -r line; do
      echo -e "     $line"
    done
  else
    echo -e "  ${YELLOW}⚠️  未检测到 iOS 真机（USB 连接你的 iPhone）${NC}"
  fi

  if [ "$TARGET" = "sim" ]; then
    echo -e "  ${GREEN}📱 iOS 模拟器:${NC}"
    echo "$ios_sims" | head -5 | while IFS= read -r line; do
      echo -e "     $line"
    done
  fi

elif [ "$TARGET" = "android" ]; then
  adb_devices=$(adb devices 2>/dev/null | grep -v "List" | grep "device$" || true)
  if [ -n "$adb_devices" ]; then
    echo -e "  ${GREEN}📱 Android 设备:${NC}"
    echo "$adb_devices" | while IFS= read -r line; do
      echo -e "     $line"
    done
    # 设置 adb reverse 以便设备访问 Metro
    adb reverse tcp:8081 tcp:8081 2>/dev/null || true
    echo -e "  ${GREEN}✅ adb reverse tcp:8081 已设置${NC}"
  else
    echo -e "  ${YELLOW}⚠️  未检测到 Android 设备${NC}"
    echo -e "  ${YELLOW}   1. USB 连接并开启 USB 调试${NC}"
    echo -e "  ${YELLOW}   2. 运行 adb devices 确认${NC}"
  fi
fi

# ─── 3. 清理 (可选) ───
if $CLEAN; then
  echo ""
  echo -e "${BLUE}🧹 [3/4] 清理构建缓存...${NC}"

  if [ "$TARGET" = "ios" ] || [ "$TARGET" = "sim" ]; then
    echo -e "  清理 iOS build..."
    rm -rf "$MOBILE_DIR/ios/build" 2>/dev/null || true
    cd "$MOBILE_DIR/ios" && pod install 2>&1 | tail -3
    cd "$MOBILE_DIR"
  elif [ "$TARGET" = "android" ]; then
    echo -e "  清理 Android build..."
    cd "$MOBILE_DIR/android" && ./gradlew clean 2>&1 | tail -3
    cd "$MOBILE_DIR"
  fi

  # 清理 Metro 缓存
  echo -e "  清理 Metro 缓存..."
  rm -rf "$MOBILE_DIR/node_modules/.cache" 2>/dev/null || true
  watchman watch-del-all 2>/dev/null || true

  echo -e "  ${GREEN}✅ 清理完成${NC}"
else
  echo ""
  echo -e "  ${YELLOW}⏭️  [3/4] 跳过清理 (用 --clean 启用)${NC}"
fi

# ─── 4. 启动 ───
echo ""
echo -e "${BLUE}🚀 [4/4] 启动 Mobile 开发环境...${NC}"
echo ""
echo -e "  ┌──────────────────────────────────────────────┐"
echo -e "  │  Platform:  ${GREEN}$TARGET${NC}                              "
echo -e "  │  Metro:     ${GREEN}http://localhost:8081${NC}                "
echo -e "  │  API:       ${GREEN}$API_URL${NC}  "
echo -e "  │                                              │"
echo -e "  │  ${YELLOW}快捷键:${NC}                                      │"
echo -e "  │    r — 重载 JS Bundle                        │"
echo -e "  │    d — 打开 Dev Menu                         │"
echo -e "  │    j — 打开 Chrome DevTools                  │"
echo -e "  │    Ctrl+C — 停止                             │"
echo -e "  └──────────────────────────────────────────────┘"
echo ""

case $TARGET in
  ios)
    echo -e "${GREEN}构建 iOS (真机)... 首次构建约 3-5 分钟${NC}"
    echo ""
    npx expo run:ios --device
    ;;
  sim)
    echo -e "${GREEN}构建 iOS (模拟器)...${NC}"
    echo ""
    npx expo run:ios
    ;;
  android)
    echo -e "${GREEN}构建 Android (真机)...${NC}"
    echo ""
    npx expo run:android --device
    ;;
  start)
    echo -e "${GREEN}仅启动 Metro Bundler...${NC}"
    echo -e "${YELLOW}提示: 在另一个终端运行构建命令，或用已安装的 dev build 连接${NC}"
    echo ""
    npx expo start --dev-client
    ;;
  *)
    echo -e "${RED}未知目标: $TARGET${NC}"
    echo -e "用法: ./dev-mobile.sh [ios|android|sim|start] [--clean]"
    exit 1
    ;;
esac
