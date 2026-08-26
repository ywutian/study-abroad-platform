# AI Agent SLO 与事故响应 Runbook

## 适用范围

适用于 `Orchestrator → AgentRunner → WorkflowEngine → ToolPolicy → ToolExecutor`
以及 Run、审批、上下文压缩、Memory 和声明式 Skills。目标先服务内部测试；有 28 天
真实流量后再校准为对外承诺。

## 临时 SLO 与硬安全目标

| SLI                    |    临时目标（滚动 28 天） | 证据                            | 触发动作                  |
| ---------------------- | ------------------------: | ------------------------------- | ------------------------- |
| API/DB/Redis 健康      |                     99.9% | `/health` 与 Cloud Run          | 回滚或平台事故            |
| Agent 成功响应率       | ≥99%（排除用户取消/限流） | `agent_requests_total`          | 消耗错误预算后停止发布    |
| Agent 总延迟 P95       |                    ≤30 秒 | `agent_total_duration_ms`       | 检查 Provider、工具和预算 |
| 工具执行延迟 P95       |                    ≤10 秒 | `agent_tool_duration_ms`        | 隔离失败工具              |
| 未审批高风险副作用     |                         0 | 审批/Run/审计记录               | SEV-1，立即禁用或回滚     |
| 敏感输出或审核绕过     |                         0 | moderation 事件与告警           | SEV-1，fail-closed 并回滚 |
| Run 重复副作用         |                         0 | 唯一约束、Run 终态、合成验收    | SEV-1，停止恢复入口       |
| 上下文 fallback 未告警 |                         0 | durable Harness evidence/alerts | SEV-2，修复后重跑验收     |

临时目标不是对客户的合同承诺。真实使用不足时报告样本数，不用百分比制造确定性。
安全 SLI 为零容忍硬门禁，不适用错误预算抵扣。

## 发布闭环

1. CI：类型、单元、E2E、安全、语义校准和控制登记全部通过。
2. 生成不可变镜像并记录提交、digest、Revision 和 SBOM。
3. 新 Revision 以 0% 流量验证健康与配置，然后直接切换 100%。
4. 使用合成账号运行 Harness production acceptance；所有场景和 cleanup 必须通过。
5. 确认 durable evidence、告警投递与 acknowledgement。
6. 失败则原子切回上一 Revision，验证健康，并保留脱敏失败原因码。

## 严重度和响应

- **SEV-1：** 权限/审批绕过、敏感数据泄露、重复业务副作用、错误账号数据访问。
  立即关闭相关入口或回滚；保存脱敏审计；轮换可能暴露的凭据；不得等待平均指标。
- **SEV-2：** moderation、恢复、持久化、告警或 Provider 大面积不可用。保持 fail-closed，
  回滚或降级到旧 ReWOO，1 个工作日内形成根因。
- **SEV-3：** 局部质量、成本或延迟退化，无安全/数据影响。冻结配置发布并进入评测队列。

## 事故关闭条件

事故只有同时满足以下项目才可关闭：

- 影响范围、开始/发现/缓解/恢复时间可追溯。
- 根因和促成因素有代码或平台证据，不以“模型偶发”代替。
- 已恢复且相关 SLI 回到目标；需要时验证上一 Revision 回滚。
- 失败被加入固定回归集或确定性故障注入。
- 告警可发现同类问题且完成一次投递/确认验证。
- 修复通过定向测试、完整回归、生产合成验收和数据清理。
- 明确负责人和防复发检查；不在事故记录中保存个人内容或原始模型输入输出。

## 恢复与外部动作边界

Cloud SQL 恢复只遵循 `cloud-sql-restore-drill.md`。创建隔离实例、执行 PITR、删除
实例和改变 IAM 都是外部状态变更，必须获得目标明确的授权。未执行的恢复演练必须
如实标记为 `external_action_required`，不能用 workflow 存在代替恢复成功证据。
