# Prediction Benchmark — 标准测试集 (M3 v2)

> **这份文档是什么**：M3 Bayesian 引擎的 benchmark "黄金测试集"完整规格。这是 `docs/PREDICTION_BENCHMARK.md` (2026-04-21 设计稿) 中规划的 **Layer 0 Golden Fixtures**（20 条手写场景）+ 7 个结构性属性测试 + 4 个 ADMITTED 案例重放的实现版本。
>
> **目的**：让任何审阅者（你 / 团队 / 留学顾问）能在不读引擎代码的前提下，逐条判断每个测试是否合理、引擎给出的数字是否符合常识。**这是引擎"对不对"的标尺**。
>
> **当前状态**（2026-05-23，engineVersion `m3-{git-sha}`，本地 DB）：
>
> - **结构性测试**：7/7 ✅
> - **Golden fixtures**：14/20 ✅（6 个失败暴露了真实 bug，见下方）
> - **ADMITTED 重放**：4/4（无硬断言，看趋势）

---

## 目录

- [Part 1 — Layer 0: 20 个 Golden Fixtures](#part-1--layer-0-20-个-golden-fixtures)
- [Part 2 — Layer 0: ADMITTED 案例重放（4 条 × Alice Zhang）](#part-2--layer-0-admitted-案例重放4-条--alice-zhang)
- [Part 3 — 结构性属性测试（7 条）](#part-3--结构性属性测试7-条)
- [Part 4 — 当前发现的 6 个 bug](#part-4--当前发现的-6-个-bug)
- [Part 5 — 文件路径速查 & 如何扩展](#part-5--文件路径速查--如何扩展)

---

## Part 1 — Layer 0: 20 个 Golden Fixtures

**设计原则**（来自 `PREDICTION_BENCHMARK.md`）：

- **不断言精确概率**（避免被微调卡住），断言 (a) tier 精确匹配，(b) probability 落在区间，(c) confidence 不超过/不低于某档，(d) ED-vs-RD 或 intl-vs-domestic 的差值满足下界
- 失败的 fixture 是 **bug 信号**，不是需要 update 的数据
- 每条 fixture 是 (profileSpec × schoolNameNorm × round) → assertions

代码位置：[`scripts/m3-golden-fixtures.ts`](../scripts/m3-golden-fixtures.ts) (`GOLDEN_FIXTURES` array)

### Group 1 — 冲刺高分 (T10 + 满分档) — 3 条

> 期望：`tier=reach`，`prob ∈ [0.08, 0.35]`。即使满分 profile 在 T5 也是 reach，但概率应明显高于平均。

| ID      | 学校      | 轮次 | Profile 关键                                           | 当前结果                      | Pass?                              |
| ------- | --------- | ---- | ------------------------------------------------------ | ----------------------------- | ---------------------------------- |
| **1.1** | Harvard   | RD   | GPA 4.0, SAT 1580, 6 NATIONAL 奖, 8 活动, UPWARD trend | **30.0%** reach (high conf)   | ✅                                 |
| **1.2** | Stanford  | REA  | GPA 3.98, SAT 1570, 5 INTERNATIONAL 奖, 7 活动         | **30.0%** reach (medium conf) | ✅                                 |
| **1.3** | Princeton | RD   | GPA 4.0, SAT 1590, 6 NATIONAL 奖, 8 活动               | **45.0%** match (high conf)   | ❌ tier=match ≠ reach；prob 超 35% |

### Group 2 — 冲刺低分 (T10 + 中等档) — 2 条

> 期望：`tier=reach`，`prob ≤ 0.15`。Profile 远低于学校 CDS 中位，应被判定为远低于均值。

| ID      | 学校    | 轮次 | Profile 关键                            | 当前结果                | Pass? |
| ------- | ------- | ---- | --------------------------------------- | ----------------------- | ----- |
| **2.1** | Harvard | RD   | GPA 3.7, SAT 1450, 0 奖, 3 活动         | **1.0%** reach (medium) | ✅    |
| **2.2** | Yale    | RD   | GPA 3.75, SAT 1430, 2 SCHOOL 奖, 3 活动 | **1.0%** reach (medium) | ✅    |

### Group 3 — 匹配 — 3 条

> 期望：`tier=match`，`prob ∈ [0.35, 0.65]`。Profile 在学校 CDS 中位附近，对应的学校 acceptance rate 较高（9-11%）。

| ID      | 学校 | 轮次 | Profile 关键                              | 当前结果                 | Pass?                                  |
| ------- | ---- | ---- | ----------------------------------------- | ------------------------ | -------------------------------------- |
| **3.1** | NYU  | RD   | GPA 3.85, SAT 1470, 2 STATE 奖, 5 活动    | **10.5%** reach (medium) | ❌ tier=reach ≠ match；prob 远低于 35% |
| **3.2** | BU   | EA   | GPA 3.8, SAT 1450, 2 REGIONAL 奖, 5 活动  | **29.8%** reach (medium) | ❌ prob 29.8% < 35%                    |
| **3.3** | USC  | EA   | GPA 3.75, SAT 1450, 1 REGIONAL 奖, 4 活动 | **7.9%** reach (high)    | ❌ tier 错；prob 严重偏低              |

### Group 4 — 保底 — 2 条

> 期望：`tier=safety`，`prob ≥ 0.75`。学校整体录取率高（60-90%），profile 在其 50th percentile 以上。

| ID      | 学校       | 轮次 | Profile 关键                     | 当前结果                  | Pass? |
| ------- | ---------- | ---- | -------------------------------- | ------------------------- | ----- |
| **4.1** | Penn State | RD   | GPA 3.7, SAT 1400, 1 REGIONAL 奖 | **76.4%** safety (medium) | ✅    |
| **4.2** | ASU        | RD   | GPA 3.6, SAT 1350, 0 奖, 3 活动  | **95.4%** safety (medium) | ✅    |

### Group 5 — ED/EA 加成 — 2 条

> 期望：同一 profile 在 ED 轮 vs RD 轮的预测，ED 概率 - RD 概率 **≥ 5pp**。学校 ED 录取率高出 overall 约 2-3 倍。

| ID      | 学校  | Profile 关键                     | ED 结果 | RD 结果 | Δ       | 期望  | Pass? |
| ------- | ----- | -------------------------------- | ------- | ------- | ------- | ----- | ----- |
| **5.1** | UPenn | GPA 3.9, SAT 1500, 3 NATIONAL 奖 | 24.0%   | 11.9%   | +12.1pp | ≥ 5pp | ✅    |
| **5.2** | Duke  | GPA 3.85, SAT 1480, 3 STATE 奖   | 14.8%   | 6.3%    | +8.5pp  | ≥ 5pp | ✅    |

### Group 6 — 国际生 / 中国申请者 — 3 条

> 期望：同一 profile 标记为 intl (CN) vs domestic，domestic 概率 - intl 概率 **≥ 2-3pp**。国际生 base rate 一般低于国内同档。

| ID      | 学校    | Profile 关键                                 | Intl 结果 | Domestic 结果 | Penalty   | 期望  | Pass?             |
| ------- | ------- | -------------------------------------------- | --------- | ------------- | --------- | ----- | ----------------- |
| **6.1** | Yale    | GPA 3.95, SAT 1550, TOEFL 115, 4 NATIONAL 奖 | 27.7%     | 27.7%         | **0.0pp** | ≥ 3pp | ❌ 引擎完全没区分 |
| **6.2** | Cornell | GPA 3.9, SAT 1500, TOEFL 110, 3 STATE 奖     | 11.9%     | 23.6%         | +11.7pp   | ≥ 3pp | ✅                |
| **6.3** | NYU     | GPA 3.8, SAT 1470, TOEFL 108, 2 REGIONAL 奖  | 10.5%     | 10.5%         | **0.0pp** | ≥ 2pp | ❌ 引擎完全没区分 |

### Group 7 — 数据缺失 — 3 条

> 期望：confidence 降级到 `medium` 或 `low`（不是 `high`）。引擎应能在数据缺失时给出预测但同时降低自信度。

| ID      | 学校     | 轮次 | 缺失内容                         | 当前结果                 | Pass? |
| ------- | -------- | ---- | -------------------------------- | ------------------------ | ----- |
| **7.1** | UPenn    | RD   | 无 SAT/ACT，`testOptional=true`  | 9.8% reach **(low)**     | ✅    |
| **7.2** | Stanford | REA  | 无 GPA，SAT 1550                 | 14.9% reach **(low)**    | ✅    |
| **7.3** | Duke     | ED   | 无 SAT/ACT，`testOptional=false` | 28.5% reach **(medium)** | ✅    |

### Group 8 — 极端边界 — 2 条

> 期望：极弱 profile 在 T5 仍 > 0%（不能 hard-zero），极强 profile 在 T70 应近确定（不能 cap 太低）。

| ID      | 学校    | 轮次 | Profile 关键                                   | 当前结果                  | 期望区间   | Pass? |
| ------- | ------- | ---- | ---------------------------------------------- | ------------------------- | ---------- | ----- |
| **8.1** | Harvard | RD   | GPA 2.5, SAT 1100, 0 活动, 0 奖                | **1.0%** reach (medium)   | [0.1%, 5%] | ✅    |
| **8.2** | ASU     | RD   | GPA 4.0, SAT 1600, 10 活动, 6 INTERNATIONAL 奖 | **94.7%** safety (medium) | [85%, 99%] | ✅    |

---

## Part 2 — Layer 0: ADMITTED 案例重放（4 条 × Alice Zhang）

跟 fixture 不同，这 4 条是用**同一个真实学生 (Alice Zhang) 在 4 所她有意申请的学校**做重放，没有硬断言，看趋势用。

### Alice Zhang 完整档案

| 维度       | 内容                                                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GPA / 高中 | 3.95 / 4.0，**北京人大附中（RDFZ）**，国际生（中国）                                                                                                                            |
| 目标专业   | Computer Science                                                                                                                                                                |
| **SAT**    | **1560** (M800 / R760)                                                                                                                                                          |
| **TOEFL**  | 115 (R30 / L29 / S27 / W29)                                                                                                                                                     |
| AP         | 3 个 AP 5：Calc BC / CS A / Phys C: Mechanics                                                                                                                                   |
| 活动       | (1) 清华 CS 系 AI for Education 研究（AAAI workshop 论文）<br>(2) 校 Programming Club 创立 + 主席<br>(3) 乡村教育志愿者 Program Director<br>(4) 校 Competitive Programming 队长 |
| 奖项       | USACO Platinum + NOIP First Prize + AMC12 140+ + **Intel ISEF Finalist (国际)**                                                                                                 |
| Hooks      | ❌ legacy / ❌ athlete / ❌ first-gen，仅 international                                                                                                                         |

### 4 个 ADMITTED 重放结果

| Case           | 学校              | 轮次 | 顾问直觉区间 | M3 实际           | Tier  | Confidence | 数据来源 |
| -------------- | ----------------- | ---- | ------------ | ----------------- | ----- | ---------- | -------- |
| `stanford-rea` | Stanford          | REA  | 5–15%        | **30.0%** ⚠️ 偏高 | reach | medium     | HIGH     |
| `mit-ea`       | MIT               | EA   | 10–22%       | **45.0%** ⚠️ 偏高 | match | high       | HIGH     |
| `cmu-ed`       | CMU               | ED   | 25–45%       | **65.0%** ⚠️ 偏高 | match | high       | MEDIUM   |
| `umich-ea`     | UMich (Ann Arbor) | EA   | 30–50%       | **57.3%** ✅ 合理 | match | medium     | MEDIUM   |

平均 49.3%（直觉期望 25–40%）。详细 contribution 拆解见 [`scripts/print-alice-predictions.ts`](../scripts/print-alice-predictions.ts)。

---

## Part 3 — 结构性属性测试（7 条）

这些不针对特定学生 — 它们检查引擎数学不变量。每条都有明确 pass criterion。详见 [`scripts/m3-structural-benchmark.ts`](../scripts/m3-structural-benchmark.ts)。

| #   | 名字                     | 输入                                 | 期望                                                  | 当前 |
| --- | ------------------------ | ------------------------------------ | ----------------------------------------------------- | ---- |
| 1   | **CDS Band Consistency** | 38 条 CDS band 各合成中点 profile    | predicted ∈ [published ×0.5, ×1.8]，≥60% bands 通过   | ✅   |
| 2   | **Round Elasticity**     | T30 中 ~20 校的 ED vs RD 比较        | predicted ED/RD ratio 在公布 ratio ±50% 内，≥70% 通过 | ✅   |
| 3   | **Monotonicity (GPA)**   | Stanford 上 GPA 3.0→4.0 sweep        | 单调不降，0 次反向                                    | ✅   |
| 4   | **Sanity Bounds (T20)**  | 10 T20 校 × 完美 vs 弱 profile       | 完美 ≥ 12%, 弱 ≤ 8%，≤20% 越界                        | ✅   |
| 5   | **Hook Elasticity**      | Yale 上 athlete/legacy/firstGen 三组 | 三组 ratio 全部 ≥ {1.4, 1.3, 1.15}× 基准              | ✅   |
| 6   | **Reproducibility**      | MIT 上同一 profile × 10 次           | stddev < 0.001                                        | ✅   |
| 7   | **Distribution Health**  | 100 profile × 50 校 = 5000 预测      | 0-10% + 90-100% < 60%；30-70% > 20%                   | ✅   |

---

## Part 4 — 当前发现的 6 个 Bug

这 6 个失败 fixture 是 benchmark 真正的产出 — 它们告诉你引擎当前哪里不对：

### Bug 1 — Princeton (1.3) 满分 profile 给出 45% match

- **现象**：GPA 4.0 / SAT 1590 / 6 NATIONAL 奖 / RD → 45% match
- **期望**：≤ 35% reach
- **同类**：MIT EA 也 45%（见 Part 2）
- **根因猜测**：Princeton 是 HIGH tier 但 ED rate `null`，引擎走 fallback 路径时 soft uncertainty ceiling 拉力不够
- **修复方向**：T5 学校的 ceiling 系数应更强

### Bug 2 — NYU (3.1) 中等 profile 给出 10.5% reach

- **现象**：GPA 3.85 / SAT 1470 / 5 活动 / RD → 10.5% reach
- **期望**：35-65% match
- **根因猜测**：NYU `acceptanceRate = 9.23`（百分比格式，不是 0.0923 小数格式）—— 数据格式不一致导致引擎当成 9.23% 的"准 T5"对待
- **修复方向**：统一 acceptanceRate 单位（全部存为小数 0-1）

### Bug 3 — BU (3.2) 同上

- **现象**：GPA 3.8 / SAT 1450 / EA → 29.8% reach
- **根因**：BU `acceptanceRate = 11.11`，同 Bug 2

### Bug 4 — USC (3.3) 同上但更严重

- **现象**：GPA 3.75 / SAT 1450 / EA → **7.9%** reach
- **根因**：USC `acceptanceRate = 9.81`，引擎当 ~10% T10 学校处理

### Bug 5 — Yale intl 没有 penalty (6.1)

- **现象**：intl=27.7%, domestic=27.7%, penalty = **0.0pp**
- **期望**：≥ 3pp penalty
- **根因猜测**：Yale `intlAcceptanceRate` 字段为 null，引擎 fallback 时没用国际生 global baseline
- **修复方向**：当学校 intl rate 缺失，使用 `GlobalAdmitBaseline.intlPenalty` 作为兜底

### Bug 6 — NYU intl 没有 penalty (6.3)

- **现象**：同 Bug 5，penalty = 0.0pp
- **根因**：同 5

**Cornell intl (6.2) 正确工作**（penalty 11.7pp）意味着引擎逻辑本身没问题，问题在 **Yale / NYU 的数据 + fallback 缺失**。修了 Bug 5/6 的 fallback，整套 intl 维度都对了。

**Bug 2/3/4 都是 acceptanceRate 单位不一致**——这是 DB 数据问题，不是引擎数学问题。一次 SQL 修正 + 引擎 normalizer 加固就能修。

---

## Part 5 — 文件路径速查 & 如何扩展

| 内容                        | 路径                                                                   |
| --------------------------- | ---------------------------------------------------------------------- |
| 20 个 fixture 定义 + runner | `scripts/m3-golden-fixtures.ts` (`GOLDEN_FIXTURES` array)              |
| 7 个结构性测试              | `scripts/m3-structural-benchmark.ts`                                   |
| Alice profile 完整定义      | `apps/api/prisma/seed-all-features.ts:107-263`                         |
| 4 个 ADMITTED case 定义     | `scripts/seed-prediction-benchmark.ts:V3_CASES`                        |
| M3 引擎                     | `scripts/m3-bayesian-engine.ts → predict()`                            |
| Seed 入库（跑全部 31 测试） | `scripts/seed-prediction-benchmark.ts`                                 |
| Alice 单点诊断              | `scripts/print-alice-predictions.ts`                                   |
| DB schema                   | `apps/api/prisma/schema.prisma → PredictionBenchmarkRun`               |
| Admin UI                    | `apps/web/src/app/[locale]/(main)/admin/prediction-benchmark/page.tsx` |

### 如何加一个新 fixture

1. 打开 `scripts/m3-golden-fixtures.ts`
2. 在 `GOLDEN_FIXTURES` 数组里加一条：
   ```ts
   {
     id: '9.1',
     group: '你的场景组名',
     description: '中文说明 fixture 在测什么',
     schoolNameNorm: 'school name lowercase',
     schoolDisplay: 'School Display Name',
     baseRound: 'RD',
     kind: { kind: 'single', profile: {...}, assert: { tier: 'reach', probMin: 0.1, probMax: 0.4 } }
   }
   ```
   `kind` 支持 3 种：`single` / `ed-vs-rd` / `intl-vs-domestic`
3. 跑 `pnpm exec tsx scripts/m3-golden-fixtures.ts` 验证
4. **同时在本文档 Part 1 加表格行**（必须 — single source of truth）

### 如何在 prod re-seed 这些 fixture 结果

```bash
# 启动 Cloud SQL Proxy
cloud-sql-proxy study-abroad-prod-2025:us-central1:study-abroad-db --port=5433 &

# 跑 seeder 入 prod
DATABASE_URL='postgresql://studyabroad:<PASSWORD>@127.0.0.1:5433/study_abroad' \
  pnpm exec tsx scripts/seed-prediction-benchmark.ts \
    --label="post-L0-fixtures" --notes="20 golden fixtures + 7 structural + 4 ADMITTED replays"

# 关 proxy
kill $(lsof -ti:5433)
```

入库后 `/admin/prediction-benchmark` 自动显示 27 个测试（7 + 20）+ 4 个 case。

---

_Last regenerated: 2026-05-23. Fixture count 20, structural test count 7, ADMITTED case count 4._
