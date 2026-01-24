# 评分系统技术文档 (Scoring System)

> 最后更新: 2026-02-13

---

## 1. 概述

本平台使用统一评分系统评估学生申请竞争力。所有模块（录取预测、互评大厅、选校推荐、档案展示）**必须**使用同一个评分工具函数，禁止在其他位置创建新的评分逻辑。

**唯一评分源文件**: `apps/api/src/common/utils/scoring.ts`

### 设计原则

1. **单一数据源**: 所有评分逻辑集中在一个文件
2. **学校相对性**: 评分可根据目标学校的数据进行调整
3. **数据驱动**: 使用 College Scorecard 官方数据作为基准
4. **渐进增强**: 当数据不足时使用合理默认值

---

## 2. 核心接口

### ProfileMetrics — 学生指标

```typescript
export interface ProfileMetrics {
  gpa?: number; // GPA 分值
  gpaScale?: number; // GPA 制度 (4.0, 5.0, 100)
  satScore?: number; // SAT 总分 (400-1600)
  actScore?: number; // ACT 综合分 (1-36)
  toeflScore?: number; // TOEFL 分数
  activityCount: number; // 课外活动数量
  awardCount: number; // 总奖项数量
  nationalAwardCount: number; // 国家级奖项数量
  internationalAwardCount: number; // 国际级奖项数量
  awardTierScores?: number[]; // 每个奖项的分值（由 competition.tier 或 level 映射）
  activityDetails?: Array<{
    // 活动详情（用于质量评分）
    category: string;
    role: string;
    totalHours: number;
  }>;
}
```

**数据来源**: Profile + TestScores + Activities + Awards (via `extractProfileMetrics()`)

### SchoolMetrics — 学校指标

```typescript
export interface SchoolMetrics {
  acceptanceRate?: number; // 录取率 (0-100)
  satAvg?: number; // SAT 平均分
  sat25?: number; // SAT 25th 百分位 (NEW)
  sat75?: number; // SAT 75th 百分位 (NEW)
  actAvg?: number; // ACT 平均分
  act25?: number; // ACT 25th 百分位 (NEW)
  act75?: number; // ACT 75th 百分位 (NEW)
  usNewsRank?: number; // US News 排名
}
```

**数据来源**: School 模型直接字段 (via `extractSchoolMetrics()`)

> **重要**: `satAvg`, `sat25`, `sat75`, `actAvg`, `act25`, `act75` 直接存储在 School 模型列上，由 College Scorecard 同步服务和 seed 脚本写入。**不是**从 `metadata` JSON 中读取。

---

## 3. 提取函数

### extractProfileMetrics

从 Prisma Profile（含 include）中提取 `ProfileMetrics`:

```typescript
extractProfileMetrics(profile: {
  gpa?: any;
  gpaScale?: any;
  testScores?: Array<{ type: string; score: number }>;
  activities?: Array<any>;
  awards?: Array<{ level?: string }>;
}): ProfileMetrics
```

- SAT: `testScores.find(t => t.type === 'SAT')?.score`
- ACT: `testScores.find(t => t.type === 'ACT')?.score`
- `nationalAwardCount`: awards where `level === 'NATIONAL'`
- `internationalAwardCount`: awards where `level === 'INTERNATIONAL'`

### extractSchoolMetrics

从 Prisma School 中提取 `SchoolMetrics`:

```typescript
extractSchoolMetrics(school: {
  acceptanceRate?: any;
  usNewsRank?: number | null;
  satAvg?: number | null;
  sat25?: number | null;
  sat75?: number | null;
  actAvg?: number | null;
  act25?: number | null;
  act75?: number | null;
}): SchoolMetrics
```

直接映射 School 模型字段，`null` → `undefined`。

---

## 4. 分项评分公式

### 4.1 Academic Score (0-100)

**基础分**: 50 (`ACADEMIC_CONFIG.baseScore`)

**GPA 分数 (最高 40 分)**:

```text
normalizedGpa = normalizeGpa(gpa, scale)  // 归一化到 4.0 制
gpaScore = (normalizedGpa / 4.0) * 40
score += gpaScore - 20  // 以 3.0 GPA 为基准
```

GPA 归一化支持: 4.0 制（直接）、5.0 制（÷5×4）、100 分制（÷100×4）

**SAT 分数 (+/- 15 分) — 四级 Fallback**:

```text
Level 1: 平台历史数据 ≥ 30 条 → empiricalPercentile(score, sortedValues)
Level 2: sat25 + sat75 → calculatePercentile(score, sat25, sat75)  // 正态 CDF
Level 3: satAvg → 差值法: clamp(-15, (diff / 50) * 5, 15)
Level 4: 默认基准 1400
```

百分位映射: `score += (percentile - 0.5) * 30`（50th = 0 分，100th = +15 分，0th = -15 分）

**ACT 分数** (仅在无 SAT 时使用): 同上四级 Fallback，支持 act25/act75 百分位

**TOEFL 分数 (+/- 5 分)**:

```text
toeflBonus = clamp(-5, (toeflScore - 100) / 4, 5)  // 100 为基准，120 满分
```

### 4.2 Activity Score (0-100)

**新路径（有 activityDetails 时）:**

```text
score = 20 (基础分)
      + min(30, activityCount * 3)              // 数量分
      + min(15, leadershipCount * 5)             // 领导力分
      + min(15, deepActivityCount * 5)           // 深度参与分 (totalHours > 200)
      + diversityBonus                           // 多样性分 (3类+5, 5类+10)
```

**Fallback（无 activityDetails）:**

```text
score = 30 + min(50, activityCount * 5)
```

### 4.3 Award Score (0-100)

**新路径（有 awardTierScores 时）:**

```text
score = sum(TIER_POINTS[competition.tier] or LEVEL_POINTS[award.level])
score = clamp(0, score, 100)
```

**Fallback（无 awardTierScores）:**

```text
score = 20
score += min(40, internationalAwardCount * 20)  // 国际级
score += min(30, nationalAwardCount * 15)        // 国家级
score += min(20, otherAwardCount * 5)            // 其他
```

---

## 5. 综合分数

```text
overall = academic * SCORING_WEIGHTS.academic + activity * SCORING_WEIGHTS.activity + award * SCORING_WEIGHTS.award
        = academic * 0.5 + activity * 0.3 + award * 0.2
```

| 权重 | 分项     | 说明           |
| ---- | -------- | -------------- |
| 50%  | Academic | GPA + 标化成绩 |
| 30%  | Activity | 课外活动       |
| 20%  | Award    | 奖项成就       |

---

## 6. 录取概率

### 6.1 统计引擎概率 (scoring.ts)

```text
baseRate = school.acceptanceRate / 100 || 0.30
scoreDiff = (overallScore - 50) / 10
probability = baseRate * 1.2^scoreDiff
probability = clamp(0.05, probability, 0.95)
```

- 50 分 = 学校基础录取率
- 每 +10 分 → 概率 × 1.2
- 每 -10 分 → 概率 × 0.83
- 限制范围: 5% ~ 95%

### 6.2 多引擎融合概率 (PredictionService v2)

统计引擎仅是三引擎之一。在预测服务中，统计概率将与 AI 引擎和历史数据引擎的结果进行动态加权融合：

```text
finalProbability = stats × W_stats + ai × W_ai + historical × W_historical + memoryAdjustment
```

权重根据引擎可用性自动调整，附带置信区间 (probabilityLow / probabilityHigh)。

> 完整多引擎融合架构详见 [PREDICTION_SYSTEM.md](PREDICTION_SYSTEM.md)

---

## 7. Tier 分类

| 学校类型 (录取率) | Safety             | Match              | Reach              |
| ----------------- | ------------------ | ------------------ | ------------------ |
| 顶尖 (< 15%)      | —                  | probability ≥ 0.25 | probability < 0.25 |
| 选择性 (15-30%)   | probability ≥ 0.50 | probability ≥ 0.25 | probability < 0.25 |
| 一般 (> 30%)      | probability ≥ 0.60 | probability ≥ 0.35 | probability < 0.35 |

---

## 8. 置信度

| 数据点   | 来源                           |
| -------- | ------------------------------ |
| GPA      | profile.gpa                    |
| 标化成绩 | satScore 或 actScore           |
| 活动     | activityCount > 0              |
| 奖项     | awardCount > 0                 |
| 录取率   | school.acceptanceRate          |
| 标化基准 | school.satAvg 或 school.actAvg |

- 5+ 数据点 → `high`
- 3-4 数据点 → `medium`
- 0-2 数据点 → `low`

---

## 9. 百分位评分 (Percentile-Based Academic Scoring)

### 目标

使用 SAT/ACT 25th/75th 百分位数据计算学生在目标学校录取学生中的百分位排名，取代简单的 "与平均分差距" 方法。

### 方法: 正态分布 CDF

已有的 `sat25` / `sat75` 代表录取学生 SAT 分布的 25th 和 75th 百分位。假设分布近似正态:

```text
mu = (sat25 + sat75) / 2
sigma = (sat75 - sat25) / (2 * 0.6745)  // IQR → std dev
percentile = Phi((studentSAT - mu) / sigma)  // 标准正态 CDF
```

### 四级 Fallback 链

1. 平台历史录取数据 ≥ 30 条 → 经验百分位 (`empiricalPercentile`)
2. 学校有 `sat25` + `sat75` → 正态 CDF (`calculatePercentile`)
3. 学校有 `satAvg` → 差值法
4. 无数据 → 默认基准 1400

### TOEFL 评分

托福作为门槛型加分项纳入学术分数:

- 基准: 100 分 = 0 加成
- 满分: 120 分 = +5 分
- 低分: 80 分 = -5 分
- 上限: ±5 分

### 状态

- ✅ Schema 已支持 (sat25, sat75, act25, act75 字段已添加)
- ✅ 数据同步已支持 (College Scorecard 和 seed 脚本写入百分位数据)
- ✅ 评分函数已迁移 (`calculateAcademicScore` 使用四级 Fallback)
- ✅ `normalCDF` / `calculatePercentile` / `empiricalPercentile` 已实现
- ✅ TOEFL 评分已纳入

---

## 10. 竞赛层级奖项评分 (Competition-Tier Award Scoring)

### 目标

用竞赛声望层级加权替代简单的 "国际/国家/其他" 计数方法。

### 竞赛层级体系

| 层级     | 分值  | 代表竞赛                                 |
| -------- | ----- | ---------------------------------------- |
| 5 (最高) | 25 分 | IMO, IPhO, ISEF, Regeneron STS           |
| 4        | 15 分 | USAMO, USABO, NSDA Nationals, YoungArts  |
| 3        | 8 分  | AIME, PhysicsBowl, Science Olympiad, NEC |
| 2        | 4 分  | AMC 12, FBLA, USACO Silver, VEX          |
| 1        | 2 分  | AMC 8, NHS, NLE, Knowledge Bowl          |

### 评分公式

```text
awardScore = sum(TIER_POINTS[competition.tier] for each award with competitionId)
           + sum(LEVEL_POINTS[award.level] for awards without competitionId)
awardScore = clamp(0, awardScore, 100)
```

### 数据链路

```text
Award.competitionId → Competition.tier → TIER_POINTS 映射 → calculateAwardScore
Award.level → LEVEL_POINTS 映射 → calculateAwardScore (fallback)
```

### 无竞赛关联的默认分值

| AwardLevel    | 分值 |
| ------------- | ---- |
| INTERNATIONAL | 20   |
| NATIONAL      | 15   |
| STATE         | 8    |
| REGIONAL      | 5    |
| SCHOOL        | 2    |

### 状态

- ✅ Competition 模型已创建
- ✅ Award 已添加 competitionId FK
- ✅ 95 条竞赛种子数据已准备
- ✅ `calculateAwardScore` 已迁移 (双路径: tier 评分 + level fallback)
- ✅ `extractProfileMetrics` 已接入 competition.tier
- ✅ 所有调用方 Prisma include 已更新 (`awards: { include: { competition: true } }`)

---

## 11. 活动质量评分 (Activity Quality Scoring)

### 目标

用活动质量维度（领导力、深度参与、多样性）替代简单的活动数量计数。

### 评分公式

```text
score = 20 (基础分)
      + min(30, activityCount * 3)              // 数量分
      + min(15, leadershipCount * 5)             // 领导力分
      + min(15, deepActivityCount * 5)           // 深度参与分 (totalHours > 200)
      + diversityBonus                           // 多样性分 (3类+5, 5类+10)
score = clamp(0, score, 100)
```

### 领导力关键词

匹配 role 字段（不区分大小写）:
`president`, `founder`, `captain`, `director`, `head`, `chair`, `editor-in-chief`, `lead`, `co-founder`, `社长`, `主席`, `队长`, `创始人`, `负责人`

### 向后兼容

当 `activityDetails` 不存在时，退化到旧的计数逻辑: `30 + min(50, count * 5)`。

### 状态

- ✅ `calculateActivityScore` 已实现双路径
- ✅ `extractProfileMetrics` 已提取 activityDetails
- ✅ 无需修改 Prisma include (`activities: true` 已返回所有字段)

---

## 12. 历史数据驱动评分 (Data-Driven Scoring)

### 目标

利用 `AdmissionCase` 历史录取数据，当样本量足够时，用真实录取者分布做经验百分位排名。

### 实现

`PredictionService.getSchoolDistribution(schoolId)`:

1. 查询 Redis 缓存 (24h TTL)
2. 从 `AdmissionCase` 聚合已验证的录取案例
3. 解析 `satRange`/`gpaRange`/`toeflRange` 字符串 (如 "1500-1550")
4. 样本量 ≥ 30 时返回排序后的分值数组

`empiricalPercentile(value, sortedValues)`:

- 使用二分查找定位学生分数在分布中的百分位

### 数据流

```text
AdmissionCase (isVerified, ADMITTED) → parseRange → sort → empiricalPercentile → calculateAcademicScore
```

### 状态

- ✅ `parseRange` 工具函数已实现
- ✅ `empiricalPercentile` 已实现
- ✅ `getSchoolDistribution` 已实现 (含 Redis 缓存)
- ✅ 四级 Fallback 链已集成到 `calculateAcademicScore`

---

## 13. 排名对比中的评分应用

### 概述

互评大厅 (`HallService.getBatchRanking`) 对用户的每所目标学校，收集所有同校申请者的评分，进行排名对比并返回丰富的统计数据。

### 流程

1. 查询用户档案 → `extractProfileMetrics()` + `extractSchoolMetrics()` → `calculateOverallScore()`
2. 查询同校竞争者 → 逐一计算评分 → 按 overall 降序排序
3. 确定用户排名、百分位、各维度百分位

### 新增统计字段

| 字段                          | 类型              | 说明                                                      |
| ----------------------------- | ----------------- | --------------------------------------------------------- |
| `scoreDistribution.overall`   | `PercentileBands` | 竞争者总分的 p25/p50/p75                                  |
| `scoreDistribution.academic`  | `PercentileBands` | 学术维度分布                                              |
| `scoreDistribution.activity`  | `PercentileBands` | 活动维度分布                                              |
| `scoreDistribution.award`     | `PercentileBands` | 奖项维度分布                                              |
| `competitorStats.avgScore`    | `number`          | 竞争者平均总分                                            |
| `competitorStats.medianScore` | `number`          | 竞争者中位总分                                            |
| `competitorStats.totalCount`  | `number`          | 竞争者总数                                                |
| `competitivePosition`         | `string`          | `strong`(>=70%) / `moderate`(>=40%) / `challenging`(<40%) |

### PercentileBands 计算

```typescript
private calcBands(values: number[]): PercentileBands {
  if (values.length === 0) return { p25: 0, p50: 0, p75: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) =>
    Math.round(
      (sorted[Math.floor(sorted.length * p)] ?? sorted[sorted.length - 1]) * 10,
    ) / 10;
  return { p25: at(0.25), p50: at(0.5), p75: at(0.75) };
}
```

### 记忆层集成

每次排名查询后，前 3 所学校的竞争力洞察（最强/最弱维度、竞争力定位）通过 `MemoryManagerService.remember()` 保存为 `FACT` 类型记忆，30 天过期。AI 智能体可通过 `recall()` 获取该上下文。

---

## 14. 锐评模式评分维度 (Review Mode Scoring)

### 概述

锐评模式（Sharp Review Mode）允许用户对其他申请者的档案进行四维评分。评分维度与系统评分系统的三大维度对齐，并额外拆分出标化成绩维度。

### 评分维度

| 维度     | Review 字段            | 分数范围               | 对应系统维度              | 权重 |
| -------- | ---------------------- | ---------------------- | ------------------------- | ---- |
| 学术成绩 | `academicScore` (0-10) | GPA、课程难度等        | Academic Score            | 30%  |
| 标化成绩 | `testScore` (0-10)     | SAT/ACT/TOEFL          | Academic Score (标化部分) | 30%  |
| 课外活动 | `activityScore` (0-10) | 活动数量、深度、领导力 | Activity Score            | 20%  |
| 奖项荣誉 | `awardScore` (0-10)    | 竞赛成绩、获奖层级     | Award Score               | 20%  |

> **注意**: 旧版使用 `essayScore` 字段，已重命名为 `testScore`；新增 `awardScore` 维度。

### 综合分数计算

```text
overallScore = academicScore * 0.3 + testScore * 0.3 + activityScore * 0.2 + awardScore * 0.2
```

权重设计参考了系统评分的 `SCORING_WEIGHTS`（academic 50% 拆分为学术 30% + 标化 30%，activity 30% → 20%，award 20% → 20%）。

### 分项评语

每个维度附带独立评语字段：

| 字段              | 说明         |
| ----------------- | ------------ |
| `academicComment` | 学术成绩评语 |
| `testComment`     | 标化成绩评语 |
| `activityComment` | 课外活动评语 |
| `awardComment`    | 奖项荣誉评语 |

### 附加字段

| 字段           | 类型         | 说明                                      |
| -------------- | ------------ | ----------------------------------------- |
| `tags`         | String[]     | 用户自定义标签（如 "理科强"、"标化优秀"） |
| `status`       | ReviewStatus | DRAFT / PUBLISHED / HIDDEN                |
| `helpfulCount` | Int          | 收到"有帮助"反应的次数（缓存）            |

### 互动反应

通过 `ReviewReaction` 模型记录用户对评审的反应：

| 反应类型     | 说明   | 积分奖励          |
| ------------ | ------ | ----------------- |
| `helpful`    | 有帮助 | 评审作者 +10 积分 |
| `insightful` | 有洞见 | 无积分（仅标记）  |

约束: 每个用户对每条评审的每种反应类型只能有一条记录 (`@@unique([reviewId, userId, type])`)。

### 统计接口

`GET /hall/reviews/:profileUserId/stats` 返回：

- 各维度平均分
- 评审总数 (`reviewCount`)
- 热门标签 (`topTags`)

### 积分激励

| 行为             | 积分 |
| ---------------- | ---- |
| 提交评审         | +20  |
| 收到"有帮助"反应 | +10  |

### 记忆系统集成

评审提交后，记录为 `DECISION` 类型记忆（旧版为 `FACT`），附带 `tags` 元数据，供 AI 智能体在后续对话中回忆引用。

---

## 15. 可配置常量

所有评分常量集中在 `scoring.ts` 顶部，便于后续 A/B 测试:

> 注意: 本节原为第 13 节，因新增第 13 节（排名对比）和第 14 节（锐评模式）而顺延。

```typescript
SCORING_WEIGHTS  = { academic: 0.5, activity: 0.3, award: 0.2 }
ACADEMIC_CONFIG  = { baseScore: 50, gpaMaxBonus: 40, gpaBaseline: 20, satMaxBonus: 15, actMaxBonus: 15, toeflMaxBonus: 5, toeflBaseline: 100 }
TIER_POINTS      = { 5: 25, 4: 15, 3: 8, 2: 4, 1: 2 }
LEVEL_POINTS     = { INTERNATIONAL: 20, NATIONAL: 15, STATE: 8, REGIONAL: 5, SCHOOL: 2 }
LEADERSHIP_KEYWORDS = ['president', 'founder', 'captain', ...]
```
