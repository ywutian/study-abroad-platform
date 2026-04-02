# 代码审查工作记录

**审查对象**：`fbd6095e710507c4cc9fb7a33eec62457ffa1e25`  
**审查日期**：2026-03-31  
**审查方式**：差异驱动 + 用户旅程审计 + 反馈分诊  
**状态**：已完成 23 条运行态记录回填，审计保持 open（`A11` / `SJ-3` 已在真实 Android 手机上复验，且 2026-04-02 follow-up 又在 Android emulator 上补跑了 Home / Schools / Cases / AI / Profile / Forum / Notifications；当前仅因 Android Firebase / FCM 原生配置缺失而保持 `BLOCKED`，standalone `studyabroad://` deep link 已在 dev build 下验证）

---

## 1. 审查范围与方法

- 范围：仅审查 `HEAD` 提交 `fbd6095`，不包含未跟踪目录 `scripts/eval/results/`
- 方法：
  - 先按 `CLAUDE.md` 做 triage：分类、根因、用户可见验收标准
  - 再按用户旅程追踪：注册/引导、学校对比、通知、外部 MCP 集成、case prefill 契约
  - 发现一个问题就立即记录，持续补充证据与影响范围
- 已复核：
  - `pnpm lint:all` 通过
  - `pnpm test` 通过
- 当前结论：自动化检查未覆盖本次发现的行为回归

### 当前覆盖矩阵

| 主线          | 状态       | 已覆盖区域                                                                               | 仍未完成                                                            |
| ------------- | ---------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| API / 数据层  | 部分完成   | onboarding、case 契约、prediction/history、health、mcp key / mcp server、相关 migrations | admin/report priority 深层消费者、prediction persistence 更深层行为 |
| AI Agent      | 部分完成   | MCP 暴露面、tool executor、PromptGuard / moderation 接线、LLM guarded/unguarded 调用     | memory 重构、router/fallback、admin AI ops 更深层契约               |
| Web 用户面    | 部分完成   | register/onboarding、notifications、schools compare、prediction/history                  | profile 其余表单、admin 新拆分页                                    |
| Mobile 用户面 | 部分完成   | home、schools、cases、ai、profile、forum、notifications、prediction、timeline 活跃页面   | remote push / notification-open、其余更深层 chat/team 交互          |
| Shared 契约   | 部分完成   | `DUOLINGO`、notification routes、timeline/prediction helper 漂移、部分 api-routes 消费   | scoring/types/schemas 其余消费者扫描                                |
| 治理 / CI     | 已建立证据 | `lint:all`、`lint:integration`、governance wiring、CI job 接线                           | verify-gate 对本次回归的命中率解释还需补更多实例                    |

### 2026-04-02 mobile follow-up

- 触发原因：用户在审计 follow-up 中反馈“模拟器也没有数据，AI 不能用”，因此额外对 Android emulator 做了端到端复测，而不是继续只依赖真机 push blocker 结论。
- 复测结论：
  - local API / db / redis 恢复后，Android emulator 能稳定跑通 Home、Schools、Cases、AI、Profile、Forum、Notifications。
  - mobile AI tab 的 `Analyze my profile` 已恢复为可见答案，不再出现 `HTTP 401`、`No response body` 或只剩空 assistant bubble。
  - 因此 mobile 的 formal blocker 已进一步收窄为“Android remote push / notification-open 仍缺 FCM native config”，不再是“模拟器无数据”或“AI 后端不可用”。
- 本轮 follow-up 新确认并已修复的根因：
  - local infra 一度未拉起，导致 emulator 看起来像“所有页面都没数据”；
  - `seed-all-features.ts` 写入的案例缺少 public review status，导致 `/cases` 公共列表为空；
  - `apps/mobile/src/lib/api/client.ts` 会把任何顶层 `data` 字段都误当标准 envelope 解包，直接吃掉 `/ai-agent/chat` 的 `message`；
  - React Native 这条 fetch/SSE body reader 在当前 runtime 下不稳定，mobile AI auto-mode 改成非流式 `/ai-agent/chat` 才能稳定向用户交付答案。

---

## 2. 已确认问题

| ID  | 严重性 | 类型         | 旅程/模块                           | 状态 | 摘要                                                                                                                         |
| --- | ------ | ------------ | ----------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| R1  | P1     | CODE_BUG     | MCP 外部集成                        | open | MCP tool 参数在 adapter 层被吃掉，标准客户端调用基本不可用                                                                   |
| R2  | P1     | CODE_BUG     | A1 注册 -> 首次登录 -> 引导         | open | onboarding 写 test scores 时把 `profile.id` 传给了需要 `userId` 的 service，带分数的请求会直接失败                           |
| R3  | P2     | CODE_BUG     | A1 注册 -> 首次登录 -> 引导         | open | onboarding 失败补偿会先删缓存再重试，存在数据丢失；后端写入也不是幂等                                                        |
| R4  | P2     | CODE_BUG     | 学校详情 -> 学校对比                | open | `graduationRate` / `retentionRate` 被额外乘 100，显示错误                                                                    |
| R5  | P2     | CODE_BUG     | Web 通知中心 / 通知页               | open | 点击“查看”会跳转但不会标已读                                                                                                 |
| R6  | P2     | CODE_BUG     | Mobile 通知页                       | open | 删除按钮实际上只是标已读，不会删除通知                                                                                       |
| R7  | P1     | CODE_BUG     | Case Prefill / Create Case API 契约 | open | profile/shared 已支持 `DUOLINGO`，case DTO 仍拒绝，prefill 与 create 自相矛盾                                                |
| R8  | P1     | SECURITY_BUG | MCP 外部集成 / AI Agent 安全链      | open | MCP 最小模块未引入安全模块，且直接暴露了会把自由文本送入 `chatSimple()` 的工具，导致 PromptGuard/输出审核在 MCP 路径上被绕过 |

---

## 3. 详细问题记录

### R1. MCP tool 参数在 adapter 层被吃掉

- 位置：
  - `apps/api/src/mcp-server.ts:145-155`
  - `apps/api/src/modules/ai-agent/config/tools.config.ts:154-204`
- 根因：
  - `server.tool()` 这里传入的是 MCP SDK 的“参数 shape”，不是完整对象 schema
  - 当前实现把 schema 写成 `{ args: z.record(z.unknown()).optional() }`
  - handler 又写成 `async ({ args }) =>`，并进一步取 `args?.args`
  - 结果：
    - 标准 MCP 调用 `{ schoolId: "123" }` 会被 Zod 直接剥掉，解析后变成 `{}`
    - 即便传 `{ args: { schoolId: "123" } }`，handler 中 `args?.args` 仍是 `undefined`
- 代码证据：
  - `apps/api/src/mcp-server.ts:149` schema 仅接受一个名为 `args` 的字段
  - `apps/api/src/mcp-server.ts:155` 实际执行时取的是嵌套 `args.args`
  - `apps/api/src/modules/ai-agent/config/tools.config.ts` 中各工具参数定义均为顶层字段（如 `field`, `value`, `query` 等），不是嵌套 `args`
- 用户/系统影响：
  - 管理员创建 MCP key 后，外部 MCP 客户端依然几乎无法正常调用有参工具
  - 这不是降级，是阻断：MCP server 启得起来，但参数型工具基本不可用
- 用户可见验收标准：
  - 标准 MCP 客户端调用 `get_school_details` / `search_schools` 时，顶层参数应原样传给 `toolExecutor.execute(...arguments)`

### R2. onboarding 写入 test scores 时传错了标识符

- 位置：
  - `apps/api/src/modules/profile/profile.controller.ts:173-181`
  - `apps/api/src/modules/profile/profile.service.ts:121-125`
  - `apps/api/src/modules/profile/profile-helpers.service.ts:32-46`
  - `apps/api/prisma/schema.prisma:444-447`
- 根因：
  - `completeOnboarding()` 先执行 `upsert(user.id, profileData)`
  - 随后循环 test scores 时调用的是 `this.profileService.createTestScore(profile.id, ...)`
  - 但 `ProfileService.createTestScore()` 形参语义是 `userId`
  - 继续往下会进入 `ProfileHelpersService.getProfileId(userId)`，其查询条件明确是 `where: { userId }`
  - `Profile.id` 和 `Profile.userId` 在 Prisma schema 中是两个独立字段，不是同一个值语义
- 推导结果：
  - 只要 onboarding payload 里带 testScores，就会用 `profile.id` 当 `userId`
  - `getProfileId(profile.id)` 查不到 profile 后，会尝试创建并 `connect` 到一个 id 为 `profile.id` 的 user
  - 在正常数据下，这会触发 Prisma relation/connect 错误，导致 onboarding 请求失败
- 用户/系统影响：
  - 注册页如果填了 TOEFL/IELTS/SAT/ACT 之一，onboarding 的 testScores 分支大概率直接失败
  - dashboard 的补偿 POST 也会重复走同一条错误路径
- 用户可见验收标准：
  - 注册时填写任意 test score，`POST /profiles/onboarding` 能成功完成
  - test score 正常写到当前用户 profile 下，而不是触发 relation/connect 错误

### R3. onboarding 失败补偿仍可能丢数据，且重试不幂等

- 位置：
  - `apps/web/src/app/[locale]/(auth)/register/page.tsx:187-194`
  - `apps/web/src/app/[locale]/(main)/dashboard/page.tsx:105-115`
  - `apps/api/src/modules/profile/profile.controller.ts:175-182`
  - `apps/api/src/modules/profile/profile-scores.service.ts:62-80`
- 根因：
  - 注册页已改成优先直接 POST `/profiles/onboarding`
  - 失败时把 payload 存到 `sessionStorage.pendingOnboarding`
  - dashboard 首屏补偿逻辑会先 `removeItem('pendingOnboarding')`，再发 POST
  - 如果这次请求再次失败，用户数据永久丢失
  - 更深一层的问题是后端 onboarding 写 test score 用的是 `createTestScore()` 逐条追加，没有去重 / upsert
- 额外风险：
  - 如果第一次 POST 在服务端已成功，但客户端因超时/断网进入 catch，dashboard 重试会再次追加 test scores，制造重复记录
- 用户/系统影响：
  - 同一条失败恢复链路同时存在“丢数据”和“重复数据”两种坏结果
  - 影响 A1 注册 -> 首次登录 -> 引导旅程的错误恢复能力
- 用户可见验收标准：
  - 首次 onboarding POST 失败后，只要用户后续进入 dashboard，最终能成功补写
  - 同一轮补偿重试不能生成重复 test score

### R4. 学校对比页把毕业率/留存率显示成 100 倍

- 位置：
  - `apps/web/src/app/[locale]/(main)/schools/compare/page.tsx:38-43`
  - `apps/web/src/app/[locale]/(main)/schools/compare/page.tsx:199-210`
  - `apps/web/src/app/[locale]/(main)/schools/[id]/_components/school-overview-tab.tsx:239-255`
  - `apps/web/src/lib/utils.ts:44-60`
- 根因：
  - compare 页自定义了 `pct()`，对数值执行 `(n * 100).toFixed(1) + '%'`
  - 但全站对学校百分比字段采用的是 `0-100` 语义
  - 学校详情页对同字段直接显示 `87%`
  - `formatAcceptanceRate()` 也明确兼容 `0-100` 语义
- 用户/系统影响：
  - 对比页是用户可触达的新页面，核心结论字段直接错误，影响决策
- 用户可见验收标准：
  - `graduationRate = 87` 显示 `87.0%` 或 `87%`
  - `retentionRate = 92` 显示 `92.0%` 或 `92%`

### R5. Web 通知“查看”跳转但不会标已读

- 位置：
  - `apps/web/src/app/[locale]/(main)/notifications/page.tsx:180-188`
  - `apps/web/src/app/[locale]/(main)/notifications/page.tsx:223-226`
  - `apps/web/src/components/features/notifications/notification-center.tsx:149-153`
  - `apps/web/src/components/features/notifications/notification-center.tsx:185-188`
- 根因：
  - 卡片容器点击时会执行 `onRead()`
  - 内部 “查看” 链接调用 `e.stopPropagation()`
  - 结果是“点卡片空白处”会已读，“点最自然的查看入口”反而不会已读
- 用户/系统影响：
  - Header badge 和真实阅读状态脱节
  - 问题同时存在于顶部通知中心和完整通知页
- 用户可见验收标准：
  - 用户点“查看”后正常跳转，同时该条通知和未读计数同步更新

### R6. Mobile 通知删除按钮是假删除

- 位置：
  - `apps/mobile/src/app/notifications.tsx:179-185`
  - `apps/mobile/src/hooks/useNotifications.ts:253-279`
  - `apps/api/src/modules/notification/notification.controller.ts:72-89`
- 根因：
  - 页面上的删除操作 `handleDelete()` 直接调用 `markAsRead(id)`
  - hook 没有 `deleteNotification()` mutation
  - 后端实际已经实现了 `DELETE /notifications/:id` 和 `DELETE /notifications`
- 代码迹象：
  - 页面里已有注释明确承认“如果以后接入 dedicated delete endpoint，再来这里调用”
- 用户/系统影响：
  - UI 用的是垃圾桶和“删除”语义，实际行为是已读确认，和用户心智完全不一致
- 用户可见验收标准：
  - 点击垃圾桶后，通知从列表移除
  - 未读计数同步减少

### R7. `DUOLINGO` 在 case prefill/create 契约上只接了一半

- 位置：
  - `apps/api/src/modules/profile/dto/test-score.dto.ts:13-23`
  - `packages/shared/src/types/profile.ts:28-38`
  - `apps/api/src/modules/case/dto/create-case.dto.ts:29-34`
  - `apps/api/src/modules/case/case-query.service.ts:306-312`
- 根因：
  - profile DTO、shared type、前端 test score 常量都已支持 `DUOLINGO`
  - `case-query.service` 的 prefill 会把 profile test scores 原样映射出去
  - 但 `CaseTestScoreDto` 仍只接受 `SAT/ACT/TOEFL/IELTS/AP/IB`
- 影响判定：
  - 当前仓库里暂未搜到 web/mobile 对 `/cases/prefill` 的直接消费者
  - 因此它更准确是“新公共 API 契约已自相矛盾”，不是已确认打断现有前端主路径的 bug
- 用户/系统影响：
  - 任意未来接入 `/cases/prefill -> POST /cases` 的客户端都会在 `DUOLINGO` 上撞 400
- 用户可见验收标准：
  - profile 中已有 `DUOLINGO` 时，prefill 返回值可直接提交到 create case，不需要手工删字段

### R8. MCP 路径绕过了 AI 安全链

- 位置：
  - `apps/api/src/mcp-server.ts:141-160`
  - `apps/api/src/mcp-server.ts` 中 `McpAppModule` imports/provider 列表
  - `apps/api/src/modules/ai-agent/providers/provider.module.ts:20-49`
  - `apps/api/src/modules/ai-agent/core/llm.service.ts:276-309`
  - `apps/api/src/modules/ai-agent/config/tools.config.ts:333-353`
  - `apps/api/src/modules/ai-agent/config/tools.config.ts:553-569`
  - `apps/api/src/modules/ai-agent/tools/essay-tools.service.ts:329-383`
  - `apps/api/src/modules/ai-agent/tools/timeline-tools.service.ts:75-136`
- 根因：
  - MCP server 直接把 `TOOLS` 注册为外部可调用工具，并直接调用 `toolExecutor.execute(...)`
  - `McpAppModule` 只导入了 `LLMProvidersModule.forRoot()`，没有导入 `AgentSecurityModule`
  - `LLMService` 对 `PromptGuardService` 是 `@Optional()` 注入；没有安全模块时，`chatSimpleGuarded()` 会静默退化为 `chatSimple()`
  - 这条路径上还直接暴露了接受自由文本的 LLM 工具，比如：
    - `generate_outline(prompt, background, wordLimit)`
    - `create_timeline(targetSchools, startDate)`
  - 这些工具内部调用的是 `llmService.chatSimple(...)`，不是受保护版本
  - MCP adapter 最后把 `result.result` 直接 `JSON.stringify` 返回给客户端，没有经过 `ContentModerationService`
- 推导结果：
  - 正常 WebSocket / HTTP agent 流程里，输入和输出至少部分经过 PromptGuard / 内容审核
  - 但 MCP 路径绕开了这条安全主链，等于新开了一条“有认证但无 AI 安全护栏”的入口
- 用户/系统影响：
  - 持有有效 MCP key 的客户端可以直接把任意自由文本送进 LLM-backed 工具
  - 这不仅是功能问题，也是安全边界不一致：同一平台对 AI 输入/输出的安全约束，在 MCP 路径上失效
- 用户可见验收标准：
  - MCP 路径下，所有接受用户自由文本的 LLM 工具都应具有与主 AI 路径一致的输入防护
  - MCP 返回的 LLM 生成内容不能绕过既有的输出审核策略

---

## 4. 流程与覆盖率缺口

### P-GAP-1. 新用户可见旅程未同步登记到旅程审计体系

- 证据：
  - `docs/USER_JOURNEY_AUDIT_LOG.md` 现有记录主要覆盖 2026-03-29 的 AI Agent 审计
  - 本次提交新增或显著改动了以下用户可见/外部可见旅程，但未见新审计 section：
    - 学校对比页
    - Web 通知页与通知中心
    - Mobile 通知页
    - Admin 创建 MCP key -> 外部 MCP 客户端使用
- 影响：
  - 2026-03-29 的“100% 覆盖”不再适用于当前 `fbd6095`
  - 本次提交存在真实用户旅程变更，但未被新的旅程审计记录覆盖

### P-GAP-2. 自动化测试未覆盖本次发现的问题

- 已确认未覆盖：
  - `apps/api/src/mcp-server.ts` 无对应测试
  - onboarding 中 `profile.id` / `user.id` 错参无测试
  - onboarding 补偿重试与幂等性无测试
  - schools compare 百分比格式化无测试
  - Web 通知“查看即已读”无测试
  - Mobile 通知真删除无测试
  - case prefill 与 create 对 `DUOLINGO` 的契约一致性无测试
- 已存在但不足的测试示例：
  - `apps/api/src/modules/profile/profile.controller.spec.ts:195-214` 只断言 onboarding 会调用 `upsert()`，未覆盖 testScores 写入、错参、重试和幂等性
  - `apps/api/src/modules/notification/notification.controller.spec.ts:109-121` 只验证后端 delete 端点存在，未覆盖 mobile 页面是否实际调用 delete

### P-GAP-3. CI 声称在跑 governance blocking check，但很多新规则根本没接入

- 证据：
  - `scripts/governance/index.ts` 已注册的规则包括：
    - `page-loading-coverage`
    - `api-route-shared-constants`
    - `error-boundary-coverage`
    - 以及多条 frontend/backend coverage 规则
  - 但 `scripts/check-integration.ts` 的 `DOMAINS.governance` 只包含 5 条：
    - `optional-security`
    - `nl-endpoint-coverage`
    - `config-consistency`
    - `user-data-isolation`
    - `dead-provider`
  - `lint:integration` 的 `ALL_RULES` 直接由 `DOMAINS` 展开，因此未列入 `DOMAINS` 的 governance 规则即使存在，也不会在 `lint:integration` 或 CI 里执行
  - CI 中的 “Governance check (blocking)” 实际运行的是 `pnpm lint:integration --domain=governance`
- 影响：
  - 工作流和文案会给人“治理规则已阻断”的错觉，但多条新加规则实际上是未接线状态
  - 这能解释为什么 compare / notifications / route-contract 这类改动并未从当前 blocking governance path 获益

## 5. 已排除 / 待证实项

### H1. Mobile `notificationService` 仍用 `PUT` 调已读接口，但当前未发现消费者

- 位置：
  - `apps/mobile/src/lib/api/services/notification.ts:7-8`
  - `apps/api/src/modules/notification/notification.controller.ts:52-69`
- 事实：
  - service 层仍用 `PUT`
  - backend controller 定义的是 `POST`
  - 当前仓库内未搜到 `notificationService.*` 的直接消费者；活跃路径走的是 `useNotifications`，它使用 `POST`
- 结论：
  - 这是已确认的契约漂移，但尚未证实现有用户路径受影响
  - 暂记为 hypothesis，不计入 confirmed finding

### H2. `timelineRoutes.personal/global` 与后端 controller 漂移，但当前未发现活跃消费者受影响

- 位置：
  - `packages/shared/src/constants/api-routes.ts:131-136`
  - `apps/api/src/modules/timeline/timeline.controller.ts:87-149`
- 事实：
  - shared helper 仍导出 `/timelines/personal` 与 `/timelines/global`
  - backend controller 实际暴露的是 `/timelines/personal-events` 与 `/timelines/global-events`
  - 当前活跃 mobile timeline 页面直接调用的是正确端点 `/personal-events` / `/global-events`
  - 当前 web 侧只看到了 `timelineRoutes.taskToggle()` 的活跃消费者，没有看到 `timelineRoutes.personal()` / `global()` 的活跃调用方
- 结论：
  - 这是新 shared helper 与 backend controller 的契约漂移
  - 目前更像“未消费的坏 helper”，暂不记为 confirmed finding

### H3. 审计中发现的 mobile 旧路由债务，当前不计入 `fbd6095` regression set

- 位置：
  - `apps/mobile/src/screens/prediction/PredictionScreen.tsx:86-88`
  - `apps/mobile/src/app/security.tsx:64-66`
  - `apps/mobile/src/app/security.tsx:154-156`
  - `apps/api/src/modules/prediction/prediction.controller.ts:106-129`
  - `apps/api/src/modules/auth/auth.controller.ts:264-359`
- 事实：
  - mobile prediction 页面仍向 `/predictions/report-result` 发请求，但 backend 实际只有 `PATCH /predictions/:schoolId/result`
  - mobile security 页面仍调 `/users/me/password` 与 `/auth/logout-all`，而 backend 实际暴露的是 `POST /auth/change-password`，且没有 `logout-all` 端点
  - `git diff HEAD^ HEAD` 显示这次提交在这些文件里主要是把部分硬编码路由换成 shared constants；错误端点语义并不是由本次提交新引入
- 结论：
  - 这些是活跃用户路径上的真实旧债，但不应混入本次 `fbd6095` 的 confirmed regression set
  - 已记录为审计中的 scope spillover，后续如做 mobile 契约专项审计应单独立项

---

## 6. 当前循环探索日志

### Loop 1

- 目标：确认最初 4 个 review findings 是否成立
- 结果：全部成立，并补充发现 Mobile 通知删除假动作、Web 通知“查看不已读”、onboarding 重试幂等性风险

### Loop 2

- 目标：按 `CLAUDE.md` 核对旅程覆盖与测试覆盖
- 结果：
  - 确认新旅程未登记到 `docs/USER_JOURNEY_AUDIT_LOG.md`
  - 确认现有自动化测试未覆盖上述回归
  - 修正判断：`DUOLINGO` 问题目前是 API 契约断裂，尚未证实现有前端主流程消费

### Loop 3

- 目标：继续下钻 onboarding 链路，确认是否只有补偿逻辑有问题
- 结果：
  - 确认 `completeOnboarding()` 在写 test scores 时传错了标识符：把 `profile.id` 传给了需要 `userId` 的 service
  - 这使得“注册时填写了考试分数”的用户会在更早阶段就撞到失败，不需要等到补偿重试才暴露

### Loop 4

- 目标：审计 `AI Agent` 重构后的安全主链，确认 MCP 是否只存在参数桥接问题
- 结果：
  - 确认正常 AI 路径里 PromptGuard / 内容审核仍然接在主链上
  - 确认 MCP 最小模块未引入 `AgentSecurityModule`
  - 确认 MCP 直接暴露了接受自由文本的 LLM-backed 工具，且这条路径没有等价的输入/输出安全护栏

### Loop 5

- 目标：核对 governance/CI 的实际门禁 wiring，而不是只看规则文件是否存在
- 结果：
  - 确认 CI 的 blocking governance check 只运行了 5 条治理规则
  - 确认多条本次新增 governance 规则未被 `lint:integration` 接入
  - 确认 `mobile` 侧仍有至少一处 service-level 路由方法漂移，但当前未发现真实消费者，暂不记为 finding

### Loop 6

- 目标：区分“本次提交新增/放大的问题”和“审计时顺手翻出来的旧债”
- 结果：
  - 确认 Web prediction 结果回报路径是正确的 `PATCH /predictions/:schoolId/result`，所以这条旅程在 web 侧不构成本次问题
  - 确认 mobile assessment 页面改成 shared constants 后与 backend 仍然一致，不构成新的 route regression
  - 确认 `timelineRoutes.personal/global` 是 shared helper 层的新契约漂移，但当前未发现活跃消费者
  - 确认 mobile prediction/security 中仍有活跃坏路由，但证据显示它们在本次提交前已经存在，因此单列到 hypothesis / excluded，不混入本次 regression set
  - 已同步把 2026-03-31 的旅程审计状态写入 `docs/USER_JOURNEY_AUDIT_LOG.md`，明确当前仍未达到大型变更所需的全量覆盖率

## 7. 2026-03-31 全量运行态执行日志

### 7.1 环境 gate 与执行介质

- `HEAD` 已确认是 `fbd6095`。
- Web / API / Admin 旅程全部基于本地真实运行中的应用完成，不依赖 staging。
- 审计账号矩阵实际可用：`admin@example.com`、`demo@example.com`、`alice.zhang@demo.studyabroad.com` 及新注册 fresh applicant。
- iOS 模拟器在当前会话中无法连接 `CoreSimulatorService`，因此 A11/SJ-3 按计划降级到 Android。
- Android runtime 已能真实到达 Home / Profile / Prediction / Notifications；随后又用 USB 连接的真实 Android 手机和独立 Android dev build 补完了 production `studyabroad://timeline` deep-link 验证。
- SJ-4 已使用真实 admin 账号创建 MCP key，并完成 live key / rejection / free-text guard 路径的本地重跑。

### 7.2 运行态结果计数

| 状态    | 数量 |
| ------- | ---- |
| PASS    | 18   |
| ISSUE   | 0    |
| BROKEN  | 0    |
| BLOCKED | 2    |
| SKIPPED | 3    |

### 7.3 23 条旅程结果矩阵

| ID   | 状态    | 证据                                              | 关键结论                                                                                                         |
| ---- | ------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A1   | PASS    | `e2e-report/journeys-2026-03-31/A1/record.json`   | 注册 / onboarding 恢复链已修复并重跑通过                                                                         |
| A2   | PASS    | `e2e-report/journeys-2026-03-31/A2/record.json`   | profile 全 CRUD 与回显通过                                                                                       |
| A3   | PASS    | `e2e-report/journeys-2026-03-31/A3/record.json`   | 推荐页生成通过                                                                                                   |
| A4   | PASS    | `e2e-report/journeys-2026-03-31/A4/record.json`   | 文书单轮通过                                                                                                     |
| A5   | PASS    | `e2e-report/journeys-2026-03-31/A5/record.json`   | 时间线单轮通过                                                                                                   |
| A6   | PASS    | `e2e-report/journeys-2026-03-31/A6/record.json`   | 5+ turns 多轮对话已重跑通过                                                                                      |
| A7   | PASS    | `e2e-report/journeys-2026-03-31/A7/record.json`   | 中英文切换通过                                                                                                   |
| A8   | PASS    | `e2e-report/journeys-2026-03-31/A8/record.json`   | 越界问题通过                                                                                                     |
| A9   | PASS    | `e2e-report/journeys-2026-03-31/A9/record.json`   | 工具失败恢复单轮通过                                                                                             |
| A10  | PASS    | `e2e-report/journeys-2026-03-31/A10/record.json`  | prediction/history/cases/ranking 通过                                                                            |
| A11  | BLOCKED | `e2e-report/journeys-2026-03-31/A11/record.json`  | mobile core flows 与 standalone `studyabroad://` deep link 已在真机通过，剩余 blocker 是 Firebase / FCM 未初始化 |
| B1   | SKIPPED | `e2e-report/journeys-2026-03-31/B1/record.json`   | 无 parent persona 入口                                                                                           |
| B2   | SKIPPED | `e2e-report/journeys-2026-03-31/B2/record.json`   | 无 parent persona 入口                                                                                           |
| B3   | SKIPPED | `e2e-report/journeys-2026-03-31/B3/record.json`   | 无 parent persona 入口                                                                                           |
| C1   | PASS    | `e2e-report/journeys-2026-03-31/C1/record.json`   | admin dashboard 通过                                                                                             |
| C2   | PASS    | `e2e-report/journeys-2026-03-31/C2/record.json`   | AI ops 通过                                                                                                      |
| C3   | PASS    | `e2e-report/journeys-2026-03-31/C3/record.json`   | 用户管理 / AI 使用通过                                                                                           |
| C4   | PASS    | `e2e-report/journeys-2026-03-31/C4/record.json`   | 内容审核通过                                                                                                     |
| C5   | PASS    | `e2e-report/journeys-2026-03-31/C5/record.json`   | 学校数据质量页通过                                                                                               |
| SJ-1 | PASS    | `e2e-report/journeys-2026-03-31/SJ-1/record.json` | 学校对比通过                                                                                                     |
| SJ-2 | PASS    | `e2e-report/journeys-2026-03-31/SJ-2/record.json` | web 通知中心 / 通知页通过                                                                                        |
| SJ-3 | BLOCKED | `e2e-report/journeys-2026-03-31/SJ-3/record.json` | 通知页 delete/read/unread sync 已通过，剩余 blocker 是 Firebase / FCM 未初始化                                   |
| SJ-4 | PASS    | `e2e-report/journeys-2026-03-31/SJ-4/record.json` | MCP live key / rejection / free-text guard 已重跑通过                                                            |

## 8. 本轮实际 regression set 与 scope spillover

### 8.1 本轮运行态 confirmed set

- `A11` / `SJ-3` `BLOCKED`
  - mobile startup blocker 已解除，Android Expo runtime 已实际到达 Home、Profile、Prediction、Timeline 与 Notifications。
  - 通知页 delete / mark-all-as-read / unread-count sync 已真实跑通，Home badge 也已回落到 `0`。
  - 独立 Android dev build 已在 USB 连接的真实手机上验证 production `studyabroad://timeline` 能落到 `com.studyabroad.mobile` 的真实 Timeline 页面。
  - 当前唯一剩余 blocker 已从“介质不足”收敛为原生配置缺失：真机上的 `Notifications.getExpoPushTokenAsync` 直接报 `Default FirebaseApp is not initialized in this process com.studyabroad.mobile`。
  - 根因是 Android Firebase / FCM native config 尚未补齐，`apps/mobile/android/app/google-services.json` 缺失；虽然 `apps/mobile/android/app/build.gradle` 与 `apps/mobile/android/build.gradle` 已准备好 Google Services 插件，但没有实际 Firebase 配置文件可供初始化。
  - 直接证据见 `e2e-report/journeys-2026-03-31/A11/06-real-device-push-blocker.png`、`e2e-report/journeys-2026-03-31/A11/push-limitations.txt`、`e2e-report/journeys-2026-03-31/SJ-3/push-limitations.txt` 与相关截图。

### 8.2 不进入本次 runtime regression set 的项

- `A1`、`A6`、`SJ-4`
  - 已完成代码修复并在本轮真实重跑通过。
  - 它们不再进入当前 runtime blocker set，但对应修复仍保留在本次代码改动与证据目录中。
- `B1-B3`
  - 本轮实际再次尝试进入 parent 角色后，正式记为 `SKIPPED`。
  - 这说明 active registry 与 live product 不一致，但不是 `fbd6095` 造成的用户可见回归。
- 旧的 compare / web notifications / case 契约 concern
  - `SJ-1`、`SJ-2`、`A10` 已在本轮实际重跑通过。
  - 因此这些点当前不进入本轮 runtime blocker set；若后续再次复现，再单独升级。

### 8.3 2026-04-02 user-driven follow-up 暴露出的漏检检查点

- 触发原因
  - 在已写入“mobile core flows 已通过 emulator follow-up”之后，用户继续指出了 profile 布局、学校图标来源、Swipe Game 崩溃、Swipe Game 结果反馈设计几类问题。
  - 这些问题说明此前的 A11 follow-up 更偏向“页面能打开、数据能回来”，但对视觉正确性、二级入口和瞬时反馈层的检查还不够。
- 本次确认的漏检点
  - `M-A11-1` Profile 布局完整性
    - 初次 follow-up 只确认了 Profile 页能加载用户数据，却漏掉了 completion ring 文案被圆环压住、标题区留白失衡等布局问题。
    - 这类问题不会让 API 或运行态报错，但对用户可见体验是明确缺陷。
  - `M-A11-2` 学校品牌图标来源与 fallback
    - 初次 follow-up 只确认了 Schools / Find College / School Detail 等页能拿到学校数据，却没有核对 mobile 是否真的复用了统一的 school logo 来源。
    - 后续确认 mobile 多处只是把裸 `logoUrl` 直接塞给 `Avatar`，没有走按学校 `website` 域名兜底的统一逻辑。
    - 影响面包括 Home Top Schools、Schools、School Detail、Find College、Case Detail、Custom Ranking。
  - `M-A11-3` Home quick action 二级入口覆盖不足
    - 初次 follow-up 覆盖了 Home / Schools / Cases / AI / Profile / Forum / Notifications，但没有继续打开 Swipe Game。
    - 后续由用户指出后复现：`Swipe Game` 在 `GameView` 中把 `/halls/swipe/batch` 的 `{ cases, meta }` 响应错当成数组展开，直接触发 `iterator method is not callable`。
  - `M-A11-4` 瞬时反馈层与 i18n 插值未纳入检查
    - 即便 Swipe Game 崩溃修掉后，如果不继续检查预测后的 overlay，仍会漏掉 `Actual: {{result}}: admitted` 这种 i18n 模板/手工拼接混用问题。
    - 同时，结果 overlay 之前还是一整块大面积浅色底板，只承载极少信息，视觉层级明显失衡；这属于设计质量问题，不是简单的 copy bug。
- 结论
  - 因此“2026-04-02 emulator 上 mobile core flows 通过”这句话，只能解释为核心数据链与主要页面恢复可用，不能再被当成“mobile 视觉与交互层已经收口”。
  - 上述 4 个漏检点已在后续 user-driven follow-up 中复现、修复并重新运行验证，但它们也暴露出原审计 checklist 不够细。

### 8.4 后续 A11 / SJ-3 必补 checklist

- 对每个已打开的 mobile 页面，不只看“有数据”，还要额外检查：
  - 布局是否在真实 seed 数据下发生重叠、遮挡、压字、留白失衡。
  - 品牌资产是否来自统一来源，并在主图缺失时有正确 fallback。
  - 至少一个页面内瞬时反馈态是否实际触发并复核，例如 toast、result overlay、error banner、badge 变化。
- Home 页面不能只验 5 个 tab，还必须额外点开至少 1 个 quick action 二级入口；本轮已证明 Swipe Game 就藏着独立契约崩溃。
- 学校相关页面必须把“logo provenance / fallback correctness”列成单独检查点，不能再被归入“学校数据已加载”。
- Profile 页面必须把“进度/圆环/长文本组合布局”列成单独检查点，不能只看字段值是否存在。
- 任何带 i18n 模板插值的反馈层，都至少要在真实运行中采一张结果态截图，避免再次漏掉 `{{result}}` 之类的模板残留。

## 9. Stop Condition 检查

| 检查项                                     | 结果                |
| ------------------------------------------ | ------------------- |
| `19` 条主旅程 + `4` 条子旅程全部有非空状态 | 是                  |
| 每条 record 都有证据路径                   | 是                  |
| 是否仍有空白条目                           | 否                  |
| 是否仍存在 `BLOCKED`                       | 是，`A11` 与 `SJ-3` |
| 整轮审计是否可宣布完成                     | 否                  |

### 剩余动作

1. 补齐 Android Firebase / FCM 配置，把有效的 `google-services.json` 放到 `apps/mobile/android/app/google-services.json`，然后重建并安装真机 dev build。
2. 将 parent persona 是否退出 active registry 的治理决策同步到后续审计模板，避免未来继续把 `B1-B3` 作为活动旅程追踪。

## 10. 2026-04-02 gate classification follow-up

- 这轮后续治理没有改变 mobile 的真实技术现状：
  - `A11`、`SJ-3` 仍然缺少 Android FCM native config
  - `apps/mobile/android/app/google-services.json` 仍不存在
  - 真 remote push / notification-open 仍未被实际打通
- 变化的是门禁分类语义：
  - Android remote push 已在注册表中登记为 `conditional capability gate`
  - 因此 `A11 / SJ-3` 继续保留 `BLOCKED` 记录，但它们不再自动拖住整轮 release gate 到 `HOLD`
  - live gate `live-2026-04-01-gate` 已刷新为 `CONDITIONAL`
- 新的收口标准：
  - 核心 mobile runtime、页面级行为和跨端一致性继续作为主门禁
  - Android remote push 单独作为条件能力跟踪，待未来引入真实 Firebase / FCM 配置后再收口

## 11. 2026-04-02 Web / Admin live gate 补充复核

- 触发原因
  - 在 live gate 已降为 `CONDITIONAL` 之后，还需要回答“当前 web 端是否已经全部 fresh 复核”这个问题，不能只依赖 2026-03-31 的旧 evidence root。
- 实际补跑范围
  - `SJ-1`
  - `C2`
  - `C3`
  - `C4`
  - `C5`
  - 执行命令：
    - `pnpm exec tsx scripts/runtime-journey-audit.ts --audit-id live-2026-04-01-gate --audit-context 'release gate live-2026-04-01-gate' --evidence-root e2e-report/releases/live-2026-04-01-gate/journeys --journeys C2,C3,C4,C5,SJ-1 --force-rerun`
- 复核结果
  - 上述 5 条旅程在当前 live 环境 fresh 重跑全部 `PASS`。
  - `C2-C5` 的 fresh records 已写入 `pageResponseStatus = 200` 与目标 `finalUrl`，因此此前 `runtime-issues.md` 里“admin 子路由可能只是截图命中壳子、实际仍有 404”的语义级疑点已被清除。
  - `SJ-1` 也已在同一 evidence root 下补跑通过，因此 applicant web / admin web / MCP 当前没有剩余 runtime blocker。
- 当前 blocker set 更新
  - 截至本次补充复核，release gate 的剩余 blocker 只来自 mobile：
    - `A11`
    - `SJ-3`
  - 两者也都不是 web/admin regression，而是 Android remote push 条件能力未解锁。
- 直接证据
  - `e2e-report/releases/live-2026-04-01-gate/journeys/SJ-1/record.json`
  - `e2e-report/releases/live-2026-04-01-gate/journeys/C2/record.json`
  - `e2e-report/releases/live-2026-04-01-gate/journeys/C3/record.json`
  - `e2e-report/releases/live-2026-04-01-gate/journeys/C4/record.json`
  - `e2e-report/releases/live-2026-04-01-gate/journeys/C5/record.json`
  - `/tmp/live-2026-04-01-gate/runtime-issues.md`
