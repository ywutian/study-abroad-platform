/**
 * 统一记忆系统接口
 * 
 * 定义 Agent 记忆系统的标准接口
 * 支持多种实现: 内存、Redis、PostgreSQL
 */

import { AgentType } from '../../types';

// ==================== 基础类型 ====================

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  agentType?: AgentType;
  toolCallId?: string;
  toolCalls?: ToolCallRecord[];
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
}

export interface Conversation {
  id: string;
  userId: string;
  messages: Message[];
  context: UserContext;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface UserContext {
  profile?: ProfileSnapshot;
  preferences?: UserPreferences;
  recentSchools?: string[];
  recentEssays?: string[];
  lastActivity?: Date;
}

export interface ProfileSnapshot {
  gpa?: number;
  gpaScale?: number;
  targetMajor?: string;
  grade?: string;
  testScores?: Record<string, number>;
  activities?: string[];
  awards?: string[];
}

export interface UserPreferences {
  language: 'zh' | 'en';
  responseStyle: 'concise' | 'detailed';
  focusAreas: string[];
  notificationEnabled: boolean;
}

// ==================== 记忆类型 ====================

export enum MemoryType {
  FACT = 'FACT',           // 事实信息
  PREFERENCE = 'PREFERENCE', // 用户偏好
  DECISION = 'DECISION',   // 决策记录
  SUMMARY = 'SUMMARY',     // 对话摘要
  FEEDBACK = 'FEEDBACK',   // 用户反馈
}

export enum EntityType {
  SCHOOL = 'SCHOOL',       // 学校
  PERSON = 'PERSON',       // 人物
  EVENT = 'EVENT',         // 事件
  TOPIC = 'TOPIC',         // 话题
}

export interface MemoryRecord {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  importance: number;      // 0-1
  embedding?: number[];    // 向量
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface EntityRecord {
  id: string;
  userId: string;
  type: EntityType;
  name: string;
  description?: string;
  relations?: EntityRelation[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EntityRelation {
  targetId: string;
  targetType: EntityType;
  relationType: string;
  metadata?: Record<string, any>;
}

// ==================== 检索上下文 ====================

export interface RetrievalContext {
  recentMessages: Message[];
  relevantMemories: MemoryRecord[];
  userPreferences: UserPreferences;
  conversationSummary?: string;
  entities: EntityRecord[];
}

// ==================== 查询选项 ====================

export interface MemoryQueryOptions {
  types?: MemoryType[];
  minImportance?: number;
  limit?: number;
  includeExpired?: boolean;
  semanticQuery?: string;  // 语义搜索
  timeRange?: {
    from?: Date;
    to?: Date;
  };
}

export interface ConversationQueryOptions {
  limit?: number;
  offset?: number;
  includeMessages?: boolean;
  orderBy?: 'createdAt' | 'updatedAt';
  order?: 'asc' | 'desc';
}

// ==================== 统一接口 ====================

/**
 * 对话记忆接口
 */
export interface IConversationMemory {
  // 对话管理
  getOrCreateConversation(userId: string, conversationId?: string): Promise<Conversation>;
  getConversation(conversationId: string): Promise<Conversation | null>;
  listConversations(userId: string, options?: ConversationQueryOptions): Promise<Conversation[]>;
  deleteConversation(conversationId: string): Promise<void>;
  
  // 消息管理
  addMessage(conversationId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message>;
  getMessages(conversationId: string, limit?: number): Promise<Message[]>;
  getRecentMessages(conversation: Conversation, limit?: number): Message[];
  
  // 上下文
  getContextSummary(context: UserContext): string;
  refreshUserContext(userId: string): Promise<UserContext>;
  
  // 清理
  clearConversation(userId: string, conversationId?: string): void;
}

/**
 * 长期记忆接口
 */
export interface ILongTermMemory {
  // 记忆管理
  remember(userId: string, memory: Omit<MemoryRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryRecord>;
  recall(userId: string, options?: MemoryQueryOptions): Promise<MemoryRecord[]>;
  forget(memoryId: string): Promise<void>;
  updateImportance(memoryId: string, importance: number): Promise<void>;
  
  // 实体管理
  recordEntity(userId: string, entity: Omit<EntityRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<EntityRecord>;
  getEntities(userId: string, options?: { types?: EntityType[]; limit?: number }): Promise<EntityRecord[]>;
  
  // 语义搜索
  semanticSearch(userId: string, query: string, limit?: number): Promise<MemoryRecord[]>;
  
  // 清理
  cleanup(): Promise<{ expiredMemories: number }>;
}

/**
 * 完整记忆系统接口
 */
export interface IMemorySystem extends IConversationMemory, ILongTermMemory {
  // 检索增强
  getRetrievalContext(userId: string, query: string, conversationId?: string): Promise<RetrievalContext>;
  buildContextSummary(context: RetrievalContext): string;
  
  // 偏好
  getPreferences(userId: string): Promise<UserPreferences>;
  updatePreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences>;
  
  // 统计
  getStats(userId: string): Promise<{
    conversationCount: number;
    messageCount: number;
    memoryCount: number;
    entityCount: number;
  }>;
}

/**
 * 记忆系统提供者 Token
 */
export const MEMORY_SYSTEM_TOKEN = Symbol('MEMORY_SYSTEM');







