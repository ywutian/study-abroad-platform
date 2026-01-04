/**
 * 内存存储实现
 * 
 * 用于开发环境和单实例部署
 */

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { IStorage, IStorageTransaction } from './storage.interface';

interface CacheEntry<T = any> {
  value: T;
  expiresAt?: number;
}

@Injectable()
export class MemoryStorage implements IStorage, OnModuleDestroy {
  private readonly logger = new Logger(MemoryStorage.name);
  
  private store: Map<string, CacheEntry> = new Map();
  private lists: Map<string, string[]> = new Map();
  private hashes: Map<string, Map<string, string>> = new Map();
  private sortedSets: Map<string, Map<string, number>> = new Map();
  
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxSize: number;

  constructor(maxSize: number = 100000, cleanupIntervalMs: number = 60000) {
    this.maxSize = maxSize;
    this.startCleanup(cleanupIntervalMs);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  // ==================== Key-Value ====================

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.evictIfNeeded();
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.lists.delete(key);
    this.hashes.delete(key);
    this.sortedSets.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(k => this.get<T>(k)));
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void> {
    for (const { key, value, ttlMs } of entries) {
      await this.set(key, value, ttlMs);
    }
  }

  async incr(key: string, delta: number = 1): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + delta;
    await this.set(key, newValue);
    return newValue;
  }

  async decr(key: string, delta: number = 1): Promise<number> {
    return this.incr(key, -delta);
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + ttlMs;
    }
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (!entry.expiresAt) return -1;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : -2;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Array.from(this.store.keys()).filter(k => regex.test(k));
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const keysToDelete = await this.keys(pattern);
    keysToDelete.forEach(k => this.store.delete(k));
    return keysToDelete.length;
  }

  // ==================== List ====================

  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = this.lists.get(key) || [];
    list.unshift(...values);
    this.lists.set(key, list);
    return list.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    const list = this.lists.get(key) || [];
    list.push(...values);
    this.lists.set(key, list);
    return list.length;
  }

  async lpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    return list?.shift() || null;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.lists.get(key);
    return list?.pop() || null;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) || [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, end);
  }

  async llen(key: string): Promise<number> {
    return this.lists.get(key)?.length || 0;
  }

  async ltrim(key: string, start: number, stop: number): Promise<void> {
    const list = this.lists.get(key);
    if (list) {
      const end = stop < 0 ? list.length + stop + 1 : stop + 1;
      this.lists.set(key, list.slice(start, end));
    }
  }

  // ==================== Hash ====================

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) || null;
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    this.hashes.get(key)!.set(field, value);
  }

  async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    const hash = this.hashes.get(key);
    return fields.map(f => hash?.get(f) || null);
  }

  async hmset(key: string, data: Record<string, string>): Promise<void> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key)!;
    Object.entries(data).forEach(([k, v]) => hash.set(k, v));
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) return 0;
    let count = 0;
    fields.forEach(f => {
      if (hash.delete(f)) count++;
    });
    return count;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  async hincrby(key: string, field: string, delta: number): Promise<number> {
    const current = parseInt(await this.hget(key, field) || '0', 10);
    const newValue = current + delta;
    await this.hset(key, field, String(newValue));
    return newValue;
  }

  // ==================== Sorted Set ====================

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map());
    }
    const isNew = !this.sortedSets.get(key)!.has(member);
    this.sortedSets.get(key)!.set(member, score);
    return isNew ? 1 : 0;
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) return [];
    const sorted = Array.from(set.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
    const end = stop < 0 ? sorted.length + stop + 1 : stop + 1;
    return sorted.slice(start, end);
  }

  async zrangebyscore(key: string, min: number, max: number): Promise<string[]> {
    const set = this.sortedSets.get(key);
    if (!set) return [];
    return Array.from(set.entries())
      .filter(([, score]) => score >= min && score <= max)
      .sort((a, b) => a[1] - b[1])
      .map(([member]) => member);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const set = this.sortedSets.get(key);
    if (!set) return 0;
    let count = 0;
    members.forEach(m => {
      if (set.delete(m)) count++;
    });
    return count;
  }

  async zscore(key: string, member: string): Promise<number | null> {
    return this.sortedSets.get(key)?.get(member) ?? null;
  }

  async zcard(key: string): Promise<number> {
    return this.sortedSets.get(key)?.size || 0;
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const set = this.sortedSets.get(key);
    if (!set) return 0;
    const toRemove = Array.from(set.entries())
      .filter(([, score]) => score >= min && score <= max)
      .map(([member]) => member);
    toRemove.forEach(m => set.delete(m));
    return toRemove.length;
  }

  // ==================== Connection ====================

  async ping(): Promise<boolean> {
    return true;
  }

  async connect(): Promise<void> {
    this.logger.log('MemoryStorage connected');
  }

  async disconnect(): Promise<void> {
    this.store.clear();
    this.lists.clear();
    this.hashes.clear();
    this.sortedSets.clear();
    this.logger.log('MemoryStorage disconnected');
  }

  // ==================== Private ====================

  private startCleanup(intervalMs: number) {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [key, entry] of this.store.entries()) {
        if (entry.expiresAt && now > entry.expiresAt) {
          this.store.delete(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        this.logger.debug(`Cleaned ${cleaned} expired entries`);
      }
    }, intervalMs);
  }

  private evictIfNeeded() {
    if (this.store.size >= this.maxSize) {
      // LRU-like: 删除最早的 10%
      const toDelete = Math.ceil(this.maxSize * 0.1);
      const keys = Array.from(this.store.keys()).slice(0, toDelete);
      keys.forEach(k => this.store.delete(k));
      this.logger.warn(`Evicted ${toDelete} entries due to size limit`);
    }
  }

  // ==================== Stats ====================

  getStats() {
    return {
      kvSize: this.store.size,
      listsSize: this.lists.size,
      hashesSize: this.hashes.size,
      sortedSetsSize: this.sortedSets.size,
    };
  }
}


