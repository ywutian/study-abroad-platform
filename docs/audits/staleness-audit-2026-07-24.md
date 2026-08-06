# 算法与数据时效性审计 — 2026-07-24

> 范围：预测/评分算法 + LLM 层。**未覆盖**：前端、mobile、依赖版本、其余业务模块。
> 结论：**算法框架大体正确，过时的是喂给它的数据、以及它对外部世界的假设。**

按影响排序。每项含：现状 → 最新事实 → 后果 → 修法 → 验收。

---

## 收口状态（逐项复核 2026-08-06）

**13 项全部关闭。** 复核方式是读当前 `main` 上的代码，不是读本文自己的结论 —— 一份
说自己已修的审计报告，和一份没修的，在文件里长得一模一样。

| #   | 判定          | 复核依据                                                                                                                                                                                                            |
| --- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ✅ 已修       | `#542`（Penn 单校）+ `#548`（10 所 >20% 录取率却 require SAT/ACT 的学校在读 1.0x）                                                                                                                                  |
| 2   | ✅ 已修       | `MODEL_CATALOG` 合并了原先四张互相漂移的表；`UNKNOWN_MODEL_PRICING` 由目录**取 max 推导**而非手写，所以未知模型只会高报。当年 gpt-5.4-mini 少算 7.5× 的经过写在该常量的注释里                                       |
| 3   | ✅ 已修       | 以旧制 TOEFL 为枢轴 + 三张官方 concordance；顺带修好 ETS 2026-01-21 新制 1–6 分被算成 0.046 的数据完整性 bug                                                                                                        |
| 4   | ⏸️ 原修法作废 | 四个 agent 一致否决；同代码路径上的一组真 bug 已落地                                                                                                                                                                |
| 5   | ⏸️ N_A        | 两个 agent 一致判定不该做；只修了注释                                                                                                                                                                               |
| 6   | ⏸️ 不删       | `scoring/ml` **不是死代码** —— `metrics.ts` 在 api 侧是活的                                                                                                                                                         |
| 8   | ✅ 已修       | `SOURCE_PRIORITY` 改回与枚举声明一致；未知来源从 `?? 99`（放行）改为 fail-safe 保护。**三条"顺带未处理"也都已修**：id 现在被记录并注明 sync 无法定向、两个 `@Cron` 都有 `runWithCronLock`、每个 sync 各自 try/catch |
| 9   | ✅ 已接入     | 16 条不变量 sweep 进了 CI                                                                                                                                                                                           |
| 10  | ✅ 已修       | scheduler 三处缺陷                                                                                                                                                                                                  |
| 11  | ⬜ N_A        | 实测证伪后关闭                                                                                                                                                                                                      |
| 12  | ✅ 已修       | `capSubstituteAtRequiredSchool()`；刻意**不引入惩罚系数**（那是 n=1076 下禁止的 per-axis 调参），只消除假阳性                                                                                                       |
| 13  | ✅ 已收敛     | `TestingPolicy` union SSOT                                                                                                                                                                                          |

三项 ⏸️ 是**决定不做**，不是待办 —— 每项的理由写在对应小节里，重开需要新证据。

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

2. ✅ **数据（真正的杠杆）— 已完成 2026-07-25**

   `apps/api/prisma/seed-testing-policy-2026-07-25.ts`，覆盖录取率 <20% 的 59 所学校，
   **50 所落值**（38 OPTIONAL / 10 REQUIRED / 2 BLIND），9 所刻意留 UNKNOWN。

   **取数**：4 个 agent 分批查证，一律以学校自己的招生官网为准（FairTest 仅作交叉验证），
   每条记录 URL + 读到的原文措辞 + 适用申请季。三条**第三方误传**被逐一推翻并记录：
   Bowdoin / Northwestern、Williams / Middlebury、Boston College 被多个备考站称已恢复强制，
   官网现行页面均否定。

   **独立复核**：另派一个 agent 对 14 条 REQUIRED **从零重新取证**（不看前一批结论）。
   **抓出 4 条**，全部会直接打到本平台用户群：

   | 学校                       | 问题                                                                       |
   | -------------------------- | -------------------------------------------------------------------------- |
   | Carnegie Mellon            | 全校 test-**flexible**（SAT/ACT/IB/AP/A-Level 皆可），仅计算机学院硬性要求 |
   | University of Miami        | 豁免名单明写「在美国境外高中毕业的学生」—— 即本平台绝大多数用户            |
   | Dartmouth                  | 按生源地分档：美高必须交，境外可用 3 门 AP / IB / A-Level / 本国统考替代   |
   | University of Pennsylvania | 两个 Penn 自有来源仍限定 "the 2025-26 application cycle"，无 2026-27 表述  |

   四条全部降级为 UNKNOWN。另 Yale 结论正确但**依据被更新**：不是旧的 test-flexible，
   而是 2026-05-27 刚宣布取消 flexible、改回只认 SAT/ACT。

   **前三条看起来的共同根因**：`TestingPolicy` 枚举没有 `FLEXIBLE`，也无法表达「按生源地分档」。
   14 条 REQUIRED 候选里就撞上 3 条。

   > ⚠️ **「扩枚举才是真解」这句我写错了，已被实测推翻** —— 见下方 §11。
   > `FLEXIBLE` 与这三所现在带的 `UNKNOWN` **逐格相同**，因为 `testingPolicy` 只在申请者
   > 五种 band-comparable 考试全无时才被读到。`UNKNOWN` 是**正确取值**，不是占位符：
   > schema 说不出我们已知的事，往任何一个方向说错都比不说更糟。
   > 真正缺的是逐校 accepted-test 数据，那是 §12。

   **写入**：带 provenance（`source` / `sourceUrl` / `cycleYear` / 原文 note）。source token
   `OFFICIAL_ADMISSIONS_PAGE` 已登记进 §8 修好的 `SOURCE_PRIORITY`，排在批量聚合器之上 ——
   否则这批值会被下一次 Scorecard 同步静默回退。

   **接线**：migrate.sh + Dockerfile + seed.ts + ci.yml 四处，`check-seed-pipeline-parity` 通过
   （漏 Dockerfile 会导致 prod 镜像里没有 .js → 静默跳过 seed）。

   **护栏**：`testing-policy-seed.spec.ts` 7 条结构性检查（重复、枚举合法性、禁止写 UNKNOWN、
   来源可解析、证据非空、nameNorm 规范、provenance token 与 merger 一致）。

   **顺带修好一处我自己在 §1 留下的不一致**：`prediction-policy.service.ts` 的
   `hasStandardizedScore` 只认 SAT/ACT，会告诉 IB / A-Level / 高考考生「你没交成绩所以估计变弱」
   —— 而引擎其实正在读他们的分数。改为复用 §4 建立的 `hasBandComparableScore`。

   **待复查**：~~Penn（8 月 Common App 开放后）~~ → **已复查 2026-08-03，升为 REQUIRED**：
   官网 testing 页现在标题就是 "2026-2027 Admissions Cycle"，并列出该季自己的截止日期
   （ED: SAT 11-07 / ACT 10-17，RD: SAT 12-05 / ACT 12-12），当初缺的正是这个 scoping。
   当时降级是对的 —— 页面没滚版，不是政策没延续。Penn 的豁免是 hardship 口径
   （缺考点 / 经济困难 / 自然灾害 / 内乱），既不是 Miami 那种按生源地豁免，
   也不是 Dartmouth 那种 AP/IB 替代，所以对本平台用户是实打实要交分。
   剩余：Juilliard（2026-09 后）、Harvey Mudd / Grinnell（官网公布 fall 2027 政策后）。

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

**深挖后发现的真问题：四张重复的模型事实表，已经互相打架**

| 表                | 位置                       | 单位  |
| ----------------- | -------------------------- | ----- |
| `PRICING`         | `llm.service.ts:320`       | $/1M  |
| `TOKEN_PRICES`    | `ai-agent/constants.ts:67` | $/1K  |
| `contextLimits`   | `token-tracker.service.ts` | token |
| `CONTEXT_WINDOWS` | `openai.provider.ts:23`    | token |

两张定价表**单位不同**且未知模型的兜底差了几个数量级：一张退到 $0.15/$0.60 per 1M，
另一张退到等效 $1000/$2000 per 1M。补四张表只会让它们继续漂。

另有一处独立错误：`token-tracker` 的 tokenizer 兜底是 `cl100k_base`（GPT-4/3.5 的旧编码），
GPT-5.x 该用 `o200k_base` —— **token 数本身就是错的**，再乘上错的单价。

**修法 — 已完成 2026-07-24**

- **合成一张 SSOT**：`ai-agent/constants.ts` 的 `MODEL_CATALOG`，每个模型一行
  `{ input, output, contextWindow }`，单位统一为 $/1M。四张表全部改为从它派生。
- **兜底改为「取表内最高价」**，不是手写常数 —— 由构造保证"永不低估"，且随表增长自动成立。
  配一条 warn-once 日志提示把模型加进目录。
  （最初手写了 $5/$30，被自己新加的不变量测试抓出来：`gpt-4` 是 $30/$60，更贵。）
- tokenizer 兜底 `cl100k_base` → `o200k_base`，并补齐 GPT-5.x 条目。
- 过时默认值 `gpt-4o-mini` → `gpt-5.4-mini`（prod 实际在跑的）：`env.validation.ts`、
  `llm.service.ts`、`profile-application-analysis-v2.service.ts`、`config.service.ts`、
  `workflow-engine.service.ts`。**这些只是 env 未设时的兜底**。
- 新增 `constants.spec.ts` 6 条测试，含「未知模型定价不得低于目录内任一模型」的不变量。
  594 项 ai-agent 测试全过。

**刻意没做**：`agents.config.ts` 里 6 个 agent 显式写死的 `model: 'gpt-4o-mini'`。
改它等于改这 6 个 agent 实际用的模型 —— 那是成本/质量决策，不是时效性修复。**待定**。

**可选升级**：GPT-5.6 家族 2026-07-09 GA，Terra（$2.50/$15）被定位为生产默认档，
与 GPT-5.4 同价。已在目录里，改 `OPENAI_MODEL` 即可切。

**验收**：一次已知 token 数的调用，`estimateCost` 结果对得上 OpenAI 账单量级。

---

## 3. 🟠 英语成绩归一化跨考种不可比

**现状** — `packages/shared/src/scoring/english-proficiency.ts`

```ts
MAX_SCORES = { TOEFL: 120, IELTS: 9.0, DUOLINGO: 160 };
normalizeEnglishScore = score / max;
```

注释自称 `0.875 ≈ TOEFL 105 / IELTS 7.875 / DET 140`。

**⚠️ 修正我自己的初判**：本文最初写「DET 140 过严」，**这是错的**。查证 Duolingo 官方
concordance：DET 130–144 ≈ IELTS 7.5 ≈ TOEFL 102–109，**140 落在正确带内**。
真正错的只有 IELTS 那条（7.875 应为 7.5，严了约 0.4 档）。误差并非我原先说的"单向低估"。

**但查证时撞见一件严重得多的事**

**ETS 已于 2026-01-21 把 TOEFL iBT 从 0–120 改为 1–6 分制**（半分档，对齐 CEFR）。
旧分两年内仍有效、成绩单双轨显示到 2028-01 —— **两套量表当前同时存在于申请者数据里**。

代码 `score / 120` 遇到新制成绩 `5.5`（C1，约合旧制 110）会算出 **0.046**，
远低于 `hardPenalty: 0.75` → 触发 `-8` 硬扣分。**一个英语接近满分的申请者，被当成几乎不会英语。**
这不是校准问题，是当季就在发生的数据完整性 bug。

**修法 — 已完成 2026-07-24**

- 以**旧制 TOEFL 0–120 为内部枢轴**（`ENGLISH_PROFICIENCY_THRESHOLDS` 本就是按 TOEFL 校准的，
  走 TOEFL 等效值就不会隐式改动这些阈值 —— 不是调参）。
- 三张 concordance 锚点表 + 分段线性插值（锚点取官方区间**中点**）：
  - TOEFL 1–6 → 0–120：ETS 官方对照表
  - IELTS → TOEFL：ETS/IELTS 2024 联合 concordance
  - DET → TOEFL：Duolingo 官方 concordance（2024–2025 数据）
- **双量表消歧按量级**：`≤6` 判为新制，`>6` 判为旧制总分。
  标了 `ponytail:` 注释写明天花板与升级路径（把量表标识持久化到成绩记录上）。
- 顺带修好越界行为：旧实现 IELTS 18 会算出 `2`、TOEFL −120 算出 `−1`；现在两端都 clamp。

阈值等效值（TOEFL 侧刻意保持不变）：

|            | baseline 0.875      | hardPenalty 0.75 |
| ---------- | ------------------- | ---------------- |
| TOEFL 旧制 | 105                 | 90               |
| TOEFL 新制 | ~5.4                | ~4.5             |
| IELTS      | **7.5**（原 7.875） | ~6.68（原 6.75） |
| DET        | ~137（原 140）      | ~119（原 120）   |

**测试**：`english-proficiency.test.ts` 重写（旧测试钉的正是被修掉的错误行为）。
新增新制识别、跨考种可比性、量表边界**刻意不连续**的钉子（防止后人"修"成平滑曲线而把 bug 放回来）。
399 项 shared 测试全过，覆盖率 92.43/82.30/96.64/93.81（较改前微升），ratchet hold。

**验收**：TOEFL 105 / IELTS 7.5 / DET 137 三份档案 normalized 值相等 —— 已在测试中钉住。

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

## ❌ 原修法已作废 —— 四个 agent 一致否决（2026-07-24）

原写的两个方案（① 锚点带 submitter-share 折扣 ② 无分数路径锚到 ~1300 等效位）
经 study-abroad-expert / architect / data-model-reviewer / test-engineer 独立审查后全部否决。

**我的前提本身就是错的**：`anchor-resolver.service.ts:79` 那个
`'scorecard (acceptanceRate + SAT bands)'` 只是**溯源文案**，锚点值就是
`school.acceptanceRate`，SAT band 一个数字都没进锚点。我被自己写的字符串骗了。

| Agent    | 判定      | 决定性论据                                                                                                                                                    |
| -------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 留学业务 | WARN      | 有分数者拿 submitter 比 submitter 分布是**正确参照系**，无偏差可修。真实错配只在 `gpaBandMultiplier` 启发式兜底，而 76% 学校已有 `gpaDistribution` 走对的路径 |
| 架构     | INFO      | 实算 Amherst：照"锚到 1300"做，无分数者得 **×0.3**（现 ×0.85）—— **处方符号与诊断相反**                                                                       |
| 数据模型 | **BLOCK** | 修正需要**申请者池**提交率，公开世界不存在；CDS C9 / IPEDS SATPCT 都是**入学**口径，拿它当分母＝重演 `intlAcceptanceRate` 那次总体调包                        |
| 测试工程 | **BLOCK** | 唯一 oracle 仅 3 条 gated fixture，hi/lo 达 **8×**，效应量 ~×1.41 —— **改与不改，CI 判定完全相同**                                                            |

**原验收标准也是错的**：「无分数档案不应低于同 GPA 有分数档案一个 tier 以上」在 2026-27
恰恰与 §1 冲突（强制标化学校**就该**低一个 tier），而且在精英校三档 tier 下**改前已恒真**。

**测试工程 agent 的收尾论据最硬**：§1（昨天落地）让无分数申请者 ×0.85 更悲观，
§4 要让同一批人 ×1.41 更乐观 —— **方向相反、相隔 24 小时，且没有任何仪器能测出净效应。**

**解除条件**（任一）：回填 `School.testSubmissionRate`（该列已存在但是死列）+ 政策回摆学校
2019/2024 双轨 band 回测；或改为只加宽区间 + caveat、不动点估计。

---

## ✅ 实际落地：同一代码路径上的一组真 bug（2026-07-24）

**1. 单调性护栏在守一份生产不跑的代码（架构 agent，MUST）**
`counselor-engine.service.ts` 曾有私有 `resolveAnchor`/`lookupCdsBand`/`isotonicBandRate`
与 `AnchorResolverService` 重复，靠 `@Optional()` 三元选择。而
`counselor-engine.monotonicity.spec.ts` 注释明写 _"intentionally NOT provided"_ ——
那个防了 #319/#320/#321 三次回归的护栏**测的是生产不走的那份**。
→ 三个 spec 全部改为注入 resolver（10/10 绿，parity 由源码逐字符比对证明）→ 删私有副本
**208 行** + 传递性死掉的 6 个 helper **90 行** → 注入改为必需（缺绑定启动即失败）。

**2. tier 虚高 → 区间假装更确定（留学业务 + 架构）**
`hasSatBands` 只判 null：学校有 band 就给 tier 2 → `medium` → 更窄区间。两个漏洞：
placeholder band（1080/1320）照算；**申请者没分数时也照算**。
→ 现在要求 band 可用**且**申请者持有可比成绩。只动区间，不动点估计。

**3. ⚠️ 我在修 2 时引入了一个 BLOCK，被验收 agent 抓到**
第一版 `applicantHasComparableScore` 硬编码 `SAT|ACT`，但 `testBandMultiplier`
**确实**把 IB / A-Level / **高考**折算成等效 SAT 去读 band —— 我把这三类考生
错误降级成 low confidence、区间宽 55%，**伤的正是核心国际生群体**。
→ 抽出 `BAND_COMPARABLE_TEST_TYPES` + `hasBandComparableScore()` 作为单一来源，两处共用。

**4. 溯源字符串在说谎且用户可见** — 旧串暗示 band 进了锚点；且它经
`sourceSummary` / `factors[0].detail` 直接渲染给用户。改为 `scorecard admit rate, test bands applied`。

**5. ACT 越界** — `act * 45` 无 clamp，ACT 36 → 1620。**这不是 no-op**：sat75 ∈ [1551,1570]
且无 ACT band 的学校，满分 ACT 的 test 轴倍率 1.5→1.2。修前满分 ACT 能压过满分 SAT。

**6. policy version bump** → `counselor-cold-start-v1.9-honest-tier`。
理由：点估计确实变了（5）；Redis cache key 含 version，不 bump 会让新旧缓存吐不同区间；
`ruleVersion` 是 replay 指纹，served 变了指纹不变会静默腐坏审计链。

**测试**：`anchor-resolver.service.spec.ts` 新增 tier 真值表 10 条
（含 IB/A-Level/高考 → tier 2 三行，正是抓住 bug 3 的那几条）+ anchorSource 契约。
827 项预测测试全过，knip clean，门禁全绿。

---

## 5. 🟡 CDS 数据源落后一个申请季

代码注释引用 CDS **2023-24** / **2024-25**：
`counselor-modifiers.ts:1050`、`:1313`、`:1439`。

CDS **2025-26** 已发布（Duke、Georgia Tech、UCSD、BU、Iowa 等）。

州内/州外比、国际生比、ED 倍率本身是 2026-05-31 那轮 48-flagship 审计定的，数字没问题，
只是底层 CDS 该滚一版。

## ❌ 判定：N_A —— 不该做（两个 agent 一致，2026-07-24）

**行号是我自己撞歪的**：`:1050/:1313/:1439` 在 §1 落地前完全命中，是 §1 给
`testBandMultiplier` 加的 36 行把它们推到了 `:1086/:1349/:1475`。

**否决理由**（按权重）：

1. **`:1086` 那条 "CDS 2023-24 / NC 2.2" 是死注释** —— 它描述的六州旧表已在 2026-05-31
   被 48-flagship 新表取代（实际 `NC: 2.5`，且 FL/MI 根本不是 key）。滚它＝更新一段
   描述已删常数的散文。
2. **这张表对本平台核心用户永不触发** —— `counselor-modifiers.ts` 里
   `if (profile.isInternational) return NEUTRAL`，整张州表对国际申请者无效。
3. **要紧的那半滚不动** —— CDS 2025-26 现约半数院校发布，早发的是公立
   （GT/UCSD/Iowa/BU），晚发/不发的正是校准 intl 常数的顶尖私立。
   方向完全反了。
4. **等错了版本** —— CDS 2025-26 = fall 2025 = 强制标化浪潮**前**的最后一版。
   现在滚＝买一个即将断裂的序列的最后一年。该等的是 **CDS 2026-27**（约 2026-12 起发布）。
5. **年际位移小于噪声** —— 硬编码的是**比值**，分母 `acceptanceRate` 每周从 DB 刷新；
   比值本身由立法/董事会周期决定（州外招生法定上限、top-6% 自动录取），
   ±0.05–0.15 过不了 clamp + geomean + 有下限的区间。
   最硬的证据：同一个 NC 注释 2.2 / 常数 2.5 的矛盾在 prod 跑了两个月无事。
6. 两组 elite intl 常数各自只建立在 **n=3** 学校上，逐年重算是 noise-chasing。

**我原文写的 "走 /closure-update" 也是错配**：该 skill 驱动 `ClosureTarget` 数据库工作队列，
**触不到 TypeScript 常数 map**；仓库里不存在能再生这三处常数的管线。

### ✅ 实际落地：只修注释（2026-07-24）

重写 `counselor-modifiers.ts` 的 `STATE_IN_STATE_OVER_OVERALL` JSDoc —— 删掉那段复述
旧表的散文（正是产生这张工单的陷阱），指向 map 自身的行内注释作为单一来源，
并写明这些值该按政策周期而非 CDS 周期刷新。**数字一个没动。**

**重评时点**：2027 Q1–Q2，CDS 2026-27 有实质覆盖后，跑
`apps/api/scripts/audit-fallback-calibration.ts` 重新验证，而不是"滚一版"。
提前触发条件只有一类：某州/某校政策变更公告。

---

## 6. 🟢 死代码：`packages/shared/src/scoring/ml/`

6 个文件，只有 `metrics.ts` 活着：

- `computeAucRoc` ← `prediction/prediction-policy-shadow.service.ts:191`
- `brierScore` ← `prediction/prediction-reporting.service.ts:996`

另外 4 个 —— `logistic-regression.ts` / `gbdt-inference.ts` / `beta-calibration.ts` /
`explainer.ts` —— 全仓库无消费者，是 2026-05-07 删除 v5 ML 路径后的残留。
`packages/shared/vitest.config.ts:9` 自己写着 "scoring/ml/* is orphaned dead code"，
但 `scoring/index.ts:8` 还在 `export * from './ml'` 对外暴露。

**修法 — 已完成 2026-07-24**

删除前先做了全仓库消费者扫描（26 个导出名 × api/web/mobile/scripts，排除 `dist/`），
结果 0 命中。**但 `metrics.ts` 有一条依赖边**：`computeFeatureImportance()` 从
`logistic-regression` 引入 `TrainedModel` 类型 —— 这就是"整目录删"会炸的地方。
该函数本身也无消费者，随 4 个文件一并删除，依赖边才断得干净。

- 删 `logistic-regression.ts` / `gbdt-inference.ts` / `beta-calibration.ts` / `explainer.ts`
- `metrics.ts` 移除 `computeFeatureImportance` + `FeatureImportance` + `TrainedModel` import
- `ml/index.ts` 收窄为只导出 `./metrics`

**顺带关掉一个假豁免**：`vitest.config.ts` 把 `src/scoring/ml/**` 排除在覆盖率外，
理由写的是 "orphaned dead code, no live importer" —— 对 `metrics.ts` 而言这句是**假的**
（`computeAucRoc` 被 `prediction-policy-shadow`、`computeBrierScore` 被 `prediction-reporting` 在用）。
死文件删掉后这条豁免没有理由了，遂解除，并补 `metrics.test.ts` 19 条测试覆盖全部 7 个导出。

覆盖率：`metrics.ts` 96/91/100/100；shared 全局 92.4/82.1/96.6/93.8，
ratchet `✅ hold the line`；knip 无输出。396 项 shared 测试全过（+19）。

**没做**：`computeAccuracy` / `computeCalibrationCurve` / `computePSI` 目前无消费者，
但已被测试覆盖、无跨文件依赖、且正是 #4/#5 校准工作会用到的东西 —— 保留。要一并删说一声。

---

## 8. 🔴 数据源优先级倒挂 —— 一把上了膛的枪

> 本项**不在原审计里**。它是审 #5 时由 agent 发现的，且在验证过程中我原本立的
> 「比值分子/分母刷新不对称」命题**被证伪**。两件事一起记在这里。

### ❌ 先记我被证伪的那条

我原以为：分母 `acceptanceRate` 每周由 cron 从 Scorecard 刷新，分子（intl/inState/oos/ed 各率）
是 2026-05-31 一次性 seed 永不刷新 → 比值每周静默上漂 → 系统性过度乐观。

**测试 agent 用实证拆掉了它**：

1. **被点名的 cron 在 prod 是死的** —— `syncSchoolsFromScorecard()` 在无
   `COLLEGE_SCORECARD_API_KEY` 时立刻 throw；而 `ci.yml` 里该 key 出现 **0 次**，
   且 `--set-env-vars` / `--set-secrets` 是**替换**语义。每周 throw 一次，零写入。
2. **唯一免 key 的路径也在空转** —— `UrbanInstituteDataService` 的
   `targetYear = 当前年 - 1 = 2025`，agent 实际调了该 API：2025 返回 `count: 0`
   （IPEDS 2025 招生数据要到 2027 才发布）；且 `ipedsId` 覆盖 0/243。
3. **数学上大部分自相抵消** —— Tier 2/3 锚点就是 `acceptanceRate`，而
   `p = anchor × product`。intl 修正 = `intlRate / A`，于是 `p = A × (intlRate/A) = intlRate`，
   **分母精确约掉**。agent 在 243 校真实 payload 上算了弹性：单修正原型
   **80–98% 精确抵消，弹性 0**。
4. **clamp 生效处符号相反** —— 弹性 +1，分母下降使预测**变保守**，不是变乐观。
5. **方向当下也是反的** —— 分子是 closure-v2 网核的 CDS 2023-25，分母若来自
   Scorecard 则滞后约 2 年，今天刷新分母是在**缩小**错配。

### ✅ 真正的 bug（更干净、更严重）

`school-data-merger.ts` 的 `SOURCE_PRIORITY` **与它上方枚举声明的意图完全相反**。
枚举注释写着「优先级从高到低」并把 `MANUAL_ADMIN` / `SEED` 排在最前，
而表里 `COLLEGE_SCORECARD: 1`（最高）、`MANUAL_ADMIN: 4`、`SEED: 5`。

更糟的是 closure-v2 那条链：
closure-v2 的 provenance 条目没有 `source` 字段 → `deriveProvenanceSource` 把它
映射成 `'CLOSURE_V2'` → **不是 `DataSource` 枚举成员** → `SOURCE_PRIORITY[...] ?? 99`
→ 判断 `incomingPriority > existingPriority` 即 `1 > 99` 为 **false**
→ **直接放行覆盖**。

**即：所有自动源压过所有人工核验值，而人工核验值毫无抵抗力。**
`MERGEABLE_FIELDS` 包含 `acceptanceRate` —— **预测锚点本身**。

**引信**：只要有人给 prod 补上 `COLLEGE_SCORECARD_API_KEY`，第一次月度 cron
就会把 2026-05-31 那次 41-agent 审计（~20 个 anchor，含 SJSU 84.61 / Hawaii 86.6 /
CU Boulder 80.5）整体静默回退到滞后约两年的值。**没有任何测试会响。**

### 修法 — 已完成 2026-07-24

- `SOURCE_PRIORITY` 改回与枚举声明一致的意图：
  `CLOSURE_V2(1) < MANUAL_ADMIN(2) < SEED(3) < COLLEGE_SCORECARD(4) < …`
  排序原则：**读学校自己发布的一手来源，优先于批量联邦聚合器**。
- 显式加入 `CLOSURE_V2_SOURCE`，它不再落到兜底。
- `?? 99` → `?? UNKNOWN_SOURCE_PRIORITY (=1)`，**未知来源改为 fail-safe 保护**。
  理由：未知来源更可能是这张表还没跟上的新管线（closure-v2 就是这么被冲掉的），
  而不是垃圾数据。既有的 staleness 阀门（>1 年可覆盖）仍然打开，所以是保护不是冻结。
- 新增 `school-data-merger.spec.ts` 6 条：closure-v2 / admin / seed / 未知来源
  四类都不得被 Scorecard 回退；stale 后仍可覆盖（证明不是冻结）；高优先级仍可覆盖低的。
  **不需要 DB、不需要 seed、不需要网络** —— 这是它能落地的关键。

232 项 school 模块测试全过。

### 顺带（agent 发现，未处理，建议单开）

- `school-provenance.scheduler.ts` 精心算出的 `staleScorecardSchools` 集合
  **只被用来取 `.size` 当批量大小**，`syncSchoolsFromScorecard(limit)` 不接受 school id
  —— 「刷新陈旧学校」实际刷的是 Scorecard 第 0 页起的任意 N 条。
- 两个 `@Cron` 都没有 Redis single-flight 锁，违反 #448/#450 的规则。
  目前无害仅因为工作本身是 no-op。
- `refreshStaleOfficialFields` 没有 try/catch，每周产生一次未捕获 rejection。

---

## 12. 🔴 REQUIRED 对 IB / A-Level / 高考考生未生效

> 由 #11 的调查翻出（#11 本身被实测证伪、已关闭）。

**问题**：`BAND_COMPARABLE_TEST_TYPES` 同时回答了两个不同的问题：

| 问题                         | IB / A-Level / 高考                             |
| ---------------------------- | ----------------------------------------------- |
| 能否折算去比 SAT band？      | **能** —— 合理                                  |
| 能否**满足该校的标化要求**？ | 在 Harvard / MIT / Georgia Tech / Yale **不能** |

代码用同一个集合回答两者。于是一个 A-Level 考生、无 SAT、申请 Harvard（#7 已标 REQUIRED）：
`bestEquivSat != null` → **跳过 REQUIRED 分支** → 走 band 比较 → **×1.2，文案
「typical of admitted students」**。

**最刺眼的证据在仓库内部**：`seed-testing-policy-2026-07-25.ts` 里 Yale 的 note 写着
「2026-05-27 起 AP/IB 不再替代」，而引擎正把 IB 当作满足了 Yale 的要求。
**数据的证据和引擎的行为直接矛盾。** 命中 #7 落值的全部 10 所 REQUIRED × 本平台核心用户群。

**修法 — 已完成 2026-07-25**

`capSubstituteAtRequiredSchool()`：在 `testingPolicy === 'REQUIRED'` 且申请者**没有真实
SAT/ACT** 时，band 比较的结果**封顶到 1.0**，并在 evidence 里说明该校要求 SAT/ACT、
所持成绩是替代品、可能不满足要求。

**刻意不做的事 —— 这是本项的设计核心**：
不引入任何惩罚系数。判定「IB 45 在 Harvard 值 ×0.6 还是 ×0.3」正是
`feedback_do_not_tune_coefficients` 在 n=1076 下禁止的 per-axis 调参，而且诚实的答案
**逐校不同**（Harvard / MIT / Caltech 保留 exceptional-cases 条款，Yale / Georgia Tech 没有）。
所以只消除**假阳性**：不给加成、不宣称「典型」、把不确定性说出来。
量级问题需要逐校 accepted-test 数据，见任务 #12 的后续。

标了 `ponytail:` 注释写明天花板：真正符合 exceptional-cases 条款的申请者也会被封到中性，
略微低估；升级路径是 per-school `acceptedTestTypes`。

**测试**：6 条 —— IB/A-Level/高考三种替代品在 REQUIRED 校不得拿加成；真实 SAT 在同校不受影响；
同一 IB 在 OPTIONAL 校不受影响；**弱替代品的既有惩罚必须保留**（防止封顶变成意外的地板）。

**policy version** → `counselor-cold-start-v1.10-substitute-cap`（点估计确实变了，
且 Redis cache key 含 version）。3740 项 API 测试全过。

---

## 附：小 bug

`counselor-modifiers.ts:581` — `considerScore(act * 45, …)`：

- SAT 路径 clamp 到 1600，ACT 路径没有 → ACT 36 × 45 = **1620**，越界
- `×45` 是线性近似，College Board 实际 concordance 非线性
  （ACT 20 ≈ SAT 1030，线性算法给 900，低分段偏差很大）

### ✅ 已修（2026-07-26）—— 两步，第二步隔了两天

越界 clamp 当天就补了（`Math.min(1600, act * 45)`），但**线性近似留了下来**，
只是不再越界。也就是说当时只修掉了看得见的那一半。

换成官方表之后重新量，偏差比这里记的还大 —— 上面「ACT 20 ≈ 1030」是凭记忆写的，
官方值是 **1040**：

| ACT | 线性 ×45         | 2018 官方 Table A2 | 偏差     |
| --- | ---------------- | ------------------ | -------- |
| 36  | 1600（clamp 后） | 1590               | +10      |
| 30  | 1350             | 1370               | −20      |
| 26  | 1170             | 1240               | **−70**  |
| 24  | 1080             | 1180               | **−100** |
| 20  | 900              | 1040               | **−140** |
| 16  | 720              | 890                | **−170** |

单向偏低，且越往下越大 —— 中低分段 ACT 考生被系统性地放在了自己真实位置之下。
与 §3 的 TOEFL `score / max` 同一类错误：用一条直线代替一张已发布的表。

修法：`actToEquivalentSat()` 直接查 2018 ACT/SAT Concordance Table A2
（ACT 与 College Board 联合发布，覆盖 ACT 9–36，9 以下返回表的下界而不外推）。
表的 28 行全部写进测试逐个钉住，另加单调性、边界、以及一条"不得再退回线性"的回归守卫。

数字来源不是记忆 —— 是从 ACT 官网 PDF 里读出来的：
<https://www.act.org/content/dam/act/unsecured/documents/ACT-SAT-Concordance-Tables.pdf>

`COUNSELOR_RULE_VERSION` → `counselor-cold-start-v1.11-act-concordance`。
外键无需迁移：`ensureCounselorPolicyVersion()` 以该常量为 key upsert，首次持久化自动建行。
gold set 里没有 ACT 考生（testScores 只有 SAT），所以 gold 基线不动。

> **2026-08-02 更新**：v1.10（substitute-cap）和 v1.11（本节的 ACT 换算表）分别落在
> 两条分支上，合并后的引擎第一次同时带上两者，因此版本号改为
> `counselor-cold-start-v1.12-substitute-cap-act-concordance`。沿用任何一个父版本号
> 都会让 served trace 谎报引擎身份 —— 两者的点估计并不相同。

---

## 来源

- [College Transitions — 回归标化的名校名单](https://www.collegetransitions.com/blog/top-colleges-rolling-back-test-optional-policies/)
- [CollegeHelpGuide — 公立系统退出 test-optional](https://www.collegehelpguide.com/blog/public-universities-dropping-test-optional-2026-2027/)
- [Morph — OpenAI 2026 全量价格表](https://www.morphllm.com/openai-api-pricing)
- [OpenRouter — GPT-5.4 Mini 规格](https://openrouter.ai/openai/gpt-5.4-mini)
- [Galvanize — DET / IELTS / TOEFL 换算](https://galvanizetestprep.com/blogs/duolingo-score-chart-ielts-toefl-conversion-guide/)
- [South Shore — test-optional 时代 SAT 均分的误导性](https://highambition.org/2025/01/19/the-misleading-nature-of-college-average-sat-and-act-scores-in-the-test-optional-era/)
- [Georgia Tech CDS 2025-26](https://irp.gatech.edu/node/152)

---

## 11. ⬜ 扩 `TestingPolicy` 枚举 —— 判定 N_A，已关闭

#7 留下 9 所 UNKNOWN，看起来是枚举表达力不足（缺 `FLEXIBLE`、缺「按生源地分档」）。
两个 agent 独立否决，其中架构 agent 跑了**实测矩阵**：

| profile     | REQUIRED | OPTIONAL | UNKNOWN   | FLEXIBLE(假想) |
| ----------- | -------- | -------- | --------- | -------------- |
| IB 45       | 1.200    | 1.200    | **1.200** | **1.200**      |
| A-Level 168 | 1.000    | 1.000    | **1.000** | **1.000**      |
| 高考 680    | 1.000    | 1.000    | **1.000** | **1.000**      |
| AP only     | 0.100    | 0.850    | **0.850** | **0.850**      |

`FLEXIBLE` 与 `UNKNOWN` **逐格相同** —— 因为 `testingPolicy` 只在申请者五种
band-comparable 考试全无时才被读到。光加枚举值不写新分支 = **纯 no-op**。

即使配上新分支，唯一变化的画像是 AP-only：CMU **+1.75pp**、Dartmouth **+0.81pp**，
而两校服务给用户的区间宽度是 **16.0pp / 8.1pp** —— 位移是区间的 5–11%，
完全埋在里面。这与 §4 被四个 agent 否掉的理由同构。Miami 的 delta **严格为 0**。

**代价**：enum migration + 该 union 类型在仓库里**被手抄 18 份** + **7 处 `as any`**
（typecheck 抓不到）+ 4 个动态解析的 i18n 面（`check-missing-keys` 也抓不到，
用户会看到裸 key）。

**业务侧补充**：test-flexible 是**收缩中**的品类 —— 发明者 Yale 2026-05-27 刚放弃。
而 AP-only 在中国申请者里主要意味着「档案未完成」而非「flexible 申请者」
（AP 轨学生几乎必考 SAT），所以 `FLEXIBLE` 会主要在未完成档案上触发，且触发错误行为。

**已落地**：`counselor-modifiers.ts` 在 `BAND_COMPARABLE_TEST_TYPES` 旁钉了
`ponytail:` 警告 —— **不要把 `AP` 加进去**（会让 AP-only 在 Georgia Tech / Harvard
拿到 band 比较，把 §1 修掉的过度乐观放回去；且 AP↔SAT 无官方 concordance）。
seed 文件头改正了原先的错误结论并附上实测矩阵。

**重评条件**：只有当 per-school `acceptedTestTypes`（§12 的后续）落地后，
枚举问题才可能重新变得相关 —— 届时也很可能是被那份数据取代，而不是被枚举解决。

---

## 9. 🟠 16 条不变量 sweep 不在 CI —— 已接入

**问题**：`apps/api/scripts/run-counselor-invariants.ts` 是唯一能抓「某次改动把预测抬得
过高」的仪器（gold / calibration 钉的是具体点，它钉的是**形状**：单调性、支配性、
轮次序、hook 方向、确定性、clamp 边界）。但它不在 CI，只靠有人记得本地跑 —— 而本产品
零用户，没有任何人工发现渠道。

**排除它的理由是**：gate DB seed 不完整 → tier-crossing 伪阳性（3.8 GPA 匹配到孤立的低
Tier-1 band，反而低于落到 Tier-2 的 3.5）。

**这个理由在 seed 序列变更后从未被重新测量。**

**实测（2026-07-25）**：忠实复现该 job 自己的建库序列
（`migrate deploy` → `db seed` → closure overlay → EA/ED2 backfill → 5 个修正 seed）：

```
Population: 241 US schools (13 portfolio exempt) | 219 w/ SAT bands
16/16 PASS   Total checks: 9,342 | Violations: 0
```

**根因**：那个伪阳性需要**部分** band 覆盖才会发生，而 gate DB 的
`SchoolCdsAdmitBand` 是 **0 行** —— 根本没有 Tier-1 可以跨进去。
**排除它是在为一个并不存在的条件付出真实的覆盖代价。**

顺带端到端验证了 §1 的 seed：gate 形态下 `🎯 Testing policy: updated 50 school row(s)`，
分布 `REQUIRED:19 OPTIONAL:45 BLIND:9 UNKNOWN:168`。

**已接入**：`ci.yml` 的 prediction-gate job，位置在 5 个修正 seed 之后、
`Verify prediction launch reports` 之前。脚本 exit 2 即 fail。

**那句"若加了 band seeding 必须重新测量"——我当场测掉了，答案是不成立。**

把 `cds-admit-bands.json`（38 条 / 9 所 UC）加载进同一个库，sweep **立刻变红：
6 处 violation，全部 UC Merced**（I2 单调性 / I4 支配性 / I16 国际生）。

根因：那 9 所里 **7 所有完整的 5 档 ladder，Berkeley 和 Merced 只有 `3.75-4.00` 一档**。
GPA 4.0 命中那唯一一档 → Tier-1 anchor 0.88；GPA 3.5 无档命中 → 落到 Tier-2 =
学校总录取率 ~0.89。**更强的申请者预测更低。**
`isotonicBandRate` 修不了 —— 它只能拿同 ladder 的**更低档**往上夹，而这里没有更低档。
Berkeley 形状相同但不倒挂：它总录取率 ~11% 远低于顶档。

### 根因：夹具数据混进了生产 payload（已修 2026-07-25）

`build-cds-admit-bands.ts` 把**两个**文件合成生产 payload：

```
scripts/cds-bands-uc-system.json  ← 真实 UC Information Center 数据（35 条 / 7 所，ladder 完整）
scripts/seed-cds-fixture.json     ← 启动用的 FIXTURE（3 条 / Merced + Berkeley，只有顶档）
```

而这个 builder 自己的注释写着 _"so we never fabricate band rows"_ ——
它读的两个文件里**有一个就是 fixture**。旁证：sourceUrl 指向学校首页而非数据页；
Berkeley 的 `sampleCount` 写 1000，而它每年约 12.5 万份申请。

**`migrate.sh` step 54 加载的正是这份合并结果**，所以 prod 有两所 UC 校区
在用测试数据做 Tier-1 锚点，其中 Merced 还因此产生了"4.0 低于 3.5"的倒挂。

fixture 的正当用途是管理员端点 `POST /cds-bands/load-fixture`
（显式触发、默认 `dryRun: true`）—— 那个不受影响。

**修法**：把 `seed-cds-fixture.json` 从 payload builder 的 `SOURCE_FILES` 里摘掉并重新生成。
38 条 / 9 所 → **35 条 / 7 所**，fixture 归零。Merced 和 Berkeley 退回 Tier-2
（用学校总录取率）—— 这是**正确**的，我们本来就没有它们的真实分档数据。

**验证**：重新加载 band 后跑 sweep → **16/16 全绿，0 violations，且 Tier-1 路径有覆盖**。

**顺带补上 gate-vs-prod 保真度缺口**：CI 的 prediction-gate 原本不加载 band
（prod 在 migrate.sh step 54 加载），整条 Tier-1 锚点路径在 CI 里从未被走到。
现在加了 `Load CDS admit bands` 步骤，#9 那个新 gate 才真正覆盖到它。

> **值得记的一课**：那条排除说明把锅甩给"gate 的数据不完整"甩了很久，
> 而问题其实在 prod 出货的 payload 里。**一个被排除的检查，没法告诉你是哪一种。**

---

## 10. 🟠 school 同步 scheduler 的三处缺陷 —— 已修

由 §8 的调查顺带发现。三处都**在正常运行时不可见**，只在 prod 咬人。

**1. 两个 `@Cron` 都没有 single-flight 锁。** Cloud Run 跑 N 个副本，每个都会触发同一个
cron。覆盖率监控那条会把一次 SLO 违约变成 **N 条 Sentry 告警**；刷新那条会 **N 倍消耗
第三方 API 配额**。违反 MEMORY.md 记的 #448/#450 规则。目前无害仅仅因为工作本身是
no-op —— 一旦补上 `COLLEGE_SCORECARD_API_KEY` 就会放大。

**2. 刷新任务没有 try/catch。** `syncSchoolsFromScorecard()` 在无 API key 时**直接
throw**（prod 当前正是如此），而调用点没有保护 → 每周一产生一次未捕获 rejection，
**并且让 IPEDS 那一半永远不会执行**。同文件的 `syncCollegeScorecard` 反而有 try/catch。

**3. 精心算出的 stale 集合只被用来取 `.size`。**
`syncSchoolsFromScorecard(limit)` / `syncAll(year, limit)` **都不接受 school id**，
它们从 API 第 0 页开始拉前 N 条。所以 `staleScorecardSchools.size` 作为 limit 传进去，
读起来像「刷新这些陈旧学校」，实际只是决定了**拉多少所任意学校** ——
一次发现 3 所陈旧的运行，会去刷新 API 的前 3 所，而那几乎必然不是那 3 所。

**修法 — 已完成 2026-07-25**

- 两个 cron 都接 `runWithCronLock`（复用仓库既有助手）。新增两个 TTL 常量：
  覆盖率监控 10 分钟；刷新任务 **1 小时** —— 它要打外部批量 API，
  窗口必须能舒服地覆盖一次慢同步。
- 两个 sync **各自独立 try/catch**，一个死源不能拖垮另一个。
- `.size` 换成显式的 `BULK_REFRESH_BATCH = 500`，并标 `ponytail:` 注释写明
  这是因为两个 sync 都无法定向、以及升级路径（让它们接受 school-id 列表）。
  同时**把陈旧学校的 id 打进日志** —— sync 既然定向不了，这就是唯一能让人
  实际行动的记录，否则这个任务只报一个没人能用的计数。

**测试**：`school-provenance.scheduler.spec.ts` 7 条 —— 锁被占则两个 cron 都不执行；
拿到锁则执行；Scorecard 失败不得阻断 IPEDS；IPEDS 失败不得抛出；只看 OFFICIAL 层级；
无陈旧字段时不调用任何 sync。3747 项 API 测试全过。

---

## 13. 🟠 `TestingPolicy` union SSOT 断裂 —— 已收敛

由 §11 的架构 agent 发现，是任何未来枚举变更的**前置条件**。

**问题**：`'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN'` 在仓库里**被手抄 18 份**
（shared / api / web 三层），没有一份与它们所描述的 Prisma `TestingPolicy` 枚举相连。
另有 **7 处 `as any` 读取**，typecheck 对它们完全不可见。

**为什么这特别危险**：i18n 是**动态取 key** 的（`testingPolicyT(school.testingPolicy)`），
所以 `check-missing-keys.ts` 抓不到 —— 枚举一旦漂移，前端表现是**用户看到裸 key**。
也就是说这个 SSOT 断裂的失败模式是静默且用户可见的。

**修法 — 已完成 2026-07-25**

- `packages/shared/src/types/prediction.ts` 的 `SchoolTestingPolicy` 作为唯一定义，
  改为从 `SCHOOL_TESTING_POLICIES` 常量数组派生（数组导出是为了让守卫能在**运行时**比对）。
- **18 处手抄全部替换为引用它** → 现在剩 0 处。顺带发现 `ai.types.ts` 在做一层
  没必要的再导出，两个消费者改为直接指向源头。
- **7 处 `as any` 全部拆除**。拆完 typecheck **直接通过** —— 说明那些 cast 一直
  纯粹是在蒙眼，类型本来就是对的。同时把 `SchoolMetrics.testingPolicy` 从
  `string` 收紧为 `SchoolTestingPolicy`。
- **漂移守卫** `testing-policy-ssot.spec.ts`：运行时断言 shared 的数组与
  `Object.keys(TestingPolicy)` 完全一致（Prisma 是权威，shared 跟随）；
  外加一条类型层断言（枚举多出成员时**编译就断**，比运行时更早）；
  以及一条钉住 `UNKNOWN` 必须存在 —— 它是列默认值且在本代码库里有确切语义
  （"已知未记录"而非"忘了填"），改名或删除会静默改变每一所未回填学校的算分。

3750 项 API 测试 + 399 项 shared 测试全过，web typecheck 通过。
