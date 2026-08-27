/**
 * Embedding 服务 - 语义向量生成
 *
 * Redis 缓存 + 内存LRU降级
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  embeddingCacheKey,
  EMBEDDING_INPUT_LIMIT,
  isEmbeddingVector,
  requestEmbeddings,
} from './embedding-contract';
import { RedisService } from '../../../common/redis/redis.service';
import { REDIS_TTL } from '../../../common/redis/redis-ttl.constants';
import { ResilienceService } from '../core/resilience.service';
import { LLMProviderError } from '../providers/llm-provider.types';

const EMBEDDING_CONFIG = {
  timeoutMs: 15000,
  retryConfig: {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    retryableErrors: [
      '429',
      '500',
      '502',
      '503',
      '504',
      'ECONNRESET',
      'ETIMEDOUT',
    ],
  },
  circuitConfig: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenRequests: 2,
  },
};

/**
 * Service for generating text embedding vectors using the OpenAI Embeddings API.
 *
 * Features:
 * - Two-tier caching: Redis (primary, 24h TTL) with in-memory LRU fallback (500 entries)
 * - Resilience: configurable retry with exponential backoff and circuit breaker
 * - Graceful degradation: returns empty vectors when the API key is missing or calls fail
 * - Default model: `text-embedding-3-small` (1536 dimensions)
 * - Input text is truncated to 8000 characters before embedding
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  // 内存 LRU 缓存（Redis降级用）
  private readonly fallbackCache = new Map<string, number[]>();
  private readonly maxCacheSize = 500;

  // Redis缓存TTL：24小时
  private readonly CACHE_TTL = REDIS_TTL.EMBEDDING_CACHE;

  constructor(
    private redis: RedisService,
    private config: ConfigService,
    @Optional() private resilience?: ResilienceService,
  ) {
    this.apiKey = this.config.get('OPENAI_API_KEY', '');
    this.baseUrl = this.config.get(
      'OPENAI_BASE_URL',
      'https://api.openai.com/v1',
    );
    this.model = this.config.get('EMBEDDING_MODEL', 'text-embedding-3-small');
  }

  /**
   * Wrap an async operation with the resilience layer (retry + circuit breaker + timeout).
   * Falls back to direct execution if the ResilienceService is not injected.
   *
   * @param fn - The async function to execute with resilience protection
   * @returns The result of the function
   * @throws {Error} Propagated from fn after retries are exhausted or circuit is open
   */
  private async executeWithResilience<T>(fn: () => Promise<T>): Promise<T> {
    if (this.resilience) {
      return this.resilience.execute('embedding', fn, {
        retry: EMBEDDING_CONFIG.retryConfig,
        circuit: EMBEDDING_CONFIG.circuitConfig,
        timeoutMs: EMBEDDING_CONFIG.timeoutMs,
      });
    }
    return fn();
  }

  /**
   * Generate an embedding vector for a single text string.
   *
   * Checks the two-tier cache (Redis then in-memory) before calling the API.
   * Text longer than 8000 characters is truncated with a warning.
   * Returns an empty array if the API key is not configured or the API call fails.
   *
   * @param text - The text to embed (max ~8000 chars; longer text is truncated)
   * @returns A numeric vector (typically 1536 dimensions), or empty array on failure
   */
  // 生成文本的向量嵌入
  async embed(text: string): Promise<number[]> {
    return (await this.embedBatch([text]))[0];
  }

  /** Validate the whole response before caching; preserve successful cache hits on failure. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey || texts.length === 0) return texts.map(() => []);
    const inputs = texts.map((text) => text.slice(0, EMBEDDING_INPUT_LIMIT));
    const keys = inputs.map((text) => this.hashText(text));
    const results = await Promise.all(
      inputs.map((text, index) =>
        text.trim()
          ? this.getCachedEmbedding(keys[index])
          : Promise.resolve([]),
      ),
    );
    const pending = inputs
      .map((text, index) => ({ text, index }))
      .filter(({ index }) => results[index] === null);
    if (pending.length === 0) return results.map((value) => value ?? []);
    try {
      const vectors = await this.executeWithResilience(() =>
        requestEmbeddings(
          this.baseUrl,
          this.apiKey,
          this.model,
          pending.map(({ text }) => text),
          EMBEDDING_CONFIG.timeoutMs,
        ),
      );
      await Promise.all(
        pending.map(async ({ index }, offset) => {
          results[index] = vectors[offset];
          await this.cacheEmbedding(keys[index], vectors[offset]);
        }),
      );
    } catch (error) {
      this.logger.warn(
        `embedding_generation_failed: ${error instanceof LLMProviderError ? error.code : 'UNAVAILABLE'}`,
      );
    }
    return results.map((value) => value ?? []);
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * 查找最相似的项
   */
  findMostSimilar<T extends { embedding?: number[] | null }>(
    queryEmbedding: number[],
    items: T[],
    topK: number = 5,
  ): Array<T & { similarity: number }> {
    if (queryEmbedding.length === 0) {
      return items.slice(0, topK).map((item) => ({ ...item, similarity: 0 }));
    }

    const scored = items
      .filter((item) => item.embedding && Array.isArray(item.embedding))
      .map((item) => ({
        ...item,
        similarity: this.cosineSimilarity(
          queryEmbedding,
          item.embedding as number[],
        ),
      }))
      .sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, topK);
  }

  // ==================== 缓存方法 ====================

  private async getCachedEmbedding(key: string): Promise<number[] | null> {
    const redisKey = `emb:${key}`;
    // `get` returns null on a miss OR when Redis is down — both fall through to
    // the in-memory cache below, matching the previous try/catch behavior.
    try {
      const raw = await this.redis.get(redisKey);
      if (raw) {
        // @cache-parse-allowed - validated numeric vector; no Date to lose
        const parsed: unknown = JSON.parse(raw);
        if (isEmbeddingVector(parsed)) return parsed;
      }
    } catch {
      this.logger.debug('embedding_cache_read_failed');
    }

    // 降级到内存
    const cached = this.fallbackCache.get(key);
    if (!isEmbeddingVector(cached)) return null;
    this.fallbackCache.delete(key);
    this.fallbackCache.set(key, cached);
    return [...cached];
  }

  private async cacheEmbedding(
    key: string,
    embedding: number[],
  ): Promise<void> {
    const redisKey = `emb:${key}`;

    // withClient throws when Redis is down or errors, so we fall through to the
    // in-memory cache exactly as the previous if/try-catch did — but the write
    // is now metered and visible in the cache-health dashboard.
    try {
      await this.redis.withClient('write', redisKey, (client) =>
        client.set(redisKey, JSON.stringify(embedding), 'EX', this.CACHE_TTL),
      );
      return;
    } catch {
      this.logger.debug('embedding_cache_write_failed');
    }

    // 降级到内存
    if (this.fallbackCache.size >= this.maxCacheSize) {
      const firstKey = this.fallbackCache.keys().next().value;
      if (firstKey) {
        this.fallbackCache.delete(firstKey);
      }
    }
    this.fallbackCache.set(key, [...embedding]);
  }

  // ==================== 私有方法 ====================

  private hashText(text: string): string {
    return embeddingCacheKey(this.baseUrl, this.model, text);
  }

  async getCacheStats(): Promise<{
    mode: 'redis' | 'memory';
    fallbackSize: number;
    redisKeyCount?: number;
  }> {
    try {
      const keys = await this.redis.withClient('read', 'emb:v2:*', (client) =>
        client.keys('emb:v2:*'),
      );
      return {
        mode: 'redis',
        fallbackSize: this.fallbackCache.size,
        redisKeyCount: keys.length,
      };
    } catch {
      // fall through
    }

    return {
      mode: 'memory',
      fallbackSize: this.fallbackCache.size,
    };
  }

  async getServiceStatus(): Promise<{
    isHealthy: boolean;
    circuitState?: string;
    cacheMode: 'redis' | 'memory';
  }> {
    const cacheStats = await this.getCacheStats();
    if (this.resilience) {
      const status = await this.resilience.getCircuitStatus('embedding');
      return {
        isHealthy: !status.isOpen,
        circuitState: status.state,
        cacheMode: cacheStats.mode,
      };
    }
    return { isHealthy: true, cacheMode: cacheStats.mode };
  }
}
