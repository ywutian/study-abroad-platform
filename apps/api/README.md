# Study Abroad Platform - API

NestJS 11 后端服务，提供 RESTful API 和 WebSocket 实时通信。

## 技术栈

- **框架**: NestJS 11 (Express 5)
- **语言**: TypeScript 5.7
- **ORM**: Prisma 5.22 (PostgreSQL + pgvector)
- **缓存**: Redis (ioredis)
- **队列**: BullMQ
- **认证**: Passport + JWT
- **AI**: OpenAI SDK 6.x
- **文档**: Swagger (`/api/docs` 开发环境)
- **监控**: Sentry
- **测试**: Jest 30

## 项目结构

```
src/
├── modules/              # 功能模块 (28个)
│   ├── admin/            # 管理后台
│   ├── ai-agent/         # AI Agent (32个工具)
│   ├── auth/             # 认证 (JWT + 邮箱验证)
│   ├── case/             # 录取案例
│   ├── chat/             # 实时聊天 (WebSocket)
│   ├── essay-ai/         # 文书 AI 辅助
│   ├── essay-scraper/    # 文书爬取
│   ├── forum/            # 论坛
│   ├── hall/             # 功能大厅
│   ├── health/           # 健康检查
│   ├── notification/     # 通知系统
│   ├── prediction/       # 录取预测
│   ├── profile/          # 个人档案
│   ├── ranking/          # 排名系统
│   ├── school/           # 学校库
│   ├── subscription/     # 订阅
│   ├── vault/            # 安全保险库
│   └── ...               # 其他模块
├── common/               # 公共模块 (guards, filters, pipes)
└── main.ts               # 入口文件 (端口 3001, 前缀 api/v1)
prisma/
├── schema.prisma         # 数据模型 (70个 model)
├── migrations/           # 数据库迁移
└── seed.ts               # 种子数据
```

## 开发

### 环境要求

- Node.js >= 18
- pnpm >= 10
- PostgreSQL 15+ (含 pgvector 扩展)
- Redis 7+

### 环境准备

```bash
# 在项目根目录启动数据库和 Redis
pnpm docker:up    # 启动 db 和 redis 容器

# 安装依赖
pnpm install

# 生成 Prisma Client
pnpm --filter api db:generate

# 运行数据库迁移
pnpm --filter api db:migrate

# 填充种子数据
pnpm --filter api db:seed
```

### 开发命令

```bash
# 启动开发服务器 (watch 模式)
pnpm --filter api dev

# 启动生产模式
pnpm --filter api start:prod

# Prisma Studio (数据库可视化)
pnpm --filter api db:studio
```

### 测试

```bash
# 运行单元测试
pnpm --filter api test

# 监视模式
pnpm --filter api test:watch

# 覆盖率报告
pnpm --filter api test:cov

# E2E 测试
pnpm --filter api test:e2e
```

覆盖率门槛：statements 60%、branches 50%、functions 50%、lines 60%。

### 代码检查

```bash
pnpm --filter api lint
pnpm --filter api format
```

## 环境变量

复制 `.env.example` 创建 `.env` 文件，核心变量：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/study_abroad
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-key
CORS_ORIGINS=http://localhost:3000
```

## API 端点

服务运行于 `http://localhost:3001`，所有路由前缀 `/api/v1`。

开发环境可通过 `/api/docs` 访问 Swagger UI 查看完整 API 文档。

## 安全特性

- JWT + Refresh Token 轮换
- RBAC 权限控制 (ADMIN / VERIFIED / USER)
- 速率限制 (per-endpoint 可配置)
- Helmet CSP + HSTS (生产环境)
- Zod 环境变量启动校验
- Prisma 异常分类处理
