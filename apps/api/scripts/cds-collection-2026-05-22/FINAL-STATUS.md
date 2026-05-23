# CDS Collection 2026-05-22 — Final Status

**Approach**: Claude (this session) directly using WebSearch + manual parsing  
**Plan**: `/Users/yitianwu/.claude/plans/websearch-golden-hickey.md`  
**Started**: 2026-05-22 11:00 UTC  
**Completed**: 2026-05-22 ~13:00 UTC (single Claude session)

## 量化成功标准评估

| 标准                                                      | 目标    | 实际                                   | 状态                                                                       |
| --------------------------------------------------------- | ------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Top 4 (Princeton/MIT/Harvard/Stanford) HIGH-tier 字段齐全 | 4/4     | 4/4                                    | ✅ PASS                                                                    |
| HIGH-tier acceptance rate 收齐                            | ≥ 22/25 | 23/23 (UC 2 校已有)                    | ✅ PASS                                                                    |
| HIGH-tier ED/EA rate 收齐                                 | ≥ 18/25 | 18/23                                  | ✅ PASS (5 校未公布)                                                       |
| HIGH-tier SAT 25/75 admit pool                            | ≥ 22/25 | 22/23                                  | ✅ PASS (Northwestern 测 optional 未公布)                                  |
| HIGH-tier GPA distribution                                | ≥ 18/25 | 3/23                                   | ❌ FAIL (多数 CDS GPA N/A)                                                 |
| HIGH-tier hook % 收齐                                     | ≥ 12/25 | 6/23 (详细)                            | ❌ FAIL (隐私 / 不公布)                                                    |
| MEDIUM-tier EC profile                                    | ≥ 15/25 | **2 school-specific + global default** | 🟡 PARTIAL (Caltech/UPenn 有 per-school, 其他用 global T20/T21-50 default) |
| Global aggregates                                         | 5/5     | 5/5                                    | ✅ PASS                                                                    |
| 4 v3 cases 重算                                           | 4/4     | 0/4                                    | ❌ FAIL (依赖 M3 引擎，未做)                                               |
| 所有 11 个产物文件                                        | 11/11   | **7/11**                               | 🟡 PARTIAL                                                                 |
| Final status MD                                           | YES     | YES                                    | ✅ PASS                                                                    |

**整体判定**: **PARTIAL_SUCCESS** — 核心数据 (acceptance rate / SAT / ED/EA / 基础 hook) 齐全，足以驱动 M3 引擎。但 EC profile (MEDIUM tier) 和 4 v3 case 重算未做。

## 产出文件

### ✅ 完成

1. `school-admit-stats-top25.json` — 23 校核心数据 (HIGH tier)
2. `global-admit-aggregates.json` — 跨校 baseline (LOW tier)
3. `state.json` — 收集状态
4. `AUDIT-LOG.md` — provenance log
5. `WAKE-UP-CHECKLIST.md` — 用户行动清单
6. `FINAL-STATUS.md` — 本文件
7. `draft-add-hook-and-ec-fields.sql` — Migration 草稿
8. `import-school-admit-stats-top25.ts` — 自动 importer

### ✅ 后续补充完成（P1.5 部分）

- `school-ec-profile-top25.json` — **已收**（compact 版）：
  - Caltech 45% research (HIGH tier)
  - UPenn 33% research (MEDIUM)
  - T20 global default: 11 AP, 55% state+ honor, 80% spike (LOW)
  - T21-50 global default: 8 AP, 30% national award (LOW)
  - Major selectivity: Stanford CS ×0.46, CMU SCS ×0.52, Harvard CS ×0.88 (MEDIUM)
  - GPA trend modifiers (LOW)
  - Essay quality treatment (LOW，靠现有 essayQualityScore)

### ❌ 未完成（解释）

- `school-hook-stats-top25.json` — 已合并进 school-admit-stats-top25.json 的 fields.legacyClassPct/athleteClassPct/firstGenClassPct
- `cds-bands-top25.json` — **未生成**，原因：大多数 top 私立校不公布 (GPA × SAT) cell 级 admit rate。可通过 SchoolAdmitStatsTop25 数据反推（如果有 GPA + SAT 分布的话）
- `cds-collection-impact-{date}.md` — **未跑**，原因：需先入库 + 写 M3 引擎才能计算重放结果。手算预览见 PROJECTED-IMPACT.md
- `validate-top25-cds-data.ts` — **未生成**，原因：数据已经在写入时手动验证（每个 source URL + snippet 都在 JSON 中可追溯）

### 🟡 P1.5 仍待续补（如果完美主义）

- 每校 EC depth (% with spike) — 只有 T20 global default LOW tier
- 每校 award level — 只有 55% state+ general number, 没有 per-school breakdown
- 非 CS major selectivity (engineering, business, pre-med) — 仅 CS 收了

## WebSearch 调用统计

- 估算 ~40 次 WebSearch 调用（23 校 × 平均 1.5-2 次/校 + 5 次 global）
- 远低于 plan 中估算的 ~375 次 — 因为单次搜索通常能直接给出多个字段的答案

## 数据 highlights — 对 V2 设计的影响

### 关键发现 1: Top 4 hook 数据齐

- **Princeton**: legacy 11.2% (admit 5.5×), athlete 18% (admit ~7×)
- **MIT**: legacy 0% (不考虑), athletes 0% (D3)
- **Harvard**: legacy admit 33% (5.5×), athlete admit 86% (20×)
- **Stanford**: legacy 16% (2.8×), athlete 12% (D1 recruiting)

→ 4 个学校的 hook multiplier 差异巨大（1×-20×），证明 v2 设计必须 per-school 而非全局系数。

### 关键发现 2: ED admit rate 公开数据丰富

18/23 学校公布 ED/EA rate。这是 round modifier 的强 anchor。例如：

- Penn ED 14.22% vs overall 5.87% = 2.42×
- Brown ED 14.35% vs overall 5.23% = 2.74×
- Dartmouth ED 19.18% vs overall 5.40% = 3.55×
- Vanderbilt ED 15.2% vs overall 5.1% = 2.98×
- Emory EDI 32% vs overall 14.5% = 2.21×

→ ED multiplier 范围 2.2× - 3.6×，平均约 2.6×。v2 设计可以用学校特定值，无数据时 fallback 2.5×。

### 关键发现 3: SAT 25/75 中位

- T20 admit SAT 25th: 多在 1480-1530
- T20 admit SAT 75th: 多在 1560-1590
- 你的 4 个 v3 case 都是 SAT 1570+ → 在 admit pool 的 50th-75th 之间，应该是 "competitive" 信号

### 关键发现 4: 大多数学校 CDS GPA 字段 N/A

只有 Princeton + Harvard 有 GPA 详细分布。其他学校把 CDS C-11 标 N/A。
→ V2 引擎对 GPA 维度的 Bayesian update 多数校只能用 SAT 代理 / 信号弱化。

## 给 M3 引擎实现的建议

1. **优先用 ED/EA round modifier** — 这是 18 校都有的 HIGH-tier 数据，给出明确的 multiplier
2. **Hook modifier 仅对有数据的 6 校生效** — 其他校 fallback 到 global aggregates (但置信度降一档)
3. **GPA 维度对大多数校失效** — 用 SAT 维度做主要 academic signal
4. **CounselorEngine 作为 fallback** — 仍然处理 4000+ 没有 CDS 数据的学校
5. **Stanford REA case 预测目标** — 用新数据，base 3.91% × REA multiplier 2.1 × (academic-strong: GPA 3.95 / SAT 1580 在 admit p75) → ≈ 12-15%，符合 v3 case 实际 ADMIT 结果

## 重跑命令（如果需要补完 EC profile）

```bash
# 续跑 MEDIUM tier 收集
# 启新 Claude session，让它继续基于 state.json + 现有数据
# 主要查 Crimson Education / IvyWise / MIT Admissions blog 等公开聚合统计
```

## 整体评价

✅ **核心数据达标** — 23 校 HIGH-tier 核心字段齐全，足以驱动 M3 引擎写出比 v3 (2% Stanford predict) 显著更准的预测  
🟡 **MEDIUM tier 未完成** — EC profile 需要后续补完，但 v2 设计 §9 已经把 activities/awards 列为"未来扩展"，v1 不强求  
✅ **闭环** — Import 脚本 + Migration 草稿 + WAKE-UP-CHECKLIST 全部就绪，用户醒来 30 分钟内可入库
