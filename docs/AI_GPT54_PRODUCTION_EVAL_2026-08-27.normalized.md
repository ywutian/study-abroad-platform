# 当前GPT-5.4生产语义评测

<!-- section:change-identity -->

## 1. 变更身份

[REQUESTER] AI-GPT54-EVAL-20260827；用户在剩余缺口清单后回复“可以”。Owner Codex。状态BLOCKED（工程修复已完成，生产采集失败）。来源：本任务、既有生产语义评测Runbook及2026-08-26失败报告；不覆盖原报告。

<!-- section:executive-summary -->

## 2. 摘要

[CODE] 上线验收不等于业务质量门禁。现有280题三轮完整生产结果属于旧版本且失败；当前GPT-5.4尚无同等证据。采集器仍可能把无SSE终态的HTTP成功记为已采集，且网络无截止时间。[DECISION] 先修复采集可信性，再评测当前生产Agent，不调整答案或门槛以通过测试。

<!-- section:current-state -->

## 3. 现状

[RUNTIME] 上轮确认01010-wul为100%，主线53885b74464588ff8ae81113c4cfe0dd261b49d2；聊天GPT-5.4、路由关闭。本地源码585a0ff7是合并源提交，仅其他收尾文档未提交。开始采样前重新核对Revision/配置，运行后再复核，变更则不声称同源评测。

<!-- section:target-outcome -->

## 4. 目标

[DECISION] 得到当前部署Agent的三轮冻结语料结果、每轮确定的采集完整性/清理/语义门禁和稳定失败类型；不把合成语义分称为真实录取命中率。

<!-- section:scope -->

## 5. 范围

[DECISION] 包含本地采集脚本、专用纯辅助函数/测试、生产合成调用、独立Codex盲审及脱敏报告。排除生产代码发布、Provider/模型/权限/预算调整、Skill候选发布、IAM、数据库恢复及真实用户材料。冻结语料不改题；多轮项沿用合成上下文注入，不能声称已验证真实跨请求记忆。

<!-- section:users-permissions -->

## 6. 权限

[REQUESTER] 复用既有生产Relay及Codex，不需要新密钥。[DECISION] 普通合成账号、不批准业务写入，不导出管理员或模型凭据；不调整配额。原始合成输出仅OS临时目录0600，提交物仅聚合指标和稳定原因码。

<!-- section:user-flows -->

## 7. 流程

[DECISION] 预检→严格采集→轮换合成账号与清理→去身份盲审→固定门禁→分歧复核→报告。缺终态/错误事件/超时作为采集失败保存，停止该轮并清理，不能当成功样本。仅既有401刷新和429退避可重试，业务已开始或结果不明时不自动重放。异常可继续诊断，但不得抹除已采集失败。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                                       | 来源        |
| ------- | -------------------------------------------------------------------------- | ----------- |
| FR-001  | 只接受明确完成且非空的done或有效approval_required；错误/缺终态不可伪装完成 | [CODE]      |
| FR-002  | 捕获连接和读体都有同一截止时间；失败原因脱敏，finally清理有界              | [DECISION]  |
| FR-003  | 280题×3轮，保留每轮完整性、配置身份、清理及失败证据                        | [REQUESTER] |
| FR-004  | 新Codex会话盲审、固定五轴/门槛；不以自审reference替代生产输出              | [REQUESTER] |
| FR-005  | 请求遵守实际x-locale协议；损坏SSE和无安全证明的400不能记为有效响应         | [CODE]      |
| NFR-001 | 不改变生产配置、评测门槛、用户数据和权限；所有临时账号清理可验证           | [REQUESTER] |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射           | Given / When / Then                                                             |
| ------ | -------------- | ------------------------------------------------------------------------------- |
| AC-001 | FR-001         | HTTP成功但缺终态、部分content、错误事件或空done时，拒绝采集；合法完成/审批通过  |
| AC-002 | FR-002         | 连接/读体悬挂或网络异常时，有界失败且不泄漏原错误/凭据，不自动重放业务          |
| AC-003 | FR-003,NFR-001 | 三轮各280题、账号创建数等于成功清理数、cleanupFailed=false；缺任何项不宣称完整  |
| AC-004 | FR-004         | 每轮独立评审全部case，关键硬门禁100%、总体≥95%、macro≥80%、每类≥75%；失败保留   |
| AC-005 | NFR-001        | 版本/配置前后相同，输出仅临时保存，脱敏报告无正文/参数/凭据，已有工作区改动保持 |
| AC-006 | FR-005         | 中英case均以x-locale覆盖相反账号语言；损坏JSON拒绝，HTTP400不推断为安全拒绝     |

<!-- section:technical-impact -->

## 10. 技术影响

[DECISION] 仅采集辅助代码及Runner/测试；无DB/API/前端/生产配置变更。增加固定采集失败码，保持旧评测数据格式。调用现有chat接口，每个完整批次最多840个首发case请求及已有认证/限流重试；被中断的先前批次单独统计，不宣称零消耗或退费。保留每Run现有预算，不升级配额。

<!-- section:nonfunctional -->

## 11. 安全与质量

[DECISION] 无真实数据、无主动业务审批；注册/清理只针对本次合成账号。网络异常不打印原文；捕获失败不做结果不明的chat重试。遇系统性失败停止扩大采样，先诊断并保留部分结果。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 仅输出进度计数、耗时、HTTP/终态稳定码、清理与完整性；盲审包无候选身份。独立盲审不是人工招生专家背书，也不证明供应商真实模型身份。

<!-- section:test-plan -->

## 13. 测试

[DECISION] 先红后绿单元测试覆盖缺终态/错误/空内容与有界网络；相关semantic全套及TypeScript通过后采样。线上先观察首轮早期进度，再开始其他重复，避免已知系统性故障时批量耗费。盲审使用Runbook指定独立Codex会话，不向用户索取生成内容。

<!-- section:rollout -->

## 14. 发布与回滚

[DECISION] N/A—本轮不部署或切换流量。采集失败停止并清理，不擅自回滚产品。源码改动可单独审查，任何后续生产修复需新的源身份和发布闭环。

<!-- section:risks-dependencies -->

## 15. 风险

[DECISION] 依赖生产可用性、普通用户限流、Codex评审可用性。采样期间若部署/Skill版本变化，需标为混合配置而非同源。多轮语料不是实际多轮请求；缺真实case时不做录取概率准确率声称。原始临时输出完成后按精确目录安全清理，保留脱敏报告。

<!-- section:open-decisions -->

## 16. 决策

[DECISION] 先执行业务质量评测，其他缺口不混入本轮。网络上限150秒用于覆盖既有120秒Run和传输余量；管理/清理请求30秒。不得扩大生产预算。独立评分若不可用则保持EVA-02未通过，不用同会话自评分替代。

<!-- section:implementation-plan -->

## 17. 实施计划

[DECISION] 冻结范围与版本→采集器红测试/修复/回归→三轮生产采样→清理核验→新Codex盲审与门禁→分歧聚合与报告→临时进程/数据清理。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] 采集器增加明确终态/错误/非空校验，连接与读体共用150秒截止，管理/清理30秒截止，失败仅输出稳定码。SIGINT/SIGTERM等待有界在途请求结束后进入清理；429超过60秒服务端退避时停止，不缩短其要求。仅本地采样代码，无生产部署。

| Requirement | 文件                                                                         | 实际结果                                           |
| ----------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| FR-001      | agent-semantic-production-capture.ts / .spec.ts                              | 明确终态与错误校验；生产三次错误未误记成功         |
| FR-002      | semantic-capture-http.ts / .spec.ts；ai-agent-semantic-production-capture.ts | 单一截止、错误脱敏、有界清理及信号退出             |
| FR-003      | ai-agent-semantic-production-capture.ts；本轮脱敏报告                        | 三轮采样因预算失败停止，未满足840条完整性          |
| FR-004      | 既有盲审流程                                                                 | BLOCKED，未生成虚假完整评分                        |
| FR-005      | agent-semantic-production-capture.ts / .spec.ts；Runbook                     | x-locale、严格SSE；400不推断安全拒绝               |
| NFR-001     | 本轮报告及只读前后检查                                                       | 配置/Skill不变，九个合成账号清理完毕，原有文件不动 |

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] intake 17/17 PASS。先纠正新增参数化测试的数据形状错误，再取得有效红测试9失败/5通过；修复后定向18/18、semantic32/32、Agent98 suites/990 tests、TypeScript和API quality通过。旧失败日志保留，不将初始fixture错误冒称产品缺陷。

[RUNTIME] 第一批生产采样三轮分别11/4/4条后停止，故障码为SEMANTIC_REQUEST_FAILED及两次SEMANTIC_REQUEST_TIMEOUT，自助清理失败。该时间段本机pmset记录多次睡眠/唤醒；同阶段服务端chat请求日志均201，已观察延迟4.4–65.2秒，不能单凭HTTP状态证明答案正确，也不能将本机断线归因于模型能力。工作流33134651817受保护补偿清理matched=3、cleaned=3、remaining=0、pass=true。三轮原始pass=false及临时输出保持原样，不复写为成功。

[DECISION] AC-001/002工程验证PASS；AC-003/004首批未完成，不生成完整语义评分。第二批使用新临时目录及进程级caffeinate，避免普通空闲睡眠；不修改系统电源配置，不能保证合盖后仍继续运行。生产模型和固定语料不变。

[RUNTIME] 第二批在协议复查后主动停止：CurrentLocale不读取ChatDto.locale，必须提供x-locale；旧脚本所有账号注册为en。三轮分别4/4/5条后通过SIGTERM有界退出，均accountCount=cleanupCount=1、cleanupFailed=false。不是产品模型得分失败，也不混入正式双语分数。

[CODE] FR-005修复实际请求头，并通过服务端resolveRequestLocale验证相反账号语言被覆盖；生产采集使用独立严格SSE解析，损坏事件拒绝，不再静默丢弃；仅HTTP400不推断安全拒答。最终相关测试5 suites/40 tests PASS、TypeScript/API quality PASS。

[RUNTIME] 第三批临时目录为OS临时路径下semantic-gpt54-v3.yrEEja，使用相同生产01010-wul及冻结v2-280语料。采集源码SHA256=fd7236eadf8b6ffc1036a228c6d792e6c47babc1de4e168b9ba8f55a12a9cff7；算法为按路径排序的git跟踪semantic-eval文件、agent-skill-eval.dataset.ts，以及Runner和新增HTTP辅助文件，每项path+NUL+bytes+NUL，共14文件。三轮分别41/40/41条后SEMANTIC_TERMINAL_FAILED，均清理1/1、cleanupFailed=false。对应日志三次school工作流AGENT_TOKEN_BUDGET_EXCEEDED；未取得完整质量结论。

[RUNTIME] 最终Agent回归98 suites/998 tests PASS。第三批初期只读核对6个Skill均为原bootstrap，快照SHA256=3e88ab3824a34e312b963eb3026031aed52191e6ea5a7c788c0c5942341b67c6；收尾查询完全一致，算法详见报告。只读SQL代理55442已停止。原生产版本100%不变，API/DB/Redis均ok。

| AC     | 结果    | 证据/边界                                                                                |
| ------ | ------- | ---------------------------------------------------------------------------------------- |
| AC-001 | PASS    | 终态单测及正式三轮错误拒绝                                                               |
| AC-002 | PASS    | 超时/错误单测、第二批信号退出；首批睡眠导致自助清理失败已补偿                            |
| AC-003 | FAIL    | 41/40/41而非280/280/280；账号清理成功不抵消完整性失败                                    |
| AC-004 | BLOCKED | 无完整采集，独立盲审、质量门禁及分歧复核未执行                                           |
| AC-005 | PASS    | Revision/Skill前后一致；敏感内容不进入报告；原四个收尾文档SHA256一致，其他既有改动未触碰 |
| AC-006 | PASS    | x-locale覆盖账号偏好、损坏SSE拒绝；不伪造400安全答案                                     |

[RUNTIME] 证据及后续闭环：[脱敏失败报告](reports/AI_PRODUCTION_SEMANTIC_EVAL_2026-08-27.md)。九个合成账号全部清理，采集进程及SQL代理停止；四个精确临时目录共34个文件已在报告核验后删除，不可从该目录恢复。没有提交/推送/部署本轮代码。结构closure校验20/20 PASS；仅说明文档完整，不抵消AC-003/004失败与阻塞。

<!-- section:release-decision -->

## 20. 结论

[DECISION] 实施结论BLOCKED：采集可信性工程修复完成，但完整生产业务质量门禁未完成。合并准备度NOT CLAIMED；发布准备度NOT CLAIMED，本轮不部署。未执行项：完整三轮盲审/语义评分/分歧复核，生产预算消耗修复。下一责任人Codex：按报告先复现预算消耗阶段，保持权限和预算上限，验证上下文收敛及Solve预留；新源身份完成测试/发布验收后再重跑。结构closure通过不代表质量或发布通过。
