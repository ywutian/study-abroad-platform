# Embedding 契约与验收闭环

<!-- section:change-identity -->

## 1. 变更身份

[REQUESTER] AI-EMBEDDING-20260827，study-abroad-platform，Owner Codex。来源为本任务Embedding诊断及用户“可以”。起始main为08ab56fe；状态Intake Ready。

<!-- section:executive-summary -->

## 2. 摘要

[CODE] 聊天上线不证明向量生成可用。Embedding失败返回空向量，记忆退回全文搜索；旧测试只覆盖无key和余弦函数。[DECISION] 修复契约和隐私问题，并把真实向量/记忆边界纳入可重复验收，失败不得声称闭环。

<!-- section:current-state -->

## 3. 当前状态

[RUNTIME] 上轮只读核查01006-xev为100%，Embedding仍为xh.v1api.cc、text-embedding-3-small。24小时旧Revision有一条直接403及一条空向量降级日志，新Revision无匹配错误不代表成功。[CODE] 数据库vector(1536)，缓存只按原文本hash，日志包含上游错误正文；Memory保存可无向量、搜索可FTS降级。

<!-- section:target-outcome -->

## 4. 目标

[DECISION] 合法向量才缓存/写库，批次映射完整，失败保留确定降级和脱敏原因；真实调用、入库/语义召回、用户隔离及清理分别有证据。

<!-- section:scope -->

## 5. 范围

[REQUESTER] 包含已有EmbeddingService、记忆边界、专项合约与发布验收。[DECISION] 不改聊天模型，不换Embedding模型/供应商，不改1536维schema，不回填真实记忆，不轮换key/IAM，不放宽预算或门禁。原两份聊天闭环文档与9份未跟踪评测JSON及用户目录保留。

<!-- section:users-permissions -->

## 6. 权限

[DECISION] 真实模型探测只向当前已配置的供应商发送固定合成文本，复用原凭据但只在进程内处理。生产数据验收仅一次性合成用户。管理员诊断不得接受任意URL、用户文本或用户ID以扩权；任何写入都须绑定synthetic范围并finally清理。

<!-- section:user-flows -->

## 7. 流程

[DECISION] 输入→有效缓存→有界请求→响应契约校验→缓存/向量入库→同用户检索。无key/空输入/超时/认证拒绝/坏JSON/维度错误均确定降级，不把降级算真实向量成功。缓存故障仍可请求；批次失败保留已命中合法缓存。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                                                     | 来源        |
| ------- | ---------------------------------------------------------------------------------------- | ----------- |
| FR-001  | API及缓存向量必须为1536个有限数且非零；响应model/index/count一致，批次拒绝重复/遗漏/错位 | [DECISION]  |
| FR-002  | 新缓存命名空间包含provider地址、模型、维度和实际截断输入的hash，不读旧缓存、不含原文/key | [DECISION]  |
| FR-003  | 不记录上游正文/网络原始错误；认证和契约失败不重试，连接及读取均有真实截止，禁重定向      | [DECISION]  |
| FR-004  | 增加合成单条/批量、缓存、语义相似度合约探测；无真实成功则不PASS                          | [REQUESTER] |
| FR-005  | 覆盖记忆向量存储、跨说法召回、用户隔离、失败降级与清理，并集成发布门禁                   | [REQUESTER] |
| NFR-001 | 不改供应商/key/schema/历史向量；隐私与权限不扩大，保留现有公共返回类型                   | [REQUESTER] |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射           | Given / When / Then                                                                          |
| ------ | -------------- | -------------------------------------------------------------------------------------------- |
| AC-001 | FR-001         | 合法单/批响应返回原顺序；错误模型/索引/维度/NaN/Infinity/零向量拒绝且不缓存                  |
| AC-002 | FR-002         | 同输入同配置命中；换模型/地址不串缓存；旧命名空间忽略；失败批次保留已缓存结果                |
| AC-003 | FR-003         | 合成敏感错误正文不出日志；401/403不重试；挂起fetch/body按截止结束，迟到成功不缓存            |
| AC-004 | FR-004         | 真实已配置接口返回合规向量，固定正向语义对高于负向对；任何失败保留并返回非零                 |
| AC-005 | FR-005,NFR-001 | 合成记忆有非空向量且被同用户改写查询召回、他用户不可见；故障回退不越权；所有合成数据清理通过 |
| AC-006 | FR-005,NFR-001 | 全量回归/发布门禁通过，新Revision100%、健康/Cron/告警/备份/回滚目标有证据                    |

<!-- section:technical-impact -->

## 10. 技术影响

[DECISION] 重用Nest/Redis/Prisma/pgvector/现有Harness，不建第二套记忆。新缓存前缀自然TTL淘汰旧缓存，不删除真实数据。响应仍number[]/number[][]；无DB迁移。真实上游不可用时可完成本地加固，但阻止发布成功结论。

<!-- section:nonfunctional -->

## 11. 安全与质量

[CODE] 对现有Prisma慢查询/开发查询日志增加Memory、向量类型和路由向量表的定向脱敏，避免上游日志已脱敏但SQL日志再次暴露向量或记忆参数；非记忆查询诊断行为保持不变。
[DECISION] 每次上游请求保持15秒上限，输入仍8000字符，拒绝未知向量结构；缓存不含明文，诊断不输出向量、记忆文本、token或用户ID。UI/国际化N/A，无前端改动。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 记录固定失败分类、HTTP状态、维度/数量、耗时与测试布尔值。缓存健康/熔断状态不是实时上游健康证明。Provider自报model不是独立身份鉴定。

<!-- section:test-plan -->

## 13. 测试计划

[DECISION] 单元：输入、向量契约、缓存污染、脱敏、重试/超时、批次顺序。集成：原Memory服务与真实pgvector测试库，合成租户隔离及FTS降级。Live：原Provider固定合成探测。生产：现有Runner及严格artifact验证，前后两轮与清理。工程/合成检索测试不等于真实录取质量评测。

<!-- section:rollout -->

## 14. 发布与回滚

[REQUESTER] 沿用既有直接上线授权与0流量验收→100%流程，不跳CI。[DECISION] 原接口真实探测失败时不切供应商或放宽验收，记录准确阻断。若发布，保留当时已确认的活动Revision；旧缓存/已有数据库兼容，按原流水线回滚。

<!-- section:risks-dependencies -->

## 15. 风险

[TEST] 实库集成发现旧SQL把整数向量绑定为bigint[]，不能直接cast到vector；改为参数化JSON数组文本。同时发现内容更新后Embedding失败会保留旧内容向量，改为同一UPDATE清除旧向量；增加实库回归，不变更schema或回填历史数据。
[CODE] 现有可选Resilience从Memory子模块未必注入，故服务自身必须有截止。缓存升级有冷启动请求成本。[EXTERNAL] OpenAI兼容契约支持float向量、model及index：[API参考](https://developers.openai.com/api/reference/resources/embeddings/methods/create)。第三方是否兼容以实测为准。

<!-- section:open-decisions -->

## 16. 决策

[DECISION] 本次只加固现有配置，不涉及新凭据/供应商选择。原接口无法用时需报告外部阻断；不擅自推断另一接口与历史向量空间兼容。Owner Codex。

<!-- section:implementation-plan -->

## 17. 实施计划

[DECISION] 先核验现有配置与合成API→实现共享向量解析/请求边界→补红绿测试→真实合约与Memory验收→按可用性决定是否满足发布前置条件→完整CI/生产闭环/记录。每一失败保留，不以重跑掩盖失败。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] 已实现共享向量契约、有界请求、v2缓存命名空间及单元测试。新增ADMIN+AI_CONFIG受保护的embedding-acceptance接口，双开关控制，只接受两个不同的合成账号，内容由服务端固定生成。复用Memory服务完成实际向量入库、改写召回、双用户隔离；请求内无key适配器测试既有FTS降级，不改变全局实例。随机category绑定清理范围，finally清理并检查残留。Runner独立创建/清理第二账号，严格artifact逐项检查布尔证据。保持已有聊天闭环文档不变。

<!-- section:verification -->

## 19. 证据

[TEST] 最终本地全仓库pnpm check通过：API 343 suites/4528 tests，各workspace测试任务全通过；36/36负向门禁证明；CI helper 76/76；最终API完整tsc通过。全量测试中旧chat/Embedding边界测试仍使用2维响应，已更新为真实1536维契约并保留原凭据/URL隔离断言。
[RUNTIME] 当前01006-xev对应既有Embedding接口预检：单条HTTP200、1×1536、1622ms；批量HTTP200、2×1536、944ms。随后真实现有Provider+临时pgvector端到端：11224ms，单条/批量、缓存一致、正负语义排序、实际向量存储/召回、双用户隔离、无key降级与清理全部true，临时账号清理通过。未写生产记忆。[TEST] AI Agent回归93 suites/930 tests；新增专项10 suites/87 tests；实库E2E 2/2；严格artifact测试14/14。TypeScript通过，API quality/路由/集成/any/file-size门禁通过。最初的测试参数/类型错误、bigint[]向量实库失败已保留并修复。AC-005生产与AC-006发布尚NOT RUN。

<!-- section:release-decision -->

## 20. 结论

[DECISION] 实施进行中，发布NOT CLAIMED；Owner Codex按上述步骤推进，真实供应商失败不得标记CLOSED。
