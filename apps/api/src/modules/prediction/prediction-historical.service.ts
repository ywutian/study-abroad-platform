import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CASE_REVIEW_APPROVED_WHERE } from '../../common/constants/prisma-selects';
import {
  ProfileMetrics,
  HistoricalDistribution,
  normalizeGpa,
  parseRange,
} from './utils/score-calculator';

const DISTRIBUTION_CACHE_TTL = 86400; // 24 hours
const DISTRIBUTION_CACHE_PREFIX = 'school:distribution:';
const MIN_CASES_FOR_FILTERED = 10;

/**
 * Optional profile context for dimension-based grouping of historical data.
 * When provided, the service attempts more specific queries before falling
 * back to the unfiltered (current) behavior.
 */
export interface HistoricalContext {
  curriculumType?: string;
  highSchoolType?: string;
  isInternational?: boolean;
  nationality?: string;
}

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
   * Invalidate cached distribution data for a specific school.
   * Called when new cases are approved for that school so prediction
   * data stays fresh.
   */
  async invalidateSchoolCache(schoolId: string): Promise<void> {
    const cacheKey = `${DISTRIBUTION_CACHE_PREFIX}${schoolId}`;
    try {
      await this.redis.del(cacheKey);
      this.logger.log(`Invalidated distribution cache for school ${schoolId}`);
    } catch (error) {
      this.logger.warn(
        `Failed to invalidate cache for school ${schoolId}`,
        error,
      );
    }
  }

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
      where: {
        schoolId,
        result: 'ADMITTED',
        isVerified: true,
        ...CASE_REVIEW_APPROVED_WHERE,
      },
      select: {
        satRange: true,
        gpaRange: true,
        toeflRange: true,
        testScores: true,
        highSchoolType: true,
        curriculumType: true,
        demographicTags: true,
      },
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
    context?: HistoricalContext,
  ): Promise<{
    probability: number;
    sampleCount: number;
    confidence: number;
    filterLevel: 'nationality' | 'specific' | 'curriculum' | 'unfiltered';
  } | null> {
    // 构建 GPA 范围匹配
    const normalizedGpa = profileMetrics.gpa
      ? normalizeGpa(
          profileMetrics.gpa,
          profileMetrics.gpaScale || 4,
          profileMetrics.gpaSystem,
        )
      : null;

    const cases = await this.fetchCasesWithFallback(schoolId, context);

    if (!cases) return null;

    // 相似度加权统计
    let totalWeight = 0;
    let admittedWeight = 0;

    for (const c of cases.data) {
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
    const confidence = Math.min(1, cases.data.length / 100); // 样本量越大置信度越高

    return {
      probability: Math.max(0.05, Math.min(0.95, probability)),
      sampleCount: cases.data.length,
      confidence,
      filterLevel: cases.filterLevel,
    };
  }

  /**
   * Build a Prisma WHERE clause from HistoricalContext for dimension-based filtering.
   */
  private buildContextWhere(
    context: HistoricalContext,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (context.curriculumType) {
      where.curriculumType = context.curriculumType;
    }
    if (context.highSchoolType) {
      where.highSchoolType = context.highSchoolType;
    }
    if (context.isInternational !== undefined) {
      where.demographicTags = context.isInternational
        ? { has: 'international' }
        : { isEmpty: true }; // fallback: no 'international' tag
    }

    return where;
  }

  /**
   * Fetch admission cases with tiered fallback based on context specificity.
   *
   * 0. Most specific: curriculumType + highSchoolType + nationality (non-US only)
   * 1. Specific:      curriculumType + highSchoolType (+ isInternational if given)
   * 2. Medium:        curriculumType only (+ isInternational if given)
   * 3. Unfiltered:    no context filter (original behavior)
   *
   * Falls back to the next tier when the current yields < MIN_CASES_FOR_FILTERED results.
   * Returns null when even the unfiltered query has < MIN_CASES_FOR_FILTERED results.
   */
  private async fetchCasesWithFallback(
    schoolId: string,
    context?: HistoricalContext,
  ): Promise<{
    data: {
      result: string;
      gpaRange: string | null;
      satRange: string | null;
      toeflRange: string | null;
    }[];
    filterLevel: 'nationality' | 'specific' | 'curriculum' | 'unfiltered';
  } | null> {
    const baseWhere = {
      schoolId,
      isVerified: true,
      ...CASE_REVIEW_APPROVED_WHERE,
    };

    const select = {
      result: true,
      gpaRange: true,
      satRange: true,
      toeflRange: true,
      testScores: true,
      highSchoolType: true,
      curriculumType: true,
      demographicTags: true,
    } as const;

    // Tier 0: most specific (curriculumType + highSchoolType + nationality)
    // Only for non-US nationalities where nationality-specific data is meaningful
    if (
      context?.curriculumType &&
      context?.highSchoolType &&
      context?.nationality &&
      context.nationality.toUpperCase() !== 'US' &&
      context.nationality.toUpperCase() !== 'USA' &&
      context.nationality.toUpperCase() !== 'UNITED STATES'
    ) {
      const nationalityWhere = {
        ...this.buildContextWhere(context),
        nationality: context.nationality,
      };
      const cases = await this.prisma.admissionCase.findMany({
        where: { ...baseWhere, ...nationalityWhere },
        select,
      });

      if (cases.length >= MIN_CASES_FOR_FILTERED) {
        this.logger.debug(
          `Historical: using nationality filter (curriculum=${context.curriculumType}, ` +
            `hs=${context.highSchoolType}, nationality=${context.nationality}) ` +
            `for school ${schoolId}: ${cases.length} cases`,
        );
        return { data: cases, filterLevel: 'nationality' };
      }
    }

    // Tier 1: specific (curriculumType + highSchoolType)
    if (context?.curriculumType && context?.highSchoolType) {
      const specificWhere = this.buildContextWhere(context);
      const cases = await this.prisma.admissionCase.findMany({
        where: { ...baseWhere, ...specificWhere },
        select,
      });

      if (cases.length >= MIN_CASES_FOR_FILTERED) {
        this.logger.debug(
          `Historical: using specific filter (curriculum=${context.curriculumType}, ` +
            `hs=${context.highSchoolType}) for school ${schoolId}: ${cases.length} cases`,
        );
        return { data: cases, filterLevel: 'specific' };
      }
    }

    // Tier 2: curriculum only
    if (context?.curriculumType) {
      const curriculumWhere: Record<string, unknown> = {
        curriculumType: context.curriculumType,
      };
      if (context.isInternational !== undefined) {
        curriculumWhere.demographicTags = context.isInternational
          ? { has: 'international' }
          : { isEmpty: true };
      }

      const cases = await this.prisma.admissionCase.findMany({
        where: { ...baseWhere, ...curriculumWhere },
        select,
      });

      if (cases.length >= MIN_CASES_FOR_FILTERED) {
        this.logger.debug(
          `Historical: using curriculum filter (${context.curriculumType}) for school ${schoolId}: ${cases.length} cases`,
        );
        return { data: cases, filterLevel: 'curriculum' };
      }
    }

    // Tier 3: unfiltered (original behavior)
    const cases = await this.prisma.admissionCase.findMany({
      where: baseWhere,
      select,
    });

    if (cases.length < MIN_CASES_FOR_FILTERED) return null;

    if (context?.curriculumType || context?.highSchoolType) {
      this.logger.debug(
        `Historical: fell back to unfiltered for school ${schoolId}: ${cases.length} cases ` +
          `(requested curriculum=${context.curriculumType}, hs=${context.highSchoolType})`,
      );
    }

    return { data: cases, filterLevel: 'unfiltered' };
  }

  /**
   * Get nationality-specific admission statistics for a school.
   *
   * Returns the admit rate and case count for applicants of a given nationality
   * at the target school. Returns null if fewer than 3 cases exist.
   *
   * @param schoolId - The target school identifier
   * @param nationality - The applicant's nationality (e.g., "China", "India")
   * @returns NationalityStats or null if insufficient data
   */
  async getNationalityStats(
    schoolId: string,
    nationality: string,
  ): Promise<{
    nationality: string;
    totalCases: number;
    admittedCases: number;
    admitRate: number;
  } | null> {
    const MIN_NATIONALITY_CASES = 3;

    const cases = await this.prisma.admissionCase.findMany({
      where: {
        schoolId,
        nationality,
        isVerified: true,
        ...CASE_REVIEW_APPROVED_WHERE,
      },
      select: { result: true },
    });

    if (cases.length < MIN_NATIONALITY_CASES) return null;

    const admittedCases = cases.filter((c) => c.result === 'ADMITTED').length;
    const admitRate = (admittedCases / cases.length) * 100;

    return {
      nationality,
      totalCases: cases.length,
      admittedCases,
      admitRate: Math.round(admitRate * 10) / 10, // 1 decimal place
    };
  }

  /**
   * Detect whether a high school is a "feeder" school for a given university.
   *
   * A feeder relationship exists when the admit rate from this high school
   * exceeds the university's overall acceptance rate by ≥ 1.5x, with at least
   * 5 verified cases from that high school.
   *
   * @param highSchoolId - The high school identifier
   * @param schoolId - The target university identifier
   * @param overallAcceptanceRate - The university's published acceptance rate (0-100)
   * @returns Feeder signal with stats, or null if insufficient data
   */
  async getFeederSignal(
    highSchoolId: string,
    schoolId: string,
    overallAcceptanceRate?: number,
  ): Promise<{
    admitRate: number;
    sampleCount: number;
    admittedCount: number;
    isFeeder: boolean;
    confidence: number;
  } | null> {
    const MIN_FEEDER_CASES = 5;

    const cases = await this.prisma.admissionCase.findMany({
      where: {
        schoolId,
        highSchoolId,
        isVerified: true,
        ...CASE_REVIEW_APPROVED_WHERE,
      },
      select: { result: true },
    });

    if (cases.length < MIN_FEEDER_CASES) return null;

    const admittedCount = cases.filter((c) => c.result === 'ADMITTED').length;
    const admitRate = admittedCount / cases.length;

    // Feeder: HS-specific admit rate > 1.5× overall rate (or > 30% if no rate available)
    const threshold = overallAcceptanceRate
      ? (overallAcceptanceRate / 100) * 1.5
      : 0.3;
    const isFeeder = admitRate > threshold;

    // Confidence scales with sample size (saturates at 30 cases)
    const confidence = Math.min(1, cases.length / 30);

    return {
      admitRate: Math.round(admitRate * 1000) / 1000, // 3 decimal places
      sampleCount: cases.length,
      admittedCount,
      isFeeder,
      confidence,
    };
  }
}
