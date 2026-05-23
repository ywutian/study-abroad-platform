# 多维匹配预测 — 维度规格表

> ⚠️ **SUPERSEDED 2026-05-22** by [PREDICTION_V2_DESIGN.md](./PREDICTION_V2_DESIGN.md)
> 本文档含 16 个手编系数（log-odds ×4、leadership 乘数 等），经讨论判定**不是数据驱动**。
> v2 改用 Bayesian sequential update（无系数）。
> 保留作为决策历史，**勿按此实施**。
>
> 最后更新: 2026-05-22
> 状态: **DEPRECATED**
> 关联: [PREDICTION_THREE_LAYER_DESIGN.md](./PREDICTION_THREE_LAYER_DESIGN.md)（需后续重写以反映此方案）

## 0. TL;DR

对每个 profile 维度算 `studentScore` (0-1) 和 `schoolExpectation` (0-1)，差值 sigmoid 化得 `dimensionMatch`。所有维度加权求和得 `baseScore`，再经一组乘法 modifier 调整得最终概率。

```
baseScore = Σ_i weight_i × match_i           // 加性，weights 总和 = 1.0
probability = baseScore × Π_j modifier_j      // 乘法 modifier 在外
            → clamp [0.02, 0.98]
```

**所有维度都参与**。CDS 给一部分维度的 school expectation，文献先验填剩下。

---

## 1. 架构：加性维度 + 乘法 modifier

### 加性部分（"学生 vs 学校录取池"的 fit）

10 个维度，权重之和 = 1.0。每个维度：

- `studentScore` ∈ [0, 1]：学生在该维度的强度
- `schoolExpectation` ∈ [0, 1]：该校录取池在该维度的典型位置
- `match = sigmoid(k × (studentScore − schoolExpectation))`, k ≈ 4
  - student 远高于 expectation → match 趋 1
  - 远低于 → 趋 0
  - 持平 → 0.5

### 乘法部分（结构性 modifier）

6 类，乘到 baseScore 之后。每个 ∈ [0.3, 3.0]，最终统一 clamp。

---

## 2. 加性维度规格（10 个维度）

| #   | 维度                    | weight | student-side 计分 (0-1)                                                                  | school expectation (0-1)                              | 数据来源                                  | 缺失 fallback                                                       |
| --- | ----------------------- | ------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| 1   | **GPA position**        | 0.18   | `(profile.gpa − admit.gpa25) / (admit.gpa75 − admit.gpa25)`，clamp [0,1]                 | 0.5（admit 中位定义为 0.5）                           | CDS C-11                                  | 用 gpa11 或 gpaByGrade 中最高项；都缺则 confidence × 0.7            |
| 2   | **SAT/ACT position**    | 0.12   | 同 GPA 公式但用 SAT 或 ACT 转换分                                                        | 0.5                                                   | CDS C-9                                   | applyingTestOptional=true → match=0.5 (中性)；否则 confidence × 0.7 |
| 3   | **Course rigor**        | 0.07   | `min(1, (apCount + honors + dualEnroll) / 8)`                                            | 0.75 (T20) / 0.6 (T20-50) / 0.4 (其他)                | 文献先验                                  | apCount 缺时按 highSchoolType 推                                    |
| 4   | **EC depth (spike)**    | 0.13   | `max(activity_score)` where activity_score = tier × yearsActive × leadership_mult / norm | 0.7 (T20: spike expected) / 0.5 (T20-50) / 0.3 (其他) | 文献先验 + CDS class profile              | activities=[] → 0.2 + 标 confidence -1档                            |
| 5   | **Award level**         | 0.08   | `weighted_sum(award.level)` (intl=1.0, national=0.8, regional=0.5, school=0.2) × tier    | 0.6 (HYPSM: national+) / 0.4 (T20-50) / 0.2 (其他)    | 文献                                      | awards=[] → 0；不强惩罚                                             |
| 6   | **Major fit narrative** | 0.07   | 0/0.5/1：targetMajor 跟 activities + awards 不匹配/部分/强匹配                           | 0.6                                                   | 文献                                      | targetMajor 缺 → match=0.5                                          |
| 7   | **HS context**          | 0.05   | `highSchoolTier`: top 1% → 1, top 5% → 0.85, top 20% → 0.6, 其他 0.4                     | 0.7 (T20 admit 多来自顶 HS) / 0.5                     | CDS class profile (geographic mix) + 文献 | highSchoolTier 缺 → 0.5                                             |
| 8   | **Essay quality**       | 0.10   | `essayQualityScore / 10` from existing AI review                                         | 0.7 (T20 要求高) / 0.5                                | 文献 + counselor 共识                     | 无 essay → match=0.5 (避免惩罚)，confidence -1档                    |
| 9   | **GPA trend**           | 0.05   | rising → 1, stable → 0.6, falling → 0.2                                                  | 0.7 (rising 偏好)                                     | 文献                                      | semesterGpas / gpaByGrade 缺 → 0.6                                  |
| 10  | **English (intl only)** | 0.05   | TOEFL: ≥110 → 1, 100-109 → 0.7, 90-99 → 0.4, <90 → 0.1                                   | 0.85 (T20) / 0.6 (其他)                               | 文献                                      | 国际生但无 TOEFL → 0.3 (penalty)                                    |

**Domestic 学生 weight 8 (English) = 0** 重新归一化，其他 weight 比例放大。

---

## 3. 乘法 modifier 规格（6 个）

| modifier                            | 触发条件                                                   | multiplier 范围                                                            | 数据来源                                                        | 备注                           |
| ----------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------ |
| **A. Application round**            | ED / REA / EA / RD                                         | ED ×2.0-2.8 / REA ×1.4-1.8 / EA ×1.2-1.4 / RD ×1.0                         | 学校公布 edRate vs overallRate（数据驱动）；fallback 用上述区间 | 区间内插值按 selectivity       |
| **B. Recruited athlete (verified)** | recruitedAthlete=true AND 有 verification                  | ×2.0-3.0 (顶校更高)                                                        | 文献                                                            | unverified → ×1.0 (禁用)       |
| **C. Legacy (verified)**            | isLegacy=true AND legacySchools 含 school                  | ×1.3-1.5                                                                   | 学校发布 + 文献                                                 | unverified → ×1.0              |
| **D. First-generation**             | isFirstGen=true                                            | ×1.25-1.4                                                                  | Arcidiacono SFFA                                                | —                              |
| **E. International × Need policy**  | isInternational=true                                       | need-aware <10% → ×0.45 / need-blind <10% → ×0.55 / domestic baseline ×1.0 | CDS B-1 + needsFinancialAid + 学校 need 政策                    | 复合：intl × need-aware 时叠加 |
| **F. Major selectivity**            | school 对 targetMajor 单列录取 (如 CS-impacted)            | competitive program: ×0.5-0.7 / 一般 program: ×0.95 / 冷门: ×1.05          | 学校 SchoolProgram 数据 / 文献                                  | CS at T20: 典型 0.5-0.6        |
| **G. Test optional at <20% admit**  | applyingTestOptional=true AND school.acceptanceRate < 0.20 | ×0.85                                                                      | Common App data                                                 | —                              |

**叠加规则**：所有触发的 modifier 连乘，最终 `probability = baseScore × Π modifier × calibration_constant`。clamp [0.02, 0.98]。

---

## 4. 工作示例 — Stanford REA, GPA 3.95, SAT 1580

```
Stanford admit profile (来自 CDS):
  GPA: p25=3.85, p50=4.0, p75=4.0
  SAT: p25=1500, p50=1540, p75=1570
  athletes %: 6, legacy %: 16, first-gen %: 18, intl %: 12
  REA rate ≈ 8%, RD rate ≈ 1.7%, overall 3.8%

Student: GPA 3.95, SAT 1580, AP=8, robotics 4yr captain + research 2yr,
         regional robotics 1st, EE major, REA, claims athlete (unverified),
         no essay data, GPA trend rising, US domestic

加性维度计算:
  1. GPA position: (3.95-3.85)/(4.0-3.85) = 0.67, exp=0.5
     match = sigmoid(4 × 0.17) = 0.66
  2. SAT position: (1580-1500)/(1570-1500) = 1.0, exp=0.5
     match = sigmoid(4 × 0.5) = 0.88
  3. Course rigor: min(1, 8/8) = 1.0, exp=0.75
     match = sigmoid(4 × 0.25) = 0.73
  4. EC depth: 0.7 (robotics captain 4yr = spike), exp=0.7
     match = 0.5
  5. Award level: regional 1st = 0.5×0.8 = 0.4, exp=0.6
     match = sigmoid(4 × −0.2) = 0.31
  6. Major fit: EE matches robotics → 1.0, exp=0.6
     match = sigmoid(4 × 0.4) = 0.83
  7. HS context: 缺 → 0.5, exp=0.7
     match = 0.31
  8. Essay quality: 缺 → match=0.5 (中性)
  9. GPA trend: rising → 1.0, exp=0.7
     match = sigmoid(4 × 0.3) = 0.77
  10. English: domestic → weight=0

重新归一化 weights (1-9 = 0.80, 10 = 0)：
  total = 0.18+0.12+0.07+0.13+0.08+0.07+0.05+0.10+0.05 = 0.85
  归一系数 = 1/0.85

baseScore = (0.18×0.66 + 0.12×0.88 + 0.07×0.73 + 0.13×0.50 + 0.08×0.31 +
            0.07×0.83 + 0.05×0.31 + 0.10×0.50 + 0.05×0.77) / 0.85
          = (0.119 + 0.106 + 0.051 + 0.065 + 0.025 + 0.058 + 0.016 +
            0.050 + 0.039) / 0.85
          = 0.529 / 0.85
          = 0.622

乘法 modifier:
  A. Round REA: × 2.1 (Stanford REA 8%/3.8% ≈ 2.1)
  B. Athlete unverified: × 1.0
  C. Legacy: 无 → ×1.0
  D. First-gen: 无 → ×1.0
  E. International: domestic → ×1.0
  F. Major selectivity: EE at Stanford = 0.95
  G. Test optional: SAT submitted → ×1.0

probability = 0.622 × 2.1 × 0.95
            = 1.24 ?!

这超过 1.0 — 说明 modifier × baseScore 不能直接当概率。需要校准映射。

校准 (Platt-style sigmoid):
  raw = log(probability / (1 - probability))
  或更直接：把 baseScore 解读为 "log-odds 增量"

  initial p₀ = school.overallAcceptanceRate = 0.038
  log_odds₀ = log(0.038 / 0.962) = −3.23

  baseScore 0.622 → 比 0.5 高 0.122 → 加到 log_odds (× 5 转化因子)
  log_odds₁ = −3.23 + 0.122 × 5 = −2.62

  modifier 总乘数 2.1 × 0.95 = 2.0 → 加 log(2.0) = 0.69 到 log_odds
  log_odds₂ = −2.62 + 0.69 = −1.93

  p = sigmoid(−1.93) = 0.127

最终输出: **12.7%**, confidence=medium-high (essay 缺 -1档, HS context 缺 -0档)
```

**注意**：这个例子暴露了一个工程决策 — `baseScore` × modifier 不能直接得概率，需要通过 log-odds 校准映射。这是 M3 实现的关键。

---

## 5. 验证方法

### 5.1 Dimension-by-dimension sanity check

对每个维度，固定其他 9 个维度在中位，只变化该维度，看 probability 变化是否单调 + 合理范围。

### 5.2 Cross-source 一致性

UCLA 有 CDS bands + 公开 admit profile。同 profile 跑两个路径（CDS band lookup vs admit profile multi-dim matching），结果差距 < 15pp。

### 5.3 Modifier 弹性

固定 baseScore，单独触发每个 modifier，看 probability 比例变化是否符合 modifier 名义值。

### 5.4 缺失字段鲁棒性

对一个完整 profile，逐个删除字段，看预测变化幅度 + confidence 降级是否合理。

### 5.5 公开 distribution 对照

对 20 个学校，造 100 个合成 profile（覆盖 admit 池 25-75 百分位），跑预测，平均概率应接近学校公布 admit rate × 某倍数。

---

## 6. 缺失数据处理原则

| 严重度 | 字段                               | fallback 策略             | confidence 影响 |
| ------ | ---------------------------------- | ------------------------- | --------------- |
| 致命   | school.acceptanceRate              | 无法预测                  | 拒绝服务        |
| 严重   | profile.gpa                        | 用 gpaByGrade 最高项      | -1 档           |
| 严重   | profile.SAT 且未声明 test-optional | 假设 sat25-100 (penalty)  | -1 档           |
| 中     | essayQualityScore                  | match=0.5（中性）         | -1 档           |
| 中     | activities=[]                      | match=0.2 + 标 spike 缺失 | -1 档           |
| 轻     | GPA trend                          | 假设 stable               | 不影响          |
| 轻     | highSchoolTier                     | 假设 medium               | 不影响          |

---

## 7. 权重表的设计原则

| 类别            | 权重总和 | 理由                                         |
| --------------- | -------- | -------------------------------------------- |
| 学术 (1+2+3+9)  | 0.42     | 学术是必要条件，但顶校录取里它不再是充分条件 |
| EC + 奖项 (4+5) | 0.21     | spike + 区分度是顶校的关键                   |
| Fit (6+7)       | 0.12     | major 与 profile 一致性 + HS context         |
| Essays (8)      | 0.10     | 顶校决定性维度                               |
| 国际生附加 (10) | 0.05     | 仅国际生触发                                 |

权重**全局一套** v1 版本。未来可按学校类别（HYPSM / T20 / T50 / 其他）分组调整 — 但 v1 不做。

---

## 8. 未解决问题（待 review 决定）

- [ ] 校准常数 / log-odds 转化因子（例子里写的 ×5）应该统一一个值还是 per-school？
- [ ] `EC depth` 的 student score 公式细节 — leadership 乘数应该是 1.5 / 2.0 / 自定义？
- [ ] T20 / T20-50 / 其他 这种"档位"在 schema 里怎么存？或者用 `school.usNewsRank` 推？
- [ ] 文献先验 schoolExpectation 是 hard-coded 在代码里还是 DB 里？建议 DB (`SchoolPredictionPriors` 表)，方便后续调整不需要 deploy
- [ ] essay 缺失时是否真的 match=0.5？counselor 共识 "essay 不能扣分" 但实际申请没 essay 是异常
- [ ] modifier 应不应该相互制约（比如 athlete + ED 同时 ×6 太离谱）

---

## 9. 工程交付物（M2 起）

1. **新 schema**：`SchoolAdmitProfile`（含 CDS 字段 + 文献先验字段）
2. **CDS 数据 seed**：top 20 校（手工整理）
3. **预测引擎**：`MultiDimMatchingService`
4. **modifier 服务**：`PredictionModifierService`
5. **校准层**：log-odds 转换函数 + clamp
6. **置信度计算**：`ConfidenceCalculator` based on which fields are present
7. **PredictionService 集成**：替换 CounselorEngine 在有数据学校的路径
8. **fallback 路径**：无 SchoolAdmitProfile 的学校继续走 CounselorEngine
