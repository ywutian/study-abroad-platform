# AI Agent Harness：声明式 Skills 与受约束自进化

**最后更新：2026-08-27**

## 目录

- [边界](#边界)
- [运行闭环](#运行闭环)
- [发布门禁](#发布门禁)
- [运行固定与回滚](#运行固定与回滚)
- [Feature Flags](#feature-flags)
- [管理接口](#管理接口)
- [生产验收](#生产验收)

## 边界

本模块复用现有调用链、OpenAI-compatible Provider、工具注册表、权限策略、Agent Run、会话和记忆。它不会加载 Bear Agent 的运行目录，也不会引入 Anthropic、文件系统工具、Shell、MCP 或子 Agent。

Skill 只能包含：

- 中英文补充指令
- 脱敏示例
- 已授权工具的子集及工具选择提示
- 输出字段规则
- 声明式工作流步骤

Skill 不能包含可执行代码、密钥、环境变量、中央权限规则、预算、模型配置、新工具或数据库迁移。候选工具必须满足：

```text
candidateTools ⊆ parentTools ∩ agentAllowedTools
```

## 运行闭环

```text
脱敏 Trace
  → 原因码聚类（同一聚类只保留一个活动候选）
  → 确定性生成声明式候选
  → Schema / 代码与密钥检查 / 权限不扩大检查
  → 30 条固定合成数据：基线与候选同输入回放
  → 硬门禁
  → 原子切换到 100%
  → 生产指标监控
  → 自动回滚或保留
```

自动候选生成不调用第二个模型，也不修改源代码。真实离线回放通过项目现有 Provider 执行；数据库只保存用例 ID、工具名、原因码、Token 和延迟，不保存输出正文、工具参数或用户资料。

固定评测集当前版本为 `agent-skill-eval-v1-30`，包含 30 条合成用例。评测集变更必须更新版本号，并让活动版本和候选版本在同一数据集、同一 Provider 配置下重新回放；不能用旧基线结果与新候选结果直接比较。

## 发布门禁

- 权限、隐私、拒绝和输出 Schema：100% 通过
- 核心任务成功率不得低于活动版本
- 目标失败类型至少改善 5 个百分点
- 平均 Token 与 P95 延迟恶化不得超过 10%
- 评测运行异常：候选失败，不发布
- 自动生成连续三次未通过：聚类暂停，等待诊断

门槛由受保护的服务端代码与配置管理。候选 Skill 不能携带或修改门槛。

不使用流量灰度。通过门禁后，`AgentSkillDeployment.activeVersionId` 在数据库事务中直接切换到新版本；`previousVersionId` 始终保留立即回滚目标。

## 运行固定与回滚

`AgentRun.skillVersionId` 在 Run 创建时写入。发布或回滚只影响之后创建的 Run；等待审批、重连和恢复中的 Run 继续读取启动时版本。

生产监控发现以下任一情况会回滚：

- 任意权限、隐私、审批绕过或密钥类失败：立即回滚
- 至少 10 个新旧样本后，成功率下降超过 2 个百分点
- 失败率、Token 或 P95 延迟恶化超过 10%

30 天内连续两次自动回滚后，该 Agent 的待处理失败聚类会暂停。

失败聚类只接受脱敏的稳定原因码与数值信号，包括工具连续失败、补充规划耗尽、用户明确纠正、审批拒绝、输出 Schema 失败以及 token/延迟相对基线退化。单次异常、模型自行判断和单个用户的私有正文不能直接触发候选或发布。

## Feature Flags

```text
AI_AGENT_SKILLS_V1
AI_AGENT_SKILLS_EVOLUTION_V1
AI_AGENT_SKILLS_AUTO_PUBLISH_V1
```

三个开关按顺序依赖。全部关闭时运行时继续使用代码中的原 Agent 配置。

## 管理接口

所有接口要求管理员角色和 `AI_CONFIG` 权限：

- `GET /admin/ai-agent/skills`
- `POST /admin/ai-agent/skills/validate`
- `POST /admin/ai-agent/skills/candidates`
- `POST /admin/ai-agent/skills/versions/:versionId/evaluate`
- `POST /admin/ai-agent/skills/versions/:versionId/publish`
- `POST /admin/ai-agent/skills/rollback`
- `POST /admin/ai-agent/skills/evolution/run`

每日任务 `agent-skill-evolution` 由现有 HTTP Cron Driver 和 Cloud Scheduler 触发。

### 信号消费与安全监控可靠性

以下为代码实现，生产切换证据另见本次变更闭环文档，不能据此认定已上线：

- `AgentEvaluationTrace.skillSignalConsumedAt` 与该 Trace 的全部信号增量在同一个数据库事务中提交。并发消费者只能认领一次；写入失败时整笔回滚，重试不重复计数。
- 每次按创建时间和 ID 顺序处理最多1000条、最近7天内未消费的 Trace。连续调用可以推进积压，不再依赖最多500个历史 ID 的 JSON 数组。
- 安全失败 Trace 持久化后立即触发数据库检查；独立每分钟任务 `agent-skill-monitor` 处理丢失通知和指标退化，不调用模型或发布候选。调度失败会告警并向 HTTP Cron 返回失败，保留下一周期重试路径。
- 硬安全检查覆盖当前激活区间全部 Trace，不受最新500条统计样本限制。自动回滚在串行化事务内同时比对版本 ID 和激活时间，陈旧/重复通知不得回滚后来发布或重新激活的版本。
- 数据库、调度不可用时不承诺硬实时；安全错误分类沿用现有稳定原因码，不等于可以发现未记录的违规。

迁移 `20260827230000_skill_signal_consumption` 只增加内部字段和索引。旧行标为切换前已处理，新行默认未消费；保留旧计数，不猜测性重算，也不把旧评测升级为新证据。尚未消费的切换前 Trace 不自动补计，原始脱敏记录仍按保留策略可审计。

发布必须先暂停旧自动进化和手动 cycle，确认在途消费者排空，再迁移、0流量验证、直切100%，验证新消费者后恢复。禁止新旧采集器并行。代码回滚保留字段，并保持进化暂停，直到重新验证；旧代码不具备新去重保证。详见 [修复闭环](AI_SKILL_EVOLUTION_RELIABILITY.normalized.md)。

管理后台的 Reliability 页面用于查看活动版本、前一版本、候选、评测和回滚状态。管理员手工发布也必须经过与自动发布相同的离线硬门禁，不能绕过权限、隐私、拒绝和输出 Schema 检查。

## 生产验收

`pnpm harness:acceptance --production` 除原 Harness 场景外，还验证：

- 六类 Agent 均有活动 Skill
- 合法声明式补丁可通过只读校验
- 扩大工具权限的候选返回 400
- 历史公开管理员密码返回 401
- 新 Agent Run 持久化了固定 Skill 版本
- 所有合成账号、事件、会话、记忆和 Trace 均完成清理

2026-08-24 的首次生产验收确认六类 Agent 均存在活动版本、自动发布已启用、合法候选可通过只读校验、工具权限扩大被拒绝、新 Run 固定 Skill 版本、历史公开管理员凭据被拒绝，且合成数据完成清理。该次上线的不可变证据见 `reports/AI_AGENT_HARNESS_PRODUCTION_CLOSURE_2026-08-24.md`。

生产管理员明文密码只保存在 GitHub Actions Secret `ADMIN_BOOTSTRAP_PASSWORD`，Cloud Run 只接收对应 bcrypt 哈希的 Base64 形式 `ADMIN_BOOTSTRAP_PASSWORD_HASH_B64`。启动服务会把指定管理员账号与该固定哈希对账：一致时无操作，不一致时轮换并同时撤销该账号的 Refresh Token。Cloud Run、仓库和日志中均不存在可直接登录的密码；生产验收从受控 CI Secret 注入明文。
