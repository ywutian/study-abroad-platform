# Phase B / Phase C 拆分策略

**前提**：你的 main repo working tree 当前 235 个文件改动，Phase B+C 已混在一起，加上无关工作（数据 sync、UI 改造等）。
**目标**：拆出两个干净 PR — Phase B (parity-gated) 和 Phase C (sanity-gated)，互不污染。

---

## Phase B/C 关键文件分类

通过 diff 分析，Phase B+C 的核心改动集中在 13 个文件 + 2 个新增脚本。其他 ~220 个文件是无关工作（数据 sync、UI、admin 模块等），跟 Phase B/C **无关**。

### Phase B（counselor primary refactor + Tier 4 contract）

**修改文件**：
| 文件 | LOC 改动 | 内容 |
|---|---|---|
| `apps/api/src/modules/prediction/prediction.service.ts` | 338 | counselor primary，删 fusion/ML/distillation 计算 |
| `apps/api/src/modules/prediction/prediction.service.spec.ts` | 1508 | 重写测试（counselor primary, Tier 4, DTO absence） |
| `apps/api/src/modules/prediction/dto/prediction-response.dto.ts` | 42 | Tier 4 contract（probability null, tier 'unavailable'）|
| `apps/api/src/modules/prediction/counselor/counselor-engine.service.ts` | 53 | Tier 4 sentinel return 完善 |
| `apps/api/src/modules/prediction/prediction-persistence.service.ts` | 7 | Tier 4 不持久化 |
| `apps/api/src/modules/prediction/prediction-memory.service.ts` | 17 | Tier 4 不写 memory |
| `apps/api/src/modules/prediction/prediction-statistical-engine.service.ts` | 47 | 简化（fusion 路径删了相关引用）|
| `apps/api/src/modules/prediction/prediction-transformer.service.ts` | 50 | DTO 字段处理 |
| `apps/api/src/modules/prediction/prediction.prompts.ts` | 5 | 微调 |
| `apps/web/src/app/[locale]/(main)/prediction/_components/PredictionHistoryTab.tsx` | ? | probability null 处理 |
| `apps/mobile/src/screens/prediction/PredictionScreen.tsx` | 51 | mobile DTO null 处理 |

**新增文件**：

- `apps/api/scripts/verify-counselor-coverage.ts`（240 × 12 coverage check）

### Phase C（counselor data activation）

**修改文件**：
| 文件 | LOC 改动 | 内容 |
|---|---|---|
| `apps/api/src/modules/prediction/counselor/counselor-modifiers.ts` | 321 | gpa distribution + real ED/EA + ACT bands + CIP matching + rule version bump |

**新增文件**：

- `apps/api/scripts/verify-counselor-data-quality.ts`（Phase C data QA）

### 不归 Phase B/C 但可能要一起 ship 的

- `apps/api/gold-cases/counselor/cases/{003,005,024,028}*.json` — gold case fixture 更新；属 Phase B（counselor primary 的 expected output 调整）

### 完全无关（拆出来不动）

- 所有 `apps/api/scripts/fetch-*.ts`、`apps/api/scripts/audit-*.ts`、`apps/api/scripts/cleanup-*.ts` 等数据 sync 工作
- `apps/web/src/components/ui/*` UI 组件改造
- `apps/api/src/modules/admin/*`、`apps/api/src/modules/school-list/*` 等模块工作
- Schema migration `prisma/migrations/202605*` （但要小心：如果 Phase B/C 依赖这些，要带上）

---

## 拆分执行（推荐顺序）

### 准备：确认 main 仓库 baseline 干净

```bash
cd /Users/yitianwu/Documents/study-abroad-platform
git status                      # 确认 235 改动还在
git stash list                  # 确认无遗忘 stash
git log --oneline -3            # 确认 HEAD = 543c7f3d (Phase A 之前的 baseline)
```

### Step 1: 备份当前所有改动到 backup branch

```bash
git checkout -b wip-phase-b-c-and-other-work
git add -A
git commit -m "wip: Phase B+C + unrelated work — to be split"
BACKUP_SHA=$(git rev-parse HEAD)
echo "backup: $BACKUP_SHA"   # 万一拆错可以 reset 回来
```

### Step 2: 回到 baseline，开 phase-b-only 分支

```bash
git checkout main             # main 仓主干（HEAD = 543c7f3d）
git checkout -b phase-b-only
```

### Step 3: 从 backup 选择性拷贝 Phase B 文件

```bash
# Phase B 修改文件（counselor-modifiers.ts 不带过来）
git checkout $BACKUP_SHA -- \
  apps/api/src/modules/prediction/prediction.service.ts \
  apps/api/src/modules/prediction/prediction.service.spec.ts \
  apps/api/src/modules/prediction/dto/prediction-response.dto.ts \
  apps/api/src/modules/prediction/counselor/counselor-engine.service.ts \
  apps/api/src/modules/prediction/prediction-persistence.service.ts \
  apps/api/src/modules/prediction/prediction-memory.service.ts \
  apps/api/src/modules/prediction/prediction-statistical-engine.service.ts \
  apps/api/src/modules/prediction/prediction-transformer.service.ts \
  apps/api/src/modules/prediction/prediction.prompts.ts \
  apps/api/src/modules/prediction/dto/ \
  apps/web/src/app/[locale]/\(main\)/prediction/_components/PredictionHistoryTab.tsx \
  apps/web/src/app/[locale]/\(main\)/prediction/page.tsx \
  apps/mobile/src/screens/prediction/PredictionScreen.tsx \
  apps/api/gold-cases/counselor/cases/

# Phase B 新增文件
git checkout $BACKUP_SHA -- apps/api/scripts/verify-counselor-coverage.ts
```

### Step 4: 验证 Phase B parity 通过

```bash
pnpm --filter api build
pnpm --filter api test -- prediction
pnpm --filter api gold:counselor

# 关键：parity gate
# 跑历史 parity script — counselor-modifiers.ts 是 baseline 状态
# 所以预期 max Δ <= 0.001
pnpm --filter api exec tsx scripts/verify-counselor-coverage.ts
# 还需要一个 verify-counselor-parity.ts 脚本（如果你只有 historical-parity.json 的输出脚本，重跑即可）
```

**通过判定**：

- `pnpm --filter api test -- prediction` ✅
- coverage 240×12 ✅ (这部分 Phase B 不影响)
- historical parity max Δ ≤ 0.001（关键！如果失败说明意外把 Phase C 改动带进来了）

如果 parity 失败：

```bash
git diff --stat main..phase-b-only -- apps/api/src/modules/prediction/counselor/counselor-modifiers.ts
# 应该是 0（无改动）。如果有改动说明 Step 3 漏了过滤
```

### Step 5: Commit Phase B + 推送 PR

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(prediction): Phase B counselor primary + Tier 4 graceful decline

- PredictionService.predictForSchool now uses counselor as the primary served
  path; legacy fusion/ML/distillation/Platt computation removed from the
  served path
- Tier 4 unavailable contract: probability=null, tier='unavailable',
  predictionMethod='insufficient_data'; Tier 4 results are NOT persisted to
  PredictionResult (DB probability remains numeric for real predictions)
- DTO drops engineScores, crossEngineConsistency, servedTrace.shadow.fusion
  for new responses; web/mobile/admin tolerate their absence
- Add verify-counselor-coverage.ts (240 schools × 12 archetypes)

Verification:
- 622 prediction tests pass
- 31/31 gold counselor cases pass
- 2880/2880 coverage pairs pass with 0 anomalies
- Historical parity max Δ ≤ 0.001 (counselor math unchanged)

Phase C (data activation: GPA distribution, real ED/EA, ACT bands, CIP)
ships separately because it intentionally changes counselor math.
EOF
)"
git push -u origin phase-b-only
gh pr create --title "Phase B: counselor primary + Tier 4 graceful decline" --body-file - <<'EOF'
... (PR description)
EOF
```

### Step 6: 开 phase-c 分支（基于 phase-b-only）

```bash
git checkout -b phase-c-data-activation phase-b-only
git checkout $BACKUP_SHA -- \
  apps/api/src/modules/prediction/counselor/counselor-modifiers.ts \
  apps/api/scripts/verify-counselor-data-quality.ts

# 跑 Phase C sanity gates
pnpm --filter api build
pnpm --filter api test -- prediction
pnpm --filter api exec tsx scripts/verify-counselor-coverage.ts
pnpm --filter api exec tsx scripts/verify-counselor-data-quality.ts
```

**通过判定**（per v2 plan）：

- max |Δ vs phaseB| ≤ 0.40 — **当前实测 0.443** ⚠️ 超阈值 0.043
- p95 |Δ| ≤ 0.20 — 待验证
- max archetype |Δ| > 0.30 学校 → 全部 manual review 完毕

⚠️ **警告**：当前 Phase C 数学有 17 学校超 0.30 manual review 阈值，max Δ 0.443 突破 0.40 hard gate。Ship Phase C 前**必须**：

1. 跑 outlier 诊断（已知主因：safety/match 校 EA 路径多 modifier 复合效应）
2. 完成 17-50 manual review 分类（见 [v2 plan](../../../.claude/plans/context-driven-onboarding-cheeky-kahan.md) 的 4-bucket framework）
3. 决策：
   - 如果分类全是"expected math change"（非 bug）→ 写进 PR description 的 changelog，ship
   - 如果有 bug → 修代码 → 重跑 → 再决策
   - 如果用户感知不能接受 → 要么放弃 Phase C，要么改 modifier 上限让 Δ ≤ 0.40

### Step 7: 恢复无关工作

```bash
git checkout phase-c-data-activation
git checkout $BACKUP_SHA -- .   # 恢复所有文件到 backup state
# 此时 phase-c-data-activation working tree 包含 Phase B+C+其他 220 文件
# 但 phase-c-data-activation HEAD 只有 Phase C 的 commit
git status                       # 看到 220 改动是 unstaged

# 这些 220 改动属于无关工作，可以：
# - stash → 之后再 commit
# - 立即创建别的分支处理
git stash push -u -m "unrelated work — non-prediction scripts and UI"
```

---

## 安全网

如果中间任何步骤翻车：

```bash
# 直接恢复 backup
git checkout wip-phase-b-c-and-other-work
git reset --hard $BACKUP_SHA
```

或更彻底：

```bash
git reflog                       # 找回任何 HEAD 历史
git reset --hard HEAD@{N}        # 回到任意点
```

---

## 总览：拆完后的 PR 状态

| Branch                                 | HEAD                 | LOC                       | Parity gate  | Sanity gate                      | Ship 顺序                     |
| -------------------------------------- | -------------------- | ------------------------- | ------------ | -------------------------------- | ----------------------------- |
| `phase-b-only`                         | 1 commit             | ~2K (mostly spec rewrite) | ✅ Δ ≤ 0.001 | N/A                              | **第 1 个 ship**              |
| `phase-c-data-activation`              | 1 commit on top of B | ~321 (modifiers + script) | N/A          | ⚠️ 当前 fail，需先 manual review | **第 2 个 ship**（review 后） |
| `wip-phase-b-c-and-other-work`         | 备份                 | ~all changes              | —            | —                                | **不 ship**，仅 backup        |
| `phase-c-data-activation` working tree | unstashed            | 220 files                 | —            | —                                | 各自 ship                     |

---

## 等 Phase C ship 前还要做的

按 [v2 plan](../../../.claude/plans/context-driven-onboarding-cheeky-kahan.md) 的 manual review framework：

```
For each school in 17 outliers ∪ 42 data QA flags (~50 unique):
  - Read counselor servedTrace before vs after
  - Identify which modifier(s) caused the largest delta
  - Classify:
    [ ] Data quality issue（修数据 → 重跑）
    [ ] Expected math change（写 changelog）
    [ ] Modifier interaction bug（修代码 → 重跑）
    [ ] Fixture issue（修 fixture）
  - 签字：[founder name + date]
```

输出：`docs/migrations/prediction-simplification/phase-c-manual-review-2026-05-XX.md`

完成 50 条全部分类 + bug 全部修完 + 通过 hard gate 后 → ship Phase C。

---

## 需要先建一个 verify-counselor-parity.ts 脚本

你现有脚本是 historical-parity.json 输出（基于 stored predictions）。

**Phase B parity gate 推荐做法**：
不要用 historical-parity（因为 stored predictions 是 v1.x 旧版本，会 trip false positive）。改用：

```typescript
// scripts/verify-counselor-parity.ts
// 对比 Phase B branch (counselor v1.x) vs main HEAD (counselor v1.x)
// 跑 240×12 archetype，所有 Δ 应该 == 0（counselor 算法 100% 一致）
```

或者你信任 historical-parity 跑出来 Δ=0 这个事实就够了——只要 phase-b-only 分支没引入 counselor-modifiers.ts 改动。

**最简单的 sanity check**:

```bash
git diff main phase-b-only -- apps/api/src/modules/prediction/counselor/counselor-modifiers.ts
# 应该输出 0 行
```

如果是 0 行 → counselor 数学没变 → parity 必然过 → 不需要重跑 historical-parity script。

---

## 最后一句

整个拆分大概 1-2 小时（Step 1-5 = 30-45 分钟，Step 6-7 = 30 分钟，Phase C manual review 是后面的事）。

**先 ship Phase B**（0 风险），然后慢慢做 Phase C 的 review + 修 bug + 决策 → 再 ship。

风险点：Step 3 时漏掉某个文件或多带文件——通过 Step 4 的 parity gate 兜底。
