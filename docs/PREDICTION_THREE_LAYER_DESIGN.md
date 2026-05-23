# 三层预测引擎设计 — Data-Driven Probability from Admissions Officer's Lens

> ⚠️ **SUPERSEDED 2026-05-22** by [PREDICTION_V2_DESIGN.md](./PREDICTION_V2_DESIGN.md)
> 本文档的 Layer 2 (Case-Based Retrieval) 经讨论被否决（理由：单 case 噪声太大）。
> 保留作为决策历史，**勿按此实施**。
>
> 最后更新: 2026-05-22
> 状态: **DEPRECATED**
> 关联: [PREDICTION_BENCHMARK.md](./PREDICTION_BENCHMARK.md) · [PREDICTION_SYSTEM.md](./PREDICTION_SYSTEM.md) · ADR-0017 (TODO)

## 0. TL;DR

把现在 CounselorEngine 的"规则公式算概率"换成**招生官式的"从相似过去案例和经验锚算概率"**。

```
profile + school
   ↓ 路由
┌───────────┬──────────────────┬─────────────────┐
│ Layer 1   │ Layer 2          │ Layer 3         │
│ CDS Band  │ Case Retrieval   │ Rule Fallback   │
│ 直接查表  │ top-K + empirical│ CounselorEngine │
│ (9 UCs)   │ (17 case schools)│ (其他几千所)    │
└───────────┴──────────────────┴─────────────────┘
   ↓
empirical_p + institutional_adjustments + confidence
```

输出 `{ probability, confidence, layer, similarCases[], explanation }`，不再是单一数字。

---

## 1. 背景：为什么换

### 1.1 当前 CounselorEngine 的根本局限

公式 `p = base_rate × gpa_mod × test_mod × round_mod × hook_mod × ...` 是**工程师对招生官思维的过度压缩**：

- 招生官不算概率，他们**找相似过去案例并比较**
- 公式输出 0-10% 和 90-100% 双峰，中段 30-70% 极少（4 个真实 v3 case 对照证实）
- anchor cap `×2.5` 把 Stanford 顶尖学生封顶在 9.5%，结构性低估 2-3x
- 系数手调，无可重复方法学

### 1.2 数据形态告诉我们能做什么

| 数据资产           | 数量            | 覆盖                                                         | 用途                 |
| ------------------ | --------------- | ------------------------------------------------------------ | -------------------- |
| AdmissionCase      | 99 (77 binary)  | 17 学校 (Stanford / Yale / MIT / Penn / Brown / Duke 等 T20) | 经验锚 — Layer 2     |
| SchoolCdsAdmitBand | 46 bands        | 9 学校 (UC 系统)                                             | 经验锚 — Layer 1     |
| User Profile       | 169 (41 有 GPA) | 当前用户                                                     | 待预测的 input       |
| PredictionResult   | 476             | 已生成预测                                                   | 历史样本，无 outcome |
| Verified outcome   | **0**           | —                                                            | 未来收集             |

**关键事实**：只有 26 所学校有经验锚（9 UC + 17 T20），全美 4000+ 学校剩下的没数据 → 必须有规则 fallback。

---

## 2. 核心原则

1. **数据驱动概率**，不再公式调参 — 概率来自相似案例的实际录取比例 或 公开 CDS band
2. **显式不确定性** — K=3 个相似案例时输出 "中等置信"；K=15 输出 "高置信"
3. **不依赖 outcome 数据** — 验证用 LOOCV + 跨源一致性，不需要 verified outcomes
4. **保留规则 fallback** — 几千所无数据的学校仍能给一个保守估计，标"低置信"
5. **解释性是一等公民** — 每个预测附带"类似的 X 个案例，其中 Y 个录取"，让 counselor 可以审

---

## 3. 架构

### 3.1 路由决策

```
INPUT: profile, school, options

IF school.id IN cdsBandSchoolIds (9 UC):
    → Layer 1 (CDS Band)
ELIF retrieval finds K ≥ 3 similar AdmissionCase at school:
    → Layer 2 (Case-Based Retrieval)
ELIF retrieval finds K ≥ 3 similar AdmissionCase at peer schools (same tier):
    → Layer 2 with peer fallback (置信度降一档)
ELSE:
    → Layer 3 (CounselorEngine rule, low confidence)
```

### 3.2 三层服务接口（NestJS）

```typescript
interface PredictionAnchorService {
  predict(profile: ProfileInput, school: SchoolInput, opts: PredictionOptions):
    Promise<AnchorResult | null>;  // null = 此 layer 不适用
}

// Three implementations
class CdsBandLookupService implements PredictionAnchorService { ... }
class CaseRetrievalService implements PredictionAnchorService { ... }
class CounselorRuleService implements PredictionAnchorService { ... }

// Orchestrator
class ThreeLayerPredictionEngine {
  constructor(
    private cdsBand: CdsBandLookupService,
    private caseRetrieval: CaseRetrievalService,
    private ruleFallback: CounselorRuleService,
  ) {}

  async predict(profile, school, opts): Promise<PredictionOutput> {
    return (await this.cdsBand.predict(...))
        ?? (await this.caseRetrieval.predict(...))
        ?? (await this.ruleFallback.predict(...));
  }
}
```

---

## 4. Layer 1 — CDS Band Lookup

### 4.1 输入

`profile.gpa`, `profile.testScores`, `school.id`（9 UC schools）

### 4.2 逻辑

1. 把 profile 的 (GPA, SAT/ACT) 落到学校的 CDS band 单元（如 [3.9-4.0, 1500-1600]）
2. 该 band 的 `admitRate` 是 base
3. 应用 institutional adjustments（round / hook / intl / fit major）
4. clamp [0.02, 0.98]

### 4.3 置信度

| 条件                        | confidence |
| --------------------------- | ---------- |
| band 落点精确，profile 完整 | high       |
| profile 部分缺失（无 SAT）  | medium     |
| band 在 sat 维度需插值      | medium     |

### 4.4 验证

**Band-internal sanity**：对每个 band，造 20 个该 band 内的合成 profile，跑 Layer 1，平均输出应该在 `[band.admitRate × 0.7, band.admitRate × 1.3]`（允许 institutional adjustment 偏移）。

---

## 5. Layer 2 — Case-Based Retrieval

### 5.1 输入

`profile`, `school`, `opts.applicationRound`

### 5.2 数据准备（一次性）

- AdmissionCase 加 `embedding pgvector(768)` 字段（schema migration）
- Profile（current users）相同字段
- Embedding 由专门 vectorize 服务生成（GPA bucket、SAT bucket、major、tags、round、intl、high school tier 这些 categorical + numeric features 拼成 feature vector，或者用 OpenAI text-embedding-3-small 编码 profile JSON 摘要）

### 5.3 检索

```sql
SELECT id, profile_summary, school_id, round, year, result
FROM admission_case
WHERE school_id = $1 AND result IN ('ADMITTED','REJECTED')
ORDER BY embedding <-> $profileEmbedding
LIMIT 10
```

如果 K < 3，扩展到 peer school（同 `selectivityTier`）：

```sql
WHERE school_id IN (SELECT id FROM "School" WHERE selectivityTier = $sameTier)
ORDER BY embedding <-> $profileEmbedding
LIMIT 10
```

### 5.4 概率计算

```
empirical_p = admits(retrieved) / |retrieved|
```

### 5.5 Institutional Adjustments

招生官真实考虑但 embedding 抓不全的因素，显式加权：

| 因素                         | 调整                                       | 来源                             |
| ---------------------------- | ------------------------------------------ | -------------------------------- |
| Round (ED/REA vs 检索池主体) | × edRate/rdRate（学校公布或 fallback 1.5） | 学校 CDS / CollegeVine published |
| Verified athlete             | × 3.0                                      | 文献（保守）                     |
| Verified legacy              | × 1.4                                      | 文献                             |
| First-gen                    | × 1.3                                      | Arcidiacono SFFA                 |
| Test optional at < 20% admit | × 0.85                                     | Common App data                  |

所有调整：log-odds additive，最终 clamp [0.02, 0.98]。

### 5.6 置信度

| K    | 检索源                   | confidence |
| ---- | ------------------------ | ---------- |
| ≥ 10 | same school              | high       |
| 5-9  | same school              | medium     |
| 3-4  | same school              | medium-low |
| 3-9  | peer school fallback     | low        |
| < 3  | 不进入 Layer 2 → Layer 3 | —          |

### 5.7 验证

**Leave-One-Out CV**：对每条 AdmissionCase，pretend 它不存在，用其他 98 条做 retrieval pool 预测它的概率，最终算 `accuracy@0.5` 和 retrieval similarity quality（top-1 案例与 query 的真实相似度由 counselor 抽样审查）。

---

## 6. Layer 3 — Rule Fallback (CounselorEngine 保留)

### 6.1 何时进入

学校既不在 9 UC 也没有 ≥ 3 相似 AdmissionCase（覆盖 99% 的全美学校）。

### 6.2 行为

完全保持 CounselorEngine 现有逻辑。**不再调系数**（之前讨论过这不是方法论）。

### 6.3 置信度

固定 `low`，UI 显示"统计参考概率，基于学校录取率和你的硬指标"。

---

## 7. 输出契约

```typescript
interface PredictionOutput {
  probability: number; // 0.02 - 0.98
  tier: 'reach' | 'match' | 'safety';
  confidence: 'high' | 'medium' | 'medium-low' | 'low';
  layer: 'cds-band' | 'case-retrieval' | 'case-peer-fallback' | 'rule';
  similarCases?: Array<{
    // Layer 2 only
    caseId: string;
    schoolName: string;
    year: number;
    round: string;
    result: 'ADMITTED' | 'REJECTED';
    similarityScore: number; // 0-1
    distinguishingFactors?: string[]; // LLM-generated, optional
  }>;
  bandAnchor?: {
    // Layer 1 only
    bandLabel: string; // "GPA 3.9-4.0, SAT 1500-1600"
    publishedAdmitRate: number;
  };
  ruleBreakdown?: {
    // Layer 3 only
    baseRate: number;
    appliedModifiers: Array<{ name: string; multiplier: number }>;
  };
  explanationText: string; // i18n key + filled values
}
```

**前端契约改动**：`PredictionResultDto` 增加 `confidence`, `layer`, `similarCases` 字段。`probability` 仍是首要展示，但 UI 需在低置信时加视觉降级（灰色 / "估算"标签）。

---

## 8. 验证方法（不需要 outcomes）

### 8.1 LOOCV on AdmissionCase（Layer 2）

99 次留一交叉验证。指标：

- `accuracy@0.5`: 多少 case 预测 tier 与真实 outcome 一致
- `mean_predicted_for_admits`: 录取 case 的平均预测概率
- `mean_predicted_for_rejects`: 落选 case 的平均预测概率
- `separation_gap`: admit 均值 - reject 均值（越大越好）

### 8.2 Band-Internal Sanity（Layer 1）

对 9 UC × 46 bands，造 20 个合成 profile/band，跑 Layer 1，平均预测落在 `band.admitRate × [0.7, 1.3]` 区间。

### 8.3 Cross-Source 一致性（Layer 1 vs Layer 2）

UCLA 在两个 layer 都有数据。同 profile 跑 Layer 1 (CDS) 和 Layer 2 (retrieval)，差距应该 < 15pp。差距大 → 一个 anchor 不可信，需要人工 review。

### 8.4 Retrieval Quality（人工）

抽 10 个 Layer 2 预测，让 counselor 审 top-5 相似案例是否"真的像"。共识 ≥ 70% 算通过。

---

## 9. 不在范围内

- ❌ ML 模型训练（无 outcomes）
- ❌ Platt scaling / Isotonic regression（同上）
- ❌ 改 CounselorEngine 系数（不是方法论）
- ❌ 自动收集 outcome 的产品改动（独立项目）
- ❌ 竞品对照（PREDICTION_BENCHMARK Layer 4 已落，独立路径）

---

## 10. 里程碑与代码位置

| Milestone | 内容                                                      | 文件位置                                                             | 估时     |
| --------- | --------------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| M1        | Layer 1 CdsBandLookupService + band-internal 验证         | `apps/api/src/modules/prediction/anchors/cds-band-lookup.service.ts` | 1 天     |
| M2        | AdmissionCase + Profile embedding 字段 + 生成脚本         | Prisma migration + `apps/api/scripts/vectorize-admission-cases.ts`   | 1 天     |
| M3        | Layer 2 CaseRetrievalService + LOOCV 验证                 | `apps/api/src/modules/prediction/anchors/case-retrieval.service.ts`  | 1 天     |
| M4        | Institutional adjustments + 三层路由 + 置信度             | `apps/api/src/modules/prediction/three-layer-prediction.engine.ts`   | 1 天     |
| M5        | 改 PredictionService.previewPredict 调用新引擎 + DTO 扩展 | `prediction.service.ts` + `dto/prediction-response.dto.ts`           | 0.5 天   |
| M6        | 跑三个验证测试，输出 baseline 报告                        | `apps/api/scripts/validate-three-layer.ts`                           | 0.5 天   |
| **共**    |                                                           |                                                                      | **5 天** |

---

## 11. 已知风险 & 决策点

| 风险                                          | 缓解                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| AdmissionCase selection bias（成功案例多）    | LOOCV 会暴露：admit 案例预测都偏高、reject 案例预测也偏高 → 报告里显式说"数据偏正" |
| 17 case schools 只占用户 target list 一小部分 | Layer 2 with peer fallback；学校层级化 hierarchy                                   |
| Embedding 维度选择                            | 第一版用 categorical + numeric features 手工拼（不依赖 LLM），便于解释             |
| pgvector 性能                                 | 99 条数据下索引可省；扩到万级需加 IVFFlat 索引                                     |
| Layer 3 仍是 CounselorEngine — 99% 学校用它   | 接受现状，本设计不修 Layer 3。未来 outcomes 收集后再回头优化                       |

---

## 12. 决策点（待确认）

- [ ] Embedding 实现：feature-engineered vs LLM-generated？
- [ ] 是否在 Layer 2 输出里给用户看 "similar cases"？（隐私 — AdmissionCase 是匿名化的，可以暴露摘要）
- [ ] Layer 3 的"低置信"在前端怎么呈现？灰色？小字"估算"？或者直接不显示概率？
- [ ] 是否替换 PredictionResult schema，还是新建 PredictionAnchorResult 表？（建议：保留 PredictionResult，扩字段）

---

_作者建议同步建立 `adr/0017-three-layer-prediction-architecture.md` 记录这个决策。_
