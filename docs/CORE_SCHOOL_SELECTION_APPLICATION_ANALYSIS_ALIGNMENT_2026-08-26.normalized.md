# 功能变更文档 / Feature Change Document

<!-- section:change-identity -->

## 1. 变更身份 / Change Identity

| 字段              | 内容                                                 |
| ----------------- | ---------------------------------------------------- |
| Change ID         | CORE-AI-ALIGN-2026-08-26                             |
| 标题              | 统一选校推荐、正式预测与申请分析的事实源和效果闭环   |
| 类型              | 功能修改                                             |
| 产品/项目         | study-abroad-platform                                |
| 请求人 / 决策人   | [REQUESTER] 产品所有者 Yitian Wu                     |
| 优先级 / 目标日期 | [DECISION] P0，2026-08-26 开始                       |
| 来源文档          | [REQUESTER] 当前任务对话；无独立 PRD，原始对话不覆盖 |
| 状态              | Implementation Complete / Release Candidate          |

<!-- section:executive-summary -->

## 2. 一页摘要 / Executive Summary

- 问题：[CODE] 正式录取预测已使用官方聚合数据锚定的 Counselor Engine，但 AI 选校推荐仍可注入历史 Case、由 LLM 产生概率并用旧统计公式做 ±15pp 修正；申请分析也会读取历史 Case。这与请求人“不依靠 Case 分析”的产品策略不一致，并形成多个概率/档位事实源。
- 业务/用户结果：[REQUESTER] 同一申请者、同一学校在选校推荐、正式预测和申请分析中获得一致、可解释、可追踪的概率与档位；在没有录取 Case 的 pre-launch 阶段仍能量化推荐质量。
- 拟议方案：[DECISION] 推荐候选仍可由现有 LLM 生成解释，但只返回能唯一映射到数据库的学校；最终概率与档位全部由 `PredictionService.previewForUser` 的 Counselor 路径覆盖；移除推荐与申请分析主链的历史 Case 注入；增加推荐学校级事件，记录曝光、加入、移除和申请转化。
- 成功衡量：[DECISION] 事实源一致率 100%；Case 主链调用数 0；未匹配学校返回率 0；事件幂等测试通过；现有相关回归全部通过。业务采纳率仅建立口径，不在无真实流量时虚构阈值。

<!-- section:current-state -->

## 3. 当前状态与证据 / Current State and Evidence

- [CODE] `PredictionModule` 声明正式路径为 Counselor Engine；没有足够已核验标签时不启用 ML。
- [CODE] Counselor Engine 使用学校官方录取率/CDS 锚点、受限修正项与概率上下界。
- [CODE] `RecommendationService` 可调用 `PredictionHistoricalService`，最多给 5 所目标学校注入历史 Case。
- [CODE] 推荐概率当前来自 LLM，并通过旧 `calculateOverallScore/calculateProbability` 约束在 ±15pp 内，不是正式 Counselor 输出。
- [CODE] `ProfileApplicationAnalysisV2Service` 为焦点学校加载 `getCaseComparison()`。
- [CODE] `SchoolRecommendation` 只保存 JSON；`SchoolListItem.isAIRecommended` 只有布尔值，无法归因到具体推荐版本。
- [CODE] 申请分析已有 Run/Step/Feedback、确定性降级和 50 个 Gold Case；nightly live replay 当前限制 5 条，AA1 runtime journey 因 CI 无 Provider 凭据而停用。
- [RUNTIME] 2026-08-26 本地定向回归：预测与申请分析 57 suites / 940 tests PASS；推荐与 School List 6 suites / 87 tests PASS。

<!-- section:target-outcome -->

## 4. 目标行为 / Target Behavior

1. 用户生成 AI 选校推荐后，只看到数据库内可唯一识别的学校。
2. 每所学校的 `estimatedProbability` 和 `tier` 来自同一次 Counselor preview；LLM 不能覆盖。
3. LLM 继续负责候选建议、专业适配、理由、风险和总结，不作为概率事实源。
4. 推荐与申请分析主链不查询或注入 Admission Case/历史 Case。
5. 推荐生成时记录学校级 `IMPRESSION`；用户从该推荐加入学校时记录 `ADDED`；后续移除记录 `REMOVED`；只有申请时间线实际转为 `SUBMITTED`（或用户明确确认）才记录 `APPLIED`，自动创建的规划时间线不算申请。
6. 事件可按 recommendation、school、user 聚合，形成采纳率、保留率和申请转化率；无流量时显示样本不足，不伪造业务命中率。
7. Provider 或 Counselor preview 失败时整次推荐失败并退款，不回退到 LLM 概率。

<!-- section:scope -->

## 5. 范围 / Scope

### In scope

- Web 用户的 LLM 选校推荐 API、结果页加入清单动作。
- API recommendation、prediction、profile application-analysis、school-list 模块。
- Shared recommendation contract、Prisma additive migration、定向测试。
- 推荐事件的服务端归因与只读汇总基础。

### Out of scope

- [DECISION] 不调整 Counselor 系数，不训练 ML，不增加 Anthropic。
- [DECISION] 不引入真实/合成录取 Case 作为预测依据。
- [DECISION] 不改 AI Agent Harness、MCP、Shell、文件工具或 Skills 自进化。
- [DECISION] 不宣称真实录取准确率，不为 pre-launch 流量设虚假采纳率目标。
- [DECISION] 本变更不自动更改生产密钥或管理员密码。

<!-- section:users-permissions -->

## 6. 用户、角色与权限 / Users, Roles, and Permissions

- [CODE] 仅已认证用户可生成、查看、删除自己的推荐并修改自己的 School List。
- [DECISION] 推荐事件必须绑定当前认证 userId；客户端提交的 recommendationId 必须经服务端校验归属关系。
- [DECISION] 不新增跨用户读权限；汇总接口若加入，只允许既有 OPERATOR/Admin 权限。
- [CODE] Web 为本阶段主要修改端；现有 Mobile 不消费 LLM recommendation 页面，因此保持兼容。

<!-- section:user-flows -->

## 7. 用户流程与状态 / User Flows and States

- 成功：提交偏好 → LLM 生成候选/解释 → 数据库唯一匹配 → Counselor preview → 覆盖概率/档位 → 持久化推荐和 IMPRESSION → 展示。
- 空结果：没有任何合法匹配或预测结果时返回明确失败并退款，不保存空的成功推荐。
- 加入：结果页携带 recommendationId 添加学校；服务端原子创建 SchoolListItem，并幂等记录 ADDED。
- 重复加入：维持既有 duplicate conflict，不重复记录 ADDED。
- 移除：若 SchoolListItem 有推荐来源，删除前记录 REMOVED；删除业务行为保持不变。
- Provider/超时/格式错误：保持既有错误与退款；不得展示未经 Counselor 校正的 LLM 概率。
- Prediction preview 失败：整次生成失败并退款；不得回退旧统计概率。
- 权限：其他用户 recommendationId 被拒绝且不写事件。
- 离线：沿用 Web 现有 API 错误行为；无新增离线队列。
- 申请：加入推荐学校时可自动建立规划时间线，但不计为 APPLIED；时间线转为 SUBMITTED 时，状态更新与 APPLIED 事件必须原子完成。
- 申请分析：无 Case 时和移除 Case 查询后均继续使用 prediction、政策证据与确定性分析；LLM 全失败时保持 degraded。

<!-- section:requirements -->

## 8. 功能与非功能需求 / Requirements

| ID      | 需求                                                                                     | 优先级 | 来源/证据   |
| ------- | ---------------------------------------------------------------------------------------- | ------ | ----------- |
| FR-001  | 推荐主链不得读取或注入历史录取 Case。                                                    | Must   | [REQUESTER] |
| FR-002  | 申请分析主链不得读取或注入历史录取 Case。                                                | Must   | [REQUESTER] |
| FR-003  | 推荐返回的概率和档位必须由 Counselor preview 决定，LLM 输出不得覆盖。                    | Must   | [DECISION]  |
| FR-004  | 推荐响应不得包含无法唯一映射到数据库的学校，也不得包含 `caseComparison`。                | Must   | [DECISION]  |
| FR-005  | 推荐生成、加入、移除和申请提交必须形成可归因且幂等的学校级事件；规划时间线不得误算申请。 | Must   | [DECISION]  |
| FR-006  | School List 加入接口必须验证 recommendationId 属于当前用户且包含该 schoolId。            | Must   | [DECISION]  |
| FR-007  | 提供可计算曝光、加入、保留和申请转化的稳定数据基础；样本不足必须显式呈现。               | Should | [REQUESTER] |
| NFR-001 | 新表和字段为 additive，旧客户端不传 recommendationId 时行为保持兼容。                    | Must   | [CODE]      |
| NFR-002 | 不泄露 Prompt、Case、用户材料或 Provider 凭据到事件 metadata。                           | Must   | [REQUESTER] |
| NFR-003 | Counselor preview 失败不得静默使用旧统计或 LLM 概率。                                    | Must   | [DECISION]  |
| NFR-004 | 相关 API/Shared/Web 测试必须全部通过。                                                   | Must   | [DECISION]  |

<!-- section:acceptance -->

## 9. 验收标准 / Acceptance Criteria

| ID     | 映射需求         | Given / When / Then                                                                                                             | 可见结果             | 持久化/系统结果                              |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------- |
| AC-001 | FR-001, FR-002   | Given 已配置 historical service, When 生成推荐或申请分析, Then 不调用任何 Case comparison 方法                                  | 无 Case 文案/组件    | mock 调用次数为 0                            |
| AC-002 | FR-003, NFR-003  | Given LLM 返回任意概率/档位, When Counselor preview 成功, Then 响应严格使用 preview 值                                          | 推荐页与预测语义一致 | 保存 JSON 为 Counselor 值                    |
| AC-003 | FR-004           | Given LLM 返回未知或歧义学校, When 匹配, Then 该学校不进入响应                                                                  | 不显示幽灵学校       | 未写该学校 IMPRESSION                        |
| AC-004 | FR-005           | Given 推荐成功, When 保存, Then 每个返回学校有一条 IMPRESSION                                                                   | N/A — 后台指标       | DB 唯一约束阻止重复事件                      |
| AC-005 | FR-005, FR-006   | Given 用户从推荐加入学校, When API 成功, Then 记录一条 ADDED                                                                    | 学校加入成功         | 事件绑定 user/recommendation/school/listItem |
| AC-006 | FR-006           | Given 其他用户或不含该学校的 recommendationId, When 加入, Then 拒绝                                                             | 返回 4xx             | 不创建 list item/event                       |
| AC-007 | FR-005           | Given 推荐来源的 SchoolListItem, When 删除或对应时间线提交, Then 分别记录 REMOVED/APPLIED；仅创建或进行中的时间线不记录 APPLIED | 删除/提交流程不变    | 事件与业务状态在同一事务中幂等保存           |
| AC-008 | NFR-001, NFR-004 | Given 旧客户端请求, When 不传 recommendationId, Then 原行为成功                                                                 | 无兼容回归           | 现有测试通过                                 |
| AC-009 | FR-007           | Given 无真实事件或低样本, When 查询指标, Then 不输出伪造百分比                                                                  | 显示样本不足/空指标  | denominator/count 可审计                     |

<!-- section:technical-impact -->

## 10. 技术与数据影响 / Technical and Data Impact

- 仓库/服务/模块：API recommendation/prediction/profile/school-list；Web ResultsView/hooks；Shared recommendation types。
- API/事件/共享合同：`CreateSchoolListItemDto` 增加可选 recommendationId；推荐响应删除 deprecated caseComparison；新增内部/管理汇总合同视实现范围。
- 数据模型/迁移/回填/保留：新增 `SchoolRecommendationEvent`；SchoolListItem 可选 recommendationId；无需历史回填，旧数据标为 unknown source。
- 配置/Feature Flag/Secret：N/A — 不新增密钥；直接替换主链，数据库迁移可向后兼容。
- 第三方服务/成本/配额：每次推荐新增一次批量 Counselor preview；使用现有 OpenAI-compatible Provider，不新增 Provider。
- 向后兼容/版本关系：旧客户端字段可选；已保存推荐仍可读取，旧 `caseComparison` JSON 不主动清除但新结果不再生成。

<!-- section:nonfunctional -->

## 11. 安全、隐私与质量属性 / Security, Privacy, and Quality

- 所有 recommendationId 服务端校验 userId。
- 事件仅保存枚举、实体 ID、position、时间和非敏感来源版本；不保存 Prompt 或完整档案。
- Counselor preview 是只读预测，不消耗积分、不写正式 PredictionResult。
- 使用数据库唯一约束保证事件幂等。
- 保留中英文现有文案；移除 Case UI 后不新增未翻译文本。
- 不改变既有认证、限流、积分扣除与失败退款。

<!-- section:observability -->

## 12. 可观测性与运营 / Observability and Operations

- 结构化记录推荐生成总数、合法匹配数、丢弃数、Counsel preview 覆盖数。
- 可聚合事件：IMPRESSION、ADDED、REMOVED、APPLIED。
- 推荐质量最小指标：validMatchRate、counselorCoverageRate、addRate、retainedCount、applicationConversionCount。
- 低样本只返回 count/insufficientSample，不对外宣称命中率。
- Provider/Prediction 错误沿用现有日志，但不记录 Prompt 或用户材料。

<!-- section:test-plan -->

## 13. 测试计划 / Test Plan

| 层级                  | 场景/映射 AC          | 环境/Provider/设备                                             | 证据                              | Owner            |
| --------------------- | --------------------- | -------------------------------------------------------------- | --------------------------------- | ---------------- |
| Unit                  | AC-001–AC-009         | Jest，mock OpenAI-compatible/Prisma/Prediction                 | suite/test 数与 PASS              | Codex            |
| Integration/Contract  | AC-002, AC-004–AC-008 | API + Prisma test DB / shared typecheck                        | migration、service、contract PASS | Codex            |
| E2E/Real path         | AC-002, AC-005        | 本地 Web/API；Provider 可 mock，生产真实 Provider 需发布授权链 | 页面加入动作与 API 证据           | Codex            |
| Manual quality review | AC-002, AC-003        | 合成申请者与学校，不使用真实用户数据                           | 抽查推荐与 prediction 一致        | Codex/产品所有者 |

<!-- section:rollout -->

## 14. 发布、迁移与回滚 / Rollout, Migration, and Rollback

- 发布顺序/灰度/Flag：[DECISION] 迁移先行，API/Web 同 Revision 发布；用户此前要求不做流量灰度，部署后直接 100%。
- 前置条件：intake/closure gate、迁移验证、相关回归、CI、生产健康检查。
- 回滚触发：推荐生成失败率显著上升、Counsel coverage 非 100%、加入接口出现授权/归因错误、迁移失败。
- 回滚方式：切回上一 Cloud Run Revision；additive 数据表保留，不影响旧代码。
- 观察窗口和成功条件：部署后合成验收全部通过；24 小时内无权限或数据完整性错误。业务率仅采集，不设无流量阈值。

<!-- section:risks-dependencies -->

## 15. 依赖与风险 / Dependencies and Risks

| 项目                          | 类型          | 影响                      | 缓解措施                                       | Owner      |
| ----------------------------- | ------------- | ------------------------- | ---------------------------------------------- | ---------- |
| LLM 生成的学校无法匹配        | Risk          | 推荐数量减少              | 丢弃并记录；不足时明确失败，不返回幽灵学校     | Codex      |
| Counselor preview 延迟        | Risk          | 推荐响应变慢              | 批量调用、复用现有并发和超时；测试耗时         | Codex      |
| 旧保存 JSON 含 caseComparison | Compatibility | 历史页面仍可能显示旧 Case | Shared/UI 不再渲染；不破坏性清库               | Codex      |
| 无真实流量                    | Dependency    | 无法证明采纳率            | 只建立口径和采集，明确 insufficient sample     | 产品所有者 |
| 生产 GCP 认证                 | Dependency    | 部署/验收可能阻塞         | 本地与 CI 先闭环；需要时由现有授权账号重新认证 | 产品所有者 |

<!-- section:open-decisions -->

## 16. 决策、假设与未决问题 / Decisions, Assumptions, and Open Questions

| 状态         | 内容                                                                                                    | 是否阻塞 | Owner      | 截止/验证方式          |
| ------------ | ------------------------------------------------------------------------------------------------------- | -------- | ---------- | ---------------------- |
| [DECISION]   | 选校和申请分析均不依赖 Case；聚合学校数据 + Counselor 是概率事实源。                                    | No       | 产品所有者 | 当前对话确认           |
| [DECISION]   | 不做灰度，满足门禁后直接发布并保留上一 Revision。                                                       | No       | 产品所有者 | 既有明确指令           |
| [ASSUMPTION] | LLM 可继续提出候选学校和解释，但未唯一映射者必须丢弃。                                                  | No       | Codex      | 测试与产品抽查         |
| [DECISION]   | “申请转化”绑定 `ApplicationTimeline.status=SUBMITTED`，不把自动创建的规划时间线或仅加入清单误算为申请。 | No       | Codex      | 事务测试与生产合成验收 |

<!-- section:implementation-plan -->

## 17. Codex 实施计划 / Codex Implementation Plan

1. 冻结本文档并通过 intake validator。
2. 移除 RecommendationService 与 ApplicationAnalysis V2 主链的 historical Case 依赖和输出。
3. 将推荐学校唯一匹配后批量交给 `PredictionService.previewForUser`，用 preview 覆盖概率和档位；过滤无匹配/无预测学校。
4. 新增 additive Prisma event/relation 模型和迁移；扩展 School List DTO/service 进行归属校验和 ADDED/REMOVED 事件。
5. 更新 Shared/Web contract，结果页携带 recommendationId；删除 CaseComparison 渲染。
6. 增加推荐指标只读汇总或服务层计算，明确低样本语义。
7. 补齐单元、合同、迁移和 Web 行为测试；运行定向回归、TypeScript、治理门禁、secret scan 和 Git diff 审查。
8. 填写 Closure、运行 closure validator；仅在 CI 和部署授权链完整时合并/发布，并执行合成生产验收和回滚检查。

<!-- section:implementation-summary -->

## 18. 实施结果 / Implementation Summary（Closure）

| Requirement            | 修改的文件/合同/迁移                                                                                 | 实际行为                                                                                                                                              | 偏差                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| FR-001, FR-002, FR-004 | recommendation/profile prompts、services、Web/Mobile 分析组件、Shared contracts                      | 推荐和两代申请分析均无 Case service/Prompt/UI 路径；模型返回的历史信号被忽略；未知或歧义学校被丢弃                                                    | Shared 的 `historicalSignals` 仅保留 deprecated 空数组以重放旧快照 |
| FR-003, NFR-003        | `recommendation.service.ts`、`school-list.service.ts`、PredictionModule wiring                       | LLM 仅提出候选与文案；推荐概率/档位和 School List AI 分类统一调用 Counselor preview；preview 无结果时失败，不使用 LLM/旧公式兜底                      | 无                                                                 |
| FR-005–FR-007          | Prisma schema/migration、recommendation/school-list/timeline services/controllers、Shared/Web routes | 原子记录 IMPRESSION/ADDED/REMOVED；仅时间线转为 SUBMITTED 或用户明确确认才幂等记录 APPLIED；提供用户级与单推荐指标，少于 30 个学校曝光时 rate 为 null | 无真实流量，当前只能验证采集与计算正确性，不能宣称业务命中率       |
| NFR-001, NFR-002       | additive migration、可选 DTO 字段、事件 metadata 白名单                                              | 旧客户端不传 recommendationId 仍可用；事件不保存 Prompt、Case、用户材料或 Provider 凭据                                                               | 无                                                                 |
| NFR-004                | 单元/模块/浏览器/跨端/全仓门禁、`core-ai-alignment-acceptance.ts`                                    | 全仓测试、类型、格式、路由、治理和数据库迁移验证通过；生产 Runner 只输出脱敏计数、单向用户哈希和稳定原因码，并在 finally 中清理合成账户               | Linux 视觉基线由 PR CI 最终确认                                    |

<!-- section:verification -->

## 19. 验证证据 / Verification Evidence（Closure）

| AC             | 结果 | 测试/人工检查                                                            | 证据路径/运行 ID                                                | 边界                                           |
| -------------- | ---- | ------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------- |
| AC-001         | PASS | 静态扫描 + V1/V2 rogue LLM signal 测试 + Web/Mobile 渲染                 | profile application-analysis services/specs；推荐 prompt/spec   | deprecated 输出字段固定为空，不作为数据源或 UI |
| AC-002         | PASS | LLM 返回值被 Counselor 4%/reach 覆盖；School List 复用 preview           | `recommendation.service.spec.ts`、`school-list.service.spec.ts` | 真实 Provider 在生产合成验收确认               |
| AC-003         | PASS | 歧义名称拒绝、无合法 Counselor 结果则退款失败                            | `recommendation.service.spec.ts`                                | 候选数量可能因此减少，这是 fail-closed 设计    |
| AC-004         | PASS | 推荐保存 nested IMPRESSION + 数据库唯一约束                              | service spec + migration from empty DB                          | 无历史事件回填                                 |
| AC-005, AC-006 | PASS | owned/membership 校验、ADDED 与 SchoolListItem 原子创建、跨用户拒绝      | school-list/recommendation service specs                        | 旧客户端无归因但行为兼容                       |
| AC-007         | PASS | REMOVED 与删除事务；SUBMITTED 与 APPLIED 事务；创建/IN_PROGRESS 不计申请 | timeline/school-list specs                                      | 明确确认 API 作为幂等 fallback                 |
| AC-008         | PASS | 可选 recommendationId；全仓回归                                          | `pnpm check`                                                    | 旧已存 JSON 不破坏性清除                       |
| AC-009         | PASS | 10/40 曝光低/足样本计算测试；count 始终返回、rate 低样本为 null          | recommendation metrics specs                                    | 30 是统计显示门槛，不是产品成功目标            |

- 数据库：空库按顺序应用 95 个 migration，含 `20260826160000_add_school_recommendation_events`，PASS。
- 定向回归：核心 7 suites / 128 tests PASS；时间线与 School List 3 suites / 92 tests PASS；Web 3/3、Mobile 分析 12/12 PASS。
- 浏览器合同：10 个固定场景 × desktop/narrow-web = 20/20 PASS。
- 全仓：API 322 suites / 4171 tests、Web 66/435、Mobile 39/346、Shared 21/399、Browser Extension 1/11，全部 PASS；36/36 gate proofs PASS。
- 生产验收合同：`pnpm core-ai:acceptance --production` 强制绑定预期 Revision，串行验证真实 Provider 推荐、Counselor 覆盖、低样本抑制、ADDED/RETAINED/APPLIED 归因、无 Case 申请分析和账户清理；未带 `--production` 时拒绝运行。
- 质量债务净改善：API 超大文件 overage -219 行、Shared -1338 行；显式 `any` -3，均锁入 only-down baseline。
- 清理结果：macOS 临时视觉快照已删除；临时迁移数据库将在提交前删除；未使用真实用户数据。
- 剩余风险：生产真实 Provider、迁移、Linux 视觉基线和合成账户清理需在合并部署后验证；无真实用户流量，因此不宣称采纳率或录取准确率。

<!-- section:release-decision -->

## 20. 合并与发布结论 / Merge and Release Decision（Closure）

- 实施结论：PASS — 本地实现与可重复验证闭环完成。
- 合并准备度：GO，前提是 PR Linux CI 全绿。
- 发布准备度：GO，按请求直接切 100%，保留上一 Cloud Run Revision；发布后必须完成健康、迁移、真实 OpenAI-compatible Provider、合成推荐/提交/指标/申请分析及清理验证。
- 未执行项：真实业务采纳率与最终录取准确率只能在未来有真实流量和核验 outcome 后评估，不以合成数据冒充。
- 下一责任人/动作：Codex 提交 PR、修正 Linux 视觉基线（如 CI 证明需要）、合并部署并完成生产闭环。
