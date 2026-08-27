# Native Claude Provider 与型号一致性门禁

<!-- section:change-identity -->

## 1. 变更身份

| 字段            | 内容                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| Change ID       | AI-NATIVE-CLAUDE-20260826                                              |
| 类型 / 项目     | 功能修改 / study-abroad-platform                                       |
| 请求人 / 决策人 | 产品所有者，当前任务用户                                               |
| 来源            | 当前任务：核对其他 Claude 调用方式，批准原生协议接入统一 Provider 边界 |
| 优先级 / 日期   | 当前接入验证 / 2026-08-26                                              |
| 状态            | Closed（本地实现与验证）；生产启用仍受外部映射阻塞                     |

<!-- section:executive-summary -->

## 2. 摘要

- [RUNTIME] 中转 Chat Completions 与 Messages 路径行为不同；后者请求 Sonnet 5 却标注 Haiku 4.5，请求 Opus 5 却标注 Opus 4.8。
- [CODE] 产品当前只有 OpenAIProvider；CDS 脚本已有原生 Messages，但不核对返回型号且固定 temperature=0。
- [DECISION] 在现有 ILLMProvider 内增加显式启用的原生适配器，不另建 Agent；默认保持 OpenAI。
- [DECISION] 成功标准为配置、内容、流式、工具、JSON、usage、失败处理合同测试通过，且型号不符在任何内容/工具发出前被拒绝；不以 HTTP 200 替代型号验证。

<!-- section:current-state -->

## 3. 变更前状态

- [CODE] `providers/provider.module.ts` 只注入 OpenAIProvider；`LLMService` 负责重试、预算与计费。
- [CODE] `scripts/lib/llm-call.ts` 用 x-api-key + anthropic-version 调用 `/v1/messages`，四个 CDS 提取脚本调用该 helper。
- [CODE] `profile-application-analysis-v2.service.ts` 和 Agent 配置分别读取 OPENAI_MODEL，需统一按已选择 Provider 取模型，避免业务/Agent 型号分叉。
- [RUNTIME] 合成测试报告保存在 `/tmp/relay-contract-test.bPIDoH/`，原始失败记录保留，报告无密钥。Messages 17 次中 16 次响应合同通过，但 Sonnet/Opus 返回型号不符，不能当作新型号成功。
- [EXTERNAL] Claude 官方模型目录及 Messages Structured Outputs 文档已核对；第三方中转的身份与可靠性不由官方文档背书。

<!-- section:target-outcome -->

## 4. 目标行为

[DECISION] 服务端明确选择原生 Claude 后，产品保持原调用接口；已验证响应转为相同内容、工具、usage 类型。返回型号缺失或不匹配、非法工具、流中断均失败，不退回另一型号。未启用时沿用 OpenAI。

<!-- section:scope -->

## 5. 范围

- In scope [DECISION]：API 原生 Provider、配置与模型选择、严格响应校验、流式终态、合同测试、部署说明。
- Out of scope [DECISION]：生产部署、Secret/IAM/中转账户修改、UI 新设计、MCP、工具/权限扩展、数据库迁移、重写 CDS 离线链、GPT 流式专用中转适配。

<!-- section:users-permissions -->

## 6. 用户与权限

[DECISION] 仅管理员通过服务端环境配置选择传输；Skill、用户消息和 providerOptions 不得改 model、URL、headers、stream 或预算。现有租户、权限、审批和使用额度不变。

<!-- section:user-flows -->

## 7. 状态与流程

[DECISION] 默认启动 → 原 OpenAI；显式选择 anthropic 且开关开启、配置完整 → 原生请求；型号验证 → 输出/工具；HTTP、网络、超时、非法 JSON、截断流 → 稳定错误。中断时取消 reader/请求，工具仅在完整 message_stop 后发出。不新增运行恢复状态。

<!-- section:requirements -->

## 8. 需求

| ID      | 需求                                                                                             | 优先级 | 来源        |
| ------- | ------------------------------------------------------------------------------------------------ | ------ | ----------- |
| FR-001  | 新原生 Provider 复用 ILLMProvider，仅显式双配置启用；默认 OpenAI 不变                            | Must   | [DECISION]  |
| FR-002  | 普通响应及流的 message_start 在发出内容前验证返回型号等于请求型号；缺失、不匹配均拒绝            | Must   | [REQUESTER] |
| FR-003  | 转换文本、工具历史/结果、工具选择、JSON Schema、usage 与流式终态；不静默忽略异常工具或截断流     | Must   | [DECISION]  |
| FR-004  | Agent、反思、普通业务及申请分析使用相同 Provider 对应的配置模型；删除文书辩论隐藏 model override | Must   | [CODE]      |
| NFR-001 | 无密钥、输入、模型原文或工具参数进入新错误日志；固定超时、响应大小上限及资源清理                 | Must   | [REQUESTER] |
| NFR-002 | 不修改生产配置和原有工具权限，不增加依赖或数据库模型                                             | Must   | [REQUESTER] |

<!-- section:acceptance -->

## 9. 验收

| ID     | 映射             | Given / When / Then                                                                          | 可见/系统结果                       |
| ------ | ---------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| AC-001 | FR-001, NFR-002  | Given 默认配置 When 启动 Then 仍为 OpenAI；anthropic 未开关或缺配置则拒绝                    | 单元/模块注入测试，现有 OpenAI 回归 |
| AC-002 | FR-002, NFR-001  | Given 返回不同或缺失型号 When 普通/流式解析 Then 不发出内容或工具且报稳定不可重试错误        | 型号负控制                          |
| AC-003 | FR-003           | Given 合法请求 When 普通/多分块流式响应 Then 文本、工具、usage、JSON Schema 与终态正确       | Provider 合同测试                   |
| AC-004 | FR-003, NFR-001  | Given 非法工具、截断流、错误事件、超时/取消 When 执行 Then 不伪造 done、不执行工具且资源清理 | 故障注入测试                        |
| AC-005 | FR-004           | Given 原生配置 When Agent/业务选择模型 Then 一致读取 ANTHROPIC_MODEL；OpenAI 保持旧默认      | 模型选择及配置回归                  |
| AC-006 | NFR-001, NFR-002 | Given 中转原始错误含敏感内容 When 返回错误 Then 仅固定错误码/HTTP 状态，无生产配置变更       | 脱敏及 Git diff 审查                |

<!-- section:technical-impact -->

## 10. 技术影响

- [DECISION] 新增原生 Provider 及 request/response helpers；沿用 LLMService 和业务 API，不改变前端合同。
- [DECISION] 配置：LLM_PROVIDER 新增 anthropic；AI_AGENT_NATIVE_CLAUDE_V1 默认 false；ANTHROPIC_API_KEY、ANTHROPIC_BASE_URL、ANTHROPIC_MODEL 必须由管理员管理，无凭据值进入文档。
- [DECISION] Embeddings 仍使用原 OPENAI 配置，不被聊天 Provider 切换。
- N/A — 无数据库、迁移或用户数据回填。
- [DECISION] 不猜测中转价格，未知模型延续现有保守费用估算并说明不是账单实价。

<!-- section:nonfunctional -->

## 11. 安全与质量

[DECISION] 仅 HTTPS、拒绝 URL 内凭据/query/fragment 和跨站重定向；允许工具来自请求已有白名单；请求选项只接受明确支持字段。工具参数必须是 JSON object；禁止响应追加未注册工具。严格比较型号不通过 alias 或内容推测绕过。国际化/可访问性 N/A — 不改 UI。

<!-- section:observability -->

## 12. 可观测性

[DECISION] 使用现有请求跟踪、usage 和错误通道；新增固定 MODEL_MISMATCH/INVALID_RESPONSE 类错误。保留脱敏 requested/returned 型号证据，不能保证第三方返回字段证明真实模型。日志只用固定错误消息，不带 provider 原始响应。

<!-- section:test-plan -->

## 13. 测试计划

| 层级                   | AC                     | 环境                           | 证据 / Owner                                      |
| ---------------------- | ---------------------- | ------------------------------ | ------------------------------------------------- |
| Unit / Contract        | AC-001–AC-006          | Jest mocked fetch              | 本地定向测试 / Codex                              |
| Integration regression | AC-001, AC-004, AC-005 | Agent/配置/业务现有 suites     | Jest 摘要 / Codex                                 |
| Real path              | AC-002, AC-003         | 中转合成请求，不访问业务数据   | 已有报告；指定新型号不一致仍 BLOCKED / 中转管理员 |
| Manual quality         | N/A                    | 不做业务答案质量或真人评审声明 | 后续评测独立进行                                  |

<!-- section:rollout -->

## 14. 发布与回滚

[DECISION] 此轮仅本地实现及测试，不部署。未来启用须核对型号、更新已暴露 Key 并跑生产验收。回滚用恢复 LLM_PROVIDER=openai、关闭原生开关及此前已验证配置，不自动切模型。无数据库不可逆变更。

<!-- section:risks-dependencies -->

## 15. 风险与依赖

| 项目                | 类型                | 影响                                       | 缓解 / Owner                                   |
| ------------------- | ------------------- | ------------------------------------------ | ---------------------------------------------- |
| 中转映射不透明      | External dependency | 指定新型号未验证                           | fail closed；管理员核对，不改返回标签          |
| 边界参数兼容        | Risk                | temperature 或 response_format 被拒绝/忽略 | 原生请求按能力转换、固定合同测试 / Codex       |
| Claude 计价与上下文 | Risk                | 中转账单不可由官方价格推定                 | 保留 token 预算与保守估算，启用前核对 / 管理员 |

<!-- section:open-decisions -->

## 16. 决策与未决问题

| 状态         | 内容                                                               | 是否阻塞                           | Owner / 验证                  |
| ------------ | ------------------------------------------------------------------ | ---------------------------------- | ----------------------------- |
| [DECISION]   | 用户批准原生适配接入既有统一边界，替代早期不增加 Claude 的范围限制 | 否                                 | 当前任务用户确认              |
| [DECISION]   | 不需要为离线实现等待服务商改映射；严格拒绝不一致即可测试该边界     | 否                                 | Codex / AC-002                |
| [UNRESOLVED] | 服务商为何把 Sonnet 请求标成 Haiku、Opus 5 标成 4.8                | 阻塞生产，不阻塞关闭开关的本地实现 | 中转管理员 / 指定型号真实验收 |

<!-- section:implementation-plan -->

## 17. 实施计划

[DECISION] 顺序：固化配置/身份合同 → 原生请求转换 → 有界 HTTP/SSE 响应验证 → 单一配置模型解析 → 模块注入与文书隐藏 override 修复 → 定向及相关回归 → 文档 closure。测试和审查完成前不提交/合并/部署，不触碰用户未跟踪目录。

<!-- section:implementation-summary -->

## 18. 实施结果

[CODE] 分支 `codex/native-claude-provider`，基线
`17fb7132fd1fc43bb41bbebd5a1a232a7715b65c`；本轮修改尚未提交或部署。
以下路径相对仓库；涉及 21 个 TypeScript 实现/测试文件的路径与内容排序摘要为
`8f08477eb8212759bf7b2111dd4044a4104b209c725468817e34eb9913bf897f`（SHA-256）。

| Requirement | 文件/合同                                                                                                                                                                                                                          | 实际行为                                                                                               | 偏差/边界                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| FR-001      | `apps/api/src/modules/ai-agent/providers/provider.module.ts`、`anthropic.provider.ts`；`common/config/env.validation.ts`                                                                                                           | 现有 Provider token 注入原生实现；双开关、完整配置才启用，默认 OpenAI                                  | 不增加 SDK 依赖或第二套 Agent；只是本地实现                                |
| FR-002      | `providers/native-claude.contract.ts`、`native-claude.stream.ts`、`llm-provider.types.ts`                                                                                                                                          | 普通/流式响应在文本、工具发出前严格核对型号                                                            | 只核对中转声明的字段，不证明底层模型真实性                                 |
| FR-003      | 同上、`providers/anthropic.provider.ts`                                                                                                                                                                                            | 工具历史/选择、JSON Schema 参数转换、usage 校验、有界 SSE；完整终态后才发出工具                        | JSON object 是提示约束；业务 Schema 验证仍由消费者负责；不支持 seed 确定性 |
| FR-004      | `providers/runtime-model.ts`、`config/config-validator.service.ts`、`core/llm.service.ts`、`infrastructure/config/config.service.ts`；`profile/profile-application-analysis-v2.service.ts`；`essay-debate/essay-debate.service.ts` | 统一配置模型；申请分析在实例创建时读取已加载环境；移除文书隐藏模型覆盖                                 | OpenAI 默认及现有业务流程保留；静态 UI 型号列表未改                        |
| NFR-001     | `providers/anthropic.provider.ts`、`native-claude.contract.ts`；`core/resilience.service.ts`                                                                                                                                       | 固定脱敏错误、2 MiB 上限、请求/reader 清理；重试尊重 Provider 明确标记；成功/失败均清除 deadline timer | 修复原重试层仅匹配错误文字、超时计时器未释放的问题；不增加自动模型降级     |
| NFR-002     | `.github/workflows/ci.yml`、`ENV_TEMPLATE.md`、`docs/DEPLOY_CONFIG.md`、`docs/architecture/ai-system.md`                                                                                                                           | 本地部署清单显式 `AI_AGENT_NATIVE_CLAUDE_V1=false`；文档说明启用和回退                                 | 无线上配置、Secret、IAM、数据库、工具权限或用户目录变更                    |

<!-- section:verification -->

## 19. 验证证据

[RUNTIME] 证据目录：`/tmp/relay-contract-test.bPIDoH/`。以下 PASS 限于列出的测试边界。

| AC     | 结果 | 测试与证据                                                                                                                    | 边界                                                               |
| ------ | ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| AC-001 | PASS | `native-claude-config.spec.ts`、`env.validation.spec.ts`、原 `openai.provider.spec.ts`；`final-contract-tests.json`           | 默认注入/配置回归，非生产开关切换                                  |
| AC-002 | PASS | 普通/流式缺失或替换型号负控制；`actual-provider-results.json` 4 次真实不一致拦截                                              | Sonnet 5 / Opus 5 的可用性仍 BLOCKED，不能把正确拦截算成新型号成功 |
| AC-003 | PASS | `anthropic.provider.spec.ts`、`native-claude.contract.spec.ts`；真实 Haiku 文本/流式/工具/Schema 四项及精确 Opus 4.8 文本一项 | 合成样本和接口合同，不是答案质量、稳定性或负载评测                 |
| AC-004 | PASS | 流截断、非法工具/JSON、强制工具缺失、超时、提前取消、HTTP/网络故障、usage 溢出；`resilience.service.spec.ts`                  | Provider 边界及既有重试层；不新增 Run 恢复机制                     |
| AC-005 | PASS | Agent/反思模型选择、`LLMService` 实际适配器链路、`profile-application-analysis-v2.model.spec.ts`、文书辩论配置回归            | 申请分析 `.env` 加载时序已覆盖；完整生产业务 E2E 未跑              |
| AC-006 | PASS | 固定错误消息断言、`git diff --check`、Gitleaks 增量+新文件扫描 0 命中；`secret-diff-scan.json`                                | 扫描不是密钥安全的全面保证；已在聊天暴露的 Key 仍需管理员轮换      |

- [RUNTIME] 最终定向：9 suites / 171 tests PASS，含 `--detectOpenHandles`，无未关闭句柄报告；`final-contract-tests.json`、`final-contract-tests.log`。
- [RUNTIME] 第一轮完整 API：325 suites / 4,261 tests PASS；`full-api-tests.json`。该轮报告 worker 未正常退出；审查发现并修复了现有 Resilience deadline timer 未清理的问题，保留该轮证据。
- [RUNTIME] 最终完整 API 回归：326 suites / 4,265 tests PASS，0 失败，443.207 秒；`final-api-regression.json`、`final-api-regression.log`。本轮无 worker 被强制退出警告，测试进程正常结束。
- [RUNTIME] 真实适配器合成请求两轮各 9 项通过；最后一轮为 `actual-provider-results.json`。每轮都是 5 项成功合同 + 4 项正确拒绝，不是 9 个目标模型可用。无真实业务工具执行。
- [RUNTIME] TypeScript、ESLint（0 warnings）、Prettier、API quality、AI 环境文档、Agent 文档事实、部署 drift、any ratchet、file-size 均通过。file-size overage 45,503 → 45,501；没有提高 ratchet 基线。
- [RUNTIME] 全文件 Secret 扫描和 HEAD 基线各有 4 个既有命中，均定位于 `env.validation.spec.ts`；本次增量+新文件扫描无命中。没有以删除历史证据来掩盖首次失败。
- [RUNTIME] 初次业务回归曾因文书辩论测试仍要求旧隐藏模型覆盖而失败；已改为断言明确的统一路由选项并通过复测。
- 清理：中转凭据仅经隐藏输入传入内存，测试进程已结束；报告只保留合成结果/脱敏指标。未启动业务服务、创建业务账号或写入用户数据；用户未跟踪目录未动。测试日志和临时脚本保留用于复核，不提交。
- 剩余风险：第三方中转型号标记不一致；返回字段不是模型身份的独立证明；未知型号成本估算不是中转实价；OpenAI-only Embeddings/离线脚本未切换；GPT 流式专用中转的普通调用聚合不在本次范围。

<!-- section:release-decision -->

## 20. 合并与发布结论

- 实施：CLOSED（仅本地）— 实现、定向合同、完整 API 回归、真实中转合成边界、安全/格式/类型审查完成；文档结构校验见证据目录的 `closure-check.json`。
- 合并：NOT CLAIMED — 未提交、未发 PR、未合并。
- 生产启用：BLOCKED — 指定 Sonnet 5 / Opus 5 映射未解决，已暴露 Key 未轮换，业务生产 E2E 未执行。
- 未执行：生产部署、切换线上 Provider、管理员 UI 改造、业务质量评测/负载测试、GPT 流式中转兼容实现。
- 下一责任人/动作：管理员核对中转真实型号并安全更新凭据后，由用户决定启用和生产验收。不要将当前返回的 Haiku/Opus 4.8 冒记为 Sonnet 5/Opus 5。
