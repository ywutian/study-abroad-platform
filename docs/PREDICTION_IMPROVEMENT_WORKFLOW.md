# 预测系统改进工作流 SOP

> 最后更新: 2026-04-21
> 目的: **不是**长期 benchmark 基础设施，而是"补数据 → 诊断 → 改代码 → 验证"的迭代 loop
> 关联: [PREDICTION_BENCHMARK.md](./PREDICTION_BENCHMARK.md) (长期 benchmark 设计) · [PREDICTION_SYSTEM.md](./PREDICTION_SYSTEM.md)

## 0. 什么时候该用这套工作流

当你觉得"预测不准"，但**不想盲改模型**时。这套工作流让每一次改动都有**数字依据 + 回归保护**，而不是凭感觉。

**不是**：

- 不是 CI gate
- 不是定时跑的长期 benchmark
- 不是给管理员看的面板

**就是**：

- 一个命令行 loop，你自己跑，自己看报告，自己改代码，自己再跑

---

## 1. 整体流程

```
[1] 补充真实 case         填 CSV
          ↓
[2] pnpm diag:ingest      CSV → AdmissionCase (isVerified=true)
          ↓
[3] pnpm diag:run         → 报告文件 apps/api/diagnostic-reports/<ts>_<sha>.md
          ↓
[4] 看报告 → 改代码        worst cases / engine attribution / findings
          ↓
[5] pnpm diag:run         → 新报告文件
          ↓
[6] pnpm diag:compare     diff 最近两份，看指标变化
```

---

## 2. Step 1 — 准备真实 Case 数据

### 2.1 数据源

理想来源 (按可信度降序)：

1. 顾问/老师确认的学生录取结果（最高质量）
2. 学生上传的 offer letter / portal 截图
3. 学生口头报告 + 多渠道交叉确认
4. 公开数据（1point3acres / Reddit / Niche 等爬虫）—— 质量参差

### 2.2 CSV 格式

文件放在 `apps/api/data/real-cases-YYYYMMDD.csv`。模板见 `apps/api/data/real-cases-template.csv`。

必填字段：

| 字段         | 类型   | 说明                                                   |
| ------------ | ------ | ------------------------------------------------------ |
| `schoolName` | string | 学校名称；ingest 会 fuzzy match 到 `School.id`         |
| `result`     | enum   | `ADMITTED` \| `REJECTED` \| `WAITLISTED` \| `DEFERRED` |
| `year`       | int    | 申请年份，如 `2025`                                    |
| `gpaRange`   | string | 如 `3.8-4.0`                                           |

强烈推荐字段（影响 hindcast 精度）：

| 字段                     | 说明                                   |
| ------------------------ | -------------------------------------- |
| `satRange` or `actRange` | 如 `1500-1550`                         |
| `round`                  | `ED` / `EA` / `REA` / `RD` / `ROLLING` |
| `major`                  | 申请专业                               |
| `activityCount`          | 活动数量                               |
| `awardCount`             | 奖项数量                               |

可选字段：

| 字段              | 说明                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `isInternational` | `true` / `false`                                                                                                            |
| `highSchoolType`  | 可填口语别名（如 `public` / `international`）或 Prisma 枚举：`PUBLIC_US`、`PRIVATE_US`、`INTL_CN`、`INTL_OTHER` 等          |
| `toeflRange`      | 如 `105-110`                                                                                                                |
| `evidenceUrl`     | offer letter / 截图链接；入库时写入 `narrative` 首行（`Evidence URL: …`）并追加 `tags` 项 `evidence_url:…`（截断 500 字符） |
| `schoolId`        | 可选。填写则**直接绑定**该校，避免校名歧义                                                                                  |
| `notes`           | 顾问备注                                                                                                                    |
| `sourceTag`       | `counselor` / `student_report` / `offer_letter` / `scraped`                                                                 |

### 2.3 数据质量红线

在 CSV 里**刻意**每批保留**两边样本**：

- **至少 30% REJECTED** —— 否则 ECE 和 bias 都失真，上一次诊断暴露的问题
- **跨多所学校** —— 避免 10 条全是 Wisconsin-Madison 这种集中度
- **跨不同档位** —— T10 / T30 / T100 混着填，不要只填 reach

---

## 3. Step 2 — Ingest

**两种方式等价**（同一套 `DiagnosticIngestService`）：

- **Admin**：`预测校准 → 真实案例` 上传 CSV → Dry Run → Commit。模板下载：`GET /api/v1/admin/predictions/diag/real-cases-template`（与 `apps/api/data/real-cases-template.csv` 同源）。
- **CLI**：

```bash
pnpm --filter api diag:ingest apps/api/data/real-cases-20260421.csv
```

脚本 / 接口做的事：

1. 解析 CSV；校验必填字段（与 `packages/shared` 中 `REAL_CASES_CSV_REQUIRED_COLUMNS` 一致）
2. 学校匹配顺序：`schoolId` → 精确校名 → 规范化名 → alias → **子串匹配仅当唯一命中**；若子串命中**多所**则视为**歧义**，该行跳过并在结果中列出候选校
3. 完全无命中时跳过，并对输入名做 **Levenshtein 建议**（最多 5 所）便于人工改 CSV
4. 匹配成功的行写入 `AdmissionCase`，`isVerified=true`；`evidenceUrl` 见上表
5. 输出 summary：写入 / 重复 / 无匹配 / **歧义** / 格式错误；CLI 打印；Admin 展示面板

修复方式：看未匹配或歧义列表，改 `schoolName`、或填 `schoolId`、或换官方英文名，再 Dry Run。

### 3.1 重复 ingest 会不会重复写入？

会。目前依赖 `(userId, schoolId, year, round)` 做去重：同 owner 下相同组合会跳过。若要替换旧数据，请先用本批次的 `rollbackSql` 删除再导入，或在 DB 中手动处理。

---

## 4. Step 3 — 跑 Diagnostic

```bash
pnpm --filter api diag:run
```

### 4.1 脚本做的事

1. 从 DB 拉所有 verified cases + 任何 verified/self-reported `PredictionOutcomeLabelRecord`
2. Hindcast: 对每条 case 用当前代码（shared/scoring 的统计引擎）重算概率
3. 对所有 (predicted, actual) 对计算：
   - 全局指标：mean(pred) vs mean(actual)、Brier、ECE、LogLoss
   - Reliability diagram (10-bin)
   - 按 source / modelVersion / tier / round / selectivityBand 切片
   - 引擎归因（engineScores 里各引擎 vs actual）
   - Worst N cases 明细
4. 规则基的 findings 生成：
   - 如果全局 bias > 0.05 → 建议全局校准
   - 如果某引擎 bias > 0.08 → 建议调权重或独立校准
   - 如果 n < 30 → 只看 worst cases，不信统计
   - 如果样本不平衡 > 80/20 → 警告统计失真
5. **写入报告文件**：
   - 路径：`apps/api/diagnostic-reports/<YYYYMMDD-HHmmss>_<git_sha>.md`
   - 同时 stdout 输出

### 4.2 报告文件进不进 git？

**进**。这让你能：

- `git log apps/api/diagnostic-reports/` 看历史改动对应的指标变化
- PR 里附诊断前后对比作为证据
- 团队其他人看到

---

## 5. Step 4 — 看报告 → 改代码

### 5.1 看哪几个 section（按优先级）

1. **Section 11 (findings)**：直接告诉你最严重的问题
2. **Section 10 (worst cases)**：肉眼找 pattern（比如"全是 T10 ED" / "全是中国申请者"）
3. **Section 8 (engine attribution)**：哪个引擎在拖后腿
4. **Section 5 (reliability diagram)**：哪段概率校准最差

### 5.2 三种常见问题 → 对应修法

| 报告显示                              | 修哪里                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 全局 bias > +0.05，且 ECE > 0.1       | 在 `packages/shared/src/scoring/score.ts:calculateProbability` 的最后加一层 **Beta 校准**（已有 `ml/beta-calibration.ts`） |
| `ai` engine bias > +0.08              | 调低 `PredictionFusionEngine` 里 AI 权重；或改 `prediction.prompts.ts` 里的 sanity clamp                                   |
| 某个 slice (如 `round=ED`) ECE 特别高 | 检查 `prediction-hook-modifiers.service.ts` 对应 hook 的系数                                                               |
| Worst cases 全是高分被预测低          | `calculateOverallScore` 或 feature scaling 的问题                                                                          |
| Worst cases 全是中等学生被预测高      | `calculateProbability` 的 threshold / k 参数                                                                               |

### 5.3 改完代码的操作

```bash
# 改完代码、通过 typecheck
pnpm typecheck

# 再跑一次 diagnostic
pnpm --filter api diag:run

# 对比前后
pnpm --filter api diag:compare
```

---

## 6. Step 5 — 对比两次报告

```bash
pnpm --filter api diag:compare
```

默认对比 `apps/api/diagnostic-reports/` 里最近两份报告。输出：

```
Previous:  20260421-143022_abc123.md  (N=42)
Current:   20260421-161500_def456.md  (N=42)

Metric              prev      current    delta
ECE (10-bin)        0.112     0.063      -0.049  ✅ 改善 43%
Brier               0.245     0.221      -0.024  ✅ 改善 10%
Global bias         +0.087    +0.012     -0.075  ✅ 接近 0
stats engine bias   +0.094    +0.014     -0.080  ✅
ai engine bias      -0.021    -0.019     +0.002  ~ 基本不变

Worst case overlap: 12/20 (60%) 还是原来的 case
Newly worst:        3 条 (见下方)
Fixed (no longer worst): 8 条
```

也可以指定两份：

```bash
pnpm --filter api diag:compare 20260420-1200_aaa.md 20260421-1600_bbb.md
```

---

## 7. 迭代节奏建议

**每轮循环大约 15-30 分钟**：

1. 补 10-30 条新 case（5-15 min）
2. `diag:ingest` + `diag:run`（<1 min）
3. 看报告（3-5 min）
4. 改一处代码（5-15 min，**一次只改一处**）
5. `diag:run` + `diag:compare`（<1 min）
6. 判断：改善 → commit；没改善或变差 → 回滚

**一次只改一处**是关键。同时改多处，compare 结果无法归因。

---

## 8. 脚本清单

| 命令                                  | 脚本                                    | 用途                                                                                          |
| ------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Admin「真实案例」Tab                  | —                                       | 与 CLI 同一 ingest；Dry Run / Commit；模板 `GET …/admin/predictions/diag/real-cases-template` |
| `pnpm --filter api diag:ingest <csv>` | `scripts/ingest-real-cases.ts`          | CSV → AdmissionCase                                                                           |
| `pnpm --filter api diag:run`          | `scripts/diagnose-prediction.ts`        | 跑诊断 + 写报告                                                                               |
| `pnpm --filter api diag:compare`      | `scripts/compare-diagnostic-reports.ts` | diff 两份报告                                                                                 |
| `pnpm --filter api diag:inspect`      | `scripts/diagnose-data-quality.ts`      | 查数据质量（ingest 前用）                                                                     |

---

## 9. 什么时候升级到完整 Benchmark

当以下条件都满足时，转向 [PREDICTION_BENCHMARK.md](./PREDICTION_BENCHMARK.md) 的 Layer 1/2/3：

- `AdmissionCase (isVerified=true)` ≥ 200 条
- 其中 `REJECTED` ≥ 60 条
- 跨至少 30 所学校
- 至少跨 2 届申请年份
- 最近 6 次 `diag:run` 的 ECE 稳定在 < 0.08

在此之前，**迭代 loop 的信息量远大于完整 benchmark 的基础设施**。

---

## 10. FAQ

**Q: 我的 case 匹配不到学校怎么办？**
A: CSV 里把 `schoolName` 改成更标准的名字（官方英文名），或直接加 `schoolId` 列手工指定。

**Q: ingest 后想删除一批怎么办？**
A: 每次 ingest 会打印 `ingestRunId`，用 `DELETE FROM admission_cases WHERE source_tag LIKE 'ingest:<id>:%'` 删除。

**Q: Hindcast 只跑统计引擎不跑 AI 引擎，不全吧？**
A: 对。AI 引擎需要 LLM 调用，太慢太贵，不适合在 hindcast loop 里跑。如果 worst cases 分析发现 AI 引擎可能是元凶，可以对 **worst 5 case** 单独手工跑一次 `PredictionService.predict` 看 AI 引擎的 probability 细节。

**Q: 我改的是 AI 引擎 prompt，diag:run 看得出来吗？**
A: 看不到。目前只覆盖统计引擎。AI 引擎评估需要单独建一个测试路径（属于 Phase 2）。

**Q: 我能让诊断跑得更频繁（比如每次 commit）吗？**
A: 可以，但不推荐。诊断结果的价值来自**对比两次 run**，太频繁只会淹没信号。每次有意义改动后手动跑一次最合适。
