# 企业级代码标准 (Enterprise Code Standards)

## 使用方式

- **写代码时**: 按各章节规则编写
- **审代码时**: 用每节末尾的 checklist 逐项对照
- `[AUTO]` = 自动化工具强制执行（pre-commit / CI）
- `[MANUAL]` = 需人工验证

---

## 1. 后端标准 (NestJS API)

### 1.1 DTO 与验证

- `[AUTO]` 所有 `@Body()` 参数必须使用 DTO class（禁止 inline `body: { ... }` 类型）— `no-inline-body` (ERROR)
- `[AUTO]` `@IsString()` 字段必须有 `@MaxLength()` — `no-missing-maxlength` (WARNING)
- `[MANUAL]` 长度约定: 标题类 `@MaxLength(200)`, 正文类 `@MaxLength(50000)`, 短输入 `@MaxLength(500)`
- `[MANUAL]` 数组字段: `@IsArray()` + `@IsString({ each: true })`
- `[MANUAL]` DTO 字段加 `@ApiProperty()` 以生成 Swagger 文档

### 1.2 安全与限流

- `[AUTO]` AI 端点 (POST/PUT 含 `/ai`) 必须有 `@ThrottleAI()` — `no-unthrottled-ai` (WARNING)
- `[MANUAL]` 敏感操作用 `@ThrottleSensitive()` (5/min) 或 `@ThrottleStrict()` (3/min)
- `[MANUAL]` 暴露敏感信息的端点加 `@Roles(Role.ADMIN)`
- `[MANUAL]` 所有端点默认需 JWT，仅 login/register/health/verify-email 用 `@Public()`
- `[MANUAL]` Token refresh 必须用 `$transaction` 防止竞态条件
- `[MANUAL]` Login 总是执行 `bcrypt.compare`（防时序攻击，即使用户不存在）

### 1.3 异常处理

- `[AUTO]` Service 中禁止 `throw new Error()` — `no-generic-throw` (WARNING)
- `[MANUAL]` 用户错误 → `BadRequestException`，未找到 → `NotFoundException`，权限 → `ForbiddenException`
- `[MANUAL]` Prisma 错误由 `AllExceptionsFilter` 统一处理，不要手动 catch
- `[MANUAL]` 豁免: 启动配置服务 (`config-validator`, `encryption`, `prisma`) 可使用 `throw new Error()` 崩溃进程

### 1.4 测试

- `[AUTO]` Service 文件必须有对应 `.spec.ts` — `no-missing-test` (WARNING, 全量扫描)
- `[MANUAL]` 测试覆盖: 正常路径 + 错误路径 + 边界情况
- `[MANUAL]` 关键路径 (auth, payment, prediction) 覆盖率 >= 90%
- `[MANUAL]` Mock 外部依赖 (Prisma, Redis, HTTP, LLM)

### 1.5 模块依赖

- `[MANUAL]` 不跨模块直接 import 内部文件 — 通过 Module 导入
- `[MANUAL]` AI 调用只用 `AiService.chat()` (简单) 或 `LLMService.call()` (Agent)
- `[MANUAL]` JSON 提取只用 `extractJsonFromLlm()`, 禁止正则
- `[MANUAL]` 共享类型放 `packages/shared/src/types/index.ts`

#### 后端 Review Checklist

- [ ] `@Body()` 用 DTO class + class-validator
- [ ] 字符串字段有 `@MaxLength()`
- [ ] AI 端点有 `@ThrottleAI()`
- [ ] 无 `throw new Error()` — 用 NestJS 异常
- [ ] 敏感端点有 `@Roles()` 守卫
- [ ] Service 有对应 `.spec.ts`
- [ ] DTO 字段有 `@ApiProperty()`

---

## 2. 前端标准 (Next.js Web)

### 2.1 暗色模式与颜色

- `[AUTO]` 禁止动态 Tailwind 插值: `` `bg-${color}-500` `` — `no-dynamic-tailwind` (ERROR)
- `[AUTO]` `bg-slate-800/900`, `text-slate-300/400` 必须有 `dark:` 变体 — `no-hardcoded-dark-bg` (WARNING)
- `[AUTO]` `bg-gray-*`, `text-gray-*`, `border-gray-*` 必须有 `dark:` 变体 — `no-hardcoded-gray` (WARNING)
- `[MANUAL]` 优先 CSS 变量: `bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-card`
- `[MANUAL]` Auth 页面专用 `--auth-*` CSS 变量
- `[MANUAL]` 映射参考: `bg-slate-50` → `bg-muted`, `text-slate-600` → `text-muted-foreground`, `border-slate-200` → `border-border`

### 2.2 页面结构

- `[AUTO]` `page.tsx` 超 500 行必须有 `_components/` 目录 — `page-size-limit` (WARNING)
- `[AUTO]` `page.tsx` 必须有同级 `loading.tsx` — `no-missing-loading` (WARNING)
- `[AUTO]` 路由组必须有 `error.tsx` 覆盖 — `no-missing-error-boundary` (WARNING)
- `[MANUAL]` 使用 `PageHeader` + `PageContainer` 布局模式
- `[MANUAL]` Loading skeleton 使用 `Skeleton` 组件匹配页面布局结构
- `[MANUAL]` 拆分后的组件各自 `'use client'`，内部调用 `useTranslations()`

### 2.3 可访问性

- `[AUTO]` 交互元素可聚焦 — `jsx-a11y/interactive-supports-focus` (WARNING)
- `[AUTO]` 图片有 alt 文本 — `jsx-a11y/alt-text` (WARNING)
- `[AUTO]` aria 属性正确 — `jsx-a11y/aria-props` (ERROR)
- `[MANUAL]` Icon-only 按钮加 `aria-label`
- `[MANUAL]` 表单控件有关联 `label`
- `[MANUAL]` 颜色对比度满足 WCAG 2.1 AA

### 2.4 国际化 (i18n)

- `[AUTO]` 源码 key 在 zh.json 中存在 — `check-missing-keys`
- `[AUTO]` zh.json 和 en.json key 一致 — `check-translation-keys`
- `[AUTO]` 翻译值语言正确 — `check-wrong-language`
- `[MANUAL]` 禁止硬编码用户可见字符串 — 用 `useTranslations()` / `t()`
- `[MANUAL]` 路由使用 `Link`/`useRouter` from `@/lib/i18n/navigation`

### 2.5 调试与日志

- `[AUTO]` 禁止 `console.log/error` — `no-console-in-prod` (WARNING)
- `[MANUAL]` 错误用 `toast` 展示，不用 `alert` 或 `console`
- `[MANUAL]` 开发调试代码在提交前移除

### 2.6 性能

- `[MANUAL]` React Query: 合理设置 `staleTime`（默认 5min）
- `[MANUAL]` 大列表使用虚拟化 (mobile: FlashList)
- `[MANUAL]` 图片使用 `next/image` 配合 `width`/`height`
- `[MANUAL]` AI 请求使用 `AI_TIMEOUTS.AI_REQUEST` 超时

#### 前端 Review Checklist

- [ ] 颜色用 CSS 变量或有 `dark:` 变体
- [ ] Tailwind 类静态可分析（无动态插值）
- [ ] 新页面有 `loading.tsx`
- [ ] Icon 按钮有 `aria-label`
- [ ] 无 `console.log` 残留
- [ ] 无硬编码字符串（用 i18n）
- [ ] 页面 < 500 行或有 `_components/`
- [ ] 图片有 alt 文本

---

## 3. 通用标准

### 3.1 TypeScript

- `[AUTO]` import 排序 — `simple-import-sort` (auto-fix)
- `[AUTO]` `prefer-const` — ESLint (ERROR)
- `[AUTO]` 未使用变量 — ESLint `no-unused-vars` (WARNING, `_` 前缀豁免)
- `[MANUAL]` 禁止 `any` — 用 Prisma 生成类型或具体类型
- `[MANUAL]` 共享 AI 类型在 `packages/shared/src/types/index.ts`
- `[MANUAL]` TypeScript strict 模式已开启 (API + Web + Mobile)

### 3.2 Git 与提交

- `[AUTO]` Conventional Commits 格式 — commitlint
- `[AUTO]` Prettier + ESLint — lint-staged (pre-commit)
- `[MANUAL]` scope 对应模块: `auth`, `profile`, `school`, `forum`, `web`, `api`, `mobile`
- `[MANUAL]` 分支生命周期 < 1 周
- `[MANUAL]` 分支命名: `feature/<描述>`, `fix/<描述>`, `hotfix/<描述>`

### 3.3 文档

- `[AUTO]` Controller 变更触发 API_REFERENCE.md 提醒 — CI doc-check
- `[AUTO]` Schema 变更触发 ARCHITECTURE.md 提醒 — CI doc-check
- `[MANUAL]` 架构决策写 ADR (`docs/adr/`)
- `[MANUAL]` 新增功能更新 CHANGELOG.md

---

## 4. 自动化工具一览

### 前端规则 (`check-code-quality.ts`, 7 rules)

| 规则                        | 严重度    | 检测内容                            | 修复方式                    |
| --------------------------- | --------- | ----------------------------------- | --------------------------- |
| `no-dynamic-tailwind`       | **ERROR** | `` `bg-${color}-500` `` 动态插值    | 使用静态 COLOR_CLASSES 映射 |
| `no-hardcoded-dark-bg`      | WARNING   | `bg-slate-800` 无 `dark:`           | 用 CSS 变量或加 `dark:`     |
| `no-hardcoded-gray`         | WARNING   | `bg-gray-100` 无 `dark:`            | 用语义类或加 `dark:`        |
| `page-size-limit`           | WARNING   | `page.tsx` >500 行无 `_components/` | 拆分为瘦 page + 组件目录    |
| `no-console-in-prod`        | WARNING   | `console.log/error`                 | 用 toast 或移除             |
| `no-missing-loading`        | WARNING   | `page.tsx` 无同级 `loading.tsx`     | 创建 Skeleton loading       |
| `no-missing-error-boundary` | WARNING   | 路由组无 `error.tsx`                | 在路由组创建 error.tsx      |

### 后端规则 (`check-api-quality.ts`, 5 rules)

| 规则                   | 严重度    | 检测内容                        | 修复方式           |
| ---------------------- | --------- | ------------------------------- | ------------------ |
| `no-inline-body`       | **ERROR** | `@Body() body: { ... }`         | 创建 DTO class     |
| `no-unthrottled-ai`    | WARNING   | AI 端点无限流                   | 加 `@ThrottleAI()` |
| `no-generic-throw`     | WARNING   | `throw new Error()`             | 用 NestJS 异常     |
| `no-missing-maxlength` | WARNING   | `@IsString()` 无 `@MaxLength()` | 加 `@MaxLength()`  |
| `no-missing-test`      | WARNING   | Service 无 `.spec.ts`           | 创建测试文件       |

### ESLint 可访问性 (`eslint-plugin-jsx-a11y`)

| 规则                                    | 严重度  | 检测内容           |
| --------------------------------------- | ------- | ------------------ |
| `jsx-a11y/alt-text`                     | WARNING | 图片缺 alt 文本    |
| `jsx-a11y/aria-props`                   | ERROR   | 无效 aria 属性     |
| `jsx-a11y/interactive-supports-focus`   | WARNING | 交互元素不可聚焦   |
| `jsx-a11y/click-events-have-key-events` | WARNING | 点击事件缺键盘事件 |

### 检查命令

```bash
# 一键全量检查
pnpm lint:all

# 分项检查
pnpm lint                             # ESLint (所有应用)
pnpm --filter web lint:quality        # 前端质量 (7 rules)
pnpm --filter api lint:quality        # 后端质量 (5 rules)
pnpm --filter web lint:i18n           # 国际化检查
pnpm --filter api test                # 后端单元测试
pnpm --filter web test                # 前端单元测试
```

---

## 5. 执行流水线

```
开发者写代码
    |
git commit
    |
+-- Pre-commit Hooks ------------------------------------+
| 1. lint-staged (Prettier + ESLint fix)                 |
| 2. commitlint (提交格式)                                |
| 3. i18n checks (翻译完整性)                             |
| 4. check-code-quality.ts (前端 7 rules)                |
| 5. check-api-quality.ts (后端 5 rules)                 |
+--------------------------------------------------------+
    | (通过)
git push / PR
    |
+-- CI Pipeline -----------------------------------------+
| 1. ESLint (含 jsx-a11y + import-sort)                  |
| 2. TypeScript strict (tsc --noEmit)                    |
| 3. 前端/后端质量检查 (全量)                              |
| 4. i18n 检查 (全量)                                     |
| 5. Unit/E2E Tests                                      |
| 6. Build                                               |
| 7. Security Scan (Trivy)                               |
| 8. Doc Sync Check                                      |
+--------------------------------------------------------+
    | (通过)
+-- PR Review (人工) ------------------------------------+
| 对照上方各章节 Checklist 逐项检查                        |
+--------------------------------------------------------+
```

---

_最后更新: 2026-03-11_
