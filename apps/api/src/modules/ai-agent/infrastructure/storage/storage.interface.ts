/**
 * 统一存储抽象层
 * 
 * 支持 Memory / Redis 实现切换
 */

export interface IKeyValueStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  
  // 批量操作
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void>;
  
  // 原子操作
  incr(key: string, delta?: number): Promise<number>;
  decr(key: string, delta?: number): Promise<number>;
  
  // 过期管理
  expire(key: string, ttlMs: number): Promise<void>;
  ttl(key: string): Promise<number>;  // 返回剩余 ms，-1 表示无过期，-2 表示不存在
  
  // 模式匹配
  keys(pattern: string): Promise<string[]>;
  deleteByPattern(pattern: string): Promise<number>;
}

export interface IListStorage {
  lpush(key: string, ...values: string[]): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  lpop(key: string): Promise<string | null>;
  rpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  llen(key: string): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<void>;
}

export interface IHashStorage {
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hmget(key: string, ...fields: string[]): Promise<(string | null)[]>;
  hmset(key: string, data: Record<string, string>): Promise<void>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hincrby(key: string, field: string, delta: number): Promise<number>;
}

export interface ISortedSetStorage {
  zadd(key: string, score: number, member: string): Promise<number>;
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zscore(key: string, member: string): Promise<number | null>;
  zcard(key: string): Promise<number>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
}

/**
 * 完整存储接口
 */
export interface IStorage extends IKeyValueStorage, IListStorage, IHashStorage, ISortedSetStorage {
  // 健康检查
  ping(): Promise<boolean>;
  
  // 连接管理
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // 事务 (可选)
  multi?(): IStorageTransaction;
}

export interface IStorageTransaction {
  get(key: string): this;
  set(key: string, value: any, ttlMs?: number): this;
  incr(key: string): this;
  exec(): Promise<any[]>;
  discard(): void;
}

/**
 * 存储配置
 */
export interface StorageConfig {
  type: 'memory' | 'redis';
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  memory?: {
    maxSize?: number;       // 最大条目数
    cleanupInterval?: number; // 清理间隔 ms
  };
}

/**
 * 存储提供者 Token
 */
export const STORAGE_TOKEN = Symbol('STORAGE');







