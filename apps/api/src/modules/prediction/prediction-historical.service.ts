import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import {
  ProfileMetrics,
  HistoricalDistribution,
  normalizeGpa,
  parseRange,
} from './utils/score-calculator';

const DISTRIBUTION_CACHE_TTL = 86400; // 24 hours
const DISTRIBUTION_CACHE_PREFIX = 'school:distribution:';

/**
 * Historical admission data service for prediction engines.
 *
 * Provides school-level admission case distributions and case-matching
 * probability estimation from verified admission cases.
 */
@Injectable()
export class PredictionHistoricalService {
  private readonly logger = new Logger(PredictionHistoricalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 获取学校历史录取数据分布
   * 从已验证的 AdmissionCase 聚合，Redis 缓存 24h
   * 样本量 <30 时返回 null
   */
  async getSchoolDistribution(
    schoolId: string,
  ): Promise<HistoricalDistribution | null> {
    const cacheKey = `${DISTRIBUTION_CACHE_PREFIX}${schoolId}`;

    try {
      const cached = await this.redis.getJSON<HistoricalDistribution>(cacheKey);
      if (cached) return cached;
    } catch (error) {
      this.logger.warn(`Distribution cache miss`, error);
    }

    const cases = await this.prisma.admissionCase.findMany({
      where: { schoolId, result: 'ADMITTED', isVerified: true },
      select: { satRange: true, gpaRange: true, toeflRange: true },
    });

    if (cases.length < 30) return null;

    const satValues: number[] = [];
    const gpaValues: number[] = [];
    const toeflValues: number[] = [];

    for (const c of cases) {
      if (c.satRange) {
        const v = parseRange(c.satRange);
        if (v !== null) satValues.push(v);
      }
      if (c.gpaRange) {
        const v = parseRange(c.gpaRange);
        if (v !== null) gpaValues.push(v);
      }
      if (c.toeflRange) {
        const v = parseRange(c.toeflRange);
        if (v !== null) toeflValues.push(v);
      }
    }

    satValues.sort((a, b) => a - b);
    gpaValues.sort((a, b) => a - b);
    toeflValues.sort((a, b) => a - b);

    const dist: HistoricalDistribution = {
      sampleCount: cases.length,
      satValues,
      gpaValues,
      toeflValues,
    };

    try {
      await this.redis.setJSON(cacheKey, dist, DISTRIBUTION_CACHE_TTL);
    } catch (error) {
      this.logger.warn(`Distribution cache write failed`, error);
    }

    return dist;
  }

  /**
   * Estimate admission probability from historical case matching.
   *
   * Uses similarity-weighted voting across verified admission cases for the target
   * school. Each case is scored by GPA proximity (within 0.2 = +0.3, within 0.5 = +0.15)
   * and SAT proximity (within 50 = +0.2, within 100 = +0.1) on top of a 0.5 base.
   * Returns null when fewer than 10 cases exist.
   *
   * @param profileMetrics - Normalized metrics extracted from the user's profile
   * @param schoolId - The target school identifier
   * @returns Weighted probability, sample count, and confidence level; or null if insufficient data
   */
  async getHistoricalProbability(
    profileMetrics: ProfileMetrics,
    schoolId: string,
  ): Promise<{
    probability: number;
    sampleCount: number;
    confidence: number;
  } | null> {
    // 构建 GPA 范围匹配
    const normalizedGpa = profileMetrics.gpa
      ? normalizeGpa(profileMetrics.gpa, profileMetrics.gpaScale || 4)
      : null;

    const cases = await this.prisma.admissionCase.findMany({
      where: {
        schoolId,
        isVerified: true,
      },
      select: {
        result: true,
        gpaRange: true,
        satRange: true,
        toeflRange: true,
      },
    });

    if (cases.length < 10) return null;

    // 相似度加权统计
    let totalWeight = 0;
    let admittedWeight = 0;

    for (const c of cases) {
      let similarity = 0.5; // 基础相似度

      // GPA 匹配
      if (normalizedGpa && c.gpaRange) {
        const caseGpa = parseRange(c.gpaRange);
        if (caseGpa !== null) {
          const gpaDiff = Math.abs(normalizedGpa - caseGpa);
          similarity += gpaDiff < 0.2 ? 0.3 : gpaDiff < 0.5 ? 0.15 : 0;
        }
      }

      // SAT 匹配
      if (profileMetrics.satScore && c.satRange) {
        const caseSat = parseRange(c.satRange);
        if (caseSat !== null) {
          const satDiff = Math.abs(profileMetrics.satScore - caseSat);
          similarity += satDiff < 50 ? 0.2 : satDiff < 100 ? 0.1 : 0;
        }
      }

      totalWeight += similarity;
      if (c.result === 'ADMITTED') {
        admittedWeight += similarity;
      }
    }

    if (totalWeight === 0) return null;

    const probability = admittedWeight / totalWeight;
    const confidence = Math.min(1, cases.length / 100); // 样本量越大置信度越高

    return {
      probability: Math.max(0.05, Math.min(0.95, probability)),
      sampleCount: cases.length,
      confidence,
    };
  }
}
