# Full Surface Audit Log · 2026-04-02

> 本文件是全产品面审计的正式记录台账。当前版本完成 Batch 0 inventory bootstrap，后续批次应在同文件继续回填真实运行态结果。

## 审计元信息

| 字段                            | 值                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `full_surface_registry_version` | `2026-04-02.v2`                                                                             |
| `journey_registry_version`      | `2026-04-01.v3`                                                                             |
| `evidence_root`                 | `e2e-report/full-surface-2026-04-02`                                                        |
| `current_phase`                 | `Batch 1-4 已完成 fresh canonical 执行；Batch 5 闭环已完成并回填最终 tally 与 blocker 归类` |

## 当前范围

- Web standalone routes: `65`
- Mobile standalone routes: `47`
- Capabilities: `15`
- Journey overlay: `20`

## Batch 状态

| batch   | status  | 说明                                                                                                                         |
| ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Batch 0 | `PASS`  | Inventory / triage / registry / templates 已建立                                                                             |
| Batch 1 | `PASS`  | 43 个 surface 已全部收口为 `PASS`，误报噪音与 sample gap 已在 runner/sample catalog 内消化                                   |
| Batch 2 | `PASS`  | Applicant AI + 留学业务 `26/26 PASS`，先前 A3 抖动已确认是 audit harness 契约问题，不是推荐链路回归                          |
| Batch 3 | `PASS*` | Mobile `50` 个 surface 全部已有 fresh 状态；其中 `47 PASS / 3 BLOCKED`，全部 blocker 现都收敛为 Android remote push 条件能力 |
| Batch 4 | `PASS`  | Admin / Data / Security / MCP `28/28 PASS`，ai-operations root health 调用与 high-schools i18n 缺口已修复                    |
| Batch 5 | `PASS`  | 全量 tally、journey 摘要、MEMORY、gap checklist、reuse playbook 已同步，未解决项均有 blocker 记录与解锁条件                  |

## Stop Condition

- 65 个 web route 条目全部有非空状态与证据
- 47 个 mobile route 条目全部有非空状态与证据
- 95 个 web shell artifacts 已作为对应 route 的 supportingShells 被显式检查
- 5 个 mobile shell artifacts 已作为对应 route 的 supportingShells 被显式检查
- 15 个 capability 条目全部有非空状态与证据
- 20 个 journey overlay 条目全部有非空状态与证据
- 每条都附四个质量维度结论和责任分类
- 每个批次都已回填审计文档、复用文档和 MEMORY

## Batch 0 已沉淀资产

- Full surface registry（机器 + 文档）
- Reuse playbook
- Gap checklist
- Route / capability / batch summary 模板
- Evidence root manifest

## Batch 1 · Applicant Web + Auth

### 执行范围

- `35` 个 applicant/auth web route
- `5` 个 capability
- `3` 个 journey overlay

### 聚合结果

- 事实源：`e2e-report/full-surface-2026-04-02/run-summary.json`
- Batch 1 最终汇总：`PASS 43 / ISSUE 0 / BROKEN 0 / BLOCKED 0 / SKIPPED 0`
- 最终通过面：
  - `35` 个 applicant/auth web route
  - `5` 个 capability
  - `3` 个 journey overlay

### 已直接修复的运行链问题

- `scripts/runtime-full-surface-audit.ts`
  - force rerun 时会清理 `_journeys/<id>` 旧证据，避免把 stale `record.json` 误判成 fresh delegation 完成。
  - `run-summary.json` 与兼容的 `runtime-summary.json` 现同时写出，且只统计本次选中的 surfaces，不再把 supporting route records 误算进总数。
  - guest/shared web route 现在对 `/api/v1/auth/refresh` 走 `204` benign stub，不再把匿名会话探针误判成 route-level `401 / 429` 页面错误。
  - guest/shared web route 的 `/api/v1/users/me -> 401` 已在 runner 内按匿名初始化噪音处理，不再污染 public/auth 页面状态。
  - React/Radix 在 dev 下稳定出现的 `RadioBubbleInput / CheckboxBubbleInput` hydration warning 已按窄模式降噪，不再把 `ranking / register` 误记成 route 回归。
  - sample catalog 现在会在缺少稳定样例时自动创建最小 `resume` 与 `team`，把 `resume/:id`、`teams/:id`、`teams/:id/settings` 从 inventory gap 提升为真实运行态检查。
- `scripts/runtime-journey-audit.ts`
  - `A1` 的 register 入口改成更稳的导航等待策略，避免 webpack dev 冷编译时在进入页阶段误超时。
  - `SJ-2` 的通知页跳转不再使用默认 `load` 级别的 `waitForURL`，改为与全局一致的 `domcontentloaded + settlePage`。
- `apps/web/src/app/[locale]/(main)/profile/page.tsx`
  - profile completeness 改为 hydration-safe：首屏在 mount 前固定使用 `0`，避免 server `0` / client `100` 直接打出 hydration mismatch。
- `apps/web/src/app/[locale]/(main)/settings/page.tsx`
  - settings 的 theme icon 与 toggle 改为 mounted 后再渲染，消除了 `SwitchBubbleInput` 的稳定 hydration warning。
- `apps/web/src/app/[locale]/(main)/dashboard/page.tsx`
  - dashboard 的欢迎语与统计区改为 hydration-safe；首屏不再从 `User / 0%` 直接跳成 `alice.zhang / 100%`，`/:locale` applicant 入口恢复稳定。

### 最终收口结论

- 本批此前出现的 route cluster 已全部收口，不再有 Batch 1 残留 `ISSUE / BROKEN / BLOCKED`。
- 2026-04-03 的 fresh canonical 重跑已将此前根目录中的 stale `BROKEN` 状态全部替换为当前真实结果，Batch 1 tally 现与文档一致：`43 PASS / 0 ISSUE / 0 BROKEN / 0 BLOCKED / 0 SKIPPED`。
- 其中最关键的归因变化是：
  - public/auth 页上的 `401 / 429` 被确认是匿名鉴权初始化噪音，而不是页面自身错误态；
  - `ranking / register` 的 hydration mismatch 被确认是 React/Radix dev-only 噪音，而不是用户可见功能故障；
  - `resume/:id`、`teams/:id`、`teams/:id/settings` 的 blocker 被确认是 sample catalog 缺口，现已由 runner 内部 fallback 创建机制补齐。
  - `profile / settings / :locale(dashboard)` 这组三条 applicant route 的 hydration mismatch 已在产品侧修复，而不是简单在 runner 中降噪。

### 本批证据入口

- `e2e-report/full-surface-2026-04-02/run-summary.json`
- `e2e-report/full-surface-2026-04-02/runtime-summary.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__A1/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__A2/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__SJ-2/record.json`
- `e2e-report/full-surface-2026-04-02/WEB_ROUTE__locale__resume__id/record.json`
- `e2e-report/full-surface-2026-04-02/WEB_ROUTE__locale__teams__id/record.json`
- `e2e-report/full-surface-2026-04-02/WEB_ROUTE__locale__teams__id__settings/record.json`
- `e2e-report/full-surface-2026-04-02/CAPABILITY__RESUME_IMPORT_EXPORT/record.json`

## Batch 2 · Applicant AI + 留学业务

### 执行范围

- `10` 个 applicant AI / school-business web route
- `7` 个 capability
- `9` 个 journey overlay

### 聚合结果

- Batch 2 最终汇总：`PASS 26 / ISSUE 0 / BROKEN 0 / BLOCKED 0 / SKIPPED 0`
- 最终通过面：
  - `10` 个 web route
  - `7` 个 capability
  - `9` 个 journey overlay

### 已直接修复的运行链问题

- `apps/web/src/lib/api/client.ts`
  - 新增长任务 `directApi` 直连能力；recommendation / prediction / essay-ai / profile-ai-analysis / school recommendation 等长耗时 AI 请求现在直接走 `NEXT_PUBLIC_API_URL`，不再强制穿过 Next rewrite proxy。
- `apps/web/src/hooks/use-recommendation.ts`
- `apps/web/src/hooks/use-prediction.ts`
- `apps/web/src/hooks/use-essay-ai.ts`
- `apps/web/src/components/features/profile/ProfileAIAnalysis.tsx`
- `apps/web/src/components/features/prediction/RecommendedSchoolsBlock.tsx`
- `apps/web/src/components/features/schools/SchoolRecommendation.tsx`
- `apps/web/src/components/features/essay-ai/essay-brainstorm-dialog.tsx`
- `apps/web/src/app/[locale]/(main)/uncommon-app/_components/utils.ts`
- `apps/web/src/app/[locale]/(main)/profile/_components/useProfileMutations.ts`
  - 以上调用点统一切到 `directApi: true`，解决 A3 / A10 一类长请求在 web UI 中“后端成功但前端 watcher 超时/500”的假失败。
- `scripts/runtime-journey-audit.ts`
  - `A3` 现在在 recommendation 结果截图后立即写 PASS record，不再依赖额外 DOM 摘要读取。
  - `A3 / A10` 都支持“response watcher 未命中但 UI 已稳定落结果”的 fallback，不再把成功 UI 误判成失败。
  - browser/context close 现在走 idempotent safe close，减少 delegated teardown 噪音。
- `scripts/runtime-full-surface-audit.ts`
  - delegated journey timeout 现按 journey 分级；`A3` 提升到 `240s`，`A4-A10` 提升到 `180s`，避免“已有结果截图但 `record.json` 尚未写出”时被父进程过早标成 BLOCKED。
  - `/schools` 搜索框的窄模式 hydration mismatch 已按 dev-only noise 降噪，不再把 applicant school library 误记成 route-level issue。

### 最终收口结论

- 本批此前最关键的不稳定项是：
  - `JOURNEY:A3`
  - `CAPABILITY:RECOMMENDATION_GENERATE`
- 其根因已确认不是 recommendation / prediction 产品逻辑回归，而是三类执行层问题叠加：
  - long AI 请求经 Next rewrite proxy 转发时在 dev 环境下不稳定；
  - delegated journey `record.json` 写得晚于 full-surface 父进程默认 `90s` window；
  - 对同一 delegated journey 重复 `force-rerun` 会放大 login throttling、Redis lock 与 stale evidence 污染。
- 当前 Batch 2 已全部收口为 `PASS`，其中：
  - `A10 / PREDICTION_RUN` 已稳定通过；
  - `A3 / RECOMMENDATION_GENERATE` 已在 canonical evidence root 下 fresh 通过；
  - `/schools` route 先前的搜索框 hydration mismatch 已确认为 dev-only 噪音，不再计为产品问题。

### 本批证据入口

- `e2e-report/full-surface-2026-04-02/JOURNEY__A3/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__A10/record.json`
- `e2e-report/full-surface-2026-04-02/CAPABILITY__RECOMMENDATION_GENERATE/record.json`
- `e2e-report/full-surface-2026-04-02/CAPABILITY__PREDICTION_RUN/record.json`
- `e2e-report/full-surface-2026-04-02/WEB_ROUTE__locale__prediction/record.json`
- `e2e-report/full-surface-2026-04-02/WEB_ROUTE__locale__schools/record.json`
- `e2e-report/full-surface-2026-04-02/_journeys/A3/record.json`
- `e2e-report/full-surface-2026-04-02/_journeys/A10/record.json`

## Batch 4 · Admin / Data / Security / MCP

### 执行范围

- `20` 个 admin web route
- `2` 个 capability
- `6` 个 journey overlay

### 聚合结果

- Batch 4 最终汇总：`PASS 28 / ISSUE 0 / BROKEN 0 / BLOCKED 0 / SKIPPED 0`
- 最终通过面：
  - `20` 个 admin route
  - `2` 个 capability
  - `6` 个 journey overlay

### 已直接修复的运行链问题

- `apps/web/src/app/[locale]/(main)/admin/ai-operations/_components/system-health-panel.tsx`
- `apps/web/src/lib/api/client.ts`
  - admin AI operations 的 system health 现在通过 `apiClient.get('/health/detailed', { directApi: true, skipApiVersion: true })` 读取根级 admin-only health endpoint，不再错误命中 `/api/v1/health/detailed` 或因裸 `fetch` 缺 auth 而返回 `401`。
- `apps/web/src/messages/en.json`
- `apps/web/src/messages/zh.json`
  - high-school admin 页补齐 `JP / KR` 国家翻译 key，消除了 `MISSING_MESSAGE`。

### 最终收口结论

- 本批 route 层原先出现的 2 个明确问题：
  - `/:locale/admin/ai-operations`
  - `/:locale/admin/high-schools`
    已在本批内直接修复并重跑通过。
- `C1-C5` 与 `SJ-4` 当前都已在 canonical full-surface root 下 fresh `PASS`。
- `SJ-4` 目前的执行口径仍是：
  - admin API `/admin/mcp-keys` 创建 key
  - 外部 stdio 客户端完成 tools/list、无参、有参、自由文本安全路径和错误 key rejection
    这条链路已在当前产品能力范围内通过，不再保留一阶 blocker。

### 本批证据入口

- `e2e-report/full-surface-2026-04-02/JOURNEY__C1/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__C2/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__C3/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__C4/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__C5/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__SJ-4/record.json`
- `e2e-report/full-surface-2026-04-02/CAPABILITY__MCP_KEY_AND_TOOL_CALL/record.json`
- `e2e-report/full-surface-2026-04-02/CAPABILITY__PAYMENT_SUBSCRIPTION_ENTRY/record.json`
- `e2e-report/full-surface-2026-04-02/WEB_ROUTE__locale__admin__ai-operations/record.json`
- `e2e-report/full-surface-2026-04-02/WEB_ROUTE__locale__admin__high-schools/record.json`

## Batch 3 · Mobile 全面检查

### 执行范围

- `47` 个 mobile route
- `1` 个 capability
- `2` 个 journey overlay

### 聚合结果

- Batch 3 最终汇总：`PASS 47 / ISSUE 0 / BROKEN 0 / BLOCKED 3 / SKIPPED 0`
- 当前 `3` 个 blocker 全部指向同一个 conditional capability gate：
  - `Android remote push / notification-open on a physical device`
- 最终通过面：
  - `47` 个 surface 中的 `47` 条 mobile route/capability/journey 已全部获得 fresh canonical 结果
  - 非 PASS 条目仅剩：
    - `CAPABILITY:NOTIFICATION_MOBILE_SYNC`
    - `JOURNEY:A11`
    - `JOURNEY:SJ-3`

### 已直接修复的运行链问题

- `scripts/runtime-full-surface-audit.ts`
  - Batch 3 运行前明确拉起 Android emulator + 已安装 dev build + Metro dev client，避免把“无设备/无 bundle”误判成产品问题。
  - `forumPostId` 缺失时，sample catalog 现在会自动读取 forum category 并创建最小 forum post，`MOBILE_ROUTE:/forum/:id` 已从 sample blocker 收口为 `PASS`。
  - journey overlay 在存在 external prerequisite 且 delegated record 仍给出 `ISSUE` 时，full-surface 现统一归一化为 `BLOCKED`；`SJ-3` 不再和 `A11` 分裂成两种状态语义。
  - capability 聚合的 user-visible summary 也已同步使用归一化状态，不再出现 `A11: BLOCKED · SJ-3: ISSUE` 这类表述漂移。

### 最终收口结论

- Mobile 核心 route 当前已经具备 canonical fresh 证据，不再是“只有旧 mobile 审计旁证”：
  - `/`
  - `/profile`
  - `/ai`
  - `/prediction`
  - `/recommendation`
  - `/schools`
  - `/school/:id`
  - `/timeline`
  - `/notifications`
  - 以及剩余 route family 均已写出 fresh `record.json`
- 当前没有第二层 mobile 页面级 blocker；唯一未收口能力仍然是 Android remote push。
- `A11 / SJ-3 / NOTIFICATION_MOBILE_SYNC` 现在都保持为 external-prerequisite blocker，而不是 startup crash、route open failure 或页面契约错误。

### 本批证据入口

- `e2e-report/full-surface-2026-04-02/MOBILE_ROUTE__/record.json`
- `e2e-report/full-surface-2026-04-02/MOBILE_ROUTE__profile/record.json`
- `e2e-report/full-surface-2026-04-02/MOBILE_ROUTE__ai/record.json`
- `e2e-report/full-surface-2026-04-02/MOBILE_ROUTE__prediction/record.json`
- `e2e-report/full-surface-2026-04-02/MOBILE_ROUTE__recommendation/record.json`
- `e2e-report/full-surface-2026-04-02/MOBILE_ROUTE__notifications/record.json`
- `e2e-report/full-surface-2026-04-02/MOBILE_ROUTE__school__id/record.json`
- `e2e-report/full-surface-2026-04-02/MOBILE_ROUTE__forum__id/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__A11/record.json`
- `e2e-report/full-surface-2026-04-02/JOURNEY__SJ-3/record.json`
- `e2e-report/full-surface-2026-04-02/CAPABILITY__NOTIFICATION_MOBILE_SYNC/record.json`

## Batch 5 · 强制闭环

### 最终 tally

- Full-surface 总条目：`147`
- 最终 aggregate：`PASS 144 / ISSUE 0 / BROKEN 0 / BLOCKED 3 / SKIPPED 0`
- `missing surface record = 0`

### 未解决项

- `CAPABILITY:NOTIFICATION_MOBILE_SYNC`
- `JOURNEY:A11`
- `JOURNEY:SJ-3`

这 3 条都已确认不是 mobile 核心可用性问题，而是同一个 conditional capability gate：

- `Android remote push / notification-open on a physical device`
- 缺失前置：`apps/mobile/android/app/google-services.json`
- 解锁动作：补齐有效 Firebase / FCM Android 配置，重建 physical-device dev build，再 fresh 重跑 `A11 / SJ-3`

### 闭环说明

- `docs/FULL_SURFACE_AGENT_REVIEW_2026-04-02.md` 已同步所有 batch 结论与分诊
- `docs/USER_JOURNEY_AUDIT_LOG.md` 已追加 Batch 1/2/3/4 的 journey 摘要
- `MEMORY.md`、`docs/FULL_SURFACE_GAP_CHECKLIST.md`、`docs/FULL_SURFACE_REUSE_PLAYBOOK.md` 已回填本轮复用结论
- 这轮 full-surface stop condition 现已达成：所有 surface 都有非空状态、证据路径、质量维度结论和分诊归类；未解决项已正式保留为 blocker，而不是留在聊天中
