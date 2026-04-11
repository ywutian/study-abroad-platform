# 用户旅程审计记录

## 2026-04-10 审计（School Library Filters + Teams Swipe/Invite 闭环）

### 元数据

| 项目     | 内容                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 日期     | 2026-04-10                                                                                                                                       |
| 触发原因 | 按 `CLAUDE.md` 工作流补齐 School Library filters 与 Teams swipe/match/invite 用户可见闭环                                                        |
| 审计范围 | Web + API；本轮不含 mobile 主 gate，不更新 `FULL_SURFACE_*` 资产                                                                                 |
| 证据类型 | code inspection + targeted tests + typecheck + routes/integration/i18n gate                                                                      |
| 正式结论 | `A10` 与新增子旅程 `SJ-5` 主链路已补齐；`invite-members` 现在可送达通知并提供 join fallback，School filters 的 badge / query / truncation 已对齐 |

### 结果摘要

| 旅程 | Persona | 评分 | 结果 | 关键结论                                                                                                                               |
| ---- | ------- | ---- | ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A10  | 申请者  | 4/5  | PASS | School Library 的 active filter badge 已改为与真实 query 同源，结果截断会显式提示，Advanced filter 的州名和 ranking preset 已收回 i18n |
| SJ-5 | 申请者  | 4/5  | PASS | Teams 组队卡现在覆盖建卡、发布、互相右滑、match 群聊、逐人邀请入队、通知送达、copy join link fallback 与 token join 接受               |

### 5 维矩阵

| 维度     | A10                                                                                            | SJ-5                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| API      | 继续复用 `GET /schools`，不新增分叉契约；前端显式展示前 100 条截断状态                         | `POST /teams/matches/:id/invite-members` 返回 `status / invitationId / token / inviteUrl / notificationSent`             |
| 类型     | `SchoolFilters` 与 query serialization 保持单源；新增 `SCHOOL_BROWSE_PAGE_SIZE` 统一 page size | shared 新增 `TeamMatchInviteResultDto` / `InviteMatchMembersResponseDto`；member DTO 暴露 display settings 供编辑器回填  |
| i18n     | `AdvancedSchoolFilter` 的州名、ranking preset 与 browse truncation 文案已进入 `en/zh` 资源     | join 页 loading 文案已进入 i18n；Teams 主页面仍有既存 hardcoded copy，当前为非 blocker warning                           |
| 权限     | 仍由 `country + filters -> dto -> Prisma where` 单链路约束结果集                               | 仅 owner/admin 可邀请；invite deep link 通过通知元数据 `team_invitation` 暴露，join 仍受 team capacity / membership 检查 |
| 错误处理 | browse 页会在结果被截断时明确提示用户缩小筛选范围                                              | 邀请结果支持 `SENT / EXISTING_PENDING / ALREADY_MEMBER`，通知失败时仍保留 copy link fallback                             |

### 已验证

- `pnpm --filter @study-abroad/shared build`
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter api exec tsc --noEmit --project tsconfig.build.json`
- `pnpm --filter web test -- --runInBand src/components/features/schools/school-filters.test.ts src/components/features/teams/team-recruitment-utils.test.ts`
- `pnpm --filter api exec jest apps/api/src/modules/team/team.service.spec.ts apps/api/src/modules/team/team.controller.spec.ts apps/api/src/modules/team/team-recruitment.service.spec.ts --runInBand`
- `pnpm lint:routes`
- `pnpm lint:integration`
- `pnpm --filter web lint:i18n`

### 非 blocker 记录

- `pnpm lint:integration` 已无 error，但仍存在全局历史 warning：hardcoded API routes、route protection coverage、cache invalidation、AI agent memory governance。
- `pnpm --filter web lint:i18n` 仍报告 `TeamsPageClient.tsx` 的既存 hardcoded 文案；本轮已修复 join 页和 School Library filter 面板，但未做整页文案迁移。
- `TeamRecruitmentService` 之前缺失专属 spec；本轮已新增并覆盖 reciprocal like / invite notification 两条关键链路。

## 2026-04-10 审计（Prediction × AI Agent 闭环整合）

### 元数据

| 项目     | 内容                                                                     |
| -------- | ------------------------------------------------------------------------ |
| 日期     | 2026-04-10                                                               |
| 触发原因 | prediction 系统升级后，补齐与 AI agent 的结构化上下文闭环                |
| 审计范围 | prediction 页面、学校详情页、profile 选校清单、AI chat、outcome feedback |

### 审计结果

| 旅程 | Persona | 评分 | 结果 | 关键结论                                                                                                                          |
| ---- | ------- | ---- | ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| A3   | 申请者  | 4/5  | PASS | prediction 页面发起 AI 分析后，后续追问不再需要重复粘贴结果；context 已进入 `/ai-agent/chat` 会话                                 |
| A10  | 申请者  | 4/5  | PASS | 学校详情页个人预测 CTA、prediction 页分析、profile 选校 CTA 已统一归到 `school agent`，chat 内可消费 history/dashboard/list/trace |
| SJ-1 | 申请者  | 4/5  | PASS | 学校详情页进入 AI 分析时保留当前学校和个人预测语境，支持继续问“为什么这样分层 / 为什么概率变了”                                   |

### 本轮新增闭环能力

- prediction 页面 AI actions 现在传结构化 `prediction-results` context，不再只靠 prompt 文本。
- prediction 页面在 “Analyze selected schools” 动作下会显式传 `selected-schools` context，不再被已有 prediction batch 覆盖。
- school detail 和 profile school list 已接入 `selected-schools` / 单校 prediction context。
- school detail 的单校 prediction context 会带 `latestOutcomeLabel`，确保用户上报结果后再进入 AI chat 仍能感知最新 outcome。
- chat 会话会持久化最近一次 prediction context 摘要，并写入 `prediction_ui_context` memory 供后续追问理解。
- `get_prediction_trace_summary` 为用户侧提供安全解释字段；raw `servedTrace` 与 shadow 结果未暴露。
- 用户上报实际结果后，后续相关 agent 对话可感知最新 outcome；只有 `ADMITTED / REJECTED` 进入 calibration 语义。

### 审计备注

- 本轮明确保持 `prediction` 归属 `school agent`，未新增独立 prediction agent。
- `v5 ML-primary` 如仍处于 shadow，只保留在治理/监控层，不进入当前用户侧回答。

## 2026-04-02 Governance Update

- 新增 full-surface audit 框架，用于覆盖 `route + capability + journey overlay` 三层审计，不再仅依赖 active journeys。
- 机器可读事实源：`scripts/release-gate/full-surface-registry.ts`
- 复用资产入口：
  - `docs/FULL_SURFACE_REGISTRY.md`
  - `docs/FULL_SURFACE_REUSE_PLAYBOOK.md`
  - `docs/FULL_SURFACE_GAP_CHECKLIST.md`
  - `MEMORY.md`
- 后续 full-surface 专项审计的 route/capability 明细不写入本文件；本文件只继续承载受影响 journey 的摘要结论。

> 每次审计完成后追加一个 section。持续积累，用于趋势分析和防漏。
> 自 2026-04-02 起，journey log 只保留 journey 级摘要；全产品面页面/能力明细请写入 `docs/FULL_SURFACE_AUDIT_LOG_<date>.md`。

---

## 2026-04-10 审计（申请分析补充闭环，targeted closure audit）

### 元数据

| 项目     | 内容                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------- |
| 日期     | 2026-04-10                                                                                               |
| 触发原因 | `GET /profiles/me/ai-analysis` canonical 化后补齐弱态、失效、消费回归与 workflow 闭环                    |
| 审计范围 | Profile 页申请分析 + `uncommon-app` canonical 消费 + 申请分析缓存 freshness + 弱态展示                   |
| 证据类型 | 定向 automated regression + contract/code inspection；本轮未重跑完整 live browser E2E                    |
| 正式结论 | 学校级申请分析主链路已统一到 `/profiles/me/ai-analysis`，弱态与降级路径已补齐，旧 `/me/grade` 仅保留兼容 |

### 结果摘要

| ID   | 状态 | 评分 | 入口 / 介质                     | 结论                                                                                  |
| ---- | ---- | ---- | ------------------------------- | ------------------------------------------------------------------------------------- |
| AA-1 | PASS | 4/5  | Profile 页面 / web              | 完整档案 + 目标校 + prediction 时，会展示学校级难点、补偿优势、top gaps、action plan  |
| AA-2 | PASS | 4/5  | Profile 页面 / web              | 无目标校时明确落到 `noTargetSchools`，不再伪造学校级 insight                          |
| AA-3 | PASS | 4/5  | Profile 页面 / web              | 有目标校但无 prediction 时明确落到 `noPredictions`，学校卡片回退为 weak state         |
| AA-4 | PASS | 4/5  | Profile 页面 / web              | synthesis 失败时返回 `analysisError` + `degraded`，页面保留基础判断但不展示伪造结论   |
| AA-5 | PASS | 4/5  | `uncommon-app` / web            | profile analysis 已只走 `profileRoutes.aiAnalysis()`，不再调用 profile agent 文本分析 |
| AA-6 | PASS | 4/5  | Profile + School List / backend | school round 变化、profile 变化、推荐信变化会失效申请分析缓存并触发重新判断           |

### 本轮覆盖的关键场景

- 完整档案 + 目标校 + prediction：学校级输出存在且结构化字段可消费
- 无目标校：`noTargetSchools`
- 有目标校但无 prediction：`noPredictions`
- synthesis throw / JSON 失败：`analysisError` + `degraded`
- 修改 school round 后重新分析：stale refresh 触发
- recommendation letter 变更：申请分析缓存失效

### 非 blocker 记录

以下问题在本轮 `--staged` gate 中仍可见，但与申请分析闭环无直接关系，未纳入本批修复：

- `ai-agent.controller` 参数签名 / spec 不一致
- `persistent-memory.service` Prisma 类型错误
- `school.controller.spec` 缺 `SchoolCommunityRatingService` provider

---

## 2026-04-10 审计（申请分析跨端闭环，mobile + docs closure）

### 元数据

| 项目     | 内容                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日期     | 2026-04-10                                                                                                                                                |
| 触发原因 | 按三版本闭环方案补齐 application analysis 的 mobile consumer、route registry 与 docs closure                                                              |
| 审计范围 | Web Profile 申请分析 + mobile `/profile`、`/profile/analysis`、`/prediction` + canonical contract docs                                                    |
| 证据类型 | targeted tests + mobile typecheck + i18n checks + docs/registry inspection                                                                                |
| 正式结论 | `GET /profiles/me/ai-analysis` 已成为 web + mobile 的统一申请分析入口；A11 受影响路由核心 runtime 已补齐，Android remote push 条件 blocker 维持非阻塞追踪 |

### 结果摘要

| ID    | 状态 | 评分 | 入口 / 介质                | 结论                                                                                      |
| ----- | ---- | ---- | -------------------------- | ----------------------------------------------------------------------------------------- |
| AA-M1 | PASS | 4/5  | mobile `/profile`          | Profile 页新增申请分析摘要卡，可显示 freshness / state / data quality 并跳转详情页        |
| AA-M2 | PASS | 4/5  | mobile `/profile/analysis` | 详情页消费 canonical `AIAnalysisResult`，可展示学校级 insight、policy badges、action plan |
| AA-M3 | PASS | 4/5  | mobile `/prediction`       | Prediction 页面新增 canonical analysis CTA，跨端策略语义与 web 对齐                       |
| AA-M4 | PASS | 4/5  | docs + registry            | API / Architecture / Research / SOP / Journey log / Full Surface Registry 已同步收口      |

### 已验证

- `pnpm --filter web test -- src/components/features/profile/ProfileAIAnalysis.test.tsx`
- `pnpm --filter api test -- modules/profile/profile-application-analysis.service.spec.ts`
- `pnpm --filter study-abroad-mobile typecheck`
- `pnpm --filter study-abroad-mobile test -- src/__tests__/screens/profile.test.tsx src/__tests__/screens/profile-analysis.test.tsx src/__tests__/screens/prediction.test.tsx src/__tests__/lib/ai-service.test.ts src/__tests__/lib/i18n.test.ts`
- `pnpm --filter web lint:i18n`

### 审计备注

- 本轮把 mobile `/profile`、`/profile/analysis`、`/prediction` 视为 A11 受影响路由并单独补证据，但不把 Android remote push 条件能力 blocker 混写成 application analysis runtime blocker。
- 文档闭环范围包括 API、架构、研究文档、prediction SOP、journey log、docs index、memory 和 full-surface registry。

### 非 blocker 记录

- `A11 / SJ-3` 的 Android remote push 依然受 Firebase / FCM 原生配置约束，继续按 conditional capability gate 跟踪；本轮申请分析不依赖 push，因此不构成 release blocker。

---

## 2026-04-10 审计（申请分析 V2 governance 骨架）

### 元数据

| 项目     | 内容                                                                                                                                      |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 日期     | 2026-04-10                                                                                                                                |
| 触发原因 | 按 application analysis 全面执行计划补齐 `V2` 数据模型、admin workflow、runtime active-policy 接线与实验框架                              |
| 审计范围 | `/admin/application-analysis-workflow`、`ApplicationAnalysisPolicyVersion`、`SchoolPolicyEvidence`、`ApplicationAnalysisEvaluationRun`    |
| 证据类型 | API build + web/mobile typecheck + focused workflow tests + docs / SOP / registry 更新                                                    |
| 正式结论 | 申请分析已具备独立的 `evidence → candidate → shadow → gates → activate / rollback` 治理骨架；applicant runtime 继续只消费 `ACTIVE` policy |

### 结果摘要

| ID    | 状态 | 评分 | 入口 / 介质                              | 结论                                                                                          |
| ----- | ---- | ---- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| AA-G1 | PASS | 4/5  | admin `/application-analysis-workflow`   | Evidence / Policies / Evaluations / Gates / Activate-Rollback 五个 tab 可运行                 |
| AA-G2 | PASS | 4/5  | API workflow endpoints                   | 已补齐 evidence、policy、evaluation、gate、activate、rollback、experiment preview             |
| AA-G3 | PASS | 4/5  | applicant runtime                        | `/profiles/me/ai-analysis` 开始读取 `ACTIVE` policy 和 approved evidence；无 active 时回退 V1 |
| AA-G4 | PASS | 4/5  | docs / SOP / memory / API / architecture | V2 workflow 与 V3 experimental 边界已写实，不再只停留在 research 计划层                       |

### 已验证

- `pnpm --filter api build`
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter study-abroad-mobile typecheck`
- `pnpm --filter api test -- src/modules/profile/application-analysis-workflow.service.spec.ts`

### 审计备注

- 这批把 application analysis 的治理链正式从 prediction SOP 中拆分出来，独立成 `APPLICATION_ANALYSIS_WORKFLOW_SOP.md` 与 `APPLICATION_ANALYSIS_EXPERIMENTAL_SOP.md`。
- runtime 继续保持 applicant-facing contract 稳定，不引入第二个公开 application-analysis API。

### 非 blocker 记录

- `prisma migrate dev --create-only` 仍被仓库既有 shadow DB 历史问题阻塞：`20260322130000_sync_schema_changes` 在 shadow database 回放失败；本批已补手写 migration 文件，不把该历史问题误记为本批 schema blocker。

---

## 2026-04-10 审计（申请分析 V3 capability-gated runtime）

### 元数据

| 项目     | 内容                                                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日期     | 2026-04-10                                                                                                                                                                    |
| 触发原因 | 按 V3 成熟闭环方案，将 recourse / strategy uncertainty / fairness disclosure 从 admin preview 升级为 capability-gated applicant runtime                                       |
| 审计范围 | `/profiles/me/ai-analysis` additive contract、`/admin/application-analysis-workflow/experiments`、web/mobile 结构化渲染与 capability 回退                                     |
| 证据类型 | focused API/web/mobile tests + typecheck + i18n + `verify-gate --staged` + docs / registry inspection                                                                         |
| 正式结论 | V3 已具备 capability-scoped `DRAFT → SHADOW → CANARY → ACTIVE → RETIRED` 治理链；applicant runtime 仅在 `ACTIVE/CANARY + flag` 条件满足时输出加法字段，关闭时静默回退到 V2/V1 |

### 结果摘要

| ID     | 状态 | 评分 | 入口 / 介质                                  | 结论                                                                                               |
| ------ | ---- | ---- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| AA-V31 | PASS | 4/5  | admin `/application-analysis-workflow`       | Experiments tab 可创建 capability version，并触发 shadow / canary / evaluate / activate / retire   |
| AA-V32 | PASS | 4/5  | applicant `/profiles/me/ai-analysis` runtime | `recourseGuidance`、`strategyUncertainty`、`fairnessDisclosure` 只在 runtime experiment 启用时出现 |
| AA-V33 | PASS | 4/5  | web Profile analysis                         | 学校卡片和顶层公平披露可渲染 V3 字段；字段缺失时自动回退，无占位失败文案                           |
| AA-V34 | PASS | 4/5  | mobile `/profile/analysis`                   | 与 web 同义渲染 recourse / uncertainty / fairness disclosure，不引入单端语义漂移                   |
| AA-V35 | PASS | 4/5  | feature flags + cache invalidation           | capability 进入 `CANARY/ACTIVE` 会同步 flag；`retire` 会关闭能力并失效 applicant cache             |
| AA-V36 | PASS | 4/5  | automated sweep / admin manual trigger       | `SHADOW -> CANARY -> ACTIVE -> RETIRED` 已具备 nightly sweep 与手动 `experiments/sweep` 双路径     |

### 已验证

- `pnpm --filter api exec prisma generate`
- `pnpm --filter api test -- src/modules/profile/profile-application-analysis.service.spec.ts src/modules/profile/application-analysis-workflow.service.spec.ts`
- `pnpm --filter web test -- src/components/features/profile/ProfileAIAnalysis.test.tsx`
- `pnpm --filter study-abroad-mobile test -- src/__tests__/screens/profile-analysis.test.tsx`
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter study-abroad-mobile typecheck`
- `pnpm --filter web lint:i18n`
- `npx tsx scripts/verify-gate.ts --staged --verbose`

### 审计备注

- 本轮没有新增第二个 applicant-facing endpoint，仍然统一走 `/profiles/me/ai-analysis`。
- `prediction` 仍是唯一概率事实源；V3 只增加 strategy layer 字段，不新增第三套概率 contract。
- `CANARY` 通过 capability feature flag 的 percentage rollout 生效；nightly sweep 会自动刷新评估、推进 ready capability，并对 regressions 执行 auto-retire。
- admin 仍可手动调用 `experiments/sweep` 复跑同一套编排逻辑，以便在证据或 gate 更新后立即推进。

### 非 blocker 记录

- 当前自动化是 nightly cron + admin manual sweep，尚未扩展到多阶段 hourly canary train 或跨实例 leader election；如果后续要做更细粒度的 release train，需要单独补编排与分布式互斥。

---

## 2026-03-29 审计（AI Agent 系统全量）

### 元数据

| 项目     | 内容                                                   |
| -------- | ------------------------------------------------------ |
| 日期     | 2026-03-29                                             |
| 触发原因 | AI Agent 企业级升级后的验收审计                        |
| 审计范围 | AI Agent 系统（Persona A 的 A3-A9 + 功能审计 10 维度） |

### 审计结果

#### 功能审计（10 维度）

| #   | 维度            | 结果                               |
| --- | --------------- | ---------------------------------- |
| 1   | 工具注册完整性  | PASS — 42 个工具全部有 handler     |
| 2   | 委派安全性      | PASS — 无自循环、深度限制 3        |
| 3   | 对话所有权      | PASS — 所有操作验证 userId         |
| 4   | 内容审核覆盖    | PASS — 所有响应路径经过 moderation |
| 5   | Token 配额执行  | PASS — Guard 层拦截                |
| 6   | WebSocket 认证  | PASS — JWT 必须                    |
| 7   | Admin 端点权限  | PASS — 类级 @Roles(ADMIN)          |
| 8   | 工具错误消息    | PASS — 多语言 + 有上下文           |
| 9   | 数据清理 / GDPR | PASS — 衰减调度 + 删除接口         |
| 10  | Feature Flag    | PASS — 运行时可切换                |

#### 用户旅程审计（12 个 Bug + 6 个 UX）

**发现并修复的 18 个问题：**

| ID     | 旅程  | 问题                            | 严重性 | 状态     |
| ------ | ----- | ------------------------------- | ------ | -------- |
| Bug-1  | A6    | 并发请求竞争同一对话            | HIGH   | verified |
| Bug-2  | A3    | 推荐结果不可复现（无缓存）      | HIGH   | verified |
| Bug-3  | A3-A5 | Solve 阶段返回空白回复          | MEDIUM | verified |
| Bug-4  | A3    | 推荐已过期截止日期的学校        | MEDIUM | verified |
| Bug-5  | A3    | 搜索返回 0 结果无提示           | MEDIUM | verified |
| Bug-6  | A4    | 文书润色无长度限制              | MEDIUM | verified |
| Bug-7  | A5    | 时间线可创建过去的事件          | MEDIUM | verified |
| Bug-8  | A6    | 超长消息溢出 context window     | MEDIUM | verified |
| Bug-9  | A6    | WebSocket 流式断开不停止        | MEDIUM | verified |
| Bug-10 | A2    | profile 更新无字段校验          | MEDIUM | verified |
| Bug-11 | A3-A5 | 空消息校验不一致                | MEDIUM | verified |
| Bug-12 | A7    | 中英文切换回复不连贯            | MEDIUM | verified |
| UX-1   | A7    | 用户用英文但系统用中文回复      | HIGH   | verified |
| UX-2   | A8    | 越界问题无分层处理              | HIGH   | verified |
| UX-3   | A3    | Action 按钮靠关键词匹配（脆弱） | HIGH   | verified |
| UX-4   | A6    | 对话历史不压缩旧消息            | MEDIUM | verified |
| UX-5   | A9    | 错误恢复消息不含工具信息        | MEDIUM | verified |
| UX-6   | A3    | 新用户无档案引导                | MEDIUM | verified |

### 已验证通过的旅程（下次可跳过，除非相关代码变更）

- 工具注册完整性 (2026-03-29)
- 委派安全性 (2026-03-29)
- 对话所有权 (2026-03-29)
- 内容审核覆盖 (2026-03-29)
- Token 配额执行 (2026-03-29)
- WebSocket 认证 (2026-03-29)
- Admin 端点权限 (2026-03-29)
- 数据清理 / GDPR (2026-03-29)
- Feature Flag (2026-03-29)

### 尚未审计的旅程

- A1 注册→首次登录→引导
- A2 填写档案（仅审计了 profile 更新校验，未审计完整 UI 流程）
- A10 预测结果 / 案例库 / 排名
- A11 移动端一致性
- B1-B3 家长旅程
- C1-C5 管理员旅程

### 指标趋势

| 日期       | 发现问题数 | 修复数 | 旅程覆盖率   |
| ---------- | ---------- | ------ | ------------ |
| 2026-03-29 | 18         | 18     | 47% (9/19)   |
| 2026-03-29 | 7          | 4      | 100% (19/19) |

---

## 2026-03-29 补充审计（剩余 10 条旅程）

### 审计结果

| #   | 旅程                      | Persona | 评分 | 结果   | 关键发现                                                                          |
| --- | ------------------------- | ------- | ---- | ------ | --------------------------------------------------------------------------------- |
| A1  | 注册→首次登录→引导        | 申请者  | 3/5  | ISSUE  | 引导可跳过，无强制新手流程                                                        |
| A2  | 填写档案                  | 申请者  | 3/5  | ISSUE  | 无内联字段校验，缺少必填标记                                                      |
| A10 | 预测/案例库/排名          | 申请者  | 4/5  | PASS   | 核心功能完整，缺 loading skeleton                                                 |
| A11 | 移动端一致性              | 申请者  | 4/5  | PASS   | **修正**：移动端功能完整（30+ 路由，含 profile/prediction/ranking）。之前审计误报 |
| B1  | 家长注册→查看进度         | 家长    | 1/5  | BROKEN | 系统无 PARENT 角色，旅程不存在                                                    |
| B2  | AI 中文问学费/签证        | 家长    | 4/5  | PASS   | 已有分层处理 + web_search                                                         |
| B3  | 查看选校列表和概率        | 家长    | 3/5  | ISSUE  | 无家长角色无法查看孩子数据                                                        |
| C1  | admin Dashboard           | 管理员  | 4/5  | PASS   | 布局清晰，缺错误边界                                                              |
| C2  | AI Operations → LLM Calls | 管理员  | 4/5  | PASS   | 功能完整，缺导出/排序                                                             |
| C3  | 用户管理                  | 管理员  | 4/5  | PASS   | 批量操作好，角色变更缺确认                                                        |
| C4  | 内容审核                  | 管理员  | 4/5  | PASS   | **已修复**：批量审核已实现（Batch 10）                                            |
| C5  | 学校数据管理              | 管理员  | 4/5  | PASS   | 三 tab 功能完整（列表+数据质量+同步）                                             |

### 问题状态更新

| ID    | 旅程 | 问题                               | 严重性   | 状态                                         |
| ----- | ---- | ---------------------------------- | -------- | -------------------------------------------- |
| GAP-1 | A11  | ~~移动端缺功能~~                   | ~~HIGH~~ | **closed（误报）**：移动端功能完整           |
| GAP-2 | B1   | 系统无 PARENT 角色，家长旅程不存在 | HIGH     | **wontfix**：产品决策不做家长角色            |
| GAP-3 | A1   | 新手引导可跳过                     | MEDIUM   | **fixed**（Batch 8：localStorage 持久化）    |
| GAP-4 | A2   | 档案 GPA 校验 bug                  | MEDIUM   | **fixed**（Batch 9：@Max(100) + scale 修复） |
| GAP-5 | C4   | 内容审核无批量操作                 | MEDIUM   | **fixed**（Batch 10：batch endpoint + UI）   |
| GAP-6 | B3   | 无家长账号关联机制                 | MEDIUM   | **wontfix**：依赖 GAP-2，已决策不做          |
| GAP-7 | C5   | 学校数据管理                       | LOW      | **closed**：审计完成，4/5 PASS               |

### 覆盖率更新

```
已审计旅程: 19 / 19
覆盖率: 100%
```

### 已验证通过（新增）

- A10 预测/案例库/排名 (2026-03-29)
- B2 AI 中文问学费/签证 (2026-03-29)
- C1 admin Dashboard (2026-03-29)
- C2 AI Operations LLM Calls (2026-03-29)
- C3 用户管理 (2026-03-29)

> 下一步：GAP-1（移动端）和 GAP-2（家长角色）需要产品决策——是要补齐还是从注册表中移除。

---

## 2026-03-31 审计（`fbd6095` 全量运行态重跑，23/23 已记录，审计保持 open）

### 审计元数据

| 项目       | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日期       | 2026-03-31                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| HEAD       | `fbd6095`                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 审计范围   | 注册表 19 条主旅程 + `SJ-1..SJ-4` 4 条新增子旅程                                                                                                                                                                                                                                                                                                                                                                                                               |
| 执行方式   | 本地 dev stack + 真实 Web/Admin 运行态 + Android Expo / Android 真机 dev build + 真实 MCP key / stdio 探测                                                                                                                                                                                                                                                                                                                                                     |
| 正式状态集 | `PASS / ISSUE / BROKEN / BLOCKED / SKIPPED`                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 证据目录   | `e2e-report/journeys-2026-03-31/`                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 正式结论   | `23/23` journey records 均已补齐且无空白状态；Web/Admin/MCP 与 mobile core flows 已重跑完成。2026-04-02 follow-up 又在 Android emulator 上补跑了 Home / Schools / Cases / AI / Profile / Forum / Notifications，确认 mobile 不再是“整体不可用”；standalone `studyabroad://` deep link 也已在 Android 真机 dev build 下验证成功，但 `A11` 与 `SJ-3` 仍因 Android Firebase / FCM 原生配置缺失而无法完成真实 remote push，故继续保持 `BLOCKED`，本轮审计继续 open |

### 运行环境 gate

- 本轮在本地 `fbd6095` dev stack 上执行，Web/API/Admin 证据全部来自真实运行中的本地应用。
- 申请者、管理员与丰富样本账号均可实际登录；A 系与 C 系旅程使用 `alice.zhang@demo.studyabroad.com`、`demo@example.com`、`admin@example.com` 等真实 seed 账号完成。
- iOS 模拟器在本会话中无法连接 `CoreSimulatorService`，A11/SJ-3 改走 Android；先用 Android runtime 完成 Home / Profile / Prediction / Notifications 运行态验证，再用 USB 连接的真实 Android 手机和独立 dev build 验证 production `studyabroad://` scheme。2026-04-02 follow-up 又在 Android emulator 上补跑了 Home / Schools / Cases / AI / Profile / Forum / Notifications，mobile blocker 已从“启动崩溃 / 模拟器无数据”进一步收敛为“Android Firebase / FCM 原生配置缺失，导致真机也无法完成 Expo push token 注册”。
- SJ-4 已使用真实 admin 账号创建 MCP key，并完成 live tool call、rejection 与 free-text guard 路径的本地重跑。

### 新增子旅程固定登记

- `SJ-1` 学校详情 → 学校对比
- `SJ-2` Web 通知中心 / 通知页
- `SJ-3` Mobile 通知页
- `SJ-4` Admin 创建 MCP key → 外部 MCP 客户端调用工具

### 结果汇总

| 状态    | 数量 |
| ------- | ---- |
| PASS    | 18   |
| ISSUE   | 0    |
| BROKEN  | 0    |
| BLOCKED | 2    |
| SKIPPED | 3    |

### 23 条结果矩阵

| ID   | 状态    | 评分 | 账号 / 介质                                 | 证据                                              | 备注                                                                                                                                                                               |
| ---- | ------- | ---- | ------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | PASS    | 4/5  | fresh applicant / web                       | `e2e-report/journeys-2026-03-31/A1/record.json`   | 注册 + auto-login + onboarding 恢复链已重跑通过                                                                                                                                    |
| A2   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/A2/record.json`   | profile 全 CRUD 与保存回显已跑通                                                                                                                                                   |
| A3   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/A3/record.json`   | 首次选校推荐生成成功                                                                                                                                                               |
| A4   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A4/record.json`   | 文书评审 / 润色单轮完成                                                                                                                                                            |
| A5   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A5/record.json`   | 时间线单轮完成，文本摘录有流式抓取噪声                                                                                                                                             |
| A6   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A6/record.json`   | 5+ 轮多轮对话已在同一会话真实跑通                                                                                                                                                  |
| A7   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A7/record.json`   | 中英文切换单轮完成                                                                                                                                                                 |
| A8   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A8/record.json`   | 越界问题单轮完成                                                                                                                                                                   |
| A9   | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web AI | `e2e-report/journeys-2026-03-31/A9/record.json`   | 工具失败 / 错误恢复单轮完成                                                                                                                                                        |
| A10  | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/A10/record.json`  | prediction/history/cases/ranking 重跑通过                                                                                                                                          |
| A11  | BLOCKED | 3/5  | Android emulator + Android 真机 + dev build | `e2e-report/journeys-2026-03-31/A11/record.json`  | Emulator 已重跑通过 Home / Schools / Cases / AI / Profile / Forum / Notifications；真机 deep link 也已验证，剩余 blocker 仅是 Firebase / FCM 未初始化导致 Expo push token 申请失败 |
| B1   | SKIPPED | 1/5  | web                                         | `e2e-report/journeys-2026-03-31/B1/record.json`   | 当前产品无 parent persona 入口                                                                                                                                                     |
| B2   | SKIPPED | 1/5  | web                                         | `e2e-report/journeys-2026-03-31/B2/record.json`   | parent AI 旅程无法真实进入                                                                                                                                                         |
| B3   | SKIPPED | 1/5  | web                                         | `e2e-report/journeys-2026-03-31/B3/record.json`   | parent 选校监督旅程无法真实进入                                                                                                                                                    |
| C1   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C1/record.json`   | admin dashboard 已实际加载                                                                                                                                                         |
| C2   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C2/record.json`   | AI Operations / LLM Calls 已实际加载                                                                                                                                               |
| C3   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C3/record.json`   | 用户管理 → AI 使用已实际加载                                                                                                                                                       |
| C4   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C4/record.json`   | 内容审核 → 举报处理已实际加载                                                                                                                                                      |
| C5   | PASS    | 4/5  | `admin@example.com` / web                   | `e2e-report/journeys-2026-03-31/C5/record.json`   | 学校数据质量页已实际加载                                                                                                                                                           |
| SJ-1 | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/SJ-1/record.json` | 学校详情 → 对比页重跑通过                                                                                                                                                          |
| SJ-2 | PASS    | 4/5  | `alice.zhang@demo.studyabroad.com` / web    | `e2e-report/journeys-2026-03-31/SJ-2/record.json` | 通知中心 + 通知页 + mark-all 已实际跑通                                                                                                                                            |
| SJ-3 | BLOCKED | 3/5  | Android emulator + Android 真机 + runtime   | `e2e-report/journeys-2026-03-31/SJ-3/record.json` | 通知页 delete/read/unread sync 已在 emulator + 真机复核；剩余 blocker 仅是 Firebase / FCM 未初始化导致真实 remote push 无法送达 / 打开                                             |
| SJ-4 | PASS    | 4/5  | `admin@example.com` + MCP stdio             | `e2e-report/journeys-2026-03-31/SJ-4/record.json` | live key / invalid-expired-revoked key / free-text guard 已重跑通过                                                                                                                |

### 本轮 regression / blocker 汇总

- `A11` / `SJ-3` `BLOCKED`：mobile startup blocker 已解除，2026-04-02 follow-up 又在 Android emulator 上重跑了 Home / Schools / Cases / AI / Profile / Forum / Notifications；AI `Analyze my profile` 已能返回完整答案。当前唯一剩余 blocker 已不是 app 启动、seed 数据或 emulator 介质，而是 Android Firebase / FCM 原生配置缺失：`apps/mobile/android/app/google-services.json` 缺失，导致 `Notifications.getExpoPushTokenAsync` 在真机上报 `Default FirebaseApp is not initialized in this process com.studyabroad.mobile`。根因与限制见 `apps/mobile/src/hooks/useNotifications.ts:90-142`、`apps/mobile/src/lib/api/client.ts`、`apps/mobile/src/app/(tabs)/ai.tsx`、`apps/mobile/android/app/build.gradle`、`apps/mobile/android/build.gradle` 与 `e2e-report/journeys-2026-03-31/A11/push-limitations.txt`。
- `B1-B3` `SKIPPED`：本轮不是沿用旧结论，而是实际再次确认 live product 不存在 parent 角色 / 入口，因此正式记为 `SKIPPED`。
- 其余 `A1-A10`、`C1-C5`、`SJ-1`、`SJ-2`、`SJ-4` 已在本轮修复后重新实际跑通，不进入当前 blocker set。

### Stop condition 检查

| 检查项                                         | 结果                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `19` 条主旅程 + `4` 条子旅程是否全部有非空状态 | 是                                                                                                                                          |
| 是否全部有运行态 evidence path                 | 是                                                                                                                                          |
| 是否存在空白条目                               | 否                                                                                                                                          |
| 是否仍存在 `BLOCKED`                           | 是，`A11` 与 `SJ-3`                                                                                                                         |
| 本轮审计是否可关闭                             | 否；当前 `A11 / SJ-3` 的 Android remote push 已改为 `conditional capability gate`，不再等同于核心 runtime blocker，但该条件能力仍需单独跟踪 |

### 2026-04-02 Follow-up（Android emulator 复测）

- 触发原因：用户在 follow-up 中指出“模拟器也没有数据，AI 不能用”，因此对 Android emulator 做了额外真实运行态复测。
- 复测结果：
  - local API health、db、redis 全部恢复后，emulator 里的 Home / Schools / Cases / AI / Profile / Forum / Notifications 都能加载真实 seed 数据。
  - `Analyze my profile` 现在会在 mobile AI tab 返回完整文案，不再出现 `HTTP 401`、`No response body` 或只有空白消息气泡的旧坏态。
  - 这次复测确认此前“模拟器无数据 / AI 不可用”并不是单一后端停机，而是 `db` 未启动、feature seed 里 case 未自动变成 public review status、mobile API client 对顶层 `data` 字段的过度解包、以及 RN SSE body reader 不稳定几项问题叠加。
- 新增证据：
  - `e2e-report/journeys-2026-03-31/A11/07-emulator-home.png`
  - `e2e-report/journeys-2026-03-31/A11/08-emulator-schools.png`
  - `e2e-report/journeys-2026-03-31/A11/09-emulator-cases.png`
  - `e2e-report/journeys-2026-03-31/A11/10-emulator-ai-answer.png`
  - `e2e-report/journeys-2026-03-31/A11/11-emulator-profile.png`
  - `e2e-report/journeys-2026-03-31/A11/12-emulator-forum.png`
  - `e2e-report/journeys-2026-03-31/A11/13-emulator-notifications.png`
  - `e2e-report/journeys-2026-03-31/A11/emulator-runtime-smoke.txt`
  - `e2e-report/journeys-2026-03-31/SJ-3/04-emulator-notifications-list.png`
  - `e2e-report/journeys-2026-03-31/SJ-3/emulator-runtime-smoke.txt`

### 2026-04-02 Follow-up（漏检检查点回填）

- 在上面的 emulator follow-up 之后，用户继续指出了几类此前检查遗漏、但确属 mobile 真实体验的一阶检查点：
  - Profile 页虽然“能加载”，但 completion ring 与文案布局一度明显失衡；
  - 学校页虽然“有数据”，但 school logo 没有走统一来源与 website-domain fallback；
  - Home quick action 里的 `Swipe Game` 没被纳入初次 emulator follow-up，后续实际打开后直接崩溃；
  - `Swipe Game` 崩溃修掉后，结果 overlay 仍暴露出 i18n 模板残留和明显失衡的反馈设计。
- 这些点说明本轮 `A11` 的“follow-up 已通过”只能解释为 mobile core data/runtime 已恢复，不能外推为“视觉、品牌资产、二级入口与瞬时反馈层已全部复核”。
- 本轮已将这些漏检点追加到工作底稿 `docs/CODE_REVIEW_2026-03-31_fbd6095.md` 的 mobile checklist 中；后续 A11 / SJ-3 复跑必须显式覆盖：
  - profile 布局与进度组件；
  - 学校 logo 来源/fallback；
  - 至少一个 Home quick action 二级入口；
  - 至少一个瞬时反馈态（如 Swipe result overlay）。

### 备注

- A4/A5/A7/A8/A9 的 `response.txt` 受流式 UI 抓取方式影响，文本摘录存在噪声；状态判定以截图、live page 完成态和实际 POST 成功为准。
- 本轮对子旅程 `SJ-1..SJ-4` 先按稳定临时 ID 固定登记；是否升格进入主注册表，待后续 registry 调整时再决策。

---

## 2026-04-01 流程治理更新（AI-first 发版门禁）

### 背景

- 后续发版门禁不再采用“人工先全量探索、Codex 事后补充”的模式。
- 自本次治理更新起，正式流程切换为：`Codex 预检 -> Codex 首轮执行 -> 人工补位体验验证 -> Codex 收口复验 -> 发版结论`。

### 固定规则

- 正式门禁环境默认是共享预发环境。
- `Baseline Smoke` 必须先由 Codex 全跑。
- 非技术用户只负责体验型验证，不负责日志、接口、seed 和环境准备。
- 正式状态继续使用 `PASS / ISSUE / BROKEN / BLOCKED / SKIPPED`。
- 审计记录新增两个必填字段：
  - `execution_owner`
  - `validation_type`

### 正式产物

- `docs/QA_RELEASE_GATE_SOP.md`
- `docs/CODEX_E2E_RUNBOOK.md`
- `docs/JOURNEY_REGISTRY.md`
- `docs/RELEASE_IMPACT_MAPPING.md`
- `docs/AI_AGENT_EVALUATION_RUBRIC.md`
- `docs/CROSS_PLATFORM_REUSE_RUBRIC.md`
- `docs/PROFESSIONAL_CONSULTANCY_RUBRIC.md`
- `docs/templates/human-e2e-task-card.md`
- `docs/templates/e2e-issue-report.md`
- `docs/templates/release-gate-master.md`
- `docs/examples/AI_FIRST_RELEASE_GATE_SAMPLE.md`

### 后续执行口径

- `objective` 旅程先由 Codex 执行。
- `experiential` 旅程先由 Codex 清障，再交人工补位。
- `admin-only` 旅程由内部 owner 或 Codex 在授权范围内执行。
- 正式放行只看门禁总表、证据目录和问题单，不再从聊天记录拼结论。
- 以下 4 项从 2026-04-01 起升级为正式门禁维度，而不是“额外体验建议”：
  - 布局合理性
  - AI Agent 功能与输出合理性
  - Web / Mobile 复用合理性
  - 是否符合专业留学中介定位

## 2026-04-02 流程治理更新（conditional capability gates）

- `A11` / `SJ-3` 已正式拆成两层结论：
  - mobile 核心运行态 / 页面级行为
  - Android remote push / notification-open 条件能力
- Android remote push 现在登记为 `conditional capability gate`：
  - 缺少 `apps/mobile/android/app/google-services.json` 时，旅程记录仍可写 `BLOCKED`
  - 但这类 blocker 不再自动把整轮 release gate 判成 `HOLD`
  - release gate 默认降为 `CONDITIONAL`，同时把该能力继续列入总表、handoff 和审计 section
- 当前 live gate 包 `live-2026-04-01-gate` 已按这一新规则刷新：
  - `PASS 13 / BLOCKED 2`
  - `A11`、`SJ-3` 的 blocker 均只剩 Android remote push
  - 最终放行建议已从 `HOLD` 降为 `CONDITIONAL`

## 2026-04-02 Follow-up（Web / Admin live gate 补充复跑）

### 触发原因

- 在 live gate 已经收敛到 `A11 / SJ-3` 两条 mobile 条件能力 blocker 之后，仍需要回答一个更具体的问题：网页端是否也都已经 fresh 复核，而不是部分沿用旧证据。

### 补充复跑范围

- `SJ-1` 学校详情 → 学校对比
- `C2` AI Operations → LLM Calls
- `C3` 用户管理 → AI 使用
- `C4` 内容审核 → 举报处理
- `C5` 学校数据质量

### 复跑结果

- 上述 5 条旅程已在与 `live-2026-04-01-gate` 相同的本地 live 环境 fresh 重跑，并全部 `PASS`。
- `C2-C5` 的 fresh records 现已明确包含 `pageResponseStatus = 200` 与目标 admin 路由的 `finalUrl`，因此此前 runtime issue 中“admin 子路由可能只是截图命中页面壳子、实际仍有 404”的疑点已被清除。
- `SJ-1` 也已在同一 live 环境下补跑通过，因此当前 web applicant / admin / MCP 路径不存在新的 runtime blocker；live gate 里剩余的 `BLOCKED` 已只属于 mobile `A11 / SJ-3` 的 Android remote push 条件能力。

### 补充证据

- `e2e-report/releases/live-2026-04-01-gate/journeys/SJ-1/record.json`
- `e2e-report/releases/live-2026-04-01-gate/journeys/C2/record.json`
- `e2e-report/releases/live-2026-04-01-gate/journeys/C3/record.json`
- `e2e-report/releases/live-2026-04-01-gate/journeys/C4/record.json`
- `e2e-report/releases/live-2026-04-01-gate/journeys/C5/record.json`
- `/tmp/live-2026-04-01-gate/release-gate-master.md`

## 2026-04-02 Follow-up（Full-Surface Batch 1 Applicant Web/Auth）

### 范围

- 这是 full-surface 专项审计下的 Batch 1，不等同于 release gate。
- 本轮 fresh 重跑并回填了 applicant web/auth 相关的 journey overlay：
  - `A1`
  - `A2`
  - `SJ-2`

### 结果

- `A1`：`PASS`
- `A2`：`PASS`
- `SJ-2`：`PASS`

### 说明

- 本轮同时修掉了 full-surface runner 的两类误导性问题：
  - delegated journey force rerun 会误吃旧 `_journeys/<id>/record.json`
  - summary 会把 supporting route records 误算进 selected surface totals
- 后续收口又补了三类 runner/sample 修复：
  - guest/auth 页面匿名 `auth bootstrap` 噪音已被隔离，不再把 public/auth route 误记成 `401 / 429`
  - `ranking / register` 的 React-Radix hydration warning 已按 dev-only 窄模式降噪
  - `resumeId / teamId` 会在 sample catalog 缺失时自动最小创建
- 因此以上 3 条结论现在都基于 fresh full-surface evidence，不是沿用旧 gate 记录；对应的 Batch 1 aggregate 也已收口为 `43/43 PASS`。
- 随后的 canonical reconciliation 又补掉了 3 个 applicant web 真实 hydration 问题：
  - profile completeness 首屏 `0 -> 100`
  - settings theme/toggle 首屏 mismatch
  - applicant 根入口 `/:locale` 实际落到 dashboard 后的欢迎语 / 统计区 mismatch
- 这些问题不改变 `A1 / A2 / SJ-2` 的最终旅程结论，但已作为 Batch 1 产品修复正式收口，不再留在审计噪音里。

### 证据

- `e2e-report/full-surface-2026-04-02/JOURNEY__A1/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__A2/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__SJ-2/record.json`

## 2026-04-02 Follow-up（Full-Surface Batch 2 Applicant AI / 留学业务）

### 范围

- 这是 full-surface 专项审计下的 Batch 2，不等同于 release gate。
- 本轮 fresh 重跑并回填了 applicant AI / business 相关 journey overlay：
  - `A3`
  - `A4`
  - `A5`
  - `A6`
  - `A7`
  - `A8`
  - `A9`
  - `A10`
  - `SJ-1`

### 结果

- `A3`：full-surface canonical rerun confirmed `PASS`
- `A10`：full-surface canonical rerun confirmed `PASS`
- `SJ-1`：保持 `PASS`
- Batch 2 aggregate：`26/26 PASS`

### 说明

- 本轮先前最像产品回归的 recommendation 抖动，已确认不是新的 applicant 推荐链路故障。
- 真正的根因是审计 harness：
  - web 长耗时 AI 请求默认穿 Next rewrite proxy，在 dev 环境下不稳；
  - delegated journey `record.json` 写出晚于 full-surface 父进程默认 `90s` 窗口；
  - 对同一 delegated journey 高频 `force-rerun` 会放大 auth throttling / Redis lock / stale evidence 污染。
- 因此 `A3` 当前应视为 fresh runtime 已通过；如果后续再出现类似 `BLOCKED`，应先按 harness suspicion 排查，而不是直接判成推荐产品回归。

### 证据

- `e2e-report/full-surface-2026-04-02/JOURNEY__A3/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__A10/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__SJ-1/record.json`
- `e2e-report/full-surface-2026-04-02/CAPABILITY__RECOMMENDATION_GENERATE/record.json`
- `e2e-report/full-surface-2026-04-02/CAPABILITY__PREDICTION_RUN/record.json`

## 2026-04-02 Follow-up（Full-Surface Batch 4 Admin / MCP）

### 范围

- 这是 full-surface 专项审计下的 Batch 4，不等同于 release gate。
- 本轮 fresh 重跑并回填了 admin / MCP 相关 journey overlay：
  - `C1`
  - `C2`
  - `C3`
  - `C4`
  - `C5`
  - `SJ-4`

### 结果

- `C1-C5`：full-surface canonical rerun confirmed `PASS`
- `SJ-4`：full-surface canonical rerun confirmed `PASS`
- Batch 4 aggregate：`28/28 PASS`

### 说明

- 本批真正修掉了两个 admin 页面级问题：
  - `admin/ai-operations` 的 detailed health 调用路径和鉴权方式错误
  - `admin/high-schools` 的 `JP / KR` 国家翻译缺失
- `SJ-4` 当前执行口径仍然是“admin API 创建 MCP key + 外部 stdio client 验证工具调用”；这条链路已通过，但“专门的 admin MCP 管理页”仍不在当前 active surface 内。

### 证据

- `e2e-report/full-surface-2026-04-02/JOURNEY__C1/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__C2/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__C3/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__C4/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__C5/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__SJ-4/record.json`

## 2026-04-03 Follow-up（Full-Surface Batch 3 Mobile）

### 范围

- 这是 full-surface 专项审计下的 Batch 3，不等同于 release gate。
- 本轮 fresh 重跑并回填了 mobile 相关 journey overlay：
  - `A11`
  - `SJ-3`

### 结果

- `A11`：`BLOCKED`
- `SJ-3`：`BLOCKED`
- Batch 3 aggregate：`47 PASS / 3 BLOCKED`

### 说明

- 当前 mobile core route 已在 canonical full-surface root 下 fresh 通过，不再只有旧 mobile 审计旁证。
- `A11 / SJ-3` 现在都已确认不是启动崩溃、页面不可达或通知页行为坏掉；它们只剩同一个 Android remote push 条件 blocker。
- 当前 blocker 仍是：
  - 缺失 `apps/mobile/android/app/google-services.json`
  - 因而 Expo / FCM push token 无法完成，真机 remote push 到达与 notification-open 无法 fresh 验证

### 证据

- `e2e-report/full-surface-2026-04-02/JOURNEY__A11/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__SJ-3/record.json`
- `e2e-report/full-surface-2026-04-02/CAPABILITY__NOTIFICATION_MOBILE_SYNC/record.json`
