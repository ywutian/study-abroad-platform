/**
 * 企业级 Agent 记忆系统类型定义
 */

import { MemoryType, EntityType } from '@prisma/client';

// ==================== 记忆相关 ====================

export interface MemoryInput {
  type: MemoryType;
  category?: string;
  content: string;
  importance?: number;
  metadata?: MemoryMetadata;
  expiresAt?: Date;
}

/**
 * 记忆元数据类型（替代 Record<string, any>）
 */
export interface MemoryMetadata {
  // 提取来源
  confidence?: number;
  source?: string;
  conversationId?: string;
  messageId?: string;

  // 去重
  dedupeKey?: string;
  pendingConflict?: boolean;
  conflictWith?: string;

  // 评分
  scoreTier?: string;
  scoreDetails?: {
    importanceScore: number;
    freshnessScore: number;
    confidenceScore: number;
    accessBonus: number;
  };
  score?: number;
  tier?: string;

  // 冲突解决
  previousContent?: string;
  previousValue?: number;
  updatedAt?: string;
  mergedAt?: string;
  mergeCount?: number;

  // 归档
  archived?: boolean;
  archivedAt?: string;

  // 访问
  accessCount?: number;

  // 工具结果提取
  eventId?: string;
  category?: string;
  transient?: boolean;

  // 压缩
  merged?: boolean;
  sourceIds?: string[];
  summarized?: boolean;

  // 规则提取
  rawMatch?: string;
  normalized?: string;

  // 对话统计
  messageCount?: number;

  // 其他
  notes?: string;

  // 各模块扩展字段
  [key: string]: unknown;
}

export interface MemoryRecord {
  id: string;
  userId: string;
  type: MemoryType;
  category?: string;
  content: string;
  importance: number;
  accessCount: number;
  lastAccessedAt?: Date;
  embedding?: number[];
  metadata?: MemoryMetadata;
  createdAt: Date;
}

export interface MemoryQuery {
  types?: MemoryType[];
  categories?: string[];
  minImportance?: number;
  limit?: number;
  timeRange?: {
    start?: Date;
    end?: Date;
  };
}

// ==================== 对话相关 ====================

export interface ConversationRecord {
  id: string;
  userId: string;
  title?: string;
  summary?: string;
  agentType?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageInput {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  agentType?: string;
  toolCalls?: ToolCallRecord[];
  tokensUsed?: number;
  latencyMs?: number;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  agentType?: string;
  toolCalls?: ToolCallRecord[];
  tokensUsed?: number;
  latencyMs?: number;
  createdAt: Date;
}

/**
 * 工具调用结果类型
 */
export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: ToolCallResult;
}

// ==================== 实体相关 ====================

/**
 * 实体属性类型
 */
export interface EntityAttributes {
  interestLevel?: 'low' | 'medium' | 'high';
  addedAt?: string;
  priority?: number;
  notes?: string;
  interest?: string;
  round?: string;
  decision?: boolean;
  category?: string;
  eventId?: string;
  [key: string]: unknown;
}

export interface EntityInput {
  type: EntityType;
  name: string;
  description?: string;
  attributes?: EntityAttributes;
  relations?: EntityRelation[];
}

export interface EntityRecord {
  id: string;
  userId: string;
  type: EntityType;
  name: string;
  description?: string;
  attributes?: EntityAttributes;
  relations?: EntityRelation[];
  createdAt: Date;
}

export interface EntityRelation {
  type: string; // e.g., "interested_in", "applied_to", "mentioned"
  targetId?: string;
  targetName: string;
}

// ==================== 上下文相关 ====================

export interface RetrievalContext {
  // 最近对话
  recentMessages: MessageRecord[];

  // 相关记忆
  relevantMemories: MemoryRecord[];

  // 用户偏好
  preferences: UserPreferences;

  // 相关实体
  entities: EntityRecord[];

  // 元数据
  meta: {
    conversationId?: string;
    messageCount: number;
    memoryCount: number;
  };
}

export interface UserPreferences {
  communicationStyle: 'friendly' | 'professional' | 'casual';
  responseLength: 'brief' | 'moderate' | 'detailed';
  language: string;
  schoolPreferences?: {
    regions?: string[];
    size?: string[];
    type?: string[];
  };
  essayPreferences?: {
    style?: string;
    tone?: string;
  };
  enableMemory: boolean;
  enableSuggestions: boolean;
}

// ==================== 摘要相关 ====================

export interface ConversationSummary {
  summary: string;
  keyTopics: string[];
  decisions: string[];
  nextSteps: string[];
  extractedFacts: MemoryInput[];
  extractedEntities: EntityInput[];
}

// ==================== 检索选项 ====================

export interface RecallOptions {
  query?: string;
  types?: MemoryType[];
  categories?: string[];
  limit?: number;
  minImportance?: number;
  useSemanticSearch?: boolean;
  includeConversations?: boolean;
}

// ==================== 统计 ====================

export interface MemoryStats {
  totalMemories: number;
  totalConversations: number;
  totalMessages: number;
  totalEntities: number;
  memoryByType: Record<string, number>;
  recentActivity: {
    conversationsLast7Days: number;
    messagesLast7Days: number;
  };
}

// ==================== LLM 解析类型 ====================

/**
 * LLM 提取的记忆结构
 */
export interface LLMParsedMemory {
  type: string;
  category?: string;
  content: string;
  importance?: number;
}

/**
 * LLM 提取的实体结构
 */
export interface LLMParsedEntity {
  type: string;
  name: string;
  description?: string;
}

/**
 * LLM 提取结果
 */
export interface LLMExtractionResult {
  memories: LLMParsedMemory[];
  entities: LLMParsedEntity[];
}

/**
 * LLM 摘要结果
 */
export interface LLMSummaryResult {
  summary: string;
  keyTopics: string[];
  decisions: string[];
  nextSteps: string[];
  facts: LLMParsedMemory[];
  entities: LLMParsedEntity[];
}

// ==================== 增强统计类型 ====================

/**
 * 记忆层级
 */
export enum MemoryTier {
  WORKING = 'WORKING',
  SHORT = 'SHORT',
  LONG = 'LONG',
  ARCHIVE = 'ARCHIVE',
}

/**
 * 衰减统计
 */
export interface DecayStats {
  totalMemories: number;
  byTier: Record<MemoryTier, number>;
  averageImportance: number;
  averageFreshness: number;
  scheduledForArchive: number;
  scheduledForDelete: number;
}

/**
 * 评分统计
 */
export interface ScoringStats {
  averageScore: number;
  tierDistribution: Record<MemoryTier, number>;
}

/**
 * 增强记忆统计（含衰减和评分）
 */
export interface EnhancedMemoryStats extends MemoryStats {
  decay?: DecayStats;
  scoring?: ScoringStats;
}

/**
 * 衰减结果
 */
export interface DecayResult {
  processed: number;
  decayed: number;
  archived: number;
  deleted: number;
  boosted: number;
  errors: number;
  durationMs: number;
}

// ==================== Embedding API 类型 ====================

/**
 * Embedding API 响应
 */
export interface EmbeddingAPIResponse {
  data: Array<{ embedding: number[] }>;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}
