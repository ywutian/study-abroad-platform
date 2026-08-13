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
| 状态              | Closed                                                                               |

<!-- section:executive-summary -->

## 2. 一页摘要 / Executive Summary

- 问题：[CODE] 修复批次最初只在本地 `main`，且 5 月历史审计曾记录仓库缺失 `20260428120000_add_mbti_and_personality_tags`；若不以当前生产重新对账，直接发布可能错误恢复过期迁移或把代码通过误当成生产关闭。
- 业务/用户结果：[RUNTIME] 修复批次已通过受保护分支 PR #594 合并至 `main`，生产迁移、canary、全流量部署、API/DB/Redis 健康和中英文公开路径均验收通过；积分系统仍关闭。
- 实施方案：[DECISION] 使用短生命周期、私有且必须 IAM 鉴权的 Cloud Run 服务，对 `database-url` 与 `database-url-proxy` 两条生产连接执行只读迁移清单/校验和与 pending migration 前置条件对账；禁止猜写 SQL 或绕过 Prisma 历史；对账和全量门禁通过后由受保护 PR 合并并持续监控生产部署。
- 成功衡量：[RUNTIME] 两条生产连接指向同一 `study_abroad/public` 且迁移清单一致；历史目标当前不存在、没有校验和冲突；pending migration 前置条件和生产执行通过；PR/main CI、迁移、canary、正式健康和公开路径成功且 `POINTS_ECONOMY_AVAILABLE=false`。

<!-- section:current-state -->

## 3. 当前状态与证据 / Current State and Evidence

[CODE] 修复批次通过 PR #594 squash 合并为 `58b1e59918af06fa566662aaebcb7b9e2275bae3`，远端 `main` 已包含归档问题修复和质量债务关闭；私人 `未命名文件夹/` 从未暂存或提交。[RUNTIME] 只读取证 run `31674059594` 证明 `database-url:latest` 与 API 实际使用的 `database-url-proxy:latest` 均连接 `study_abroad/public`，各有 131 条原始迁移记录且清单完全一致；两边都没有历史目标 `20260428120000_add_mbti_and_personality_tags`。[RUNTIME] 与仓库按名称和 SHA-256 对账后无共同迁移校验和不一致；run `31674204209` 证明当时唯一 pending migration `20260811120000_application_timeline_cycle_history` 的生产前置条件安全。[RUNTIME] main run `31677048632` 随后成功执行 migration `study-abroad-migrate-zztr7`，确认迁移与 API 都连接 `study_abroad`，并将 Cloud Run revision `study-abroad-api-00936-yex` 通过 canary 后提升到全流量。

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

[CODE] 已从 Git 对象、远端 refs、本机归档、GitHub Actions artifacts 和 GCP 历史镜像搜索历史候选；通过短生命周期私有 Cloud Run 服务直接对账当前生产两条数据库连接，确认旧目标已不在当前迁移历史；完成 pending migration 预检、本地全量门禁、受保护 PR CI、生产迁移、canary、全流量提升和外部健康验收。所有临时 Cloud Run 取证服务均由工作流删除。

<!-- section:implementation-summary -->

## 18. 实施结果 / Implementation Summary（Closure）

- [CODE] 归档功能修复、积分关闭闸门、超大文件拆分、CardTitle 字号统一、移动端语义状态、API 重复结构和历史脚本类型债务已汇总在 PR #594；GitHub 以 squash commit `58b1e599` 合并到受保护的 `main`。
- [CODE] PR #594 首轮 clean-checkout CI 暴露 shared `dist` 前置依赖后，提交 `afabde8f` 在根门禁前显式构建 shared；PR run `31676093927` 随后完整通过 Lint、Type Check、Unit、E2E、Web Runtime、Application Analysis、Prediction、Security 与 Build。
- [RUNTIME] main run `31677048632` 全部成功：migration execution `study-abroad-migrate-zztr7` 完成；迁移/API 数据库名均为 `study_abroad`；revision `study-abroad-api-00936-yex` 的 canary 与 post-promote health 均为 HTTP 200、health/database/redis=`ok`；29 个 Cloud Scheduler job 与 manifest 一致；gallery total 为 190。
- [CODE] CI 注解中暴露的失效 Markdown 链接、非阻断链接检查、Node 20/已停维护 Turbo cache Action、Semgrep SARIF 和隐藏 `.next` artifact 问题已在独立后续 PR #595 中修复并接受同一全量 CI 验证，不改变本次产品发布结果。

<!-- section:verification -->

## 19. 验证证据 / Verification Evidence（Closure）

| AC     | 结论 | 证据                                                                                                                                                                                                                                             |
| ------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AC-001 | PASS | runs `31674059594` / `31674204209`：两条生产连接同库同 schema、131 条迁移历史一致、共同迁移无 SHA-256 冲突；旧历史目标不存在；pending migration 回填为 0 重复组/0 多余行。                                                                       |
| AC-002 | PASS | 本地 `lint:all`、全量 tests/build 与依赖审计通过；PR #594 run `31676093927` 全绿；squash commit `58b1e599` 已在 `origin/main`；main run `31677048632` 的 Build/E2E/Security/SBOM/Docker/Deploy 全绿。                                            |
| AC-003 | PASS | production migration `study-abroad-migrate-zztr7`、revision `study-abroad-api-00936-yex` canary/post-promote health 通过；外部复测 `/health` uptime=153.85 秒（证明新实例）、DB latency 9ms、Redis latency 43ms，`/`、`/zh`、`/en` 均 HTTP 200。 |
| AC-004 | PASS | `packages/shared/src/constants/index.ts` 仍为 `POINTS_ECONOMY_AVAILABLE=false`；API/Web/直达保护测试已通过；未来开放与回滚步骤记录在 `docs/runbooks/points-economy-launch.md`；私人 `未命名文件夹/` 未进入任何提交。                             |

[CODE] Markdown Bug 对账结论：反馈来源 17/17 均为 done；`CODE_REVIEW.md` 的原 P0/P1/P2 均已修复或由明确产品退役决策覆盖；`技术文档/已知问题与解决方案.md` 七项均标记并复核为已解决；旧 5 月数据库 `OPEN` 已由 2026-08-12 当前生产证据明确取代。`A11/SJ-3` 的 Android FCM 真机 remote push 仍是非网站阻塞的外部条件能力，不是未修复网站 Bug。

<!-- section:release-decision -->

## 20. 合并与发布结论 / Merge and Release Decision（Closure）

- 实施结论：CLOSED — AC-001 至 AC-004 全部 PASS。
- 合并准备度：MERGED — PR #594 已按仓库允许的 squash 策略合并到受保护的 `main`。
- 发布准备度：RELEASED — main run `31677048632` 完成生产迁移、canary、全流量提升和部署后探针，未触发回滚。
- 未执行项：积分系统按产品决定保持关闭；Android Firebase/FCM 真机 remote push 是明确的 conditional capability，需移动发布 owner 提供私密项目配置后独立验收，不阻塞网站发布。
- 下一责任人/动作：无当前网站修复动作；未来开放积分时严格执行 `docs/runbooks/points-economy-launch.md` 的双闸门、验收和回滚流程。
