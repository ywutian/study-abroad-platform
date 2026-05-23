# 预测系统 v2 — Bayesian Sequential Update (Data-Driven Only)

> 最后更新: 2026-05-22
> 状态: **设计稿 v2 — final**（待 review）
> 取代: [PREDICTION_THREE_LAYER_DESIGN.md](./PREDICTION_THREE_LAYER_DESIGN.md) (case retrieval — rejected)、[PREDICTION_DIMENSION_SPEC.md](./PREDICTION_DIMENSION_SPEC.md) (heuristic 系数 — rejected)
> 关联: [PREDICTION_BENCHMARK.md](./PREDICTION_BENCHMARK.md) · ADR-0017 (TODO)

## 0. TL;DR

把规则公式换成 **Bayesian 序列更新**：以 `school.overallAdmitRate` 为先验，对每个有公开学校数据 (CDS / 学校 publication) 的 profile 维度做一次 Bayes 更新得到后验概率。**没有公开数据锚点的 profile 维度不进概率，仅作 diagnostics 给 counselor**。

无手编系数、无文献先验、无 case lookup。每个数字可追溯到学校官方 publication。

```
p₀ = school.overallAdmitRate
FOR each profile dimension d where school has public data anchor:
    p = bayesian_update(p, profile.d, school.anchor[d])
return p, plus diagnostics for dimensions without anchors
```

---

## 1. 为什么 v2

| 之前的版本                                         | 被否决原因                                                   |
| -------------------------------------------------- | ------------------------------------------------------------ |
| CounselorEngine 规则公式                           | 系数手调，无方法学；anchor cap 把 Stanford 顶尖学生封顶 9.5% |
| Case-based retrieval (v1 of three-layer)           | 个体案例噪声大，单 case 暗藏不可见因素                       |
| Weighted multi-dim matching with literature priors | 16 个系数我编的，不是数据驱动                                |

**v2 原则**：每个进入概率的信号必须能追溯到一个具体的公开学校 publication 字段。其余信号作 diagnostics。

---

## 2. 架构

```
INPUT: profile, school

p ← school.overallAdmitRate

FOR each dimension d in PROFILE_DIMENSIONS:
    anchor ← lookupAnchor(school, d)         // CDS / school publication

    IF anchor exists AND profile.d is set:
        likelihood_admit = P(profile.d | admit)    // from anchor
        likelihood_apply = P(profile.d | apply)    // from anchor or estimated
        p ← bayes_update(p, likelihood_admit, likelihood_apply)
        confidence_contributions.push({d, contribution, source})
    ELSE:
        diagnostics.push({d, message: "暂无公开数据锚点" 或 "profile 数据缺失"})

p ← clamp(p, 0.02, 0.98)
confidence ← derive_from(contributions)

OUTPUT: { probability: p, confidence, contributions, diagnostics }
```

`bayes_update` 是教科书公式：

```
posterior_odds = prior_odds × likelihood_ratio
p_new = posterior_odds / (1 + posterior_odds)
```

---

## 3. 数据锚点表（每个 profile 维度的来源）

> ⚠️ **2026-05-22 修订**：基于实际 DB 深挖（[PREDICTION_DATA_INVENTORY_2026-05-22.md](./PREDICTION_DATA_INVENTORY_2026-05-22.md)），覆盖度数据已修正。之前"数据稀缺"的估计错了——DB 实际比预期丰富 5-10 倍。

### 3.1 进入概率的维度

| Profile 维度                      | 学校侧数据来源                                                        | DB 覆盖（240 校）                                     | 学生侧字段                                                                                     |
| --------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **GPA**                           | `School.gpaDistribution` (JSON) + `sat25/75` 推断                     | **182/240 (76%)**                                     | `Profile.gpa, gpaScale, gpa9/10/11/12`                                                         |
| **SAT/ACT**                       | `School.sat25 / sat75 / act25 / act75 / satAvg`                       | **226-240/240 (94-100%)**                             | `TestScore[]` (type='SAT'/'ACT')                                                               |
| **Application round**             | `School.edAcceptanceRate / eaAcceptanceRate`                          | ED 68/240, EA 21/240 (稀疏)                           | `Profile.applicationRound`                                                                     |
| **International**                 | `School.intlAcceptanceRate / intlStudentPct / needBlindInternational` | intlRate 185/240, intlPct 240, needBlind 63           | `Profile.nationality, citizenship, countryOfResidence`                                         |
| **First-generation**              | 全局 baseline (Common App: ~20% applicants)                           | DB 无字段；用 global aggregates                       | `Profile.firstGeneration`                                                                      |
| **HS class rank**                 | `School.gpaDistribution` 含 top10% 推断                               | 部分                                                  | `HighSchool.tier / qualityScore` 间接                                                          |
| **Major selectivity**             | `SchoolProgram.acceptanceRateEstimate`                                | **1,788 rows, 240 校 × 128 CIP** ✅                   | `Profile.targetMajor → CIP 映射`                                                               |
| **OOS (in-state public schools)** | `School.oosAcceptanceRate`                                            | 129/240 (54%)                                         | `Profile.stateOfResidence`                                                                     |
| **Legacy**                        | 全局 baseline + 学校 publication（Harvard/Stanford 详细）             | DB **无字段** — 需要 migration（详见 §9 升级路径）    | `Profile.legacy[]` (数组含学校名)                                                              |
| **Recruited athlete**             | 全局 baseline + 学校 publication                                      | DB **无字段**                                         | `Profile.recruitedAthlete + recruitedSport + recruitedCoachStatus`（已有 verification 状态！） |
| **HS context**                    | `HighSchool.tier / qualityScore / academicRigor / placementRecord`    | **HighSchool 164/165 (99%) qualityScore** ✅          | `Profile.highSchoolId` (FK)                                                                    |
| **TOEFL (intl)**                  | `School` 标化 + intl 门槛                                             | 部分                                                  | `TestScore` (type='TOEFL')                                                                     |
| **Test optional**                 | `School.testingPolicy` + `applyingTestOptional`                       | testingPolicy 240 + applyingTestOptional Profile 字段 | `Profile.applyingTestOptional`                                                                 |

### 3.2 进入概率但用 "tier 加权" — 数据较弱

| Profile 维度               | 学校侧来源                                                                                            | 学生侧                                                               | Bayesian weight          |
| -------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------ |
| **Activity depth (spike)** | 全局先验（T20: 80% 有 spike，Crimson 数据）+ `cds-collection-2026-05-22/school-ec-profile-top25.json` | `Activity[]` (category, hours/yr, role, isOngoing, yearsActive 推断) | LOW tier (0.5× weight)   |
| **Award level**            | 全局先验（T20: 55%+ 有 state+ honor）+ Crimson 数据                                                   | `Award[]` (level enum: INTERNATIONAL/NATIONAL/REGIONAL/SCHOOL)       | LOW tier                 |
| **AP count**               | 全局先验（T20: avg 10-14）                                                                            | `TestScore` (type='AP') count                                        | LOW tier                 |
| **GPA trend**              | counselor 共识 (rising ×1.06, falling ×0.95)                                                          | `Profile.gpa9/10/11/12` derived trend                                | LOW tier                 |
| **English (intl)**         | T20 隐性 TOEFL 100+                                                                                   | `TestScore` (type='TOEFL')                                           | LOW tier (intl 学生触发) |

### 3.3 仅 diagnostics（不进概率）

| Profile 维度                | 为什么不进概率                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Essay quality**           | 无公开 essay 评分分布。用现有 `essayQualityScore` 作 student-side signal，但无 school-side anchor → 不构成 likelihood ratio |
| **MBTI / Holland**          | 不是 admission prediction 变量；用于 major recommendation                                                                   |
| **Specific HS feeder 历史** | 没数据（`HighSchool.annualTop30Count` 字段存在但未填充）                                                                    |

**核心约束**：Diagnostics **不在 UI 上转化为隐性 modifier**。用户看到的概率数字纯来自第 3.1 + 3.2 节维度。

---

## 4. 算法细节

### 4.1 GPA / SAT 的 Bayesian update

学校公布的 admit pool GPA 分布是 25/50/75 百分位。把它当作 **学生 GPA 给定录取条件下的近似 normal 分布**：

```
admit_mu = p50, admit_sigma = (p75 - p25) / 1.349
apply_mu, apply_sigma 从学校整体 applicant pool 推
   (apply_p50 通常公布在 fact book；若无，假设 apply_mu = admit_mu - 0.1 GPA 单位)

likelihood_ratio = normal_pdf(profile.gpa | admit_mu, admit_sigma) /
                   normal_pdf(profile.gpa | apply_mu, apply_sigma)
```

### 4.2 Categorical 维度（round / intl / legacy 等）

```
likelihood_ratio = P(category | admit) / P(category | apply)

P(category | admit) = CDS published rate    (e.g., 16% admits are legacy)
P(category | apply) = either from school publication or estimated from base rates
```

### 4.3 缺失数据处理

```
IF profile.d 缺失:
    skip this dimension
    add to diagnostics: "profile 缺 d 字段"
    reduce confidence by tier

IF anchor 缺失 (学校未公布 d 的数据):
    skip this dimension
    add to diagnostics: "学校未公布 d 数据锚点"
    don't reduce confidence (这是数据问题不是用户问题)
```

### 4.4 Confidence 计算

```
confidence_score = (n_dimensions_used / n_dimensions_total_for_school) ×
                   completeness_of_profile_for_used_dimensions

confidence_tier:
    >= 0.8 → high
    [0.5, 0.8) → medium
    [0.3, 0.5) → low
    < 0.3 → very-low (UI 警告)
```

---

## 5. 输出契约

```typescript
interface PredictionOutput {
  probability: number; // 0.02 - 0.98
  tier: 'reach' | 'match' | 'safety';
  confidence: 'high' | 'medium' | 'low' | 'very-low';
  contributions: Array<{
    // 每个进入概率的维度
    dimension: string;
    profileValue: string | number;
    delta: number; // 该维度对概率的贡献 (pp)
    sourceLabel: string; // e.g., "Stanford CDS 2024 Section C-9"
  }>;
  diagnostics: Array<{
    // 没进概率的 profile 信号
    dimension: string;
    state: 'no-anchor' | 'profile-missing' | 'present-but-not-modeled';
    counselorNote?: string;
  }>;
  bayesianTrace?: Array<{
    // 调试用：每步 p 怎么变化
    after: string;
    p: number;
  }>;
}
```

UI 渲染：

- 主数字：probability + tier
- 旁边：每个 contributions 项怎么把 p 推动了多少（透明）
- 底部：diagnostics 作为 "counselor 视角的补充信号"

---

## 6. 验证方法（无 outcome 数据可用）

### 6.1 Round consistency

对每个有 ED 数据的学校，造一个中位 profile，跑 ED vs RD，比例应 ≈ school.edRate / school.rdRate。差距 > 5% → 实现有 bug。

### 6.2 GPA band consistency

对 9 UC schools 的 46 bands，每个 band 造 20 个中位 profile，跑预测，平均预测应在 `[band.admitRate × 0.8, band.admitRate × 1.2]`。

### 6.3 Cross-source 一致性

UCLA 既有 CDS band 也有 admit pool 分布。两条路径预测同 profile 应 < 10pp 差距。

### 6.4 Profile completeness sensitivity

完整 profile 跑预测，逐个删 dimension，看 probability 移动幅度 + confidence 降级是否合理。

### 6.5 监督式校验（外部）

对 20 个 Crimson/CollegeVine 公开案例 (profile + 录取结果)，跑系统预测，看分布是否合理（不是单点对，是看 admit 案例预测均值 > reject 案例预测均值）。

---

## 7. 工作分解

> ⚠️ **2026-05-22 修订**：数据深挖发现 DB 已有大部分必需数据。M2 大幅缩水。

| Milestone  | 内容                                                                                                                                          | 估时                       | 状态    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------- |
| M2         | ~~收集 top 20 校完整 CDS~~ → **DB 已有大部分**；只补 ED/EA gap + hook % migration + global aggregates                                         | **0.5 天**（半夜跑完 80%） | ✅ 完成 |
| M3         | Bayesian sequential update 引擎 + diagnostics 收集 — **直接用 DB 现有 School/SchoolProgram/HighSchool/Profile/Activity/Award/TestScore 数据** | 1.5 天                     | ⏸ 待写  |
| M4         | 改 PredictionService.previewPredict 集成 + DTO 扩展 + UI 契约                                                                                 | 0.5 天                     | ⏸ 待写  |
| M5         | 跑 5 个验证测试，输出 baseline 报告                                                                                                           | 0.5 天                     | ⏸ 待写  |
| **共剩余** |                                                                                                                                               | **~2.5 天**                |         |

### 7.1 M3 引擎读取的数据来源（优先级）

```
1. 学校侧 anchors:
   - School (240 rows) — 主表，覆盖最全（SAT 226, GPA 182, intl 185, rank 240, acceptance 240）
   - SchoolProgram (1,788 rows) — major selectivity 用，按 CIP code 索引
   - HighSchool (165 rows) — student.highSchoolId → HS tier/quality
   - SchoolMetric (447 rows) — yield rate 等额外 metrics

2. 学生侧 input:
   - Profile (169 rows) — gpa, round, nationality, legacy[], firstGen, recruitedAthlete
   - TestScore[] — SAT/ACT/TOEFL/AP
   - Activity[] — category, role, hours, years
   - Award[] — level enum

3. Bayesian 分母:
   - apps/api/scripts/cds-collection-2026-05-22/global-admit-aggregates.json (NACAC/Common App baseline)

4. Fallback when no anchor:
   - CounselorEngine (existing rule-based)
```

---

## 8. 已知限制（必须接受）

> ⚠️ **2026-05-22 修订**：基于数据深挖修订。之前的"覆盖度受限"过度悲观。

1. **0 verified outcome** — **真正限制**。准确性无法验证，只能用 §6 proxy 测试。需 outcome 收集（§9 升级路径，独立产品工作）。
2. **DB 学校覆盖**：240 所学校核心 SAT/GPA/intl/rank 字段齐全（76-100% 覆盖），但 4000+ 全美学校仍有大量空白 → fallback 到 `School.acceptanceRate` + 全局 baseline。
3. **ED/EA rate 稀疏**（DB ED 68/240 + EA 21/240） → fallback 到全局先验（ED ×2.5）或 CounselorEngine。我今晚补了 ~15 个 top 校。
4. **Hook % schema 缺字段**（legacyClassPct 等） → 需 schema migration（draft SQL 已生成在 `cds-collection-2026-05-22/`）。Profile 侧有 `legacy[]` 和 `recruitedCoachStatus`，只缺学校侧 anchor。
5. **Activities / Awards 数据存在但 schoolside anchor 弱**（用 LOW tier 全局 T20 先验：80% spike, 55% national+ award）→ 可进概率但 weight 打折。
6. **Bayesian 同 bucket 学生概率几乎一样** — 不区分 within-bucket，是诚实的"我们没数据区分"的反映。
7. **`P(category | apply)` 分母靠估计**（来自 `global-admit-aggregates.json`），NACAC/Common App 跨校 baseline 替代单校真实 applied pool 统计。

---

## 9. 未来扩展路径（不在 v1）

| 升级                                 | 触发条件                               | 怎么做                                                  |
| ------------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| 加入 activities/awards/essays 进概率 | 收到 ≥ 50 verified outcomes per cohort | 训练 isotonic regression 把这些信号映射到 log-odds 调整 |
| Per-school 校准                      | 收到 ≥ 100 outcomes per school         | Platt scaling on 顶校                                   |
| Confidence interval (区间输出)       | 数据稳定后                             | Conformal prediction 或 bootstrap                       |
| Subgroup fairness gate               | 跨子群 outcome 足够                    | PREDICTION_BENCHMARK Layer 3 设计                       |

---

## 10. 关键决策记录

| 决策                    | 选择                                                   | 理由                                      |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------- |
| 是否用 case retrieval   | ❌ 不用                                                | 单 case 噪声太大                          |
| 是否用文献先验填空      | ❌ 不用                                                | 不是数据驱动                              |
| 是否手编系数            | ❌ 不用                                                | 同上                                      |
| 是否做校准循环          | ❌ 不需要                                              | 没系数可校                                |
| ~~Activities 进概率？~~ | **2026-05-22 修订**：进概率，但 LOW tier weight (0.5×) | 数据深挖发现 Activity 表 + 全局先验充足   |
| ~~Awards 进概率？~~     | **2026-05-22 修订**：进概率，LOW tier weight           | Award.level enum 已有 + Crimson aggregate |
| CounselorEngine 保留？  | ✅ 作 fallback                                         | 几千所无 CDS 学校仍需要某种输出           |

---

## 11. 修订记录 (Revision History)

- **2026-05-22 v2.0**：初版（基于"数据稀缺"假设）
- **2026-05-22 v2.1**：基于实际 DB 深挖 ([PREDICTION_DATA_INVENTORY_2026-05-22.md](./PREDICTION_DATA_INVENTORY_2026-05-22.md)) 大幅修订：
  - §3.1 数据覆盖度全部纠正（SAT 226/240, GPA 182/240, SchoolProgram 1788 行, HighSchool 165）
  - §3.2 新增"LOW tier 进概率"分类 — activities/awards 从 diagnostics 移入概率
  - §7 工作量缩水（M2 从 2-3 天 → 0.5 天）
  - §8 已知限制重写（不再说"覆盖度受限"）
  - §10 修订 activities/awards 决策

---

_作者注：这是经过 8 轮方法论 pivot + 1 次数据深挖修订后的最终方向。所有元素都经过"必须可追溯到现有 DB 数据或公开数据"的过滤。若未来 outcome 数据积累，按本文档 §9 升级路径接入更高级技术（isotonic regression, conformal prediction 等）。_
