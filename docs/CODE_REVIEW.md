# 📋 代码审查报告

> 最后更新: 2026-08-12
>
> 本文保留最初审计问题与建议代码，作为历史证据。2026-08-12 重新对照
> 当前代码后，原始 8 条问题均已修复或因对应产品面退役而被替代；下方旧的
> “修复”代码块不再是待执行任务。

---

## 📊 审查概览

| 指标     | 数值                             |
| -------- | -------------------------------- |
| 总问题数 | 8 + 4 + 13（历史审计）           |
| P0 严重  | 已修复或被已批准的产品面退役替代 |
| P1 高    | 已修复                           |
| P2 中等  | 已修复或已由统一契约覆盖         |
| 修复进度 | 100%（针对本文登记的问题）       |

---

## ✅ 已修复问题 (2026-02-07) — 企业级安全审计

### Critical P0: Forum createCategory 权限漏洞

**问题**: `createCategory` 注释写 "Admin only" 但无 `@Roles` 装饰器，任何登录用户可创建分类

**修复**: `forum.controller.ts` 添加 `@Roles(Role.ADMIN)` 装饰器

### Critical P0: XSS 漏洞 — dangerouslySetInnerHTML 无消毒

**问题**: `forum/page.tsx` 中 `renderMarkdown()` 对用户 markdown 做 regex 替换为 HTML 后直接 `dangerouslySetInnerHTML`

**修复**: 安装 `isomorphic-dompurify`，所有 `dangerouslySetInnerHTML` 值通过 `DOMPurify.sanitize()` 消毒

### Critical P0: CORS 允许所有来源

**问题**: `main.ts` 中 `origin: true` 允许所有域跨域

**修复**: 通过 `CORS_ORIGINS` 环境变量限制生产环境来源，开发环境 fallback `true`

### Critical P0: Docker 容器以 root 运行

**问题**: `Dockerfile.railway` 无 `USER` 指令

**修复**: 添加 `addgroup/adduser` 创建 `nestjs` 非 root 用户

### Critical P0: 无启动环境变量校验

**问题**: `ConfigModule.forRoot()` 无 `validationSchema`

**修复**: 创建 `env.validation.ts`，校验 `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`

### High P1: scoring.ts 零值被 fallback 覆盖

**问题**: `profile.gpaScale || 4.0` 和 `school.satAvg || 1400` — 当值为 0 时会被错误覆盖

**修复**: 改用 `??` (nullish coalescing)

### High P1: upsertSchool 无事务保护

**问题**: School + SchoolMetric 多表写入无原子性保证

**修复**: 包裹 `this.prisma.$transaction(async (tx) => { ... })`

### High P1: Auth 端点无独立速率限制

**问题**: login/register/refresh 端点仅受全局 100 req/60s 限制

**修复**: 添加 `@Throttle({ default: { limit: 5, ttl: 60000 } })` (register/login: 5/min, refresh: 10/min)

### High P1: Roles 装饰器使用字符串而非枚举

**问题**: `settings.controller.ts` 和 `agent-admin.controller.ts` 使用 `@Roles('ADMIN')` 字符串

**修复**: 全部替换为 `@Roles(Role.ADMIN)` 枚举引用

### High P1: Profile Controller 业务逻辑

**问题**: `getProfileGrade` 包含 60+ 行评分逻辑

**修复**: 提取到 `profile.service.ts` 的 `calculateProfileGrade()` 方法

### High P1: prediction.service 使用 `any` 类型

**问题**: `profileToInput(profile: any)` 和 `schoolToInput(school: any)`

**修复**: 替换为 `ProfileWithRelations` (Prisma.ProfileGetPayload) 和 `School` 类型

### High P1: 前端 middleware 无路由保护

**问题**: `middleware.ts` 仅处理 i18n，无认证检查

**修复**: 添加保护路由列表，无 token 时重定向到登录页

### High P1: CI 安全扫描不阻断

**问题**: Trivy `exit-code: '0'`，不阻断 CI

**修复**: 改为 `exit-code: '1'`，并添加 `pnpm audit --audit-level=high` 步骤

---

## ✅ 已修复问题 (2026-02-06)

### P0 RESOLVED: Schema Mismatch — School 统计字段缺失

**问题**: `satAvg`, `actAvg`, `studentCount`, `graduationRate` 被 6+ 脚本和服务引用写入，但 Prisma `model School` 中不存在这些字段，导致所有学校统计数据静默丢失。

**影响范围**: `school-data.service.ts`, `update-top100-stats.ts`, 5 个 seed 脚本, `scoring.ts`

**修复**: 在 `schema.prisma` 的 `model School` 中添加了 12 个新字段: `satAvg`, `sat25`, `sat75`, `satMath25`, `satMath75`, `satReading25`, `satReading75`, `actAvg`, `act25`, `act75`, `studentCount`, `graduationRate`

### P0 RESOLVED: Data Sync Pipeline Broken

**问题**: College Scorecard 同步服务仅获取 SAT/ACT 平均分，缺少百分位数据。

**修复**: `school-data.service.ts` 和 `update-top100-stats.ts` 现在获取并写入 SAT/ACT 25th/75th 百分位数据，同时写入 SchoolMetric 年度快照。

### P0 RESOLVED: Fragmented Scoring Formulas

**问题**: 四个独立的评分公式产生不一致的结果。

**修复**: 统一评分工具 `apps/api/src/common/utils/scoring.ts` 作为唯一评分来源。

### P1 RESOLVED: extractSchoolMetrics Reading from metadata

**问题**: `extractSchoolMetrics()` 从 `school.metadata.satAvg` 读取（始终返回 undefined），而非 School 模型直接字段。

**修复**: 重写 `extractSchoolMetrics()` 直接从 School 模型字段读取 `satAvg`, `sat25`, `sat75`, `actAvg`, `act25`, `act75`。

---

## ✅ 原 P0 - 严重问题（2026-08-12 复核：已关闭）

### 1. 论坛组队功能权限控制缺失

**位置**: `apps/api/src/modules/forum/forum.controller.ts:73-83`

**问题**: `POST /forum/posts` 缺少 VERIFIED 角色限制，USER 可创建组队帖子

**当前状态**: 已修复。Controller 与 service 双层拒绝未认证用户创建组队帖；
当前论坛创建对话框只创建普通帖子，组队入口走独立 Teams 产品面。

**修复**:

```typescript
@Post('posts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.USER)
async createPost(@CurrentUser() user, @Body() data: CreatePostDto) {
  if (data.isTeamPost && user.role !== Role.VERIFIED && user.role !== Role.ADMIN) {
    throw new ForbiddenException('Only verified users can create team posts');
  }
  return this.forumService.createPost(user.id, data);
}
```

---

### 2. 组队帖子数据初始化不完整

**位置**: `apps/api/src/modules/forum/forum.service.ts:347-380`

**问题**: `currentSize` 和 `teamStatus` 未在数据库层初始化

**当前状态**: 已修复。Prisma 模型分别以 `1` 和 `RECRUITING` 为默认值，
团队成员增减路径继续同步真实人数与状态。

**修复**:

```typescript
const post = await this.prisma.forumPost.create({
  data: {
    // ...
    currentSize: data.isTeamPost ? 1 : undefined,
    teamStatus: data.isTeamPost ? TeamStatus.RECRUITING : undefined,
  },
});
```

---

### 3. 前端论坛页面缺少权限检查

**当前状态**: 已被当前产品结构替代。论坛创建对话框固定提交
`isTeamPost: false`；组队创建与权限检查由 Teams 产品面承担，API 仍保留
第二层 VERIFIED/ADMIN 防护。

**位置**: `apps/web/src/app/[locale]/(main)/forum/page.tsx:540-559`

**修复**:

```typescript
const { user } = useAuth();
const canCreateTeam = user?.role === 'VERIFIED' || user?.role === 'ADMIN';

{canCreateTeam && (
  <Button onClick={() => { setIsTeamPost(true); setShowCreateDialog(true); }}>
    创建组队
  </Button>
)}
```

---

### 4. 互评大厅权限控制缺失

**当前状态**: 已被产品决策替代。Hall 内旧 review 子系统已经退役；仍保留的
独立 `peer-reviews` API 在 request/submit 两条写路径上均要求
`VERIFIED` 或 `ADMIN`。

**位置**: `apps/api/src/modules/hall/hall.controller.ts:44-52`

**修复**:

```typescript
@Post('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.VERIFIED)
async createReview(@CurrentUser() user, @Body() data: CreateReviewDto) {
  return this.hallService.createReview(user.id, data);
}
```

---

### 5. 前端互评页面缺少权限检查

**当前状态**: 已被产品决策替代。Hall 页面不再呈现 review tab；独立
peer-review 写接口继续以后端角色校验为最终权限边界。

**位置**: `apps/web/src/app/[locale]/(main)/hall/page.tsx:103-692`

**修复**:

```typescript
const { isVerified } = useAuth();

{isVerified ? <ReviewForm /> : <p>只有认证用户才能参与互评</p>}
```

---

## ✅ 原 P1 - 中等问题（2026-08-12 复核：已关闭）

### 6. API端点路径不一致

前端: `PATCH /forum/applications/:id`  
后端: `POST /forum/applications/:id/review`

**当前状态**: 已修复。Web 使用 `POST /forums/applications/:id/review`，与
Controller 契约一致。

**修复**: 前端改为 `POST /forum/applications/:id/review`

---

### 7. 组队申请列表API缺失

前端调用 `GET /forum/posts/:id/applications`，后端无此端点

**当前状态**: 已修复。Controller 提供 `GET /forums/posts/:id/applications`，
并将帖子作者/管理员授权判断下沉到 service。

**修复**: 添加端点

```typescript
@Get('posts/:id/applications')
@UseGuards(JwtAuthGuard)
async getApplications(@Param('id') postId: string, @CurrentUser() user) {
  return this.forumService.getApplications(postId, user.id);
}
```

---

## ✅ 原 P2 - 轻微问题（2026-08-12 复核：已关闭）

### 8. API响应格式不一致

前端期望 `{ success, data }` 格式，后端返回格式不统一

**当前状态**: 已修复。全局 `TransformInterceptor` 统一成功响应为
`{ success, data, meta }`；SSE/streaming 响应在 headers 已发送后显式跳过包装。

---

## ⏱️ 修复时间

| 阶段         | 问题数 | 时间     |
| ------------ | ------ | -------- |
| Phase 1 (P0) | 5      | 1h50m    |
| Phase 2 (P1) | 2      | 45m      |
| Phase 3 (P2) | 1      | 1h       |
| **总计**     | 8      | **3.5h** |

---

## ✅ 功能状态

| 模块             | 核心逻辑 | 权限控制 | API完整性 | i18n |
| ---------------- | -------- | -------- | --------- | ---- |
| 论坛组队         | ✅       | ✅       | ✅        | ✅   |
| 互评大厅         | 已退役   | ✅       | 已退役    | ✅   |
| 私信聊天         | ✅       | ✅       | ✅        | ✅   |
| AI选校           | ✅       | ✅       | ✅        | ✅   |
| 案例预测 (Swipe) | ✅       | ✅       | ✅        | ✅   |

---

## ✅ 已修复问题 (2026-02-09) — Hall 系统 UI/UX 全面优化

### 后端修复

| 问题                   | 严重度 | 修复                                            |
| ---------------------- | ------ | ----------------------------------------------- |
| `notIn` 查询性能       | P0     | 替换为 Prisma `none` 关系过滤器 (NOT EXISTS)    |
| `submitSwipe` 竞态条件 | P0     | 使用 `$transaction` + P2002 try-catch           |
| `getStats` 竞态条件    | P1     | 使用 `upsert` 原子操作                          |
| 时区敏感的每日挑战     | P1     | 使用 UTC 日期字符串比较                         |
| 输入验证缺失           | P1     | 添加 `@Max(20)` / `@Max(50)` DTO 校验           |
| 排行榜隐私泄露         | P1     | 用户 ID/名称脱敏                                |
| 冗余路由入口           | P2     | 移除 `SwipeController`，统一到 `HallController` |
| Fisher-Yates 洗牌      | P2     | 替换有偏随机排序                                |
| DTO 映射重复代码       | P2     | 提取 `mapCaseToDto` 私有方法                    |

### 前端修复

| 问题               | 严重度 | 修复                                 |
| ------------------ | ------ | ------------------------------------ |
| apiClient 双重解包 | P0     | 移除冗余 `.data` 访问                |
| SwipeCard 宽度为 0 | P0     | 为 motion.div 添加 `w-full max-w-md` |
| 硬编码中文文本     | P1     | 全部替换为 `next-intl` t() 调用      |
| 缺失 i18n 键       | P1     | 添加 40+ 翻译键 (zh/en)              |
| 空状态逻辑错误     | P1     | 区分"案例池为空"与"已全部看完"       |
| 方向动画缺失       | P2     | `lastDirection` 驱动退出动画         |
| 移动端响应式不足   | P2     | 添加 sm/md 断点、弹性布局            |

### UI/UX 优化

| 功能           | 描述                                                        |
| -------------- | ----------------------------------------------------------- |
| 角标印章       | SwipeCard 拖动时在角落显示 ADMIT/REJECT 印章 (替代全屏遮罩) |
| 速度检测       | 支持快速 flick 手势 (降低阈值 50%)                          |
| 渐变叠加       | 拖动时背景渐变色反馈 (绿色/红色)                            |
| 录取率进度条   | SwipeCard 底部显示录取率进度条                              |
| 键盘快捷键     | 方向键操作滑动                                              |
| 进度计数器     | 显示当前 / 总数                                             |
| 工具提示       | 操作按钮悬停显示标签和快捷键                                |
| 结果反馈浮层   | 正确/错误弹性动画 + 积分 + 连胜                             |
| 排行榜准确率条 | 每行显示迷你准确率进度条                                    |
| 连胜火焰动画   | 连胜 >= 3 时脉冲动画                                        |
| 完成庆祝       | 每日挑战完成时礼物摇晃动画                                  |
