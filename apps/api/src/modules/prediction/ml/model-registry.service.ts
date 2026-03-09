/**
 * Model Registry Service
 *
 * Manages the lifecycle of prediction models:
 *   CANDIDATE → SHADOW → CHAMPION → RETIRED
 *
 * Champion models are cached in Redis (1h TTL) for fast serving.
 * Supports global models and per-selectivity-band models.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import type { TrainedModel, GBDTModel } from '@study-abroad/shared/scoring';
import type { ModelStatus } from '@prisma/client';

// ============================================
// Types
// ============================================

export interface ModelSummary {
  id: string;
  version: number;
  tier: number;
  modelType: string;
  selectivityBand: string | null;
  status: ModelStatus;
  trainSamples: number;
  valSamples: number;
  valAuc: number;
  brierScore: number;
  calibrationECE: number;
  cvMeanAuc: number | null;
  cvStdAuc: number | null;
  fairnessMetrics: any;
  createdAt: Date;
  promotedAt: Date | null;
  retiredAt: Date | null;
}

export interface ModelComparison {
  modelA: ModelSummary;
  modelB: ModelSummary;
  aucDelta: number;
  brierDelta: number;
  eceDelta: number;
  recommendation: 'A' | 'B' | 'similar';
}

// ============================================
// Cache Keys & TTL
// ============================================

const CACHE_PREFIX = 'ml:model:';
const CHAMPION_CACHE_KEY = (band: string | null) =>
  `${CACHE_PREFIX}champion:${band ?? 'global'}`;
const SHADOW_CACHE_KEY = (band: string | null) =>
  `${CACHE_PREFIX}shadow:${band ?? 'global'}`;
const CACHE_TTL_SECONDS = 3600; // 1 hour

@Injectable()
export class ModelRegistryService {
  private readonly logger = new Logger(ModelRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ============================================
  // Champion & Shadow Retrieval (serving path)
  // ============================================

  /**
   * Get the current champion model for a selectivity band.
   * Checks Redis cache first, falls back to DB.
   * Returns null if no champion exists (Tier 0 — heuristics only).
   */
  async getChampionModel(
    band: string | null = null,
  ): Promise<TrainedModel | GBDTModel | null> {
    const cacheKey = CHAMPION_CACHE_KEY(band);

    // Try Redis cache
    const cached = await this.redis.getJSON<TrainedModel | GBDTModel>(cacheKey);
    if (cached) return cached;

    // DB fallback
    const record = await this.prisma.predictionModel.findFirst({
      where: {
        status: 'CHAMPION',
        selectivityBand: band,
      },
      orderBy: { version: 'desc' },
    });

    if (!record) return null;

    const model = record.weights as unknown as TrainedModel | GBDTModel;

    // Populate cache
    await this.redis.setJSON(cacheKey, model, CACHE_TTL_SECONDS);

    return model;
  }

  /**
   * Get the current shadow model (for A/B comparison).
   */
  async getShadowModel(
    band: string | null = null,
  ): Promise<TrainedModel | GBDTModel | null> {
    const cacheKey = SHADOW_CACHE_KEY(band);

    const cached = await this.redis.getJSON<TrainedModel | GBDTModel>(cacheKey);
    if (cached) return cached;

    const record = await this.prisma.predictionModel.findFirst({
      where: {
        status: 'SHADOW',
        selectivityBand: band,
      },
      orderBy: { version: 'desc' },
    });

    if (!record) return null;

    const model = record.weights as unknown as TrainedModel | GBDTModel;
    await this.redis.setJSON(cacheKey, model, CACHE_TTL_SECONDS);

    return model;
  }

  // ============================================
  // Model CRUD
  // ============================================

  /**
   * Save a trained model as CANDIDATE. Auto-increments version.
   * If this is the first model ever, auto-promote to CHAMPION.
   */
  async saveModel(params: {
    tier: number;
    modelType: string;
    weights: TrainedModel | GBDTModel;
    config: Record<string, any>;
    medians: Record<string, number>;
    selectivityBand: string | null;
    trainSamples: number;
    valSamples: number;
    trainAuc: number;
    valAuc: number;
    brierScore: number;
    calibrationECE: number;
    cvMeanAuc?: number;
    cvStdAuc?: number;
    fairnessMetrics?: any;
  }): Promise<string> {
    // Get next version
    const latest = await this.prisma.predictionModel.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    // Check if there's already a champion for this band
    const existingChampion = await this.prisma.predictionModel.findFirst({
      where: {
        status: 'CHAMPION',
        selectivityBand: params.selectivityBand,
      },
    });

    // If no champion exists, auto-promote the first model
    const status = existingChampion ? 'CANDIDATE' : 'CHAMPION';

    const record = await this.prisma.predictionModel.create({
      data: {
        version: nextVersion,
        tier: params.tier,
        modelType: params.modelType,
        weights: params.weights as any,
        config: params.config as any,
        medians: params.medians as any,
        selectivityBand: params.selectivityBand,
        trainSamples: params.trainSamples,
        valSamples: params.valSamples,
        trainAuc: params.trainAuc,
        valAuc: params.valAuc,
        brierScore: params.brierScore,
        calibrationECE: params.calibrationECE,
        cvMeanAuc: params.cvMeanAuc,
        cvStdAuc: params.cvStdAuc,
        fairnessMetrics: params.fairnessMetrics ?? null,
        status,
        promotedAt: status === 'CHAMPION' ? new Date() : null,
      },
    });

    if (status === 'CHAMPION') {
      await this.clearCacheForBand(params.selectivityBand);
      this.logger.log(
        `Auto-promoted model v${nextVersion} to CHAMPION (first model for band=${params.selectivityBand ?? 'global'})`,
      );
    } else {
      this.logger.log(`Saved model v${nextVersion} as CANDIDATE`);
    }

    return record.id;
  }

  /**
   * Get a single model by ID with full details.
   */
  async getModel(modelId: string) {
    const model = await this.prisma.predictionModel.findUnique({
      where: { id: modelId },
    });
    if (!model) throw new NotFoundException(`Model ${modelId} not found`);
    return model;
  }

  /**
   * List models with optional filters.
   */
  async listModels(filter?: {
    status?: ModelStatus;
    tier?: number;
    selectivityBand?: string;
    limit?: number;
  }): Promise<ModelSummary[]> {
    const records = await this.prisma.predictionModel.findMany({
      where: {
        ...(filter?.status && { status: filter.status }),
        ...(filter?.tier != null && { tier: filter.tier }),
        ...(filter?.selectivityBand !== undefined && {
          selectivityBand: filter.selectivityBand,
        }),
      },
      orderBy: { version: 'desc' },
      take: filter?.limit ?? 50,
      select: {
        id: true,
        version: true,
        tier: true,
        modelType: true,
        selectivityBand: true,
        status: true,
        trainSamples: true,
        valSamples: true,
        valAuc: true,
        brierScore: true,
        calibrationECE: true,
        cvMeanAuc: true,
        cvStdAuc: true,
        fairnessMetrics: true,
        createdAt: true,
        promotedAt: true,
        retiredAt: true,
      },
    });
    return records;
  }

  // ============================================
  // Lifecycle Management
  // ============================================

  /**
   * Promote a CANDIDATE model to SHADOW (runs in parallel with champion, logs only).
   */
  async promoteToShadow(modelId: string): Promise<void> {
    const model = await this.getModel(modelId);

    if (model.status !== 'CANDIDATE') {
      throw new ConflictException(
        `Model ${modelId} is ${model.status}, expected CANDIDATE`,
      );
    }

    // Retire any existing shadow for this band
    await this.prisma.predictionModel.updateMany({
      where: {
        status: 'SHADOW',
        selectivityBand: model.selectivityBand,
      },
      data: {
        status: 'CANDIDATE',
      },
    });

    await this.prisma.predictionModel.update({
      where: { id: modelId },
      data: {
        status: 'SHADOW',
        promotedAt: new Date(),
        shadowMetrics: {
          predictionCount: 0,
          startedAt: new Date().toISOString(),
        },
      },
    });

    await this.clearCacheForBand(model.selectivityBand);
    this.logger.log(
      `Promoted model v${model.version} to SHADOW (band=${model.selectivityBand ?? 'global'})`,
    );
  }

  /**
   * Promote a model to CHAMPION. Retires the previous champion.
   */
  async promoteToChampion(modelId: string): Promise<void> {
    const model = await this.getModel(modelId);

    if (model.status !== 'CANDIDATE' && model.status !== 'SHADOW') {
      throw new ConflictException(
        `Model ${modelId} is ${model.status}, expected CANDIDATE or SHADOW`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Retire current champion for this band
      await tx.predictionModel.updateMany({
        where: {
          status: 'CHAMPION',
          selectivityBand: model.selectivityBand,
        },
        data: {
          status: 'RETIRED',
          retiredAt: new Date(),
        },
      });

      // Promote new champion
      await tx.predictionModel.update({
        where: { id: modelId },
        data: {
          status: 'CHAMPION',
          promotedAt: new Date(),
        },
      });
    });

    await this.clearCacheForBand(model.selectivityBand);
    this.logger.log(
      `Promoted model v${model.version} to CHAMPION (band=${model.selectivityBand ?? 'global'})`,
    );
  }

  /**
   * Rollback: retire current champion, reinstate the previous one.
   */
  async rollback(selectivityBand: string | null = null): Promise<void> {
    // Find current champion
    const currentChampion = await this.prisma.predictionModel.findFirst({
      where: { status: 'CHAMPION', selectivityBand },
      orderBy: { version: 'desc' },
    });

    if (!currentChampion) {
      throw new NotFoundException('No champion model to rollback');
    }

    // Find previous champion (most recently retired)
    const previousChampion = await this.prisma.predictionModel.findFirst({
      where: {
        status: 'RETIRED',
        selectivityBand,
        retiredAt: { not: null },
      },
      orderBy: { retiredAt: 'desc' },
    });

    if (!previousChampion) {
      throw new NotFoundException('No previous champion to rollback to');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.predictionModel.update({
        where: { id: currentChampion.id },
        data: { status: 'RETIRED', retiredAt: new Date() },
      });
      await tx.predictionModel.update({
        where: { id: previousChampion.id },
        data: { status: 'CHAMPION', promotedAt: new Date(), retiredAt: null },
      });
    });

    await this.clearCacheForBand(selectivityBand);
    this.logger.log(
      `Rollback: v${currentChampion.version} → RETIRED, v${previousChampion.version} → CHAMPION`,
    );
  }

  // ============================================
  // Comparison
  // ============================================

  /**
   * Side-by-side comparison of two models.
   */
  async compareModels(idA: string, idB: string): Promise<ModelComparison> {
    const [a, b] = await Promise.all([
      this.listModels().then((ms) => ms.find((m) => m.id === idA)),
      this.listModels().then((ms) => ms.find((m) => m.id === idB)),
    ]);

    if (!a) throw new NotFoundException(`Model ${idA} not found`);
    if (!b) throw new NotFoundException(`Model ${idB} not found`);

    const aucDelta = a.valAuc - b.valAuc;
    const brierDelta = a.brierScore - b.brierScore; // lower is better
    const eceDelta = a.calibrationECE - b.calibrationECE; // lower is better

    // Recommendation: A wins if better AUC and not worse calibration
    let recommendation: 'A' | 'B' | 'similar' = 'similar';
    if (aucDelta > 0.01 && brierDelta <= 0.01) recommendation = 'A';
    else if (aucDelta < -0.01 && brierDelta >= -0.01) recommendation = 'B';

    return {
      modelA: a,
      modelB: b,
      aucDelta,
      brierDelta,
      eceDelta,
      recommendation,
    };
  }

  // ============================================
  // Shadow Metrics
  // ============================================

  /**
   * Update shadow model's online metrics (called by ShadowEvaluatorService).
   */
  async updateShadowMetrics(
    modelId: string,
    metrics: Record<string, any>,
  ): Promise<void> {
    await this.prisma.predictionModel.update({
      where: { id: modelId },
      data: { shadowMetrics: metrics },
    });
  }

  /**
   * Get shadow model's accumulated metrics.
   */
  async getShadowMetrics(selectivityBand: string | null = null) {
    const shadow = await this.prisma.predictionModel.findFirst({
      where: { status: 'SHADOW', selectivityBand },
      orderBy: { version: 'desc' },
    });

    if (!shadow) return null;

    return {
      modelId: shadow.id,
      version: shadow.version,
      metrics: shadow.shadowMetrics,
      promotedAt: shadow.promotedAt,
    };
  }

  // ============================================
  // Cache Management
  // ============================================

  private async clearCacheForBand(band: string | null): Promise<void> {
    await Promise.all([
      this.redis.del(CHAMPION_CACHE_KEY(band)),
      this.redis.del(SHADOW_CACHE_KEY(band)),
    ]);
  }

  /**
   * Clear all model caches (e.g., after a migration or schema change).
   */
  async clearAllCaches(): Promise<void> {
    const bands = [null, '0.0-0.3', '0.3-0.6', '0.6-0.8', '0.8-1.0'];
    await Promise.all(bands.map((b) => this.clearCacheForBand(b)));
    this.logger.log('Cleared all model caches');
  }
}
