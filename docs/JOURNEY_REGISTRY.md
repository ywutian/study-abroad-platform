# 发版门禁旅程注册表

> 本文件是发版门禁的人类可读注册表。
> 运行时机器可读事实源在 `scripts/release-gate/registry.ts`；后续脚本和自动生成逻辑以该文件为准。

## 1. 注册表元信息

| 字段                  | 值                                          |
| --------------------- | ------------------------------------------- |
| `registry_version`    | `2026-04-01.v3`                             |
| `owner`               | Release / QA                                |
| `default_environment` | shared pre-release                          |
| `status_set`          | `PASS / ISSUE / BROKEN / BLOCKED / SKIPPED` |

## 2. 状态定义

| registry_status   | 含义                                 |
| ----------------- | ------------------------------------ |
| `active`          | 日常发版门禁可直接纳入               |
| `inactive`        | 当前不属于活动旅程，不纳入默认门禁   |
| `temporary-child` | 子旅程，已登记但未升格为主注册表编号 |

## 3. 外部前置能力 / Capability Gates

以下能力不是“产品主代码自动具备”，而是依赖外部配置或第三方前置。缺少这些前置时，旅程必须记为 `BLOCKED`（外部依赖），不得误记为“启动崩溃”或“页面完全不可用”。

| journey_id | capability scope                             | blocking policy | 缺失时标准判法                                                                                                                     | 解锁条件                                                                                                 |
| ---------- | -------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `A11`      | Android remote push / 真机 notification-open | `conditional`   | mobile 核心页面、deep link、跨端语义可单独验证；默认不作为核心 mobile runtime 放行阻塞项，但必须在记录里显式保留为条件能力 blocker | 放入有效 `apps/mobile/android/app/google-services.json`，重建 Android 真机 dev build，再在连接真机上重跑 |
| `SJ-3`     | 真 remote push 到达 / 通知打开行为           | `conditional`   | 通知列表、未读数、删除、已读等页面级行为可单独验证；默认不作为通知页核心页面级放行阻塞项，但必须显式保留为条件能力 blocker         | 放入有效 `apps/mobile/android/app/google-services.json`，重建 Android 真机 dev build，再在连接真机上重跑 |

## 4. Baseline Smoke 固定清单

以下旅程是每次 release 默认都要跑的最小集合。除非 release owner 书面豁免，否则不得跳过。

| journey_id | 标题                               | 原因                             |
| ---------- | ---------------------------------- | -------------------------------- |
| `A1`       | 注册 → 首次登录 → onboarding 恢复  | 覆盖身份、会话、首次激活         |
| `A2`       | 填写档案                           | 覆盖 profile CRUD 和核心用户数据 |
| `A3`       | AI 首次选校推荐                    | 覆盖 applicant 主 AI 能力        |
| `A10`      | 预测 / 案例库 / 排名               | 覆盖核心业务数据检索与结果页     |
| `A11`      | 移动端一致性                       | 覆盖移动端基础可用性             |
| `C1`       | admin Dashboard                    | 覆盖高权限基础入口               |
| `SJ-2`     | Web 通知中心 / 通知页              | 覆盖通知读取与状态变化           |
| `SJ-4`     | Admin 创建 MCP key → 外部 MCP 调用 | 覆盖外部集成与高风险边界         |

## 5. Active Set

| journey_id | registry_status   | 标题                               | persona        | 平台    | default_execution_owner | validation_type | baseline_smoke | full_audit_default | 重点质量维度       | 备注                                                                                                   |
| ---------- | ----------------- | ---------------------------------- | -------------- | ------- | ----------------------- | --------------- | -------------- | ------------------ | ------------------ | ------------------------------------------------------------------------------------------------------ |
| `A1`       | `active`          | 注册 → 首次登录 → onboarding 恢复  | applicant      | web     | `codex`                 | `objective`     | yes            | yes                | 布局、专业感       | 首次激活链路                                                                                           |
| `A2`       | `active`          | 填写档案                           | applicant      | web     | `codex`                 | `objective`     | yes            | yes                | 布局、专业感       | 包含 GPA/标化/活动/奖项/推荐信                                                                         |
| `A3`       | `active`          | AI：首次选校推荐                   | applicant      | web     | `codex`                 | `objective`     | yes            | yes                | AI 输出、专业感    | 推荐 agent 主入口                                                                                      |
| `A4`       | `active`          | AI：文书评审 / 润色                | applicant      | web     | `codex`                 | `objective`     | no             | yes                | AI 输出、专业感    | essay agent                                                                                            |
| `A5`       | `active`          | AI：时间线规划                     | applicant      | web     | `codex`                 | `objective`     | no             | yes                | AI 输出、专业感    | timeline agent                                                                                         |
| `A6`       | `active`          | AI：5+ 轮多轮对话                  | applicant      | web     | `codex`                 | `objective`     | no             | yes                | AI 输出、专业感    | memory / orchestration                                                                                 |
| `A7`       | `active`          | AI：中英文切换                     | applicant      | web     | `codex`                 | `objective`     | no             | yes                | AI 输出、专业感    | 双语一致性                                                                                             |
| `A8`       | `active`          | AI：越界问题                       | applicant      | web     | `codex`                 | `objective`     | no             | yes                | AI 输出、专业感    | safety boundary                                                                                        |
| `A9`       | `active`          | AI：错误恢复                       | applicant      | web     | `codex`                 | `objective`     | no             | yes                | AI 输出            | tool failure / recovery                                                                                |
| `A10`      | `active`          | 预测 / 案例库 / 排名               | applicant      | web     | `codex`                 | `objective`     | yes            | yes                | 专业感、布局       | 核心业务结果面                                                                                         |
| `A11`      | `active`          | 移动端一致性                       | applicant      | mobile  | `codex + human`         | `experiential`  | yes            | yes                | 跨端、布局、专业感 | 移动端核心运行态与 Android remote push 分开判；remote push 默认作为 `conditional capability gate` 跟踪 |
| `C1`       | `active`          | admin Dashboard                    | admin          | web     | `codex`                 | `admin-only`    | yes            | yes                | 布局、专业感       | 高权限基础入口                                                                                         |
| `C2`       | `active`          | AI Operations → LLM Calls          | admin          | web     | `codex`                 | `admin-only`    | no             | yes                | 布局               | AI 运维页                                                                                              |
| `C3`       | `active`          | 用户管理 → AI 使用                 | admin          | web     | `codex`                 | `admin-only`    | no             | yes                | 布局               | 使用明细与管理                                                                                         |
| `C4`       | `active`          | 内容审核 → 举报处理                | admin          | web     | `codex`                 | `admin-only`    | no             | yes                | 布局、专业感       | moderation                                                                                             |
| `C5`       | `active`          | 学校数据质量                       | admin          | web     | `codex`                 | `admin-only`    | no             | yes                | 布局               | data quality                                                                                           |
| `SJ-1`     | `temporary-child` | 学校详情 → 学校对比                | applicant      | web     | `codex`                 | `objective`     | no             | yes                | 专业感、布局       | 与 A10 紧邻                                                                                            |
| `SJ-2`     | `temporary-child` | Web 通知中心 / 通知页              | applicant      | web     | `codex`                 | `objective`     | yes            | yes                | 布局、专业感       | web 通知主子旅程                                                                                       |
| `SJ-3`     | `temporary-child` | Mobile 通知页                      | applicant      | mobile  | `codex + human`         | `experiential`  | no             | yes                | 跨端、真机体验     | 列表/未读/删除可单独验；真 push/open 默认作为 `conditional capability gate` 跟踪                       |
| `SJ-4`     | `temporary-child` | Admin 创建 MCP key → 外部 MCP 调用 | admin/external | api+mcp | `codex`                 | `objective`     | yes            | yes                | AI 输出、专业感    | 外部集成高风险链路                                                                                     |

## 6. Inactive Set

以下旅程保留历史记录，但默认不纳入日常发版门禁。

| journey_id | registry_status | 标题                       | 当前状态                    | 重新激活条件                          |
| ---------- | --------------- | -------------------------- | --------------------------- | ------------------------------------- |
| `B1`       | `inactive`      | 家长注册 → 中文界面 → 进度 | 产品无 parent persona 入口  | 产品重新引入 parent role / entrypoint |
| `B2`       | `inactive`      | 家长 AI：中文问学费 / 签证 | 产品无 parent persona 入口  | 产品提供 parent AI 入口               |
| `B3`       | `inactive`      | 家长查看选校列表和录取概率 | 产品无 parent-child linking | 产品提供 parent-child linkage         |

## 7. 使用规则

- 所有 release gate 必须引用本文件中的 `registry_version`。
- 如需修改运行时行为，先更新 `scripts/release-gate/registry.ts`，再同步本文件。
- 如需把旅程移入或移出 active set，必须在本文件修改并在审计日志中记录治理变更。
- `Baseline Smoke` 以本文件第 4 节为准，不允许临场改写。
- 旅程如声明了外部前置能力，门禁总表和审计记录必须显式写明“缺什么前置、因此哪一部分仍为 `BLOCKED`”。
- `blocking_policy = conditional` 的能力默认不拖住核心 release gate，但必须在总表、handoff 和审计 section 中保留为条件能力结论。
- 子旅程 `SJ-*` 升格或下线前，必须先更新本文件，再更新 SOP/模板。
