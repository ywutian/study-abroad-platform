# Agent 记忆系统架构设计

## 一、架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Agent Memory System                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Memory Manager                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │  Working    │  │   Short     │  │    Long     │  │   Entity    │ │   │
│  │  │  Memory     │  │   Term      │  │    Term     │  │   Memory    │ │   │
│  │  │ (Context)   │  │  (Redis)    │  │ (Postgres)  │  │  (Vector)   │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌───────────────────────────────────┼───────────────────────────────────┐  │
│  │                                   ▼                                    │  │
│  │  ┌─────────────┐  ┌─────────────────────────────┐  ┌─────────────┐   │  │
│  │  │   Memory    │  │      Memory Retriever       │  │   Memory    │   │  │
│  │  │   Writer    │  │  (Relevance + Recency)      │  │  Compactor  │   │  │
│  │  └─────────────┘  └─────────────────────────────┘  └─────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 二、记忆层级

### 1. Working Memory（工作记忆）
- **存储**: 内存
- **生命周期**: 单次请求
- **内容**: 
  - 当前对话上下文
  - 工具调用中间结果
  - Agent 推理状态

### 2. Short-Term Memory（短期记忆）
- **存储**: Redis
- **生命周期**: 24-72小时
- **内容**:
  - 对话历史（最近 N 轮）
  - 会话状态
  - 临时用户偏好

### 3. Long-Term Memory（长期记忆）
- **存储**: PostgreSQL
- **生命周期**: 永久
- **内容**:
  - 对话摘要
  - 用户偏好
  - 历史决策记录
  - 重要事实

### 4. Entity Memory（实体记忆）
- **存储**: PostgreSQL + pgvector
- **生命周期**: 永久
- **内容**:
  - 用户提到的学校
  - 文书主题/故事
  - 关键人物/事件
  - 语义向量索引

## 三、数据模型

```sql
-- 对话会话
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255),
  summary TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

-- 消息记录
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  role VARCHAR(20) NOT NULL, -- user, assistant, tool, system
  content TEXT NOT NULL,
  agent_type VARCHAR(50),
  tool_calls JSONB,
  tokens_used INT,
  latency_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 记忆条目
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- fact, preference, decision, summary
  category VARCHAR(50), -- school, essay, profile, timeline
  content TEXT NOT NULL,
  importance FLOAT DEFAULT 0.5, -- 0-1
  access_count INT DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  embedding VECTOR(1536), -- OpenAI embedding
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 实体记录
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- school, person, event, topic
  name VARCHAR(255) NOT NULL,
  description TEXT,
  attributes JSONB DEFAULT '{}',
  relations JSONB DEFAULT '[]', -- [{type, target_id}]
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户偏好
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
  school_preferences JSONB DEFAULT '{}',
  essay_preferences JSONB DEFAULT '{}',
  communication_style VARCHAR(50) DEFAULT 'friendly',
  language VARCHAR(10) DEFAULT 'zh-CN',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_memories_user_type ON memories(user_id, type);
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_entities_user_type ON entities(user_id, type);
```

## 四、核心流程

### 4.1 记忆写入流程

```
用户消息 → 
  1. 提取实体 (NER)
  2. 提取事实/偏好
  3. 写入 Redis (对话历史)
  4. 异步写入 PostgreSQL (重要记忆)
  5. 生成 Embedding (语义索引)
```

### 4.2 记忆检索流程

```
新对话 →
  1. 加载短期记忆 (Redis)
  2. 语义检索相关记忆 (pgvector)
  3. 加载用户偏好
  4. 加载相关实体
  5. 构建增强上下文
```

### 4.3 记忆压缩流程

```
定时任务 (每日) →
  1. 检查超长对话
  2. LLM 生成对话摘要
  3. 提取关键决策/事实
  4. 归档原始消息
  5. 清理过期 Redis 缓存
```

## 五、API 设计

```typescript
interface MemoryManager {
  // 写入
  remember(userId: string, memory: MemoryInput): Promise<Memory>;
  addMessage(conversationId: string, message: MessageInput): Promise<Message>;
  
  // 检索
  recall(userId: string, query: string, options?: RecallOptions): Promise<Memory[]>;
  getConversationHistory(conversationId: string, limit?: number): Promise<Message[]>;
  getRelevantContext(userId: string, currentMessage: string): Promise<Context>;
  
  // 管理
  summarizeConversation(conversationId: string): Promise<string>;
  forgetMemory(memoryId: string): Promise<void>;
  updateImportance(memoryId: string, importance: number): Promise<void>;
}

interface RecallOptions {
  types?: MemoryType[];
  categories?: string[];
  limit?: number;
  minImportance?: number;
  timeRange?: { start: Date; end: Date };
}

interface Context {
  recentMessages: Message[];
  relevantMemories: Memory[];
  userPreferences: UserPreferences;
  relatedEntities: Entity[];
}
```

## 六、企业级特性

### 6.1 高可用
- Redis Cluster 或 Redis Sentinel
- PostgreSQL 主从复制
- 多区域部署支持

### 6.2 可扩展
- 分片策略 (按 user_id)
- 读写分离
- 缓存预热

### 6.3 安全
- 数据加密 (AES-256)
- 访问控制 (RBAC)
- 审计日志
- GDPR 合规 (数据删除)

### 6.4 监控
- 记忆命中率
- 检索延迟
- 存储使用量
- 成本追踪

### 6.5 成本优化
- Embedding 缓存
- 批量处理
- 智能过期
- 分层存储

## 七、技术选型

| 组件 | 选型 | 理由 |
|-----|------|-----|
| 短期缓存 | Redis 7+ | 高性能、TTL 支持 |
| 持久存储 | PostgreSQL 16 | JSONB + pgvector |
| 向量索引 | pgvector | 一体化、运维简单 |
| 消息队列 | BullMQ | 异步任务处理 |
| Embedding | OpenAI text-embedding-3-small | 性价比高 |

## 八、实现优先级

### P0 (必须) ✅
- [x] Redis 对话缓存
- [x] PostgreSQL 消息持久化
- [x] 基础检索

### P1 (重要) ✅
- [x] 对话摘要生成
- [x] 用户偏好存储
- [x] 实体提取

### P2 (增强) ✅
- [x] pgvector 向量语义检索
- [x] HNSW 索引加速
- [ ] 智能遗忘
- [ ] 重要性动态调整

### P3 (优化)
- [ ] 多租户隔离
- [ ] 数据加密
- [ ] 成本监控

## 九、pgvector 设置

### 安装要求

PostgreSQL 需要安装 pgvector 扩展：

```bash
# Ubuntu/Debian
sudo apt install postgresql-16-pgvector

# macOS (Homebrew)
brew install pgvector

# Docker (使用 pgvector 镜像)
docker pull pgvector/pgvector:pg16
```

### 初始化

```bash
# 方式 1: 运行设置脚本
psql -d your_database -f apps/api/scripts/setup-pgvector.sql

# 方式 2: 手动执行
psql -d your_database -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 性能调优

```sql
-- 调整 HNSW 搜索参数（更高 = 更准确但更慢）
SET hnsw.ef_search = 100;  -- 默认 40

-- 查看索引使用情况
EXPLAIN ANALYZE
SELECT * FROM "Memory" 
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector 
LIMIT 10;
```

### 索引参数说明

| 参数 | 默认值 | 说明 |
|-----|-------|------|
| m | 16 | 每个节点的最大连接数 |
| ef_construction | 64 | 构建时的候选列表大小 |
| ef_search | 40 | 搜索时的候选列表大小 |

建议：
- 数据量 < 10万：使用默认参数
- 数据量 > 10万：增加 m 和 ef_construction

