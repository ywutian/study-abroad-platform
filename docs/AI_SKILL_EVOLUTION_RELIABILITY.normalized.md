# Skills 自进化去重与回滚可靠性

<!-- section:change-identity -->

## 1. 变更身份

[REQUESTER] AI-SKILL-RELIABILITY-20260827；study-abroad-platform；来源：本任务只读复查及用户“可以”。Owner Codex；状态 Closed（本地实现与验证），生产未上线。源码基线92ea5808，对应已部署合并00fbfc2e。实现分支 `codex/skill-evolution-reliability`，尚未提交或部署。

<!-- section:executive-summary -->

## 2. 摘要

[CODE] 501条唯一Trace重复采集变成1002次；回滚只在每日进化周期调用。[DECISION] 改为数据库事务消费标记、安全失败落库后检查、每分钟持久化证据巡检及版本条件回滚。

<!-- section:current-state -->

## 3. 当前状态

[RUNTIME] 纯内存运行实际collectSignals：first=501，second=501，无新增Trace。只保留500个traceIds，查询每次从最早1000条开始。生产01008-sef启用Skills/evolution/auto-publish。[CODE] 安全统计take500且无排序，可能漏掉更晚失败；rollback未绑定被观察版本。

<!-- section:target-outcome -->

## 4. 目标

[DECISION] 同一终态Trace最多贡献一次信号集合；并发或重启不重复、失败可重试。持久化安全证据立即触发受控回滚；失去进程通知后由一分钟周期兜底，不声称数据库/调度故障下硬实时保证。

<!-- section:scope -->

## 5. 范围

[DECISION] 包含信号采集、Trace内部消费元数据、回滚监控/版本比较、模块接线、Cron manifest和相关测试。排除模型路由、候选生成策略、评测门槛、IAM、灾备、真实用户数据回填以及历史计数重算。

<!-- section:users-permissions -->

## 6. 权限

[DECISION] 保留ADMIN+AI_CONFIG与原Feature Flags；不新增客户端入口或工具。测试只使用合成数据。发布需遵守已有CI流程；本次先完成代码与验证，不以本地测试代替生产证据。

<!-- section:user-flows -->

## 7. 流程

[DECISION] 终态Trace落库→安全失败通知→校验活动版本和激活时间→原子回滚/审计。每日采集未消费记录→事务认领→各原因码计数→提交；任何一步失败整笔回滚。每分钟巡检独立于慢速候选评测。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                                                                   | 来源        |
| ------- | ------------------------------------------------------------------------------------------------------ | ----------- |
| FR-001  | 持久化逐Trace消费标记与信号增量同事务，取消500-ID数组去重依赖                                          | [REQUESTER] |
| FR-002  | 超过1000条积压可分批前进；并发、重启、重复调用和事务失败不丢失/重复新增信号                            | [DECISION]  |
| FR-003  | 安全失败落库后触发监控；一分钟HTTP Cron兜底，无第二个模型调用                                          | [REQUESTER] |
| FR-004  | 安全查询不受500条统计窗口限制；自动回滚绑定观察到的版本与激活时间，重复/陈旧通知不得回滚后来发布的版本 | [DECISION]  |
| NFR-001 | 保持权限、门槛、现有Run固定版本、审计和隐私边界；失败日志脱敏                                          | [REQUESTER] |
| NFR-002 | 迁移仅增加内部字段；保留旧数据/计数，明确新旧消费者切换限制                                            | [DECISION]  |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射            | Given / When / Then                                                                           |
| ------ | --------------- | --------------------------------------------------------------------------------------------- |
| AC-001 | FR-001,FR-002   | 501及1501条唯一记录，多次/重启/并发采集，增量之和等于唯一记录数，再采集为0                    |
| AC-002 | FR-001,FR-002   | 计数写入失败，消费标记和已写增量全部回滚，重试只计一次                                        |
| AC-003 | FR-003,NFR-001  | 持久化硬安全失败即调用监控；普通成功、开关关闭不触发；失败通知保留持久证据并告警              |
| AC-004 | FR-003,FR-004   | 进程重启/通知丢失和第501条安全失败，独立周期仍发现并回滚                                      |
| AC-005 | FR-004,NFR-001  | 重复/并发通知、发布竞争、同版本重新激活：只有匹配版本/激活时间能改变指针，审计一次，旧Run不变 |
| AC-006 | NFR-001,NFR-002 | 迁移、模块接线、Cron manifest、定向和完整相关回归通过；生产未运行项明确标注                   |

<!-- section:technical-impact -->

## 10. 技术影响

[DECISION] 为AgentEvaluationTrace增加nullable skillSignalConsumedAt及查询索引；旧行迁移时标为切换前已处理，未来新行默认NULL。现有终态Trace更新不清除此标记，运行重连不能重新计数。增加独立监控服务及每分钟Cron，旧日任务仍可调用同一监控。API公开合同不变；不新增凭据。

<!-- section:nonfunctional -->

## 11. 安全与质量

[DECISION] 消费只存时间戳，既有Trace保留策略自动清理；不新增原文、用户资料或模型调用。反复通知幂等；回滚检查失败不能伪报成功。前端/国际化N/A，无UI改动。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 复用原Skill审计及告警服务；只用稳定错误码和聚合数。明确直接触发、定时兜底、版本陈旧跳过和失败重试的测试证据。

<!-- section:test-plan -->

## 13. 测试计划

[DECISION] 先保存旧501重复计数的红测试。单元覆盖事务/批次、即时触发、完整安全查询及比较回滚；真实Postgres合成E2E验证并发、事务回滚和重启。模块编译验证注入；Cron生成及负向门禁。外部模型N/A，修复不涉及生成质量。

<!-- section:rollout -->

## 14. 发布与回滚

[DECISION] 仅增字段兼容旧代码，但旧消费者不认识消费标记：发布前必须暂停旧版自动进化及手动cycle，排空在途cycle，再迁移并通过0流量验收后直切100%，验证新消费者后恢复。不能并行运行新旧采集器。旧计数不可从已截断ID精确重建，本次保留不清零、不重算；历史评测结论不因此升级。回滚代码保留字段，并保持进化暂停直到重新验证；不得声称回滚旧代码仍具备新去重保证。

<!-- section:risks-dependencies -->

## 15. 风险

[DECISION] 依赖Postgres事务及可用HTTP Scheduler。旧行已处理标记会跳过尚未采集的切换前证据，这是避免旧计数再次膨胀的保守切换边界，原始脱敏Trace仍保留可审计。历史重算另行授权。新Cron不会评测或发布候选，仅监控和回滚。

[CODE] Scheduler复用现有部署配置：失败重试最小退避3600秒。正常计划每分钟运行不等于故障后60秒恢复SLO；本次没有更改全局调度重试策略。需在生产验收记录实际触发与失败恢复时间，不用本地手动调用下一tick的测试替代调度证据。

<!-- section:open-decisions -->

## 16. 决策

[DECISION] 只实施两项已批准修复；使用原开关，不增加模型/权限。工程巡检频率一分钟为本次实现选择，Owner Codex，按调度与故障测试验证。生产切换需要旧周期暂停与排空证据；本地修复不阻塞于该生产前置项。

<!-- section:implementation-plan -->

## 17. 实施计划

[DECISION] 1红测试；2事务采集/迁移；3独立监控与指针比较；4Trace通知与模块接线；5单元/实库/回归；6更新结果和发布前置清单。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] 仅更改以下可靠性路径，原候选生成、评测门槛和业务工具保持不变。

| Requirement    | 实现                                                                                                                  | 结果与边界                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| FR-001, FR-002 | `agent-skill-signal-collector.service.ts`、`schema.prisma`、迁移 `20260827230000_skill_signal_consumption`            | 逐Trace条件认领与所有原因码计数同事务；分批读取未消费记录，不覆盖已有候选的attempt元数据  |
| FR-003         | `agent-evaluation-trace.service.ts`、`agent-skill-monitor.service.ts`、`ai-agent.module.ts`、`.github/cron-jobs.json` | 持久化后即时检查，独立一分钟Cron；启用进化却缺少监控依赖时启动失败；调度失败告警并返回503 |
| FR-004         | `agent-skill.service.ts`、`agent-skill-monitor.service.ts`                                                            | 全激活区间安全查询；串行化事务校验版本和激活时间；竞争失败留待下次检查，不回滚其他版本    |
| NFR-001        | monitor及Trace测试、Skills策略回归                                                                                    | 不增加模型调用、工具或权限；新增监控错误仅含稳定原因码；旧Run固定版本不改变               |
| NFR-002        | additive migration、Skills操作文档                                                                                    | 旧行标记为切换前消费、新行NULL；保留旧计数；锁等待上限5秒、单条语句上限60秒               |

[CODE] 原 `AgentSkillEvolutionService` 保留委托接口，日周期先做监控再采集/评测；完整统计阈值和原暂停规则未改动。统计窗口显式采用最新500条，硬安全查询不采样。

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] 旧代码红测试：501条输入第一次计501，第二次错误地再计501（expected 0 / received 501）。修复后同一测试通过。以下为本地合成数据证据，不是生产模型质量评估。

| AC     | 结果         | 测试/证据                                                                                                                                                                   | 边界                                                                                    |
| ------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| AC-001 | PASS         | `agent-skill-signal-regression.spec.ts`：501重复、1501分批；`test/skill-evolution-reliability.e2e-spec.ts`：两个服务实例竞争消费1501条，所有增量合计1501，再创建实例消费为0 | PostgreSQL16.11真实事务；不以模拟事务代替并发证据；重启指服务实例重建，并非生产主机重启 |
| AC-002 | PASS         | 实库故意使第二个原因码写入违反临时约束：第一个增量和消费标记同时回滚；移除约束后重试计2个原因码，再次计0                                                                    | 仅隔离本地测试数据库，约束在finally移除                                                 |
| AC-003 | PASS         | Trace持久化顺序测试、启动缺依赖失败、普通成功不触发、关闭进化不读数据库；即时失败告警且不改变已完成Run、下个周期重试                                                        | 不模拟线上Scheduler延迟；不能发现没有原因码证据的违规                                   |
| AC-004 | PASS         | 实库502条：1条较早安全失败+501条正常样本，独立巡检回滚1次；再次0次                                                                                                          | 真实JSON筛选，超出最新500条仍能发现                                                     |
| AC-005 | PASS         | 两个真实串行化回滚竞争，仅一次成功、一次审计、旧Run仍v2；新版本/同版本新激活/已回滚状态均拒绝陈旧观察                                                                       | 实库与单元分别覆盖事务竞争与陈旧观察；生产发布竞争尚未演练                              |
| AC-006 | PASS（本地） | 96个迁移、schema drift为0、模块接线、34项Cron、TypeScript、质量检查、36/36负向门禁和全工作区测试通过                                                                        | 生产切换待本次发布验收                                                                  |

[RUNTIME] 定向单元8 suites /45 tests PASS；实库E2E1 suite /5 tests PASS；最终Agent回归97 suites /977 tests PASS。全工作区测试如下：

| 范围              | 结果                        | 本次执行边界                 |
| ----------------- | --------------------------- | ---------------------------- |
| API               | 346 suites /4554 tests PASS | 本次重新运行，包含Agent977项 |
| Web               | 66 files /435 tests PASS    | Turbo缓存，相关源码未变      |
| Mobile            | 39 suites /346 tests PASS   | Turbo缓存，相关源码未变      |
| Shared            | 21 files /399 tests PASS    | Turbo缓存，相关源码未变      |
| Browser extension | 1 file /11 tests PASS       | Turbo缓存，相关源码未变      |

[RUNTIME] `pnpm check`首次完成36项负向门禁及其余静态检查，最后因新monitor文件一处格式问题退出。格式修复后，`pnpm format:check && pnpm test`通过（6/6任务成功，5缓存包含构建任务）；没有把首次失败覆盖成成功。最终TypeScript和API quality亦通过。工作区总测试5745项，不能把其中缓存结果称为本次全新运行；独立5项实库E2E不包含在此总数中。

[RUNTIME] 本地原始日志仅在临时目录：`/tmp/skill-reliability-unit-final.log`、`/tmp/skill-reliability-e2e-final.log`、`/tmp/skill-reliability-migration-drift.log`、`/tmp/skill-reliability-check.log`（保留首次格式失败）、`/tmp/skill-reliability-agent-final.log`、`/tmp/skill-reliability-test-all.log`；可重跑命令如下，数据库URL必须指向已迁移的专用本地测试库：

```sh
pnpm --filter api exec jest --runInBand --silent agent-skill agent-evaluation-trace.service.spec.ts
pnpm --filter api exec jest --config test/jest-e2e.json --runInBand skill-evolution-reliability.e2e-spec.ts
pnpm --filter api exec jest --runInBand --silent ai-agent
pnpm check
pnpm lint:cron-manifest
pnpm exec tsx scripts/check-migration-safety.ts --new-only
```

[RUNTIME] Gitleaks扫描Skills目录及新增E2E均无泄漏。迁移安全检查0error/1warning：普通建索引短暂阻塞写入，已经设置超时，但仍需低流量窗口和切换证据。无生产写入，无模型调用，无权限变更；用户已有文档、未跟踪JSON和`未命名文件夹/`保持不动。

[RUNTIME] 实库测试后Run、Trace、Signal、Audit、Deployment、User计数均为0；专用临时数据库 `/tmp/skill-reliability-pg.YcsrVg/data` 已停止，`pg_ctl status` 确认no server running。测试日志和空测试库保留在临时目录便于审计，没有删除用户文件或操作其他数据库进程。

<!-- section:release-decision -->

## 20. 结论

[DECISION] 本地实施结论CLOSED；合并准备度READY（尚未提交/PR/远端CI，不代表已合并）；发布准备度BLOCKED于生产切换前置检查。本次只修复两项已批准问题，未把其余审计清单默认为完成。

- 未执行：PR/CI、生产暂停/排空、生产迁移与新Revision、100%切换、线上验收/回滚演练。没有新的生产版本或生产验收结论。
- 下一动作：本地回归、合成数据清理、临时进程停机及Git diff审查已完成。发布负责人按第14节暂停旧消费者、迁移、0流量验收后直切100%，验证34个Cron及新消费/回滚路径后恢复进化。
- 不可省略：上线前确认现存Signal计数是否已被旧版本污染。本次不自动重算历史，原先被污染的计数不会因为修复而变正确；不得把这些计数作为新的无污染评测证据。

## 2026-08-27 发布续办记录

[REQUESTER] 用户“继续”授权继续发布上述已完成修复，沿用现有CI，不更改模型、IAM、数据恢复或历史计数。

[RUNTIME] 发布前生产01008-sef为100%；回滚候选01006-xev Ready。历史Signal共2组：STREAM_ABORTED=15、REPLAN_EXHAUSTED=52，各自计数等于保留的唯一trace ID数；最大52未触发500截断，未发现本缺陷导致的重复计数。当前Trace=0，评测4条均FAILED、无RUNNING；6个Agent均为bootstrap活动版本，无自动发布记录。历史计数保留，不清零或重算，不宣称被清理的原始Trace还能回放。

[DECISION] 发布前暂停唯一agent-skill-evolution Scheduler；发布窗口冻结手动进化操作，不调用管理cycle入口。用脱敏请求日志、RUNNING评测数量和数据库活动查询检查排空；不撤销管理员权限、不改IAM。若出现新手动cycle或在途评测，则停止迁移，排空后再继续。保留暂停前状态，仅新版本验证成功后恢复调度。失败时维持进化暂停并按已有CI回滚路径恢复业务流量。
