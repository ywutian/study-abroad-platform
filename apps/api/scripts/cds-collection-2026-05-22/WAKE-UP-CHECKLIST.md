# 醒来检查清单 — CDS 收集 2026-05-22

晚上 Claude 完成了 top 25 校的 CDS 数据收集，这里是你 review + 入库的步骤。

## 📊 收集状态

| 项                                                           | 完成度                                                                  |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Top 25 学校处理                                              | **23/25** (UC Berkeley + UCLA 跳过 — 已有 UC 9 校数据)                  |
| 必达 - Top 4 (Princeton/MIT/Harvard/Stanford) HIGH-tier 字段 | ✅ 全部齐全                                                             |
| 必达 - 23 校 acceptance rate                                 | ✅ 23/23                                                                |
| 必达 - SAT 25/75 admit pool                                  | ✅ 22/23（Northwestern 因 test-optional 不公布 Class 2028）             |
| 尽力 - ED/EA 分轮录取率                                      | 🟡 18/23 (Princeton/MIT/Caltech/UChicago/Rice/UMich 未公布)             |
| 尽力 - Hook % (legacy/athlete)                               | 🟡 6/23 详细数据 (Princeton/Harvard/Stanford/UPenn 详细，其他大多 null) |
| Global aggregates                                            | ✅ 5/5 baseline 项                                                      |
| 4 v3 case 重算预测                                           | ⚠️ 见下方"未完成"说明                                                   |

## 🗂 产出文件位置

所有产物在 `apps/api/scripts/cds-collection-2026-05-22/`：

```
school-admit-stats-top25.json        ← 23 校核心数据
global-admit-aggregates.json         ← 跨校 P(category|apply) baseline
state.json                           ← 收集状态
AUDIT-LOG.md                         ← provenance + 数据源
WAKE-UP-CHECKLIST.md                 ← 本文件
FINAL-STATUS.md                      ← 完成总结
draft-add-hook-and-ec-fields.sql     ← Migration 草稿
import-school-admit-stats-top25.ts   ← 自动入库脚本
```

## ✅ 第 1 步：Review 数据 (5-10 分钟)

- [ ] 打开 `school-admit-stats-top25.json` — 抽 3 校核对 acceptance rate 跟你印象/记忆是否一致
- [ ] 重点 review Top 4 (Princeton/MIT/Harvard/Stanford) — 这 4 个是 fixture 种子
- [ ] 看 `AUDIT-LOG.md` — 每校的 source URL 跟数据是否合理
- [ ] 看 `FINAL-STATUS.md` 知道整体收完情况

## ✅ 第 2 步：Apply schema migration (10 分钟)

- [ ] 看 `draft-add-hook-and-ec-fields.sql` — review 字段定义
- [ ] 把字段 paste 到 `apps/api/prisma/schema.prisma` 的 School model
- [ ] 跑：
  ```bash
  pnpm --filter api db:migrate -- --name add_hook_and_ec_fields
  pnpm --filter api db:generate
  ```

## ✅ 第 3 步：Import 数据到 DB (5 分钟)

- [ ] 跑 import 脚本：
  ```bash
  cd apps/api && pnpm exec tsx scripts/cds-collection-2026-05-22/import-school-admit-stats-top25.ts
  ```
- [ ] 检查导入数：
  ```bash
  pnpm exec tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); (async () => { const n = await p.school.count({ where: { edAcceptanceRate: { not: null }, usNewsRank: { lte: 25 } } }); console.log('Schools with ED rate:', n); await p.\$disconnect(); })();"
  ```
  应该 ≥ 18

## ✅ 第 4 步：开始 M3 (Bayesian sequential update 引擎)

入库后即可开 task #13 — v2 设计文档已经规定接口和算法（[docs/PREDICTION_V2_DESIGN.md](docs/PREDICTION_V2_DESIGN.md)）。

第一步建议：

1. 建 `apps/api/src/modules/prediction/v2/bayesian-engine.service.ts`
2. 实现 §4.1 GPA/SAT Bayesian update（用 normal pdf 比较 admit pool vs general apply pool）
3. 实现 §4.2 categorical Bayesian update（用 P(category|admit) from CDS / P(category|apply) from global aggregates）
4. 跑 `scripts/replay-v3-cases.ts` 看 4 个 v3 case 在新引擎下变成多少

## ⚠️ 未完成 / Partial

| 项                                           | 状态                                     | 原因                                             |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------ |
| GPA distribution (CDS C-11)                  | 仅 3 校齐全 (Princeton/Harvard/Stanford) | 多数学校 CDS GPA 字段标 N/A                      |
| Hook % 细数据                                | 6/23                                     | 多数学校不公布                                   |
| EC profile (Crimson/MIT blog 等 MEDIUM tier) | **未收**                                 | Context length 限制；plan §P1.5 部分留到下次执行 |
| 4 v3 case 重算                               | **未跑**                                 | 需要先入库 + 写 M3 才能验证                      |
| import script                                | 仅 admit-stats，没生成 hooks/EC import   | EC 数据没收，对应 import 不需要                  |

## 🔁 可选 - 续跑

如果想补完 P1.5 (EC profile from Crimson 等 MEDIUM tier)，可以:

```bash
# Resume from where Claude left off:
# 重新启动 Claude session，让它读 state.json + 续跑 MEDIUM tier
```

未做学校：UC Berkeley, UCLA（已在 UC 9 校 seed 数据中，跳过避免重复）。

## 📋 数据完整度按学校

完整度 = (HIGH tier 字段填充率)

| 排名 | 学校         | acceptanceRate | ED/EA Rate         | SAT 25/75 | GPA dist | Hooks         |
| ---- | ------------ | -------------- | ------------------ | --------- | -------- | ------------- |
| 1    | Princeton    | ✅             | ⚠️ historical only | ✅        | ✅       | ✅            |
| 2    | MIT          | ✅             | ✅                 | ✅        | 🟡       | ✅ (legacy=0) |
| 3    | Harvard      | ✅             | ✅                 | ✅        | ✅       | ✅            |
| 3    | Stanford     | ✅             | ⚠️                 | ✅        | 🟡       | ✅            |
| 5    | Yale         | ✅             | ✅                 | 🟡        | 🟡       | 🟡            |
| 6    | UPenn        | ✅             | ✅                 | ✅        | 🟡       | ✅            |
| 7    | Caltech      | ✅             | ⚠️                 | ✅        | 🟡       | ✅ (legacy=0) |
| 7    | Duke         | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 9    | Brown        | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 9    | JHU          | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 9    | Northwestern | ✅             | ✅                 | 🟡        | 🟡       | 🟡            |
| 12   | Columbia     | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 12   | Cornell      | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 12   | UChicago     | ✅             | ⚠️                 | ✅        | 🟡       | 🟡            |
| 17   | Rice         | ✅             | 🟡                 | ✅        | 🟡       | 🟡            |
| 18   | Dartmouth    | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 18   | Vanderbilt   | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 20   | Notre Dame   | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 21   | UMich        | ✅             | 🟡                 | ✅        | 🟡       | 🟡            |
| 22   | Georgetown   | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 24   | CMU          | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 24   | Emory        | ✅             | ✅                 | ✅        | 🟡       | 🟡            |
| 24   | WashU        | ✅             | ✅                 | ✅        | 🟡       | 🟡            |

图例: ✅ HIGH | 🟡 MEDIUM/部分 | ⚠️ HIGH 但学校未公布 | ❌ 完全没有

## 🎯 接下来你最该做的

**最高 ROI**: 把这 23 校数据入库 → 写 M3 引擎 → 跑 4 v3 case → 看 Stanford REA 是不是真的能从 v3 的 2% 上升到 12-15% 区间。**这是验证 v2 设计是否真的更准的关键一步**。
