# 部署策略与基础设施分析

> 留学申请平台（Next.js + NestJS + PostgreSQL + Redis）的部署选型、GCP vs AWS 对比、迁移指南。
> 最后更新：2026-02

---

## 1. 技术栈与基础设施需求

### 应用构成

| 应用       | 技术                                 | 说明                   |
| ---------- | ------------------------------------ | ---------------------- |
| **web**    | Next.js (App Router)、next-intl、PWA | SSR/ISR，多语言        |
| **api**    | NestJS、Prisma、Socket.IO            | 单体 API，含 WebSocket |
| **mobile** | Expo (React Native)                  | 移动端，与 API 同源    |

### 基础设施需求矩阵

| 能力      | 需求                          | 说明                     |
| --------- | ----------------------------- | ------------------------ |
| 持久化 DB | PostgreSQL 15+，支持 pgvector | 60+ 模型，含 AI 向量搜索 |
| 长连接    | WebSocket（Chat、AI Agent）   | 需 WS 或 sticky session  |
| 长请求    | AI/预测接口 30s–2min          | 可配置请求超时           |
| 定时任务  | @nestjs/schedule              | 单实例或专用 worker      |
| Redis     | 限流、AI 队列/缓存            | 不配则内存降级           |
| 对象存储  | local / S3 / OSS / COS / GCS  | 验证材料、附件           |

---

## 2. 部署产品对照

### 前端托管

| 产品                 | 免费档             | Next.js 匹配度 | 备注                 |
| -------------------- | ------------------ | -------------- | -------------------- |
| Vercel               | Hobby 免费（有限） | 最佳           | 商用建议 Pro         |
| Firebase App Hosting | Blaze 按量         | 好（13.5+）    | 最少运维             |
| Cloud Run (Next)     | 免费额度           | 完全           | 完全掌控，支持 ISR   |
| Amplify Gen 2        | 免费档             | 好             | 不支持 on-demand ISR |
| ECS Fargate (Next)   | 无                 | 完全           | 运维重               |

### API 计算

| 产品           | WebSocket | 长请求 | 免费档        | 运维量 |
| -------------- | --------- | ------ | ------------- | ------ |
| GCP Cloud Run  | 需配置    | 60min  | ~200万请求/月 | 低     |
| AWS App Runner | 支持      | 支持   | 无            | 低     |
| AWS ECS        | 支持      | 支持   | 无            | 高     |
| Railway        | 支持      | 支持   | 试用/限额     | 最低   |
| VPS            | 支持      | 支持   | 无            | 全自管 |

### 数据库

| 产品           | pgvector | 免费档 | 企业级特性 |
| -------------- | -------- | ------ | ---------- |
| Neon           | 支持     | 0.5GB  | Serverless |
| GCP Cloud SQL  | 支持     | 无     | HA、备份   |
| AWS RDS/Aurora | 支持     | 无     | HA、自动扩 |

### Redis

| 产品            | 免费档 | 与计算层延迟 |
| --------------- | ------ | ------------ |
| GCP Memorystore | 无     | 同 VPC 低    |
| AWS ElastiCache | 无     | 同 VPC 低    |
| Upstash         | 有     | Serverless   |
| Railway add-on  | 无     | 同平台       |

---

## 3. GCP vs AWS 全面对比

### 架构方案

**GCP**: Cloud CDN → Firebase App Hosting / Cloud Run (Next) → Cloud Run (NestJS) → Cloud SQL + Memorystore → GCS

**AWS**: CloudFront → Amplify / ECS (Next) → App Runner / ECS (NestJS) → RDS/Aurora + ElastiCache → S3

### 关键差异

| 维度       | GCP                     | AWS                              |
| ---------- | ----------------------- | -------------------------------- |
| 前端 ISR   | Cloud Run 完全支持      | Amplify **不支持** on-demand ISR |
| 组件复杂度 | 少，心智负担小          | 产品线多，学习曲线陡             |
| 免费额度   | Cloud Run ~200万请求/月 | 无持续免费计算额度               |
| Redis 成本 | Memorystore ~$35/月     | ElastiCache ~$15-25/月           |
| CI/CD      | Cloud Build 原生        | CodePipeline / GitHub Actions    |

### 成本粗算（月费，美元）

| 流量级别                | 100% GCP | 100% AWS |
| ----------------------- | -------- | -------- |
| 小流量（~50万请求/月）  | $80–125  | $85–145  |
| 中流量（~500万请求/月） | $200–350 | $250–400 |

---

## 4. 推荐部署组合

### 正式上线（推荐）

| 层级   | 推荐            | 备选           |
| ------ | --------------- | -------------- |
| 前端   | Vercel Pro      | Cloud Run      |
| API    | GCP Cloud Run   | AWS App Runner |
| 数据库 | GCP Cloud SQL   | Neon Pro       |
| Redis  | GCP Memorystore | Upstash        |
| 存储   | GCS             | S3 / R2        |

### 免费/MVP

前端 Vercel Hobby + API Cloud Run 免费额度 + Neon 免费档 + 不配 Redis

### VPS 省钱

前端 Vercel + 单台 VPS (4GB) Docker（NestJS + Redis + PostgreSQL），月费 ~$20-50

---

## 5. GCP 迁移指南（Vercel + Railway + Neon → GCP）

### 迁移可行性

**总体：中等偏下，不麻烦。** 应用层无厂商锁定，Docker/Prisma/环境变量都是标准用法。

| 模块   | 工作量 | 说明                                     |
| ------ | ------ | ---------------------------------------- |
| API    | 低     | 已有 Dockerfile，直接上 Cloud Run        |
| 数据库 | 中     | 建实例、开 pgvector、导数据、改连接串    |
| Redis  | 低     | 改 REDIS_URL，协议兼容                   |
| 前端   | 低-中  | 保留 Vercel 仅改 API 地址；迁 GCP 需重做 |
| 存储   | 低     | GCS S3 兼容层或加 STORAGE_TYPE=gcs       |
| CI/CD  | 中     | Cloud Build 或 gcloud run deploy         |

### 迁移步骤

1. **准备 GCP**: 建项目、启用 API（Cloud Run、Cloud SQL、Memorystore、VPC）
2. **Cloud SQL**: 建实例、开 pgvector、从 Neon `pg_dump` 导入
3. **Memorystore**: 建 Redis、记内网 `REDIS_URL`
4. **API 上 Cloud Run**: 现有 Dockerfile 构建部署，配环境变量、VPC
5. **前端**: 保持 Vercel，`NEXT_PUBLIC_API_URL` 指向 Cloud Run
6. **CI/CD**: 改 deploy.yml，用 GCP 认证 + Cloud Run 部署
7. **收尾**: 切流量、下线 Railway/Neon、配监控告警

### 代码改动（最小集）

| 文件                 | 改动                                  | 必须？ |
| -------------------- | ------------------------------------- | ------ |
| health.controller.ts | commitSha fallback 增加 `K_REVISION`  | 可选   |
| sentry.module.ts     | release commit 增加 GCP revision      | 可选   |
| deploy.yml           | GCP 认证 + Cloud Run 部署替代 Railway | 必须   |
| Dockerfile / schema  | 无需改动                              | -      |

---

## 6. 本地开发快速启动

```bash
git clone https://github.com/your-org/study-abroad-platform.git && cd study-abroad-platform
pnpm install

# 配置环境变量
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 启动数据库和 Redis
pnpm docker:up   # 或手动安装 PostgreSQL 16 + Redis 7

# 初始化数据库
cd apps/api && pnpm prisma migrate dev && pnpm prisma db seed && cd ..

# 启动开发服务器
pnpm dev
# 前端: http://localhost:4100 | API: http://localhost:4101 | Swagger: http://localhost:4101/api/docs
```

---

## 7. Docker 部署

```bash
docker compose build && docker compose up -d
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed
```

| 服务  | 端口 | 说明              |
| ----- | ---- | ----------------- |
| db    | 5432 | PostgreSQL 数据库 |
| redis | 6379 | Redis 缓存        |
| api   | 4101 | NestJS API        |
| web   | 4100 | Next.js 前端      |

---

## 8. Vercel 部署（前端）

1. 导入项目到 Vercel
2. 环境变量: `NEXT_PUBLIC_API_URL` = API 地址
3. 构建命令: `pnpm --filter web build`，输出目录: `apps/web/.next`
4. 配置自定义域名

---

## 9. 生产环境检查清单

- [ ] 强密码 `JWT_SECRET`、`DB_PASSWORD`
- [ ] SSL 证书
- [ ] SMTP 邮件服务
- [ ] Sentry 错误监控
- [ ] 数据库备份
- [ ] SBOM 供应链审计（CI 自动生成，或 `pnpm sbom:generate`）

### 默认账号

| 角色     | 邮箱              | 密码      |
| -------- | ----------------- | --------- |
| 管理员   | admin@example.com | Admin123! |
| 测试用户 | demo@example.com  | Demo123!  |

---

_此文档整合自部署策略分析、GCP vs AWS 对比、本地开发指南。_
