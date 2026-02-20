#!/usr/bin/env bash
# 把 Neon 数据库数据迁移到 GCP Cloud SQL（表结构已在 GCP 存在，只导数据）
#
# 前置：已安装 psql、pg_dump，以及 Cloud SQL Auth Proxy
# 用法：
#   export SOURCE_DATABASE_URL="postgresql://neondb_owner:xxx@ep-xxx.neon.tech/neondb?sslmode=require"
#   ./scripts/migrate-neon-to-gcp.sh
#
# 第一步：从 Neon 导出数据（仅数据，不导表结构）
# 第二步：需在本机启动 Cloud SQL Proxy 后，再执行本脚本的导入部分（或按下方说明手动导入）

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if [[ -z "$SOURCE_DATABASE_URL" ]]; then
  echo "请先设置源库连接串: export SOURCE_DATABASE_URL='postgresql://...'"
  exit 1
fi

BACKUP_FILE="${REPO_ROOT}/neon-backup-data-$(date +%Y%m%d-%H%M%S).sql"
echo "从 Neon 导出数据到: $BACKUP_FILE"
pg_dump "$SOURCE_DATABASE_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  -f "$BACKUP_FILE"

echo "导出完成. 行数: $(wc -l < "$BACKUP_FILE")"
echo ""
echo "========== 下一步：导入到 GCP Cloud SQL =========="
echo "1. 在本机启动 Cloud SQL Auth Proxy（新开一个终端）:"
echo "   cloud-sql-proxy study-abroad-prod-2025:us-central1:study-abroad-db --port=5433"
echo ""
echo "2. 在项目根目录执行导入（先启动 Cloud SQL Proxy 到 5433，且 PATH 含 psql）:"
echo "   export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
echo "   export PGPASSWORD=\$(grep DB_PASSWORD .gcp-db-password.txt | sed 's/DB_PASSWORD=//')"
echo "   psql 'host=127.0.0.1 port=5433 user=studyabroad dbname=study_abroad' -c \"SET session_replication_role = replica;\" -f $BACKUP_FILE -c \"SET session_replication_role = DEFAULT;\""
echo ""
echo "3. 导入完成后可删除备份: rm $BACKUP_FILE"
echo "   备份文件含数据，请勿提交到 Git。"
