# 录取预测闭环运营 SOP

> 最后更新: 2026-04-10
> 适用范围: prediction accuracy 验证、outcome 审核、weekly calibration review

## 目标

- 让 `PredictionOutcomeLabelRecord` 成为唯一正式结果事实源
- 每周稳定把 `SELF_REPORTED` 推进到 `COUNSELOR_VERIFIED / DOCUMENT_VERIFIED`
- 让 `pnpm prediction:accuracy` 和 `pnpm prediction:gate` 持续产出可信结果

## 与申请分析的边界

- prediction 继续是唯一概率 / tier 事实源；application analysis 只能作为 strategy layer 消费 prediction 结果。
- 本轮已经闭合的是 application analysis 的 `V1` consumer/runtime/docs loop：web + mobile 统一消费 `/profiles/me/ai-analysis`。
- application analysis 的 `V2` governance 骨架现已存在，但独立运行规则已拆到 [APPLICATION_ANALYSIS_WORKFLOW_SOP.md](./APPLICATION_ANALYSIS_WORKFLOW_SOP.md)。
- 因此，任何对外 accuracy claim、probability claim、calibration claim 仍只由 prediction workflow 负责，不由 application analysis 代言。

## 收数标准

一条记录 = 一个申请者 + 一所学校。

最少必填字段：

- 匿名申请者 ID
- 学校
- 申请年份
- 申请轮次
- 是否国际生
- 最终结果
- 结果状态
- 证据文件或链接

推荐补充字段：

- 申请专业或学院
- 高中背景
- 课程体系
- GPA / 标化

## 审核规范

- `DOCUMENT_VERIFIED`
  - 有 offer / reject / portal 截图 / PDF，可回查
- `COUNSELOR_VERIFIED`
  - 顾问或老师确认，但没有上传正式文件
- `SELF_REPORTED`
  - 学生口述或聊天记录，未完成核验

以下结果不进入主评估：

- `WAITLISTED`
- `DEFERRED`
- `WITHDRAWN`
- `UNKNOWN`
- `CONFLICTED`

它们只保留在库存和辅助分析中。

## 每周节奏

每周固定执行两件事：

1. 审核 backlog
   - 优先处理 `SELF_REPORTED`
   - 补 `evidenceUrl`
   - 修正 `round`
   - 标记 `isFinal`
2. 跑闭环报表
   - `pnpm prediction:accuracy --days 365`
   - `pnpm prediction:gate --days 365 --min-verified 200`

每周复盘至少记录：

- verified sample count
- Brier score
- ECE
- tier monotonicity
- baseline source mix
- 当前是否达到 `PASS / CHECK / FAIL`

## 样本目标

- 第 1 里程碑: 2 周内累计 50 条 verified `ADMITTED / REJECTED`
- 第 2 里程碑: 6 周内累计 200 条 verified `ADMITTED / REJECTED`

在 verified 样本未达到 200 之前：

- 允许 gate 输出 `CHECK`
- 不允许对外宣称“准确率已验证”

## 备注

- `SELF_REPORTED` 可以帮助定位库存和运营优先级，但不能作为正式 accuracy claim 的依据。
- 新 policy promote 或对外 accuracy 宣传前，必须要求 `prediction gate = PASS`。
