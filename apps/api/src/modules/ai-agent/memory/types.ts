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
  metadata?: Record<string, any>;
  expiresAt?: Date;
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
  metadata?: Record<string, any>;
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

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

// ==================== 实体相关 ====================

export interface EntityInput {
  type: EntityType;
  name: string;
  description?: string;
  attributes?: Record<string, any>;
  relations?: EntityRelation[];
}

export interface EntityRecord {
  id: string;
  userId: string;
  type: EntityType;
  name: string;
  description?: string;
  attributes?: Record<string, any>;
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









