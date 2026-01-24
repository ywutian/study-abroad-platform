# 新人入职指南

> 目标：新成员在 3 天内完成环境搭建，1 周内提交首个 PR。

## 目录

1. [第一天：环境搭建](#第一天环境搭建)
2. [第二天：代码熟悉](#第二天代码熟悉)
3. [第三天：首个任务](#第三天首个任务)
4. [参考文档索引](#参考文档索引)
5. [常见问题](#常见问题)

---

## 第一天：环境搭建

### 1.1 前置要求

| 工具             | 版本要求 | 安装方式                         |
| ---------------- | -------- | -------------------------------- |
| Node.js          | >= 18    | `nvm install --lts`              |
| pnpm             | >= 10    | `npm install -g pnpm`            |
| Docker Desktop   | 最新版   | [docker.com](https://docker.com) |
| Git              | 2.40+    | `brew install git` (macOS)       |
| VS Code / Cursor | 最新版   | 推荐使用 Cursor                  |

### 1.2 获取代码

```bash
# 1. Clone 仓库（需要仓库访问权限，联系 Tech Lead）
git clone <repo-url>
cd study-abroad-platform

# 2. 切换到开发分支
git checkout feature/major-updates

# 3. 安装依赖
pnpm install
```

### 1.3 环境配置

```bash
# 1. 复制环境变量模板
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 2. 编辑 .env 文件（参考 ENV_TEMPLATE.md 获取各变量说明）
```

关键环境变量：

| 变量             | 说明              | 示例                                                         |
| ---------------- | ----------------- | ------------------------------------------------------------ |
| `DATABASE_URL`   | PostgreSQL 连接串 | `postgresql://postgres:postgres@localhost:5432/study_abroad` |
| `REDIS_URL`      | Redis 连接串      | `redis://localhost:6379`                                     |
| `JWT_SECRET`     | JWT 签名密钥      | 随机 32 位字符串                                             |
| `OPENAI_API_KEY` | OpenAI API 密钥   | 向 Tech Lead 申请                                            |

### 1.4 启动服务

```bash
# 1. 启动数据库和 Redis
docker compose up -d db redis

# 2. 初始化数据库
cd apps/api
npx prisma migrate deploy   # 应用迁移
npx prisma db seed           # 填充种子数据

# 3. 启动后端
pnpm --filter api dev        # http://localhost:3001

# 4. 启动前端（新终端）
pnpm --filter web dev        # http://localhost:3000 (Turbopack 模式)
```

### 1.5 验证

- 访问 `http://localhost:3001/api/v1/health` → 应返回 `{ "status": "ok" }`
- 访问 `http://localhost:3000` → 应看到登录页面
- 运行测试：`pnpm --filter api test` → 24/24 套件通过

---

## 第二天：代码熟悉

### 2.1 必读文档

按顺序阅读：

1. **[ARCHITECTURE.md](ARCHITECTURE.md)** — 整体架构（重点看 Section 1-4）
2. **[API_REFERENCE.md](API_REFERENCE.md)** — API 端点概览
3. **[CONTRIBUTING.md](../CONTRIBUTING.md)** — 开发规范和 Git 工作流
4. **[ADR 目录](adr/)** — 架构决策记录（理解历史决策）

### 2.2 代码结构速览

```text
study-abroad-platform/
  apps/
    api/               ← NestJS 后端（重点）
      src/
        modules/       ← 业务模块（28 个）
          auth/        ← 认证模块（入手推荐）
          profile/     ← 用户档案
          school/      ← 学校数据
          ai-agent/    ← AI Agent（最复杂）
        common/        ← 公共模块（guards, filters, interceptors）
      prisma/
        schema.prisma  ← 数据模型定义
    web/               ← Next.js 前端
      src/
        app/[locale]/  ← 国际化路由
        components/    ← 组件库
        hooks/         ← 自定义 Hooks
        lib/           ← 工具函数
  packages/
    shared/            ← 前后端共享类型与工具
```

### 2.3 推荐上手路径

1. **从 `auth` 模块开始** — 最简单的 CRUD 模块，理解 NestJS 模块结构
2. **看 `profile` 模块** — 标准的增删改查 + 子资源（test-scores, activities, awards）
3. **看 `school` 模块** — 数据查询 + 分页 + 筛选
4. **最后看 `ai-agent` 模块** — 最复杂的模块，包含 Agent 系统

### 2.4 数据模型

```bash
# 可视化查看数据模型
npx prisma studio  # 打开 http://localhost:5555
```

核心模型关系：`User → Profile → TestScore / Activity / Award / Essay`

---

## 第三天：首个任务

### 3.1 新手任务建议

- 修复一个标记为 `good-first-issue` 的 Issue
- 给现有 Service 添加单元测试
- 给缺少中文翻译的页面补充翻译

### 3.2 提交你的第一个 PR

```bash
# 1. 创建分支
git checkout -b feature/your-task-name

# 2. 编写代码，确保：
#    - TypeScript 严格模式无报错
#    - lint 通过: pnpm lint
#    - 测试通过: pnpm --filter api test

# 3. 提交（遵循 Conventional Commits）
git add .
git commit -m "feat(module): add xxx feature"

# 4. 推送并创建 PR
git push -u origin feature/your-task-name
# 在 GitHub 上创建 PR，使用 PR 模板
```

---

## 参考文档索引

| 文档                                         | 说明                 |
| -------------------------------------------- | -------------------- |
| [ARCHITECTURE.md](ARCHITECTURE.md)           | 系统架构（核心文档） |
| [API_REFERENCE.md](API_REFERENCE.md)         | API 端点参考         |
| [CONTRIBUTING.md](../CONTRIBUTING.md)        | 开发规范             |
| [RUNBOOK.md](RUNBOOK.md)                     | 运维排障             |
| [SECURITY.md](../SECURITY.md)                | 安全策略             |
| [CHANGELOG.md](../CHANGELOG.md)              | 变更日志             |
| [ENV_TEMPLATE.md](../ENV_TEMPLATE.md)        | 环境变量说明         |
| [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) | 测试清单             |
| [ADR 目录](adr/)                             | 架构决策记录         |
| [GLOSSARY.md](GLOSSARY.md)                   | 术语表               |

---

## 常见问题

### Q: `pnpm install` 报错 `EACCES`

使用 nvm 管理 Node.js，不要使用系统全局安装的 Node。

### Q: `prisma migrate deploy` 报错

确保 PostgreSQL 已启动：`docker compose up -d db`，然后检查 `.env` 中的 `DATABASE_URL`。

### Q: 前端页面 404

确保使用 Turbopack 模式启动：`pnpm --filter web dev`（Next.js 16 默认使用 Turbopack；如需 Webpack 可使用 `dev:webpack`），详见 [ADR-0001](adr/0001-use-nextjs-turbopack-webpack-fallback.md)。

### Q: 测试失败

先运行 `pnpm --filter api test` 确认是否为已知问题。如果是新引入的失败，检查 mock 是否完整（参考 [已知问题与解决方案](技术文档/已知问题与解决方案.md)）。

### Q: OpenAI API Key 从哪里获取？

联系 Tech Lead 获取开发环境密钥。不要使用个人密钥。

---

_最后更新: 2026-02-13_
