# 预测系统现状核对报告

**日期**: 2026-04-22
**触发原因**: 用户反馈"预测系统太复杂不精准"→ 拟扩展外部教师源 → 核对后发现前期 Explore agent 报告大量幻觉，plan 前提不成立 → 重新核实
**核对方式**: 直接读源代码（grep + 逐文件 Read），不依赖 subagent

---

## 1. 事实纠偏（前期幻觉 vs 源码真相）

| 前期假设                                                   | 源码真相                          | 证据                                                                                    |
| ---------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| `DistillationService` 已上线                               | ❌ **不存在**                     | `grep -r distillation apps/api/src` → 0 匹配                                            |
| 外部教师信号 CollegeVine(w=0.6) + CampusReel(w=0.3)        | ❌ **不存在**                     | prediction 模块无 teacher signal 相关 service                                           |
| Prisma `CompetitorPrediction` / `StaticTeacherSnapshot` 表 | ❌ **不存在**                     | schema.prisma 无匹配                                                                    |
| CollegeVine 作为预测教师                                   | ❌ **错位**                       | CollegeVine 仅出现在 `essay/strategies/collegevine.strategy.ts`（文书策略），与预测无关 |
| Niche 爬虫 13 个 + 生产运行                                | ⚠️ **部分真**                     | 实际 4 个 TS 脚本（非生产调度，手动运行）                                               |
| "prediction-distillation-blend" feature flag               | ⚠️ 仅存在于 prediction.service.ts | 实际代码无消费逻辑                                                                      |

---

## 2. 真实架构现状

### 2.1 外部数据源（已完整接入 + cron 调度）

`apps/api/src/modules/school/` 下**已实现 7 个合法外部数据源**：

| 数据源                        | 调度                | 合规              | 文件                                                                                           |
| ----------------------------- | ------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| **College Scorecard API**     | 每月 1 日 03:00     | ✅ 官方政府 API   | [data-sync.scheduler.ts:35](apps/api/src/modules/school/data-sync.scheduler.ts)                |
| **Urban Institute IPEDS API** | 季度（1/4/7/10 月） | ✅ 合规，免费 API | [urban-institute-data.service.ts](apps/api/src/modules/school/urban-institute-data.service.ts) |
| **IPEDS 更新监控**            | 每周一 09:00        | ✅                | [ipeds-monitor.service.ts:29](apps/api/src/modules/school/ipeds-monitor.service.ts)            |
| **IPEDS CSV 导入**            | 手动/季度备份       | ✅ 政府公开数据   | [data-sync.scheduler.ts:148](apps/api/src/modules/school/data-sync.scheduler.ts)               |
| **BigFuture** (College Board) | 季度爬虫            | ⚠️ 需审 ToS       | [scrapers/bigfuture.scraper.ts](apps/api/src/modules/school/scrapers/bigfuture.scraper.ts)     |
| **Appily**                    | 季度爬虫            | ⚠️ 需审 ToS       | [scrapers/appily.scraper.ts](apps/api/src/modules/school/scrapers/appily.scraper.ts)           |
| **US News 排名**              | 年度手动提醒        | ✅（手工更新）    | [data-sync.scheduler.ts:162](apps/api/src/modules/school/data-sync.scheduler.ts)               |

**所有数据** → `SchoolDataMerger` 合并（带 provenance tier）→ `School` / `SchoolMetric` 表

### 2.2 Niche 爬虫真实状态

| 文件                                            | 运行方式                  | 状态       |
| ----------------------------------------------- | ------------------------- | ---------- |
| `apps/api/scripts/scrape-niche-grades.ts`       | 手动 `npx ts-node`        | 非生产调度 |
| `apps/api/scripts/scrape-niche-high-schools.ts` | 手动（admin UI 给出命令） | 非生产调度 |
| `apps/api/scripts/scrape-niche-puppeteer.ts`    | 手动                      | 非生产调度 |
| `apps/api/scripts/seed-niche-grades.ts`         | 手动 seed                 | 非生产调度 |

**合规性**：脚本文件头已注释"may violate Niche ToS"。无 cron 调用，无生产自动运行。风险级别比想象中低，但仍建议下线或替换。

### 2.3 Prediction 模块已消费的学校字段

`prediction-transformer.service.ts:241-299` 的 `schoolToInput()` 读取 20+ 字段，**每个带 provenance tier 权重**：

- `acceptanceRate` / `intlAcceptanceRate` / `intlStudentPct`
- `satAvg` / `sat25` / `sat75` / `actAvg` / `act25` / `act75`
- `usNewsRank` / `graduationRate` / `retentionRate`
- `needBlindInternational` / `percentNeedMet` / `averageNetPrice`
- `studentFacultyRatio` / `testingPolicy` / `testOptional`

**结论**：预测系统**已充分使用已接入的外部数据**，字段级 provenance tier 系统（`TRUST_TIER_PREDICTION_WEIGHT`）已生效。

### 2.4 Prediction 模块真实规模

| 文件                                                | 行数     |
| --------------------------------------------------- | -------- |
| `prediction.service.ts`（主编排）                   | **1715** |
| `prediction-ml-primary.service.ts`（v5）            | 489      |
| `prediction-calibration.service.ts`（Platt）        | 417      |
| `prediction-hook-modifiers.service.ts`（6 类 Hook） | 309      |
| **合计（核心 4 文件）**                             | 2930     |

21 个 service 注入到主服务（见 [prediction.module.ts](apps/api/src/modules/prediction/prediction.module.ts)）。

### 2.5 Outcome 采集基础设施

- Enum `PredictionOutcomeLabel`: `ADMITTED` / `REJECTED` / `WAITLISTED` / `DEFERRED` / `WITHDRAWN` / `UNKNOWN` / `CENSORED`
- `PredictionResult.outcomeLabel` + `outcomeLabelRecords` 已实现
- API: `PATCH /predictions/:schoolId/result`
- 前端 UI: `PredictionHistoryTab.tsx` 已有反馈按钮

---

## 3. 用户"蒸馏系统"的含义确认

**用户定义**: "拿一个 case 去外部看看给的录取率 我们拿来用"

**即 profile-aware teacher signal**：输入 {profile, school} → 外部返回概率 → 融入我方预测

**核对结果**:

- ❌ 代码中不存在此功能
- ⚠️ 可能的外部源：CollegeVine（Playwright 会话拦截）、AI 模拟其他顾问（LLM）、合作 API（无）
- ✅ 已有的 school 级外部数据（Scorecard/IPEDS）**不是 profile-aware**，只能告诉你"学校平均录取率 X%"

**结论**: 要实现"拿 case 去外部查录取率"的蒸馏层，需从零构建，且需解决合规问题（公开合法的 profile-aware API 几乎不存在）。

---

## 4. 真实问题定位

原问题"复杂但不准"的实际成因（按可能性排序）：

### (A) 工程复杂度真实存在，但不是精度瓶颈

- `prediction.service.ts` 1715 行、21 个 service 注入 ✅ 真实
- 3 层校准叠加（Hooks → Platt → Per-school）✅ 真实
- v3/v4/v5 共存 + 3 个 feature flag ✅ 真实
- **影响**：迭代速度慢、调试困难 — 但直接影响的是**开发者**，不是预测精度

### (B) 数据其实充沛，但有更新频率 gap

- College Scorecard 年度更新，IPEDS 1 年延迟 — 对实时预测够用
- US News 排名手动更新 — 可能过时
- **影响**：某些快速变化的字段（测试政策、录取率）可能滞后

### (C) 缺 profile-aware 外部教师信号（用户真正要的"蒸馏"）

- 目前所有预测都来自自家引擎
- 缺少"权威第三方对同一 profile 的概率估计"作为参照
- **影响**：无法通过 triangulation 降低模型系统性偏差

### (D) Platt 校准样本稀疏

- 需要 ≥50 条 verified outcomes/校，当前未知
- Outcome 采集 UI 存在，但采集率未知
- **影响**：小学校或冷门学校校准失效，回退到裸 ML 输出

### (E) 用户感知层信息过载

- 预测卡片 6+ 维度 + 5 个可展开面板
- `confidenceReason` vs `uncertaintyReasons` 双维度冲突
- 缺少信任锚点（同类学生案例、本系统历史 hit rate）
- **影响**：客户反馈"不准"可能部分是"看不懂"

---

## 5. 可选路径（按 ROI 排序）

| #     | 路径                                                           | 预期收益                | 预期成本                   | ROI   |
| ----- | -------------------------------------------------------------- | ----------------------- | -------------------------- | ----- |
| **1** | 测量 Platt 校准样本量 + 推动 outcome 采集（如顾问激励）        | 高（直接改善精度）      | 低（2-3 天脚本 + UI 文案） | ★★★★★ |
| **2** | 前端感知层精简（合并 confidence/uncertainty、突出同类案例）    | 中-高（解决"感觉不准"） | 中（1 周）                 | ★★★★  |
| **3** | 拆分 1715 行 `prediction.service.ts`（Coordinator + Pipeline） | 低（迭代速度）          | 高（2-3 周）               | ★★    |
| **4** | 从零搭蒸馏层（含 profile-aware teacher）                       | 中（triangulation）     | 高（2-4 周 + 合规）        | ★★    |
| **5** | Hook 系数 ablation + 删除无效 Hook                             | 中（精度）              | 中（1-2 周）               | ★★★   |
| **6** | 下线 Niche 脚本 + 评估 BigFuture/Appily 合规                   | 低（合规保险）          | 低（1 天）                 | ★★★   |

---

## 6. 建议的下一步决策

**两条主推荐路径**：

### 路径 α（数据驱动快赢）:

1. 先做 Outcome 样本量诊断（1 天脚本）→ 回答"我们目前有多少 verified outcomes"
2. 若 <50/校：推动采集（顾问激励 + UI 强化）
3. 若 ≥50/校但 Brier 仍高：Hook ablation
4. **成本**: 1-2 周；**直接改善精度**

### 路径 β（感知层快赢）:

1. 前端精简预测卡片 → 合并信任维度、突出同类学生案例
2. 加入"本系统在该类学校的历史 hit rate"（需路径 α 的数据）
3. **成本**: 1 周；**直接解决"客户说不准"的部分**

**不推荐**立即启动路径 4（从零搭蒸馏层）—— 现有数据资产尚未充分利用，且合规成本高。

---

## 附录 A: 核对命令（供复现）

```bash
# 确认无 DistillationService
grep -r "distillation\|Distillation" apps/api/src → 0 matches

# 确认 prediction 真实 services
cat apps/api/src/modules/prediction/prediction.module.ts → 21 services

# 确认外部数据源调度
grep -l "@Cron" apps/api/src/modules/school/*.ts → 4 schedulers

# 确认 Niche 脚本未被调度
grep -r "scrape-niche\|scrapeNiche" apps/api/src → 0 matches in src/
```

## 附录 B: 已知未验证的现状问题（需要数据）

- [ ] 当前 `PredictionResult.actualResult` 非空样本数（分学校）
- [ ] 过去 30/90 天 Brier Score（分 tier）
- [ ] v5 ML-Primary 当前是否 enabled（看 FeatureFlag DB）
- [ ] BigFuture / Appily ToS 审查结论
