# 全面完善计划

> 基于 2026-03-29 的系统审计、用户旅程审计、AI 质量审计的综合成果。
>
> **更新于 2026-03-30**：P0-P3 全部完成（17/18 代码任务 + 1 延后），15 commits。

## 已完成（第一轮 21 commits）

### 基础设施

- [x] 并行工具执行（读写分离，35 个 readonly 工具并行）
- [x] 语义路由（EmbeddingRouter + pgvector，shadow 模式）
- [x] 自建 LLM 调用追踪（替代 Langfuse，admin LLM Calls tab）
- [x] 路由层 + critique 指标追踪
- [x] 8 条 governance 规则（含 3 条新增安全规则）
- [x] CVE 修复（handlebars, path-to-regexp）
- [x] Gemini Code Assist PR 审查
- [x] LLM 成本计算（estimateCost 修复）
- [x] providerOptions denylist 安全修复

### AI Agent 质量

- [x] Chain-of-Verification（替代简单 critique）
- [x] Graph Memory（PostgreSQL 递归 CTE）
- [x] MCP Server（42 工具 stdio 暴露）
- [x] Profile 预加载到 system prompt
- [x] 主动截止日期提醒（scheduler）
- [x] RESUME prompt 改为大学申请格式
- [x] ESSAY prompt 加 Common App 规范检查
- [x] SCHOOL 推荐注入历史案例
- [x] PROFILE 分析注入学校对比数据
- [x] TIMELINE 个性化进度评估
- [x] 对话历史智能压缩

### Bug 修复（18 个）

- [x] 并发请求对话级锁
- [x] 推荐结果 Redis 缓存
- [x] Solve 空回复兜底
- [x] 截止日期过期标注
- [x] 搜索零结果提示
- [x] 文书长度限制
- [x] 时间线过去日期校验
- [x] Context window 溢出预检
- [x] WebSocket 断开检测
- [x] Profile 更新字段校验
- [x] 空消息 DTO 校验
- [x] 语言切换连贯性
- [x] 语言自动检测
- [x] 越界问题分层处理
- [x] Action 按钮显式返回
- [x] 新用户引导持久化
- [x] GPA 百分制/IB/A-Level 后端 bug 修复
- [x] SAT 最低分动态校验

### UX 改进（6 个）

- [x] 对话历史压缩（旧消息截断）
- [x] 错误恢复带工具信息
- [x] 新用户 profile 引导
- [x] 批量内容审核
- [x] 引导 localStorage 持久化
- [x] 论坛批量操作端点

### 框架

- [x] 用户旅程审计框架（Agent #13 + 模板 + 记录）
- [x] 19 条旅程 100% 覆盖

---

## 已完成（第二轮 15 commits，2026-03-30）

### P0: 产品核心 ✅ 全部完成

- [x] **P0-1**: react-hook-form + Zod 迁移 profile 表单（8 tab + 3 dialog，tab 错误指示，内联校验）
- [x] **P0-2**: SCHOOL 推荐显示录取+拒绝案例对比（getCaseComparison + CaseComparisonSummary 组件）
- [x] **P0-3**: ESSAY supplement word limit 自动检查（传入 linkedPrompt.wordLimit + WordLimitIndicator 组件）
- [x] **P0-4**: PREDICTION 结果追踪（已存在：ResultFeedbackButtons + Platt Scaling + Admin 校准面板）

### P1: 用户体验 ✅ 4/5 完成

- [x] **P1-5**: 首次引导优化（Header amber 圆点 + Mobile 进度环 + Dashboard mini banner）
- [x] **P1-7**: Admin 审核工作流（ReportPriority 枚举 + claim/release + 审核统计 Statistics tab）
- [x] **P1-8**: Admin scrape 确认对话框（ConfirmDialog 包裹 7 个按钮）
- [x] **P1-9**: Admin 长任务 WebSocket 进度（AdminProgressGateway + useAdminProgress hook + 实时进度条）
- [ ] ~~**P1-6**: 家长角色~~ → **延后**（无明确用户需求，工作量大）

### P2: AI 系统深化 ✅ 全部完成

- [x] **P2-10**: 语义路由激活 → 已加可观测性（routing fallback rate 在 admin 指标面板）。决策：生产环境 fallback >30% 时切 ACTIVE，否则保持 shadow
- [x] **P2-11**: SCHOOL 反思验证 → 已加可观测性（critique pass/fail rate 在 admin 指标面板）。决策：生产环境失败率 <5% 时关闭反思省 token
- [x] **P2-12**: Graph Memory 集成 Agent 工具（find_similar_applicants，多维相似度评分）
- [x] **P2-13**: MCP Server 认证（McpApiKey 模型 + bcrypt hash + prefix lookup + Admin CRUD 端点）
- [x] **P2-14**: ESSAY 声音真实性检测（5 检测信号 + authenticity 评分回传 + cliches 提取展示）

### P3: 基础设施 ✅ 3/4 完成

- [x] **P3-16**: Governance 规则扩展（8→11：i18n-key-balance, page-loading-coverage, api-route-shared-constants）
- [x] **P3-17**: eval 接入 CI（fixtures 模式，15 用例，CI 步骤加入 test job）
- [x] **P3-18**: 前端动态 Tailwind class 修复（onboarding-guide + ProfileTabNav 用静态 class map）
- [x] **P3-15**: Staging 环境配置 → **不需要**（当前规模 CI + preview deploy 已足够，无需额外维护 staging 基础设施）

---

## 第三轮（进行中，2026-03-30）

### Batch A: 基础优化 ✅

- [x] **P1-1**: 用户页面 error.tsx 边界（about, help, privacy, terms 4 个静态页，其余已有）
- [x] **P1-3**: ForumPost 复合索引（`[categoryId, createdAt]` + `[authorId, createdAt]`，migration 已建）
- [x] **P1-4**: 预测历史分页（reporting service + controller + 前端 hook，向后兼容 page=1/pageSize=20）
- [x] **P2-2**: 学校列表 Redis 缓存（非搜索查询 hash key 缓存 5 分钟，invalidateSchoolCache 含 list 清理，新增 `delByPrefix` 方法）

### Batch B: 性能与 DX ✅

- [x] **P1-2**: 懒加载 PDF/recharts（resume-export-dialog + step-results 动态 import pdf，admin page 动态 import AdminChartSection，首屏减 ~700KB）
- [x] **P2-4**: 移动端 ScrollView → FlatList（HallOfFameScreen → Animated.FlatList，EssaysScreen → FlatList + ListHeaderComponent）
- [x] **P2-5**: 共享类型文件拆分（1149 行单文件 → 13 个域文件 + barrel index.ts，零破坏性变更）
- [x] **P3-2**: 移动端 CI 增强（并行 lint/typecheck/test，新增 expo-doctor + expo export 构建验证 + 依赖审计 + Turbo 缓存）

### Batch C1: 组件拆分 + Deep Linking ✅

- [x] **P1-5**: 拆分 5 个超大组件（submit-case 768→491, school-selection 726→506, pending-cases 702→388, create-case 696→546, test-score 692→537, 新增 7 个子组件文件）
- [x] **P3-3**: 移动端 Deep Linking（lib/linking.ts 工具库 + app.json associatedDomains/intentFilters + useNotifications deepLinkPaths）

### Batch C2: Memo + 治理规则 ✅

- [x] **P2-1**: Memoize 高频渲染组件（SchoolExpandedDetails, CaseDetailDialog, RankingCard 加 React.memo）
- [x] **P3-5**: 新增 3 条治理规则 13→16（component-size-limit, service-size-limit, error-boundary-coverage）

### Batch D1: 服务拆分 + Zod ✅

- [x] **P2-3**: case.service.ts 拆分（1369→444 行，新增 case-query/batch/memory 3 个子服务，39 测试通过）
- [x] **P3-4**: 共享 Zod Schema（packages/shared/schemas/ 10 个 schema factory，web validations 改为 re-export）

### Batch D2: 后端关键测试 ✅

- [x] **P3-1**: 后端关键测试 Batch 1（auth 3 + prediction 4 = 7 个 .spec.ts，172 个新测试，覆盖 63→70 files）

### Batch D3: 移动端测试 ✅

- [x] **P3-6**: 移动端 5 个核心 screen 测试（home, prediction, chat, school-detail, scores = 26 tests，14→19 files）

---

## 渐进式优化 Backlog（不紧急，按需推进）

### 前端组件拆分（21 个 >500 行）

Top 5：`activity-form.tsx` 693, `bulk-import-tab.tsx` 665, `header.tsx` 660, `school-overview-tab.tsx` 657, `gpa-tab.tsx` 653

### 后端服务拆分（8 个 >1000 行）

`persistent-memory` 1414, `prediction` 1382, `workflow-engine` 1366, `orchestrator` 1288, `admin` 1225, `memory-manager` 1206, `essay-ai` 1203, `profile-scores` 1106
（prediction/memory 已有子服务体系，主要是 orchestration 逻辑留存）

### 后端测试覆盖 70/149 (47%)

Batch 1 (auth+prediction) 已完成。剩余 79 个未测 service：用户功能 14、AI tools 14、基础设施 37

### 移动端测试覆盖 19 files

剩余高优 screen：`timeline.tsx` 1214, `forum.tsx` 1097, `find-college.tsx` 1088

### flex-overflow-safety 120 warnings

需逐个加 `min-w-0` / `truncate`，无功能影响

---

## 待产品决策（P4）

| #   | 任务              | 决策点                                  | 状态   |
| --- | ----------------- | --------------------------------------- | ------ |
| 19  | 家长角色 (PARENT) | 是否做？做到什么程度？                  | 已延后 |
| 20  | 移动端功能差异    | 功能已齐全，但体验需审计（A11 已 PASS） | 待决策 |
| 21  | 付费/订阅体系     | 与 AI 用量限制的关系                    | 待决策 |

---

## 运维待办

| 任务                   | 操作                                                             | 地点                 |
| ---------------------- | ---------------------------------------------------------------- | -------------------- |
| P2-10 语义路由切换     | 观察 admin 面板 routing fallback rate，决定切 ACTIVE             | 生产环境 ENV         |
| P2-11 反思开关         | 观察 admin 面板 critique fail rate，决定关闭                     | agents.config.ts     |
| 清理废弃 Langfuse 变量 | 删除 LANGFUSE_PUBLIC_KEY/SECRET_KEY/BASE_URL（已用自建追踪替代） | GCP Console 环境变量 |

---

## 质量指标追踪

| 指标           | 之前                 | 当前                 | 目标      |
| -------------- | -------------------- | -------------------- | --------- |
| 用户旅程覆盖率 | 100% (19/19)         | 100% (19/19)         | 维持 100% |
| CI 全绿        | E2E 偶发 flaky       | eval fixtures 已接入 | 稳定全绿  |
| 治理规则数     | 8                    | **13**               | 12+ ✅    |
| 改进计划完成率 | 0/21                 | **21/21 (100%)** ✅  | 100%      |
| 开放 Gap 数    | 2 (B1 家长, B3 关联) | 0 (家长延后不计)     | 0 ✅      |
