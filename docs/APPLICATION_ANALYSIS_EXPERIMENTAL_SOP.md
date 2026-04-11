# 申请分析实验能力 SOP

> 最后更新: 2026-04-10
> 适用范围: `RECOURSE` / `UNCERTAINTY` / `FAIRNESS` capability-scoped experiments

## 原则

- 继续复用 canonical applicant endpoint：`GET /profiles/me/ai-analysis`
- V3 只做加法字段，不替代 `PredictionResult` 的概率事实层
- 不输出录取裁决或 institution-side yield optimization 结论
- 不建议修改不可变特征
- 不做 NLP trait scoring
- web 与 mobile 必须同义消费；不允许 web-only experiment

## 运行对象

- `ApplicationAnalysisExperimentVersion`
- `ApplicationAnalysisExperimentEvaluationRun`

Capability 固定为：

- `RECOURSE`
- `UNCERTAINTY`
- `FAIRNESS`

## Lifecycle

1. `DRAFT`
   - 创建方法版本、gate 配置、rollout 配置
2. `SHADOW`
   - 运行 `GOLD_SET` + `SHADOW` 评估
3. `CANARY`
   - 通过 feature flag 百分比采样给 applicant runtime
4. `ACTIVE`
   - capability 全量生效
5. `RETIRED`
   - capability 退役 / kill switch

## Feature Flags

- master: `application-analysis-experimental`
- recourse: `application-analysis-recourse`
- uncertainty: `application-analysis-conformal`
- fairness: `application-analysis-fairness`

规则：

- 只有存在 `ACTIVE` 或 `CANARY` 的 experiment version 时，对应 capability flag 才会被同步开启。
- `CANARY` 时 capability flag 带 percentage rollout 规则。
- `ACTIVE` 时 capability flag 全量开启。
- `retire` 会同步关闭对应 capability，并失效 applicant cache。

## Applicant Runtime Contract

V3 通过 `/profiles/me/ai-analysis` 的加法字段进入公开 contract：

- `meta.experimentalVersions[]`
- `targetSchoolInsights[].recourseGuidance`
- `targetSchoolInsights[].strategyUncertainty`
- `fairnessDisclosure`

渲染规则：

- 没有启用 capability 时，这些字段直接省略。
- applicant 不会看到 `DRAFT / SHADOW` 内容。
- `CANARY` 只在 feature-flag 命中的用户请求中可见。
- 若 capability 被关闭、退役或缺数据，前端静默回退到 V2/V1 主分析，不显示“实验失败”占位文案。

## Admin / Internal Endpoints

治理与预览入口统一放在 `/admin/application-analysis-workflow`：

- `GET /experiments`
- `POST /experiments`
- `POST /experiments/sweep`
- `POST /experiments/:id/shadow`
- `POST /experiments/:id/canary`
- `POST /experiments/:id/evaluate`
- `GET /experiments/:id/gates`
- `POST /experiments/:id/activate`
- `POST /experiments/:id/retire`
- `GET /experiment-evaluations`
- `POST /experiments/recourse-preview`
- `POST /experiments/uncertainty-preview`
- `GET /experiments/fairness-report`

## Gate Thresholds

### Recourse

- `unsafeSuggestionRate = 0`
- `immutableFeatureViolation = 0`
- `actionabilityMean >= 4.4`
- `schoolPolicyConsistency >= 0.97`
- `contractParityPass = true`
- `webRenderPass = true`
- `mobileRenderPass = true`
- `journeyPassRate = 1`

### Uncertainty

- `empiricalCoverageOverall >= 0.87`
- `empiricalCoverageKeySubgroup >= 0.82`
- `medianIntervalWidthDelta <= 0.12`
- `contractParityPass = true`
- `webRenderPass = true`
- `mobileRenderPass = true`
- `journeyPassRate = 1`

### Fairness

- `fabricatedInsightCount = 0`
- `unknownPolicyRateDelta <= 0.10`
- `actionabilityMeanDelta <= 0.5`
- `blockedSubgroupCount = 0`
- `disclosurePass = true`
- `contractParityPass = true`
- `webRenderPass = true`
- `mobileRenderPass = true`
- `journeyPassRate = 1`

## Output Boundaries

### Recourse

- 只输出可行动、可变更、时间上可行的 next moves
- 必须 school-aware / round-aware / policy-aware
- 禁止建议伪造经历或修改不可变特征

### Uncertainty

- 以 prediction interval 为底座
- 只增加 strategy uncertainty 的解释层
- 不单独发明第三套概率系统

### Fairness

- 只输出 disclosure，不给用户“公平分数”
- 任一关键 subgroup 被 blocked 时，该 capability 不得公开激活

## Kill Switch / Rollback

- `POST /admin/application-analysis-workflow/experiments/:id/retire` 是 capability kill switch
- `POST /admin/application-analysis-workflow/experiments/sweep` 可手动触发整批自动编排
- 任一 capability 退役，不影响 V1/V2 主链与其他 capability
- kill switch 触发后：
  - 对应 feature flag 关闭
  - applicant cache 失效
  - web / mobile 同时回退到无该 capability 的主分析

## Automation

- `ApplicationAnalysisExperimentScheduler` 每天 `04:15` 执行一次自动 sweep。
- sweep 会：
  - 刷新 `SHADOW` experiment 的评估并在 gate 通过时自动推进到 `CANARY`
  - 刷新 `CANARY` experiment 的评估，并在满足最小 canary 时长与 gate 条件时自动激活
  - 对失败或 gate 回归的 `CANARY / ACTIVE` experiment 自动执行 `retire`
- rolloutConfig 默认开启：
  - `autoPromoteToCanary = true`
  - `autoPromoteToActive = true`
  - `autoRetireOnFailure = true`
  - `minCanaryHours = 24`

## Verification

至少验证以下内容后才可升到 `CANARY` / `ACTIVE`：

- API workflow tests
- shared contract compatibility
- web `ProfileAIAnalysis` 渲染
- mobile `/profile/analysis` 渲染
- `/prediction` 到 analysis 的语义一致性
- `verify-gate --staged`
