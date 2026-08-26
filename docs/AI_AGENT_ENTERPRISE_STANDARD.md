# AI Agent 企业级控制标准

**状态：** 当前控制事实源

**更新时间：** 2026-08-25
**机器登记表：** `docs/governance/ai-agent-enterprise-controls.json`

## 目标和证据原则

本标准将 NIST AI RMF 的 Govern、Map、Measure、Manage，OWASP Agentic Top 10、
ISO/IEC 42001 管理体系思想、SLSA 供应链来源和 Google Cloud 可靠性原则映射到
本项目。它不是认证声明，也不把“已有文档”写成“已经在生产验证”。

每个控制必须具备：唯一 ID、角色负责人、状态、仓库证据、验证方法、失败动作、
复查周期，以及未关闭时的下一动作。CI 命令
`pnpm lint:ai-agent-enterprise-controls` 校验登记表和证据路径，防止控制项在文档中
静默丢失。

权威基线：

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- [OWASP Top 10 for Agentic Applications](https://genai.owasp.org/)
- [ISO/IEC 42001 AI management systems](https://www.iso.org/standard/42001)
- [SLSA v1.2](https://slsa.dev/spec/v1.2/)
- [Google Cloud reliability pillar](https://cloud.google.com/architecture/framework/reliability)

## 状态语义

- `enforced`：控制由代码或 CI 强制，并有可重复验证。
- `documented`：流程和责任边界已定义，但仍需周期性运行证据。
- `evidence_pending`：实现基础存在，尚缺真实环境或独立证据。
- `external_action_required`：需要明确授权的云资源、IAM 或恢复操作；不得用本地
  推断替代。

只有 `enforced` 才能表述为技术闭环。其余状态必须保留 `nextAction`。标记
`customerLaunchBlocker=true` 的未关闭控制不会阻止产品所有者自己的合成测试，
但必须在面向付费客户开放前完成或由风险所有者书面接受。

## 当前结论

已经强制执行的核心边界包括工具最小权限与审批、输出审核 fail-closed、合成数据
和脱敏证据、冻结语义门禁、OWASP Agentic Top 10 回归矩阵、依赖扫描、SBOM，
以及第三方 GitHub Actions 的不可变 SHA 固定。

目前不得声称完成的企业证据有两类：

1. 部署模型对完整冻结语料的独立盲审；当前 100% 是 Codex reference 校准。
2. 经授权的 Cloud SQL 隔离恢复实操，以及独立运行时 Service Account 的最小权限
   验证。

完整状态、闭环动作和验收证据以机器登记表为准，避免两个文档分别维护数字。

## 变更规则

- 新增模型、工具、MCP、数据源、长期记忆类别或权限时，先更新风险登记和测试。
- `customerLaunchBlocker`、状态或失败动作的降低必须单独审查，不能由声明式 Skill 修改。
- 任何权限绕过、隐私泄露、未审核原始输出或来源不匹配都是硬失败，平均质量分不能抵消。
- 事故关闭必须形成：时间线、根因、影响、修复、回归用例、监控和负责人。
- 每次发布保存不可变提交、镜像 digest、Revision、生产验收和回滚目标；不得保存密钥、
  prompt、完整响应、工具参数或个人材料。
