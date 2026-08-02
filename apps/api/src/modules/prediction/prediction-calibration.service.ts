import { Injectable, Logger } from '@nestjs/common';
import {
  resolveCanonicalPredictionOutcome,
  VERIFIED_OUTCOME_STATUSES,
} from '@study-abroad/shared/scoring';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { REDIS_TTL } from '../../common/redis/redis-ttl.constants';

const CALIBRATION_CACHE_PREFIX = 'prediction:calibration:';
const DISTRIBUTION_CACHE_TTL = REDIS_TTL.PREDICTION_DISTRIBUTION;

const SCHOOL_CALIBRATION_CACHE_KEY = 'prediction:school-calibrations';
const SCHOOL_CALIBRATION_CACHE_TTL = REDIS_TTL.SCHOOL_CALIBRATION;
const CALIBRATION_EXCLUDED_SOURCES = ['quick-match'] as const;

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

  private async getVerifiedOutcomeSamples(): Promise<
    Array<{
      schoolId: string;
      probability: number;
      actualResult: 'ADMITTED' | 'REJECTED';
    }>
  > {
    // governance: admin-scope — calibration surface behind @Roles(Role.OPERATOR)
    const records = await this.prisma.predictionResult.findMany({
      where: {
        OR: [
          { source: null },
          { source: { notIn: [...CALIBRATION_EXCLUDED_SOURCES] } },
        ],
        outcomeLabelRecords: {
          some: {
            status: { in: VERIFIED_OUTCOME_STATUSES },
            result: { in: ['ADMITTED', 'REJECTED'] },
          },
        },
      },
      select: {
        schoolId: true,
        probability: true,
        outcomeLabelRecords: {
          select: {
            result: true,
            status: true,
            isFinal: true,
            createdAt: true,
            resolvedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return records
      .map((record) => {
        const canonical = resolveCanonicalPredictionOutcome(
          record.outcomeLabelRecords,
        );
        if (!canonical.eligibleForCalibration || !canonical.canonicalRecord) {
          return null;
        }

        return {
          schoolId: record.schoolId,
          probability: Number(record.probability),
          actualResult: canonical.canonicalRecord.result as
            'ADMITTED' | 'REJECTED',
        };
      })
      .filter(
        (
          record,
        ): record is {
          schoolId: string;
          probability: number;
          actualResult: 'ADMITTED' | 'REJECTED';
        } => Boolean(record),
      );
  }

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
      // governance: admin-scope — calibration surface behind @Roles(Role.OPERATOR)
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
      await Promise.all([
        this.redis.del(SCHOOL_CALIBRATION_CACHE_KEY),
        this.redis.del(`${CALIBRATION_CACHE_PREFIX}platt`),
      ]);
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

    const records = await this.getVerifiedOutcomeSamples();

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

  /**
   * Aggregate calibration statistics for admin overview.
   */
  async getCalibrationStats(): Promise<{
    totalCalibrations: number;
    averageMultiplier: number;
    boostedCount: number;
    reducedCount: number;
    distribution: Array<{ range: string; count: number }>;
  }> {
    // governance: admin-scope — calibration surface behind @Roles(Role.OPERATOR)
    const calibrations = await this.prisma.schoolCalibration.findMany({
      select: { multiplier: true },
    });

    const total = calibrations.length;
    if (total === 0) {
      return {
        totalCalibrations: 0,
        averageMultiplier: 1.0,
        boostedCount: 0,
        reducedCount: 0,
        distribution: [],
      };
    }

    const multipliers = calibrations.map((c) => Number(c.multiplier));
    const avg = multipliers.reduce((s, m) => s + m, 0) / total;
    const boosted = multipliers.filter((m) => m > 1.0).length;
    const reduced = multipliers.filter((m) => m < 1.0).length;

    const buckets = [
      { min: 0.5, max: 0.7, label: '0.5–0.7' },
      { min: 0.7, max: 0.9, label: '0.7–0.9' },
      { min: 0.9, max: 1.1, label: '0.9–1.1' },
      { min: 1.1, max: 1.3, label: '1.1–1.3' },
      { min: 1.3, max: 1.5, label: '1.3–1.5' },
      { min: 1.5, max: 2.01, label: '1.5–2.0' },
    ];

    const distribution = buckets.map((b) => ({
      range: b.label,
      count: multipliers.filter((m) => m >= b.min && m < b.max).length,
    }));

    return {
      totalCalibrations: total,
      averageMultiplier: Math.round(avg * 1000) / 1000,
      boostedCount: boosted,
      reducedCount: reduced,
      distribution,
    };
  }

  /**
   * Identify schools where predicted probability diverges significantly from actual outcomes.
   * Returns schools needing calibration, sorted by drift magnitude.
   */
  async getSchoolsNeedingCalibration(limit = 20): Promise<
    Array<{
      schoolId: string;
      schoolName: string;
      schoolNameZh: string | null;
      usNewsRank: number | null;
      predictionCount: number;
      avgPredicted: number;
      actualAdmitRate: number;
      drift: number;
      suggestedMultiplier: number;
    }>
  > {
    // Get schools already calibrated to exclude them
    // governance: admin-scope — calibration surface behind @Roles(Role.OPERATOR)
    const existingCalibrations = await this.prisma.schoolCalibration.findMany({
      select: { schoolId: true },
    });
    const calibratedIds = new Set(existingCalibrations.map((c) => c.schoolId));

    // Get all predictions with actual outcomes
    const results = await this.getVerifiedOutcomeSamples();

    // Group by school
    const schoolMap = new Map<
      string,
      { probabilities: number[]; admitted: number }
    >();
    for (const r of results) {
      if (calibratedIds.has(r.schoolId)) continue;
      const entry = schoolMap.get(r.schoolId) ?? {
        probabilities: [],
        admitted: 0,
      };
      entry.probabilities.push(Number(r.probability));
      if (r.actualResult === 'ADMITTED') entry.admitted++;
      schoolMap.set(r.schoolId, entry);
    }

    // Filter schools with >= 5 results and > 10pp drift
    const candidates: Array<{
      schoolId: string;
      predictionCount: number;
      avgPredicted: number;
      actualAdmitRate: number;
      drift: number;
      suggestedMultiplier: number;
    }> = [];

    for (const [schoolId, data] of schoolMap) {
      if (data.probabilities.length < 5) continue;

      const avgPredicted =
        data.probabilities.reduce((s, p) => s + p, 0) /
        data.probabilities.length;
      const actualRate = data.admitted / data.probabilities.length;
      const drift = actualRate - avgPredicted;

      if (Math.abs(drift) < 0.1) continue; // < 10pp drift is acceptable

      const suggested =
        avgPredicted > 0
          ? Math.max(0.5, Math.min(2.0, actualRate / avgPredicted))
          : 1.0;

      candidates.push({
        schoolId,
        predictionCount: data.probabilities.length,
        avgPredicted: Math.round(avgPredicted * 1000) / 1000,
        actualAdmitRate: Math.round(actualRate * 1000) / 1000,
        drift: Math.round(drift * 1000) / 1000,
        suggestedMultiplier: Math.round(suggested * 1000) / 1000,
      });
    }

    // Sort by absolute drift descending
    candidates.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));
    const topCandidates = candidates.slice(0, limit);

    if (topCandidates.length === 0) return [];

    // Fetch school details
    const schoolIds = topCandidates.map((c) => c.schoolId);
    // governance: admin-scope — calibration surface behind @Roles(Role.OPERATOR)
    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      select: { id: true, name: true, nameZh: true, usNewsRank: true },
    });
    const schoolLookup = new Map(schools.map((s) => [s.id, s]));

    return topCandidates.map((c) => {
      const school = schoolLookup.get(c.schoolId);
      return {
        ...c,
        schoolName: school?.name ?? 'Unknown',
        schoolNameZh: school?.nameZh ?? null,
        usNewsRank: school?.usNewsRank ?? null,
      };
    });
  }

  /**
   * Get Platt scaling status for admin display.
   */
  async getPlattStatus(): Promise<{
    enabled: boolean;
    params: { a: number; b: number } | null;
    trainingDataCount: number;
    minRequired: number;
  }> {
    const trainingDataCount = (await this.getVerifiedOutcomeSamples()).length;

    const params = await this.getPlattCalibration();

    return {
      enabled: params !== null,
      params,
      trainingDataCount,
      minRequired: 50,
    };
  }
}
