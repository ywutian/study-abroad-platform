# 留学申请平台 (Study Abroad Platform)

AI 驱动的智能留学申请辅助平台，提供选校推荐、录取预测、案例分析等功能。

## 🚀 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 8
- PostgreSQL >= 16
- Redis >= 7 (可选，用于缓存)

### 本地开发

```bash
# 1. 克隆项目
git clone <repository-url>
cd study-abroad-platform

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. 启动数据库 (Docker)
docker compose up -d postgres redis

# 5. 初始化数据库
pnpm --filter api db:generate
pnpm --filter api db:push
pnpm --filter api db:seed  # 可选：填充示例数据

# 6. 启动开发服务器
pnpm dev
```

访问：

- 前端: http://localhost:3000
- API: http://localhost:3001
- API 文档: http://localhost:3001/api/docs

## 📁 项目结构

```
study-abroad-platform/
├── apps/
│   ├── api/                 # NestJS 后端
│   │   ├── src/
│   │   │   ├── modules/     # 功能模块
│   │   │   ├── common/      # 公共组件
│   │   │   └── prisma/      # 数据库服务
│   │   └── prisma/
│   │       └── schema.prisma
│   ├── web/                 # Next.js 前端
│   │   ├── src/
│   │   │   ├── app/         # 页面路由
│   │   │   ├── components/  # UI 组件
│   │   │   ├── lib/         # 工具库
│   │   │   └── stores/      # 状态管理
│   │   └── messages/        # 国际化文件
│   └── mobile/              # React Native 移动端
│       ├── src/
│       │   ├── app/         # Expo Router 页面
│       │   ├── components/  # UI 组件库
│       │   ├── lib/         # API/i18n/存储
│       │   └── stores/      # 状态管理
│       └── assets/          # 应用资源
├── packages/
│   └── shared/              # 共享类型定义
└── docker-compose.yml
```

## 🔧 环境变量

### API (.env)

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/studyabroad"

# JWT 认证
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# 邮件服务 (可选)
SMTP_HOST="smtp.example.com"
SMTP_USER="your-email"
SMTP_PASS="your-password"

# AI 服务 (可选)
OPENAI_API_KEY="sk-xxx"

# 其他
CORS_ORIGIN="http://localhost:3000"
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### Web (.env)

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

## 📦 常用命令

```bash
# 开发
pnpm dev                    # 启动所有服务 (前端默认 Webpack 模式)
pnpm --filter api dev       # 仅启动 API
pnpm --filter web dev       # 仅启动前端 (Webpack 模式，推荐)
pnpm --filter web dev:turbo # 仅启动前端 (Turbopack 模式，实验性)
pnpm --filter mobile start  # 启动移动端 (Expo)

# 构建
pnpm build                  # 构建所有
pnpm --filter api build     # 构建 API
pnpm --filter web build     # 构建前端
pnpm --filter mobile ios    # 移动端 iOS
pnpm --filter mobile android # 移动端 Android

# 测试
pnpm --filter api test      # 单元测试
pnpm --filter api test:e2e  # E2E 测试
pnpm --filter api test:cov  # 测试覆盖率

# 数据库
pnpm --filter api db:generate  # 生成 Prisma Client
pnpm --filter api db:push      # 同步 Schema
pnpm --filter api db:migrate   # 运行迁移
pnpm --filter api db:studio    # 打开 Prisma Studio
pnpm --filter api db:seed      # 填充示例数据

# 代码质量
pnpm lint                   # 检查所有
pnpm format                 # 格式化代码
```

## 🚢 部署

### Docker 部署

```bash
# 生产构建
docker compose -f docker-compose.prod.yml up -d

# 查看日志
docker compose logs -f api
```

### 手动部署

1. 构建项目

```bash
pnpm build
```

2. 启动 API

```bash
cd apps/api
NODE_ENV=production node dist/main.js
```

3. 启动前端 (可选: 使用 Vercel/Cloudflare Pages)

```bash
cd apps/web
pnpm start
```

## 🔒 安全配置

生产环境必须配置：

- [ ] 更改默认数据库密码
- [ ] 设置强 JWT_SECRET (至少 32 字符)
- [ ] 配置 CORS_ORIGIN 为实际域名
- [ ] 启用 HTTPS
- [ ] 配置防火墙规则

## 📖 API 文档

启动服务后访问 Swagger 文档：

- 开发环境: http://localhost:3001/api/docs
- 生产环境: https://api.your-domain.com/api/docs

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)
