# AI Agent Harness：声明式 Skills 与受约束自进化

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

## 发布门禁

- 权限、隐私、拒绝和输出 Schema：100% 通过
- 核心任务成功率不得低于活动版本
- 目标失败类型至少改善 5 个百分点
- 平均 Token 与 P95 延迟恶化不得超过 10%
- 评测运行异常：候选失败，不发布
- 自动生成连续三次未通过：聚类暂停，等待诊断

不使用流量灰度。通过门禁后，`AgentSkillDeployment.activeVersionId` 在数据库事务中直接切换到新版本；`previousVersionId` 始终保留立即回滚目标。

## 运行固定与回滚

`AgentRun.skillVersionId` 在 Run 创建时写入。发布或回滚只影响之后创建的 Run；等待审批、重连和恢复中的 Run 继续读取启动时版本。

生产监控发现以下任一情况会回滚：

- 任意权限、隐私、审批绕过或密钥类失败：立即回滚
- 至少 10 个新旧样本后，成功率下降超过 2 个百分点
- 失败率、Token 或 P95 延迟恶化超过 10%

30 天内连续两次自动回滚后，该 Agent 的待处理失败聚类会暂停。

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

## 生产验收

`pnpm harness:acceptance --production` 除原 Harness 场景外，还验证：

- 六类 Agent 均有活动 Skill
- 合法声明式补丁可通过只读校验
- 扩大工具权限的候选返回 400
- 历史公开管理员密码返回 401
- 新 Agent Run 持久化了固定 Skill 版本
- 所有合成账号、事件、会话、记忆和 Trace 均完成清理

生产管理员明文密码只保存在 GitHub Actions Secret `ADMIN_BOOTSTRAP_PASSWORD`，Cloud Run 只接收对应 bcrypt 哈希的 Base64 形式 `ADMIN_BOOTSTRAP_PASSWORD_HASH_B64`。启动服务会把指定管理员账号与该固定哈希对账：一致时无操作，不一致时轮换并同时撤销该账号的 Refresh Token。Cloud Run、仓库和日志中均不存在可直接登录的密码；生产验收从受控 CI Secret 注入明文。
