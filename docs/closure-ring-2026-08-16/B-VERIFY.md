# B 验收包

> [Index](./README.md) · [A 实施](./A-IMPLEMENT.md) · [B 验收](./B-VERIFY.md) · [Agent](./AGENT-MAP.md)

技能：`.claude/skills/verify-where-it-matters.md`。  
每条主张都是可证伪的句子。先写失败释义，再跑命令。绿 ≠ 覆盖了生产路径。  
**HEAD 基线**：`main` @ `6cd02a61`。WP0 未 CLOSED 前，任何「CI 绿」证据记为路径未覆盖。

每个 B 只服务一个 A。探针全过才能把对应 G\* 标 `CLOSED`。

---

## 证据回写格式

对每个探针，在 [README GAP 表](./README.md#缺口清单账本--证据回写处) 写：

```
状态 | 探针ID | 日期 | 命令 | 覆盖了哪条路径 | 观察 | 预先承诺的失败释义
```

「未验证」是合法状态。禁止用 typecheck 绿代替生产路径。

---

## B-WP0 救 main

**对应 A**：[A-WP0](./A-IMPLEMENT.md#a-wp0-救-main)

### 主张（可证伪）

| ID   | 主张                                                                                                    | 怎样证明它是假的                                                                                                         |
| ---- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| C0.1 | lockfile 解析到的 `nanoid@3.x` 不在 `GHSA-2v37-7h3g-55p8` 受影响区间（3.x：`< 3.3.18`）                 | `osv-scanner` / `check-dependency-audit.ts` 仍打印该 GHSA；或 `pnpm-lock.yaml` 仍出现 `nanoid@3.3.17:` 且无 3.3.18       |
| C0.2 | 存在 scheduled workflow 跑**同一**审计脚本，失败会使 workflow 红                                        | 无 `schedule:`；或 step 含 `continue-on-error: true`；或跑的是 `pnpm audit` 而非 `check-dependency-audit.ts`             |
| C0.3 | 当某已 proven gate 在未播种树上已红时，`pnpm lint:gate-proofs` 诊断为基线红，而不是「proof 没让门变红」 | 人为弄红一扇已 proven 门后，stderr 仍含 `did NOT go red on a seeded violation` 或 `Gate proof(s) failed` 且不提 baseline |

### 路径枚举与覆盖

| 路径                                             | C0.1                                                         | C0.2 | C0.3 |
| ------------------------------------------------ | ------------------------------------------------------------ | ---- | ---- |
| 本地 `tsx scripts/check-dependency-audit.ts`     | 必须                                                         | —    | —    |
| CI job（push/PR）同一脚本                        | 必须（WP0 之后）                                             | —    | —    |
| 新建 schedule workflow                           | —                                                            | 必须 | —    |
| 干净工作树 `pnpm lint:gate-proofs`               | —                                                            | —    | 必须 |
| 生产运行时是否调用 nanoid customAlphabet(size=0) | 不在本包（CVE 是 lockfile 门禁；若要声称不可利用须另开主张） | —    | —    |

### 探针（先写失败释义）

**P0.1 钉死 CVE**

```bash
rg -n "nanoid@3\.3\.17" pnpm-lock.yaml package.json
pnpm exec tsx scripts/check-dependency-audit.ts
```

- 失败释义：lockfile 仍解析 3.3.17 **或** 审计输出含 `GHSA-2v37-7h3g-55p8` → C0.1 为假。
- 混淆源：忽略列表。`auditConfig.ignoreGhsas` 含该 GHSA → 主张为假（A 包禁止 ignore）。
- 种违规：把 override 改回 `>=3.3.17 <4`，门必须红；再撤回。

**P0.2 schedule**

```bash
rg -n "schedule:" .github/workflows/osv-audit-scheduled.yml
rg -n "continue-on-error|check-dependency-audit" .github/workflows/osv-audit-scheduled.yml
```

- 失败释义：文件不存在 / 无 schedule / 软化退出 / 调用 `pnpm audit` → C0.2 为假。
- 未覆盖：直到第一次 cron 真正触发前，「schedule 已触发」未验证——在 GAP 写明，DoD 不要求等一周；要求 YAML 与脚本路径正确且无软化。

**P0.3 误诊**

1. 记录干净树 `pnpm lint:gate-proofs` 输出。
2. 临时破坏一扇 **已有 proof** 的 gate，使它对未改种子的树变红（例如给 `check-deletion-promise.ts` 一个必红的 LOCALES 空洞，随即还原）。
3. 再跑 `pnpm lint:gate-proofs`。

- 失败释义：输出把失败说成 proof 没开火，而不是「基线已红、本轮 proof 无信息」→ C0.3 为假。
- 种 runner 回归：删掉 BASELINE_RED 分支 → 本探针必须再红。

### 失败即红的 gate

```bash
pnpm exec tsx scripts/check-dependency-audit.ts   # 必须 0，且无 GHSA-2v37-7h3g-55p8
pnpm lint:gate-proofs                             # 干净树：0；基线红：非 0 且文案正确
pnpm lint:audit-gate                              # 主 CI 门仍硬（mobile 那条归 B-WP4）
```

---

## B-WP1 注销成真

**对应 A**：[A-WP1](./A-IMPLEMENT.md#a-wp1-注销成真)

### 主张

| ID        | 主张                                                                                                                | 怎样证明它是假的                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| C1.blob   | hardDelete 之后，该用户 `verification/`、`outcome-evidence/`、`forum` 图、vault 文件 key 在配置的 provider 上不存在 | 删除后对同一 key GET/Head 仍 200；或 `deleteFile` 仍无调用点；或 COS 分支仍只 `deleteLocal`            |
| C1.orphan | hardDelete 之后，inventory 里非 allowlist 表对该 `userId` 行数为 0                                                  | Memory/AgentConversation/Entity 等仍有行；`clearAll*` 仍未被 hardDelete 调用                           |
| C1.pay    | 用户可见注销文案写明 Payment 账号不会被 purge                                                                       | 承诺永久删除的字符串在有支付记录路径上无例外句                                                         |
| C1.cron   | http 驱动下，锁内 job throw → HTTP 5xx；Scheduler min-backoff ≥ 最大 cron lock TTL                                  | throw 仍 200；`sync-cloud-scheduler.mjs` 仍 `--min-backoff=300s` 而 `ACCOUNT_PURGE_CRON_LOCK` 为 1800s |
| C1.i18n   | 所有已部署 locale 的注销串含与 `ACCOUNT_PURGE_GRACE_DAYS` 相同的天数；漏文件会使 `lint:deletion-promise` 红         | mobile `en.json` 仍无 `\d+ days`；从 LOCALES 去掉 en 门仍绿                                            |
| C1.ux     | 无当前密码（或等价再认证）不能软删；`/settings/security` 红按钮触发同一删除而非纯导航                               | `DELETE /users/me` 无密码仍 200；security 页仍是 `Link href="/settings"`                               |
| C1.flag   | 决策树被遵守：删不干净 ⇒ 改文案 XOR 关开关；删干净 ⇒ 保持 true + 30 天文案                                          | 开关 true + 文案承诺 + P1.blob/orphan 失败同时成立                                                     |

### 路径枚举

| 路径                                           | 覆盖要求                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| 单元：`user.service` hardDelete + storage mock | 必要但不充分                                                                |
| API e2e：`account-purge.e2e-spec.ts` + 真 DB   | 必要                                                                        |
| Provider：local + **生产实际用的 COS/S3**      | 声称「文件没了」必须打真实 provider 或明确「仅 local 已验、COS 未验」       |
| Cloud Scheduler 重试                           | 读 YAML/mjs 可证 backoff；「生产曾 5xx 并重试」需部署后日志，合并前标未验证 |
| Web `/settings` 与 `/settings/security`        | 浏览器或组件测；curl HTML 不能证按钮行为                                    |
| Mobile en 文案                                 | 读 JSON + `lint:deletion-promise`                                           |
| 生产 `--set-env-vars`                          | 读 `ci.yml`，不是读 zod default                                             |

### 探针

**P1.blob** 建用户，上传 verification + outcome + forum 图，记 key，`hardDelete`，对 storage 查 key。

- 失败释义：任一 key 仍可读 → C1.blob 为假 → **走决策树**，禁止标 G1.1 CLOSED。
- 混淆：只断言 Prisma 行没了。行没了但 COS 对象还在 = 主张为假。

**P1.orphan** 对 inventory 每一张非 allowlist 表插入 `userId=victim`，hardDelete，`count === 0`。

- 失败释义：任一张剩余 > 0 → C1.orphan 为假 → 决策树。
- 允许剩余：allowlist（`AuditLog` 等），测试里点名。

**P1.pay**

```bash
rg -n "payment|支付|financial|财务" apps/web/src/messages/{zh,en}.json apps/mobile/src/lib/i18n/locales/{zh,en}.json
```

- 失败释义：注销 desc 承诺永久删除且无支付例外 → C1.pay 为假。

**P1.cron**

```bash
# 单测：CRON_DRIVER=http，job throw，controller/lock 不得吞成 200
pnpm --filter api test -- cron-lock internal-cron account-purge
rg -n "min-backoff" scripts/ci/sync-cloud-scheduler.mjs
rg -n "CRON_LOCK" apps/api/src/common/redis/redis-ttl.constants.ts
```

- 失败释义：http + throw → 200；或 `300s` < 最大 lock 秒数 → C1.cron 为假。

**P1.i18n**

```bash
pnpm lint:deletion-promise
# 种违规：从 LOCALES 逻辑中拿掉 mobile en（或临时删天数）→ 必须非 0
```

- 失败释义：en 无天数且门绿；或漏文件门绿 → C1.i18n 为假。

**P1.ux** 无密码 `DELETE /users/me` 必须 4xx；security 页源码不得用纯 `Link` 代替删除。

- 失败释义：无密码 200；或 `settings/security/page.tsx` 仍 `Link href="/settings"` 作为唯一红按钮行为 → C1.ux 为假。

**P1.flag** 若 P1.blob 或 P1.orphan 失败：

```bash
rg -n "ACCOUNT_PURGE_ENABLED=" .github/workflows/ci.yml
pnpm lint:deletion-promise
```

- 失败释义：ENABLED=true **且** 文案仍承诺永久删除 **且** 删除探针失败 → C1.flag 为假（假闭环仍在）。

### 失败即红

```bash
pnpm --filter api test -- user.service account-purge storage cron-lock
pnpm --filter api test:e2e -- account-purge   # 需 Docker
pnpm lint:deletion-promise
pnpm --filter web exec tsc --noEmit
pnpm --filter study-abroad-mobile exec tsc --noEmit
```

生产 COS 路径若本环境打不到：GAP 写 `OPEN-UNVERIFIED-PROD-BLOB`，**不得** CLOSED G1.1。那会强制决策树（改文案或关开关）。

---

## B-WP2 Seed 失败必须可见

**对应 A**：[A-WP2](./A-IMPLEMENT.md#a-wp2-seed-失败必须可见)

### 主张

| ID        | 主张                                                                                                                         | 怎样证明它是假的                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| C2.soft   | `global-events` / `forum-communities` / `match-pools` / `testing-policy` / `competition-data` 失败会使 `migrate.sh` 非零退出 | 关键 label 仍包在 `\|\| echo WARNING`；模拟 seed 失败后脚本仍 0 |
| C2.assert | 内容断言在空表/少行时红，在承诺下限时绿                                                                                      | 空库仍 0 退出；或断言不存在                                     |

### 路径

| 路径                                             | 覆盖                                               |
| ------------------------------------------------ | -------------------------------------------------- |
| 本地对 `migrate.sh` 的 `run_seed` 定义做静态扫描 | 必要                                               |
| 用假失败脚本跑 migrate（或抽测 `run_seed`）      | 必要                                               |
| 生产 Cloud Run Job `study-abroad-migrate` 日志   | 合并后；合并前标未验证                             |
| 对生产/canary 只读 API 或 SQL 计数               | C2.assert 的「生产」行；没有凭证则 OPEN-UNVERIFIED |

T1 前车：`Deploy to GCP: success` 与种子没跑长得一样。B 不得用 deploy job 绿关闭 G2.*。

### 探针

**P2.1**

```bash
rg -n "run_seed|WARNING" apps/api/migrate.sh
pnpm lint:seed-parity
```

把关键 seed 的 `.js` 临时改名为不存在 → 跑 `run_seed` 片段或带 `set -e` 的包装。

- 失败释义：退出码 0 且只有 WARNING 行 → C2.soft 为假。

**P2.2** 在空库或故意少一行 official community 上跑 verify/assert。

- 失败释义：仍 exit 0 → C2.assert 为假。
- 数字：communities **=11** 与 `OFFICIAL_COMMUNITIES` 数组长度绑定；改数组不断言 → 为假。

### 失败即红

```bash
pnpm lint:seed-parity
pnpm lint:seed-freshness
pnpm exec tsx apps/api/scripts/verify-seed.ts   # 或本包新增的 assert 入口
```

---

## B-WP3 对学生诚实

**对应 A**：[A-WP3](./A-IMPLEMENT.md#a-wp3-对学生诚实)

### 主张

| ID         | 主张                                                                                            | 怎样证明它是假的                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| C3.copy    | 学生在首页/引导看不到「机器学习精准预测」类与 FAQ 互殴的句子                                    | `welcome.prediction` 或 `home.features` 仍含「机器学习」/「精准录取预测」且 FAQ 仍否认固定准确率 |
| C3.unknown | `testingPolicy=UNKNOWN` 的学校对学生显示未知态，不是没徽章                                      | 三处 UI 仍 `!== 'UNKNOWN'` 直接不渲染                                                            |
| C3.cal     | 考试日历按对学生行动有意义的日期排序，且含 sourced 托福（或诚实空态「未收录托福」而非假装完整） | 仍 `orderBy: { eventDate: 'asc' }` 作为唯一键；缺托福却无空态说明                                |
| C3.team    | 默认可组队面不把已结束 edition 排最前；国家队赛不可冒充可加入；有 sourced tracks                | 7 条 `eventEndAt` 已过仍第一屏；`CompetitionTrack` count=0                                       |
| C3.forum   | 新种子帖 like/view 为 0；存量假随机数已清或已披露                                               | `seed-forum-posts.ts` 仍 `randomLike()`；生产帖 like 分布仍像 `rand(20)`                         |
| C3.essay   | essays-tab 筛选/翻页不把列表打回骨架                                                            | 文件仍无 `keepPreviousData`/`placeholderData`                                                    |
| C3.uniq    | 同一 profile+school 不同 `applicationYear` 可并存；换季不覆盖旧 outcome                         | schema 仍 `@@unique([profileId, schoolId])`；插入第二年行失败                                    |

### 路径

| 主张       | 代码路径                     | 生产路径                                          |
| ---------- | ---------------------------- | ------------------------------------------------- |
| C3.copy    | messages JSON                | 首页 SSR HTML（curl，不读客户端）                 |
| C3.unknown | 组件测试                     | 一所 UNKNOWN 校详情页                             |
| C3.cal     | timeline service 测试        | `GET` 全局事件                                    |
| C3.team    | recruitment 测试 + JSON      | `GET` editions/tracks                             |
| C3.forum   | seed 静态 + DB               | 生产帖计数（部署后）                              |
| C3.essay   | 组件/质量规则                | 浏览器翻页（本地 `next start` 可证 UX；生产另标） |
| C3.uniq    | migration + persistence 测试 | 生产插入前不可在用户库乱写；用测试库              |

### 探针

**P3.copy**

```bash
rg -n "机器学习|精准录取预测|machine learning" apps/web/src/messages/{zh,en}.json
curl -sS "$WEB_ORIGIN/zh" | rg -n "机器学习|精准录取"
```

- 失败释义：营销面仍有禁用句 → C3.copy 为假。FAQ 改成也宣称 ML 来「对齐」同样为假（降低诚实度）。

**P3.unknown** 渲染 `testingPolicy: 'UNKNOWN'` fixture。

- 失败释义：DOM 无未知标签且无政策徽章 → 主张为假（藏起来）。

**P3.cal** 两行：报名截止更早但 eventDate 更晚 vs 相反。排序必须让更早的**行动截止**在前，或标签明确。

- 失败释义：仍按 eventDate 把报名已过的考试排在可报名考试前面且无说明 → 为假。

**P3.team** 用 `eventEndAt` 昨天的 edition + 明年的 edition。

- 失败释义：昨天的排第一 → 为假。`SELECT count(*) FROM "CompetitionTrack"` = 0 → 为假。

**P3.forum**

```bash
rg -n "randomLike|randomView|Math.random" apps/api/prisma/seed-forum-posts.ts
```

- 失败释义：仍存在随机赋值 → 为假。

**P3.essay**

```bash
rg -n "keepPreviousData|placeholderData|useListQuery" apps/web/src/app/\[locale\]/\(main\)/cases/_components/essays-tab.tsx
```

- 失败释义：无匹配 → 为假。质量规则在同文件第二处违规 query 也必须能红（依赖 B-WP4 P4.5；若 WP4 未完，本探针仍以源码为准）。

**P3.uniq** 测试库：同一 profile+school year=2026 与 2027 两行；2026 的 `actualResult` 在 2027 upsert 后不变。

- 失败释义：第二年 insert 唯一键冲突或 2026 outcome 被改 → 为假。

### 失败即红

```bash
pnpm --filter web lint:i18n
pnpm --filter api test -- timeline-application team-recruitment prediction-persistence
pnpm --filter web test -- essays-tab RateBreakdownPanel
```

---

## B-WP4 门禁方法论补全

**对应 A**：[A-WP4](./A-IMPLEMENT.md#a-wp4-门禁方法论补全)

### 主张

| ID       | 主张                                                                                             | 怎样证明它是假的                                                                               |
| -------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| C4.proof | 13 个 listed app check 各有会开火的 proof                                                        | 任一 `prove()` 缺 `expectFired`；或 runner 仍不扫描 `apps/*/scripts` 且 ratchet 把它们当不存在 |
| C4.pw    | 至少一条非 `core-pages` 的 Playwright spec 在某个无软化的 workflow step 里跑                     | CI 仍只有 `playwright test e2e/core-pages.spec.ts`；其它 spec 仅手工                           |
| C4.seo   | web 变更会跑 seo 与 hydration 检查，或 nightly 打约定 URL                                        | `package.json` 有脚本但无 workflow 引用                                                        |
| C4.ext   | 扩展包在 CI 构建/测试；默认 API 不是生产主机                                                     | CI 无该包；`API_BASE_URL` 仍是 `https://www.lumniedu.com/api/v1`                               |
| C4.kp    | keep-previous 规则对同一文件两处违规报 ≥2                                                        | 种两处后仍只 1 条（文件级 return）                                                             |
| C4.mob   | `mobile-ci.yml` 审计失败会使 job 红；`check-audit-gate` 能抓住任意 workflow 的 continue-on-error | 仍 `continue-on-error: true`；gate 仍只读 `ci.yml`                                             |

### 路径

| 主张     | 本地                                                | CI                               | 生产                                   |
| -------- | --------------------------------------------------- | -------------------------------- | -------------------------------------- |
| C4.proof | `pnpm lint:gate-proofs`                             | 同                               | 无                                     |
| C4.pw    | `pnpm exec playwright test <spec>`                  | **必须看见 job 日志跑了该 spec** | 无                                     |
| C4.seo   | `pnpm --filter web check:seo http://localhost:4102` | workflow                         | 打生产须 `curl` HTML（hydration 陷阱） |
| C4.ext   | `pnpm --filter browser-extension test`              | 同                               | 禁止打生产                             |
| C4.kp    | 种违规 + `pnpm --filter web lint:quality`           | 同                               | 无                                     |
| C4.mob   | 读 YAML + `pnpm lint:audit-gate`                    | 同                               | 无                                     |

数 CI checks：正常 PR 约 20 个 job。不要把「5 个绿的无关 workflow」当成 ci.yml 已跑（verify-where-it-matters 已记录的坑）。

### 探针

**P4.1** 对 13 个名字各 `ls scripts/gate-proofs/<stem>.proof.ts`；`pnpm lint:gate-proofs`。空 `prove()` 必须进 broken。

**P4.2**

```bash
rg -n "playwright test" .github/workflows/*.yml
```

- 失败释义：唯一匹配仍是 `e2e/core-pages.spec.ts` → C4.pw 为假。

**P4.3**

```bash
rg -n "check:seo|check:hydration|check-seo-html|check-hydration" .github/workflows/*.yml package.json apps/web/package.json
```

- 失败释义：仅 scripts 存在、workflow 无引用 → C4.seo 为假。

**P4.4** `rg lumniedu.com packages/browser-extension` 在 API_BASE 上必须 0（测试 fixture 除外且不得在 CI 网络访问）。

**P4.5** 在临时文件放两个 `useQuery` + page 在 key 里、无 keepPreviousData。

- 失败释义：只 1 条 finding → C4.kp 为假。测完删除。

**P4.6** 在 `mobile-ci.yml` 临时加回 `continue-on-error: true` 于审计 step。

- 失败释义：`pnpm lint:audit-gate` 仍 0 → C4.mob 为假。测完还原。

### 失败即红

```bash
pnpm lint:gate-proofs
pnpm lint:audit-gate
pnpm --filter web lint:quality
pnpm exec playwright test e2e/core-pages.spec.ts   # 回归
# 另：workflow 中新 runner 指向的 spec
```

---

## B-WP5 文档自洽

**对应 A**：[A-WP5](./A-IMPLEMENT.md#a-wp5-文档自洽)

### 主张

| ID        | 主张                                                                         | 怎样证明它是假的                                                             |
| --------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| C5.fb     | Secondary defects 不再一边 FIXED#568 一边 NOT fixed；dialog 不再写待修       | 文件仍含 `deliberately NOT fixed` 且指 pending-decisions；dialog 行无 ✅#561 |
| C5.sec    | `security.md` 删除段与 **当时** 生产开关、文案、hardDelete 实际 cascade 一致 | 仍写 ENABLED is false，而 `ci.yml` 为 true；仍写 cascade 55 而孤儿表无 FK    |
| C5.deploy | 治理文档写明 merged ≠ production，且不把 canary 绿写成用户已看见             | 发版文档仍暗示 merge 即生产修复                                              |

### 路径

文档主张只覆盖「仓库里的字」。生产是否已部署是 B-WP1/2 的路径，本包不偷换。

### 探针

**P5.1**

```bash
rg -n "NOT fixed|待修|512px|deliberately NOT" docs/USER_FEEDBACK_ANALYSIS_2026-08-05.md
rg -n "✅ FIXED \\(#561\\)|✅ FIXED \\(#568\\)" docs/USER_FEEDBACK_ANALYSIS_2026-08-05.md
```

- 失败释义：Secondary 两行缺 ✅ 标记，或 NOT fixed 仍描述 pending-decisions → C5.fb 为假。
- 第三行唯一键警告应仍在（G3.7）；把它标 FIXED 也是假。

**P5.2** 在 B-WP1 CLOSED 之后：

```bash
rg -n "ACCOUNT_PURGE_ENABLED is \`false\`|cascades 55" .claude/rules/security.md
rg -n "ACCOUNT_PURGE_ENABLED=" .github/workflows/ci.yml
```

- 失败释义：规则与 ci.yml/代码相反 → C5.sec 为假。
- B-WP1 未 CLOSED 时本探针标 SKIP：过早改文档会制造新谎言。

**P5.3**

```bash
rg -n "merged ≠ production|merged != production|不等于生产" docs/DEPLOY_CONFIG.md docs/RELEASE_GATE_ONE_PAGER.md
```

- 失败释义：无诚实边界句 → C5.deploy 为假。

### 失败即红

无单独 lint 时可把 P5.1/P5.3 做成 `scripts/check-drift.ts` 的一条，或本环人工跑 rg 并把输出贴进 GAP。若加 drift 规则，按 close-the-loop ⑤ 种一次矛盾句看它是否红。

---

## 证据日志 · 2026-08-17 集成

落地分支 `fix/closure-ring-2026-08-16`（base `main` @ `6cd02a61`）。完整 GAP 状态在 [README](./README.md#缺口清单账本--证据回写处)。本环 **未闭合**（G1.1/G1.7 仍 OPEN；多数其余 PARTIAL）。

| 命令                                                                                                                                                      | 结果                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `pnpm exec tsx scripts/check-dependency-audit.ts`                                                                                                         | 0 unignored high/critical   |
| `pnpm lint:gate-proofs`                                                                                                                                   | 36 proven, 0 unproven of 36 |
| `pnpm lint:audit-gate` / `lint:dep-pins` / `lint:deletion-promise` / `lint:orphan-userid` / `lint:e2e-runner` / `lint:seed-parity` / `lint:cron-manifest` | 绿                          |
| `tsx apps/api/prisma/check-seed-result-assertions.ts`                                                                                                     | 静态绿；`--db` 未跑         |
| `pnpm --filter api test -- user.service user.controller storage cron-lock outcome prediction-persistence team-recruitment timeline-application`           | 9 suites / 134 passed       |
| `pnpm --filter api exec tsc --noEmit --project tsconfig.build.json`                                                                                       | 绿                          |
| `pnpm --filter web exec tsc --noEmit`                                                                                                                     | 绿                          |
| `pnpm --filter web lint:quality`                                                                                                                          | 绿                          |
| `pnpm --filter web lint:i18n` / `pnpm --filter study-abroad-mobile lint:i18n`                                                                             | 绿（集成中途）              |
| `account-purge` e2e / Playwright / 生产 COS Head / seed `--db` / 九路重审 / 第一次 scheduled cron                                                         | **未跑**                    |

---

## 九路重审时 B 的角色

重审不是替代本文件。重审若发现新 BLOCK：在 README GAP 表加 `G9.x`，**先**配 A/B 对（可追加小节），再实施。没有 B 的新 A 不准进环。
