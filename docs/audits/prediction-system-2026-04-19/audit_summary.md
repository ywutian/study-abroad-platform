# 留学预测系统全面审计总结

## 主结论

- 审计日期: 2026-04-19
- 最终结论: **必须停止宣称**
- 当前仓库基线: `pnpm prediction:accuracy --format json --days 365` 返回 verified sampleCount = 0
- 外部宣传状态: 发现 4 条需要立即下线或替换的准确率文案

## 关键证据

- 本地 accuracy 基线没有任何 verified `ADMITTED/REJECTED` outcome，因此不能形成真实准确率结论。
- Closed-loop SOP 明确要求 verified outcome 少于 200 条时不得对外宣称“准确率已验证”。
- 现有 calibration path 仍会读取 `PredictionResult.actualResult`，而该字段会在 `SELF_REPORTED` 时立即写入。
- quick-match 以 `source=quick-match` / `modelVersion=v1-stats` 写入 `PredictionResult`，如果不拆分 source，会污染主 accuracy 汇总。

## prediction:gate 摘要

```text
> study-abroad-platform@1.0.0 prediction:gate /Users/yitianwu/Documents/study-abroad-platform
> tsx scripts/prediction-gate.ts --days 365 --min-verified 200

Prediction Gate
- workflow: FAIL
- accuracy: CHECK
```

## 外部基线摘要

- 官方抽样学校数: 5
- 匹配到官方 Scorecard 数据: 5
- 匹配到内部学校元数据: 5
- acceptance rate 平均绝对偏差: 0.66%

## 合成压力测试摘要

- 场景数: 16
- 通过检查数: 8/11

## 离线导入状态

- No --import-dir was provided. CSV ingestion scaffold is implemented but no read-only export was supplied.
