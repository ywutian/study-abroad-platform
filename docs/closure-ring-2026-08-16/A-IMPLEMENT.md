# A 实施包

> [Index](./README.md) · [A 实施](./A-IMPLEMENT.md) · [B 验收](./B-VERIFY.md) · [Agent](./AGENT-MAP.md)

每条 A 有且仅有一条 B。做完去跑对应 B，把证据写回 [缺口清单](./README.md#缺口清单账本--证据回写处)。  
Guardrail 必须达到 `/close-the-loop` ③–⑤：同类不能靠文档挡住。  
**HEAD**：`main` @ `6cd02a61`。

---

## A-WP0 救 main

**对应 B**：[B-WP0](./B-VERIFY.md#b-wp0-救-main)  
**Owner agent**：`architect`（实施）+ `security-reviewer`（CVE 范围）+ `test-engineer`（proof 误诊）  
**依赖**：无。阻塞所有以 CI 为证据的 B 探针。  
**风险**：override 钉错大版本会拆 Next/Jest；定时审计误报会红掉无人值守的 cron。  
**回滚**：还原 `package.json` overrides + `pnpm-lock.yaml`；删新建 workflow；harness 诊断改动可独立回滚。

### 做

**T0.1 G0.1 nanoid**

- 根 `package.json` `pnpm.overrides` 现为 `"nanoid@>=3.0.0 <3.3.17": ">=3.3.17 <4"`，把解析钉在 **漏洞版** 3.3.17。
- GitHub Advisory `GHSA-2v37-7h3g-55p8` / CVE-2026-67213：3.x 线 patched = **3.3.18**（`< 3.3.18` 受影响）；5.x 线 patched = 5.1.6。本仓库锁在 3.x。
- 改为能解析到 `>=3.3.18 <4` 的最窄 override（例如 `"nanoid@>=3.0.0 <3.3.18": ">=3.3.18 <4"`）。**禁止**把 3.3.17 写进 ignoreGhsas。
- `pnpm install` 更新 `pnpm-lock.yaml`。用 `osv-scanner` / `tsx scripts/check-dependency-audit.ts` 确认 GHSA 消失。
- 若 3.3.18 拆消费者：按 `docs/SECURITY_DEPS.md` 贴出失败证据，不要静默 ignore。

**T0.2 G0.2 scheduled 审计**

- **新建** `.github/workflows/osv-audit-scheduled.yml`（不要改 `ci.yml`，该文件归 A-WP4）。
- `on.schedule`（建议每周）+ `workflow_dispatch`；跑与 CI 相同的 `osv-scanner` 安装 + `tsx scripts/check-dependency-audit.ts`。
- **禁止** `continue-on-error: true` / `|| true` / `exit 0`。失败必须红。
- 在 `docs/SECURITY_DEPS.md` 加一节：lockfile 不变时 CVE 仍可能出现，所以要有 schedule。

**T0.3 G0.3 gate-proof 误诊**

- `scripts/gate-proofs/harness.ts` 的 `expectClean`：树已红时抛「Gate is red on an unmodified tree」。
- `scripts/check-gate-proofs.ts` 把任何 throw 放进 `broken`，文案是「Gate proof(s) failed … the gate did NOT go red on a seeded violation」——这在基线已红时是**假诊断**。
- 改 runner：区分 `BASELINE_RED` vs `PROOF_DID_NOT_FIRE`。基线红：打印真正的门输出，exit ≠ 0，**不得**说 proof 坏。
- 加一条自证：人为让某已 proven 的 gate 在干净树变红，确认文案含 `BASELINE_RED`（或等价），不含「did NOT go red on a seeded violation」；再撤回。

### 不做

- 不 bump Node 20 → 22 只为救 `pnpm audit`（`SECURITY_DEPS.md` 已否决）。
- 不改 `mobile-ci.yml`（A-WP4 / G4.6）。
- 不改 `ci.yml`。
- 不 ignore GHSA-2v37-7h3g-55p8。

### 独占文件

- `package.json`（仅 `pnpm.overrides` / 必要时 lockfile 相关字段）
- `pnpm-lock.yaml`
- `.github/workflows/osv-audit-scheduled.yml`（新建）
- `scripts/check-gate-proofs.ts`
- `scripts/gate-proofs/harness.ts`
- `docs/SECURITY_DEPS.md`

### Guardrail（同类不能再来）

- override 钉到漏洞版：`lint:dep-pins` 或审计脚本断言 overrides 目标版本 **不在** OSV 受影响区间。种一条钉回 3.3.17 的 override → 门必须红。
- 无 schedule：`check-audit-gate.ts` **本包不要改**（归 A-WP4）；本包用新 workflow 存在且无 continue-on-error 作为 B 探针。
- proof 误诊：runner 对 BASELINE_RED 有独立分支；自证见 T0.3。

---

## A-WP1 注销成真

**对应 B**：[B-WP1](./B-VERIFY.md#b-wp1-注销成真)  
**Owner agent**：`security-reviewer`（主导）+ `data-model-reviewer`（孤儿表/FK）+ `i18n-specialist`（文案）+ `applicant-simulator`（两次点击/密码）  
**依赖**：B 证据中的 CI 项依赖 WP0。schema 工作可在 WP0 并行开发，但 PR 证明等 WP0。  
**风险**：`hardDelete` 不可逆；FK+cascade 可能误删审计表；COS delete 实现错会删错对象。  
**回滚**：关流量后的 API revision；migration 必须可向前兼容（新 FK 用 `ON DELETE CASCADE` 前先 backfill/清孤儿）。**禁止**用关 `ACCOUNT_PURGE_ENABLED` 当默认回滚（见决策树）。

### 决策树（G1.7 · 必须执行，不是可选项）

生产 `.github/workflows/ci.yml` Deploy canary 已是 `ACCOUNT_PURGE_ENABLED=true`，web/zh 文案已承诺「30 天后永久删除」。

```
B-WP1 对「删不干净」的探针（P1.blob / P1.orphan）结果
 ├─ 删不干净为真
 │    → 合并前必须二选一，且 B 能看见：
 │         (1) 文案去掉「永久删除 / 30 天」承诺，且 check-deletion-promise 与之一致
 │         (2) ACCOUNT_PURGE_ENABLED=false（生产 --set-env-vars）
 │    → 禁止第三种：开关仍 true + 文案仍承诺 + 能力未追上
 └─ 删得干净为真
      → 保持 ENABLED=true 与 30 天文案
      → 禁止关开关「假装没这回事」
```

### 做

**T1.1 G1.1 对象存储**

- `StorageService.deleteFile()`（`apps/api/src/common/storage/storage.service.ts`）今日零调用，且非 `local` 分支仍走 `deleteLocal`（COS/S3/OSS **没删**）。
- 实现各 provider 的真删除。
- 在 `hardDelete` / vault 删项 / verification 删材料 / forum 删图 / outcome evidence 删证路径上**调用**它。上传入口：`uploadVerificationFile`、`uploadOutcomeEvidence`、`uploadForumImage`、vault 密文若落地文件则同样。
- 测：上传 → 记 key → hardDelete → provider 侧 404/不存在。

**T1.2 G1.2 孤儿表**

- 先用 schema grep 列出全部 `userId` 无 `User @relation` 的 model（审查点名 Memory / AgentConversation / Entity；还有 UserAIPreference、AgentTokenUsage、AgentQuota、MemoryCompaction、AgentAuditLog 等，以 grep 为准，目标约 14）。
- `UserDataService.clearAllMemories/Conversations/Entities` 已存在，**接入** `UserService.hardDelete`（事务内或明确的 pre-cascade 步骤）。其余表要么加 FK+`onDelete: Cascade`，要么在 hardDelete 里显式 `deleteMany`。
- `AuditLog`（及规则已声明应存活的审计）保持无 cascade —— 写入 allowlist。
- schema 变更：新 FK 必须有 migration；nullable-or-default 规则适用列变更。先清生产孤儿或 backfill，再加 NOT NULL FK。

**T1.3 G1.3 Payment 例外**

- `AccountPurgeService` 已 skip 有 Payment 的账号。用户文案没有这句话。
- 在 web `settings.items.deleteAccountDesc` / `security.dangerZoneDesc` / `settings.dialogs.deleteDesc` 与 mobile 对应 key 写明：有支付记录的账号在宽限期后仍会保留财务所需行，身份会清、登录会关。
- 只改注销相关 key（web messages 本包窗口见 AGENT-MAP）。

**T1.4 G1.4 cron 锁与 backoff**

- `runWithCronLock`：job throw 被 catch 后仍 `return true` → `InternalCronController` 回 `{ dispatched: true }` → HTTP 200。http 模式下 job 失败必须抛出 → 5xx，Scheduler 才重试。
- 锁被占用（`held`）保持不重试是对的；但 **失败** 与 **跳过** 不得都是 200。
- `scripts/ci/sync-cloud-scheduler.mjs`：`--min-backoff=300s`，而 `DEADLINE_*_CRON_LOCK=600s`、`ACCOUNT_PURGE_CRON_LOCK=1800s`。把 min-backoff **抬到大于本仓库最大 cron lock TTL**，或按 job 对齐，并加检查：`min-backoff >= max(REDIS_TTL.*_CRON_LOCK)`。

**T1.5 G1.5 i18n 与 LOCALES**

- `apps/mobile/src/lib/i18n/locales/en.json` 注销串补上与 `ACCOUNT_PURGE_GRACE_DAYS=30` 一致的天数（现 zh 有、en 无）。
- `scripts/check-deletion-promise.ts` 的 `LOCALES` 改为扫描实际 locale 文件（web zh/en + mobile zh/en），**禁止**手写漏文件。漏 `en.json` 必须使门变红。

**T1.6 G1.6 确认 UX**

- `DELETE /users/me` 无密码。Web `settings/page.tsx` 两次点击即 `apiClient.delete(userRoutes.me())`。
- `/settings/security` 红按钮是 `<Link href="/settings">`。
- 要：当前密码（或等价再认证）才能软删；security 页走同一 mutation，不是 Link。Mobile `security.tsx` 已有密码框，对齐 web，并让 API 强制校验。

### 不做

- 不关 `ACCOUNT_PURGE_ENABLED` 来让 B 变绿，除非决策树第一分支（删不干净）且同时改文案。
- 不把 `AuditLog` 随用户 cascade 掉。
- 不改 `apps/web/src/messages/*.json` 里非注销命名空间（首页/FAQ 归 A-WP3）。
- 不改 `PredictionResult` 唯一键（A-WP3）。
- 不改 `.claude/rules/security.md`（A-WP5，且须等本包 B 绿）。

### 独占文件

- `apps/api/src/modules/user/user.service.ts` 及 `user.service.spec.ts`
- `apps/api/src/modules/user/user.controller.ts` 及 spec
- `apps/api/src/modules/user/account-purge.service.ts` 及 spec
- `apps/api/src/modules/user/BRIEF.md`
- `apps/api/src/common/storage/storage.service.ts` 及 spec
- `apps/api/src/modules/verification/verification.service.ts`（仅删除路径）
- `apps/api/src/modules/forum/forum-upload.service.ts`（仅删除路径）
- `apps/api/src/modules/ai-agent/memory/user-data.service.ts`（仅接入 hardDelete 所需 export/调用，不改 prompt）
- `apps/api/src/common/redis/cron-lock.util.ts` 及 spec
- `apps/api/src/common/cron/internal-cron.controller.ts` 及 spec
- `scripts/ci/sync-cloud-scheduler.mjs`
- `scripts/check-deletion-promise.ts` 及 `scripts/gate-proofs/check-deletion-promise.proof.ts`
- `apps/web/src/app/[locale]/(main)/settings/page.tsx`
- `apps/web/src/app/[locale]/(main)/settings/security/page.tsx`
- `apps/mobile/src/lib/i18n/locales/en.json`、`zh.json`（仅注销/danger 相关 key）
- `apps/web/src/messages/zh.json`、`en.json`（**仅** `settings.items.deleteAccount*`、`settings.dialogs.delete*`、`security.dangerZone*`；窗口期内独占整个文件，见 AGENT-MAP）
- `apps/api/prisma/schema.prisma` + **本包自己的** migration（孤儿 FK；窗口期内独占 schema）
- `apps/api/test/account-purge.e2e-spec.ts`

### Guardrail

- 新 `userId` 无 FK：lint 或 schema 检查 allowlist（AuditLog 等）。种一张无 relation 的 `userId` 表 → 门红。
- `deleteFile` 零调用：API quality 规则或测试断言 hardDelete 路径 `expect(storage.deleteFile).toHaveBeenCalled()`。
- LOCALES 漏文件：proof 删掉 en 条目 → `lint:deletion-promise` 必须红。
- cron 失败 200：controller/e2e 在 http + 抛错 job 时期望 5xx。
- min-backoff < lock TTL：`check-cron-manifest` 或新断言。

---

## A-WP2 Seed 失败必须可见

**对应 B**：[B-WP2](./B-VERIFY.md#b-wp2-seed-失败必须可见)  
**Owner agent**：`architect` + `test-engineer` + `study-abroad-expert`（内容下限是否合理）  
**依赖**：CI 证明依赖 WP0。可与 WP1/WP4 并行。  
**风险**：fail-loud 会让下一次生产 migrate job 失败——这是目标，不是事故。先确认哪些 seed 是内容关键。  
**回滚**：把非关键 seed 留在 fail-soft 名单（显式 allowlist，禁止默认 soft）。

### 做

**T2.1 G2.1 fail-soft**

- `apps/api/migrate.sh`：`run_seed` 现 `|| echo "WARNING: $label seed failed — non-fatal"`。
- 内容关键 seed **必须失败即非零退出**（至少）：`global-events`、`forum-communities`、`match-pools`、`testing-policy`、`competitions` / `competition-data`。
- 允许 fail-soft 的 label 写成显式名单 + 注释「为什么空表可接受」。不在名单里的失败 = migrate job 红。
- `scripts/check-seed-pipeline-parity.ts` 继续存在；补一条：关键 seed 不得匹配 fail-soft 包装。

**T2.2 G2.2 生产内容断言**

- 扩展 `apps/api/scripts/verify-seed.ts` 或新建 post-deploy 断言（只读生产/canary）：
  - `GlobalEvent` 行数 ≥ 已提交 JSON 的现行季条数
  - `ForumCommunity` official = **11**（`seed-forum-communities.ts` `OFFICIAL_COMMUNITIES`）
  - 每个 MatchPool `entries.length > 0`
  - CompetitionEdition 含已提交 2026-2027 sourced 记录
  - `School.testingPolicy = REQUIRED` 行数有下限（用 seed 脚本/现网抽样钉死数字，禁止拍脑袋）
- 断言必须能在「种子没跑、表为空」时变红——这是 fail-soft 的失败形态。

### 不做

- 不编造考试日期/社区/池子数据来把计数刷绿。空就该红。
- 不改组队排序/赛道（A-WP3）。
- 不把 `migrate.sh` 整文件改成与 A-WP4 CI 纠缠。

### 独占文件

- `apps/api/migrate.sh`
- `apps/api/scripts/verify-seed.ts`（及新建的 `scripts/check-prod-content-assert.ts` 若需要）
- `scripts/check-seed-pipeline-parity.ts` 及 `scripts/gate-proofs/check-seed-pipeline-parity.proof.ts`
- `docs/runbooks/` 下与 migrate/seed 相关的短更新（可选，不改 USER_FEEDBACK 全文）

### Guardrail

- 关键 `run_seed` 被改回 fail-soft：parity/proof 种一行 `|| echo WARNING` 在关键 label 上 → 门红。
- 内容断言：对空库或少一行 REQUIRED 必须非零退出。

---

## A-WP3 对学生诚实

**对应 B**：[B-WP3](./B-VERIFY.md#b-wp3-对学生诚实)  
**Owner agent**：`study-abroad-expert`（主导）+ `applicant-simulator` + `i18n-specialist` + `data-model-reviewer`（唯一键）  
**依赖**：schema 与 web messages 等 B-WP1。日历/徽章/组队/论坛 seed/essays-tab 可与 WP1 并行。CI 证明依赖 WP0。  
**风险**：放宽 `PredictionResult` 唯一键会让 pending-decisions 的「学校数」再次按行计数（反馈表第三行 Secondary 已警告）。必须同时 `distinct: ['schoolId']` 或改文案。  
**回滚**：文案回退；唯一键 migration 必须有双写/回填方案，禁止无回填 DROP UNIQUE。

### 做

**T3.1 G3.1 文案**

- 引导 `welcome.prediction`（zh：「精准录取预测」+「机器学习」；en：machine learning）。首页 `home.features.items` 含「招生偏好模型 / 持续校准的模型」。FAQ `predictionAccuracy`：「不对外宣称固定准确率」。
- 对外主张与 counselor 引擎 + FAQ 对齐：可解释、锚定公开录取率、**不是**「机器学习精准预测」。禁止营销句与 FAQ 互殴。
- 等 WP1 释放 `apps/web/src/messages/{zh,en}.json` 后再改这些 key。

**T3.2 G3.2 UNKNOWN 徽章**

- 隐藏点：`RateBreakdownPanel.tsx`、`school-hero-header.tsx`、`schools-list.tsx`（`testingPolicy !== 'UNKNOWN'`）。未知政策显示为未知，禁止当「没有政策」藏起来。
- 约 166 所：以查询钉死，不要写死 166。

**T3.3 G3.3 考试日历**

- `getGlobalEvents` 按 `eventDate` 排序，学生要的是报名截止与申请截止。补齐托福等缺席考试（**只许** sourced 数据，走 `/competition-data-update` 同源纪律：无 sourceUrl 不准编）。
- 列表排序键改为对学生行动有意义的日期（`registrationDeadline` 优先，否则明确标注「仅考试日」）。

**T3.4 G3.4 组队**

- `apps/api/prisma/seeds/competition-schedules-2026-2027.json`：相对 2026-08-16，多条 `eventEndAt` 已过仍排前。过滤或下沉已结束 edition。
- 国家队/IMO 等学生不能组的队伍不得出现在默认可加入面（或明确 badge「不可自行组队」）。
- JSON 无 `tracks` → `CompetitionTrack` 为 0。按 `/competition-data-update` 补真实赛道，禁止空数组假闭环。

**T3.5 G3.5 论坛计数**

- `apps/api/prisma/seed-forum-posts.ts` `randomLike()` / `randomView()`。种子必须 0；热度只来自真实 like/view。已入库存量：迁移或一次性 SQL 清零假数，并在 verify-seed 断言 `likeCount/viewCount` 分布不像 `Math.random`。

**T3.6 G3.6 essays-tab**

- `apps/web/src/app/[locale]/(main)/cases/_components/essays-tab.tsx`：`useQuery` 无 `keepPreviousData`。加上 `placeholderData: keepPreviousData`（或改走 `useListQuery`）。

**T3.7 G3.7 唯一键**

- `@@unique([profileId, schoolId])` 换季覆盖旧 `actualResult`。改为包含 `applicationYear`（及如需要的 round）的唯一键；upsert 点全部改；pending-decisions 计数改为按学校 distinct，避免 D1 回潮。
- **等 A-WP1 释放 schema.prisma。**

### 不做

- 不编造托福日期或 CompetitionTrack。
- 不在 WP1 占用 schema/messages 时抢改。
- 不把 UNKNOWN 显示成 OPTIONAL 来「有徽章」。

### 独占文件

- `apps/web/src/app/[locale]/(main)/cases/_components/essays-tab.tsx`
- `apps/web/src/components/features/prediction/RateBreakdownPanel.tsx`
- `apps/web/src/app/[locale]/(main)/schools/[id]/_components/school-hero-header.tsx`
- `apps/web/src/app/[locale]/(main)/admin/schools/_components/schools-list.tsx`
- `apps/api/src/modules/timeline/timeline-application.service.ts` 及 spec
- `apps/api/src/modules/team/team-recruitment.service.ts` 及 spec（过滤/排序）
- `apps/api/prisma/seeds/competition-schedules-2026-2027.json` 及 `upsert-competition-data.ts`（只加真实 tracks）
- `apps/api/prisma/seed-forum-posts.ts`
- `apps/api/src/modules/prediction/` 持久化 upsert（唯一键消费者）
- 窗口 3：`apps/api/prisma/schema.prisma` + 新 migration
- 窗口 3：`apps/web/src/messages/{zh,en}.json` 的 `welcome.prediction` / `home.features` / `help.faqItems.predictionAccuracy`

### Guardrail

- 禁用词「机器学习」「精准录取」出现在营销面：i18n 或 copy lint。种回 welcome.prediction 旧句 → 门红。
- UNKNOWN 隐藏：组件测试，policy=UNKNOWN 时仍渲染未知态。
- 已结束 edition 排最前：服务测试用 `eventEndAt` 昨天 vs 明年。
- 随机 like：seed 后 `likeCount` 全 0 或仅来自 Like 表聚合。
- essays-tab：质量规则应能扫到该文件（与 A-WP4 早退修复配合；本包先把实例清零）。
- 唯一键：migration 后插入同一 profile+school、不同 year 必须成功；同 year 必须冲突。

---

## A-WP4 门禁方法论补全

**对应 B**：[B-WP4](./B-VERIFY.md#b-wp4-门禁方法论补全)  
**Owner agent**：`test-engineer`（主导）+ `architect`（CI）+ `mobile-specialist`（mobile-ci）  
**依赖**：CI 证明依赖 WP0。可与 WP1/WP2 并行。  
**风险**：把 1.9k 行 Playwright 一次性拉进 PR CI 会超时/脆。允许分阶段：先进 nightly/路径过滤，但 **必须有 runner**，禁止继续只跑 core-pages 却声称 E2E 全覆盖。  
**回滚**：workflow 文件回退；proof 文件可删但不得提高 `gate-proof-baseline.json` 的 unproven 而不在 PR 说明。

### 做

**T4.1 G4.1 十三门零 proof**  
`check-gate-proofs.ts` 只扫根 `scripts/check-*.ts`。下列 **13** 个 `apps/*/scripts/check-*.ts` 零 proof（已排除 helpers、数据脚本、以及单独开票的 seo/hydration）：

1. `apps/api/scripts/check-api-quality.ts`
2. `apps/api/scripts/check-endpoints.ts`
3. `apps/mobile/scripts/check-mobile-i18n.ts`
4. `apps/mobile/scripts/check-mobile-quality.ts`
5. `apps/web/scripts/check-code-quality.ts`
6. `apps/web/scripts/check-hardcoded-english.ts`
7. `apps/web/scripts/check-i18n-scope.ts`
8. `apps/web/scripts/check-i18n.ts`
9. `apps/web/scripts/check-missing-keys.ts`
10. `apps/web/scripts/check-translation-keys.ts`
11. `apps/web/scripts/check-typography.ts`
12. `apps/web/scripts/check-unused-keys.ts`
13. `apps/web/scripts/check-wrong-language.ts`

为每一门写 `scripts/gate-proofs/<name>.proof.ts`（种违规 → `expectFired`）。扩展 runner 使 `apps/*/scripts/check-*.ts` 也被计数；unproven ratchet 只降不升。

**T4.2 G4.2 Playwright runner**

- CI 今日：`pnpm exec playwright test e2e/core-pages.spec.ts`。
- 其余：`auth` / `content-social` / `feature-closure` / `forum-infinite-scroll` / `admin-and-misc` / `application-analysis-*` / `full-ui-surface.spec.ts`（1209 行）无自动通道。
- 加 runner：PR 上对变更路径跑相关 spec；`full-ui-surface` 可放 nightly（已有 `application-analysis-nightly.yml` 可扩），但必须出现在 **某个** workflow 的非 `continue-on-error` step。

**T4.3 G4.3 seo / hydration**

- `pnpm --filter web check:seo` / `check:hydration` 写入自动通道（CI 对 web 变更，或 nightly 打生产 URL）。生产路径必须按 verify-where-it-matters：`curl` 服务端 HTML，不读 hydration 后 DOM。

**T4.4 G4.4 browser-extension**

- `packages/browser-extension/src/utils/api-client.ts` 写死生产 API。
- CI 要 build/test 该包；默认 API 不得指向生产（env / 构建配置）。禁止用扩展 job 打 `www.lumniedu.com`。

**T4.5 G4.5 keep-previous 早退**

- `checkListQueryNeedsKeepPrevious` 命中后 `return issues`（一文件一条）。`essays-tab` 这种同文件多 query 会漏。改为扫完整文件；A-WP3 修实例，本包修规则。

**T4.6 G4.6 mobile-ci audit**

- `.github/workflows/mobile-ci.yml`：删 `continue-on-error: true`，改为与主 CI 相同的 `osv-scanner` 脚本（`pnpm audit` 在 Node 20 上是坏的，见 SECURITY_DEPS）。
- 扩展 `scripts/check-audit-gate.ts`：扫描 **全部** `.github/workflows/*.yml`，任何 audit 步骤的 continue-on-error 都红。这样也罩住 A-WP0 的 scheduled workflow。

### 不做

- 不改 `package.json` overrides（A-WP0）。
- 不改 `migrate.sh`（A-WP2）。
- 不在扩展里用生产 cookie/密钥做「真实」E2E。
- 不把 unproven ratchet 往上调而不在 PR 写明。

### 独占文件

- `.github/workflows/ci.yml`
- `.github/workflows/mobile-ci.yml`
- `.github/workflows/application-analysis-nightly.yml`（若扩 Playwright）
- `playwright.config.ts`
- `e2e/**`（只加 runner/项目划分，不借机改产品断言除非红了）
- `apps/web/scripts/check-code-quality.ts`（早退）
- `apps/*/scripts/check-*.ts` 的 proof 文件 + `scripts/check-gate-proofs.ts` 的扫描范围（**注意**：`check-gate-proofs.ts` 归 A-WP0。本包 **不得** 改 runner 的 BASELINE_RED 分支；只通过 **新建 proof 文件** + 若必须扩扫描路径则等 B-WP0 绿后串一次，或把扫描扩开放进 WP0 的 harness PR 由 test-engineer 附带——默认：**B-WP0 绿之前只写 proof 文件，不改 runner**。扩扫描作为 T4.1 的第二提交，独占窗口见 AGENT-MAP。）
- `scripts/check-audit-gate.ts` 及 proof
- `packages/browser-extension/**`
- `scripts/gate-proof-baseline.json`（只降 unproven）

### Guardrail

- 新 `apps/*/scripts/check-*.ts` 无 proof → ratchet 红。
- mobile-ci 再写 continue-on-error → `lint:audit-gate` 红。
- keep-previous 早退：同文件两个违规 query，门必须报 ≥2。
- 扩展默认生产 URL：CI 或 lint 禁止硬编码 `lumniedu.com` 作为 API_BASE。

---

## A-WP5 文档自洽

**对应 B**：[B-WP5](./B-VERIFY.md#b-wp5-文档自洽)  
**Owner agent**：`feedback-processor` + `security-reviewer`（security.md 对齐）+ `architect`（部署边界）  
**依赖**：G5.2 等 B-WP1。G5.1 计划作者已改两行，本包负责扫全文 + 防回归。  
**风险**：把 security.md 改成「ENABLED=true」但 B-WP1 尚未证明能删干净 → 文档再次撒谎。所以删除段必须等 B-WP1。  
**回滚**：文档回退；无生产副作用。

### 做

**T5.1 G5.1 反馈表**

- `docs/USER_FEEDBACK_ANALYSIS_2026-08-05.md` Secondary 两行已标 ✅#561 / ✅#568。
- 扫同文件其余段落、`.normalized.md`、pending-decisions 是否仍写 NOT fixed。第三行 Secondary（唯一键 vs 「学校」文案）**保留为 OPEN 风险**，指向 G3.7，不要标 FIXED。
- 不要重写整篇。

**T5.2 G5.2 security.md 三处相反**（B-WP1 之后）

对照 `.claude/rules/security.md` vs 代码（HEAD `6cd02a61`）：

1. 「`ACCOUNT_PURGE_ENABLED` is `false`」vs 生产 `--set-env-vars` `true`。
2. 「Restore a retention period in that copy only when `ACCOUNT_PURGE_ENABLED=true`」vs 文案已经承诺 30 天且开关已 true——规则在叙述一个已过时的缺口。
3. 「One `hardDelete` cascades 55 relations off User」vs Memory/AgentConversation/Entity 等 **无 FK**，并不 cascade。

改到与 **B-WP1 之后的代码** 一致。`ci.yml` 里仍写 ENABLED=false 是 lock、与 default 相同的注释一并改（该 yaml 归 A-WP4；**只改注释**须在 AGENT-MAP 登记一次「A-WP5 可碰 ci.yml 注释块 ACCOUNT_PURGE」，或把注释修正并入 A-WP4 的 ci.yml 窗口并由 WP5 出文案——默认：**A-WP4 改 ci.yml 时顺手改那块过时注释**，A-WP5 只改 `security.md`）。

**T5.3 G5.3 merged ≠ production**

- 诚实边界写进 `docs/DEPLOY_CONFIG.md` 或 `docs/RELEASE_GATE_ONE_PAGER.md` 一小节（现有治理文档，不新建平行 SSOT）：
  - `ci.yml` 在 `push` 到 `main` 时部署 **GCP API canary 再切流量**；web 在 Vercel。
  - 没有单独的 `deploy-prod.yml`。
  - merge 绿 ≠ 用户已看见：canary、Vercel 独立、`migrate.sh` 曾 fail-soft、文案/开关可漂移。
- 禁止写「合进 main 即生产已修复」。

### 不做

- 不重写 USER_FEEDBACK 全文。
- 不改产品代码。
- 不在 B-WP1 前把 security.md 写成「删除已闭环」。

### 独占文件

- `docs/USER_FEEDBACK_ANALYSIS_2026-08-05.md`（及若发现矛盾的 `.normalized.md` 对应两行）
- `.claude/rules/security.md`
- `docs/DEPLOY_CONFIG.md` 和/或 `docs/RELEASE_GATE_ONE_PAGER.md`（只加诚实边界小节）
- 本目录四份 MD（回写 GAP 状态）

### Guardrail

- 文档与代码漂移：`scripts/check-drift.ts` 或 targeted grep 断言 `security.md` 不得在生产 ENABLED=true 时写「is false」。
- Secondary 两行再写成 NOT fixed：B-WP5 探针 grep。
