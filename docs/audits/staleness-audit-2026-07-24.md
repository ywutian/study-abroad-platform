# 算法与数据时效性审计 — 2026-07-24

> 范围：预测/评分算法 + LLM 层。**未覆盖**：前端、mobile、依赖版本、其余业务模块。
> 结论：**算法框架大体正确，过时的是喂给它的数据、以及它对外部世界的假设。**

按影响排序。每项含：现状 → 最新事实 → 后果 → 修法 → 验收。

---

## 1. 🔴 `testingPolicy=UNKNOWN` 静默等于"无惩罚"

**现状**

`testBandMultiplier()`（`apps/api/src/modules/prediction/counselor/counselor-modifiers.ts:536`）分支：

| policy     | 无分数时 multiplier                   |
| ---------- | ------------------------------------- |
| `BLIND`    | 1.0（正确）                           |
| `REQUIRED` | 0.1（正确）                           |
| `OPTIONAL` | 0.85 / 1.0（正确）                    |
| `UNKNOWN`  | **NEUTRAL ×1.0** ← 落到 `:637` 的兜底 |

而 `schema.prisma:1487` 是 `testingPolicy TestingPolicy @default(UNKNOWN)`，且
**College Scorecard 不提供该字段**（见 `docs/DATA_SOURCES.md` 字段映射表——无此列），
同步进来的学校默认全是 `UNKNOWN`。只有 `school-write.service.ts` / `school-data-merger.ts`
能写它，即人工/admin 数据管线，**没有任何自动刷新机制**。

**最新事实（2026-27 申请季）**

- 8 所藤校中 **6 所**已强制 SAT/ACT
- **整个佐治亚州立系统**（UGA、Georgia Tech、Georgia State）fall 2026 起强制
- University of Florida 全员强制；Auburn fall 2027 起全员强制
- Princeton / Columbia 已宣布 2027-28 起强制（2026-27 为最后一年 test-optional）

**后果**

无 SAT 学生申请 Georgia Tech → 引擎给 ×1.0，正确答案 ×0.1。**差一个数量级，且方向是过度乐观**——
选校产品最不能犯的错。

**实测 prod 数据（2026-07-24，cloud-sql-proxy 只读）**

```
testingPolicy | n   | pct
--------------+-----+------
UNKNOWN       | 234 | 96.3
BLIND         |   9 |  3.7      ← 仅 UC 系，来自 closure overlay
```

**`REQUIRED` 和 `OPTIONAL` 各 0 条。** 该枚举在 prod 实际处于未使用状态。

UNKNOWN 的 234 所按选择性拆分：

| 选择性               | n      |
| -------------------- | ------ |
| ≥50%                 | 132    |
| **<20%（高选择性）** | **56** |
| 20–50%               | 45     |
| 无 acceptanceRate    | 1      |

受影响最严重的（UNKNOWN + 录取率最低 top 20）是一份名校名单：
Caltech 2.6% / Harvard 3.7% / Stanford 3.8% / Columbia 3.9% / Princeton 4.4% /
MIT 4.6% / Yale 4.8% / UChicago 4.8% / Penn 5.4% / Brown 5.4% / Dartmouth 5.4% /
Duke 5.7% / Vanderbilt 5.9% / JHU 6.4% / Pomona 6.8% …

其中 Harvard、Yale、Brown、Dartmouth、Penn、MIT、Caltech、Stanford **在 2026-27 已强制标化**，
引擎却对无分数申请者一律给 ×1.0。

**结论修正**：`UNKNOWN` 不是边缘分支，**它是主分支**（96.3%）。
因此本项的主要杠杆从「改兜底逻辑」变成「**回填 testingPolicy 数据**」——
只改代码的话，效果等同于给几乎所有预测挂上一个"数据不足"标注。

**修法（B 打底 + A 兜底，已定）**

1. ✅ **代码 — 已完成 2026-07-24**
   - **A（概率兜底）** `counselor-modifiers.ts` `testBandMultiplier()`：删除 neutral 兜底。
     凡不是 `BLIND`/`REQUIRED`/`OPTIONAL` 的（含 `UNKNOWN`、`null`、以及将来新增的枚举值）
     一律走与 test-optional 相同的选择性分级修正 —— <20% 给 0.85×，≥20% 给 1.0×。
     **刻意不给 UNKNOWN 单独的曲线**：在 `testingPolicy` 真正回填、两者能被分开测量之前，
     那只是凭空造数。同理刻意不把 UNKNOWN 当 `REQUIRED`（0.1×）—— 那是把过度乐观换成
     过度悲观，对真的 test-optional 学校同样是错的。
   - **B（显式标注）** `prediction-policy.service.ts` `buildTracePayload()`：策略未记录
     且申请者无 SAT/ACT 时，往 `uncertaintyReasons` 推一条 caveat。该通道已接
     `prediction-public-explanation.ts` 的 `buildCaveats()`，直达用户可见层，无需新字段。
   - 测试：`counselor-modifiers.spec.ts` +2（选择性/非选择性各一条回归护栏），
     `prediction-policy.service.spec.ts` +2（caveat 触发/不触发）。
     顺带修了一个假 fixture —— 原 "all metadata available" 用例的 `school: {}` 根本没有
     `testingPolicy`。290 项预测测试全过，含 11-invariant sweep + monotonicity + 行为矩阵。

   **已知残留缺口**（代码层解不了）：录取率 ≥20% 但实际强制标化的学校（如 UF ~23%）
   在这里仍读作 1.0×。只有回填数据能关掉它。

2. ⬜ **数据（真正的杠杆）**：回填 234 所学校的 `testingPolicy`。
   Scorecard 无此字段，需要独立数据源 —— 优先覆盖 56 所 <20% 的高选择性学校。

**验收**：无分数 + `UNKNOWN` 高选择性学校，输出不得高于同条件 `OPTIONAL` 学校。

---

## 2. 🔴 LLM 钉在 gpt-4o-mini；成本统计已失真

**现状**

- 默认模型 `gpt-4o-mini`：`ai-agent/core/llm.service.ts:114`、
  `common/config/env.validation.ts:99`、`profile/profile-application-analysis-v2.service.ts:55`
- `ai-agent/DEVELOPMENT_STANDARDS.md:256-260` 5 个 agent 全部 `gpt-4o-mini`
- 计费表 `llm.service.ts:320` 只有 gpt-4 / 4-turbo / 4o / 4o-mini / 3.5-turbo + deepseek

```ts
const price = PRICING[model] || PRICING['gpt-4o-mini']; // 未知模型静默按最便宜的算
```

**最新事实（2026-07）**

| 模型         | input $/M | output $/M | ctx  |
| ------------ | --------- | ---------- | ---- |
| GPT-5.5      | 5.00      | 30.00      | 1M   |
| GPT-5.4      | 2.50      | 15.00      | —    |
| GPT-5.4-mini | 0.75      | 4.50       | 400k |
| GPT-5.4-nano | 0.20      | 1.25       | —    |

GPT-4o 系已从 OpenAI 官方定价页下架。

**后果**

prod 实际跑 `gpt-5.4-mini`（不在表里）→ 按 gpt-4o-mini 计价 →
**input 少算 5×，output 少算 7.5×**。TokenTracker 的成本数字全是假的。

**修法**：补 PRICING 表；`||` 兜底改为告警而非静默。

**验收**：一次已知 token 数的调用，`estimateCost` 结果对得上 OpenAI 账单量级。

---

## 3. 🟠 英语成绩归一化跨考种不可比

**现状** — `packages/shared/src/scoring/english-proficiency.ts`

```ts
MAX_SCORES = { TOEFL: 120, IELTS: 9.0, DUOLINGO: 160 };
normalizeEnglishScore = score / max;
```

注释自称 `0.875 ≈ TOEFL 105 / IELTS 7.875 / DET 140`。

**问题**：三个考试下限不是 0（IELTS 从 1 起，DET 从 10 起），线性除法没有可比性。
对照公开换算：TOEFL 105 ≈ IELTS 7.5；DET 130–135 ≈ IELTS 7.0。
→ IELTS / DET 门槛各被抬高约半档到一档。

**后果**：考 IELTS / Duolingo 的国际生被系统性低估——正好是核心用户群。

**修法**：删掉比例计算，换一张三列 concordance 查找表。
DET 官方刻度仍是 10–160、5 分一档，表很短。

**验收**：TOEFL 105 / IELTS 7.5 / DET 132 三份档案，学术分之差 < 1 分。

---

## 4. 🟠 Scorecard SAT band 在 test-optional 时代上偏

**现状**

- `counselor/anchor-resolver.service.ts:79` 用 `scorecard (acceptanceRate + SAT bands)` 做锚
- `counselor-modifiers.ts:269` 把 GPA 映射成"等效 SAT"再去比这个 band

**最新事实**

公开 SAT 25/75 只统计**提交分数者**，自选择偏差使绝大多数学校 2019→2022 均分上行。
Opportunity Insights：不提交分数的学生，实际表现约等于提交 ~1300 的学生。

**后果**：两层偏差叠加（GPA 推出的 SAT × 只含提交者的分布）→ 对无分数申请者系统性低估。
可量化、有文献，不是玄学。

**修法**：锚点用 band 时带 submitter-share 折扣；或无分数路径直接锚到 ~1300 等效位，
不走 GPA→SAT。

**验收**：跑 11-invariant sweep，无分数档案的预测不应低于同 GPA 有分数档案一个 tier 以上。

> ⚠️ 这是**改结构**不是**调系数**。参见 `feedback_do_not_tune_coefficients`——
> n=1076 下不得手调/ML 学习各轴倍率。

---

## 5. 🟡 CDS 数据源落后一个申请季

代码注释引用 CDS **2023-24** / **2024-25**：
`counselor-modifiers.ts:1050`、`:1313`、`:1439`。

CDS **2025-26** 已发布（Duke、Georgia Tech、UCSD、BU、Iowa 等）。

州内/州外比、国际生比、ED 倍率本身是 2026-05-31 那轮 48-flagship 审计定的，数字没问题，
只是底层 CDS 该滚一版。

**修法**：走 `/closure-update` + `/competition-data-audit` 流程，不要手改数字。

---

## 6. 🟢 死代码：`packages/shared/src/scoring/ml/`

6 个文件，只有 `metrics.ts` 活着：

- `computeAucRoc` ← `prediction/prediction-policy-shadow.service.ts:191`
- `brierScore` ← `prediction/prediction-reporting.service.ts:996`

另外 4 个 —— `logistic-regression.ts` / `gbdt-inference.ts` / `beta-calibration.ts` /
`explainer.ts` —— 全仓库无消费者，是 2026-05-07 删除 v5 ML 路径后的残留。
`packages/shared/vitest.config.ts:9` 自己写着 "scoring/ml/* is orphaned dead code"，
但 `scoring/index.ts:8` 还在 `export * from './ml'` 对外暴露。

**修法**：删那 4 个，`index.ts` 改为只导出 `./ml/metrics`。

> 注意：`metrics.ts` 是活的，**不要整目录删**（旧记忆已记此坑）。

---

## 附：小 bug

`counselor-modifiers.ts:581` — `considerScore(act * 45, …)`：

- SAT 路径 clamp 到 1600，ACT 路径没有 → ACT 36 × 45 = **1620**，越界
- `×45` 是线性近似，College Board 实际 concordance 非线性
  （ACT 20 ≈ SAT 1030，线性算法给 900，低分段偏差很大）

---

## 来源

- [College Transitions — 回归标化的名校名单](https://www.collegetransitions.com/blog/top-colleges-rolling-back-test-optional-policies/)
- [CollegeHelpGuide — 公立系统退出 test-optional](https://www.collegehelpguide.com/blog/public-universities-dropping-test-optional-2026-2027/)
- [Morph — OpenAI 2026 全量价格表](https://www.morphllm.com/openai-api-pricing)
- [OpenRouter — GPT-5.4 Mini 规格](https://openrouter.ai/openai/gpt-5.4-mini)
- [Galvanize — DET / IELTS / TOEFL 换算](https://galvanizetestprep.com/blogs/duolingo-score-chart-ielts-toefl-conversion-guide/)
- [South Shore — test-optional 时代 SAT 均分的误导性](https://highambition.org/2025/01/19/the-misleading-nature-of-college-average-sat-and-act-scores-in-the-test-optional-era/)
- [Georgia Tech CDS 2025-26](https://irp.gatech.edu/node/152)
