import { Injectable } from '@nestjs/common';
import { EngineScores } from './dto';

/**
 * 引擎权重配置
 *
 * 动态权重根据数据可用性调整:
 * - 有 AI + 有历史数据: stats 0.25, ai 0.40, historical 0.35
 * - 有 AI + 无历史数据: stats 0.35, ai 0.65
 * - 无 AI + 有历史数据: stats 0.45, historical 0.55
 * - 仅统计: stats 1.0
 */
const ENGINE_WEIGHTS = {
  full: { stats: 0.25, ai: 0.4, historical: 0.35 },
  noHistory: { stats: 0.35, ai: 0.65 },
  noAi: { stats: 0.45, historical: 0.55 },
  statsOnly: { stats: 1.0 },
} as const;

/** Engine weights when ML model is available (Engine 4) */
const ENGINE_WEIGHTS_ML = {
  fullWithMl: { stats: 0.1, ai: 0.25, historical: 0.25, ml: 0.4 },
  noHistWithMl: { stats: 0.15, ai: 0.4, ml: 0.45 },
  noAiWithMl: { stats: 0.2, historical: 0.3, ml: 0.5 },
  statsWithMl: { stats: 0.3, ml: 0.7 },
} as const;

/** 置信区间宽度 (根据 confidence level) */
const CONFIDENCE_INTERVAL_WIDTH = {
  high: 0.08, // ±4%
  medium: 0.14, // ±7%
  low: 0.22, // ±11%
} as const;

/**
 * Engine fusion service for multi-engine ensemble predictions.
 *
 * Merges outputs from stats, AI, historical, and ML engines using
 * dynamic weighted averaging with consistency-based weight adjustment.
 */
@Injectable()
export class PredictionFusionEngine {
  /**
   * Fuse predictions from multiple engines into a single probability with confidence interval.
   *
   * Fusion strategy:
   * 1. Statistical engine (always available) — data-driven baseline
   * 2. AI engine (may fail) — expert judgment + qualitative analysis
   * 3. Historical data engine (if sufficient data) — case matching
   * 4. ML engine (if champion model available)
   * 5. Memory enhancement — micro-adjustment (±2%)
   *
   * @param statsProbability - Probability from the statistical engine
   * @param aiProbability - Probability from the AI engine (null if failed)
   * @param historicalResult - Result from historical case matching (null if insufficient data)
   * @param memoryAdjustment - Micro-adjustment from memory system
   * @param confidenceLevel - Data confidence level
   * @param mlProbability - Probability from ML model (null if unavailable)
   * @returns Fused probability with confidence interval and engine score breakdown
   */
  fusePredictions(
    statsProbability: number,
    aiProbability: number | null,
    historicalResult: {
      probability: number;
      sampleCount: number;
      confidence: number;
    } | null,
    memoryAdjustment: number,
    confidenceLevel: 'low' | 'medium' | 'high',
    mlProbability: number | null = null,
  ): {
    probability: number;
    probabilityLow: number;
    probabilityHigh: number;
    crossEngineConsistency: number;
    engineScores: EngineScores;
  } {
    let weights: Record<string, number>;
    let fusedProbability: number;

    // 计算跨引擎一致性 (0-1, 1=完全一致)
    let crossEngineConsistency = 1;

    const hasAi = aiProbability !== null;
    const hasHist = historicalResult !== null;
    const hasMl = mlProbability !== null;

    if (hasMl) {
      // --- ML model available: use ML-enhanced weights ---

      if (hasAi && hasHist) {
        weights = { ...ENGINE_WEIGHTS_ML.fullWithMl };
        const histConfidence = historicalResult.confidence;
        weights.historical *= histConfidence;
      } else if (hasAi) {
        weights = { ...ENGINE_WEIGHTS_ML.noHistWithMl };
      } else if (hasHist) {
        weights = { ...ENGINE_WEIGHTS_ML.noAiWithMl };
      } else {
        weights = { ...ENGINE_WEIGHTS_ML.statsWithMl };
      }

      // Cross-engine consistency (include ML in the calculation)
      const probs = [statsProbability, mlProbability];
      if (hasAi) probs.push(aiProbability);
      if (hasHist) probs.push(historicalResult.probability);
      const maxP = Math.max(...probs);
      const minP = Math.min(...probs);
      crossEngineConsistency = Math.max(0, 1 - (maxP - minP) / 0.4);

      // Safety: if ML wildly disagrees with stats (>0.3 diff), halve ML weight
      const mlStatsDiff = Math.abs(mlProbability - statsProbability);
      if (mlStatsDiff > 0.3) {
        const halved = weights.ml / 2;
        weights.ml = halved;
        weights.stats += halved; // redistribute to stats (safe)
      }

      // Safety floor: stats weight never below 0.10
      if (weights.stats < 0.1) {
        const deficit = 0.1 - weights.stats;
        weights.stats = 0.1;
        if (weights.ml) weights.ml -= deficit;
      }

      // AI consistency scaling (same as non-ML path)
      if (hasAi && weights.ai) {
        const aiConsistency = Math.max(
          0,
          1 - Math.abs(aiProbability - statsProbability) / 0.4,
        );
        const aiScale = 0.5 + 0.5 * aiConsistency;
        const originalAi = weights.ai;
        weights.ai *= aiScale;
        weights.stats += (originalAi - weights.ai) * 0.5;
        if (weights.ml) weights.ml += (originalAi - weights.ai) * 0.5;
      }

      // Renormalize
      const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);
      for (const key of Object.keys(weights)) {
        weights[key] /= totalWeight;
      }

      // Weighted sum
      fusedProbability =
        statsProbability * weights.stats + mlProbability * (weights.ml ?? 0);
      if (hasAi) fusedProbability += aiProbability * (weights.ai ?? 0);
      if (hasHist)
        fusedProbability +=
          historicalResult.probability * (weights.historical ?? 0);
    } else {
      // --- No ML model: original logic ---
      if (hasAi && hasHist) {
        weights = { ...ENGINE_WEIGHTS.full };
        const histConfidence = historicalResult.confidence;
        weights.historical *= histConfidence;

        crossEngineConsistency = Math.max(
          0,
          1 - Math.abs(aiProbability - statsProbability) / 0.4,
        );
        const aiScale = 0.5 + 0.5 * crossEngineConsistency;
        const originalAiWeight = weights.ai;
        weights.ai *= aiScale;
        const removedWeight = originalAiWeight - weights.ai;
        weights.stats += removedWeight * 0.6;
        weights.historical += removedWeight * 0.4;

        const totalWeight = weights.stats + weights.ai + weights.historical;
        weights.stats /= totalWeight;
        weights.ai /= totalWeight;
        weights.historical /= totalWeight;

        fusedProbability =
          statsProbability * weights.stats +
          aiProbability * weights.ai +
          historicalResult.probability * weights.historical;
      } else if (hasAi) {
        weights = { ...ENGINE_WEIGHTS.noHistory };

        crossEngineConsistency = Math.max(
          0,
          1 - Math.abs(aiProbability - statsProbability) / 0.4,
        );
        const aiScale = 0.5 + 0.5 * crossEngineConsistency;
        const originalAiWeight = weights.ai;
        weights.ai *= aiScale;
        weights.stats += originalAiWeight - weights.ai;
        const totalWeight = weights.stats + weights.ai;
        weights.stats /= totalWeight;
        weights.ai /= totalWeight;

        fusedProbability =
          statsProbability * weights.stats + aiProbability * weights.ai;
      } else if (hasHist) {
        weights = { ...ENGINE_WEIGHTS.noAi };
        fusedProbability =
          statsProbability * weights.stats +
          historicalResult.probability * weights.historical;
      } else {
        weights = { ...ENGINE_WEIGHTS.statsOnly };
        fusedProbability = statsProbability;
      }
    }

    // 应用记忆增强微调
    fusedProbability += memoryAdjustment;
    fusedProbability = Math.max(0.05, Math.min(0.95, fusedProbability));

    // 计算置信区间 — 引擎不一致时区间更宽
    let intervalWidth = CONFIDENCE_INTERVAL_WIDTH[confidenceLevel];
    intervalWidth *= 1 + (1 - crossEngineConsistency) * 0.5;
    const probabilityLow = Math.max(0.01, fusedProbability - intervalWidth / 2);
    const probabilityHigh = Math.min(
      0.99,
      fusedProbability + intervalWidth / 2,
    );

    // Determine fusion method name
    const engineList = ['stats'];
    if (hasAi) engineList.push('ai');
    if (hasHist) engineList.push('hist');
    if (hasMl) engineList.push('ml');
    const fusionMethod =
      engineList.length === 1
        ? 'stats_only'
        : `weighted_ensemble_${engineList.length}_${engineList.join('_')}`;

    return {
      probability: fusedProbability,
      probabilityLow,
      probabilityHigh,
      crossEngineConsistency,
      engineScores: {
        stats: statsProbability,
        ai: aiProbability ?? undefined,
        historical: historicalResult?.probability,
        ml: mlProbability ?? undefined,
        memoryAdjustment: memoryAdjustment !== 0 ? memoryAdjustment : undefined,
        weights,
        fusionMethod,
      },
    };
  }
}
