/**
 * Redis 存储实现
 *
 * 用于生产环境和多实例部署
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorage } from './storage.interface';

// Redis client type (使用 ioredis)
type RedisClient = any;

@Injectable()
export class RedisStorage implements IStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisStorage.name);
  private client: RedisClient | null = null;
  private readonly keyPrefix: string;

  constructor(private configService: ConfigService) {
    this.keyPrefix = configService.get('REDIS_KEY_PREFIX', 'agent:');
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  // ==================== Connection ====================

  async connect(): Promise<void> {
    if (this.client) return;

    try {
      // 动态导入 ioredis
      const ioredis = await import('ioredis');
      const Redis = ioredis.default as any;

      this.client = new Redis({
        host: this.configService.get('REDIS_HOST', 'localhost'),
        port: this.configService.get('REDIS_PORT', 6379),
        password: this.configService.get('REDIS_PASSWORD'),
        db: this.configService.get('REDIS_DB', 0),
        keyPrefix: this.keyPrefix,
        retryStrategy: (times: number) => {
          if (times > 3) {
            this.logger.error('Redis connection failed after 3 retries');
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on('error', (err: Error) => {
        this.logger.error('Redis error:', err.message);
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connected');
      });

      await this.ping();
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.logger.log('Redis disconnected');
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  private ensureConnected() {
    if (!this.client) {
      throw new Error('Redis not connected. Call connect() first.');
    }
    return this.client;
  }

  // ==================== Key-Value ====================

  async get<T>(key: string): Promise<T | null> {
    const client = this.ensureConnected();
    const value = await client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const client = this.ensureConnected();
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlMs) {
      await client.set(key, serialized, 'PX', ttlMs);
    } else {
      await client.set(key, serialized);
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.ensureConnected();
    await client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const client = this.ensureConnected();
    return (await client.exists(key)) === 1;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const client = this.ensureConnected();
    const values = await client.mget(...keys);
    return values.map((v: string | null) => {
      if (!v) return null;
      try {
        return JSON.parse(v) as T;
      } catch {
        return v as unknown as T;
      }
    });
  }

  async mset<T>(
    entries: Array<{ key: string; value: T; ttlMs?: number }>,
  ): Promise<void> {
    const client = this.ensureConnected();
    const pipeline = client.pipeline();

    for (const { key, value, ttlMs } of entries) {
      const serialized =
        typeof value === 'string' ? value : JSON.stringify(value);
      if (ttlMs) {
        pipeline.set(key, serialized, 'PX', ttlMs);
      } else {
        pipeline.set(key, serialized);
      }
    }

    await pipeline.exec();
  }

  async incr(key: string, delta: number = 1): Promise<number> {
    const client = this.ensureConnected();
    if (delta === 1) {
      return client.incr(key);
    }
    return client.incrby(key, delta);
  }

  async decr(key: string, delta: number = 1): Promise<number> {
    const client = this.ensureConnected();
    if (delta === 1) {
      return client.decr(key);
    }
    return client.decrby(key, delta);
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    const client = this.ensureConnected();
    await client.pexpire(key, ttlMs);
  }

  async ttl(key: string): Promise<number> {
    const client = this.ensureConnected();
    const ttl = await client.pttl(key);
    return ttl;
  }

  async keys(pattern: string): Promise<string[]> {
    const client = this.ensureConnected();
    // 注意: 生产环境应使用 SCAN 而非 KEYS
    return client.keys(pattern);
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const client = this.ensureConnected();
    const keys = await this.keys(pattern);
    if (keys.length === 0) return 0;
    return client.del(...keys);
  }

  // ==================== List ====================

  async lpush(key: string, ...values: string[]): Promise<number> {
    const client = this.ensureConnected();
    return client.lpush(key, ...values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    const client = this.ensureConnected();
    return client.rpush(key, ...values);
  }

  async lpop(key: string): Promise<string | null> {
    const client = this.ensureConnected();
    return client.lpop(key);
  }

  async rpop(key: string): Promise<string | null> {
    const client = this.ensureConnected();
    return client.rpop(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const client = this.ensureConnected();
    return client.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    const client = this.ensureConnected();
    return client.llen(key);
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const client = this.ensureConnected();
    await client.ltrim(key, start, stop);
  }

  // ==================== Hash ====================

  async hget(key: string, field: string): Promise<string | null> {
    const client = this.ensureConnected();
    return client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    const client = this.ensureConnected();
    await client.hset(key, field, value);
  }

  async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    const client = this.ensureConnected();
    return client.hmget(key, ...fields);
  }

  async hmset(key: string, data: Record<string, string>): Promise<void> {
    const client = this.ensureConnected();
    await client.hmset(key, data);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const client = this.ensureConnected();
    return client.hdel(key, ...fields);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const client = this.ensureConnected();
    return client.hgetall(key);
  }

  async hincrby(key: string, field: string, delta: number): Promise<number> {
    const client = this.ensureConnected();
    return client.hincrby(key, field, delta);
  }

  // ==================== Sorted Set ====================

  async zadd(key: string, score: number, member: string): Promise<number> {
    const client = this.ensureConnected();
    return client.zadd(key, score, member);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const client = this.ensureConnected();
    return client.zrange(key, start, stop);
  }

  async zrangebyscore(
    key: string,
    min: number,
    max: number,
  ): Promise<string[]> {
    const client = this.ensureConnected();
    return client.zrangebyscore(key, min, max);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const client = this.ensureConnected();
    return client.zrem(key, ...members);
  }

  async zscore(key: string, member: string): Promise<number | null> {
    const client = this.ensureConnected();
    const score = await client.zscore(key, member);
    return score !== null ? parseFloat(score) : null;
  }

  async zcard(key: string): Promise<number> {
    const client = this.ensureConnected();
    return client.zcard(key);
  }

  async zremrangebyscore(
    key: string,
    min: number,
    max: number,
  ): Promise<number> {
    const client = this.ensureConnected();
    return client.zremrangebyscore(key, min, max);
  }
}
