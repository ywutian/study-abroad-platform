# 选校预算修复发布与线上复验

<!-- section:change-identity -->

## 1. 变更身份

[REQUESTER] AI-SCHOOL-BUDGET-RELEASE-20260827；用户在本地修复报告后回复“可以”，批准进入发布和线上复验。Owner Codex。来源：AI_SCHOOL_WORKFLOW_BUDGET_2026-08-27.normalized.md及本任务。状态INTAKE。

<!-- section:executive-summary -->

## 2. 摘要

[CODE] 本地预算调度/严格流终态已通过350 suites/4596 tests。[DECISION] 经既有PR/CI发布，先复验失败组再全量评测；发布验收与业务质量分开记录，失败不抹除。

<!-- section:current-state -->

## 3. 现状

[RUNTIME] 当前01010-wul 100%，GPT-5.4，路由关闭，ready=true；将其作为本次回滚版本。origin/main=53885b74，与本地585a0ff7树无差异。原semantic评测三次在选校预算处失败。

<!-- section:target-outcome -->

## 4. 目标

[DECISION] 指定修复版本上线并通过独立验收；两个原失败case各三次合成复验，成功后280×3及独立盲审。失败保持明确状态，不声称“线上已彻底修复”。

<!-- section:scope -->

## 5. 范围

[DECISION] 预算核心7文件、上轮评测采集器5文件与配套文档；增加仅诊断用冻结case选择能力。提交严格按文件白名单，不包含其他收尾文档、评测JSON、用户目录。无迁移/Provider/模型/预算/权限/IAM变更，不增加工具或修改Skill版本。

<!-- section:users-permissions -->

## 6. 权限

[REQUESTER] 沿用既有直接100%发布策略，先无流量验收；失败使用既有CI回滚路径。合成测试不得审批真实业务写入。管理员凭据只在受保护CI使用，普通合成账号用于语义捕获；不输出密钥。

<!-- section:user-flows -->

## 7. 流程

[DECISION] 只读核对→白名单提交→PR门禁→合并→主线部署/迁移/无流量验收→100%→生产验收/健康/Cron/告警/备份→失败组复验→全量→盲审→报告/清理。任一硬失败停止扩大测试，不跳过门禁。

<!-- section:requirements -->

## 8. 需求

| ID      | 内容                                                                  | 来源        |
| ------- | --------------------------------------------------------------------- | ----------- |
| FR-001  | 经现有CI发布精确提交，保持原模型/预算/权限，保留旧Revision            | [REQUESTER] |
| FR-002  | 诊断subset只可选择冻结case，未知/重复拒绝；不能冒充完整采集或质量PASS | [DECISION]  |
| FR-003  | 原失败组通过后开展同源280×3、独立Codex盲审、固定门禁                  | [REQUESTER] |
| NFR-001 | 清理所有合成账号；原始输出只在私有临时目录，保留脱敏失败证据          | [REQUESTER] |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射           | Given / When / Then                                                                                                 |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| AC-001 | FR-001         | PR/主线门禁绿，指定Revision为100%，旧版可回滚，模型配置不变                                                         |
| AC-002 | FR-001/NFR-001 | 正式Harness验收及清理PASS，API/DB/Redis健康，34Cron一致/启用、HTTP驱动/无进程timer、未认证拒绝、告警0、备份PITR开启 |
| AC-003 | FR-002         | subset选2题时完成后仍complete=false/pass=false，diagnosticPass单独报告；默认仍280题                                 |
| AC-004 | FR-003/NFR-001 | 两失败case×3无错误终态、清理通过；然后3×280完整及原盲审质量阈值全部达到才声称业务质量通过                           |

<!-- section:technical-impact -->

## 10. 技术影响

[DECISION] 复用现有主线部署和采集器；subset仅本地Runner参数，不增加线上API或数据库。新一批最多6次首发诊断及840次首发全量请求，不改普通限流/配额。

<!-- section:nonfunctional -->

## 11. 安全与质量

[DECISION] 默认拒绝危险操作，不擅自确认真实告警；审批、预算、记忆边界继续由正式验收证明。工具结果/账号/原始回答不得进git或CI artifact。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 发布记录Commit/Revision/CI/流量；语义报告仅候选hash、计数、原因码、清理状态，不记录正文。subset和完整质量门禁明确分离。

<!-- section:test-plan -->

## 13. 测试

[DECISION] subset选择/完整性单测→Agent定向回归/TypeScript→PR完整CI→生产正式验收→失败组→全量独立盲审。Codex评分非人工招生专家结论。

<!-- section:rollout -->

## 14. 发布与回滚

[DECISION] 旧01010-wul保留。CI无流量验证后直接100%，不做5%/25%。正式验收或安全失败按既有回滚处理；语义诊断失败停止扩量、保留证据并按影响诊断，不提高预算换通过。

<!-- section:risks-dependencies -->

## 15. 风险

[ASSUMPTION] Relay/生产配额与网络影响长测；不能把本机合盖断线视作模型失败。原生产预算失败的所有成因未完全还原，修复后仍需真实验证。Owner Codex按门禁诊断。

<!-- section:open-decisions -->

## 16. 决策

[DECISION] 用户已批准本次上线；不授权顺带部署其他未提交变更或调整权限/密钥。当前没有阻塞性产品选择。

<!-- section:implementation-plan -->

## 17. 计划

[DECISION] subset辅助函数/测试→审查并提交白名单→PR→部署→生产门禁→分层复验→证据/清理。版本变化或失败时不生成混合来源的全量结论。

<!-- section:implementation-summary -->

## 18. 实施结果

[DECISION] 待执行；不提前声称发布完成。

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] 前置本地全量4596测试已通过；本轮AC-001至004待执行。

<!-- section:release-decision -->

## 20. 结论

[DECISION] IN PROGRESS；Owner Codex负责发布与复验，任一未通过项保持未通过。
