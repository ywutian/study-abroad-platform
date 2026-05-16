# Prediction Closure Re-run Playbook

> 第一次闭环（2026-05-16）见 [PREDICTION_CLOSURE_FINAL_REPORT_2026-05-16.md](PREDICTION_CLOSURE_FINAL_REPORT_2026-05-16.md)。
> 本 playbook 是**重跑指令**——每 6-12 个月学校发布新 CDS 后用。
>
> **用法**：把本仓库 README 或对话中的"触发指令"粘给 AI，AI 按本文档执行。
> 也可人工逐步跑 — 每段都是可独立执行的 shell。

---

## 0. 触发指令（user 粘贴用）

> 帮我跑预测系统数据闭环重跑 cycle，按 `docs/PREDICTION_CLOSURE_RERUN_PLAYBOOK.md` 执行。
> 先跑 freshness check 看哪些学校需要刷新；按结果选 Path A（混合）或 Path B（全 AI）。
> 闭环达成后用现有 `db:seed:prediction-closure:build` 生成新 payload 并开 PR。
> Git 不带 Claude attribution。

---

## 1. 前置检查（必跑）

```bash
# A. 当前 branch 干净
cd /Users/yitianwu/Documents/study-abroad-platform  # 或 worktree 路径
git status -s   # 应为空 / 仅未跟踪文件
git checkout main && git pull
git checkout -b "claude/closure-rerun-$(date +%Y-%m-%d)"

# B. 环境就绪
ls apps/api/.env || ln -sf $(pwd)/apps/api/.env <worktree>/apps/api/.env
docker ps | grep -E "study-abroad-(db|redis)"  # 必须 Up healthy
pnpm --filter api db:generate                   # Prisma client 同步

# C. 工具就绪
which $(pwd)/node_modules/.bin/tsx               # 应有
echo $TAVILY_API_KEY | head -c 4                 # 应为 tvly
```

如缺：`docker compose up -d`、`cp .env.example .env` 填 key。

---

## 2. Freshness Check（决定要不要跑）

```bash
pnpm --filter api predict:check-closure
```

**判断标准**：

- ✅ 所有 7 字段 ≥ 90% closure → 闭环还成立，看 OFFICIAL-pure 是否 drift > 5%
  - 若 stale provenance（fetchedAt > 18 个月） → 进入 Path A 刷新
  - 否则不必跑
- ⚠️ 任一字段 < 90% → 立刻 Path A 或 Path B（看数据缺多少）
- 🔴 任一字段 < 85% → 立刻 Path B（缺口大）

辅助检查（看哪些学校 stale）：

```bash
# 一次性 freshness script (尚未存在 — 第一次重跑时写)
$(pwd)/node_modules/.bin/tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const NOW = Date.now();
  const STALE_DAYS = 540;  // 18 months
  const schools = await p.school.findMany({
    where: { country: { in: ['US','United States','United States of America'] } },
    select: { id: true, name: true, usNewsRank: true, metadata: true }
  });
  const stale: any[] = [];
  for (const s of schools) {
    const prov = (s.metadata as any)?.provenance?.acceptanceRate;
    if (!prov?.fetchedAt) continue;
    const ageDays = (NOW - new Date(prov.fetchedAt).getTime()) / 86400000;
    if (ageDays > STALE_DAYS) stale.push({ rank: s.usNewsRank, name: s.name, age: ageDays.toFixed(0) });
  }
  stale.sort((a,b) => (a.rank ?? 9999) - (b.rank ?? 9999));
  console.log('Stale schools (acceptanceRate > 18mo):', stale.length);
  for (const s of stale.slice(0,30)) console.log('  rank', s.rank ?? '—', s.name, '(' + s.age + 'd)');
  await p.\$disconnect();
})();
"
```

---

## 3. Path 选择

### Path A — 混合模式（推荐：~20% 学校改变 → AI 仅补漏）

适用：上次闭环 < 12 个月、< 50 所学校 NEEDS_AI。

**3A.1 自动批量刷新**（脚本，无 AI；第一次需写）

```bash
# 新建 apps/api/scripts/closure-agents/auto-refresh-batch.ts
# 逻辑：
#   1. 读 ledger.json 所有 PROCESSED 学校
#   2. 对每所学校的 acceptanceRate.sourceUrl 发 HEAD
#      - 304 / 同 ETag → mark UNCHANGED
#      - 200 → 下载 → pdf-parse 抽 C1/C9/C21/C22
#        - 值差异 < 1% → AUTO_UPDATE（直接更新 + 刷新 fetchedAt）
#        - 值差异 1-10% → NEEDS_REVIEW（输出 diff 给我看）
#        - 值差异 > 10% → NEEDS_AI（可能学校真改了）
#      - 404 → NEEDS_AI（URL 失效）
#      - parse fail (xlsx/HTML/Google Drive) → NEEDS_AI
#   3. 写新 ledger entries
#   4. 输出 NEEDS_AI 学校列表给 dispatcher

# 然后跑
pnpm --filter api exec tsx scripts/closure-agents/auto-refresh-batch.ts
```

**3A.2 AI 补漏** — 对 NEEDS_AI 学校跑：

```bash
# 用现有 dispatcher 但传入 NEEDS_AI 列表
pnpm --filter api exec tsx scripts/closure-agents/next-batch.ts --size 9 \
  --only-from=apps/api/scripts/closure-reports/needs-ai-$(date +%F).json
```

按 [Phase 3 模式](PREDICTION_CLOSURE_PLAN_2026-05-16.md) 派 3 个 subagent 并行处理。

### Path B — 全 AI 模式（缺口大或第一次重跑没 Phase A 时）

直接重跑 [docs/PREDICTION_CLOSURE_PLAN_2026-05-16.md](PREDICTION_CLOSURE_PLAN_2026-05-16.md) 第 3 节 Phase 1-3 全流程：

```bash
# 1. 清 ledger 重新开始（保留作 audit）
mv apps/api/scripts/closure-agents/ledger.json \
   apps/api/scripts/closure-agents/ledger-archived-$(date +%F).json

# 2. 从 Top 1 开始拉 batch
pnpm --filter api exec tsx scripts/closure-agents/next-batch.ts --size 9

# 3. AI 派 3 subagent × 3 schools 并行
#    每 subagent 模板（贴给 AI）：
#      "处理 3 schools: X (id), Y (id), Z (id). 用 update-bowdoin-phase3.ts
#       为模板。规则：公立 oosAR=OFFICIAL；私立=TERMINAL；C9 优先 Composite；
#       minimal Prisma update + select: { id: true }; cycleYear number;
#       不覆盖已 closed。每所完成跑 next-batch.ts --record ID --status PROCESSED."

# 4. 重复 step 2-3 直到 candidates = 0

# 5. 验证
pnpm --filter api predict:check-closure  # 必须 exit 0
```

预估：~6-8 小时自治，~25-30M tokens。

### Path C — 仅刷新 provenance fetchedAt（最轻：所有值没变）

适用：数据正确但 fetchedAt 老化想刷"质量印章"。

```bash
$(pwd)/node_modules/.bin/tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const NOW = new Date().toISOString();
  const schools = await p.school.findMany({
    where: { country: 'US' },
    select: { id: true, metadata: true }
  });
  for (const s of schools) {
    const meta = (s.metadata as any) ?? {};
    const prov = meta.provenance ?? {};
    for (const f of Object.keys(prov)) prov[f].verifiedAt = NOW;
    await p.school.update({ where: { id: s.id }, data: { metadata: { ...meta, provenance: prov } }, select: { id: true } });
  }
})();
"
```

---

## 4. 闭环达成后 — 生成 payload + 发布

```bash
# 1. Build 新 payload（自动写到 data/prediction-closure-YYYY-MM-DD.json）
pnpm --filter api db:seed:prediction-closure:build

# 2. Dry-run local 确认 idempotent
pnpm --filter api db:seed:prediction-closure:dry
# 期望：240 entries / 240 matched / 0 updated / 0 unmatched

# 3. 验证：抽样 + tier 分布
pnpm --filter api exec tsx scripts/closure-agents/verify-sample.ts | head -50
$(pwd)/node_modules/.bin/tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const s = await p.school.findMany({ where: { country: 'US' },
    select: { institutionType: true, acceptanceRate: true, sat25: true, sat75: true } });
  const t = { 'T2':0, 'T3':0, 'T4':0, 'Excl':0 };
  for (const x of s) {
    if (x.institutionType === 'ART_DESIGN' || x.institutionType === 'MUSIC_CONSERVATORY') { t['Excl']++; continue; }
    if (x.acceptanceRate == null) { t['T4']++; continue; }
    if (x.sat25 && x.sat75) t['T2']++; else t['T3']++;
  }
  console.log(t); await p.\$disconnect();
})();
"
# 期望 T2 > 80%，T4 ≤ 2 所

# 4. Stage + commit (无 Claude attribution)
git add -A
git -c commit.gpgsign=false commit -m \"chore(prediction): refresh closure payload for $(date +%Y-%m-%d) cycle

- N schools updated via [Path A/B/C]
- All 7 fields closure >= 90% maintained
- Major changes: <列出 AR drift > 5pp 的学校>
- payload: apps/api/prisma/seeds/data/prediction-closure-$(date +%F).json\"

# 5. Push + PR
git push -u origin HEAD
gh pr create --title \"chore(prediction): refresh closure payload $(date +%Y-%m-%d)\" \\
  --body \"Refresh cycle per docs/PREDICTION_CLOSURE_RERUN_PLAYBOOK.md.

Field closure (in-scope US schools):
<paste check-closure output>

Major value changes:
<list AR drift > 5pp>

Deploy:
  DATABASE_URL=\\\$STAGING_DB pnpm --filter api db:seed:prediction-closure:dry
  DATABASE_URL=\\\$STAGING_DB pnpm --filter api db:seed:prediction-closure
  # then prod same flow\"
```

---

## 5. 发布到 staging / prod

```bash
# Staging 先 dry-run（240/240 matched, 0 unmatched 才继续）
DATABASE_URL=$STAGING_DB pnpm --filter api db:seed:prediction-closure:dry

# Staging apply
DATABASE_URL=$STAGING_DB pnpm --filter api db:seed:prediction-closure

# Staging 烟测：随机抽 5 所看前端 /prediction 结果

# Production 同流程
DATABASE_URL=$PROD_DB pnpm --filter api db:seed:prediction-closure:dry
DATABASE_URL=$PROD_DB pnpm --filter api db:seed:prediction-closure
```

## 6. 回滚

```bash
# 旧 payload 在 data/ 目录有历史
ls apps/api/prisma/seeds/data/prediction-closure-*.json

# 用任意旧 payload 重写
DATABASE_URL=$PROD_DB pnpm --filter api exec tsx prisma/seeds/seed-prediction-closure.ts \
  --file=apps/api/prisma/seeds/data/prediction-closure-2026-05-16.json
```

---

## 7. 关键文件索引

| 用途                | 文件                                                            |
| ------------------- | --------------------------------------------------------------- |
| 闭环检测            | `apps/api/scripts/check-closure.ts`                             |
| Dispatcher + ledger | `apps/api/scripts/closure-agents/next-batch.ts`                 |
| Audit trail         | `apps/api/scripts/closure-agents/update-*-phase*.ts` (223 历史) |
| 抽样验证            | `apps/api/scripts/closure-agents/verify-sample.ts`              |
| Payload builder     | `apps/api/prisma/seeds/build-prediction-closure-payload.ts`     |
| Seed runner         | `apps/api/prisma/seeds/seed-prediction-closure.ts`              |
| Payload 历史        | `apps/api/prisma/seeds/data/prediction-closure-*.json`          |
| 上次闭环报告        | `docs/PREDICTION_CLOSURE_FINAL_REPORT_2026-05-16.md`            |
| 设计文档            | `docs/PREDICTION_CLOSURE_PLAN_2026-05-16.md`                    |
| Pre-closure 审计    | `docs/PREDICTION_SYSTEM_AUDIT_2026-05-16.md`                    |

---

## 8. 红线规则（永不破）

1. **ADR-0020**：不用 case 数据 / 平台用户 outcome 做 calibration（强制 OFFICIAL/CDS/IPEDS）
2. **私立学校 oosAR**：自动 UNAVAILABLE/TERMINAL（in/out-of-state 不适用）
3. **跨校污染检测**：写入前 verify `sourceUrl` 域名与 `school.name` 一致（Mizzou 不能用 missouristate.edu）
4. **schema drift 兼容**：`prisma.school.update` 必须带 `select: { id: true }`
5. **cycleYear**：必须 number（如 2024），string 会被 serializer 丢
6. **Git commit**：永远不带 `Co-Authored-By` / `🤖 Claude Code` / 任何 AI attribution footer
7. **Branch**：先新建 feature branch，不直接 commit 到 main / 当前共享 branch
8. **不动 src/**：闭环 pipeline 只动数据 + scripts/ + prisma/seeds/，不动 apps/api/src/ 或 packages/shared/

---

## 9. AI subagent prompt 模板（直接复制）

派 3 个 subagent 并行时，每个用此模板（替换占位）：

```
数据闭环 agent。依序处理 3 所学校：

CWD: <worktree path>
模板：apps/api/scripts/closure-agents/update-bowdoin-phase3.ts (私立) 或 update-calpoly-slo-phase3.ts (公立)

| # | School | ID | CDS URL | Public/Private |
| 1 | <name> | <id> | <url 或 NEEDS_DISCOVERY> | <pub/priv> |
| 2 | ... |
| 3 | ... |

规则：
- 公立 → oosAR=OFFICIAL（C1 residency OOS 行）；私立 → UNAVAILABLE/TERMINAL
- C9 优先 SAT Composite 行；空 → EBRW+Math 求和
- C1 residency 空 → UNAVAILABLE/OFFICIAL_BLANK_SECTION
- C21 ED=No / C22 EA=No → UNAVAILABLE/OFFICIAL_BLANK_SECTION
- ED/EA=Yes 但无数字 → UNAVAILABLE/TERMINAL（NO_PUBLIC_ROUND_RATE）
- Test-blind 学校 sat25/75 → UNAVAILABLE/OFFICIAL_BLANK_SECTION (NOT_COLLECTED)
- minimal Prisma update + select: { id: true }（不要 SchoolWriteService）
- cycleYear number；不覆盖已 closed 字段；name 精确匹配避免撞名

流程：每所
  1. WebFetch CDS URL → binary 路径 → Read pages 5-13 (or 14-22 if C 节靠后)
  2. 抽 C1/C9/C21/C22
  3. 写 update-<short>-rerun-$(date).ts (参考模板)
  4. 跑 update → ledger: tsx scripts/closure-agents/next-batch.ts \
       --record <id> --status PROCESSED --mark-batch rerun-$(date) --notes auto

回报每校 1 行：`School: AR X→Y, sat X/Y, intlAR X, oosAR X% (state), ED/EA: state`

禁忌：不改 src，不 commit，不碰其他学校；解析失败别瞎填 → 标 PENDING_ALTERNATE_SOURCE
```

---

## 10. 何时该重跑

- **CDS 发布日历**：大多数学校 6-10 月发布新周期 CDS。年度 cycle 建议 11 月。
- **触发条件**（任一）：
  - `predict:check-closure` 报 floor / threshold 警告
  - 距上次闭环 ≥ 12 个月
  - 用户反馈预测精度下降
  - ADR / 业务策略变更（如新增 oosAR 公立 list）
- **不需要重跑**：
  - 距上次 < 6 个月（CDS 没更新）
  - check-closure 仍 exit 0 且 OFFICIAL-pure drift < 3%
  - 仅 1-2 个边角学校 stale（人工 patch 即可）
