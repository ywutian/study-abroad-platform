# 录取预测系统 Benchmark 设计文档

> 最后更新: 2026-04-21
> 状态: **设计稿**（未落代码）
> 关联: [PREDICTION_SYSTEM.md](./PREDICTION_SYSTEM.md) · [PREDICTION_CLOSED_LOOP_SOP.md](./PREDICTION_CLOSED_LOOP_SOP.md) · [ADR-0016](./adr/0016-prediction-ml-primary-architecture.md)

## 0. TL;DR

预测系统的离线评估目前散落在 `ModelTrainerService` 的 5-fold CV 和 `ShadowEvaluatorService` 的在线 A/B 中，缺少：

1. 独立可重复的 offline benchmark（冻结数据集 → 多基线对比 → 切片报告）
2. 系统性的**非 ML 基线**（base rate / SAT 启发式 / v3-fusion / v5-ml-primary 全部放在同一张表上比较）
3. 按 cohort 年份的**时间 backtest**（目前随机 CV 高估真实表现）
4. 子群 fairness gate（目前 fairness 仅报告，不拦截 promote）
5. 面向非 ML 回归的 **golden fixture** 防护网

本文档定义 4 层 benchmark 架构、数据集协议、指标矩阵、Admin 面板集成方式与 promote gate 规则。**所有报告产物都写入 DB 并由 Admin 面板消费，不产出文件**。

---

## 1. 目标与 KPI

### 1.1 北极星指标（用户可感）

| KPI                                                               | 目标   | 当前状态             |
| ----------------------------------------------------------------- | ------ | -------------------- |
| **ECE (10-bin, verified outcomes only)**                          | ≤ 0.05 | 冷启动中，无冻结测量 |
| **子群 ECE gap** (国际生 vs 国内；ED vs RD；T30 vs 其他)          | ≤ 0.04 | 未系统测量           |
| **Brier Score**                                                   | ≤ 0.20 | 仅在训练期测量       |
| **Reliability at reach tier** (predicted ≤ 20% 时实际 admit rate) | ≤ 15%  | 未测量               |

### 1.2 次级指标（工程可感）

- AUC-ROC, PR-AUC, Log-Loss, Accuracy@0.5（各基线之间对比用）
- Tier confusion matrix（reach / match / safety 预测-实际 3×3）
- 输出稳定性：固定输入 10 次运行的 probability 标准差（LLM 非确定性暴露）
- v3 vs v5 的 per-band 差异（回答"什么时候 v5 更好"）

### 1.3 非目标

- **不**评估 LLM 文本质量（suggestions / factors 的文本）——这是 AI Prompt Engineer Agent 的职责
- **不**评估选校推荐的"推荐质量"（相关性、覆盖率）——走 `recommendation` 模块单独 benchmark
- **不**在 benchmark 内做模型训练——训练继续由 `ModelTrainerService` 负责；benchmark 只评估

---

## 2. 架构：4 层 Benchmark

```
Layer 0  Golden Fixture Benchmark     (随 CI 跑, <5s, 防回归)
Layer 1  Offline Static Benchmark     (admin 触发, 冻结 snapshot + 多基线)
Layer 2  Cohort Backtest              (定时月跑, 真实 DB + 时间切分)
Layer 3  Online Shadow Gate           (已存在, 补阈值 + 接 promote)
Layer 4  External Competitor Benchmark (admin 手动触发, 概率对齐 pilot)
```

### Layer 0 — Golden Fixtures

**放在**：`apps/api/src/modules/prediction/__fixtures__/benchmark/`

**内容**：~20 条手写 `(ProfileMetrics, SchoolMetrics, options) → ExpectedOutcome` 样例，按场景分组：

| 场景组                      | 条数 | 断言重点                                    |
| --------------------------- | ---- | ------------------------------------------- |
| 冲刺高分 (T10 + 满分档)     | 3    | `tier=reach`, probability ∈ [0.08, 0.35]    |
| 冲刺低分 (T10 + 中等档)     | 2    | `tier=reach`, probability ≤ 0.15            |
| 匹配                        | 3    | `tier=match`, probability ∈ [0.35, 0.65]    |
| 保底                        | 2    | `tier=safety`, probability ≥ 0.75           |
| ED / EA 加成                | 2    | 同一学生 ED vs RD 概率差 ≥ 5pp              |
| 国际生 / 中国申请者         | 3    | base rate 低于国内学生同档                  |
| 数据缺失（无 SAT / 无 GPA） | 3    | `confidence=low`，`factors` 含 missing data |
| 极端边界                    | 2    | probability ∈ [0.05, 0.95]，不越界          |

**断言**：**不断言精确概率**（避免被微调卡住），而是断言：

- `tier` 精确匹配
- `probability` 落在区间
- `factors[].type` 集合（positive/negative/neutral）包含必要元素
- `engineScores.fusionMethod` 符合预期分支
- `confidence` 精确匹配

**LLM 处理**：必须 mock。新建 `LLMMockService` 提供基于 `(profileId, schoolId)` 哈希的确定性返回；否则 Layer 0 无法 diff。

**产物**：`prediction-benchmark.spec.ts` 直接跑在 `pnpm --filter api test` 里，失败即 CI 阻断。

---

### Layer 1 — Offline Static Benchmark（核心交付）

**目标**：回答四个问题：

1. v5 比 v3 好多少？
2. 去掉 AI 引擎损失多少？
3. Hook 系数值不值？
4. 在哪些切片上表现最差？

#### 2.1.1 数据集协议

- **冻结 snapshot**：新增 `TrainingDataService.exportSnapshot(snapshotId)` 方法，把 `collectAll()` 的输出去 PII 后持久化到新表 `PredictionBenchmarkDataset`（字段：`id`, `createdAt`, `sampleCount`, `features JSON`, `labels JSON`, `cohortSplit JSON`, `schemaVersion`）
- 一次导出后**永远冻结**；新数据进不了旧 snapshot
- 评估永远引用 snapshot ID，保证可重复

#### 2.1.2 切分协议（**不用**随机 K-fold）

- **时间切分**：按 `admissionCycle / year` 切：训练 ≤ N-1，测试 = N（默认 N = 当前自然年）
- **分组切分**（防数据泄露）：同一 `userId` 的所有 `(user, school)` 样本整体划到同一侧
- **Waitlist / Deferred 从评估集 exclude**（沿用 `resolveCanonicalPredictionOutcome` 的 `eligibleForCalibration`）
- **最小样本门槛**：每个切片 `< 30` 时只报 count，不报 metric，避免小样本 ECE 失真

#### 2.1.3 基线集合（8 条，**不可省**）

| ID                | 说明                                           | 实现                                                  |
| ----------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `base_rate`       | 只用 `school.acceptanceRate`                   | 1 行代码                                              |
| `sat_heuristic`   | GPA+SAT 对标 `school.sat25/75` 的简单 logistic | 10 行代码，对照 Cornell L@S 2023 论文                 |
| `stats_only`      | 统计引擎单独输出                               | 直接调 `PredictionStatisticalEngine`                  |
| `ai_only`         | AI 引擎单独（mock 固定种子）                   | 调 `PredictionAiEngine`，LLM 走 mock                  |
| `historical_only` | 历史引擎单独                                   | 调 `PredictionHistoricalService`                      |
| `v3_fusion`       | 当前 served 四引擎融合                         | `PredictionService.predict(..., { forcePath: 'v3' })` |
| `v5_ml_primary`   | ML-primary 路径                                | `PredictionService.predict(..., { forcePath: 'v5' })` |
| `v5_no_hooks`     | v5 关掉所有 log-odds hooks                     | `PredictionMlPrimaryService` + hook override          |

**新增小改动**：`PredictionService.predict` 接受内部 `forcePath` 参数（仅 benchmark 上下文使用，production 不暴露）。

#### 2.1.4 指标矩阵

每个 `(baseline × slice)` 产生一行，字段：

```
baseline, slice, sampleCount,
auc, prAuc, brier, ece_10bin, logLoss, accuracy,
reliability_points (JSON, reliability diagram 用),
tier_confusion (JSON, 3×3),
stability_stddev (仅 ai_only / v3 / v5, LLM 参与的基线)
```

#### 2.1.5 切片维度（必跑）

| 维度                 | 分桶                                  |
| -------------------- | ------------------------------------- |
| Selectivity band     | `<15%` / `15-30%` / `30-60%` / `>60%` |
| Application round    | ED / EA / REA / RD                    |
| 国际生               | true / false                          |
| 中国申请者           | true / false                          |
| School tier          | T10 / T11-30 / T31-100 / Other        |
| Cohort year          | 按 admissionCycle 列                  |
| Profile completeness | 3 桶（高/中/低 数据点）               |

切片**不做笛卡尔积**（会稀疏到无意义），而是每个维度独立切一遍。

#### 2.1.6 Fairness 切片（单独 section）

- 按国际生 / 父母教育 / 高中类型 / 性别（有则）切
- 计算每个子群的 ECE 与全量 ECE 的绝对差 `|ece_subgroup - ece_overall|`
- 报告中高亮 gap > 0.04 的子群（对齐 Abbadi 2025 的 9-11% 差异线）

---

### Layer 2 — Cohort Backtest

**触发**：

- `@Cron('0 3 1 * *')` 每月 1 号 03:00 自动
- Admin 面板"Run Now"按钮手动

**行为**：

1. 调 `TrainingDataService.exportSnapshot(autoId)` 生成当月 snapshot
2. 调 Layer 1 runner 按时间切分（训练 ≤ 上月 = test set）
3. 所有 baseline × slice 结果写入 `PredictionBenchmarkRun`

**与 Layer 1 的区别**：Layer 1 是一次性的 snapshot（admin 手动挑 snapshotId + baselines），Layer 2 是自动化定时任务，数据集始终是"最新到齐的 verified outcomes"。

---

### Layer 3 — Online Shadow Gate（补全现有）

`ShadowEvaluatorService` 已存在；`ModelMonitorService` 有 PSI/ECE 检查但**不拦截 promote**。需要：

在 `ModelRegistryService.promoteToChampion()` 入口前插入 gate：

```
GateInput: candidateModelId, currentChampionMetrics
Checks (任一 fail 即 reject):
  1. shadow.brier  <= champion.brier + 0.01
  2. shadow.ece    <= max(champion.ece, 0.06)
  3. subgroup_ece_gap <= 0.04  (新增)
  4. PSI(champion_input, shadow_input) < 0.25
  5. sample_count  >= tier_threshold (tier-strategy.ts)
  6. 最近 30 天 shadow outcome 数 >= 50
```

失败时：

- 写 `PolicyObservation` 记录失败原因
- 不 promote，返回 4xx with rejection reasons
- Admin 面板高亮显示并允许强制 override（需填写 override reason，入 audit）

---

### Layer 4 — External Competitor Benchmark（pilot）

**目标**：抓取外部竞品页面对单个标准 profile 的**数值录取率 / probability**，并与本系统当前 served 预测做逐校 diff。这个 layer 用于内部校准，不是 ground truth outcome benchmark，也不会把竞品数据回写到用户侧展示。

**触发方式**：

- Admin `/admin/calibrations` 下的 `External Benchmark` tab
- CLI：`pnpm --filter api benchmark:run --profile=<id> --source=<key> [--limit=N] [--headed]`

**核心约束**：

- 只接受人工导出的 `storageState.json`（Playwright 标准格式），不做自动登录
- 竞品**明确百分比**是主数据；若只有 `reach/match/safety` 之类档位，则保留为 tier-only，不伪造概率，不参与 MAE
- 以竞品可预测学校集合为准，left-join 到本系统 `School`
- `CompetitorPrediction` 按 `(runId, schoolKey)` 幂等，支持断点续跑
- kill-switch、单域名串行、2–4s jitter、URL 级日志、secrets 目录 gitignore
- **CollegeVine**（`sourceKey=collegevine`）：adapter 在 `/schools/hub` 上 `reload` 并捕获 `GET …/schools/hub/data/chances-and-financials` 的 JSON，解析 `initialSchools.schools` 与 `chancesAndFinancials`；**不会**把 benchmark `profileJson` 自动同步进 CollegeVine，需在 collegevine.com 手动维护 chancing profile 与 hub school list

**接口**：

- `GET /admin/predictions/benchmark/profiles`
- `POST /admin/predictions/benchmark/profiles`
- `GET /admin/predictions/benchmark/sources`
- `POST /admin/predictions/benchmark/sources/:key/session`
- `GET /admin/predictions/benchmark/runs`
- `POST /admin/predictions/benchmark/runs`
- `GET /admin/predictions/benchmark/runs/:id`
- `GET /admin/predictions/benchmark/runs/:id/report`

**报告输出**：

- per-school: `oursProbability`, `theirsProbability`, `delta`, `oursTier`, `theirsTier`, `matchStatus`, `externalSource`
- summary: `MAE`, `mean delta`, `tier agreement`, `coverage gap`, `unmatched`, `ambiguous`, `adapter error`, `session error`

详见 [`COMPETITOR_BENCHMARK_RUNBOOK.md`](./COMPETITOR_BENCHMARK_RUNBOOK.md)。

---

## 3. 数据模型

### 3.1 新增 Prisma model

```prisma
model PredictionBenchmarkDataset {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())
  createdBy       String?  // adminUserId
  sampleCount     Int
  schemaVersion   String   // feature schema version
  cohortSplit     Json     // { train: [years], test: [years] }
  features        Json     // [FeatureVector] 冻结
  labels          Json     // number[]
  metadata        Json     // DatasetStats

  @@index([createdAt])
}

model PredictionBenchmarkRun {
  id               String   @id @default(cuid())
  createdAt        DateTime @default(now())
  datasetId        String
  dataset          PredictionBenchmarkDataset @relation(fields: [datasetId], references: [id])
  triggeredBy      String   // 'manual' | 'cron' | 'promote-gate'
  gitSha           String?
  modelVersionsTested String[] // ['v3-enterprise', 'v5-ml-primary-20260401', ...]
  status           String   // 'RUNNING' | 'SUCCESS' | 'FAILED'
  durationMs       Int?
  error            String?

  overallMetrics   Json     // Record<baseline, Metrics>
  sliceMetrics     Json     // Array<{ baseline, sliceKey, sliceValue, metrics }>
  fairnessReport   Json     // Array<{ subgroup, gap, flag }>
  regressions      Json?    // 和上一次 run 相比变差的指标

  @@index([createdAt])
  @@index([status])
}
```

**不创建** `PredictionBenchmarkSlice` 单独表——`sliceMetrics` JSON 已够查询，避免行数爆炸。

### 3.2 复用

- 不改 `PredictionModel` / `PredictionResult` / `PredictionSnapshot`
- Layer 3 的 gate 结果写入现有 `PolicyObservation`，不新建表

---

## 4. Admin 面板集成

### 4.1 入口

在现有 `/admin/calibrations` 下**新增 `Benchmark` tab**（与 `overview / workflow / policies / outcomes / school-calibrations / system-calibration` 同级）。

原因：benchmark 是"评估预测质量"的一环，归在 calibrations 比单独顶层入口更一致；用户已经熟悉 `/admin/calibrations` 的导航。

### 4.2 `benchmark-tab.tsx` 结构

```
┌─────────────────────────────────────────────────┐
│ [Run Layer 1]  [Export Snapshot]  [Latest Run ↗]│
├─────────────────────────────────────────────────┤
│ Summary Cards                                    │
│   Dataset size · ECE (v3/v5) · Brier · Fairness │
│   gap max  ·  Last run age                       │
├─────────────────────────────────────────────────┤
│ Baseline Comparison Table                        │
│   baseline × (auc, brier, ece, logloss, acc)    │
│   点击 row 展开 slice breakdown                  │
├─────────────────────────────────────────────────┤
│ Reliability Diagram  (选 baseline)               │
│   SVG, predicted_mean vs actual_rate, per bin    │
├─────────────────────────────────────────────────┤
│ Fairness Report                                  │
│   subgroup, overall_ece, subgroup_ece, gap, flag│
├─────────────────────────────────────────────────┤
│ Run History (10 最近)                            │
│   trend line: ECE over time                      │
└─────────────────────────────────────────────────┘
```

### 4.3 新 API 端点（加在 `PredictionMlController`）

```
POST   /admin/predictions/benchmark/datasets       # 导出 snapshot
GET    /admin/predictions/benchmark/datasets       # 列表
POST   /admin/predictions/benchmark/runs           # 触发 run (body: datasetId, baselines[])
GET    /admin/predictions/benchmark/runs           # 列表分页
GET    /admin/predictions/benchmark/runs/:id       # run 详情 + sliceMetrics
GET    /admin/predictions/benchmark/runs/latest    # summary（给 Admin 首页卡用）
```

所有端点 `@Roles(ADMIN)`。

---

## 5. 代码结构

```
apps/api/src/modules/prediction/
├── benchmark/                         ← 新目录，与 ml/ 平级
│   ├── benchmark.module.ts
│   ├── benchmark.controller.ts        ← 挂在 /admin/predictions/benchmark
│   ├── benchmark.service.ts           ← 主编排
│   ├── benchmark-runner.service.ts    ← 跑一个 run
│   ├── dataset-exporter.service.ts    ← snapshot 导出
│   ├── baselines/
│   │   ├── baseline.interface.ts      ← ProbabilityPredictor
│   │   ├── base-rate.predictor.ts
│   │   ├── sat-heuristic.predictor.ts
│   │   ├── stats-only.predictor.ts
│   │   ├── ai-only.predictor.ts
│   │   ├── historical-only.predictor.ts
│   │   ├── v3-fusion.predictor.ts
│   │   ├── v5-ml-primary.predictor.ts
│   │   └── v5-no-hooks.predictor.ts
│   ├── slicers/
│   │   ├── slicer.interface.ts
│   │   ├── selectivity-band.slicer.ts
│   │   ├── round.slicer.ts
│   │   ├── international.slicer.ts
│   │   ├── china-applicant.slicer.ts
│   │   ├── school-tier.slicer.ts
│   │   ├── cohort-year.slicer.ts
│   │   └── profile-completeness.slicer.ts
│   ├── gate/
│   │   └── promote-gate.service.ts    ← Layer 3 的 gate 检查
│   ├── utils/
│   │   ├── mock-llm.util.ts           ← 确定性 LLM mock
│   │   └── subgroup-analysis.util.ts
│   ├── __fixtures__/
│   │   └── benchmark/                 ← Layer 0 fixtures
│   └── __tests__/
│       ├── benchmark-runner.spec.ts
│       ├── baselines.spec.ts
│       ├── slicers.spec.ts
│       └── prediction-benchmark.spec.ts  ← Layer 0 CI spec
└── ml/ (不变)
```

**frontend**：

```
apps/web/src/app/[locale]/(main)/admin/calibrations/_components/
├── benchmark-tab.tsx                  ← 新
└── _benchmark/
    ├── baseline-comparison-table.tsx
    ├── reliability-diagram.tsx
    ├── fairness-report-panel.tsx
    └── run-history-chart.tsx
```

---

## 6. Promote Gate 详细规则

| Check                       | 阈值                      | 数据来源                                       |
| --------------------------- | ------------------------- | ---------------------------------------------- |
| Shadow Brier                | ≤ champion.brier + 0.01   | `ShadowEvaluatorService.getShadowReport()`     |
| Shadow ECE                  | ≤ max(champion.ece, 0.06) | 同上                                           |
| **Subgroup ECE gap**        | ≤ 0.04                    | **新**: benchmark 最近一次 fairness report     |
| PSI                         | < 0.25                    | `ModelMonitorService`                          |
| Shadow outcome 样本         | ≥ 50（最近 30 天）        | `ShadowEvaluatorService`                       |
| Tier 样本门槛               | 按 `tier-strategy.ts`     | `TrainingDataService.countAvailableOutcomes()` |
| **Benchmark 最近 7 天跑过** | YES                       | **新**: 强制先跑 benchmark 才能 promote        |

**override 机制**：admin 可强制 promote，但必须填 `overrideReason`（≥ 30 字符），写入 `PolicyObservation` with `signalType=PROMOTE_OVERRIDE`，触发飞书/邮件告警。

---

## 7. 落地计划

### Milestone 1 — Layer 0 Golden Fixtures（1-2 天）

- 新建 `benchmark/` 目录骨架
- `mock-llm.util.ts`
- 20 个 fixture + `prediction-benchmark.spec.ts`
- 接入 `pnpm --filter api test`
- **交付标志**：CI 跑过，改动 `prediction.service.ts` 非平凡代码立即能被捕捉

### Milestone 2 — Layer 1 Runner + 3 个基线（3-4 天）

- `ProbabilityPredictor` 接口 + 3 个最简基线（`base_rate`, `sat_heuristic`, `v3_fusion`）
- `BenchmarkRunnerService.run(datasetId, baselines, slicers)`
- 复用 `packages/shared/src/scoring/ml/metrics.ts`
- Prisma migration: `PredictionBenchmarkDataset`, `PredictionBenchmarkRun`
- 最简 admin API（POST runs, GET runs/:id）
- **交付标志**：admin 手动 POST，DB 里出现一行 run，能看到 3 个 baseline × 1 slice 的指标

### Milestone 3 — 补全 baselines + 切片（2-3 天）

- 补 `ai_only`, `historical_only`, `stats_only`, `v5_ml_primary`, `v5_no_hooks`
- 7 个 slicer 全上
- Fairness report 逻辑
- `PredictionService.predict` 支持 `forcePath` 参数

### Milestone 4 — Admin 面板（3-4 天）

- `benchmark-tab.tsx` + 4 个子组件
- Reliability diagram (SVG)
- Run history 趋势线
- i18n (en/zh)
- **交付标志**：整个面板可用，能看出 v3 vs v5 的差距

### Milestone 5 — Layer 2 定时 + Layer 3 Gate（2-3 天）

- `@Cron` 每月跑 Layer 2
- `PromoteGateService` + `promoteToChampion` 前置拦截
- Override 机制 + audit log
- **交付标志**：candidate 模型 promote 时被 gate 拦截或放行

**总工期估计**：**11-16 工作日**

---

## 8. 风险与权衡

| 风险                                                  | 缓解                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Snapshot 导出把生产 DB 拉慢                           | 单独 read replica；或限定 off-peak 执行；sample count hard cap 10k                                      |
| AI 引擎 mock 和真实 LLM 输出分布差异大                | Layer 2 保留真实 LLM 路径；Layer 0/1 的结果解释时始终注明"AI 引擎使用 mock"                             |
| `AdmissionCase` 的 self-report bias 导致评估集有偏    | fairness report 强制给出"report rate by subgroup"；对 `prediction_outcome` vs `admission_case` 分别报告 |
| 冻结 snapshot 越来越旧，与线上特征 schema 漂移        | `schemaVersion` 字段 + 特征 schema 变更时强制生成新 snapshot；旧 snapshot 标 deprecated                 |
| Gate 太严导致无法 promote                             | 第一版 gate 设 WARN（记录但不拦截）跑 2 个月，再切 BLOCK                                                |
| Benchmark 本身成本失控（每个 baseline 都跑 LLM 太贵） | AI 引擎只跑一次并缓存到 snapshot；`v3_fusion` / `v5_ml_primary` 的 LLM 部分复用同一批 AI 输出           |

---

## 9. 未解问题

1. **Snapshot 是否要脱敏 schoolId**？admin 面板内部用没问题，但若将来要对外开源 benchmark 需要脱敏策略（用 `hash(schoolId)` + 保留 tier 属性）
2. **是否要给 `recommendation.estimatedProbability` 做一致性测试**？建议 Milestone 2 加 2 个 fixture：同一 `(profile, school)` 调两处，概率差 ≤ 10pp
3. **Mobile 端是否需要 benchmark 可视化**？第一版不做；Admin 功能 web-only
4. **Benchmark 结果是否注入 `/admin/calibrations` 的 overview tab**？建议 Milestone 4 在 overview 新增一个"Latest Benchmark ECE"卡片引用最近 run

---

## 10. 参考

- Cornell L@S 2023 (GBDT vs SAT heuristic 对照)
- CollegeVine 校准标准（±3%）
- Abbadi et al. 2025（fairness 审计强制环节；9-11% 子群差异警戒）
- TabArena 2026（Beta / Venn-Abers 校准大规模对比）
- PMC 2025（RF Brier 0.15；Isotonic > Platt > Beta 在该数据集）
- [PREDICTION_V5_RESEARCH_REPORT.md](./PREDICTION_V5_RESEARCH_REPORT.md) 详细文献综述

---

_关联 ADR：建议新建 `adr/0017-prediction-benchmark-architecture.md`（Milestone 1 同步落）_
