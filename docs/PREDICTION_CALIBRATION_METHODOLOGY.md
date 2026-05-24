# Prediction Calibration Methodology

> **这份文档是什么**：录取预测引擎"对不对"的判定方法论。当 counselor / M3 / 任何未来引擎需要 calibration 改动，按此文档执行 — 不靠"我盯着某个 profile 找 bug"这种 whack-a-mole。
>
> **核心问题它解决什么**：2026-05-24 的 incident — 强 profile 在 prod counselor 被低估到**低于学校 anchor**（Alice MIT 2.2% vs anchor 4.55%）。调查发现 5 个 modifier calibration bug + 1 个数据错误。**那些 bug 本可以被预防** —— 只要有一份 "Alice 这种 profile 在 MIT 应该 5-15%" 的 normative 测试。本文档定义这套测试 + 维护规则。
>
> **使用对象**：未来给 prediction 模块做改动的任何工程师 / agent；以及 review 校准 PR 的人。
>
> **维护周期**：industry research 显著更新（NACAC/Crimson 年报）→ revisit expected bands。引擎实现改动 → 不动 spec，跑 spec 验证。

---

## 1. 为什么我们需要方法论

### 1.1 已有工具的盲区

| 工具                                   | 干什么                                             | 漏掉什么                                                      |
| -------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `counselor-modifiers.spec.ts` 127 case | 单个 modifier 输入/输出                            | "代码做了我让它做的" — 测不到"我让它做的对不对"               |
| `gold:counselor` 30 case               | (profile × school) 概率区间断言                    | **rationale 写了 `0.85 × 0.5 = 0.42` —— 反向把 bug 锁进期望** |
| `verify:counselor-coverage` 3133 pair  | profile signal toggle 的 delta bound               | 只检查 "signal 不让预测变化太大"，不检查"预测本身合不合理"    |
| `m3-golden-fixtures.ts` 20 case        | 场景组（reach/match/safety/intl/ED/缺失/极端）断言 | **跑在 M3 standalone，不是 counselor —— 用户实际看不到**      |

**根本问题**：上述工具都是**描述性**的 ("engine does X") 而不是**规范性**的 ("engine should do Y at this profile/school")。结果：bug 出现后，工具也跟着调整，丢失"我们的目标是什么"的锚点。

### 1.2 方法论的核心原则

1. **Normative not descriptive** — 测试期望来自 industry intuition（NACAC、Crimson、留学顾问共识），不来自"当前 engine 算出什么"。Engine 算错 → 测试挂 → 修 engine。Engine 改变 → 测试不动 → 跑测试验证。
2. **场景驱动** — 不只测一个 Alice，测一整套档案场景（强 STEM unhooked / 强 humanities legacy / 弱 GPA 国际生 / 完美档案小学校 等）覆盖空间
3. **公开依据** — 每条测试的 expected band 必须引用至少一个公开来源（CDS / NACAC 报告 / Crimson report / 学校 admissions blog）
4. **CI 强制** — 任何不通过 spec 的引擎改动**不能 merge** 到 main

---

## 2. 三层防御

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3 — Calibration Spec (Industry-Anchored)               │
│   counselor-fixture-spec.ts (planned)                        │
│   ─ 场景组 × profile × school = 80+ expected band assertions │
│   ─ 期望来自 NACAC / Crimson / 顾问共识                       │
│   ─ 改动 spec 要 PR + 引证                                   │
│   PURPOSE: 防 "engine drift away from industry intuition"     │
├─────────────────────────────────────────────────────────────┤
│ Layer 2 — Coverage Sweep                                     │
│   verify:counselor-coverage (existing)                       │
│   ─ 8 demo profile × 241 school = 3133 pair                  │
│   ─ profile-signal delta gate (p95 ≤ 4pp, max ≤ 12pp)        │
│   ─ tier 分布 sanity (no school stuck at 0% or 100%)         │
│   PURPOSE: 防 "engine breaks at some unusual school"          │
├─────────────────────────────────────────────────────────────┤
│ Layer 1 — Unit Specs                                         │
│   counselor-modifiers.spec.ts (existing)                     │
│   ─ 127 单元 case                                             │
│   PURPOSE: 防 "代码改动让 modifier 函数行为意外变"           │
└─────────────────────────────────────────────────────────────┘
```

任何一层挂都不允许 merge。

---

## 3. Layer 3 详细规格（建设中）

### 3.1 文件位置

- 数据：`apps/api/gold-cases/counselor-calibration/` 一条 fixture = 一个 JSON 文件
- 运行器：`apps/api/scripts/run-counselor-calibration-spec.ts`
- 报告输出：`apps/api/gold-cases/counselor-calibration/reports/`
- 在 CI Prediction Gate 里加 step `pnpm calibration:counselor`

### 3.2 Fixture 结构

```json
{
  "id": "001-mit-strong-unhooked-domestic-rea",
  "scenarioGroup": "T5_REA_STRONG_UNHOOKED_DOMESTIC",
  "schoolName": "Massachusetts Institute of Technology",
  "applicationRound": "REA",

  "profile": { ... 标准 ProfileInput ... },

  "expectedProbabilityRange": [0.05, 0.15],
  "expectedTier": "reach",
  "expectedConfidenceAtMost": "high",

  "rationale": {
    "intuition": "顶级 unhooked STEM 申请者，REA 早申有 1.5× lift。industry consensus 5-15%",
    "sources": [
      { "name": "MIT CDS 2024-25", "url": "...", "evidence": "EA admit rate 4.55%" },
      { "name": "Crimson T20 STEM benchmark 2024", "evidence": "...similar profiles 8-15%..." },
      { "name": "NACAC State of College Admission 2024 §4.2", "evidence": "Hook applicants 50-80% lift; unhooked profile lift cap ~2×" }
    ]
  },

  "lastReviewedAt": "2026-05-24",
  "reviewedBy": "yitian@",
  "tags": ["t5-private", "stem-spike", "unhooked", "early-round", "domestic"]
}
```

**关键字段**：

- `rationale.intuition` — 用人话写"为啥这个数字 ok"
- `rationale.sources` — 至少 1 个公开来源，每个有 evidence 引文
- `lastReviewedAt` — 行业数据更新时，看这个判断要不要 refresh

### 3.3 场景组覆盖

| 场景组                          | 学校 selectivity | Profile 强度      | Hook      | Round    | 预期 tier   | 预期 prob 区间                |
| ------------------------------- | ---------------- | ----------------- | --------- | -------- | ----------- | ----------------------------- |
| T5_REA_STRONG_UNHOOKED_DOMESTIC | <5% accept       | top 1%            | 无        | REA/ED   | reach       | 5-15%                         |
| T5_RD_STRONG_UNHOOKED_DOMESTIC  | <5% accept       | top 1%            | 无        | RD       | reach       | 3-10%                         |
| T5_RD_STRONG_UNHOOKED_INTL      | <5% accept       | top 1%            | intl      | RD       | reach       | 2-8%                          |
| T5_RD_LEGACY_VERIFIED           | <5% accept       | top 1%            | legacy    | RD       | reach       | 10-25%                        |
| T5_RD_ATHLETE_VERIFIED          | <5% accept       | strong            | athlete   | RD       | match       | 30-60%                        |
| T20_ED_STRONG_UNHOOKED          | 5-12%            | top 5%            | 无        | ED       | reach/match | 15-30%                        |
| T20_EA_STRONG_INTL              | 5-12%            | top 5%            | intl      | EA       | reach       | 5-12%                         |
| T30_EA_MID_STRONG               | 12-25%           | top 10%           | 无        | EA       | match       | 25-50%                        |
| MATCH_RD_MID_PROFILE            | 15-30%           | mid-strong        | 无        | RD       | match       | 30-55%                        |
| SAFETY_RD_STRONG                | 50%+             | strong            | 无        | RD       | safety      | 75-95%                        |
| EXTREME_BOUND_WEAK_AT_T5        | <5%              | 弱                | 无        | RD       | reach       | 0.1-3%                        |
| EXTREME_BOUND_PERFECT_AT_SAFETY | 50%+             | perfect           | 无        | RD       | safety      | 85-99%                        |
| INTL_PENALTY                    | T20              | strong            | intl      | RD       | reach       | 同 profile domestic 减 30-50% |
| ED_BOOST                        | T20              | strong            | 无        | ED vs RD | match       | ED - RD ≥ 5pp                 |
| TEST_OPTIONAL                   | T20              | strong, no test   | 无        | RD       | reach       | confidence ≤ medium           |
| LOW_GPA_HIGH_TEST               | T30              | GPA 3.4, SAT 1550 | 无        | RD       | reach       | 5-15%                         |
| HIGH_GPA_LOW_TEST               | T30              | GPA 4.0, SAT 1350 | 无        | RD       | reach       | 5-15%                         |
| FIRST_GEN_T20                   | T20              | strong            | first-gen | RD       | reach/match | 同 profile 加 10-30%          |

目标：~60-80 case，每个场景组 3-5 个 instance。

### 3.4 怎么"通过"

Spec runner 输出每条 case 的：

- `actualProbability` — counselor 计算结果
- `actualTier` — `deriveTier(actualProbability)`
- `actualConfidence`
- `pass: boolean` — `prob ∈ expectedRange && tier === expectedTier && confidence ≤ expectedConfidenceAtMost`
- `failures: string[]` — 不通过的原因

CI gate: 所有 case 必须 pass，否则 fail。

例外：可以标 `wontFix: { reason: "..." }` 让一条 case 暂时跳过（PR 审查时讨论）。

### 3.5 怎么修

#### 情形 A — 引擎改动 broke spec

引擎改了 → spec case 挂 → **debug 引擎，spec 不动**。

- 把 spec 当成 ground truth
- Engine 没做对 industry intuition → 找 modifier 哪里偏了 → 修

#### 情形 B — 行业研究更新

NACAC 出新报告说"first-gen 实际 lift 是 1.7× 不是 1.5×" → **spec 改动需要 PR**：

1. 引用新研究
2. 重新计算 affected case 的 expected band
3. 引擎跟着调
4. 同 PR 改 spec + 引擎

#### 情形 C — 发现 spec 本身漏了一个场景

新增 fixture：

1. 找 ≥ 1 公开来源
2. 写 rationale.intuition
3. 加 expected range
4. 运行 → 看通不通过 → 调引擎（情形 A）

---

## 4. 已有 Layer 2 / Layer 1 的维护规则

### 4.1 `gold:counselor` 30 case 的命运

**问题**：现有 30 case 的 rationale 写着 `0.04 × 1.2 × 0.85 × 0.5 = 0.020`（buggy multipliers 烤进期望）。

**修复方案**：在 Layer 3 上线后，将 gold-cases 的 expected range **按 industry intuition 重新校准**，去除对引擎数学的依赖。每条 rationale 重写为"为什么这个数字对"。

**短期**（Layer 3 没建好之前）：保留 30 case，但在 review PR 时优先用 Layer 3。

### 4.2 `verify:counselor-coverage` gate 阈值

当前（2026-05-24 post-fix）：

- `PROFILE_SIGNAL_P95_DELTA_GATE = 0.04`
- `PROFILE_SIGNAL_MAX_DELTA_GATE = 0.12`
- `PROFILE_SIGNAL_REVIEW_DELTA = 0.07`

这些 gate 不是真值，是"profile signals 不应该把预测推太远"的工程约束。一年内 revisit 一次。

### 4.3 Layer 1 unit specs

测每个 modifier 函数。改 modifier 函数 → 同 PR 更新 spec。

---

## 5. PR Review Checklist for Calibration Changes

任何动 `counselor-modifiers.ts` / `counselor-engine.service.ts` 的 PR：

- [ ] Layer 1 unit specs 通过（`pnpm test counselor`）
- [ ] Layer 2 coverage gate 通过（CI 自动）
- [ ] Layer 3 calibration spec 通过（CI 自动，建好后）
- [ ] 若 Layer 3 有 case **故意失败 → 走 gate update PR**（先在 spec 里改 expected + 引证 → 等 review → 再改引擎）
- [ ] 描述里说明：哪个 modifier 改了 / 为啥 / 引用 industry source
- [ ] 跑 `scripts/compare-counselor-vs-m3.ts` Alice × 4 V3_CASES，附结果在 PR description

---

## 6. 已知的引擎 vs 直觉差距

记录到这里，作为后续 Layer 3 case 的种子：

| Profile                     | 学校           | 直觉   | Counselor (post-fix) | 差距    | 行业来源                       |
| --------------------------- | -------------- | ------ | -------------------- | ------- | ------------------------------ |
| Alice 3.95/1560 unhooked CS | MIT EA         | 5-12%  | 5.8%                 | ✅ 落入 | NACAC 2024 T20 STEM            |
| Alice 3.95/1560 unhooked CS | Stanford REA   | 5-15%  | 6.3%                 | ✅ 落入 | Crimson Stanford profile       |
| Alice 3.95/1560 unhooked CS | CMU ED (SCS)   | 15-30% | 10.3%                | ⚠️ 略低 | CMU SCS direct admit + ED 倍率 |
| Alice 3.95/1560 unhooked CS | UMich EA (CSE) | 20-40% | 14.8%                | ⚠️ 略低 | UMich CoE intl 招生            |

CMU/UMich 略低 是因为它们有 direct-admit CS program，`SchoolProgram.acceptanceRateEstimate` 数据正确地拉低了 prob。但 industry intuition 估计 ED 早申 + 强 profile 更高一些。**Layer 3 应该把 CMU SCS ED 列为一个 case** —— 当 spec 表达"应该 15-30%" → CI 挂 → 我们要么改 program rate 数据，要么调 majorMultiplier 中段曲线。

---

## 7. 立即下一步（implementation queue）

| 优先级 | 任务                                                                             | 工时   |
| ------ | -------------------------------------------------------------------------------- | ------ |
| **P0** | 写本文档（**就是现在**）                                                         | 30 min |
| P1     | 建 `apps/api/gold-cases/counselor-calibration/` 目录 + schema                    | 30 min |
| P1     | 写 ~15 条种子 fixture（从场景组 §3.3 挑）                                        | 1.5 h  |
| P1     | 写 runner `run-counselor-calibration-spec.ts`                                    | 1.5 h  |
| P1     | 接入 CI Prediction Gate                                                          | 30 min |
| P2     | 把已有 30 gold case 重新校准（rationale 用 industry intuition 而非 engine math） | 2 h    |
| P2     | 扩到 80 case 覆盖完整场景组                                                      | 4-6 h  |
| P3     | 自动生成 calibration 报告（monthly cron）                                        | 2 h    |

---

## 8. 维护

| 触发                                              | 动作                                                                        |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| NACAC / Crimson / IvyWise 发新年报                | review §3.3 场景组的 expected range，可能更新若干 fixture                   |
| 学校公布新 CDS                                    | 该校 anchor 数据更新；相关 fixture 不需动                                   |
| 收集到 verified outcome（Decision Day 后）≥ 50 条 | 用 outcome 数据 cross-check Layer 3 — 出现系统偏差就要么改 spec 要么改引擎  |
| 引擎重构 (e.g., M3 → counselor port)              | Layer 3 不动，跑 spec 验证                                                  |
| 用户报 bug "我的预测看起来不对"                   | 提取 user profile + school 输入 → 加成 Layer 3 case → 看 spec 是否覆盖 → 修 |

---

_本文档建立于 2026-05-24, 起因：fix/counselor-modifier-calibration (PR #278) 暴露了 calibration 是 whack-a-mole 的状态。未来动 calibration 用本方法论。_
