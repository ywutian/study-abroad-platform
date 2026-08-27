# 申请分析共享请求与发布闭环

<!-- section:change-identity -->

## 1. 变更身份

- Change ID: AI-ANALYSIS-RELEASE-20260827；Owner Codex；状态实现完成、验证有失败、发布BLOCKED。
- [REQUESTER] 本任务最新授权：查阅资料、完善、测试、自己部署上线。
- [CODE] 来源：`AI_ANALYSIS_COMPACT.normalized.md`；保留原实现及负面评测记录，不改写历史结论。起始 HEAD `17fb7132fd1fc43bb41bbebd5a1a232a7715b65c`，叠加前轮未提交路由/Provider/compact 工作。

<!-- section:executive-summary -->

## 2. 摘要

[RUNTIME] 上轮五校紧凑分析仍超24k预算；最近主分支CI 33018768614 在生产验收失败后回滚。[DECISION] 分别解决多校请求开销与发布前置条件，未通过门禁不提升生产流量。

<!-- section:current-state -->

## 3. 当前状态

[RUNTIME] 上轮真实小批仅3/8完整；五校每校独立请求约4.3k报告tokens。CI验收缺摘要/审批，合成清理成功，旧公开管理员凭据已拒绝。流水线记录回滚到00992-zin；这只是历史证据，不冒充当前云状态。本机gcloud需要交互式重新认证；GitHub访问正常。

<!-- section:target-outcome -->

## 4. 目标行为

[DECISION] 用原LLMService/路由/预算完成申请分析。同一运行内最多两校共享一次请求，输入公共事实只传一次，每校结果严格绑定原schoolId和证据。原概率、权限和API响应不变。失败明确降级。

<!-- section:scope -->

## 5. 范围

- In scope：[REQUESTER] 申请分析、模型路由现有改造、回归、真实合成评测、现有CI发布闭环。续轮明确授权生产聊天使用此前测试的Relay并配置独立聊天Secret，Embedding保持当前线上配置。
- Out of scope：[DECISION] 新模型升级、24k/120s预算扩大、凭据轮换、IAM修改、数据库迁移、前端重做、MCP/Shell工具、真实用户材料评测；不触碰未命名文件夹。

<!-- section:users-permissions -->

## 6. 用户与权限

[DECISION] 管理端配置选模，客户端/Skills不能扩大权限。同一批次只能属于同一用户、预算、语言和运行。保留前轮原生Claude代码但不开启。[REQUESTER] 续轮授权复用已指定Relay凭据，创建独立生产聊天Secret；不新建供应商Key、不修改旧Secret或IAM。

<!-- section:user-flows -->

## 7. 流程与状态

[DECISION] 旧策略走旧路径；新shared-v1显式开启后，最多两校一组，共享事实和Schema→逐校证据验证→原归一化→组合分析。单校尾组正常完成；无数据保留unknown；超时/拒答/截断/重复或错学校ID失败；禁止拆组重试刷成功。业务状态仍fresh/degraded/原空态，不增加重启恢复承诺。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                                                    | 来源        |
| ------- | --------------------------------------------------------------------------------------- | ----------- |
| FR-001  | 新显式shared-v1仅学校单段使用；最多2校同运行共享请求，不混用户/证据                     | [DECISION]  |
| FR-002  | 严格Schema及本地逐校业务校验，拒绝重复/遗漏/错ID、未授权证据和不完整输出                | [DECISION]  |
| FR-003  | 五校至多3次学校请求加1次组合请求；共享原24k/120s和组合预留，usage不重复累计             | [DECISION]  |
| FR-004  | 固定中英/学校数/缺失与对抗样例，源版本冻结，真实小批通过后才扩大；失败留证              | [REQUESTER] |
| FR-005  | 发布前检查生产前置条件，通过现有CI部署及生产验收才宣称上线                              | [REQUESTER] |
| FR-006  | 专用聊天API_KEY/BASE_URL/MODEL必须成组配置，缺项启动失败；原Embedding配置与旧Secret不变 | [REQUESTER] |
| FR-007  | 聊天错误仅输出稳定分类和状态，不记录上游正文、网络错误原文或凭据                        | [DECISION]  |
| NFR-001 | 无权限/凭据/概率/用户数据改动，不放宽门禁或升预算                                       | [REQUESTER] |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射           | Given / When / Then                                                                                       |
| ------ | -------------- | --------------------------------------------------------------------------------------------------------- |
| AC-001 | FR-001,FR-002  | 开启候选，输入1/2/3/5校，正确分组返回原顺序；不合法绑定拒绝；关闭不变                                     |
| AC-002 | FR-002,NFR-001 | 错ID/证据/截断/拒答/跨运行请求不能被接纳；原概率和权限不变                                                |
| AC-003 | FR-003         | 合成五校完整只需4次请求；累计token与Provider使用一致、无隐藏重试，超预算仍拒绝                            |
| AC-004 | FR-004         | 固定小批完整、安全通过才扩大矩阵；同输入比较完整率/调用数/token/延迟，降级不计成功                        |
| AC-005 | FR-005,NFR-001 | 本地回归/CI通过；目标Revision100%、健康/Cron/生产验收/清理/告警/备份PITR/回滚均有证据                     |
| AC-006 | FR-006,FR-007  | 完整聊天配置只影响聊天；缺项/不安全URL拒绝；Embedding使用原地址/密钥/模型；Provider错误日志无合成敏感标记 |

<!-- section:technical-impact -->

## 10. 技术与数据影响

[DECISION] Profile小模块+既有路由可选字段+测试/Runner/文档。新增模式改变策略hash，旧运行不自动变更。每请求最多3000输出是两校原1500额度相加，不增加运行额度。无DB/API合同迁移；生产凭据配对不擅改。原始评测输出仅/tmp，不提交。

<!-- section:nonfunctional -->

## 11. 安全与质量

[DECISION] 公共事实仍为不可信数据，投影白名单，不从历史案例编概率。所有学校结果分别绑定证据，批次最多2校限制失败范围。受限临时网络调用不接业务工具。中文英文均覆盖。没有UI修改，可访问性N/A。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 路由计真实调用，业务步骤保存共享请求hash、分摊usage和批次大小/序号；总量不双计。保留错误码、源hash、逐样例结果，禁止把Provider自报用量称真实账单。

<!-- section:test-plan -->

## 13. 测试计划

[DECISION] Unit AC-001–003：分组、归属、取消/超时、预算与兼容。Integration：Profile→Router→HTTP mock，1/2/3/5校及失败。Live AC-004：已授权Relay，先固定中英1/5校小批，再扩展矩阵；无真实DB写入。Regression AC-005：API与相关共享包、静态与秘密扫描；部署由既有CI完整门禁。Codex语义复核不是独立专家或招生结果评测。

<!-- section:rollout -->

## 14. 发布与回滚

[REQUESTER] 不做用户流量灰度，允许0流量验证后100%。[DECISION] 发布前确认真实活动Revision和可用回滚目标；新策略实测未过不启用；迁移/健康/Cron/真实Harness/清理/告警/备份PITR任一失败阻止上线或按既有CI回滚。观察以完整验收及独立告警检查为界，不声称长期无故障。

<!-- section:risks-dependencies -->

## 15. 风险

[EXTERNAL] OpenAI官方建议减少重复请求；Strict输出仍可能事实错误，应复用Zod并做应用验证：

- https://developers.openai.com/api/docs/guides/latency-optimization
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/evaluation-best-practices

[DECISION] Relay能力和真实用量以实测为准；两校批次失败影响同组两校，不自动拆分。Owner Codex。

<!-- section:open-decisions -->

## 16. 决策与假设

[REQUESTER] 最新授权覆盖此前“不部署”，不覆盖凭据/IAM变更。[RUNTIME] 2026-08-27 15:48 UTC用户重新认证后，GCP描述与日志读取均恢复，无需新增IAM。失败版本01003-por有7条直接上游OpenAI HTTP 401日志及7条传播错误；这些日志severity为DEFAULT，原ERROR-only查询漏报。两版本引用同一凭据，Secret元数据没有部署后新增版本；没有读取密钥值，不能推断密钥归属。[UNRESOLVED] 生产聊天凭据/接口选择仍需用户确认；候选真实矩阵失败仍阻塞默认启用。[DECISION] 不伪造完成、跳CI或把旧成功证据当新版本验证。

<!-- section:implementation-plan -->

## 17. 实施计划

1. 读取资料、生产历史证据、规范；request/intake校验。
2. 实现shared-v1受限两校请求与失败/归属/预算测试。
3. 合成真实小批及固定矩阵，修复问题但保留每次失败源版本。
4. 本地回归、Git diff/密钥/文件审查，不提交原始评测或用户目录。
5. 生产前置条件恢复后通过既有CI发布、验收、清理和回滚证明；否则明确BLOCKED。

[DECISION] CI新增显式只读inspection入口，使用既有部署身份检查活动/最新Revision和错误类别；不访问Secret值、不改IAM。发布前在0流量版本运行完整Harness验收，仍保留100%后的原验收和回滚，不跳原门禁。

[DECISION] 续轮仅修复FR-005的只读日志发现：保留ERROR查询，同时匹配文本/结构化消息中的确定Provider错误标记，以覆盖Nest DEFAULT日志。输出仍仅错误分类与计数；回归必须证明DEFAULT 401不漏报、过滤条件保持服务范围且不输出错误正文。该修复不改变模型调用、凭据或发布阈值。生产凭据确认前不开展新的OpenAI API调用。

<!-- section:implementation-summary -->

[REQUESTER] 2026-08-27续轮“可以”确认专用Relay聊天Secret方案，取代第16节待确认状态；凭据变更禁令仅对此授权例外，旧Secret、Embedding及IAM仍不得改变。[RUNTIME] 当前00992-zin的Embedding实际使用`https://xh.v1api.cc/v1`、`text-embedding-3-small`与`openai-api-key`，不是失败版本01003的官方地址；本次保留当前线上组合，不把保持配置声称为Embedding已经可用。已授权Relay现存进程凭据的合成连通测试HTTP200、GPT-5.4自报型号匹配、SSE终止与usage齐全，未输出密钥/正文。

[DECISION] FR-006/007实施：新增纯配置解析器供既有Provider和启动校验共用，runtimeModel识别聊天模型；缺省仍旧路径，专用三元组禁止混用旧key；部署配置与drift测试锁定生产聊天和既有Embedding组合，staging仍用原配置。先合约与隔离回归，再配置`openai-chat-api-key`，仅经原CI发布。shared-v1失败记录保留，暂不开启；聊天接入恢复不宣称共享分析矩阵通过。

## 18. 实施结果

[CODE] FR-001–003：已实现shared-v1、同源严格Schema、逐校证据绑定及usage分摊。补充固定2校一波的调度，避免真实持久化耗时不同把请求拆散；一波只发一次Provider请求。旧路径不变。

[CODE] FR-005：现有CI增加0流量完整Harness验收和只读inspection；inspection模式强制排除部署，即使deploy输入保持默认true也不会部署。URL只输出已知公开Provider地址，其它地址不输出路径。

[CODE] 本机并发工作使pre-push的类型/Lint/集成检查触发原120秒watchdog。新增仅本地的 `VERIFY_GATE_TIMEOUT_MS`（120000–3600000）参数；默认和CI仍120000，检查项目/断言不变，不涉及产品运行预算。非法/无限值拒绝，单元测试覆盖。600秒和900秒尝试均保留失败证据，后者Lint输出0错误但进程仍超时，不能据此算通过。

[CODE] 真实矩阵出现网络等待超出deadline；补充fetch/read/cancel不响应取消的三条回归（均先红后绿）。路由传输对连接与读取独立竞争截止信号，检查实际截止时间，清理不再等待底层取消完成；旧非路由传输不变。不声称这已证明历史网络故障的唯一原因，也不承诺在操作系统暂停时JS计时器能实时运行。

[CODE] FR-005续轮修复：`inspect-agent-release.mjs`保留服务范围，将Cloud Logging ERROR条件与确定Provider失败文本/结构化消息标记组成括号内OR，覆盖DEFAULT级别Nest日志，不扩大成全部LLM消息。未改API模型调用或任何Secret。

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] 历史生产失败证据 `/tmp/harness-release-audit.HkmkWp/harness-acceptance.json`。本轮有只读云核查，无生产变更或合成账号写入。2026-08-27 10:41 UTC，CI 33064063846确认00992-zin承接100%流量，最新01003-por未承接流量；日志读取返回BLOCKED_READ_PERMISSION_OR_REQUEST，不能从空计数推断无错误。剩余风险见16节。

[RUNTIME] 本地阶段性证据：71定向、399 Shared、42 CI脚本通过；首次TypeScript发现响应finishReason类型不一致，修正后通过。新增持久化延迟回归先失败（预期4次、实际5次调用），固定波次后8项集成通过。初始缺少SchoolCard mock的失败另存，不混作产品缺陷。

[RUNTIME] 三个实现快照各8个真实工作流：候选均4/4完整、单段对照均2/4，五校对照均预算失败。先前矩阵在32/288完成后因持久化调度缺陷主动中断；32条已完成记录保留，不宣称矩阵通过；中断时在途请求用量未知，不宣称退费或零用量。后续必须绑定修复后源版本重新验收。

[RUNTIME] 固定波次版本的矩阵 `/tmp/analysis-compact.pdXKFe` 在88/288时停止：共享候选44条中41条完整，3条网络失败，未通过完整门禁。其中两个等待超过100秒；第三个在约30秒请求截止时失败。记录没有重试或删除；停止时在途用量未知。三条取消挂起回归先失败；修复后含迟到成功、401清理、共享分组与路由预算的5 suites/112 tests通过，TypeScript通过。新源版本须重新跑真实小批，不能复旧判为该矩阵通过。

[RUNTIME] 2026-08-27续轮：新增DEFAULT日志发现回归先红（漏计2条合成认证错误）后绿；inspection/pre-promote/watchdog共15项通过。修复后15:53 UTC只读查询成功发现错误分类；按Revision核对01003-por有7条直接OpenAI HTTP 401，00992-zin近24小时有5条直接上游403。仅记录状态码与计数，不输出或保存错误正文/密钥。旧版本仍承接100%，本轮没有生产变更。此前0ae25487的CI 33066959105已全绿，但不覆盖本轮尚未推送的日志修复。

<!-- section:release-decision -->

## 20. 发布结论

[RUNTIME] 实现源提交 `e71d62cabb88c553f63a2aebd4faf9e83fb07583`，PR #633。同源先导候选4/4完整；扩展矩阵在160/288停止，共享79/80完整，出现一条坏JSON、正常stop标记的真实失败。校验正确拒绝、未重试或删除失败；默认启用门禁FAIL。详见[共享分析报告](reports/AI_ANALYSIS_SHARED_2026-08-27.md)。

[DECISION] AC-001–003工程回归PASS；AC-004真实完整矩阵FAIL/未完成（不可默认开启）；AC-005生产待CI。用户已确认生产聊天接口/专用凭据方案，Owner Codex已实施隔离配置并验证模型合约，继续发布门禁。不得把HTTP 401/403猜测为特定密钥归属。AC-006隔离与脱敏测试PASS；完整API 338 suites/4456 tests、CI脚本48项、TypeScript/API质量通过。原始评测留本地、不提交。结构校验PASS不代表发布PASS。

[RUNTIME] 专用Secret已创建并内存校验，旧Embedding Secret版本1/2不变，无IAM修改。FR-006/007实现与四项真实合约见[聊天Relay发布记录](reports/AI_CHAT_RELAY_RELEASE_2026-08-27.md)。流式返回usage此前被预算结算忽略，合成回归2501被算为4先红后绿；现有24k/120s不变。生产仍00992-zin100%，尚未创建生产合成账号。
