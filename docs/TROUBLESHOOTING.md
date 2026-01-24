# 开发环境排障指南

> 本指南针对**本地开发环境**的常见问题。生产环境排障请参考 [RUNBOOK.md](RUNBOOK.md)。

**最后更新**: 2026-02-13

## 目录

1. [环境搭建问题](#1-环境搭建问题)
2. [API 服务问题](#2-api-服务问题)
3. [Web 前端问题](#3-web-前端问题)
4. [移动端问题](#4-移动端问题)
5. [测试问题](#5-测试问题)
6. [Git 与 CI 问题](#6-git-与-ci-问题)

---

## 1. 环境搭建问题

### 1.1 Node.js / pnpm 版本不匹配

**症状**：

- `pnpm install` 报错 `ERR_PNPM_UNSUPPORTED_ENGINE`
- 运行命令时出现 `SyntaxError: Unexpected token`
- 提示 `This project requires Node.js >= 18`

**原因**：项目要求 Node.js >= 18，pnpm >= 10（`packageManager: pnpm@10.22.0`）。系统全局安装的 Node.js 版本可能过低，或 pnpm 版本不匹配。

**解决方案**：

```bash
# 检查当前版本
node -v   # 应为 v18.x 或更高
pnpm -v   # 应为 10.x

# 使用 nvm 安装并切换 Node.js 版本
nvm install 22
nvm use 22

# 安装正确版本的 pnpm
corepack enable
corepack prepare pnpm@10.22.0 --activate

# 或直接安装
npm install -g pnpm@10
```

### 1.2 pnpm install 失败

**症状**：

- `EACCES` 权限错误
- Peer dependency 警告或错误
- `ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY` 锁文件不一致

**原因**：使用系统全局 Node.js 导致权限问题；`pnpm-lock.yaml` 与 `package.json` 不同步；Radix UI 等库的 `@types/react` peer dep 警告（安全可忽略）。

**解决方案**：

```bash
# 权限问题 — 使用 nvm 管理 Node.js，避免全局安装
nvm install --lts
nvm use --lts

# 锁文件不同步 — 删除缓存重新安装
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install

# 如果仍然失败，尝试不冻结锁文件安装
pnpm install --no-frozen-lockfile

# Radix UI 的 @types/react peer dep 警告 — 安全可忽略
# 这些是 web 端依赖，不影响功能
```

### 1.3 Docker / PostgreSQL 连接问题

**症状**：

- `docker compose up -d db` 后容器立即退出
- API 启动时报 `Can't reach database server at localhost:5432`
- `pg_isready` 返回 `no response`

**原因**：Docker Desktop 未启动；端口 5432 被本地 PostgreSQL 占用；Docker 容器未正常启动。

**解决方案**：

```bash
# 1. 确认 Docker Desktop 正在运行
docker info

# 2. 检查容器状态
docker compose ps

# 3. 如果容器状态为 exited，查看日志
docker logs study-abroad-db

# 4. 检查端口是否被占用
lsof -i :5432

# 5. 如果被本地 PostgreSQL 占用，停止本地服务
# macOS (Homebrew)
brew services stop postgresql@16

# 6. 如果数据卷损坏，重建
docker compose down -v
docker compose up -d db

# 7. 等待健康检查通过后再启动 API
docker compose up -d db && sleep 5 && docker exec -it study-abroad-db pg_isready -U postgres
```

### 1.4 Redis 连接问题

**症状**：

- API 日志出现 `Redis connection refused` 或 `ECONNREFUSED 127.0.0.1:6379`
- AI Agent 功能缓存失效，响应变慢

**原因**：Redis 容器未启动；Redis 密码配置不匹配。注意 Redis 是**可选依赖**，API 会降级为内存缓存继续运行。

**解决方案**：

```bash
# 1. 启动 Redis 容器
docker compose up -d redis

# 2. 验证 Redis 运行
docker exec -it study-abroad-redis redis-cli -a redis_dev_password ping
# 应返回 PONG

# 3. 检查 .env 中的 REDIS_URL
# 默认开发值：redis://localhost:6379
# 如果 Docker Redis 设置了密码：redis://:redis_dev_password@localhost:6379

# 4. 如果无需 Redis，可以不设置 REDIS_URL
# API 会自动降级为内存缓存（日志会提示 fallback）
```

---

## 2. API 服务问题

### 2.1 端口被占用

**症状**：

- 启动 API 时报 `Error: listen EADDRINUSE: address already in use :::3001`

**原因**：上一次 API 进程未正常退出；其他服务占用了 3001 端口。

**解决方案**：

```bash
# 1. 查找占用端口的进程
lsof -i :3001

# 2. 终止进程
kill -9 <PID>

# 3. 或者修改端口（apps/api/.env）
PORT=3002

# 4. 重新启动
pnpm --filter api dev
```

### 2.2 Prisma 迁移失败

**症状**：

- `prisma migrate dev` 报 `P3009: migrate found failed migrations`
- `prisma migrate deploy` 报 `Migration has already been applied`
- Shadow database 创建失败

**原因**：迁移历史不一致（使用过 `prisma db push` 跳过迁移）；数据库已包含迁移对应的变更但 `_prisma_migrations` 表中无记录。

**解决方案**：

```bash
# 1. 检查迁移状态
cd apps/api
npx prisma migrate status

# 2. 如果有 "failed" 迁移，标记为已回滚
npx prisma migrate resolve --rolled-back <migration_name>

# 3. 如果数据库已包含变更但缺少迁移记录，标记为已应用
npx prisma migrate resolve --applied <migration_name>

# 4. 如果迁移完全混乱，可重置开发数据库（会丢失数据！）
npx prisma migrate reset

# 5. 最佳实践：开发新功能时，优先使用 migrate 而非 db push
npx prisma migrate dev --create-only --name add_new_feature
npx prisma migrate dev
```

### 2.3 Prisma generate 错误

**症状**：

- TypeScript 提示 Prisma 类型不存在（如 `Property 'xxx' does not exist on type 'PrismaClient'`）
- 启动 API 时报 `Cannot find module '.prisma/client'`

**原因**：修改 `schema.prisma` 后未重新生成 Prisma Client；`node_modules` 被清除后未重新 generate。

**解决方案**：

```bash
cd apps/api

# 重新生成 Prisma Client
npx prisma generate

# 或者通过 Turbo 从根目录运行
pnpm db:generate

# 如果仍然报错，尝试清除并重新安装
rm -rf node_modules/.prisma
pnpm install
npx prisma generate
```

### 2.4 JWT / Auth Token 问题

**症状**：

- 所有受保护 API 返回 `401 Unauthorized`
- Token 过期错误 `jwt expired`
- `invalid signature` 错误

**原因**：`.env` 中 `JWT_SECRET` 未设置或少于 16 字符；Token 已过期（默认 15 分钟）；API 重启后 secret 变更导致旧 Token 失效。

**解决方案**：

```bash
# 1. 检查 .env 配置
# JWT_SECRET 必须 >= 16 字符
# JWT_REFRESH_SECRET 必须设置

# 2. 重新登录获取新 Token
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123456!"}'

# 3. 在 Swagger UI 中测试
# 访问 http://localhost:3001/api/docs
# 点击 Authorize 按钮，输入 Bearer <token>

# 4. 开发环境建议延长 Token 有效期
# apps/api/.env
JWT_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="30d"
```

### 2.5 Swagger UI 无法加载

**症状**：

- 访问 `http://localhost:3001/api/docs` 返回 404
- Swagger 页面空白或 JSON 解析错误
- 日志出现 `Swagger UI failed to initialize`

**原因**：`NODE_ENV` 设置为 `production`（Swagger 仅非生产环境可用）；Swagger 装饰器配置错误导致初始化失败。

**解决方案**：

```bash
# 1. 确认 NODE_ENV 不是 production
echo $NODE_ENV
# 或检查 apps/api/.env
# NODE_ENV=development

# 2. 确认 API 已正常启动
curl http://localhost:3001/health

# 3. 查看 API 启动日志中是否有 Swagger 相关警告
# 正常应看到: "Swagger UI enabled at /api/docs"
# 如果看到: "Swagger UI failed to initialize: ..."
# 检查新增的 Controller 是否有 Swagger 装饰器语法错误

# 4. 尝试直接访问 Swagger JSON
curl http://localhost:3001/api/docs-json
```

### 2.6 环境变量校验失败

**症状**：

- API 启动时出现 `ENVIRONMENT VARIABLE VALIDATION FAILED`

**原因**：必填环境变量缺失或格式不正确。

**解决方案**：

```bash
# 1. 错误消息会列出所有不合格的变量名
# 常见问题：
#   - DATABASE_URL 未以 postgresql:// 开头
#   - JWT_SECRET 少于 16 字符
#   - PORT 非数字或超出 1-65535

# 2. 从模板重新创建
cp apps/api/.env.example apps/api/.env

# 3. 填写必要的值
# 最少需要：DATABASE_URL 和 JWT_SECRET
```

---

## 3. Web 前端问题

### 3.1 Turbopack 构建错误 / 回退到 Webpack

**症状**：

- `pnpm --filter web dev` 报 Turbopack 相关错误
- 页面返回 404，尤其是路由组内的页面（`(main)`, `(auth)`）
- 控制台出现模块解析错误

**原因**：Next.js 16 默认使用 Turbopack 编译器。在早期版本中存在路由组兼容性问题（已在 middleware 层修复，见 ADR-0001）。部分第三方库可能尚不完全兼容 Turbopack。

**解决方案**：

```bash
# 1. 首先确认 middleware.ts 使用排除式 matcher（核心修复）
# apps/web/src/middleware.ts 中应有：
# matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|...)).*)',]

# 2. 如果 Turbopack 仍有问题，切换到 Webpack 模式
pnpm --filter web dev:webpack

# 3. 清除 Next.js 缓存后重试 Turbopack
rm -rf apps/web/.next
pnpm --filter web dev

# 4. 如果特定第三方库不兼容 Turbopack
# 在 next.config.ts 中配置 transpilePackages
```

### 3.2 next-intl 国际化加载问题

**症状**：

- 页面显示 translation key 而非翻译文本（如 `common.login` 而非 "登录"）
- 控制台报 `Could not find messages for locale`
- 路由不自动重定向到 `/zh/` 或 `/en/`

**原因**：翻译文件中缺少对应的 key；`middleware.ts` 的 locale 检测配置有误；`[locale]` 动态段未正确传递。

**解决方案**：

```bash
# 1. 检查翻译 key 是否存在
# 查看 apps/web/src/messages/zh.json 和 en.json

# 2. 运行 i18n 一致性检查
pnpm --filter web lint:i18n

# 3. 自动生成缺失的翻译 key placeholder
pnpm --filter web exec npx tsx scripts/check-missing-keys.ts --fix

# 4. 检查 key 一致性（zh.json 与 en.json 的 key 应完全一致）
pnpm --filter web exec npx tsx scripts/check-translation-keys.ts

# 5. 检查翻译值语言是否正确（zh.json 中不应有英文值）
pnpm --filter web exec npx tsx scripts/check-wrong-language.ts

# 6. 确认 locale 路由重定向正常
# 访问 http://localhost:3000/ 应重定向到 /zh/ 或 /en/
# 检查 middleware.ts 中的 locales 配置
```

### 3.3 Tailwind CSS 样式不生效

**症状**：

- 组件没有样式或样式错乱
- 新添加的 Tailwind 类名无效
- 暗黑模式切换无效果

**原因**：Tailwind v4 使用新的 CSS-first 配置方式（通过 `@import` 和 `@theme`）；`content` 路径未覆盖新增文件；PostCSS 配置缺失。

**解决方案**：

```bash
# 1. 确认 globals.css 中有 Tailwind 导入
# apps/web/src/app/globals.css 应包含:
# @import "tailwindcss";

# 2. 确认 PostCSS 配置存在
# apps/web/postcss.config.js 或 postcss.config.mjs
# 应包含 @tailwindcss/postcss 插件

# 3. 清除 Next.js 缓存
rm -rf apps/web/.next
pnpm --filter web dev

# 4. 如果使用了 tw-animate-css，确认其导入顺序正确

# 5. 暗黑模式检查
# 确认 next-themes 的 ThemeProvider 已在 layout 中配置
# 确认 HTML 根元素有 class="dark" 或 data-theme 属性
```

### 3.4 热更新（HMR）不工作

**症状**：

- 修改代码后页面不自动刷新
- 终端显示文件变更但浏览器无反应
- 需要手动刷新才能看到变更

**原因**：文件监视器达到系统限制；WebSocket 连接断开；缓存文件损坏。

**解决方案**：

```bash
# 1. 增加文件监视器限制（macOS 通常不需要，Linux 可能需要）
# Linux:
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 2. 清除 Next.js 缓存
rm -rf apps/web/.next
pnpm --filter web dev

# 3. 检查浏览器 DevTools Console 是否有 WebSocket 错误

# 4. 尝试 Webpack 模式（HMR 实现不同）
pnpm --filter web dev:webpack

# 5. 确认不是浏览器缓存问题 — 使用 Ctrl+Shift+R 强制刷新
```

---

## 4. 移动端问题

### 4.1 Expo 启动失败

**症状**：

- `expo start` 报错 `Cannot find module 'expo'`
- Metro Bundler 无法启动
- 二维码无法显示

**原因**：依赖未安装完整；Expo CLI 版本不匹配；全局 Expo CLI 与项目版本冲突。

**解决方案**：

```bash
# 1. 确保依赖已安装（从项目根目录）
pnpm install

# 2. 使用项目本地的 Expo CLI（而非全局安装）
pnpm --filter study-abroad-mobile start

# 3. 如果有全局 expo-cli，建议卸载
npm uninstall -g expo-cli

# 4. 清除 Expo 缓存
pnpm --filter study-abroad-mobile start -- --clear

# 5. 检查 Expo SDK 版本
# apps/mobile/package.json 中 "expo": "~54.0.33"
# 确保所有 expo-* 包版本兼容 SDK 54
```

### 4.2 Metro Bundler 问题

**症状**：

- `Unable to resolve module` 错误
- 模块路径别名（`@/`）无法解析
- 加载极慢或卡在 "Building JavaScript bundle"

**原因**：Metro 缓存损坏；`babel.config.js` 中的 `module-resolver` 配置错误；pnpm monorepo 的 symlink 结构需要特殊的 `transformIgnorePatterns`。

**解决方案**：

```bash
# 1. 清除 Metro 缓存
pnpm --filter study-abroad-mobile start -- --reset-cache

# 2. 清除 Expo 临时文件
rm -rf apps/mobile/.expo
rm -rf apps/mobile/node_modules/.cache

# 3. 检查路径别名配置
# apps/mobile/babel.config.js 中应有 module-resolver 插件
# jest.config.js 中的 moduleNameMapper 应与之一致

# 4. 如果 monorepo 包（@study-abroad/shared）无法解析
# 确认 packages/shared 已正确构建
pnpm --filter @study-abroad/shared build

# 5. 检查 transformIgnorePatterns（pnpm monorepo 特殊配置）
# jest.config.js 中需包含 .pnpm 在例外列表中
```

### 4.3 iOS 模拟器 / Android 模拟器问题

**症状**：

- iOS: `No simulator available` 或 `xcrun: error`
- Android: `No connected devices` 或 `adb: command not found`
- 模拟器启动但应用闪退

**原因**：开发工具版本不足；模拟器未配置或未安装；Android SDK 路径未设置。

**解决方案**：

```bash
# === iOS (macOS only) ===

# 1. 确认 Xcode 已安装且命令行工具已配置
xcode-select --install
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# 2. 安装 iOS 模拟器运行时
# 打开 Xcode > Settings > Platforms > 下载 iOS Simulator

# 3. 列出可用模拟器
xcrun simctl list devices

# 4. 启动 iOS 模拟器
pnpm --filter study-abroad-mobile ios

# === Android ===

# 1. 安装 Android Studio 并配置 SDK
# 确保 ANDROID_HOME 环境变量已设置
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools

# 2. 创建 AVD（Android Virtual Device）
# 打开 Android Studio > Virtual Device Manager > 创建新设备

# 3. 启动 Android 模拟器
pnpm --filter study-abroad-mobile android
```

### 4.4 React Native 版本不匹配警告

**症状**：

- 控制台出现 `Warning: peer dependency react-native@xxx not satisfied`
- 某些原生模块编译失败
- 运行时报 `Invariant Violation` 错误

**原因**：Expo SDK 54 锁定了 React Native 0.81.5 和 React 19.1。某些社区库可能未声明对此版本的兼容性。

**解决方案**：

```bash
# 1. 检查依赖兼容性
npx expo-doctor

# 2. 如果是 peer dep 警告但功能正常，通常可以忽略

# 3. 确认核心版本一致（apps/mobile/package.json）
# "react": "19.1.0"
# "react-native": "0.81.5"
# "expo": "~54.0.33"

# 4. 如果某个库不兼容，考虑：
#    - 寻找替代库
#    - 在 pnpm overrides 中强制版本
#    - 提 Issue 到上游库
```

### 4.5 Reanimated / Worklets 插件问题

**症状**：

- 编译报错 `Reanimated plugin is not added to the babel config`
- 运行时报 `ReanimatedError: Trying to access a property on a non-shared value`
- 动画不生效或应用崩溃

**原因**：Reanimated 4 需要配置 `react-native-worklets/plugin` Babel 插件（而非旧版的 `react-native-reanimated/plugin`）。

**解决方案**：

```bash
# 1. 检查 babel.config.js 中的插件配置
# 应包含：plugins: ['react-native-worklets/plugin']
# 注意：Reanimated 4 使用 worklets 插件，而非旧版 reanimated 插件

# 2. 清除 Metro 缓存
pnpm --filter study-abroad-mobile start -- --reset-cache

# 3. 如果使用 Hermes 引擎（默认），确认不冲突
# Reanimated 4 + Hermes 通常开箱即用

# 4. 检查版本兼容
# react-native-reanimated: ~4.1.6
# react-native-worklets: ^0.7.3
# 两者版本必须匹配
```

---

## 5. 测试问题

### 5.1 Jest 配置错误

**症状**：

- `SyntaxError: Cannot use import statement outside a module`
- `TypeError: Jest: a transform must export a 'process' function`
- 模块路径 `@/` 无法解析

**原因**：TypeScript 转译配置缺失；`transformIgnorePatterns` 未包含需要转译的 node_modules 包；`moduleNameMapper` 与路径别名不匹配。

**解决方案**：

```bash
# === API 测试（NestJS） ===
# Jest 配置在 apps/api/package.json 的 "jest" 字段
# 使用 ts-jest 转译器

# 1. 确认 transform 配置
# "transform": { "^.+\\.(t|j)s$": "ts-jest" }

# 2. 运行测试
pnpm --filter api test

# === Mobile 测试（Expo） ===
# Jest 配置在 apps/mobile/jest.config.js
# 使用 jest-expo 预设

# 1. pnpm monorepo 的特殊 transformIgnorePatterns
# 需要包含 .pnpm 在例外列表中（见 jest.config.js）

# 2. 确认 moduleNameMapper 与 babel module-resolver 一致
# '@/(.*)$': '<rootDir>/src/$1'

# 3. 清除 Jest 缓存
pnpm --filter study-abroad-mobile test -- --clearCache
pnpm --filter api test -- --clearCache
```

### 5.2 测试数据库配置

**症状**：

- 测试运行时报 `Can't reach database server`
- 测试数据污染开发数据库
- E2E 测试因数据库状态不一致失败

**原因**：测试应 mock 数据库调用（单元测试）或使用独立测试数据库（E2E 测试）。

**解决方案**：

```bash
# 1. 单元测试：Mock PrismaService（推荐）
# 在 spec 文件中：
# {
#   provide: PrismaService,
#   useValue: {
#     user: { findUnique: jest.fn(), create: jest.fn(), ... },
#     $transaction: jest.fn(),
#   },
# }

# 2. E2E 测试：使用独立测试数据库
# 创建 apps/api/.env.test
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/study_abroad_test"

# 初始化测试数据库
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/study_abroad_test" \
  npx prisma migrate deploy

# 运行 E2E 测试
pnpm --filter api test:e2e
```

### 5.3 DI Mock 缺失

**症状**：

- `Nest can't resolve dependencies of the XxxService`
- `TypeError: Cannot read properties of undefined (reading 'methodName')`
- `xxx is not iterable`（mock 返回值类型错误）

**原因**：服务构造函数新增了依赖，但测试文件的 mock provider 未同步更新。这是本项目最常见的测试问题。

**解决方案**：

```typescript
// 1. 查看服务构造函数的所有依赖
// constructor(
//   private readonly prisma: PrismaService,
//   private readonly redis: RedisCacheService,  // 新增的
//   private readonly memory: MemoryManagerService, // 新增的
// ) {}

// 2. 在 spec 文件的 Test.createTestingModule providers 中添加 mock
// {
//   provide: RedisCacheService,
//   useValue: {
//     cacheMessage: jest.fn().mockResolvedValue(undefined),
//     getMessages: jest.fn().mockResolvedValue([]), // 注意：必须返回数组
//   },
// },
// {
//   provide: MemoryManagerService,
//   useValue: {
//     remember: jest.fn().mockResolvedValue(undefined),
//     recall: jest.fn().mockResolvedValue([]),
//   },
// }

// 关键要点：
// - Mock 方法名必须与实际服务方法名一致
// - 返回数组的方法必须 mock 返回 []（不能是 undefined）
// - @Optional() 装饰的依赖也需要 mock
```

详细案例见 [已知问题与解决方案 - 第 4 节](技术文档/已知问题与解决方案.md#4-单元测试-di-mock-缺失)。

---

## 6. Git 与 CI 问题

### 6.1 Pre-commit Hook 失败（Husky / lint-staged）

**症状**：

- `git commit` 被拒绝，提示 `lint-staged` 错误
- ESLint 或 Prettier 格式化失败
- `command not found: pnpm` 在 hook 中报错

**原因**：暂存的代码有 lint 错误；Husky 环境中找不到 pnpm（常见于使用 nvm 的用户）。

**解决方案**：

```bash
# 1. 手动运行 lint-staged 查看具体错误
pnpm exec lint-staged

# 2. 修复 lint 错误
pnpm lint

# 3. 格式化代码
pnpm format

# 4. 如果 hook 中找不到 pnpm
# 在 ~/.huskyrc 或 ~/.config/husky/init.sh 中添加：
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 5. 紧急跳过 hook（仅限特殊情况！）
git commit --no-verify -m "fix: emergency fix"
```

### 6.2 commitlint 校验失败

**症状**：

- `git commit` 被拒绝，提示 `subject may not be empty`
- 提示 `type must be one of [feat, fix, docs, ...]`

**原因**：提交信息不符合 Conventional Commits 格式。项目使用 `@commitlint/config-conventional` 配置。

**解决方案**：

```bash
# 正确格式
git commit -m "feat(auth): add OAuth2 login"
git commit -m "fix(profile): prevent GPA overflow"
git commit -m "docs: update API reference"

# 允许的 type:
# feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

# 允许的 scope（可选）:
# auth, profile, school, case, ai, forum, web, api, mobile

# 常见错误示例
# "Add login feature"          ← 缺少 type
# "feat add login"             ← 缺少冒号
# "Feat(auth): add login"      ← type 首字母不应大写
# "feat(auth):add login"       ← 冒号后缺少空格
```

### 6.3 i18n Pre-commit 检查失败

**症状**：

- 提交时报 `i18n check failed: missing translation keys detected`
- 提示 `zh.json and en.json keys are inconsistent`
- 提示 `wrong-language translations detected`

**原因**：修改了 `apps/web/src/` 下的代码或翻译文件，触发了自动 i18n 检查。代码中使用的翻译 key 在 JSON 文件中不存在，或中英文翻译 key 不一致。

**解决方案**：

```bash
# 1. 自动生成缺失的 key（生成 [TODO] 占位符）
pnpm --filter web exec npx tsx scripts/check-missing-keys.ts --fix

# 2. 手动编辑翻译文件，替换 [TODO] 值
# apps/web/src/messages/zh.json
# apps/web/src/messages/en.json

# 3. 确认 key 一致性
pnpm --filter web exec npx tsx scripts/check-translation-keys.ts

# 4. 确认翻译语言正确
pnpm --filter web exec npx tsx scripts/check-wrong-language.ts

# 5. 一次性运行所有 i18n 检查
pnpm --filter web lint:i18n
```

### 6.4 CI 流水线失败

**症状**：

- PR 检查不通过
- CI 构建失败但本地构建成功
- 测试在 CI 中超时

**原因**：CI 环境与本地环境差异（Node.js 版本、环境变量、缓存状态）；依赖安装不一致。

**解决方案**：

```bash
# 1. 确保本地能通过所有检查
pnpm lint
pnpm --filter api test
pnpm build

# 2. 确认 pnpm-lock.yaml 已提交
git add pnpm-lock.yaml

# 3. 确认没有遗漏的文件
git status

# 4. 如果 CI 中 pnpm install 失败
# 确保 packageManager 字段正确
# package.json: "packageManager": "pnpm@10.22.0"

# 5. 如果测试超时，可能是 CI 环境无法连接外部服务
# 确保所有外部调用都有 mock
```

### 6.5 合并冲突处理

**症状**：

- `git merge` 或 `git rebase` 产生冲突
- `pnpm-lock.yaml` 冲突（最常见）
- `schema.prisma` 冲突

**原因**：多人同时修改同一文件；锁文件因不同分支安装了不同依赖而冲突。

**解决方案**：

```bash
# === pnpm-lock.yaml 冲突（最常见）===
# 不要手动编辑 lock 文件！

# 1. 接受任一版本
git checkout --theirs pnpm-lock.yaml
# 或
git checkout --ours pnpm-lock.yaml

# 2. 重新安装依赖，自动更新 lock 文件
pnpm install

# 3. 提交解决后的文件
git add pnpm-lock.yaml
git rebase --continue  # 或 git merge --continue

# === schema.prisma 冲突 ===
# 手动合并 model 定义，确保所有字段都保留

# 1. 解决冲突后重新生成 Prisma Client
npx prisma generate

# 2. 检查迁移状态
npx prisma migrate status

# === 通用建议 ===
# - 经常 rebase 到目标分支，减少冲突范围
# - 分支生命周期不超过 1 周
# - 大型重构前与团队沟通，避免同时修改同一模块

git fetch origin
git rebase origin/main
```

---

_最后更新: 2026-02-13_
