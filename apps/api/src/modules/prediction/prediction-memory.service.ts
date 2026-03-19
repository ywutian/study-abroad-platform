import { Injectable, Logger, Optional } from '@nestjs/common';
import { MemoryType, EntityType } from '@prisma/client';
import { MemoryManagerService } from '../ai-agent/memory';
import { PredictionResultDto } from './dto';

const MODEL_VERSION = 'v3-enterprise';

/**
 * Memory system integration for prediction context and recording.
 *
 * Reads user memory for prediction context (past predictions, preferences, insights)
 * and writes prediction results back to the memory system for context-aware future
 * predictions and cross-module knowledge sharing.
 */
@Injectable()
export class PredictionMemoryService {
  private readonly logger = new Logger(PredictionMemoryService.name);

  constructor(
    @Optional() private readonly memoryManager?: MemoryManagerService,
  ) {}

  /**
   * 从记忆系统获取用户上下文（预测前读取）
   *
   * 读取内容:
   * - 用户过去的预测记录和偏好
   * - 已知的学校兴趣和优先级
   * - Profile 历史变化趋势
   */
  async getMemoryContext(userId: string): Promise<{
    previousPredictions: Array<{
      schoolName: string;
      probability: number;
      timestamp: string;
    }>;
    knownPreferences: string[];
    profileInsights: string[];
    memoryAdjustments: Map<string, number>;
  }> {
    const ctx = {
      previousPredictions: [] as Array<{
        schoolName: string;
        probability: number;
        timestamp: string;
      }>,
      knownPreferences: [] as string[],
      profileInsights: [] as string[],
      memoryAdjustments: new Map<string, number>(),
    };

    if (!this.memoryManager) return ctx;

    try {
      // 1. 搜索过去的预测决策记忆（普通查询，按类型过滤）
      const predictionMemories = await this.memoryManager.recall(userId, {
        types: [MemoryType.DECISION],
        categories: ['school_prediction'],
        useSemanticSearch: false,
        limit: 5,
      });

      for (const mem of predictionMemories) {
        const metadata = mem.metadata as any;
        if (metadata?.topSchools) {
          for (const school of metadata.topSchools) {
            ctx.previousPredictions.push({
              schoolName: school.name,
              probability: school.probability,
              timestamp: metadata.timestamp || '',
            });
          }
        }
      }

      // 2. 搜索用户偏好记忆
      const preferenceMemories = await this.memoryManager.recall(userId, {
        types: [MemoryType.PREFERENCE],
        useSemanticSearch: false,
        limit: 5,
      });

      for (const mem of preferenceMemories) {
        ctx.knownPreferences.push(mem.content);
      }

      // 3. 搜索 Profile 相关的事实记忆
      const factMemories = await this.memoryManager.recall(userId, {
        types: [MemoryType.FACT],
        useSemanticSearch: false,
        limit: 5,
      });

      for (const mem of factMemories) {
        ctx.profileInsights.push(mem.content);
      }
    } catch (error) {
      this.logger.warn(
        'Memory context retrieval failed, proceeding without',
        error,
      );
    }

    return ctx;
  }

  /**
   * Write prediction results to the memory system (post-prediction, enhanced).
   *
   * Records a DECISION memory summarizing the schools and average probability.
   * Detects repeat predictions (same schools queried before) and adjusts the
   * memory importance accordingly (0.8 for repeats vs 0.7 for first-time).
   * Also upserts SCHOOL entities with latest probability and tier data.
   *
   * @param userId - The user identifier
   * @param results - Array of prediction results to record
   * @param memoryContext - Prior memory context including previous predictions and preferences
   */
  async recordPredictionToMemory(
    userId: string,
    results: PredictionResultDto[],
    memoryContext: { previousPredictions: any[]; knownPreferences: string[] },
  ): Promise<void> {
    if (!this.memoryManager || results.length === 0) return;

    const topSchools = results.slice(0, 5);
    const schoolNames = topSchools.map((r) => r.schoolName).join('、');
    const avgProbability = Math.round(
      results.reduce((sum, r) => sum + r.probability * 100, 0) / results.length,
    );

    // 判断是否为重复预测
    const isRepeat = memoryContext.previousPredictions.some((p) =>
      topSchools.some((r) => r.schoolName === p.schoolName),
    );

    // 决策记忆
    const content = isRepeat
      ? `用户再次查看了${results.length}所学校的录取预测（${schoolNames}），平均录取概率${avgProbability}%。这表明对这些学校有持续关注。`
      : `用户首次查看了${results.length}所学校的录取预测，包括${schoolNames}等，平均录取概率${avgProbability}%`;

    await this.memoryManager.remember(userId, {
      type: MemoryType.DECISION,
      category: 'school_prediction',
      content,
      importance: isRepeat ? 0.8 : 0.7,
      metadata: {
        schoolCount: results.length,
        topSchools: topSchools.map((r) => ({
          name: r.schoolName,
          probability: r.probability,
          probabilityRange:
            r.probabilityLow && r.probabilityHigh
              ? `${(r.probabilityLow * 100).toFixed(0)}-${(r.probabilityHigh * 100).toFixed(0)}%`
              : undefined,
          tier: r.tier,
        })),
        avgProbability,
        modelVersion: MODEL_VERSION,
        isRepeatQuery: isRepeat,
        timestamp: new Date().toISOString(),
      },
    });

    // 记录/更新学校实体
    for (const result of topSchools) {
      await this.memoryManager.recordEntity(userId, {
        type: EntityType.SCHOOL,
        name: result.schoolName,
        description: `录取概率${(result.probability * 100).toFixed(0)}%（${
          result.tier === 'reach'
            ? '冲刺校'
            : result.tier === 'match'
              ? '匹配校'
              : '保底校'
        }），置信度: ${result.confidence}`,
        attributes: {
          schoolId: result.schoolId,
          probability: result.probability,
          probabilityLow: result.probabilityLow,
          probabilityHigh: result.probabilityHigh,
          tier: result.tier,
          confidence: result.confidence,
          modelVersion: MODEL_VERSION,
          lastPredictedAt: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * 通用的预测结果记忆写入（供桥接路径使用）。
   * 写入轻量级 FACT 记忆（重要性 0.5），不覆盖高质量 DECISION 记忆。
   * 同时更新 SCHOOL 实体的预测属性。
   */
  async recordBridgePredictionToMemory(
    userId: string,
    schools: Array<{ name: string; probability: number; tier: string }>,
    source: string,
  ): Promise<void> {
    if (!this.memoryManager || schools.length === 0) return;

    const sourceLabel =
      source === 'quick-match'
        ? '快速匹配'
        : source === 'ai-recommend'
          ? 'AI 推荐'
          : source === 'recommendation'
            ? '智能选校'
            : source;

    const topSchools = schools.slice(0, 5);
    const summary = topSchools
      .map(
        (s) =>
          `${s.name} ${(s.probability * 100).toFixed(0)}%(${
            s.tier === 'reach' ? '冲刺' : s.tier === 'match' ? '匹配' : '保底'
          })`,
      )
      .join(', ');

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'school_prediction',
      content: `通过${sourceLabel}获得预测: ${summary}`,
      importance: 0.5,
      metadata: {
        source,
        schoolCount: schools.length,
        topSchools: topSchools.map((s) => ({
          name: s.name,
          probability: s.probability,
          tier: s.tier,
        })),
        timestamp: new Date().toISOString(),
      },
    });

    // 更新 SCHOOL 实体
    for (const school of topSchools) {
      await this.memoryManager.recordEntity(userId, {
        type: EntityType.SCHOOL,
        name: school.name,
        description: `录取概率${(school.probability * 100).toFixed(0)}%（${
          school.tier === 'reach'
            ? '冲刺校'
            : school.tier === 'match'
              ? '匹配校'
              : '保底校'
        }）`,
        attributes: {
          probability: school.probability,
          tier: school.tier,
          source,
          lastPredictedAt: new Date().toISOString(),
        },
      });
    }
  }
}
