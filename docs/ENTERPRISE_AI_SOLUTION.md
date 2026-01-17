# 🏢 企业级 AI Agent 解决方案

> **版本**: v2.0  
> **更新日期**: 2026-01-26  
> **合规标准**: SOC2, GDPR, ISO 27001

---

## 📋 目录

1. [架构概览](#架构概览)
2. [类型安全](#类型安全)
3. [可观测性](#可观测性)
4. [安全与合规](#安全与合规)
5. [性能优化](#性能优化)
6. [运维指南](#运维指南)
7. [部署配置](#部署配置)

---

## 🏗️ 架构概览

### 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway (Rate Limit)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     Request Context Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Request ID  │  │  Trace ID   │  │   User Context          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      Orchestrator Service                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Fast Router → Agent Selection → ReAct Loop → Response  │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Essay Agent  │    │ School Agent  │    │ Profile Agent │
│  (文书专家)    │    │  (选校专家)    │    │  (档案分析)    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Enterprise Memory System                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Redis     │  │ PostgreSQL  │  │   pgvector (HNSW)       │  │
│  │  (短期)     │  │   (长期)    │  │    (语义检索)            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Scorer     │  │   Decay     │  │   Conflict Resolution   │  │
│  │  (评分)     │  │   (衰减)    │  │      (冲突处理)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Observability Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Structured  │  │OpenTelemetry│  │   Prometheus Metrics    │  │
│  │   Logger    │  │   Tracing   │  │    (指标收集)            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件               | 职责                 | 技术                       |
| ------------------ | -------------------- | -------------------------- |
| **Orchestrator**   | 请求调度、Agent 选择 | Fast Router + ReAct        |
| **Agent Runner**   | ReAct 循环执行       | LLM + Tool Chain           |
| **Memory Manager** | 三层记忆管理         | Redis + PG + pgvector      |
| **Resilience**     | 熔断、重试、降级     | Circuit Breaker Pattern    |
| **Observability**  | 日志、追踪、指标     | OpenTelemetry + Prometheus |

---

## 🔒 类型安全

### 类型定义文件结构

```
apps/api/src/modules/ai-agent/
├── types/
│   └── index.ts              # 核心类型定义
├── core/
│   └── types.ts              # LLM/Tool 相关类型
├── memory/
│   ├── types.ts              # 记忆系统类型
│   └── prisma-types.ts       # Prisma 查询类型
└── infrastructure/
    └── logging/types.ts      # 日志类型
```

### 主要类型

```typescript
// LLM 响应类型
interface ChatCompletionResponse {
  id: string;
  choices: ChatCompletionChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// 记忆元数据
interface MemoryMetadata {
  confidence?: number;
  source?: string;
  scoreDetails?: {
    importanceScore: number;
    freshnessScore: number;
    confidenceScore: number;
    accessBonus: number;
  };
}

// 工具执行结果
interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}
```

### 类型安全检查

```bash
# 检查 any 使用
grep -r ": any\b" apps/api/src/modules/ai-agent/memory/
# 预期结果: 0 matches

# TypeScript 严格模式编译
npx tsc --noEmit --strict
```

---

## 📊 可观测性

### 1. 结构化日志

**文件**: `infrastructure/logging/structured-logger.service.ts`

```typescript
// 使用示例
logger.setContext({ requestId, userId, agentType });

// 记录操作
const op = logger.startOperation('memory.search');
const results = await memoryService.search(query);
op.end({ resultCount: results.length });

// 输出格式 (JSON)
{
  "timestamp": "2026-01-26T10:30:00.000Z",
  "level": "info",
  "message": "memory.search completed",
  "service": "ai-agent",
  "context": {
    "requestId": "req_abc123",
    "userId": "user_xyz",
    "operation": "memory.search"
  },
  "metrics": { "durationMs": 45 },
  "data": { "resultCount": 15 }
}
```

**特性**:

- ✅ JSON 格式输出
- ✅ 请求追踪 ID
- ✅ 自动敏感数据脱敏
- ✅ 性能指标记录
- ✅ 日志级别动态控制

### 2. 分布式追踪

**文件**: `infrastructure/observability/opentelemetry.service.ts`

```typescript
// 自动追踪
const result = await tracer.trace('agent.process', async (span) => {
  span.setAttribute('user.id', userId);
  span.addEvent('processing_started');

  const response = await agent.process(message);

  span.setAttribute('response.length', response.length);
  return response;
});

// W3C Trace Context 支持
const traceparent = tracer.generateTraceparent(span.getContext());
// "00-traceId-spanId-01"
```

**追踪层级**:

```
agent.request (SERVER)
├── orchestrator.route (INTERNAL)
├── agent.essay (INTERNAL)
│   ├── llm.call (CLIENT)
│   └── tool.get_profile (INTERNAL)
└── memory.search (CLIENT)
```

### 3. Prometheus 指标

**文件**: `infrastructure/observability/prometheus-metrics.service.ts`

**核心指标**:

| 指标名称                           | 类型      | 说明            |
| ---------------------------------- | --------- | --------------- |
| `ai_agent_requests_total`          | Counter   | 请求总数        |
| `ai_agent_request_duration_ms`     | Histogram | 请求延迟        |
| `ai_agent_llm_calls_total`         | Counter   | LLM 调用数      |
| `ai_agent_llm_tokens_prompt`       | Histogram | Prompt Token 数 |
| `ai_agent_memory_operations_total` | Counter   | 记忆操作数      |
| `ai_agent_circuit_breaker_state`   | Gauge     | 熔断器状态      |

**使用示例**:

```typescript
// 记录请求
metrics.recordRequest('essay', 'success', 1250);

// 记录 LLM 调用
metrics.recordLLMCall('gpt-4o', 'success', 850, {
  prompt: 1200,
  completion: 450,
});

// 导出 Prometheus 格式
const output = metrics.exportPrometheus();
// # HELP ai_agent_requests_total Total number of requests
// # TYPE ai_agent_requests_total counter
// ai_agent_requests_total{agent_type="essay",status="success"} 1542
```

---

## 🛡️ 安全与合规

### 敏感数据脱敏

**文件**: `memory/sanitizer.service.ts`

**三级脱敏策略**:

| 级别         | 用途     | 规则                          |
| ------------ | -------- | ----------------------------- |
| **LIGHT**    | 内部日志 | 仅脱敏高敏感（SSN、银行卡）   |
| **MODERATE** | 数据导出 | 脱敏高+中敏感（含 GPA、成绩） |
| **FULL**     | 公开展示 | 脱敏所有敏感信息（含姓名）    |

**脱敏规则**:

```typescript
// 高敏感 - 所有级别脱敏
SSN: "123-45-6789" → "***-**-****"
银行卡: "4532-1234-5678-9012" → "****-****-****-****"

// 中敏感 - MODERATE/FULL 脱敏
邮箱: "john@example.com" → "j***@example.com"
手机: "13812345678" → "138****5678"
GPA: "3.85" → "*.**"
SAT: "1520" → "****"

// 低敏感 - 仅 FULL 脱敏
姓名: "张三" → "***"
```

**集成点**:

- ✅ 数据导出 (`UserDataService.exportData`)
- ✅ 结构化日志 (`StructuredLoggerService`)
- ✅ 记忆存储前检测

### GDPR 合规 API

| 权利     | API 端点                                 | 说明         |
| -------- | ---------------------------------------- | ------------ |
| 访问权   | `GET /ai-agent/user-data/export`         | 导出所有数据 |
| 纠正权   | `PATCH /ai-agent/user-data/memories/:id` | 修改记忆     |
| 删除权   | `DELETE /ai-agent/user-data/clear`       | 清除所有数据 |
| 限制处理 | `PATCH /ai-agent/user-data/preferences`  | 禁用记忆功能 |

---

## ⚡ 性能优化

### 1. 向量索引

**迁移文件**: `prisma/migrations/20260126_add_vector_indexes/migration.sql`

```sql
-- HNSW 索引（推荐）
CREATE INDEX CONCURRENTLY idx_memory_embedding_hnsw
ON "Memory" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 复合索引
CREATE INDEX idx_memory_user_type ON "Memory" ("userId", "type");
CREATE INDEX idx_memory_user_importance ON "Memory" ("userId", "importance" DESC);
```

**性能提升**:

- 向量搜索：10x 加速（100ms → 10ms）
- 记忆查询：5x 加速

### 2. 记忆衰减批量处理

```typescript
// 批量更新（每批 1000 条）
async function batchDecay(memories: Memory[], batchSize = 1000) {
  for (let i = 0; i < memories.length; i += batchSize) {
    const batch = memories.slice(i, i + batchSize);
    await prisma.$transaction(
      batch.map((m) =>
        prisma.memory.update({
          where: { id: m.id },
          data: { importance: m.importance * 0.99 },
        })
      )
    );
  }
}
```

### 3. Redis 缓存策略

| 数据           | TTL      | 策略     |
| -------------- | -------- | -------- |
| Embedding 缓存 | 7 天     | LRU 淘汰 |
| 用户偏好       | 1 小时   | 写穿透   |
| 限流计数       | 滑动窗口 | 自动过期 |

---

## 🔧 运维指南

### 健康检查

```bash
# 服务健康
GET /ai-agent/health

# 响应示例
{
  "status": "healthy",
  "components": {
    "llm": { "status": "up", "latencyMs": 120 },
    "storage": { "status": "up", "latencyMs": 5 },
    "memory": { "status": "up", "latencyMs": 15 }
  }
}
```

### 关键告警规则

```yaml
# Prometheus AlertManager 配置
groups:
  - name: ai-agent
    rules:
      # 错误率告警
      - alert: HighErrorRate
        expr: rate(ai_agent_request_errors_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'AI Agent 错误率超过 5%'

      # 延迟告警
      - alert: HighLatency
        expr: histogram_quantile(0.99, ai_agent_request_duration_ms_bucket) > 5000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'AI Agent P99 延迟超过 5 秒'

      # 熔断器打开
      - alert: CircuitBreakerOpen
        expr: ai_agent_circuit_breaker_state == 2
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: 'AI Agent 熔断器已打开'
```

### 日志查询 (ELK)

```json
// 查询特定请求的完整链路
{
  "query": {
    "bool": {
      "must": [
        { "match": { "context.requestId": "req_abc123" } }
      ]
    }
  },
  "sort": [{ "timestamp": "asc" }]
}

// 查询错误日志
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "error" } },
        { "range": { "timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

---

## 📦 部署配置

### 环境变量

```bash
# 基础配置
APP_NAME=ai-agent
NODE_ENV=production

# LLM 配置
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o
OPENAI_BASE_URL=https://api.openai.com/v1

# 数据库
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# 可观测性
LOG_LEVEL=info
LOG_SANITIZE=true
TRACING_ENABLED=true
TRACING_SAMPLE_RATE=0.1
TRACING_ENDPOINT=http://jaeger:4318/v1/traces
METRICS_ENABLED=true
METRICS_PREFIX=ai_agent

# 限流
RATE_LIMIT_USER_RPM=60
RATE_LIMIT_GLOBAL_RPM=1000

# 熔断
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=30000
```

### Docker Compose

```yaml
version: '3.8'

services:
  ai-agent:
    image: ai-agent:latest
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    depends_on:
      - postgres
      - redis
      - jaeger
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/ai-agent/health']
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: pgvector/pgvector:pg16
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - '16686:16686' # UI
      - '4318:4318' # OTLP HTTP

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - '9090:9090'

volumes:
  postgres_data:
```

---

## 📊 优化完成状态

### P0 - 已完成 ✅

| 项目               | 状态 | 文件                          |
| ------------------ | ---- | ----------------------------- |
| 类型安全 (memory/) | ✅   | `types.ts`, `prisma-types.ts` |
| 敏感数据脱敏       | ✅   | `sanitizer.service.ts`        |

### P1 - 已完成 ✅

| 项目            | 状态 | 文件                            |
| --------------- | ---- | ------------------------------- |
| 结构化日志      | ✅   | `structured-logger.service.ts`  |
| 分布式追踪      | ✅   | `opentelemetry.service.ts`      |
| Prometheus 指标 | ✅   | `prometheus-metrics.service.ts` |
| Core 类型定义   | ✅   | `core/types.ts`                 |

### P2 - 已完成 ✅

| 项目         | 状态 | 文件                        |
| ------------ | ---- | --------------------------- |
| 向量索引优化 | ✅   | `migrations/20260126_*.sql` |

### 剩余工作

| 项目               | 优先级 | 说明                      |
| ------------------ | ------ | ------------------------- |
| Core 服务 any 替换 | P1     | 使用 `core/types.ts` 替换 |
| 单元测试补充       | P2     | 覆盖核心服务              |
| 集成测试           | P3     | 端到端测试                |

---

_文档版本: v2.0 | 企业级 AI Agent 解决方案_
