# 选校工作流预算修复

<!-- section:change-identity -->

## 1. 变更身份

[REQUESTER] AI-SCHOOL-BUDGET-20260827，用户同意修复上轮发现的选校预算失败。Owner Codex。来源：[失败报告](reports/AI_PRODUCTION_SEMANTIC_EVAL_2026-08-27.md)。本地基线585a0ff7，保留所有既有未提交内容。状态INTAKE。

<!-- section:executive-summary -->

## 2. 摘要

[RUNTIME] 上轮三次school工作流token预算失败，完整评测阻塞。[CODE] 补充规划无条件消耗剩余预算，未为Solve保留输入/输出预算；非路由Solve忽略error事件，可能空重试或把部分文本当成功。[DECISION] 先修复可确定的预算调度与失败语义，不增加总预算或切模型。

<!-- section:current-state -->

## 3. 现状

[CODE] workflow-engine.service.ts每轮工具执行后调用supplementalPlanPhase；AgentRunBudgetTracker仅逐调用预留并结算。MemoryService.getRecentMessages已有工具摘要，因此不能仅凭完整JSON入存储断言上下文未压缩。原始线上回答已清理，无法事后精确还原失败请求的阶段token分布。

<!-- section:target-outcome -->

## 4. 目标

[DECISION] 可选补充规划不能抢占当前结果生成回答所需的预算；无安全余量时跳过补充规划，仍由现有Solve输出。已有预算不足、模型错误、流中断保持确定失败，不能伪装完成。

<!-- section:scope -->

## 5. 范围

[DECISION] 本地核心预算辅助方法、工作流补充规划/流错误处理、测试及文档。无DB/API/前端/模型/工具权限/生产配置变更；不改冻结评测题、不截断学校来源或个人约束、不部署。线上修复效果需后续发布及真实复验。

<!-- section:users-permissions -->

## 6. 用户与权限

[DECISION] 仅Harness+Context预算开启时启用新预算调度；旧ReWOO不变。普通用户、管理员、审批规则、租户边界不变。测试全部合成，不读取密钥或用户数据。

<!-- section:user-flows -->

## 7. 流程

[DECISION] Plan→工具→估算当前Solve和额外规划成本→有余量则有界补充规划，否则直接Solve→显式done才完成；error或缺终态失败，不重放工具。空且正常完成的旧fallback保留，但预算拦截始终有效。

<!-- section:requirements -->

## 8. 需求

| ID      | 内容                                                                    | 来源        |
| ------- | ----------------------------------------------------------------------- | ----------- |
| FR-001  | 补充规划前保留当前Solve输入与配置输出预算；可选核验不足时明确未核验     | [DECISION]  |
| FR-002  | 调度预估考虑工具schema，不改变中央token计数与上限；临时预留finally释放  | [DECISION]  |
| FR-003  | 带预算的Solve/ReSolve拒绝流错误及缺done，不将部分内容或错误重试冒充成功 | [CODE]      |
| FR-004  | 记录预算调度的阶段、数值和稳定原因码，不记录消息、工具参数或用户标识    | [DECISION]  |
| NFR-001 | 保持来源/约束/审批/去重/恢复/Feature Flag兼容，所有原有工作区内容不改   | [REQUESTER] |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射           | Given / When / Then                                                                                        |
| ------ | -------------- | ---------------------------------------------------------------------------------------------------------- |
| AC-001 | FR-001/002     | 24000预算且大工具结果重复输入时，新流程跳过无法负担的补充规划完成Solve；可选核验不足提示未核验，上限不增加 |
| AC-002 | FR-001/002     | 余量足够时仍可两轮规划；临时预留限制额外输出，成功/异常均释放                                              |
| AC-003 | FR-003         | 空流/部分流后error或缺done时失败；不重试、不发done、不重复工具                                             |
| AC-004 | NFR-001        | Flag关闭保持旧行为，审批/恢复/成功调用去重回归通过；不修改上下文内容                                       |
| AC-005 | FR-004/NFR-001 | 日志仅阶段/计数/原因码；类型、Agent回归、质量及安全检查通过                                                |

<!-- section:technical-impact -->

## 10. 技术影响

[DECISION] 复用AgentRunBudgetTracker及WorkflowEngine。新小型纯辅助模块，避免扩大大文件；无数据库迁移/环境变量/依赖更新。金额不从估算推断供应商真实账单。

<!-- section:nonfunctional -->

## 11. 安全和质量

[DECISION] 中央预算仍fail-closed，不吞token/duration错误；预留不是降低已使用token。请求输出可能根据可用余量减少，工具权限和调用上限不变。不以丢弃证据换成功。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 记录replan前剩余token、预计Solve保留、额外规划输入/输出预算及调度决定；可选核验不足记录稳定跳过码并向用户提示未核验。线上原有三次失败仅有终态日志，离线复现说明机制，不声称是完整线上重放。

<!-- section:test-plan -->

## 13. 测试

[DECISION] 使用真实AgentRunBudgetTracker、实际学校配置及合成Provider/工具数据执行工作流；新测试先红后绿。覆盖大结果、多工具、低预算、可用预算、错误/缺终态、审批与恢复已有回归。真实线上全量评测NOT RUN，待新版本发布。

<!-- section:rollout -->

## 14. 发布与回滚

[DECISION] 本轮本地实现与测试，不部署、不切流量。后续必须经过既有CI与生产验收，保留上一Revision；先复验失败组再开展280×3。未取得线上结果不更新旧报告为PASS。

<!-- section:risks-dependencies -->

## 15. 风险

[ASSUMPTION] 输入字符数估算不等于供应商真实token；后续工具仍可能增加上下文，预算仍可拒绝。跳过可选规划可能降低答案完整性，须用固定语料量测。Owner Codex，后续线上复验。

<!-- section:open-decisions -->

## 16. 决策

[DECISION] 本轮不做未经证实的工具结果截断。先解决已证实的可选规划预算抢占机制，剩余问题依据后续阶段计数诊断。无需用户提供新模型或密钥。

<!-- section:implementation-plan -->

## 17. 实施计划

[DECISION] 记录范围→真实预算工作流红测试→无副作用预算预估与预留→严格流失败处理→回归/静态检查→证据与残余风险。范围内文件与上轮采集器改动分离。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] 本地实现完成；无新增Provider/工具/配置/迁移。新增预算与流终态小模块，保留中央预算计数、实际Memory投影、工具结果、来源、审批和去重逻辑。未提交、推送或部署。

| 需求       | 文件（apps/api/src/modules/ai-agent/core）                           | 结果                                                                                                                                            |
| ---------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001/002 | agent-run-context.ts、workflow-budget.ts、workflow-engine.service.ts | 只读remainingTokens；补充规划为当前Solve保留输入+配置输出预算；计入工具schema/调用参数的调度估算；不足跳过且不增加实际规划轮数；预留finally释放 |
| FR-001     | workflow-budget.ts、workflow-engine.service.ts                       | 可选核验成本不足不调用模型，返回unverified并复用用户提示；时间超限及实际预算异常仍失败                                                          |
| FR-003     | workflow-stream.ts、workflow-engine.service.ts                       | Solve/ReSolve统一检查error/缺done；保留预算错误码、脱敏其他错误；流关闭后的结算失败仍传播                                                       |
| FR-004     | workflow-budget.ts、workflow-engine.service.ts                       | 仅阶段、调度决定和token数日志；无正文/用户ID/参数                                                                                               |
| NFR-001    | 三个新增spec及现有回归                                               | 来源/42k证据不变、未新增工具执行、审批/恢复/旧Flag路径保持                                                                                      |

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] 有效红测试为6失败/3通过，原始日志保留于/tmp/school-budget-red.log；修复后新增场景及现有定向回归5 suites/66 tests PASS（/tmp/school-budget-targeted-verified.log）。过程中发现并修正新增fixture的缺失required字段、routing snapshot类型、可选maxTokens缺省，以及测试finally/格式lint问题；不把这些fixture问题冒称线上缺陷。

| AC     | 结果         | 证据与边界                                                                                                                                                                        |
| ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-001 | PASS（本地） | 冻结选校输入+真实Memory/BudgetTracker+合成工具/Provider；42,000字符证据旧流程token失败，新流程不删证据、一次工具，累计计数<17,000；66,000字符边界完成后提示未核验；不是生产质量分 |
| AC-002 | PASS         | 预算启用时仍可两轮补充规划；工具schema影响可用输出；成功/异常释放预留；已有并发hold和超时不绕过                                                                                   |
| AC-003 | PASS         | 空/部分流后error、缺done不完成且无重放；收到done后真实BudgetTracker结算失败也不能逃逸；路由错误合同保持                                                                           |
| AC-004 | PASS         | Flag-off保留旧路径；7e2低预算在工具前失败；90k证据Solve仍拒绝；原审批/恢复/去重回归通过                                                                                           |
| AC-005 | PASS（本地） | TypeScript、ESLint、API quality、文件大小及any ratchet、diff、敏感信息扫描通过；所有日志仅合成工程测试内容                                                                        |

[RUNTIME] Agent专项目录曾通过101 suites/1017 tests；随后增加两项预算启用边界测试并通过66项定向回归。更广API回归首轮350 suites/4594 tests PASS；最终全量复跑350 suites/4596 tests PASS，79.43秒（/tmp/school-budget-api-verified.log）。TypeScript、ESLint、API quality及两个ratchet均通过。测试包括人工设计合成数据，不是实际Relay调用、模型对比或录取命中率。

[RUNTIME] 本次7个源码/测试文件按仓库相对路径字典排序，以path+NUL+bytes+NUL计算SHA256：8e53b42de831768e8f406cc1972973e709256b5b0bb9282a1e3b7e324ea3d93c。文件为agent-run-context.ts、workflow-engine.service.ts、workflow-budget.ts、workflow-stream.ts、workflow-budget.spec.ts、workflow-budget-helper.spec.ts、workflow-stream.spec.ts。文档closure结构校验20/20 PASS，不代表生产发布通过。

[RUNTIME] 本轮未启动生产采样、账号、数据库代理或模型评审进程，无生产合成数据需清理。仅保留普通本地测试日志，无原始线上输出。原上轮失败报告不改，四个既有收尾文档SHA256与上轮一致，未触碰用户未命名目录。

[DECISION] 线上剩余风险：输入估算与真实用量有差异、新工具结果可能继续膨胀、减少可选规划可能影响答案完整性。原三次生产失败的精确阶段消耗未能还原，不能声称本地机制修复已彻底解决线上所有预算失败。

<!-- section:release-decision -->

## 20. 结论

[DECISION] CLOSED（仅本地实现及工程验证）。合并准备度NOT CLAIMED（未提交/CI），生产发布准备度NOT CLAIMED。未执行：真实Provider失败组复验、完整280×3评测、独立盲审及生产发布验收。下一责任人Codex：通过既有发布流程后，先复验两个失败case及低预算/流失败路径，再扩至完整矩阵；任何失败保留原证据，不扩大预算或改题通过。用户/发布负责人确认具体发布范围后再进入生产流程。文档closure只证明结构完整。
