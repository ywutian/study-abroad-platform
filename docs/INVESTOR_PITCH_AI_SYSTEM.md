# 🧠 AI 智能系统技术白皮书

> **核心价值主张**: 自研企业级多 Agent AI 助手，通过持久化记忆系统实现"越用越懂你"的个性化留学服务体验

---

## 📌 Executive Summary

| 指标           | 数据                                    |
| -------------- | --------------------------------------- |
| **架构类型**   | 自研多 Agent + ReWOO 工作流 + 三层记忆  |
| **技术栈**     | NestJS + PostgreSQL + pgvector + Redis  |
| **Agent 数量** | 5个专业 Agent（可扩展）                 |
| **工具数量**   | 32个业务工具（12个分类）                |
| **依赖框架**   | 无（不依赖 LangChain 等第三方 AI 框架） |
| **合规性**     | GDPR 兼容（完整数据导出/删除 API）      |

---

## 一、系统架构全景

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              用户层 (Web / Mobile / Extension)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               API Gateway                                    │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │
│   │   限流器    │  │   熔断器    │  │  认证鉴权   │  │  SSE 流式响应   │   │
│   │ RateLimit   │  │ Circuit     │  │   JWT       │  │   Streaming     │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           🎯 智能路由层 (Fast Router)                        │
│                                                                              │
│   关键词匹配 → 快速路由 → 减少 70% LLM 调用                                   │
│   简单问答 → 直接响应 → 零延迟                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           🤖 多 Agent 协作层                                 │
│                                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Orchestrat │  │   Essay    │  │   School   │  │  Profile   │            │
│  │    协调者   │──│   文书     │──│   选校     │──│   档案     │            │
│  │  (路由决策) │  │  (写作)    │  │  (推荐)    │  │  (分析)    │            │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘            │
│         │                                                                    │
│         └──────────────────────────────────────────────────────┐            │
│                                                                 ▼            │
│  ┌────────────┐                                          ┌────────────┐     │
│  │  Timeline  │                                          │   Agent    │     │
│  │   规划     │◀─────────────────────────────────────────│   Runner   │     │
│  │ (时间线)   │                                          │ReWOO工作流 │     │
│  └────────────┘                                          └────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           🔧 基础设施层                                       │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │    LLM 服务      │  │    工具执行器     │  │   记忆管理器      │          │
│  │  (OpenAI API)    │  │  (32个业务工具)   │  │  (三层架构)       │          │
│  │  • 流式输出       │  │  • 12个工具分类   │  │  • Redis 短期     │          │
│  │  • Token追踪      │  │  • 含联网搜索     │  │  • PostgreSQL长期 │          │
│  │  • 重试/熔断      │  │  • 超时保护       │  │  • pgvector语义   │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、多 Agent 系统详解

### 2.1 Agent 协作模型

```text
用户: "帮我选校，我 GPA 3.8，目标 CS"
                │
                ▼
        ┌───────────────┐
        │  Orchestrator │  ← 快速路由：关键词 "选校" → School Agent
        │   (协调者)     │
        └───────┬───────┘
                │ delegate_to_agent(school, "帮用户选校")
                ▼
        ┌───────────────┐
        │ School Agent  │  ← 专业选校 Agent
        │   (选校专家)   │
        └───────┬───────┘
                │
        ┌───────┴───────┐
        ▼               ▼
   get_profile()   recommend_schools()
        │               │
        ▼               ▼
   用户档案数据      AI 选校推荐
        │               │
        └───────┬───────┘
                ▼
        生成个性化选校列表
```

### 2.2 五大专业 Agent

| Agent                 | 职责                 | 核心工具                                                                                   | 典型场景               |
| --------------------- | -------------------- | ------------------------------------------------------------------------------------------ | ---------------------- |
| **🎯 Orchestrator**   | 智能路由、任务协调   | `delegate_to_agent`, 论坛工具, 案例预测工具, 档案排名工具, `web_search`                    | 理解用户意图，分发任务 |
| **📝 Essay Agent**    | 文书写作、修改、评估 | `review_essay`, `polish_essay`, `brainstorm_ideas`, `generate_outline`, `get_essays`       | "帮我看看这篇文书"     |
| **🏫 School Agent**   | 选校推荐、录取分析   | `search_schools`, `recommend_schools`, `analyze_admission_chance`, `search_school_website` | "帮我选10所学校"       |
| **👤 Profile Agent**  | 档案管理、背景分析   | `get_profile`, `update_profile`, 测评工具 (3个)                                            | "分析我的竞争力"       |
| **📅 Timeline Agent** | 时间规划、截止日期   | `get_deadlines`, `create_timeline`, 个人事件工具, `search_cases`, `search_school_website`  | "帮我做申请规划"       |

### 2.3 Agent 配置示例

```typescript
// School Agent 配置 (摘自 agents.config.ts)
{
  type: AgentType.SCHOOL,
  name: '选校专家',
  description: '专注于学校搜索、对比、推荐和录取分析',
  systemPrompt: `留学选校顾问。

能力: 学校查询|选校推荐|学校对比|录取分析|学校官网信息搜索

选校分层:
- Reach(<30%): 冲刺校
- Match(30-70%): 匹配校
- Safety(>70%): 保底校

考虑因素: GPA/标化匹配度、专业排名、地理位置、学费奖学金、校园规模
...`,

  tools: [
    'get_profile',
    'search_schools',
    'get_school_details',
    'compare_schools',
    'recommend_schools',
    'analyze_admission_chance',
    'search_school_website',   // 联网搜索学校官网
  ],

  canDelegate: [AgentType.ORCHESTRATOR],
  model: 'gpt-4o-mini',
  temperature: 0.5,
  maxTokens: 4000,
}
```

### 2.4 ReWOO 三阶段工作流

> 基于 ReWOO (Reason Without Observation) 模式，而非 ReAct 循环。
> 一次规划 → 批量执行 → 统一总结，杜绝重复 LLM 调用。

```text
┌─────────────────────────────────────────────────────────────┐
│            WorkflowEngineService (ReWOO 三阶段)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Phase 1: PLAN (规划)                                      │
│   ┌───────────────────────────────────────────────────────┐ │
│   │  LLM 分析用户意图 → 一次性规划所有需要的工具调用       │ │
│   │  快速路径: 不需要工具 → 直接返回文本回复               │ │
│   │  委派路径: delegate_to_agent → 直接委派，不执行工具    │ │
│   └───────────────────────────────────────────────────────┘ │
│                         ↓                                   │
│   Phase 2: EXECUTE (执行)                                   │
│   ┌───────────────────────────────────────────────────────┐ │
│   │  按计划依次执行所有工具（无 LLM 参与，杜绝重复）       │ │
│   │  每个工具有 30s 超时保护                               │ │
│   │  失败标记 → Solve 阶段基于已有结果生成回复             │ │
│   └───────────────────────────────────────────────────────┘ │
│                         ↓                                   │
│   Phase 3: SOLVE (总结)                                     │
│   ┌───────────────────────────────────────────────────────┐ │
│   │  LLM 综合所有工具结果 → 生成最终回复（流式输出）       │ │
│   │  空内容 fallback: 流式失败 → 自动重试非流式            │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、记忆系统深度解析

### 3.1 三层记忆架构

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           🧠 Memory Manager Service                          │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                    Layer 1: Redis (短期记忆)                         │   │
│   │                                                                      │   │
│   │   • TTL: 5 分钟                                                      │   │
│   │   • 存储: 当前对话上下文、活跃会话 ID                                  │   │
│   │   • 作用: 毫秒级响应、减少数据库压力                                   │   │
│   │   • 降级: 内存 LRU 缓存 (500 条)                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                     ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                  Layer 2: PostgreSQL (长期记忆)                       │   │
│   │                                                                      │   │
│   │   • 存储: 用户事实、偏好、决策、对话摘要                               │   │
│   │   • 模型: Memory, Entity, AgentConversation, AgentMessage            │   │
│   │   • 特性: ACID 事务、持久化、可审计                                    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                     ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                  Layer 3: pgvector (语义记忆)                         │   │
│   │                                                                      │   │
│   │   • 向量维度: 1536 (text-embedding-3-small)                          │   │
│   │   • 相似度: 余弦距离 (1 - embedding <=> query)                        │   │
│   │   • 作用: 语义检索相关记忆、RAG 增强                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 记忆类型体系

| 类型     | 枚举值       | 说明               | 示例                       |
| -------- | ------------ | ------------------ | -------------------------- |
| **事实** | `FACT`       | 用户陈述的客观信息 | "我 GPA 3.8"               |
| **偏好** | `PREFERENCE` | 用户表达的主观偏好 | "我喜欢加州的学校"         |
| **决策** | `DECISION`   | 用户做出的决定     | "我决定 ED 申 Stanford"    |
| **摘要** | `SUMMARY`    | 对话/会话摘要      | "讨论了选校策略和文书主题" |
| **反馈** | `FEEDBACK`   | 用户对 AI 的反馈   | "这个建议很有帮助"         |

### 3.3 实体知识图谱

```typescript
enum EntityType {
  SCHOOL,   // 学校: MIT, Stanford, Berkeley
  PERSON,   // 人物: 推荐老师、招生官
  EVENT,    // 事件: 夏校、竞赛、面试
  TOPIC,    // 话题: CS申请、文书写作
}

// 实体关系示例
{
  id: "entity_001",
  type: "SCHOOL",
  name: "MIT",
  description: "麻省理工学院，用户关注的冲刺校",
  attributes: {
    interestLevel: "high",
    addedAt: "2026-01-15"
  },
  relations: [
    { targetId: "entity_002", targetType: "TOPIC", relationType: "major", metadata: { name: "CS" } }
  ]
}
```

### 3.4 记忆检索流程 (RAG)

```text
用户提问: "MIT 的 CS 录取率是多少？"
                │
                ▼
┌───────────────────────────────────────┐
│        getRetrievalContext()          │
└───────────────────────────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│  Redis  │ │PostgreSQL│ │pgvector │
│ 对话历史 │ │ 用户偏好 │ │ 语义搜索 │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     │           │           ▼
     │           │    ┌─────────────┐
     │           │    │ 向量化查询   │
     │           │    │"MIT CS录取率"│
     │           │    └──────┬──────┘
     │           │           │
     │           │           ▼
     │           │    ┌─────────────┐
     │           │    │ 相似度排序   │
     │           │    │ Top-5 记忆   │
     │           │    └──────┬──────┘
     │           │           │
     └───────────┴───────────┘
                │
                ▼
┌───────────────────────────────────────┐
│           合并上下文                   │
│                                       │
│  • 最近 10 条对话消息                  │
│  • 相关记忆: "用户对MIT有兴趣"          │
│  • 用户偏好: "偏好加州/东北部学校"       │
│  • 相关实体: MIT, CS, 用户关注的学校列表 │
└───────────────────────────────────────┘
                │
                ▼
        增强的 System Prompt
                │
                ▼
        LLM 生成个性化回复
```

### 3.5 自动记忆提取

```typescript
// 从用户消息自动提取记忆
async extractFromMessage(message: MessageRecord): Promise<{
  memories: MemoryInput[];
  entities: EntityInput[];
}> {
  // LLM 分析用户消息
  const prompt = `分析用户消息，提取重要信息。只提取明确陈述的事实和偏好。
输出 JSON：
{
  "memories": [
    {"type": "FACT|PREFERENCE", "category": "school|essay|profile", "content": "内容", "importance": 0.5-1.0}
  ],
  "entities": [
    {"type": "SCHOOL|PERSON|EVENT|TOPIC", "name": "名称", "description": "描述"}
  ]
}`;

  // 示例输入: "我 GPA 3.8，想申 MIT 的 CS"
  // 输出:
  // memories: [{ type: "FACT", category: "profile", content: "GPA 3.8", importance: 0.9 }]
  // entities: [{ type: "SCHOOL", name: "MIT", description: "用户目标学校" }]
}
```

### 3.6 对话摘要生成

```typescript
// 对话结束时自动生成摘要
async summarizeConversation(messages: MessageRecord[]): Promise<ConversationSummary> {
  return {
    summary: "讨论了MIT CS申请策略，用户GPA 3.8，建议同时申请CMU和Stanford",
    keyTopics: ["MIT", "CS申请", "选校策略"],
    decisions: ["确定ED申MIT"],
    nextSteps: ["准备Why MIT文书", "联系推荐人"],
    extractedFacts: [
      { type: "FACT", content: "GPA 3.8", importance: 0.9 },
      { type: "DECISION", content: "ED申MIT", importance: 1.0 }
    ],
    extractedEntities: [
      { type: "SCHOOL", name: "MIT", description: "ED目标校" }
    ]
  };
}
```

---

## 四、核心技术优势

### 4.1 性能优化

| 优化项             | 实现方式                      | 效果                       |
| ------------------ | ----------------------------- | -------------------------- |
| **快速路由**       | 关键词匹配 + LLM 决策二级路由 | 减少 70% 不必要的 LLM 调用 |
| **Embedding 缓存** | Redis + 内存 LRU 双层缓存     | 24小时 TTL，避免重复向量化 |
| **流式输出**       | SSE (Server-Sent Events)      | 首字节延迟 < 500ms         |
| **并行检索**       | Promise.all 并发查询          | 记忆检索耗时减少 60%       |

### 4.2 弹性保护

```typescript
// 重试策略
{
  maxRetries: 3,
  backoff: 'exponential',  // 1s → 2s → 4s
  retryableErrors: [429, 500, 502, 503, 504]
}

// 熔断器
{
  failureThreshold: 5,      // 5次失败触发熔断
  recoveryTimeout: 30000,   // 30秒后尝试恢复
  halfOpenRequests: 2       // 半开状态测试请求数
}

// 超时控制
{
  llmTimeout: 30000,        // LLM调用 30s
  toolTimeout: 30000        // 工具执行 30s
}
```

### 4.3 数据合规 (GDPR)

| API      | 功能               | 路径                                      |
| -------- | ------------------ | ----------------------------------------- |
| 记忆列表 | 查看所有记忆       | `GET /ai-agent/user-data/memories`        |
| 删除记忆 | 删除指定记忆       | `DELETE /ai-agent/user-data/memories/:id` |
| 导出数据 | 导出所有AI数据     | `POST /ai-agent/user-data/export`         |
| 清除全部 | 删除所有AI相关数据 | `DELETE /ai-agent/user-data/all`          |

---

## 五、数据模型

### 5.1 核心表结构

```sql
-- AI 对话记录
CREATE TABLE "AgentConversation" (
  id        VARCHAR PRIMARY KEY,
  "userId"  VARCHAR NOT NULL,
  title     VARCHAR,
  summary   TEXT,
  "agentType" VARCHAR,      -- orchestrator, essay, school, profile, timeline
  metadata  JSONB,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP
);

-- AI 消息
CREATE TABLE "AgentMessage" (
  id              VARCHAR PRIMARY KEY,
  "conversationId" VARCHAR REFERENCES "AgentConversation"(id),
  role            VARCHAR NOT NULL,  -- user, assistant, tool, system
  content         TEXT NOT NULL,
  "agentType"     VARCHAR,           -- 处理该消息的 Agent
  "toolCalls"     JSONB,             -- 工具调用记录
  "tokensUsed"    INTEGER,           -- Token 使用量
  "latencyMs"     INTEGER,           -- 响应延迟
  "createdAt"     TIMESTAMP DEFAULT NOW()
);

-- 用户记忆 (支持向量搜索)
CREATE TABLE "Memory" (
  id             VARCHAR PRIMARY KEY,
  "userId"       VARCHAR NOT NULL,
  type           VARCHAR NOT NULL,   -- FACT, PREFERENCE, DECISION, SUMMARY, FEEDBACK
  category       VARCHAR,            -- school, essay, profile, timeline
  content        TEXT NOT NULL,
  importance     FLOAT DEFAULT 0.5,  -- 0-1 重要性评分
  "accessCount"  INTEGER DEFAULT 0,  -- 访问次数
  embedding      vector(1536),       -- pgvector 向量字段
  metadata       JSONB,
  "expiresAt"    TIMESTAMP,
  "createdAt"    TIMESTAMP DEFAULT NOW(),
  "updatedAt"    TIMESTAMP
);

-- 向量相似度查询
SELECT *, 1 - (embedding <=> $1) AS similarity
FROM "Memory"
WHERE "userId" = $2
ORDER BY embedding <=> $1
LIMIT 10;
```

### 5.2 实体模型

```sql
-- 实体提取
CREATE TABLE "Entity" (
  id          VARCHAR PRIMARY KEY,
  "userId"    VARCHAR NOT NULL,
  type        VARCHAR NOT NULL,  -- SCHOOL, PERSON, EVENT, TOPIC
  name        VARCHAR NOT NULL,
  description TEXT,
  attributes  JSONB,             -- 额外属性
  relations   JSONB,             -- 关系列表
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP,

  UNIQUE("userId", type, name)
);

-- 用户 AI 偏好
CREATE TABLE "UserAIPreference" (
  id                  VARCHAR PRIMARY KEY,
  "userId"            VARCHAR UNIQUE NOT NULL,
  "communicationStyle" VARCHAR DEFAULT 'friendly',  -- friendly, professional, casual
  "responseLength"    VARCHAR DEFAULT 'moderate',   -- brief, moderate, detailed
  language            VARCHAR DEFAULT 'zh',
  "schoolPreferences" JSONB,    -- { regions: [], size: [], type: [] }
  "essayPreferences"  JSONB,    -- { style: "", tone: "" }
  "enableMemory"      BOOLEAN DEFAULT TRUE,
  "enableSuggestions" BOOLEAN DEFAULT TRUE,
  "createdAt"         TIMESTAMP DEFAULT NOW(),
  "updatedAt"         TIMESTAMP
);
```

---

## 六、工具系统

### 6.1 工具列表 (32个，12个分类)

| 分类         | 工具名                               | 功能                       |
| ------------ | ------------------------------------ | -------------------------- |
| **委派**     | `delegate_to_agent`                  | 委派任务给专业 Agent       |
| **档案**     | `get_profile`                        | 获取用户完整档案           |
|              | `update_profile`                     | 更新档案字段               |
| **学校**     | `search_schools`                     | 多条件搜索学校             |
|              | `get_school_details`                 | 获取学校详情               |
|              | `compare_schools`                    | 多校对比                   |
| **文书**     | `get_essays`                         | 获取用户文书列表           |
|              | `review_essay`                       | 文书评估打分               |
|              | `polish_essay`                       | 文书润色                   |
|              | `generate_outline`                   | 生成文书大纲               |
|              | `brainstorm_ideas`                   | 头脑风暴创意               |
| **选校**     | `recommend_schools`                  | AI 智能选校推荐            |
|              | `analyze_admission_chance`           | 录取概率分析               |
| **案例**     | `search_cases`                       | 搜索录取案例               |
| **时间线**   | `get_deadlines`                      | 获取截止日期               |
|              | `create_timeline`                    | 创建申请时间线             |
|              | `get_personal_events`                | 获取个人事件列表           |
|              | `create_personal_event`              | 创建个人事件               |
| **测评**     | `get_assessment_results`             | 获取 MBTI/Holland 测评结果 |
|              | `interpret_assessment`               | 深度解读测评结果           |
|              | `suggest_activities_from_assessment` | 基于测评推荐活动           |
| **论坛**     | `search_forum_posts`                 | 搜索论坛帖子               |
|              | `get_popular_discussions`            | 获取热门讨论               |
|              | `answer_forum_question`              | 回答留学问题               |
| **案例预测** | `explain_case_result`                | 解释录取案例结果           |
|              | `analyze_prediction_accuracy`        | 分析预测准确率             |
|              | `compare_case_with_profile`          | 案例与档案对比             |
| **档案排名** | `analyze_profile_ranking`            | 档案竞争力排名             |
|              | `suggest_profile_improvements`       | 档案改进建议               |
|              | `compare_with_admitted_profiles`     | 与已录取档案对比           |
| **外部搜索** | `web_search`                         | 搜索互联网获取实时信息     |
|              | `search_school_website`              | 搜索学校官网权威信息       |

### 6.2 工具定义格式

```typescript
{
  name: 'recommend_schools',
  description: '根据学生档案智能推荐学校，分为冲刺校、匹配校、保底校',
  parameters: {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: '推荐数量',
      },
      preference: {
        type: 'string',
        description: '偏好：research, liberal_arts, urban, rural',
      },
    },
    required: [],
  },
  handler: 'school.recommend',  // 映射到实际处理函数
}
```

---

## 七、商业价值分析

### 7.1 用户价值

| 传统留学咨询        | 我们的 AI 系统                 |
| ------------------- | ------------------------------ |
| 每次咨询需重复背景  | **记忆持久化**：无需重复       |
| 通用建议            | **个性化推荐**：基于历史数据   |
| 单一顾问视角        | **多专家协作**：5个专业 Agent  |
| 响应延迟（小时/天） | **即时响应**：流式输出 < 500ms |
| 人力成本高          | **24/7 可用**：无限扩展        |

### 7.2 数据护城河

```text
用户使用量 ↑
     │
     ▼
记忆数据积累 ↑
     │
     ▼
个性化精度 ↑
     │
     ▼
用户体验 ↑ ───→ 用户粘性 ↑ ───→ 迁移成本 ↑
     │
     └──────────────────────────────────────→ 竞争壁垒 ↑
```

### 7.3 可量化指标

```typescript
// 每用户可追踪的数据资产
interface UserDataStats {
  conversationCount: number;  // 对话数 → 用户活跃度
  messageCount: number;       // 消息数 → 交互深度
  memoryCount: number;        // 记忆条数 → 数据资产
  entityCount: number;        // 实体数 → 知识图谱规模
}

// 示例：活跃用户画像
{
  conversationCount: 47,
  messageCount: 523,
  memoryCount: 156,        // 156 条用户专属记忆
  entityCount: 23          // 23 个关联实体（学校、话题等）
}
```

---

## 八、技术路线图

### Phase 1: 当前 (2026 Q1) ✅

- [x] 多 Agent 协作架构（ReWOO 三阶段工作流）
- [x] 三层记忆系统
- [x] 32 个业务工具（12 个分类）
- [x] 流式输出 (SSE)
- [x] GDPR 合规 API
- [x] 记忆重要性衰减算法（memory-decay.service.ts）
- [x] 记忆压缩与冲突解决
- [x] 联网搜索（web_search + search_school_website）
- [x] 测评集成（MBTI / Holland）
- [x] 论坛与案例预测工具集成

### Phase 2: 近期 (2026 Q2)

- [ ] Agent 自主学习（从用户反馈优化）
- [ ] 多模态支持（图片/文档解析）
- [ ] Agent 对话可视化

### Phase 3: 远期 (2026 Q3-Q4)

- [ ] 自定义 Agent 市场
- [ ] 跨用户知识图谱（匿名化）
- [ ] 本地化部署方案
- [ ] Agent-to-Agent 协作协议

---

## 九、Demo 脚本建议

### 场景1: 首次对话（记忆建立）

```text
用户: 你好，我 GPA 3.8，想申 CS
AI: 了解！你的 GPA 3.8 属于竞争力较强的水平。
    我帮你记下了这些信息，以后不用重复说。
    请问你有 SAT/ACT 成绩吗？目标是 Top 多少的学校？
```

**演示点**: 展示记忆自动提取

### 场景2: 后续对话（记忆检索）

```text
用户: 帮我选校
AI: 根据你之前提到的 GPA 3.8 和 CS 方向，我为你推荐：

    🎯 冲刺校: MIT, Stanford, CMU
    ✅ 匹配校: UCLA, UMich, GaTech
    🛡️ 保底校: UIUC, Purdue, UW-Madison

    需要我详细分析哪所学校吗？
```

**演示点**: 展示无需重复输入背景

### 场景3: 跨会话记忆

```text
（新对话）
用户: 我上次说想 ED MIT，现在改想 ED Stanford 了
AI: 了解！我帮你更新了 ED 目标校。
    之前记录的是 MIT，现在改为 Stanford。

    Stanford CS 竞争非常激烈，你的 GPA 3.8 在申请池中属于中上水平。
    建议同时准备 "Why Stanford" 文书，要突出你对 Stanford 独特资源的了解。
```

**演示点**: 展示记忆更新和跨会话持久化

---

## 十、竞品对比

| 维度       | ChatGPT    | 传统留学 App | 我们的系统             |
| ---------- | ---------- | ------------ | ---------------------- |
| 对话上下文 | 单次会话   | 无 AI 对话   | **跨会话持久化**       |
| 个性化程度 | 低（通用） | 低（模板化） | **高（记忆驱动）**     |
| 专业深度   | 中等       | 高（人工）   | **高（专业 Agent）**   |
| 响应速度   | 快         | 慢（人工）   | **快（流式）**         |
| 数据合规   | 黑盒       | 可控         | **GDPR 兼容**          |
| 可扩展性   | 低         | 低           | **高（Agent 可扩展）** |

---

## 附录: 核心代码位置

| 组件             | 路径                                                                |
| ---------------- | ------------------------------------------------------------------- |
| Agent 配置       | `apps/api/src/modules/ai-agent/config/agents.config.ts`             |
| 工具配置 (32个)  | `apps/api/src/modules/ai-agent/config/tools.config.ts`              |
| 协调器           | `apps/api/src/modules/ai-agent/core/orchestrator.service.ts`        |
| Agent 运行器     | `apps/api/src/modules/ai-agent/core/agent-runner.service.ts`        |
| ReWOO 工作流引擎 | `apps/api/src/modules/ai-agent/core/workflow-engine.service.ts`     |
| 快速路由         | `apps/api/src/modules/ai-agent/core/fast-router.service.ts`         |
| 记忆管理器       | `apps/api/src/modules/ai-agent/memory/memory-manager.service.ts`    |
| 记忆衰减         | `apps/api/src/modules/ai-agent/memory/memory-decay.service.ts`      |
| 记忆压缩         | `apps/api/src/modules/ai-agent/memory/memory-compaction.service.ts` |
| Embedding 服务   | `apps/api/src/modules/ai-agent/memory/embedding.service.ts`         |
| 摘要服务         | `apps/api/src/modules/ai-agent/memory/summarizer.service.ts`        |
| 数据库模型       | `apps/api/prisma/schema.prisma`                                     |
| 架构文档         | `docs/AI_AGENT_ARCHITECTURE.md`                                     |

---

_文档版本: v2.0 | 最后更新: 2026-02-13_
