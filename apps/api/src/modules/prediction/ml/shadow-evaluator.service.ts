/**
 * Shadow Evaluator Service
 *
 * Runs the shadow model in parallel with the champion for A/B comparison.
 * Logs predictions without affecting served results.
 * Accumulates online metrics for promotion decisions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { predict, predictGBDT } from '@study-abroad/shared/scoring';
import type { TrainedModel, GBDTModel } from '@study-abroad/shared/scoring';
import { ModelRegistryService } from './model-registry.service';
import { RedisService } from '../../../common/redis/redis.service';

// ============================================
// Types
// ============================================

interface ShadowMetrics {
  predictionCount: number;
  startedAt: string;
  sumAbsDiff: number;
  sumSquaredDiff: number;
  predictions: Array<{
    shadowProb: number;
    servedProb: number;
    timestamp: string;
  }>;
  // Updated when outcomes are reported
  outcomesCollected: number;
  sumBrier: number;
}

export interface ShadowReport {
  modelId: string;
  version: number;
  predictionCount: number;
  startedAt: string;
  meanAbsDiff: number;
  rmsDiff: number;
  onlineBrier: number | null;
  outcomesCollected: number;
  recommendPromotion: boolean;
  reasons: string[];
}

const SHADOW_METRICS_KEY = (modelId: string) => `ml:shadow:metrics:${modelId}`;
const SHADOW_METRICS_TTL = 60 * 60 * 24 * 30; // 30 days
const MAX_STORED_PREDICTIONS = 1000;

@Injectable()
export class ShadowEvaluatorService {
  private readonly logger = new Logger(ShadowEvaluatorService.name);

  constructor(
    private readonly modelRegistry: ModelRegistryService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Run shadow model prediction if a shadow model is active.
   * Non-blocking — errors are logged and swallowed.
   */
  async runIfActive(
    featureArray: number[],
    servedProbability: number,
    selectivityBand: string | null = null,
  ): Promise<void> {
    try {
      const shadowModel =
        await this.modelRegistry.getShadowModel(selectivityBand);
      if (!shadowModel) return;

      // Predict with shadow model
      let shadowProb: number;
      if ('trees' in shadowModel) {
        shadowProb = predictGBDT(shadowModel, featureArray);
      } else {
        shadowProb = predict(shadowModel, featureArray);
      }

      // Get shadow model DB record for ID
      const shadowRecord =
        await this.modelRegistry.getShadowMetrics(selectivityBand);
      if (!shadowRecord) return;

      // Update metrics
      await this.updateMetrics(
        shadowRecord.modelId,
        shadowProb,
        servedProbability,
      );
    } catch (err) {
      this.logger.debug(
        `Shadow evaluation skipped: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Record outcome for shadow model (when user reports admission result).
   */
  async onOutcomeReported(
    selectivityBand: string | null,
    predictedProb: number,
    actualResult: boolean,
  ): Promise<void> {
    const shadowRecord =
      await this.modelRegistry.getShadowMetrics(selectivityBand);
    if (!shadowRecord) return;

    const metricsKey = SHADOW_METRICS_KEY(shadowRecord.modelId);
    const raw = await this.redis.getJSON<ShadowMetrics>(metricsKey);
    if (!raw) return;

    const actualLabel = actualResult ? 1 : 0;
    raw.outcomesCollected++;
    raw.sumBrier += (predictedProb - actualLabel) ** 2;

    await this.redis.setJSON(metricsKey, raw, SHADOW_METRICS_TTL);
  }

  /**
   * Generate a shadow report for admin review.
   */
  async getShadowReport(
    selectivityBand: string | null = null,
  ): Promise<ShadowReport | null> {
    const shadowRecord =
      await this.modelRegistry.getShadowMetrics(selectivityBand);
    if (!shadowRecord) return null;

    const metricsKey = SHADOW_METRICS_KEY(shadowRecord.modelId);
    const metrics = await this.redis.getJSON<ShadowMetrics>(metricsKey);

    if (!metrics || metrics.predictionCount === 0) {
      return {
        modelId: shadowRecord.modelId,
        version: shadowRecord.version,
        predictionCount: 0,
        startedAt: shadowRecord.promotedAt?.toISOString() ?? '',
        meanAbsDiff: 0,
        rmsDiff: 0,
        onlineBrier: null,
        outcomesCollected: 0,
        recommendPromotion: false,
        reasons: ['No shadow predictions collected yet'],
      };
    }

    const meanAbsDiff = metrics.sumAbsDiff / metrics.predictionCount;
    const rmsDiff = Math.sqrt(metrics.sumSquaredDiff / metrics.predictionCount);
    const onlineBrier =
      metrics.outcomesCollected > 0
        ? metrics.sumBrier / metrics.outcomesCollected
        : null;

    // Promotion recommendation criteria
    const reasons: string[] = [];
    let recommendPromotion = true;

    if (metrics.predictionCount < 100) {
      recommendPromotion = false;
      reasons.push(`Insufficient predictions: ${metrics.predictionCount}/100`);
    }

    if (meanAbsDiff > 0.15) {
      reasons.push(
        `Large mean difference from champion: ${meanAbsDiff.toFixed(3)}`,
      );
    }

    if (onlineBrier !== null && onlineBrier > 0.25) {
      recommendPromotion = false;
      reasons.push(`Online Brier score too high: ${onlineBrier.toFixed(3)}`);
    }

    if (onlineBrier !== null && onlineBrier < 0.15) {
      reasons.push(`Good online Brier score: ${onlineBrier.toFixed(3)}`);
    }

    if (reasons.length === 0) {
      reasons.push('Shadow model performing within acceptable bounds');
    }

    return {
      modelId: shadowRecord.modelId,
      version: shadowRecord.version,
      predictionCount: metrics.predictionCount,
      startedAt: metrics.startedAt,
      meanAbsDiff,
      rmsDiff,
      onlineBrier,
      outcomesCollected: metrics.outcomesCollected,
      recommendPromotion,
      reasons,
    };
  }

  // ============================================
  // Internal
  // ============================================

  private async updateMetrics(
    modelId: string,
    shadowProb: number,
    servedProb: number,
  ): Promise<void> {
    const metricsKey = SHADOW_METRICS_KEY(modelId);
    let metrics = await this.redis.getJSON<ShadowMetrics>(metricsKey);

    if (!metrics) {
      metrics = {
        predictionCount: 0,
        startedAt: new Date().toISOString(),
        sumAbsDiff: 0,
        sumSquaredDiff: 0,
        predictions: [],
        outcomesCollected: 0,
        sumBrier: 0,
      };
    }

    const diff = Math.abs(shadowProb - servedProb);
    metrics.predictionCount++;
    metrics.sumAbsDiff += diff;
    metrics.sumSquaredDiff += diff * diff;

    // Keep last N predictions for detailed analysis
    if (metrics.predictions.length < MAX_STORED_PREDICTIONS) {
      metrics.predictions.push({
        shadowProb,
        servedProb,
        timestamp: new Date().toISOString(),
      });
    }

    await this.redis.setJSON(metricsKey, metrics, SHADOW_METRICS_TTL);
  }
}
