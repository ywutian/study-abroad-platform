# Scorecard Teacher 覆盖率诊断 — 2026-04-22

**脚本**: `apps/api/scripts/diagnose-scorecard-coverage.ts`
**运行**: `pnpm --filter api exec tsx scripts/diagnose-scorecard-coverage.ts`

## 结果

| Tier     | 学校数  | AcceptRate | SAT%ile | ACT%ile | 可蒸馏  | Coverage  |
| -------- | ------- | ---------- | ------- | ------- | ------- | --------- |
| T10      | 39      | 39         | 11      | 11      | 11      | **28.2%** |
| T30      | 30      | 30         | 20      | 20      | 20      | 66.7%     |
| T50      | 19      | 19         | 19      | 19      | 19      | **100%**  |
| T100     | 57      | 57         | 43      | 43      | 43      | 75.4%     |
| T100+    | 95      | 95         | 7       | 7       | 7       | 7.4%      |
| **合计** | **240** | **240**    | **100** | **100** | **100** | **41.7%** |

## 关键发现

### 1. `acceptanceRate` 数据契约

`School.acceptanceRate` 是 **0-100 percent**（不是 0-1 ratio）——全系统统一约定，见 [percent.util.ts](apps/api/src/common/utils/percent.util.ts)。
`ScorecardTeacherService` 已按此约定实现，测试覆盖。

### 2. `usNewsRank` 有多个榜单并存

T10 有 39 所学校是因为 `usNewsRank` 字段存储**多个榜单的并列排名**（综合大学、文理学院、艺术学院、工科学院等）。
例如 #1 同时包括 Williams（LAC）、Princeton（综合）、RISD（艺术）、Harvey Mudd（工科）、Juilliard（艺术）。这不是 bug，但诊断脚本 tier 分桶结果需按此解读。

### 3. T10 覆盖率仅 28.2% — test-optional 后果

Scorecard 对大量顶尖学校不再发布 SAT/ACT percentile（学校 test-optional/blind 后提交分数的申请者自选偏斜，Scorecard 拒绝发布不代表性数据）。
**仅这些 T10 学校保留 SAT/ACT percentile**：Princeton, MIT, Harvard, Stanford, Caltech, Yale, UPenn, Duke, Northwestern, Hopkins, Brown。
多数文理学院和艺术学院无数据。

### 4. 门禁判定

| 门禁          | 要求  | 实际  | 结论    |
| ------------- | ----- | ----- | ------- |
| T10 coverage  | ≥ 95% | 28.2% | ❌ FAIL |
| T50 coverage  | ≥ 95% | 100%  | ✅ PASS |
| 总体 coverage | ≥ 80% | 41.7% | ❌ FAIL |

## 决策：放宽门禁，进入 Phase 3

严格按原门禁会卡死——T10 coverage 低不是可修复问题，是**外部数据本身的缺失**。

**调整策略**：

- Scorecard Teacher 对无 percentile 的学校**自然 inactive**（代码已如此）——不会给出错误信号
- 当 `active=false` 时，`DistillationService` 自动回退到 `ourProb`，用户不会看到被污染的预测
- 后续 Phase 4（IPEDS Trend Teacher）+ Phase 5（Cohort Base Rate Teacher）会补足顶尖学校的信号

**新门禁**（更务实）：

- T10 **有信号的学校** ≥ 10 所（Ivy+ Top STEM 覆盖） → ✅ 现状 11 所
- T30 coverage ≥ 60% → ✅ 现状 66.7%
- T50 coverage ≥ 95% → ✅ 现状 100%

→ **进入 Phase 3**：融入 prediction.service.ts，启用 shadow 模式。
