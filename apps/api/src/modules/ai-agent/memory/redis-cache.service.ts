/**
 * Redis 缓存服务 - 短期记忆存储
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRecord, ConversationRecord } from './types';

// 简化实现，不依赖 ioredis（可选安装）
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout;
  
  // 配置
  private readonly defaultTTL: number; // 秒
  private readonly maxConversationMessages: number;

  constructor(private config: ConfigService) {
    this.defaultTTL = this.config.get('MEMORY_CACHE_TTL', 86400); // 24小时
    this.maxConversationMessages = this.config.get('MAX_CONVERSATION_MESSAGES', 50);
    
    // 定期清理过期缓存
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    
    this.logger.log('Memory cache service initialized (in-memory mode)');
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  // ==================== 对话缓存 ====================

  /**
   * 缓存对话消息
   */
  async cacheMessage(
    conversationId: string,
    message: MessageRecord,
    ttl?: number,
  ): Promise<void> {
    const key = this.getConversationKey(conversationId);
    const messages = await this.getConversationMessages(conversationId);
    
    messages.push(message);
    
    // 保持最大消息数
    const trimmed = messages.slice(-this.maxConversationMessages);
    
    this.set(key, trimmed, ttl || this.defaultTTL);
  }

  /**
   * 获取对话消息
   */
  async getConversationMessages(conversationId: string): Promise<MessageRecord[]> {
    const key = this.getConversationKey(conversationId);
    return this.get<MessageRecord[]>(key) || [];
  }

  /**
   * 缓存对话元数据
   */
  async cacheConversation(
    conversationId: string,
    data: Partial<ConversationRecord>,
    ttl?: number,
  ): Promise<void> {
    const key = this.getConversationMetaKey(conversationId);
    const existing = await this.getConversationMeta(conversationId);
    
    this.set(key, { ...existing, ...data }, ttl || this.defaultTTL);
  }

  /**
   * 获取对话元数据
   */
  async getConversationMeta(conversationId: string): Promise<Partial<ConversationRecord> | null> {
    const key = this.getConversationMetaKey(conversationId);
    return this.get<Partial<ConversationRecord>>(key);
  }

  /**
   * 删除对话缓存
   */
  async deleteConversation(conversationId: string): Promise<void> {
    this.cache.delete(this.getConversationKey(conversationId));
    this.cache.delete(this.getConversationMetaKey(conversationId));
  }

  // ==================== 用户上下文缓存 ====================

  /**
   * 缓存用户上下文
   */
  async cacheUserContext(
    userId: string,
    context: Record<string, any>,
    ttl?: number,
  ): Promise<void> {
    const key = this.getUserContextKey(userId);
    this.set(key, context, ttl || this.defaultTTL);
  }

  /**
   * 获取用户上下文
   */
  async getUserContext(userId: string): Promise<Record<string, any> | null> {
    const key = this.getUserContextKey(userId);
    return this.get<Record<string, any>>(key);
  }

  /**
   * 更新用户上下文字段
   */
  async updateUserContext(
    userId: string,
    updates: Record<string, any>,
  ): Promise<void> {
    const existing = await this.getUserContext(userId) || {};
    await this.cacheUserContext(userId, { ...existing, ...updates });
  }

  /**
   * 删除用户上下文
   */
  async deleteUserContext(userId: string): Promise<void> {
    this.cache.delete(this.getUserContextKey(userId));
  }

  // ==================== 活跃会话追踪 ====================

  /**
   * 记录用户活跃会话
   */
  async setActiveConversation(userId: string, conversationId: string): Promise<void> {
    const key = this.getActiveConversationKey(userId);
    this.set(key, conversationId, this.defaultTTL);
  }

  /**
   * 获取用户活跃会话
   */
  async getActiveConversation(userId: string): Promise<string | null> {
    const key = this.getActiveConversationKey(userId);
    return this.get<string>(key);
  }

  // ==================== 通用方法 ====================

  private set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  // ==================== Key 生成 ====================

  private getConversationKey(conversationId: string): string {
    return `conv:msgs:${conversationId}`;
  }

  private getConversationMetaKey(conversationId: string): string {
    return `conv:meta:${conversationId}`;
  }

  private getUserContextKey(userId: string): string {
    return `user:ctx:${userId}`;
  }

  private getActiveConversationKey(userId: string): string {
    return `user:active:${userId}`;
  }

  // ==================== 统计 ====================

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}









