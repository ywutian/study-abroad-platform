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

---

## 开发环境搭建

### 前置要求

| 工具    | 版本要求 | 说明                    |
| ------- | -------- | ----------------------- |
| Node.js | >= 20    | 推荐使用 nvm 管理版本   |
| pnpm    | >= 9     | 包管理器                |
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
docker-compose up -d

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

如需跳过（仅限紧急情况）：`git commit --no-verify`

### 创建 PR 前

1. 确保代码通过 lint 检查：`pnpm lint`
2. 确保所有测试通过：`pnpm --filter api test`
3. 更新相关文档
4. 将分支 rebase 到最新的目标分支

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
- 错误处理完整性
- 性能影响
- 安全隐患（特别是用户输入处理）

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

## 问题反馈

- **Bug 报告**: 使用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.yml) 创建 Issue
- **功能建议**: 使用 [功能请求模板](.github/ISSUE_TEMPLATE/feature_request.yml) 创建 Issue
- **安全漏洞**: 请参考 [SECURITY.md](SECURITY.md) 通过内部渠道上报

---

## 保密声明

本项目为商业私有项目，所有代码和文档均为公司机密。未经授权，不得向外部人员透露项目代码、架构设计或业务逻辑。
