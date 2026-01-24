# 部署指南

## 目录

- [快速开始](#快速开始)
- [本地开发](#本地开发)
- [Docker 部署](#docker-部署)
- [Vercel 部署](#vercel-部署)
- [生产环境](#生产环境)

---

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-org/study-abroad-platform.git
cd study-abroad-platform
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
# API
cp apps/api/.env.example apps/api/.env

# Web
cp apps/web/.env.example apps/web/.env.local
```

编辑 `.env` 文件，填写必要配置（参考 `ENV_TEMPLATE.md`）

### 4. 启动数据库和 Redis

```bash
# 使用 Docker 启动 PostgreSQL 和 Redis（推荐）
pnpm docker:up

# 或手动安装 PostgreSQL 16 和 Redis 7
```

### 5. 初始化数据库

```bash
cd apps/api
pnpm prisma migrate dev
pnpm prisma db seed
```

### 6. 启动开发服务器

```bash
# 在项目根目录
pnpm dev
```

访问:

- 前端: http://localhost:3000
- API: http://localhost:3001
- API 文档: http://localhost:3001/api/docs

---

## 本地开发

### 数据库管理

```bash
# 数据库迁移
pnpm --filter api prisma migrate dev

# 查看数据库
pnpm --filter api prisma studio

# 重置数据库
pnpm --filter api prisma migrate reset
```

### 测试

```bash
# API 单元测试
pnpm --filter api test

# API E2E 测试
pnpm --filter api test:e2e

# 运行 lint
pnpm lint
```

---

## Docker 部署

### 一键部署

```bash
# 赋予执行权限
chmod +x deploy.sh

# 启动所有服务
./deploy.sh start

# 查看日志
./deploy.sh logs

# 停止服务
./deploy.sh stop
```

### 手动部署

```bash
# 构建镜像
docker compose build

# 启动服务
docker compose up -d

# 运行数据库迁移
docker compose exec api npx prisma migrate deploy

# 导入初始数据
docker compose exec api npx prisma db seed
```

### 服务说明

| 服务  | 端口   | 说明              |
| ----- | ------ | ----------------- |
| db    | 5432   | PostgreSQL 数据库 |
| redis | 6379   | Redis 缓存        |
| api   | 3001   | NestJS API        |
| web   | 3000   | Next.js 前端      |
| nginx | 80/443 | 反向代理 (生产)   |

---

## Vercel 部署

### 前端部署 (推荐)

1. Fork 或导入项目到 Vercel

2. 配置环境变量:
   - `NEXT_PUBLIC_API_URL`: API 地址

3. 配置构建命令:
   - Build Command: `pnpm --filter web build`
   - Output Directory: `apps/web/.next`
   - Install Command: `pnpm install`

4. 部署完成后配置自定义域名

### API 部署

API 建议使用以下方式部署:

- **Railway** / **Render**: 一键部署
- **AWS ECS** / **GCP Cloud Run**: 容器部署
- **自建服务器**: Docker Compose

---

## 生产环境

### 检查清单

- [ ] 配置强密码的 `JWT_SECRET` 和 `DB_PASSWORD`
- [ ] 配置 SSL 证书 (Let's Encrypt)
- [ ] 配置邮件服务 (SMTP)
- [ ] 配置 Sentry 错误监控
- [ ] 配置 CDN (可选)
- [ ] 配置数据库备份

### SSL 证书 (Let's Encrypt)

```bash
# 安装 certbot
apt install certbot

# 获取证书
certbot certonly --webroot -w /var/www/certbot -d your-domain.com

# 证书自动续期
certbot renew --dry-run
```

### 数据库备份

```bash
# 手动备份
docker compose exec db pg_dump -U postgres study_abroad > backup.sql

# 恢复备份
docker compose exec -T db psql -U postgres study_abroad < backup.sql
```

### 监控

- **日志**: `./deploy.sh logs`
- **健康检查**: `curl http://localhost:3001/health`
- **Sentry**: 配置 `SENTRY_DSN` 后自动上报错误

---

## SBOM（Software Bill of Materials）

项目使用 CycloneDX 标准自动生成 SBOM，用于供应链安全审计。

### 自动生成

每次推送到 `main` 分支时，CI 自动生成 SBOM 并存储为 GitHub Actions artifact（保留 90 天）。

### 手动生成

```bash
pnpm sbom:generate
# 输出: sbom/bom.json (CycloneDX JSON v1.5)
```

---

## 常见问题

### 数据库连接失败

检查 `DATABASE_URL` 格式是否正确，确保数据库服务已启动。

### API 404

确保 API 已启动并且 `NEXT_PUBLIC_API_URL` 配置正确。

### 邮件发送失败

检查 SMTP 配置，推荐使用 Resend 或 SendGrid。

### AI 功能不可用

配置正确的 `OPENAI_API_KEY`，确保有足够余额。

---

## 默认账号

| 角色     | 邮箱              | 密码      |
| -------- | ----------------- | --------- |
| 管理员   | admin@example.com | Admin123! |
| 测试用户 | demo@example.com  | Demo123!  |
