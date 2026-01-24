# 快速参考卡

> 留学申请平台开发常用信息速查。一页在手，开发无忧。

**最后更新**: 2026-02-13

## 目录

1. [常用端口与 URL](#1-常用端口与-url)
2. [常用命令](#2-常用命令)
3. [Docker 命令](#3-docker-命令)
4. [数据库命令](#4-数据库命令)
5. [Git 工作流](#5-git-工作流)
6. [环境变量速查](#6-环境变量速查)
7. [API 快速测试](#7-api-快速测试)
8. [常用文件路径](#8-常用文件路径)
9. [求助链接](#9-求助链接)

---

## 1. 常用端口与 URL

| 服务              | 端口   | 本地 URL                                                     |
| ----------------- | ------ | ------------------------------------------------------------ |
| NestJS API        | `3001` | `http://localhost:3001`                                      |
| Next.js Web       | `3000` | `http://localhost:3000`                                      |
| Expo Mobile       | `8081` | Expo DevTools（终端扫码启动）                                |
| Swagger UI        | `3001` | `http://localhost:3001/api/docs`                             |
| Health Check      | `3001` | `http://localhost:3001/health`                               |
| Health (Detailed) | `3001` | `http://localhost:3001/health/detailed`                      |
| PostgreSQL        | `5432` | `postgresql://postgres:postgres@localhost:5432/study_abroad` |
| Redis             | `6379` | `redis://localhost:6379`                                     |
| Prisma Studio     | `5555` | `http://localhost:5555`                                      |

> **注意**：Swagger UI 仅在 `NODE_ENV !== 'production'` 时启用。API 前缀为 `api/v1`，健康检查端点不含前缀。

---

## 2. 常用命令

### 全局命令（项目根目录执行）

| 命令                 | 说明                              |
| -------------------- | --------------------------------- |
| `pnpm install`       | 安装所有 workspace 依赖           |
| `pnpm dev`           | 启动所有应用的开发服务器（Turbo） |
| `pnpm build`         | 构建所有应用（Turbo）             |
| `pnpm lint`          | 运行所有应用的 lint 检查（Turbo） |
| `pnpm format`        | Prettier 格式化全部文件           |
| `pnpm db:generate`   | 运行 Prisma generate（Turbo）     |
| `pnpm db:push`       | 运行 Prisma db push（Turbo）      |
| `pnpm sbom:generate` | 生成 SBOM（CycloneDX JSON v1.5）  |

### API（NestJS）

| 命令                            | 说明                |
| ------------------------------- | ------------------- |
| `pnpm --filter api dev`         | 启动 API 开发服务器 |
| `pnpm --filter api build`       | 构建 API            |
| `pnpm --filter api test`        | 运行 API 单元测试   |
| `pnpm --filter api test:watch`  | 测试监视模式        |
| `pnpm --filter api test:cov`    | 生成测试覆盖率报告  |
| `pnpm --filter api test:e2e`    | 运行端到端测试      |
| `pnpm --filter api start:debug` | Debug 模式启动      |

### Web（Next.js）

| 命令                                | 说明                         |
| ----------------------------------- | ---------------------------- |
| `pnpm --filter web dev`             | Turbopack 模式启动（默认）   |
| `pnpm --filter web dev:webpack`     | Webpack 模式启动（回退方案） |
| `pnpm --filter web build`           | 生产构建                     |
| `pnpm --filter web lint`            | ESLint 检查                  |
| `pnpm --filter web lint:i18n`       | 国际化 key 一致性检查        |
| `pnpm --filter web lint:typography` | 中文排版检查                 |

### Mobile（Expo）

| 命令                                              | 说明                 |
| ------------------------------------------------- | -------------------- |
| `pnpm --filter study-abroad-mobile start`         | 启动 Expo 开发服务器 |
| `pnpm --filter study-abroad-mobile ios`           | iOS 模拟器运行       |
| `pnpm --filter study-abroad-mobile android`       | Android 模拟器运行   |
| `pnpm --filter study-abroad-mobile test`          | 运行测试             |
| `pnpm --filter study-abroad-mobile test:coverage` | 测试覆盖率           |

---

## 3. Docker 命令

| 命令                           | 说明                          |
| ------------------------------ | ----------------------------- |
| `pnpm docker:up`               | 启动 PostgreSQL + Redis 容器  |
| `pnpm docker:down`             | 停止并移除所有容器            |
| `pnpm docker:logs`             | 查看 DB 和 Redis 日志（持续） |
| `docker compose up -d db`      | 仅启动 PostgreSQL             |
| `docker compose up -d redis`   | 仅启动 Redis                  |
| `docker compose ps`            | 查看容器运行状态              |
| `docker compose restart db`    | 重启数据库容器                |
| `docker compose restart redis` | 重启 Redis 容器               |

### 重置数据库

```bash
# 1. 停止容器并删除数据卷
docker compose down -v

# 2. 重新启动
pnpm docker:up

# 3. 重新执行迁移和种子数据
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

### Docker 容器信息

| 容器名               | 镜像                     | 默认账号                         |
| -------------------- | ------------------------ | -------------------------------- |
| `study-abroad-db`    | `pgvector/pgvector:pg16` | 用户 `postgres`，密码 `postgres` |
| `study-abroad-redis` | `redis:7-alpine`         | 密码 `redis_dev_password`        |

---

## 4. 数据库命令

所有 Prisma 命令在 `apps/api/` 目录下执行，或使用 `pnpm --filter api` 前缀。

| 命令                                                                                                         | 说明                                   |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `npx prisma migrate dev`                                                                                     | 创建并应用新迁移（开发环境）           |
| `npx prisma migrate dev --create-only`                                                                       | 仅生成迁移 SQL，不自动应用             |
| `npx prisma migrate deploy`                                                                                  | 应用所有待处理迁移（生产/CI）          |
| `npx prisma migrate status`                                                                                  | 查看迁移同步状态                       |
| `npx prisma generate`                                                                                        | 根据 schema 生成 Prisma Client         |
| `npx prisma db push`                                                                                         | 快速同步 schema 到数据库（不生成迁移） |
| `npx prisma db seed`                                                                                         | 执行种子数据脚本                       |
| `npx prisma studio`                                                                                          | 打开可视化数据管理界面（:5555）        |
| `npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma` | 对比 schema 与迁移差异                 |

> **提示**：开发阶段推荐使用 `prisma migrate dev`；`prisma db push` 适合快速原型，但不会生成迁移记录。

---

## 5. Git 工作流

### 分支命名

| 分支类型 | 命名格式          | 示例                          |
| -------- | ----------------- | ----------------------------- |
| 功能     | `feature/<描述>`  | `feature/add-school-filter`   |
| 修复     | `fix/<描述>`      | `fix/login-token-expired`     |
| 热修复   | `hotfix/<描述>`   | `hotfix/critical-auth-bypass` |
| 文档     | `docs/<描述>`     | `docs/update-api-reference`   |
| 重构     | `refactor/<描述>` | `refactor/scoring-calculator` |

### Conventional Commits 格式

```
<type>(<scope>): <subject>
```

**Type**: `feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` | `ci` | `chore` | `revert`

**Scope（可选）**: `auth` | `profile` | `school` | `case` | `ai` | `forum` | `web` | `api` | `mobile`

**示例**:

```bash
git commit -m "feat(auth): add OAuth2 login"
git commit -m "fix(profile): prevent GPA overflow"
git commit -m "docs: update API reference"
```

### PR 自查清单

- [ ] 代码通过 lint 检查：`pnpm lint`
- [ ] 所有测试通过：`pnpm --filter api test`
- [ ] 已更新相关文档
- [ ] 分支已 rebase 到最新目标分支
- [ ] 提交信息符合 Conventional Commits 格式
- [ ] 无 `any` 类型，无硬编码字符串
- [ ] 新增 API 端点已添加 Swagger 装饰器

### Pre-commit Hooks（自动执行）

1. **lint-staged** — 对暂存的 `.ts/.tsx` 文件运行 Prettier + ESLint
2. **commitlint** — 校验提交信息格式
3. **i18n 检查** — 当 `apps/web/src/` 文件变动时，自动检查翻译 key 一致性

---

## 6. 环境变量速查

### API 环境变量（`apps/api/.env`）

| 变量                     | 必填 | 说明                         | 示例值                                                       |
| ------------------------ | ---- | ---------------------------- | ------------------------------------------------------------ |
| `DATABASE_URL`           | 是   | PostgreSQL 连接串            | `postgresql://postgres:postgres@localhost:5432/study_abroad` |
| `JWT_SECRET`             | 是   | JWT 签名密钥（>=16 字符）    | 随机 32 位字符串                                             |
| `JWT_REFRESH_SECRET`     | 是   | Refresh Token 签名密钥       | 随机 32 位字符串                                             |
| `JWT_EXPIRES_IN`         | 否   | Access Token 过期时间        | `15m`                                                        |
| `JWT_REFRESH_EXPIRES_IN` | 否   | Refresh Token 过期时间       | `7d`                                                         |
| `REDIS_URL`              | 否   | Redis 连接串（无则降级内存） | `redis://localhost:6379`                                     |
| `OPENAI_API_KEY`         | 否   | OpenAI API 密钥              | `sk-...`（联系 Tech Lead 获取）                              |
| `OPENAI_BASE_URL`        | 否   | OpenAI 接口地址              | `https://api.openai.com/v1`                                  |
| `OPENAI_MODEL`           | 否   | 默认 AI 模型                 | `gpt-4o-mini`                                                |
| `PORT`                   | 否   | API 服务端口                 | `3001`                                                       |
| `NODE_ENV`               | 否   | 运行环境                     | `development`                                                |
| `SMTP_HOST`              | 否   | SMTP 邮件服务器              | `smtp.example.com`                                           |
| `SMTP_PORT`              | 否   | SMTP 端口                    | `587`                                                        |
| `SMTP_USER`              | 否   | SMTP 用户名                  | —                                                            |
| `SMTP_PASS`              | 否   | SMTP 密码                    | —                                                            |
| `FRONTEND_URL`           | 否   | 前端地址（邮件链接用）       | `http://localhost:3000`                                      |
| `THROTTLE_TTL`           | 否   | 速率限制窗口（秒）           | `60`                                                         |
| `THROTTLE_LIMIT`         | 否   | 速率限制最大请求数           | `100`                                                        |

### Web 环境变量（`apps/web/.env`）

| 变量                   | 必填 | 说明                | 示例值                  |
| ---------------------- | ---- | ------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL`  | 是   | API 服务地址        | `http://localhost:3001` |
| `NEXT_PUBLIC_WS_URL`   | 否   | WebSocket 地址      | 默认同 API URL          |
| `NEXT_PUBLIC_SITE_URL` | 否   | 站点 URL（SSR 用）  | `http://localhost:3000` |
| `NEXT_PUBLIC_GA_ID`    | 否   | Google Analytics ID | `G-XXXXXXXX`            |

### Mobile 环境变量（`apps/mobile/.env`）

| 变量                  | 必填 | 说明         | 示例值                  |
| --------------------- | ---- | ------------ | ----------------------- |
| `EXPO_PUBLIC_API_URL` | 是   | API 服务地址 | `http://localhost:3001` |

---

## 7. API 快速测试

### 健康检查

```bash
# 基础健康检查
curl http://localhost:3001/health

# 详细健康检查（含 DB/Redis 延迟）
curl http://localhost:3001/health/detailed

# Kubernetes 探针
curl http://localhost:3001/health/live     # 存活探针
curl http://localhost:3001/health/ready    # 就绪探针
curl http://localhost:3001/health/startup  # 启动探针
```

### 用户注册与登录

```bash
# 注册
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123456!", "name": "测试用户"}'

# 登录（获取 JWT）
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123456!"}'
```

### 使用 JWT 访问受保护端点

```bash
# 将登录返回的 token 赋值给变量
TOKEN="eyJhbG..."

# 获取当前用户信息
curl http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 获取学校列表
curl "http://localhost:3001/api/v1/schools?page=1&take=10" \
  -H "Authorization: Bearer $TOKEN"
```

### Swagger UI

浏览器访问 `http://localhost:3001/api/docs`，可交互式测试所有 API 端点。点击 "Authorize" 按钮输入 JWT Token 即可调用受保护接口。

---

## 8. 常用文件路径

| 路径                                | 说明                             |
| ----------------------------------- | -------------------------------- |
| `apps/api/`                         | NestJS 后端应用                  |
| `apps/api/src/modules/`             | 业务模块（28 个）                |
| `apps/api/prisma/schema.prisma`     | 数据库模型定义（70 个模型）      |
| `apps/api/prisma/migrations/`       | 数据库迁移文件                   |
| `apps/api/prisma/seed.ts`           | 种子数据脚本                     |
| `apps/api/.env`                     | API 环境变量                     |
| `apps/web/`                         | Next.js 前端应用                 |
| `apps/web/src/app/[locale]/`        | 国际化路由页面                   |
| `apps/web/src/components/`          | 前端组件库                       |
| `apps/web/src/hooks/`               | 自定义 React Hooks               |
| `apps/web/src/messages/`            | i18n 翻译文件（en.json/zh.json） |
| `apps/web/src/middleware.ts`        | Next.js 中间件（路由/国际化）    |
| `apps/web/.env`                     | Web 环境变量                     |
| `apps/mobile/`                      | Expo 移动端应用                  |
| `apps/mobile/src/app/`              | Expo Router 页面                 |
| `apps/mobile/src/components/ui/`    | 移动端 UI 组件库（26 个组件）    |
| `apps/mobile/src/lib/i18n/locales/` | 移动端翻译文件                   |
| `packages/shared/`                  | 前后端共享类型与工具             |
| `docs/`                             | 项目文档目录                     |
| `docs/adr/`                         | 架构决策记录（ADR）              |
| `docker-compose.yml`                | Docker 服务定义                  |
| `turbo.json`                        | Turborepo 任务配置               |
| `commitlint.config.js`              | 提交信息校验配置                 |
| `.husky/`                           | Git Hooks 配置                   |
| `eslint.config.mjs`                 | ESLint 配置                      |

---

## 9. 求助链接

| 文档                                                             | 说明                     |
| ---------------------------------------------------------------- | ------------------------ |
| [ONBOARDING.md](ONBOARDING.md)                                   | 新人入职指南             |
| [ARCHITECTURE.md](ARCHITECTURE.md)                               | 系统架构设计             |
| [API_REFERENCE.md](API_REFERENCE.md)                             | API 端点参考             |
| [RUNBOOK.md](RUNBOOK.md)                                         | 运维排障手册（生产环境） |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md)                         | 开发环境排障指南         |
| [CONTRIBUTING.md](../CONTRIBUTING.md)                            | 开发规范与协作流程       |
| [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)                     | 测试清单                 |
| [CODE_REVIEW.md](CODE_REVIEW.md)                                 | Code Review 指南         |
| [I18N_GUIDE.md](I18N_GUIDE.md)                                   | 国际化开发指南           |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)                             | 设计系统规范             |
| [DOCUMENTATION_STANDARDS.md](DOCUMENTATION_STANDARDS.md)         | 文档编写标准             |
| [DEPLOY.md](DEPLOY.md)                                           | 部署指南                 |
| [GLOSSARY.md](GLOSSARY.md)                                       | 项目术语表               |
| [技术文档/已知问题与解决方案.md](技术文档/已知问题与解决方案.md) | 已知问题与修复记录       |
| [AI_AGENT_ARCHITECTURE.md](AI_AGENT_ARCHITECTURE.md)             | AI Agent 系统架构        |

---

_最后更新: 2026-02-13_
