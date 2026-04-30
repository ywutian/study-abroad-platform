# CDS 数据挖掘进度报告

**更新日期**: 2026-04-30  
**数据库**: 240 所美国学校

---

## 一、整体覆盖率

| 字段                                  | 已有    | 总计 | 覆盖率  |
| ------------------------------------- | ------- | ---- | ------- |
| 录取率 `acceptanceRate`               | 240     | 240  | 100%    |
| SAT 区间 `sat25/sat75`                | 238     | 240  | 99%     |
| 国际生录取率 `intlAcceptanceRate`     | 240     | 240  | 100%    |
| GPA 分布 `gpaDistribution` (C11)      | **167** | 240  | **70%** |
| ED 录取率 `edAcceptanceRate` (C21)    | 62      | 240  | 26%     |
| EA 录取率 `eaAcceptanceRate` (C21)    | 12      | 240  | 5%      |
| CDS 真实分格数据 `SchoolCdsAdmitBand` | 9 所    | 240  | 4%      |

---

## 二、预测精度分层

| 层级               | 条件                           | 学校数  | 说明                     |
| ------------------ | ------------------------------ | ------- | ------------------------ |
| 🥇 **Tier 1**      | CDS 真实分格（GPA×SAT→录取率） | **9**   | 最准确，直接读真实录取率 |
| 🥈 **Tier 2 高质** | GPA + SAT + ED 均有            | **39**  | 可计算所有修正因子       |
| 🥉 **Tier 2 良好** | GPA + SAT（无 ED）             | **128** | 缺 ED 加成，其余正常     |
| ⚪ **Tier 2 基础** | 仅 SAT + 录取率                | **73**  | GPA 修正靠算法估算       |
| ❌ **无法预测**    | 无 SAT 数据                    | **2**   | Curtis, Juilliard        |

---

## 三、Tier 1 学校（CDS 分格数据）

| 学校             | 分格数 | 录取率区间 |
| ---------------- | ------ | ---------- |
| UC Berkeley      | 5      | 0.5% – 20% |
| UC Davis         | 5      | 3% – 50%   |
| UC Irvine        | 5      | 1% – 33%   |
| UC Los Angeles   | 5      | 0.3% – 17% |
| UC Merced        | 6      | 45% – 92%  |
| UC Riverside     | 5      | 10% – 80%  |
| UC San Diego     | 5      | 1% – 38%   |
| UC Santa Barbara | 5      | 1% – 40%   |
| UC Santa Cruz    | 5      | 5% – 62%   |

> 数据来源：加州大学系统官方 UCOP 入学数据，按 GPA 区间分格。

---

## 四、Tier 2 高质量学校（GPA + ED 均有）

| 学校                               | 基准录取率 | ED 录取率 | EA 录取率 |
| ---------------------------------- | ---------- | --------- | --------- |
| Columbia University                | 3.9%       | 13.2%     | —         |
| Johns Hopkins University           | 4.6%       | 11.7%     | —         |
| Northeastern University            | 5.0%       | 43.1%     | —         |
| Vanderbilt University              | 5.1%       | 15.4%     | —         |
| Duke University                    | 5.2%       | 17.3%     | —         |
| Brown University                   | 5.2%       | 14.4%     | —         |
| University of Pennsylvania         | 5.4%       | 14.2%     | —         |
| Dartmouth College                  | 5.4%       | 19.2%     | —         |
| Barnard College                    | 7.0%       | 27.1%     | —         |
| Cornell University                 | 8.4%       | 11.6%     | —         |
| Boston University                  | 10.7%      | 28.3%     | —         |
| Carnegie Mellon University         | 11.7%      | 13.8%     | —         |
| Washington University in St. Louis | 12.1%      | 25.3%     | —         |
| Davidson College                   | 12.6%      | 29.1%     | —         |
| Colgate University                 | 13.5%      | 19.5%     | —         |
| Emory University                   | 14.5%      | 23.2%     | —         |
| Tulane University                  | 14.7%      | 59.4%     | —         |
| University of Virginia             | 16.5%      | 27.9%     | —         |
| Vassar College                     | 18.6%      | 31.2%     | —         |
| University of Miami                | 19.0%      | 44.3%     | —         |
| Smith College                      | 20.5%      | 38.2%     | —         |
| Villanova University               | 27.0%      | 54.3%     | —         |
| William & Mary                     | 33.0%      | 47.0%     | —         |
| Case Western Reserve University    | 37.8%      | 1.0%      | —         |
| University of Rochester            | 40.1%      | 38.1%     | —         |
| Brandeis University                | 40.5%      | 42.2%     | —         |
| Howard University                  | 41.3%      | 49.4%     | —         |
| Fordham University                 | 43.0%      | 51.6%     | —         |
| Stevens Institute of Technology    | 43.4%      | 55.4%     | —         |
| Loyola Marymount University        | 45.1%      | 44.1%     | **52.4%** |
| Santa Clara University             | 47.9%      | 80.1%     | —         |
| Baylor University                  | 51.3%      | 76.7%     | —         |
| Rensselaer Polytechnic Institute   | 56.1%      | 57.9%     | —         |
| Worcester Polytechnic Institute    | 60.2%      | 75.6%     | **68.9%** |
| Illinois Institute of Technology   | 60.8%      | 68.1%     | —         |
| Southern Methodist University      | 63.3%      | 87.4%     | —         |
| Rochester Institute of Technology  | 71.1%      | 72.8%     | —         |
| Manhattan School of Music          | 78.9%      | 100.0%    | —         |
| Drexel University                  | 79.4%      | 91.7%     | —         |

---

## 五、GPA 缺失的 73 所学校分类

### 永久无法获取 — 不报告 C11 数据（约 17 所文理学院）

| 学校                          | 录取率 | 原因           |
| ----------------------------- | ------ | -------------- |
| Williams College              | 7.5%   | LAC 不报告 C11 |
| Swarthmore College            | 7.5%   | LAC 不报告 C11 |
| Amherst College               | 9.0%   | LAC 不报告 C11 |
| Claremont McKenna College     | 9.6%   | LAC 不报告 C11 |
| Middlebury College            | 10.8%  | LAC 不报告 C11 |
| Pomona College                | 12.2%  | LAC 不报告 C11 |
| Haverford College             | 12.4%  | LAC 不报告 C11 |
| Grinnell College              | 12.7%  | LAC 不报告 C11 |
| Harvey Mudd College           | 12.7%  | LAC 不报告 C11 |
| Wellesley College             | 13.0%  | LAC 不报告 C11 |
| Cooper Union                  | 13.0%  | LAC 不报告 C11 |
| Hamilton College              | 13.6%  | LAC 不报告 C11 |
| Washington and Lee University | 14.0%  | LAC 不报告 C11 |
| Bates College                 | 14.8%  | LAC 不报告 C11 |
| Carleton College              | 17.9%  | LAC 不报告 C11 |
| Colby College                 | 6.6%   | LAC 不报告 C11 |
| Bowdoin College               | 7.0%   | LAC 不报告 C11 |

### 永久无法获取 — 空白 Fillable PDF（8 所）

| 学校                         | 录取率 | 确认方式              |
| ---------------------------- | ------ | --------------------- |
| Northwestern University      | 7.5%   | GradGPT NA + PDF 空白 |
| Rice University              | 7.5%   | GradGPT NA            |
| Wake Forest University       | 21.7%  | PDF 空白验证          |
| Lehigh University            | 25.4%  | PDF 空白验证          |
| George Washington University | 47.1%  | PDF 空白验证          |
| University of Connecticut    | 52.4%  | PDF 空白              |
| Texas A&M University         | 57.3%  | PDF 空白验证          |
| University of Pittsburgh     | 58.1%  | GradGPT 0.00%         |

### 永久无法获取 — 确认不发布（4 所）

| 学校                                | 录取率 | 确认方式       |
| ----------------------------------- | ------ | -------------- |
| University of California, Irvine    | 28.8%  | 直接确认不报告 |
| University of Texas at Austin       | 30.0%  | 直接确认不报告 |
| University of Vermont               | 65.3%  | GradGPT NA     |
| University of Minnesota Twin Cities | 79.8%  | GradGPT NA     |

### 永久无法获取 — 艺术/音乐学院（8 所）

Curtis Institute, Juilliard, New England Conservatory, Berklee, California Institute of the Arts, California College of the Arts, School of the Art Institute of Chicago, Maryland Institute College of Art, RISD, ArtCenter College of Design

### 仍可继续挖（~20 所）

| 学校                                                     | 录取率 | 状态                    |
| -------------------------------------------------------- | ------ | ----------------------- |
| Tufts University                                         | 10.0%  | PDF 找到，待解析        |
| University of Notre Dame                                 | 11.1%  | URL 404，新链接待找     |
| Georgetown University                                    | 12.3%  | Box 链接待验证          |
| Boston College                                           | 14.7%  | PDF 找到，待解析        |
| California Polytechnic State University, San Luis Obispo | 30.0%  | GradGPT 404             |
| University of California, Merced                         | 96.0%  | GradGPT 404             |
| American University                                      | 55.0%  | GradGPT 404             |
| James Madison University                                 | 85.0%  | GradGPT 404             |
| University of Missouri                                   | 81.0%  | CDS 页面找到            |
| Rutgers University-New Brunswick                         | 65.4%  | 2024-25 未发布          |
| University of Denver                                     | 74.7%  | 待查                    |
| Hofstra University                                       | 72.0%  | 待查                    |
| Clarkson University                                      | 72.0%  | 待查                    |
| Seton Hall University                                    | 81.9%  | 待查                    |
| Missouri University of Science and Technology            | 81.0%  | 待查                    |
| Kent State University                                    | 62.7%  | 待查                    |
| University of North Dakota                               | 83.0%  | 待查                    |
| Eastern Michigan University                              | 83.0%  | 已在 batch88 失败 (403) |
| University of Toledo                                     | 92.0%  | 已在 batch88 失败       |
| University of Maine                                      | 94.2%  | 待查                    |

---

## 六、本轮新增数据（2026-04-30）

| 学校                                    | 新增字段 | 来源            |
| --------------------------------------- | -------- | --------------- |
| University of Miami                     | GPA 分布 | 2023-24 CDS PDF |
| Syracuse University                     | GPA 分布 | GradGPT         |
| Colorado School of Mines                | GPA 分布 | GradGPT         |
| Stony Brook University                  | GPA 分布 | GradGPT         |
| Florida State University                | GPA 分布 | GradGPT         |
| UC Davis                                | GPA 分布 | GradGPT         |
| UC Santa Barbara                        | GPA 分布 | GradGPT         |
| University of Illinois Urbana-Champaign | GPA 分布 | WebSearch       |
| University of Arkansas                  | GPA 分布 | GradGPT         |
| University of Nebraska-Lincoln          | GPA 分布 | GradGPT         |

---

## 七、下一步优先级

### 优先级 1 — 补充 ED/EA 数据（高影响）

20 所选择性强学校有 GPA 但缺 ED 数据，包括：
Caltech, Harvard, Yale, Stanford, Princeton, MIT, UChicago, NYU, UCLA, USC, UCB, Georgia Tech, UNC, UMich, UF, UCSD 等

### 优先级 2 — 继续挖 GPA（中影响）

~20 所学校仍有可能找到数据（见上表"仍可继续挖"）

### 优先级 3 — 扩展 Tier 1 分格（高精度提升）

当前仅 9 所 UC 学校有 CDS 分格数据。顶尖私校（HYP、MIT、Stanford）可尝试从其 CDS PDF 中提取 C9 表格。

---

## 八、已排除数据（疑似幻觉，未入库）

| 来源文件 | 学校                   | 问题                                                       |
| -------- | ---------------------- | ---------------------------------------------------------- |
| batch85  | Cal Poly SLO           | GPA 分布极度均匀 (0.25/0.30/0.20/0.15/0.10)，疑似 LLM 编造 |
| batch86  | UC Merced              | 同样模式 (0.25/0.30/0.20/0.15/0.10)，已确认不入库          |
| batch88  | University of Arkansas | ED/EA 数据疑似编造（已用 GradGPT 真实数据替换 GPA）        |
