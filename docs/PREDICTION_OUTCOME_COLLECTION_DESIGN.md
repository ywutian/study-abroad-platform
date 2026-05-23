# Outcome 收集产品设计

> 最后更新: 2026-05-22
> 状态: 设计稿
> 关联: [PREDICTION_V2_DESIGN.md §9](./PREDICTION_V2_DESIGN.md)（升级路径）

## 0. 为什么这是治本

V2 Bayesian 引擎能跑（[M3 结果](../scripts/m3-bayesian-engine.ts)：Stanford 30%、CMU 64% 等），但**无法证明准确**，因为：

- 0 条 verified outcome
- 4 个 v3 case 全是同一个 demo 用户 Alice Zhang，非真实样本
- 任何"准确性"陈述都是空中楼阁

**唯一解锁路径**：让用户在 Decision Day 后回填录取结果，3-6 个月内积累 ≥ 50 条 verified outcome。

之后才能：

- 算 Brier / ECE / AUC
- 跑 Platt scaling 校准每校
- 真正比较 v2 vs v3 / CounselorEngine 哪个准

---

## 1. 用户旅程

### 1.1 当前断点

```
申请季 (Sep-Jan): 用户用平台做预测 ────► PredictionResult 入库
                                          ↓
                                          ▼
Decision Day (Mar-Apr): 用户在学校官网收到 ►► 平台不知道
                                          ↓
                                          ▼
后续学年: 用户离开平台 ──────────────────► 数据消失
```

### 1.2 目标状态

```
申请季: 用户做预测 ──► PredictionResult 入库
                       ↓
Decision Day 前 1 周: 平台主动 ping ──► "你预计 X 月 Y 日收到 [Stanford REA] 结果，记得回来报告 outcome"
                       ↓
Decision Day: 用户在学校官网收到 ──► 同日/次日 收到平台 push "你的 Stanford 结果是？"
                       ↓
用户报告: 一键选 ADMITTED/REJECTED/WAITLISTED ──► PredictionOutcomeLabelRecord (SELF_REPORTED)
                       ↓
Verification (optional): 用户上传录取通知截图 ──► admin OCR + 标 DOCUMENT_VERIFIED
                       ↓
反馈循环: 用户的 outcome 进入 verified pool ──► 用于 v3 校准 + 后续学弟学妹的 AdmissionCase 库
                       ↓
激励: 用户获得点数 / hall ranking / alumni badge ──► 用户得到回报
```

---

## 2. 组件清单

### 2.1 Frontend / UX

| 组件                            | 描述                                                      | 位置                                              |
| ------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| **Decision Day reminder card**  | Dashboard 上方卡片，倒计时到下一个学校的 decision day     | `apps/web/src/app/[locale]/(main)/page.tsx`       |
| **Outcome reporting modal**     | 一键选 ADMITTED/REJECTED/WAITLISTED/DEFERRED 的轻量 modal | `apps/web/src/components/features/outcome/` (新)  |
| **Bulk outcome reporting page** | 一次报多个学校的 batch UI                                 | `apps/web/src/app/[locale]/(main)/outcomes/` (新) |
| **Outcome verification upload** | 录取通知截图上传 + admin queue                            | 同上                                              |
| **My outcomes history**         | 用户看自己已报 outcome 的 list                            | 同上                                              |
| **Hall verified-alumni badge**  | Hall profile 上显示"已 verified outcome ×N"               | `apps/web/src/app/[locale]/(main)/hall/` 现有     |

### 2.2 Backend / API

| 端点                                       | 用途                                            |
| ------------------------------------------ | ----------------------------------------------- |
| `POST /outcomes`                           | 用户报告 outcome (self-reported)                |
| `POST /outcomes/:id/upload-document`       | 上传录取通知做 document verification            |
| `GET /outcomes/me`                         | 用户看自己的 outcome history                    |
| `POST /admin/outcomes/:id/verify`          | admin 标 COUNSELOR_VERIFIED / DOCUMENT_VERIFIED |
| `GET /admin/outcomes/pending-verification` | admin verification queue                        |

### 2.3 Cron / 自动触发

| Job                           | 触发     | 行为                                                                           |
| ----------------------------- | -------- | ------------------------------------------------------------------------------ |
| `decision-day-reminder`       | 每天 8am | 扫描所有 PredictionResult，找出本周内有 decision day 的，给用户发 push + email |
| `outcome-collection-followup` | 每 3 天  | 给已过 decision day 但未报 outcome 的用户发 reminder                           |
| `verified-outcome-aggregator` | 每周     | 把 verified outcome 写入对应学校的"今年 admit pool" 聚合数据，给未来学弟学妹用 |

### 2.4 数据库 (大部分已有)

| 表                             | 状态             | 用途                                                                  |
| ------------------------------ | ---------------- | --------------------------------------------------------------------- |
| `PredictionOutcomeLabelRecord` | ✅ 已有          | 主表 (status: SELF_REPORTED / COUNSELOR_VERIFIED / DOCUMENT_VERIFIED) |
| `PredictionResult`             | ✅ 已有          | 用 outcomeLabelRecord 关联                                            |
| `SchoolDeadline`               | ✅ 已有 (432 行) | decision day 数据源                                                   |
| `PointHistory`                 | ✅ 已有          | 奖励点数                                                              |
| `Notification`                 | ✅ 已有          | push/email 发送                                                       |

新增字段（小 migration）：

- `PredictionOutcomeLabelRecord.documentUrl` (string, optional) — 上传的录取通知 URL
- `PredictionOutcomeLabelRecord.verifiedBy` (string, optional) — admin userId
- `PredictionOutcomeLabelRecord.userSubmittedAt` (timestamp) — 跟 createdAt 区分

---

## 3. 核心产品决策 — 待你定

### 3.1 Verification 严格度

| 选项                               | 工作量 | 数据可信度        | UX     |
| ---------------------------------- | ------ | ----------------- | ------ |
| A. 只接受 self-reported            | 最低   | 最低 (用户可瞎报) | 最好   |
| B. self-reported + 可选上传 verify | 中     | 中 (混合)         | 好     |
| C. 强制上传录取通知截图 verify     | 高     | 高                | 摩擦大 |
| D. 只接受 counselor 第三方 verify  | 最高   | 最高              | 用户难 |

**我的建议**：**B (混合)** — self-reported 默认进 pool，标 SELF_REPORTED tier；用户上传截图后升级到 DOCUMENT_VERIFIED tier，给更多奖励。

### 3.2 激励力度

| 选项                                         | 力度 | 风险               |
| -------------------------------------------- | ---- | ------------------ |
| A. 只给点数 (50pt/校)                        | 弱   | 报告率可能低       |
| B. 点数 + Hall badge "alumni"                | 中   | 平衡               |
| C. 点数 + badge + 解锁高级功能 (essay AI 等) | 强   | 用户可能瞎报刷奖励 |
| D. 现金 / 礼品卡                             | 最强 | 法律 + 预算问题    |

**我的建议**：**B + 严格防刷机制**（每校报告必须有对应 PredictionResult 历史 = 用户当时真的预测过这学校）

### 3.3 Timing — 什么时候提醒报告

| 选项                                         | 描述                             |
| -------------------------------------------- | -------------------------------- |
| A. 每个学校 decision day 当天 push           | 即时性强，但用户可能还没看到结果 |
| B. Decision day + 3 天 后 push               | 给用户时间看到结果               |
| C. 用户主动登录平台才弹 modal                | 减少打扰但被动                   |
| D. 通过用户已选 schoolList 推断 + 多渠道触达 | 综合                             |

**我的建议**：**D** — Dashboard banner 持续显示 + decision day +3 天后 push + 每周 1 次 email reminder

### 3.4 用户私密性

| 维度                      | 选项                                |
| ------------------------- | ----------------------------------- |
| Outcome 默认可见性        | 私密 / Hall 用户可见 / 公开         |
| 是否进入 AdmissionCase 池 | 默认进 / 用户 opt-in / 用户 opt-out |
| 是否匿名化                | 强制匿名 / 用户选择 / 实名          |

**我的建议**：

- Outcome 默认私密
- 用户 opt-in 进入 AdmissionCase 池（"分享给学弟学妹"）
- 进池时自动匿名化（去掉 user identifier）

### 3.5 MVP 范围

| 阶段         | 内容                                                         | 工程量 |
| ------------ | ------------------------------------------------------------ | ------ |
| **MVP v0.1** | 后台数据收集（Dashboard banner + 一键报告 modal + 点数奖励） | 1 周   |
| **v0.2**     | Document upload + admin verification queue                   | 1 周   |
| **v0.3**     | Decision day cron + push notification                        | 0.5 周 |
| **v0.4**     | Hall alumni badge + 进 AdmissionCase 池                      | 1 周   |
| **v1.0**     | Full — including OCR for document verification               | 2-3 周 |

**我的建议**：**v0.1 + v0.3 先上** (~1.5 周)，能开始收数据。Document verification / Hall 集成 v0.2-v0.4 后续 ship。

---

## 4. 数据收集目标 (Success Metrics)

3 个月时间线（2026-05 ~ 2026-08）：

| 时间点        | 累计 outcome        | 状态                                                |
| ------------- | ------------------- | --------------------------------------------------- |
| Month 1 (Jun) | 10-20 self-reported | MVP 上线，早期用户回填                              |
| Month 2 (Jul) | 50-100 mixed        | 第一批 Decision Day（春季录取学生），可开始算 Brier |
| Month 3 (Aug) | 100-200 total       | 可开始 per-school Platt calibration on top 5 校     |

**目标**：3 个月内 50+ verified (predict, outcome) 对，可计算 Brier score。

---

## 5. 反馈循环到 Prediction 引擎

```
verified outcome 入库
       ↓
每月 1 号 cron: aggregate-outcomes-for-calibration
       ↓
对每个学校 if (outcome 数 ≥ 5 AND verified ratio ≥ 50%):
       ↓
   计算该学校的 v2 引擎实际 Brier / ECE
       ↓
   如果 > 阈值: trigger Platt scaling fitting
       ↓
   产生 per-school calibration parameter
       ↓
   v2 引擎读 calibration 表 → 应用到 final probability
```

**关键**: outcome → calibration 是**自动管线**，不是手动调参。每月 cron 跑，参数自动更新。

---

## 6. 风险 & 缓解

| 风险                                 | 缓解                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| 用户瞎报刷点数                       | 限定每校只能报一次 + 必须有 PredictionResult 历史；DOCUMENT_VERIFIED 才给高额点数 |
| Self-reported 偏正向（admit 报得多） | tag confidence；权重 verified > self-reported；分布对照                           |
| 用户私密顾虑导致 opt-out 高          | 默认私密 + 透明地说明用途（"用于改进未来预测"）                                   |
| OCR 不准/作弊                        | admin 人工复核 + 抽样验证 + 上传截图前给免责声明                                  |
| Decision day 数据不准                | 复用 SchoolDeadline（已有 432 行）；用户也可手动报告                              |
| 数据量不足以 calibrate               | tier-strategy：n<20 不动概率，n=20-50 weak Platt，n>50 full calibration           |

---

## 7. 不在范围内（明确排除）

- ❌ 自动从 学校 portal 抓取录取结果（隐私 + 法律风险，不做）
- ❌ 通过 IRS / 学籍数据 verify（不可能）
- ❌ 强制 Decision Day 后必须报告（伤用户体验）
- ❌ 把 outcome 数据卖给第三方（违背初衷）
- ❌ 用 outcome 数据训练 ML 模型（v1 仅校准，不训练 — 见 v2 §9）

---

## 8. 工作分解

| Milestone | 内容                                       | 工程量              | 责任      |
| --------- | ------------------------------------------ | ------------------- | --------- |
| M6.1      | UX 设计 (wireframe)                        | 2 天                | 产品/设计 |
| M6.2      | Backend endpoints (POST /outcomes 等 4 个) | 2 天                | 工程      |
| M6.3      | Dashboard banner + 一键报告 modal          | 1.5 天              | 工程      |
| M6.4      | Decision Day cron + push notification      | 1 天                | 工程      |
| M6.5      | Points 奖励集成                            | 0.5 天              | 工程      |
| M6.6      | Document upload + admin verification queue | 2 天                | 工程      |
| M6.7      | 进 AdmissionCase 池 + Hall alumni badge    | 1.5 天              | 工程      |
| **共**    |                                            | **~10.5 天 (2 周)** |           |

---

## 9. 战略影响

如果按本方案走，**v2 引擎的 v0.1 (M3+M4 in feature flag) 仍然 ship**，但**准确性的真正答案要等 6 个月**。

```
现在 (2026-05): M3 引擎写完，proxy 测试 pass
明天 (~2026-06): M4 集成 + M5 proxy 验证 + feature flag ship
3 个月 (~2026-08): M6 收集到 50+ outcome → 第一次真正测 Brier
6 个月 (~2026-11): 200+ outcome → per-school Platt 校准 → v2.5
12 个月 (~2027-05): 1000+ outcome → 训练真正 ML 模型 (per v2 §9)
```

**这是正确的 study-abroad 平台产品节奏**：录取数据天然延迟，没有 shortcut。

---

## 10. 你需要决策的 5 件事（汇总）

| #   | 决策                | 我建议                                   |
| --- | ------------------- | ---------------------------------------- |
| 1   | Verification 严格度 | B: self-reported + 可选 document upgrade |
| 2   | 激励力度            | B: 点数 + Hall badge + 防刷              |
| 3   | Reminder timing     | D: 多渠道，decision day +3 天            |
| 4   | 私密性              | 默认私密 + opt-in 进 AdmissionCase 池    |
| 5   | MVP 范围            | v0.1 + v0.3 先 (~1.5 周)                 |

确认这 5 个 → 进 M6.1 (UX wireframe)。
