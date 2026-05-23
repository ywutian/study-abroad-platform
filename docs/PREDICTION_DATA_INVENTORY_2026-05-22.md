# 现有数据深挖报告 — 2026-05-22

> 在写 M3 引擎之前的实测数据全景。**我之前的认知有多处错误**，这份报告纠正。

---

## 🎯 核心结论：你的 DB 比我以为的丰富 5-10 倍

我之前一直说"数据稀缺"。**真相**：240 个学校的核心字段大部分已经有真实数据。我今晚跑 CDS WebSearch 大部分是**重复劳动**。

---

## 1. School 主表（240 行）— 真实字段覆盖

| 字段                                 | 覆盖               | 状态                                      |
| ------------------------------------ | ------------------ | ----------------------------------------- |
| `acceptanceRate`                     | **240/240 (100%)** | ✅ 全                                     |
| `usNewsRank`                         | **240/240 (100%)** | ✅ 全                                     |
| `sat25 / sat75`                      | **226/240 (94%)**  | ✅ 我今晚 WebSearch 只多收了 22 校 = 重复 |
| `act25 / act75`                      | **240/240 (100%)** | ✅ 全                                     |
| `satAvg / actAvg`                    | **240/240**        | ✅                                        |
| `gpaDistribution` (JSON)             | **182/240 (76%)**  | ✅ 已存在！我以为"3/23"是错的             |
| `intlAcceptanceRate`                 | **185/240 (77%)**  | ✅                                        |
| `intlStudentPct`                     | **240/240**        | ✅                                        |
| `oosAcceptanceRate`                  | 129/240 (54%)      | 🟡 中等                                   |
| `edAcceptanceRate`                   | 68/240 (28%)       | 🟡 **稀疏 — 我今晚补的有价值**            |
| `eaAcceptanceRate`                   | 21/240 (9%)        | 🔴 **极稀疏 — 我今晚的关键贡献**          |
| `needBlindInternational`             | 63/240             | 🟡                                        |
| `testingPolicy` / `hasEarlyDecision` | 240/240            | ✅                                        |

**结论**：我今晚 WebSearch **唯一真有价值的**是 ED/EA rate 补完，其他字段 DB 已经有了。

---

## 2. SchoolProgram (1,788 行) — 我之前完全没看到

| 内容                            | 数字                   |
| ------------------------------- | ---------------------- |
| 总行数                          | **1,788**              |
| `acceptanceRateEstimate` 填充率 | **1,788/1,788 (100%)** |
| 覆盖学校数                      | **240**                |
| 覆盖 CIP code                   | **128** 个专业代码     |

**这是 per-school per-major admit rate 完整数据**！例如 Stanford CS / MIT EE / Harvard Bio 都有专属 admit rate。

我今晚 plan 里说"major selectivity 极少 — 仅 4 校 CS"。**完全错**。**DB 有 240 × 7-13 program 的完整数据**。

样例：

```
Stanford Architecture (04.0901): 7.75% admit, competitiveness 5
Stanford Arts/Humanities (24.0101): 25.28%, competitiveness 3
Stanford Business/Mgmt (52.0101): 4.55%, competitiveness 5
```

**M3 引擎 major selectivity 维度可以直接查这张表**。

---

## 3. HighSchool (165 行) — 我之前以为 "数据稀缺"

实际字段覆盖：
| 字段 | 覆盖 |
|---|---|
| `tier` | ~大多数 |
| `recognition` | ~大多数 |
| `academicRigor` | ~大多数 |
| `placementRecord` | ~大多数 |
| `qualityScore` | **164/165 (99%)** |
| `curriculumSystem` | **164/165** |
| 中国 HS (`cnHsCategory`) | **82** 所 |
| `annualTop30Count` | 0 (未填) |

**结论**：HS context 维度也已经有数据。我之前说"完全没有"是错的。

---

## 4. Activity (69) + Award (63) + TestScore (253) — 用户侧数据

样例（alice.zhang@demo — 4 v3 case 的同一个用户）：

- **30 个 Activity**（含 category / role / hoursPerWeek / 完整结构）
- **30 个 Award**（含 level enum: NATIONAL / INTERNATIONAL / REGIONAL）
- **39 个 TestScore**

字段质量：高。

样例 Award：

```
USACO Platinum Division — level=NATIONAL, year=2025
NOIP First Prize — level=NATIONAL, year=2024
Intel ISEF Finalist — level=INTERNATIONAL, year=2025
```

样例 Activity：

```
AI for Education Research Project — RESEARCH, Lead Researcher, 15hr/wk × 40wk
School Programming Club — ACADEMIC, President & Founder, 10hr/wk
Rural Education Volunteer — COMMUNITY_SERVICE, Program Director
```

**结论**：student-side activity/award 数据**已经在 DB 里**，结构化、有 enum level，可直接用作 Bayesian update 的 student-side score。

---

## 5. Profile 字段（169 profiles，41 有 GPA）

字段完整度：

- gpa, gpaScale, gpaByGrade (g9/10/11/12)
- targetMajor, intendedMajor, secondMajor
- applicationRound, applicationCycleYear
- nationality, countryOfResidence, citizenship
- **legacy (array of school names!)** — 比 boolean 强
- firstGeneration (boolean)
- **recruitedAthlete + recruitedSport + recruitedDivision + recruitedCoachStatus** — 含 verification 状态！
- urmStatus, applyingTestOptional
- mbti, personalityTags
- stateOfResidence, applicantType
- highSchoolId (FK)

**结论**：Profile 字段比我以为的丰富多 — `recruitedCoachStatus` 已经能区分 verified vs unverified athlete。

---

## 6. SchoolMetric (447) — 另一份独立 metric 数据

```
avg_sat              : 92 schools
international_rate   : 92 schools
yield_rate           : 92 schools (新！我没见过 yield 数据)
acceptance_rate      : 92 schools
ed_acceptance_rate   : 53 schools
ea_acceptance_rate   : 16 schools
cs_rank              : 10 schools
```

**结论**：另一个 metric source，跟 School / SchoolHistoricalData 并行。92 校（多数 top 校）有 yield rate — 这是 enrollment management 的重要信号。

---

## 7. SchoolHistoricalData (60,440 行) — 假数据多

我之前以为这是金矿。**真相**：大部分是 placeholder shell。

年份 2024 真实 vs placeholder：
| 字段 | Real values | Placeholder |
|---|---|---|
| edAcceptanceRate | **46/240 (19%)** | 194 |
| acceptanceRate | 23/240 (10%) | 217 |
| satAvg | 23/240 (10%) | 217 |
| intlAcceptanceRate | 23/240 (10%) | 217 |
| rankings | 12/240 | 228 |
| cdsAdmitBands | **9/240** | 231 (= 9 UC schools) |
| eaAcceptanceRate | 5/240 | 235 |
| sat25 / sat75 / act25/75 | **0** | 240 |
| gpaDistribution | **0** | 240 |
| 其他 30+ 字段 | **0** | 240 |

**所有 placeholder 都标 LOW confidence + `"no_historical_value_in_local_db_or_cached_source_registry_after_enrichment_pass"`**。

**结论**：SchoolHistoricalData 是一个**全字段全年份的 ledger 结构**，但只有 acceptance rate / ED rate / intl rate / 部分 CDS bands 真实填了。**真实数据反而是 School 主表更全**（226 SAT vs 0 SAT 在 SHD）。

---

## 8. 录取结果数据

| 来源                                              | 数量           | 性质                                   |
| ------------------------------------------------- | -------------- | -------------------------------------- |
| AdmissionCase                                     | 99 (77 binary) | **peer 数据**（学长学姐案例），17 学校 |
| PredictionOutcomeLabelRecord (SELF_REPORTED)      | 10             | 用户自报，无 verification              |
| PredictionOutcomeLabelRecord (COUNSELOR_VERIFIED) | **0**          | 没有                                   |
| PredictionOutcomeLabelRecord (DOCUMENT_VERIFIED)  | **0**          | 没有                                   |
| PredictionResult                                  | 476            | 当前预测，无 outcome                   |
| PredictionSnapshot                                | 951            | 历史快照                               |

**结论**：**0 verified outcome 这一条没变** — 准确性验证仍需 outcome 收集（v2 §9 升级路径）。

---

## 9. 重大发现：4 个 v3 case 是同一个用户

```
alice.zhang@demo.studyabroad.com
  - 30 activities, 30 awards, 39 test scores
  - GPA 3.95, EA, CS major
  - firstGen=false, athlete=false, legacy=[]
```

**4 个 ADMIT case 都是 Alice Zhang 一人申请不同学校的结果**。这是一个 demo "super profile"。

含义：4 v3 case 验证集**不是 4 个独立学生**，是 **1 个超强学生 × 4 学校**的样本。统计上更弱。

---

## 10. 我之前对数据的认知错误 — 全清单

| 我之前说的                   | 真相                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| "只有 9 UC 有 CDS bands"     | DB 主表 226/240 有 SAT，182/240 有 GPA distribution。**够用**                                   |
| "Major selectivity 数据极少" | **SchoolProgram 1,788 行**, 100% 有 admit rate                                                  |
| "HS context 数据稀缺"        | HighSchool 165 行，qualityScore 99% 覆盖                                                        |
| "Hook % schema 无字段"       | School 表确实没有，但 Profile.recruitedCoachStatus 有                                           |
| "ED/EA rate 多数学校未公布"  | School.edAcceptanceRate 68/240, School.eaAcceptanceRate 21/240 — **稀疏但有**；我今晚补了 23 校 |
| "Yield rate 无数据"          | SchoolMetric.yield_rate 92 校有                                                                 |
| "Forum/Hall 数据无用"        | ForumPost 48 + Comment 58 — 可能含质性 outcome 报告                                             |

---

## 11. v2 引擎实际需要的字段 vs 现有数据

| v2 维度             | 来源（首选）                                                | 来源（fallback）        | 覆盖                           |
| ------------------- | ----------------------------------------------------------- | ----------------------- | ------------------------------ |
| GPA → admit profile | `School.gpaDistribution` JSON                               | 全局先验                | **182/240** ✅                 |
| SAT → admit profile | `School.sat25/sat75`                                        | satAvg                  | **226/240** ✅                 |
| ACT                 | `School.act25/75`                                           | actAvg                  | **240/240** ✅                 |
| Round (ED/EA)       | `School.edAcceptanceRate / eaAcceptanceRate`                | 全局 fallback ×2.5      | 68/21/240 🟡 + 我今晚补 23     |
| International       | `School.intlAcceptanceRate` + `Profile.nationality`         | 全局 fallback ×0.5      | **185/240** ✅                 |
| OOS                 | `School.oosAcceptanceRate` + `Profile.stateOfResidence`     | fallback                | 129/240 🟡                     |
| Major selectivity   | `SchoolProgram.acceptanceRateEstimate`                      | `School.acceptanceRate` | **1,788 rows, 240 schools** ✅ |
| Hook: legacy        | `Profile.legacy[]` 跟 school name 比对                      | -                       | Profile 100% ✅                |
| Hook: athlete       | `Profile.recruitedAthlete` + `recruitedCoachStatus`         | -                       | Profile 100% ✅                |
| Hook: first-gen     | `Profile.firstGeneration`                                   | -                       | Profile 100% ✅                |
| HS tier             | `HighSchool.tier / qualityScore` via `Profile.highSchoolId` | 全局 fallback           | 164/165 ✅                     |
| Activities          | `Activity[]` (category, hours, role)                        | -                       | Per-profile ✅                 |
| Awards              | `Award[]` (level enum)                                      | -                       | Per-profile ✅                 |
| Test optional       | `Profile.applyingTestOptional`                              | -                       | Profile 100% ✅                |

**结论**：**M3 引擎几乎所有维度都有数据可用**，无需额外收集。

---

## 12. 对今晚 CDS 收集的复盘

| 我今晚 WebSearch 收的                           | 实际增量价值                                                   |
| ----------------------------------------------- | -------------------------------------------------------------- |
| 23 校 acceptance rate                           | 0（DB 已有 240/240）                                           |
| 23 校 SAT 25/75                                 | 微小（DB 已有 226/240）                                        |
| 23 校 GPA distribution（仅 3 校详细）           | 微小（DB 已有 182/240）                                        |
| 23 校 ED/EA rate                                | **真有价值**（DB ED 68/240, EA 21/240 — 补 ~10-15 个新数据点） |
| 4 top 校 hook % 详细                            | **有价值**（DB 没这字段，需 schema migration）                 |
| Global aggregates (NACAC, Common App baselines) | **有价值**（DB 没有跨校 baseline）                             |
| EC profile MEDIUM tier (Crimson 等)             | 部分价值（DB 有 student-side 不有 school-side）                |

**整体**：我今晚的工作约 **30% 真有价值，70% 重复 DB 已有的**。但**30% 那部分**是 v2 引擎的关键短板。

---

## 13. 修订后的 M3 实施建议

**之前计划**：先 import 我今晚收的数据 → 写 M3 引擎

**修订后**：

### 第一步：直接用 DB 现有数据写 M3

- GPA / SAT / ACT / intl / round / major / HS tier / activities / awards 全部已经在 DB
- 直接写 Bayesian engine 读这些字段 → 预测

### 第二步：补今晚收集的 30% 增量

- ED/EA 的 ~15 个新值合并进 `School.edAcceptanceRate / eaAcceptanceRate`
- Hook % 加 schema migration + import top 4 校的数据
- Global aggregates 单独存（已有 `global-admit-aggregates.json`）

### 第三步：跑预测

- 用 Alice Zhang × Stanford REA 测试
- 期望：v2 用 DB 已有数据给出合理预测（不一定是 12%，但应该 > 5% 而不是 2%）

---

## 14. 关键修订：v2 设计 §3 维度表错了

之前 v2 设计说"GPA distribution 仅 3/23 有"是基于错误数据。

**修订**：DB 已有 182/240 GPA distribution。M3 引擎可以正常用 GPA 维度做 Bayesian update。

---

## 15. 下一步建议

1. **不再做更多 CDS WebSearch** — DB 已经够丰富
2. **直接开始写 M3** — 用 DB 现有 School + Profile + SchoolProgram + HighSchool + Activity + Award 数据
3. **今晚收集的数据合并** — ED/EA 补 + hook % migration（按 WAKE-UP-CHECKLIST 跑）
4. **Outcome 收集** — 真正治本，但独立于 M3

---

## 关键修正：v2 设计文档需要更新

- ❌ 之前说"大多数学校 CDS GPA 字段 N/A" → **错**，DB 有 182/240
- ❌ 之前说"Major selectivity 极少" → **错**，SchoolProgram 1,788 行
- ❌ 之前说"HS context 数据稀缺" → **错**，HighSchool 165 + qualityScore 99%
- ✅ "0 verified outcome" → 仍然正确，需 outcome 收集
- ✅ "Hook % schema 无字段" → 正确，需 migration

**应该修订 `docs/PREDICTION_V2_DESIGN.md`** 反映这些数据真相，否则 M3 写出来会基于错误假设。
