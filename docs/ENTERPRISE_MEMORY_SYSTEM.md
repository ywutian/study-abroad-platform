# 🧠 企业级 AI 记忆系统架构方案

> **版本**: v2.2
> **参考**: Mem0, LangChain Memory, OpenAI Memory API
> **适用场景**: 留学申请 AI 助手
> **审计状态**: 已审计 (2026-02-12) — 各功能标注 **[已实现]** 或 **[规划中]**

---

## 一、系统概述

### 1.1 设计目标

| 目标       | 指标                       | 状态                                        |
| ---------- | -------------------------- | ------------------------------------------- |
| **个性化** | 基于记忆的推荐准确率 > 85% | **[规划中]** — 尚无量化测量                 |
| **一致性** | 跨会话上下文保持率 100%    | **[已实现]** — Redis + PG 持久化            |
| **实时性** | 记忆检索延迟 < 50ms        | **[已实现]** — Redis 缓存层                 |
| **可扩展** | 支持 100万+ 用户记忆       | **[已实现]** — pgvector HNSW 索引           |
| **合规性** | GDPR/CCPA 完全合规         | **[已实现]** — UserDataService 提供完整 API |

### 1.2 核心架构 **[已实现]**

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Memory System Architecture                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      Memory Lifecycle Manager                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │ Extract  │→│ Validate │→│  Store   │→│  Decay   │→│ Archive│ │   │
│  │  │ 提取     │  │ 验证     │  │  存储    │  │  衰减    │  │ 归档   │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                        │
│                    ▼               ▼               ▼                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Memory Store (3-Tier)                          │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │  Working Memory │  │  Short-term     │  │   Long-term     │       │   │
│  │  │    工作记忆      │  │   短期记忆       │  │    长期记忆      │       │   │
│  │  │                 │  │                 │  │                 │       │   │
│  │  │  • 当前对话上下文 │  │  • 会话记忆      │  │  • 用户事实      │       │   │
│  │  │  • 工具调用状态  │  │  • 最近交互      │  │  • 长期偏好      │       │   │
│  │  │  • 临时推理     │  │  • 临时偏好      │  │  • 核心决策      │       │   │
│  │  │                 │  │                 │  │  • 重要经历      │       │   │
│  │  │  TTL: 请求级    │  │  TTL: 24h-7d    │  │  TTL: 永久/年    │       │   │
│  │  │  Storage: RAM   │  │  Storage: Redis │  │  Storage: PG    │       │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                        │
│                    ▼               ▼               ▼                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Memory Index Layer                             │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │  Semantic Index │  │  Temporal Index │  │  Category Index │       │   │
│  │  │    语义索引      │  │    时间索引      │  │    分类索引      │       │   │
│  │  │   (pgvector)    │  │   (B-tree)      │  │   (Hash)        │       │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │   │
│  │                                                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、记忆分类体系

### 2.1 记忆类型矩阵 **[已实现]**

```text
                    持久性
            短暂 ←──────────→ 持久
        ┌─────────────────────────────┐
   低   │  临时状态   │   会话偏好    │
   ↑    │  (工作记忆)  │  (短期记忆)   │
重要性  ├─────────────┼───────────────┤
   ↓    │  上下文信息  │   核心事实    │
   高   │  (工作记忆)  │  (长期记忆)   │
        └─────────────────────────────┘
```

### 2.2 详细分类定义 **[已实现]**

| 层级   | 类型     | 存储       | TTL     | 示例                             |
| ------ | -------- | ---------- | ------- | -------------------------------- |
| **L1** | 工作记忆 | RAM        | 请求级  | 当前对话上下文、工具调用中间状态 |
| **L2** | 短期记忆 | Redis      | 1-7天   | 最近讨论的学校、临时修改的偏好   |
| **L3** | 长期记忆 | PostgreSQL | 永久/年 | GPA、SAT、ED决定、核心偏好       |

### 2.3 记忆类型枚举 **[已实现]**

> **重要修正**: 实际代码使用 5 种基础类型 + `category` 字段实现细粒度分类，而非 16 种子类型枚举。

```typescript
// === 实际实现 (types/index.ts + Prisma enum) ===
enum MemoryType {
  FACT = 'FACT', // 事实信息 (GPA, SAT, 活动等，通过 category 区分)
  PREFERENCE = 'PREFERENCE', // 用户偏好 (学校偏好, 专业偏好等)
  DECISION = 'DECISION', // 决策记录 (ED/EA, 选校等)
  SUMMARY = 'SUMMARY', // 对话摘要
  FEEDBACK = 'FEEDBACK', // 用户反馈
}

// 细粒度分类通过 category 字段实现，例如:
// { type: 'FACT', category: 'gpa', content: 'GPA 3.8' }
// { type: 'FACT', category: 'sat', content: 'SAT 1520' }
// { type: 'PREFERENCE', category: 'school', content: '偏好东海岸大U' }

enum MemoryTier {
  WORKING = 'WORKING', // L1: 工作记忆 (RAM)
  SHORT = 'SHORT', // L2: 短期记忆 (Redis)
  LONG = 'LONG', // L3: 长期记忆 (PostgreSQL)
  ARCHIVE = 'ARCHIVE', // L4: 归档 (冷存储)
}
```

<details>
<summary>原规划的细粒度类型 (已通过 type + category 组合实现)</summary>

| 规划子类型             | 实际实现                              |
| ---------------------- | ------------------------------------- |
| `ACADEMIC_FACT`        | `FACT` + category `gpa`/`rank`        |
| `TEST_SCORE_FACT`      | `FACT` + category `sat`/`act`/`toefl` |
| `ACTIVITY_FACT`        | `FACT` + category `activity`          |
| `AWARD_FACT`           | `FACT` + category `award`             |
| `SCHOOL_PREFERENCE`    | `PREFERENCE` + category `school`      |
| `MAJOR_PREFERENCE`     | `PREFERENCE` + category `major`       |
| `APPLICATION_DECISION` | `DECISION` + category `ed`/`ea`       |
| `CONVERSATION_SUMMARY` | `SUMMARY` + category `conversation`   |

</details>

---

## 三、记忆生命周期管理

### 3.1 生命周期流程 **[已实现]**

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Memory Lifecycle                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│   │ EXTRACT │───→│ VALIDATE│───→│  SCORE  │───→│  STORE  │───→│  INDEX  │   │
│   │  提取   │    │  验证   │    │  评分   │    │  存储   │    │  索引   │   │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│        │              │              │              │              │         │
│        ▼              ▼              ▼              ▼              ▼         │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│   │规则引擎 │    │格式验证 │    │重要性   │    │选择存储层│    │向量化   │   │
│   │+ LLM   │    │范围验证 │    │新鲜度   │    │去重检查 │    │分类索引 │   │
│   │        │    │业务验证 │    │置信度   │    │冲突解决 │    │时间索引 │   │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│                                                                               │
│   ════════════════════════════════════════════════════════════════════════   │
│                                                                               │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│   │ RETRIEVE│◄───│ REINFORCE│◄───│  DECAY  │◄───│ COMPRESS│◄───│ ARCHIVE │   │
│   │  检索   │    │  强化   │    │  衰减   │    │  压缩   │    │  归档   │   │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│        │              │              │              │              │         │
│        ▼              ▼              ▼              ▼              ▼         │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │
│   │语义检索 │    │访问计数+1│   │时间衰减 │    │合并相似 │    │导出备份 │   │
│   │时间过滤 │    │重要性↑  │    │重要性↓  │    │生成摘要 │    │冷存储   │   │
│   │重排序   │    │新鲜度↑  │    │过期检查 │    │删除冗余 │    │GDPR删除 │   │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 生命周期配置

> **注**: 实际代码中不存在统一的 `MemoryLifecycleConfig` 接口。各子系统配置分散在各自的服务文件中。

#### 评分配置 **[已实现]** (`memory-scorer.service.ts`)

```typescript
interface ScoringConfig {
  weights: { importance: 0.4; freshness: 0.3; confidence: 0.3 };
  decayRate: 0.01;
  accessBoostRate: 0.02;
  maxAccessBonus: 0.2;
}
```

#### 衰减配置 **[已实现]** (`memory-decay.service.ts`)

```typescript
interface DecayConfig {
  enabled: true;
  decayRate: 0.01; // 每天衰减 1%
  minImportance: 0.1; // 最低 0.1
  accessBoost: 0.05; // 访问加成 5%
  maxAccessBoost: 0.3; // 最大访问加成 30%
  archiveThreshold: 0.2; // 归档阈值
  archiveAfterDays: 180; // 180 天后归档
  deleteAfterDays: 365; // 1 年后删除 (注: 非文档之前描述的 730 天/2 年)
  batchSize: 100; // 每批 100 条
}
```

#### 压缩配置 **[已实现]** (`memory-compaction.service.ts`)

```typescript
interface CompactionConfig {
  similarityThreshold: 0.92; // 相似度阈值 (注: 非之前描述的 0.9)
  minCompactionInterval: 24; // 最小压缩间隔 (小时)
  batchSize: 50; // 每批处理数量
  maxMemoryCount: 500; // 最大记忆数量 (触发压缩)
  maxTokenCount: 100000; // 最大 Token 数量 (触发压缩)
}
```

#### 提取配置 **[已实现]** (`memory-extractor.service.ts` + `extraction-rules.ts`)

- 规则引擎提取: 已实现
- LLM 提取: 已实现

#### 验证配置 **[规划中]**

- 统一的验证配置接口: 未实现

---

## 四、记忆评分系统

### 4.1 综合评分公式 **[已实现]**

```
MemoryScore = (Importance × W_i) + (Freshness × W_f) + (Confidence × W_c) + AccessBonus

其中:
- Importance: 基于规则的重要性 [0, 1]
- Freshness: 时间新鲜度 = exp(-λ × days_since_creation)
- Confidence: 提取置信度 [0, 1]
- AccessBonus: min(accessCount × boost, 0.2)
- W_i, W_f, W_c: 权重 (默认 0.4, 0.3, 0.3)
```

### 4.2 重要性评分规则 **[已实现]**

> **注**: 实际代码使用 5 种基础 `MemoryType` 而非细粒度子类型。评分通过 `content` 正则匹配实现条件加成。

```typescript
// 实际实现 (memory-scorer.service.ts)
const IMPORTANCE_RULES: Partial<Record<MemoryType, ImportanceRule>> = {
  [MemoryType.FACT]: {
    base: 0.8,
    boosts: [
      { condition: (input) => /GPA|绩点/i.test(input.content), boost: 0.1 },
      { condition: (input) => /SAT|ACT|TOEFL|IELTS/i.test(input.content), boost: 0.1 },
      // ... 更多规则
    ],
  },
  [MemoryType.DECISION]: {
    base: 0.85,
    boosts: [{ condition: (input) => /ED|Early Decision/i.test(input.content), boost: 0.1 }],
  },
  [MemoryType.PREFERENCE]: {
    base: 0.6,
    boosts: [],
  },
  [MemoryType.SUMMARY]: {
    base: 0.5,
    boosts: [],
  },
  [MemoryType.FEEDBACK]: {
    base: 0.7,
    boosts: [],
  },
};
```

### 4.3 新鲜度衰减曲线 **[已实现]**

```
新鲜度 Freshness(t) = exp(-λ × t)

其中:
- t: 距离创建的天数
- λ: 衰减系数 (默认 0.01)

示例:
- 创建当天: Freshness = 1.0
- 7 天后:   Freshness = 0.93
- 30 天后:  Freshness = 0.74
- 90 天后:  Freshness = 0.41
- 180 天后: Freshness = 0.17
- 365 天后: Freshness = 0.03
```

```
     1.0 ┤●
         │ ╲
     0.8 ┤  ╲
         │   ╲
     0.6 ┤    ╲
         │     ╲
     0.4 ┤      ╲
         │       ╲╲
     0.2 ┤         ╲╲╲
         │            ╲╲╲___
     0.0 ┼──────────────────────────
         0   30   90  180  365 (天)
```

---

## 五、记忆检索系统

### 5.1 检索策略

> **注**: 实际代码中不存在 `RetrievalStrategy` 枚举和 `RetrievalConfig` 接口。检索通过 `RecallOptions` 接口控制。

```typescript
// === 实际实现 (memory/types.ts) ===  **[已实现]**
interface RecallOptions {
  query?: string; // 语义搜索查询 (使用 pgvector)
  types?: MemoryType[]; // 按类型过滤
  categories?: string[]; // 按分类过滤
  limit?: number; // 返回数量
  minImportance?: number; // 最低重要性
  useSemanticSearch?: boolean; // 是否使用语义搜索 (默认 true)
  includeConversations?: boolean; // 是否包含对话
}
```

**已实现的检索方式**:

- 语义检索 (pgvector cosine similarity) **[已实现]**
- 按类型/分类过滤 **[已实现]**
- 按时间排序 (recentMessages) **[已实现]**

**规划中的检索方式**:

- 混合检索 (多路并行 + 合并) **[规划中]**
- MMR 多样性重排 **[规划中]**
- 独立的重排序模型 **[规划中]**

### 5.2 混合检索流程 **[规划中]**

```
用户查询: "帮我分析申请 MIT 的机会"
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Stage 1: 并行检索                          │
│                                                               │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐        │
│   │ 语义检索    │   │ 分类检索    │   │ 时间检索    │        │
│   │ "MIT申请"   │   │ SCHOOL_*    │   │ 最近7天     │        │
│   │ Top 20     │   │ ACADEMIC_*  │   │ Top 10     │        │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘        │
│          │                 │                 │               │
│          └─────────────────┼─────────────────┘               │
│                            ▼                                 │
│   ┌───────────────────────────────────────────────────────┐  │
│   │              Stage 2: 合并去重                         │  │
│   │  • Union 所有结果                                      │  │
│   │  • 按 memory_id 去重                                   │  │
│   │  • 保留最高分                                          │  │
│   └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│   ┌───────────────────────────────────────────────────────┐  │
│   │              Stage 3: 评分排序                         │  │
│   │                                                       │  │
│   │  Score = (similarity × 0.4) + (importance × 0.3)      │  │
│   │        + (freshness × 0.2) + (accessBonus × 0.1)      │  │
│   │                                                       │  │
│   └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│   ┌───────────────────────────────────────────────────────┐  │
│   │              Stage 4: 多样性重排 (可选)                 │  │
│   │                                                       │  │
│   │  • MMR (Maximal Marginal Relevance)                   │  │
│   │  • 避免返回过于相似的记忆                               │  │
│   │                                                       │  │
│   └───────────────────────────────────────────────────────┘  │
│                            ▼                                 │
│   ┌───────────────────────────────────────────────────────┐  │
│   │              Stage 5: 返回 Top-K                       │  │
│   │                                                       │  │
│   │  [                                                    │  │
│   │    { content: "GPA 3.8", score: 0.92 },               │  │
│   │    { content: "SAT 1520", score: 0.88 },              │  │
│   │    { content: "目标MIT CS", score: 0.85 },            │  │
│   │    ...                                                │  │
│   │  ]                                                    │  │
│   └───────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5.3 检索上下文构建 **[已实现]**

> **重要修正**: 实际 `RetrievalContext` 是**扁平结构**，不是文档之前描述的分类嵌套结构。

```typescript
// === 实际实现 (memory/types.ts) ===
interface RetrievalContext {
  // 最近对话 (扁平数组)
  recentMessages: MessageRecord[];

  // 相关记忆 (扁平数组，非按类型分组)
  relevantMemories: MemoryRecord[];

  // 用户偏好
  preferences: UserPreferences;

  // 相关实体 (扁平数组，非按类型分组)
  entities: EntityRecord[];

  // 元数据
  meta: {
    conversationId?: string;
    messageCount: number;
    memoryCount: number;
  };
}
```

> **差异说明**: 文档之前描述的 `memories.academic`、`memories.testScores` 等分类字段在实际代码中不存在。记忆统一放在 `relevantMemories` 数组中，可通过 `type` 和 `category` 字段在消费端过滤。

---

## 六、记忆去重与冲突

### 6.1 去重策略矩阵 **[已实现]**

> **注**: 实际去重键使用 `user:{userId}:{category}` 格式，基于 `MemoryType` + `category` 组合。

| 记忆场景                | 去重键                        | 冲突策略       | 说明             | 状态         |
| ----------------------- | ----------------------------- | -------------- | ---------------- | ------------ |
| GPA (`FACT` + gpa)      | `user:{userId}:gpa`           | `KEEP_LATEST`  | 一个用户一个 GPA | **[已实现]** |
| SAT/ACT/TOEFL (`FACT`)  | `user:{userId}:sat` 等        | `KEEP_HIGHEST` | 保留最高分       | **[已实现]** |
| ED 决策 (`DECISION`)    | `user:{userId}:ed`            | `KEEP_LATEST`  | 只能有一个 ED    | **[已实现]** |
| 专业偏好 (`PREFERENCE`) | `user:{userId}:major:{name}`  | `MERGE`        | 合并偏好原因     | **[已实现]** |
| 学校偏好 (`PREFERENCE`) | `user:{userId}:school:{name}` | `MERGE`        | 合并偏好原因     | **[已实现]** |
| 对话摘要 (`SUMMARY`)    | `conv:{convId}:summary`       | `KEEP_LATEST`  | 每对话一个摘要   | **[已实现]** |

### 6.2 冲突解决算法 **[已实现]**

```typescript
enum ConflictStrategy {
  KEEP_LATEST = 'KEEP_LATEST', // 保留最新
  KEEP_HIGHEST = 'KEEP_HIGHEST', // 保留最高值
  KEEP_OLDEST = 'KEEP_OLDEST', // 保留最旧
  MERGE = 'MERGE', // 合并
  KEEP_BOTH = 'KEEP_BOTH', // 都保留
  ASK_USER = 'ASK_USER', // 询问用户
}

function resolveConflict(
  newMemory: Memory,
  existingMemory: Memory,
  strategy: ConflictStrategy
): ResolveResult {
  switch (strategy) {
    case 'KEEP_LATEST':
      return {
        action: 'REPLACE',
        memory: newMemory,
        reason: '保留最新记忆',
      };

    case 'KEEP_HIGHEST':
      const newValue = extractNumericValue(newMemory.content);
      const existValue = extractNumericValue(existingMemory.content);
      if (newValue > existValue) {
        return {
          action: 'REPLACE',
          memory: newMemory,
          reason: `新值 ${newValue} > 旧值 ${existValue}`,
        };
      }
      return {
        action: 'SKIP',
        memory: existingMemory,
        reason: `旧值 ${existValue} >= 新值 ${newValue}`,
      };

    case 'MERGE':
      return {
        action: 'MERGE',
        memory: {
          ...existingMemory,
          content: mergeContents(existingMemory.content, newMemory.content),
          importance: Math.max(existingMemory.importance, newMemory.importance),
          updatedAt: new Date(),
        },
        reason: '合并记忆内容',
      };

    case 'KEEP_BOTH':
      return {
        action: 'ADD',
        memory: newMemory,
        reason: '允许多条记忆',
      };

    case 'ASK_USER':
      return {
        action: 'PENDING',
        memory: newMemory,
        reason: '需要用户确认',
        confirmationRequired: true,
      };
  }
}
```

---

## 七、记忆压缩与摘要

### 7.1 压缩触发条件 **[已实现]**

> **注**: 实际代码中不存在 `CompressionTrigger` 接口。压缩由 `CompactionConfig` 控制，定时任务为每天凌晨 4 点。

```typescript
// 实际配置 (memory-compaction.service.ts)
interface CompactionConfig {
  similarityThreshold: 0.92; // 相似度阈值
  minCompactionInterval: 24; // 最小压缩间隔 (小时)
  batchSize: 50; // 每批处理数量
  maxMemoryCount: 500; // 最大记忆数量 (触发压缩)
  maxTokenCount: 100000; // 最大 Token 数量 (触发压缩)
}

// 定时: @Cron('0 4 * * *') — 每天凌晨 4 点 (非之前描述的 3 点)
// 分布式锁: Redis 防止多实例重复执行
```

### 7.2 压缩流程 **[已实现]**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Memory Compression Flow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 识别压缩候选                                                  │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ SELECT * FROM memories                                  │ │
│     │ WHERE user_id = ? AND importance < 0.5                  │ │
│     │ AND created_at < NOW() - INTERVAL '90 days'             │ │
│     │ ORDER BY category, created_at                           │ │
│     └─────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  2. 分组聚类 (按 category + 语义相似度)                           │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ Group 1: [活动A, 活动B, 活动C]  (相似度 > 0.9)           │ │
│     │ Group 2: [学校偏好1, 学校偏好2]                          │ │
│     │ Group 3: [...]                                          │ │
│     └─────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  3. LLM 生成摘要                                                 │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ Prompt: "将以下记忆合并为一条摘要，保留关键信息"          │ │
│     │ Input:  [活动A, 活动B, 活动C]                            │ │
│     │ Output: "参与了3项活动：机器人社团(社长)、..."            │ │
│     └─────────────────────────────────────────────────────────┘ │
│                            │                                     │
│                            ▼                                     │
│  4. 替换原记忆                                                   │
│     ┌─────────────────────────────────────────────────────────┐ │
│     │ Transaction:                                            │ │
│     │   DELETE FROM memories WHERE id IN (...)                │ │
│     │   INSERT INTO memories (summary) VALUES (...)           │ │
│     │   INSERT INTO compression_log (...)                     │ │
│     └─────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 摘要生成 Prompt **[已实现]**

```typescript
const COMPRESSION_PROMPT = `你是记忆压缩专家。将多条相关记忆合并为一条精炼的摘要。

## 原则
1. 保留所有关键信息（数字、名称、日期）
2. 去除重复和冗余
3. 保持客观陈述
4. 控制在 200 字以内

## 输入记忆
{memories}

## 输出格式
{
  "summary": "压缩后的摘要",
  "keyFacts": ["保留的关键事实1", "..."],
  "droppedInfo": ["丢弃的信息1", "..."],
  "confidence": 0.9
}`;
```

---

## 八、安全与合规

### 8.1 数据分级 **[规划中]**

| 级别        | 类型           | 存储要求   | 访问控制   |
| ----------- | -------------- | ---------- | ---------- |
| **L1 公开** | 沟通偏好       | 普通加密   | 用户 + AI  |
| **L2 敏感** | GPA、成绩      | 字段加密   | 仅用户授权 |
| **L3 隐私** | 真实姓名、身份 | 端到端加密 | 仅用户本人 |

### 8.2 GDPR 合规 API **[已实现]**

> **注**: 实际实现由 `UserDataService` 提供，API 端点通过 `AiAgentController` 暴露。完整 API 列表参见 [AI_AGENT_ARCHITECTURE.md](AI_AGENT_ARCHITECTURE.md#用户数据管理-api)。

**已实现的 GDPR 功能**:

| GDPR 权利  | API 端点                                         | 状态         |
| ---------- | ------------------------------------------------ | ------------ |
| 数据访问权 | `GET /ai-agent/user-data/memories`               | **[已实现]** |
| 数据导出权 | `POST /ai-agent/user-data/export`                | **[已实现]** |
| 删除权     | `DELETE /ai-agent/user-data/memories/:id`        | **[已实现]** |
| 批量删除   | `POST /ai-agent/user-data/memories/batch-delete` | **[已实现]** |
| 全部清除   | `DELETE /ai-agent/user-data/all`                 | **[已实现]** |
| 偏好管理   | `PUT /ai-agent/user-data/preferences`            | **[已实现]** |
| 偏好重置   | `POST /ai-agent/user-data/preferences/reset`     | **[已实现]** |

**规划中的功能**:

- `MemoryAuditLog` 审计日志接口 **[规划中]** — 代码中无对应实现
- `pauseMemoryExtraction` / `resumeMemoryExtraction` **[规划中]** — 可通过 preferences.enableMemory 间接实现
- `exportMemories(format: 'csv')` CSV 格式导出 **[规划中]**

### 8.3 数据保留策略 **[规划中]**

```yaml
# 数据保留配置
retention:
  # 活跃用户
  active_users:
    memories: 365 days # 记忆保留 1 年
    conversations: 90 days # 对话保留 90 天
    audit_logs: 180 days # 审计日志 180 天

  # 非活跃用户 (90天未登录)
  inactive_users:
    memories: 180 days
    conversations: 30 days
    audit_logs: 90 days

  # 删除账号后
  deleted_accounts:
    anonymized_data: 30 days # 匿名化数据保留 30 天
    backup: 90 days # 备份保留 90 天
    permanent_delete: 90 days # 90 天后永久删除
```

---

## 九、可观测性

### 9.1 指标体系

> **注**: 实际代码中不存在独立的 `MemoryMetrics` 接口。记忆系统指标通过 `PrometheusMetricsService` 和各服务的内部统计方法提供。

**已实现的指标** **[已实现]**:

- `ai_agent_requests_total` — 请求计数 (Counter)
- `ai_agent_request_duration_ms` — 请求延迟 (Histogram)
- `ai_agent_llm_tokens_prompt` / `ai_agent_llm_tokens_completion` — Token 使用量 (Histogram)
- `ai_agent_circuit_breaker_state` — 熔断器状态 (Gauge)
- `ai_agent_memory_operations_total` — 记忆操作数 (Counter)
- `EmbeddingService.getCacheStats()` — 缓存模式 + 大小

**已实现的内部统计**:

- `MemoryDecayService.getStats()` — 衰减统计 (按 tier 分布、平均重要性等)
- `MemoryCompactionService` 返回 `CompactionResult` (processed, merged, summarized, deleted, tokensSaved)

**规划中的指标** **[规划中]**:

- 细粒度容量指标 (memoriesByType, storageUsageBytes)
- 质量指标 (extractionAccuracy, retrievalRelevance, dedupeRate)
- 业务指标 (personalizationScore, memoryUsageRate)

### 9.2 告警规则 **[规划中]**

```yaml
# Prometheus AlertManager Rules
groups:
  - name: memory_system_alerts
    rules:
      # 存储容量告警
      - alert: MemoryStorageHigh
        expr: memory_storage_usage_bytes / memory_storage_limit_bytes > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: '记忆存储使用率超过 80%'

      # 检索延迟告警
      - alert: MemoryRetrievalSlow
        expr: histogram_quantile(0.95, memory_retrieval_latency_bucket) > 200
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'P95 记忆检索延迟超过 200ms'

      # 提取失败率告警
      - alert: MemoryExtractionFailureHigh
        expr: rate(memory_extraction_failures_total[5m]) / rate(memory_extraction_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: '记忆提取失败率超过 10%'
```

### 9.3 仪表盘设计 **[规划中]**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Memory System Dashboard                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │   Total Memories    │  │  Active Users       │  │  Avg per User       │  │
│  │                     │  │                     │  │                     │  │
│  │     1,234,567       │  │      45,678         │  │       27            │  │
│  │     ↑ 5.2%          │  │      ↑ 3.1%         │  │       ↑ 2.3%        │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Memories by Type                                                      │  │
│  │  ████████████████████████████████████ ACADEMIC_FACT (35%)              │  │
│  │  ████████████████████████ TEST_SCORE_FACT (24%)                        │  │
│  │  ████████████████ SCHOOL_PREFERENCE (16%)                              │  │
│  │  ████████████ ACTIVITY_FACT (12%)                                      │  │
│  │  ████████ DECISION (8%)                                                │  │
│  │  ████ OTHER (5%)                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  Retrieval Latency (P95)        │  │  Extraction Success Rate         │  │
│  │                                 │  │                                 │  │
│  │  45ms ────────────────●         │  │  98.5% ────────────────●        │  │
│  │       ╱╲    ╱╲                  │  │        ╱╲                       │  │
│  │      ╱  ╲  ╱  ╲                 │  │       ╱  ╲                      │  │
│  │     ╱    ╲╱    ╲                │  │  ────╱    ╲───────────          │  │
│  │  ──╱              ╲──           │  │                                 │  │
│  │  0   6   12   18   24 (hour)    │  │  0   6   12   18   24 (hour)    │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 十、实施路线图

### Phase 1: 基础完善 (1-2 周)

- [x] 三层记忆架构 **[已实现]** — Redis + PG + pgvector
- [x] 规则引擎提取 **[已实现]** — `extraction-rules.ts`
- [x] 基础去重 **[已实现]** — `memory-conflict.service.ts` dedupeRules
- [x] **冲突处理策略** **[已实现]** — 6 种策略 (KEEP_LATEST, KEEP_HIGHEST, KEEP_OLDEST, MERGE, KEEP_BOTH, ASK_USER)
- [x] **记忆衰减机制** **[已实现]** — `memory-decay.service.ts` 每天 3AM @Cron + 分布式锁
- [ ] **完善验证规则** **[规划中]** — 统一验证接口未实现

### Phase 2: 企业级功能 (2-3 周)

- [ ] 混合检索策略 **[规划中]** — 当前仅语义检索 + 类型过滤
- [x] 记忆压缩 **[已实现]** — `memory-compaction.service.ts` 每天 4AM @Cron
- [ ] 多样性重排 (MMR) **[规划中]**
- [x] 记忆评分 **[已实现]** — `memory-scorer.service.ts` 多维评分系统
- [x] 指标监控 **[已实现]** — `prometheus-metrics.service.ts` + `metrics.service.ts`

### Phase 3: 高级功能 (3-4 周)

- [ ] 跨用户知识图谱 **[规划中]**
- [ ] 自动学习优化 **[规划中]**
- [ ] A/B 测试框架 **[规划中]**
- [ ] 管理后台 **[规划中]** — 部分实现于 `admin/agent-admin.controller.ts`

---

## 十一、预测系统集成 (v2-ensemble, 2026-02-09) **[已实现]**

记忆系统已与录取预测系统深度集成，实现双向数据流。

### 11.1 预测前读取 (PredictionService → MemoryManagerService)

| 读取类型 | 记忆/实体类型                             | API 调用                                                      | 用途                   |
| -------- | ----------------------------------------- | ------------------------------------------------------------- | ---------------------- |
| 历史预测 | `DECISION` + category `school_prediction` | `recall({ types: ['DECISION'], useSemanticSearch: false })`   | 趋势分析、重复查询检测 |
| 用户偏好 | `PREFERENCE`                              | `recall({ types: ['PREFERENCE'], useSemanticSearch: false })` | 申请策略偏好           |
| 个人事实 | `FACT`                                    | `recall({ types: ['FACT'], useSemanticSearch: false })`       | 补充 Profile 洞察      |
| 学校实体 | `Entity(SCHOOL)`                          | `searchEntities({ types: ['SCHOOL'] })`                       | 关注频次 → 微调        |

> **重要**: `useSemanticSearch: false` 确保按 `types` 精确过滤，而非语义搜索。

### 11.2 预测后写入 (PredictionService → MemoryManagerService)

| 写入内容 | 类型             | Importance              | 内容模板                                                            |
| -------- | ---------------- | ----------------------- | ------------------------------------------------------------------- |
| 预测摘要 | `DECISION`       | 0.7 (首次) / 0.8 (重复) | "为 {school} 进行了录取预测, 概率: {prob}%, tier: {tier}"           |
| 学校实体 | `Entity(SCHOOL)` | —                       | `{ name, description, attributes: { predictedProbability, tier } }` |

### 11.3 记忆增强微调

- 当用户多次关注同一学校 (Entity 中有记录) → 概率 +1~2% (reflected demonstrated interest)
- 微调上限: ±2%
- 微调值记录在 `engineScores.memoryAdjustment` 字段

### 11.4 技术要点

- 记忆读取使用 `try/catch` 包装，`MemoryManagerService` 不可用时 graceful degradation
- Entity 表**不含** `embedding` 列，使用 Prisma ORM 关键词匹配而非 pgvector

> 完整预测系统文档: [PREDICTION_SYSTEM.md](PREDICTION_SYSTEM.md)

---

## 附录: 核心代码结构

> **审计修正**: 以下为实际存在的文件列表。

```
apps/api/src/modules/ai-agent/memory/
├── types.ts                      # 类型定义 (MemoryRecord, RetrievalContext 等)
├── extraction-rules.ts           # 提取规则引擎
├── memory-extractor.service.ts   # 记忆提取服务
├── memory-manager.service.ts     # 记忆管理器 (核心入口)
├── memory-scorer.service.ts      # 记忆评分服务 [已实现]
├── memory-compaction.service.ts  # 记忆压缩服务 [已实现] (注: 非 memory-compressor)
├── memory-conflict.service.ts    # 记忆冲突解决 [已实现]
├── memory-decay.service.ts       # 记忆衰减服务 [已实现]
├── embedding.service.ts          # 向量化服务 (Redis 缓存 + 内存 LRU)
├── persistent-memory.service.ts  # 持久化服务 (PostgreSQL + pgvector)
├── redis-cache.service.ts        # Redis 短期缓存 (+ 内存降级)
├── sanitizer.service.ts          # 敏感数据脱敏 (三级策略)
├── summarizer.service.ts         # 摘要服务
├── user-data.service.ts          # GDPR 用户数据管理
└── prisma-types.ts               # Prisma 查询类型
```

> **不存在的文件**: `memory-compressor.service.ts`(实际为 `memory-compaction.service.ts`)、`memory-retriever.service.ts`(检索集成于 `memory-manager.service.ts`)。

---

_文档版本: v2.2 | 更新日期: 2026-02-13 | 审计日期: 2026-02-12_
