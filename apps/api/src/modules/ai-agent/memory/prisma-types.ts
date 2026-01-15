/**
 * Prisma 原始查询结果类型
 *
 * 用于替代 any 类型，提供类型安全的原始 SQL 查询结果处理
 */

import { MemoryType, EntityType } from '@prisma/client';
import { MemoryMetadata, EntityAttributes, EntityRelation } from './types';

// ==================== 原始查询行类型 ====================

/**
 * Memory 表原始查询结果
 */
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
  metadata: MemoryMetadata | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // 仅 vector 搜索返回
  similarity?: number;
}

/**
 * Entity 表原始查询结果
 */
export interface RawEntityRow {
  id: string;
  userId: string;
  type: EntityType;
  name: string;
  description: string | null;
  attributes: EntityAttributes | null;
  relations: EntityRelation[] | null;
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
  // 仅 vector 搜索返回
  similarity?: number;
}

/**
 * AgentMessage 表原始查询结果
 */
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

/**
 * AgentConversation 表原始查询结果
 */
export interface RawConversationRow {
  id: string;
  userId: string;
  title: string | null;
  summary: string | null;
  agentType: string | null;
  metadata: Record<string, unknown> | null;
  isArchived: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== Prisma Where 条件类型 ====================

/**
 * Memory 查询 where 条件
 */
export interface MemoryWhereInput {
  userId?: string;
  type?: MemoryType | { in: MemoryType[] };
  category?: string | { in: string[] } | null;
  importance?: { gte?: number; lte?: number; gt?: number; lt?: number };
  content?: { contains: string; mode?: 'insensitive' | 'default' };
  createdAt?: { gte?: Date; lte?: Date; gt?: Date; lt?: Date };
  expiresAt?: { gt?: Date; lt?: Date } | null;
  accessCount?: { gte?: number; lte?: number };
  OR?: MemoryWhereInput[];
  AND?: MemoryWhereInput[];
  metadata?: {
    path: string[];
    equals?: unknown;
  };
}

/**
 * Entity 查询 where 条件
 */
export interface EntityWhereInput {
  userId?: string;
  type?: EntityType | { in: EntityType[] };
  name?: string | { contains: string; mode?: 'insensitive' | 'default' };
  description?: { contains: string; mode?: 'insensitive' | 'default' } | null;
  createdAt?: { gte?: Date; lte?: Date };
  OR?: EntityWhereInput[];
  AND?: EntityWhereInput[];
}

/**
 * Conversation 查询 where 条件
 */
export interface ConversationWhereInput {
  userId?: string;
  id?: string;
  isArchived?: boolean;
  createdAt?: { gte?: Date; lte?: Date };
}

/**
 * Message 查询 where 条件
 */
export interface MessageWhereInput {
  conversationId?: string;
  role?: string | { in: string[] };
  createdAt?: { gte?: Date; lte?: Date; lt?: Date };
  conversation?: { userId: string };
}

// ==================== 聚合结果类型 ====================

/**
 * Memory 分组统计结果
 */
export interface MemoryGroupByResult {
  type: MemoryType;
  _count: number;
}

/**
 * Memory 聚合结果
 */
export interface MemoryAggregateResult {
  _avg: {
    importance: number | null;
  };
  _count: number;
}

// ==================== 类型守卫函数 ====================

/**
 * 检查是否为有效的 MemoryType
 */
export function isValidMemoryType(value: unknown): value is MemoryType {
  return (
    typeof value === 'string' &&
    ['FACT', 'PREFERENCE', 'DECISION', 'SUMMARY', 'FEEDBACK'].includes(value)
  );
}

/**
 * 检查是否为有效的 EntityType
 */
export function isValidEntityType(value: unknown): value is EntityType {
  return (
    typeof value === 'string' &&
    ['SCHOOL', 'PERSON', 'EVENT', 'TOPIC'].includes(value)
  );
}

/**
 * 安全解析 JSON metadata
 */
export function parseMetadata(raw: unknown): MemoryMetadata | undefined {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  return raw as MemoryMetadata;
}

/**
 * 安全解析 Entity relations
 */
export function parseRelations(raw: unknown): EntityRelation[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw as EntityRelation[];
}
