/**
 * Embedding 服务 - 语义向量生成
 *
 * Redis 缓存 + 内存LRU降级
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RedisService } from '../../../common/redis/redis.service';

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
  private readonly CACHE_TTL = 86400;

  constructor(
    private redis: RedisService,
    private config: ConfigService,
  ) {
    this.apiKey = this.config.get('OPENAI_API_KEY', '');
    this.baseUrl = this.config.get(
      'OPENAI_BASE_URL',
      'https://api.openai.com/v1',
    );
    this.model = this.config.get('EMBEDDING_MODEL', 'text-embedding-3-small');
  }

  /**
   * 生成文本的向量嵌入
   */
  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) {
      this.logger.warn(
        'OpenAI API key not configured, returning empty embedding',
      );
      return [];
    }

    const cacheKey = this.hashText(text);

    // 尝试从 Redis 获取
    const cached = await this.getCachedEmbedding(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text.slice(0, 8000), // 限制长度
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding || [];

      // 缓存结果
      await this.cacheEmbedding(cacheKey, embedding);

      return embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error);
      return [];
    }
  }

  /**
   * 批量生成向量嵌入
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey || texts.length === 0) {
      return texts.map(() => []);
    }

    // 检查缓存命中
    const cacheKeys = texts.map((t) => this.hashText(t));
    const cachedResults = await Promise.all(
      cacheKeys.map((key) => this.getCachedEmbedding(key)),
    );

    const results: (number[] | null)[] = cachedResults;

    // 找出需要请求的
    const toFetch: { index: number; text: string }[] = [];
    results.forEach((r, i) => {
      if (!r) {
        toFetch.push({ index: i, text: texts[i] });
      }
    });

    if (toFetch.length === 0) {
      return results as number[][];
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: toFetch.map((t) => t.text.slice(0, 8000)),
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        data?: Array<{ embedding: number[] }>;
      };
      const embeddings = data.data?.map((d) => d.embedding) || [];

      // 填充结果并缓存
      await Promise.all(
        embeddings.map(async (emb: number[], i: number) => {
          const { index, text } = toFetch[i];
          results[index] = emb;
          await this.cacheEmbedding(this.hashText(text), emb);
        }),
      );

      return results as number[][];
    } catch (error) {
      this.logger.error('Failed to generate batch embeddings', error);
      return texts.map(() => []);
    }
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
    const client = this.redis.getClient();

    if (client && this.redis.connected) {
      try {
        const raw = await client.get(redisKey);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (err) {
        this.logger.debug(`Redis getCachedEmbedding failed: ${err}`);
      }
    }

    // 降级到内存
    return this.fallbackCache.get(key) || null;
  }

  private async cacheEmbedding(
    key: string,
    embedding: number[],
  ): Promise<void> {
    const redisKey = `emb:${key}`;
    const client = this.redis.getClient();

    if (client && this.redis.connected) {
      try {
        await client.set(
          redisKey,
          JSON.stringify(embedding),
          'EX',
          this.CACHE_TTL,
        );
        return;
      } catch (err) {
        this.logger.debug(`Redis cacheEmbedding failed: ${err}`);
      }
    }

    // 降级到内存
    if (this.fallbackCache.size >= this.maxCacheSize) {
      const firstKey = this.fallbackCache.keys().next().value;
      if (firstKey) {
        this.fallbackCache.delete(firstKey);
      }
    }
    this.fallbackCache.set(key, embedding);
  }

  // ==================== 私有方法 ====================

  private hashText(text: string): string {
    // 使用 SHA256 前16字节，比简单哈希更可靠
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }

  async getCacheStats(): Promise<{
    mode: 'redis' | 'memory';
    fallbackSize: number;
    redisKeyCount?: number;
  }> {
    const client = this.redis.getClient();

    if (client && this.redis.connected) {
      try {
        const keys = await client.keys('emb:*');
        return {
          mode: 'redis',
          fallbackSize: this.fallbackCache.size,
          redisKeyCount: keys.length,
        };
      } catch {
        // fall through
      }
    }

    return {
      mode: 'memory',
      fallbackSize: this.fallbackCache.size,
    };
  }
}
