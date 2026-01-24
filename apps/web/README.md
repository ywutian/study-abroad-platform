# Study Abroad Platform - Web

Next.js 16 前端应用，支持国际化和暗黑模式。

## 技术栈

- **框架**: Next.js 16.1 (默认 Turbopack)
- **语言**: TypeScript 5.x
- **UI 库**: Radix UI + Tailwind CSS 4
- **样式**: tailwind-merge, class-variance-authority
- **状态管理**: Zustand 5
- **数据获取**: TanStack Query 5
- **国际化**: next-intl 4
- **表单**: React Hook Form + Zod
- **动画**: Framer Motion 12
- **图标**: Lucide React
- **实时通信**: Socket.IO Client
- **监控**: Sentry
- **字体**: Geist (via next/font)
- **部署**: Cloudflare Pages (OpenNext)

## 项目结构

```
src/
├── app/
│   └── [locale]/
│       ├── (auth)/           # 认证页面 (登录/注册/忘记密码/邮箱验证)
│       ├── (main)/           # 主要页面 (29个路由组)
│       │   ├── admin/        # 管理后台
│       │   ├── ai/           # AI 助手
│       │   ├── cases/        # 录取案例
│       │   ├── chat/         # 实时聊天
│       │   ├── dashboard/    # 仪表盘
│       │   ├── forum/        # 论坛
│       │   ├── hall/         # 功能大厅
│       │   ├── prediction/   # 录取预测
│       │   ├── profile/      # 个人档案
│       │   ├── ranking/      # 排名系统
│       │   ├── schools/      # 学校库
│       │   └── ...           # 其他页面
│       └── layout.tsx        # 根布局
├── components/
│   ├── ui/                   # 基础 UI 组件 (61个)
│   ├── features/             # 功能组件
│   └── layout/               # 布局组件
├── hooks/                    # 自定义 Hooks
├── lib/
│   └── api/                  # API 客户端
├── stores/                   # Zustand 状态管理
├── messages/                 # i18n 翻译文件
│   ├── en.json
│   └── zh.json
└── middleware.ts             # 国际化 + 认证中间件
```

## 开发

### 环境要求

- Node.js >= 18
- pnpm >= 10

### 开发命令

```bash
# 启动开发服务器 (Turbopack, 默认)
pnpm --filter web dev

# 使用 Webpack 启动 (如遇 Turbopack 兼容性问题)
pnpm --filter web dev:webpack

# 构建生产版本
pnpm --filter web build

# 启动生产服务
pnpm --filter web start
```

### 代码检查

```bash
# ESLint
pnpm --filter web lint

# i18n 翻译完整性检查
pnpm --filter web lint:i18n

# 排版规范检查
pnpm --filter web lint:typography
```

## 环境变量

在 `apps/web` 目录下创建 `.env.local` 文件：

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

## 部署

### Cloudflare Pages

```bash
# 构建 Cloudflare 版本
pnpm --filter web build:cloudflare

# 本地预览
pnpm --filter web preview

# 部署
pnpm --filter web deploy
```

## 主要功能

- 用户认证 (登录/注册/邮箱验证/密码重置)
- 学校库浏览与搜索
- 录取案例社区
- AI Agent 对话 (流式响应)
- 文书 AI 辅助
- 录取预测
- 实时聊天
- 论坛
- 个人档案管理
- 排名系统
- 国际化 (中文/英文)
- 暗黑/明亮主题切换
- PWA 支持
