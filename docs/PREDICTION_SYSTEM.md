# 录取预测系统技术文档 (Served v3 / Workflow v4)

> 最后更新: 2026-04-10
> Served model version: `v3-enterprise`
> Policy version: `prediction-policy-2026-04-03.v4`
> 状态: 现网 `v3 served`，`v4 workflow` 文档/治理迁移中

---

## 目录

1. [系统概述](#1-系统概述)
2. [v4 Workflow 与兼容期](#2-v4-workflow-与兼容期)
3. [架构设计](#3-架构设计)
4. [多引擎融合](#4-多引擎融合)
5. [记忆系统集成](#5-记忆系统集成)
6. [置信区间](#6-置信区间)
7. [准确率校准闭环](#7-准确率校准闭环)
8. [数据模型与 Served Trace](#8-数据模型与-served-trace)
9. [API 端点与兼容约束](#9-api-端点与兼容约束)
10. [前端展示](#10-前端展示)
11. [行业对标](#11-行业对标)
12. [配置参考](#12-配置参考)
13. [未来规划](#13-未来规划)

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

| 版本          | 发布日期   | 核心变更                                                                                                                   |
| ------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| v1            | 2026-01    | 单一 AI 预测 + stats fallback                                                                                              |
| v2-ensemble   | 2026-02-09 | 三引擎融合 + 记忆集成 + 置信区间 + 校准闭环                                                                                |
| v3-enterprise | 2026-03    | Stats + AI + Historical + ML served 融合，`modelVersion` 统一为 `v3-enterprise`                                            |
| v4-workflow   | 2026-04    | 引入 policy version、served trace、outcome label、observation/active signal 治理层                                         |
| v5-ml-primary | 计划中     | ML 单一引擎（非 4 引擎 ensemble）；LLM 退出概率计算改为纯解释；Beta/Venn-Abers 校准；文献驱动 hook 系数 + 认知摩擦人工审核 |

### 1.3 当前现网事实

- **当前真正对用户提供结果的 served contract 仍然是 v3**：
  - 服务端常量 `MODEL_VERSION = 'v3-enterprise'`
  - 前端与移动端仍主要消费 `probability / probabilityLow / probabilityHigh / confidence / tier / engineScores / modelVersion`
- **v4 不是“已经全面替换 v3 的新公开 API”**，而是：
  - 一套新的 workflow / policy / observability 语义层
  - 用于约束如何解释结果、如何记录 trace、如何接纳 outcome 和信号
  - 在兼容期内先以文档、治理、审计和 admin/离线分析路径落地
- **兼容期原则**：
  - `modelVersion` 继续表示“当前真正对用户提供结果的引擎版本”
  - `policyVersion` 表示“解释与治理规则版本”，不能替代 `modelVersion`
  - 如果某条预测当前仍由 `v3-enterprise` 提供结果，也可以按 `prediction-policy-2026-04-03.v4` 的规则记录和解释

### 1.4 参考标准与文献综述

> 最后更新: 2026-04-04。基于 10 篇核心学术/行业文献的系统调研。

#### 核心学术文献

| #   | 文献                                                              | 方法论                                                                      | 核心发现 / 借鉴点                                                                                                               |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Arcidiacono et al.** (SFFA v. Harvard Expert Report, 2018-2023) | 条件逻辑回归，控制 SAT/种族/性别                                            | Legacy OR=**8.5x**，Recruited Athlete OR=**5,000x**，ALDC 占白人录取 43%。所有 hook 量化的基准。                                |
| 2   | **Lee et al.** (Cornell, L@S 2023)                                | GBDT vs SAT-heuristic 对比                                                  | GBDT 显著优于 SAT 启发式；Top Pool 的 URM/性别/Legacy 比例更贴近人类招生委员会决策。确立树模型在 holistic review 中的统治地位。 |
| 3   | **Priyadarshini et al.** (UCI, arxiv 2401.11698, 2024)            | ICNN + FF NN + LIME，4,442 份 UC 系统 CS 申请                               | AUC 0.81，Essay 用 NLP 特征（Flesch readability, sentiment, 字数），LIME 提供特征归因。可解释深度学习的标杆。                   |
| 4   | **Zeng & Shen** (CAPS 框架, 2025)                                 | SAS+EQI+EIS 三维分解，凸组合权重 `w = 0.3×w_log + 0.3×w_xgb + 0.4×w_expert` | GPA 权重 **0.3732**，课程难度 **0.2626**，SAT 仅 **0.1486**。多样性奖励最高 12 分。多模态融合的最高水准。                       |
| 5   | **Abbadi et al.** (LLM 增强 + 公平性审计, 2025)                   | Stacked Ensemble + GPT-4 文书评分 + 公平性审计                              | 准确率 91%，LR 基线 89.5%。发现 9% 性别差异 + 11% 父母教育程度鸿沟。公平性审计必须是 pipeline 强制环节。                        |
| 6   | **PMC 2025** (ML-Based Admission Decisions)                       | LR/ElasticNet/RF + 三种校准方法对比                                         | RF Brier **0.15**，Isotonic > Platt > Beta 校准（在该数据集上）。校准方法选择取决于数据分布。                                   |

#### 行业产品与政策研究

| #   | 文献                                                         | 方法论                                   | 核心发现 / 借鉴点                                                                                                           |
| --- | ------------------------------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 7   | **CollegeVine** (技术博客 + 产品分析)                        | 75 因素 ML 模型，4-tier 活动系统         | 校准 ±3%，84.38% 准确率，不含 essay/rec/legacy/ED。数十万条真实录取结果训练。                                               |
| 8   | **Naviance 行为研究** (J. Labor Economics, 2021)             | 双变量散点图，220 所高中 70,000 名申请人 | 使用 Naviance 导致高成就学生 **向下匹配增加 50%**（2.1-2.2x odds）。二维工具的致命结构缺陷。                                |
| 9   | **SFFA Post-Decision Data** (IPEDS 2025-2026)                | 自主政策评估                             | 亚裔入学 **+1.04pp**（p<0.001），URM 仅 **-0.67pp**（p=0.044），白人 **-1.63pp**（p=0.012）。"录取错觉"现象。               |
| 10  | **Beta Calibration & Venn-Abers** (TabArena 2026 大规模基准) | 21 种分类器 + 多种校准方法               | Beta 校准 Log-loss 改善频率最高且 CPU 仅 -0.42%。Venn-Abers Log-loss 平均降幅最大但 CPU +139.5% 且 >50% 场景 AUC 轻微衰减。 |

#### 补充参考

| 文献                                                   | 说明                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **Compact for Academic Excellence** (白宫, 2025.10)    | 提出国际本科生 ≤15%、单国 ≤5% 硬性配额                                                   |
| **Post-SFFA 级联效应研究** (2026 初)                   | 300 万新生数据：URM 从 Ivy 向 State Flagship 流动，各 Tier 竞争池结构突变                |
| **TabPFN** (表格基础模型, 2024-2026)                   | 小样本 (n<100) 已超越 GBDT/LR 的预训练表格模型                                           |
| **EU AI Act / EDPS 人在回路研究** (2025-2026)          | "认知摩擦"对抗自动化偏见；高度流畅的 AI 解释反而加剧自动化信任 → 盲审时必须隐藏 LLM 解释 |
| **《LLMs Do Not Grade Essays Like Humans》** (2026.03) | LLM 偏好短文、惩罚有瑕疵长文 → 文书不能用 LLM 打分，改为二进制标签提取                   |
| **Beta-TabPFN** (2026)                                 | 原生 TabPFN 推理 5.5x 慢 + 高维退化 → 必须用 Encoder 降维的 Beta-TabPFN 变体             |
| **MAIHDA 交叉性模型** (定量社会学 2026)                | log-odds 加法无法捕捉多重身份交叉非线性效应 → 用 ML 交互特征替代                         |
| **计算型魔鬼代言人** (HCI/AI 治理 2026)                | 简单隐藏答案导致认知技能退化 → 系统生成对立论点强迫辩论                                  |
| **级联效应研究** (2024-2026)                           | Top 10 名额耗尽 → 高分学生向 Top 20-40 级联 → 需要跨校 ED surge 指标                     |
| **PAA 对抗攻击研究** (LLM-as-Reviewer Security, 2026)  | 同义重写可精准触发 LLM 分类阈值 → 需要 Span Extraction + NLI 验证                        |
| **Fairness Gerrymandering** (算法公平性审计, 2026)     | 手动交互特征只保护显式群体 → 需要自动子群搜索审计                                        |
| **支架式认知摩擦** (HCI/MAS, 2026)                     | 静态字数限制导致认知吝啬退化 → 后台 LLM 验证回复实质性                                   |

### 1.5 Prediction × AI Agent 集成口径

- **prediction 不是独立 agent**。用户侧所有预测分析都归属 `school agent`。
- 当前 AI 接入分三层看：
  - `served v3-enterprise`：真正提供给用户的预测结果
  - `workflow v4`：解释、治理、trace、outcome、policy 语义层
  - `v5 ML-primary`：shadow / future-served，不直接进入当前用户回答
- prediction 相关 UI 会把结构化 context 注入 `/ai-agent/chat`：
  - `prediction-results`
  - `selected-schools`
- 当前已接入的入口：
  - prediction 页面 AI actions
  - 学校详情页个人预测 CTA
  - profile 里的选校/预测学校 CTA
- conversation 会持久化最近一次 prediction context 摘要，供后续追问继续消费；这条 UI context 也会写成 `prediction_ui_context` memory。
- **重要边界**：
  - UI context 只用于后续对话理解
  - 不作为 calibration truth
  - 不作为训练真值
  - 不作为 policy gate 输入
- school agent 对用户解释预测时，只能使用公开安全字段：
  - `sourceSummary`
  - `uncertaintyReasons`
  - `confidenceReason`
  - `roundContext`
  - `latestOutcomeLabel`
- raw `servedTrace`、shadow 结果、内部 policy/challenger 细节仍属于 admin / audit / offline analysis 范围。

---

## 2. v4 Workflow 与兼容期

### 2.1 v4 workflow 的四个新增语义

#### `policyVersion`

- **定义**：解释预测结果、信号处理、outcome 归一化和审计落表时采用的治理版本。
- **当前文档默认值**：`prediction-policy-2026-04-03.v4`
- **边界**：
  - `policyVersion` 不是模型权重版本
  - `policyVersion` 也不是前端应该直接展示给普通用户的字段
  - 在兼容期内，它优先属于 admin / audit / offline analysis / served trace 语义

#### `servedTrace`

- **定义**：每次真正向用户返回预测结果时应保留的一份最小可审计轨迹。
- **目的**：
  - 区分“真正 served 的结果”和 shadow/challenger 的内部比较结果
  - 在兼容期内，给 v3 结果补上 v4 的治理语义，而不要求立刻改公开 API
- **最小建议字段**：

```json
{
  "traceId": "pred_xxx",
  "servedAt": "2026-04-03T00:00:00.000Z",
  "modelVersion": "v3-enterprise",
  "policyVersion": "prediction-policy-2026-04-03.v4",
  "source": "prediction",
  "fusionMethod": "weighted_ensemble_4_stats_ai_hist_ml",
  "selectivityBand": "global | <band>",
  "servedProbability": 0.36,
  "confidenceLevel": "medium",
  "tier": "match",
  "outcomeLabel": null,
  "signalSummary": {
    "observation": [],
    "active": []
  }
}
```

#### `outcomeLabel`

- **定义**：统一的预测结果真实结果标签。
- **v4 canonical set**：
  - `ADMITTED`
  - `REJECTED`
  - `WAITLISTED`
  - `DEFERRED`
  - `WITHDRAWN`
  - `UNKNOWN`
- **兼容期要求**：
  - 旧数据和旧接口仍可能只出现 `ADMITTED / REJECTED / WAITLISTED / UNKNOWN`
  - v4 语义层必须先做归一化，不能要求旧客户端立刻改 payload
  - 前端展示和校准分析都应以 canonical label 为准，而不是靠散落枚举自行猜

#### `observation / active signal`

- **Observation signal（观察信号）**
  - 被动行为
  - 例如：重复查看某学校预测、进入学校详情、打开 compare、重复刷新 prediction 页面
  - 在兼容期内，这类信号**可以入 trace / audit / analytics**，但**不能单独改变 served probability**
- **Active signal（主动信号）**
  - 用户明确表达的动作
  - 例如：报告真实录取结果、修正 GPA/标化/活动后重新生成预测、明确更新目标学校列表
  - 在兼容期内，只有 active signal 才能进入校准与结果闭环

### 2.2 兼容期规则

| 维度               | 兼容期规则                                         |
| ------------------ | -------------------------------------------------- |
| Served result      | 继续由 `v3-enterprise` 提供                        |
| Public API         | 继续返回当前 `PredictionResultDto` 形状            |
| `modelVersion`     | 继续表示 served engine version                     |
| `policyVersion`    | 先用于文档、审计、admin/离线分析，不强行暴露给用户 |
| `servedTrace`      | 先作为治理与审计产物，不要求旧客户端消费           |
| `outcomeLabel`     | 以 canonical set 统一解释旧 `actualResult`         |
| Observation signal | 记录，不直接校准                                   |
| Active signal      | 可触发校准、复算或后续分析                         |

### 2.3 v3 → v4 的上线方式

- **阶段 A：served 保持 v3，治理按 v4**
  - 现网先不改变公开 API 和普通用户页面协议
  - 先统一文档、trace、outcome label 和信号解释
- **阶段 B：shadow / challenger 并行**
  - 利用现有 shadow/champion 机制并行观察，不影响 served 结果
- **阶段 C：选择性暴露 v4 元信息**
  - 优先给 admin、audit、calibration 面板使用
- **阶段 D：公开 API 才考虑引入显式 `policyVersion` / `servedTrace` 字段**
  - 必须先完成跨端兼容评审，不在本轮文档迁移内

### 2.4 2026-04-03 当前已落地的 v4 operability

- backend canonical 已统一：
  - DB/internal 使用 `policyVersionId`
  - DB/internal 使用 `applicationRound`
  - `servedPolicyVersionId` 只作为 response alias
- `PredictionResult` / `PredictionSnapshot` 当前已持久化：
  - `policyVersionId`
  - `servedTrace`
  - `sourceSummary`
  - `uncertaintyReasons`
  - `confidenceReason`
- outcome workflow 当前已是双轨：
  - 旧字段 `actualResult` 继续兼容
  - `PredictionOutcomeLabelRecord` 保存历史事实
  - `PredictionResult.outcomeLabel` 保存当前 canonical label
- admin workflow hub 已落在 `/admin/calibrations`：
  - `workflow`
  - `policies`
  - `outcomes`
  - 现阶段是 operability-first 的后台入口，不改变用户侧 prediction 主流程
- whole-policy release skeleton 当前已可运行：
  - `DRAFT -> CANDIDATE -> SHADOW -> ACTIVE -> RETIRED`
  - shadow metrics 第一版已按 `cohort × round × selectivity band` 聚合
  - 结果写入 `PredictionPolicyVersion.monitoringConfig.shadowMetrics`
- 当前还**没有**发生的事：
  - numeric core 还没有切到 `cohort × school × round + drift + relationship`
  - whole-policy shadow 还不是完整监控大盘，只是 release skeleton
  - admin UI 目前只覆盖 review/activate/rollback/workflow，不是完整运营系统

---

## 3. 架构设计

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
│  3. 对每个学校，并行执行 served 引擎:         │
│     ┌─────────────┐                          │
│     │ 引擎 1      │ 统计算法 (always)        │
│     │ 引擎 2      │ AI 分析 (may fail)       │
│     │ 引擎 3      │ 历史案例匹配 (if data)   │
│     │ 引擎 4      │ ML champion (if exists)  │
│     └─────────────┘                          │
│                                               │
│  4. 动态加权融合 + 记忆微调                  │
│  5. （可选）shadow model 并行对照            │
│  6. 置信区间计算 + served trace 组装         │
│  7. Tier 分类 + 建议生成                     │
│                                               │
│  8. 保存:                                    │
│     ├─ Redis 缓存 (1h)                       │
│     ├─ PredictionResult 表 (持久化)          │
│     ├─ 记忆系统 (增强写入)                   │
│     └─ Monitor / shadow metrics              │
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
│   └── prediction-response.dto.ts  # PredictionResultDto + EngineScores + PredictionFactor + PredictionComparison + PredictionResponseDto
└── utils/
    ├── prompt-builder.ts           # AI Prompt 构建
    └── score-calculator.ts         # → re-exports from common/utils/scoring.ts
```

### 3.3 依赖关系

```
PredictionModule
  ├── PrismaService       (数据库)
  ├── LLMService          (OpenAI / provider abstraction)
  ├── RedisService        (缓存)
  ├── MemoryManagerService  (可选, AI 记忆)
  ├── ModelRegistryService  (champion / shadow)
  ├── ShadowEvaluatorService (served vs shadow 对照)
  └── ModelMonitorService   (drift / ECE / growth)
```

---

## 4. 多引擎融合

### 3.1 引擎概览

| 引擎             | 数据源                      | 可用性          | 输出                                |
| ---------------- | --------------------------- | --------------- | ----------------------------------- |
| **统计引擎**     | Profile + School metrics    | Always          | 0-1 概率 + factors                  |
| **AI 引擎**      | GPT-4o-mini 专家分析        | 可能失败 → null | 0-1 概率 + factors + suggestions    |
| **历史数据引擎** | AdmissionCase 录取案例      | 需 ≥10 案例     | 0-1 概率 + sampleCount + confidence |
| **ML 引擎**      | champion model / band model | 需有 champion   | 0-1 概率 + contribution / tier      |

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

## 5. 记忆系统集成

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

## 6. 置信区间

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

## 7. 准确率校准闭环

闭环运营与每周审核节奏见 [`PREDICTION_CLOSED_LOOP_SOP.md`](./PREDICTION_CLOSED_LOOP_SOP.md)。

### 7.1 Outcome label 与数据收集

兼容期内，公开 API 仍然可能以旧示例展示结果上报；但文档层统一按 `outcomeLabel` 解释和归一化。

**Canonical labels**:

```text
ADMITTED | REJECTED | WAITLISTED | DEFERRED | WITHDRAWN | UNKNOWN
```

当前 `PredictionResult.actualResult` 仍是自由字符串字段，因此 v4 workflow 的要求是：

- 先做 canonical normalization
- 再进入 calibration / audit / served trace
- 不能把旧数据的空值、未知值、未报告状态混成“拒绝”

### 7.2 Active signal：显式结果回报

用户可以通过 `PATCH /predictions/:schoolId/result` 报告实际录取结果：

```json
{ "result": "ADMITTED" | "REJECTED" | "WAITLISTED" }
```

结果存储在 `PredictionResult.actualResult` 和 `PredictionResult.reportedAt`。

在兼容期内，这属于 **active signal**，可以进入：

- 校准统计
- shadow/champion 对照复核
- served trace 的 `outcomeLabel`

### 7.3 Observation signal：只记录、不直接校准

以下行为应视为 **observation signal**：

- 重复查看某学校预测
- 打开学校详情 / 学校对比
- 重跑 prediction 但未更新档案
- 查看建议但未做任何明确确认

兼容期规则：

- observation signal 可以进入 analytics / trace / audit
- observation signal 不能单独改变 served probability
- 只有与 active signal 结合后，才能作为后续 policy 调整依据

### 7.4 校准统计

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

### 7.5 校准迭代路线

| 阶段   | 数据量       | 动作                     |
| ------ | ------------ | ------------------------ |
| 冷启动 | <100 结果    | 监控偏差，不调整         |
| 早期   | 100-500 结果 | 按桶调整 baseRate 偏移量 |
| 稳定期 | 500+ 结果    | 自动校准系数 + A/B 测试  |

---

## 8. 数据模型与 Served Trace

### 8.1 当前公开 / 持久化契约

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
  modelVersion    String    @default("v3-enterprise")
  tier            String?                        // reach / match / safety
  confidence      String?                        // low / medium / high
  engineScores    Json?                          // { stats, ai, historical, weights, fusionMethod }
  suggestions     Json?                          // string[]
  comparison      Json?                          // PredictionComparison
  actualResult    String?                        // 兼容期: legacy string，v4 解释层统一归一为 outcomeLabel
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

### 8.2 EngineScores (JSON 结构)

```typescript
{
  stats: number;          // 统计引擎概率
  ai?: number;            // AI 引擎概率 (可选)
  historical?: number;    // 历史数据概率 (可选)
  memoryAdjustment?: number; // 记忆微调值
  weights: Record<string, number>; // 各引擎权重
  fusionMethod: string;   // weighted_ensemble_3 | weighted_ensemble_2_ai | weighted_ensemble_2_hist | stats_only
}
```

### 8.3 v4 `servedTrace` 语义层

`servedTrace` 在本轮迁移中属于 **治理/审计语义**，不是已经落到公开 API 的强制字段。

建议结构：

```typescript
{
  traceId: string;
  servedAt: string;
  modelVersion: 'v3-enterprise' | string;
  policyVersion: 'prediction-policy-2026-04-03.v4' | string;
  fusionMethod: string;
  source: string;
  tier: 'reach' | 'match' | 'safety';
  confidenceLevel: 'low' | 'medium' | 'high';
  outcomeLabel?: 'ADMITTED' | 'REJECTED' | 'WAITLISTED' | 'DEFERRED' | 'WITHDRAWN' | 'UNKNOWN' | null;
  signalSummary: {
    observation: string[];
    active: string[];
  };
}
```

### 8.4 `modelVersion` 与 `policyVersion` 的分工

| 字段            | 含义                                        | 兼容期规则                                           |
| --------------- | ------------------------------------------- | ---------------------------------------------------- |
| `modelVersion`  | 当前真正 served 给用户的引擎版本            | 继续保持现网 `v3-enterprise`                         |
| `policyVersion` | 解释、trace、signal、outcome 归一化规则版本 | 可先用于 admin / audit / docs，不替代 `modelVersion` |

---

## 9. API 端点与兼容约束

### 9.1 运行预测

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

### 9.2 获取历史

```
GET /api/v1/predictions/history
Authorization: Bearer <token>

Response: PredictionResult[]
```

### 9.3 报告实际结果

```
PATCH /api/v1/predictions/:schoolId/result
Authorization: Bearer <token>

Request:
{ "result": "ADMITTED" | "REJECTED" | "WAITLISTED" }

Response:
{ "success": true, "message": "Result recorded for calibration" }
```

> 兼容期说明：
>
> - 当前公开 API 示例仍以现有实现为准。
> - `DEFERRED / WITHDRAWN / UNKNOWN` 作为 v4 canonical outcome label 可以先在治理层支持和归一化，但不要求旧客户端立即改 payload。

### 9.4 校准数据

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

## 10. 前端展示

### 10.1 结果卡片

每个学校的预测结果卡片包含：

| 区域     | 内容                                               |
| -------- | -------------------------------------------------- |
| 头部     | 学校名称 + Tier 标签 (冲刺/匹配/保底) + 置信度标签 |
| 概率     | 大字体概率 + 置信区间文本 (如 "区间: 28-42%")      |
| 概率条   | Progress bar + 半透明置信区间叠加层                |
| 因素     | 彩色标签 (绿色=正面、红色=负面、灰色=中性)         |
| 展开面板 | 改进建议 + 引擎明细 (统计/AI/历史 各自概率和权重)  |

### 10.2 引擎明细面板

### 10.3 兼容期前端原则

- 普通用户继续优先看到：
  - `个人预估录取概率`
  - `学校整体录取率`
  - `数据参考程度`
  - `冲刺 / 匹配 / 保底`
- 普通用户不直接看到：
  - 内部 `policyVersion`
  - 原始 `servedTrace`
  - shadow / challenger 细节
- admin / calibration / audit 页面可以优先消费：
  - `servedTrace`
  - `outcomeLabel`
  - `observation / active signal` 分类
- prediction 始终是概率层；学校级策略解释由 canonical `GET /profiles/me/ai-analysis` 承接，不在前端额外发明第二套概率或顾问结论。
- mobile `/prediction` 现在必须能跳转到 canonical `/profile/analysis` 视图；web/mobile 对 prediction × application analysis 的语义边界必须保持一致。

### 10.4 Application Analysis Companion Surface

- `application analysis` 是 prediction 的下游 strategy layer，不替代 prediction 的概率 contract。
- web Profile、web `uncommon-app`、mobile `/profile`、mobile `/profile/analysis`、mobile `/prediction` CTA 都应消费同一份 `AIAnalysisResult`。
- 学校级 `policyContext`、弱态、uncertainty / confidence 解释应在 web 与 mobile 上保持同义，不允许一端弱态、一端伪造确定性。
- `V2` governance 现在通过 `/admin/application-analysis-workflow` 管理 `SchoolPolicyEvidence`、`ApplicationAnalysisPolicyVersion` 与 `ApplicationAnalysisEvaluationRun`；applicant runtime 只消费 `ACTIVE` policy。
- `V3` capability runtime 通过 `ApplicationAnalysisExperimentVersion` / `ApplicationAnalysisExperimentEvaluationRun` 管理 `RECOURSE`、`UNCERTAINTY`、`FAIRNESS`。这些能力只以 `/profiles/me/ai-analysis` 的加法字段公开，且仍然以 prediction interval / probability 为底座，不额外发明概率事实层。

展开后显示三引擎的独立概率和权重：

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ ⚡ 统计引擎  │  │ 🧠 AI 引擎  │  │ 📊 历史数据  │
│   35%       │  │   28%       │  │   32%       │
│  (权重: 25%)│  │  (权重: 40%)│  │  (权重: 35%)│
└─────────────┘  └─────────────┘  └─────────────┘
```

---

## 11. 行业对标

| 指标        | CollegeVine      | 本平台 served v3 / workflow v4 | 差距                       |
| ----------- | ---------------- | ------------------------------ | -------------------------- |
| 评估因素数  | 75+              | ~15                            | 需扩展文书/推荐信/面试因素 |
| 覆盖学校数  | 1500+            | 100+                           | 持续扩展                   |
| 历史数据量  | 数千真实结果     | 冷启动中                       | 需激励用户报告结果         |
| 校准精度    | ±3%              | 待验证                         | 需积累数据                 |
| 置信区间    | 有               | 有                             | ✅ 对齐                    |
| 多引擎融合  | 是 (proprietary) | 是 (3 引擎)                    | ✅ 对齐                    |
| 记忆/个性化 | 有限             | 深度集成                       | ✅ 超越                    |
| 实时更新    | 年度更新         | 实时 (forceRefresh)            | ✅ 超越                    |

---

## 12. 配置参考

### 12.1 引擎权重

```typescript
const ENGINE_WEIGHTS = {
  full: { stats: 0.25, ai: 0.4, historical: 0.35 },
  noHistory: { stats: 0.35, ai: 0.65 },
  noAi: { stats: 0.45, historical: 0.55 },
  statsOnly: { stats: 1.0 },
};
```

### 12.2 置信区间

```typescript
const CONFIDENCE_INTERVAL_WIDTH = {
  high: 0.08, // ±4%
  medium: 0.14, // ±7%
  low: 0.22, // ±11%
};
```

### 12.3 缓存配置

| 缓存项   | Key 格式                            | TTL     |
| -------- | ----------------------------------- | ------- |
| 预测结果 | `prediction:{profileId}:{schoolId}` | 1 小时  |
| 历史分布 | `school:distribution:{schoolId}`    | 24 小时 |

---

## 13. 未来规划

### 已完成项（v4 阶段）

| 项目                      | 说明                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| Served trace 落库         | `policyVersionId / servedTrace / sourceSummary / uncertaintyReasons / confidenceReason` 已持久化 |
| Outcome label 统一        | `PredictionOutcomeLabelRecord` + canonical `outcomeLabel` 已落地                                 |
| Observation / Signal 骨架 | `Observation -> Prior/Drift/Relationship -> PolicyVersion` schema + service + admin API          |

### v5 ML-Primary 路线图

| 优先级 | 项目                  | 说明                                                                                                                       | 预期影响                      | 文献依据                  |
| ------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------- |
| **P0** | ML-Primary 架构       | 4-engine ensemble → 单一 ML 模型（Tier 0-4 渐进），AI Engine 降为解释生成器                                                | 消除 LLM 幻觉，100% 确定性    | CollegeVine, Cornell GBDT |
| **P0** | 校准闭环修复          | outcome → invalidate cache；实时 Beta / 离线 Venn-Abers                                                                    | 校准参数实时更新              | TabArena 2026             |
| **P0** | Log-odds Hook 系数    | 文献实证：Legacy +2.14, ED 独立 base rate, NeedAware 分层                                                                  | Hook 建模精度                 | Arcidiacono               |
| **P0** | 认知摩擦审核          | 强制理由 + 陷阱测试 + 盲审 + 审批率监控                                                                                    | 防止人工审核橡皮图章          | EU AI Act 研究            |
| P1     | 中国申请者精细建模    | base rate 按 selectivity band 调整 + 配额 proximity penalty                                                                | 中国学生预测准确度            | SFFA 数据                 |
| P1     | CAPS 特征工程         | SAS/EQI/EIS 三维分解，GPA 0.37 / 课程难度 0.26 / SAT 0.15                                                                  | 特征权重数据驱动              | CAPS 2025                 |
| P1     | Spike Coherence       | 活动聚类 + 非线性 coherence multiplier                                                                                     | 捕捉"尖刺型"学生优势          | CollegeVine Spike 机制    |
| P1     | Hook 系数时效衰减     | 年度 CDS 更新工作流 + decayRate 自动衰减                                                                                   | 防止静态系数过时              | 级联效应研究              |
| P1     | 关系信号接入          | Feeder/Partnership/Counselor 三类关系信号作为 ML 特征（非后处理）；新增 `InstitutionPartnership` + `CounselorChannel` 模型 | 关系驱动的录取优势量化        | Arcidiacono, CollegeVine  |
| P2     | 文书多维评分          | EssayAIResult 解析为 content depth / structure / vitality                                                                  | Essay 维度信息量提升          | UCI NLP                   |
| P2     | Major Competitiveness | 专业级别录取率作为独立特征                                                                                                 | CS@CMU vs Phil@CMU 区分       | CAPS EIS                  |
| P2     | 推荐信代理特征        | recommender type + relationship depth 作为特征                                                                             | 填补 holistic review 最大盲区 | —                         |
| P3     | TabPFN 冷启动         | Tier 0 用表格基础模型替代手调启发式                                                                                        | 小样本预测精度提升            | TabPFN 2026               |
| P3     | Demonstrated Interest | campus visit + alumni interview + Why School depth                                                                         | 中层学校（#15-50）关键因素    | CollegeVine               |
| P3     | 公平性审计            | per-demographic AUC/ECE + 强制公平性 gate                                                                                  | 合规 + 减少系统性偏差         | Abbadi 2025               |

---

_本文档遵循 [DOCUMENTATION_STANDARDS.md](DOCUMENTATION_STANDARDS.md) 规范_
_关联 ADR: [ADR-0008](adr/0008-prediction-multi-engine-ensemble.md)_
_关联文档: [SCORING_SYSTEM.md](SCORING_SYSTEM.md) | [ENTERPRISE_MEMORY_SYSTEM.md](ENTERPRISE_MEMORY_SYSTEM.md)_
