import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

type RedisClient = Redis;

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClient | null = null;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const redisHost = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const redisPort = this.configService.get<number>('REDIS_PORT') || 6379;
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    try {
      if (redisUrl) {
        this.client = new Redis(redisUrl);
      } else {
        this.client = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
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
      this.logger.warn('Redis not available, running without cache');
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

  // 健康检查
  async healthCheck(): Promise<{ status: 'ok' | 'error'; latencyMs?: number; message?: string }> {
    if (!this.client || !this.isConnected) {
      return { status: 'error', message: 'Redis not connected' };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latencyMs = Date.now() - start;
      return { status: 'ok', latencyMs };
    } catch (error) {
      return { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Ping failed' 
      };
    }
  }

  // 基本操作
  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;
    return (await this.client.exists(key)) === 1;
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
}

