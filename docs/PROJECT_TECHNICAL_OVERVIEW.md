# Lumni 留学申请平台 — 技术总览（综合文档）

> **最后更新**: 2026-05-20  
> **状态**: 对照源码与 runbook 整理；用于 BP、入职、技术复盘  
> **相关文档**: [ARCHITECTURE.md](./ARCHITECTURE.md) · [PREDICTION_SYSTEM.md](./PREDICTION_SYSTEM.md) · [PREDICTION_ACCURACY_STRATEGY.md](./PREDICTION_ACCURACY_STRATEGY.md) · [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)

---

## 目录

1. [项目定位](#1-项目定位)
2. [技术架构摘要](#2-技术架构摘要)
3. [AI 三层模型（必读）](#3-ai-三层模型必读)
4. [三个关键问题（深入结论）](#4-三个关键问题深入结论)
5. [Vision / 多模态：现状与规划](#5-vision--多模态现状与规划)
6. [PDF 与文档解析栈](#6-pdf-与文档解析栈)
7. [量化指标与数据覆盖](#7-量化指标与数据覆盖)
8. [核心技术难点](#8-核心技术难点)
9. [加入 MMFM 后的目标形态](#9-加入-mmfm-后的目标形态)
10. [对外表述建议](#10-对外表述建议)
11. [附录：关键路径与命令](#11-附录关键路径与命令)

---

## 1. 项目定位

**Lumni**（仓库名 `study-abroad-platform`）是 AI 驱动的智能留学申请辅助平台，面向 DIY 申请者，提供选校、档案管理、录取预测、案例社区、AI 顾问、时间线、文书与 Admin 数据治理等能力。

产品愿景可概括为四大模块：

| 模块 | 能力 |
|------|------|
| **Find Your College** | 智能选校、筛选、对比、选校清单 |
| **Uncommon App** | 档案中心 + 选校清单 + AI 评估 |
| **功能大厅（Hall）** | 滑动预测、互评、招生官视角类体验 |
| **社交大厅** | 论坛、私信、组队、案例分享 |

---

## 2. 技术架构摘要

### 2.1 Monorepo

```
study-abroad-platform/
├── apps/api/          # NestJS 11 后端 (默认端口 4101)
├── apps/web/          # Next.js 16 前端 (4100)
├── apps/mobile/       # Expo / React Native
├── packages/shared/   # 类型、评分、设计 token、Zod schema
├── packages/browser-extension/  # CommonApp 自动填表
├── docs/              # 50+ 篇架构/运维/产品文档
├── e2e/               # Playwright
└── scripts/           # 发版门禁、预测审计、数据脚本
```

工具链：**pnpm workspace + Turbo**，Node ≥ 20，PostgreSQL 16 + **pgvector**，Redis 7，部署以 **GCP Cloud Run** 为主。

### 2.2 后端模块（约 30 个业务模块）

| 领域 | 模块 |
|------|------|
| 认证与用户 | Auth、User、Settings、Notification、Subscription、Points |
| 档案与学校 | Profile、School、SchoolList、Ranking |
| AI | Ai（遗留）、**AiAgent**（企业级）、Essay、Recommendation、Assessment、Prediction、Resume |
| 案例与认证 | Case、Verification |
| 社交 | Forum、Chat、Hall、PeerReview、Team |
| 工具 | Timeline、Vault、Admin、Health |

全局：JWT + RBAC + Feature Flag、Prisma、Redis、Sentry、限流、XSS 清洗、统一响应 `{ success, data, meta }`。

### 2.3 数据规模（Prisma）

- 约 **100 个 model**，**29+ enum**
- 预测、申请分析治理、AI Agent 记忆、学校 provenance、案例审核等表族齐全

### 2.4 前端路由（Web）

主要用户面：`/dashboard`、`/schools`、`/uncommon-app`、`/profile`、`/prediction`、`/ai`、`/cases`、`/forum`、`/hall`、`/timeline`、`/essays`、`/vault` 等；**Admin 20+ 子页**（数据审核、预测健康、AI 运维、申请分析工作流等）。

---

## 3. AI 三层模型（必读）

本项目存在 **三种不同的「AI」**，写材料时必须分开，不可混为一谈。

```text
┌─────────────────────────────────────────────────────────────┐
│  Layer 1 — 研发/运营 AI（建设期）                             │
│  • Claude Code（Claude 4.x）— 写代码、规则、closure-agents   │
│  • Codex（GPT 5.x）— 发版门禁、全产品面审计、部分 batch 编排  │
│  • Cursor 等 — 日常 IDE 协作                                 │
│  → 不直接等于「用户打开的 Lumni App」                         │
└───────────────────────────┬─────────────────────────────────┘
                            │ 产出：代码、JSON、TS 数据文件、文档
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2 — 仓库内批量流水线（可复现脚本）                    │
│  • pdftotext / pdf-parse / mammoth / cheerio                 │
│  • callLlm（gpt-5.4-mini、gpt-4.1-mini、claude-haiku 等）   │
│  • closure-agents/*.ts（Agent 调研结论硬编码为 TARGETS[]）    │
│  → 写入 PostgreSQL（学校字段、CDS、closure 状态）             │
└───────────────────────────┬─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3 — 线上产品（NestJS，终端用户）                      │
│  • LLM_PROVIDER 默认 openai                                  │
│  • OPENAI_MODEL 默认 gpt-4o-mini                             │
│  • 仅文本 Chat Completions（LLMMessage.content: string）       │
│  • Embedding: text-embedding-3-small（1536 维）              │
│  → /ai、文书 AI、申请分析、预测解释等                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Layer 1 说明

- **Claude Code**：`.claude/`、`CLAUDE.md`、agent/skill 定义；驱动功能开发与 `closure-agents` 数据闭环脚本（文件内为调研结果数组，**运行时不再调 Claude API**）。
- **Codex**：`CODEX_E2E_RUNBOOK.md`、`FULL_SURFACE_REGISTRY` 中 `execution_owner: codex`；负责发版门禁与 E2E 证据收口，**不是** 产品内嵌的模型服务。

### 3.2 Layer 2 说明

- CDS 批次 JSON 的 `_meta.model` 常见：`gpt-5.4-mini`、`gpt-4.1-mini`、`gpt-4o-mini`，少量 `claude-haiku-4-5-20251001`（见 `apps/api/scripts/cds-data/`）。
- 流程始终是 **PDF → 抽文本 → 文本 LLM → JSON**，不是 Vision API。

### 3.3 Layer 3 说明

- `apps/api/src/modules/ai-agent/providers/provider.module.ts` 仅注册 **OpenAIProvider**；`anthropic` 在 env 枚举中存在，但 Provider **未实现**（注释 `Future: anthropic`）。
- Admin `model-select.tsx` 列出 gpt-4o、Claude、Gemini 等，**UI 选项 ≠ 均已接线的运行时 Provider**；未配置时走 OpenAI 文本 API。

---

## 4. 三个关键问题（深入结论）

> 本节直接回答：Vision LLM 选型、PDF/截图解析实现、量化指标。结论均来自 **2026-05-20 源码全库检索**（`ModalityService`、`image_url`、Azure DI、portfolio 等零生产实现）。

### 4.1 Vision LLM 用的是哪个？GPT-4o、Gemini Vision，还是 Claude？

| 场景 | 实际使用 | 是否 Vision API |
|------|----------|-----------------|
| **Lumni 线上（学生/顾问）** | **OpenAI Chat Completions，默认 `gpt-4o-mini`，仅 `content: string`** | **否** |
| **Nest Provider 注册** | 仅 `OpenAIProvider`（`LLM_PROVIDER` 默认 `openai`）；`anthropic` **未实现** | 否 |
| **Gemini** | Admin 下拉有 `gemini-2.0-*`，**无** `GeminiProvider` / 无 API 调用 | 否 |
| **Claude 多模态** | **无**；离线脚本 `llm-call.ts` 可走 **Claude 文本** Messages API（`claude-*` 模型名） | 否 |
| **gpt-4o 型号** | 出现在 Admin 定价与部分 Agent 配置；请求体 **从不** 带 `image_url` | **仅用文本通道** |
| **研发期（Claude Code / Codex）** | 建设代码与数据；**不等于** 用户请求打到 Claude 4.7 / GPT 5.5 Vision | 视 IDE 会话而定，**未固化进产品 Vision 端点** |

**一句话：** 产品侧 **没有** 选用「GPT-4o Vision / Gemini Vision / Claude Vision」中的任何一个作为 **Vision LLM**；只有 **OpenAI 兼容文本 LLM**（线上默认 mini）。Claude/GPT 5.x 主要出现在 **Layer 1 开发** 与 **Layer 2 CDS 批量脚本**（见 §3、§7.2）。

证据：`LLMMessage.content` 仅为字符串；`openai.provider.ts` 的 `convertMessages` 只 push `{ role, content }`；全库 **无** `ModalityService`、`image_url`、`input_image`。

### 4.2 PDF/截图解析：ModalityService + Vision，还是第三方？

| 说法 | 是否符合仓库 |
|------|----------------|
| 自研 **ModalityService** | **否** — 仅存在于本文 §9 规划描述 |
| **Vision LLM** 读 PDF/截图 | **否** — 无 multimodal message |
| **Azure Document Intelligence** | **否** — 依赖中无 `@azure/ai-form-recognizer` |
| **pdfplumber** | **否** |

**实际流水线：**

```text
PDF  →  pdftotext (poppler CLI) 或  pdf-parse (npm)  →  纯文本
     →  可选 pdf_regex（确定性）或 pdf_llm（OpenAI/Claude 文本 JSON 模式）
HTML →  cheerio
DOCX →  mammoth
截图 →  仅用户上传存储（chat/forum/verification），不进入模型
```

| 组件 | 用途 |
|------|------|
| `extract-cds-c1.ts` / `extract-cds-c9-c21.ts` | `execFileSync('pdftotext', …)` → `callLlm` |
| `extract-cds-residency-only.ts` | 同上，截取前 30k 字符 |
| `resume.service.ts` | `PDFParse` / `mammoth` → 文本 → 规则分段 |
| `closure-agents/*.ts` | Agent **人工/会话调研** 结果写死为 `TARGETS[]`，`tsx` 写库，**非** 运行时 Vision |

**结论：** 既不是「ModalityService + Vision LLM」，也不是 Azure DI；是 **传统文本抽取 + 文本 LLM 结构化**（Layer 2），与 **Claude Code/Codex 辅助建设**（Layer 1）的组合。

### 4.3 有没有量化结果？

#### A. 字段抽取「准确率」

| 指标类型 | 有无 | 说明 |
|----------|------|------|
| 相对官方真值的 **precision/recall/F1**（全字段） | **无** 对外发布 | 无统一 benchmark 报告 |
| CDS 批次 **作业成功率** | **有（运维口径）** | 见下表 |
| **Fact Auditor** 字段一致率 | **有（窄口径）** | `scripts/audit/fact-audit.ts`：仅对部分 **官方来源** 字段（deadline、testingPolicy、intl aid 等）算 `fieldLevelAccuracy`；**不含** 数值型录取率快照的逐字段真值对比 |
| 抽取后 **规则校验** | 有 | 如 GPA band 之和 ∈ [0.85, 1.15]、`verify-counselor-data-quality.ts`、`manual-review.json` |

**CDS 批量作业成功率（2026-05-20 扫 `apps/api/scripts/cds-data/*.json` 之 `_meta`）：**

| 指标 | 数值 |
|------|------|
| 含 `_meta` 的批次文件 | **314** |
| 累计 `success` | **1292** |
| 累计 `failures` | **340** |
| **success / (success+failures)** | **≈ 79.2%** |

**重要：** 这是「脚本跑完且写入 JSON 的成功条数」，**不是**「与 CDS 真值对照的字段准确率」。失败包括 PDF 无文本、LLM 未返回 JSON、字段缺失等。

**离线批次记录的模型（有 `_meta.model` 的文件，非全库 314 个）：** `gpt-4.1-mini`（47）、`gpt-5.4-mini`（41）、`gpt-4o-mini`（15）、`claude-haiku-4-5-20251001`（4）、`manual`（4）等。仓库内 **未见 `gpt-5.5` 字符串**；若你使用 Codex 时界面为 5.5，落库元数据多为 **5.4-mini / 4.1-mini**。

#### B. 学校数据覆盖（240 所 US）

见 [§7.1](#71-学校数据240-所-us2026-04-30-文档)：录取率 100% 填满、CDS 真分格 **9 校（4%）**、约 **68%** 校含启发式字段等。

#### C. 预测准确率（对用户）

| 指标 | 数值/状态 |
|------|-----------|
| `verifiedCount`（校准） | **0**（2026-05-09 runbook） |
| 对外宣称固定准确率 | **禁止**（FAQ + `PREDICTION_SYSTEM.md`） |
| ECE ≤ 0.05 | 设计目标，**无冻结测量** |

#### D. Portfolio 相关指标 — 必须区分两个「portfolio」

| 含义 | 实现 | 有无量化 |
|------|------|----------|
| **选校组合 portfolio**（reach/target/safety 清单风险） | `POST /predictions/portfolio-summary/stream`：`prediction-explanation.service.ts` 用 **文本 LLM** 总结已有 `PredictionResult` 列表（JSON 输入），**不** 看图、**不** 重算概率 | **无** 准确率/Rubric 分数；仅 prompt 约束条数 |
| **艺术作品集 portfolio**（RISD、音乐学院等） | `institutionType ∈ { ART_DESIGN, MUSIC_CONSERVATORY }` → counselor **Tier 4**，`predictionMethod: insufficient_data`，`anchorSource: audition_or_portfolio_admission` | **无** 作品集质量分、无视觉评估指标；**刻意不做** 标化概率 |

代码依据：

```34:52:apps/api/src/modules/prediction/counselor/anchor-resolver.service.ts
    if (this.isAuditionOrPortfolioSchool(school)) {
      return {
        tier: 4,
        anchorSource: 'audition_or_portfolio_admission',
        insufficientData: {
          reason: '... portfolio review or audition; academic stats alone cannot reliably predict outcome',
        },
      };
    }
```

**结论：** 没有任何 **Portfolio 视觉评估** 的量化 KPI；仅有 **选校组合文字总结**（无评分）与 **作品集校「拒绝给概率」** 的产品策略。

---

## 5. Vision / 多模态：现状与规划

### 4.1 现状结论

| 问题 | 答案 |
|------|------|
| 线上用哪个 Vision LLM？ | **无**。未接入 GPT-4V / Gemini Vision / Claude 多模态 message。 |
| 生产默认 LLM？ | **OpenAI 文本 API，`gpt-4o-mini`**（即使用户名含 gpt-4o，请求体也只有字符串）。 |
| Gemini / Claude 线上？ | Gemini **无** API 代码；Claude 仅 **离线** `scripts/lib/llm-call.ts` 文本路径。 |
| 聊天/认证里的图片？ | **存储 + 展示**；不送入模型。 |
| 作品集校？ | **Tier 4 unavailable**；艺术/音乐学院不输出标化概率。 |

### 4.2 与 MMFM 的概念交集（未实现）

| 场景 | 今天 | 规划/缺口 |
|------|------|-----------|
| 用户上传 CDS/成绩单截图问 AI | 不支持看图 | `PLATFORM_DATA_INTELLIGENCE_EXECUTION_PLAN` 提到 screenshot/PDF AI 抽取 |
| CDS 批量入库 | pdftotext + 文本 LLM | 可提高表格抽取率，需 provenance + 人工审核 |
| 作品集评估 | 不做 | `PREDICTION_ACCURACY_STRATEGY` 提及 portfolio-quality fallback |
| 认证材料 | 人工审核 + OSS | 可半自动 OCR/VLM，需合规 |

### 4.3 易混淆点

- **gpt-4o 是多模态模型族**，但本仓库 **只调用其文本能力**。
- **Claude Code / Codex 在开发时可能「看懂」PDF**，固化方式为 **代码与 JSON/TS 数据**，不是产品 Vision 端点。

---

## 6. PDF 与文档解析栈

**没有**自研 layout 模型，**没有** Azure Document Intelligence、pdfplumber。

| 场景 | 工具 | 是否 Vision |
|------|------|-------------|
| CDS 批量（`extract-cds-c1.ts` 等） | 系统 **pdftotext**（poppler）→ `pdf_regex` 或 **pdf_llm** | 否 |
| CDS 专项脚本 | download PDF → pdftotext → 截取文本 → `callLlm` | 否 |
| HTML CDS | **cheerio** | 否 |
| 用户简历 | **pdf-parse** / **mammoth** → 文本 → 分段逻辑 | 否 |
| 官网爬虫 | **Playwright** + cheerio | 否 |

依赖见 `apps/api/package.json`：`pdf-parse`、`mammoth`、`cheerio`、`playwright`；无 `@azure/ai-form-recognizer`。

---

## 7. 量化指标与数据覆盖

### 7.1 学校数据（240 所 US，2026-04-30 文档）

来源：`docs/cds-data-coverage-2026-04-30.md`、`scripts/coverage-reports/coverage-2026-04-29.json`。

| 指标 | 数值 |
|------|------|
| 目标校规模 | **240** 所美国本科 |
| `acceptanceRate` 填充 | **100%** (240/240) |
| `intlAcceptanceRate` 填充 | **100%**（含启发式） |
| `sat25/sat75` | **99%** (238/240) |
| `gpaDistribution` (C11) | **70%** (167/240) |
| `edAcceptanceRate` | **26%** (62/240) |
| **SchoolCdsAdmitBand**（Tier 1 真分格） | **9 校（4%）**，主要为 UC 系统 |
| 必填 7 字段无缺失 | **240 complete** |
| 至少含启发式字段的学校 | **163 校（≈68%）** |

预测分层（同文档）：Tier 1 共 9 校；Tier 2 高质 39；Tier 2 良好 128；Tier 2 基础 73；无法预测 2（Curtis、Juilliard）。

Scorecard teacher 可蒸馏覆盖（2026-04-22）：**100/240 ≈ 41.7%**；T10 子集约 **28.2%**（test-optional 导致外部分位缺失，属数据限制非单纯 bug）。

### 7.2 字段抽取与批次量化

详见 [§4.3](#43-有没有量化结果)。摘要：

- **字段级真值准确率**：未发布。
- **CDS 批次作业成功率**：约 **79.2%**（1292 / 1632 条 `_meta` 计数，314 个批次文件）。
- **Fact Auditor**：窄字段官方一致率（`scripts/audit/fact-audit.ts`），非常规 CDS 全表抽取评估。

核实批次模型分布：

```bash
rg '"model":' apps/api/scripts/cds-data --no-heading | sort | uniq -c | sort -rn
```

### 7.3 预测准确率（对用户宣称）

来源：`docs/runbooks/outcome-verification-pipeline.md`（2026-05-09）、`PREDICTION_SYSTEM.md`。

| 指标 | 状态 |
|------|------|
| **verifiedCount**（校准用） | **0**（冷启动） |
| 校准晋升 | ≥ **50** verified 才考虑 Platt；≥ **200** 才允许对外 accuracy claim |
| ECE ≤ 0.05 | `PREDICTION_BENCHMARK.md` 中为**设计目标**，「冷启动中，无冻结测量」 |
| 产品 FAQ | 样本足够前**不对外宣称固定准确率** |
| 当前 served 路径 | **counselor-primary** 规则引擎（`counselor-cold-start-v1.7-launch` 量级），**非** LLM 出概率 |

相关 DB 快照（2026-05-09 runbook）：

| 信号 | 数量 |
|------|------|
| AdmissionCase 总数 | 99 |
| isVerified=true | 8 |
| PredictionResult | 476 |
| 带 actualResult | 5 |
| SELF_REPORTED outcome | 10 |

**禁止**将 Hall 滑动游戏的「预测准确率」等同于录取模型准确率。

### 7.4 Portfolio 与用户使用量

**Portfolio：** 见 [§4.3 D](#d-portfolio-相关指标--必须区分两个portfolio)。无作品集视觉评估指标。

**MAU/DAU：** 见下节。

### 7.5 用户使用量（MAU/DAU）

仓库内 **无** 权威产品级 DAU/MAU 报表；运营指标需查生产分析后台。

---

## 8. 核心技术难点

### 7.1 方法论层（最难）

- 用户要**具体概率**，但 **平台用户样本不可用于校准**（ADR-0020：自选择 + 幸存者偏差 + SFFA 代理风险）。
- 策略：**全申请人池公开数据 + 文献系数 + 不确定性表达**；verified outcome 仅作诊断，不作 per-school 训练。
- CollegeVine 等已承认低录取率校高估；CollegeBoard 选择**不给概率**。

### 7.2 Counselor 引擎（领域 + 数值）

- `counselor-modifiers.ts` 约 **1600 行**纯函数 modifier，需可解释、可回放。
- Tier 1 CDS cell 须 **抑制 double-count**（cell 已编码 GPA/SAT 不得再乘同类 modifier）。
- 三态字段语义（如 `needBlindInternational` null vs false）错误会**静默扭曲**国际生预测。
- 三代预测架构（融合 / ML-primary / counselor-primary）**ADR 已 supersede**，但 `prediction.service.ts` 仍 **2700+ 行**历史代码，须保证 served 路径仅 counselor。

### 7.3 数据平台

- ADR-0017：**字段级 provenance**（OFFICIAL → INFERRED）；约 **68%** 校含启发式字段。
- 准确率上限往往在 **ETL 完整度**，不在再训一个黑盒模型。

### 7.4 AI Agent

- ReWOO + Orchestrator；**PG 写入单写者**（MemoryManager vs WorkflowEngine 内存）。
- 工具暴露整库业务；`forwardRef` 环依赖；Fast Router / Embedding Router 降本。
- **文本-only** LLM 契约。

### 7.5 申请分析

- `profile-application-analysis.service.ts` **2650+ 行**；LLM 结构化 JSON + 预测数字**必须隔离**（LLM 不得改写 served probability）。

### 7.6 工程治理

- 四端（Prisma / shared / API / Web / Mobile）一致性靠 `check-integration.ts` **21 条规则**。
- AI-first 发版门禁、full-surface audit；文档需与源码持续对齐。

---

## 9. 加入 MMFM 后的目标形态

（规划蓝图，**非当前实现**。）

### 8.1 架构增补

新增横切 **ModalityService**：上传 → 预处理 →（可选）Document Intelligence / Vision LLM → `StructuredExtractionResult` + provenance → 业务模块。

### 8.2 产品变化摘要

| 模块 | 目标能力 |
|------|----------|
| AI 顾问 | 上传截图/PDF，看图问答（仍不替代 counselor 概率） |
| 档案 | 材料库：成绩单/证书 OCR 草稿 → 用户确认写入 |
| 预测 | **双轨**：标化 counselor + 作品集 Portfolio Readiness（明确不输出概率或分档说明） |
| Admin | visual-etl 队列、字段 provenance 审核 |
| 认证 | AI 预审 + 人工终审 |

### 8.3 需新建基础设施

- 扩展 `LLMMessage` 支持 multimodal content parts  
- 多 Provider（OpenAI / Anthropic / Gemini）统一 ModalityService  
- 图像/PDF 页渲染、PII 脱敏、按模态计费与 prompt-guard  
- 视觉抽取 **golden set** 与字段级 F1（当前缺失）

---

## 10. 对外表述建议

### 9.1 推荐表述

> Lumni 在研发阶段使用 Claude Code 与 Codex（GPT 5.x 系列）协作建设平台与数据流水线；**生产环境** AI 顾问默认 **OpenAI 文本模型（gpt-4o-mini）**，录取概率由 **可审计的 counselor 规则引擎** 提供。学校 CDS 与简历 PDF 经 **pdftotext / pdf-parse 等抽取文本** 后由 LLM 结构化，**未使用多模态视觉 API**。美国目标校库 **240 所**，核心字段覆盖率高，但约 **三分之二学校存在启发式补全**；CDS 真分格数据 **9 校**。在 verified 录取结果达到运营门槛前，**不对外宣称校准准确率**。

### 9.2 避免表述

- 「我们使用 GPT-4o / Claude 多模态理解申请材料」  
- 「产品内嵌 Claude 4.7 / GPT-5.5」  
- 「预测准确率 XX%」（除非 verified 样本达标且 `prediction:accuracy` 报告支持）  
- 「Gemini 驱动主 Agent」（未实现 Provider）

---

## 11. 附录：关键路径与命令

| 用途 | 路径 / 命令 |
|------|-------------|
| 架构详述 | `docs/ARCHITECTURE.md` |
| 预测契约 | `docs/PREDICTION_SYSTEM.md` |
| 预测策略 | `docs/PREDICTION_ACCURACY_STRATEGY.md` |
| ADR 无样本校准 | `docs/adr/0020-prediction-no-sample-calibration.md` |
| Outcome 流水线 | `docs/runbooks/outcome-verification-pipeline.md` |
| CDS 覆盖报告 | `docs/cds-data-coverage-2026-04-30.md` |
| 生产 LLM Provider | `apps/api/src/modules/ai-agent/providers/provider.module.ts` |
| 离线 LLM（含 Claude 文本） | `apps/api/scripts/lib/llm-call.ts` |
| Counselor 引擎 | `apps/api/src/modules/prediction/counselor/` |
| closure-agents | `apps/api/scripts/closure-agents/` |
| 预测准确率报告 | `pnpm prediction:accuracy` |
| 发版门禁 | `pnpm release-gate:run` |
| 本地开发 | `pnpm dev` → Web 4100 / API 4101 |

---

## 文档变更记录

| 日期 | 说明 |
|------|------|
| 2026-05-20 | 初版：整合项目梳理、技术难点、MMFM 现状/规划、Claude Code/Codex vs 线上 AI、PDF 栈与量化指标 |
| 2026-05-20 | 增补 §4「三个关键问题」：Vision/PDF/量化深入结论；CDS 批次 ~79.2% 作业成功率；Portfolio 双义辨析 |

---

_本文档为对话整理的技术总览；细节以源码与 cited runbook 为准。架构变更时请同步更新本节与 `docs/README.md` 索引。_
