# Prediction System — Audit Report (2026-05-16)

> **性质**：时间点快照，只读型审计。不修改代码、不修改 schema、不更新现有文档（建议的改动在第 9–10 章列出，由用户自行决定是否执行）。
> **用途**：架构认知全景、防误改误删、降低维护成本、对外契约稳定。
> **下一次审计**：另起新文件（如 `PREDICTION_SYSTEM_AUDIT_YYYY-MM-DD.md`），不要覆盖本文件。
> **审计基线**：worktree `claude/zealous-nash-0332e6`，main 最近 commit `86166f58`。

---

## 1. TL;DR

- **服役引擎**：`CounselorEngineService`（确定性规则引擎），feature flag `prediction-counselor-mode-v1` 全量。代码版本字符串 `counselor-cold-start-v1.8-profile-signals`；内部 mode 常量 `counselor-v2`；用户视角统称 "counselor-primary"。
- **架构状态**：单一服役路径已收敛，但 Fusion（4 个 service）和 Distillation（15 unique teachers）作为历史/管理后台路径仍完整存在，**所有调用都在线**但不进 served response。
- **最大风险**：`PredictionResult` 的 `@@unique([profileId, schoolId])` 约束意味着**每个 (profile, school) 只有一行**，PREVIEW 和 AUTHORITATIVE 必须共用同一行 —— 一旦 [school-list.service.ts:602](apps/api/src/modules/school-list/school-list.service.ts:602) 的"跳过 AUTHORITATIVE"守护失效，PREVIEW 会**静默覆盖** AUTHORITATIVE，且无 DB 层兜底。
- **最大债务**：[prediction.service.ts](apps/api/src/modules/prediction/prediction.service.ts)（2806 行）含 **24 个 @deprecated 委托方法**，全部转发给已抽出的子服务；以及 4 份 v5 ML-Primary 文档（含 1 份 ADR-0016 标记 SUPERSEDED）描述 deferred 架构如同 ready，与代码实际状态不符。
- **最大盲点**：`PredictionModel` 表（[schema.prisma:4660](apps/api/prisma/schema.prisma:4660)）已无活跃 CHAMPION 模型（ML platform 已于 2026-05-07 commit `afb03888` #100 删除）；表保留为 nullable 外键残留。

**如果只看 3 段**：第 3 章（路径地图）、第 4 章（数据契约）、第 8 章（操作守则）。

---

## 2. 服役架构全景：Counselor-Primary

### 2.1 入口路径

```
HTTP POST /predictions
  └─ PredictionController.predict()                       [controller :102]
       ├─ Profile 加载 (Prisma)
       ├─ UC 自动展开：任一 UC 校 → 9 校全展开
       └─ PredictionService.predict(profileId, schoolIds) [service :2159]
            └─ when featureFlag('prediction-counselor-mode-v1') 命中
                 └─ CounselorEngineService.run()          [counselor-engine.service.ts]
```

- **Feature flag 引用**：[prediction.service.ts:1513](apps/api/src/modules/prediction/prediction.service.ts:1513)、[prediction.module.ts:58](apps/api/src/modules/prediction/prediction.module.ts:58)、[counselor-backfill.service.ts:14](apps/api/src/modules/prediction/counselor/counselor-backfill.service.ts:14)
- **服役状态**：全量上线，无 percentage rollout（按 [BRIEF.md:48](apps/api/src/modules/prediction/BRIEF.md:48) 与 ADR-0016 头注交叉确认）

### 2.2 Tier 锚点逻辑

| Tier | 锚点来源                                                 | 触发条件                   | 是否持久化                                                                                            |
| ---- | -------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1    | `SchoolCdsAdmitBand` cell（学校自报 SAT/GPA 录取率分桶） | CDS bands 命中且足够精细   | ✅ 写入 PredictionResult + PredictionSnapshot                                                         |
| 2    | `Scorecard` 录取率 + SAT/ACT 25/75 分位                  | 无 CDS bands、有 scorecard | ✅                                                                                                    |
| 3    | School 总体 acceptance rate                              | 仅有 AR                    | ✅                                                                                                    |
| 4    | —（拒绝输出数值）                                        | 无任何可用锚点             | ❌ **不写库**，返回 `{probability: null, tier: 'unavailable', predictionMethod: 'insufficient_data'}` |

**Tier 4 隐式契约**（第 4 章详述）：前端必须处理 `probability === null` 分支。

### 2.3 Modifier 与钳制

8 个 modifier（GPA 百分位、SAT/ACT band、申请 round、hooks、国际生身份、major selectivity、地理 cohort、recruited athlete），实现在 [counselor-modifiers.ts](apps/api/src/modules/prediction/counselor/counselor-modifiers.ts)（55 KB）。

**钳制范围**：`[0.3 × anchor, 2.5 × anchor] ∩ [0.02, 0.98]`

权重写死在 `.ts`（未配置化）— 调参需发版，见第 7 章 P3 债务。

### 2.4 关键文件清单

| 文件                                                                                                               | 大小    | 职责                                            |
| ------------------------------------------------------------------------------------------------------------------ | ------- | ----------------------------------------------- |
| [counselor/counselor-engine.service.ts](apps/api/src/modules/prediction/counselor/counselor-engine.service.ts)     | 25 KB   | 服役主路径入口；编排 anchor + modifiers + clamp |
| [counselor/counselor-modifiers.ts](apps/api/src/modules/prediction/counselor/counselor-modifiers.ts)               | 55 KB   | 8 个 modifier 的确定性规则（最大单文件）        |
| [counselor/anchor-resolver.service.ts](apps/api/src/modules/prediction/counselor/anchor-resolver.service.ts)       | 7 KB    | Tier 1→2→3→4 锚点降级逻辑                       |
| [counselor/counselor-backfill.service.ts](apps/api/src/modules/prediction/counselor/counselor-backfill.service.ts) | 13 KB   | 历史预测从 fusion 反向迁移到 counselor schema   |
| [counselor/counselor-engine.module.ts](apps/api/src/modules/prediction/counselor/counselor-engine.module.ts)       | 2 KB    | NestJS 子模块                                   |
| [prediction.service.ts](apps/api/src/modules/prediction/prediction.service.ts)                                     | 2806 行 | 总编排（含 24 个 @deprecated 委托）             |
| [prediction.controller.ts](apps/api/src/modules/prediction/prediction.controller.ts)                               | 568 行  | 9 个 HTTP 端点（含 2 个 SSE）                   |

### 2.5 命名混乱（必读）

同一个引擎有 3 个名字 — 阅读时请知悉：

| 层             | 名称                                        | 出现位置                                                                                                               |
| -------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 用户/Swagger   | `counselor-primary`                         | [controller :104 summary](apps/api/src/modules/prediction/prediction.controller.ts:104)、`predictionMethod` 字段       |
| 内部 mode 常量 | `counselor-v2`                              | [prediction.service.ts:91 `COUNSELOR_ENGINE_MODE`](apps/api/src/modules/prediction/prediction.service.ts:91)、ADR-0020 |
| 版本字符串     | `counselor-cold-start-v1.8-profile-signals` | [counselor-engine.service.ts:67](apps/api/src/modules/prediction/counselor/counselor-engine.service.ts:67)             |

**操作含义**：在 git log / 文档 / commit message 看到任何一个，对应的是同一个 served path。第 10 章建议将三者收敛文档化。

---

## 3. 路径地图：服役 / Fallback / Shadow / 已弃 / 未落地

| #   | 路径                                                           | 状态                         | 触发条件                                  | 关键文件                                                                                                                                                                                                                                                                                                                                                                                                                                   | 可删？                                       |
| --- | -------------------------------------------------------------- | ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 1   | **Counselor**                                                  | 🟢 服役 100%                 | feature flag on（默认）                   | `counselor/*`、`PredictionService.predict` 主分支                                                                                                                                                                                                                                                                                                                                                                                          | ❌ 绝不可删                                  |
| 2   | Fusion 三引擎（statistical + AI + historical + fusion 合并器） | 🟡 Fallback                  | feature flag off 或 counselor 失败回退    | [prediction-statistical-engine.service.ts](apps/api/src/modules/prediction/prediction-statistical-engine.service.ts)、[prediction-ai-engine.service.ts](apps/api/src/modules/prediction/prediction-ai-engine.service.ts)、[prediction-fusion-engine.service.ts](apps/api/src/modules/prediction/prediction-fusion-engine.service.ts)、[prediction-historical.service.ts](apps/api/src/modules/prediction/prediction-historical.service.ts) | ⚠️ 暂留，admin dry-run 仍调用                |
| 3   | Distillation 15 teachers + rollup                              | 🟡 Shadow / 历史分析         | admin `/admin/predictions/distillation/*` | `distillation/`、`distillation/teachers/`（15 unique `.service.ts`）                                                                                                                                                                                                                                                                                                                                                                       | ⚠️ 暂留，shadow 评估在用                     |
| 4   | ML Platform（v5 ML-Primary 实现层）                            | 🔴 已删                      | —                                         | benchmark/、prediction-ml-primary/、diagnostic-ingest/（已物理删除）                                                                                                                                                                                                                                                                                                                                                                       | ✅ 已删，commit `afb03888` (#100) 2026-05-07 |
| 5   | v5 ML-Primary 设计 / Benchmark / Checklist                     | 📦 设计未落地（deferred）    | —                                         | docs/PREDICTION*V5*\*.md、PREDICTION_BENCHMARK.md、memory `project_prediction_v5_research.md`                                                                                                                                                                                                                                                                                                                                              | 📝 文档归档（不是代码）                      |
| 6   | `PredictionPolicyShadowService`                                | 🟡 Shadow（policy 漂移监控） | admin 评估新 policy version               | [prediction-policy-shadow.service.ts](apps/api/src/modules/prediction/prediction-policy-shadow.service.ts)                                                                                                                                                                                                                                                                                                                                 | ⚠️ 不可删，与 PolicyVersion 工作流绑定       |

### 3.1 Fallback 的实际触发面

- Fusion 路径**不会被普通用户触发** — feature flag 已 100% on。
- 但下列代码路径仍调用它：
  - `prediction.service.ts` 在 counselor 抛异常时的 try/catch fallback（[搜索 `predictWithStats|predictWithAI|fusePredictions` 调用点](apps/api/src/modules/prediction/prediction.service.ts)）
  - admin `/distillation/dry-run` 端点对比 counselor vs fusion
  - admin `/predictions/distillation/backfill-counselor` 用于把历史 fusion 数据反向迁移到 counselor schema
- **删除前必须**：(1) 移除 fallback 调用点 (2) 确认 admin 工具不再依赖 (3) 通知前端 admin 页面同步移除

### 3.2 Distillation 15 Teachers 完整清单

| Teacher                      | Live / Shadow    | 说明                                                   |
| ---------------------------- | ---------------- | ------------------------------------------------------ |
| `scorecard-teacher`          | Live             | College Scorecard 录取率信号                           |
| `ipeds-trend-teacher`        | Live             | IPEDS 多年趋势                                         |
| `cohort-prior-teacher`       | Live             | 同 cohort 历史先验（gate: min 5 samples）              |
| `chinese-outcome-teacher`    | Live             | 中国学生历史 outcome（authority='AUTHORITATIVE' 过滤） |
| `chinese-case-teacher`       | Live/Shadow 混合 | 中国学生具体 case 聚合                                 |
| `cds-bands-teacher`          | Shadow           | CDS 分桶（counselor 已直接消费）                       |
| `hooks-teacher`              | Shadow           | Recruited athlete / legacy / URM                       |
| `ed-boost-teacher`           | Shadow           | ED/EA round 加成                                       |
| `geo-cohort-teacher`         | Shadow           | 地理 cohort 信号                                       |
| `major-selectivity-teacher`  | Shadow           | 专业选择性                                             |
| `intl-pool-teacher`          | Shadow           | 国际生池容量                                           |
| `ap-rigor-teacher`           | Shadow           | AP 课程严格度                                          |
| `ib-teacher`                 | Shadow           | IB 系统                                                |
| `feeder-hs-teacher`          | Shadow           | 高中-大学 feeder 关系                                  |
| `activity-intensity-teacher` | Shadow           | 活动强度                                               |

**注**："22" 出现在早期探索是文件计数（含 spec 和 utils），实际 unique teachers 是 **15**。

### 3.3 ML Platform 删除恢复路径

- 删除 commit: `afb03888 Phase A: archive legacy ML platform layer (13K LOC dead code removal) (#100)` (2026-05-07)
- 恢复方法（BRIEF.md:48 已记录）：`git log --diff-filter=D --all` 找到删除点 → cherry-pick 恢复
- **何时恢复**：仅当 verified outcome 样本充足、ADR-0016 复活时

---

## 4. 数据契约

### 4.1 Authority 不变量（最关键）

#### 4.1.1 Enum 定义

```prisma
// apps/api/prisma/schema.prisma:211–217
/// PredictionAuthority — distinguishes full pipeline writes (AUTHORITATIVE) from
/// quick-match preview writes (PREVIEW). Enforced by school-list.service.ts
/// skip-on-authority-match logic + check-integration lint rule
/// `prediction-write-must-declare-authority`.
enum PredictionAuthority {
  AUTHORITATIVE
  PREVIEW
}
```

#### 4.1.2 写入路径

| 写者                                           | Authority     | 表                                        | 文件                                                                                                   |
| ---------------------------------------------- | ------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `PredictionPersistenceService.savePrediction`  | AUTHORITATIVE | `PredictionResult` + `PredictionSnapshot` | [prediction-persistence.service.ts](apps/api/src/modules/prediction/prediction-persistence.service.ts) |
| `SchoolListService.syncQuickMatchToPrediction` | PREVIEW       | 仅 `PredictionResult`（不写 snapshot）    | [school-list.service.ts:546–625](apps/api/src/modules/school-list/school-list.service.ts:546)          |

#### 4.1.3 守护层

| 层       | 内容                                                                               | 文件                                                                                                                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 代码     | school-list 写入前查询 `existing.authority`，等于 AUTHORITATIVE 时 `continue` 跳过 | [school-list.service.ts:599–602](apps/api/src/modules/school-list/school-list.service.ts:599)                                                                                                                                                                |
| Lint     | `prediction-write-must-declare-authority` 规则禁止不带 authority 字段的写入        | [scripts/check-integration.ts:67,91](scripts/check-integration.ts:67)                                                                                                                                                                                        |
| Test     | 三个 spec 验证不变量                                                               | `prediction-persistence.service.spec.ts`、`school-list.service.spec.ts`、`distillation/teachers/chinese-outcome-teacher.service.spec.ts`                                                                                                                     |
| 运营监控 | admin/prediction-health 页面展示 `previewRowsWithOutcomeLabel` 不变量              | [prediction-workflow.service.ts:1399](apps/api/src/modules/prediction/prediction-workflow.service.ts:1399)、[apps/web/src/app/[locale]/(main)/admin/prediction-health/page.tsx:251](<apps/web/src/app/[locale]/(main)/admin/prediction-health/page.tsx:251>) |

#### 4.1.4 Schema 隐患（务必理解）

```prisma
// PredictionResult 当前约束：
@@unique([profileId, schoolId])   // ← 每个 (profile, school) 只有一行！
```

**含义**：`PREVIEW` 与 `AUTHORITATIVE` **共用同一行**，由 `authority` 字段标识。这是设计选择，不是 bug，但意味着：

- 一旦 school-list 守护失效（漏掉 `continue`），PREVIEW 写入会**直接 upsert 覆盖** AUTHORITATIVE 行（PostgreSQL upsert 在唯一键冲突时执行 UPDATE）。
- 无 DB 层兜底（CHECK 约束、trigger 都没有）。
- 检测靠 `previewRowsWithOutcomeLabel` 不变量监控 + 单测。

**加固方向**（第 10 章 roadmap 提）：要么改 unique 为 `(profileId, schoolId, authority)` 让两者共存（但需要重写所有读取代码），要么加 PostgreSQL CHECK / RLS。两者都是大动作。

#### 4.1.5 消费者规则

任何读取用于 stats / training / distillation / UI trend 的查询**必须**过滤 `authority: 'AUTHORITATIVE'`。已确认的过滤点：

- [prediction.controller.ts:258](apps/api/src/modules/prediction/prediction.controller.ts:258) `/dashboard`
- [prediction.controller.ts:425](apps/api/src/modules/prediction/prediction.controller.ts:425) `/school/:schoolId` current
- [prediction.controller.ts:439](apps/api/src/modules/prediction/prediction.controller.ts:439) `/school/:schoolId` history snapshots

### 4.2 Tier 4 隐式契约

| 维度      | 实际行为                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP 响应 | `{ probability: null, tier: 'unavailable', confidence: undefined, predictionMethod: 'insufficient_data', factors: [...], suggestions: [...] }` |
| DB        | 不写 `PredictionResult` 行、不写 `PredictionSnapshot` 行                                                                                       |
| 历史影响  | 用户多次查询 → 永远不会出现在 `/history`                                                                                                       |
| 前端约束  | 必须处理 `probability === null`；TIER_CONFIG 已有 `unavailable` 配色                                                                           |

**已确认正确处理的前端组件**：

- [PortfolioDiagnosisCard.tsx:34](apps/web/src/components/features/prediction/PortfolioDiagnosisCard.tsx:34) `if (prediction.probability != null)` — ✅
- TIER_CONFIG 的 `unavailable` 项已在 [prediction/constants.ts](apps/web/src/components/features/prediction/constants.ts) 定义

**未审计**（需手动检查）：mobile `PredictionScreen.tsx`（38 KB）的 `mapDashboardToPredictions()` 是否处理 null；`PredictionResultCard.tsx`（38 KB）数值显示路径；admin 各页面的 probability 渲染。

### 4.3 Prisma 模型清单

| 表                             | 行号                                                     | 写者                           | 读者                                                  | 是否过滤 authority                 | 状态        |
| ------------------------------ | -------------------------------------------------------- | ------------------------------ | ----------------------------------------------------- | ---------------------------------- | ----------- |
| `PredictionResult`             | [schema.prisma:2291](apps/api/prisma/schema.prisma:2291) | Persistence(A) + SchoolList(P) | Controller、Workflow、Calibration、Reporting          | **必须**                           | 🟢 活跃     |
| `PredictionSnapshot`           | [schema.prisma:2374](apps/api/prisma/schema.prisma:2374) | Persistence(A) 唯一写者        | History、Trend、Calibration                           | 必须（PREVIEW 不该出现，但表允许） | 🟢 活跃     |
| `PredictionOutcomeLabelRecord` | [schema.prisma:2414](apps/api/prisma/schema.prisma:2414) | Reporting                      | Calibration、Reporting、Workflow                      | N/A（不带 authority 字段）         | 🟢 活跃     |
| `PredictionFeedback`           | [schema.prisma:2352](apps/api/prisma/schema.prisma:2352) | FeedbackService                | Admin Feedback Controller                             | N/A                                | 🟢 活跃     |
| `PredictionPolicyVersion`      | [schema.prisma:1518](apps/api/prisma/schema.prisma:1518) | Workflow                       | Policy、PolicyShadow、Persistence                     | N/A                                | 🟢 活跃     |
| `PredictionSourceObservation`  | [schema.prisma:1889](apps/api/prisma/schema.prisma:1889) | Distillation/Workflow          | Workflow（policy 构建）                               | N/A                                | 🟢 活跃     |
| `SchoolCohortRoundPrior`       | [schema.prisma:1946](apps/api/prisma/schema.prisma:1946) | DistillationStatsRollup        | cohort-prior-teacher                                  | N/A                                | 🟢 活跃     |
| `SchoolCohortRegimeSignal`     | [schema.prisma:1978](apps/api/prisma/schema.prisma:1978) | DistillationStatsRollup        | shadow 评估                                           | N/A                                | 🟢 活跃     |
| `PredictionModel`              | [schema.prisma:4660](apps/api/prisma/schema.prisma:4660) | **无活跃写者**（ML 已删）      | `PredictionResult.predictionModelId` SetNull 外键残留 | N/A                                | 🟡 **残留** |

#### 4.3.1 `PredictionModel` 残留风险

- 删除影响：`PredictionResult.predictionModelId` 外键定义为 `onDelete: SetNull`，物理删表会安全 nullify。
- 但 Prisma 类型生成、Swagger schema、admin 页面如果仍引用，会产生 type error。
- **推荐**：先标记 `@deprecated` 注释，下一次 schema 清理时合并删除。

---

## 5. API 契约清单（端到端）

### 5.1 用户端 9 个端点（controller-level `@ThrottleAI()`）

| Route                                                 | Method | Handler                         | Auth                         | 用途                                     |
| ----------------------------------------------------- | ------ | ------------------------------- | ---------------------------- | ---------------------------------------- |
| `/predictions`                                        | POST   | `predict()`                     | JWT                          | 主入口；UC 自动展开；返回 counselor 结果 |
| `/predictions/history`                                | GET    | `getHistory()`                  | JWT                          | 分页历史（仅 AUTHORITATIVE）             |
| `/predictions/:schoolId/result`                       | PATCH  | `reportResult()`                | JWT + `@ThrottleSensitive()` | 用户报告实际录取结果                     |
| `/predictions/:predictionResultId/feedback`           | POST   | `submitFeedback()`              | JWT + `@ThrottleSensitive()` | 主观质量反馈                             |
| `/predictions/calibration`                            | GET    | `getCalibration()`              | `@Roles(Role.ADMIN)`         | calibration 分析（admin）                |
| `/predictions/dashboard`                              | GET    | `getDashboard()`                | JWT                          | 聚合 dashboard（tier 分布、avg）         |
| `/predictions/:predictionResultId/explanation/stream` | POST   | `streamPredictionExplanation()` | JWT                          | **SSE**：LLM 解释单校预测                |
| `/predictions/portfolio-summary/stream`               | POST   | `streamPortfolioSummary()`      | JWT                          | **SSE**：LLM 总结整组预测                |
| `/predictions/school/:schoolId`                       | GET    | `getSchoolPrediction()`         | JWT                          | 单校详情 + 历史趋势                      |

**实现位置**：[apps/api/src/modules/prediction/prediction.controller.ts](apps/api/src/modules/prediction/prediction.controller.ts)

### 5.2 Admin 端点（按子域分组）

| 子域         | Route prefix                        | Controller                                                                                                                  |
| ------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Calibrations | `/admin/calibrations/*`             | `admin/admin-calibration.controller.ts`                                                                                     |
| Workflow     | `/admin/prediction-workflow/*`      | `prediction-workflow.service.ts` 对应 controller                                                                            |
| Distillation | `/admin/predictions/distillation/*` | [prediction-distillation.controller.ts](apps/api/src/modules/prediction/distillation/prediction-distillation.controller.ts) |
| Feedback     | `/admin/prediction-feedback`        | [admin-prediction-feedback.controller.ts](apps/api/src/modules/prediction/admin-prediction-feedback.controller.ts)          |

完整路由清单参考 [packages/shared/src/constants/api-routes.ts](packages/shared/src/constants/api-routes.ts) 的 `adminRoutes` 部分。

### 5.3 共享类型源

[packages/shared/src/types/prediction.ts](packages/shared/src/types/prediction.ts) — Web 端 import 这个文件；Mobile **未** import 而是本地定义了 `PredictionResultItem`（裂痕，见 5.4）。

### 5.4 端到端裂痕

| 裂痕           | Web                                              | Mobile                                               | Admin                   |
| -------------- | ------------------------------------------------ | ---------------------------------------------------- | ----------------------- |
| 主类型         | 用 shared `PredictionResult`                     | 本地 `PredictionResultItem` interface                | 部分用 shared，部分本地 |
| Dashboard 映射 | 无显式 mapper                                    | `mapDashboardToPredictions()` 本地实现               | N/A                     |
| API client     | `apiClient` + `AI_TIMEOUTS.AI_REQUEST`           | `predictionService` + 60s 硬编码 + `directApi: true` | `apiClient`             |
| Tier 4 处理    | 部分组件确认（PortfolioDiagnosisCard）；其余未审 | **未审**（38 KB 文件）                               | **未审**                |

---

## 6. 模块依赖与集成点

### 6.1 依赖图（文本版）

```
                    PredictionService
                          │
       ┌──────────────────┼──────────────────┐
       │                  │                  │
  CounselorEngine     PolicyService      PersistenceService
  AnchorResolver      PolicyShadow       (writes A)
  Modifiers           CalibrationService
                      ReportingService
                      FeedbackService
                      ExplanationService
                      MemoryService ──→ ai-agent/memory
                      CacheService  ──→ Redis
                      TransformerService
       │
       ├─ Fusion engines (statistical, ai, historical, fusion)
       │  └─ AI engine ──→ LLMService (ai-agent/providers)
       │
       └─ Distillation (compliant-distillation, stats-rollup, observation,
                        cds-bands-ingestion, case-aggregate-backfill,
                        15 teachers)

  External writers also touching prediction tables:
       SchoolListService.syncQuickMatchToPrediction (writes PREVIEW)
       PointsService.charge / safeRefund (财务侧)
```

### 6.2 上游集成点

| 模块                 | 集成方式                             | 风险点                                                                                                                     | 守护                              |
| -------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `ai-agent/memory`    | LLM 上下文注入                       | 必须通过 `MemoryManagerService`，禁止绕过直读 Prisma                                                                       | 模块 import 边界                  |
| `ai-agent/providers` | AI engine 调 `LLMService.chatSimple` | LLM JSON 必须用 `extractJsonFromLlm`                                                                                       | `.claude/rules/ai-system.md`      |
| `school`             | 学校元数据 + CDS bands               | school 数据缺失 → Tier 降级                                                                                                | anchor-resolver 自然降级          |
| `school-list`        | 写 PREVIEW                           | 必须先检查 AUTHORITATIVE 存在（[school-list.service.ts:602](apps/api/src/modules/school-list/school-list.service.ts:602)） | 代码 skip + lint + spec           |
| `points`             | 扣费/退款                            | 必须 `safeRefund()` 兜底，否则失败用户扣分但无结果                                                                         | `prediction.service.ts` try/catch |
| `admin`              | Policy workflow                      | DRAFT → CANDIDATE → SHADOW → ACTIVE → RETIRED 状态机                                                                       | Workflow service                  |
| `calibrations`       | 验证 outcome                         | **只用 verified 标签**（DOCUMENT_VERIFIED / COUNSELOR_VERIFIED），绝不用 SELF_REPORTED                                     | CalibrationService 内过滤         |

### 6.3 反向消费方（谁在读 prediction 数据）

- `recommendation` 模块：读 `PredictionResult` 做 AI school recommendation
- `dashboard` 页面：用户进入 `/dashboard` 时读 prediction 概览
- `school-list`：QuickMatch 检查 AUTHORITATIVE 是否存在
- `notification`：完成预测 / 报告结果时触发通知（如启用）
- `ranking`：可能用 prediction 数据排序（待核）

---

## 7. 技术债清单（按严重度排序）

| #   | 债务                                                                                    | 严重度 | 文件 / 位置                                                                                                        | 改动估算                                                  | 解决时机                         |
| --- | --------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------- |
| 1   | **`@@unique([profileId, schoolId])` 强制 PREVIEW 与 AUTHORITATIVE 同行**                | **P0** | [schema.prisma:2339](apps/api/prisma/schema.prisma:2339)                                                           | 大（重写读路径）                                          | 下次有 prediction 重大重构时同步 |
| 2   | **v5 ML-Primary 4 份文档与现实严重脱节**                                                | **P1** | docs/PREDICTION*V5*\*.md + memory file                                                                             | 小（加 ARCHIVED 头注 + 移动）                             | ≤ 1 PR                           |
| 3   | **Memory `project_prediction_v5_research.md` 41 天未更新**（写于 2026-04-05）           | **P1** | `.claude/projects/.../memory/project_prediction_v5_research.md`                                                    | 小（重写 + MEMORY.md 链接更新）                           | ≤ 1 PR                           |
| 4   | **`PredictionModel` 表残留，无活跃 CHAMPION**                                           | P1     | [schema.prisma:4660](apps/api/prisma/schema.prisma:4660)                                                           | 中（migration + 移除外键 + admin 同步）                   | 下次 schema 清理批次             |
| 5   | **Engine 命名三套并存（counselor-primary / counselor-v2 / counselor-cold-start-v1.8）** | P1     | 跨多文件                                                                                                           | 小（在 BRIEF.md + PREDICTION_SYSTEM.md 加注 alias 表）    | ≤ 1 PR                           |
| 6   | **24 个 @deprecated 委托方法在 prediction.service.ts**                                  | P2     | [prediction.service.ts](apps/api/src/modules/prediction/prediction.service.ts)（行号见 §7.1）                      | 中（grep 全部调用方、改为直调子服务、删委托）             | 1–2 PR                           |
| 7   | **Fusion 4 个 service 仅 admin dry-run 使用**                                           | P2     | `prediction-{statistical,ai,fusion,historical}-engine.service.ts`                                                  | 中（移至 `legacy/` 子目录 + 标记）                        | 1 PR                             |
| 8   | **Distillation 15 teachers bucketing 策略分散**                                         | P2     | `distillation/teachers/*`                                                                                          | 中（提取统一 bucketing interface）                        | 2 PR                             |
| 9   | **Mobile `PredictionResultItem` 本地定义、未用 shared 类型**                            | P2     | [apps/mobile/src/screens/prediction/PredictionScreen.tsx](apps/mobile/src/screens/prediction/PredictionScreen.tsx) | 中（删本地 + import shared + 修类型差异）                 | 1 PR                             |
| 10  | **Tier 4 `probability === null` 在部分 web/mobile 组件未审**                            | P2     | mobile PredictionScreen.tsx、admin 页面                                                                            | 小（grep `probability` + 补 null guard）                  | 1 PR                             |
| 11  | **`getDashboard` 在 controller 直接查 Prisma**（违反"controller 不持 DAL"惯例）         | P2     | [prediction.controller.ts:257–302](apps/api/src/modules/prediction/prediction.controller.ts:257)                   | 中（抽到 service）                                        | 1 PR                             |
| 12  | **counselor modifier 权重 hardcode 在 .ts**                                             | P3     | [counselor-modifiers.ts](apps/api/src/modules/prediction/counselor/counselor-modifiers.ts)                         | 大（迁移到 PredictionPolicyVersion.modifierWeights JSON） | 大 sprint                        |
| 13  | **`prediction.service.ts` 2806 行单文件**                                               | P3     | 同 #6                                                                                                              | 与 #6 共同治理                                            | 与 #6 一起                       |
| 14  | **`counselor-modifiers.ts` 55 KB 单文件**                                               | P3     | 同 #12                                                                                                             | 与 #12 一起                                               | 与 #12 一起                      |

### 7.1 24 个 @deprecated 方法分布（完整清单）

```
prediction.service.ts:
  L222  getSchoolCalibrations()      → PredictionCalibrationService
  L227  invalidateCalibrationCache() → PredictionCalibrationService
  L234  hashProfileData()            → PredictionCacheService
  L257  getFromCache()               → PredictionCacheService
  L274  saveToCache()                → PredictionCacheService
  L313  getSchoolDistribution()      → PredictionHistoricalService
  L318  getHistoricalProbability()   → PredictionHistoricalService
  L331  getMemoryContext()           → PredictionMemoryService
  L336  recordPredictionToMemory()   → PredictionMemoryService
  L349  recordBridgePredictionToMemory() → PredictionMemoryService
  L364  profileToInput()             → PredictionTransformerService
  L372  schoolToInput()              → PredictionTransformerService
  L471  extractProfileMetrics()      → PredictionTransformerService
  L476  extractSchoolMetrics()       → PredictionTransformerService
  L481  evaluateDataCompleteness()   → PredictionTransformerService
  L783  predictWithStats()           → PredictionStatisticalEngine
  L800  predictWithAI()              → PredictionAiEngine
  L825  fusePredictions()            → PredictionFusionEngine
  L925  getPlattCalibration()        → PredictionCalibrationService
  L930  applyPlattCalibration()      → PredictionCalibrationService
  L2753 savePrediction()             → PredictionPersistenceService
  L2762 getPredictionHistory()       → PredictionReportingService
  L2777 reportActualResult()         → PredictionReportingService
  L2802 getCalibrationData()         → PredictionReportingService
```

**清理策略**：grep 所有调用方（外部模块 + 测试），改为直接注入对应子 service；删委托后 `prediction.service.ts` 体积可降 30%+。

---

## 8. "动这块时要小心" — 操作守则

按"我要改 X" 的视角组织。每段给出 must / must-not / 必读文件。

### 8.1 改 Prisma `Prediction*` / `SchoolCohort*` 表

- ✅ **MUST**：`pnpm --filter api db:migrate -- --name <name>` 生成迁移
- ✅ **MUST**：新列必须 nullable 或带 default（避免 downtime）
- ✅ **MUST**：grep 所有 consumer（schema.prisma 中模型名 + DTO + 共享类型 + admin UI）
- ✅ **MUST**：评估 authority 是否影响读路径
- ❌ **MUST-NOT**：在 `PredictionResult` 上 `db:push` 或手改 `@@unique`
- 📖 **必读**：[apps/api/CLAUDE.md](apps/api/CLAUDE.md) Schema Change Rules、[BRIEF.md](apps/api/src/modules/prediction/BRIEF.md) Authority invariant 段

### 8.2 改 `PredictionResult` / `PredictionResponse` / `PredictionFactor` 等共享类型

- ✅ **MUST**：同步 [packages/shared/src/types/prediction.ts](packages/shared/src/types/prediction.ts)
- ✅ **MUST**：`pnpm --filter @study-abroad/shared build`
- ✅ **MUST**：扫 mobile [PredictionScreen.tsx](apps/mobile/src/screens/prediction/PredictionScreen.tsx) 的本地 `PredictionResultItem`（裂痕，可能漏改）
- ✅ **MUST**：扫 admin 页面（calibrations、prediction-health、prediction-feedback）
- ❌ **MUST-NOT**：在 Web 端 `apps/web/src/components/features/prediction/types.ts` 重复定义（仅 re-export）

### 8.3 改 Counselor modifier 逻辑或权重

- ✅ **MUST**：更新 [docs/PREDICTION_SYSTEM.md](docs/PREDICTION_SYSTEM.md) 的 modifier 列表
- ✅ **MUST**：更新 [counselor-modifiers.spec.ts](apps/api/src/modules/prediction/counselor/counselor-modifiers.spec.ts)
- ✅ **MUST**：考虑是否要 bump `counselor-cold-start-v1.8-profile-signals` 版本字符串
- ✅ **MUST**：考虑历史 `PredictionSnapshot` 是否需要 backfill
- ❌ **MUST-NOT**：在不同 modifier 之间引入隐藏状态依赖

### 8.4 新增 `/predictions/*` 端点

- ✅ **MUST**：用 `@ThrottleAI()`（涉及 LLM）或 `@ThrottleSensitive()`（涉及写）或继承 controller-level `@ThrottleAI()`
- ✅ **MUST**：用 DTO class + `@MaxLength()`
- ✅ **MUST**：Admin-only 端点加 `@Roles(Role.ADMIN)`
- ✅ **MUST**：在 [packages/shared/src/constants/api-routes.ts](packages/shared/src/constants/api-routes.ts) 加路由常量
- ✅ **MUST**：如返回 PredictionResult/Snapshot 数据 → **必须过滤 `authority: 'AUTHORITATIVE'`**
- ❌ **MUST-NOT**：在 controller 内直接 Prisma 查询（参考 #11 债务）

### 8.5 加 Distillation teacher

- ✅ **MUST**：读 [distillation/types.ts](apps/api/src/modules/prediction/distillation/types.ts) 接口
- ✅ **MUST**：模仿现有 teacher（推荐 `scorecard-teacher` 作为最简模板）
- ✅ **MUST**：定义 sample-count gate（参考 `cohort-prior-teacher` 的 `COHORT_PRIOR_MIN_LIVE_SAMPLES = 5`）
- ✅ **MUST**：在 [distillation.module.ts](apps/api/src/modules/prediction/distillation/distillation.module.ts) providers 注册
- ✅ **MUST**：考虑 Live vs Shadow stage（先 Shadow，accumulate 数据后再 Live）
- ❌ **MUST-NOT**：跨 teacher 共享可变状态

### 8.6 删除任何 fusion / distillation / legacy 文件

- ✅ **MUST**：先 `grep -rn "<service-name>" apps/api/ apps/web/` 确认无活跃调用
- ✅ **MUST**：确认 admin dry-run / backfill 端点不再依赖
- ✅ **MUST**：通知前端 admin 页面同步移除（calibrations、prediction-health）
- ✅ **MUST**：读 [BRIEF.md:48](apps/api/src/modules/prediction/BRIEF.md:48) "ML platform 恢复方法"
- ❌ **MUST-NOT**：删除 counselor 任何文件（即使看起来"未被引用"——backfill 路径会用）

### 8.7 碰 `authority` 字段

- ❌ **MUST-NOT**：直接 `prisma.predictionResult.update({ data: { authority: ... } })`
- ❌ **MUST-NOT**：在 admin 工具中提供 "切换 authority" UI
- ✅ **MUST**：通过 `PredictionPersistenceService`（A）或 `SchoolListService.syncQuickMatchToPrediction`（P）
- ✅ **MUST**：消费侧（统计、训练、UI 趋势）必须 `where: { authority: 'AUTHORITATIVE' }`

### 8.8 写新预测算法 / 引擎

- ✅ **MUST**：写在新子目录（如 `apps/api/src/modules/prediction/<engine-name>/`），不混入 root
- ✅ **MUST**：feature flag gate（参考 `prediction-counselor-mode-v1` 模式）
- ✅ **MUST**：先 Shadow（PredictionPolicyShadowService 评估 AUC/Brier/ECE）再 Live
- ✅ **MUST**：考虑 ADR-0020 "no per-sample calibration" 约束 — 不用平台用户 outcome 做样本校准
- ❌ **MUST-NOT**：在主路径直接调用 LLM 产生概率（LLM 仅 explanation/advice）

### 8.9 修改 v5 / Benchmark 相关文档

- ✅ **MUST**：先读 ADR-0016（SUPERSEDED）+ ADR-0020（ACCEPTED）现有状态
- ✅ **MUST**：如确认 v5 复活则需要先写新 ADR（如 0021）
- ❌ **MUST-NOT**：在 PREDICTION*V5*\*.md 加新内容（这些是历史快照，应只读）

---

## 9. 文档地图：哪份还有效

| 文档                                                                                                       | 状态             | 时间       | 推荐动作                                                |
| ---------------------------------------------------------------------------------------------------------- | ---------------- | ---------- | ------------------------------------------------------- |
| [docs/PREDICTION_SYSTEM.md](docs/PREDICTION_SYSTEM.md)                                                     | ✅ 当前合约      | 2026-05-08 | **保留为唯一权威**                                      |
| [docs/PREDICTION_ACCURACY_STRATEGY.md](docs/PREDICTION_ACCURACY_STRATEGY.md)                               | ✅ ADR-0020 配套 | 2026-05-14 | 保留                                                    |
| [docs/PREDICTION_CLOSED_LOOP_SOP.md](docs/PREDICTION_CLOSED_LOOP_SOP.md)                                   | ✅ 运营 SOP      | 2026-04-10 | 保留                                                    |
| [docs/PREDICTION_IMPROVEMENT_WORKFLOW.md](docs/PREDICTION_IMPROVEMENT_WORKFLOW.md)                         | ⚠️ 未审          | —          | 用户决定（建议读后定 keep / archive）                   |
| [docs/PREDICTION_BENCHMARK.md](docs/PREDICTION_BENCHMARK.md)                                               | 📦 设计未落地    | 2026-04-21 | 加 ARCHIVED 头注或移到 `docs/archive/`                  |
| [docs/PREDICTION_V5_RESEARCH_REPORT.md](docs/PREDICTION_V5_RESEARCH_REPORT.md)                             | 📦 deferred      | 2026-04-04 | 加 ARCHIVED 头注，链接到 ADR-0016 SUPERSEDED 说明       |
| [docs/PREDICTION_V5_REVIEW_CHECKLIST.md](docs/PREDICTION_V5_REVIEW_CHECKLIST.md)                           | 📦 deferred      | 2026-04-05 | 加 ARCHIVED 头注                                        |
| [docs/PREDICTION_V5_MULTI_AGENT_REVIEW_2026-04-05.md](docs/PREDICTION_V5_MULTI_AGENT_REVIEW_2026-04-05.md) | 📦 历史快照      | 2026-04-05 | 移到 `docs/archive/` 或加 ARCHIVED 头注                 |
| [docs/adr/0008-prediction-multi-engine-ensemble.md](docs/adr/0008-prediction-multi-engine-ensemble.md)     | 📦 历史 ensemble | —          | 状态改 `Superseded by 0020`                             |
| [docs/adr/0016-prediction-ml-primary-architecture.md](docs/adr/0016-prediction-ml-primary-architecture.md) | 📦 SUPERSEDED    | 2026-04-04 | 状态正确（已标 SUPERSEDED / DEFERRED）                  |
| [docs/adr/0020-prediction-no-sample-calibration.md](docs/adr/0020-prediction-no-sample-calibration.md)     | ✅ ACCEPTED      | 2026-05-14 | 保留                                                    |
| [apps/api/src/modules/prediction/BRIEF.md](apps/api/src/modules/prediction/BRIEF.md)                       | ✅ 准确          | —          | 建议补充 §2.5 命名 alias 表 + §4.1.4 unique schema 风险 |
| Memory `project_prediction_v5_research.md`                                                                 | ⚠️ 41 天未更     | 2026-04-05 | **见 §9.1 建议替换**                                    |

### 9.1 建议的 memory 替换文本（用户可粘贴）

> 仅作建议草稿，由用户决定是否替换。文件路径：
> `/Users/yitianwu/.claude/projects/-Users-yitianwu-Documents-study-abroad-platform/memory/project_prediction_v5_research.md`

```markdown
---
name: Prediction System Current State
description: 服役引擎、deferred 路径、关键不变量、命名 alias
type: project
---

**当前服役**（2026-05-08 起 100% 上线）：

- 引擎：CounselorEngineService（确定性规则）
- 内部 mode：`counselor-v2`；版本：`counselor-cold-start-v1.8-profile-signals`；用户/Swagger：`counselor-primary`
- Tier 1–4 锚点降级（CDS bands → Scorecard+SAT/ACT bands → AR-only → insufficient_data 不持久化）
- ADR-0020：no per-sample calibration（不用平台用户 outcome 做样本校准）

**已弃 / 删除**：

- ML platform 层 2026-05-07 commit afb03888 (#100) 物理删除（13K LOC）
- ADR-0016 v5 ML-Primary 标记 SUPERSEDED / DEFERRED
- `PredictionModel` 表保留为外键残留，无活跃 CHAMPION

**遗留代码（不可乱删）**：

- Fusion 4 个 service（statistical/ai/historical/fusion）：admin dry-run 仍调
- Distillation 15 unique teachers：shadow 评估 + admin 工具仍调
- prediction.service.ts 24 个 @deprecated 委托方法：转发给子服务

**关键不变量**：

- `PredictionResult.@@unique([profileId, schoolId])`：PREVIEW 与 AUTHORITATIVE 共用同一行；
  school-list 写 PREVIEW 前必须 skip-on-AUTHORITATIVE-match
- 所有 stats/training/UI trend 读取必须 `where: { authority: 'AUTHORITATIVE' }`
- Tier 4 不写库，返回 `probability: null` / `tier: 'unavailable'`

**审计报告**：`docs/PREDICTION_SYSTEM_AUDIT_2026-05-16.md`（完整版）
```

同时建议在 `MEMORY.md` 中将 `project_prediction_v5_research.md` 条目改为：

```markdown
- [Prediction System Current State](project_prediction_v5_research.md) — Counselor-primary 服役、Fusion/Distillation 遗留、关键不变量
```

---

## 10. 后续 Roadmap 建议（不强制执行）

### 10.1 轻量档（≤ 1 PR / ≤ 半天工作量）

| 行动                                                                                                         | 解决债务 #          |
| ------------------------------------------------------------------------------------------------------------ | ------------------- |
| 给 4 份 v5 文档加 `> **ARCHIVED 2026-05-08** — 历史设计文档，未落地。当前服役见 PREDICTION_SYSTEM.md。` 头注 | 2                   |
| 更新 memory `project_prediction_v5_research.md`（按 §9.1 草稿）                                              | 3                   |
| 在 BRIEF.md 补充命名 alias 表（counselor-primary / counselor-v2 / counselor-cold-start-v1.8）                | 5                   |
| 在 BRIEF.md 增加 "Tier 4 隐式契约" 段落                                                                      | （加固 4.2）        |
| 在 BRIEF.md 标注 `PredictionResult @@unique` 风险                                                            | 1（不修，仅文档化） |

### 10.2 中等档（2–4 PR / 1–2 周）

| 行动                                                                                                                                                  | 解决债务 #  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Fusion 4 个 service 移入 `apps/api/src/modules/prediction/legacy/` 子目录，标注 `@module legacy`                                                      | 7           |
| 清理 24 个 @deprecated 委托（grep 调用方 → 改直调 → 删委托）。建议分 2 PR：先清前端可见的 4 个（save/getHistory/report/getCalibration），再清内部委托 | 6, 13       |
| Mobile 改用 shared `PredictionResult` 类型 + 移除 `mapDashboardToPredictions` 本地 mapper（统一为后端返回）                                           | 9           |
| 端到端 Tier 4 null guard 审计（grep `probability` 所有渲染点 + 补 null 分支）                                                                         | 10          |
| `getDashboard` 抽到 `PredictionReportingService`                                                                                                      | 11          |
| ADR-0020 落地审计：确认 seed-calibrations.ts 中的 5 个 hand-tuned multiplier 在生产 DB 已清（写一个 read-only audit script）                          | （新增 14） |

### 10.3 重量档（多 sprint）

| 行动                                                                                                                                                                           | 解决债务 #   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| Counselor modifier 权重配置化（迁移到 `PredictionPolicyVersion.modifierWeights` JSON），同时设计 A/B rollout                                                                   | 12, 14       |
| Authority DB 约束加固：评估两条路径 (a) 改 `@@unique([profileId, schoolId, authority])` 让两行共存（需重写所有读路径）；(b) PostgreSQL trigger 防止 PREVIEW 覆盖 AUTHORITATIVE | 1            |
| Distillation 模块独立化：抽 `bucketing` 接口、统一 teacher 注册、独立 module 边界                                                                                              | 8            |
| Tier 4 显式契约改造：返回 `{ insufficientData: { reason, missingFields, ... } }` 结构化对象，前端类型化处理                                                                    | （加固 4.2） |
| `PredictionModel` 表评估：彻底删除 vs 改为通用 `EngineRunMetadata`                                                                                                             | 4            |

### 10.4 我建议的起点（个人意见，不强制）

如果优先级是"信息透明 + 防误改"，先做 **10.1 全部 + 10.2 第 1, 4 项**（即文档归档 + memory 更新 + Fusion 移 legacy + Tier 4 null guard 审计）。这一波下来：

- 团队/Claude 不会再被 v5 文档误导
- 历史/废弃代码有清晰边界
- 对外契约（Tier 4）的 UI 兼容性有保证
- 不动 schema，不动主路径，回归风险极低

---

## 11. 验证 Checklist（让用户跑一遍）

复制下列命令，确认报告事实与代码一致：

```bash
cd /Users/yitianwu/Documents/study-abroad-platform/.claude/worktrees/zealous-nash-0332e6

# 断言 1: Counselor 是 100% 服役
grep -rn "prediction-counselor-mode" apps/api/src/ | wc -l
# 期望：≥ 5 处引用（含 module、service、controller、backfill）

# 断言 2: 24 个 @deprecated 在 prediction.service.ts
grep -c "@deprecated" apps/api/src/modules/prediction/prediction.service.ts
# 期望：24

# 断言 3: ML platform 已删
ls apps/api/src/modules/prediction/ | grep -iE "^ml|^benchmark|^prediction-ml-primary|^diagnostic"
# 期望：空输出

# 断言 4: 15 个 unique teachers
ls apps/api/src/modules/prediction/distillation/teachers/ | grep "teacher.service.ts$" | grep -v ".spec.ts" | wc -l
# 期望：15

# 断言 5: 9 个 user-facing 端点
grep -cE "^\s*@(Post|Get|Patch)\(" apps/api/src/modules/prediction/prediction.controller.ts
# 期望：9

# 断言 6: PredictionResult 的 unique 约束
grep -A1 "model PredictionResult" apps/api/prisma/schema.prisma | head -5
grep "@@unique" apps/api/prisma/schema.prisma | grep -A0 "profileId.*schoolId"
# 期望：见到 @@unique([profileId, schoolId]) 单一约束

# 断言 7: ML 删除 commit
git log --all --oneline --diff-filter=D | grep -iE "ml|benchmark" | head -3
# 期望：afb03888 commit

# 断言 8: Engine 命名三套
grep -rn "counselor-v2\|counselor-cold-start\|counselor-primary" apps/api/src/modules/prediction/ | grep -v ".spec.ts" | wc -l
# 期望：≥ 4 处不同字符串
```

### 完整性 Checklist（报告自检）

- [x] 10 个章节齐全
- [x] 每项债务标了严重度（P0/P1/P2/P3）
- [x] 每条 must / must-not 有文件路径定位
- [x] 文档地图覆盖 docs/ 下所有 prediction 相关 .md
- [x] 服役/Fallback/Shadow/已弃/未落地 5 类路径全部归类
- [x] Tier 4 契约明确（前端约束 + DB 行为）
- [x] Authority 不变量 5 个守护层全列出
- [x] 引擎命名三套 alias 表
- [x] Roadmap 分 3 档，每行动关联到具体债务编号
- [x] Memory 替换文本草稿提供

### 可读性 sanity check（建议用户做）

请只看以下 3 段，确认能独立支撑"防误改"目标：

1. **§1 TL;DR**（10 行）
2. **§3 路径地图**（一张表 + 触发条件）
3. **§8 操作守则**（"我要改 X" 视角）

如这 3 段读完仍不能让你/团队成员"知道动哪里前要先看什么"——告诉我，我会补强。

---

## 附录 A：本次审计未深入的角落

- `recommendation` / `ranking` / `notification` 模块对 prediction 数据的具体消费路径（仅在第 6.3 提及）
- mobile `PredictionScreen.tsx`（38 KB）内 Tier 4 处理与 dashboard mapper 细节
- admin `calibrations/_components/` 9 个组件（100+ KB）内的具体业务逻辑
- `PredictionPolicyVersion` 状态机的实际 transition 路径
- SSE 流式端点（explanation/portfolio-summary）的 LLM prompt 和 token 消耗
- E2E 测试（`apps/api/test/*prediction*.e2e-spec.ts`，如有）

如某一角落变成日后修改焦点，建议届时单独深审。

---

**报告 end. 共 ~700 行。**
