# 申请分析共享请求与发布闭环

<!-- section:change-identity -->

## 1. 变更身份

- Change ID: AI-ANALYSIS-RELEASE-20260827；Owner Codex；状态 Intake Ready。
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

- In scope：[REQUESTER] 申请分析、模型路由现有改造、回归、真实合成评测、现有CI发布闭环。
- Out of scope：[DECISION] 新模型升级、24k/120s预算扩大、凭据轮换、IAM修改、数据库迁移、前端重做、MCP/Shell工具、真实用户材料评测；不触碰未命名文件夹。

<!-- section:users-permissions -->

## 6. 用户与权限

[DECISION] 管理端配置选模，客户端/Skills不能扩大权限。同一批次只能属于同一用户、预算、语言和运行。保留前轮原生Claude代码但不开启。仅已授权第三方Relay用于模型实验；不创建新Key。

<!-- section:user-flows -->

## 7. 流程与状态

[DECISION] 旧策略走旧路径；新shared-v1显式开启后，最多两校一组，共享事实和Schema→逐校证据验证→原归一化→组合分析。单校尾组正常完成；无数据保留unknown；超时/拒答/截断/重复或错学校ID失败；禁止拆组重试刷成功。业务状态仍fresh/degraded/原空态，不增加重启恢复承诺。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                                        | 来源        |
| ------- | --------------------------------------------------------------------------- | ----------- |
| FR-001  | 新显式shared-v1仅学校单段使用；最多2校同运行共享请求，不混用户/证据         | [DECISION]  |
| FR-002  | 严格Schema及本地逐校业务校验，拒绝重复/遗漏/错ID、未授权证据和不完整输出    | [DECISION]  |
| FR-003  | 五校至多3次学校请求加1次组合请求；共享原24k/120s和组合预留，usage不重复累计 | [DECISION]  |
| FR-004  | 固定中英/学校数/缺失与对抗样例，源版本冻结，真实小批通过后才扩大；失败留证  | [REQUESTER] |
| FR-005  | 发布前检查生产前置条件，通过现有CI部署及生产验收才宣称上线                  | [REQUESTER] |
| NFR-001 | 无权限/凭据/概率/用户数据改动，不放宽门禁或升预算                           | [REQUESTER] |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射           | Given / When / Then                                                                   |
| ------ | -------------- | ------------------------------------------------------------------------------------- |
| AC-001 | FR-001,FR-002  | 开启候选，输入1/2/3/5校，正确分组返回原顺序；不合法绑定拒绝；关闭不变                 |
| AC-002 | FR-002,NFR-001 | 错ID/证据/截断/拒答/跨运行请求不能被接纳；原概率和权限不变                            |
| AC-003 | FR-003         | 合成五校完整只需4次请求；累计token与Provider使用一致、无隐藏重试，超预算仍拒绝        |
| AC-004 | FR-004         | 固定小批完整、安全通过才扩大矩阵；同输入比较完整率/调用数/token/延迟，降级不计成功    |
| AC-005 | FR-005,NFR-001 | 本地回归/CI通过；目标Revision100%、健康/Cron/生产验收/清理/告警/备份PITR/回滚均有证据 |

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

[REQUESTER] 最新授权覆盖此前“不部署”，不覆盖凭据/IAM变更。[UNRESOLVED] 本机GCP重新认证及生产Provider失败根因阻塞发布，不阻塞本地改造；Owner 用户认证/Codex排查。[DECISION] 不伪造完成、跳CI或把旧成功证据当新版本验证。

<!-- section:implementation-plan -->

## 17. 实施计划

1. 读取资料、生产历史证据、规范；request/intake校验。
2. 实现shared-v1受限两校请求与失败/归属/预算测试。
3. 合成真实小批及固定矩阵，修复问题但保留每次失败源版本。
4. 本地回归、Git diff/密钥/文件审查，不提交原始评测或用户目录。
5. 生产前置条件恢复后通过既有CI发布、验收、清理和回滚证明；否则明确BLOCKED。

[DECISION] CI新增显式只读inspection入口，使用既有部署身份检查活动/最新Revision和错误类别；不访问Secret值、不改IAM。发布前在0流量版本运行完整Harness验收，仍保留100%后的原验收和回滚，不跳原门禁。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] FR-001–003：已实现shared-v1、同源严格Schema、逐校证据绑定及usage分摊。补充固定2校一波的调度，避免真实持久化耗时不同把请求拆散；一波只发一次Provider请求。旧路径不变。

[CODE] FR-005：现有CI增加0流量完整Harness验收和只读inspection；inspection模式强制排除部署，即使deploy输入保持默认true也不会部署。URL只输出已知公开Provider地址，其它地址不输出路径。

[CODE] 本机并发工作使pre-push的类型/Lint/集成检查均触发原120秒watchdog。新增仅本地的 `VERIFY_GATE_TIMEOUT_MS`（120000–900000）参数；默认和CI仍120000，检查项目/断言不变，不涉及产品运行预算。非法/无限值拒绝，单元测试覆盖。

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] 历史生产失败证据 `/tmp/harness-release-audit.HkmkWp/harness-acceptance.json`。本轮代码测试NOT RUN；本轮无云变更或合成账号写入。剩余风险见16节。

[RUNTIME] 本地阶段性证据：71定向、399 Shared、42 CI脚本通过；首次TypeScript发现响应finishReason类型不一致，修正后通过。新增持久化延迟回归先失败（预期4次、实际5次调用），固定波次后8项集成通过。初始缺少SchoolCard mock的失败另存，不混作产品缺陷。

[RUNTIME] 三个实现快照各8个真实工作流：候选均4/4完整、单段对照均2/4，五校对照均预算失败。先前矩阵在32/288完成后因持久化调度缺陷主动中断；32条已完成记录保留，不宣称矩阵通过；中断时在途请求用量未知，不宣称退费或零用量。后续必须绑定修复后源版本重新验收。

<!-- section:release-decision -->

## 20. 发布结论

[DECISION] 实施NOT RUN；合并NOT CLAIMED；生产BLOCKED（前置条件未确认）。Owner Codex继续在授权范围内完善和验证；不得据文档结构通过宣称上线。
