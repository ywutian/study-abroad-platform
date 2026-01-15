# AI Agent & Memory 系统开发标准

> 本文档是留学平台 AI Agent 模块的开发规范，适用于所有涉及 Agent 工作流、工具调用、记忆系统的代码变更。
>
> 最后更新: 2026-02-06 | 架构: ReWOO 三阶段工作流

---

## 目录

1. [架构总览](#1-架构总览)
2. [工作流引擎标准](#2-工作流引擎标准)
3. [工具设计标准](#3-工具设计标准)
4. [LLM 调用标准](#4-llm-调用标准)
5. [记忆系统标准](#5-记忆系统标准)
6. [Agent 配置标准](#6-agent-配置标准)
7. [错误处理与弹性](#7-错误处理与弹性)
8. [安全标准](#8-安全标准)
9. [可观测性标准](#9-可观测性标准)
10. [代码规范](#10-代码规范)

---

## 1. 架构总览

### 1.1 三阶段工作流 (ReWOO)

本系统采用 **Plan → Execute → Solve** 三阶段工作流架构，基于 ReWOO (Reason Without Observation) 模式：

```
用户消息
   ↓
Phase 1: PLAN（1 次 LLM 调用，带 tools）
   LLM 分析意图，一次性规划所有需要的工具调用
   ↓
Phase 2: EXECUTE（0 次 LLM 调用）
   按计划依次执行工具，完全不调用 LLM
   ↓
Phase 3: SOLVE（1 次 LLM 调用，不带 tools）
   LLM 综合所有工具结果，生成最终回复
   ↓
最终回复
```

**核心原则**：Execute 阶段不调用 LLM，从结构上杜绝重复 tool 调用。

### 1.2 服务分层

```
Controller / Gateway (HTTP/WebSocket 入口)
   ↓
OrchestratorService (协调者 — 路由、委派、记忆增强)
   ↓
AgentRunnerService (运行器 — 调度工作流引擎)
   ↓
WorkflowEngineService (工作流引擎 — Plan/Execute/Solve)
   ↓
┌─────────────────┬───────────────────┐
│  LLMService     │  ToolExecutorService  │
│  (LLM 调用封装) │  (工具执行适配层)      │
└─────────────────┴───────────────────┘
   ↓                    ↓
MemoryService      LegacyToolExecutor
(对话状态管理)      (实际工具实现)
```

### 1.3 文件组织

```
ai-agent/
├── core/                    # 核心运行时
│   ├── workflow-engine.service.ts  # 三阶段工作流引擎 ★
│   ├── agent-runner.service.ts     # Agent 运行调度
│   ├── orchestrator.service.ts     # 多 Agent 协调
│   ├── llm.service.ts              # LLM API 封装
│   ├── tool-executor.service.ts    # 工具执行适配
│   ├── memory.service.ts           # 对话状态管理
│   ├── resilience.service.ts       # 弹性保护
│   └── ...
├── config/                  # 配置
│   ├── agents.config.ts     # Agent 角色配置
│   └── tools.config.ts      # 工具定义
├── memory/                  # 企业级记忆系统
│   ├── memory-manager.service.ts   # 记忆管理总控
│   ├── embedding.service.ts        # 向量嵌入
│   ├── persistent-memory.service.ts # 持久化
│   └── ...
├── types/                   # 类型定义
└── DEVELOPMENT_STANDARDS.md # 本文档
```

---

## 2. 工作流引擎标准

### 2.1 三阶段职责划分

| 阶段        | 职责                   | LLM 调用 | tools 参数 | 允许的操作                 |
| ----------- | ---------------------- | -------- | ---------- | -------------------------- |
| **PLAN**    | 分析意图，规划工具调用 | 1 次     | 传入       | 生成 tool_calls 或直接回复 |
| **EXECUTE** | 按计划执行工具         | **0 次** | N/A        | 只执行工具，写入结果       |
| **SOLVE**   | 综合结果生成回复       | 1 次     | **不传**   | 只生成文本回复             |

### 2.2 规则

- **MUST**: Plan 阶段必须在一次 LLM 调用中返回所有需要的工具调用
- **MUST**: Execute 阶段严禁调用 LLM
- **MUST**: Solve 阶段调用 LLM 时不传入 `tools` 参数，使 LLM 无法生成 tool_calls
- **MUST**: Plan 阶段对同名工具去重，保留第一个
- **SHOULD**: 如果 Plan 阶段不返回工具调用，直接将 planningContent 作为最终回复（跳过 Execute 和 Solve）
- **SHOULD**: Execute 阶段工具失败时标记为 `failed`，不阻塞后续工具执行
- **MUST NOT**: 任何阶段都不得出现无限循环或递归
- **MUST NOT**: 不得在 Execute 阶段根据工具结果决定是否调用更多工具

### 2.3 委派处理

```typescript
// 正确：Plan 阶段检测到 delegate_to_agent → 直接返回委派信息
if (plan.delegation) {
  return { delegation: plan.delegation, ... };
}

// 错误：在 Execute 阶段检测委派
// ❌ 不要这样做
```

### 2.4 何时退回 ReAct 循环

三阶段工作流适用于绝大多数场景。以下极端情况可考虑保留回退机制（但目前不启用）：

- 工具 B 的参数强依赖于工具 A 的结果（如：先搜索学校获取 ID，再用 ID 查详情）
- 需要多轮工具交互的复杂推理链

**当前策略**：通过优化工具设计避免这类依赖（见第 3 节）。

---

## 3. 工具设计标准

### 3.1 单一职责 (Single Responsibility)

每个工具只做一件事，做到最好。

```typescript
// ✅ 正确：原子化工具
{ name: 'get_profile', ... }        // 只获取档案
{ name: 'update_profile', ... }     // 只更新档案
{ name: 'search_schools', ... }     // 只搜索学校

// ❌ 错误：上帝工具
{ name: 'manage_profile', ... }     // action: 'get' | 'update' | 'delete'
```

### 3.2 幂等性 (Idempotency)

读操作天然幂等。写操作必须具备幂等性保护。

```typescript
// 标记非幂等工具，禁止重试
const NON_RETRYABLE_TOOLS = new Set([
  ToolName.UPDATE_PROFILE,
  ToolName.POLISH_ESSAY,
  ToolName.CREATE_PERSONAL_EVENT,
]);
```

**规则**：

- **MUST**: 所有读取工具（`get_*`, `search_*`）必须是幂等的
- **MUST**: 写入工具应通过业务逻辑保证幂等性（如 upsert 而非 insert）
- **MUST**: 非幂等工具必须在 `NON_RETRYABLE_TOOLS` 中注册

### 3.3 参数自包含

工具参数应尽量自包含，减少对其他工具结果的依赖。

```typescript
// ✅ 正确：支持 schoolName 直接查询，不依赖 schoolId
{
  name: 'get_school_details',
  parameters: {
    properties: {
      schoolId: { type: 'string', description: '学校ID' },
      schoolName: { type: 'string', description: '或直接用学校名称查询' },
    },
    required: [],  // 两者传一即可
  }
}

// ❌ 错误：强依赖其他工具的输出
{
  name: 'get_school_details',
  parameters: {
    properties: {
      schoolId: { type: 'string', description: '必须先调用 search_schools 获取' },
    },
    required: ['schoolId'],
  }
}
```

### 3.4 语义清晰的描述

工具描述是给 LLM 看的"可执行文档"，必须包含：

```typescript
{
  name: 'search_schools',
  description: `搜索和筛选学校列表。
当用户询问学校推荐、排名、筛选条件时使用。
支持按排名范围、学费、地理位置等条件筛选。
返回匹配的学校列表（含基本信息和排名）。
不要用于获取单个学校的详细信息（请用 get_school_details）。`,
}
```

**必须包含**：

1. 工具做什么（一句话）
2. 什么时候用（When to use）
3. 返回什么（Return format）
4. 什么时候不用（When NOT to use）

### 3.5 错误返回规范

工具必须返回结构化的错误信息，而非抛出异常。

```typescript
// ✅ 正确
return {
  success: false,
  error: '未找到该学校，请检查学校名称是否正确',
  duration: 120,
};

// ❌ 错误：抛出异常让上层猜
throw new Error('School not found');
```

---

## 4. LLM 调用标准

### 4.1 调用场景分类

| 场景                 | 传入 tools | tool_choice | temperature | 说明         |
| -------------------- | ---------- | ----------- | ----------- | ------------ |
| Plan 阶段            | 是         | `auto`      | 0.3-0.5     | 需要工具规划 |
| Solve 阶段           | **否**     | N/A         | 0.5-0.7     | 只生成文本   |
| 直接回复（简单问题） | 否         | N/A         | 0.7         | 无需工具     |

### 4.2 模型选择

| Agent        | 推荐模型    | 说明                   |
| ------------ | ----------- | ---------------------- |
| ORCHESTRATOR | gpt-4o-mini | 路由和委派，低延迟优先 |
| ESSAY        | gpt-4o-mini | 文书需要创造力         |
| SCHOOL       | gpt-4o-mini | 数据分析，准确性优先   |
| PROFILE      | gpt-4o-mini | 档案分析               |
| TIMELINE     | gpt-4o-mini | 时间规划               |

### 4.3 Token 预算

- 单次 Plan 阶段：maxTokens ≤ 1000（规划不需要长输出）
- 单次 Solve 阶段：maxTokens ≤ 4000（需要生成完整回复）
- 单次请求总预算：≤ 10000 tokens（含 input + output）

### 4.4 去重与安全

- **MUST**: LLM 返回的 tool_calls 必须按工具名去重（`parseResponse` 和 `callStream` 中已实现）
- **MUST**: 流式和非流式路径的去重逻辑必须保持一致
- **SHOULD**: 记录去重日志用于监控

---

## 5. 记忆系统标准

### 5.1 记忆层次

```
┌─────────────────────────────────────────┐
│  Layer 1: 对话记忆 (Session Memory)      │  MemoryService
│  - 当前会话的消息历史                      │  内存 Map
│  - TTL: 会话结束后清除                     │
├─────────────────────────────────────────┤
│  Layer 2: 短期记忆 (Working Memory)      │  RedisCacheService
│  - 用户上下文快照                          │  Redis, TTL 5min
│  - 最近工具调用结果缓存                    │
├─────────────────────────────────────────┤
│  Layer 3: 长期记忆 (Long-term Memory)    │  PersistentMemoryService
│  - 用户事实 (FACT)                        │  PostgreSQL + 向量索引
│  - 用户偏好 (PREFERENCE)                  │
│  - 决策记录 (DECISION)                    │
│  - 对话摘要 (SUMMARY)                     │
└─────────────────────────────────────────┘
```

### 5.2 记忆类型定义

| 类型 | 枚举值       | 示例                 | 重要性范围 | 衰减速率 |
| ---- | ------------ | -------------------- | ---------- | -------- |
| 事实 | `FACT`       | "用户 GPA 3.8/4.0"   | 0.6-1.0    | 慢       |
| 偏好 | `PREFERENCE` | "偏好加州的学校"     | 0.5-0.9    | 中       |
| 决策 | `DECISION`   | "已选择 ED 申请 MIT" | 0.7-1.0    | 慢       |
| 摘要 | `SUMMARY`    | "上次讨论了选校策略" | 0.3-0.6    | 快       |
| 反馈 | `FEEDBACK`   | "用户对推荐表示满意" | 0.4-0.7    | 中       |

### 5.3 记忆写入规则

- **MUST**: 记忆提取必须在 Solve 阶段完成后异步执行，不阻塞响应
- **MUST**: 新记忆必须经过冲突检测（`MemoryConflictService`）
- **MUST**: 敏感信息必须经过脱敏（`SanitizerService`）
- **SHOULD**: 重要性评分 < 0.3 的记忆不持久化
- **SHOULD**: 相似度 > 0.9 的记忆合并而非新建

### 5.4 记忆读取规则

- **MUST**: 检索上下文时使用语义搜索 + 类型过滤组合
- **MUST**: 注入 system prompt 的记忆总量不超过 2000 tokens
- **SHOULD**: 按 重要性 x 时效性 x 相关性 综合排序
- **SHOULD**: 优先检索 FACT 和 PREFERENCE 类型

### 5.5 记忆生命周期

```
写入 → 评分 → 冲突检测 → 持久化 → 衰减 → 压缩/删除
```

- **衰减**: `MemoryDecayService` 定期降低旧记忆的重要性
- **压缩**: `MemoryCompactionService` 将多条相关记忆合并为摘要
- **清理**: 重要性降至 0.1 以下的记忆标记为可删除

### 5.6 工具结果摘要规范

`MemoryService.getRecentMessages()` 会对工具结果进行摘要以控制 context 长度：

- 数组：最多保留 8 项，超出部分标注 `_totalCount`
- 对象：最多保留 15 个 key，超出部分标注 `_truncated`
- **MUST**: 摘要必须保留 `_totalCount` / `_truncated` 元信息，让 LLM 知道数据是完整获取但被截断展示
- **MUST NOT**: 摘要不得丢弃关键业务字段（如学校名称、GPA）

---

## 6. Agent 配置标准

### 6.1 Agent 定义规范

每个 Agent 必须包含以下配置：

```typescript
{
  type: AgentType.SCHOOL,          // 唯一标识
  name: '选校专家',                 // 中文名
  description: '学校搜索与推荐',     // 简短描述
  systemPrompt: '...',             // 系统提示词（见 6.2）
  tools: ['search_schools', ...],  // 可用工具列表
  canDelegate: [AgentType.ORCHESTRATOR], // 可委派目标
  model: 'gpt-4o-mini',           // 模型
  temperature: 0.5,                // 温度
  maxTokens: 4000,                 // 最大输出 token
}
```

### 6.2 System Prompt 编写规范

```markdown
# 角色定义

你是一个专业的 [角色名]，擅长 [能力描述]。

# 核心能力

- 能力 1: 具体描述
- 能力 2: 具体描述

# 工作规则

- 始终使用中文回复
- [特定于该 Agent 的业务规则]

# 输出格式

- [描述期望的回复结构]
```

**规则**：

- **MUST**: System prompt 不超过 800 tokens
- **MUST**: 包含角色定义、核心能力、工作规则三个部分
- **MUST NOT**: 在 system prompt 中硬编码"不要重复调用工具"——这由工作流引擎在结构上保证
- **SHOULD**: 包含输出格式说明（如 JSON 结构、Markdown 格式等）

### 6.3 工具分配原则

- 每个 Agent 只分配其职责范围内的工具
- `get_profile` 可分配给所有需要用户信息的 Agent
- `delegate_to_agent` 只分配给 ORCHESTRATOR
- 总工具数不超过 15 个（避免 LLM 选择困难）

---

## 7. 错误处理与弹性

### 7.1 错误分类

| 错误类型           | 是否可重试 | 处理策略                  |
| ------------------ | ---------- | ------------------------- |
| LLM API 超时       | 是         | 指数退避重试（最多 3 次） |
| LLM API 限流 (429) | 是         | 退避重试 + 熔断           |
| LLM 返回格式错误   | 否         | 降级为文本回复            |
| 工具执行超时       | 视工具而定 | 幂等工具可重试            |
| 工具执行失败       | 视工具而定 | 标记失败，Solve 阶段处理  |
| Agent 配置缺失     | 否         | FallbackService 降级响应  |

### 7.2 弹性保护层

```
请求 → RateLimiter → CircuitBreaker → Retry → Timeout → 执行
```

- **限流**: `RateLimiterService` — 每用户每分钟 20 次
- **熔断**: `ResilienceService` — 连续 5 次失败后熔断 30s
- **重试**: `ResilienceService` — 指数退避，最多 3 次
- **超时**: 工具 30s，LLM 30s

### 7.3 降级策略

```typescript
// 优先级从高到低
1. 正常工作流执行
2. 跳过失败的工具，基于已有结果生成回复
3. FallbackService 提供预设降级回复
4. 返回通用错误消息
```

---

## 8. 安全标准

### 8.1 输入防护

- **MUST**: 所有用户输入经过 `SecurityPipelineService` 处理
- **MUST**: Prompt injection 检测（`AgentSecurityMiddleware`）
- **MUST**: 输入长度限制（单条消息 ≤ 5000 字符）

### 8.2 输出审核

- **MUST**: LLM 输出经过敏感信息检测
- **MUST**: 工具返回的用户数据经过 `SanitizerService` 脱敏
- **MUST NOT**: 在日志中记录完整的用户消息内容或 API Key

### 8.3 工具安全

- **MUST**: 写入类工具必须验证用户身份（userId）
- **MUST**: 工具只能访问当前用户的数据
- **MUST NOT**: 工具接受 SQL 片段或原始查询语句作为参数

---

## 9. 可观测性标准

### 9.1 必须记录的指标

| 指标                      | 类型      | 来源                       |
| ------------------------- | --------- | -------------------------- |
| 工作流各阶段耗时          | Histogram | `WorkflowResult.timing`    |
| 工具调用成功/失败次数     | Counter   | `ToolExecutorService`      |
| LLM 调用次数与 token 用量 | Counter   | `TokenTrackerService`      |
| 每请求工具调用数          | Histogram | `WorkflowResult.toolsUsed` |
| 委派次数                  | Counter   | `OrchestratorService`      |
| 错误率（按错误类型）      | Counter   | 各 Service                 |

### 9.2 日志规范

```typescript
// ✅ 结构化日志
this.logger.log(`[${agentType}] Phase 2: EXECUTE completed`, {
  duration: executeMs,
  toolsExecuted: plan.steps.length,
  successCount: plan.steps.filter((s) => s.status === 'success').length,
  failedCount: plan.steps.filter((s) => s.status === 'failed').length,
});

// ❌ 非结构化日志
this.logger.log('done executing tools');
```

### 9.3 追踪

- 每个请求分配 `requestId`（`correlation-id.middleware`）
- 工作流的每个阶段记录 `phase` 和耗时
- 工具调用记录 `toolName`、`duration`、`success`

---

## 10. 代码规范

### 10.1 命名规范

| 类型       | 命名规则     | 示例                            |
| ---------- | ------------ | ------------------------------- |
| Service    | `XxxService` | `WorkflowEngineService`         |
| 接口       | `PascalCase` | `ExecutionPlan`, `PlannedStep`  |
| 枚举       | `PascalCase` | `WorkflowPhase`, `AgentType`    |
| 工具名     | `snake_case` | `get_profile`, `search_schools` |
| Agent 类型 | `UPPER_CASE` | `ORCHESTRATOR`, `ESSAY`         |

### 10.2 文件规范

- 每个 Service 一个文件，文件名与类名对应：`workflow-engine.service.ts`
- 类型定义集中在 `types/index.ts` 或 `core/types.ts`
- 配置文件放在 `config/` 目录
- 测试文件与源文件同目录：`xxx.service.spec.ts`

### 10.3 依赖注入规范

```typescript
// ✅ 可选依赖使用 @Optional()
constructor(
  private required: RequiredService,
  @Optional() private optional?: OptionalService,
) {}

// ✅ 检查可选依赖
if (this.optional) {
  await this.optional.doSomething();
}
```

### 10.4 新增工具 Checklist

添加新工具时，必须完成以下步骤：

- [ ] 在 `config/tools.config.ts` 中定义工具（名称、描述、参数 schema、handler）
- [ ] 工具描述包含：做什么、何时用、返回什么、何时不用
- [ ] 参数尽量自包含，减少对其他工具输出的依赖
- [ ] 在对应的 `tools.executor` 中实现 handler
- [ ] 返回结构化结果 `{ success, result, error, duration }`
- [ ] 如果是非幂等操作，加入 `NON_RETRYABLE_TOOLS`
- [ ] 在对应 Agent 的 `tools` 列表中注册
- [ ] 添加单元测试
- [ ] 更新本文档（如果改变了架构）

### 10.5 新增 Agent Checklist

添加新 Agent 时，必须完成以下步骤：

- [ ] 在 `types/index.ts` 的 `AgentType` 枚举中添加新类型
- [ ] 在 `config/agents.config.ts` 中定义完整配置
- [ ] System prompt 遵循 6.2 节规范（≤ 800 tokens）
- [ ] 工具列表遵循 6.3 节分配原则
- [ ] 在 ORCHESTRATOR 的 system prompt 中添加委派规则
- [ ] 在 ORCHESTRATOR 的 `canDelegate` 列表中注册
- [ ] 添加 Fast Router 关键词规则（如果适用）
- [ ] 添加集成测试
- [ ] 更新本文档

---

## 附录 A: 工作流引擎快速参考

```typescript
// 非流式调用
const result = await workflowEngine.run(agentType, config, conversation, tools);
// result.message      — 最终回复
// result.toolsUsed    — 使用的工具列表
// result.delegation   — 委派信息（如有）
// result.timing       — 各阶段耗时
// result.plan         — 执行计划详情

// 流式调用
for await (const event of workflowEngine.runStream(...)) {
  switch (event.type) {
    case 'phase_change':  // 阶段切换
    case 'tool_start':    // 工具开始执行
    case 'tool_end':      // 工具执行完成
    case 'solve_content': // Solve 阶段流式输出
    case 'done':          // 工作流完成
    case 'error':         // 错误
  }
}
```

## 附录 B: 常见问题

### Q: 如果一个工具的参数依赖于另一个工具的结果怎么办？

A: 优先通过工具设计解决——让工具支持多种查询方式（如同时支持 `schoolId` 和 `schoolName`）。如果确实无法避免，可以考虑将两个工具合并为一个更高级的工具。

### Q: Solve 阶段 LLM 是否可能返回 tool_calls？

A: 不可能。Solve 阶段调用 LLM 时不传入 `tools` 参数，OpenAI API 在没有 tools 定义时不会生成 tool_calls。

### Q: 工作流引擎如何处理 ORCHESTRATOR 的委派？

A: Plan 阶段检测到 `delegate_to_agent` 工具调用时，直接返回委派信息，不进入 Execute 和 Solve 阶段。由上层 `OrchestratorService` 处理实际委派。

### Q: 如何监控工具重复调用是否真的被杜绝了？

A: 检查 `WorkflowResult.plan.steps`，每个工具名应该只出现一次。同时监控日志中的 `Plan dedup` 警告，如果频繁出现说明 LLM 提示词需要优化。
