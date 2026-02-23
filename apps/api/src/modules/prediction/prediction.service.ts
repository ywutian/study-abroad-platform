import {
  Injectable,
  Logger,
  Optional,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { RedisService } from '../../common/redis/redis.service';
import { MemoryManagerService } from '../ai-agent/memory';
import { MemoryType, EntityType, Prisma, School } from '@prisma/client';
import {
  AI_PREDICTION_TIMEOUT_MS,
  PREDICTION_LOCK_TTL,
} from './prediction-error';

/** Profile with included relations used by prediction logic */
type ProfileWithRelations = Prisma.ProfileGetPayload<{
  include: {
    testScores: true;
    activities: true;
    awards: { include: { competition: true } };
  };
}>;

import {
  PredictionResultDto,
  PredictionFactor,
  PredictionComparison,
  EngineScores,
} from './dto';
import {
  buildPredictionPrompt,
  ProfileInput,
  SchoolInput,
} from './utils/prompt-builder';
import {
  ProfileMetrics,
  SchoolMetrics,
  HistoricalDistribution,
  calculateOverallScore,
  calculateProbability,
  calculateTier,
  calculateConfidence,
  normalizeGpa,
  parseRange,
  enforceMonotonicity,
  calculateSelectivityIndex,
} from './utils/score-calculator';

// ============================================
// Constants
// ============================================

const CACHE_TTL = 86400; // 24 hours — profile changes trigger invalidation via invalidateUserCache()
const CACHE_PREFIX = 'prediction:';
const DISTRIBUTION_CACHE_TTL = 86400; // 24 hours
const DISTRIBUTION_CACHE_PREFIX = 'school:distribution:';
const CALIBRATION_CACHE_PREFIX = 'prediction:calibration:';
const MODEL_VERSION = 'v3-enterprise';

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

/** 置信区间宽度 (根据 confidence level) */
const CONFIDENCE_INTERVAL_WIDTH = {
  high: 0.08, // ±4%
  medium: 0.14, // ±7%
  low: 0.22, // ±11%
} as const;

// ============================================
// Service
// ============================================

/**
 * Multi-engine ensemble prediction service for college admissions.
 *
 * Combines three prediction engines (statistical, AI, and historical case-matching)
 * using dynamic weighted fusion. Integrates with the memory system for context-aware
 * predictions and records results for calibration feedback loops.
 *
 * Engine weight allocation varies by data availability:
 * - Full data: stats 0.25, AI 0.40, historical 0.35
 * - No history: stats 0.35, AI 0.65
 * - No AI: stats 0.45, historical 0.55
 * - Stats only: stats 1.0
 */
@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  // AI service circuit breaker state
  private aiCircuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    state: 'closed' as 'closed' | 'open' | 'half-open',
    threshold: 5,
    resetTimeout: 60_000,
  };

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private redis: RedisService,
    @Optional() private memoryManager?: MemoryManagerService,
  ) {}

  private isAiCircuitOpen(): boolean {
    if (this.aiCircuitBreaker.state === 'open') {
      if (
        Date.now() - this.aiCircuitBreaker.lastFailureTime >
        this.aiCircuitBreaker.resetTimeout
      ) {
        this.aiCircuitBreaker.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  private recordAiSuccess(): void {
    this.aiCircuitBreaker.failures = 0;
    this.aiCircuitBreaker.state = 'closed';
  }

  private recordAiFailure(): void {
    this.aiCircuitBreaker.failures++;
    this.aiCircuitBreaker.lastFailureTime = Date.now();
    if (this.aiCircuitBreaker.failures >= this.aiCircuitBreaker.threshold) {
      this.aiCircuitBreaker.state = 'open';
      this.logger.warn(
        `AI circuit breaker OPEN after ${this.aiCircuitBreaker.threshold} consecutive failures`,
      );
    }
  }

  // ==================== 缓存管理 ====================

  /**
   * Build a composite Redis cache key for a profile-school prediction pair.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @returns Cache key in the format `prediction:{profileId}:{schoolId}`
   */
  private getCacheKey(profileId: string, schoolId: string): string {
    return `${CACHE_PREFIX}${profileId}:${schoolId}`;
  }

  /**
   * Hash prediction-relevant profile fields for cache key versioning.
   * Ensures stale cache is not served when profile data changes.
   */
  private hashProfileData(profile: {
    gpa?: any;
    gpaScale?: any;
    testScores?: Array<{ type: string; score: number }>;
    activities?: any[];
    awards?: Array<{ level?: string }>;
  }): string {
    const data = JSON.stringify({
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      scores: (profile.testScores || []).map((s) => ({
        t: s.type,
        s: s.score,
      })),
      actCount: (profile.activities || []).length,
      awards: (profile.awards || []).map((a) => a.level).sort(),
    });
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(36);
  }

  /**
   * Retrieve a cached prediction result from Redis.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @returns The cached prediction with `fromCache: true`, or null on miss/error
   */
  private async getFromCache(
    profileId: string,
    schoolId: string,
    profileHash?: string,
  ): Promise<PredictionResultDto | null> {
    try {
      const cached = await this.redis.getJSON<
        PredictionResultDto & { _profileHash?: string }
      >(this.getCacheKey(profileId, schoolId));
      if (cached) {
        // Hash-on-read: treat as cache miss if profile data changed
        if (
          profileHash &&
          cached._profileHash &&
          cached._profileHash !== profileHash
        ) {
          return null;
        }
        const { _profileHash: _, ...result } = cached;
        return { ...result, fromCache: true, cachedAt: result.cachedAt };
      }
    } catch (error) {
      this.logger.warn(`Cache read failed`, error);
    }
    return null;
  }

  /**
   * Persist a prediction result to Redis with a 24-hour TTL.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @param result - The prediction result to cache
   * @param profileHash - Hash of profile data, stored inside the value for stale-on-read detection
   */
  private async saveToCache(
    profileId: string,
    schoolId: string,
    result: PredictionResultDto,
    profileHash?: string,
  ): Promise<void> {
    try {
      await this.redis.setJSON(
        this.getCacheKey(profileId, schoolId),
        {
          ...result,
          cachedAt: new Date().toISOString(),
          _profileHash: profileHash,
        },
        CACHE_TTL,
      );
    } catch (error) {
      this.logger.warn(`Cache write failed`, error);
    }
  }

  /**
   * Invalidate all cached prediction results for a given profile.
   *
   * Looks up every school the profile has predictions for and deletes
   * the corresponding Redis keys. Should be called when profile data changes.
   *
   * @param profileId - The profile whose caches should be invalidated
   */
  async invalidateUserCache(profileId: string): Promise<void> {
    try {
      const predictions = await this.prisma.predictionResult.findMany({
        where: { profileId },
        select: { schoolId: true },
      });
      for (const pred of predictions) {
        await this.redis.del(this.getCacheKey(profileId, pred.schoolId));
      }
      this.logger.log(
        `Invalidated ${predictions.length} prediction caches for profile ${profileId}`,
      );
    } catch (error) {
      this.logger.warn(`Cache invalidation failed`, error);
    }
  }

  // ==================== 数据准备 ====================

  /**
   * 获取学校历史录取数据分布
   * 从已验证的 AdmissionCase 聚合，Redis 缓存 24h
   * 样本量 <30 时返回 null
   */
  private async getSchoolDistribution(
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
  /**
   * 获取历史录取案例统计概率
   * 基于匹配的录取案例直接估算概率
   */
  private async getHistoricalProbability(
    profileMetrics: ProfileMetrics,
    schoolId: string,
  ): Promise<{
    probability: number;
    sampleCount: number;
    confidence: number;
  } | null> {
    // 查找相似条件的案例
    const whereConditions: any[] = [{ schoolId }, { isVerified: true }];

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

  // ==================== 记忆系统集成 ====================

  /**
   * 从记忆系统获取用户上下文（预测前读取）
   *
   * 读取内容:
   * - 用户过去的预测记录和偏好
   * - 已知的学校兴趣和优先级
   * - Profile 历史变化趋势
   */
  private async getMemoryContext(userId: string): Promise<{
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
  /**
   * 将预测结果写入记忆系统（预测后写入，增强版）
   */
  private async recordPredictionToMemory(
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

  // ==================== 数据转换 ====================

  /**
   * Convert a Prisma profile (with relations) to the internal ProfileInput format
   * used by prediction engines and prompt builders.
   *
   * @param profile - Prisma profile with testScores, activities, and awards relations
   * @returns Normalized ProfileInput for prediction calculations
   */
  private profileToInput(profile: ProfileWithRelations): ProfileInput {
    return {
      gpa: profile.gpa ? Number(profile.gpa) : undefined,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      grade: profile.grade ?? undefined,
      currentSchoolType: profile.currentSchoolType ?? undefined,
      targetMajor: profile.targetMajor ?? undefined,
      testScores: (profile.testScores || []).map((s) => ({
        type: s.type,
        score: s.score,
        subScores: s.subScores as Record<string, number> | undefined,
      })),
      activities: (profile.activities || []).map((a) => ({
        category: a.category,
        role: a.role,
        hoursPerWeek: a.hoursPerWeek ?? undefined,
        weeksPerYear: a.weeksPerYear ?? undefined,
      })),
      awards: (profile.awards || []).map((a) => ({
        level: a.level,
        name: a.name,
      })),
    };
  }

  /**
   * Convert a Prisma School entity to the internal SchoolInput format.
   *
   * @param school - Prisma School entity
   * @returns Normalized SchoolInput for prediction calculations
   */
  private schoolToInput(school: School): SchoolInput {
    return {
      id: school.id,
      name: school.name,
      nameZh: school.nameZh ?? undefined,
      acceptanceRate: school.acceptanceRate
        ? Number(school.acceptanceRate)
        : undefined,
      satAvg: school.satAvg ?? undefined,
      sat25: school.sat25 ?? undefined,
      sat75: school.sat75 ?? undefined,
      actAvg: school.actAvg ?? undefined,
      act25: school.act25 ?? undefined,
      act75: school.act75 ?? undefined,
      usNewsRank: school.usNewsRank ?? undefined,
      graduationRate: school.graduationRate
        ? Number(school.graduationRate)
        : undefined,
    };
  }

  /**
   * Extract numeric metrics from a ProfileInput for use in statistical calculations.
   *
   * Pulls SAT, ACT, TOEFL scores from testScores array and counts activities/awards
   * by level (national, international).
   *
   * @param profile - The normalized profile input
   * @returns ProfileMetrics with scores, counts, and award breakdowns
   */
  private extractProfileMetrics(profile: ProfileInput): ProfileMetrics {
    const satScore = profile.testScores.find((s) => s.type === 'SAT')?.score;
    const actScore = profile.testScores.find((s) => s.type === 'ACT')?.score;
    const toeflScore = profile.testScores.find(
      (s) => s.type === 'TOEFL',
    )?.score;

    return {
      gpa: profile.gpa,
      gpaScale: profile.gpaScale,
      satScore,
      actScore,
      toeflScore,
      activityCount: profile.activities.length,
      awardCount: profile.awards.length,
      nationalAwardCount: profile.awards.filter((a) => a.level === 'NATIONAL')
        .length,
      internationalAwardCount: profile.awards.filter(
        (a) => a.level === 'INTERNATIONAL',
      ).length,
    };
  }

  /**
   * Extract numeric metrics from a SchoolInput for use in statistical calculations.
   *
   * @param school - The normalized school input
   * @returns SchoolMetrics including acceptance rate, test score ranges, and ranking
   */
  private extractSchoolMetrics(school: SchoolInput): SchoolMetrics {
    return {
      acceptanceRate: school.acceptanceRate,
      satAvg: school.satAvg,
      sat25: school.sat25,
      sat75: school.sat75,
      actAvg: school.actAvg,
      act25: school.act25,
      act75: school.act75,
      usNewsRank: school.usNewsRank,
    };
  }

  /**
   * Evaluate how complete the available profile and school data is on a 0-100 scale.
   *
   * Profile data contributes up to 60 points: GPA (15), SAT/ACT (15), TOEFL (5),
   * activities (10), awards (10), target major (5). School data contributes up to
   * 40 points: acceptance rate (10), ranking (10), SAT range (10), ACT range (10).
   *
   * @param profile - Normalized profile input
   * @param school - Normalized school input
   * @returns Completeness score from 0 to 100
   */
  /**
   * 评估数据完整度 (0-100)
   */
  private evaluateDataCompleteness(
    profile: ProfileInput,
    school: SchoolInput,
  ): number {
    let score = 0;
    const maxScore = 100;

    // Profile 数据 (60 分)
    if (profile.gpa) score += 15;
    if (profile.testScores.some((s) => s.type === 'SAT' || s.type === 'ACT'))
      score += 15;
    if (profile.testScores.some((s) => s.type === 'TOEFL')) score += 5;
    if (profile.activities.length > 0) score += 10;
    if (profile.awards.length > 0) score += 10;
    if (profile.targetMajor) score += 5;

    // School 数据 (40 分)
    if (school.acceptanceRate) score += 10;
    if (school.graduationRate) score += 10;
    if (school.satAvg || (school.sat25 && school.sat75)) score += 10;
    if (school.actAvg || (school.act25 && school.act75)) score += 10;

    return Math.min(maxScore, score);
  }

  // ==================== 引擎 1: 统计算法 ====================

  /**
   * Engine 1: Statistical prediction algorithm.
   *
   * Computes admission probability from a data-driven score combining GPA (weight 0.3),
   * standardized test scores (0.25), activities (0.25), and awards (0.2). Generates
   * per-factor impact analysis and applicant-vs-school comparison percentiles.
   * Optionally incorporates historical distribution data for percentile adjustments.
   *
   * @param profile - Normalized profile input
   * @param school - Normalized school input
   * @param historicalDistribution - Optional historical admit score distributions for the school
   * @returns Object containing probability (0-1), detailed factors, and comparison data
   */
  private predictWithStats(
    profile: ProfileInput,
    school: SchoolInput,
    historicalDistribution?: HistoricalDistribution,
    locale = 'zh',
  ): {
    probability: number;
    factors: PredictionFactor[];
    comparison: PredictionComparison;
  } {
    const isZh = locale === 'zh';
    const profileMetrics = this.extractProfileMetrics(profile);
    const schoolMetrics = this.extractSchoolMetrics(school);

    const overallScore = calculateOverallScore(
      profileMetrics,
      schoolMetrics,
      historicalDistribution,
    );
    const probability = calculateProbability(overallScore, schoolMetrics);

    // 生成因素分析
    const factors: PredictionFactor[] = [];

    if (profileMetrics.gpa) {
      const normalizedGpa = normalizeGpa(
        profileMetrics.gpa,
        profileMetrics.gpaScale || 4,
      );
      const isGood = normalizedGpa >= 3.7;
      factors.push({
        name: 'GPA',
        impact: isGood
          ? 'positive'
          : normalizedGpa >= 3.3
            ? 'neutral'
            : 'negative',
        weight: 0.3,
        detail: isGood
          ? isZh
            ? `GPA ${normalizedGpa.toFixed(2)} 具有较强竞争力`
            : `GPA of ${normalizedGpa.toFixed(2)} is competitive for ${school.name || school.nameZh}`
          : isZh
            ? `GPA ${normalizedGpa.toFixed(2)} 需要其他方面弥补`
            : `GPA of ${normalizedGpa.toFixed(2)} needs support from other areas`,
        improvement: !isGood
          ? isZh
            ? '建议在剩余学期提高GPA，选修有把握的课程'
            : 'Consider improving GPA in remaining semesters by taking courses you can excel in'
          : undefined,
      });
    } else {
      factors.push({
        name: 'GPA',
        impact: 'negative',
        weight: 0.3,
        detail: isZh
          ? '未提供GPA信息，无法评估学术水平'
          : 'GPA not provided — unable to assess academic standing',
        improvement: isZh
          ? '请在个人档案中填写GPA信息以获得更准确的预测'
          : 'Add your GPA to your profile for a more accurate prediction',
      });
    }

    if (profileMetrics.satScore) {
      const isGood = profileMetrics.satScore >= (schoolMetrics.satAvg || 1400);
      factors.push({
        name: isZh ? '标化成绩' : 'Standardized Test Scores',
        impact: isGood ? 'positive' : 'negative',
        weight: 0.25,
        detail: isGood
          ? isZh
            ? `SAT ${profileMetrics.satScore} 达到或超过学校平均水平`
            : `SAT ${profileMetrics.satScore} meets or exceeds the school average`
          : isZh
            ? `SAT ${profileMetrics.satScore} 略低于学校平均水平`
            : `SAT ${profileMetrics.satScore} is below the school average`,
        improvement: !isGood
          ? isZh
            ? '建议考虑重考SAT或提交ACT成绩'
            : 'Consider retaking the SAT or submitting ACT scores'
          : undefined,
      });
    } else if (!profileMetrics.actScore) {
      factors.push({
        name: isZh ? '标化成绩' : 'Standardized Test Scores',
        impact: 'negative',
        weight: 0.25,
        detail: isZh
          ? '未提供标化成绩，可能会影响整体竞争力'
          : 'No standardized test scores provided, which may reduce competitiveness',
        improvement: isZh
          ? '建议在个人档案中添加SAT/ACT成绩，或说明是否选择test-optional'
          : 'Provide SAT or ACT scores to strengthen your application',
      });
    }

    if (profileMetrics.activityCount > 0) {
      const isGood = profileMetrics.activityCount >= 5;
      factors.push({
        name: isZh ? '活动经历' : 'Extracurricular Activities',
        impact: isGood ? 'positive' : 'neutral',
        weight: 0.25,
        detail: isGood
          ? isZh
            ? `${profileMetrics.activityCount}项活动展示了多元化兴趣`
            : `${profileMetrics.activityCount} activities demonstrate diverse interests`
          : isZh
            ? `${profileMetrics.activityCount}项活动，建议增加深度参与`
            : `${profileMetrics.activityCount} activities — consider deepening your involvement`,
        improvement: !isGood
          ? isZh
            ? '建议在现有活动中发挥领导作用'
            : 'Take on leadership roles in your current activities'
          : undefined,
      });
    } else {
      factors.push({
        name: isZh ? '活动经历' : 'Extracurricular Activities',
        impact: 'negative',
        weight: 0.25,
        detail: isZh
          ? '缺乏课外活动经历，可能会使申请者在综合评估中处于劣势'
          : 'No extracurricular activities may weaken the overall application',
        improvement: isZh
          ? '建议添加课外活动信息，展示学术外的能力和兴趣'
          : 'Add extracurricular activities to showcase skills and interests beyond academics',
      });
    }

    if (profileMetrics.awardCount > 0) {
      const hasTopAwards =
        profileMetrics.nationalAwardCount > 0 ||
        profileMetrics.internationalAwardCount > 0;
      factors.push({
        name: isZh ? '获奖情况' : 'Awards & Honors',
        impact: hasTopAwards ? 'positive' : 'neutral',
        weight: 0.2,
        detail: hasTopAwards
          ? isZh
            ? '拥有国家级或国际级奖项，增强竞争力'
            : 'National or international awards strengthen competitiveness'
          : isZh
            ? `${profileMetrics.awardCount}项奖项，建议争取更高级别奖项`
            : `${profileMetrics.awardCount} awards — aim for higher-level recognition`,
        improvement: !hasTopAwards
          ? isZh
            ? '建议参加含金量较高的学科竞赛'
            : 'Participate in prestigious academic competitions'
          : undefined,
      });
    } else {
      factors.push({
        name: isZh ? '获奖情况' : 'Awards & Honors',
        impact: 'negative',
        weight: 0.2,
        detail: isZh
          ? '没有获奖经历，可能会影响申请的竞争力'
          : 'No awards may affect application competitiveness',
        improvement: isZh
          ? '建议参加学科竞赛或其他有影响力的比赛'
          : 'Participate in academic competitions or other impactful contests',
      });
    }

    // 目标专业竞争力
    if (profile.targetMajor) {
      const competitiveMajors = [
        'Computer Science',
        'Engineering',
        'Business',
        'Pre-Med',
        '计算机科学',
        '工程',
        '商科',
        '医学预科',
      ];
      const isCompetitive = competitiveMajors.some((m) =>
        profile.targetMajor!.toLowerCase().includes(m.toLowerCase()),
      );
      if (isCompetitive) {
        factors.push({
          name: isZh ? '目标专业竞争力' : 'Target Major Competitiveness',
          impact: 'neutral',
          weight: 0.0, // 信息因素，不影响权重
          detail: isZh
            ? `${profile.targetMajor}专业竞争激烈，申请者需要在各方面表现突出`
            : `${profile.targetMajor} is a highly competitive major — strong performance across all areas is needed`,
        });
      }
    }

    // 对比数据
    const comparison: PredictionComparison = {
      gpaPercentile: profileMetrics.gpa
        ? Math.min(
            99,
            Math.round(
              (normalizeGpa(profileMetrics.gpa, profileMetrics.gpaScale || 4) /
                4) *
                100,
            ),
          )
        : 50,
      testScorePercentile: profileMetrics.satScore
        ? Math.max(
            1,
            Math.min(
              99,
              Math.round(((profileMetrics.satScore - 1000) / 600) * 100),
            ),
          )
        : 50,
      activityStrength:
        profileMetrics.activityCount >= 7
          ? 'strong'
          : profileMetrics.activityCount >= 4
            ? 'average'
            : 'weak',
    };

    return { probability, factors, comparison };
  }

  // ==================== 引擎 2: AI 预测 ====================

  /**
   * Engine 2: AI-powered prediction using LLM expert consultation.
   *
   * Builds a structured prompt with profile and school data, injects the statistical
   * engine's probability as a calibration anchor, and appends memory-sourced user insights.
   * The AI response is parsed as JSON and sanity-checked: probability is clamped to [0.05, 0.95]
   * and must not deviate more than 3x from the statistical baseline.
   *
   * @param profile - Normalized profile input
   * @param school - Normalized school input
   * @param statsResult - Statistical engine probability (used as calibration anchor)
   * @param memoryInsights - User context strings from the memory system
   * @returns Parsed AI prediction with probability, factors, suggestions, and comparison; or null on failure
   */
  /**
   * 计算确定性 seed (FNV-1a hash)，确保相同 profile+school 输入始终产生相同 AI 输出。
   */
  private computeSeed(profileId: string, schoolId: string): number {
    const input = `${profileId}:${schoolId}`;
    let hash = 2166136261; // FNV offset basis
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = (hash * 16777619) >>> 0; // FNV prime, keep uint32
    }
    return hash % 2_147_483_647;
  }

  private async predictWithAI(
    profile: ProfileInput,
    school: SchoolInput,
    statsResult: { probability: number },
    memoryInsights: string[],
    locale = 'zh',
    profileId?: string,
  ): Promise<{
    probability: number;
    factors: PredictionFactor[];
    suggestions: string[];
    comparison: PredictionComparison;
  } | null> {
    const prompt = buildPredictionPrompt(profile, school, locale);

    // 注入统计校准锚点和记忆洞察
    let enhancedPrompt = prompt;
    if (locale === 'zh') {
      enhancedPrompt += `\n\n## 统计模型参考（仅供校准，请根据专业判断调整）\n- 统计模型计算的录取概率: ${(statsResult.probability * 100).toFixed(0)}%\n- 请在此基础上结合专业经验给出最终判断，可上下浮动但需有合理依据。`;
    } else {
      enhancedPrompt += `\n\n## Statistical Model Reference (for calibration only)\n- Statistical model probability: ${(statsResult.probability * 100).toFixed(0)}%\n- Adjust based on your professional judgment with reasonable justification.`;
    }

    if (memoryInsights.length > 0) {
      const insightsText = memoryInsights
        .slice(0, 3)
        .map((i) => `- ${i}`)
        .join('\n');
      enhancedPrompt +=
        locale === 'zh'
          ? `\n\n## 用户已知背景信息\n${insightsText}\n\n请将这些额外信息纳入分析。`
          : `\n\n## Known User Background\n${insightsText}\n\nIncorporate this information into your analysis.`;
    }

    const systemPrompt =
      locale === 'zh'
        ? '你是一位资深美国大学招生顾问，拥有20年经验。请始终用中文回复，且只返回有效的JSON。关键要求：录取概率必须根据学校选拔性显著变化——录取率3%的顶尖学校应远低于录取率25%的学校（同一学生档案）。绝不给不同选拔性的学校相同概率。'
        : 'You are an expert college admissions consultant with 20 years of experience. Always respond in English with valid JSON only. CRITICAL: Your probability estimates MUST vary significantly based on school selectivity — a top-5 school with 3% acceptance rate should have MUCH lower probability than a top-50 school with 25% acceptance rate for the same student profile. Never give the same probability for schools with different selectivity levels.';

    try {
      const response = await this.aiService.chat(
        [
          {
            role: 'system',
            content: systemPrompt,
          },
          { role: 'user', content: enhancedPrompt },
        ],
        {
          temperature: 0,
          maxTokens: 1500,
          ...(profileId && { seed: this.computeSeed(profileId, school.id) }),
        },
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      let probability = Number(parsed.probability);

      if (isNaN(probability) || probability < 0 || probability > 1) {
        return null;
      }

      probability = Math.max(0.05, Math.min(0.95, probability));

      // 合理性校验：与统计模型偏差不能超过 1.8 倍
      const statsProb = statsResult.probability;
      if (probability > statsProb * 1.8 && statsProb > 0.05) {
        probability = Math.min(probability, statsProb * 1.8);
      }
      if (probability < statsProb / 1.8 && statsProb < 0.8) {
        probability = Math.max(probability, statsProb / 1.8);
      }

      // 高选拔性学校额外 cap — 防止 AI 对顶尖学校给出过高概率
      const schoolMetrics = this.extractSchoolMetrics(school);
      const selectivity = calculateSelectivityIndex(schoolMetrics);
      if (selectivity > 0.8) {
        const aiCap = 0.4 - (selectivity - 0.8) * 1.0;
        probability = Math.min(probability, Math.max(0.05, aiCap));
      }

      return {
        probability,
        factors: (parsed.factors || []).map((f: any) => ({
          name: f.name || 'Unknown',
          impact: f.impact || 'neutral',
          weight: f.weight || 0,
          detail: f.detail || '',
          improvement: f.improvement || undefined,
        })),
        suggestions: parsed.suggestions || [],
        comparison: parsed.comparison || {
          gpaPercentile: 50,
          testScorePercentile: 50,
          activityStrength: 'average',
        },
      };
    } catch (error) {
      this.logger.warn(`AI prediction failed for school ${school.id}`, error);
      return null;
    }
  }

  // ==================== 引擎融合 ====================

  /**
   * 多引擎融合预测
   *
   * 融合策略:
   * 1. 统计引擎 (always available) — 数据驱动的基准概率
   * 2. AI 引擎 (may fail) — 专家判断 + 定性分析
   * 3. 历史数据引擎 (if sufficient data) — 案例匹配
   * 4. 记忆增强 — 微调 (±2%)
   *
   * 权重动态调整:
   * - 全部可用: stats 0.25 + ai 0.40 + historical 0.35
   * - 无历史数据: stats 0.35 + ai 0.65
   * - AI 失败: stats 0.45 + historical 0.55
   * - 仅统计: stats 1.0
   */
  private fusePredictions(
    statsProbability: number,
    aiProbability: number | null,
    historicalResult: {
      probability: number;
      sampleCount: number;
      confidence: number;
    } | null,
    memoryAdjustment: number,
    confidenceLevel: 'low' | 'medium' | 'high',
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

    if (aiProbability !== null && historicalResult !== null) {
      // 全引擎可用
      weights = { ...ENGINE_WEIGHTS.full };
      // 历史数据权重随样本量调整
      const histConfidence = historicalResult.confidence;
      weights.historical = weights.historical * histConfidence;

      // AI 权重根据跨引擎一致性动态调整
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

      // 重新归一化
      const totalWeight = weights.stats + weights.ai + weights.historical;
      weights.stats /= totalWeight;
      weights.ai /= totalWeight;
      weights.historical /= totalWeight;

      fusedProbability =
        statsProbability * weights.stats +
        aiProbability * weights.ai +
        historicalResult.probability * weights.historical;
    } else if (aiProbability !== null) {
      weights = { ...ENGINE_WEIGHTS.noHistory };

      // AI 权重根据跨引擎一致性动态调整
      crossEngineConsistency = Math.max(
        0,
        1 - Math.abs(aiProbability - statsProbability) / 0.4,
      );
      const aiScale = 0.5 + 0.5 * crossEngineConsistency;
      const originalAiWeight = weights.ai;
      weights.ai *= aiScale;
      weights.stats += originalAiWeight - weights.ai;
      // 重新归一化
      const totalWeight = weights.stats + weights.ai;
      weights.stats /= totalWeight;
      weights.ai /= totalWeight;

      fusedProbability =
        statsProbability * weights.stats + aiProbability * weights.ai;
    } else if (historicalResult !== null) {
      weights = { ...ENGINE_WEIGHTS.noAi };
      fusedProbability =
        statsProbability * weights.stats +
        historicalResult.probability * weights.historical;
    } else {
      weights = { ...ENGINE_WEIGHTS.statsOnly };
      fusedProbability = statsProbability;
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

    return {
      probability: fusedProbability,
      probabilityLow,
      probabilityHigh,
      crossEngineConsistency,
      engineScores: {
        stats: statsProbability,
        ai: aiProbability ?? undefined,
        historical: historicalResult?.probability,
        memoryAdjustment: memoryAdjustment !== 0 ? memoryAdjustment : undefined,
        weights,
        fusionMethod:
          aiProbability !== null && historicalResult !== null
            ? 'weighted_ensemble_3'
            : aiProbability !== null
              ? 'weighted_ensemble_2_ai'
              : historicalResult !== null
                ? 'weighted_ensemble_2_hist'
                : 'stats_only',
      },
    };
  }

  // ==================== 验证 ====================

  /**
   * 批量预测结果验证：在 enforceMonotonicity 之前检测异常。
   */
  private validateBatchResults(results: PredictionResultDto[]): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    // 为每个结果计算 selectivity index
    const withSel = results
      .filter((r) => r.schoolMeta)
      .map((r) => ({
        result: r,
        selectivity: calculateSelectivityIndex(r.schoolMeta as SchoolMetrics),
      }))
      .sort((a, b) => a.selectivity - b.selectivity); // ascending selectivity

    // Check 1: 单调性违反 — 更高选拔性的学校不应该有更高的概率
    for (let i = 0; i < withSel.length - 1; i++) {
      const easier = withSel[i];
      const harder = withSel[i + 1];
      if (
        harder.selectivity > easier.selectivity + 0.05 &&
        harder.result.probability > easier.result.probability + 0.02
      ) {
        violations.push(
          `${harder.result.schoolName}(sel=${harder.selectivity.toFixed(2)},P=${harder.result.probability.toFixed(2)}) > ${easier.result.schoolName}(sel=${easier.selectivity.toFixed(2)},P=${easier.result.probability.toFixed(2)})`,
        );
      }
    }

    // Check 2: 高选拔性学校概率异常偏高
    for (const { result, selectivity } of withSel) {
      if (selectivity > 0.9 && result.probability > 0.45) {
        warnings.push(
          `${result.schoolName}(sel=${selectivity.toFixed(2)}) P=${result.probability.toFixed(2)} unusually high`,
        );
      }
    }

    // Check 3: 概率碰撞 (精度 0.01)
    const probMap = new Map<string, string[]>();
    for (const r of results) {
      const key = r.probability.toFixed(2);
      if (!probMap.has(key)) probMap.set(key, []);
      probMap.get(key)!.push(r.schoolName);
    }
    for (const [prob, schools] of probMap) {
      if (schools.length > 1) {
        warnings.push(`P=${prob} shared by: ${schools.join(', ')}`);
      }
    }

    return { violations, warnings };
  }

  // ==================== 校准 ====================

  /**
   * 基于历史校准数据的 Platt Scaling 修正。
   *
   * 读取已有的 (predicted, actual) 数据点，拟合 sigmoid: calibrated = 1 / (1 + exp(-(a*p + b)))
   * 当校准数据 < 50 条时返回 null，不做修正。
   * 结果缓存 24 小时。
   */
  private async getPlattCalibration(): Promise<{
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
  private applyPlattCalibration(
    probability: number,
    params: { a: number; b: number },
  ): number {
    const z = params.a * probability + params.b;
    const calibrated = 1 / (1 + Math.exp(-z));
    return Math.max(0.05, Math.min(0.95, calibrated));
  }

  // ==================== 主预测方法 ====================

  /**
   * Run the full multi-engine ensemble prediction pipeline for one or more schools.
   *
   * Pipeline stages:
   * 1. Load Profile (with testScores, activities, awards) and School records from DB
   * 2. Retrieve user context from the memory system (past predictions, preferences, insights)
   * 3. For each school: check cache, then run all three engines sequentially
   *    - Engine 1 (Stats): always succeeds, provides baseline probability
   *    - Engine 2 (AI): may fail gracefully, returns null
   *    - Engine 3 (Historical): returns null if < 10 matching cases
   * 4. Fuse engine outputs via dynamic weighted averaging + memory micro-adjustment
   * 5. Compute confidence interval based on data completeness
   * 6. Cache result in Redis (1h TTL), persist to DB via upsert
   * 7. Asynchronously write results to the memory system
   *
   * @param profileId - The profile to predict for
   * @param schoolIds - Array of school IDs to generate predictions for
   * @param forceRefresh - When true, bypass the Redis cache and recompute
   * @returns Array of PredictionResultDto sorted by probability descending
   */
  /**
   * 企业级多引擎融合预测
   *
   * 流程:
   * 1. 加载 Profile + School 数据
   * 2. 从记忆系统获取用户上下文（读取）
   * 3. 对每个学校并行执行三引擎预测
   * 4. 动态加权融合 + 置信区间计算
   * 5. 结果排序 + 缓存 + 持久化
   * 6. 写入记忆系统（增强版）
   */
  async predict(
    profileId: string,
    schoolIds: string[],
    forceRefresh = false,
    locale = 'zh',
  ): Promise<{
    results: PredictionResultDto[];
    dataCompleteness: number;
    memoryContext: {
      previousPredictions: number;
      knownPreferences: string[];
      dataPoints: number;
    };
  }> {
    this.logger.log('Prediction requested', {
      profileId,
      schoolCount: schoolIds.length,
      forceRefresh,
    });

    // Idempotency lock — prevent concurrent identical requests
    const lockKey = `prediction:lock:${profileId}`;
    const acquired = await this.redis.setNX(lockKey, '1', PREDICTION_LOCK_TTL);
    if (!acquired) {
      throw new ConflictException('Prediction already in progress');
    }

    try {
      return await this.predictInternal(
        profileId,
        schoolIds,
        forceRefresh,
        locale,
      );
    } finally {
      await this.redis.del(lockKey);
    }
  }

  private async predictInternal(
    profileId: string,
    schoolIds: string[],
    forceRefresh: boolean,
    locale: string,
  ): Promise<{
    results: PredictionResultDto[];
    dataCompleteness: number;
    memoryContext: {
      previousPredictions: number;
      knownPreferences: string[];
      dataPoints: number;
    };
  }> {
    const emptyMemoryCtx = {
      previousPredictions: 0,
      knownPreferences: [] as string[],
      dataPoints: 0,
    };

    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    if (!profile) {
      return {
        results: [],
        dataCompleteness: 0,
        memoryContext: emptyMemoryCtx,
      };
    }

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });

    const profileInput = this.profileToInput(profile);
    const profileMetrics = this.extractProfileMetrics(profileInput);
    const profileHash = this.hashProfileData(profile);

    // Phase 1.5: 加载 Platt 校准参数（如果有足够校准数据）
    const plattParams = await this.getPlattCalibration();

    // Phase 2: 从记忆系统获取上下文
    const rawMemoryCtx = profile.userId
      ? await this.getMemoryContext(profile.userId)
      : {
          previousPredictions: [],
          knownPreferences: [],
          profileInsights: [],
          memoryAdjustments: new Map<string, number>(),
        };

    // Evaluate data completeness using first school as representative
    let dataCompleteness = 0;
    if (schools.length > 0) {
      const firstSchoolInput = this.schoolToInput(schools[0]);
      dataCompleteness = this.evaluateDataCompleteness(
        profileInput,
        firstSchoolInput,
      );
    }

    // Transform memory context to DTO shape
    const memoryContextDto = {
      previousPredictions: rawMemoryCtx.previousPredictions.length,
      knownPreferences: rawMemoryCtx.knownPreferences,
      dataPoints:
        rawMemoryCtx.previousPredictions.length +
        rawMemoryCtx.knownPreferences.length +
        rawMemoryCtx.profileInsights.length,
    };

    // 分离缓存命中 vs 需要预测的学校
    const results: PredictionResultDto[] = [];
    const schoolsToPredict: typeof schools = [];

    // Build schoolMeta lookup (includes fields needed for selectivity index)
    const schoolMetaMap = new Map<
      string,
      {
        usNewsRank?: number;
        acceptanceRate?: number;
        graduationRate?: number;
        satAvg?: number;
        sat25?: number;
        sat75?: number;
      }
    >();
    for (const s of schools) {
      schoolMetaMap.set(s.id, {
        usNewsRank: s.usNewsRank ?? undefined,
        acceptanceRate:
          s.acceptanceRate != null ? Number(s.acceptanceRate) : undefined,
        graduationRate:
          s.graduationRate != null ? Number(s.graduationRate) : undefined,
        satAvg: s.satAvg ?? undefined,
        sat25: s.sat25 ?? undefined,
        sat75: s.sat75 ?? undefined,
      });
    }

    if (!forceRefresh) {
      for (const school of schools) {
        const cached = await this.getFromCache(
          profileId,
          school.id,
          profileHash,
        );
        if (cached) {
          // Attach schoolMeta to cached results too
          cached.schoolMeta = schoolMetaMap.get(school.id);
          results.push(cached);
        } else {
          schoolsToPredict.push(school);
        }
      }
    } else {
      schoolsToPredict.push(...schools);
    }

    // 并行预测（控制并发上限为 3）
    const CONCURRENCY = 3;
    const freshResults: PredictionResultDto[] = [];

    for (let i = 0; i < schoolsToPredict.length; i += CONCURRENCY) {
      const batch = schoolsToPredict.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((school) =>
          this.predictForSchool(
            profileId,
            profileInput,
            profileMetrics,
            school,
            rawMemoryCtx,
            locale,
            plattParams,
            profileHash,
          ),
        ),
      );

      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          // Attach schoolMeta to fresh results
          outcome.value.schoolMeta = schoolMetaMap.get(outcome.value.schoolId);
          freshResults.push(outcome.value);
        } else {
          this.logger.warn('Prediction failed for a school', outcome.reason);
        }
      }
    }

    results.push(...freshResults);

    // 验证管道：在单调性约束之前检测异常
    const validation = this.validateBatchResults(results);
    if (validation.violations.length > 0) {
      this.logger.warn(
        'Monotonicity violations pre-PAV',
        validation.violations,
      );
    }

    // 单调性约束: 保证 selectivity 更高的学校 probability 更低
    enforceMonotonicity(results);

    // 按概率降序排序
    results.sort((a, b) => b.probability - a.probability);

    const cachedCount = results.filter((r) => r.fromCache).length;
    this.logger.log('Prediction completed', {
      profileId,
      totalSchools: results.length,
      cachedResults: cachedCount,
      freshResults: results.length - cachedCount,
      dataCompleteness,
      avgProbability:
        results.length > 0
          ? Math.round(
              (results.reduce((s, r) => s + r.probability, 0) /
                results.length) *
                100,
            )
          : 0,
    });

    // 写入记忆系统（增强版，异步非阻塞）
    if (this.memoryManager && profile.userId) {
      this.recordPredictionToMemory(
        profile.userId,
        results,
        rawMemoryCtx,
      ).catch((err) => {
        this.logger.warn('Failed to record prediction to memory', err);
      });
    }

    return {
      results,
      dataCompleteness,
      memoryContext: memoryContextDto,
      ...(validation.violations.length > 0 || validation.warnings.length > 0
        ? { validationSummary: validation }
        : {}),
    };
  }

  /**
   * 对单个学校执行三引擎融合预测
   */
  private async predictForSchool(
    profileId: string,
    profileInput: any,
    profileMetrics: any,
    school: any,
    memoryContext: any,
    locale: string,
    plattParams?: { a: number; b: number } | null,
    profileHash?: string,
  ): Promise<PredictionResultDto> {
    const schoolInput = this.schoolToInput(school);
    const schoolMetrics = this.extractSchoolMetrics(schoolInput);

    // 获取历史分布数据
    const historicalDist = await this.getSchoolDistribution(school.id);

    // === 引擎 1: 统计算法 (always runs) ===
    const statsResult = this.predictWithStats(
      profileInput,
      schoolInput,
      historicalDist ?? undefined,
      locale,
    );

    // === 引擎 2: AI 预测 (may fail → null, with circuit breaker + timeout) ===
    let aiResult: Awaited<ReturnType<typeof this.predictWithAI>> = null;
    if (!this.isAiCircuitOpen()) {
      try {
        aiResult = await Promise.race([
          this.predictWithAI(
            profileInput,
            schoolInput,
            { probability: statsResult.probability },
            memoryContext.profileInsights,
            locale,
            profileId,
          ),
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error('AI_PREDICTION_TIMEOUT')),
              AI_PREDICTION_TIMEOUT_MS,
            ),
          ),
        ]);
        if (aiResult) this.recordAiSuccess();
      } catch (err: any) {
        if (err?.message === 'AI_PREDICTION_TIMEOUT') {
          this.logger.warn(
            `AI prediction timed out (${AI_PREDICTION_TIMEOUT_MS}ms) for school ${school.id}`,
          );
        }
        this.recordAiFailure();
        aiResult = null;
      }
    } else {
      this.logger.debug(
        `AI circuit breaker open, skipping AI for school ${school.id}`,
      );
    }

    // === 引擎 3: 历史案例匹配 ===
    const historicalResult = await this.getHistoricalProbability(
      profileMetrics,
      school.id,
    );

    // 记忆增强调整
    const memoryAdjustment =
      memoryContext.memoryAdjustments.get(school.id) || 0;

    // 计算置信度
    const confidenceLevel = calculateConfidence(profileMetrics, schoolMetrics);

    // === 融合 ===
    const fusedResult = this.fusePredictions(
      statsResult.probability,
      aiResult?.probability ?? null,
      historicalResult,
      memoryAdjustment,
      confidenceLevel,
    );

    // Platt scaling 校准（当有足够历史数据时）
    if (plattParams) {
      fusedResult.probability = this.applyPlattCalibration(
        fusedResult.probability,
        plattParams,
      );
      // 重新计算置信区间 — preserve consistency widening
      let intervalWidth = CONFIDENCE_INTERVAL_WIDTH[confidenceLevel];
      intervalWidth *= 1 + (1 - fusedResult.crossEngineConsistency) * 0.5;
      fusedResult.probabilityLow = Math.max(
        0.01,
        fusedResult.probability - intervalWidth / 2,
      );
      fusedResult.probabilityHigh = Math.min(
        0.99,
        fusedResult.probability + intervalWidth / 2,
      );
    }

    // 确定 tier
    const tier = calculateTier(fusedResult.probability, schoolMetrics);

    // 选择最佳 factors (优先 AI，回退 stats)
    const factors = aiResult?.factors?.length
      ? aiResult.factors
      : statsResult.factors;

    // 合并建议
    const suggestions = this.generateSuggestions(
      tier,
      confidenceLevel,
      profileInput,
      schoolInput,
      aiResult?.suggestions,
      locale,
    );

    // 选择最佳 comparison (优先 AI，回退 stats)
    const comparison = aiResult?.comparison || statsResult.comparison;

    const result: PredictionResultDto = {
      schoolId: school.id,
      schoolName:
        locale === 'zh'
          ? school.nameZh || school.name
          : school.name || school.nameZh,
      probability: fusedResult.probability,
      probabilityLow: fusedResult.probabilityLow,
      probabilityHigh: fusedResult.probabilityHigh,
      confidence: confidenceLevel,
      tier,
      factors,
      suggestions,
      comparison,
      engineScores: fusedResult.engineScores,
      crossEngineConsistency: fusedResult.crossEngineConsistency,
      modelVersion: MODEL_VERSION,
    };

    // 保存到缓存
    await this.saveToCache(profileId, school.id, result, profileHash);

    // 保存到数据库
    await this.savePrediction(profileId, school.id, result);

    return result;
  }

  // ==================== 辅助方法 ====================

  /**
   * Generate actionable suggestions based on prediction tier, confidence, and profile gaps.
   *
   * Priority: AI-generated suggestions (up to 3) are included first, followed by
   * tier-specific advice (reach: essay/ED tips; match: maintain strengths; safety: show
   * genuine interest). Low-confidence results trigger a data-completeness reminder.
   * Missing standardized test scores also produce a suggestion. Maximum 5 suggestions returned.
   *
   * @param tier - Admission tier classification ('reach' | 'match' | 'safety')
   * @param confidence - Data confidence level ('low' | 'medium' | 'high')
   * @param profile - Normalized profile input for gap detection
   * @param school - Normalized school input
   * @param aiSuggestions - Optional suggestions produced by the AI engine
   * @returns Array of suggestion strings (max 5)
   */
  /**
   * 生成智能建议
   */
  private generateSuggestions(
    tier: 'reach' | 'match' | 'safety',
    confidence: 'low' | 'medium' | 'high',
    profile: ProfileInput,
    school: SchoolInput,
    aiSuggestions?: string[],
    locale = 'zh',
  ): string[] {
    const isZh = locale === 'zh';
    const suggestions: string[] = [];

    // AI 建议优先
    if (aiSuggestions?.length) {
      suggestions.push(...aiSuggestions.slice(0, 3));
    }

    // 补充通用建议
    if (tier === 'reach') {
      const essayKw = isZh ? '文书' : 'essay';
      if (!suggestions.some((s) => s.toLowerCase().includes(essayKw))) {
        suggestions.push(
          isZh
            ? '作为冲刺校，建议在文书中充分展示独特性和对该校的了解'
            : 'As a reach school, highlight your uniqueness and knowledge of the school in your essays',
        );
      }
      const edKw = isZh ? '早申' : 'ED';
      if (!suggestions.some((s) => s.includes(edKw))) {
        suggestions.push(
          isZh
            ? '考虑通过ED/EA早申请增加录取机会'
            : 'Consider applying ED/EA to improve your chances',
        );
      }
    } else if (tier === 'match') {
      const matchKw = isZh ? '优势' : 'strength';
      if (!suggestions.some((s) => s.toLowerCase().includes(matchKw))) {
        suggestions.push(
          isZh
            ? '作为匹配校，保持现有优势的同时完善申请材料'
            : 'As a match school, maintain your strengths while polishing application materials',
        );
      }
    } else {
      const interestKw = isZh ? '兴趣' : 'interest';
      if (!suggestions.some((s) => s.toLowerCase().includes(interestKw))) {
        suggestions.push(
          isZh
            ? '作为保底校，确保展示对该校的真诚兴趣（Why School文书）'
            : 'As a safety school, show genuine interest in your Why School essay',
        );
      }
    }

    // 数据不足时的建议
    if (confidence === 'low') {
      suggestions.push(
        isZh
          ? '当前预测数据不足，建议完善个人档案以获得更准确的预测结果'
          : 'Prediction data is limited — complete your profile for more accurate results',
      );
    }

    // Profile 缺失项建议
    if (!profile.testScores.some((s) => s.type === 'SAT' || s.type === 'ACT')) {
      const testKw = isZh ? '标化' : 'SAT';
      if (!suggestions.some((s) => s.includes(testKw))) {
        suggestions.push(
          isZh
            ? '添加标化成绩（SAT/ACT）可大幅提高预测准确性'
            : 'Adding SAT/ACT scores can significantly improve prediction accuracy',
        );
      }
    }

    return suggestions.slice(0, 5); // 最多5条
  }

  /**
   * Persist a prediction result to the database using upsert.
   *
   * Creates a new PredictionResult row or updates an existing one keyed by
   * the (profileId, schoolId) compound unique constraint. Stores probability,
   * confidence interval, engine scores, factors, suggestions, and model version.
   * Failures are logged but do not propagate.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @param result - The fully computed prediction result
   */
  /**
   * 保存预测结果到数据库（增强版，使用 upsert）
   */
  private async savePrediction(
    profileId: string,
    schoolId: string,
    result: PredictionResultDto,
  ): Promise<void> {
    try {
      await this.prisma.predictionResult.upsert({
        where: {
          profileId_schoolId: { profileId, schoolId },
        },
        update: {
          probability: result.probability,
          probabilityLow: result.probabilityLow,
          probabilityHigh: result.probabilityHigh,
          factors: result.factors as any,
          tier: result.tier,
          confidence: result.confidence,
          engineScores: result.engineScores as any,
          suggestions: result.suggestions as any,
          comparison: result.comparison as any,
          modelVersion: MODEL_VERSION,
          source: 'prediction',
        },
        create: {
          profileId,
          schoolId,
          probability: result.probability,
          probabilityLow: result.probabilityLow,
          probabilityHigh: result.probabilityHigh,
          factors: result.factors as any,
          tier: result.tier,
          confidence: result.confidence,
          engineScores: result.engineScores as any,
          suggestions: result.suggestions as any,
          comparison: result.comparison as any,
          modelVersion: MODEL_VERSION,
          source: 'prediction',
        },
      });

      // 写入历史快照（用于趋势追踪）
      await this.prisma.predictionSnapshot.create({
        data: {
          profileId,
          schoolId,
          probability: result.probability,
          probabilityLow: result.probabilityLow,
          probabilityHigh: result.probabilityHigh,
          tier: result.tier,
          confidence: result.confidence,
          source: 'prediction',
          modelVersion: MODEL_VERSION,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to save prediction to database', error);
    }
  }

  /**
   * Retrieve the prediction history for a profile, ordered by most recent first.
   *
   * @param profileId - The profile identifier
   * @returns Up to 50 most recent PredictionResult records
   */
  /**
   * 获取预测历史
   */
  async getPredictionHistory(profileId: string) {
    return this.prisma.predictionResult.findMany({
      where: { profileId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Record the actual admission outcome for a previously predicted school.
   *
   * Used to close the calibration feedback loop: actual results are stored alongside
   * predicted probabilities so model accuracy can be measured over time via
   * {@link getCalibrationData}.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @param actualResult - The real admission outcome ('ADMITTED' | 'REJECTED' | 'WAITLISTED')
   */
  /**
   * 报告实际录取结果（用于校准闭环）
   */
  async reportActualResult(
    profileId: string,
    schoolId: string,
    actualResult: 'ADMITTED' | 'REJECTED' | 'WAITLISTED',
  ): Promise<void> {
    try {
      await this.prisma.predictionResult.updateMany({
        where: { profileId, schoolId },
        data: {
          actualResult,
          reportedAt: new Date(),
        },
      });

      this.logger.log(
        `Recorded actual result ${actualResult} for profile ${profileId}, school ${schoolId}`,
      );
    } catch (error) {
      this.logger.warn('Failed to report actual result', error);
    }
  }

  /**
   * Compute model calibration statistics for monitoring and improvement.
   *
   * Aggregates all predictions that have actual outcomes reported, grouping them into
   * five probability buckets (0-20%, 20-40%, 40-60%, 60-80%, 80-100%). For each bucket,
   * calculates the actual admit rate. A well-calibrated model should have actual rates
   * close to the predicted range midpoints.
   *
   * @returns Total prediction count, count with actual results, and per-bucket calibration data
   */
  /**
   * 获取模型校准数据（用于监控和改进）
   */
  async getCalibrationData(): Promise<{
    totalPredictions: number;
    withActualResults: number;
    calibrationBuckets: Array<{
      predictedRange: string;
      actualAdmitRate: number;
      count: number;
    }>;
  }> {
    const total = await this.prisma.predictionResult.count();
    const withResults = await this.prisma.predictionResult.count({
      where: { actualResult: { not: null } },
    });

    // 按概率分桶统计
    const results = await this.prisma.predictionResult.findMany({
      where: { actualResult: { not: null } },
      select: { probability: true, actualResult: true },
    });

    const buckets = [
      { min: 0, max: 0.2, label: '0-20%' },
      { min: 0.2, max: 0.4, label: '20-40%' },
      { min: 0.4, max: 0.6, label: '40-60%' },
      { min: 0.6, max: 0.8, label: '60-80%' },
      { min: 0.8, max: 1.0, label: '80-100%' },
    ];

    const calibrationBuckets = buckets.map((bucket) => {
      const inBucket = results.filter((r) => {
        const p = Number(r.probability);
        return p >= bucket.min && p < bucket.max;
      });
      const admitted = inBucket.filter((r) => r.actualResult === 'ADMITTED');

      return {
        predictedRange: bucket.label,
        actualAdmitRate:
          inBucket.length > 0 ? admitted.length / inBucket.length : 0,
        count: inBucket.length,
      };
    });

    return {
      totalPredictions: total,
      withActualResults: withResults,
      calibrationBuckets,
    };
  }
}
