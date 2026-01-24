# AI Agent 架构文档

## 概述

本系统是一个自研的企业级多 Agent AI 助手，专为留学申请场景设计。采用 NestJS 框架原生实现，不依赖 LangChain 等第三方 AI 框架。

### 技术选型

| 组件     | 技术                  | 说明             |
| -------- | --------------------- | ---------------- |
| 后端框架 | NestJS                | 依赖注入、模块化 |
| 数据库   | PostgreSQL + pgvector | 向量搜索         |
| 缓存     | Redis                 | 会话缓存、限流   |
| LLM      | OpenAI API            | GPT-4o-mini      |

---

## 系统架构

```text
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              AiAgentController                           │    │
│  │   POST /chat (SSE)  │  GET /history  │  POST /clear     │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Orchestrator Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ FastRouter   │  │ Orchestrator │  │ FallbackService      │   │
│  │ (关键词路由)  │→│   Service    │→│ (降级响应)            │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Layer                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │Orchestr- │ │  Essay   │ │  School  │ │ Profile  │ │Timeline││
│  │  ator    │ │  Agent   │ │  Agent   │ │  Agent   │ │ Agent  ││
│  │ (路由)   │ │ (文书)   │ │ (选校)   │ │ (档案)   │ │ (规划) ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                   WorkflowEngineService                          │
│              (ReWOO 三阶段: Plan→Execute→Solve)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐
│   LLM Layer     │ │   Tool Layer    │ │     Memory Layer        │
│ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────────────┐ │
│ │ LLMService  │ │ │ │ToolExecutor │ │ │ │ MemoryManagerService│ │
│ │ (OpenAI)    │ │ │ │ Service     │ │ │ ├─────────────────────┤ │
│ └─────────────┘ │ │ └──────┬──────┘ │ │ │ Redis (短期缓存)    │ │
│ ┌─────────────┐ │ │        │        │ │ │ Embedding (向量化)  │ │
│ │Resilience   │ │ │        ▼        │ │ │ Persistent (持久化) │ │
│ │Service      │ │ │ ┌─────────────┐ │ │ │ Summarizer (摘要)   │ │
│ │(重试/熔断)  │ │ │ │Legacy       │ │ │ └─────────────────────┘ │
│ └─────────────┘ │ │ │ToolExecutor │ │ └─────────────────────────┘
└─────────────────┘ │ │(15个工具)   │ │
                    │ └─────────────┘ │
                    └─────────────────┘
```

---

## 核心服务职责

### 1. OrchestratorService

- **职责**: 接收用户消息，决定路由策略
- **流程**:
  1. 快速路由检测（关键词匹配）
  2. LLM 路由决策（复杂场景）
  3. 委派到专业 Agent
  4. 返回响应

### 2. WorkflowEngineService

- **职责**: 执行 Agent 的三阶段工作流
- **实现**: ReWOO (Reason Without Observation) 模式
- **三阶段**:
  1. **Plan** — LLM 分析用户意图，一次性规划所有需要调用的工具
  2. **Execute** — 按计划执行所有工具调用（无 LLM 参与，杜绝重复）
  3. **Solve** — LLM 综合所有工具结果，生成最终回复
- **降级策略**:
  - Plan 阶段 LLM 未返回工具调用 → 直接返回文本回复（无需 Solve）
  - Plan 阶段返回 delegate_to_agent → 直接委派，不进入 Execute
  - Execute 阶段某工具失败 → 标记失败，Solve 阶段基于已有结果生成回复
  - Solve 阶段流式输出为空 → 自动 fallback 到非流式重试

> 注: AgentRunnerService 仍存在于代码中用于非流式兼容路径，但主流程由 WorkflowEngineService 驱动。

### 3. LLMService

- **职责**: 封装 OpenAI API 调用
- **特性**:
  - 流式输出 (SSE)
  - Token 追踪
  - 弹性保护（重试、熔断、超时）

### 4. ToolExecutorService

- **职责**: 执行工具调用
- **实现**: 适配层，调用旧架构的 ToolExecutor
- **工具列表**: 32 个（31 业务 + 1 委派），涵盖文书、选校、档案、规划、论坛、案例预测、档案排名、外部搜索等

### 5. MemoryManagerService

- **职责**: 管理用户记忆和对话历史
- **三层架构**:
  - Redis: 短期缓存（默认 24 小时 TTL，可配置 `MEMORY_CACHE_TTL`）
  - PostgreSQL: 持久化存储
  - pgvector: 语义搜索
- **增强服务**: MemoryScorerService（评分）、MemoryDecayService（衰减）、MemoryConflictService（冲突解决）、MemoryCompactionService（压缩）

---

## 数据流

### 用户消息处理流程

```text
用户消息 "帮我选校"
        │
        ▼
┌──────────────────┐
│ AiAgentController│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  FastRouter      │ ──→ 匹配关键词 "选校" → School Agent
└────────┬─────────┘
         │ (如未匹配)
         ▼
┌──────────────────┐
│  Orchestrator    │ ──→ LLM 判断 → delegate_to_agent(school)
└────────┬─────────┘
         │
         ▼
┌──────────────────────┐
│  WorkflowEngine      │ ──→ 运行 School Agent（三阶段）
│  (School Agent)      │
└────────┬─────────────┘
         │
  Phase 1: PLAN
    ▼
┌───────┐
│  LLM  │ ──→ 规划: 需调用 get_profile, recommend_schools
└───┬───┘
    │
  Phase 2: EXECUTE
    ▼
┌───────┐
│ Tools │ ──→ 执行 get_profile → 执行 recommend_schools
└───┬───┘
    │
  Phase 3: SOLVE
    ▼
┌───────┐
│  LLM  │ ──→ 综合工具结果生成最终回复
└───┬───┘
    ▼
┌──────────────────┐
│  返回推荐结果    │
└──────────────────┘
```

### 记忆检索流程

```text
用户提问
    │
    ▼
┌────────────────────┐
│ getRetrievalContext│
└─────────┬──────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌───────┐  ┌─────────────┐
│ Redis │  │ Persistent  │
│ Cache │  │  Memory     │
└───┬───┘  └──────┬──────┘
    │             │
    │      ┌──────┴──────┐
    │      ▼             ▼
    │ ┌─────────┐  ┌──────────┐
    │ │Embedding│  │  Query   │
    │ │ Search  │  │ (type)   │
    │ └────┬────┘  └────┬─────┘
    │      │            │
    └──────┴─────┬──────┘
                 ▼
          ┌─────────────┐
          │ 合并结果    │
          │ 构建上下文  │
          └─────────────┘
```

---

## 配置说明

### Agent 配置 (agents.config.ts)

```typescript
{
  type: AgentType.ESSAY,
  name: '文书专家',
  systemPrompt: '...专业的 Prompt...',
  tools: ['get_essays', 'review_essay', ...],
  canDelegate: [AgentType.ORCHESTRATOR],
  model: 'gpt-4o-mini',
  temperature: 0.7,
}
```

### 工具配置 (tools.config.ts)

```typescript
{
  name: 'search_schools',
  description: '搜索学校...',
  parameters: {
    type: 'object',
    properties: { query: {...}, rankRange: {...} },
    required: [],
  },
  handler: 'school.search',
}
```

---

## 弹性保护

### 1. 重试策略 (ResilienceService)

- 最大重试次数: 3
- 指数退避: 1s → 2s → 4s
- 可重试错误: 429, 500, 502, 503, 504

### 2. 熔断器 (CircuitBreaker)

- 失败阈值: 5 次
- 恢复超时: 30 秒
- 半开状态请求数: 2

### 3. 超时控制

- LLM 调用: 30 秒（`LLM_CONFIG.defaultTimeoutMs = 30000`）
- 工具执行: 30 秒（`TOOL_TIMEOUT_MS = 30000`）
- Embedding 生成: 15 秒（`EMBEDDING_CONFIG.timeoutMs = 15000`）

### 4. 限流 (RateLimiterService)

- 滑动窗口算法
- Redis 分布式实现
- 支持 VIP 差异化配额

---

## 扩展指南

### 添加新 Agent

1. 在 `types/index.ts` 添加 AgentType 枚举值
2. 在 `agents.config.ts` 添加配置
3. 配置该 Agent 可用的 tools

### 添加新工具

1. 在 `tools.config.ts` 添加工具定义
2. 在旧架构 `tools.executor.ts` 实现执行逻辑
3. 在 Agent 配置中启用该工具

### 自定义 LLM 模型

修改 `agents.config.ts` 中的 `model` 字段：

```typescript
model: 'gpt-4-turbo'; // 或其他模型
```

---

## 故障排查

### 常见问题

| 问题         | 可能原因              | 解决方案                       |
| ------------ | --------------------- | ------------------------------ |
| LLM 超时     | 网络问题 / 模型过载   | 检查网络，增加超时             |
| 工具执行失败 | 数据库连接 / 参数错误 | 查看日志，检查参数             |
| 记忆检索为空 | pgvector 未启用       | 运行 `CREATE EXTENSION vector` |
| 限流触发     | 请求过于频繁          | 检查限流配置                   |

### 日志级别

```typescript
// main.ts 中配置
Logger.overrideLogger(['error', 'warn', 'log', 'debug']);
```

### 监控端点

- `GET /ai-agent/health` - 健康检查
- `GET /ai-agent/usage/:userId` - 使用统计
- `GET /ai-agent/rate-limit/:userId` - 限流状态

---

## 用户数据管理 API

提供 GDPR 合规的用户数据管理功能。

### 记忆管理

| API                                         | 方法   | 说明                       |
| ------------------------------------------- | ------ | -------------------------- |
| `/ai-agent/user-data/memories`              | GET    | 获取记忆列表（分页、筛选） |
| `/ai-agent/user-data/memories/:id`          | GET    | 获取单条记忆               |
| `/ai-agent/user-data/memories/:id`          | DELETE | 删除单条记忆               |
| `/ai-agent/user-data/memories/batch-delete` | POST   | 批量删除记忆               |
| `/ai-agent/user-data/memories`              | DELETE | 清除所有记忆               |

### 对话管理

| API                                     | 方法   | 说明                   |
| --------------------------------------- | ------ | ---------------------- |
| `/ai-agent/user-data/conversations`     | GET    | 获取对话列表           |
| `/ai-agent/user-data/conversations/:id` | GET    | 获取对话详情（含消息） |
| `/ai-agent/user-data/conversations/:id` | DELETE | 删除对话               |
| `/ai-agent/user-data/conversations`     | DELETE | 清除所有对话           |

### 实体管理

| API                                | 方法   | 说明         |
| ---------------------------------- | ------ | ------------ |
| `/ai-agent/user-data/entities`     | GET    | 获取实体列表 |
| `/ai-agent/user-data/entities/:id` | DELETE | 删除实体     |
| `/ai-agent/user-data/entities`     | DELETE | 清除所有实体 |

### 偏好设置

| API                                     | 方法 | 说明         |
| --------------------------------------- | ---- | ------------ |
| `/ai-agent/user-data/preferences`       | GET  | 获取 AI 偏好 |
| `/ai-agent/user-data/preferences`       | PUT  | 更新 AI 偏好 |
| `/ai-agent/user-data/preferences/reset` | POST | 重置为默认值 |

### 数据导出与清除

| API                                   | 方法   | 说明                 |
| ------------------------------------- | ------ | -------------------- |
| `/ai-agent/user-data/export`          | POST   | 导出所有数据（JSON） |
| `/ai-agent/user-data/export/download` | GET    | 下载数据文件         |
| `/ai-agent/user-data/stats`           | GET    | 获取统计信息         |
| `/ai-agent/user-data/clear`           | POST   | 批量清除（可选）     |
| `/ai-agent/user-data/all`             | DELETE | 清除所有 AI 数据     |

### 查询参数示例

```typescript
// 获取记忆列表
GET /ai-agent/user-data/memories?types=FACT,PREFERENCE&category=school&page=1&limit=20

// 获取对话列表
GET /ai-agent/user-data/conversations?page=1&limit=10
```

---

## 数据库模型

### AI Agent 相关表

| 表名              | 用途              |
| ----------------- | ----------------- |
| AgentConversation | AI 对话记录       |
| AgentMessage      | 对话消息          |
| Memory            | 用户记忆 (含向量) |
| Entity            | 实体提取          |
| UserAIPreference  | AI 偏好设置       |

### pgvector 使用

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 向量相似度查询
SELECT *, 1 - (embedding <=> query_vector) AS similarity
FROM "Memory"
WHERE "userId" = 'xxx'
ORDER BY embedding <=> query_vector
LIMIT 10;
```

---

## 版本历史

| 版本  | 日期    | 变更                    |
| ----- | ------- | ----------------------- |
| 1.0.0 | 2026-01 | 初始版本，多 Agent 架构 |
