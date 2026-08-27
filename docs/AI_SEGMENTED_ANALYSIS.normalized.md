# 分段分析与证据驱动选模

<!-- section:change-identity -->

## 1. 变更身份

- Change ID: AI-SEGMENTS-20260826。
- [REQUESTER] 用户授权分段、全面测试，并根据测试结果直接修改本地文件及使用方案。
- [CODE] 基线 HEAD `17fb7132fd1fc43bb41bbebd5a1a232a7715b65c` 加既有42个TS文件的路由/Provider本地变更；基线内容哈希见原选模报告。
- 来源：本任务用户消息与 `docs/reports/AI_MODEL_SELECTION_SCREEN_2026-08-26.md`；原报告不覆盖。
- 状态：本地实现、选模验收和逐包回归均已完成。Owner：Codex。本地开发，不合并、不部署。

<!-- section:executive-summary -->

## 2. 摘要

- [RUNTIME] 原144次筛查中分析长输出耗时超过代码默认deadline；轻量题不足以证明完整流程的模型映射。
- [DECISION] 单校/组合各拆成两个有界顺序片段，复用现有LLMService、ModelRouter、预算和最终业务响应；不新建Agent。
- [DECISION] 模型策略增加可选执行模式和受控推理强度；测试后保存本地推荐策略，不自动改环境或启用线上开关。
- [DECISION] 验收先检查权限、预算、输出契约、失败可见性，再比较相同输入的有效输出、耗时和报告tokens；不宣称录取准确率提升。

<!-- section:current-state -->

## 3. 当前状态

- [CODE] `profile-application-analysis-v2.service.ts` 单校与组合各一次长JSON；最多5校并行，单校12s、组合15s默认值；路由最短deadline胜出。
- [CODE] `routing/model-routing.policy.ts` 有12类任务、严格快照、最多两个模型，没有推理强度或分段字段。
- [CODE] `workflow-engine.service.ts` CoVE异常默认allCorrect=true；不能区分未知与验证通过。
- [CODE] `memory.extract` 当前从单条明确用户消息提取；原筛查并非这一实际提示词。Luna必须真实回放通过后才采用。

<!-- section:target-outcome -->

## 4. 目标行为

- [DECISION] 用户继续得到同一申请分析响应；分段结果只有全段合法并通过最终校验后合并，失败返回原确定性降级，不输出半截JSON。
- [DECISION] 概率、学校事实、权限和证据范围不由模型改变。策略由服务端管理，冻结到既有运行快照。
- [DECISION] 核验未知明确标注未核验；不得写成已验证正确或凭空要求纠错。

<!-- section:scope -->

## 5. 范围

- In scope：[DECISION] 分段提示词/校验/调用；共享截止时间和预算；策略受控reasoning；CoVE未知状态；合成完整业务回放；本地推荐JSON及文档。
- Out of scope：[DECISION] 生产部署、.env/密钥写入、数据库迁移、前端重做、概率算法改变、新增Provider、MCP、Shell、文件工具、Skills进化。保留前轮Native Claude代码不修改或启用。

<!-- section:users-permissions -->

## 6. 用户与权限

[DECISION] 所有产品用户、语言和平台共享原API；业务服务负责选择任务，用户/Skill不得指定模型、推理预算或放宽策略。真实评测仅合成输入，不使用账号或生产数据。

<!-- section:user-flows -->

## 7. 流程与状态

[DECISION] 旧策略/开关关闭仍单次调用。明确配置segmented后：判断段→校验→行动段→校验并合并→原业务normalizer。两段顺序执行，不增加学校级并发；一段失败不重跑已成功段，整组按既有降级处理；全校失败跳过组合。模型fallback仍最多一次且共享剩余时间。恢复使用原冻结参数；没有新持久化恢复协议。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                                    | 来源        |
| ------- | ----------------------------------------------------------------------- | ----------- |
| FR-001  | school/portfolio两种分析可配置两段执行；旧策略与旧API兼容               | [REQUESTER] |
| FR-002  | 每段严格有限Schema、已知证据和字段边界；合并不改变权威概率              | [DECISION]  |
| FR-003  | 分段共享既有总预算、总deadline和学校并发；失败可观测且不伪装完成        | [DECISION]  |
| FR-004  | 受控reasoning枚举与模型能力声明冻结进策略；任意providerOptions不能绕过  | [DECISION]  |
| FR-005  | CoVE区分已核验、冲突、未知；未知不计成功，不伪称事实错误                | [DECISION]  |
| FR-006  | 用实际服务/提示词做合成对比，保存每次失败，按结果确定本地模型配置       | [REQUESTER] |
| NFR-001 | 不更改权限、密钥、概率算法或生产；保留用户文件和旧回退                  | [REQUESTER] |
| NFR-002 | 中英文可用，日志/报告不含真实会话、凭据或个人材料；测试有调用和时间上限 | [DECISION]  |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射            | Given / When / Then                                                                              |
| ------ | --------------- | ------------------------------------------------------------------------------------------------ |
| AC-001 | FR-001          | 无segmented字段时保持一次旧调用；启用时恰好两段顺序、输出原合同                                  |
| AC-002 | FR-002          | 非法JSON、缺字段、越权证据、错误工具或概率改写被拒绝；合法结果可归一化                           |
| AC-003 | FR-003          | 首段失败不启动次段；次段失败不重跑首段；预算/时间不足禁止额外请求；并发不膨胀                    |
| AC-004 | FR-004          | 受支持reasoning按快照传递；非法值/绕过/能力撤销被拒绝；旧快照哈希不变                            |
| AC-005 | FR-005          | 提取失败、无事实、查库失败/无字段均不是已验证；已确认差异才触发纠错                              |
| AC-006 | FR-006          | 实际分析服务的合成快照对比和实际Memory/Agent相关提示词回放完成；所有失败留证；不达门禁型号不启用 |
| AC-007 | NFR-001,NFR-002 | 定向、集成、完整API回归、类型/质量/安全/格式检查通过；无生产变更                                 |

<!-- section:technical-impact -->

## 10. 技术与数据影响

- [DECISION] 在profile新增小型分段模块，沿用LLMService，不增加Nest服务栈。
- [DECISION] routing policy增加可选`execution`、`reasoningEffort`与模型支持集；历史未设置字段不注入默认值以保留快照哈希。
- [DECISION] 分段仅由现有路由开关和策略启用。策略总timeout控制分段，旧12/15s默认不改。两段输出上限相加不超过原1500；具体阈值经回放验证。
- [DECISION] 审计扩展可选segment元数据；沿用JSON字段，无迁移。保留实际分段型号和报告用量，不把最后一段用量当整组。
- [DECISION] 依然使用OpenAI-compatible Chat Completions。无新增SDK、账号、Key或收费服务。

<!-- section:nonfunctional -->

## 11. 安全与质量

[DECISION] 分段不是增加模型权限。可执行工具、身份和审批仍由原系统控制。合成评测由Codex编写和复核，不声称独立或招生专家评审；不能证明真实录取校准。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 分段记录固定阶段名、策略哈希、型号、状态、耗时、报告usage与提示词哈希，不新增原始分段响应日志。失败保留错误码与已经发生的调用记录；业务降级与模型成功分开统计。

<!-- section:test-plan -->

## 13. 测试计划

- [DECISION] Unit：AC-001–005，包括fake timers、预算、非法输出、概率/证据约束、旧快照与unknown核验。
- [DECISION] Integration：实际LLMService→Router→Provider合同、实际Profile快照生成、失败降级与Memory输出。
- [DECISION] Live：先小型参数兼容，再冻结多场景中文/英文、缺数据、预算、test-blind、注入、组合约束；原长输出与分段同输入比较；轻量候选用实际服务提示词回放。单批明确上限并可断点续跑，不覆盖失败。
- [DECISION] Regression：完整API Jest、TypeScript、配置/质量/secret/格式检查；前端合同未变则不宣称跑浏览器E2E。
- [DECISION] 选择规则：安全/合同缺陷不靠平均分抵消；候选有效结果不得劣于当前对照，综合延迟和tokens决定；未验证任务保留旧型号。不把小样本当SLA。

<!-- section:rollout -->

## 14. 发布与回退

[DECISION] 本轮只改本地代码及推荐策略文件，不修改.env、CI默认启用状态或云配置；全局路由开关仍默认关闭。未来用户自行更新。删去execution和segmentationMaxSchools回到旧单段、恢复原策略回到原型号；快照按既有冻结规则处理；无不可逆迁移。

<!-- section:risks-dependencies -->

## 15. 风险

- [CODE] 分段重复输入可能增加tokens；必须以共享预算和实测约束，不默认加大总预算。
- [RUNTIME] Relay型号与usage自述无法独立认证；测试异常不全部归咎模型能力。
- [EXTERNAL] 官方建议显式reasoning并在代表任务比较；Relay可能拒绝或忽略参数，需实测。来源：https://developers.openai.com/api/docs/guides/latest-model 。
- [DECISION] 不放宽mini身份校验，不将未经完整题验证的Luna替换所有任务。

<!-- section:open-decisions -->

## 16. 决策与假设

- [ASSUMPTION] “分段”指拆分模型长输出任务，不是单纯UI排版；Owner Codex，按前轮超时问题和用户本轮授权实施，以回放验证。
- [REQUESTER] 用户允许测试后自行决定并修改本地文件；不再为每个型号询问。
- [DECISION] 无阻塞性未决问题。上线与真实用户数据不在权限范围。
- [RUNTIME/DECISION] 首轮真实回放发现全量分段在2–5校场景消耗重复输入并触发24k总预算，因此复测单校分段、多校单段候选，保持预算不变，并为部分失败显式降级。候选完整成功21/24，仍低于单段对照22/24；遵守成功率不降门禁，最终默认单段，分段单独保留为可选实验策略，不自动发布。
- [RUNTIME/DECISION] Memory实测60次：5.4 none 20/20、Luna none 18/20、Luna low 17/20；Luna失败为虚构/通用讨论实体超出保守记忆边界，不是已发现的个人事实伪造。默认保留5.4，不以小样本认定Luna普遍劣于5.4。

<!-- section:implementation-plan -->

## 17. 实施计划

1. 冻结需求与基线，request/intake校验。
2. 兼容扩展路由、参数合同和审计；实现分段提示词/严格Schema/共享预算调用；接入原Profile服务。
3. 修复CoVE未知处理，补定向和集成回归；不执行真实业务工具。
4. 冻结实际业务夹具，受限真实对比；据证据更新本地推荐策略，不改生产。
5. 完整API回归与静态/安全检查，关闭文档并报告实际证据及未覆盖项。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] FR-001/002/003：`apps/api/src/modules/profile/analysis-segments{,.contract,.input,.prompts}.ts` 与原ProfileApplicationAnalysisV2Service集成。严格有限Schema、两段共享deadline/预算、证据白名单、成功合并与整组失败降级。segmentationMaxSchools限制学校数量；无合法数量不启用分段。原概率字段不变。

[CODE] FR-004：既有routing policy、ModelRouter、OpenAIProvider与LLM请求类型增加可选reasoning/segment元数据，模型支持集与冻结快照校验。旧字段无默认注入，恢复哈希兼容。

[CODE] FR-005：`workflow-verification.ts` 提取保守数值核验与工具查证；WorkflowEngine只将明确冲突交给纠错，未知不计核验成功，用户收到未核验提示。拆分模块而非抬高文件规模基线。

[RUNTIME] FR-006：新增两个实际服务合成评测Runner，完成74个分析运行、60个记忆抽取，共342次Provider请求。四份逐运行证据与完整结论见 [验收报告](reports/AI_SEGMENTED_ANALYSIS_2026-08-26.md)。首轮夹具旧tier格式的覆盖缺口另行补测，不篡改旧结果。

[DECISION] 默认5.4 none单段、记忆抽取5.4，复杂任务保留5.5；5.6不默认使用。条件分段候选21/24低于单段对照22/24，发布门禁拒绝默认开启。候选能力与独立JSON仍保留，可测试、可回退。NFR-001/002：无迁移、无权限扩大、无生产/凭据/用户数据写入；保留原脏工作区与`未命名文件夹/`。

<!-- section:verification -->

## 19. 验证证据

| 验收       | 状态 | 结果说明                                                                                                        |
| ---------- | ---- | --------------------------------------------------------------------------------------------------------------- |
| AC-001–005 | PASS | 分段、合同、预算、冻结参数、核验与失败处理单元/集成通过                                                         |
| AC-006     | PASS | 全部计划回放已执行，负面结果留证；候选默认发布门禁FAIL，因此默认策略不启用分段                                  |
| AC-007     | PASS | 静态、安全与逐包完整回归完成；API334 suites/4398 tests、Web435、Mobile346、Shared399、Extension11，共5589项通过 |

[RUNTIME] AC-001–005：分段/实际服务集成、冻结路由、CoVE与降级测试通过。最终边界定向3 suites / 46 tests：`/tmp/segmented-analysis.dl6TyD/final-boundary-tests.json`；包括512输出预算边界、异常JSON、首/次段失败、部分失败可见、多校回到单段、最大并发、无剩余预算不访问Provider、推荐/候选JSON校验。其他CoVE与降级测试包含在完整API回归中。

[RUNTIME] AC-006：首轮48运行、条件候选24运行、纠正mixed夹具补测2运行、Memory60次均执行完成。候选负面结果完整保存，不将降级算完整成功。默认策略mixed两次均保持REACH/TARGET/SAFETY及原概率并完整生成。具体源哈希、失败原因、完整分母见报告的四份JSON证据。

[RUNTIME] AC-007静态检查：API/Web/Mobile TypeScript均通过；API quality、routes/closure、integration、drift、AI环境/文档事实/企业控制检查均通过；file-size从45503降为45498，any-ratchet保持640，没有抬基线。ESLint零错误、3项非阻断类型警告；Prettier与git diff --check通过。

[RUNTIME] Secret：本轮新文件扫描无泄露；profile、routing、scripts扫描无泄露。整个ai-agent目录扫描报告2条已有content-moderation安全测试样例，文件与HEAD逐字一致，不是本轮新增密钥；保留扫描结果，不隐藏全目录扫描告警。

[RUNTIME] 回归历史：初始集成夹具构造器参数顺序错误，修正后通过；初始file-size/type-escape门禁分别通过模块提取和完整类型夹具修复，未放宽基线。`pnpm test`曾6/6成功（5项缓存）；强制无缓存并发回归出现13个Web 5秒超时并联动中止API/Mobile，记录于monorepo-final.log。未放宽超时或断言，改为Web最多2 workers、其余逐包重跑。

[RUNTIME] 最终逐包结果PASS：API334 suites/4398 tests，0失败、0跳过，证据`/tmp/segmented-analysis.dl6TyD/api-closure.json`；Web66文件/435项、Mobile39 suites/346项；Shared21文件/399项、Extension1文件/11项（强制无缓存轮通过）。合计5589项通过。没有将此前失败的并行命令改标为成功；本地验收使用降低测试并发后的逐包结果。不声称浏览器E2E、云部署或生产验收通过。

<!-- section:release-decision -->

## 20. 合并与发布结论

[DECISION] 本地交付采用默认单段策略，拒绝自动启用未过质量门禁的分段候选；合并/部署NOT CLAIMED，生产与真实凭据未变。后续由用户更新时启用服务端路由配置，使用与回退见 [AI_MODEL_USAGE.md](AI_MODEL_USAGE.md)。

[DECISION] 剩余限制明确交付：5校输入在24k预算下仍可能降级；本轮已完成识别、停止、保留结果、明确状态与留证，不宣称5校AI生成始终成功。真实录取准确率、独立招生专家语义评分、真实用户材料和未测试任务的模型替换均NOT CLAIMED。这些限制不靠增加预算、抹除失败或升级型号掩盖。
