# Verify预算与生产评测闭环

<!-- section:change-identity -->

## 1. 变更身份

[REQUESTER] AI-VERIFY-BUDGET-20260831；本任务用户要求“继续全面闭环”。Owner Codex，项目study-abroad-platform，类型Bug修复及验收。来源为本任务粘贴的#639–#644复盘，原文保留于附件。基线main=20b0b1274f97419670c19d2d8b8440289471cb87。状态Implementation Verified / Release Pending。

<!-- section:executive-summary -->

## 2. 摘要

[REQUESTER] 旧诊断送达6/6但verify仍跳过、存在预算超支，合成账号清理和280×3尚未闭环。[DECISION] 固定24000 token及原模型，先补充合成Run预算证据，再修复已复现的预留生命周期问题；通过诊断后才扩大评测。

<!-- section:current-state -->

## 3. 当前状态

[RUNTIME] 2026-08-31只读CI 33417868718确认01027-pin为100%、GPT-5.4、routing=false；稳定URL API/DB/Redis健康。本机认证过期且CI日志读取失败，缺口数字未知。[CODE] workflow-budget.ts在replan finally释放Solve+verify hold；Solve未持有verify hold。ai-agent.controller.ts的runs/:runId返回本人Run的budget/usage，可供合成账号自查。原工作区20项变更保留。

<!-- section:target-outcome -->

## 4. 目标

[DECISION] 在预算允许Solve和verify同时执行时，Solve不能消费为verify预留的额度；无法同时容纳时保持已完成回答及诚实的未核验提示。预算估算与Provider结算分开报告；正式发布及语义质量分别验收。

<!-- section:scope -->

## 5. 范围

[DECISION] In scope：预算辅助函数、Solve接线、针对性回归、合成诊断预算观测、现有合成账号清理工作流安全预检、既有CI发布和评测。Out of scope：增加总预算、切换模型、改题/阈值、扩大权限、读写真实用户内容、改Skill部署、DB迁移及其他工作区报告。

<!-- section:users-permissions -->

## 6. 权限

[DECISION] 用户本轮要求延续修复、既有发布及验收闭环。生产发布仅经现有主线门禁；不修改IAM，不导出管理员凭据。清理仅严格匹配的历史semantic合成账号，先预检精确数量再调用既有清理端点。普通合成账号仅读本人Run；不批准真实业务写入。

<!-- section:user-flows -->

## 7. 流程

[DECISION] 只读检查→合成诊断/账号finally清理→确定性复现→修复→本地/PR门禁→无流量及100%发布验收→固定两题各三次→满足门禁后280×3及独立Codex审阅。错误、取消、离线、超时保持明确失败，不重放工具或隐藏未核验状态。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                                               | 来源        |
| ------- | ---------------------------------------------------------------------------------- | ----------- |
| FR-001  | 可容纳Solve最低输出及verify时，verify预留贯穿Solve并在所有退出路径释放             | [DECISION]  |
| FR-002  | 诊断读取本人Run预算及结算用量，只保存数值与固定原因码                              | [DECISION]  |
| FR-003  | 经既有门禁发布，固定失败组通过后才扩大到280×3和独立审阅                            | [REQUESTER] |
| FR-004  | 预检合成账号数量，再按精确数量清理并验证归零                                       | [REQUESTER] |
| FR-005  | 核验器识别学校工具的已验证、未过期来源百分比对象，不放宽缺失来源或单位歧义         | [CODE]      |
| FR-006  | 保留有界调用数值账目及固定未核验原因码，区分预留、Provider输入/输出/总量和未知用量 | [RUNTIME]   |
| NFR-001 | 不增加预算或权限，不损坏已完成回答，不泄漏正文/密钥/账号                           | [DECISION]  |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射           | Given / When / Then                                                                                                                                                 |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-001 | FR-001/NFR-001 | Given输出能吃掉verify余额，When完整工作流Solve结算，Then verify仍被调用、用量不超限；旧行为测试失败                                                                 |
| AC-002 | FR-001/NFR-001 | Given取消/异常/不反思/仅Solve可容纳，When执行，Then无hold泄漏、非反思不受影响、已完成回答不因可选检查丢失                                                           |
| AC-003 | FR-002/NFR-001 | Given诊断合成Run，When读取本人摘要，Then只输出预算/用量/次数等白名单；读取失败显式unknown，不输出原始摘要                                                           |
| AC-004 | FR-003/NFR-001 | Given精确提交，When现有CI发布，Then无流量及正式Harness/清理、健康/Cron/告警/备份PITR/回滚目标全部通过                                                               |
| AC-005 | FR-003         | Given同一生产源身份，When两题各三次，Then送达6/6且verify运行/预算检查；之后全量及原质量门禁才能声明业务闭环                                                         |
| AC-006 | FR-004/NFR-001 | Given受保护CI凭据，When预检，Then无删除只输出匹配数；实际清理要求精确数一致并归零，不匹配不写                                                                       |
| AC-007 | FR-005/NFR-001 | Given学校工具真实百分比投影，When核验，Then来源已验证且FRESH/AGING、value/display一致才可比较；无来源/STALE/隐藏/单位不符均unverified，冲突更正保留明确百分比       |
| AC-008 | FR-006/NFR-001 | GivenProvider用量偏离预留或事实未核验，WhenRun结算，Then本人诊断可见有界阶段/数值/固定原因，无正文/模型原始响应；缺失用量仍unknown，旧Run兼容，预算行为不因观测改变 |

<!-- section:technical-impact -->

## 10. 技术影响

[DECISION] api ai-agent核心及本地采集脚本、既有cleanup工作流。无新公共API/DB迁移/Secret/模型配置。保留现有标志和非反思行为。实测使用既有OpenAI兼容Provider；不添加生成参考内容所需外部调用。诊断小样本和全量成本分别受既有门禁约束。

<!-- section:nonfunctional -->

## 11. 隐私与质量

[DECISION] 原始合成回答仅保存在采集器规定的私有临时目录用于审阅；不提交或上传CI。持久化报告只记脱敏计数/原因。国际化未核验提示保持原样，无UI/可访问性改动。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 预算输出上限不称实际消耗；Run usage含Provider结算及未知用量估计，不能称账单。读取缺失记unknown。记录每批版本、完成数、清理数、预算缺口和核验状态的证据来源，不推断没有日志的成功。

<!-- section:test-plan -->

## 13. 测试

[DECISION] AC-001/002：真实tracker+工作流模拟Provider、失败/取消、旧行为负控；AC-003/006：HTTP契约/脱敏及无写入测试；AC-004：既有PR及主线门禁；AC-005：部署Agent生成固定诊断/全量输出，Codex独立审阅，非人工专家签署。Owner Codex。

<!-- section:rollout -->

## 14. 发布与回滚

[DECISION] 当前稳定01027-pin保留；PR门禁后主线部署，精确无流量revision验收后直接100%，不跳过门禁。正式验收/隐私/审批/清理硬失败走既有回滚；诊断失败停止扩量并保留证据。无迁移或不可逆产品数据变更；合成账号清理使用既有软删除契约。

<!-- section:risks-dependencies -->

## 15. 风险

[ASSUMPTION] 实际Provider输入可能偏离估算，工具结果增长也可能让Solve+verify本就无法共存；本地测试不证明生产缺口已经消失。Owner Codex用真实诊断验证。认证影响日志读取但不阻塞代码/本人Run诊断；管理员清理依赖既有CI secret。

<!-- section:open-decisions -->

## 16. 决策与未决项

[DECISION] 不调大预算、不砍固定轮数、不默默截断证据；先复现已知生命周期缺口。无阻塞本地实施的产品决定。生产实际缺口、历史账号精确数为待测事实，不猜测。若同预算无法容纳所需证据，保留未解决状态并提交具体取舍。

[CODE] SchoolToolsService.formatSourcedPercentFact返回value/displayValue/source/consumerPolicy对象，旧核验器拒绝全部对象，导致录取率即使有来源也不核验。[DECISION] 按已有SchoolFieldSource.isVerified及staleness契约保守适配；不新增信任级别，不推断货币、日期或比例单位。先用生产工具投影构造契约测试，后参与同一PR/真实诊断。

<!-- section:implementation-plan -->

## 17. 实施计划

[DECISION] Codex先增加诊断观测及预检，取得生产事实；然后追加能复现预算耗尽的测试，修复hold生命周期并验证。所有改动按白名单提交，不携带其他报告。使用operate-study-abroad-agent-harness负责发布与验收，所有结果回填本文件。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] FR-001：workflow-budget.ts在Solve可同时容纳最低输出与verify时保留2226调度额度，workflow-engine.service.ts在finally释放；恢复路径不预留不存在的核验。可选核验预算异常保持unverified；预算不足以重新生成时输出数据库更正并保留原答案。核验实现抽入workflow-verify-phase.ts，原中英文模板移入workflow-verification.ts复用。

[CODE] FR-002：agent-run-context.ts/agent-run-state.ts为已有usage增加可选核验数值/状态证据。semantic-budget-evidence.ts白名单投影本人Run，采集器只在diagnostic读取；旧Run缺少字段明确null。FR-004：既有cleanup工作流增加默认dry_run=true预检，实际清理仍要求精确数量一致。

[CODE] FR-005：workflow-verification.ts保守适配SchoolToolsService实际百分比对象，只接受既有isVerified=true、FRESH/AGING来源与一致value/displayValue。缺失/过期/隐藏来源继续unverified，不把含货币格式、日期、多数字或比例歧义误报为verified；这些仍是核验覆盖边界。

[RUNTIME] 文件大小棘轮实测45504→45453，下降51，无抬高基线。FR-003发布和全量评测待门禁。

[RUNTIME] PR #646首轮CI 33419613769的API测试4654条中4653通过，路由空回答fallback用例因真实时钟超过fixture的1000ms截止失败。该用例触发冷tokenizer且CI启用coverage；不修改生产截止或全局fixture阈值。将路由契约测试统一使用受控时钟，已有截止用例显式推进fixture.timeoutMs+1，仍断言不能调用backup。此测试稳定性修正属于FR-003发布门禁。

[RUNTIME] 修正测试时钟后，按CI完整覆盖率入口本地执行jest --coverage --forceExit --maxWorkers=2：354 suites/4654 tests全部通过，未更改覆盖率阈值。原CI失败记录保留，等待新源身份的完整CI。

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] AC-001/002本地PASS：105 suites/1077 tests通过，TypeScript通过。将Solve hold替换为空操作后，完整流程新测试出现缺少agent.verify、余额0/required594的预期失败；还原后全绿。覆盖取消/错误释放、仅Solve可容纳、非反思、核验预算异常与无重写预算时的数据库更正。

[RUNTIME] AC-003本地PASS：新增白名单/未知数值/未知核验状态测试。AC-006本地PASS：3条cleanup契约测试，预检只有登录和列表两次请求，没有删除。

[RUNTIME] AC-007负控：使用SchoolToolsService.formatSourcedPercentFact的真实投影生成fixture，旧代码的正确值和冲突值两条测试均失败（均返回unverified），并非手写裸数字fixture。新增7条来源/单位一致性拒绝用例。

[RUNTIME] AC-007本地PASS：适配后完整API覆盖率回归354 suites/4663 tests全绿，覆盖率阈值不变。CI 33420566466的完整Unit Tests通过，验证了c1d8f916测试时钟修正；百分比适配待最终源身份CI。

[RUNTIME] 最终实现冻结为ded48a460484cbdc2f48c6ea97532c56edf430ee，PR #646；完整pre-push检查通过。最终CI 33421532525运行中；上一轮33420566466因推送新提交而取消，不计作整轮通过。只使用最终源身份的成功门禁作为合并依据。

[RUNTIME] 2026-08-31T18:05:57Z，最终CI 33421532525整轮SUCCESS，所有PR检查完成、mergeState=CLEAN后，#646按精确head合并为main 44f7aaa6a14207975c5f67c91a2c77235a9672b0。最终CI API日志确认354 suites/4663 tests全部通过；未绕过门禁。生产发布仍需主线CI和无流量/正式验收。

[RUNTIME] 主线CI 33423138202部署进行中，前置测试/运行时/构建及镜像门禁均通过。备份artifact 9770315397核对PASS、reasonCodes=[]：2026-08-31T18:24:37Z检查时自动备份及PITR均开启、transactionLogRetentionDays=7、retainedBackups=7；最近自动备份2026-08-31T05:46:55Z成功结束。此为只读证据，不曾创建/恢复/删除备份。

[RUNTIME] AC-004发布PASS：主线CI 33423138202最终SUCCESS。01029-hip在18:32:41Z以0%部署；健康/Cron及pre-promote验收通过后，18:34:35Z切至100%。独立检查job 99598446812于18:33:35Z确认01027-pin仍为100%且Ready、新版也Ready，作为切流前可用回滚目标证据；job 99599731853于18:37:45Z确认01029-hip为100%且Ready。GPT-5.4、routing=false、Harness/context/approvals=true保持不变。两个只读检查job均SUCCESS，之后取消其附带重复测试，不把这两条整轮CI标SUCCESS。日志读取仍BLOCKED，不据此声称无Provider错误。

[RUNTIME] pre-promote artifact 9770648524及post-promote artifact 9770747732均用仓库严格validator按01029-hip重验：10 records、pass=true、reasonCodes=[]，包括embedding、权限/审批、预算耗尽和cleanup。切流前后均34 Cron、driver=http、0 in-process timers、未认证调度拒绝；Scheduler更新34/创建0/删除0。独立健康检查API/DB/Redis均ok；独立告警CI 33426086755成功，18:38:04Z activeAlerts=0、各严重级别均0。AC-005诊断进行中，发布成功不等于质量闭环。

[RUNTIME] AC-005首轮候选诊断FAIL：01029-hip送达6/6、3账号清理3/3、cleanupFailed=false、Run用量超24000为0/6，但2/6未启动verify：r1两题分别remaining/required=672/1394及7/1759，均supplementalRounds=2。另外4/6 attempted=true却verified=0，unverified分别4/4/2/4；其verify前后Run用量差分别3563/3887/3927/3778，预算判据只预估1459/1789/1876/1665。此差值尚不能区分Provider输入附加开销、输出超限或其他结算差异。不猜预留值；FR-006先补数值账目及拒绝原因，280×3暂停扩量。采集器diagnosticPass=true仅表示交付/清理成功，不代表AC-005通过。

[CODE] FR-006：budgetCalls保留最近16次结算的固定阶段、输入估算、输出上限、当时heldTokens及Provider报告的输入/输出/总量，缺失为null；不是涵盖未知重试费用的完整账单。未核验原因仅六种固定枚举及计数，不含声明、字段原值或学校名。诊断仍仅读合成账号本人Run。预算算法及事实比较规则不变。

[RUNTIME] AC-008本地PASS：针对性6 suites/102 tests、TypeScript通过；负控去掉合法账目后3条新增测试失败，还原后完整API覆盖率回归354 suites/4673 tests通过。棘轮实测45453→45454（+1），唯一超长文件增长为LLMService结算传入阶段名的一行参数，已在基线文件同PR记录理由；未改变500行阈值、预算或测试阈值。

[RUNTIME] AC-006生产PASS：33419611406预检matched=5/cleaned=0/remaining=5；33419662473执行matched=5/cleaned=5/remaining=0。使用受保护CI凭据，未导出管理员密码；撤销刷新令牌、清除AI数据及匿名化账号，清除内容不可经该流程恢复。本轮诊断账号另已3/3清理。

[RUNTIME] 旧版01027-pin基线诊断三批完成6/6、3个账号清理3/3、cleanupFailed=false。下表为本人Run结束后的持久化usage；不是逐阶段账单，post-run提取模板估计不能证明verify实际启动。所有6条均有未核验提示，旧usage没有核验状态。原始内容仅留私有临时目录，未上传。

| 重复/案例hash前16位 | Run用量 | 剩余 | 最终输出提取模板估计需求 |
| ------------------- | ------- | ---- | ------------------------ |
| 1/f63bd49655a4f41a  | 20902   | 3098 | 1687                     |
| 2/f63bd49655a4f41a  | 21321   | 2679 | 1353                     |
| 3/f63bd49655a4f41a  | 22140   | 1860 | 1691                     |
| 1/da2f83851113c81a  | 23775   | 225  | 1769                     |
| 2/da2f83851113c81a  | 23971   | 29   | 1587                     |
| 3/da2f83851113c81a  | 21497   | 2503 | 1451                     |

[RUNTIME] 只读CI 33417868718确认生产01027-pin 100%，日志BLOCKED；API/DB/Redis健康。独立告警检查33419081268成功，activeAlerts=0。AC-004/005修复后验证NOT RUN，不从基线小样本0/6超支推断已修复。历史失败证据保留。

<!-- section:release-decision -->

## 20. 发布结论

[DECISION] RELEASE PASS / DIAGNOSTIC FAIL / FULL EVAL NOT RUN；#646已成功发布，生产诊断仍暴露预算和事实核验缺口，不声明业务闭环。Owner Codex在main 44f7aaa6基础上继续FR-006诊断，保持24000预算、模型、冻结题集及阈值不变。生产失败证据保留，不用新批次覆盖。
