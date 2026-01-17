# AI Agent 系统技术规格文档

> 版本: 2.0.0 | 更新日期: 2026-01-26

## 目录

**Part I: 多 Agent 协作系统**

1. [多 Agent 架构概览](#1-多-agent-架构概览)
2. [Agent 类型与配置](#2-agent-类型与配置)
3. [核心执行服务](#3-核心执行服务)
4. [工具系统](#4-工具系统)
5. [弹性与容错](#5-弹性与容错)

**Part II: 记忆层系统** 6. [记忆系统架构概览](#6-记忆系统架构概览) 7. [多级存储层架构 (L1-L4)](#7-多级存储层架构-l1-l4) 8. [记忆核心服务详解](#8-记忆核心服务详解) 9. [记忆生命周期管理](#9-记忆生命周期管理)

**Part III: 基础设施** 10. [类型系统规格](#10-类型系统规格) 11. [API 与权限控制](#11-api-与权限控制) 12. [监控与可观测性](#12-监控与可观测性) 13. [性能优化策略](#13-性能优化策略)

---

# Part I: 多 Agent 协作系统

---

## 1. 多 Agent 架构概览

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户请求入口                                    │
│                           POST /ai-agent/chat                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AgentThrottleGuard                                │
│                   (并发限制 + 频率限流 + 配额检查)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FastRouterService                                  │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  关键词预判 → 简单问答直接回复 / 高置信度直接路由 / 低置信度交协调器  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
            ┌───────────────┐               ┌───────────────────────┐
            │  简单问答      │               │  OrchestratorService  │
            │  直接返回      │               │     (协调器)           │
            └───────────────┘               └───────────┬───────────┘
                                                        │
                           ┌────────────────────────────┼────────────────────────────┐
                           │                            │                            │
                           ▼                            ▼                            ▼
                  ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
                  │   ORCHESTRATOR  │        │  专业 Agent     │        │  记忆系统       │
                  │   (智能路由)    │───────▶│  (委派执行)     │◀──────▶│  (上下文增强)   │
                  └─────────────────┘        └─────────────────┘        └─────────────────┘
                           │                            │
                           │        ┌───────────────────┼───────────────────┐
                           │        │                   │                   │
                           ▼        ▼                   ▼                   ▼
                  ┌─────────────────────────────────────────────────────────────────┐
                  │                    AgentRunnerService                           │
                  │   ┌─────────────────────────────────────────────────────────┐  │
                  │   │  推理循环 (最多8次迭代)                                   │  │
                  │   │  1. 构建 System Prompt (含记忆上下文)                     │  │
                  │   │  2. 调用 LLM (gpt-4o-mini)                               │  │
                  │   │  3. 处理工具调用 / 委派 / 最终响应                        │  │
                  │   └─────────────────────────────────────────────────────────┘  │
                  └─────────────────────────────────────────────────────────────────┘
                                                        │
                           ┌────────────────────────────┼────────────────────────────┐
                           │                            │                            │
                           ▼                            ▼                            ▼
                  ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
                  │   LLMService    │        │ToolExecutorService│        │ResilienceService│
                  │   - OpenAI API  │        │   - 18个工具     │        │   - 重试       │
                  │   - 流式支持    │        │   - 超时保护     │        │   - 熔断       │
                  │   - Token追踪   │        │   - Metrics埋点  │        │   - 超时       │
                  └─────────────────┘        └─────────────────┘        └─────────────────┘
```

### 1.2 Agent 协作模式

```
                         ┌─────────────────────────────┐
                         │       ORCHESTRATOR          │
                         │         (协调者)             │
                         │   • 智能路由                 │
                         │   • 任务委派                 │
                         │   • 上下文管理               │
                         └─────────────┬───────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │ delegate_to_agent      │                        │
              ▼                        ▼                        ▼
     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
     │     ESSAY       │     │     SCHOOL      │     │    PROFILE      │
     │   (文书专家)     │     │   (选校专家)    │     │  (档案分析师)    │
     │                 │     │                 │     │                 │
     │ • 文书评估      │     │ • 学校搜索      │     │ • 背景分析      │
     │ • 润色修改      │     │ • 录取分析      │     │ • 优势识别      │
     │ • 头脑风暴      │     │ • 选校推荐      │     │ • 档案管理      │
     │ • 大纲生成      │     │ • 学校对比      │     │                 │
     └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
              │                       │                       │
              └───────────────────────┼───────────────────────┘
                                      │
                         ┌────────────▼────────────┐
                         │       TIMELINE          │
                         │      (规划顾问)          │
                         │                         │
                         │ • 时间线规划             │
                         │ • 截止日期管理           │
                         │ • 任务分解               │
                         │ • 案例参考               │
                         └─────────────────────────┘

委派规则:
• 最大委派深度: 3 层
• 专业 Agent 可委派回 ORCHESTRATOR
• 委派时携带上下文和记忆
```

### 1.3 文件结构

```
apps/api/src/modules/ai-agent/
├── ai-agent.controller.ts      # 主控制器
├── ai-agent.module.ts          # 模块定义
│
├── config/                     # 配置层
│   ├── agents.config.ts        # Agent 配置 (5个Agent)
│   └── tools.config.ts         # 工具配置 (18个工具)
│
├── core/                       # 核心服务层
│   ├── orchestrator.service.ts # 协调器 (入口)
│   ├── agent-runner.service.ts # Agent 执行器
│   ├── llm.service.ts          # LLM 调用
│   ├── tool-executor.service.ts# 工具执行
│   ├── fast-router.service.ts  # 快速路由
│   ├── fallback.service.ts     # 降级服务
│   ├── resilience.service.ts   # 弹性保护
│   ├── memory.service.ts       # 基础记忆 (降级)
│   └── token-tracker.service.ts# Token 追踪
│
├── memory/                     # 企业级记忆系统
│   └── (12个服务文件)
│
├── infrastructure/             # 基础设施层
│   ├── config/                 # 配置管理
│   ├── context/                # 请求上下文
│   ├── observability/          # 可观测性
│   └── storage/                # 存储抽象
│
├── admin/                      # 管理接口
│   └── agent-admin.controller.ts
│
├── guards/                     # 权限守卫
│   └── agent-throttle.guard.ts
│
└── types/                      # 类型定义
    └── index.ts
```

---

## 2. Agent 类型与配置

### 2.1 Agent 类型枚举

```typescript
enum AgentType {
  ORCHESTRATOR = 'orchestrator', // 协调者 - 智能路由和任务分发
  ESSAY = 'essay', // 文书专家 - 文书写作和修改
  SCHOOL = 'school', // 选校专家 - 学校搜索和推荐
  PROFILE = 'profile', // 档案分析 - 背景评估
  TIMELINE = 'timeline', // 规划顾问 - 时间规划
}
```

### 2.2 Agent 配置详情

| Agent        | 模型        | Temperature | MaxTokens | 工具数 | 可委派                           |
| ------------ | ----------- | ----------- | --------- | ------ | -------------------------------- |
| ORCHESTRATOR | gpt-4o-mini | 0.3         | 1000      | 1      | ESSAY, SCHOOL, PROFILE, TIMELINE |
| ESSAY        | gpt-4o-mini | 0.7         | 4000      | 6      | ORCHESTRATOR                     |
| SCHOOL       | gpt-4o-mini | 0.5         | 4000      | 6      | ORCHESTRATOR                     |
| PROFILE      | gpt-4o-mini | 0.5         | 3000      | 2      | ORCHESTRATOR                     |
| TIMELINE     | gpt-4o-mini | 0.5         | 3000      | 4      | ORCHESTRATOR                     |

### 2.3 ORCHESTRATOR (协调者)

**职责**: 智能路由，将用户请求分发给专业 Agent

**System Prompt**:

```
留学申请AI协调者。中文回复。

委派规则:
- 文书(写作/修改/润色) → essay
- 选校(搜索/对比/录取分析) → school
- 档案(成绩/活动/背景) → profile
- 规划(截止日期/时间线) → timeline
- 简单问候 → 直接回复

需委派时调用 delegate_to_agent
```

**工具**: `delegate_to_agent`

**路由决策逻辑**:

```typescript
// FastRouterService 预判规则
const ROUTING_RULES = {
  essay: ['文书', 'essay', 'PS', '个人陈述', '润色', '修改', '写作'],
  school: ['选校', '学校', '排名', '录取率', '推荐', '对比'],
  profile: ['档案', '背景', 'GPA', '活动', '竞争力', '分析'],
  timeline: ['规划', '时间线', 'deadline', '截止', '计划'],
};
```

### 2.4 ESSAY (文书专家)

**职责**: 文书写作、修改、评估和创意生成

**System Prompt**:

```
留学文书专家。中文回复。

能力: 文书评估|润色修改|头脑风暴|大纲规划

评估标准: 真实个性、具体细节、清晰结构、自然语言、切题

流程:
1. get_profile 了解背景
2. get_essays 查看文书
3. 提供具体可操作建议

原则: 保持学生声音，不代写完整文书
```

**工具**:
| 工具名 | 功能 |
|--------|------|
| `get_profile` | 获取用户档案 |
| `get_essays` | 获取已保存文书 |
| `review_essay` | 评估文书质量 |
| `polish_essay` | 润色文书 (formal/vivid/concise) |
| `generate_outline` | 生成文书大纲 |
| `brainstorm_ideas` | 头脑风暴创意 |

### 2.5 SCHOOL (选校专家)

**职责**: 学校搜索、对比、推荐和录取分析

**System Prompt**:

```
留学选校顾问。中文回复。

能力: 学校查询|选校推荐|学校对比|录取分析

选校分层:
- Reach(<30%): 冲刺校
- Match(30-70%): 匹配校
- Safety(>70%): 保底校

考虑因素: GPA/标化匹配度、专业排名、地理位置、学费奖学金、校园规模

流程:
1. get_profile 了解背景
2. 搜索/推荐学校
3. 数据支撑分析

原则: 用数据说话，解释推荐理由
```

**工具**:
| 工具名 | 功能 |
|--------|------|
| `get_profile` | 获取用户档案 |
| `search_schools` | 按条件搜索学校 |
| `get_school_details` | 获取学校详情 |
| `compare_schools` | 对比多所学校 |
| `recommend_schools` | 智能推荐 (Reach/Match/Safety) |
| `analyze_admission_chance` | 分析录取概率 |

### 2.6 PROFILE (档案分析师)

**职责**: 用户档案管理和背景分析

**System Prompt**:

```
留学背景分析师。中文回复。

能力: 档案审查|优势分析|短板识别|定位建议

分析维度:
- 学术: GPA、课程难度、趋势
- 标化: SAT/ACT、TOEFL/IELTS
- 活动: 深度、持续性、领导力
- 奖项: 级别、相关性

流程:
1. get_profile 获取档案
2. 多维度分析
3. 可执行提升建议

原则: 客观分析，指出优势也不回避不足
```

**工具**:
| 工具名 | 功能 |
|--------|------|
| `get_profile` | 获取用户档案 |
| `update_profile` | 更新档案字段 |

### 2.7 TIMELINE (规划顾问)

**职责**: 申请时间线规划和截止日期管理

**System Prompt**:

```
留学规划顾问。中文回复。

能力: 时间线规划|截止日期管理|任务分解|案例参考

轮次: ED(11月,绑定)|EA(11月)|ED2(1月,绑定)|RD(1月)

规划原则:
- 文书提前2-3月准备
- 标化预留2次考试机会
- 推荐信提前1月联系
- 预留1周检查提交

流程:
1. 了解目标和进度
2. get_deadlines 查询截止日期
3. 制定详细规划

原则: 给出具体时间节点，按优先级排列
```

**工具**:
| 工具名 | 功能 |
|--------|------|
| `get_profile` | 获取用户档案 |
| `get_deadlines` | 获取申请截止日期 |
| `create_timeline` | 创建个性化时间线 |
| `search_cases` | 搜索录取案例 |

---

## 3. 核心执行服务

### 3.1 OrchestratorService (协调器)

**位置**: `core/orchestrator.service.ts`

**职责**: 统一入口，管理多 Agent 协作

**依赖关系**:

```typescript
@Injectable()
export class OrchestratorService {
  constructor(
    private readonly agentRunner: AgentRunnerService,
    private readonly memory: MemoryService, // 内存记忆
    private readonly llm: LLMService,
    private readonly toolExecutor: ToolExecutorService,
    @Optional() private readonly memoryManager?: MemoryManagerService, // 企业级记忆
    @Optional() private readonly fastRouter?: FastRouterService,
    @Optional() private readonly fallback?: FallbackService
  ) {}
}
```

**核心方法**:

#### handleMessage (同步处理)

```typescript
async handleMessage(userId: string, message: string, conversationId?: string): Promise<AgentResponse> {
  // 1. 快速路由检查
  if (this.fastRouter) {
    const routeResult = this.fastRouter.route(message);
    if (routeResult.canHandle && routeResult.response) {
      return routeResult.response;  // 简单问答直接返回
    }
  }

  // 2. 获取/创建对话
  const conversation = await this.getOrCreateConversation(userId, conversationId);

  // 3. 添加用户消息
  await this.addMessage(conversation, { role: 'user', content: message });

  // 4. 确定初始 Agent
  const initialAgent = this.fastRouter?.route(message).targetAgent ?? AgentType.ORCHESTRATOR;

  // 5. 执行 Agent (含委派循环)
  let response = await this.agentRunner.run(conversation, initialAgent);
  let delegationDepth = 0;

  while (response.delegatedTo && delegationDepth < 3) {
    response = await this.agentRunner.run(conversation, response.delegatedTo);
    delegationDepth++;
  }

  // 6. 保存响应
  await this.addMessage(conversation, { role: 'assistant', content: response.message });

  return response;
}
```

#### handleMessageStream (流式处理)

```typescript
async *handleMessageStream(userId: string, message: string, conversationId?: string): AsyncGenerator<StreamEvent> {
  // ... 类似流程，但返回流式事件
  yield { type: 'content', data: { chunk: '...' } };
  yield { type: 'tool_start', data: { name: '...', args: {...} } };
  yield { type: 'tool_end', data: { name: '...', result: {...} } };
  yield { type: 'agent_switch', data: { from: '...', to: '...' } };
  yield { type: 'done', data: { response: {...} } };
}
```

#### buildSystemPrompt (记忆增强)

```typescript
private async buildSystemPrompt(conversation: ConversationState, agentType: AgentType, currentMessage?: string): Promise<string> {
  const config = getAgentConfig(agentType);
  let contextSummary = this.memory.getContextSummary(conversation.context);

  // 企业级记忆增强
  if (this.memoryManager && currentMessage) {
    const retrievalContext = await this.memoryManager.getRetrievalContext(
      conversation.userId,
      currentMessage,
      conversation.id,
    );
    contextSummary = this.memoryManager.buildContextSummary(retrievalContext);
  }

  return `${config.systemPrompt}\n\n## 用户信息\n${contextSummary}`;
}
```

### 3.2 AgentRunnerService (执行器)

**位置**: `core/agent-runner.service.ts`

**职责**: 执行单个 Agent 的推理循环

**执行流程**:

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentRunner.run()                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │  iteration = 0              │
              │  MAX_ITERATIONS = 8         │
              └─────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         │                                      │
         ▼                                      │
┌─────────────────────────┐                    │
│ 1. 构建 System Prompt   │                    │
│    (含用户上下文)       │                    │
└─────────────────────────┘                    │
         │                                      │
         ▼                                      │
┌─────────────────────────┐                    │
│ 2. 获取最近消息         │                    │
│    memory.getRecent()   │                    │
└─────────────────────────┘                    │
         │                                      │
         ▼                                      │
┌─────────────────────────┐                    │
│ 3. 调用 LLM             │                    │
│    llm.call()           │                    │
│    - userId             │                    │
│    - conversationId     │                    │
│    - agentType          │                    │
└─────────────────────────┘                    │
         │                                      │
         ▼                                      │
┌─────────────────────────┐                    │
│ 4. 检查响应             │                    │
└─────────────────────────┘                    │
         │                                      │
    ┌────┴────┐                                │
    │         │                                │
    ▼         ▼                                │
┌───────┐ ┌───────────────────────────────┐   │
│无工具 │ │ 有工具调用                     │   │
│调用   │ │                               │   │
└───┬───┘ │ 5a. 检查是否是委派            │   │
    │     │     → 是: 返回 delegatedTo    │   │
    │     │                               │   │
    │     │ 5b. 执行工具 (带10s超时)      │   │
    │     │     toolExecutor.execute()   │   │
    │     │                               │   │
    │     │ 5c. 记录工具结果              │   │
    │     │     memory.addMessage()       │   │
    │     └───────────────────────────────┘   │
    │                  │                       │
    │                  │ iteration++           │
    │                  └───────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ 返回最终响应            │
│ { message, agentType,   │
│   toolsUsed, ... }      │
└─────────────────────────┘
```

**关键代码**:

```typescript
async run(conversation: ConversationState, agentType: AgentType): Promise<AgentResponse> {
  const config = getAgentConfig(agentType);
  const tools = getTools(config.tools);
  const toolsUsed: string[] = [];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const systemPrompt = this.buildSystemPrompt(conversation, agentType);
    const messages = this.memory.getRecentMessages(conversation, 20);

    const response = await this.llm.call({
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      tools: toOpenAIFormat(tools),
    }, { userId: conversation.userId, conversationId: conversation.id, agentType });

    if (!response.toolCalls?.length) {
      return { message: response.content, agentType, toolsUsed };
    }

    // 处理工具调用
    for (const toolCall of response.toolCalls) {
      if (toolCall.function.name === 'delegate_to_agent') {
        return this.handleDelegation(toolCall);
      }

      const result = await this.withTimeout(
        this.toolExecutor.execute(toolCall, conversation.context),
        10000  // 10秒超时
      );

      this.memory.addMessage(conversation, {
        role: 'tool',
        content: JSON.stringify(result),
        toolCallId: toolCall.id
      });
      toolsUsed.push(toolCall.function.name);
    }
  }

  return { message: '达到最大迭代次数', agentType, toolsUsed };
}
```

### 3.3 LLMService (LLM 调用)

**位置**: `core/llm.service.ts`

**职责**: 封装 OpenAI API 调用

**核心特性**:

- 同步调用: `call()`
- 流式调用: `callStream()`
- 弹性保护: 重试 + 熔断 + 超时
- Token 追踪: 记录使用量

**配置**:

```typescript
const LLM_CONFIG = {
  defaultTimeout: 30000, // 30秒超时
  retryAttempts: 3, // 最多重试3次
  retryBackoff: 'exponential', // 指数退避
  circuitBreaker: {
    failureThreshold: 5, // 失败阈值
    resetTimeout: 30000, // 重置时间
  },
};
```

**调用流程**:

```typescript
async call(request: ChatCompletionRequest, context: LLMContext): Promise<LLMResponse> {
  return this.resilience.execute(
    async () => {
      const response = await this.openai.chat.completions.create({
        model: request.model,
        messages: this.formatMessages(request.messages),
        tools: request.tools,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      });

      // Token 追踪
      if (this.tokenTracker) {
        await this.tokenTracker.trackUsage(context, response.usage);
      }

      return this.parseResponse(response);
    },
    { timeout: 30000, retries: 3, circuitBreaker: 'llm' }
  );
}
```

### 3.4 ToolExecutorService (工具执行)

**位置**: `core/tool-executor.service.ts`

**职责**: 执行工具调用，适配旧架构

**特性**:

- 超时保护 (10秒)
- 重试机制 (非幂等工具除外)
- Metrics 埋点
- 特殊处理委派工具

**重试配置**:

```typescript
const NON_RETRYABLE_TOOLS = [
  'update_profile', // 可能重复更新
  'polish_essay', // 可能重复修改
];

const RETRY_CONFIG = {
  maxRetries: 2,
  backoff: 'exponential',
};
```

### 3.5 FastRouterService (快速路由)

**位置**: `core/fast-router.service.ts`

**职责**: 减少不必要的 LLM 调用

**路由规则**:

```typescript
const SIMPLE_RESPONSES = {
  你好: '你好！我是留学申请助手，可以帮你处理文书、选校、档案分析和时间规划。有什么需要帮助的？',
  hello: "Hello! I'm your study abroad assistant...",
  谢谢: '不客气！还有其他需要帮助的吗？',
};

const KEYWORD_RULES: Record<AgentType, string[]> = {
  essay: ['文书', 'essay', 'PS', '个人陈述', '润色', '修改'],
  school: ['选校', '学校', '排名', '录取率', '推荐'],
  profile: ['档案', '背景', 'GPA', '活动', '竞争力'],
  timeline: ['规划', '时间线', 'deadline', '截止'],
};
```

**路由逻辑**:

```typescript
route(message: string): RouteResult {
  // 1. 简单问答检查
  for (const [keyword, response] of Object.entries(SIMPLE_RESPONSES)) {
    if (message.includes(keyword)) {
      return { canHandle: true, response, confidence: 1.0 };
    }
  }

  // 2. 关键词匹配
  let bestMatch: AgentType | null = null;
  let maxScore = 0;

  for (const [agent, keywords] of Object.entries(KEYWORD_RULES)) {
    const score = this.calculateScore(message, keywords);
    if (score > maxScore) {
      maxScore = score;
      bestMatch = agent as AgentType;
    }
  }

  // 3. 置信度判断
  if (maxScore >= 0.7) {
    return { canHandle: true, targetAgent: bestMatch, confidence: maxScore };
  }

  return { canHandle: false, confidence: maxScore };
}
```

---

## 4. 工具系统

### 4.1 工具总览

系统定义了 **18 个工具**，分为 7 类：

| 类别   | 工具数 | 工具列表                                                                   |
| ------ | ------ | -------------------------------------------------------------------------- |
| 委派   | 1      | delegate_to_agent                                                          |
| 档案   | 2      | get_profile, update_profile                                                |
| 学校   | 3      | search_schools, get_school_details, compare_schools                        |
| 文书   | 5      | get_essays, review_essay, polish_essay, generate_outline, brainstorm_ideas |
| 选校   | 2      | recommend_schools, analyze_admission_chance                                |
| 案例   | 1      | search_cases                                                               |
| 时间线 | 2      | get_deadlines, create_timeline                                             |

### 4.2 工具定义格式

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
  };
  handler?: (args: unknown, context: ToolContext) => Promise<unknown>;
}
```

### 4.3 核心工具详解

#### delegate_to_agent (委派工具)

```typescript
{
  name: 'delegate_to_agent',
  description: '将任务委派给专业Agent处理',
  parameters: {
    type: 'object',
    properties: {
      agent_type: {
        type: 'string',
        description: '目标Agent类型',
        enum: ['essay', 'school', 'profile', 'timeline'],
      },
      task_description: {
        type: 'string',
        description: '任务描述，传递给目标Agent',
      },
      context: {
        type: 'object',
        description: '传递的上下文信息',
      },
    },
    required: ['agent_type', 'task_description'],
  },
}
```

#### recommend_schools (选校推荐)

```typescript
{
  name: 'recommend_schools',
  description: '基于用户档案智能推荐学校',
  parameters: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: '推荐数量，默认10',
      },
      tiers: {
        type: 'array',
        items: { type: 'string', enum: ['reach', 'match', 'safety'] },
        description: '推荐层级',
      },
      preferences: {
        type: 'object',
        properties: {
          location: { type: 'string' },
          major: { type: 'string' },
          budget: { type: 'number' },
        },
      },
    },
    required: [],
  },
}
```

#### analyze_admission_chance (录取分析)

```typescript
{
  name: 'analyze_admission_chance',
  description: '分析用户被特定学校录取的概率',
  parameters: {
    type: 'object',
    properties: {
      school_id: {
        type: 'string',
        description: '学校ID',
      },
      round: {
        type: 'string',
        enum: ['ED', 'EA', 'ED2', 'RD'],
        description: '申请轮次',
      },
    },
    required: ['school_id'],
  },
}
```

### 4.4 工具权限矩阵

| 工具                     | ORCHESTRATOR | ESSAY | SCHOOL | PROFILE | TIMELINE |
| ------------------------ | :----------: | :---: | :----: | :-----: | :------: |
| delegate_to_agent        |      ✓       |       |        |         |          |
| get_profile              |              |   ✓   |   ✓    |    ✓    |    ✓     |
| update_profile           |              |       |        |    ✓    |          |
| get_essays               |              |   ✓   |        |         |          |
| review_essay             |              |   ✓   |        |         |          |
| polish_essay             |              |   ✓   |        |         |          |
| generate_outline         |              |   ✓   |        |         |          |
| brainstorm_ideas         |              |   ✓   |        |         |          |
| search_schools           |              |       |   ✓    |         |          |
| get_school_details       |              |       |   ✓    |         |          |
| compare_schools          |              |       |   ✓    |         |          |
| recommend_schools        |              |       |   ✓    |         |          |
| analyze_admission_chance |              |       |   ✓    |         |          |
| search_cases             |              |       |        |         |    ✓     |
| get_deadlines            |              |       |        |         |    ✓     |
| create_timeline          |              |       |        |         |    ✓     |

---

## 5. 弹性与容错

### 5.1 ResilienceService (弹性服务)

**位置**: `core/resilience.service.ts`

**三层保护**:

```
┌─────────────────────────────────────────────────────────────┐
│                       请求                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    超时控制 (Timeout)                       │
│                      默认 30 秒                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    熔断器 (Circuit Breaker)                 │
│   ┌─────────┐    ┌─────────┐    ┌─────────────┐            │
│   │ CLOSED  │───▶│  OPEN   │───▶│ HALF_OPEN   │            │
│   │ (正常)  │◀───│ (断开)  │◀───│ (半开测试)  │            │
│   └─────────┘    └─────────┘    └─────────────┘            │
│   失败阈值:5     重置时间:30s   半开请求数:2               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    重试机制 (Retry)                         │
│             最多 3 次，指数退避 (1s, 2s, 4s)                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       执行                                  │
└─────────────────────────────────────────────────────────────┘
```

**熔断器状态机**:

```typescript
enum CircuitState {
  CLOSED = 'closed', // 正常，请求通过
  OPEN = 'open', // 断开，请求快速失败
  HALF_OPEN = 'half_open', // 半开，允许少量请求测试
}

interface CircuitBreakerConfig {
  failureThreshold: number; // 5 - 触发熔断的失败次数
  resetTimeout: number; // 30000ms - 从OPEN到HALF_OPEN的等待时间
  halfOpenRequests: number; // 2 - HALF_OPEN状态允许的测试请求数
}
```

**使用示例**:

```typescript
// 组合使用
async execute<T>(fn: () => Promise<T>, options: ExecuteOptions): Promise<T> {
  return this.withTimeout(
    this.withCircuitBreaker(
      this.withRetry(fn, options.retries),
      options.circuitBreaker
    ),
    options.timeout
  );
}
```

### 5.2 FallbackService (降级服务)

**位置**: `core/fallback.service.ts`

**错误分类**:

```typescript
enum ErrorCategory {
  TIMEOUT = 'timeout', // 超时
  RATE_LIMIT = 'rate_limit', // 限流
  QUOTA = 'quota', // 配额超限
  NETWORK = 'network', // 网络错误
  CIRCUIT_OPEN = 'circuit_open', // 熔断器断开
  MODERATION = 'moderation', // 内容审核
  UNKNOWN = 'unknown', // 未知错误
}
```

**降级响应**:

```typescript
const FALLBACK_RESPONSES: Record<ErrorCategory, FallbackResponse> = {
  timeout: {
    message: '处理时间较长，请稍后再试或简化您的问题。',
    suggestions: ['简化问题', '分步询问'],
    shouldRetry: true,
  },
  rate_limit: {
    message: '请求过于频繁，请稍等片刻后再试。',
    retryAfter: 60,
    shouldRetry: true,
  },
  quota: {
    message: '今日使用额度已达上限，请明天再试或升级套餐。',
    shouldRetry: false,
    action: 'upgrade',
  },
  circuit_open: {
    message: '服务暂时不可用，我们正在处理中，请稍后再试。',
    shouldRetry: true,
    retryAfter: 30,
  },
  // ...
};
```

### 5.3 AgentThrottleGuard (限流守卫)

**位置**: `guards/agent-throttle.guard.ts`

**三层保护**:

| 层级 | 检查项   | 普通用户                   | VIP/ADMIN |
| ---- | -------- | -------------------------- | --------- |
| 1    | 并发请求 | 2                          | 5         |
| 2    | 频率限流 | 由 RateLimiterService 配置 | 更高限额  |
| 3    | 配额检查 | 每日/每月限额              | 更高限额  |

**错误响应**:

- 并发超限: `429 Too Many Requests`
- 频率超限: `429 Too Many Requests`
- 配额超限: `402 Payment Required`

---

# Part II: 记忆层系统

---

## 6. 记忆系统架构概览

### 6.1 记忆系统架构层次图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        应用层 (Application Layer)                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               OrchestratorService (协调器)                   │   │
│  │   - 多Agent协作调度                                          │   │
│  │   - 统一记忆系统入口                                          │   │
│  │   - 双模式自动切换                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  AgentRunner    │    │   FastRouter    │    │   LLMService    │
│  - 推理循环      │    │   - 快速路由     │    │   - LLM调用     │
│  - 工具执行      │    │   - 意图分类     │    │   - Token管理   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                   │
┌─────────────────────────────────────────────────────────────────────┐
│                         记忆系统层 (Memory Layer)                    │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              MemoryManagerService (企业级记忆管理器)            │ │
│  │   - 短期记忆协调 (Redis)                                       │ │
│  │   - 长期记忆协调 (PostgreSQL + pgvector)                       │ │
│  │   - 语义检索协调 (Embedding)                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                 │                                   │
│     ┌───────────────────────────┼───────────────────────────┐      │
│     │                           │                           │      │
│     ▼                           ▼                           ▼      │
│  ┌──────────┐   ┌─────────────────────────┐   ┌──────────────────┐│
│  │ Redis    │   │  PersistentMemory       │   │  Embedding       ││
│  │ Cache    │   │  Service                │   │  Service         ││
│  │ Service  │   │  - PostgreSQL           │   │  - OpenAI        ││
│  │          │   │  - pgvector             │   │  - 向量生成       ││
│  └──────────┘   └─────────────────────────┘   └──────────────────┘│
│         │                                              │           │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              降级层 (Fallback Layer)                          │ │
│  │   ┌─────────────────────────────────────────────────────┐    │ │
│  │   │              MemoryService (内存降级)                │    │ │
│  │   │   - Map<string, ConversationState>                  │    │ │
│  │   │   - 最近20条消息                                     │    │ │
│  │   │   - 用户上下文缓存 (5分钟TTL)                         │    │ │
│  │   └─────────────────────────────────────────────────────┘    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                   │
┌─────────────────────────────────────────────────────────────────────┐
│                     辅助服务层 (Support Services)                    │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│  │ Scorer    │ │ Decay     │ │ Conflict  │ │ Extractor │          │
│  │ Service   │ │ Service   │ │ Service   │ │ Service   │          │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘          │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│  │ Summarizer│ │ Compaction│ │ Sanitizer │ │ UserData  │          │
│  │ Service   │ │ Service   │ │ Service   │ │ Service   │          │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘          │
└─────────────────────────────────────────────────────────────────────┘
                                   │
┌─────────────────────────────────────────────────────────────────────┐
│                      基础设施层 (Infrastructure)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Redis     │  │ PostgreSQL  │  │  OpenAI API │                 │
│  │   Cluster   │  │ + pgvector  │  │  Embedding  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 记忆系统文件结构

```
apps/api/src/modules/ai-agent/
├── core/                           # 核心服务层
│   ├── memory.service.ts           # 基础记忆服务（降级方案）
│   ├── orchestrator.service.ts     # 协调器服务
│   ├── agent-runner.service.ts     # Agent执行器
│   ├── llm.service.ts              # LLM调用服务
│   └── fast-router.service.ts      # 快速路由服务
│
├── memory/                         # 企业级记忆系统
│   ├── memory-manager.service.ts   # 记忆管理器（核心）
│   ├── persistent-memory.service.ts # 持久化存储
│   ├── redis-cache.service.ts      # Redis缓存
│   ├── embedding.service.ts        # 向量嵌入
│   ├── summarizer.service.ts       # 摘要服务
│   ├── memory-scorer.service.ts    # 记忆评分
│   ├── memory-decay.service.ts     # 记忆衰减
│   ├── memory-conflict.service.ts  # 冲突处理
│   ├── memory-extractor.service.ts # 记忆提取
│   ├── memory-compaction.service.ts# 记忆压缩
│   ├── sanitizer.service.ts        # 敏感数据脱敏
│   ├── user-data.service.ts        # 用户数据管理
│   ├── extraction-rules.ts         # 提取规则定义
│   ├── types.ts                    # 记忆类型定义
│   └── prisma-types.ts             # Prisma查询类型
│
├── infrastructure/                 # 基础设施抽象
│   └── memory/
│       ├── memory.interface.ts     # 统一接口定义
│       └── index.ts
│
└── types/
    └── index.ts                    # 系统核心类型
```

---

## 7. 多级存储层架构 (L1-L4)

### 7.1 存储层级定义

| 层级   | 名称    | 存储介质              | TTL      | 容量        | 访问延迟  | 用途           |
| ------ | ------- | --------------------- | -------- | ----------- | --------- | -------------- |
| **L1** | WORKING | RAM (Map)             | 会话期间 | ~100条/用户 | <1ms      | 当前对话上下文 |
| **L2** | SHORT   | Redis                 | 24小时   | ~50条/会话  | 1-5ms     | 短期记忆缓存   |
| **L3** | LONG    | PostgreSQL + pgvector | 永久     | 无限制      | 10-50ms   | 持久化记忆     |
| **L4** | ARCHIVE | 冷存储                | 永久     | 无限制      | 100-500ms | 归档记忆       |

### 7.2 L1: 工作记忆层 (WORKING)

**服务**: `MemoryService` (core/memory.service.ts)

**数据结构**:

```typescript
// 会话状态存储
private conversations = new Map<string, ConversationState>();
private contextCache = new Map<string, { data: UserContext; timestamp: number }>();

interface ConversationState {
  id: string;
  userId: string;
  messages: Message[];         // 最多保留20条
  context: UserContext;
  activeAgent?: AgentType;
  pendingTasks: Task[];
  startedAt: Date;
  lastActivityAt: Date;
}
```

**特性**:

- 内存存储，访问延迟 <1ms
- 消息上限: 20条（自动清理旧消息）
- 用户上下文缓存 TTL: 5分钟
- 工具结果自动简化（避免上下文过长）
- Redis/PostgreSQL 不可用时的降级方案

**关键方法**:

```typescript
getOrCreateConversation(userId: string, conversationId?: string): ConversationState
addMessage(conversation: ConversationState, message: Message): void
getRecentMessages(conversation: ConversationState, limit?: number): Message[]
getContextSummary(context: UserContext): string
```

### 7.3 L2: 短期记忆层 (SHORT)

**服务**: `RedisCacheService` (memory/redis-cache.service.ts)

**存储结构**:

```typescript
// Redis Key 命名规范
const KEYS = {
  conversationMessages: (convId: string) => `conv:${convId}:messages`,
  conversationMeta: (convId: string) => `conv:${convId}:meta`,
  userContext: (userId: string) => `user:${userId}:context`,
  activeConversation: (userId: string) => `user:${userId}:active`,
};

// 内存降级缓存
private fallbackCache = new Map<string, CacheEntry>();
interface CacheEntry {
  data: unknown;
  expiresAt: number;
}
```

**特性**:

- 对话消息缓存（最多50条）
- 用户上下文缓存（TTL: 30分钟）
- 活跃会话追踪
- Redis不可用时自动降级到内存缓存
- 自动过期清理

**关键方法**:

```typescript
cacheMessage(conversationId: string, message: MessageRecord): Promise<void>
getConversationMessages(conversationId: string, limit?: number): Promise<MessageRecord[]>
cacheUserContext(userId: string, context: UserContext): Promise<void>
setActiveConversation(userId: string, conversationId: string): Promise<void>
```

### 7.4 L3: 长期记忆层 (LONG)

**服务**: `PersistentMemoryService` (memory/persistent-memory.service.ts)

**数据库表结构**:

```prisma
model Memory {
  id           String       @id @default(cuid())
  userId       String
  type         MemoryType   // FACT, PREFERENCE, DECISION, SUMMARY, FEEDBACK
  category     String?
  content      String
  importance   Float        @default(0.5)
  accessCount  Int          @default(0)
  lastAccessAt DateTime?
  embedding    Float[]      @db.Vector(1536)  // pgvector
  metadata     Json?
  expiresAt    DateTime?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  @@index([userId, type])
  @@index([userId, importance])
}

model Entity {
  id          String      @id @default(cuid())
  userId      String
  type        EntityType  // SCHOOL, PERSON, EVENT, TOPIC
  name        String
  description String?
  attributes  Json?
  relations   Json?
  embedding   Float[]     @db.Vector(1536)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([userId, type, name])
}

model AgentConversation {
  id          String           @id @default(cuid())
  userId      String
  title       String?
  summary     String?
  metadata    Json?
  messages    AgentMessage[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}
```

**向量检索 (pgvector)**:

```typescript
// 语义检索实现
async searchMemories(
  userId: string,
  queryEmbedding: number[],
  options: { limit?: number; types?: MemoryType[]; minImportance?: number }
): Promise<MemoryRecord[]> {
  // 使用 pgvector 的 <=> 操作符进行余弦距离搜索
  const results = await this.prisma.$queryRaw`
    SELECT *, 1 - (embedding <=> ${queryEmbedding}::vector) as similarity
    FROM "Memory"
    WHERE "userId" = ${userId}
      AND (${!types} OR "type" = ANY(${types}))
      AND "importance" >= ${minImportance}
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT ${limit}
  `;
  return results;
}
```

**特性**:

- PostgreSQL + pgvector 向量数据库
- 支持语义相似度搜索
- 搜索复杂度: O(log n)（使用 IVFFlat 索引）
- 实体关系图谱存储
- 用户偏好持久化

### 7.5 L4: 归档层 (ARCHIVE)

**触发条件**:

- 重要性低于 0.2
- 创建时间超过 180 天
- 访问计数为 0
- 手动标记归档

**归档策略**:

```typescript
interface ArchiveConfig {
  archiveThreshold: number;    // 0.2 - 重要性阈值
  archiveAfterDays: number;    // 180 - 天数阈值
  deleteAfterDays: number;     // 365 - 删除阈值
}

// 归档状态在 metadata 中标记
metadata: {
  archived: true,
  archivedAt: Date,
  archiveReason: 'decay' | 'manual' | 'expired'
}
```

---

## 8. 记忆核心服务详解

### 8.1 MemoryManagerService (记忆管理器核心)

**位置**: `memory/memory-manager.service.ts`

**职责**: 统一协调短期、长期记忆和语义检索

**依赖关系**:

```typescript
@Injectable()
export class MemoryManagerService {
  constructor(
    private readonly redisCache: RedisCacheService, // 短期记忆
    private readonly persistentMemory: PersistentMemoryService, // 长期记忆
    private readonly embedding: EmbeddingService, // 向量生成
    private readonly summarizer: SummarizerService, // 摘要生成
    @Optional() private readonly scorer?: MemoryScorerService, // 评分
    @Optional() private readonly decay?: MemoryDecayService, // 衰减
    @Optional() private readonly conflict?: MemoryConflictService // 冲突
  ) {}
}
```

**核心方法**:

##### 8.1.1 对话管理

```typescript
// 获取或创建对话
async getOrCreateConversation(userId: string, conversationId?: string): Promise<ConversationRecord>

// 添加消息（触发异步记忆提取）
async addMessage(conversationId: string, message: MessageInput): Promise<MessageRecord>
```

#### 8.1.2 记忆操作

```typescript
// 记住信息（含冲突检测与评分）
async remember(userId: string, memory: MemoryInput): Promise<MemoryRecord>

// 回忆相关信息（记录访问，语义检索）
async recall(userId: string, query: string, options?: RecallOptions): Promise<MemoryRecord[]>
```

#### 8.1.3 上下文检索

```typescript
// 获取完整检索上下文
async getRetrievalContext(
  userId: string,
  currentMessage: string,
  conversationId?: string
): Promise<RetrievalContext>

interface RetrievalContext {
  recentMessages: MessageRecord[];    // 最近对话消息
  relevantMemories: MemoryRecord[];   // 语义检索的相关记忆
  preferences: UserPreferences;       // 用户偏好
  entities: EntityRecord[];           // 相关实体
  meta: {
    conversationId?: string;
    messageCount: number;
    memoryCount: number;
  };
}
```

### 8.2 EmbeddingService (向量嵌入服务)

**位置**: `memory/embedding.service.ts`

**职责**: 生成文本的语义向量嵌入

**配置**:

```typescript
const CONFIG = {
  model: 'text-embedding-3-small', // OpenAI 嵌入模型
  dimensions: 1536, // 向量维度
  maxInputTokens: 8191, // 最大输入token
  batchSize: 100, // 批量处理大小
  cacheEnabled: true, // 启用缓存
  cacheTTL: 86400, // 缓存TTL（24小时）
};
```

**核心方法**:

```typescript
// 生成单个文本向量
async embed(text: string): Promise<number[]>

// 批量生成向量
async embedBatch(texts: string[]): Promise<number[][]>

// 计算余弦相似度
cosineSimilarity(a: number[], b: number[]): number

// 查找最相似项
findMostSimilar<T extends { embedding?: number[] }>(
  query: number[],
  items: T[],
  topK?: number
): Array<T & { similarity: number }>
```

**缓存策略**:

- 优先使用 Redis 缓存
- Redis 不可用时降级到内存 LRU 缓存
- 缓存 Key: `embedding:${hash(text)}`

### 8.3 SummarizerService (摘要服务)

**位置**: `memory/summarizer.service.ts`

**职责**: 生成对话摘要并提取记忆

**触发条件**:

```typescript
shouldSummarize(messages: Message[]): boolean {
  return (
    messages.length > 20 ||                           // 消息数超过20
    conversationDuration > 3600000 ||                 // 对话超过1小时
    totalContentLength > 10000                        // 内容超过10000字符
  );
}
```

**LLM 提取 Prompt**:

```typescript
const EXTRACTION_PROMPT = `
分析以下用户消息，提取关键信息：

消息内容：{message}
用户上下文：{context}

请提取以下类型的信息：
1. FACT: 客观事实（GPA、成绩、活动等）
2. PREFERENCE: 用户偏好（目标学校、专业意向等）
3. DECISION: 重要决定（ED选择、申请策略等）

输出JSON格式：
{
  "memories": [{ "type": "...", "content": "...", "importance": 0.0-1.0 }],
  "entities": [{ "type": "SCHOOL|PERSON|EVENT", "name": "...", "description": "..." }]
}
`;
```

### 8.4 MemoryScorerService (记忆评分服务)

**位置**: `memory/memory-scorer.service.ts`

**评分公式**:

```
TotalScore = (Importance × W_i) + (Freshness × W_f) + (Confidence × W_c) + AccessBonus

默认权重：
- W_i (importance) = 0.4
- W_f (freshness) = 0.3
- W_c (confidence) = 0.3
- AccessBonus = min(0.1, accessCount × 0.01)
```

**重要性计算规则**:

```typescript
const IMPORTANCE_RULES: Record<MemoryType, ImportanceRule> = {
  FACT: {
    base: 0.8,
    modifiers: [
      { pattern: /gpa|sat|act|toefl|ielts/i, bonus: 0.1 },
      { pattern: /排名|rank/i, bonus: 0.05 },
    ],
  },
  PREFERENCE: {
    base: 0.6,
    modifiers: [
      { pattern: /ed|早申|早决定/i, bonus: 0.15 },
      { pattern: /dream.*school|梦校/i, bonus: 0.1 },
    ],
  },
  DECISION: {
    base: 0.9,
    modifiers: [{ pattern: /ed.*决定|最终.*选择/i, bonus: 0.1 }],
  },
};
```

**新鲜度计算 (指数衰减)**:

```typescript
calculateFreshness(createdAt: Date): number {
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const decayRate = 0.1;  // 每10天衰减约63%
  return Math.exp(-decayRate * ageInDays);
}
```

**层级判定**:

```typescript
determineTier(score: number): MemoryTier {
  if (score >= 0.8) return MemoryTier.WORKING;
  if (score >= 0.5) return MemoryTier.SHORT;
  if (score >= 0.2) return MemoryTier.LONG;
  return MemoryTier.ARCHIVE;
}
```

### 8.5 MemoryDecayService (记忆衰减服务)

**位置**: `memory/memory-decay.service.ts`

**配置**:

```typescript
interface DecayConfig {
  enabled: boolean; // 启用衰减
  decayRate: number; // 每日衰减率: 0.01
  minImportance: number; // 最低重要性: 0.1
  accessBoost: number; // 访问加成: 0.05
  archiveThreshold: number; // 归档阈值: 0.2
  archiveAfterDays: number; // 归档天数: 180
  deleteAfterDays: number; // 删除天数: 365
  batchSize: number; // 批处理大小: 1000
}
```

**定时任务**:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_3AM)
async runDailyDecay(): Promise<DecayResult> {
  // 1. 执行重要性衰减
  await this.executeDecay();

  // 2. 归档低重要性记忆
  await this.executeArchive();

  // 3. 删除过期记忆
  await this.executeDelete();

  return result;
}
```

**访问强化**:

```typescript
async recordAccess(memoryId: string): Promise<void> {
  await this.prisma.memory.update({
    where: { id: memoryId },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: new Date(),
      importance: { increment: this.config.accessBoost },
    },
  });
}
```

### 8.6 MemoryConflictService (冲突处理服务)

**位置**: `memory/memory-conflict.service.ts`

**冲突策略枚举**:

```typescript
enum ConflictStrategy {
  KEEP_LATEST, // 保留最新
  KEEP_HIGHEST, // 保留最高值（数值类型）
  KEEP_OLDEST, // 保留最旧
  MERGE, // 合并内容
  KEEP_BOTH, // 都保留
  ASK_USER, // 需要用户确认
}
```

**冲突检测流程**:

```typescript
async detectConflict(newMemory: MemoryInput): Promise<ConflictDetectionResult> {
  // 1. 去重键冲突检测
  if (newMemory.metadata?.dedupeKey) {
    const existing = await this.findByDedupeKey(newMemory);
    if (existing) return { hasConflict: true, conflictType: 'key', ... };
  }

  // 2. 精确内容匹配
  const exactMatch = await this.findExactMatch(newMemory);
  if (exactMatch) return { hasConflict: true, conflictType: 'exact', ... };

  // 3. 语义相似性检测（相似度 > 90%）
  const semanticMatch = await this.findSemanticMatch(newMemory);
  if (semanticMatch && semanticMatch.similarity > 0.9) {
    return { hasConflict: true, conflictType: 'semantic', similarity: semanticMatch.similarity, ... };
  }

  return { hasConflict: false };
}
```

### 8.7 MemoryExtractorService (记忆提取服务)

**位置**: `memory/memory-extractor.service.ts`

**提取流程 (混合规则+LLM)**:

```typescript
async extract(message: string, context: ExtractionContext): Promise<ExtractionResult> {
  const stats = { ruleMatches: 0, llmExtractions: 0, duplicatesRemoved: 0, validationFailed: 0 };

  // 1. 规则提取（优先，低延迟）
  const ruleMemories = this.extractByRules(message);
  stats.ruleMatches = ruleMemories.length;

  // 2. LLM提取（补充，高准确率）
  const llmResult = await this.summarizer.extractFromMessage(message, context);
  stats.llmExtractions = llmResult.memories.length;

  // 3. 合并去重
  const merged = this.mergeAndDedupe([...ruleMemories, ...llmResult.memories]);
  stats.duplicatesRemoved = ruleMemories.length + llmResult.memories.length - merged.length;

  // 4. 验证
  const validated = merged.filter(m => this.validate(m));
  stats.validationFailed = merged.length - validated.length;

  return { memories: validated, entities: llmResult.entities, stats };
}
```

**规则定义示例**:

```typescript
const EXTRACTION_RULES: ExtractionRule[] = [
  {
    id: 'gpa',
    name: '学术成绩-GPA',
    type: MemoryType.FACT,
    patterns: [/(?:我的)?gpa[是为]?\s*(\d+\.?\d*)/i, /(?:成绩|绩点)[是为]?\s*(\d+\.?\d*)/i],
    baseImportance: 0.85,
    validator: (value) => {
      const gpa = parseFloat(value);
      return { valid: gpa >= 0 && gpa <= 5, normalizedValue: gpa.toFixed(2) };
    },
    dedupeKey: (value) => `gpa:${value}`,
    conflictStrategy: ConflictStrategy.KEEP_LATEST,
    ttlDays: 365,
  },
  // ... 更多规则
];
```

### 8.8 MemoryCompactionService (记忆压缩服务)

**位置**: `memory/memory-compaction.service.ts`

**压缩策略**:

```typescript
@Cron(CronExpression.EVERY_DAY_AT_4AM)
async runCompaction(): Promise<CompactionResult> {
  // 1. 语义去重（相似度阈值 0.92）
  await this.deduplicateMemories();

  // 2. 时间衰减合并
  await this.mergeSimilarMemories();

  // 3. 智能摘要压缩（老旧记忆）
  await this.summarizeOldMemories();

  return result;
}
```

**语义去重算法**:

```typescript
async deduplicateMemories(userId: string): Promise<number> {
  const memories = await this.getMemoriesWithEmbeddings(userId);
  const toDelete: string[] = [];

  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const similarity = this.embedding.cosineSimilarity(
        memories[i].embedding,
        memories[j].embedding
      );

      if (similarity > 0.92) {
        // 保留更重要的，删除另一个
        const keepIndex = memories[i].importance >= memories[j].importance ? i : j;
        const deleteIndex = keepIndex === i ? j : i;
        toDelete.push(memories[deleteIndex].id);
      }
    }
  }

  await this.prisma.memory.deleteMany({ where: { id: { in: toDelete } } });
  return toDelete.length;
}
```

### 8.9 SanitizerService (敏感数据脱敏服务)

**位置**: `memory/sanitizer.service.ts`

**脱敏级别**:

```typescript
enum SanitizeLevel {
  LIGHT, // 轻度：内部日志
  MODERATE, // 中度：数据导出
  FULL, // 完全：公开展示
}
```

**脱敏规则**:

```typescript
const SENSITIVE_PATTERNS = {
  // 高敏感
  ssn: { pattern: /\d{3}-\d{2}-\d{4}/, replacement: '***-**-****' },
  idCard: { pattern: /\d{17}[\dXx]/, replacement: '******************' },
  creditCard: {
    pattern: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/,
    replacement: '****-****-****-****',
  },

  // 中敏感
  email: { pattern: /[\w.-]+@[\w.-]+\.\w+/, replacement: (m) => m[0] + '***@***' },
  phone: { pattern: /1[3-9]\d{9}/, replacement: (m) => m.slice(0, 3) + '****' + m.slice(7) },

  // 低敏感
  gpa: {
    pattern: /gpa[：:]\s*\d+\.?\d*/i,
    replacement: 'GPA: [已脱敏]',
    level: SanitizeLevel.FULL,
  },
};
```

---

## 9. 记忆生命周期管理

### 9.1 生命周期状态图

```
                           ┌──────────────────────────────────────────┐
                           │              消息输入                     │
                           └───────────────────┬──────────────────────┘
                                               │
                                               ▼
                           ┌──────────────────────────────────────────┐
                           │         MemoryExtractorService           │
                           │    (规则提取 + LLM提取 + 验证去重)        │
                           └───────────────────┬──────────────────────┘
                                               │
                                               ▼
                           ┌──────────────────────────────────────────┐
                           │         MemoryConflictService            │
                           │      (冲突检测: key/exact/semantic)      │
                           └───────────────────┬──────────────────────┘
                                               │
                      ┌────────────────────────┼────────────────────────┐
                      │                        │                        │
                      ▼                        ▼                        ▼
              ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
              │   无冲突       │       │   可解决冲突   │       │  需确认冲突    │
              │   CREATE      │       │   UPDATE/MERGE │       │  PENDING      │
              └───────┬───────┘       └───────┬───────┘       └───────────────┘
                      │                       │
                      └───────────┬───────────┘
                                  │
                                  ▼
                  ┌──────────────────────────────────────┐
                  │         MemoryScorerService          │
                  │   计算: Importance × Freshness ×     │
                  │         Confidence + AccessBonus     │
                  └───────────────────┬──────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
  ┌───────────────┐         ┌───────────────┐         ┌───────────────┐
  │  Score ≥ 0.8  │         │ 0.5 ≤ S < 0.8 │         │ 0.2 ≤ S < 0.5 │
  │  → WORKING    │         │  → SHORT      │         │  → LONG       │
  │  (RAM)        │         │  (Redis)      │         │  (PostgreSQL) │
  └───────┬───────┘         └───────┬───────┘         └───────┬───────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    │
                                    ▼
                    ┌──────────────────────────────────┐
                    │       EmbeddingService           │
                    │    生成向量 → pgvector存储       │
                    └───────────────────┬──────────────┘
                                        │
                                        ▼
                    ┌──────────────────────────────────┐
                    │     PersistentMemoryService      │
                    │     持久化到 PostgreSQL          │
                    └───────────────────┬──────────────┘
                                        │
                                        │ 每日定时任务
                                        ▼
                    ┌──────────────────────────────────┐
                    │       MemoryDecayService         │
                    │   重要性衰减 (rate: 0.01/day)    │
                    └───────────────────┬──────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                         │                         │
              ▼                         ▼                         ▼
      ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
      │ 访问增强      │       │ 重要性 < 0.2  │       │ 超过365天     │
      │ +0.05/次      │       │ → ARCHIVE     │       │ → DELETE      │
      └───────────────┘       └───────────────┘       └───────────────┘
```

### 9.2 记忆检索流程

```
                           ┌──────────────────────────────────────────┐
                           │              用户查询                     │
                           │         "我之前说的GPA是多少？"            │
                           └───────────────────┬──────────────────────┘
                                               │
                                               ▼
                           ┌──────────────────────────────────────────┐
                           │         EmbeddingService.embed()         │
                           │         生成查询向量 [1536维]             │
                           └───────────────────┬──────────────────────┘
                                               │
                      ┌────────────────────────┼────────────────────────┐
                      │                        │                        │
                      ▼                        ▼                        ▼
              ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
              │  L1: WORKING  │       │  L2: SHORT    │       │  L3: LONG     │
              │  内存 Map     │       │  Redis缓存    │       │  pgvector     │
              │  精确匹配     │       │  模糊匹配     │       │  语义搜索     │
              └───────┬───────┘       └───────┬───────┘       └───────┬───────┘
                      │                       │                       │
                      └───────────┬───────────┴───────────┬───────────┘
                                  │                       │
                                  ▼                       ▼
                  ┌──────────────────────────────────────────────────┐
                  │               结果聚合与排序                      │
                  │  - 按相似度排序                                   │
                  │  - 按重要性加权                                   │
                  │  - 去重 & TopK                                    │
                  └───────────────────┬──────────────────────────────┘
                                      │
                                      ▼
                  ┌──────────────────────────────────────────────────┐
                  │           MemoryDecayService.recordAccess()      │
                  │           更新 accessCount & lastAccessedAt      │
                  │           重要性 +0.05 (访问强化)                 │
                  └───────────────────┬──────────────────────────────┘
                                      │
                                      ▼
                  ┌──────────────────────────────────────────────────┐
                  │              返回 RetrievalContext               │
                  │  { recentMessages, relevantMemories,             │
                  │    preferences, entities, meta }                 │
                  └──────────────────────────────────────────────────┘
```

---

---

# Part III: 基础设施

---

## 10. 类型系统规格

### 10.1 核心枚举类型

```typescript
// 记忆类型
enum MemoryType {
  FACT = 'FACT', // 客观事实（GPA、成绩、活动）
  PREFERENCE = 'PREFERENCE', // 用户偏好（目标学校、专业）
  DECISION = 'DECISION', // 重要决定（ED选择）
  SUMMARY = 'SUMMARY', // 对话摘要
  FEEDBACK = 'FEEDBACK', // 用户反馈
}

// 实体类型
enum EntityType {
  SCHOOL = 'SCHOOL', // 学校
  PERSON = 'PERSON', // 人物（顾问、推荐人）
  EVENT = 'EVENT', // 事件（面试、deadline）
  TOPIC = 'TOPIC', // 话题
}

// 记忆层级
enum MemoryTier {
  WORKING = 'WORKING', // L1: 工作记忆 (RAM)
  SHORT = 'SHORT', // L2: 短期记忆 (Redis)
  LONG = 'LONG', // L3: 长期记忆 (PostgreSQL)
  ARCHIVE = 'ARCHIVE', // L4: 归档
}

// 冲突策略
enum ConflictStrategy {
  KEEP_LATEST = 'KEEP_LATEST',
  KEEP_HIGHEST = 'KEEP_HIGHEST',
  KEEP_OLDEST = 'KEEP_OLDEST',
  MERGE = 'MERGE',
  KEEP_BOTH = 'KEEP_BOTH',
  ASK_USER = 'ASK_USER',
}
```

### 10.2 记忆数据结构

```typescript
// 记忆输入
interface MemoryInput {
  type: MemoryType;
  category?: string; // 子分类（如 'academic', 'test_score'）
  content: string; // 记忆内容
  importance?: number; // 重要性 [0, 1]
  metadata?: MemoryMetadata;
  expiresAt?: Date;
}

// 记忆元数据
interface MemoryMetadata {
  confidence?: number; // 置信度 [0, 1]
  source?: string; // 来源（'user_input', 'llm_extract', 'rule_extract'）
  conversationId?: string;
  messageId?: string;
  dedupeKey?: string; // 去重键
  pendingConflict?: boolean;
  conflictWith?: string;
  scoreTier?: MemoryTier;
  scoreDetails?: {
    importanceScore: number;
    freshnessScore: number;
    confidenceScore: number;
    accessBonus: number;
    totalScore: number;
  };
  previousContent?: string; // 冲突前的旧内容
  accessCount?: number;
  archived?: boolean;
  archivedAt?: Date;
}

// 记忆记录（数据库返回）
interface MemoryRecord extends MemoryInput {
  id: string;
  userId: string;
  accessCount: number;
  lastAccessedAt?: Date;
  embedding?: number[]; // 1536维向量
  createdAt: Date;
  updatedAt: Date;
}
```

### 10.3 对话与消息结构

```typescript
// 消息输入
interface MessageInput {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agentType?: AgentType;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}

// 消息记录
interface MessageRecord extends MessageInput {
  id: string;
  conversationId: string;
  timestamp: Date;
}

// 对话记录
interface ConversationRecord {
  id: string;
  userId: string;
  title?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 10.4 实体结构

```typescript
interface EntityInput {
  type: EntityType;
  name: string;
  description?: string;
  attributes?: EntityAttributes;
  relations?: EntityRelation[];
}

interface EntityAttributes {
  interestLevel?: 'low' | 'medium' | 'high';
  addedAt?: string;
  priority?: number;
  notes?: string;
  // 学校特有属性
  ranking?: number;
  location?: string;
  admissionRate?: number;
}

interface EntityRelation {
  type: string; // 'interested_in', 'applied_to', 'admitted_to'
  targetId?: string;
  targetName: string;
}

interface EntityRecord extends EntityInput {
  id: string;
  userId: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 10.5 检索上下文

```typescript
interface RetrievalContext {
  recentMessages: MessageRecord[]; // 最近对话
  relevantMemories: MemoryRecord[]; // 相关记忆
  preferences: UserPreferences; // 用户偏好
  entities: EntityRecord[]; // 相关实体
  meta: {
    conversationId?: string;
    messageCount: number;
    memoryCount: number;
  };
}

interface UserPreferences {
  targetCountries?: string[];
  targetMajors?: string[];
  budgetRange?: { min: number; max: number };
  preferredSchoolTypes?: string[];
  applicationRounds?: string[];
  communicationStyle?: 'formal' | 'casual';
  language?: string;
}
```

### 10.6 评分与衰减结构

```typescript
// 评分输入
interface MemoryScoreInput {
  type: MemoryType;
  content: string;
  importance: number;
  confidence: number;
  createdAt: Date;
  accessCount?: number;
  lastAccessedAt?: Date;
}

// 评分结果
interface MemoryScoreResult {
  totalScore: number;
  components: {
    importanceScore: number;
    freshnessScore: number;
    confidenceScore: number;
    accessBonus: number;
  };
  tier: MemoryTier;
  shouldDecay: boolean;
  shouldArchive: boolean;
}

// 衰减结果
interface DecayResult {
  processed: number;
  decayed: number;
  archived: number;
  deleted: number;
  boosted: number;
  errors: number;
  durationMs: number;
}

// 衰减统计
interface DecayStats {
  totalMemories: number;
  byTier: Record<MemoryTier, number>;
  averageImportance: number;
  averageFreshness: number;
  scheduledForArchive: number;
  scheduledForDelete: number;
}
```

---

## 11. API 与权限控制

### 11.1 API 端点总览

#### 主控制器 (`/ai-agent`)

| 端点               | 方法   | 功能                | 流式支持 | 限流跳过 |
| ------------------ | ------ | ------------------- | -------- | -------- |
| `/chat`            | POST   | 与 AI Agent 对话    | ✅       | ❌       |
| `/agent`           | POST   | 直接调用特定 Agent  | ❌       | ❌       |
| `/history`         | GET    | 获取对话历史        | ❌       | ❌       |
| `/conversation`    | DELETE | 清除对话            | ❌       | ❌       |
| `/refresh-context` | POST   | 刷新用户上下文      | ❌       | ❌       |
| `/usage`           | GET    | 获取 Token 使用统计 | ❌       | ✅       |
| `/rate-limit`      | GET    | 获取限流状态        | ❌       | ✅       |
| `/quota`           | GET    | 检查使用配额        | ❌       | ✅       |
| `/health`          | GET    | 服务健康状态        | ❌       | ✅       |

#### 管理控制器 (`/admin/ai-agent`)

需要 `ADMIN` 角色

**配置管理**:

- `GET /config` - 获取完整配置
- `PUT /config/quota` - 更新配额配置
- `PUT /config/rate-limit/:type` - 更新限流配置

**Agent 配置**:

- `GET /agents` - 获取所有 Agent 配置
- `GET /agents/:type` - 获取单个 Agent 配置
- `PUT /agents/:type` - 更新 Agent 配置
- `PUT /agents/:type/toggle` - 启用/禁用 Agent

**用户配额管理**:

- `GET /users/:userId/usage` - 查看用户使用量
- `DELETE /users/:userId/rate-limit` - 重置用户限流

**监控指标**:

- `GET /metrics` - 获取指标摘要
- `GET /metrics/prometheus` - Prometheus 格式指标
- `GET /traces/recent` - 最近请求追踪
- `GET /traces/errors` - 错误请求追踪

**熔断器管理**:

- `GET /circuit-breakers` - 获取熔断器状态
- `DELETE /circuit-breakers/:service` - 重置熔断器

### 11.2 权限控制层

```
┌─────────────────────────────────────────────────────────────────────┐
│                          请求入口                                   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       JWT 认证守卫                                  │
│                    验证 Bearer Token                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Roles 角色守卫                                 │
│              检查 @Roles('ADMIN') 装饰器                           │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   AgentThrottleGuard                                │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Layer 1: 并发限制                                          │  │
│   │  - 普通用户: 2 个并发请求                                    │  │
│   │  - VIP/ADMIN: 5 个并发请求                                   │  │
│   │  - 超限: 429 Too Many Requests                              │  │
│   └─────────────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Layer 2: 频率限流 (RateLimiterService)                     │  │
│   │  - 用户级 / 对话级 / Agent级                                 │  │
│   │  - 滑动窗口算法                                              │  │
│   │  - 超限: 429 Too Many Requests                              │  │
│   └─────────────────────────────────────────────────────────────┘  │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Layer 3: 配额检查 (TokenTrackerService)                    │  │
│   │  - 每日 Token 限额                                          │  │
│   │  - 每月成本限额                                              │  │
│   │  - 超限: 402 Payment Required                               │  │
│   └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Controller 处理                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.3 数据流 - 消息处理主流程

```
┌─────────────────────────────────────────────────────────────────────┐
│  OrchestratorService.handleMessage(userId, message, conversationId) │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1: 快速路由检查                                               │
│  FastRouter.route(message) → { canHandle, response? }              │
│  - FAQ 直接响应                                                     │
│  - 简单查询快速处理                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2: 获取/创建对话                                              │
│  if (useEnterpriseMemory) {                                         │
│    conversation = MemoryManager.getOrCreateConversation()           │
│    // 同时初始化 Redis 缓存和 PostgreSQL 记录                         │
│  } else {                                                           │
│    conversation = MemoryService.getOrCreateConversation()           │
│    // 仅内存 Map                                                     │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3: 添加用户消息                                               │
│  MemoryService.addMessage(conversation, userMessage)  // 内存       │
│  if (useEnterpriseMemory) {                                         │
│    MemoryManager.addMessage(conversationId, userMessage)            │
│    // → Redis 缓存                                                  │
│    // → PostgreSQL 持久化                                           │
│    // → 异步触发记忆提取                                             │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4: 构建增强 System Prompt                                     │
│  baseSummary = MemoryService.getContextSummary()                    │
│  if (useEnterpriseMemory) {                                         │
│    context = MemoryManager.getRetrievalContext(userId, message)     │
│    // 语义检索相关记忆                                               │
│    // 获取用户偏好                                                   │
│    // 获取相关实体                                                   │
│    enhancedPrompt = MemoryManager.buildContextSummary(context)      │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 5: Agent 执行                                                 │
│  AgentRunner.run(conversation, systemPrompt)                        │
│  // 推理循环: LLM调用 → 工具执行 → 结果处理                           │
│  // 每次工具调用都记录到 MemoryService                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Step 6: 记录 Assistant 响应                                        │
│  MemoryService.addMessage(conversation, assistantMessage)           │
│  if (useEnterpriseMemory) {                                         │
│    MemoryManager.addMessage(conversationId, assistantMessage)       │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                          ┌───────────────┐
                          │  返回响应      │
                          └───────────────┘
```

### 11.4 数据流 - 记忆提取异步流程

```
┌─────────────────────────────────────────────────────────────────────┐
│  MemoryManager.addMessage() 触发异步提取                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ setImmediate() 异步执行
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MemoryExtractor.extract(messageContent, context)                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
  ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
  │  规则提取      │       │  LLM 提取     │       │  验证去重     │
  │  (低延迟)     │       │  (高准确率)   │       │              │
  └───────────────┘       └───────────────┘       └───────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  for each memory in extractedMemories:                              │
│    conflict = MemoryConflict.detectConflict(memory)                │
│    if (conflict.hasConflict) {                                      │
│      resolved = MemoryConflict.resolveConflict(memory, conflict)    │
│      if (resolved.action === 'PENDING') continue                    │
│    }                                                                │
│    score = MemoryScorer.score(memory)                               │
│    memory.metadata.scoreTier = score.tier                           │
│    PersistentMemory.createMemory(memory)                            │
│  end for                                                            │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  for each entity in extractedEntities:                              │
│    PersistentMemory.upsertEntity(entity)                            │
│  end for                                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### 11.5 记忆 API 接口规范

```typescript
// 对话管理
POST   /ai-agent/conversations                    // 创建对话
GET    /ai-agent/conversations                    // 列出对话
GET    /ai-agent/conversations/:id                // 获取对话详情
DELETE /ai-agent/conversations/:id                // 删除对话

// 消息交互
POST   /ai-agent/conversations/:id/messages       // 发送消息
GET    /ai-agent/conversations/:id/messages       // 获取消息历史
POST   /ai-agent/conversations/:id/stream         // 流式对话

// 记忆管理
GET    /ai-agent/memories                         // 获取用户记忆
POST   /ai-agent/memories                         // 手动添加记忆
DELETE /ai-agent/memories/:id                     // 删除记忆
PATCH  /ai-agent/memories/:id/importance          // 更新重要性

// 实体管理
GET    /ai-agent/entities                         // 获取用户实体
POST   /ai-agent/entities                         // 添加实体
PUT    /ai-agent/entities/:id                     // 更新实体

// 数据管理
GET    /ai-agent/user-data/export                 // 导出用户数据
DELETE /ai-agent/user-data                        // 清除用户数据
```

---

## 12. 监控与可观测性

### 12.1 指标体系 (MetricsService)

**核心指标类别**:

| 类别  | 指标                               | 类型      | 描述                  |
| ----- | ---------------------------------- | --------- | --------------------- |
| 请求  | `ai_agent_requests_total`          | Counter   | 请求总数              |
| 请求  | `ai_agent_requests_by_agent`       | Counter   | 按 Agent 分类的请求数 |
| 延迟  | `ai_agent_latency_seconds`         | Histogram | 总延迟分布            |
| 延迟  | `ai_agent_llm_latency_seconds`     | Histogram | LLM 调用延迟          |
| 延迟  | `ai_agent_tool_latency_seconds`    | Histogram | 工具执行延迟          |
| Token | `ai_agent_llm_tokens_prompt`       | Histogram | Prompt Token 分布     |
| Token | `ai_agent_llm_tokens_completion`   | Histogram | Completion Token 分布 |
| 错误  | `ai_agent_errors_total`            | Counter   | 错误总数              |
| 错误  | `ai_agent_errors_by_type`          | Counter   | 按类型分类的错误      |
| 系统  | `ai_agent_active_requests`         | Gauge     | 当前活跃请求数        |
| 系统  | `ai_agent_circuit_breaker_state`   | Gauge     | 熔断器状态            |
| 记忆  | `ai_agent_memory_operations_total` | Counter   | 记忆操作总数          |

### 12.2 分布式追踪 (TracingService)

**Span 结构**:

```typescript
interface Span {
  traceId: string; // 请求链路 ID
  spanId: string; // 当前 Span ID
  parentSpanId?: string; // 父 Span ID
  name: string; // Span 名称
  startTime: number; // 开始时间戳
  endTime?: number; // 结束时间戳
  duration?: number; // 持续时间 (ms)
  status: 'ok' | 'error'; // 状态
  tags: Record<string, string>; // 标签
  logs: Array<{ timestamp: number; message: string }>; // 日志
}
```

**追踪场景**:

- Agent 请求追踪
- LLM 调用追踪
- 工具执行追踪
- 记忆操作追踪

**慢请求阈值**: 5 秒

### 12.3 OpenTelemetry 集成

**特性**:

- W3C Trace Context 标准支持
- 自动 Span 创建与传播
- 采样策略配置
- 多后端导出 (Jaeger, Zipkin, OTLP)

**专用追踪方法**:

```typescript
startAgentRequest(userId: string, agentType: AgentType): Span
traceAgentExecution(conversationId: string): Span
traceLLMCall(model: string, tokenCount: number): Span
traceToolExecution(toolName: string): Span
traceMemoryOperation(operation: string, memoryType: MemoryType): Span
```

### 12.4 Prometheus 指标端点

**端点**: `GET /admin/ai-agent/metrics/prometheus`

**示例输出**:

```prometheus
# HELP ai_agent_requests_total Total number of AI agent requests
# TYPE ai_agent_requests_total counter
ai_agent_requests_total{agent="orchestrator",status="success"} 1234
ai_agent_requests_total{agent="essay",status="success"} 567

# HELP ai_agent_llm_latency_seconds LLM call latency in seconds
# TYPE ai_agent_llm_latency_seconds histogram
ai_agent_llm_latency_seconds_bucket{model="gpt-4o-mini",le="0.5"} 100
ai_agent_llm_latency_seconds_bucket{model="gpt-4o-mini",le="1"} 250
ai_agent_llm_latency_seconds_bucket{model="gpt-4o-mini",le="2"} 400
ai_agent_llm_latency_seconds_bucket{model="gpt-4o-mini",le="+Inf"} 450
```

---

## 13. 企业级特性与性能优化

### 13.1 双模式自动切换

```typescript
// OrchestratorService 初始化
private get useEnterpriseMemory(): boolean {
  return !!this.memoryManager;
}

// 自动选择记忆系统
async handleMessage(userId: string, message: string, conversationId?: string) {
  if (this.useEnterpriseMemory) {
    // 企业级模式：Redis + PostgreSQL + pgvector
    return this.handleWithEnterpriseMemory(userId, message, conversationId);
  } else {
    // 降级模式：纯内存
    return this.handleWithBasicMemory(userId, message, conversationId);
  }
}
```

### 13.2 可选服务注入

```typescript
@Injectable()
export class MemoryManagerService {
  constructor(
    // 必需服务
    private readonly redisCache: RedisCacheService,
    private readonly persistentMemory: PersistentMemoryService,
    private readonly embedding: EmbeddingService,
    private readonly summarizer: SummarizerService,

    // 可选服务（使用 @Optional() 装饰器）
    @Optional() private readonly scorer?: MemoryScorerService,
    @Optional() private readonly decay?: MemoryDecayService,
    @Optional() private readonly conflict?: MemoryConflictService
  ) {}

  // 安全调用可选服务
  async remember(userId: string, memory: MemoryInput) {
    // 评分（如果可用）
    if (this.scorer) {
      const score = this.scorer.score(memory);
      memory.metadata = { ...memory.metadata, scoreTier: score.tier };
    }

    // 冲突检测（如果可用）
    if (this.conflict) {
      const result = await this.conflict.detectConflict(memory);
      if (result.hasConflict) {
        // 处理冲突...
      }
    }

    return this.persistentMemory.createMemory(userId, memory);
  }
}
```

### 13.3 降级策略

| 组件             | 降级条件      | 降级方案                  |
| ---------------- | ------------- | ------------------------- |
| Redis            | 连接失败/超时 | 内存 Map + 自动过期       |
| PostgreSQL       | 连接失败      | 只使用 Redis 缓存         |
| OpenAI Embedding | API 失败/限流 | 返回零向量 + 禁用语义搜索 |
| LLM 提取         | API 失败      | 仅使用规则提取            |
| MemoryManager    | 未注入        | 使用基础 MemoryService    |

### 13.4 数据安全与隐私

```typescript
// 敏感数据脱敏等级
export enum SanitizeLevel {
  LIGHT = 'LIGHT',       // 内部日志
  MODERATE = 'MODERATE', // 数据导出
  FULL = 'FULL',         // 公开展示
}

// 数据导出（自动脱敏）
async exportUserData(userId: string): Promise<ExportData> {
  const memories = await this.getMemories(userId);
  const conversations = await this.getConversations(userId);

  return {
    memories: memories.map(m => this.sanitizer.sanitizeForExport(m)),
    conversations: conversations.map(c => ({
      ...c,
      messages: c.messages.map(msg => this.sanitizer.sanitizeForExport(msg)),
    })),
    exportedAt: new Date(),
    sanitizeLevel: SanitizeLevel.MODERATE,
  };
}

// GDPR 数据删除
async clearUserData(userId: string, options: ClearOptions): Promise<void> {
  if (options.includeMemories) {
    await this.prisma.memory.deleteMany({ where: { userId } });
  }
  if (options.includeConversations) {
    await this.prisma.agentConversation.deleteMany({ where: { userId } });
  }
  if (options.includeEntities) {
    await this.prisma.entity.deleteMany({ where: { userId } });
  }
}
```

---

### 13.5 性能优化策略

#### 13.5.1 缓存策略

| 缓存层     | 存储  | TTL   | 命中率目标 |
| ---------- | ----- | ----- | ---------- |
| 向量缓存   | Redis | 24h   | >90%       |
| 对话缓存   | Redis | 30min | >95%       |
| 用户上下文 | Redis | 5min  | >99%       |
| 活跃会话   | Redis | 24h   | 100%       |

#### 13.5.2 批量操作

```typescript
// 批量向量生成
async embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    results.push(...embeddings.data.map(e => e.embedding));
  }

  return results;
}

// 批量记忆创建
async createMemories(userId: string, memories: MemoryInput[]): Promise<MemoryRecord[]> {
  // 批量生成向量
  const contents = memories.map(m => m.content);
  const embeddings = await this.embedding.embedBatch(contents);

  // 批量插入
  return this.prisma.$transaction(
    memories.map((m, i) =>
      this.prisma.memory.create({
        data: { ...m, userId, embedding: embeddings[i] }
      })
    )
  );
}
```

#### 13.5.3 异步处理

```typescript
// 异步记忆提取（不阻塞响应）
async addMessage(conversationId: string, message: MessageInput) {
  // 立即返回，不等待提取完成
  const record = await this.persistentMemory.createMessage(conversationId, message);

  // 异步提取（使用 setImmediate 避免阻塞事件循环）
  setImmediate(() => {
    this.extractAndSaveMemory(conversationId, message).catch(err => {
      this.logger.error('Memory extraction failed', err);
    });
  });

  return record;
}
```

#### 13.5.4 pgvector 索引优化

```sql
-- 创建 IVFFlat 索引（适合百万级数据）
CREATE INDEX memory_embedding_idx ON "Memory"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 创建 HNSW 索引（适合更高召回率要求）
CREATE INDEX memory_embedding_hnsw_idx ON "Memory"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

#### 13.5.5 定时任务调度

| 任务     | 执行时间     | 描述                       |
| -------- | ------------ | -------------------------- |
| 记忆衰减 | 每天 3:00 AM | 执行重要性衰减、归档、删除 |
| 记忆压缩 | 每天 4:00 AM | 语义去重、合并、摘要       |
| 缓存清理 | 每小时       | 清理过期缓存               |

---

## 附录 A: 环境变量配置

```bash
# Redis 配置
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=1800

# PostgreSQL 配置
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# OpenAI 配置
OPENAI_API_KEY=sk-xxx
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# 记忆系统配置
MEMORY_DECAY_ENABLED=true
MEMORY_DECAY_RATE=0.01
MEMORY_ARCHIVE_THRESHOLD=0.2
MEMORY_ARCHIVE_AFTER_DAYS=180
MEMORY_DELETE_AFTER_DAYS=365
```

## 附录 B: 监控指标

```typescript
// Prometheus 指标
const metrics = {
  memoryCreated: new Counter('memory_created_total'),
  memoryRetrieved: new Counter('memory_retrieved_total'),
  embeddingLatency: new Histogram('embedding_latency_seconds'),
  cacheHitRate: new Gauge('cache_hit_rate'),
  memoryTierDistribution: new Gauge('memory_tier_distribution'),
  decayJobDuration: new Histogram('decay_job_duration_seconds'),
};
```

---

**文档结束**

> 最后更新: 2026-01-26 | 维护者: AI Team
