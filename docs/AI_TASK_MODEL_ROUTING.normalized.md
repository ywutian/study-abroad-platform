# Task Model Routing — 统一治理，不统一型号

<!-- section:change-identity -->

## 1. 变更身份

- Change ID: AI-TASK-ROUTING-20260826
- [REQUESTER] study-abroad-platform 用户批准任务级选模、预算、版本与评测闭环。
- 来源：当前任务中“根据不同功能调用不同模型”的确认；不覆盖原 Native Claude 变更文档。
- [CODE] 基线为 `17fb7132fd1fc43bb41bbebd5a1a232a7715b65c` 加前轮未提交的 Native Claude 实现；用户未跟踪目录不动。
- 状态：CLOSED — 本地实现与验证闭环，未部署。Owner：Codex 本地实现；用户决定生产启用。

<!-- section:executive-summary -->

## 2. 摘要

- [CODE] 目前全局模型覆盖 Agent/反思，业务申请分析也固定模型；缺任务级路由。
- [DECISION] 在现有 LLMService / Provider 内增加受控路由，不另建 Agent、会话、工具或权限系统。
- [DECISION] 默认关闭；开启必须提供完整、可验证的服务端策略。不同任务可选择不同 GPT，不能凭型号名称宣称业务质量提升。
- [RUNTIME] 已指定中转的 GPT 仅支持流式；路由路径需要严格 SSE 汇总，旧 OpenAI 路径保持兼容。

<!-- section:current-state -->

## 3. 实施前状态（冻结基线）

- [CODE] `core/llm.service.ts` 有 model override 和单一 Provider，没有 taskType。
- [CODE] `core/workflow-engine.service.ts` Plan/Replan/Solve/Verify/Revise 复用同一个配置模型。
- [CODE] AgentRun 已有 JSON budget/usage/checkpoint，可扩展可选路由快照而无 Prisma 迁移。
- [CODE] 旧重试在一次预算预留内多次调用；新路由必须每次尝试预留预算，失败未知用量保守计费。
- [CODE] 申请分析已有业务验证和失败降级；概率仍由 Prediction 确定，路由不改变该权威来源。

<!-- section:target-outcome -->

## 4. 目标行为

[DECISION] 业务声明任务 → Harness 验证策略/能力/预算 → 调用指定模型 → 校验结果 → 必要时按预设备用顺序再尝试 → 记录脱敏路由证据。任何换模均不改变工具范围、审批和用户身份。

<!-- section:scope -->

## 5. 范围

- In scope：版本化任务策略；GPT 路由；Agent 步骤、摘要/提取、选校建议、申请分析、文书辩论入口；严格 GPT 流式接口；受限回退；AgentRun 路由快照与审计；离线合同/路由评测夹具。
- Out of scope：部署、密钥写入、模型真实身份背书、自动学习选模、概率算法修改、MCP、子 Agent、UI 重做、Skills 权限扩大、价格重估。
- [DECISION] Claude 原生仍默认关闭；本次不做跨 Provider 自动回退。

<!-- section:users-permissions -->

## 6. 用户与权限

[DECISION] 管理员控制策略；业务代码声明 taskType；用户输入与声明式 Skill 不得提交任意策略、model、URL、header 或扩展预算。路由只是传输治理，不执行业务工具。

<!-- section:user-flows -->

## 7. 状态与流程

[DECISION] 关闭走旧路径；开启且配置非法则启动失败；找不到任务、模型能力不足或权限白名单失效时拒绝。正常输出完成才返回工具；认证、身份不符、非法工具不自动换模。仅临时传输错误或明确输出验证失败可按策略备用顺序尝试，最多两次。流已向用户输出后不自动拼接另一模型结果。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                                            | 来源        |
| ------- | ------------------------------------------------------------------------------- | ----------- |
| FR-001  | taskType 决定模型，服务端策略严格校验、含版本和内容哈希；默认关闭               | [REQUESTER] |
| FR-002  | GPT 路由路径支持纯流式中转并严格检查型号、终态、工具、usage；兼容普通业务响应   | [CODE]      |
| FR-003  | 回退有界且能力不降级，每次尝试共享整次预算/截止时间，拒绝安全错误回退           | [REQUESTER] |
| FR-004  | AgentRun 创建时冻结路由快照；检查点与恢复沿用快照；旧运行不自动加入新路由       | [REQUESTER] |
| FR-005  | Agent 各步骤与核心业务声明任务，输出/步骤记录实际模型与路由原因，不虚记默认模型 | [REQUESTER] |
| FR-006  | 建立可重复的路由/契约回放与比较证据；区分合成策略验证和真实业务质量评测         | [REQUESTER] |
| NFR-001 | 不新增权限、业务副作用、数据库迁移或真实密钥；新日志只含固定路由元数据          | [REQUESTER] |
| NFR-002 | 响应有大小/时间边界，流中断无工具执行，所有测试进程清理                         | [DECISION]  |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射             | Given / When / Then                                                                                          |
| ------ | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| AC-001 | FR-001           | 关闭时所有已有调用保持旧路由；开启后不同 taskType 命中预配置不同模型；非法配置/任务拒绝                      |
| AC-002 | FR-002, NFR-002  | 合成 SSE 分块/UTF-8/工具/usage 正确汇总；型号不符、缺终态、非法工具和超时失败                                |
| AC-003 | FR-003, NFR-001  | 临时错误最多尝试两个预设模型；认证/模型不符/权限错误不回退；预算耗尽不再请求                                 |
| AC-004 | FR-004           | 保存/序列化/恢复后沿用原策略和预算；修改活动策略不改变旧运行；撤销模型则拒绝而不是换权                       |
| AC-005 | FR-005           | Agent 规划/解答/验证及摘要、申请分析等入口提交正确 taskType；业务记录实际模型；原工具权限测试通过            |
| AC-006 | FR-006           | 固定合成矩阵覆盖任务、能力、回退、失败与恢复；输出策略哈希、结果、调用数、token 与耗时；不宣称录取准确率提升 |
| AC-007 | NFR-001, NFR-002 | 类型/格式/增量 Secret 检查、相关及完整 API 回归通过；生产配置未变                                            |

<!-- section:technical-impact -->

## 10. 技术影响

- [DECISION] 新增 `routing/` 小模块；沿用 LLMService、ILLMProvider、AgentRunBudgetTracker、现有工具/审批。
- [DECISION] `AI_AGENT_MODEL_ROUTING_V1=false`；`AI_AGENT_MODEL_ROUTING_CONFIG` 保存无凭据的严格 JSON 策略。启用时要求 OpenAI Provider 及 Harness/Context 开启。
- [DECISION] AgentRun budget 可选 routing 快照，usage 可选脱敏 attempts；JSON 可选字段，无迁移。既有 v1/v2 检查点兼容，历史无快照运行保留旧路径。
- [DECISION] 每任务配置明确能力、上下文上限、输出上限、超时及最多两个模型；示例仅供本地评测，不自动发布。

<!-- section:nonfunctional -->

## 11. 安全与质量

[DECISION] 拒绝 providerOptions 覆盖 model、tools、预算和 URL。保留审批绑定参数；路由不接触工具执行。原始消息/工具参数/密钥不写入路由 trace。普通调用通过有界 SSE 汇总；流式输出不能混用不同模型。UI/国际化 N/A — 不改界面。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 记录 taskType、策略哈希、型号、尝试序号、固定原因码、耗时、tokens；成功时请求/返回型号必须一致，失败保留请求型号及错误码，不保存上游原始响应。AgentRun 检查点/结果最多保留64条脱敏尝试记录，业务调用使用现有日志/步骤记录。失败指标与结果质量不混淆。

<!-- section:test-plan -->

## 13. 测试计划

- Unit/Contract：AC-001–AC-007，Jest mock fetch 和固定合成输入。
- Integration：LLMService → Router → 原 OpenAIProvider；Workflow → Budget → checkpoint → resume。
- Real path：使用用户先前授权的中转仅发送合成内容；不创建 Key，不写凭据；接口通过不等于业务质量通过。
- Business quality：建立可重复比较入口和固定用例，模型分工在同输入评测后决定；真人结果/录取命中率 N/A — 无可验证真实标签。

<!-- section:rollout -->

## 14. 发布与回退

[DECISION] 本轮不提交、不部署；开关默认 false。后续管理员提供验证通过的路由配置才启用。关闭开关阻止新的路由调用；已冻结路由的运行遇全局关闭须明确失败，不能悄悄换模型。旧无快照运行继续旧路径。无不可逆数据变更。

<!-- section:risks-dependencies -->

## 15. 风险与依赖

- 中转别名/型号字段只是其自述：严格字段验证，不替服务商背书。
- 现有会话与业务材料敏感：真实请求仅合成样本，生产另行验收。
- 未校准的质量/价格：示例策略不是最佳模型推荐；实际账单不由本地估算证明。
- 本地已有 Native Claude 未提交变更：保留，不撤销，不把前轮回归计作新路由测试。

<!-- section:open-decisions -->

## 16. 决策与假设

- [REQUESTER] GPT 为主，允许各业务/步骤不同型号；已有中转合成测试授权继续适用。
- [DECISION] 规则路由先行，不让 LLM 任意选型号。JSON 配置、能力与预算由管理员管理。
- [ASSUMPTION] 本轮本地实现和评测，不包含生产发布；沿用前轮交付边界。
- [UNRESOLVED] 最终生产模型映射由业务评测决定，阻塞启用但不阻塞默认关闭的实现。

<!-- section:implementation-plan -->

## 17. 实施计划

1. 严格策略 schema、类型、版本哈希与冻结快照。
2. GPT 严格有界流式兼容及普通响应汇总。
3. LLMService 单一入口接入路由、预算/受控回退/验证。
4. AgentRun JSON 快照与恢复；Agent 和业务 taskType 接线。
5. 合同及集成矩阵、完整 API、类型/安全/文档闭环。

<!-- section:implementation-summary -->

## 18. 实施结果

本地实现已完成：

- FR-001/003：`routing/model-routing.policy.ts` 与 `model-router.service.ts` 实现12任务严格策略、稳定哈希、能力/上下文门禁、两次尝试上限、共享截止时间与预算；安全错误不换模。
- FR-002：`providers/openai-routed.stream.ts` 支持有界 SSE、普通响应汇总、明确型号与终态/usage、UTF-8 和工具完整性校验；认证/嵌入错误/非法工具/模型不符不重试；旧路径不变。
- FR-004：`core/agent-run-{state,context,settings,service}` 与 Workflow 接入运行快照、恢复和有界审计。旧运行不加入新策略；活动白名单可撤销模型。
- FR-005：LLMService 单一入口及全局 Nest 模块接线；Workflow 的5阶段、Memory 两类任务、推荐、逐校/组合分析、文书辩论明确 taskType。申请分析并行学校与组合步骤共享同一预算，缓存/输入快照含策略哈希，步骤保存实际型号。
- FR-006：固定合成夹具、同输入评测库、`apps/api/scripts/ai-model-routing-eval.ts` 可重复运行入口；默认 dry-run，显式 `--live` 才调用已有凭据，失败非零退出，无数据库访问。
- NFR-001/002：无迁移、无生产发布、无凭据改动；工具/审批仍走旧系统。将分析运行配置、并发和usage适配抽到 `profile-application-analysis-runtime.ts`，响应适配抽到 `core/llm-response-adapter.ts`，保持旧逻辑并通过文件规模门禁。
- 范围限定：独立 Memory 任务单独有预算，未宣称与前台运行共享；申请分析只冻结本次调用策略，未新增跨重启恢复；路由未新增或启用 Native Claude。

示例策略使用当前中转契约验证通过的 `gpt-5.4` / `gpt-5.5`，不是效果最佳或成本最低的生产决策。所有任务可由管理员重新配置，模型和Skill无权修改策略。

<!-- section:verification -->

## 19. 验证证据

证据目录 `/tmp/task-model-routing.Voe9ue/`，只含合成结果和本地验证日志；不提交原始评测输出或凭据。

| 验收       | 证据                                                                                      | 结果                                           |
| ---------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| AC-001–005 | `routing-closure.json`：策略、预算、恢复、全局模块DI、Workflow错误不重复请求、严格传输    | 5 suites / 96 tests PASS                       |
| AC-005     | `integration-tests.json`：前轮定向覆盖LLM、Workflow、AgentRun、推荐、申请分析、文书、环境 | 19 suites / 274 tests PASS，最终以全量回归为准 |
| AC-006     | `live-routing-verified-results.json`：12任务，单型号基线与任务路由同输入                  | 24/24 PASS                                     |
| AC-002/006 | `live-capabilities.json`：两款型号分别JSON/工具协议                                       | 4/4 PASS，业务工具执行0次                      |
| AC-007     | TypeScript、增量ESLint、Secret scan、质量/环境/部署/文档/ratchet门禁                      | PASS（见下方明细）                             |
| AC-007     | `full-api.json`：全部 API 测试                                                            | 330 suites / 4,327 tests PASS                  |

静态/安全验证：API TypeScript、变更TS文件ESLint和Prettier、API quality、精确路由、集成治理、配置drift、部署配置drift、19项Agent环境声明、6 Agent/45工具文档事实、企业控制登记校验、any/file-size ratchet、Git diff whitespace、增量Gitleaks均通过。企业登记有效不代表其余企业控制已全部完成：登记仍含1项 evidence_pending、2项 external_action_required，非本轮路由范围。

文件规模超限累计量由45,503降至45,493，未调高基线；显式any数量640保持不增。Runner dry-run成功，缺配置的live请求按预期退出1且只返回固定脱敏错误。前轮API基线为326 suites / 4,265 tests，本轮新增4 suites / 62 tests；本轮相关95项后再补1项损坏流测试，最终定向96项通过。

最终42个变更TS文件（含保留的前轮Native Provider改动）按路径排序，以 `path + NUL + content + NUL` 连接计算SHA-256：`5eb02118cec231b3b4193802a804bf438a1130a53e3d74ae37b795950d320fe4`。对应本地工作区而非已提交或已部署版本。

真实路径小样本（每组12次、单次采样，不具有统计显著性）：

| 指标                                    | 单模型 gpt-5.4 | 任务路由 gpt-5.4 / gpt-5.5 |
| --------------------------------------- | -------------- | -------------------------- |
| 合成固定输出正确                        | 12/12          | 12/12                      |
| 中转报告总tokens                        | 30,820         | 30,778                     |
| 调用耗时中位数                          | 1,794.5 ms     | 1,967 ms                   |
| 调用耗时P95（最近秩，本样本等于最大值） | 2,916 ms       | 2,936 ms                   |

这证明按任务选模和接口契约可用，不证明录取命中率、业务答案质量提升或降本。路由组在此样本反而略慢；中转usage及已有价格表估算不是账单或官方模型身份的独立证明。

保留的失败与修复证据：

1. 初次 `live-routing-results.json`：6/24通过，mini别名18次因 `MODEL_MISMATCH` 被拦截。诊断 `reported-models.json` 显示返回 `gpt-5.4-mini-2026-03-17`；这不是已证实的跨型号替换。
2. `live-routing-pinned-results.json`：明确日期ID被中转拒绝，仍6/24通过。没有放宽检查；示例改用验证通过的4/5.5。mini待中转提供可固定且匹配的请求ID后再纳入。
3. 初次类型、ESLint、文件规模检查失败均已修正：类型导入/JSON断言、无效测试表达式与有意义的运行辅助模块拆分；没有提高ratchet基线。
4. Git diff检查修正Cloud Run参数分隔符，两个新配置以现有 `|` 分隔、默认关闭；未执行gcloud或部署命令。

清理：真实请求仅合成内容；没有创建账号、会话或数据库记录，业务工具未执行。凭据只经隐藏标准输入留在已退出测试进程内存，不写文件；临时证据保留便于复查，用户未跟踪目录未触碰。

<!-- section:release-decision -->

## 20. 发布结论

CLOSED（本地）：实现、定向测试、完整API回归、真实合成协议验收、安全/文档检查和清理闭环。合并/部署 NOT CLAIMED。开关默认关闭，生产未变。生产启用仍需业务映射评测与管理员明确配置；本轮合成路由验收不能代替申请分析/选校真实质量验收。用户按此前要求自行更新，Codex不代为部署。
