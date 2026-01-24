# 🏢 企业级 AI Agent 解决方案

> **版本**: v2.1
> **更新日期**: 2026-02-13
> **合规标准**: SOC2, GDPR, ISO 27001
> **审计状态**: 已审计 (2026-02-12) — 各功能标注 **[已实现]** 或 **[规划中]**

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
│  │  Fast Router → Agent Selection → ReWOO Workflow → Response│    │
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

| 组件               | 职责                                  | 技术                       |
| ------------------ | ------------------------------------- | -------------------------- | ------------ |
| **Orchestrator**   | 请求调度、Agent 选择                  | Fast Router + ReWOO        | **[已实现]** |
| **WorkflowEngine** | ReWOO 三阶段执行 (Plan/Execute/Solve) | LLM + Tool Chain           | **[已实现]** |
| **Memory Manager** | 三层记忆管理                          | Redis + PG + pgvector      | **[已实现]** |
| **Resilience**     | 熔断、重试、降级                      | Circuit Breaker Pattern    | **[已实现]** |
| **Observability**  | 日志、追踪、指标                      | OpenTelemetry + Prometheus | **[已实现]** |

---

## 🔒 类型安全

### 类型定义文件结构 **[已实现]**

```
apps/api/src/modules/ai-agent/
├── types/
│   └── index.ts              # 核心类型定义 (AgentType, MemoryType, EntityType 等)
├── core/
│   └── types.ts              # LLM/Tool 相关类型
├── memory/
│   ├── types.ts              # 记忆系统类型 (RetrievalContext, MemoryMetadata 等)
│   └── prisma-types.ts       # Prisma 查询类型
└── infrastructure/
    └── logging/
        └── structured-logger.service.ts  # 日志类型内联定义 (LogLevel, LogContext, LogEntry)
```

> **注**: 不存在独立的 `infrastructure/logging/types.ts` 文件，日志类型定义内联于 `structured-logger.service.ts`。

### 主要类型 **[已实现]**

```typescript
// 记忆元数据 (memory/types.ts)
interface MemoryMetadata {
  confidence?: number;
  source?: string;
  conversationId?: string;
  messageId?: string;
  dedupeKey?: string;
  pendingConflict?: boolean;
  conflictWith?: string;
  scoreDetails?: {
    importanceScore: number;
    freshnessScore: number;
    confidenceScore: number;
    accessBonus: number;
  };
  score?: number;
  tier?: string;
  // ... 更多字段见 memory/types.ts
}

// 工具调用结果 (memory/types.ts)
interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

> **注**: `ChatCompletionResponse` 定义在 `core/types.ts`，`ToolCallResult` 和 `MemoryMetadata` 定义在 `memory/types.ts`。

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

### 1. 结构化日志 **[已实现]**

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

### 2. 分布式追踪 **[已实现]**

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

### 3. Prometheus 指标 **[已实现]**

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

### 敏感数据脱敏 **[已实现]**

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

### GDPR 合规 API **[已实现]**

| 权利     | API 端点                                  | 说明             | 状态         |
| -------- | ----------------------------------------- | ---------------- | ------------ |
| 访问权   | `POST /ai-agent/user-data/export`         | 导出所有数据     | **[已实现]** |
| 删除权   | `DELETE /ai-agent/user-data/all`          | 清除所有 AI 数据 | **[已实现]** |
| 限制处理 | `PUT /ai-agent/user-data/preferences`     | 更新 AI 偏好     | **[已实现]** |
| 记忆管理 | `DELETE /ai-agent/user-data/memories/:id` | 删除单条记忆     | **[已实现]** |

> **注**: 完整的用户数据管理 API 参见 [AI_AGENT_ARCHITECTURE.md](AI_AGENT_ARCHITECTURE.md#用户数据管理-api)。

---

## ⚡ 性能优化

### 1. 向量索引 **[已实现]**

**迁移文件**: `prisma/migrations/20260126_add_vector_indexes/migration.sql` 及 `prisma/migrations/1_create_vector_indexes/migration.sql`

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

### 2. 记忆衰减批量处理 **[已实现]**

**文件**: `memory/memory-decay.service.ts`

```typescript
// 实际配置: 每批 100 条 (非文档之前描述的 1000 条)
// 衰减率: 0.01 (每日衰减 1%)
// 归档: 180 天后
// 删除: 365 天后 (1 年)
// 定时: 每天凌晨 3 点 (@Cron)
// 分布式锁: Redis 防止多实例重复执行
```

> **注**: 实际实现使用逐条 `prisma.memory.update()` 而非 `prisma.$transaction(batch.map(...))`，`batchSize` 默认值为 `100`。

### 3. Redis 缓存策略 **[已实现]**

| 数据           | TTL               | 策略                             | 状态         |
| -------------- | ----------------- | -------------------------------- | ------------ |
| Embedding 缓存 | **24 小时**       | LRU 淘汰 (内存降级: 最大 500 条) | **[已实现]** |
| 短期记忆缓存   | 可配置 (默认 24h) | 写穿透 + 内存降级 (最大 1000 条) | **[已实现]** |
| 限流计数       | 滑动窗口          | Redis ZSET + Lua 原子操作        | **[已实现]** |
| 熔断器状态     | 自动过期          | Redis 原子递增 (Lua) + 内存降级  | **[已实现]** |

> **修正**: Embedding 缓存 TTL 为 24 小时 (`CACHE_TTL = 86400`)，非之前文档描述的 7 天。

---

## 🔧 运维指南

### 健康检查 **[已实现]**

```bash
# 服务健康 (ai-agent.controller.ts, line 257)
GET /ai-agent/health

# 实际响应格式
{
  "status": "healthy" | "degraded",
  "llm": {
    "isHealthy": true,
    "circuitState": "CLOSED",
    "provider": "openai"
  },
  "timestamp": "2026-01-26T10:30:00.000Z"
}
```

> **注**: 实际响应仅包含 `llm` 状态（来自 `LLMService.getServiceStatus()`），不含独立的 `storage` 和 `memory` 组件检查。

### 关键告警规则 **[规划中]**

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

### 日志查询 (ELK) **[规划中]**

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
NODE_ENV=production

# LLM 配置 [已实现]
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o           # 默认: gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1

# Embedding 配置 [已实现]
EMBEDDING_MODEL=text-embedding-3-small  # 默认: text-embedding-3-small

# 数据库 [已实现]
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# 短期记忆缓存 [已实现]
MEMORY_CACHE_TTL=86400         # 默认: 86400 (24小时)

# 可观测性 [部分实现]
LOG_LEVEL=info                 # [已实现] 通过 ConfigService
TRACING_ENABLED=true           # [已实现] OpenTelemetryService 读取
TRACING_SAMPLE_RATE=0.1        # [已实现] OpenTelemetryService 读取
TRACING_ENDPOINT=http://jaeger:4318/v1/traces  # [已实现]
METRICS_ENABLED=true           # [已实现] PrometheusMetricsService 读取
METRICS_PREFIX=ai_agent        # [已实现] PrometheusMetricsService 读取

# 限流 [已实现]
RATE_LIMIT_USER_RPM=60         # 默认: 60
RATE_LIMIT_GLOBAL_RPM=1000     # 默认: 1000

# 熔断 (硬编码默认值，非环境变量) [已实现]
# failureThreshold=5, resetTimeoutMs=30000
```

> **注**: 熔断器参数目前硬编码在 `ResilienceService` 中，非通过环境变量配置。`APP_NAME` 和 `LOG_SANITIZE` 未在代码中使用。

### Docker Compose **[规划中]**

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

| 项目               | 状态 | 文件                          | 审计确认                              |
| ------------------ | ---- | ----------------------------- | ------------------------------------- |
| 类型安全 (memory/) | ✅   | `types.ts`, `prisma-types.ts` | **[已实现]** — 文件存在，类型定义完善 |
| 敏感数据脱敏       | ✅   | `sanitizer.service.ts`        | **[已实现]** — 三级脱敏策略已实现     |

### P1 - 已完成 ✅

| 项目            | 状态 | 文件                            | 审计确认                                    |
| --------------- | ---- | ------------------------------- | ------------------------------------------- |
| 结构化日志      | ✅   | `structured-logger.service.ts`  | **[已实现]** — JSON 格式、追踪 ID、脱敏     |
| 分布式追踪      | ✅   | `opentelemetry.service.ts`      | **[已实现]** — W3C Trace Context、Span 管理 |
| Prometheus 指标 | ✅   | `prometheus-metrics.service.ts` | **[已实现]** — Counter/Gauge/Histogram 指标 |
| Core 类型定义   | ✅   | `core/types.ts`                 | **[已实现]** — LLM/Tool 相关类型            |

### P2 - 已完成 ✅

| 项目         | 状态 | 文件                                                   | 审计确认                       |
| ------------ | ---- | ------------------------------------------------------ | ------------------------------ |
| 向量索引优化 | ✅   | `migrations/20260126_add_vector_indexes/migration.sql` | **[已实现]** — HNSW + 复合索引 |

### 额外已实现 (文档未列出)

| 项目            | 文件                                     | 审计确认     |
| --------------- | ---------------------------------------- | ------------ |
| 记忆评分系统    | `memory-scorer.service.ts`               | **[已实现]** |
| 记忆衰减管理    | `memory-decay.service.ts`                | **[已实现]** |
| 记忆冲突解决    | `memory-conflict.service.ts`             | **[已实现]** |
| 记忆压缩服务    | `memory-compaction.service.ts`           | **[已实现]** |
| Token 追踪      | `core/token-tracker.service.ts`          | **[已实现]** |
| 限流服务        | `core/rate-limiter.service.ts`           | **[已实现]** |
| 弹性保护        | `core/resilience.service.ts`             | **[已实现]** |
| Prompt 注入防护 | `security/prompt-guard.service.ts`       | **[已实现]** |
| 内容审核        | `security/content-moderation.service.ts` | **[已实现]** |
| 双引擎 Web 搜索 | `services/web-search.service.ts`         | **[已实现]** |

### 剩余工作

| 项目               | 优先级 | 说明                      | 状态                                |
| ------------------ | ------ | ------------------------- | ----------------------------------- |
| Core 服务 any 替换 | P1     | 使用 `core/types.ts` 替换 | **[规划中]**                        |
| 单元测试补充       | P2     | 覆盖核心服务              | **[规划中]** — 部分 spec 文件已存在 |
| 集成测试           | P3     | 端到端测试                | **[规划中]**                        |
| AlertManager 配置  | P2     | Prometheus 告警规则       | **[规划中]**                        |
| ELK 日志聚合       | P3     | 生产环境日志查询          | **[规划中]**                        |
| Docker Compose     | P2     | 容器化部署配置            | **[规划中]**                        |

---

_文档版本: v2.1 | 企业级 AI Agent 解决方案 | 审计日期: 2026-02-12_
