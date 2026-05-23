# Lumni 技术路线预估（2026）

> **用途**：提前做资源、路线与对外表述的预估。  
> **依据**：仓库现状（2026-05-20）、内部策略文档（ADR-0020、PREDICTION_ACCURACY_STRATEGY、outcome pipeline）、行业资料（Gemini 文档理解、2025 PDF 解析 benchmark）。  
> **性质**：情景分析 + 概率判断，**非承诺排期**。

---

## 1. 高置信度基线（今天 = 事实）

| 维度 | 现状 | 置信度 |
|------|------|--------|
| 线上 LLM | OpenAI **文本** API，默认 `gpt-4o-mini` | 极高 |
| Gemini Vision | **未接入**（无 SDK、无 `inlineData`、无 PDF 字节送模） | 极高 |
| PDF/截图入模方式 | **无**「直接传图」也 **无**「PDF→页图」流水线 | 极高 |
| CDS/学校 ETL | `pdftotext` → 文本 LLM（gpt-4.1/5.4-mini 等）+ regex + closure-agents | 极高 |
| 批次作业成功率 | 文本管线约 **79%**（1292/1632，非字段真值准确率） | 高 |
| 240 校数据 | 必填字段满；**~68%** 校含启发式；Tier1 CDS 分格 **9 校** | 高 |
| 预测 served | **counselor-primary** 规则引擎 | 极高 |
| verified outcome 校准 | **0**；对外准确率 **不可宣称** | 高（runbook 2026-05-09） |
| 作品集 Vision 评估 | **无**；`ART_DESIGN`/`MUSIC_CONSERVATORY` → Tier4 unavailable | 极高 |
| 研发 AI | Claude Code、Codex、Cursor → 代码与 batch，**≠** 产品运行时 Vision | 高 |

**预估时务必区分**：「建设期用过 GPT/Claude」≠「产品 = Gemini Vision 平台」。

---

## 2. 最可能的主情景（建议按此做默认计划）

### 情景 M（主情景，概率约 **55–65%**）

**「文本数据工程 + 规则预测」再延续 12–18 个月；Vision 仅试点，不进主路径。**

```text
2026 H1–H2
├── 产品 AI：继续 gpt-4o-mini（或同类文本模型），不上 Gemini 主 Agent
├── 学校 ETL：仍以 pdftotext + 文本 LLM + 人工/closure 为主
│   └── 优先 PREDICTION_ACCURACY_STRATEGY Phase C（C21 ED/EA、C7 国际生率、need-blind 审核）
├── 预测：counselor 规则迭代；verified outcome 缓慢增长但仍 <50 全年
├── 用户侧：仍不能「上传截图问 AI」；聊天图片只存储
└── 作品集：维持 Tier4 拒绝概率 + 文案说明，不做 Vision rubric

2027 上半年
├── 若 outcome ≥50：开启 Platt **诊断**（仍可能不用样本训练 per-school multiplier，见 ADR-0020）
└── 若仍 <50：继续强调数据完整度与区间 UX（Phase D）
```

**为何这是最可能：**

1. 你们自己的策略文档把 **最高杠杆** 标在 **Phase C 元数据**，不是 MMFM（`PREDICTION_ACCURACY_STRATEGY` §5）。  
2. ADR-0020 禁止用平台样本做校准 → **投 Vision 抽字段** 的 ROI 必须先证明「比文本多抽对多少」，而 **gold 评估尚未存在**。  
3. 已有 **79% 文本批次成功** + closure 体系 → 组织惯性会继续走「补字段、修 heuristic」，而不是重写 ETL 为 Vision。  
4. 工程带宽被 **DB 迁移对齐、readiness 通知、申请分析治理** 占用（`PLATFORM_DATA_INTELLIGENCE_EXECUTION_PLAN` 2026-05 心跳）。  
5. 行业 benchmark：表格 PDF 上 Vision **并非全面碾压** pdftotext+LLM；**混合路由**才是 2025–2026 主流，但你们 **连混合都还没建**。

**在此情景下你应准备的预估：**

| 项目 | 合理预期 |
|------|----------|
| 「用上 Gemini Vision」上线 | **2026 年内大概率不会** 成为生产主路径 |
| Tier1 CDS 分格校数 | 9 → **12–20**（靠 UC 扩展 + 少量文本 LLM 成功），难到 50+ |
| 文本批次作业成功率 | 维持 **75–85%**；靠 regex/closure 吃掉失败 |
| verified outcomes | 2026 末 **5–30**（若做 outcome 提醒）；**≥50 更可能 2027** |
| 可对外的「预测准确率」 | **2026 全年不宜** |
| 研发人力分配建议 | **70%** 数据/规则/provenance，**20%** 产品 AI 文本，**10%** Vision 预研 |

---

## 3. 次可能情景（并行准备，概率约 **25–30%**）

### 情景 H（混合 ETL，「GCP 友好」）

**2026 Q3–Q4 上线「CDS 重试专用」Vision 支路，仍不是全量 Gemini。**

与你们栈最吻合的行业做法（[Google Gemini 文档理解](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/document-understanding)）：

| 步骤 | 做法 |
|------|------|
| 1 | **先** `pdftotext` + 质量分（字符数、乱码率、C1 锚点是否命中） |
| 2 | 质量 **达标** → 继续现有文本 LLM（便宜） |
| 3 | 质量 **不达标** → **二选一**：<br>• **A**：Gemini **原生 PDF** 上传（有文本层的 CDS 常够用）<br>• **B**：`pdftoppm` → 页图 → Gemini Flash（扫描件更稳） |
| 4 | 写入 `provenance.tier = SCRAPED/INFERRED`，`extractionMethod = vision_retry` |
| 5 | **仅** 对失败队列或 Top100 校跑，**不是** 240×全页 Vision |

**为何有可能：**

- 部署在 **GCP Cloud Run** → Vertex AI Gemini 集成成本低于另起 Azure DI。  
- Phase C 明确要攻 **C21/C7** → 文本失败 caso 多时，运营会推动「再试一次贵的」。  
- 2025 benchmark：前沿 MLLM 在**部分**表格域领先，但域差异大（法律合同高、学术 PDF 低）→ **只适合当 retry，不适合默认全量**。

**在此情景下你应准备的预估：**

| 项目 | 粗算量级（供预算） |
|------|-------------------|
| 试点范围 | **30–80 校** × 1 份 CDS/年，非 240 全量 |
| 单校成本（Vision retry） | 约 **$0.30–2.00/校**（视页数 30–80、Gemini Flash、是否原生 PDF） |
| 工程周期 | ModalityService 最小版 **4–8 周**；gold 评估 **4–6 周** 并行 |
| 字段准确率提升 | 无公开数；经验上 C11/C1 **可多 5–15 校「有值」**，需自测 |
| 仍 **不会** | 用户聊天默认走 Gemini Vision |

**PDF 怎么送 Gemini（若走本情景）——最可能技术选择：**

```text
优先：Gemini API / Vertex「原生 PDF」字节输入（有文本层的 CDS）
回退：pdftoppm 150dpi → PNG → 按页或按 2 页一批送 Vision（扫描/烂版式）
不推荐首版：用户截图直传做批量 ETL（难审计、难批量）
```

---

## 4. 低概率情景（需警惕「以为会发生」）

### 情景 V（全量 Vision 平台，概率约 **8–12%**）

- 2026 内产品主路径改为 Gemini Vision；CDS 240 校全量页图抽取。  
- **判断：与当前 ADR、runbook、工程积压不一致**，除非融资/合作方硬性要求 demo「AI 读 PDF」。

### 情景 P（作品集 Vision 评估上线，概率约 **5–8%**）

- `PREDICTION_ACCURACY_STRATEGY` Phase B 把 portfolio 标为 deferred；无 gold rubric、无法规合规框架。  
- **更可能**：仅改 UI 文案（「portfolio review not modeled」），而非模型评估。

---

## 5. PDF/截图 × Gemini：行业规律 → 对你的含义

（综合 [Gemini PDF 排障说明](https://gemilab.net/en/articles/gemini-api/gemini-api-pdf-input-troubleshooting-guide)、表格抽取 benchmark 2025）

| PDF 类型 | 行业常见表现 | 你们 CDS 多数属于 |
|----------|--------------|-------------------|
| 有文本层 + 表格 | 原生 PDF + Vision **常优于** 纯 pdftotext | **多数** |
| 扫描件 | Vision 仍吃力；常先 OCR/Document AI | 少数老 CDS |
| 极长（>100 页） | 需分块；成本高 | 部分名校 CDS |

**最可能的技术事实（若未来做 Vision）：**

- **不会**长期依赖「用户随手截图」做 240 校 ETL。  
- **更可能**是脚本侧：**PDF 文件 →（必要时）渲染页图 → Gemini**。  
- **直接传图**仅用于：**C 端顾问单页问答**、**认证单页 OCR 辅助**（与批量 ETL 分开）。

---

## 6. 量化指标：现在有什么、未来最可能有什么

### 6.1 现在（可写进报告的数字）

| 指标 | 值 | 备注 |
|------|-----|------|
| Vision 抽取校数 | **0** | |
| Vision vs 文本 A/B | **无** | |
| 文本 CDS 批次 success rate | **~79.2%** | 作业成功，非准确率 |
| US 目标校 | **240** | |
| heuristic 校占比 | **~68%** | 163/240 |
| Tier1 CDS band 校 | **9（3.75%）** | |
| verified outcomes | **0** | 2026-05-09 |
| AdmissionCase / PredictionResult | 99 / 476 | 快照，会变 |

### 6.2 主情景 M 下 2026 年末「最可能」区间

| 指标 | 保守 | 中性 | 乐观 |
|------|------|------|------|
| Vision 生产校数 | 0 | 0 | 0–15（仅试点未投产则仍为 0） |
| Tier1 band 校数 | 10 | 15 | 22 |
| 文本批次 success | 78% | 82% | 88% |
| verified outcomes | 8 | 20 | 45 |
| 可否对外宣称准确率 | 否 | 否 | 否（除非≥50 且 gate PASS） |
| 用户 Vision 聊天 | 无 | 无 | 无 |

### 6.3 情景 H 下 2026 Q4 额外可能

| 指标 | 中性预期 |
|------|----------|
| Vision retry 校数（累计） | 40–80 |
| 相对文本多抽出「可用 C21/C11」字段 | +10–25 校（需自建 gold 验证） |
| Vision 字段级准确率 | **未知**；目标 pilot **≥85%** on gold 子集才可扩 |

**重要：** 在跑完 **30–50 校人工 gold** 之前，任何「Vision 比文本好 X%」都**不应**写进对外材料。

---

## 7. 资源与排期预估（供你提前要人头/预算）

### 7.1 若坚持主情景 M（推荐默认）

| 工作包 | 人周（粗估） | 产出 |
|--------|--------------|------|
| Phase C 数据（C21/C7/need-blind） | 8–16 | 字段覆盖 ↑，预测解释力 ↑ |
| Phase B GPA scale + placeholder | 2–4 | 少一类静默错误 |
| Outcome 收集 + 审核 UI | 4–8 | verified 从 0 起步 |
| Phase D 区间/数据来源 UX | 3–6 | 降低「感觉不准」 |
| Vision **预研**（gold 30 校 + 报告 only） | 3–5 | 决策是否 2027 上 H |

**合计**：约 **20–39 人周**（1 人约 5–9 个月副业强度），**不含** 全量 ModalityService。

### 7.2 若并行推情景 H（混合 ETL）

在主情景基础上 **额外**：

| 工作包 | 人周（粗估） | 产出 |
|--------|--------------|------|
| ModalityService MVP + Vertex Gemini | 6–10 | PDF 质量路由 + retry API |
| Gold 标注 + eval 脚本 | 4–6 | Vision vs text 报告 |
| Provenance 扩展 + Admin 审核 | 3–5 | `vision_retry` 可审计 |
| 试点跑批 + 运维 | 2–4 | 40–80 校 |

**额外合计**：约 **15–25 人周**；API 成本 **$50–200/月** 试点量级。

### 7.3 不建议 2026 预算内立项

- 全量 240 校 Vision 重抽  
- 作品集 Vision 评分产品化  
- 用 Vision 输出直接改 counselor 概率（违反可审计策略）  
- 无 gold 即对外宣称「AI 抽取准确率 90%+」

---

## 8. 风险登记（预估时要留缓冲）

| 风险 | 可能性 | 影响 | 缓冲 |
|------|--------|------|------|
| 文本 LLM 在 C1 国际生表编造数字 | 中–高 | 预测偏差、信任危机 | provenance + 人工 spot-check Top50 |
| 以为「Codex/GPT5 = 产品 Vision」对外宣传 | 中 | 尽调/合作翻车 | 统一用 §1 基线表述 |
| 无 gold 就上 Gemini 全量 | 低–中 | 成本爆、难回归 | 先 H 情景试点 |
| verified 全年 <50 | **高** | 无法校准叙事 | 主打方法论 + 数据覆盖 |
| DB 迁移/环境不一致拖慢 ETL | 中（已有记录） | 数据迭代停滞 | 先修 schema 再扩 Vision |
| Gemini PDF API 行为变更 | 中 | 批次失败率波动 | 版本 pin + 回归集 |

---

## 9. 决策树：你现在该按哪条准备

```text
你的目标是什么？
│
├─ 2026 内「产品能用 Gemini 读 PDF」对外讲故事
│   └─ 最可能仍做不到主路径 → 准备「试点/demo 级」预算（情景 H 下限）
│       或改叙事为「文本可审计 ETL + 规则预测」
│
├─ 提升预测/选校质量（真实用户价值）
│   └─ 默认情景 M → 预算投 Phase C + outcome + GPA scale
│       Vision 仅 3–5 人周预研，不要先写进 OKR
│
├─ 降低数据团队人工成本
│   └─ 情景 H 值得做 → 但只对「pdftotext 失败队列」上 Vision
│       先做 30 校 gold，再批预算
│
└─ 作品集/艺术校
    └─ 2026 低概率 → 只做 Tier4 文案与 refer，不做 Vision KPI
```

---

## 10. 对外 / 对内「最可能」表述模板（2026）

**对内规划：**

> 默认继续文本 ETL + counselor 预测；Gemini Vision 不在 2026 主路径。Q3 视 gold 评估结果决定是否做 CDS 失败重试试点（Vertex Gemini，原生 PDF 优先）。全年不宣称预测准确率；verified outcome 目标中性 20 例。

**对投资/合作（保守）：**

> 平台 AI 为可审计规则引擎与文本 LLM 顾问；学校数据来自公开 CDS/Scorecard 与自动化文本抽取（约八成批次成功），非多模态录取概率模型。多模态文档理解处于评估阶段，未纳入生产 SLA。

---

## 11. 与 `PROJECT_TECHNICAL_OVERVIEW.md` 的关系

- **OVERVIEW** = 现状事实清单  
- **本文** = 在现状之上的 **概率化预估与资源量级**  
- 每季度用仓库数据更新 §6 表格（尤其 verified count、Tier1 校数、`_meta` success rate）

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-05-20 | 初版：主情景 M / 混合 H / 低概率 V·P；量化区间；人周与成本量级 |
