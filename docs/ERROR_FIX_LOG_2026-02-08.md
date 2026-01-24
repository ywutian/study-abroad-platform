# 错误修复日志 - 2026-02-08

> 本文档记录了对 study-abroad-platform 项目全页面巡检中发现并修复的所有问题。
> 修复方法遵循企业级标准：根因分析、最小侵入修复、双语同步、schema 迁移。

---

## 修复总览

| #   | 错误类型                  | 严重级别    | 影响范围                 | 状态   |
| --- | ------------------------- | ----------- | ------------------------ | ------ |
| 1   | CSS 解析失败 (Turbopack)  | P0 Critical | 全站所有页面 500         | 已修复 |
| 2   | API 500 - Prisma 模型缺失 | P0 Critical | `/api/v1/verification/*` | 已修复 |
| 3   | Next.js 缓存损坏 (ENOENT) | P1 High     | Dev server 页面渲染      | 已修复 |
| 4   | i18n 缺失翻译键 (26 个)   | P2 Medium   | 多页面控制台警告         | 已修复 |

---

## 问题 1: CSS 解析错误 — Tailwind v4 + Turbopack 不兼容

### 症状

```text
web:dev: Parsing CSS source code failed
  .text-\[var\(\.\.\.\)\] {
>     color: var(...);
  Unexpected token Delim('.')
```

所有页面返回 **500** 错误。

### 根因分析

Tailwind CSS v4（通过 `@import "tailwindcss"` 使用）在扫描源代码时，发现了 `text-[var(--auth-error)]` 等任意值类名。Turbopack 的 CSS 解析器无法正确处理生成的 `var(...)` 字面量中间值，导致 CSS 编译失败。

涉及文件：

- `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx` (6 处)
- `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx` (3 处)
- `apps/web/src/app/[locale]/(auth)/verify-email/page.tsx` (2 处)

### 修复方案

**策略**：将 `[var(--*)]` 任意值语法替换为预定义的 CSS 工具类（语义化、可维护、避免编译器问题）。

**1. 在 `globals.css` 的 `@layer utilities` 中添加缺失的工具类：**

```css
.text-auth-error {
  color: var(--auth-error);
}
.bg-auth-error-bg {
  background-color: var(--auth-error-bg);
}
.ring-auth-error-ring {
  --tw-ring-color: var(--auth-error-ring);
}
.text-auth-accent {
  color: var(--auth-accent);
}
.bg-auth-icon-bg {
  background-color: var(--auth-icon-bg);
}
.ring-auth-icon-ring {
  --tw-ring-color: var(--auth-icon-ring);
}
.border-auth-focus-border {
  border-color: var(--auth-focus-border);
}
.ring-auth-focus-ring {
  --tw-ring-color: var(--auth-focus-ring);
}
```

**2. 在 auth 页面中替换类名：**

| 旧写法                              | 新写法                     |
| ----------------------------------- | -------------------------- |
| `text-[var(--auth-error)]`          | `text-auth-error`          |
| `bg-[var(--auth-error-bg)]`         | `bg-auth-error-bg`         |
| `ring-[var(--auth-error-ring)]`     | `ring-auth-error-ring`     |
| `text-[var(--auth-accent)]`         | `text-auth-accent`         |
| `bg-[var(--auth-icon-bg)]`          | `bg-auth-icon-bg`          |
| `ring-[var(--auth-icon-ring)]`      | `ring-auth-icon-ring`      |
| `border-[var(--auth-focus-border)]` | `border-auth-focus-border` |
| `ring-[var(--auth-focus-ring)]`     | `ring-auth-focus-ring`     |

### 修改文件

- `apps/web/src/app/globals.css` — 添加 8 个工具类
- `apps/web/src/app/[locale]/(auth)/reset-password/page.tsx` — 替换 6 处
- `apps/web/src/app/[locale]/(auth)/forgot-password/page.tsx` — 替换 3 处
- `apps/web/src/app/[locale]/(auth)/verify-email/page.tsx` — 替换 2 处

---

## 问题 2: API 500 — VerificationRequest Prisma 模型缺失

### 症状

```text
ERROR [AllExceptionsFilter] GET /api/v1/verification/my - 500
  Cannot read properties of undefined (reading 'findMany')
TypeError: Cannot read properties of undefined (reading 'findMany')
  at VerificationService.getMyVerifications (verification.service.ts:134)
```

### 根因分析

`verification.service.ts` 调用了 `this.prisma.verificationRequest.findMany()`，但 Prisma schema 中没有定义 `VerificationRequest` 模型和 `VerificationStatus` 枚举。这是一个 schema 与代码不同步的问题。

### 修复方案

**1. 在 `prisma/schema.prisma` 中添加枚举：**

```prisma
enum VerificationStatus {
  PENDING
  APPROVED
  REJECTED
}
```

**2. 添加 `VerificationRequest` 模型：**

```prisma
model VerificationRequest {
  id         String             @id @default(cuid())
  userId     String
  user       User               @relation(...)
  caseId     String
  case       AdmissionCase      @relation(...)
  proofType  String
  proofData  String?            @db.Text
  proofUrl   String?
  status     VerificationStatus @default(PENDING)
  reviewerId String?
  reviewNote String?
  reviewedAt DateTime?
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt

  @@index([userId])
  @@index([caseId])
  @@index([status])
}
```

**3. 在 `User` 和 `AdmissionCase` 模型中添加关联字段：**

- `User`: `verificationRequests VerificationRequest[]`
- `AdmissionCase`: `verificationRequests VerificationRequest[]`

**4. 执行 Prisma 迁移：**

```bash
pnpm --filter api db:generate  # 重新生成 Prisma Client
pnpm --filter api db:push      # 同步 schema 到数据库
```

### 修改文件

- `apps/api/prisma/schema.prisma` — 添加枚举、模型、关联

---

## 问题 3: Next.js Dev Server 缓存损坏

### 症状

```text
ENOENT: no such file or directory, open '.../.next/dev/server/app/[locale]/(auth)/login/page/build-manifest.json'
Persisting failed: Unable to write SST file
```

### 根因分析

`.next` 目录中的 Turbopack 缓存文件损坏，可能由于之前的异常中断导致。

### 修复方案

```bash
rm -rf apps/web/.next
```

清理缓存后重新启动 dev server，缓存会自动重建。

### 修改文件

无代码修改，仅清理缓存目录。

---

## 问题 4: i18n 翻译键缺失 (26 个)

### 症状

```text
MISSING_MESSAGE: Could not resolve `meta.home.keywords` in messages for locale `zh`.
MISSING_MESSAGE: Could not resolve `nav.descriptions.ai` in messages for locale `zh`.
MISSING_MESSAGE: Could not resolve `validation.required` in messages for locale `zh`.
... (共 26 个不同的 key)
```

### 根因分析

新增功能（导航描述、首页 Demo UI、学校指数、论坛详情等）引用了尚未添加到翻译文件中的 i18n 键。

### 修复方案

在 `zh.json` 和 `en.json` 中同步添加全部 26 个缺失的翻译键，分为以下类别：

| 类别                           | 键数量 | 示例                   |
| ------------------------------ | ------ | ---------------------- |
| `meta.home.keywords`           | 1      | SEO 关键词             |
| `home.demoFlow.*`              | 1      | Demo 步骤指示器        |
| `home.demoUI.step1.*`          | 8      | 首页 Demo 交互组件     |
| `nav.descriptions.*`           | 8      | 导航菜单描述文本       |
| `nav.sections.*`               | 2      | 导航分组标题           |
| `validation.*`                 | 4      | 表单验证消息           |
| `forum.postDetail`             | 1      | 论坛帖子详情           |
| `agentChat.quickActions.title` | 1      | AI 快捷操作标题        |
| `schools.indices.*`            | 5      | 学校安全/幸福/美食指数 |

### 修改文件

- `apps/web/src/messages/zh.json` — 添加 26 个中文翻译
- `apps/web/src/messages/en.json` — 添加 26 个英文翻译

---

## 页面巡检结果

以下页面已通过测试（HTTP 200，无错误）：

| 页面         | 路由                  | 状态 |
| ------------ | --------------------- | ---- |
| 首页         | `/zh`                 | 正常 |
| 登录         | `/zh/login`           | 正常 |
| 注册         | `/zh/register`        | 正常 |
| 忘记密码     | `/zh/forgot-password` | 正常 |
| 邮箱验证     | `/zh/verify-email`    | 正常 |
| 学校库       | `/zh/schools`         | 正常 |
| 案例库       | `/zh/cases`           | 正常 |
| 论坛         | `/zh/forum`           | 正常 |
| Find College | `/zh/find-college`    | 正常 |
| 排名         | `/zh/ranking`         | 正常 |
| 功能大厅     | `/zh/hall`            | 正常 |
| 关于我们     | `/zh/about`           | 正常 |

### 已知非错误行为

- **401 POST /api/v1/auth/refresh**：未登录时尝试刷新 token，属于前端 auth 中间件的正常防御行为，不影响用户体验。

---

## 第二轮全量检查 (2026-02-08 21:30)

### 背景

第一轮检查发现并修复了 26 个缺失的 i18n key，但后续发现仍存在大量遗漏（如 `nav.user.manageAccount`）。说明手动检查不够全面，需要系统化方法。

### 检查方法

采用企业级静态分析脚本，自动完成以下步骤：

1. **遍历所有源码文件** (`apps/web/src/**/*.tsx`, `*.ts`)
2. **识别每个文件的 i18n 命名空间**（`useTranslations()` 根命名空间 vs `useTranslations('namespace')` 限定命名空间）
3. **提取所有 `t('key')` 调用**，结合命名空间解析完整 key 路径
4. **与 `zh.json` / `en.json` 交叉比对**，找出所有缺失 key
5. **批量生成翻译并合并到翻译文件**

### 发现的问题

| 模块           | 缺失 key 数 | 说明                                                                                                     |
| -------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| admin          | 77          | 整个管理后台模块的翻译缺失                                                                               |
| essayAi        | 57          | 文书 AI（头脑风暴/润色/评审）翻译缺失                                                                    |
| ui             | 50          | 通用 UI 组件（命令面板/对话框/离线提示等）翻译缺失                                                       |
| verification   | 47          | 身份认证模块翻译缺失                                                                                     |
| hall           | 43          | 功能大厅（滑动卡片/排行榜/每日挑战）翻译缺失                                                             |
| prediction     | 41          | 录取预测 AI 相关翻译缺失                                                                                 |
| essayAdmin     | 39          | 文书管理后台翻译缺失                                                                                     |
| profile        | 38          | 档案表单（教育/活动/奖项/成绩）翻译缺失                                                                  |
| agentChat      | 37          | AI 助手对话面板翻译缺失                                                                                  |
| assessment     | 31          | 性格测评 AI 分析翻译缺失                                                                                 |
| home           | 30          | 首页 Demo UI（步骤2-4）翻译缺失                                                                          |
| auth           | 21          | 认证页面（登录/注册/重置密码）翻译缺失                                                                   |
| dataExport     | 17          | 数据导出组件翻译缺失                                                                                     |
| dashboard      | 16          | 仪表盘（引导/统计）翻译缺失                                                                              |
| globalSearch   | 15          | 全局搜索组件翻译缺失                                                                                     |
| recommendation | 14          | 智能推荐翻译缺失                                                                                         |
| feedback       | 13          | 反馈组件翻译缺失                                                                                         |
| essays         | 11          | 文书页面 AI 助手翻译缺失                                                                                 |
| vault          | 11          | 密码库 Demo 数据翻译缺失                                                                                 |
| 其他           | ~30         | notifications/welcome/essayGallery/chat/followers/subscription/resume/common/helpCenter/schools/settings |
| **总计**       | **~641**    | 跨 25+ 模块                                                                                              |

### 修复方案

1. **编写自动化翻译合并脚本**：
   - `zh.json`: 使用 `setNestedValue()` 递归插入 641 个中文翻译
   - `en.json`: 使用 `deepMerge()` 递归插入对应英文翻译
   - 确保不覆盖已有翻译，仅添加缺失项

2. **同步验证**：
   - 运行校验脚本确认 `en.json` 覆盖 `zh.json` 全部 key
   - 结果：**0 个缺失**

### 验证结果

重启开发服务器后，使用 curl 访问全部 25 个路由：

| 路由                  | 状态   |
| --------------------- | ------ |
| `/zh` (首页)          | 200 OK |
| `/zh/login`           | 200 OK |
| `/zh/register`        | 200 OK |
| `/zh/forgot-password` | 200 OK |
| `/zh/reset-password`  | 200 OK |
| `/zh/verify-email`    | 200 OK |
| `/zh/dashboard`       | 200 OK |
| `/zh/ranking`         | 200 OK |
| `/zh/prediction`      | 200 OK |
| `/zh/cases`           | 200 OK |
| `/zh/forum`           | 200 OK |
| `/zh/ai`              | 200 OK |
| `/zh/recommendation`  | 200 OK |
| `/zh/assessment`      | 200 OK |
| `/zh/timeline`        | 200 OK |
| `/zh/hall`            | 200 OK |
| `/zh/essay-gallery`   | 200 OK |
| `/zh/chat`            | 200 OK |
| `/zh/vault`           | 200 OK |
| `/zh/profile`         | 200 OK |
| `/zh/settings`        | 200 OK |
| `/zh/admin`           | 200 OK |
| `/zh/schools`         | 200 OK |
| `/zh/followers`       | 200 OK |
| `/zh/essays`          | 200 OK |

**终端输出：0 个 MISSING_MESSAGE 错误**

### 影响文件

- `apps/web/src/messages/zh.json` — 新增 641 个中文翻译
- `apps/web/src/messages/en.json` — 新增对应 641 个英文翻译

---

## 预防措施建议

1. **CI 集成 i18n 校验**：在 CI 中运行静态分析脚本，自动检测代码中引用的 i18n key 是否在翻译文件中存在
2. **Prisma schema 与代码同步检查**：在 CI 中加入 `prisma validate` 验证
3. **避免 Tailwind 任意值中使用 `var()`**：统一使用预定义工具类，保证与 Turbopack 兼容
4. **定期清理 `.next` 缓存**：在遇到异常构建错误时，首先尝试清理缓存
5. **i18n 翻译文件应与功能代码同步提交**：每个新功能 PR 必须包含对应的 i18n key，不允许 key 与翻译文件脱节
6. **建议引入 `i18n-ally` VSCode 插件**：实时高亮缺失/未使用的翻译 key
