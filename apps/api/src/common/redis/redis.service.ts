import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisMetricsCollector, RedisOpKind } from './redis-metrics.service';

type RedisClient = Redis;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClient | null = null;
  private isConnected = false;

  constructor(
    private configService: ConfigService,
    private readonly metrics: RedisMetricsCollector,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost =
      this.configService.get<string>('REDIS_HOST') || 'localhost';
    const redisPort = this.configService.get<number>('REDIS_PORT') || 6379;
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    const commandTimeoutMs =
      this.configService.get<number>('REDIS_COMMAND_TIMEOUT_MS') ?? 5000;

    try {
      if (redisUrl) {
        this.client = new Redis(redisUrl, { commandTimeout: commandTimeoutMs });
      } else {
        this.client = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          commandTimeout: commandTimeoutMs,
          retryStrategy: (times: number) => {
            if (times > 3) {
              this.logger.warn('Redis connection failed after 3 retries');
              return null;
            }
            return Math.min(times * 200, 2000);
          },
        });
      }

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis connected');
      });

      this.client.on('error', (err: Error) => {
        this.isConnected = false;
        this.logger.warn(`Redis error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.log('Redis disconnected');
      });

      // 测试连接
      await this.client.ping();
      this.isConnected = true;
    } catch (error) {
      const isProduction =
        this.configService.get<string>('NODE_ENV') === 'production';
      if (isProduction) {
        this.logger.error(
          'Redis connection failed in production — cache and rate limiting degraded',
          error instanceof Error ? error.message : error,
        );
      } else {
        this.logger.warn('Redis not available, running without cache');
      }
      this.client = null;
      this.isConnected = false;
    }
  }

  private async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Time + record one Redis operation. The driver call is delegated to
   * `fn`; we capture latency, success/failure, and (for reads) hit/miss.
   *
   * `hit` is computed by `hitFromResult` if provided. Errors are
   * re-thrown so callers retain their existing semantics — metrics
   * collection is purely passive.
   */
  private async record<T>(
    op: RedisOpKind,
    key: string,
    fn: () => Promise<T>,
    hitFromResult?: (value: T) => boolean,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const latencyMs = Date.now() - start;
      this.metrics.record({
        op,
        key,
        latencyMs,
        hit: hitFromResult ? hitFromResult(result) : undefined,
      });
      return result;
    } catch (error) {
      const latencyMs = Date.now() - start;
      this.metrics.record({ op, key, latencyMs, error });
      throw error;
    }
  }

  // 健康检查
  async healthCheck(): Promise<{
    status: 'ok' | 'error';
    latencyMs?: number;
    message?: string;
  }> {
    if (!this.client || !this.isConnected) {
      return { status: 'error', message: 'Redis not connected' };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latencyMs = Date.now() - start;
      this.metrics.record({ op: 'admin', key: 'PING', latencyMs });
      return { status: 'ok', latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - 0; // not tracked precisely; healthCheck is best-effort
      this.metrics.record({ op: 'admin', key: 'PING', latencyMs, error });
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Ping failed',
      };
    }
  }

  // 基本操作
  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.record(
      'read',
      key,
      () => this.client!.get(key),
      (v) => v !== null && v !== undefined,
    );
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    await this.record('write', key, async () => {
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await this.client!.set(key, value, 'EX', Math.floor(ttlSeconds));
      } else {
        await this.client!.set(key, value);
      }
    });
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.record('delete', key, () => this.client!.del(key));
  }

  async delByPrefix(prefix: string): Promise<number> {
    if (!this.client) return 0;
    return this.record('delete', `${prefix}*`, async () => {
      let deleted = 0;
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client!.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client!.del(...keys);
          deleted += keys.length;
        }
      } while (cursor !== '0');
      return deleted;
    });
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    return this.record(
      'read',
      key,
      async () => (await this.client!.exists(key)) === 1,
      (v) => v,
    );
  }

  // JSON 操作
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  // 获取连接状态
  get connected(): boolean {
    return this.isConnected;
  }

  // 获取原始客户端（高级用途）
  getClient(): RedisClient | null {
    return this.client;
  }

  // List 操作（用于通知等）
  async lpush(key: string, value: string): Promise<number> {
    if (!this.client) return 0;
    return this.record('write', key, () => this.client!.lpush(key, value));
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.client) return [];
    return this.record(
      'read',
      key,
      () => this.client!.lrange(key, start, stop),
      (arr) => arr.length > 0,
    );
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    if (!this.client) return;
    await this.record('write', key, () => this.client!.ltrim(key, start, stop));
  }

  async lset(key: string, index: number, value: string): Promise<void> {
    if (!this.client) return;
    await this.record('write', key, () => this.client!.lset(key, index, value));
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    if (!this.client) return 0;
    return this.record('delete', key, () =>
      this.client!.lrem(key, count, value),
    );
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.record('atomic', key, () => this.client!.incr(key));
  }

  async decr(key: string): Promise<number> {
    if (!this.client) return 0;
    return this.record('atomic', key, () => this.client!.decr(key));
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    await this.record('write', key, () => this.client!.expire(key, seconds));
  }

  // Set 操作（用于 tag-based 缓存管理）
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.client) return 0;
    return this.record('write', key, () => this.client!.sadd(key, ...members));
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.client) return [];
    return this.record(
      'read',
      key,
      () => this.client!.smembers(key),
      (arr) => arr.length > 0,
    );
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.client) return 0;
    return this.record('delete', key, () => this.client!.srem(key, ...members));
  }

  /**
   * SET if Not eXists — returns true if the key was set, false if it already existed.
   * Used for distributed idempotency locks.
   */
  async setNX(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.client) return true; // no Redis = allow through (degrade gracefully)
    return this.record('atomic', key, async () => {
      const result = await this.client!.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    });
  }
}
