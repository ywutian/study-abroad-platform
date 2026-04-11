# Prediction v5 ML-Primary 架构检查文档

> 用途：提供给外部 AI 或人工审查员，对 v5 ML-Primary 架构进行独立审查。
> 日期：2026-04-05
> 状态：L1 核心实施完成，待 Shadow 部署验证

---

## 1. 架构概述

### 1.1 设计目标

将预测系统从 4-engine ensemble（Stats + AI/LLM + Historical + ML 加权融合）重构为 **ML-Primary 单一引擎**架构：

- ML 模型是**唯一**概率预测引擎（确定性，无 LLM 幻觉）
- LLM 退出概率计算，仅作为解释文字生成器
- 所有概率修饰在 log-odds 空间操作（数学正确，不会溢出）
- Hook 系数来自学术文献实证（Arcidiacono SFFA v. Harvard）
- 通过 Feature Flag 实现 legacy / shadow / ml-primary 三模式无感切换

### 1.2 核心文件清单

**新建文件（5 个）：**

| 文件                                                                   | 行数 | 职责                                                                            |
| ---------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `apps/api/src/modules/prediction/prediction-ml-primary.service.ts`     | ~440 | v5 核心编排器：Tier 判断 → base rate → hook → 校准 → 输出                       |
| `apps/api/src/modules/prediction/prediction-hook-modifiers.service.ts` | ~304 | Hook 系数管理：Legacy/FirstGen/NeedAware/ED/China/Major 在 log-odds 空间        |
| `packages/shared/src/scoring/ml/beta-calibration.ts`                   | ~127 | Beta 校准 3 参数 MLE + 贝叶斯 L2 正则化                                         |
| `packages/shared/src/scoring/spike-coherence.ts`                       | ~83  | 活动 Spike 非线性连贯性乘子                                                     |
| `packages/shared/src/scoring/score.ts` (新增函数)                      | +45  | `logit()`, `invLogit()`, `adjustInLogOdds()`, `getMajorSelectivityMultiplier()` |

**修改文件（13 个）：**

| 文件                              | 改动                                                        |
| --------------------------------- | ----------------------------------------------------------- |
| `prediction.service.ts`           | +60 行 feature flag 分支 + v5 缓存 + flag 提升到循环外      |
| `prediction-ai-engine.service.ts` | +90 行 `generateExplanation()` 方法                         |
| `prediction-reporting.service.ts` | +15 行 校准闭环 + outcome 去重                              |
| `prediction-cache.service.ts`     | `getCacheKey/getFromCache/saveToCache` 加 `engineMode` 参数 |
| `prediction-memory.service.ts`    | +50 行 `getMemoryFeatures()`                                |
| `prediction.module.ts`            | +2 providers                                                |
| `prediction.controller.ts`        | `@ThrottleSensitive()` on reportResult                      |
| `prediction-response.dto.ts`      | +5 optional fields                                          |
| `shared/types/prediction.ts`      | +5 optional fields                                          |
| `shared/scoring/index.ts`         | +1 export                                                   |
| `shared/scoring/ml/index.ts`      | +1 export                                                   |
| `PredictionResultCard.tsx`        | dark mode fix                                               |
| 3 个 `.spec.ts` 文件              | mock 修复                                                   |

---

## 2. 审查维度与检查项

### 维度 A：数学正确性

请验证以下核心数学操作：

**A1. Log-odds 空间操作**

- 文件：`packages/shared/src/scoring/score.ts`
- 函数：`logit(p)`, `invLogit(x)`, `adjustInLogOdds(p, shift)`
- 检查：
  - `logit(0.5)` 应返回 `0`
  - `invLogit(0)` 应返回 `0.5`
  - `adjustInLogOdds(0.5, 0)` 应返回 `0.5`
  - `adjustInLogOdds(0.05, 2.14)` 应返回约 `0.31`（Legacy 8.5x odds 从 5% base rate）
  - `logit(0)` 和 `logit(1)` 不应返回 `±Infinity`（有 clamp 保护）

**A2. Beta 校准拟合**

- 文件：`packages/shared/src/scoring/ml/beta-calibration.ts`
- 函数：`fitBetaCalibration()`, `applyBetaCalibration()`
- 检查：
  - `n < 20` 时返回 identity 参数 `(a=0, b=1, c=1)`
  - `exp()` 调用有 `[-500, 500]` clamp 防溢出
  - `b` 和 `c` 参数保持 `> 0`（Beta 分布约束）
  - 正样本率 `< 10%` 时正则化强度自动 ×3
  - `applyBetaCalibration(0.5, identityParams)` ≈ `0.5`

**A3. Base rate + Hook 融合**

- 文件：`prediction-hook-modifiers.service.ts`
- 方法：`getBaseRate()`, `computeHookShifts()`, `applyHooks()`
- 检查：
  - Base rate 优先级：ED 公布率 > 国际生率 > 整体率
  - 中国申请者调整：selectivity > 0.85 → ×0.4, > 0.70 → ×0.60
  - Hook shift 总和 cap 在 `[-3.0, +3.0]`
  - 最终概率 clamp 在 `[0.01, 0.99]`
  - Legacy OR=8.5x 对应 log-odds shift = `ln(8.5)` ≈ `2.14`

**A4. Tier 0 冷启动融合**

- 文件：`prediction-ml-primary.service.ts`
- 方法：`fuseBaseRateAndHeuristic()`
- 检查：
  - `logit(baseRate) * 0.6 + logit(heuristicProb) * 0.4` 的加权平均
  - base rate 权重（0.6）大于启发式权重（0.4）— 因为 base rate 是真实数据
  - 两个极端输入（如 base rate=0.03, heuristic=0.90）不应产生荒谬结果

**A5. Spike Coherence**

- 文件：`packages/shared/src/scoring/spike-coherence.ts`
- 检查：
  - 0 活动 → 返回 `1.0`
  - 全部同 category → `focusRatio=1.0` → spike 奖励 `~1.2x`
  - `focusRatio < 0.3` → 轻微惩罚 `~0.9x`
  - `targetMajor` 对齐 → 额外 `×1.1`

---

### 维度 B：数据流完整性

**B1. Feature Flag 分支**

- 文件：`prediction.service.ts`，搜索 `v5 ML-Primary feature flag branch`
- 检查：
  - Feature flag 在 per-school 循环**外**查询（不是每个 school 查一次）
  - `v5MlPrimary` 和 `v5Shadow` 作为参数传入 `predictForSchool()`
  - Shadow 模式：运行 ML-Primary 但返回 legacy 结果
  - ML-Primary 失败时 try/catch fall back 到 legacy

**B2. 缓存一致性**

- 文件：`prediction-cache.service.ts`
- 检查：
  - `getCacheKey()` 包含 `engineMode` 参数（默认 `'v4'`）
  - v5 分支保存缓存时传 `engineMode: 'v5'`
  - `getFromCache()` 和 `saveToCache()` 都接受并传递 `engineMode`
  - 不同 engine mode 的缓存不会互相污染

**B3. 校准闭环**

- 文件：`prediction-reporting.service.ts`
- 检查：
  - `reportActualResult()` 末尾调用 `calibrationService.invalidateCalibrationCache()`
  - 同一 prediction 的 SELF_REPORTED 记录去重（update 而非重复 create）
  - `PredictionCalibrationService` 通过 `@Optional()` 注入

**B4. ML Primary Pipeline 输出完整性**

- 文件：`prediction-ml-primary.service.ts`
- 检查 result 对象包含：
  - `policyVersionId`（设置为 `MODEL_VERSION`）
  - `servedTrace`（包含 tier、calibration、hookShifts 等审计信息）
  - `factors`（从 hookShifts 生成，非空）
  - `hookShifts`（公开 API 版本已脱敏：`logOddsShift=0`，humanized labels）
  - `applicationRound`
  - `pipelineTier`, `calibrationMethod`, `baseRate`

---

### 维度 C：安全性

**C1. Hook 系数注入**

- 检查：`HOOK_COEFFICIENTS` 是硬编码 `const`，无 Admin API 可修改
- `applyHooks()` 的 `[-3.0, +3.0]` cap 防止极端值

**C2. hookShifts 隐私**

- 检查：公开 API 返回的 `hookShifts` 中 `logOddsShift` 已设为 `0`
- `hookType` 已替换为 user-friendly 标签（如 `Legacy Advantage`，非 `LEGACY_PRIMARY`）
- 完整精度值仅在 `servedTrace`（DB 审计字段）中保留

**C3. LLM 解释隔离**

- 文件：`prediction-ai-engine.service.ts` → `generateExplanation()`
- 检查：
  - LLM **不**产生概率数字
  - prompt 明确指示"不要修改概率"
  - `hookShifts` 数据注入 prompt 时，值来自系统常量（非用户输入），无注入风险
  - 失败返回 `null`，调用者有确定性 fallback

**C4. reportResult 限流**

- 文件：`prediction.controller.ts`
- 检查：`@ThrottleSensitive()`（5/min）已添加到 `reportResult` 端点

**C5. Feature Flag 权限**

- 检查：Feature flag CRUD 由 `AdminFeatureFlagController` 管理，有 `@Roles(Role.ADMIN)`

---

### 维度 D：兼容性

**D1. DTO 向后兼容**

- 检查 `PredictionResultDto` 的 v5 新字段全部是 `@ApiPropertyOptional`：
  - `pipelineTier?: number`
  - `calibrationMethod?: string`
  - `baseRate?: number`
  - `hookShifts?: Array<{...}>`
  - `quotaDisclosure?: string`
- 前端不消费的字段会被忽略（不 break）

**D2. Agent Tool 兼容**

- `analyze_admission_chance` tool 消费的字段（`.tier`, `.probability`, `.confidence`, `.factors`, `.suggestions`）在 v5 结果中全部存在
- `MlPrimaryResult extends InternalPredictionResult extends PredictionResultDto`

**D3. Shared Types 同步**

- `packages/shared/src/types/prediction.ts` 的 `PredictionResult` 接口与 DTO 同步
- v5 字段在两处一致

**D4. Mobile 兼容**

- Mobile 通过 dashboard 端点消费，不直接使用 `PredictionResult` 的引擎字段
- 全部 v5 字段 optional → Mobile 不受影响

---

### 维度 E：性能

**E1. Feature Flag 查询位置**

- 检查：`featureFlagService.isEnabled()` 在 per-school 循环**外**调用
- `userId` 查询也在循环外（`prisma.profile.findUnique` 一次）

**E2. 额外 DB 查询**

- v5 每个 school 新增：`countLabeledData()`（1 次 COUNT）+ `resolveMajorCompetitiveness()`（1 次 findFirst）
- 校准查询 Redis 缓存

**E3. 缓存策略**

- v5 结果正确缓存到 Redis（`engineMode: 'v5'` key）
- TTL 与 legacy 相同（24h）

---

### 维度 F：测试覆盖

**F1. 新增测试**

- `prediction-hook-modifiers.service.spec.ts` — 36 tests
- `prediction-ml-primary.service.spec.ts` — 21 tests

**F2. 全量测试通过**

- 13 prediction suites, 347 tests, 0 failures
- 129 total API suites, 2,428 tests, 0 failures
- 3 apps typecheck clean (API + Web + Mobile)

---

## 3. 关键算法验证场景

请用以下场景验证预测行为的合理性：

| 场景              | 学校           | 学生                       | 期望行为                                          |
| ----------------- | -------------- | -------------------------- | ------------------------------------------------- |
| 强学生 + 超选拔校 | Harvard (3.4%) | GPA 3.98, SAT 1560, 强活动 | 概率 10-20%（不应超过 25%，base rate 锚定）       |
| 强学生 + 普通校   | BU (30%)       | 同上                       | 概率 50-70%（同一学生更高）                       |
| 平均学生          | Harvard        | GPA 3.5, SAT 1400          | 概率 ≈ base rate（~1.5% 中国国际生）              |
| Legacy + ED       | Penn (7%)      | 中等, Legacy, ED           | 概率显著高于 RD 非 Legacy（hook shifts 叠加）     |
| 国际生需 Aid      | MIT (4%)       | 强, 需全额 Aid, 中国       | 概率被 need-aware 和 China 调整显著压低           |
| CS at CMU         | CMU (11%)      | 强, 申请 CS                | base rate 被 major selectivity ×0.30 调整为 ~3.3% |

---

## 4. 已知限制与未来计划

| 限制                      | 说明                                    | 计划                               |
| ------------------------- | --------------------------------------- | ---------------------------------- |
| Tier 0 仍是启发式         | 数据不足时用 base rate + heuristic 融合 | L3: Beta-TabPFN                    |
| factors 无 LLM 质量       | 当前从 hookShifts 机械生成              | L2: 调用 `generateExplanation()`   |
| comparison 硬编码         | percentile 全是 50                      | L2: 从 profile/school metrics 计算 |
| 无 EQI/RFS 特征           | essay + 关系信号待接入                  | L2                                 |
| 配额模型未实现            | 阶跃函数待开发                          | L2                                 |
| Recommendation 概率不一致 | 独立计算，未调用 PredictionService      | L2: 统一                           |
| Hook 系数静态             | 无 Admin 覆盖 API                       | L2: CRUD + 衰减                    |

---

## 5. 参考文献

完整文献列表见 `docs/PREDICTION_SYSTEM.md` §1.4（10 篇核心 + 11 篇补充）。

关键参考：

1. **Arcidiacono et al.** (SFFA v. Harvard) — Legacy OR=8.5x
2. **TabArena 2026** — Beta 校准唯一同时提升 Log-loss + AUC
3. **CAPS (Zeng & Shen 2025)** — SAS/EQI/EIS 三维分解，GPA 权重 0.37
4. **CollegeVine** — 75 因素单一 ML 模型，84.38% 准确率
5. **Cornell GBDT (Lee et al. 2023)** — GBDT > SAT-heuristic

---

## 6. 文件定位速查

```
# v5 核心
apps/api/src/modules/prediction/prediction-ml-primary.service.ts     # 主编排器
apps/api/src/modules/prediction/prediction-hook-modifiers.service.ts  # Hook 系数
packages/shared/src/scoring/ml/beta-calibration.ts                   # Beta 校准
packages/shared/src/scoring/spike-coherence.ts                       # Spike 分析
packages/shared/src/scoring/score.ts                                 # logit/invLogit/adjustInLogOdds

# Feature Flag 分支
apps/api/src/modules/prediction/prediction.service.ts                # 搜索 "v5 ML-Primary"

# 校准闭环
apps/api/src/modules/prediction/prediction-reporting.service.ts      # 搜索 "invalidateCalibrationCache"

# 缓存
apps/api/src/modules/prediction/prediction-cache.service.ts          # getCacheKey with engineMode

# LLM 解释
apps/api/src/modules/prediction/prediction-ai-engine.service.ts      # generateExplanation()

# DTO
apps/api/src/modules/prediction/dto/prediction-response.dto.ts       # v5 optional fields
packages/shared/src/types/prediction.ts                              # shared types

# 测试
apps/api/src/modules/prediction/prediction-ml-primary.service.spec.ts
apps/api/src/modules/prediction/prediction-hook-modifiers.service.spec.ts

# 设计文档
docs/PREDICTION_V5_RESEARCH_REPORT.md                                # 完整研究报告
docs/adr/0016-prediction-ml-primary-architecture.md                  # 架构决策记录
docs/PREDICTION_SYSTEM.md                                            # 系统文档（含文献）
```
