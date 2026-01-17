# 🔴 P0 优化计划 - 类型安全 & 敏感数据脱敏

> **版本**: v1.0  
> **预计工期**: 3-5 天  
> **风险等级**: 高（影响运行时稳定性和数据安全）

---

## 📊 问题概览

| 问题类型       | 影响文件数 | 问题数量 | 风险         |
| -------------- | ---------- | -------- | ------------ |
| `: any` 类型   | 20         | 60       | 运行时错误   |
| `as any` 断言  | 6          | 27       | 类型检查失效 |
| 敏感数据未脱敏 | 11         | -        | 数据泄露     |

---

## 🎯 P0.1 类型安全改进

### 阶段 1: 新增严格类型定义 (Day 1)

#### 1.1 扩展 `memory/types.ts`

```typescript
// ==================== 新增类型 ====================

/**
 * Prisma 查询 where 条件类型
 */
export interface MemoryWhereInput {
  userId: string;
  type?: { in: MemoryType[] };
  category?: string | { in: string[] };
  importance?: { gte?: number; lte?: number };
  content?: { contains: string; mode: 'insensitive' };
  createdAt?: { gte?: Date; lte?: Date };
  expiresAt?: { gt: Date } | null;
  OR?: MemoryWhereInput[];
}

export interface EntityWhereInput {
  userId: string;
  type?: { in: EntityType[] };
  name?: { contains: string; mode: 'insensitive' };
  description?: { contains: string; mode: 'insensitive' };
  OR?: EntityWhereInput[];
}

/**
 * 工具调用结果类型（替代 any）
 */
export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>; // 改为 unknown
  result?: ToolCallResult; // 改为具体类型
}

/**
 * 增强统计类型
 */
export interface EnhancedMemoryStats extends MemoryStats {
  decay?: {
    totalMemories: number;
    byTier: Record<MemoryTier, number>;
    averageImportance: number;
    averageFreshness: number;
    scheduledForArchive: number;
    scheduledForDelete: number;
  };
  scoring?: {
    averageScore: number;
    tierDistribution: Record<MemoryTier, number>;
  };
}

/**
 * LLM 响应结构
 */
export interface LLMParsedMemory {
  type: string;
  category?: string;
  content: string;
  importance?: number;
}

export interface LLMParsedEntity {
  type: string;
  name: string;
  description?: string;
}

export interface LLMExtractionResult {
  memories: LLMParsedMemory[];
  entities: LLMParsedEntity[];
}

export interface LLMSummaryResult {
  summary: string;
  keyTopics: string[];
  decisions: string[];
  nextSteps: string[];
  facts: LLMParsedMemory[];
  entities: LLMParsedEntity[];
}

/**
 * Embedding API 响应
 */
export interface EmbeddingAPIResponse {
  data: Array<{ embedding: number[] }>;
  usage?: { prompt_tokens: number; total_tokens: number };
}
```

#### 1.2 新增 `memory/prisma-types.ts`

```typescript
/**
 * Prisma 原始查询结果类型
 */
import { MemoryType, EntityType } from '@prisma/client';

export interface RawMemoryRow {
  id: string;
  userId: string;
  type: MemoryType;
  category: string | null;
  content: string;
  importance: number;
  accessCount: number;
  lastAccessedAt: Date | null;
  embedding: number[] | null;
  metadata: Record<string, unknown> | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  similarity?: number; // 仅 vector 搜索返回
}

export interface RawEntityRow {
  id: string;
  userId: string;
  type: EntityType;
  name: string;
  description: string | null;
  attributes: Record<string, unknown> | null;
  relations: Array<{ type: string; targetId?: string; targetName: string }> | null;
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
  similarity?: number;
}

export interface RawMessageRow {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  agentType: string | null;
  toolCalls: unknown;
  tokensUsed: number | null;
  latencyMs: number | null;
  createdAt: Date;
}
```

---

### 阶段 2: 修复核心服务 (Day 2)

#### 2.1 修复 `persistent-memory.service.ts` (4处)

```diff
// 修复 1: queryMemories where 条件
- const where: any = { userId, ... };
+ const where: Prisma.MemoryWhereInput = { userId, ... };

// 修复 2-4: 转换函数参数
- private toMemoryRecord(m: any): MemoryRecord
+ private toMemoryRecord(m: RawMemoryRow): MemoryRecord

- private toMessageRecord(m: any): MessageRecord
+ private toMessageRecord(m: RawMessageRow): MessageRecord

- private toEntityRecord(e: any): EntityRecord
+ private toEntityRecord(e: RawEntityRow): EntityRecord
```

#### 2.2 修复 `memory-manager.service.ts` (3处)

```diff
// 修复 1: getEntities 参数
- options?: { types?: any[]; limit?: number }
+ options?: { types?: EntityType[]; limit?: number }

// 修复 2: getEnhancedStats 返回值
- const result: any = { basic };
+ const result: EnhancedMemoryStats = { ...basic };

// 修复 3: triggerDecay 返回值
- Promise<{ success: boolean; result?: any }>
+ Promise<{ success: boolean; result?: DecayResult }>
```

#### 2.3 修复 `summarizer.service.ts` (4处)

```diff
// 修复 LLM 响应解析
- (parsed.memories || []).map((m: any) => ({
+ (parsed.memories || []).map((m: LLMParsedMemory) => ({

- (parsed.entities || []).map((e: any) => ({
+ (parsed.entities || []).map((e: LLMParsedEntity) => ({

- (parsed.facts || []).map((f: any) => ({
+ (parsed.facts || []).map((f: LLMParsedMemory) => ({
```

#### 2.4 修复 `user-data.service.ts` (3处)

```diff
// 修复 where 条件
- const where: any = { userId };
+ const where: Prisma.MemoryWhereInput = { userId };

- const where: any = { userId };
+ const where: Prisma.EntityWhereInput = { userId };

// 修复 toMemoryItem
- private toMemoryItem(memory: any): MemoryItemDto
+ private toMemoryItem(memory: RawMemoryRow): MemoryItemDto
```

---

### 阶段 3: 修复其他服务 (Day 3)

#### 3.1 需修复文件清单

| 文件                      | any 数量 | 修复方案                     |
| ------------------------- | -------- | ---------------------------- |
| `memory-decay.service.ts` | 1        | 使用 Prisma.MemoryWhereInput |
| `embedding.service.ts`    | 1        | 使用 EmbeddingAPIResponse    |
| `llm.service.ts`          | 6        | 定义 LLMResponse 类型        |
| `memory.service.ts`       | 5        | 使用已有类型                 |
| `orchestrator.service.ts` | 6        | 定义 StreamEvent 具体类型    |
| `agent-runner.service.ts` | 3        | 使用 ToolCall 类型           |
| `types/index.ts`          | 6        | 替换为 unknown + 类型守卫    |

#### 3.2 `types/index.ts` 改造策略

```typescript
// 旧代码：使用 any
interface Message {
  metadata?: any;
}

// 新代码：使用 unknown + 类型守卫
interface Message {
  metadata?: Record<string, unknown>;
}

// 类型守卫函数
export function isToolCallMetadata(metadata: unknown): metadata is { toolCallId: string } {
  return typeof metadata === 'object' && metadata !== null && 'toolCallId' in metadata;
}
```

---

### 阶段 4: 启用严格模式 (Day 4)

#### 4.1 修改 `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

#### 4.2 添加 ESLint 规则

```javascript
// eslint.config.mjs
{
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "warn",
    "@typescript-eslint/no-unsafe-member-access": "warn",
    "@typescript-eslint/no-unsafe-call": "warn",
  }
}
```

---

## 🎯 P0.2 敏感数据脱敏

### 阶段 1: 创建脱敏服务 (Day 3)

#### 1.1 新建 `memory/sanitizer.service.ts`

```typescript
/**
 * 敏感数据脱敏服务
 *
 * 脱敏级别：
 * - L1 轻度：保留部分信息（用于日志）
 * - L2 中度：大部分脱敏（用于导出）
 * - L3 完全：完全脱敏（用于公开）
 */

import { Injectable } from '@nestjs/common';

export enum SanitizeLevel {
  LIGHT = 'LIGHT', // L1: 日志
  MODERATE = 'MODERATE', // L2: 导出
  FULL = 'FULL', // L3: 公开
}

export interface SanitizeOptions {
  level: SanitizeLevel;
  preserveLength?: boolean; // 保留原始长度
  maskChar?: string; // 脱敏字符
}

interface SanitizePattern {
  pattern: RegExp;
  replacement: string | ((match: string, level: SanitizeLevel) => string);
  description: string;
}

@Injectable()
export class SanitizerService {
  private readonly patterns: SanitizePattern[] = [
    // === 高敏感 (所有级别都脱敏) ===
    {
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      replacement: '***-**-****',
      description: 'SSN',
    },
    {
      pattern: /\b\d{16}\b/g, // 银行卡
      replacement: '****-****-****-****',
      description: 'Credit Card',
    },
    {
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
      replacement: (match, level) => {
        if (level === SanitizeLevel.LIGHT) {
          const [local, domain] = match.split('@');
          return `${local.charAt(0)}***@${domain}`;
        }
        return '****@****.***';
      },
      description: 'Email',
    },
    {
      pattern: /1[3-9]\d{9}/g, // 中国手机号
      replacement: (match, level) => {
        if (level === SanitizeLevel.LIGHT) {
          return `${match.slice(0, 3)}****${match.slice(-4)}`;
        }
        return '***********';
      },
      description: 'Phone (CN)',
    },

    // === 中敏感 (MODERATE/FULL 脱敏) ===
    {
      pattern: /(?:GPA|绩点)[:\s]*(\d+\.?\d*)/gi,
      replacement: (match, level) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d+\.?\d*/, '*.** ');
      },
      description: 'GPA',
    },
    {
      pattern: /(?:SAT|ACT)[:\s]*(\d{3,4})/gi,
      replacement: (match, level) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d{3,4}/, '****');
      },
      description: 'Test Score',
    },
    {
      pattern: /(?:TOEFL|托福)[:\s]*(\d{2,3})/gi,
      replacement: (match, level) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d{2,3}/, '***');
      },
      description: 'TOEFL Score',
    },
    {
      pattern: /(?:IELTS|雅思)[:\s]*(\d\.?\d?)/gi,
      replacement: (match, level) => {
        if (level === SanitizeLevel.LIGHT) return match;
        return match.replace(/\d\.?\d?/, '*.*');
      },
      description: 'IELTS Score',
    },

    // === 低敏感 (仅 FULL 脱敏) ===
    {
      pattern: /(?:姓名|名字|name)[:\s]*([^\s,，。]+)/gi,
      replacement: (match, level) => {
        if (level !== SanitizeLevel.FULL) return match;
        return match.replace(/[^\s:：]+$/, '***');
      },
      description: 'Name',
    },
  ];

  /**
   * 脱敏文本内容
   */
  sanitize(content: string, options: SanitizeOptions = { level: SanitizeLevel.MODERATE }): string {
    let result = content;

    for (const { pattern, replacement } of this.patterns) {
      if (typeof replacement === 'function') {
        result = result.replace(pattern, (match) => replacement(match, options.level));
      } else {
        result = result.replace(pattern, replacement);
      }
    }

    return result;
  }

  /**
   * 批量脱敏
   */
  sanitizeBatch(contents: string[], options?: SanitizeOptions): string[] {
    return contents.map((c) => this.sanitize(c, options));
  }

  /**
   * 脱敏记忆记录
   */
  sanitizeMemory<T extends { content: string; metadata?: Record<string, unknown> }>(
    memory: T,
    options?: SanitizeOptions
  ): T {
    return {
      ...memory,
      content: this.sanitize(memory.content, options),
      metadata: memory.metadata ? this.sanitizeMetadata(memory.metadata, options) : undefined,
    };
  }

  /**
   * 脱敏元数据
   */
  private sanitizeMetadata(
    metadata: Record<string, unknown>,
    options?: SanitizeOptions
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string') {
        result[key] = this.sanitize(value, options);
      } else if (Array.isArray(value)) {
        result[key] = value.map((v) => (typeof v === 'string' ? this.sanitize(v, options) : v));
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 检测内容是否包含敏感信息
   */
  detectSensitive(content: string): { hasSensitive: boolean; types: string[] } {
    const types: string[] = [];

    for (const { pattern, description } of this.patterns) {
      if (pattern.test(content)) {
        types.push(description);
        // 重置 lastIndex（全局正则需要）
        pattern.lastIndex = 0;
      }
    }

    return {
      hasSensitive: types.length > 0,
      types: [...new Set(types)],
    };
  }
}
```

---

### 阶段 2: 集成脱敏服务 (Day 4)

#### 2.1 集成到 `user-data.service.ts` (导出)

```typescript
import { SanitizerService, SanitizeLevel } from './sanitizer.service';

@Injectable()
export class UserDataService {
  constructor(
    private prisma: PrismaService,
    private sanitizer: SanitizerService // 新增
  ) {}

  async exportData(userId: string, options: DataExportRequestDto): Promise<DataExportResponseDto> {
    // ... 获取数据 ...

    // 脱敏处理
    if (result.memories) {
      result.memories = result.memories.map((m) =>
        this.sanitizer.sanitizeMemory(m, { level: SanitizeLevel.MODERATE })
      );
    }

    if (result.conversations) {
      result.conversations = result.conversations.map((conv) => ({
        ...conv,
        messages: conv.messages.map((msg) => ({
          ...msg,
          content: this.sanitizer.sanitize(msg.content, { level: SanitizeLevel.MODERATE }),
        })),
      }));
    }

    return result;
  }
}
```

#### 2.2 集成到日志输出

```typescript
// memory-manager.service.ts
import { SanitizerService, SanitizeLevel } from './sanitizer.service';

private async extractAndSaveMemory(conversationId: string, message: MessageRecord): Promise<void> {
  // 脱敏后记录日志
  this.logger.debug(
    `Extracting memories from: ${this.sanitizer.sanitize(message.content, { level: SanitizeLevel.LIGHT })}`
  );

  // ... 业务逻辑 ...
}
```

#### 2.3 添加审计日志

```typescript
// 在 user-data.service.ts 中
async exportData(...) {
  // 记录审计日志
  await this.prisma.auditLog.create({
    data: {
      userId,
      action: 'EXPORT_AI_DATA',
      resource: 'ai_data',
      metadata: {
        includeMemories: options.includeMemories,
        includeConversations: options.includeConversations,
        sanitized: true,  // 标记已脱敏
      },
      ipAddress: this.context.ip,  // 需要注入 RequestContext
    },
  });

  // ... 导出逻辑 ...
}
```

---

### 阶段 3: 添加脱敏测试 (Day 5)

#### 3.1 新建 `sanitizer.service.spec.ts`

```typescript
import { SanitizerService, SanitizeLevel } from './sanitizer.service';

describe('SanitizerService', () => {
  let service: SanitizerService;

  beforeEach(() => {
    service = new SanitizerService();
  });

  describe('sanitize', () => {
    it('should mask SSN', () => {
      const input = '我的SSN是 123-45-6789';
      const result = service.sanitize(input, { level: SanitizeLevel.FULL });
      expect(result).toBe('我的SSN是 ***-**-****');
    });

    it('should mask email partially in LIGHT mode', () => {
      const input = '邮箱: john.doe@example.com';
      const result = service.sanitize(input, { level: SanitizeLevel.LIGHT });
      expect(result).toBe('邮箱: j***@example.com');
    });

    it('should mask GPA in MODERATE mode', () => {
      const input = '我的GPA是3.85';
      const result = service.sanitize(input, { level: SanitizeLevel.MODERATE });
      expect(result).toContain('*.**');
    });

    it('should preserve GPA in LIGHT mode', () => {
      const input = '我的GPA是3.85';
      const result = service.sanitize(input, { level: SanitizeLevel.LIGHT });
      expect(result).toBe('我的GPA是3.85');
    });

    it('should mask SAT score in MODERATE mode', () => {
      const input = 'SAT: 1520';
      const result = service.sanitize(input, { level: SanitizeLevel.MODERATE });
      expect(result).toBe('SAT: ****');
    });

    it('should mask Chinese phone numbers', () => {
      const input = '电话 13812345678';
      const result = service.sanitize(input, { level: SanitizeLevel.FULL });
      expect(result).toBe('电话 ***********');
    });
  });

  describe('detectSensitive', () => {
    it('should detect SSN', () => {
      const result = service.detectSensitive('SSN: 123-45-6789');
      expect(result.hasSensitive).toBe(true);
      expect(result.types).toContain('SSN');
    });

    it('should detect multiple sensitive types', () => {
      const input = 'Email: test@test.com, GPA: 3.9, SAT: 1500';
      const result = service.detectSensitive(input);
      expect(result.types.length).toBeGreaterThan(1);
    });
  });
});
```

---

## 📅 执行时间线

```
Day 1: 类型定义扩展
├── 扩展 memory/types.ts
├── 新建 memory/prisma-types.ts
└── 代码审查

Day 2: 核心服务修复
├── 修复 persistent-memory.service.ts
├── 修复 memory-manager.service.ts
├── 修复 summarizer.service.ts
└── 修复 user-data.service.ts

Day 3: 其他服务 + 脱敏服务
├── 修复剩余 any 使用
├── 新建 sanitizer.service.ts
└── 单元测试

Day 4: 集成 + 严格模式
├── 集成脱敏到导出
├── 集成脱敏到日志
├── 启用 TypeScript 严格模式
└── 修复编译错误

Day 5: 测试 + 上线
├── 完成单元测试
├── 集成测试
├── 代码审查
└── 合并上线
```

---

## ✅ 验收标准

### P0.1 类型安全

- [ ] `grep ': any' --include='*.ts' | wc -l` 结果为 0
- [ ] `grep 'as any' --include='*.ts' | wc -l` 结果为 0
- [ ] `tsc --noEmit` 无错误
- [ ] ESLint `@typescript-eslint/no-explicit-any` 规则通过

### P0.2 敏感数据脱敏

- [ ] 导出数据中无明文敏感信息
- [ ] 日志中无明文敏感信息
- [ ] 单元测试覆盖率 > 90%
- [ ] 脱敏检测功能正常

---

## 🔗 相关文件

| 类型     | 文件路径                                                         |
| -------- | ---------------------------------------------------------------- |
| 类型定义 | `apps/api/src/modules/ai-agent/memory/types.ts`                  |
| 新增类型 | `apps/api/src/modules/ai-agent/memory/prisma-types.ts`           |
| 脱敏服务 | `apps/api/src/modules/ai-agent/memory/sanitizer.service.ts`      |
| 测试文件 | `apps/api/src/modules/ai-agent/memory/sanitizer.service.spec.ts` |

---

_文档版本: v1.0 | 创建日期: 2026-01-26_
