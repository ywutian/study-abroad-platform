# 开发规范

本文档为团队成员提供开发规范和协作流程指导。

---

## 目录

- [开发环境搭建](#开发环境搭建)
- [分支策略](#分支策略)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [代码规范](#代码规范)
- [测试要求](#测试要求)
- [文档要求](#文档要求)
- [数据库 Schema 变更](#数据库-schema-变更)

---

## 开发环境搭建

### 前置要求

| 工具    | 版本要求 | 说明                    |
| ------- | -------- | ----------------------- |
| Node.js | >= 18    | 推荐使用 nvm 管理版本   |
| pnpm    | >= 10    | 包管理器                |
| Docker  | 最新版   | PostgreSQL + Redis 容器 |
| Git     | >= 2.30  | 版本控制                |

### 快速开始

```bash
# 1. 克隆仓库
git clone <repository-url>
cd study-abroad-platform

# 2. 安装依赖
pnpm install

# 3. 启动基础设施
docker-compose up -d db redis

# 4. 数据库迁移
pnpm --filter api db:generate
pnpm --filter api prisma migrate deploy

# 5. 启动开发服务器
pnpm dev
```

详细步骤请参考 [新人指南](docs/ONBOARDING.md)。

---

## 分支策略

基于 Git Flow 简化版：

| 分支类型 | 命名规范          | 来源      | 合入目标           |
| -------- | ----------------- | --------- | ------------------ |
| 功能分支 | `feature/<描述>`  | `develop` | `develop`          |
| 修复分支 | `fix/<描述>`      | `develop` | `develop`          |
| 热修复   | `hotfix/<描述>`   | `main`    | `main` + `develop` |
| 文档分支 | `docs/<描述>`     | `develop` | `develop`          |
| 重构分支 | `refactor/<描述>` | `develop` | `develop`          |

### 分支规则

- `main` 分支受保护，只接受 PR 合入
- 分支名使用小写英文 + 短横线（如 `feature/add-school-filter`）
- 分支生命周期不超过 1 周，避免长期分支

---

## 提交规范

本项目使用 **Husky + commitlint** 自动校验提交信息。不符合规范的提交会被拒绝。

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

| 类型       | 说明      | 示例                                    |
| ---------- | --------- | --------------------------------------- |
| `feat`     | 新功能    | `feat(auth): add OAuth2 login`          |
| `fix`      | Bug 修复  | `fix(profile): prevent GPA overflow`    |
| `docs`     | 文档更新  | `docs: update API reference`            |
| `style`    | 代码格式  | `style: fix eslint warnings`            |
| `refactor` | 重构      | `refactor(scoring): extract calculator` |
| `test`     | 测试      | `test(case): add unit tests`            |
| `chore`    | 构建/工具 | `chore: update dependencies`            |
| `perf`     | 性能优化  | `perf(query): add database index`       |
| `ci`       | CI/CD     | `ci: add security scanning`             |

### Scope（可选）

使用模块名：`auth`, `profile`, `school`, `case`, `ai`, `forum`, `web`, `api`, `mobile`

### 示例

```
feat(prediction): add percentile-based SAT scoring

Implements SAT 25th/75th percentile scoring using College Scorecard data.
Falls back to average SAT when percentile data is unavailable.

Closes #42
```

---

## Pull Request 流程

### Pre-commit Hooks (自动执行)

每次 `git commit` 时，Husky 会自动执行：

1. **lint-staged**: 对暂存文件运行 Prettier 格式化 + ESLint 修复
2. **commitlint**: 校验提交信息是否符合 Conventional Commits 格式
3. **i18n 检查** (当 `apps/web/src/` 有变动时):
   - 缺失翻译 key 检查
   - zh.json / en.json key 一致性检查
   - 翻译值语言正确性检查
4. **前端质量检查** (当 `apps/web/src/` 有变动时, 7 条规则):
   - ❌ Tailwind 动态类插值（生产构建会被 purge）
   - ⚠️ 硬编码 slate/gray 颜色缺少 `dark:` 变体
   - ⚠️ 页面超过 500 行未拆分 `_components/`
   - ⚠️ 生产代码中的 `console.log/error`
   - ⚠️ `page.tsx` 缺少同级 `loading.tsx`
   - ⚠️ 路由组缺少 `error.tsx` 错误边界
5. **后端质量检查** (当 `apps/api/src/` 有变动时, 5 条规则):
   - ❌ `@Body()` 使用 inline 类型而非 DTO class
   - ⚠️ AI 端点缺少 `@ThrottleAI()` 限流
   - ⚠️ Service 中使用 `throw new Error()` 而非 NestJS 异常
   - ⚠️ `@IsString()` 字段缺少 `@MaxLength()`
   - ⚠️ Service 缺少 `.spec.ts` 测试文件

如需跳过（仅限紧急情况）：`git commit --no-verify`

### 代码质量检查详情

本项目使用自定义静态分析脚本 `apps/web/scripts/check-code-quality.ts`，捕获 ESLint 无法覆盖的常见问题。

```bash
# 手动运行全量检查
pnpm --filter web lint:quality

# 仅检查暂存文件（pre-commit 使用此模式）
pnpm --filter web lint:quality --staged
```

| 规则                        | 严重度           | 说明                                         | 修复方式                               |
| --------------------------- | ---------------- | -------------------------------------------- | -------------------------------------- |
| `no-dynamic-tailwind`       | **error** (阻断) | `` `bg-${color}-500` `` 在生产构建会被 purge | 使用静态类映射对象                     |
| `no-hardcoded-dark-bg`      | warning          | `bg-slate-800` 缺少 `dark:` 变体             | 使用 CSS 变量或添加 `dark:`            |
| `no-hardcoded-gray`         | warning          | `bg-gray-100` 等缺少 `dark:` 变体            | 使用语义类 (`bg-muted`) 或添加 `dark:` |
| `page-size-limit`           | warning          | `page.tsx` 超过 500 行无 `_components/`      | 拆分为瘦 page.tsx + 组件目录           |
| `no-console-in-prod`        | warning          | 生产代码中的 `console.log/error`             | 使用 toast 或移除调试日志              |
| `no-missing-loading`        | warning          | `page.tsx` 无同级 `loading.tsx`              | 创建 Skeleton loading 文件             |
| `no-missing-error-boundary` | warning          | 路由组无 `error.tsx`                         | 在路由组层级创建 error.tsx             |

**Tailwind 动态类的正确做法**：

```typescript
// ❌ 错误：会被 Tailwind purge 掉
className={`bg-${color}-500/10 text-${color}-600`}

// ✅ 正确：使用静态类映射
const COLOR_CLASSES = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
};
className={`${COLOR_CLASSES[color].bg} ${COLOR_CLASSES[color].text}`}
```

### PR 提交检查清单

**后端 (apps/api):**

- [ ] `[AUTO]` 所有 `@Body()` 参数使用 DTO class + class-validator（禁止 inline 类型）
- [ ] `[AUTO]` 字符串字段有 `@MaxLength()` (标题: 200, 正文: 50000, 短输入: 500)
- [ ] `[AUTO]` AI 端点有 `@ThrottleAI()` 装饰器
- [ ] `[AUTO]` 无 `throw new Error()` — 使用 NestJS 异常
- [ ] `[AUTO]` Service 有对应 `.spec.ts` 测试文件
- [ ] `[MANUAL]` 敏感端点有 `@Roles(Role.ADMIN)`
- [ ] `[MANUAL]` DTO 字段有 `@ApiProperty()` (Swagger)
- [ ] `[MANUAL]` `@types/*` 包在 devDependencies

**前端 (apps/web):**

- [ ] `[AUTO]` Tailwind 类名静态可分析（禁止动态插值）
- [ ] `[AUTO]` 硬编码颜色有 `dark:` 变体（或使用 CSS 变量）
- [ ] `[AUTO]` 新页面有 `loading.tsx` skeleton
- [ ] `[AUTO]` 路由组有 `error.tsx` 错误边界
- [ ] `[AUTO]` 无 `console.log/error` 残留
- [ ] `[AUTO]` 图片有 alt 文本，交互元素可聚焦
- [ ] `[MANUAL]` Icon-only 按钮有 `aria-label`
- [ ] `[MANUAL]` 页面 > 500 行已拆分 `_components/`
- [ ] `[MANUAL]` 无硬编码用户可见字符串（用 i18n）

> 完整标准详见 [企业级代码标准](docs/CODE_STANDARDS.md)

### 创建 PR 前

1. 确保所有检查通过：`pnpm lint:all`
2. 确保所有测试通过：`pnpm test`
3. 或一键全量检查：`pnpm check`
4. 更新相关文档
5. 将分支 rebase 到最新的目标分支

### PR 描述要求

使用仓库提供的 PR 模板，包含：

- **Summary**: 简述变更内容和目的
- **Changes**: 具体修改清单
- **Test Plan**: 如何验证变更
- **Checklist**: 自查项

### Code Review 要求

- 至少 1 名维护者审核
- CI 检查全部通过
- 所有评论已回复或解决
- Squash merge 合入（保持主分支历史清洁）

### Review 关注点

- 代码正确性和边界处理
- 类型安全（避免 `any` 类型）
- 错误处理完整性（后端使用 NestJS 异常，前端使用 toast）
- 性能影响
- 安全隐患（特别是用户输入处理）
- **Tailwind 类是否静态可分析**（禁止 `` `bg-${var}` `` 动态插值）
- **颜色是否有暗色模式支持**（优先 CSS 变量，硬编码色须加 `dark:` 变体）
- **页面是否过长**（>500 行应拆分 `_components/`）
- **console.log 是否残留**（使用 toast 替代用户错误提示）

---

## 代码规范

### TypeScript

- 使用严格模式（`strict: true`）
- 优先使用 `const` 声明
- 接口命名使用 PascalCase
- 避免使用 `any`，使用 Prisma 生成的类型
- 异步函数使用 `async/await`

### NestJS (后端)

- 每个模块包含：Controller, Service, Module, DTO
- Controller 仅做参数验证和路由，业务逻辑在 Service 中
- 使用 `ValidationPipe` + class-validator 进行 DTO 验证
- 所有 Controller 方法添加 Swagger 装饰器（`@ApiTags`, `@ApiOperation`）

### Next.js (前端)

- 使用 `'use client'` 标记客户端组件
- 避免 Hydration 不匹配：浏览器 API 放入 `useEffect`
- 使用 `@tanstack/react-query` 管理服务端状态
- 使用 `next-intl` 进行国际化，禁止硬编码字符串

### 命名约定

| 类型       | 规范                  | 示例                     |
| ---------- | --------------------- | ------------------------ |
| 文件名     | kebab-case            | `school-data.service.ts` |
| 类名       | PascalCase            | `SchoolDataService`      |
| 函数/变量  | camelCase             | `getSchoolById`          |
| 常量       | UPPER_SNAKE_CASE      | `MAX_RETRY_COUNT`        |
| DTO        | PascalCase + Dto 后缀 | `CreateSchoolDto`        |
| 数据库模型 | PascalCase            | `AdmissionCase`          |

---

## 测试要求

### 单元测试

- 新增 Service 必须有对应的 `.spec.ts` 文件
- 使用 Jest + NestJS Testing 模块
- Mock 外部依赖（Prisma、Redis、HTTP 调用）
- 测试覆盖：正常路径 + 错误路径 + 边界情况

### 运行测试

```bash
# 运行所有 API 单元测试
pnpm --filter api test

# 运行特定文件
pnpm --filter api test -- --testPathPattern=case.service

# 查看覆盖率
pnpm --filter api test -- --coverage
```

### 测试目标

- 新增代码覆盖率 >= 80%
- 关键路径（认证、支付、数据修改）覆盖率 >= 90%

---

## 文档要求

### 何时需要更新文档

- 新增 API 端点 → 更新 `docs/API_REFERENCE.md`
- 修改架构决策 → 新建 ADR 文件 `docs/adr/NNNN-*.md`
- 修改数据库 Schema → 更新 `docs/ARCHITECTURE.md` 数据模型章节
- 修复重要 Bug → 更新 `CHANGELOG.md`
- 新增功能 → 更新 `CHANGELOG.md` 和相关文档

### 文档规范

详见 [文档标准](docs/DOCUMENTATION_STANDARDS.md)。

---

## 数据库 Schema 变更

修改 `apps/api/prisma/schema.prisma` 时，**必须**遵循以下流程：

1. **创建迁移文件**: `pnpm --filter api db:migrate -- --name <name>`
   - 使用 snake_case 描述性名称: `add_school_retention_fields`, `rename_user_status`
   - 禁止手动编辑生成的 migration SQL 文件
2. **生成客户端**: `pnpm --filter api db:generate`
3. **运行测试**: `pnpm --filter api test`
4. **一起提交**: `schema.prisma` + `prisma/migrations/` 目录必须在同一个 commit 中

### 数据回填脚本

对于数据密集型迁移（例如将 JSON 字段提升为独立列）：

- 在 `apps/api/scripts/` 下创建脚本，遵循 `--apply` 模式
- 默认 dry-run（只读），需传 `--apply` 才写入数据
- 包含校验步骤，对比源数据和目标数据的计数
- 在脚本头部注释中说明用法

### 注意事项

- **禁止**在生产或 staging 环境使用 `db:push`（不生成迁移历史）
- 新列必须为 **nullable** 或有 **default 值**，避免锁表
- CI/CD 会自动执行 `prisma migrate deploy`，无需手动干预

---

## 问题反馈

- **Bug 报告**: 使用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.yml) 创建 Issue
- **功能建议**: 使用 [功能请求模板](.github/ISSUE_TEMPLATE/feature_request.yml) 创建 Issue
- **安全漏洞**: 请参考 [SECURITY.md](SECURITY.md) 通过内部渠道上报

---

## 保密声明

本项目为商业私有项目，所有代码和文档均为公司机密。未经授权，不得向外部人员透露项目代码、架构设计或业务逻辑。

---

_最后更新: 2026-03-11_
