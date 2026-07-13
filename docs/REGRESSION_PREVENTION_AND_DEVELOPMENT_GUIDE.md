# 企业级防回归与开发指南

> 本文是执行入口：把最近 Git 历史、返工模式、质量门禁和日常开发动作连成一套流程。它不替代
> [ANTI_CHURN_PLAYBOOK.md](ANTI_CHURN_PLAYBOOK.md)、[TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)
> 或 [RELEASE_GATE_ONE_PAGER.md](RELEASE_GATE_ONE_PAGER.md)，而是告诉开发者“这次改动该跑哪些防回归动作”。

## 1. 最近 Git 历史告诉我们的事

### 1.1 统计口径

默认窗口采用最近 90 天 Git 历史：

| 项目       | 口径                                                                                   |
| ---------- | -------------------------------------------------------------------------------------- |
| 时间范围   | 2026-03-31 到 2026-06-25                                                               |
| 提交数     | 457 commits                                                                            |
| 数据来源   | `git log --since="90 days ago"`、`scripts/churn-report.ts`、`scripts/git-dashboard.ts` |
| 默认可视化 | `pnpm git:dashboard`                                                                   |

> 本仓库要求 Node 20 与 `pnpm@10.22.0`。如果本地命令意外触发 pnpm 11 或 Node 24 的依赖处理，先切换运行时，再做验证。

### 1.2 主要变更重心

90 天窗口内的高频 scope：

| Scope               | 提交数 | 说明                                               |
| ------------------- | ------ | -------------------------------------------------- |
| `prediction`        | 109    | 预测、评分、顾问引擎、校准与输出治理是长期主战场。 |
| `dashboard`         | 30     | 仪表盘和工作台多次重排，容易出现 UI/数据契约返工。 |
| `web`               | 29     | Web 页面、i18n、状态与错误展示频繁变化。           |
| `timeline`          | 17     | 最近集中补齐日期、任务、deadline、scheduler 语义。 |
| `deps` / `deps-dev` | 19     | zod、knip、Node、Vercel 构建环境曾反复摇摆。       |

最近 80 个提交的主题簇：

| 主题簇                          | 数量 | 代表风险                                                 |
| ------------------------------- | ---- | -------------------------------------------------------- |
| timeline / deadlines            | 20   | 日期滚动、UTC、Rolling round、SQL 与 mapper 口径不同步。 |
| prediction / scoring            | 17   | 校准、空态、错误态、shared scoring 口径漂移。            |
| deps / build / guardrails       | 16   | 本地、CI、Vercel、Docker 依赖与 Node 版本不一致。        |
| cron / monitoring / reliability | 12   | 重复执行、缺锁、claim 时机、heartbeat 缺失。             |
| security / contracts            | 3    | IDOR、签名比较、DTO validation、滥用边界。               |

### 1.3 Churn 指标

`scripts/churn-report.ts` 的定义：同一代码文件在 14 天内被再次编辑，则后一次改动计入 rework。

| 窗口  | Churn | 状态 | 需要怎么读                                                                    |
| ----- | ----- | ---- | ----------------------------------------------------------------------------- |
| 30 天 | 22.6% | 高   | 最新返工集中在 timeline、prediction 页面、application analysis、essay/cases。 |
| 60 天 | 24.7% | 高   | prediction、dashboard、schema 与多个 Web 工作台持续被重摸。                   |
| 90 天 | 27.3% | 高   | 长窗口暴露出 prediction/dashboard/schema 的系统性反复。                       |

结论：这不是“多写几行测试”能单点解决的问题。默认流程必须把需求澄清、设计选择、契约测试、运行时门禁和事故闭环都前移。

## 2. 变更类型防回归矩阵

| 变更类型                    | 历史信号                                                                 | 必守 invariant                                                                                                                   | PR 前必须覆盖                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| timeline / deadline         | #436 到 #449 连续修复日期滚动、状态、任务、提醒和 IDOR                   | 用户看到的 deadline 口径必须和 scheduler、SQL 查询、API mapper 一致；日期计算使用 UTC 边界；`Rolling` 输入必须归一为 `ROLLING`。 | API 单元测试覆盖 read-time 与 scheduler-time；涉及 UI 时覆盖空态、load-error、编辑/删除任务；涉及移动端时同步 enum picker 与 i18n。      |
| cron / reliability          | 多个 cron 先后补 single-flight lock、durable change detection、heartbeat | 任何可能并发触发或外部重复触发的 job 必须有 `withCronLock` 或等价单飞锁；claim 只在成功后发生；失败要可见。                      | 覆盖 lock acquired / skipped / failure / retry；确认 Redis TTL 常量命名清楚；生产监控 job 必须发 heartbeat。                             |
| prediction / scoring        | 90 天内 `prediction` 109 commits，shared scoring 从 0% 补到高覆盖        | scoring、shared types、API response 与 Web/Mobile consumer 必须用同一事实源；空结果和错误不能渲染空白列。                        | `packages/shared` scoring tests；相关 API/service spec；Web 空态/错误态测试或手动证据；必要时跑 `prediction:smoke` / `prediction:gate`。 |
| deps / build                | zod 3/4、knip、Vercel typecheck、Node 版本反复修正                       | 本地、CI、Vercel、Docker 固定在 Node 20；lockfile 冻结； contested deps 的版本选择由 ADR 和 `lint:dep-pins` 决定。               | `pnpm install --frozen-lockfile --ignore-scripts`；`pnpm lint:dep-pins`；依赖决策变更必须同步 ADR-0021；不要在无关 PR 中 `pnpm dedupe`。 |
| auth / security / contracts | 未验证邮箱登录、IDOR、constant-time compare、DTO hardening               | 用户身份、资源归属、签名比较、输入上限和 DTO validation 都必须 fail closed；用户可恢复的 auth 边界不能变成硬阻断。               | Auth/service spec；负例测试覆盖 401/403/invalid signature/foreign resource；DTO 字段有 validator 和长度上限；Web copy 覆盖中英。         |
| UI / i18n / layout          | prediction、dashboard、hero、workbench 多次返工                          | 大改布局先写 design note；用户可见文本走 i18n；失败态、加载态、空态不能靠布局碰运气。                                            | `pnpm --filter web lint:i18n`；`pnpm --filter web lint:quality`；关键页面截图或 Playwright smoke；超过 1 天的布局变更保留 invariant。    |
| schema / seed / data        | `schema.prisma` 与 seed 文件高 churn，历史上有 migration drift           | schema、migration、seed、verify 脚本必须同步；不要用 `db push` 代替可审计 migration。                                            | Prisma generate；migration drift/safety；seed parity；涉及学校事实时跑 school facts verify。                                             |

## 3. 日常开发流程

### 3.1 开工前

先问四件事，答案写进 PR design note 或 ADR：

1. 这次是否超过 1 天、改布局、改架构、改数据契约、改依赖版本？
2. 有没有一个“不确定能不能工作”的点？有就开 spike，限时回答一个问题，再把结论带回正式 PR。
3. 是否触碰 shared types、API route、Prisma schema、cron、auth/security、i18n 或 release gate registry？
4. 如果这次是修 bug，防止它回来的资产是什么：test、lint、ADR、runbook，至少选一个。

默认规则：

- 非平凡 PR 必须有 `Problem / Options / Decision / Invariant`。
- 第三次写同类逻辑时才抽象，且三个调用点必须有同一个 reason to change。
- 依赖、运行时、schema、security 的决策不能只藏在代码里，必须可被文档或脚本复查。

### 3.2 编码中

把防回归动作做在代码旁边：

| 场景                      | 动作                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 新增字段或 response shape | 搜索 Web、Mobile、API、shared consumer；类型放 shared 时同步导出。                                                |
| read-time 计算值          | 搜索是否有 cron、SQL `where`、aggregate、dashboard 或 notification 使用同一值；非展示 consumer 需要时优先持久化。 |
| 新增 cron/job             | 使用 `withCronLock` 或等价锁；补 TTL 常量；定义 skipped、failed、succeeded 观测信号。                             |
| 新增 mutation             | 先证明 resource ownership；测试 foreign user、missing auth、invalid id。                                          |
| 新增用户可见状态          | 至少覆盖 loading、empty、error、success；错误态必须给 retry 或可恢复路径。                                        |
| 改 i18n                   | 同步 `en` / `zh`，避免只改一端；移动端 locale 单独检查。                                                          |
| 改依赖                    | 先解释为什么现有版本不够，再改 package 和 lockfile； contested deps 需要 ADR 同步。                               |

### 3.3 PR 前基础门禁

按从便宜到昂贵的顺序跑：

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter api db:generate
pnpm exec tsx scripts/verify-gate.ts --pre-push --verbose
pnpm lint:coverage-ratchet
pnpm lint:audit-gate
pnpm lint:dep-pins
pnpm lint:deploy-drift
pnpm lint:seed-parity
```

如果当前 shell 不是 Node 20 / pnpm 10.22.0，先修环境。不要为了让本地通过而放宽 `engines`、删除 frozen lockfile、降低 coverage floor 或关闭 audit gate。

### 3.4 按影响面加专项门禁

| 影响面                          | 加跑                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| API route / client route helper | `pnpm lint:routes`                                                                                              |
| Web i18n                        | `pnpm --filter web lint:i18n`                                                                                   |
| Web UI / layout                 | `pnpm --filter web lint:quality`，必要时 `pnpm test:e2e:web`                                                    |
| Mobile                          | `pnpm --filter study-abroad-mobile lint:quality`，`pnpm --filter study-abroad-mobile lint:i18n`，相关 Jest 测试 |
| Shared scoring/types            | `pnpm --filter @study-abroad/shared test`，下游 API/Web/Mobile typecheck                                        |
| Prediction                      | `pnpm prediction:smoke`，必要时 `pnpm prediction:gate` 和 counselor/gold-case 脚本                              |
| Prisma migration                | `pnpm exec tsx scripts/check-migration-safety.ts --new-only`，CI 中还会跑 migrate diff                          |
| Release-facing flow             | `pnpm release-gate:generate --release-id <id> --candidate-version <version> --environment pre-release`          |
| Full surface audit              | `pnpm full-surface:generate --audit-date YYYY-MM-DD`                                                            |

### 3.5 修复后闭环

任何回归修复 PR 都要留下一个“以后会挡住它”的资产：

| 回归类型                  | 最低闭环资产                                                 |
| ------------------------- | ------------------------------------------------------------ |
| 纯逻辑 bug                | 单元测试或 contract test                                     |
| UI 空白、错误态、跳转失败 | component test、Playwright smoke 或 release journey evidence |
| cron 重复/漏发            | scheduler spec + lock/claim/failure 分支                     |
| 依赖/构建返工             | `lint:dep-pins`、ADR 或 CI guard                             |
| schema/seed 漂移          | migration safety、seed parity、school facts verify           |
| 文档/流程误用             | runbook 或 README 索引更新                                   |

没有闭环资产的 bugfix 默认不完整，除非 PR 明确写出为什么无法自动化，以及谁负责人工验证。

## 4. 角色使用方式

| 角色          | 怎么用这份文档                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 开发者        | 开 PR 前按变更类型选门禁；修 bug 时用第 3.5 节补闭环资产。                                                                                                     |
| Reviewer      | 先看 invariant 和 test plan 是否覆盖历史风险，再看代码细节。                                                                                                   |
| Release owner | 用第 2 节判断本轮是否需要 release gate、full-surface 或人工体验补位。                                                                                          |
| 新人          | 先读本页，再回到 [CONTRIBUTING.md](../CONTRIBUTING.md)、[ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) 和 [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)。 |

## 5. 例外处理

- 可以跳过某个门禁，但必须在 PR 中写明：跳过原因、风险、替代验证、后续补偿动作。
- 不能跳过的底线：high/critical audit gate、frozen lockfile、resource ownership/security 负例、schema migration safety。
- 不能用 `--no-verify`、降低 coverage、放宽 audit、删除 tests 的方式“修 CI”。这类操作必须独立成治理 PR，并说明为什么原门禁过时。

## 6. 相关文档

- [ANTI_CHURN_PLAYBOOK.md](ANTI_CHURN_PLAYBOOK.md)：为什么会返工，以及大型工程组织怎么把思考前移。
- [SECURITY_DEPS.md](SECURITY_DEPS.md)：依赖安全、audit gate、override 和 GHSA ignore 规则。
- [RELEASE_GATE_ONE_PAGER.md](RELEASE_GATE_ONE_PAGER.md)：发版门禁执行入口。
- [QA_RELEASE_GATE_SOP.md](QA_RELEASE_GATE_SOP.md)：AI-first 发版门禁 SOP。
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md)：测试体系与 release gate 资料入口。
- [docs/adr/0021-dependency-version-pinning.md](adr/0021-dependency-version-pinning.md)：依赖版本钉死与构建环境一致性决策。
