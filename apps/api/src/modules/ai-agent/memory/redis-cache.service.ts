/**
 * Redis 缓存服务 - 短期记忆存储
 *
 * 使用项目现有的 RedisService，Redis 不可用时降级为内存缓存。
 * 所有 Redis 访问走 `redis.withClient(...)`：它在 Redis 不可用或出错时抛出，
 * 让既有的 try/catch 命中内存降级路径——行为不变，但操作现在会计入
 * cache-health 监控面板（消除 #274 那类隐形配额泄漏的盲区）。
 */

import type { MaybeSerialized } from '../../../common/redis/redis-json.types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/redis/redis.service';
import { MessageRecord, ConversationRecord } from './types';

// 内存降级缓存
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  // 内存降级缓存（Redis 不可用时使用）
  private readonly fallbackCache = new Map<string, CacheEntry<any>>();
  private readonly MAX_FALLBACK_SIZE = 1000;

  // 配置
  private readonly defaultTTL: number; // 秒
  private readonly maxConversationMessages: number;

  constructor(
    private readonly redis: RedisService,
    private config: ConfigService,
  ) {
    this.defaultTTL = this.config.get('MEMORY_CACHE_TTL', 86400); // 24小时
    this.maxConversationMessages = this.config.get(
      'MAX_CONVERSATION_MESSAGES',
      50,
    );

    if (this.redis.connected) {
      this.logger.log('RedisCacheService initialized (Redis connected)');
    } else {
      this.logger.warn(
        'RedisCacheService initialized — Redis unavailable, using in-process Map fallback. ' +
          'Data will NOT be shared across pods.',
      );
    }
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
    const key = `conv:msgs:${conversationId}`;

    try {
      await this.redis.withClient('write', key, async (client) => {
        await client.rpush(key, JSON.stringify(message));
        await client.ltrim(key, -this.maxConversationMessages, -1);
        await client.expire(key, ttl || this.defaultTTL);
      });
      return;
    } catch (err) {
      this.logger.debug(
        `Redis cacheMessage failed, using fallback: ${String(err)}`,
      );
    }

    // 降级到内存
    const messages = this.getFallback<MessageRecord[]>(key) || [];
    messages.push(message);
    const trimmed = messages.slice(-this.maxConversationMessages);
    this.setFallback(key, trimmed, ttl || this.defaultTTL);
  }

  /**
   * 获取对话消息
   */
  async getConversationMessages(
    conversationId: string,
  ): Promise<MessageRecord[]> {
    const key = `conv:msgs:${conversationId}`;

    try {
      const raw = await this.redis.withClient('read', key, (client) =>
        client.lrange(key, 0, -1),
      );
      // Rehydrate rather than widen the signature: callers merge this list
      // with the database path, and the two must hand back the same runtime
      // type. Nothing currently calls a Date method on `createdAt`, so this is
      // closing the shape, not fixing a crash.
      return raw.map((r) => {
        const msg = JSON.parse(r) as MaybeSerialized<MessageRecord>;
        return { ...msg, createdAt: new Date(msg.createdAt) };
      });
    } catch (err) {
      this.logger.debug(`Redis getConversationMessages failed: ${String(err)}`);
    }

    return this.getFallback<MessageRecord[]>(key) || [];
  }

  /**
   * 缓存对话元数据
   */
  async cacheConversation(
    conversationId: string,
    data: Partial<ConversationRecord>,
    ttl?: number,
  ): Promise<void> {
    const key = `conv:meta:${conversationId}`;

    try {
      await this.redis.withClient('write', key, async (client) => {
        const existing = await this.getConversationMeta(conversationId);
        await client.set(
          key,
          JSON.stringify({ ...existing, ...data }),
          'EX',
          ttl || this.defaultTTL,
        );
      });
      return;
    } catch (err) {
      this.logger.debug(`Redis cacheConversation failed: ${String(err)}`);
    }

    const existing = this.getFallback<Partial<ConversationRecord>>(key);
    this.setFallback(key, { ...existing, ...data }, ttl || this.defaultTTL);
  }

  /**
   * 获取对话元数据
   */
  async getConversationMeta(
    conversationId: string,
  ): Promise<Partial<MaybeSerialized<ConversationRecord>> | null> {
    const key = `conv:meta:${conversationId}`;

    try {
      const raw = await this.redis.withClient('read', key, (client) =>
        client.get(key),
      );
      // Reads its own key rather than going through getJSON, so state the
      // round-trip here too: the Dates on ConversationRecord came back strings.
      return raw
        ? (JSON.parse(raw) as Partial<MaybeSerialized<ConversationRecord>>)
        : null;
    } catch (err) {
      this.logger.debug(`Redis getConversationMeta failed: ${String(err)}`);
    }

    return this.getFallback<Partial<ConversationRecord>>(key);
  }

  /**
   * 删除对话缓存
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const msgKey = `conv:msgs:${conversationId}`;
    const metaKey = `conv:meta:${conversationId}`;

    // del no-ops when Redis is down; memory entries are removed regardless.
    await this.redis.del(msgKey);
    await this.redis.del(metaKey);

    this.fallbackCache.delete(msgKey);
    this.fallbackCache.delete(metaKey);
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
    const key = `user:ctx:${userId}`;

    try {
      await this.redis.withClient('write', key, (client) =>
        client.set(key, JSON.stringify(context), 'EX', ttl || this.defaultTTL),
      );
      return;
    } catch (err) {
      this.logger.debug(`Redis cacheUserContext failed: ${String(err)}`);
    }

    this.setFallback(key, context, ttl || this.defaultTTL);
  }

  /**
   * 获取用户上下文
   */
  async getUserContext(
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    const key = `user:ctx:${userId}`;

    try {
      const raw = await this.redis.withClient('read', key, (client) =>
        client.get(key),
      );
      // @cache-parse-allowed - user context is validated as an object boundary
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch (err) {
      this.logger.debug(`Redis getUserContext failed: ${String(err)}`);
    }

    return this.getFallback<Record<string, unknown>>(key);
  }

  /**
   * 更新用户上下文字段
   */
  async updateUserContext(
    userId: string,
    updates: Record<string, any>,
  ): Promise<void> {
    const existing = (await this.getUserContext(userId)) || {};
    await this.cacheUserContext(userId, { ...existing, ...updates });
  }

  /**
   * 删除用户上下文
   */
  async deleteUserContext(userId: string): Promise<void> {
    const key = `user:ctx:${userId}`;

    await this.redis.del(key);

    this.fallbackCache.delete(key);
  }

  // ==================== 活跃会话追踪 ====================

  /**
   * 记录用户活跃会话
   */
  async setActiveConversation(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const key = `user:active:${userId}`;

    try {
      await this.redis.withClient('write', key, (client) =>
        client.set(key, conversationId, 'EX', this.defaultTTL),
      );
      return;
    } catch (err) {
      this.logger.debug(`Redis setActiveConversation failed: ${String(err)}`);
    }

    this.setFallback(key, conversationId, this.defaultTTL);
  }

  /**
   * 获取用户活跃会话
   */
  async getActiveConversation(userId: string): Promise<string | null> {
    const key = `user:active:${userId}`;

    try {
      return await this.redis.withClient('read', key, (client) =>
        client.get(key),
      );
    } catch (err) {
      this.logger.debug(`Redis getActiveConversation failed: ${String(err)}`);
    }

    return this.getFallback<string>(key);
  }

  // ==================== 内存降级方法 ====================

  private setFallback<T>(key: string, data: T, ttlSeconds: number): void {
    if (this.fallbackCache.size >= this.MAX_FALLBACK_SIZE) {
      // 先清过期条目
      const now = Date.now();
      for (const [k, entry] of this.fallbackCache) {
        if (now > entry.expiresAt) this.fallbackCache.delete(k);
      }
      // 仍然超限则淘汰最早插入的 10%
      if (this.fallbackCache.size >= this.MAX_FALLBACK_SIZE) {
        const toDelete = Math.floor(this.MAX_FALLBACK_SIZE * 0.1);
        const keys = this.fallbackCache.keys();
        for (let i = 0; i < toDelete; i++) {
          const k = keys.next().value;
          if (k) this.fallbackCache.delete(k);
        }
      }
    }
    this.fallbackCache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private getFallback<T>(key: string): T | null {
    const entry = this.fallbackCache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.fallbackCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // ==================== 统计 ====================

  async getStats(): Promise<{
    connected: boolean;
    mode: 'redis' | 'memory';
    keyCount?: number;
    fallbackSize: number;
  }> {
    try {
      const keys = await this.redis.withClient('read', 'conv:*', (client) =>
        client.keys('conv:*'),
      );
      return {
        connected: true,
        mode: 'redis',
        keyCount: keys.length,
        fallbackSize: this.fallbackCache.size,
      };
    } catch {
      // fall through
    }

    return {
      connected: false,
      mode: 'memory',
      fallbackSize: this.fallbackCache.size,
    };
  }
}
