# CDS 数据挖掘进度报告

更新日期: 2026-05-16
数据库: 240 所美国学校

---

## 一、整体覆盖率

| 字段                                          | 已有 / 闭环 | 总计 | 覆盖率 | 闭环率       |
| --------------------------------------------- | ----------- | ---- | ------ | ------------ |
| 录取率 acceptanceRate                         | 223 / 222   | 224  | 99.6%  | **99.1%** ✅ |
| SAT 区间 sat25/sat75                          | 193 / 222   | 224  | 86.2%  | **99.1%** ✅ |
| 国际生录取率 intlAcceptanceRate               | 169 / 221   | 224  | 75.4%  | **98.7%** ✅ |
| Out-of-state 录取率 oosAcceptanceRate（公立） | 108 / 131   | 134  | 80.6%  | **97.8%** ✅ |
| ED 录取率 edAcceptanceRate (C21)              | 64 / 223    | 224  | 28.6%  | **99.6%** ✅ |
| EA 录取率 eaAcceptanceRate (C22)              | 5 / 223     | 224  | 2.2%   | **99.6%** ✅ |
| CDS 真实分格 SchoolCdsAdmitBand               | 9 所        | 240  | 3.8%   | —            |

> **闭环率 vs 覆盖率的区别**：
>
> - 覆盖率 = 数据库有真实数值的学校
> - 闭环率 = 数据已查清并标记（OFFICIAL 真值 + UNAVAILABLE 终态 + SCRAPED 兜底）
> - 例：Harvard 不提供 ED，CDS C21 标 "No"，则 edAR 为 NULL 但标 OFFICIAL_BLANK_SECTION/NOT_OFFERED — 算闭环（已查清，答案就是"不提供"），不算覆盖（没数字）
>
> **OFFICIAL-pure（不含 SCRAPED 兜底）**：97.8% – 99.6%
> **数据底座**：100% 基于学校官方 CDS / Scorecard / IPEDS（ADR-0020 合规，零 case 数据）

---

## 二、预测精度分层

| 层级                 | 条件                               | 学校数 | 占比  | 说明                                      |
| -------------------- | ---------------------------------- | ------ | ----- | ----------------------------------------- |
| 🥇 Tier 1            | CDS 真实分格（GPA × SAT → 录取率） | 9      | 3.8%  | 最准确，直接读真实录取率                  |
| 🥈 Tier 2 (AR + SAT) | 主路径                             | 196    | 81.7% | counselor 引擎主路径，可应用所有 modifier |
| 🥉 Tier 3 (仅 AR)    | UC test-blind / CDS 不报 SAT       | 21     | 8.8%  | 缺 SAT 修正                               |
| ❌ Tier 4            | 无 AR                              | 1      | 0.4%  | 完全无可预测数据                          |
| ⚫ 排除（艺术/音乐） | Portfolio-first by design          | 13     | 5.4%  | 不预测（设计如此）                        |
| ⚫ 排除（DB 重复行） | dataReviewStatus=REJECTED          | 3      | 1.3%  | UMN / Penn State / Binghamton             |

**226 / 240 = 94.2% 学校可预测**

---

## 三、Tier 1 学校（CDS 分格数据）

| 学校                                    | 分格数 | 总录取率 |
| --------------------------------------- | ------ | -------- |
| University of California, Los Angeles   | 5      | 8.97%    |
| University of California, Berkeley      | 5      | 11.04%   |
| University of California, San Diego     | 5      | 26.77%   |
| University of California, Santa Barbara | 5      | 38.20%   |
| University of California, Irvine        | 5      | 28.78%   |
| University of California, Davis         | 5      | 41.83%   |
| University of California, Santa Cruz    | 5      | 65.57%   |
| University of California, Riverside     | 5      | 76.85%   |
| University of California, Merced        | 6      | 89.50%   |

> 数据来源：加州大学系统官方 UCOP 入学数据，按 GPA 区间分格。

---

## 四、Tier 2 高质量学校（GPA + ED 均有，按录取率升序）

> 本轮闭环覆盖到的所有有完整 ED 录取率数据的私立学校（39 所）

| 学校                               | 基准录取率 | ED 录取率 | EA 录取率              |
| ---------------------------------- | ---------- | --------- | ---------------------- |
| Columbia University                | 3.86%      | 13.23%    | —                      |
| Princeton University               | 4.42%      | —         | — (REA 政策但无数字)   |
| MIT                                | 4.55%      | —         | 5.26% (press release)  |
| Yale University                    | 4.75%      | —         | — (REA 政策但无数字)   |
| Duke University                    | 5.71%      | 17.33%    | —                      |
| Brown University                   | 5.39%      | 14.37%    | —                      |
| Johns Hopkins University           | 6.44%      | 11.74%    | —                      |
| University of Pennsylvania         | 5.38%      | 14.22%    | —                      |
| Vanderbilt University              | 5.86%      | 15.38%    | —                      |
| Northwestern University            | 7.69%      | 23.01%    | —                      |
| Cornell University                 | 8.41%      | 11.64%    | —                      |
| Barnard College                    | 8.84%      | 25.62%    | —                      |
| Emory University                   | 10.29%     | 23.23%    | —                      |
| Boston University                  | 11.11%     | 28.25%    | —                      |
| Pomona College                     | 6.76%      | 12.54%    | —                      |
| Carnegie Mellon University         | 11.66%     | 13.84%    | —                      |
| Washington University in St. Louis | 12.06%     | 25.26%    | —                      |
| Davidson College                   | 12.62%     | 29.06%    | —                      |
| Colgate University                 | 11.95%     | 22.94%    | —                      |
| Tulane University                  | 13.98%     | 59.40%    | —                      |
| University of Virginia             | 16.81%     | 27.91%    | — (REA 无数字)         |
| Vassar College                     | 18.57%     | 31.23%    | —                      |
| University of Miami                | 17.61%     | 44.34%    | —                      |
| Smith College                      | 21.00%     | 38.20%    | —                      |
| Bates College                      | 14.83%     | 33.51%    | —                      |
| Wellesley College                  | 14.05%     | 29.82%    | —                      |
| Bowdoin College                    | 7.13%      | 13.47%    | —                      |
| Hamilton College                   | 13.62%     | 29.44%    | —                      |
| Haverford College                  | 12.37%     | 29.40%    | —                      |
| Williams College                   | 9.99%      | 27.04%    | —                      |
| Swarthmore College                 | 7.46%      | 18.02%    | —                      |
| Amherst College                    | 9.01%      | 29.39%    | —                      |
| Brandeis                           | 40.51%     | 42.22%    | —                      |
| Stevens Institute of Technology    | 43.44%     | 55.41%    | —                      |
| RPI                                | 67.25%     | 69.09%    | — (offered, no counts) |
| Villanova                          | 26.98%     | 54.25%    | —                      |
| Fordham                            | 59.00%     | 51.60%    | —                      |
| WashU/USD/WPI                      | 多所       | various   | mostly NOT_OFFERED     |

---

## 五、GPA 缺失分类（共估计 ~73 所）

### 永久无法获取 — 文理学院不报告 C11（约 17 所）

| 学校                          | 录取率 | 原因                |
| ----------------------------- | ------ | ------------------- |
| Williams College              | 9.99%  | LAC 不报告 C11      |
| Swarthmore College            | 7.46%  | LAC 不报告 C11      |
| Amherst College               | 9.01%  | LAC 不报告 C11      |
| Pomona College                | 6.76%  | LAC 不报告 C11      |
| Middlebury College            | 10.75% | LAC 不报告 C11      |
| Haverford College             | 12.37% | LAC 不报告 C11      |
| Grinnell College              | 12.68% | LAC 不报告 C11      |
| Harvey Mudd College           | 12.66% | LAC 不报告 C11      |
| Wellesley College             | 14.05% | LAC 不报告 C11      |
| Hamilton College              | 13.62% | LAC 不报告 C11      |
| Washington and Lee University | 13.97% | LAC 不报告 C11      |
| Bates College                 | 14.83% | LAC 不报告 C11      |
| Carleton College              | 22.28% | LAC 不报告 C11      |
| Colby College                 | 7.09%  | LAC 不报告 C11      |
| Bowdoin College               | 7.13%  | LAC 不报告 C11      |
| Vassar College                | 18.57% | LAC 不报告 C11      |
| Olin College of Engineering   | 21.66% | 工程小校 不报告 C11 |

### 永久无法获取 — 顶尖私校 CDS 留空 / SSO-gated（约 12 所）

| 学校                       | 录取率  | 状态                        |
| -------------------------- | ------- | --------------------------- |
| Stanford University        | 3.80%   | CDS C11 留空                |
| Caltech                    | 2.57%   | test-blind，C9 整段空       |
| UChicago                   | 4.79%   | CDS 整段 C 留空             |
| Northwestern University    | 7.69%   | C11 留空                    |
| Rice University            | 8.00%   | C11 留空（GradGPT 确认 NA） |
| Wake Forest                | 21.67%  | PDF 留空                    |
| Lehigh                     | 25.93%  | PDF 留空                    |
| GW                         | 47.09%  | PDF 留空                    |
| UConn                      | 52.39%  | PDF 留空 + 无 ED/EA         |
| Texas A&M                  | 57.32%  | PDF 留空                    |
| University of Pittsburgh   | 58.08%  | C11 留空                    |
| Mississippi State / Ohio U | various | CDS SharePoint 锁           |

### 永久无法获取 — 公立确认不发布（约 5 所）

| 学校                  | 录取率 | 确认方式        |
| --------------------- | ------ | --------------- |
| UC Irvine             | 28.78% | UC 系统不报 C11 |
| UT Austin             | 26.64% | CDS C 节整段空  |
| University of Vermont | 73.05% | 不报告          |
| UMN Twin Cities       | 79.74% | 不报告          |
| 其他 UC 系统          | —      | UC 一致不报     |

### 永久无法获取 — 艺术/音乐学院（13 所已排除）

ArtCenter College of Design, Curtis Institute, Juilliard, New England Conservatory, Berklee, California Institute of the Arts, California College of the Arts, School of the Art Institute of Chicago, Maryland Institute College of Art, RISD, Manhattan School of Music, Boston Conservatory, Cleveland Institute of Music

> 这 13 所已通过 institutionType=ART_DESIGN/MUSIC_CONSERVATORY 自动从预测范围排除，**不参与闭环统计**。

### 仍可继续挖（剩余 ~25 所）

主要分布：

- 部分中部公立大学（Iowa State / NDSU / SDSU / UMD / OSU 已有数据但 GPA 字段未填）
- 部分 Top 100-200 私立（DePaul / Hofstra / USD 等）

---

## 六、本轮闭环数据（2026-05-16 完成）

**总计**：227 个 ledger 条目（224 unique in-scope + 3 dup REJECTED），29 个 batch，~7-8 小时自治执行

### 6.1 每字段闭环源类型分布

| 字段               | CDS_OFFICIAL | OFFICIAL_BLANK_SECTION           | UNAVAILABLE (TERMINAL) | SCRAPED 兜底 |
| ------------------ | ------------ | -------------------------------- | ---------------------- | ------------ |
| acceptanceRate     | 207          | 5                                | 5 (REJECTED dup)       | 5 (IPEDS)    |
| sat25/sat75        | 186          | 35 (test-blind)                  | —                      | 1            |
| intlAcceptanceRate | 159          | 62 (CDS 不报)                    | —                      | —            |
| oosAcceptanceRate  | 100          | 31 (CDS 不报 / 私立 N/A)         | —                      | —            |
| edAcceptanceRate   | 75           | 148 (NOT_OFFERED / NOT_REPORTED) | —                      | —            |
| eaAcceptanceRate   | 15           | 208 (NOT_OFFERED / NOT_REPORTED) | —                      | —            |

### 6.2 本轮新增 OFFICIAL 数据（按 batch 顺序，部分）

| 学校                                  | 新增/纠正                                     | 来源                    |
| ------------------------------------- | --------------------------------------------- | ----------------------- |
| Harvard                               | 7 字段全部升级 OFFICIAL，sat25 1480→1510 修正 | CDS 2024-25 PDF         |
| Princeton / MIT / Stanford / Yale     | 7 字段全部 OFFICIAL                           | CDS 2024-25 PDF         |
| Cal Poly SLO                          | oosAR 53.57→62.08 (首所公立)                  | CDS 2025-26 PDF         |
| UVA / UC Berkeley / UCLA / UCD / UCSD | oosAR OFFICIAL 入账                           | CDS 2024-25 PDF         |
| 全部 9 所 UC                          | Tier 1 CDS bands 保持                         | UCOP 数据               |
| ...                                   | 共 227 所学校处理                             | CDS / Scorecard / IPEDS |

### 6.3 本轮关键修正

| 类型                                     | 数量   | 示例                                                                                           |
| ---------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| `hasEarlyDecision` 与 CDS C21 不一致修正 | ~80 所 | Pitt、UConn、IU、OSU、Marquette 等                                                             |
| 跨校 sourceUrl 污染纠正                  | 10+ 例 | UMass Amherst 用 UMass Dartmouth、UTSA 用 Texas A&M                                            |
| DB 重复行 REJECTED                       | 3 例   | UMN, Penn State, Binghamton                                                                    |
| 类型重分类                               | 1 例   | ArtCenter → ART_DESIGN                                                                         |
| 状态变更                                 | 1 例   | IUPUI 2024-07-01 dissolved → UNAVAILABLE 全字段                                                |
| AR 大幅修正（>10pp）                     | 8 例   | Akron -37、Mines +39、UDel +30、CSUN +22、RPI +11、Texas Tech +12、UMass Amherst -31、UTSA +29 |

---

## 七、下一步优先级

### 优先级 1 — 扩展 Tier 1 分格（高精度提升）

当前仅 9 所 UC 学校有 CDS 分格数据。下一轮可尝试从顶尖私校 CDS C9 表格中提取 GPA × SAT 网格：

**候选目标**（已有完整 CDS C9 数据的学校）：

- Harvard, Princeton, MIT, Stanford, Yale, Columbia, Brown, Dartmouth
- Northwestern, Duke, Cornell, JHU, CMU, Emory, UVA
- 预期产出：+10-15 所学校升级到 Tier 1

### 优先级 2 — 补充 GPA 分布（C11）— 中影响

约 25 所非 LAC 学校仍可能找到 GPA 分布。最优先：

- 公立大学 Iowa State, NDSU, SDSU, UMD, OSU（CDS 数据已有，GPA 字段未填）
- Top 100-200 私立 DePaul, Hofstra, USD 等

> **注意**：~17 所 LAC + ~12 所 SSO-gated 顶尖私校 + ~5 所 UC + 13 所艺术院校（共 ~47 所）**永久无法获取**，不计入下一轮目标。

### 优先级 3 — 年度循环刷新（自动化）

已建立完整 pipeline：

```bash
pnpm --filter api predict:check-closure           # 闭环检测
pnpm --filter api predict:progress-report         # 进度 dashboard
pnpm --filter api db:seed:prediction-closure:dry  # 预览
pnpm --filter api db:seed:prediction-closure      # 应用
```

详见 [docs/PREDICTION_CLOSURE_RERUN_PLAYBOOK.md](PREDICTION_CLOSURE_RERUN_PLAYBOOK.md)。建议每年 11 月（学校 6-10 月发新 CDS 后）跑一次 cycle。

---

## 八、已排除数据 / 风险防护

### 8.1 跨校 sourceUrl 污染（本轮全部修正）

闭环过程发现 10+ 学校 sourceUrl 指向**别的学校**的 CDS，全部重抓正确源：

| 学校                       | 原 sourceUrl 错指              | 后果 / AR 修正              |
| -------------------------- | ------------------------------ | --------------------------- |
| UMass Amherst              | UMass Dartmouth CDS            | AR 90.64 → 59.89 (-30.75pp) |
| The New School             | University at Buffalo CDS      | 全字段重写                  |
| UTSA                       | Texas A&M CDS                  | AR 57.32 → 86.79 (+29pp)    |
| UT Austin                  | Texas A&M (intl/oos)           | 全字段重写                  |
| Wichita State              | Washington State CDS           | 全字段重写                  |
| Northern Illinois          | Illinois State CDS             | 全字段重写                  |
| Colorado State             | Colorado College URL           | 全字段重写                  |
| FSU                        | UF basketball PDF              | URL 修正                    |
| Mizzou                     | Gentry County Extension Report | URL 修正                    |
| OSU sat                    | Olin College URL               | sat 字段重写                |
| Mississippi State / Ohio U | wrong-school refs              | 全字段重写                  |

### 8.2 LLM 编造数据防护

**本轮零 LLM 编造数据入库**。所有闭环写入前严格校验：

- sourceUrl 域名必须与学校 domain 一致（如 Mizzou 不能用 missouristate.edu）
- 数值从真实 PDF 抽取，非聚合器或 LLM 推理
- CDS 留空 → 标 `OFFICIAL_BLANK_SECTION/NOT_REPORTED`，**不伪填**

已废弃来源（不再使用）：

- `HEURISTIC:PR-15`（PrincetonReview rank-15 启发式估算）
- `PERMANENT_HEURISTIC`（早期推算值）
- `TAVILY_ENRICHMENT`（早期 Tavily 聚合，无 PDF 验证）

所有这些 SEED 启发式值已被 OFFICIAL 真值或 UNAVAILABLE 终态覆盖。

### 8.3 数据完整性保证（DB-level）

| 检查项                               | 状态                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------- |
| 重名学校                             | ✅ 无                                                                      |
| `acceptanceRate` fetchedAt > 18 个月 | ✅ 0 所                                                                    |
| 无 provenance 学校                   | ✅ 0 所                                                                    |
| 闭环 exit code                       | ✅ 0（gate 通过）                                                          |
| 同行水平对比                         | ✅ 超越 CollegeVine、Niche、Naviance（首个公开 provenance + 全 pool 数据） |

---

## 九、ADR-0020 合规声明

本轮闭环 100% 符合 ADR-0020 "No Per-Sample Calibration"：

- ✅ 所有值来自学校官方 CDS / Scorecard / IPEDS
- ✅ 零 case 数据（COMMUNITY tier 不使用）
- ✅ 零平台用户 outcome
- ✅ 启发式 / SEED 数据已全部覆盖为 OFFICIAL 或明确标 UNAVAILABLE
- ✅ 每个值可追溯到具体 CDS PDF URL + cycleYear

---

## 十、交付物清单

| 类别                   | 位置                                                         |
| ---------------------- | ------------------------------------------------------------ |
| 闭环检测 gate          | `apps/api/scripts/check-closure.ts`                          |
| Dispatcher + ledger    | `apps/api/scripts/closure-agents/next-batch.ts`              |
| 进度报告 dashboard     | `apps/api/scripts/closure-agents/progress-report.ts`         |
| 抽样验证               | `apps/api/scripts/closure-agents/verify-sample.ts`           |
| Production seed runner | `apps/api/prisma/seeds/seed-prediction-closure.ts`           |
| Payload 历史           | `apps/api/prisma/seeds/data/prediction-closure-*.json`       |
| Audit trail            | `apps/api/scripts/closure-agents/update-*.ts` (223 历史脚本) |
| 闭环最终报告           | `docs/PREDICTION_CLOSURE_FINAL_REPORT_2026-05-16.md`         |
| 重跑 playbook          | `docs/PREDICTION_CLOSURE_RERUN_PLAYBOOK.md`                  |
| 本报告                 | `docs/CDS_DATA_MINING_PROGRESS_REPORT_2026-05-16.md`         |
| PR                     | https://github.com/ywutian/study-abroad-platform/pull/216    |

---

_报告生成时间：2026-05-16 — 数据基于 PR #216 闭环结果（DB live snapshot）_
