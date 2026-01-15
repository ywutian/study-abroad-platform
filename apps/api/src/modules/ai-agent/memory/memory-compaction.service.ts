/**
 * 记忆压缩服务
 *
 * 企业级记忆优化：
 * 1. 语义去重
 * 2. 时间衰减合并
 * 3. 智能摘要压缩
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';
import { SummarizerService } from './summarizer.service';
import { MemoryType } from '@prisma/client';

// ==================== 类型定义 ====================

export interface CompactionResult {
  userId: string;
  processed: number;
  merged: number;
  summarized: number;
  deleted: number;
  tokensSaved: number;
  durationMs: number;
}

export interface CompactionConfig {
  // 相似度阈值（用于去重）
  similarityThreshold: number;
  // 最小压缩间隔（小时）
  minCompactionInterval: number;
  // 每批次处理数量
  batchSize: number;
  // 最大记忆数量（触发压缩）
  maxMemoryCount: number;
  // 最大 Token 数量（触发压缩）
  maxTokenCount: number;
}

interface MemoryWithEmbedding {
  id: string;
  userId: string;
  type: MemoryType;
  category: string | null;
  content: string;
  importance: number;
  accessCount: number;
  embedding: number[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== 默认配置 ====================

const DEFAULT_CONFIG: CompactionConfig = {
  similarityThreshold: 0.92,
  minCompactionInterval: 24,
  batchSize: 100,
  maxMemoryCount: 500,
  maxTokenCount: 50000,
};

// ==================== 服务实现 ====================

@Injectable()
export class MemoryCompactionService {
  private readonly logger = new Logger(MemoryCompactionService.name);
  private readonly config: CompactionConfig;

  // 运行状态
  private isRunning = false;
  private lastRunTime: Map<string, Date> = new Map();

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    private summarizerService: SummarizerService,
  ) {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * 定时压缩任务（每天凌晨 4 点）
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduledCompaction() {
    if (this.isRunning) {
      this.logger.warn('Compaction already running, skipping');
      return;
    }

    this.isRunning = true;
    try {
      await this.compactAll();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 压缩所有用户的记忆
   */
  async compactAll(): Promise<CompactionResult[]> {
    const results: CompactionResult[] = [];

    // 获取需要压缩的用户
    const users = await this.getUsersNeedingCompaction();

    for (const userId of users) {
      try {
        const result = await this.compactUserMemory(userId);
        results.push(result);
      } catch (err) {
        this.logger.error(`Failed to compact memory for user ${userId}`, err);
      }
    }

    this.logger.log(`Compaction completed for ${results.length} users`);
    return results;
  }

  /**
   * 压缩单个用户的记忆
   */
  async compactUserMemory(
    userId: string,
    options?: Partial<CompactionConfig>,
  ): Promise<CompactionResult> {
    const startTime = Date.now();
    const config = { ...this.config, ...options };

    // 检查是否需要压缩
    const lastRun = this.lastRunTime.get(userId);
    if (
      lastRun &&
      Date.now() - lastRun.getTime() < config.minCompactionInterval * 3600000
    ) {
      return {
        userId,
        processed: 0,
        merged: 0,
        summarized: 0,
        deleted: 0,
        tokensSaved: 0,
        durationMs: 0,
      };
    }

    let processed = 0;
    let merged = 0;
    let summarized = 0;
    let deleted = 0;
    let tokensSaved = 0;

    // 1. 语义去重
    const dedupeResult = await this.deduplicateMemories(userId, config);
    merged += dedupeResult.merged;
    tokensSaved += dedupeResult.tokensSaved;

    // 2. 合并相似记忆
    const mergeResult = await this.mergeSimilarMemories(userId, config);
    merged += mergeResult.merged;
    tokensSaved += mergeResult.tokensSaved;
    processed += mergeResult.processed;

    // 3. 摘要压缩（针对老旧记忆）
    const summaryResult = await this.summarizeOldMemories(userId, config);
    summarized += summaryResult.summarized;
    tokensSaved += summaryResult.tokensSaved;
    deleted += summaryResult.deleted;

    // 更新最后运行时间
    this.lastRunTime.set(userId, new Date());

    // 记录压缩日志
    await this.recordCompaction(userId, {
      processed,
      merged,
      summarized,
      deleted,
      tokensSaved,
    });

    return {
      userId,
      processed,
      merged,
      summarized,
      deleted,
      tokensSaved,
      durationMs: Date.now() - startTime,
    };
  }

  // ==================== 压缩策略 ====================

  /**
   * 语义去重
   */
  private async deduplicateMemories(
    userId: string,
    config: CompactionConfig,
  ): Promise<{ merged: number; tokensSaved: number }> {
    let merged = 0;
    let tokensSaved = 0;

    // 获取用户记忆（按类型分组）
    const memories = await this.prisma.$queryRaw<MemoryWithEmbedding[]>`
      SELECT id, "userId", type, category, content, importance, "accessCount",
             embedding::text as embedding, metadata, "createdAt", "updatedAt"
      FROM "Memory"
      WHERE "userId" = ${userId}
      ORDER BY type, "createdAt" DESC
    `;

    // 按类型分组处理
    const byType = new Map<MemoryType, MemoryWithEmbedding[]>();
    for (const memory of memories) {
      const list = byType.get(memory.type) || [];
      // 解析 embedding
      if (memory.embedding) {
        try {
          memory.embedding = JSON.parse(memory.embedding as unknown as string);
        } catch {
          memory.embedding = null;
        }
      }
      list.push(memory);
      byType.set(memory.type, list);
    }

    // 对每种类型进行去重
    for (const [_type, typeMemories] of byType) {
      if (typeMemories.length < 2) continue;

      const toDelete: string[] = [];
      const processed = new Set<string>();

      for (let i = 0; i < typeMemories.length; i++) {
        if (processed.has(typeMemories[i].id)) continue;

        for (let j = i + 1; j < typeMemories.length; j++) {
          if (processed.has(typeMemories[j].id)) continue;

          const similarity = await this.calculateSimilarity(
            typeMemories[i],
            typeMemories[j],
          );

          if (similarity >= config.similarityThreshold) {
            // 保留更重要或更新的记忆
            const keep = this.selectMemoryToKeep(
              typeMemories[i],
              typeMemories[j],
            );
            const remove =
              keep === typeMemories[i] ? typeMemories[j] : typeMemories[i];

            toDelete.push(remove.id);
            processed.add(remove.id);
            tokensSaved += this.estimateTokens(remove.content);
            merged++;
          }
        }
      }

      // 批量删除重复记忆
      if (toDelete.length > 0) {
        await this.prisma.$executeRaw`
          DELETE FROM "Memory" WHERE id = ANY(${toDelete}::text[])
        `;
      }
    }

    return { merged, tokensSaved };
  }

  /**
   * 合并相似记忆
   */
  private async mergeSimilarMemories(
    userId: string,
    config: CompactionConfig,
  ): Promise<{ processed: number; merged: number; tokensSaved: number }> {
    let processed = 0;
    let merged = 0;
    let tokensSaved = 0;

    // 获取低重要性、高相似度的记忆进行合并
    const memories = await this.prisma.$queryRaw<MemoryWithEmbedding[]>`
      SELECT id, "userId", type, category, content, importance, "accessCount",
             embedding::text as embedding, metadata, "createdAt", "updatedAt"
      FROM "Memory"
      WHERE "userId" = ${userId}
        AND importance < 0.5
        AND "createdAt" < NOW() - INTERVAL '7 days'
      ORDER BY type, category, "createdAt"
      LIMIT ${config.batchSize}
    `;

    if (memories.length < 2) return { processed: 0, merged: 0, tokensSaved: 0 };

    // 解析 embeddings
    for (const memory of memories) {
      if (memory.embedding) {
        try {
          memory.embedding = JSON.parse(memory.embedding as unknown as string);
        } catch {
          memory.embedding = null;
        }
      }
    }

    // 按 category 分组合并
    const byCategory = new Map<string, MemoryWithEmbedding[]>();
    for (const memory of memories) {
      const key = `${memory.type}:${memory.category || 'default'}`;
      const list = byCategory.get(key) || [];
      list.push(memory);
      byCategory.set(key, list);
    }

    for (const [_category, categoryMemories] of byCategory) {
      if (categoryMemories.length < 3) continue;

      // 合并为一条摘要记忆
      const contents = categoryMemories.map((m) => m.content);
      const mergedContent =
        await this.summarizerService.summarizeTexts(contents);

      const originalTokens = contents.reduce(
        (sum, c) => sum + this.estimateTokens(c),
        0,
      );
      const newTokens = this.estimateTokens(mergedContent);

      if (newTokens < originalTokens * 0.7) {
        // 创建合并后的记忆
        const sourceIds = categoryMemories.map((m) => m.id);
        const avgImportance =
          categoryMemories.reduce((sum, m) => sum + m.importance, 0) /
          categoryMemories.length;

        await this.prisma.$executeRaw`
          INSERT INTO "Memory" (
            id, "userId", type, category, content, importance, 
            "accessCount", metadata, "createdAt", "updatedAt"
          ) VALUES (
            ${`mem_merged_${Date.now()}`},
            ${userId},
            ${categoryMemories[0].type},
            ${categoryMemories[0].category},
            ${mergedContent},
            ${Math.min(avgImportance + 0.1, 1)},
            0,
            ${JSON.stringify({ merged: true, sourceIds })}::jsonb,
            NOW(),
            NOW()
          )
        `;

        // 删除原始记忆
        await this.prisma.$executeRaw`
          DELETE FROM "Memory" WHERE id = ANY(${sourceIds}::text[])
        `;

        processed += categoryMemories.length;
        merged++;
        tokensSaved += originalTokens - newTokens;

        // 记录压缩历史
        await this.prisma.$executeRaw`
          INSERT INTO "MemoryCompaction" (
            id, "userId", "sourceMemoryIds", "compactedMemoryId",
            "compressionType", "originalTokens", "compactedTokens",
            "compressionRatio", "createdAt"
          ) VALUES (
            ${`compact_${Date.now()}`},
            ${userId},
            ${sourceIds},
            ${`mem_merged_${Date.now()}`},
            'MERGE',
            ${originalTokens},
            ${newTokens},
            ${(1 - newTokens / originalTokens) * 100},
            NOW()
          )
        `;
      }
    }

    return { processed, merged, tokensSaved };
  }

  /**
   * 摘要压缩老旧记忆
   */
  private async summarizeOldMemories(
    userId: string,
    config: CompactionConfig,
  ): Promise<{ summarized: number; deleted: number; tokensSaved: number }> {
    let summarized = 0;
    let deleted = 0;
    let tokensSaved = 0;

    // 获取超过 30 天的低重要性记忆
    const oldMemories = await this.prisma.$queryRaw<MemoryWithEmbedding[]>`
      SELECT id, content, importance, "accessCount"
      FROM "Memory"
      WHERE "userId" = ${userId}
        AND importance < 0.3
        AND "accessCount" < 3
        AND "createdAt" < NOW() - INTERVAL '30 days'
      LIMIT ${config.batchSize}
    `;

    for (const memory of oldMemories) {
      const originalTokens = this.estimateTokens(memory.content);

      if (originalTokens > 100) {
        // 压缩长内容
        const summary = await this.summarizerService.summarizeText(
          memory.content,
          50,
        );
        const newTokens = this.estimateTokens(summary);

        if (newTokens < originalTokens * 0.5) {
          await this.prisma.$executeRaw`
            UPDATE "Memory"
            SET content = ${summary},
                metadata = jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{summarized}',
                  'true'
                ),
                "updatedAt" = NOW()
            WHERE id = ${memory.id}
          `;
          summarized++;
          tokensSaved += originalTokens - newTokens;
        }
      } else if (memory.importance < 0.1 && memory.accessCount === 0) {
        // 删除极低价值记忆
        await this.prisma.$executeRaw`
          DELETE FROM "Memory" WHERE id = ${memory.id}
        `;
        deleted++;
        tokensSaved += originalTokens;
      }
    }

    return { summarized, deleted, tokensSaved };
  }

  // ==================== 辅助方法 ====================

  private async getUsersNeedingCompaction(): Promise<string[]> {
    const result = await this.prisma.$queryRaw<
      Array<{ userId: string; count: bigint }>
    >`
      SELECT "userId", COUNT(*) as count
      FROM "Memory"
      GROUP BY "userId"
      HAVING COUNT(*) > ${this.config.maxMemoryCount}
      ORDER BY count DESC
      LIMIT 100
    `;

    return result.map((r) => r.userId);
  }

  private async calculateSimilarity(
    m1: MemoryWithEmbedding,
    m2: MemoryWithEmbedding,
  ): Promise<number> {
    // 如果有 embedding，使用余弦相似度
    if (m1.embedding && m2.embedding) {
      return this.cosineSimilarity(m1.embedding, m2.embedding);
    }

    // 否则使用简单的文本相似度
    return this.textSimilarity(m1.content, m2.content);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  private selectMemoryToKeep(
    m1: MemoryWithEmbedding,
    m2: MemoryWithEmbedding,
  ): MemoryWithEmbedding {
    // 优先保留更重要的
    if (Math.abs(m1.importance - m2.importance) > 0.1) {
      return m1.importance > m2.importance ? m1 : m2;
    }

    // 其次保留访问次数更多的
    if (m1.accessCount !== m2.accessCount) {
      return m1.accessCount > m2.accessCount ? m1 : m2;
    }

    // 最后保留更新的
    return m1.updatedAt > m2.updatedAt ? m1 : m2;
  }

  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  private async recordCompaction(
    userId: string,
    stats: {
      processed: number;
      merged: number;
      summarized: number;
      deleted: number;
      tokensSaved: number;
    },
  ): Promise<void> {
    this.logger.log(`Memory compaction for ${userId}`, stats);
  }
}
