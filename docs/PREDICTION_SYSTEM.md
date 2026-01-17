# 录取预测系统技术文档 (Prediction System v2)

> 最后更新: 2026-02-09
> 模型版本: v2-ensemble
> 状态: 已实施

---

## 目录

1. [系统概述](#1-系统概述)
2. [架构设计](#2-架构设计)
3. [多引擎融合](#3-多引擎融合)
4. [记忆系统集成](#4-记忆系统集成)
5. [置信区间](#5-置信区间)
6. [准确率校准闭环](#6-准确率校准闭环)
7. [数据模型](#7-数据模型)
8. [API 端点](#8-api-端点)
9. [前端展示](#9-前端展示)
10. [行业对标](#10-行业对标)
11. [配置参考](#11-配置参考)
12. [未来规划](#12-未来规划)

---

## 1. 系统概述

### 1.1 设计目标

| 目标           | 指标                                   | 状态          |
| -------------- | -------------------------------------- | ------------- |
| **差异化预测** | 不同学校（如 MIT vs BC）概率差异 >20%  | ✅ 已实现     |
| **透明度**     | 用户可查看各引擎得分明细               | ✅ 已实现     |
| **校准精度**   | 预测 X% → 实际 ~X%（CollegeVine 标准） | ⏳ 数据积累中 |
| **个性化**     | 基于记忆系统的用户画像增强             | ✅ 已实现     |
| **置信度量化** | 每个预测附带概率区间                   | ✅ 已实现     |
| **闭环改进**   | 用户报告实际结果 → 校准统计            | ✅ 已实现     |

### 1.2 版本演进

| 版本        | 发布日期   | 核心变更                                    |
| ----------- | ---------- | ------------------------------------------- |
| v1          | 2026-01    | 单一 AI 预测 + stats fallback               |
| v2-ensemble | 2026-02-09 | 三引擎融合 + 记忆集成 + 置信区间 + 校准闭环 |

### 1.3 参考标准

| 平台 / 论文                      | 方法论                                 | 借鉴点                                |
| -------------------------------- | -------------------------------------- | ------------------------------------- |
| **CollegeVine**                  | 75+ 因素、校准精度达 ±3%、1500+ 学校   | 校准方法论、分桶统计、tiered 课外活动 |
| **CAPS 框架** (arxiv 2507.15862) | SAS + EQI + EIS、XGBoost + Transformer | 三维度分解、多模态融合思路            |
| **Stacked Ensemble** (IEEE 2020) | 多模型堆叠集成                         | 加权融合策略                          |

---

## 2. 架构设计

### 2.1 系统流程图

```
用户选择学校 → POST /predictions
    ↓
┌──────────────────────────────────────────────┐
│              PredictionService                │
│                                               │
│  1. 加载 Profile + School 数据               │
│  2. 从记忆系统获取用户上下文（读取）          │
│     ├─ 历史预测记忆 (DECISION)               │
│     ├─ 用户偏好 (PREFERENCE)                 │
│     └─ 个人背景 (FACT)                       │
│                                               │
│  3. 对每个学校，并行执行三引擎:              │
│     ┌─────────────┐                          │
│     │ 引擎 1      │ 统计算法 (always)        │
│     │ 引擎 2      │ AI 分析 (may fail)       │
│     │ 引擎 3      │ 历史案例匹配 (if data)   │
│     └─────────────┘                          │
│                                               │
│  4. 动态加权融合 + 记忆微调                  │
│  5. 置信区间计算                             │
│  6. Tier 分类 + 建议生成                     │
│                                               │
│  7. 保存:                                    │
│     ├─ Redis 缓存 (1h)                       │
│     ├─ PredictionResult 表 (持久化)          │
│     └─ 记忆系统 (增强写入)                   │
└──────────────────────────────────────────────┘
    ↓
返回 PredictionResultDto[]
```

### 2.2 文件结构

```
apps/api/src/modules/prediction/
├── prediction.module.ts          # 模块定义
├── prediction.controller.ts      # API 端点 (4 endpoints)
├── prediction.service.ts         # 核心服务 (多引擎融合)
├── dto/
│   ├── index.ts
│   ├── prediction-request.dto.ts
│   └── prediction-response.dto.ts  # PredictionResultDto + EngineScores
└── utils/
    ├── prompt-builder.ts           # AI Prompt 构建
    └── score-calculator.ts         # → re-exports from common/utils/scoring.ts
```

### 2.3 依赖关系

```
PredictionModule
  ├── PrismaService       (数据库)
  ├── AiService           (OpenAI 调用)
  ├── RedisService        (缓存)
  └── MemoryManagerService (可选, AI 记忆)
       ├── recall()          (预测前读取)
       ├── remember()        (预测后写入)
       └── recordEntity()    (实体记录)
```

---

## 3. 多引擎融合

### 3.1 引擎概览

| 引擎             | 数据源                   | 可用性          | 输出                                |
| ---------------- | ------------------------ | --------------- | ----------------------------------- |
| **统计引擎**     | Profile + School metrics | Always          | 0-1 概率 + factors                  |
| **AI 引擎**      | GPT-4o-mini 专家分析     | 可能失败 → null | 0-1 概率 + factors + suggestions    |
| **历史数据引擎** | AdmissionCase 录取案例   | 需 ≥10 案例     | 0-1 概率 + sampleCount + confidence |

### 3.2 统计引擎详情

使用 `apps/api/src/common/utils/scoring.ts` 统一评分：

```
overallScore = academic × 0.5 + activity × 0.3 + award × 0.2
probability  = baseRate × 1.2^((overallScore - 50) / 10)
probability  = clamp(0.05, probability, 0.95)
```

详细评分公式见 [SCORING_SYSTEM.md](SCORING_SYSTEM.md)。

**缺失数据处理**: 当用户未提供 GPA / 标化 / 活动 / 奖项时，对应因素标记为 `negative`，并附带数据补全建议。

### 3.3 AI 引擎详情

**Prompt 结构**:

1. System prompt: 20 年经验的招生顾问，要求根据学校选择性差异化概率
2. 用户 prompt: 学生档案 + 学校数据 + 概率区间指导
3. 统计校准锚点: `统计模型计算的录取概率: X%, tier: Y`
4. 记忆洞察: 从记忆系统获取的用户背景信息 (最多 3 条)

**校验规则**:

- 概率范围: [0.05, 0.95]
- 与统计模型偏差: 不超过 3 倍
- 无效响应: 回退到统计引擎结果

### 3.4 历史数据引擎详情

```
对 schoolId 查询所有 isVerified=true 的 AdmissionCase
→ 对每个案例计算与当前用户的相似度 (GPA距离 + SAT距离)
→ 按相似度加权统计录取率
→ 返回 { probability, sampleCount, confidence }
```

- GPA 差距 < 0.2: 相似度 +0.3
- SAT 差距 < 50: 相似度 +0.2
- 最低 10 条案例方可使用此引擎

### 3.5 动态权重策略

权重根据数据可用性自动调整：

| 场景       | 统计引擎 | AI 引擎 | 历史引擎 |
| ---------- | -------- | ------- | -------- |
| 全部可用   | 25%      | 40%     | 35%\*    |
| 无历史数据 | 35%      | 65%     | —        |
| AI 失败    | 45%      | —       | 55%      |
| 仅统计     | 100%     | —       | —        |

> \*历史引擎权重随样本量调整: `weight × (sampleCount / 100)`, 然后重新归一化

### 3.6 记忆增强微调

从记忆系统读取的学校实体，如果用户对某学校有持续关注（多次查看），给予 +1~2% 的微调。这反映了 "demonstrated interest" 对录取的正向影响。

**上限**: ±2% (避免过度调整)

---

## 4. 记忆系统集成

### 4.1 双向数据流

```
┌─────────────────┐                    ┌─────────────────┐
│   预测系统       │ ←── 预测前读取 ──→ │   记忆系统       │
│                 │                    │                 │
│ getMemoryContext │                    │ recall(DECISION) │
│                 │                    │ recall(PREFERENCE)│
│                 │                    │ recall(FACT)     │
│                 │                    │                 │
│ recordPrediction │ ──── 预测后写入 ──→│ remember(DECISION)│
│ ToMemory        │                    │ recordEntity()   │
└─────────────────┘                    └─────────────────┘
```

### 4.2 预测前读取

| 读取类型 | 记忆类型                                  | 用途                   |
| -------- | ----------------------------------------- | ---------------------- |
| 历史预测 | `DECISION` + category `school_prediction` | 检测重复查询、趋势分析 |
| 用户偏好 | `PREFERENCE`                              | 学校偏好、申请策略     |
| 个人背景 | `FACT`                                    | 额外 Profile 洞察      |
| 学校实体 | `Entity(SCHOOL)`                          | 关注频次 → 微调        |

### 4.3 预测后写入

| 写入内容 | 类型             | Importance              |
| -------- | ---------------- | ----------------------- |
| 预测摘要 | `DECISION`       | 0.7 (首次) / 0.8 (重复) |
| 学校实体 | `Entity(SCHOOL)` | —                       |

**重复查询检测**: 如果用户再次预测同一学校，记忆内容会标记 `isRepeatQuery: true`，表明持续关注。

---

## 5. 置信区间

### 5.1 计算方法

置信区间宽度根据置信度等级动态调整：

| Confidence | 区间宽度        | 示例 (概率 35%) |
| ---------- | --------------- | --------------- |
| `high`     | ±4% (总宽 8%)   | 31% - 39%       |
| `medium`   | ±7% (总宽 14%)  | 28% - 42%       |
| `low`      | ±11% (总宽 22%) | 24% - 46%       |

### 5.2 置信度评估

基于 Profile 和 School 的数据完整度（共 6 个数据点）：

| 数据点   | 来源                               |
| -------- | ---------------------------------- |
| GPA      | `profile.gpa`                      |
| 标化成绩 | `satScore` 或 `actScore`           |
| 活动     | `activityCount > 0`                |
| 奖项     | `awardCount > 0`                   |
| 录取率   | `school.acceptanceRate`            |
| 标化基准 | `school.satAvg` 或 `school.actAvg` |

- 5+ 数据点 → `high`
- 3-4 数据点 → `medium`
- 0-2 数据点 → `low`

---

## 6. 准确率校准闭环

### 6.1 数据收集

用户可以通过 `PATCH /predictions/:schoolId/result` 报告实际录取结果：

```json
{ "result": "ADMITTED" | "REJECTED" | "WAITLISTED" }
```

结果存储在 `PredictionResult.actualResult` 和 `PredictionResult.reportedAt`。

### 6.2 校准统计

`GET /predictions/calibration` 返回分桶统计：

```json
{
  "totalPredictions": 1500,
  "withActualResults": 320,
  "calibrationBuckets": [
    { "predictedRange": "0-20%", "actualAdmitRate": 0.12, "count": 45 },
    { "predictedRange": "20-40%", "actualAdmitRate": 0.28, "count": 87 },
    { "predictedRange": "40-60%", "actualAdmitRate": 0.52, "count": 93 },
    { "predictedRange": "60-80%", "actualAdmitRate": 0.71, "count": 64 },
    { "predictedRange": "80-100%", "actualAdmitRate": 0.89, "count": 31 }
  ]
}
```

**目标**: 每个桶的 `actualAdmitRate` ≈ 桶的中位预测值（CollegeVine 标准）。

### 6.3 校准迭代路线

| 阶段   | 数据量       | 动作                     |
| ------ | ------------ | ------------------------ |
| 冷启动 | <100 结果    | 监控偏差，不调整         |
| 早期   | 100-500 结果 | 按桶调整 baseRate 偏移量 |
| 稳定期 | 500+ 结果    | 自动校准系数 + A/B 测试  |

---

## 7. 数据模型

### PredictionResult (Prisma Schema)

```prisma
model PredictionResult {
  id              String    @id @default(cuid())
  profileId       String
  profile         Profile   @relation(...)
  schoolId        String
  probability     Decimal   @db.Decimal(5, 4)   // 0.0000 - 1.0000
  probabilityLow  Decimal?  @db.Decimal(5, 4)   // 置信区间下界
  probabilityHigh Decimal?  @db.Decimal(5, 4)   // 置信区间上界
  factors         Json                           // PredictionFactor[]
  modelVersion    String    @default("v2")
  tier            String?                        // reach / match / safety
  confidence      String?                        // low / medium / high
  engineScores    Json?                          // { stats, ai, historical, weights, fusionMethod }
  suggestions     Json?                          // string[]
  comparison      Json?                          // PredictionComparison
  actualResult    String?                        // ADMITTED / REJECTED / WAITLISTED
  reportedAt      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @default(now()) @updatedAt

  @@unique([profileId, schoolId])
  @@index([profileId])
  @@index([schoolId])
  @@index([modelVersion])
  @@index([actualResult])
}
```

### EngineScores (JSON 结构)

```typescript
{
  stats: number;          // 统计引擎概率
  ai?: number;            // AI 引擎概率 (可选)
  historical?: number;    // 历史数据概率 (可选)
  memoryAdjustment?: number; // 记忆微调值
  weights: Record<string, number>; // 各引擎权重
  fusionMethod: string;   // weighted_ensemble_3 | weighted_ensemble_2_ai | ...
}
```

---

## 8. API 端点

### 8.1 运行预测

```
POST /api/v1/predictions
Authorization: Bearer <token>

Request:
{
  "schoolIds": ["clxx...", "clyy..."],
  "forceRefresh": true  // 可选，跳过缓存
}

Response:
{
  "results": [PredictionResultDto],
  "processingTime": 2340
}
```

### 8.2 获取历史

```
GET /api/v1/predictions/history
Authorization: Bearer <token>

Response: PredictionResult[]
```

### 8.3 报告实际结果

```
PATCH /api/v1/predictions/:schoolId/result
Authorization: Bearer <token>

Request:
{ "result": "ADMITTED" | "REJECTED" | "WAITLISTED" }

Response:
{ "success": true, "message": "Result recorded for calibration" }
```

### 8.4 校准数据

```
GET /api/v1/predictions/calibration

Response:
{
  "totalPredictions": number,
  "withActualResults": number,
  "calibrationBuckets": [{ predictedRange, actualAdmitRate, count }]
}
```

---

## 9. 前端展示

### 9.1 结果卡片

每个学校的预测结果卡片包含：

| 区域     | 内容                                               |
| -------- | -------------------------------------------------- |
| 头部     | 学校名称 + Tier 标签 (冲刺/匹配/保底) + 置信度标签 |
| 概率     | 大字体概率 + 置信区间文本 (如 "区间: 28-42%")      |
| 概率条   | Progress bar + 半透明置信区间叠加层                |
| 因素     | 彩色标签 (绿色=正面、红色=负面、灰色=中性)         |
| 展开面板 | 改进建议 + 引擎明细 (统计/AI/历史 各自概率和权重)  |

### 9.2 引擎明细面板

展开后显示三引擎的独立概率和权重：

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ ⚡ 统计引擎  │  │ 🧠 AI 引擎  │  │ 📊 历史数据  │
│   35%       │  │   28%       │  │   32%       │
│  (权重: 25%)│  │  (权重: 40%)│  │  (权重: 35%)│
└─────────────┘  └─────────────┘  └─────────────┘
```

---

## 10. 行业对标

| 指标        | CollegeVine      | 本平台 v2           | 差距                       |
| ----------- | ---------------- | ------------------- | -------------------------- |
| 评估因素数  | 75+              | ~15                 | 需扩展文书/推荐信/面试因素 |
| 覆盖学校数  | 1500+            | 100+                | 持续扩展                   |
| 历史数据量  | 数千真实结果     | 冷启动中            | 需激励用户报告结果         |
| 校准精度    | ±3%              | 待验证              | 需积累数据                 |
| 置信区间    | 有               | 有                  | ✅ 对齐                    |
| 多引擎融合  | 是 (proprietary) | 是 (3 引擎)         | ✅ 对齐                    |
| 记忆/个性化 | 有限             | 深度集成            | ✅ 超越                    |
| 实时更新    | 年度更新         | 实时 (forceRefresh) | ✅ 超越                    |

---

## 11. 配置参考

### 11.1 引擎权重

```typescript
const ENGINE_WEIGHTS = {
  full: { stats: 0.25, ai: 0.4, historical: 0.35 },
  noHistory: { stats: 0.35, ai: 0.65 },
  noAi: { stats: 0.45, historical: 0.55 },
  statsOnly: { stats: 1.0 },
};
```

### 11.2 置信区间

```typescript
const CONFIDENCE_INTERVAL_WIDTH = {
  high: 0.08, // ±4%
  medium: 0.14, // ±7%
  low: 0.22, // ±11%
};
```

### 11.3 缓存配置

| 缓存项   | Key 格式                            | TTL     |
| -------- | ----------------------------------- | ------- |
| 预测结果 | `prediction:{profileId}:{schoolId}` | 1 小时  |
| 历史分布 | `school:distribution:{schoolId}`    | 24 小时 |

---

## 12. 未来规划

| 优先级 | 项目         | 说明                             | 预期影响     |
| ------ | ------------ | -------------------------------- | ------------ |
| P1     | 文书质量因子 | 接入 Essay AI 评分 (类 CAPS EQI) | 准确率 +5%   |
| P1     | 批量并行预测 | Promise.all 替代 for loop        | 延迟 -60%    |
| P2     | 推荐信因子   | 推荐信强度评估                   | 准确率 +3%   |
| P2     | 自动校准系数 | 基于历史结果自动调整 baseRate    | 校准精度 +2% |
| P3     | A/B 测试框架 | 多模型版本对比                   | 持续优化     |
| P3     | 贝叶斯更新   | 随数据积累动态调整先验           | 长期精度提升 |

---

_本文档遵循 [DOCUMENTATION_STANDARDS.md](DOCUMENTATION_STANDARDS.md) 规范_
_关联 ADR: [ADR-0008](adr/0008-prediction-multi-engine-ensemble.md)_
_关联文档: [SCORING_SYSTEM.md](SCORING_SYSTEM.md) | [ENTERPRISE_MEMORY_SYSTEM.md](ENTERPRISE_MEMORY_SYSTEM.md)_
