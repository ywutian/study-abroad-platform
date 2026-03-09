# GCP 部署步骤（API + Cloud SQL，前端 Vercel）

> 按顺序执行即可把 API 部署到 Cloud Run，数据库用 Cloud SQL。前端继续 Vercel，只改 API 地址。
> Redis 可选：低流量阶段不需要，应用自动回退内存模式。
> 预计时间：首次约 30–60 分钟。

---

## 前置条件

- 已注册 GCP 账号（可用 $300 赠金）
- 本机已安装 [gcloud CLI](https://cloud.google.com/sdk/docs/install) 并登录
- 一个域名（可选，用于给 Cloud Run 绑自定义域名）

---

## 第一步：创建项目并启用 API

```bash
# 创建项目（或使用现有项目）
export GCP_PROJECT_ID=你的项目ID
export GCP_REGION=us-central1   # 或 asia-northeast1 等

gcloud config set project $GCP_PROJECT_ID

# 启用所需 API（不再需要 redis/vpcaccess）
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 第二步：创建 Cloud SQL（PostgreSQL）

```bash
# 创建实例（首次约 5–10 分钟）
gcloud sql instances create study-abroad-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$GCP_REGION

# 创建数据库与用户
gcloud sql databases create study_abroad --instance=study-abroad-db
gcloud sql users create studyabroad --instance=study-abroad-db --password=你的强密码
```

记下 Cloud SQL 实例连接名（格式：`PROJECT_ID:REGION:study-abroad-db`）：

```bash
gcloud sql instances describe study-abroad-db --format='get(connectionName)'
```

在库里启用 pgvector（通过 Cloud Console 的 Cloud SQL Studio 或本机用 Cloud SQL Proxy 连接后执行）：

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 第三步：Artifact Registry 与镜像构建

```bash
# 创建 Docker 仓库
gcloud artifacts repositories create study-abroad --repository-format=docker --location=$GCP_REGION

# 在项目根目录构建并推送（使用仓库中的 cloudbuild.yaml）
cd /path/to/study-abroad-platform
gcloud builds submit --config=cloudbuild.yaml --substitutions=SHORT_SHA=latest,_REGION=$GCP_REGION .
```

---

## 第四步：部署 Cloud Run（API）

Cloud Run 通过 `--add-cloudsql-instances` 直连 Cloud SQL（Unix socket），**不需要 VPC Connector**。

将下面命令里的环境变量换成你的实际值。`DATABASE_URL` 使用 Unix socket 格式连接 Cloud SQL。

```bash
export IMAGE=${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/study-abroad/api:latest
export CLOUDSQL_INSTANCE=${GCP_PROJECT_ID}:${GCP_REGION}:study-abroad-db

gcloud run deploy study-abroad-api \
  --image=$IMAGE \
  --region=$GCP_REGION \
  --platform=managed \
  --allow-unauthenticated \
  --add-cloudsql-instances=$CLOUDSQL_INSTANCE \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="DATABASE_URL=postgresql://studyabroad:你的DB密码@localhost/study_abroad?host=/cloudsql/${CLOUDSQL_INSTANCE}" \
  --set-env-vars="JWT_SECRET=你的JWT密钥" \
  --set-env-vars="JWT_REFRESH_SECRET=你的Refresh密钥" \
  --set-env-vars="FRONTEND_URL=https://你的前端域名" \
  --min-instances=0 \
  --max-instances=3 \
  --cpu-throttling \
  --port=8080
```

> **注意**：`REDIS_URL` 未设置时，应用自动回退到内存缓存模式，低流量阶段完全够用。

敏感项建议改为用 Secret Manager，再在 Cloud Run 里引用（`--set-secrets=...`），见 GCP 文档。

部署完成后记下 **Cloud Run 服务 URL**（如 `https://study-abroad-api-xxx.run.app`）。

---

## 第五步：前端与 CORS

- 在 **Vercel** 中把 `NEXT_PUBLIC_API_URL` 设为上一步的 Cloud Run URL（或你的 API 域名）。
- 在 **Cloud Run** 或负载均衡中配置 **CORS**（若 API 与前端不同域）：在 NestJS 里已配置 CORS 时，确保 `CORS_ORIGINS` 包含前端域名。

---

## 第六步：数据库迁移与数据

- **迁移**：当前 API 的 `entrypoint.sh` 会在启动时执行 `prisma migrate deploy`，首次部署后若 DB 为空，会自动跑迁移。
- **从 Neon 迁数据**：见下方第七步。

---

## 第七步：从 Neon 导入数据到 Cloud SQL

### 方式一：Cloud SQL Auth Proxy（推荐）

1. **应用默认登录（本机未做过时执行一次）**

   ```bash
   gcloud auth application-default login
   ```

2. **终端 A：启动 Proxy（保持运行）**

   ```bash
   cloud-sql-proxy ${GCP_PROJECT_ID}:${GCP_REGION}:study-abroad-db --port=5433
   ```

3. **终端 B：导入**
   ```bash
   export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
   export PGPASSWORD='你的Cloud_SQL密码'
   psql 'host=127.0.0.1 port=5433 user=studyabroad dbname=study_abroad' \
     -c "SET session_replication_role = replica;" \
     -f neon-backup-data.sql \
     -c "SET session_replication_role = DEFAULT;"
   ```

若报 "server closed the connection unexpectedly"，确认 Proxy 在终端 A 中正常运行且 `gcloud config get-value project` 为正确项目。

### 方式二：临时公网 IP（不用 Proxy）

```bash
# 给实例加公网 IP 并授权
gcloud sql instances patch study-abroad-db --assign-ip
gcloud sql instances patch study-abroad-db --authorized-networks=你的公网IP/32

# 查公网地址
gcloud sql instances describe study-abroad-db --format='get(ipAddresses[0].ipAddress)'

# 导入
export PGPASSWORD='你的Cloud_SQL密码'
psql "host=CLOUD_SQL_PUBLIC_IP port=5432 user=studyabroad dbname=study_abroad sslmode=require" \
  -c "SET session_replication_role = replica;" \
  -f neon-backup-data.sql \
  -c "SET session_replication_role = DEFAULT;"

# 导入完成后去掉公网
gcloud sql instances patch study-abroad-db --clear-authorized-networks
```

---

## 后续：用 GitHub Actions 自动部署

仓库中已提供 `.github/workflows/deploy-gcp.yml`。在 **GitHub → Settings → Secrets and variables → Actions** 中添加：

| Secret 名称                      | 说明                                                        |
| -------------------------------- | ----------------------------------------------------------- |
| `GCP_PROJECT_ID`                 | GCP 项目 ID                                                 |
| `GCP_REGION`                     | 区域，如 `us-central1`                                      |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Federation provider                       |
| `GCP_CLOUDSQL_INSTANCE`          | Cloud SQL 实例连接名（`PROJECT_ID:REGION:study-abroad-db`） |

手动触发 workflow 后，会自动构建镜像并部署到 Cloud Run。**环境变量（DATABASE*URL、JWT*\* 等）需在首次部署时用 gcloud 或控制台配好**，后续部署不会覆盖已有环境变量。

---

## 可选：添加 Memorystore Redis

如果后续流量增大需要 Redis（会话共享、限流持久化等），可以添加回来：

```bash
# 需要先启用 API 和创建 VPC Connector
gcloud services enable redis.googleapis.com vpcaccess.googleapis.com

gcloud compute networks vpc-access connectors create study-abroad-connector \
  --region=$GCP_REGION \
  --network=default \
  --range=10.8.0.0/28 \
  --min-instances=2 \
  --max-instances=3

gcloud redis instances create study-abroad-redis \
  --size=1 \
  --region=$GCP_REGION \
  --redis-version=redis_7_0 \
  --network=default

# 然后在 Cloud Run 部署时加上：
# --vpc-connector=study-abroad-connector
# --set-env-vars="REDIS_URL=redis://REDIS内网IP:6379"
```

> 注意：VPC Connector + Memorystore 会增加约 $25-35/月。

---

## 费用参考（优化后）

| 服务              | 月费预估   | 说明                        |
| ----------------- | ---------- | --------------------------- |
| Cloud Run         | $1-3       | min-instances=0，按请求计费 |
| Cloud SQL         | $7-10      | db-f1-micro，最小规格       |
| Artifact Registry | ~$1        | 自动清理旧镜像              |
| **总计**          | **~$9-14** |                             |

---

## 参考

- 迁移与架构总览：`docs/GCP_MIGRATION_AUDIT.md`
- [Cloud Run 文档](https://cloud.google.com/run/docs)
- [Cloud SQL 连接 Cloud Run](https://cloud.google.com/sql/docs/postgres/connect-run)
