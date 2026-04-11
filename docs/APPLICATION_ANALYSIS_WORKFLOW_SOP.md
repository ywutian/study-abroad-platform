# 申请分析治理工作流 SOP

> 最后更新: 2026-04-10
> 适用范围: application analysis `V2` evidence / candidate / shadow / activate / rollback

## 目标

- 让 `GET /profiles/me/ai-analysis` 继续保持唯一 applicant-facing 入口。
- 把学校政策证据、策略版本、评估运行纳入独立治理链，不再依赖隐式代码约定。
- 保证 web、mobile、admin 消费的都是同一个 `ACTIVE` 申请分析策略版本。

## 运行对象

- `SchoolPolicyEvidence`
- `ApplicationAnalysisPolicyVersion`
- `ApplicationAnalysisEvaluationRun`

## 生命周期

1. `DRAFT`
   - 新证据录入
   - 新策略草稿创建
2. `CANDIDATE`
   - 冻结候选版本
   - 自动生成一轮 `GOLD_SET` 评估记录
3. `SHADOW`
   - 候选版本进入 shadow
   - 允许刷新 `SHADOW` 评估与 gates
4. `ACTIVE`
   - 供 applicant web / mobile runtime 使用
5. `RETIRED`
   - 被新 active 替换，保留回滚能力

## 证据优先级

school-level policy context 固定按以下优先级解析：

1. `APPROVED` 且未过期的 `SchoolPolicyEvidence`
2. backend derived rules
3. `UNKNOWN`

说明：

- `policySourceQuality = REVIEWED` 表示至少一项学校政策来自审核通过的证据。
- `policySourceQuality = DERIVED` 表示当前只有后端推导规则。
- `policySourceQuality = UNKNOWN` 表示没有可信政策上下文。

## 激活门槛

- `policyCorrectnessRate >= 0.95`
- `weakStateCorrectnessRate >= 0.98`
- `fabricatedInsightCount = 0`
- `actionabilityMean >= 4.3`
- `contractParityPass = true`
- `webRenderPass = true`
- `mobileRenderPass = true`
- `journeyPassRate = 1`

## 操作步骤

### 1. 录入证据

- 在 admin `/admin/application-analysis-workflow` 的 `Evidence` tab 创建学校政策证据。
- 至少填写：
  - `schoolId`
  - `policyDimension`
  - `policyValue`
  - `sourceName`
- 推荐补齐：
  - `sourceUrl`
  - `sourcePublishedAt`
  - `sourceQuality`
  - `notes`

### 2. 审核证据

- 将证据从 `DRAFT` / `UNDER_REVIEW` 推进到 `APPROVED` 或 `REJECTED`。
- 任何 `APPROVED / REJECTED / EXPIRED` 变更都会失效 applicant application-analysis cache。

### 3. 创建策略版本

- 在 `Policies` tab 创建新的 `ApplicationAnalysisPolicyVersion`。
- 必填：
  - `version`
  - `analysisVersion`
- 推荐填写：
  - `promptVersion`
  - `ruleBundleVersion`

### 4. 冻结 Candidate

- 触发 `candidate` 后，系统生成一轮 `GOLD_SET` 评估记录。
- Candidate 代表“规则冻结”，不是对外生效。

### 5. 进入 Shadow

- 触发 `shadow` 后，策略进入 shadow。
- 使用 `shadow-refresh` 刷新 shadow evaluation 与 gates。

### 6. 查看 Gates

- 在 `Gates` tab 查看当前门禁状态。
- 只有 `ready = true` 的 shadow policy 才允许激活。

### 7. 激活 / 回滚

- `activate` 会将当前 active policy 退役，并激活新的 shadow policy。
- `rollback` 会恢复上一版 retired policy。
- 激活和回滚都会失效 applicant application-analysis cache。

## Applicant Runtime 约束

- applicant 端只读取 `ACTIVE` policy。
- 没有 `ACTIVE` policy 时，runtime 自动回退到内建 `V1` 规则，不阻断 `/profiles/me/ai-analysis`。
- web 与 mobile 都不得消费 candidate / shadow 输出。

## 实验能力边界

- `V2` governance 负责 applicant runtime 的稳定策略层，实验能力治理已拆分到 `APPLICATION_ANALYSIS_EXPERIMENTAL_SOP.md`。
- applicant runtime 的基线 contract 仍由 `ACTIVE` policy 决定；实验能力只能以加法字段方式附着在基线响应上。
- `policyContext`、弱态、行动计划与推荐项仍属于 `V2` 稳定 contract，不依赖任何实验 capability。
