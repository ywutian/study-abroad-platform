/**
 * 语义路由服务 - 基于 Embedding 相似度的 Agent 路由
 *
 * 利用现有 EmbeddingService（memory/embedding.service.ts）和 pgvector
 * 将用户查询与预计算的示例查询进行语义匹配。
 *
 * 架构：
 * - 每个 AgentType 有 20-30 条示例查询的 embedding（存储在 agent_route_embeddings 表）
 * - 查询时计算用户输入 embedding，在 pgvector 中做 cosine 相似度搜索
 * - 阈值 0.82 以上直接路由，低于走 LLM
 *
 * 灰度策略：
 * - SHADOW 模式：计算结果但不决策，与 LLM 结果对比统计准确率
 * - ACTIVE 模式：达到 >90% 一致率后切换为决策模式
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from '../memory/embedding.service';
import { AgentType } from '../types';

export interface EmbeddingRoutingResult {
  agent: AgentType | null;
  confidence: number;
  shouldUseLLM: boolean;
  /** Diagnostics: top matches by agent type */
  topMatches?: Array<{ agentType: string; similarity: number }>;
}

interface RawSimilarityRow {
  agent_type: string;
  similarity: number;
}

/** Confidence threshold: route directly if the best match exceeds this value. */
const CONFIDENCE_THRESHOLD = 0.82;

/** Maximum number of nearest neighbors to fetch from pgvector. */
const TOP_K = 5;

@Injectable()
export class EmbeddingRouterService {
  private readonly logger = new Logger(EmbeddingRouterService.name);

  /** SHADOW = log-only (compare with LLM), ACTIVE = make routing decisions */
  private readonly mode: 'shadow' | 'active';

  constructor(
    private prisma: PrismaService,
    @Optional() private embeddingService?: EmbeddingService,
    @Optional() private configService?: ConfigService,
  ) {
    this.mode =
      (this.configService?.get<string>('EMBEDDING_ROUTER_MODE') as
        | 'shadow'
        | 'active') || 'shadow';
    this.logger.log(`EmbeddingRouter initialized in ${this.mode} mode`);
  }

  /**
   * Route a user message to the best-matching agent via embedding similarity.
   *
   * Steps:
   * 1. Generate embedding for the user's message
   * 2. Query pgvector for TOP_K nearest neighbors from agent_route_embeddings
   * 3. Aggregate similarity scores by agent type (average of top matches)
   * 4. If best agent exceeds CONFIDENCE_THRESHOLD, route directly
   *
   * In shadow mode, always returns shouldUseLLM=true so the LLM orchestrator
   * still makes the final decision. The result is logged for accuracy analysis.
   */
  async route(message: string): Promise<EmbeddingRoutingResult> {
    if (!this.embeddingService) {
      return { agent: null, confidence: 0, shouldUseLLM: true };
    }

    try {
      // 1. Generate embedding
      const queryEmbedding = await this.embeddingService.embed(message);
      if (queryEmbedding.length === 0) {
        return { agent: null, confidence: 0, shouldUseLLM: true };
      }

      // 2. pgvector nearest-neighbor search
      const vectorStr = `[${queryEmbedding.join(',')}]`;
      const results = await this.prisma.$queryRawUnsafe<RawSimilarityRow[]>(
        `SELECT agent_type, 1 - (embedding <=> $1::vector) as similarity
         FROM agent_route_embeddings
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        vectorStr,
        TOP_K,
      );

      if (!results || results.length === 0) {
        return { agent: null, confidence: 0, shouldUseLLM: true };
      }

      // 3. Aggregate by agent type
      const agentScores = this.aggregateScores(results);
      const best = agentScores[0];

      const routingResult: EmbeddingRoutingResult = {
        agent: best ? (best.agentType as AgentType) : null,
        confidence: best?.avgSimilarity ?? 0,
        shouldUseLLM:
          this.mode === 'shadow' ||
          !best ||
          best.avgSimilarity < CONFIDENCE_THRESHOLD,
        topMatches: agentScores.slice(0, 3).map((s) => ({
          agentType: s.agentType,
          similarity: s.avgSimilarity,
        })),
      };

      this.logger.debug(
        `Embedding route: ${routingResult.agent} (${routingResult.confidence.toFixed(3)}, mode=${this.mode})`,
      );

      return routingResult;
    } catch (error) {
      this.logger.warn(
        `Embedding routing failed, falling back to LLM: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { agent: null, confidence: 0, shouldUseLLM: true };
    }
  }

  /** Aggregate similarity scores: average per agent type, sorted descending. */
  private aggregateScores(
    rows: RawSimilarityRow[],
  ): Array<{ agentType: string; avgSimilarity: number; count: number }> {
    const map = new Map<string, { total: number; count: number }>();

    for (const row of rows) {
      const entry = map.get(row.agent_type) || { total: 0, count: 0 };
      entry.total += row.similarity;
      entry.count += 1;
      map.set(row.agent_type, entry);
    }

    return Array.from(map.entries())
      .map(([agentType, { total, count }]) => ({
        agentType,
        avgSimilarity: total / count,
        count,
      }))
      .sort((a, b) => b.avgSimilarity - a.avgSimilarity);
  }
}
