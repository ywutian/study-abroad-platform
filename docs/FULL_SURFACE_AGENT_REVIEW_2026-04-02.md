# Full Surface Agent Review · 2026-04-02

> 本文件记录多 Agent 视角下的 Batch 规划、分诊规则和阶段性结论。当前版本用于 Batch 0 启动与后续批次承接。

## 审查元信息

| 字段                            | 值                   |
| ------------------------------- | -------------------- |
| `full_surface_registry_version` | `2026-04-02.v2`      |
| `journey_registry_version`      | `2026-04-01.v3`      |
| `route_scope`                   | `web 65 / mobile 47` |
| `capability_scope`              | `15`                 |
| `journey_overlay_scope`         | `20`                 |

## Batch 0 结论

- 已确认当前仓库此前只有 journey 级事实源，没有 full-surface registry。
- Web 存在大量 shell-only 文件；它们不应算独立页面，但必须绑定到对应 route 检查。
- Mobile 真实应区分 standalone routes 与 `_layout` 壳层；后者必须单列为专项检查。
- `A11 / SJ-3` 的 Android remote push 继续保留为 conditional capability gate，不与 mobile 核心运行态混淆。
- `MEMORY.md` 之前不存在，本轮需要显式建立以沉淀易漏点与重复使用说明。

## CLAUDE 五类分诊默认口径

| 类别                  | 默认适用                                         |
| --------------------- | ------------------------------------------------ |
| `CODE_BUG`            | 页面崩溃、错误渲染、请求契约不一致、错误恢复失效 |
| `DATA_ISSUE`          | seed / 样本 / 后台数据缺失导致的空态或误导       |
| `UX_CONFUSION`        | badge、概率、置信度、策略分层等用户误解          |
| `NEW_FEATURE`         | inventory 中发现不存在但产品目标要求的新能力     |
| `INDUSTRY_SUGGESTION` | 顾问口吻、留学业务逻辑、推荐解释是否专业         |

## 后续批次执行矩阵

| batch                             | agents                                                                                            | 主要对象                         | 预期产物                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------- |
| `batch-1-applicant-web-auth`      | `design-reviewer`, `i18n-specialist`, `applicant-simulator`, `test-engineer`                      | web / auth                       | 对应 batch summary + route/capability records |
| `batch-2-applicant-ai-business`   | `ai-prompt-engineer`, `study-abroad-expert`, `applicant-simulator`, `test-engineer`               | prediction / recommendation / ai | 对应 batch summary + route/capability records |
| `batch-3-mobile`                  | `mobile-specialist`, `design-reviewer`, `i18n-specialist`, `applicant-simulator`, `test-engineer` | mobile                           | 对应 batch summary + route/capability records |
| `batch-4-admin-data-security-mcp` | `architect`, `data-model-reviewer`, `security-reviewer`, `design-reviewer`, `test-engineer`       | admin / security / mcp           | 对应 batch summary + route/capability records |
| `batch-5-forced-closure`          | `integration-checker`, `test-engineer`, `user-journey-auditor`                                    | closure                          | 对应 batch summary + route/capability records |

## 文档闭环要求

- 每个批次结束后，必须同步更新 `FULL_SURFACE_AUDIT_LOG`、`FULL_SURFACE_AGENT_REVIEW`、`MEMORY.md` 和相关模板。
- Journey 层的变更只回填摘要到 `docs/USER_JOURNEY_AUDIT_LOG.md`，不把 full-surface 明细塞进去。
- 所有发现都必须落入复用手册或 gap checklist，避免下次再次遗漏。

## Batch 1 复盘

### 已确认通过的主链

- `A1 / A2 / SJ-2` 已在 full-surface evidence root 下 fresh 复跑通过。
- capability 聚合也已同步恢复：
  - `AUTH_SESSION`
  - `ONBOARDING_RECOVERY`
  - `PROFILE_CRUD`
  - `NOTIFICATION_WEB_SYNC`
  - `RESUME_IMPORT_EXPORT`
- Batch 1 最终 aggregate：`43 PASS / 0 ISSUE / 0 BROKEN / 0 BLOCKED / 0 SKIPPED`

### 本批分诊结果

#### `CODE_BUG`

- full-surface runner 自身的小问题已直接修复：
  - stale delegated journey records 被误用
  - summary 统计把 supporting route records 算进 selected surface
  - `A1` / `SJ-2` 的导航等待策略不稳
  - guest/shared route 的 `auth/refresh` 匿名初始化噪音
  - guest/shared route 的 `/users/me -> 401` 匿名初始化噪音
  - `ranking / register` 的 React-Radix hydration warning 误报
  - `resumeId / teamId` 缺失时的 sample catalog 空洞
- Batch 1 收口后，不再保留 applicant web/auth 一阶 `CODE_BUG` route blocker。
- 本批后续又确认了 3 个真实 hydration 点并已直接修复：
  - `/profile`：profile completeness 首屏 `0 -> 100` mismatch
  - `/settings`：theme/toggle 的 `SwitchBubbleInput` hydration mismatch
  - `/:locale` applicant 入口实际落到 dashboard，欢迎语与统计区首屏 `User / 0 -> alice.zhang / 100` mismatch
- 这三条不属于 dev-only 噪音，已在产品代码中改为 hydration-safe 渲染，而不是继续扩大 runner ignore list。

#### `DATA_ISSUE`

- 原始缺口是：
  - `resumeId`
  - `teamId`
- 当前已通过 runner 内 fallback 自愈：
  - 缺 `resumeId` 时自动创建最小 resume
  - 缺 `teamId` 时优先读取 `teams/my`，再自动创建最小 public team
- 因此 Batch 1 的 data/sample gap 已收口，不再保留 `BLOCKED`。

#### `UX_CONFUSION`

- 本批没有新增 applicant web/auth 一阶 UX confusion 被修出来。
- 先前 route-level hydration / auth noise 已被确认是 dev/runtime audit 噪音，不继续计入 applicant web/auth 页面问题。

### Agent 视角下的下一轮切分

- `Batch 2`
  - applicant AI + 留学业务页面/能力开始执行
- `Batch 3`
  - mobile 全面检查继续承接跨端一致性和真机体验问题

### 可复用结论

- dynamic route 不能只靠 `:id -> 任意样例` 泛化；当前 registry/runtime 是按路由族一条条映射的。
- 已确认需要稳定样例的 web/mobile route 族，必须进入 playbook / memory：
  - `resumeId`
  - `teamId`
  - `forumPostId`
  - `chatConversationId`
  - `essayGalleryId`
  - mobile `essay/new` 作为创建流特例
- guest/shared web route 在 full-surface 审计中必须 stub 匿名 auth bootstrap，否则 public/auth 页会稳定产出假 `401 / 429`。
- React/Radix 的 `RadioBubbleInput / CheckboxBubbleInput` hydration warning，在当前仓库和 webpack dev 组合下可按 dev-only noise 处理，但只能用窄模式降噪，不能泛化忽略所有 hydration mismatch。
- 对 user-specific 首屏信息（用户名、profile completeness、theme/toggle 状态），优先做 hydration-safe 首次渲染；不要靠扩大 console ignore 覆盖真实 SSR/CSR 不一致。

## Batch 2 复盘

### 已确认通过的主链

- `A3 / A4 / A5 / A6 / A7 / A8 / A9 / A10 / SJ-1` 已在 full-surface evidence root 下完成 fresh 运行并收口。
- capability 聚合也已同步恢复：
  - `PREDICTION_RUN`
  - `RECOMMENDATION_GENERATE`
  - `AI_CHAT_MULTI_TURN`
  - `AI_LANGUAGE_SWITCH`
  - `AI_GUARDRAIL`
  - `AI_TOOL_FAILURE_RECOVERY`
  - `SCHOOL_COMPARE`
- Batch 2 最终 aggregate：`26 PASS / 0 ISSUE / 0 BROKEN / 0 BLOCKED / 0 SKIPPED`

### 本批分诊结果

#### `CODE_BUG`

- 本批没有新增已确认的 applicant AI / business 产品 blocker。
- 先前最像产品回归的两项：
  - `A3`
  - `CAPABILITY:RECOMMENDATION_GENERATE`
    已确认是审计执行链问题，不是 recommendation 后端逻辑失败。
- 直接修掉的 runner / integration 问题有：
  - web 长耗时 AI 请求默认穿 Next rewrite proxy，导致“后端 201 成功但前端 watcher 超时/500”
  - delegated journey `record.json` 写出晚于 full-surface 默认 `90s` delegation window
  - `/schools` 搜索框窄模式 hydration mismatch 被误当成稳定产品 issue

#### `DATA_ISSUE`

- 本批没有新增高优先级 data blocker。
- recommendation / prediction 运行所需 seed 数据已足够支撑 Batch 2 主链，不再保留新的 `BLOCKED(DATA_ISSUE)`。

#### `UX_CONFUSION`

- prediction / recommendation 去歧义改造已进入 Batch 2 正式结论，不再仅停留在“建议层”。
- 当前需要继续沿用的判断口径：
  - `学校整体录取率` 与 `个人预估录取概率` 必须分开表达
  - `冲刺 / 匹配 / 保底` 是选校策略，不是官方评级
  - `数据参考程度` 不能再沿用风险色语义

#### `INDUSTRY_SUGGESTION`

- Batch 2 的 AI / prediction / recommendation 文案已转向“专业留学顾问”口吻。
- 当前未发现新的高优先级行业逻辑回归；后续如果还有 recommendation/essay/timeline 体验复核，优先看专业感，而不是重复做接口正确性验证。

#### `PROCESS / HARNESS`

- 这是 Batch 2 的主结论：
  - recommendation / AI applicant surfaces 更适合 chunked execution，不适合在 full-surface 审计里长时间大批量串跑
  - outer surface summary 不能早于 delegated journey `record.json` 稳定落盘
  - recommendation/auth 页应优先真实 auth cookie bootstrap，不要依赖高频 refresh / rerun
  - 对同一 delegated journey 连续 `force-rerun` 会放大 throttling、Redis lock 和 stale evidence 污染

### Agent 视角下的下一轮切分

- `Batch 3`
  - mobile 全面检查进入 canonical full-surface 执行
- `Batch 4`
  - admin / data / security / MCP 进入 canonical full-surface 执行
- `Batch 5`
  - 在 Batch 3/4 收口后，统一做 cross-platform / journey overlay closure

### 可复用结论

- 长耗时 AI 请求在 web 端默认应优先走 direct API，而不是 Next rewrite proxy。
- delegated journey timeout 需要按 journey 类别分级，不能一刀切 `90s`。
- `/schools` 搜索框当前的 `caret-color: transparent` hydration mismatch 属于 dev-only noise；可按窄模式降噪，但不能推广成“忽略所有 hydration mismatch”。

## Batch 4 复盘

### 已确认通过的主链

- `C1 / C2 / C3 / C4 / C5 / SJ-4` 已在 full-surface evidence root 下 fresh 复跑通过。
- capability 聚合也已同步恢复：
  - `MCP_KEY_AND_TOOL_CALL`
  - `PAYMENT_SUBSCRIPTION_ENTRY`
- Batch 4 最终 aggregate：`28 PASS / 0 ISSUE / 0 BROKEN / 0 BLOCKED / 0 SKIPPED`

### 本批分诊结果

#### `CODE_BUG`

- 本批 route 层有两个明确并已修复的问题：
  - `admin/ai-operations` 把 admin-only root health endpoint 当成 `/api/v1` 路径调用，随后又因裸 fetch 缺 auth 触发 `401`
  - `admin/high-schools` 的国家翻译字典缺少 `JP / KR`
- 修复后两条 route 均已 fresh `PASS`，不再保留 Batch 4 route blocker。

#### `DATA_ISSUE`

- 本批没有新增高优先级 data blocker。
- Admin 数据页和 school data quality 页均能在当前 seed 下完成首轮运行态验证。

#### `UX_CONFUSION`

- Batch 4 没有新增需要单列的 admin UX confusion；当前主要问题都属于执行契约或 i18n 缺口，而不是用户误读。

#### `PROCESS / EXECUTION`

- `SJ-4` 当前仍通过 admin API `/admin/mcp-keys` 完成 key 创建，而不是通过不存在的 admin MCP 管理页。
- 这不是当前产品 blocker，但必须继续记在治理层：未来如果要求“admin UI 创建 key”，应把该 UI surface 明确加入 registry，而不是默认假定其存在。

### Agent 视角下的下一轮切分

- `Batch 3`
  - mobile 全面检查进入 canonical full-surface 执行
- `Batch 5`
  - 在 mobile 收口后统一做 closure、cross-platform 和 journey 摘要回填

### 可复用结论

- admin 根级健康检查类接口可能不受 `/api/v1` global prefix 管理；调用时要先确认是否需要 `skipApiVersion`。
- 对于 admin-only 的 root endpoint，不能用裸 `fetch` 替代带 auth 的 `apiClient` 调用。
- i18n 字典要覆盖页面内的常量枚举源；像 high-school 国家码这类固定数组，必须与 message keys 同步维护。

## Batch 3 复盘

### 已确认通过的主链

- Batch 3 当前已在 canonical full-surface root 下写出 `50/50` non-empty records。
- 其中 `47` 条 mobile route 已是 fresh `PASS`，包括首页、profile、AI、prediction、recommendation、schools、school detail、timeline、notifications 和其余 route family。
- 非 PASS 仅剩：
  - `A11`
  - `SJ-3`
  - `NOTIFICATION_MOBILE_SYNC`
    三者已统一收敛为同一个 Android remote push 条件 blocker。

### 本批分诊结果

#### `CODE_BUG`

- 本批没有新的 mobile 页面级一阶 `CODE_BUG` blocker。
- 先前最容易被误判成页面故障的点：
  - 无 Android device / emulator
  - dev build 未安装
  - Metro 未启动
    已确认属于执行环境前置，而不是产品逻辑问题。

#### `DATA_ISSUE`

- `MOBILE_ROUTE:/forum/:id` 一度因 `forumPostId` 缺失而 `BLOCKED(DATA_ISSUE)`。
- 当前已通过 runner sample fallback 收口：
  - 读取 forum category
  - 自动创建最小 forum post
- 因此 Batch 3 不再保留 dynamic sample 缺口作为 route blocker。

#### `UX_CONFUSION`

- `A11 / SJ-3 / NOTIFICATION_MOBILE_SYNC` 当前都不再代表“页面打不开”或“通知页不可用”。
- 真正的剩余问题是：
  - 用户在当前 Android 环境下无法完成 remote push 到达 / notification-open 的真实感知
  - 原因是 native Firebase / FCM 初始化失败
- 这类问题必须继续按 conditional capability gate 表述，不能再写成“mobile 还有通知页问题”。

#### `PROCESS / EXECUTION`

- Batch 3 的关键可复用结论是：mobile full-surface 必须先满足 3 个环境前置再跑 canonical：
  - Android emulator / device 已连接
  - `com.studyabroad.mobile` dev build 已安装
  - Metro dev client 已启动并连通
- journey overlay 在 delegated record 给出 `ISSUE`、但 surface 本身已声明 conditional external prerequisite 时，full-surface 应归一化为 `BLOCKED`。
- capability 汇总也应使用同一归一化状态，避免总表出现 `A11: BLOCKED · SJ-3: ISSUE` 这类语义漂移。

### Agent 视角下的下一轮切分

- 本轮 Batch 3 已收口，不再需要继续扩展 mobile route 扫描。
- 后续如果要继续，只剩 conditional gate 专项：
  - Android Firebase / FCM 配置
  - 真机 remote push token / delivery / open 行为

### 可复用结论

- mobile full-surface 不要在无设备状态下直接开跑；否则会把整个 Batch 3 污染成环境型 `BLOCKED`。
- dynamic route sample fallback 除了 `resumeId / teamId`，现在还应覆盖 `forumPostId`。
- remote push 条件 gate 需要和 notifications page reachability 分开记录；同一旅程里不要把“页可达”和“push 不通”揉成一个模糊 `ISSUE`。
