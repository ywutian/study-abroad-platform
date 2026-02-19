# 换 GCP 迁移审核

> 基于当前代码与 CI/CD，评估从 Vercel + Railway + Neon 迁到 100% GCP 的工作量。  
> 最后更新：2026-02

---

## 一、结论先看：麻烦吗？

**总体：中等偏下，不麻烦。**  
应用层几乎无厂商锁定，Docker/Prisma/环境变量都是标准用法；主要工作是**在 GCP 上建资源、改 CI/CD 与配置**，代码改动很少。

| 模块                                | 工作量 | 说明                                                                          |
| ----------------------------------- | ------ | ----------------------------------------------------------------------------- |
| API（NestJS）                       | **低** | 已有 Dockerfile，可直接上 Cloud Run；仅 2 处可选的“Railway”字样可改为通用     |
| 数据库（Neon → Cloud SQL）          | **中** | 建实例、开 pgvector、导数据、改连接串                                         |
| Redis（→ Memorystore）              | **低** | 改 REDIS_URL，协议兼容                                                        |
| 前端（Vercel → Firebase/Cloud Run） | **中** | 若保留 Vercel 则只改 API 地址；若迁到 GCP 需重做部署与域名                    |
| 存储（→ GCS）                       | **低** | 已有 S3 兼容或 local，GCS 可 S3 兼容或加一层                                  |
| CI/CD                               | **中** | 用 Cloud Build 或 gcloud 部署 API/前端，替换 Railway 自动部署与 Vercel Action |
| 密钥与环境变量                      | **低** | 用 Secret Manager + Cloud Run 环境变量即可                                    |

---

## 二、当前项目与 GCP 的匹配度

### 2.1 已经对 GCP 友好、几乎不用改的

| 项目          | 说明                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- | --- | --- | ------------------------------------------------------------------------ |
| **API 容器**  | `apps/api/Dockerfile` 多阶段构建、暴露 8080、entrypoint 先 migrate 再启动，符合 Cloud Run 惯例 |
| **数据库**    | Prisma + 标准 `DATABASE_URL`，无 Neon 专有语法；迁移到 Cloud SQL 只需新连接串                  |
| **pgvector**  | 迁移里用标准 `CREATE EXTENSION vector`；Cloud SQL 支持 pgvector，建库后执行一次即可            |
| **Redis**     | 代码里用 `REDIS_URL`，Memorystore 提供标准 Redis 协议，改 URL 即可                             |
| **存储**      | `STORAGE_TYPE=local                                                                            | s3  | oss | cos`，无 Vercel/Railway/Neon 专有；GCS 可用 S3 兼容接口或后续加 GCS 实现 |
| **健康检查**  | `/health`、`/health/live`、`/health/ready` 已有，Cloud Run 可直接用                            |
| **WebSocket** | Chat/AI Agent 在 Nest 内，跑在 Cloud Run 上即可，Cloud Run 支持 WebSocket                      |

### 2.2 需要改或配置的（代码改动很少）

| 项目              | 位置                                           | 改动                                                                                                                                                                    |
| ----------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **构建/发布标识** | `health.controller.ts`、`sentry.module.ts`     | 当前用 `RAILWAY_GIT_COMMIT_SHA`；Cloud Run 部署时传入 `GIT_COMMIT_SHA`（或 `K_REVISION`）即可，**无需改代码**；若希望显示 GCP 版本可加 `CLOUD_RUN_REVISION` 到 fallback |
| **前端 API 地址** | `apps/web` 构建/运行时的 `NEXT_PUBLIC_API_URL` | 改为 Cloud Run API 的 URL（或内部用 VPC 地址），仅配置                                                                                                                  |
| **CI/CD**         | `.github/workflows/deploy.yml`                 | 当前写死“Railway 自动部署”+ Vercel Action；改为 Cloud Build 或 `gcloud run deploy` +（若前端迁 GCP）Firebase/Cloud Run 前端部署                                         |

### 2.3 无厂商锁定的部分

- **Next.js**：标准 App Router、rewrites 指向 `NEXT_PUBLIC_API_URL`，无 Vercel 专有 API。
- **vercel.json**：仅 `installCommand`/`buildCommand`，迁到 Firebase App Hosting 或 Cloud Run 时用各自配置即可。
- **Prisma**：标准 PostgreSQL，迁移文件与 schema 可直接用于 Cloud SQL。

---

## 三、分项迁移要点

### 3.1 API（Cloud Run）

- **镜像**：用现有 `apps/api/Dockerfile` 在 Cloud Build 中构建并推送到 Artifact Registry，再 `gcloud run deploy`。
- **环境变量**：在 Cloud Run 服务中配置 `DATABASE_URL`、`REDIS_URL`、`JWT_*`、`VAULT_ENCRYPTION_KEY` 等；敏感项可来自 Secret Manager。
- **VPC**：若 Cloud SQL、Memorystore 在同一 VPC，需给 Cloud Run 配 Serverless VPC Access，并设 `REDIS_URL`/`DATABASE_URL` 为内网地址。
- **代码**：无需改；可选在 health/sentry 的 commit/revision 里增加对 `K_REVISION` 或 `CLOUD_RUN_REVISION` 的 fallback。

### 3.2 数据库（Neon → Cloud SQL）

- **实例**：建 Cloud SQL for PostgreSQL（建议 15+），同区、同 VPC。
- **pgvector**：在库里执行 `CREATE EXTENSION IF NOT EXISTS vector;`（与现有迁移一致）。
- **数据**：用 `pg_dump` 从 Neon 导出、`psql` 或 `pg_restore` 导入 Cloud SQL；或用 Neon 的导出 + 导入，注意序列和时区。
- **连接串**：Cloud SQL 支持私有 IP（推荐）或 Cloud SQL Auth Proxy；把新 `DATABASE_URL` 配到 Cloud Run 和迁移脚本即可。
- **Prisma**：无需改 schema；`connection_limit`/`pool_timeout` 可继续在 URL 里带。

### 3.3 Redis（→ Memorystore）

- **实例**：建 Memorystore for Redis（Basic 或 Standard），同 VPC。
- **配置**：把 `REDIS_URL` 改为 Memorystore 的 `redis://:password@host:6379`（内网）。
- **代码**：无需改，ioredis 兼容。

### 3.4 前端（Vercel → GCP 或保留 Vercel）

**方案 A：保留 Vercel**

- 只改 `NEXT_PUBLIC_API_URL` 为 Cloud Run API 的对外 URL；域名/CORS 在 Cloud Run 或负载均衡上配好即可。
- **改动**：仅配置 + 环境变量，几乎零代码。

**方案 B：迁到 GCP**

- **Firebase App Hosting**：连 GitHub，选 `apps/web`，构建命令与 env 指向 Cloud Run API；或
- **Cloud Run（Next）**：为 web 写 Dockerfile（standalone 输出），同 API 一样用 Cloud Build + Cloud Run 部署。
- **改动**：CI/CD 与部署配置；Next 代码里的 rewrites 仍指向 `NEXT_PUBLIC_API_URL`，无需改逻辑。

### 3.5 存储（→ GCS，可选）

- **当前**：`local` 或 S3 兼容；Cloud Run 无持久盘，生产建议用对象存储。
- **GCS**：可用“GCS 的 S3 兼容 API”把现有 S3 逻辑指到 GCS，或单独实现一个 `STORAGE_TYPE=gcs` 并在配置里开关。
- **改动**：配置 + 可选一小块存储封装，业务代码可不变。

### 3.6 CI/CD（GitHub Actions）

- **当前**：`deploy.yml` 里 API 依赖 Railway 自动部署，Web 用 `vercel-action`， migrations 用 `secrets.DATABASE_URL`。
- **迁 GCP 后**：
  - **Migrations**：在 job 里用 Cloud SQL 的 `DATABASE_URL`（或 Auth Proxy）跑 `prisma migrate deploy`，与现在类似。
  - **API**：用 `google-github-actions/auth` + `gcloud run deploy` 或 Cloud Build 触发器构建并部署镜像。
  - **Web**：若保留 Vercel，继续用 `vercel-action` 只改 API URL；若迁到 GCP，改为 Cloud Build 部署前端镜像或 Firebase 的 GitHub 集成。
- **Secrets**：GitHub 里存 GCP 服务账号密钥、Cloud Run 项目/服务名；`DATABASE_URL` 可改为 Cloud SQL 连接串。

---

## 四、建议的迁移顺序

1. **准备 GCP**：建项目、启用 API（Cloud Run、Cloud SQL、Memorystore、GCS、Secret Manager、VPC）、建 VPC 与 Serverless VPC Access。
2. **Cloud SQL**：建实例、开 pgvector、从 Neon 导数据、记下内网 `DATABASE_URL`。
3. **Memorystore**：建 Redis、记下内网 `REDIS_URL`。
4. **API 上 Cloud Run**：用现有 Dockerfile 构建并部署，环境变量/Secret 配好，VPC 连上，跑迁移与健康检查。
5. **前端**：先保持 Vercel，只把 `NEXT_PUBLIC_API_URL` 指到 Cloud Run，验证整站；再决定是否迁前端到 Firebase/Cloud Run。
6. **CI/CD**：改 `deploy.yml`，用 GCP 部署 API（及可选前端），migrations 用 Cloud SQL 的 URL。
7. **存储与收尾**：按需接 GCS；切流量、下线 Railway/Neon、收尾监控与告警。

---

## 五、代码改动清单（最小集）

| 文件                                               | 改动                                                                                 | 必须？ |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| `apps/api/src/modules/health/health.controller.ts` | 在 commitSha 的 fallback 中增加 `process.env.K_REVISION` 或 `CLOUD_RUN_REVISION`     | 可选   |
| `apps/api/src/common/sentry/sentry.module.ts`      | 同上，release 的 commit 来源增加 GCP 的 revision                                     | 可选   |
| `apps/web/next.config.ts`                          | 无（仅通过 `NEXT_PUBLIC_API_URL` 指向 API）                                          | -      |
| `apps/api/Dockerfile`                              | 无（已兼容 Cloud Run）                                                               | -      |
| `.github/workflows/deploy.yml`                     | 用 GCP 认证 + Cloud Run 部署替代 Railway 说明步骤；migrations 用 Cloud SQL 的 secret | 必须   |

其余均为**配置与 GCP 控制台/CLI 操作**，无需改业务代码。

---

## 六、总结

- **麻烦吗？** 不麻烦：应用和数据库都是标准技术栈，没有对 Vercel/Railway/Neon 的强依赖；主要工作是**在 GCP 上建资源、改 CI/CD 和配置**。
- **风险点**：数据迁移（Neon → Cloud SQL）需要停机或双写窗口规划；API 与 Redis/DB 的 VPC 与连接串要一次配对。
- **时间粗估**：若熟悉 GCP，1–2 天可完成 API + DB + Redis + 前端（保留 Vercel）上线；再 1 天做 CI/CD 与收尾。若前端也迁到 GCP，再加约 1 天。

如需，我可以按你选的方案（例如“前端保留 Vercel”或“前端也上 Cloud Run”）写一版具体的 `deploy.yml` 片段和 gcloud/Cloud Build 命令示例。
