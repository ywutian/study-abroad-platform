# ADR-0016: Prediction v5 — ML-Primary Architecture

- Status: SUPERSEDED / DEFERRED by counselor-primary launch architecture (2026-05-08)
- Date: 2026-04-04
- Decision-makers: Engineering Team
- Tags: prediction, ml, architecture, calibration

> This ADR is not the current served architecture. ML-primary promotion is
> deferred until verified outcome sample size is sufficient. The launch served
> path is deterministic counselor-primary; LLM/ML work may return later as
> explanation, anomaly detection, or calibrated promotion after enough verified
> outcomes exist.

## Context

### 当前架构问题（v3-enterprise 4-engine ensemble）

1. **AI Engine 被 Stats Engine 锚定**：prompt 注入 stats 概率作为"锚点"，AI 失去独立判断能力。LLM 输出被 2.5x clamp 限制在 stats ±60% 范围内。
2. **4 引擎不独立**：Stats 和 ML 共享特征，AI 依赖 Stats 输出，Historical 仅用 GPA+SAT 两维。ensemble 的误差不相关假设不成立。
3. **后处理乘子无概率论基础**：`probability *= 1.35 (ED)` 等乘法在高概率段溢出（Harvard 强学生可达 89%）。
4. **手调权重和参数**：`academic: 0.5, activity: 0.3, award: 0.2` 和 sigmoid 的 threshold/k 均为手动设定。
5. **校准闭环断裂**：`reportActualResult()` 不失效 Platt cache（24h TTL），新 outcome 无法即时改善预测。
6. **LLM 幻觉风险**：AI Engine 直接输出概率数字，两次相同输入可能产生不同结果。

### 文献调研结论

系统调研了 10 篇核心文献和 2 个商业产品：

- **CollegeVine**（75 因素，84.38% 准确率）：单一 ML 模型 + 4-tier 活动系统，不用 LLM 做概率预测。
- **Cornell GBDT (2023)**：GBDT 显著优于 SAT-heuristic，更贴近 holistic review。
- **CAPS (2025)**：SAS/EQI/EIS 三维分解，GPA 权重 0.37，SAT 仅 0.15。
- **Arcidiacono (SFFA v. Harvard)**：Legacy OR=8.5x，Athlete OR=5,000x。
- **TabArena 2026**：Beta 校准 Log-loss 改善最频繁且 CPU 低；Venn-Abers 校准最准但 CPU +139.5% 且可能降低 AUC。
- **Post-SFFA 数据**：亚裔 +1.04pp，白人 -1.63pp。级联效应导致各 Tier 竞争池结构突变。

**核心结论**：业界和学术界**一致使用单一 ML 模型 + 结构化特征 + 校准**。无任何成功系统使用 LLM 做概率预测。

## Decision

### 架构转向 ML-Primary

1. **ML 模型升级为唯一概率预测引擎**，复用现有 Tier 0-4 渐进策略。
2. **Stats Engine 降级为特征计算器**（计算 percentile, selectivity index）。
3. **AI Engine 降级为解释生成器**（只写文字，不出数字）。
4. **Fusion Engine 废弃**（不再需要多引擎加权）。
5. **Historical Engine 转为训练数据源 + LLM 上下文提供者**。

### Hook 系数改为 log-odds 空间 + 文献实证

- ED：使用学校公布的 ED 录取率作为独立 base rate。
- Legacy：OR=8.5x（Arcidiacono），log-odds +2.14，Admin 可按学校调整 + 年度衰减。
- Need-Aware：分层（partial -0.50, full -1.00），need-blind 学校为 0。
- 所有 Hook 系数支持时效衰减（default 年衰减 10%）+ Admin 覆盖 + 审计日志。

### 校准栈分离

- **实时推理**：Platt (n<200) → Beta (n≥200)，CPU 低。
- **离线分析**：Venn-Abers（Shadow 评估 / Admin 审核用）。
- AUC 守护：校准后 AUC 衰减 >1% 自动回滚。

### 人工工作流 + 认知摩擦

8 个环节保留人工审核（Outcome 验证、模型升级、校准参数、School drift、Hook 系数、Essay 复核、新学校数据、Policy 发布），并强制：

- 填写 ≥20 字理由
- 随机陷阱测试（5%）
- 校准参数盲审
- 审批率监控（连续 20 次全批准 → flag）

### 配额政策建模

引入 quota proximity penalty 应对硬性配额政策冲击（国际生 ≤15%，单国 ≤5%）。检测到配额压力时向用户展示 uncertainty disclosure。

## Consequences

### 正面

- **100% 确定性**：相同输入 → 相同概率，无 LLM 幻觉。
- **数据驱动**：权重从 outcome 数据学习，不是手调。Tier 0-4 渐进提升。
- **文献支撑**：Hook 系数来自 Arcidiacono 等实证研究，可追溯。
- **校准闭环**：outcome → cache 失效 → 周度/触发式 refit。
- **人工护栏**：关键环节有认知摩擦机制的人工审核。
- **与业界一致**：架构方向与 CollegeVine + 学术前沿对齐。

### 负面

- **Tier 0 仍依赖启发式**：数据不足时的冷启动仍是手调公式，直到 TabPFN（Phase 2）替代。
- **特征限制**：推荐信、Demonstrated Interest 难以量化。AdmissionCase 缺 essay 数据。
- **迁移风险**：legacy→ml-primary 切换时用户看到的概率可能显著变化。需要 Shadow 验证期。
- **Hook 系数衰减假设**：年衰减 10% 是估计值，可能偏保守或激进。需要持续验证。
- **Venn-Abers 限于离线**：实时路径不享受其理论保证，但 Beta 已是次优方案。

### 中性

- **前端兼容**：`EngineScores` DTO 在 ml-primary 模式下 ai/historical 为 undefined，需要前端适配。
- **Admin 工作量增加**：认知摩擦机制增加审核负担，但这是有意设计。

## Migration

Feature flag `PREDICTION_ENGINE_MODE`: `'legacy'` → `'shadow'` → `'ml-primary'`

1. `legacy`：现有 4 引擎 ensemble（默认，安全）
2. `shadow`：两条管线并行运行，记录对比数据，返回 legacy 结果
3. `ml-primary`：新架构（目标状态），Admin 审核 Shadow 结果后批准切换

## 2026-04-04 Addendum: 深层漏洞修正（两轮审查，共 8 项）

### 第一轮（4 项）

1. **EQI 文书模块降级**：LLM 不给文书打分（《LLMs Do Not Grade Essays Like Humans》2026.03 证实 LLM 偏好短文/惩罚有瑕疵长文）。改为 LLM 提取二进制标签（contains adversity? contains research? 等），ML 赋权重。
2. **配额阶跃函数**：线性 Quota Proximity Penalty 改为阶跃函数。fillRate ≥ 1.0 时阻断（概率归零）；0.8-1.0 重度惩罚。
3. **TabPFN 必须用 Beta-TabPFN 变体**：原生 TabPFN 推理 5.5x 慢 + 50 维高维退化。需要 Encoder 降维。
4. **HITL 解释延迟**：盲审时强制隐藏 LLM 生成的 factors/suggestions。

### 第二轮（4 项）

5. **Hook 交叉效应**：废弃纯 log-odds 加法逻辑。新增交互特征（legacy×intl, firstGen×needAware, china×stem）让 ML 学习非线性效应。Tier 0 fallback 保留加法但 cap 总惩罚在 [-3.0, +3.0]。（MAIHDA 模型启发）
6. **统一 Beta 校准，废弃 Venn-Abers**：TabArena 2026 证实 Beta 是唯一同时提升 Log-loss 和 AUC-ROC (+0.062%) 的方法。Venn-Abers 在 >50% 场景降低 AUC，不适用于排序敏感的录取预测。
7. **配额级联效应**：新增跨校 ED surge 指标。同 Tier 学校 ED 录取率同比下降 >10% → RD 竞争加剧惩罚。（独立级联模型启发，工程简化为代理指标）
8. **认知摩擦升级为"计算型魔鬼代言人"**：系统不只是隐藏答案，而是主动生成与 Admin 判断对立的反面论点 + 数据证据。Admin 必须逐条回应后才能确认。（防止认知技能退化）

### 第三轮（4 项）

9. **EQI 抗 PAA 攻击**：二进制标签提取改为 Span Extraction + NLI 验证，防止同义重写对抗攻击。
10. **公平性子群自动审计**：废弃手动交互特征硬编码。离线自动枚举 2-3 维交叉群体，Brier 偏差 >5pp 时 flag。
11. **Beta 校准贝叶斯正则化**：正样本 < 10% 时自动增加 L2 正则强度，防止小样本过拟合崩溃。
12. **魔鬼代言人回复验证**：后台 LLM 实时检验 Admin 回复是否实质性回应论点，废话拒绝通过。

### 关系信号集成

13. **三类关系信号作为 ML 特征**：Feeder（自动检测 + 确认）、Partnership（新 `InstitutionPartnership` 模型）、Counselor Channel（新 `CounselorChannel` 模型）。12 个新特征，特征向量 ~50 → ~62。信号是 ML 特征输入，不是后处理乘子。
14. **配额签约开关**：`School.isCompactSignatory` 控制配额阶跃函数是否对该校生效。拒签的大学不受 5%/15% 惩罚。
15. **倒置监督修正**：废弃 LLM 验证 Admin 回复。改为纯规则检查（必须含数据引用、不能与历史回复 >80% 相似）。
16. **MNAR 报告率调整**：显式记录每校报告率，报告率 < 30% 时对正样本比例做保守下调。

---

**架构冻结**：经 4 轮 16 项深层审查后冻结。进一步理论改进记录到未来规划，不阻塞实施。

## References

见 `docs/PREDICTION_SYSTEM.md` §1.4 完整文献列表（10 篇核心 + 11 篇补充）。
