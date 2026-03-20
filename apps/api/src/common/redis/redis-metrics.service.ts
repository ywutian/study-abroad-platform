import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface CacheMetrics {
  totalHits: number;
  totalMisses: number;
  hitRatio: number;
  avgLatencyMs: number;
  totalOperations: number;
}

@Injectable()
export class RedisMetricsService {
  private totalHits = 0;
  private totalMisses = 0;
  private totalLatencyMs = 0;
  private totalOperations = 0;

  constructor(private readonly redisService: RedisService) {}

  /**
   * Wraps a Redis GET with hit/miss and latency tracking.
   */
  async trackedGet(key: string): Promise<string | null> {
    const start = Date.now();
    try {
      const value = await this.redisService.get(key);
      const latency = Date.now() - start;
      this.totalLatencyMs += latency;
      this.totalOperations++;

      if (value !== null && value !== undefined) {
        this.totalHits++;
      } else {
        this.totalMisses++;
      }

      return value;
    } catch (error) {
      const latency = Date.now() - start;
      this.totalLatencyMs += latency;
      this.totalOperations++;
      this.totalMisses++;
      throw error;
    }
  }

  /**
   * Wraps a Redis SET with latency tracking.
   */
  async trackedSet(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
    const start = Date.now();
    try {
      await this.redisService.set(key, value, ttlSeconds);
    } finally {
      const latency = Date.now() - start;
      this.totalLatencyMs += latency;
      this.totalOperations++;
    }
  }

  /**
   * Returns current cache metrics snapshot.
   */
  getCacheMetrics(): CacheMetrics {
    const total = this.totalHits + this.totalMisses;
    return {
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRatio: total > 0 ? this.totalHits / total : 0,
      avgLatencyMs:
        this.totalOperations > 0
          ? Math.round((this.totalLatencyMs / this.totalOperations) * 100) / 100
          : 0,
      totalOperations: this.totalOperations,
    };
  }

  /**
   * Resets all counters (useful for testing or periodic reset).
   */
  resetMetrics(): void {
    this.totalHits = 0;
    this.totalMisses = 0;
    this.totalLatencyMs = 0;
    this.totalOperations = 0;
  }
}
