# 功能变更文档 / Feature Change Document

<!-- section:change-identity -->

## 1. 变更身份 / Change Identity

| 字段              | 内容                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------ |
| Change ID         | PRODUCTION-RELEASE-CLOSURE-2026-08-12                                                |
| 标题              | 归档问题修复的生产发布闭环                                                           |
| 类型              | 发布 / 数据库迁移对账 / 生产验收                                                     |
| 产品/项目         | Study Abroad Platform monorepo                                                       |
| 请求人 / 决策人   | [REQUESTER] 仓库所有者                                                               |
| 优先级 / 目标日期 | [REQUESTER] 立即执行；2026-08-12                                                     |
| 来源文档          | `docs/USER_FEEDBACK_ANALYSIS_2026-08-05.normalized.md`；[REQUESTER] 2026-08-12“你来” |
| 状态              | Implementing                                                                         |

<!-- section:executive-summary -->

## 2. 一页摘要 / Executive Summary

- 问题：[CODE] 本地 `main` 已包含全部修复并通过门禁，但比 `origin/main` 超前 5 个提交；push 会自动执行生产迁移和 GCP 部署。5 月历史审计曾记录仓库缺失 `20260428120000_add_mbti_and_personality_tags`，因此必须用当前生产数据库证据重新对账，不能把过期阻塞直接带入发布。
- 业务/用户结果：[REQUESTER] 安全推送已验证修复，并完成迁移、部署及生产健康验收。
- 拟议方案：[DECISION] 通过短生命周期、私有且必须 IAM 鉴权的 Cloud Run 服务，对 `database-url` 与 `database-url-proxy` 两条生产连接执行只读迁移清单/校验和与 pending migration 前置条件对账；禁止猜写 SQL 或绕过 Prisma 历史；门禁通过后才推送并监控部署。
- 成功衡量：[RUNTIME] 两条生产连接指向同一数据库且迁移清单一致；历史目标当前不存在、没有校验和冲突；唯一 pending migration 的生产前置条件通过；发布门禁退出 0、GitHub CI/迁移/部署成功、生产健康检查通过且积分仍关闭。

<!-- section:current-state -->

## 3. 当前状态与证据 / Current State and Evidence

[CODE] `main` 位于 `eac77a6b`，比 `origin/main` 超前 5 个提交；仅私人 `未命名文件夹/` 和本发布文档保持未跟踪。[CODE] `.github/workflows/ci.yml` 在 `main` push 后先运行 build/e2e/security，再构建镜像、执行 `apps/api/migrate.sh` 和 `prisma migrate deploy`，最后部署 Cloud Run。[RUNTIME] 只读取证 run `31674059594` 证明 `database-url:latest` 与 API 实际使用的 `database-url-proxy:latest` 均连接 `study_abroad/public`，各有 131 条原始迁移记录且清单完全一致；两边都没有历史目标 `20260428120000_add_mbti_and_personality_tags`。[RUNTIME] 与仓库按名称和 SHA-256 对账后无共同迁移校验和不一致，唯一 repo-only migration 是 `20260811120000_application_timeline_cycle_history`；run `31674204209` 证明生产尚无 `applicationYear`、旧唯一索引存在且按回填公式计算的重复组/多余行均为 0。

<!-- section:target-outcome -->

## 4. 目标行为 / Target Behavior

[REQUESTER] Codex 自主完成可信迁移证据查找、当前生产对账、pending migration 兼容验证、提交、推送、部署监控和生产验收；任何无法证明安全的数据操作必须停止并报告，不得以“代码测试通过”替代生产数据库门禁。

<!-- section:scope -->

## 5. 范围 / Scope

### In scope

- [REQUESTER] 只读搜索本机 Git、归档、GitHub、GCP/Cloud Run/Artifact Registry 的历史构件，并以当前生产数据库为最终事实来源。
- [CODE] 对账两条生产连接、仓库迁移名/校验和与 pending migration 前置条件，并运行发布门禁。
- [REQUESTER] 推送 `main`、监控自动迁移/部署并执行生产健康验收。

### Out of scope

- [DECISION] 猜写迁移 SQL、`prisma db push`、未经证据的 `migrate resolve` 或 baseline。
- [DECISION] 开启积分系统；`POINTS_ECONOMY_AVAILABLE` 必须保持 `false`。
- [CODE] Android FCM 真机推送配置是独立条件能力，不阻塞网站发布。

<!-- section:users-permissions -->

## 6. 用户、角色与权限 / Users, Roles, and Permissions

[CODE] GitHub push 与 GCP 发布使用当前已授权的仓库/云端身份；不输出 token、数据库 URL 或 Secret Manager 内容。生产用户数据不被读取或修改，除 CI 中仓库已定义且通过门禁的 Prisma 迁移和幂等 seed 外。

<!-- section:user-flows -->

## 7. 用户流程与状态 / User Flows and States

[CODE] 发布流程按“历史证据搜索 → 当前生产迁移清单/校验和对账 → pending migration 兼容验证 → 提交 → push → CI → 迁移 → 部署 → 健康验收”执行。任一数据库对账、兼容门禁或 CI 失败即停止；部署失败由既有 workflow 回滚机制处理，Codex 保留失败证据并修复后重试。

<!-- section:requirements -->

## 8. 功能与非功能需求 / Requirements

| ID      | 需求                                                                           | 优先级 | 来源/证据   |
| ------- | ------------------------------------------------------------------------------ | ------ | ----------- |
| FR-001  | 以当前生产数据库为事实来源完成迁移清单/校验和及 pending migration 前置条件对账 | Must   | [CODE]      |
| FR-002  | 门禁通过后推送 `main` 并完成自动部署监控                                       | Must   | [REQUESTER] |
| FR-003  | 部署后验证生产健康和关键修复可达                                               | Must   | [REQUESTER] |
| NFR-001 | 不猜写、绕过或破坏生产迁移历史                                                 | Must   | [DECISION]  |
| NFR-002 | 不泄露凭据、不提交私人草稿、不开放积分                                         | Must   | [CODE]      |

<!-- section:acceptance -->

## 9. 验收标准 / Acceptance Criteria

| ID     | 映射需求       | Given / When / Then                                                                                                                                               | 可见结果              | 持久化/系统结果                                                    |
| ------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| AC-001 | FR-001,NFR-001 | Given 两条生产连接和仓库迁移，When 对账数据库身份、迁移名/校验和及 pending migration 前置条件，Then 连接一致、共同迁移无校验和冲突且 pending migration 可安全执行 | 取证 run 和摘要可审计 | 不恢复当前生产历史中不存在的旧迁移；保留唯一合法 pending migration |
| AC-002 | FR-002,NFR-002 | Given 本地发布门禁通过，When push `main`，Then GitHub build/e2e/security/迁移/部署全绿                                                                            | CI 状态成功           | `origin/main` 包含发布提交                                         |
| AC-003 | FR-003         | Given 部署完成，When 调用生产健康和关键公开路径，Then 返回有效成功结果                                                                                            | 网站/API 可达         | Cloud Run 新版本健康                                               |
| AC-004 | NFR-002        | Given 发布后，When 检查积分闸门和 Git 状态，Then 积分关闭且私人目录未提交                                                                                         | 无积分入口开放        | `POINTS_ECONOMY_AVAILABLE=false`                                   |

<!-- section:technical-impact -->

## 10. 技术与数据影响 / Technical and Data Impact

- 仓库/服务/模块：[CODE] Git 历史、Prisma migrations、GitHub Actions、GCP Cloud Run、Artifact Registry。
- API/事件/共享合同：[CODE] 本次不新增 API 合同；发布既有 5 个提交。
- 数据模型/迁移/回填：[CODE] 自动部署按既有 `migrate.sh` 执行 `20260811120000_application_timeline_cycle_history`：为 `ApplicationTimeline` 增加并回填 `applicationYear`，建立新周期唯一键和查询索引后移除旧唯一键；生产预检确认无回填冲突。
- 配置/Feature Flag/Secret：[CODE] 使用既有 GitHub/GCP 凭据；不读取或记录 secret 值；积分总闸门保持 false。
- 第三方服务/成本/配额：[CODE] 可能产生常规 CI、Artifact Registry 和 Cloud Run 构建/部署成本。
- 向后兼容/版本关系：[CODE] `applicationYear` 的数据库默认值保证旧新 Cloud Run revision 重叠时旧代码仍可写入；新代码显式写入周期年份。

<!-- section:nonfunctional -->

## 11. 安全、隐私与质量属性 / Security, Privacy, and Quality

[DECISION] 当前生产中不存在的历史目标不得因旧文档而补入仓库；生产数据库不接受手工 SQL、猜测 baseline 或直接 schema push。Git hook secret scan、全仓质量门禁和 CI security job 保持强制；私人未跟踪目录继续排除。

<!-- section:observability -->

## 12. 可观测性与运营 / Observability and Operations

[CODE] 使用 GitHub Actions job 状态、Cloud Run migration execution、部署健康检查、Cloud Run revision 状态和生产 `/health` 作为证据。失败时保存 run URL、job 名和失败步骤，不输出敏感日志内容。

<!-- section:test-plan -->

## 13. 测试计划 / Test Plan

| 层级                  | 场景/映射 AC  | 环境/Provider/设备                    | 证据                                                         | Owner |
| --------------------- | ------------- | ------------------------------------- | ------------------------------------------------------------ | ----- |
| Unit                  | AC-001,AC-004 | 本地 shell/Git                        | 生产/仓库迁移名与 SHA-256 对账、常量和暂存清单               | Codex |
| Integration/Contract  | AC-001,AC-002 | 私有 Cloud Run + 本地 Prisma/monorepo | 生产只读预检、migration diff/deploy、`lint:all`、tests/build | Codex |
| E2E/Real path         | AC-002,AC-003 | GitHub Actions + GCP production       | CI、migration、deploy、health run                            | Codex |
| Manual quality review | AC-003        | 生产公开路径                          | HTTP 状态与响应合同抽检                                      | Codex |

<!-- section:rollout -->

## 14. 发布、迁移与回滚 / Rollout, Migration, and Rollback

- 发布顺序/灰度/Flag：[DECISION] 当前生产对账和 pending migration 预检通过后提交并 push `main`；既有 workflow 自动迁移和 canary 部署；积分 flag 不变。
- 前置条件：[DECISION] 两条生产连接清单一致、共同迁移无校验和冲突、pending migration 无数据冲突、本地发布门禁通过、Git/GCP 身份可用。
- 回滚触发：[CODE] CI、migration job、canary 或 post-promote health 任一失败。
- 回滚方式与不可逆影响：[CODE] workflow 保存上一 Cloud Run revision并包含回滚；数据库迁移新增列、回填并替换唯一索引，不执行删除业务行。生产预检和本地数据库门禁必须在 push 前通过。
- 观察窗口和成功条件：[DECISION] workflow 完成后立即验证 health 与关键路径；无失败 job、无迁移异常、积分仍关闭。

<!-- section:risks-dependencies -->

## 15. 依赖与风险 / Dependencies and Risks

| 项目                   | 类型       | 影响                                     | 缓解措施                                           | Owner                |
| ---------------------- | ---------- | ---------------------------------------- | -------------------------------------------------- | -------------------- |
| 历史审计状态过期       | Risk       | 把生产当前不存在的迁移补回会导致错误执行 | 以两个当前生产连接的完整迁移清单和校验和重新对账   | Codex                |
| 申请周期回填冲突       | Risk       | 新唯一索引创建失败会中止 migration job   | 发布前查询按相同公式聚合；必须为 0 重复组/0 多余行 | Codex                |
| main push 自动生产部署 | Risk       | push 立即触发生产变更                    | 未通过 AC-001 前禁止 push                          | Codex                |
| Android FCM 缺失       | Dependency | 真机 remote push 不可验收                | 保持 conditional，独立后续配置                     | Mobile release owner |

<!-- section:open-decisions -->

## 16. 决策、假设与未决问题 / Decisions, Assumptions, and Open Questions

| 状态       | 内容                                                                                    | 是否阻塞 | Owner     | 截止/验证方式                     |
| ---------- | --------------------------------------------------------------------------------------- | -------- | --------- | --------------------------------- |
| [DECISION] | [REQUESTER] 授权 Codex 处理迁移对账、推送与部署闭环                                     | No       | Requester | 2026-08-12“你来”                  |
| [DECISION] | 只有当前生产迁移记录实际存在且精确 SHA-256 匹配，才允许恢复历史迁移                     | No       | Codex     | AC-001                            |
| [DECISION] | 当前生产两条连接均无历史目标，因此不恢复 `20260428120000_add_mbti_and_personality_tags` | No       | Codex     | runs `31674059594`、`31674204209` |

<!-- section:implementation-plan -->

## 17. Codex 实施计划 / Codex Implementation Plan

[CODE] 已从 Git 对象、远端 refs、本机归档、GitHub Actions artifacts 和 GCP 历史镜像搜索历史候选；随后通过短生命周期私有 Cloud Run 服务直接对账当前生产两条数据库连接，确认旧目标已不在当前迁移历史。下一步运行 pending migration 与全仓发布门禁，提交并 push `main`；随后持续读取 GitHub/GCP 状态直到部署成功或出现需要修复的确定失败。

<!-- section:implementation-summary -->

## 18. 实施结果 / Implementation Summary（Closure）

N/A — 实施进行中，关闭时填写精确来源、提交和部署结果。

<!-- section:verification -->

## 19. 验证证据 / Verification Evidence（Closure）

N/A — 实施进行中，关闭时逐项填写 AC-001 至 AC-004 的 PASS/FAIL/BLOCKED。

<!-- section:release-decision -->

## 20. 合并与发布结论 / Merge and Release Decision（Closure）

- 实施结论：IN PROGRESS
- 合并准备度：BLOCKED — 等待精确迁移证据。
- 发布准备度：BLOCKED — 禁止在 AC-001 通过前 push `main`。
- 未执行项：迁移恢复、发布门禁、push、生产部署与验收。
- 下一责任人/动作：Codex 执行第 17 节计划。
