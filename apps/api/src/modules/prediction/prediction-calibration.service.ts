import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

const CALIBRATION_CACHE_PREFIX = 'prediction:calibration:';
const DISTRIBUTION_CACHE_TTL = 86400; // 24 hours

const SCHOOL_CALIBRATION_CACHE_KEY = 'prediction:school-calibrations';
const SCHOOL_CALIBRATION_CACHE_TTL = 3600; // 1 hour

/**
 * Calibration service for prediction probability correction.
 *
 * Manages per-school calibration multipliers and Platt scaling parameters
 * derived from historical prediction-vs-actual outcome data.
 */
@Injectable()
export class PredictionCalibrationService {
  private readonly logger = new Logger(PredictionCalibrationService.name);

  private schoolCalibrationMap: Record<string, number> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Load school calibrations from DB (cached in Redis + in-memory).
   * Returns a map of schoolId → multiplier.
   */
  async getSchoolCalibrations(): Promise<Record<string, number>> {
    if (this.schoolCalibrationMap) return this.schoolCalibrationMap;

    try {
      const cached = await this.redis.get(SCHOOL_CALIBRATION_CACHE_KEY);
      if (cached) {
        this.schoolCalibrationMap = JSON.parse(cached);
        return this.schoolCalibrationMap!;
      }
    } catch {
      /* Redis unavailable, fall through */
    }

    try {
      const calibrations = await this.prisma.schoolCalibration.findMany({
        select: { schoolId: true, multiplier: true },
      });
      const map: Record<string, number> = {};
      for (const c of calibrations) {
        map[c.schoolId] = Number(c.multiplier);
      }
      this.schoolCalibrationMap = map;

      try {
        await this.redis.set(
          SCHOOL_CALIBRATION_CACHE_KEY,
          JSON.stringify(map),
          SCHOOL_CALIBRATION_CACHE_TTL,
        );
      } catch {
        /* best-effort cache write */
      }

      return map;
    } catch (err) {
      this.logger.warn(
        'Failed to load school calibrations, using empty map',
        err,
      );
      this.schoolCalibrationMap = {};
      return {};
    }
  }

  /**
   * Invalidate school calibration cache (called by AdminController after CUD).
   * Clears both in-memory and Redis layers so next prediction re-fetches from DB.
   */
  async invalidateCalibrationCache(): Promise<void> {
    this.schoolCalibrationMap = null;
    try {
      await this.redis.del(SCHOOL_CALIBRATION_CACHE_KEY);
    } catch {
      /* soft-fail: TTL will expire naturally */
    }
  }

  /**
   * 基于历史校准数据的 Platt Scaling 修正。
   *
   * 读取已有的 (predicted, actual) 数据点，拟合 sigmoid: calibrated = 1 / (1 + exp(-(a*p + b)))
   * 当校准数据 < 50 条时返回 null，不做修正。
   * 结果缓存 24 小时。
   */
  async getPlattCalibration(): Promise<{
    a: number;
    b: number;
  } | null> {
    const cacheKey = `${CALIBRATION_CACHE_PREFIX}platt`;

    try {
      const cached = await this.redis.getJSON<{ a: number; b: number }>(
        cacheKey,
      );
      if (cached) return cached;
    } catch {
      // ignore cache miss
    }

    const records = await this.prisma.predictionResult.findMany({
      where: { actualResult: { not: null } },
      select: { probability: true, actualResult: true },
    });

    if (records.length < 50) return null;

    // Platt scaling via gradient descent on log-loss with L2 regularization
    // y = 1 if ADMITTED, 0 otherwise
    // model: sigma(a * p + b)
    let a = 1.0;
    let b = 0.0;
    const lr = 0.005; // lower learning rate for stability
    const iterations = 500; // more iterations to compensate
    const lambda = 0.01; // L2 regularization

    for (let iter = 0; iter < iterations; iter++) {
      let gradA = 0;
      let gradB = 0;

      for (const r of records) {
        const p = Number(r.probability);
        const y = r.actualResult === 'ADMITTED' ? 1 : 0;
        const z = Math.max(-500, Math.min(500, a * p + b)); // clamp for numerical stability
        const sigma = 1 / (1 + Math.exp(-z));
        const diff = sigma - y;
        gradA += diff * p;
        gradB += diff;
      }

      // L2 regularization
      gradA += lambda * a;
      gradB += lambda * b;

      a -= (lr * gradA) / records.length;
      b -= (lr * gradB) / records.length;
    }

    const params = { a, b };

    try {
      await this.redis.setJSON(cacheKey, params, DISTRIBUTION_CACHE_TTL);
    } catch {
      // ignore cache write failure
    }

    return params;
  }

  /**
   * 应用 Platt scaling 校准到融合概率
   */
  applyPlattCalibration(
    probability: number,
    params: { a: number; b: number },
  ): number {
    const z = params.a * probability + params.b;
    const calibrated = 1 / (1 + Math.exp(-z));
    return Math.max(0.05, Math.min(0.95, calibrated));
  }
}
