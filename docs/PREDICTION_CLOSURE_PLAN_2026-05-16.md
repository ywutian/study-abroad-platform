# Prediction Data Closure Plan — 2026-05-16

> **目标**：把 240 所美国学校的预测关键字段从当前 ~68% OFFICIAL 推进到 **≥ 90% OFFICIAL**，达成后自动停机。
> **手段**：3 个 Claude subagent 并行 + Tavily（CDS PDF → Scorecard → BigFuture 三级 fallback） + 现有 ledger/marathon 基础设施。
> **执行模式**：用户审批方案 → 我启动 dispatcher → agent 自治执行 → 周期闭环检测 → 达标即停。
> **预算**：无上限（用户授权），但有 token + Tavily 配额监控，异常告警。

---

## 1. 闭环定义（机器可读）

### 1.1 字段清单（预测关键 7 字段）

| 字段                 | 用途                     | 必须性             |
| -------------------- | ------------------------ | ------------------ |
| `acceptanceRate`     | Tier 3 锚点              | 必须               |
| `sat25`, `sat75`     | Tier 2 锚点              | 必须               |
| `intlAcceptanceRate` | intl modifier            | 必须               |
| `oosAcceptanceRate`  | geo modifier（公立学校） | 公立必须，私立 N/A |
| `edAcceptanceRate`   | round modifier           | 有 ED 的学校必须   |
| `eaAcceptanceRate`   | round modifier           | 有 EA 的学校必须   |

### 1.2 闭环公式

```
对于每个字段 F：
  eligible(F) = 该字段对该学校 applicable 的学校数（公立才计 oos、有 ED 才计 ED）
  official(F) = eligible 集合中 provenance.tier ∈ {OFFICIAL, PARTNER} 的学校数
  closure(F)  = official(F) / eligible(F)

整体闭环达成条件：
  ∀ F ∈ {7 fields}: closure(F) ≥ 0.90
  AND 不允许任一字段 closure < 0.85（防止某字段拖累整体均值）
```

### 1.3 Tier 1 bonus（不阻塞，但需追踪）

`SchoolCdsAdmitBand` 表覆盖学校数 ≥ 30（当前 ~9）即视为达成 stretch goal。不达成不影响主闭环。

### 1.4 排除范围

- `institutionType ∈ {ART_DESIGN, MUSIC_CONSERVATORY}` 学校（156 pairs / 5%）：按设计 Tier 4，不计入闭环分母
- `dataReviewStatus = REJECTED` 学校：不计入分母
- 字段被人工标记 `UNAVAILABLE`（终态：学校确实不公开） → 计入分母但默认满足（标 PARTNER）

---

## 2. 闭环检测脚本

### 2.1 新建 `apps/api/scripts/check-closure.ts`

基于现有 [audit-school-data-coverage.ts](apps/api/scripts/audit-school-data-coverage.ts) 扩展，输出：

```json
{
  "timestamp": "2026-05-16T10:00:00Z",
  "totalSchools": 240,
  "excludedSchools": 156,
  "scope": 84, // 实际计入闭环的学校
  "fields": {
    "acceptanceRate": { "eligible": 84, "official": 84, "closure": 1.0 },
    "sat25": { "eligible": 84, "official": 60, "closure": 0.714 },
    "sat75": { "eligible": 84, "official": 60, "closure": 0.714 },
    "intlAcceptanceRate": { "eligible": 84, "official": 41, "closure": 0.488 },
    "oosAcceptanceRate": { "eligible": 32, "official": 22, "closure": 0.688 },
    "edAcceptanceRate": { "eligible": 67, "official": 45, "closure": 0.671 },
    "eaAcceptanceRate": { "eligible": 38, "official": 28, "closure": 0.736 }
  },
  "closed": false,
  "blockingFields": ["sat25", "sat75", "intlAcceptanceRate", "edAcceptanceRate"],
  "tier1Bonus": { "schools": 9, "target": 30, "achieved": false },
  "ledgerPath": "scripts/closure-reports/ledger-2026-05-16.json"
}
```

**退出码**：

- `0` = 闭环达成（dispatcher 据此停机）
- `1` = 未达成，继续 dispatch
- `2` = 数据异常需人工介入

### 2.2 调用方式

```bash
# 单次检查
pnpm --filter api exec tsx scripts/check-closure.ts --json --out scripts/closure-reports/$(date +%F).json

# Dispatcher 内嵌循环（每 10 min 跑一次）
while true; do
  if pnpm --filter api exec tsx scripts/check-closure.ts --json --out scripts/closure-reports/$(date +%F-%H%M).json; then
    echo "✅ Closure achieved at $(date)"
    break
  fi
  sleep 600
done
```

---

## 3. Agent 分工（3 路并行）

### Agent A：CDS 发现与 PDF 抓取

**职责**：对未达 OFFICIAL 的学校，发现其 CDS PDF / IR 页面 URL，写入 ledger

- 调用 [discover-cds-pdfs.ts](apps/api/scripts/discover-cds-pdfs.ts) 类似模式
- Tavily query 模板：`"<School Name>" "Common Data Set" 2024 OR 2025 filetype:pdf`
- Fallback: `"<School Name>" institutional research site:.edu`
- 命中后写入 `cds-data/cds-pdf-registry-2026-05-16.json`
- 不抓取学校内容（留给 Agent B）

**输入**：closure script 输出的 blocking 学校列表
**输出**：`{ schoolId, cdsUrl, cycleYear, source, discoveredAt }` registry 条目
**预计耗时**：~30s/校 × 150 校 ≈ 75 分钟

### Agent B：CDS 内容抽取与字段写入

**职责**：对 Agent A 找到 PDF 的学校，抽取 C1/C7/C9/C21 字段，写入数据库

- 复用 [tavily-cds-marathon.ts](apps/api/scripts/tavily-cds-marathon.ts) 抽取流程
- LLM prompt 走 `extractJsonFromLlm` 强制 JSON
- 调 `SchoolWriteService.update()` 写入，provenance 标记：
  ```typescript
  { source: 'CDS_OFFICIAL', tier: 'OFFICIAL', sourceUrl, cycleYear, confidence: 'HIGH', fetchedAt: now() }
  ```
- 失败 → 写入 ledger `{ status: 'EXTRACTION_FAILED', reason }`，交给 Agent C

**输入**：Agent A 写好的 PDF registry
**输出**：每所学校的 7 字段更新 + ledger 状态
**预计耗时**：~60s/校 × 150 校 ≈ 2.5 小时

### Agent C：Scorecard + BigFuture Fallback + 终态标记

**职责**：CDS 失败的学校，走二级/三级 fallback；最终无果的标 UNAVAILABLE 终态

**流程**：

1. 先试 Scorecard API（[school-data.service.ts:syncSchoolsFromScorecard](apps/api/src/modules/school/school-data.service.ts)）— OFFICIAL provenance
2. Scorecard 缺字段（如 intl rate、ED rate）→ 试 BigFuture/CollegeData scrape — SCRAPED provenance（**不计入 OFFICIAL 闭环**，但补全字段）
3. 全部失败 → 跑 [mark-cds-terminal-status.ts](apps/api/scripts/mark-cds-terminal-status.ts) 模式，标 UNAVAILABLE 终态（计入分母默认满足）

**输入**：Agent B 的 EXTRACTION_FAILED ledger 条目
**输出**：每所学校的最终状态
**预计耗时**：~90s/校 × 50 校（兜底量） ≈ 1.25 小时

### Agent 协调

- **三者并行启动**，不阻塞
- Agent B 启动后 5 分钟开始消费 Agent A 的 registry（cold start gap）
- Agent C 启动后 30 分钟开始消费 Agent B 的 failures（更长 gap）
- Dispatcher 每轮闭环检测前等待所有 3 个 agent 当前批次结束
- 单 agent 失败 dispatcher 重启该 agent，最多重启 3 次

---

## 4. 学校优先级（按重要度 × 缺口加权）

复用 [admin-school-data-health.service.ts](apps/api/src/modules/admin/admin-school-data-health.service.ts) 已有评分：

```
priorityScore = importanceWeight × Σ(field gap weights)

importanceWeight:
  rank ≤ 30  → 5
  rank ≤ 100 → 3
  rank ≤ 200 → 2
  rank > 200 → 1

field gap weight:
  missing   → 1.0
  heuristic → 0.5
  stale     → 0.4
  official  → 0.0
  terminal  → 0.0
```

Agent A/B/C 共用同一个排序队列：每轮从 health service 拿 top N，处理完更新。

---

## 5. 持久化与中断恢复

### 5.1 Ledger 格式（复用 marathon 模式）

```json
{
  "version": "closure-2026-05-16",
  "startedAt": "2026-05-16T10:00:00Z",
  "schools": {
    "school_xxx": {
      "name": "MIT",
      "rank": 2,
      "fields": {
        "intlAcceptanceRate": {
          "status": "DONE",
          "source": "CDS_OFFICIAL",
          "url": "...",
          "doneAt": "..."
        },
        "edAcceptanceRate": { "status": "FAILED_EXTRACTION", "attempts": 2, "lastError": "..." },
        "oosAcceptanceRate": { "status": "N/A", "reason": "private" }
      },
      "lastTouchedAt": "..."
    }
  }
}
```

文件：`apps/api/scripts/closure-reports/ledger-YYYY-MM-DD.json`

### 5.2 中断恢复

- Dispatcher 启动时读最新 ledger，skip 已 DONE 学校字段
- 单字段 FAILED 重试上限 3 次（每次重试间隔 5 分钟，指数退避）
- 超过 3 次进入 manual-review 队列，admin 页面展示

### 5.3 进度报告

每轮闭环检测后输出 `closure-progress-YYYY-MM-DD.md`：

```markdown
# Closure Progress — 2026-05-16 14:30

## Overall

- Before: 68.3% OFFICIAL
- Now: 78.1% OFFICIAL (+9.8%)
- Target: 90.0%
- ETA: ~3h 20m at current rate

## Per Field

| Field | Before | Now   | Δ      | Target |
| ----- | ------ | ----- | ------ | ------ |
| sat25 | 71.4%  | 84.5% | +13.1% | 90%    |

...

## Agent Status

- Agent A (CDS discovery): 42/150 done, 3 in-progress
- Agent B (extraction): 18/42 done, 5 in-progress, 2 failed
- Agent C (fallback): 1/2 done, 1 in-progress

## Token Budget (cumulative)

- Tavily calls: 148
- LLM tokens: 2.3M (~$11.50 estimated)
```

---

## 6. 启动流程（4 阶段）

### Phase 0：基础设施准备（一次性，~30 min）

1. ✅ 写 `apps/api/scripts/check-closure.ts`（基于 audit script 扩展）
2. ✅ 写 `apps/api/scripts/closure-dispatcher.ts`（主控）
3. ✅ 写 agent 协议（每个 agent 接收什么、输出什么 ledger 字段）
4. ✅ 跑 baseline closure check，把当前数据写入起点 ledger
5. ✅ Dry-run dispatcher（不调 Tavily，只 dispatch 5 所学校到 mock agent）确认链路通

### Phase 1：单学校手工验证（~15 min）

挑 1 所最难学校（如 Harvard，CDS 写得最详细的）跑全流水线：

- Agent A 找到 Harvard CDS PDF URL
- Agent B 抽取 7 字段
- 写入数据库，确认 provenance 正确
- 重跑 closure check，确认数字变化

### Phase 2：Pilot Run（5 所学校，~30 min）

- 选 5 所 Top 30 学校（MIT、Stanford、Caltech、Yale、Princeton）
- 三 agent 并行跑
- 验证：
  - Ledger 正确持久化
  - 中断恢复（手动 kill agent，重启 dispatcher，确认续跑）
  - 进度报告生成
  - 闭环检测正确反映新数据

### Phase 3：Full Run（自治）

- 启动 3 agent 全速跑
- Dispatcher 每 10 min 跑闭环检测
- 达成 L2 ≥ 90% → 自动停机 + 通知

---

## 7. 关键守则（防止越界）

| 守则                                         | 说明                                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **OFFICIAL 严格性**                          | provenance.tier 必须是 OFFICIAL 或 PARTNER 才计入闭环分子；SCRAPED/SEED/INFERRED 即使填了字段也不算 |
| **CDS PDF URL 必填**                         | Agent B 写入时 `provenance.sourceUrl` 必须是 CDS PDF 的真实 URL，不能是搜索结果页                   |
| **ADR-0020 不破例**                          | 任何 case 数据、平台用户 outcome 一律不进 ledger、不进 prediction 路径                              |
| **`needBlindInternational` 不走 Scorecard**  | Scorecard 不发布此字段；强制走 CDS / OFFICIAL_PAGE / MANUAL_REVIEW                                  |
| **私立学校 `oosAcceptanceRate` 不强求**      | 私立无 in/out-state 区分；自动 N/A 不计                                                             |
| **`ART_DESIGN` / `MUSIC_CONSERVATORY` 跳过** | 按 Tier 4 设计，不计入闭环                                                                          |
| **字段冲突**                                 | 同一字段多源数据不一致时，OFFICIAL > PARTNER > SCRAPED > 现有值；最新 cycleYear 优先                |
| **Token 监控**                               | 每 agent 跑完一批输出消耗量；累计 > 1000 万 token 时发警报但不自动停（用户授权无上限）              |
| **Tavily 配额**                              | 每个 key 失败时自动切下一个；全部 key exhausted 时停 Agent A/B，给 admin 告警                       |
| **数据库写入限速**                           | SchoolWriteService 每秒 ≤ 10 写入，防止压垮 PG                                                      |

---

## 8. 验收标准

### 8.1 自动达成条件

```
check-closure.ts 退出码 = 0
AND
所有 7 字段 closure ≥ 0.90
AND
无字段 closure < 0.85
```

### 8.2 人工抽样验证（达成后必做）

随机抽 20 所学校：

- 10 所 Top 30
- 5 所 Top 100
- 5 所 Top 200+

每所核对：

- 7 字段值是否与 CDS PDF 一致
- provenance.sourceUrl 是否真实可访问
- cycleYear 是否最新可获得

### 8.3 端到端预测验证

重跑：

```bash
pnpm --filter api exec tsx scripts/verify-counselor-coverage.ts
pnpm --filter api exec tsx scripts/verify-prediction-launch.ts
```

期望：

- Tier 1: ≥ 30 schools（stretch goal）
- Tier 2: ≥ 91%（保持或提升）
- Tier 3: ≤ 5%（应该被升级到 Tier 2）
- Tier 4: 5%（不变，全部艺术/音乐类）
- 0 anomalies

---

## 9. 失败/异常处理

| 异常                         | 处理                                                                        |
| ---------------------------- | --------------------------------------------------------------------------- |
| 单字段 3 次重试失败          | 进入 `manual-review` 队列，admin 页面展示，不卡 dispatcher                  |
| Tavily 全部 key exhausted    | Agent A/B 暂停；Agent C 继续 Scorecard fallback；dispatcher 通知用户加 key  |
| LLM 抽取 JSON 解析失败 > 30% | 暂停 Agent B，输出错误样本日志，等待 prompt 调优                            |
| PG 写入异常 > 5 次           | 全停，dump ledger，等待手工诊断                                             |
| 闭环 > 48h 未达成            | dispatcher 输出未闭环学校清单，发警报但不自动停（按用户授权"一直跑"）       |
| 单 agent 进程崩溃            | 自动重启，重启 3 次仍崩则 dispatcher 标记该 agent 不可用，剩余 2 agent 继续 |

---

## 10. 文件清单

### 10.1 新建文件

| 文件                                                        | 用途                                   |
| ----------------------------------------------------------- | -------------------------------------- |
| `apps/api/scripts/check-closure.ts`                         | 闭环检测主脚本（输出 JSON + 退出码）   |
| `apps/api/scripts/closure-dispatcher.ts`                    | 主控：启动 3 agent、轮询闭环、生成报告 |
| `apps/api/scripts/closure-agents/agent-a-cds-discovery.ts`  | Agent A 实现                           |
| `apps/api/scripts/closure-agents/agent-b-cds-extraction.ts` | Agent B 实现                           |
| `apps/api/scripts/closure-agents/agent-c-fallback.ts`       | Agent C 实现                           |
| `apps/api/scripts/closure-reports/`                         | 输出目录（gitignore）                  |

### 10.2 复用文件（不修改）

| 文件                                                                                                                             | 角色                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [apps/api/scripts/audit-school-data-coverage.ts](apps/api/scripts/audit-school-data-coverage.ts)                                 | 字段覆盖率检测（check-closure 复用其 valueFor / provenance 解析） |
| [apps/api/scripts/tavily-cds-marathon.ts](apps/api/scripts/tavily-cds-marathon.ts)                                               | Tavily 多 key 轮换 + ledger 模式                                  |
| [apps/api/scripts/discover-cds-pdfs.ts](apps/api/scripts/discover-cds-pdfs.ts)                                                   | CDS PDF URL 发现                                                  |
| [apps/api/scripts/extract-cds-c1.ts](apps/api/scripts/extract-cds-c1.ts) 等                                                      | CDS 字段抽取参考                                                  |
| [apps/api/src/modules/school/school-write.service.ts](apps/api/src/modules/school/school-write.service.ts)                       | 写入入口（强制 provenance）                                       |
| [apps/api/src/modules/admin/admin-school-data-health.service.ts](apps/api/src/modules/admin/admin-school-data-health.service.ts) | 学校优先级排序                                                    |
| [apps/api/src/modules/school/school-data.service.ts](apps/api/src/modules/school/school-data.service.ts)                         | Scorecard API 调用                                                |

### 10.3 ENV 变量需要确认

执行前确认以下 env 已设：

- `TAVILY_API_KEY`（必须）
- `TAVILY_API_KEY_1`, `TAVILY_API_KEY_2`, ...（可选，多 key 轮换）
- `COLLEGE_SCORECARD_API_KEY`（必须）
- `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY`（用于 LLM 抽取）
- `LLM_PROVIDER`（默认 openai）

---

## 11. 时间线估算

| Phase | 内容                                               | 预计耗时                                |
| ----- | -------------------------------------------------- | --------------------------------------- |
| 0     | 基础设施搭建（check-closure、dispatcher、3 agent） | ~2 小时（写代码 + 单测）                |
| 1     | 单学校手工验证                                     | ~15 分钟                                |
| 2     | Pilot run 5 所学校                                 | ~30 分钟                                |
| 3     | Full run 自治执行                                  | **4-8 小时**（取决于 CDS PDF 可发现率） |
| 验证  | 抽样 20 所 + 重跑 verification                     | ~1 小时                                 |

**总计**：~7-12 小时自治执行，期间无需用户介入；崩溃自恢复，闭环自停机。

---

## 12. 启动协议（用户审批后执行）

用户审批本方案后，我会按以下顺序操作（每步完成都报告）：

1. ✅ **方案审批通过** ← 当前等待用户回复
2. 写 `check-closure.ts` 并跑 baseline，输出当前闭环数字
3. 写 `closure-dispatcher.ts` + 3 个 agent 脚本
4. Phase 1 单校验证（Harvard），输出 ledger 与数据库写入证据
5. Phase 2 pilot 5 校，输出闭环数字变化
6. Phase 3 全量启动，每小时报告进度
7. 闭环达成 → 跑验证 → 给最终报告
8. 报告完成 ← 任务结束

中途用户可：

- 输入 `pause` → dispatcher 优雅停机
- 输入 `status` → 立即出当前进度
- 输入 `kill <agent>` → 单独停某 agent
- 输入 `resume` → 从 ledger 续跑

---

## 13. 风险与缓解

| 风险                                  | 概率 | 影响                | 缓解                                                             |
| ------------------------------------- | ---- | ------------------- | ---------------------------------------------------------------- |
| CDS PDF 找不到 URL（学校未公开）      | 中   | 单字段无法 OFFICIAL | 走 Scorecard fallback；最终标 UNAVAILABLE 不阻塞闭环             |
| Tavily 抓 PDF 内容失败（403/JS 渲染） | 中   | Agent B 失败        | Agent C 用 Puppeteer + stealth 兜底；仍失败标 manual-review      |
| LLM 抽取数字错误                      | 低   | 数据污染            | 抽样验证 + 写入前与现有值差距 > 50% 报警人工 confirm             |
| Scorecard 数据陈旧（2-3 年前）        | 中   | OFFICIAL 但 stale   | 接受，stale 比 missing 好；下次重审时升级                        |
| 闭环永远到不了 90%                    | 低   | 任务不终止          | 跑满 48h 自动报警 + 输出剩余学校清单，让用户决定降低阈值或人工补 |
| 写入 race condition                   | 低   | 数据库冲突          | SchoolWriteService 已有事务保护 + 每秒 10 写入限速               |
| ADR-0020 违规（误用 case 数据）       | 极低 | 合规风险            | 三 agent 的数据源 whitelist 写死，case 数据物理不可达            |

---

**方案 end. 等待用户审批。**
