# Harness Solve 流式恢复

<!-- section:change-identity -->

## 1. 变更身份

[REQUESTER] AI-HARNESS-STREAM-RECOVERY-20260827。用户在4/6生产复验报告后要求“继续”。Owner Codex。来源：reports/AI_SCHOOL_BUDGET_DIAGNOSTIC_2026-08-27.md。状态INTAKE。

<!-- section:executive-summary -->

## 2. 摘要

[RUNTIME] 上批2次Provider流NETWORK_ERROR，一次有定时取消栈。[CODE] LLMService.buildRequest给非路由Solve套用30000ms默认截止，短于120000ms Run上限。[DECISION] 使用剩余Run截止、仅无输出的瞬时错误最多重试一次；部分输出后保持明确失败。

<!-- section:current-state -->

## 3. 现状

[RUNTIME] 01012-geb 100%，GPT-5.4，路由关闭，Harness/Context启用；main dbdabf49。上次发布验收通过，业务子集未通过。原始失败数据与用户未提交文件均保留，不覆写为成功。

<!-- section:target-outcome -->

## 4. 目标

[DECISION] 合法长响应不被无关30秒默认值截断，仍不得超过Run剩余时限和Provider上限。未输出时有界恢复；已输出、审批/工具、权限、协议和预算错误不得靠重试掩盖。

<!-- section:scope -->

## 5. 范围

[DECISION] 仅现有OpenAI Provider、非路由有预算的agent.solve/agent.revise且无工具的流。复用现有Harness开关/Run预算。新增内部恢复helper、传输诊断与测试。无数据库/前端/凭据/模型/预算配置变更，不启用新工具、Claude、路由或Skill版本。

<!-- section:users-permissions -->

## 6. 权限

[REQUESTER] 延续经CI零流量验收后直切100%的发布方式。只用合成账号测试，不审批真实操作。无Shell/文件工具/权限扩张；未授权副作用仍禁止。

<!-- section:user-flows -->

## 7. 流程

[DECISION] Solve→冻结本阶段截止→每尝试独立预留token→流→完成后结算再done。首发瞬时失败且未输出、时间/token足够→最多第二次同模型同输入请求；其余直接失败。重试不重新进入Plan/Execute。客户端终止消费时取消源流，不后台重试。

<!-- section:requirements -->

## 8. 需求

- FR-001：[DECISION] Solve截止不超过Run剩余时长、显式调用限制与Provider上限；重试不重置截止。
- FR-002：[DECISION] 仅typed retryable NETWORK_ERROR/SERVER_ERROR且无内容/工具/完成事件时最多重试一次；429、鉴权、模型/协议/安全、已输出、结算失败不重试。未知错误默认拒绝重试。
- FR-003：[DECISION] 无可信最终usage的失败尝试保留全部预留token作为保守计费；成功按usage结算，未结算不得done，不释放预算后偷跑重试。
- NFR-001：[REQUESTER] 只记录阶段、尝试号、字节数、时长、首字节时长、稳定原因码和重试决策，禁止正文/工具参数/账号/密钥。

<!-- section:acceptance -->

## 9. 验收

- AC-001 / FR-001：可控31秒流在120秒Run内成功；显式短截止、消耗后的剩余时间和Provider上限仍被遵守；到期无第二请求。
- AC-002 / FR-002：首发无输出瞬时错误可恢复，最多2次；部分内容/工具事件/协议/鉴权/429/未知错误/空或缺终态失败不重试；无工具重放。
- AC-003 / FR-003：失败预算不退还、重试预算不足不发请求；超过usage或时限不出现done；消费取消不启动新请求。
- AC-004 / NFR-001：诊断仅白名单字段，错误可区分连接/读流/协议/截止；敏感诱饵不进入日志；旧非Harness和路由路径不变。
- AC-005 / FR-001/FR-002/NFR-001：CI/正式Harness/清理/告警/健康/Cron/回滚证据齐全；冻结两失败case各三次全部成功后才启动280×3及盲审，任一失败保留记录并停止扩量。

<!-- section:technical-impact -->

## 10. 技术影响

[DECISION] 新内部helper和Provider错误诊断类型，不新增API/配置/迁移。每Solve最多多一次模型请求，但同一24000 token/120000ms上限；保守计费可能拒绝重试。非路由普通调用和路由策略不修改。Embedding不受影响。

<!-- section:nonfunctional -->

## 11. 安全与质量

[DECISION] 流中已出现内容不得拼接替代响应；模型与输入不变；权限集中策略不变。退避也计入同一截止。成功/失败不混淆，不承诺能修复全部外部网络故障。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 传输层提供typed脱敏诊断，Solve helper白名单日志。保留可区分的deadline/transport/protocol原因；不打印Error对象、request/response或任意details。

<!-- section:test-plan -->

## 13. 测试

[DECISION] 先红测30秒截断/无输出错误，再实现。可控fetch流+真实OpenAIProvider+LLMService+预算tracker验证；定向、全部Agent、完整API、TypeScript和安全门禁。上线后合成6次诊断通过才全量；工程测试不冒充模型质量。

<!-- section:rollout -->

## 14. 发布与回滚

[REQUESTER] 通过现有PR和main CI，零流量正式验收后100%。回滚目标01012-geb，保留旧修复。正式验收/安全/清理失败走现有回滚；诊断失败停止扩量。不得手工绕过门禁或上调预算。

<!-- section:risks-dependencies -->

## 15. 风险

[ASSUMPTION] 无输出重试不保证成功；流中断无法安全透明恢复。token估计延续现有约定，不等于Relay账单精确值。Provider截止与网络行为必须通过可控测试及生产复验验证，Owner Codex。

<!-- section:open-decisions -->

## 16. 决策

[DECISION] 不提高Run/Provider配置上限；取消非路由Solve的默认30秒截断属于同一Run内调度。未知/无usage失败最坏情况保守计费，宁可明确失败。没有要求用户补充密钥；没有扩大产品范围。

<!-- section:implementation-plan -->

## 17. 实施计划

[DECISION] 固定文档与红测→内部恢复helper/传输诊断→定向及全量测试→白名单PR/CI→生产验收→失败组复测→条件全量/清理/报告。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] FR-001/002：LLMService将非路由、有Run预算、无工具的Solve/Revise交给harness-solve-stream.ts，默认使用剩余Run截止；显式调用/Provider限制仍有效。最多2次同模型请求，只在未输出的typed瞬时错误且时间/token足够时恢复，Retry-After要求不被缩短。旧路径不变。

[CODE] FR-003：失败的未知usage保留全部预留token；仅源流完成且最终结算成功后传递done，部分输出/取消/缺终态不重试。NFR-001：Provider诊断由typed白名单投影，包含阶段、字节数、首字节/总时长和原因，不记录正文。原buildRequest转换提取到llm-request-adapter.ts保持语义，文件大小门槛未放宽。

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] 上次4/6失败证据是本轮起点。旧实现3条红测全部失败；修复后定向4 suites/84 tests PASS，覆盖AC-001至004。完整API两轮均353 suites/4639 tests PASS；最后仅将等价NETWORK_ERROR枚举比较改为字面量消除lint警告，并复跑恢复测试。TypeScript/ESLint/API quality及文件大小/any门禁通过。最终提交仍须经过云端完整CI。

[DECISION] AC-005待CI及生产验收；未声称已发布或业务质量达标。最终源码、线上证据及清理结果在运行结束后补记。

<!-- section:release-decision -->

## 20. 结论

[DECISION] IN PROGRESS。Owner Codex负责实现与闭环，保留失败，未验收项不算完成。
