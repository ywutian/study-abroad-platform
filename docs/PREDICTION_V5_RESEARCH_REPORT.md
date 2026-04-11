# 预测系统 v5 架构重构研究报告

**基于 ML-Primary 与认知摩擦机制的下一代升学概率引擎**

> 状态: 设计完成，待实施
> 日期: 2026-04-04
> 关联 ADR: [ADR-0016](adr/0016-prediction-ml-primary-architecture.md)
> 关联计划: `.claude/plans/cheerful-launching-whistle.md`
> 审查轮次: 6 轮（4 轮深层漏洞审查 + 2 轮 Agent 并行探索）

---

## 1. 引言与架构演进背景

在高等教育招生预测与升学概率建模领域，长久以来存在着两种截然不同的技术路线：一种是高度依赖不透明的启发式规则与庞杂的人工经验设定，此种方法往往导致评估标准的前后不一致与潜在的系统性偏见；另一种则是近年来兴起的盲目整合大型语言模型（LLM）的趋势，试图利用自然语言处理的泛化能力来取代统计建模，但这却以牺牲概率论的严谨性与预测的稳定性为代价。

当前系统（v4 版本）在实际运行中所采用的四引擎集成（4-Engine Ensemble）架构，正逐渐暴露出深层的统计学与工程学结构性缺陷。具体而言：

- 各底层引擎之间缺乏严格的统计独立性
- LLM 引擎直接处理连续概率数字，频繁出现数值锚定效应与"幻觉"现象
- 大量使用基于人工经验调节的乘法修饰符，在极端特征时产生突破概率空间上下限的结果

经过对近期八篇核心学术文献及两个行业领先商业产品的系统性调研，v5 架构确立 **ML-Primary（机器学习为主导）** 的核心发展方向：

1. 申请人特征被解构为四维结构化数据（SAS、EQI、EIS、RFS）
2. 数据进入渐进式机器学习管线（Tier 0 至 Tier 4）
3. 在对数赔率空间内施加文献实证的政策与身份修饰符（Hook Modifiers）
4. 经过 Beta 正则化校准层后输出最终概率区间
5. LLM 严格隔离在定量计算之外，唯一职责是生成解释性文本

---

## 2. 核心架构设计原则

### 2.1 ML 模型为唯一概率预测引擎

机器学习模型必须成为系统中唯一的定量概率发生器。LLM 的能力被精确收敛于"翻译器"角色，接收 ML 模型的可解释性特征贡献值（如 Shapley 值），将其转化为用户反馈建议。

### 2.2 修饰符的对数赔率空间映射

所有分类修饰符必须首先转换为优势比（Odds Ratio），继而取自然对数转换为 Log-odds 偏移量。这确保了多重极端特征的叠加永远符合统计学公理。

### 2.3 政策冲击的动态非 i.i.d. 建模

当配额制度打破独立同分布假设时，系统引入动态的政策冲击模型与阶跃函数惩罚机制。

### 2.4 自适应校准栈

统一部署 Beta 校准（唯一同时提升 Log-loss 和 AUC-ROC 的方法），辅以小样本下的 Platt Scaling。Venn-Abers 因 CPU +139.5% 和 AUC 衰减被废弃。

### 2.5 脚手架式认知摩擦

在高风险节点强制人工审查，通过盲审、计算型魔鬼代言人辩论和陷阱测试强制深层分析。

---

## 3. 特征工程：CAPS 与 RFS 的多维结构化解构

### 3.1 学术能力维度 (SAS)

基于 CAPS 框架 (Zeng & Shen, 2025) 的实证权重：

| 特征     | CAPS 权重  | 实现                                |
| -------- | ---------- | ----------------------------------- |
| GPA      | **0.3732** | normalizeGpa()                      |
| 课程难度 | **0.2626** | apCount + ibScore + curriculum type |
| SAT/ACT  | **0.1486** | percentile in school range          |
| 成绩趋势 | 0.0736     | gpa9-12 斜率拟合                    |
| 英语水平 | 0.0420     | TOEFL/IELTS normalized              |

### 3.2 文书质量维度 (EQI) — NLI 验证的二进制标签

基于《LLMs Do Not Grade Essays Like Humans》(2026.03) 的发现，LLM 不给文书打分，只提取离散二进制标签 + 证据片段 → NLI 模型验证。

### 3.3 课外活动维度 (EIS) — 四级系统 + Spike Coherence

复用 CollegeVine 4-tier 体系，新增非线性 Spike Coherence 乘子（focus ratio > 0.6 奖励，< 0.3 惩罚）。

### 3.4 关系信号维度 (RFS) — 三类关系 ML 特征化

高中 Feeder（自动检测 + Admin 确认）、机构合作（InstitutionPartnership 新模型）、顾问渠道（CounselorChannel 新模型）。12 个新特征，特征向量 ~50 → ~62。

---

## 4. 预测引擎：渐进式 Tier 0-4

| Tier | 数据量    | 模型                                       | 说明                  |
| ---- | --------- | ------------------------------------------ | --------------------- |
| 0    | < 50      | Bayesian LR with informed priors           | 冷启动，CAPS 权重主导 |
| 1    | 50-199    | Platt/Beta calibration on heuristic        | 校准启发式            |
| 2    | 200-999   | LR (basic ~15 features)                    | 基础模型              |
| 3    | 1000-4999 | LR (full ~50 features) + interaction terms | 全量 + 交互           |
| 4    | 5000+     | GBDT per selectivity band                  | 黄金标准              |

Cornell GBDT 研究 (Lee et al., 2023) 证实：GBDT 的 Top Pool 在 URM/性别/Legacy 比例上比 SAT-heuristic 更贴近真实录取。

---

## 5. Log-odds 调节器：文献实证系数

### 5.1 Arcidiacono 实证

Legacy OR = **8.5x** (log-odds +2.14)，Athlete OR = **5,000x**。ALDC 占白人录取 43%。

### 5.2 ED 独立 base rate

使用学校公布的 ED 录取率，而非 log-odds 微调。无公布数据时按 selectivity band 回退（OR ~2.0-3.0x）。

### 5.3 配额阶跃函数

动态检测名额使用率（fill rate），0.8+ 重度惩罚，1.0 接近阻断。含 `isCompactSignatory` 签约开关。

### 5.4 时效衰减

所有文献系数附带年衰减率（默认 10%），无新数据时自动衰减。年度 CDS 更新工作流。

---

## 6. Beta 校准栈

### 6.1 Venn-Abers 废弃论证

TabArena 2026：CPU +139.5%，>50% 场景 AUC 衰减。

### 6.2 Beta 校准确立

唯一同时提升 Log-loss (67.1% 胜率) 和 AUC-ROC (+0.062%) 的方法。CPU 仅 -0.42%。

### 6.3 贝叶斯正则化

正样本 < 10% 时自动增加 L2 正则强度，防止小样本过拟合。

---

## 7. 认知摩擦与人工工作流

### 7.1 自动化偏见防护

基于 Yu Shen 等 (2026) 关于认知代理权沦丧的研究：

- 盲审对照（隐藏模型推荐和 LLM 解释）
- 计算型魔鬼代言人（生成对立论点 + 数据证据）
- 陷阱测试（5% 混入已知错误）
- 审批率监控（连续 20 次全批准 → flag）

### 7.2 八个不可自动化环节

Outcome 验证、ML 模型升级、校准参数、School drift、Hook 系数、Essay 审核、新学校数据、Policy 发布。

---

## 8. 数据工作流与分层实施

### 8.1 前期数据采集：校园代理问卷

校园代理向已拿到录取结果的学长学姐发放问卷。双渠道：外部问卷 CSV 导入 + 平台内置"录取经验分享"页面。活动/奖项自动匹配 ActivityTemplate/Competition → 自动赋 tier。

### 8.2 分层实施

| 层      | 内容                                                                                         | 时间   |
| ------- | -------------------------------------------------------------------------------------------- | ------ |
| L1 核心 | ML-Primary + Beta 校准 + Log-odds hooks + Major-specific base rate + Feature flag + 闭环修复 | 2-3 周 |
| L2 增强 | Spike coherence + EQI + 配额阶跃 + CAPS 权重 + 认知摩擦 + 关系信号                           | 2-3 周 |
| L3 前沿 | NLI 验证 + MNAR 调整 + 公平性审计 + Beta-TabPFN + Hook 衰减 + 魔鬼代言人                     | 持续   |

---

## 参考文献

1. Arcidiacono et al. — SFFA v. Harvard Expert Report
2. Lee et al. — Cornell GBDT (L@S 2023)
3. Priyadarshini et al. — UCI ICNN + LIME (arxiv 2401.11698, 2024)
4. Zeng & Shen — CAPS 框架 (2025)
5. Abbadi et al. — LLM Fairness + Stacked Ensemble (2025)
6. PMC 2025 — ML-Based Admission, RF Brier 0.15
7. CollegeVine — 75 因素, 4-tier, 84.38% 准确率
8. Naviance — J. Labor Economics, 向下匹配 +50%
9. SFFA Post-Decision Data — IPEDS 2025-2026
10. TabArena 2026 — Beta vs Venn-Abers 大规模基准
11. 《LLMs Do Not Grade Essays Like Humans》(2026.03)
12. EU AI Act / EDPS — 人在回路认知摩擦
13. Yu Shen et al. — Cognitive Agency Surrender (2026)
14. MAIHDA — 交叉性定量分析
15. Beta-TabPFN — 小样本表格基础模型
16. PAA — 同义重写对抗攻击
17. Fairness Gerrymandering — 子群公平性审计

---

_本文档遵循 [DOCUMENTATION_STANDARDS.md](DOCUMENTATION_STANDARDS.md) 规范_
_关联 ADR: [ADR-0016](adr/0016-prediction-ml-primary-architecture.md)_
_关联文档: [PREDICTION_SYSTEM.md](PREDICTION_SYSTEM.md) | [SCORING_SYSTEM.md](SCORING_SYSTEM.md)_
