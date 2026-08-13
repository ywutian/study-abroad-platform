# 功能变更文档 / Feature Change Document

<!-- section:change-identity -->

## 1. 变更身份 / Change Identity

| 字段              | 内容                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Change ID         | FEEDBACK-CLOSURE-2026-08-12                                                                          |
| 标题              | 用户反馈、归档 Bug 与存量技术债最终关闭                                                              |
| 类型              | Bug 修复 / 技术债清理 / 文档对账                                                                     |
| 产品/项目         | Study Abroad Platform monorepo                                                                       |
| 请求人 / 决策人   | [REQUESTER] 仓库所有者                                                                               |
| 优先级 / 目标日期 | [REQUESTER] 全量完成；2026-08-12                                                                     |
| 来源文档          | `docs/USER_FEEDBACK_ANALYSIS_2026-08-05.md`、`docs/CODE_REVIEW.md`、`docs/USER_JOURNEY_AUDIT_LOG.md` |
| 状态              | Closed                                                                                               |

<!-- section:executive-summary -->

## 2. 一页摘要 / Executive Summary

- 问题：[REQUESTER] 归档 Markdown 中登记了用户可见 Bug、技术债和历史条件阻断，需要确认修复范围并合入 `main`。
- 业务/用户结果：[CODE] 用户反馈表中的 17 条可执行项全部关闭；积分产品保持关闭；代码质量门禁可重复执行。
- 拟议方案：[DECISION] 以原始记录为事实来源，补齐代码、测试和文档闭环；历史记录保留，不把外部配置或产品未开放状态伪装成软件 Bug。
- 成功衡量：[RUNTIME] `lint:all`、全量测试、构建、diff 校验均通过，反馈表无 open 行。

<!-- section:current-state -->

## 3. 当前状态与证据 / Current State and Evidence

[CODE] 来源反馈表登记 17 条可执行反馈，当前 triage 状态均为 `done`，resolution 表均为 fixed/decided/shipped。[CODE] `docs/CODE_REVIEW.md` 的旧总览仍写 85%，与当前权限、API 和产品结构不符，已在本次关闭中纠正。[CODE] 用户旅程日志仍保留 Android remote push、家长 persona 等历史/条件记录，它们不是当前反馈表中的未修复代码 Bug。

<!-- section:target-outcome -->

## 4. 目标行为 / Target Behavior

[REQUESTER] 将网站修复与技术债清理汇总到可合并状态；所有归档 Bug 有代码或决策证据；积分系统继续不可用且未来开放步骤有文档；不能完成的外部能力明确标注边界。

<!-- section:scope -->

## 5. 范围 / Scope

### In scope

- [REQUESTER] 2026-08-05 用户反馈 17 项及其回归证据。
- [REQUESTER] 超大文件拆分、CardTitle 字号、移动端语义状态、API 重复结构、历史脚本类型债务。
- [REQUESTER] 积分关闭闸门与未来开放 runbook。
- [CODE] 仓库 Markdown 中与上述事项直接相关的状态对账。

### Out of scope

- [DECISION] 部署生产环境、写入生产数据库或开启积分系统。
- [CODE] 需要真实 Firebase/FCM 项目凭据的 Android remote push 交付。
- [DECISION] 已明确 wontfix 的家长 persona，以及预测/数据治理长期计划。

<!-- section:users-permissions -->

## 6. 用户、角色与权限 / Users, Roles, and Permissions

[CODE] 影响 Web、Mobile、API、Browser Extension 与管理员界面。论坛组队写入受 VERIFIED/ADMIN 权限保护；管理端设置和历史积分兑换继续受管理员权限保护；积分用户能力在产品总闸门关闭时不可达。

<!-- section:user-flows -->

## 7. 用户流程与状态 / User Flows and States

[CODE] 用户反馈涉及 Prediction、Dashboard、Forum、Tindermatch、Case Library 与 Timeline 的正常、空、错误、禁用和响应式状态。[CODE] 积分关闭时入口隐藏、直达显示未开放、用户 API 返回中性值；未来开放、验证与回滚见 `docs/runbooks/points-economy-launch.md`。

<!-- section:requirements -->

## 8. 功能与非功能需求 / Requirements

| ID      | 需求                                                        | 优先级 | 来源/证据   |
| ------- | ----------------------------------------------------------- | ------ | ----------- |
| FR-001  | 关闭反馈表 17 条可执行用户问题并保留逐项状态                | Must   | [REQUESTER] |
| FR-002  | 积分系统保持关闭，未来开放具备双闸门步骤和回滚说明          | Must   | [REQUESTER] |
| NFR-001 | 全仓 lint、测试、构建与质量 ratchet 不回退                  | Must   | [REQUESTER] |
| NFR-002 | 拆分大文件与重复结构，并降低显式 `any` 与脚本类型债务       | Must   | [REQUESTER] |
| NFR-003 | 历史审计、外部能力阻断和产品决策不得被误报为已部署 Bug 修复 | Must   | [CODE]      |

<!-- section:acceptance -->

## 9. 验收标准 / Acceptance Criteria

| ID     | 映射需求        | Given / When / Then                                                          | 可见结果             | 持久化/系统结果                    |
| ------ | --------------- | ---------------------------------------------------------------------------- | -------------------- | ---------------------------------- |
| AC-001 | FR-001          | Given 来源反馈表，When 对照代码与回归证据，Then 17 条均为 done/fixed/decided | 无 open 反馈行       | 修复与测试可追踪                   |
| AC-002 | FR-002          | Given 产品闸门为 false，When 用户或管理员访问积分面，Then 用户积分能力不开放 | 入口隐藏或未开放状态 | 无新积分记账；历史兑换仍可安全处理 |
| AC-003 | NFR-001,NFR-002 | Given 当前工作树，When 运行全量门禁、测试与构建，Then 全部命令退出 0         | 无质量错误           | ratchet 不回退                     |
| AC-004 | NFR-003         | Given 历史 Markdown，When 检索 BLOCKED/ISSUE，Then 条件能力与产品决策单列    | 不误导为当前网站 Bug | 原始证据保留                       |

<!-- section:technical-impact -->

## 10. 技术与数据影响 / Technical and Data Impact

- 仓库/服务/模块：[CODE] API、Web、Mobile、Browser Extension、shared、质量脚本与文档。
- API/事件/共享合同：[CODE] 响应类型、DTO、通知可见性、积分总闸门和公共 presentation helper 收敛。
- 数据模型/迁移/回填：[CODE] 本批不要求生产迁移或回填；历史积分账本保留。
- 配置/Feature Flag/Secret：[CODE] `POINTS_ECONOMY_AVAILABLE=false`；真实 FCM 配置未纳入仓库。
- 第三方服务/成本/配额：[CODE] 未启用新的付费服务。
- 向后兼容/版本关系：[CODE] 保留旧 API/历史账本必要兼容，不恢复已退役 UI。

<!-- section:nonfunctional -->

## 11. 安全、隐私与质量属性 / Security, Privacy, and Quality

[CODE] 权限守卫、设置键保护、通知过滤、依赖漏洞 gate、响应类型与移动端可访问语义纳入检查。私人未跟踪草稿不进入提交；生产 secret 不创建、不记录。

<!-- section:observability -->

## 12. 可观测性与运营 / Observability and Operations

[CODE] 依赖安全、文件大小、显式 `any`、路由漂移、journey、seed freshness、cron manifest 和 gate proofs 均由仓库脚本持续检查。[CODE] 积分开放后的负余额、重复记账、退款失败与兑换积压监控属于开放前置条件。

<!-- section:test-plan -->

## 13. 测试计划 / Test Plan

| 层级                  | 场景/映射 AC  | 环境/Provider/设备                   | 证据                            | Owner |
| --------------------- | ------------- | ------------------------------------ | ------------------------------- | ----- |
| Unit                  | AC-001,AC-002 | 本地 Node/Jest/Vitest                | `pnpm test`                     | Codex |
| Integration/Contract  | AC-001,AC-003 | monorepo quality gates               | `pnpm lint:all`                 | Codex |
| E2E/Real path         | AC-001        | 既有 fixture-backed Full UI evidence | 来源反馈表 closure verification | Codex |
| Manual quality review | AC-004        | Markdown 与 Git 状态检查             | 本文及最终汇总                  | Codex |

<!-- section:rollout -->

## 14. 发布、迁移与回滚 / Rollout, Migration, and Rollback

- 发布顺序/灰度/Flag：[DECISION] 本次仅合并到 `main`，不部署；积分闸门保持 false。
- 前置条件：[RUNTIME] lint、测试、构建通过，提交不含私人草稿。
- 回滚触发：[DECISION] 合并后门禁回退或用户反馈复现。
- 回滚方式与不可逆影响：[CODE] 使用普通 Git revert；无生产数据写入，无不可逆影响。
- 观察窗口和成功条件：[DECISION] 后续部署由发布流程另行执行；本次不声称生产验证。

<!-- section:risks-dependencies -->

## 15. 依赖与风险 / Dependencies and Risks

| 项目                      | 类型       | 影响                                    | 缓解措施                                                       | Owner                |
| ------------------------- | ---------- | --------------------------------------- | -------------------------------------------------------------- | -------------------- |
| Android Firebase/FCM 配置 | Dependency | 无法在本仓库内完成真实 remote push 验收 | 保持 conditional capability gate；由移动发布负责人提供真实配置 | Mobile release owner |
| 生产部署尚未执行          | Risk       | 本地修复不等于生产已生效                | 合并后走独立部署和生产验收                                     | Release owner        |
| 积分用户中心尚未重建      | Dependency | 积分不能开放                            | 保持产品总闸门关闭并遵循 runbook                               | Product owner        |

<!-- section:open-decisions -->

## 16. 决策、假设与未决问题 / Decisions, Assumptions, and Open Questions

| 状态         | 内容                                               | 是否阻塞                 | Owner                | 截止/验证方式                    |
| ------------ | -------------------------------------------------- | ------------------------ | -------------------- | -------------------------------- |
| [DECISION]   | 本次只合并，不部署、不开放积分                     | No                       | Requester            | 本次请求                         |
| [DECISION]   | 家长 persona 维持历史 wontfix 决策                 | No                       | Product owner        | `docs/USER_JOURNEY_AUDIT_LOG.md` |
| [UNRESOLVED] | Android remote push 需要真实 Firebase/FCM 项目配置 | No（不阻塞网站代码合并） | Mobile release owner | 真机 push delivery/open 验收     |

<!-- section:implementation-plan -->

## 17. Codex 实施计划 / Codex Implementation Plan

[CODE] 盘点工作树和来源 Markdown；逐条核对代码与测试；纠正失真状态；运行全量门禁、测试和构建；排除无关未跟踪草稿；在当前 `main` 提交全部已验证变更；复核分支与工作树。

<!-- section:implementation-summary -->

## 18. 实施结果 / Implementation Summary（Closure）

| Requirement | 修改的文件/合同/迁移/Commit                                       | 实际行为                                                           | 偏差                                                 |
| ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- |
| FR-001      | 来源反馈表、Web/API/Mobile 回归文件                               | 17 条反馈全部关闭                                                  | None                                                 |
| FR-002      | shared product gate、points/settings/notification、launch runbook | 积分保持 dormant，历史兑换可处理                                   | 用户积分中心未开放，符合范围                         |
| NFR-001     | package scripts、quality gates、tests                             | 全量门禁可重复运行                                                 | 生产验收未运行                                       |
| NFR-002     | API/Web/Mobile helpers 与拆分组件                                 | 大文件、重复结构、字号/语义状态和类型债务得到收敛并受 ratchet 约束 | 仓库仍保留受 baseline 约束的历史规模，不声称零代码量 |
| NFR-003     | `docs/CODE_REVIEW.md` 与本文                                      | 当前 Bug、历史记录、外部条件边界分离                               | None                                                 |

<!-- section:verification -->

## 19. 验证证据 / Verification Evidence（Closure）

| AC     | 结果 | 测试/人工检查                                                  | 证据路径/运行 ID                            | 边界                                     |
| ------ | ---- | -------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| AC-001 | PASS | 反馈表逐项状态与来源代码核对                                   | `docs/USER_FEEDBACK_ANALYSIS_2026-08-05.md` | 仅 C1′/T1 有既有生产测量，其余为本地验收 |
| AC-002 | PASS | points/notification/settings tests + gate inspection           | points specs 与 launch runbook              | 未开启产品                               |
| AC-003 | PASS | `pnpm lint:all`; `pnpm test`; `pnpm build`; `git diff --check` | 本地 2026-08-12 run                         | 不含部署                                 |
| AC-004 | PASS | Markdown open/blocker 检索与代码复核                           | 本文、`docs/CODE_REVIEW.md`、journey log    | FCM 条件能力仍待外部配置                 |

- 清理结果：未启动持久服务；未写生产数据；无关 `未命名文件夹/` 未纳入 Git。
- 剩余风险：真实 Firebase/FCM remote push 与生产部署均需各自负责人后续执行。

<!-- section:release-decision -->

## 20. 合并与发布结论 / Merge and Release Decision（Closure）

- 实施结论：CLOSED
- 合并准备度：PASS
- 发布准备度：NOT CLAIMED
- 未执行项：生产部署、生产全量复测、Android remote push 真机验收、积分开放。
- 下一责任人/动作：Codex 提交到当前 `main`；Release owner 决定后续 push/deploy。
