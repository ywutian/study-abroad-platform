# 录取预测系统 — 准确性 backtest 审计报告

> 日期: 2026-05-21
> 触发: 平台所有者要求验证「预测系统是否大致准确」
> 关联: [PREDICTION_SYSTEM.md](./PREDICTION_SYSTEM.md) · [PREDICTION_BENCHMARK.md](./PREDICTION_BENCHMARK.md) · skill `/test-prediction-system`
> 前置: 同日 5-agent 根因诊断 + 3 项有据修复（commit `d6640d58`）+ 20 条 OFAT 行为矩阵（commit `baf31cbf`）

## 0. TL;DR

对修复后的 counselor 引擎做了一次离线 backtest。结论分两层：

- **排序能力（ranking）= 可靠。** 去除 hook 案例后 AUC = **0.816**，可靠性曲线单调。引擎能正确区分强弱申请者——2026-05-21 之前「所有 HYPSM 一律 2.0%」的 profile-blind bug 已确实修复。
- **绝对校准（calibration）= 无法用现有数据证实。** backtest 的唯一 ground truth 是 5 个 LLM「招生专家」agent 构造的 100 案例基准；该基准本身存在系统性**乐观偏差**，不能作为校准目标。引擎相对该基准整体偏保守（预测偏低），但「偏低多少」在缺少真实历史录取数据前不可知。

**裁决：不对引擎 multiplier 做任何调整。** 按 `/test-prediction-system` skill 的铁律——「无法引用来源的乘数常量是 bug，不是修复」。用 LLM 基准去校准乘数幅度，正是被明确禁止的 fabricated-calibration 反模式。

## 1. 方法

| 项      | 说明                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 基准    | 100 例，5 段 × 20（strong-intl / avg-intl / us-dom / hook / match-safety），由 5 个招生专家 agent 构造，每例含 expert 概率 + 二元结果 |
| 引擎    | `CounselorEngineService.compute()`，真实 PrismaService（CDS admit-band + SchoolProgram 解析生效）                                     |
| 指标    | calibration MAE、signed bias、Pearson r、Brier、AUC（Mann-Whitney）、十分位可靠性表                                                   |
| harness | 一次性 jest spec（decorator metadata 原因不能用 standalone tsx），审计后已删除                                                        |

## 2. 结果

```
calibration MAE : 32.3 pp      signed bias : -31.8 pp（引擎偏低）
Pearson r       : 0.590        AUC (engine): 0.783
Brier (engine)  : 0.480        Brier (expert ceiling): 0.157
去 hook 后       : MAE 28.7pp   bias -28.1pp   AUC 0.816

可靠性表（引擎十分位 → 实际录取率）
  0-10%  : n=59  meanPred  4.9%  → 实际 59.3%
  10-20% : n=13  meanPred 13.9%  → 实际 76.9%
  30-40% : n=9   meanPred 33.8%  → 实际 100%
```

## 3. 解读（关键——区分真 bug 与坏前提）

### 3.1 hook 段（-47pp）不是 bug

`athleteMultiplier` / `legacyHookMultiplier` 对自报的 recruited-athlete / legacy **故意返回中性 ×1.0**，注释明确：「在校方教练联系/offer 被核实前不施加 hook 加成」。这是防止用户虚报 hook 的产品/风控决策。hook 段测的是引擎按设计**拒绝建模**的路径——属坏前提，不计入裁决。

### 3.2 LLM 构造的基准存在系统性乐观偏差

证据：

- `us-dom-06`：Duke（录取率 6%）的弱 GPA 申请者，expert 给 82%。任何无 hook 申请者在 Duke 都不可能 82%。
- strong-intl 段的申请者被放在 Cornell(8%)/WashU(12%)/Tufts(11%)/NYU(9%) 等 <12% 录取率学校，expert 概率 52-64%、二元结果 55% 录取——一个强国际生在一组 <12% 录取率学校上不可能有 55% 的 per-application 录取率。
- 段录取率：strong-intl 55% / avg-intl 60% / match 95%——与所投学校选择性不符。

这是已被广泛记录的 **LLM 招生乐观偏差**。因此 -28pp 的 gap 是「引擎保守」与「基准乐观」的混合，两者无法在缺真实数据时分离。

### 3.3 一个与基准校准无关的真实结构隐患

`avg-intl-17`：Rochester（录取率 **40%**）的普通国际生 → 引擎预测 **6.8%**。一个 40% 录取率学校产出 6.8% 预测，无论基准多乐观都不合理。根因是 near-floor modifier 的乘法叠加：`gpaBand 0.15 × intl 0.45` 连乘塌缩。这是 skill 所述的「safety floor」弱点。

**但修复它 = 重新校准 modifier 幅度，必须依赖真实历史数据，不能猜。** 故本次不动。

## 4. 裁决

| 维度                               | 结论                                                 |
| ---------------------------------- | ---------------------------------------------------- |
| profile-blind bug（全 HYPSM=2.0%） | ✅ 已修复（commit `d6640d58`）                       |
| 排序能力（强弱区分）               | ✅ 可靠，去 hook AUC 0.816                           |
| 单调性（OFAT 20 条不变量）         | ✅ 全绿（commit `baf31cbf`）                         |
| 绝对概率「大致准确」               | ⚠️ 无法证实——唯一 ground truth 是乐观偏差的 LLM 基准 |
| 引擎方向性                         | 相对基准整体偏保守（从不过预测）                     |

**给用户的一句话**：预测系统结构上是健康的、能正确给申请者排序；但「绝对录取率是否大致准确」在拿到真实历史录取结果之前无法盖章——这正是 skill 的纪律：不拿一个有偏差的基准去硬调乘数。

## 5. 真正证实「大致准确」需要什么

唯一诚实路径（skill 已写明）：对平台 2400+ 真实 `AdmissionCase` 历史行做回归——需要这些行带结构化 `gpa11/gpa12 + testScores`。当前 DB 中 0 行带这些字段（见 2026-05-21 诊断）。这是一项独立工程，不是一次猜测会话能完成的。

后续动作（不在本次范围）：

1. 补全 `AdmissionCase` 的结构化 profile 字段（gpa by grade、test scores）。
2. 按 `docs/PREDICTION_BENCHMARK.md` 的 4 层架构落地 offline benchmark。
3. 用真实 verified outcomes 测 ECE / Brier，再决定 modifier 幅度是否需校准。
