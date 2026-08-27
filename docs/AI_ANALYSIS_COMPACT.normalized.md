# 申请分析：紧凑输入、严格输出与组合预算

<!-- section:change-identity -->

## 1. 变更身份

- Change ID: AI-COMPACT-20260827。
- [REQUESTER] 来源：本任务上一轮四步方案与用户“可以”；原报告 `reports/AI_SEGMENTED_ANALYSIS_2026-08-26.md` 保留不覆盖。
- [DECISION] Owner Codex；本地实现和验证，不提交、不上线。状态 Closed（本地实现与负面评测闭环）；默认切换门禁未通过。

<!-- section:executive-summary -->

## 2. 摘要

- [CODE] 第二段重复完整输入，组合阶段重复完整学校结果；格式仅靠提示词与事后校验。
- [REQUESTER] 精简重复输入、严格Schema、为组合预留预算，然后同条件复测。
- [DECISION] 新行为显式受服务端路由可选字段控制，原配置不变；不提高24k/120s预算，不换模型。
- [DECISION] 完整成功率不低于对照且安全检查全部通过才考虑更新推荐策略；降级不计完整成功。

<!-- section:current-state -->

## 3. 当前状态

- [CODE] `analysis-segments.ts` actions使用 `{...input, priorStage: merged}`。
- [CODE] Profile组合输入使用完整schoolResults；academicFacts目前只提供给分段。
- [CODE] ModelRouter已支持response_format透传及计入输入预算，无需新Provider。
- [RUNTIME] 原首轮单段22/24、全分段15/24；五校仍可能预算降级。旧失败留证。

<!-- section:target-outcome -->

## 4. 目标行为

[DECISION] 返回原API合同和原概率。精简仅在模型输入边界进行，不删业务响应、证据或原持久化数据。成功完整返回，异常显式degraded，不能默默修JSON或放宽事实校验。

<!-- section:scope -->

## 5. 范围

- In scope：[REQUESTER] 输入白名单、阶段化摘要、严格输出、预算预留、单元/集成/实际合成对照。
- Out of scope：[DECISION] 生产/.env/密钥/DB迁移/新Provider/权限/概率算法/前端/Memory；保留已有脏工作区和未命名文件夹。

<!-- section:users-permissions -->

## 6. 用户与权限

[DECISION] 原所有用户/中英文共享服务；路由由服务端固定，客户端和Skill不能设置新策略字段。仅用户已指定Relay和合成资料用于实测，不使用真实业务工具或账号。

<!-- section:user-flows -->

## 7. 流程与状态

[DECISION] 旧配置完全走旧路径。新配置：准备必要事实→预留组合预算→并发学校分析→释放预留→组合分析→原校验与归一化。分段第二段只接收必要事实和选定前段字段。无数据保留unknown，超时/离线/拒答/截断走原失败路径，不自动重复成功段。运行级预算与快照不变。

[CODE/DECISION] 紧凑学校并发上限为min(2,原配置)，降低同时预留导致的过早拒绝；旧模式不变。未宣称降低并发一定更快。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                               | 来源        |
| ------- | ------------------------------------------------------------------ | ----------- |
| FR-001  | 新策略使用白名单事实和窄组合摘要；单段/分段获得相同事实            | [REQUESTER] |
| FR-002  | 使用同源Zod与严格JSON Schema；本地证据/概率/最终业务校验仍必须通过 | [REQUESTER] |
| FR-003  | 在原共享预算内预留组合额度，幂等释放，不能伪造用量或增加额度       | [REQUESTER] |
| FR-004  | 新可选路由字段冻结，旧字段缺省不改变hash/行为                      | [DECISION]  |
| FR-005  | 固定夹具、失败留证、有上限实测并做分项统计                         | [REQUESTER] |
| NFR-001 | 不改凭据、生产、业务权限或权威概率，不记录私有数据                 | [REQUESTER] |
| NFR-002 | 不用放宽预算/测试断言/身份校验掩盖失败                             | [REQUESTER] |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射            | Given / When / Then                                                                             |
| ------ | --------------- | ----------------------------------------------------------------------------------------------- |
| AC-001 | FR-001          | 相同合成事实投影后，GPA/测试/轮次/政策/资助未知/证据ID保留，重复长文本不进入次段/组合           |
| AC-002 | FR-002          | 调用包含strict schema；额外字段、错层级、未知证据、拒答和截断不算成功；不支持时不撤销schema重试 |
| AC-003 | FR-003          | 学校并发调用不能消费预留；释放后组合可用；重复释放不增额度，错误/小预算有确定结果               |
| AC-004 | FR-004          | 无新字段保留旧流程/哈希；不合法任务字段/配置被拒绝                                              |
| AC-005 | FR-005,NFR-002  | 小批兼容门禁通过后，固定1/2/3/5校×中英文×6场景×3重复做同条件对照；失败保留、受限批次可恢复      |
| AC-006 | NFR-001,NFR-002 | 定向/集成/完整API回归与类型/质量/格式检查；无生产或密钥改动                                     |

<!-- section:technical-impact -->

## 10. 技术与数据影响

[DECISION] profile小型模块、现有BudgetTracker、路由策略及测试；可选 `analysisOptimization: compact-v1` 仅分析任务且明确execution时合法。无新DB或API响应字段。使用已有OpenAI SDK的Zod Schema helper，不新增依赖；当前Relay支持性由合约实测确定。

<!-- section:nonfunctional -->

## 11. 安全与质量

[DECISION] 事实投影确定性、不调用模型做摘要、不截断关键约束。生成文本仍不可信。严格Schema不等于事实正确。已有推荐配置默认不变；所有测试不执行业务工具。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 保留已有调用trace、策略hash、失败码、usage；实测证据区分完整生成/正确降级/结构/事实检查/token/耗时，第三方usage非账单。

<!-- section:test-plan -->

## 13. 测试计划

- [DECISION] Unit AC-001–004：投影、Schema同源、预留并发/幂等/预算不足、旧策略。
- [DECISION] Integration AC-001–004：实际Profile→Router→Provider，mock HTTP，五校、失败、证据与概率。
- [DECISION] Live AC-005：先严格Schema小批；不通过则停止扩大测试，保留阻塞证据。通过后固定矩阵288个workflow，分批有上限，不重试刷分。
- [DECISION] Regression AC-006：完整API Jest、相关包回归、TypeScript与质量检查；不声称浏览器或生产E2E。
- [DECISION] 语义由Codex针对性复核，不是独立专家或录取校准评估。

<!-- section:rollout -->

## 14. 发布与回滚

[REQUESTER] 本地修改，用户自行更新。[DECISION] 未过同条件门禁不改默认推荐配置；去掉analysisOptimization恢复原行为。无迁移，不改云开关。运行快照沿用旧冻结规则。

<!-- section:risks-dependencies -->

## 15. 风险

- [EXTERNAL] 官方Structured Outputs要求所有对象关闭额外字段，输出仍可能事实错误；https://developers.openai.com/api/docs/guides/structured-outputs 。
- [ASSUMPTION] Relay可能不支持strict，Owner Codex，小批验证，不将HTTP200单独作为支持证据。
- [CODE] 预算基于估计，真实usage可能超估计；预留不等于严格计费保证。
- [DECISION] 若精简仍无法完成五校，不提高预算掩盖，保留候选且报告限制。

<!-- section:open-decisions -->

## 16. 决策与假设

- [REQUESTER] 已授权四步方案；不升级模型、不提高原运行预算。
- [ASSUMPTION] 采用显式compact-v1整体开关作为候选边界；Owner Codex，用兼容测试验证。
- [DECISION] 实测凭据仅使用此前用户指定Relay；没有可安全使用凭据时停止实测、完成离线验证，不申请新服务或Key。
- [DECISION] 无阻塞本地实现的未决事项；Relay能力和实测结果是发布门禁，不预设通过。

<!-- section:implementation-plan -->

## 17. 实施计划

1. request/intake验证，保留原来源与证据。
2. 实现紧凑事实、同源Schema、共享预算预留与显式策略。
3. 定向/集成测试，修复代码问题后再做Relay合约小批。
4. 小批通过再跑有上限矩阵，按证据决定是否推荐。
5. 完整回归、diff审查、closure及准确边界报告。

<!-- section:implementation-summary -->

## 18. 实施结果

| 需求        | 代码/合同                                                            | 实际结果与偏差                                                                                  |
| ----------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| FR-001      | `analysis-compact.ts`、`analysis-segments.input.ts`、Profile service | 确定性事实投影、窄组合摘要，原API与概率保留；不在此层截断约束                                   |
| FR-002      | `analysis-segments.contract.ts`、`analysis-segments.ts`              | 同源Zod/strict schema、本地验证、完整段实际prompt审计；首轮百分比失败后加强schema，不修改旧分数 |
| FR-003      | `agent-run-context.ts`、`analysis-compact.ts`                        | 内部hold、幂等释放、错误释放；上限6000/四分之一，不能保证真实usage不超估计                      |
| FR-004      | `model-routing.policy.ts`、兼容测试                                  | 可选compact-v1仅分析显式execution；旧hash与路径兼容                                             |
| FR-005      | `ai-compact-analysis-{cases,eval}.ts`、报告及evidence JSON           | 41次真实请求；8工作流3完整；288模拟；真实大矩阵因门禁拒绝                                       |
| NFR-001/002 | 保留默认与既有worktree、secret扫描、回归                             | 不更改生产/密钥/权限/模型/总预算；规模检查通过模块提取修复而非抬基线                            |

[CODE] 为保持文件规模，原filterAllowedEvidenceIds纯函数移至既有runtime helper并保留service导出；不改变证据过滤语义。

<!-- section:verification -->

## 19. 验证证据

| AC     | 状态         | 证据与边界                                                                                                  |
| ------ | ------------ | ----------------------------------------------------------------------------------------------------------- |
| AC-001 | PASS         | 投影/实际服务mock HTTP集成；并非真实模型语义100%正确                                                        |
| AC-002 | PASS（合同） | 定向拒绝测试；初始4/4和加强后4/4真实Schema探针；8工作流仍含历史失败，未覆盖最终版本完整真实workflow         |
| AC-003 | PASS（机制） | 并发/幂等/错误/小预算测试，模拟五校分段仍降级；五校完整生成目标未达                                         |
| AC-004 | PASS         | 旧hash、非法任务字段、默认不变；定向测试                                                                    |
| AC-005 | BLOCKED      | 初始真实小批3/8完整，按门禁停止288真实矩阵；288模拟完成，不替代真实评测                                     |
| AC-006 | PASS         | 定向65、API335 suites/4414 tests、Shared399通过；TypeScript/API quality/路由/集成/drift/配置文档/secret通过 |

[RUNTIME] 源版本、41次真实请求、157445报告tokens、逐运行失败、最终Schema探针与模拟manifest见 `reports/AI_ANALYSIS_COMPACT_2026-08-27.evidence.json`。临时日志根 `/tmp/analysis-compact.bMBh4V`；完整小批在 `/tmp/analysis-compact.1ZO88o`；最终Schema `/tmp/analysis-compact.dBNuPc`；288模拟 `/tmp/analysis-compact.XZPLop`。

[RUNTIME] 65定向：`targeted-final.json`；Shared399：`shared-tests.log`；静态：`types-final.log`、`lint-closure.log`（零错误、2个继承的非阻断类型警告）。规模45503→45480；any640，不抬基线。Profile/scripts/routing三目录gitleaks均无泄露。大矩阵无合格pilot时命令返回PASSING_PILOT_REQUIRED，未读取凭据或调用Provider。

[RUNTIME] 保留初始失败：测试fixture类型不完整；旧测试修改环境导致后续测试继承1-token限额；代码规模越线；首次lint格式错误。分别修复fixture、恢复测试环境、提取模块、格式化，未放宽断言。真实小批失败没有重跑刷分。

[RUNTIME] 完整API：335 suites/4414 tests，零失败、零跳过，810.13秒；`api-regression.json`与`api-regression.log`。Shared21 files/399 tests；合计4813项不同包测试通过，定向65包含在API总数中，不重复累计。Web/Mobile/Extension未重新执行，因为本轮未改前端或共享合同，不沿用旧轮数冒充本轮结果。

[DECISION] 清理：测试与实测进程均已结束；没有生产数据/账号/业务工具写入，合成证据保留，凭据未写入文件。本轮不清理用户目录或其他任务的进程。

<!-- section:release-decision -->

## 20. 合并与发布结论

[DECISION] 本地实现与评测闭环CLOSED，默认切换REJECTED；合并NOT CLAIMED、生产发布NOT RUN。不是所有验收项均通过：AC-005因小批门禁阻止扩大真实评测；完整API与静态回归通过不能抵消真实小批失败。

[DECISION] 下一步需要单独评估多校共享事实/批量推理，保留每校证据归属和失败隔离；这属于后续设计，不通过加预算、放宽断言或更换5.6掩盖当前限制。由用户决定后续实施，当前不启用该候选。
