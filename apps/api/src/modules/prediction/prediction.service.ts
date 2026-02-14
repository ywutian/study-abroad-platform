import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { RedisService } from '../../common/redis/redis.service';
import { MemoryManagerService } from '../ai-agent/memory';
import { MemoryType, EntityType, Prisma, School } from '@prisma/client';

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
} from './utils/score-calculator';

// ============================================
// Constants
// ============================================

const CACHE_TTL = 3600; // 1 hour
const CACHE_PREFIX = 'prediction:';
const DISTRIBUTION_CACHE_TTL = 86400; // 24 hours
const DISTRIBUTION_CACHE_PREFIX = 'school:distribution:';
const CALIBRATION_CACHE_PREFIX = 'prediction:calibration:';
const MODEL_VERSION = 'v2-ensemble';

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

  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private redis: RedisService,
    @Optional() private memoryManager?: MemoryManagerService,
  ) {}

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
   * Retrieve a cached prediction result from Redis.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @returns The cached prediction with `fromCache: true`, or null on miss/error
   */
  private async getFromCache(
    profileId: string,
    schoolId: string,
  ): Promise<PredictionResultDto | null> {
    try {
      const cached = await this.redis.getJSON<PredictionResultDto>(
        this.getCacheKey(profileId, schoolId),
      );
      if (cached) {
        return { ...cached, fromCache: true };
      }
    } catch (error) {
      this.logger.warn(`Cache read failed`, error);
    }
    return null;
  }

  /**
   * Persist a prediction result to Redis with a 1-hour TTL.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @param result - The prediction result to cache
   */
  private async saveToCache(
    profileId: string,
    schoolId: string,
    result: PredictionResultDto,
  ): Promise<void> {
    try {
      await this.redis.setJSON(
        this.getCacheKey(profileId, schoolId),
        result,
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
    if (school.usNewsRank) score += 10;
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
  ): {
    probability: number;
    factors: PredictionFactor[];
    comparison: PredictionComparison;
  } {
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
          ? `GPA ${normalizedGpa.toFixed(2)} 具有较强竞争力`
          : `GPA ${normalizedGpa.toFixed(2)} 需要其他方面弥补`,
        improvement: !isGood
          ? '建议在剩余学期提高GPA，选修有把握的课程'
          : undefined,
      });
    } else {
      factors.push({
        name: 'GPA',
        impact: 'negative',
        weight: 0.3,
        detail: '未提供GPA信息，无法评估学术水平',
        improvement: '请在个人档案中填写GPA信息以获得更准确的预测',
      });
    }

    if (profileMetrics.satScore) {
      const isGood = profileMetrics.satScore >= (schoolMetrics.satAvg || 1400);
      factors.push({
        name: '标化成绩',
        impact: isGood ? 'positive' : 'negative',
        weight: 0.25,
        detail: isGood
          ? `SAT ${profileMetrics.satScore} 达到或超过学校平均水平`
          : `SAT ${profileMetrics.satScore} 略低于学校平均水平`,
        improvement: !isGood ? '建议考虑重考SAT或提交ACT成绩' : undefined,
      });
    } else if (!profileMetrics.actScore) {
      factors.push({
        name: '标化成绩',
        impact: 'negative',
        weight: 0.25,
        detail: '未提供标化成绩，可能会影响整体竞争力',
        improvement:
          '建议在个人档案中添加SAT/ACT成绩，或说明是否选择test-optional',
      });
    }

    if (profileMetrics.activityCount > 0) {
      const isGood = profileMetrics.activityCount >= 5;
      factors.push({
        name: '活动经历',
        impact: isGood ? 'positive' : 'neutral',
        weight: 0.25,
        detail: isGood
          ? `${profileMetrics.activityCount}项活动展示了多元化兴趣`
          : `${profileMetrics.activityCount}项活动，建议增加深度参与`,
        improvement: !isGood ? '建议在现有活动中发挥领导作用' : undefined,
      });
    } else {
      factors.push({
        name: '活动经历',
        impact: 'negative',
        weight: 0.25,
        detail: '缺乏课外活动经历，可能会使申请者在综合评估中处于劣势',
        improvement: '建议添加课外活动信息，展示学术外的能力和兴趣',
      });
    }

    if (profileMetrics.awardCount > 0) {
      const hasTopAwards =
        profileMetrics.nationalAwardCount > 0 ||
        profileMetrics.internationalAwardCount > 0;
      factors.push({
        name: '获奖情况',
        impact: hasTopAwards ? 'positive' : 'neutral',
        weight: 0.2,
        detail: hasTopAwards
          ? `拥有国家级或国际级奖项，增强竞争力`
          : `${profileMetrics.awardCount}项奖项，建议争取更高级别奖项`,
        improvement: !hasTopAwards ? '建议参加含金量较高的学科竞赛' : undefined,
      });
    } else {
      factors.push({
        name: '获奖情况',
        impact: 'negative',
        weight: 0.2,
        detail: '没有获奖经历，可能会影响申请的竞争力',
        improvement: '建议参加学科竞赛或其他有影响力的比赛',
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
          name: '目标专业竞争力',
          impact: 'neutral',
          weight: 0.0, // 信息因素，不影响权重
          detail: `${profile.targetMajor}专业竞争激烈，申请者需要在各方面表现突出`,
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
        ? Math.min(
            99,
            Math.round(((profileMetrics.satScore - 1000) / 600) * 100),
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
  private async predictWithAI(
    profile: ProfileInput,
    school: SchoolInput,
    statsResult: { probability: number },
    memoryInsights: string[],
  ): Promise<{
    probability: number;
    factors: PredictionFactor[];
    suggestions: string[];
    comparison: PredictionComparison;
  } | null> {
    const prompt = buildPredictionPrompt(profile, school);

    // 注入统计校准锚点和记忆洞察
    let enhancedPrompt = prompt;
    enhancedPrompt += `\n\n## 统计模型参考（仅供校准，请根据专业判断调整）\n- 统计模型计算的录取概率: ${(statsResult.probability * 100).toFixed(0)}%\n- 请在此基础上结合专业经验给出最终判断，可上下浮动但需有合理依据。`;

    if (memoryInsights.length > 0) {
      enhancedPrompt += `\n\n## 用户已知背景信息\n${memoryInsights
        .slice(0, 3)
        .map((i) => `- ${i}`)
        .join('\n')}\n\n请将这些额外信息纳入分析。`;
    }

    try {
      const response = await this.aiService.chat(
        [
          {
            role: 'system',
            content:
              'You are an expert college admissions consultant with 20 years of experience. Always respond with valid JSON only. CRITICAL: Your probability estimates MUST vary significantly based on school selectivity — a top-5 school with 3% acceptance rate should have MUCH lower probability than a top-50 school with 25% acceptance rate for the same student profile. Never give the same probability for schools with different selectivity levels.',
          },
          { role: 'user', content: enhancedPrompt },
        ],
        { temperature: 0.3, maxTokens: 1500 },
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      let probability = Number(parsed.probability);

      if (isNaN(probability) || probability < 0 || probability > 1) {
        return null;
      }

      probability = Math.max(0.05, Math.min(0.95, probability));

      // 合理性校验：与统计模型偏差不能超过 3 倍
      const statsProb = statsResult.probability;
      if (probability > statsProb * 3 && statsProb > 0.05) {
        probability = Math.min(probability, statsProb * 2.5);
      }
      if (probability < statsProb / 3 && statsProb < 0.8) {
        probability = Math.max(probability, statsProb / 2.5);
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
    engineScores: EngineScores;
  } {
    let weights: Record<string, number>;
    let fusedProbability: number;

    if (aiProbability !== null && historicalResult !== null) {
      // 全引擎可用
      weights = { ...ENGINE_WEIGHTS.full };
      // 历史数据权重随样本量调整
      const histConfidence = historicalResult.confidence;
      weights.historical = weights.historical * histConfidence;
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

    // 计算置信区间
    const intervalWidth = CONFIDENCE_INTERVAL_WIDTH[confidenceLevel];
    const probabilityLow = Math.max(0.01, fusedProbability - intervalWidth / 2);
    const probabilityHigh = Math.min(
      0.99,
      fusedProbability + intervalWidth / 2,
    );

    return {
      probability: fusedProbability,
      probabilityLow,
      probabilityHigh,
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
  ): Promise<PredictionResultDto[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        testScores: true,
        activities: true,
        awards: { include: { competition: true } },
      },
    });

    if (!profile) return [];

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
    });

    const profileInput = this.profileToInput(profile);
    const profileMetrics = this.extractProfileMetrics(profileInput);

    // Phase 2: 从记忆系统获取上下文
    const memoryContext = profile.userId
      ? await this.getMemoryContext(profile.userId)
      : {
          previousPredictions: [],
          knownPreferences: [],
          profileInsights: [],
          memoryAdjustments: new Map<string, number>(),
        };

    const results: PredictionResultDto[] = [];

    for (const school of schools) {
      // 检查缓存
      if (!forceRefresh) {
        const cached = await this.getFromCache(profileId, school.id);
        if (cached) {
          results.push(cached);
          continue;
        }
      }

      const schoolInput = this.schoolToInput(school);
      const schoolMetrics = this.extractSchoolMetrics(schoolInput);

      // 获取历史分布数据
      const historicalDist = await this.getSchoolDistribution(school.id);

      // === 引擎 1: 统计算法 (always runs) ===
      const statsResult = this.predictWithStats(
        profileInput,
        schoolInput,
        historicalDist ?? undefined,
      );

      // === 引擎 2: AI 预测 (may fail → null) ===
      const aiResult = await this.predictWithAI(
        profileInput,
        schoolInput,
        { probability: statsResult.probability },
        memoryContext.profileInsights,
      );

      // === 引擎 3: 历史案例匹配 ===
      const historicalResult = await this.getHistoricalProbability(
        profileMetrics,
        school.id,
      );

      // 记忆增强调整
      const memoryAdjustment =
        memoryContext.memoryAdjustments.get(school.id) || 0;

      // 计算置信度
      const confidenceLevel = calculateConfidence(
        profileMetrics,
        schoolMetrics,
      );

      // === 融合 ===
      const fusedResult = this.fusePredictions(
        statsResult.probability,
        aiResult?.probability ?? null,
        historicalResult,
        memoryAdjustment,
        confidenceLevel,
      );

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
      );

      // 选择最佳 comparison (优先 AI，回退 stats)
      const comparison = aiResult?.comparison || statsResult.comparison;

      const result: PredictionResultDto = {
        schoolId: school.id,
        schoolName: school.nameZh || school.name,
        probability: fusedResult.probability,
        probabilityLow: fusedResult.probabilityLow,
        probabilityHigh: fusedResult.probabilityHigh,
        confidence: confidenceLevel,
        tier,
        factors,
        suggestions,
        comparison,
        engineScores: fusedResult.engineScores,
        modelVersion: MODEL_VERSION,
      };

      // 保存到缓存
      await this.saveToCache(profileId, school.id, result);

      // 保存到数据库
      await this.savePrediction(profileId, school.id, result);

      results.push(result);
    }

    // 按概率降序排序
    results.sort((a, b) => b.probability - a.probability);

    // 写入记忆系统（增强版，异步非阻塞）
    if (this.memoryManager && profile.userId) {
      this.recordPredictionToMemory(
        profile.userId,
        results,
        memoryContext,
      ).catch((err) => {
        this.logger.warn('Failed to record prediction to memory', err);
      });
    }

    return results;
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
  ): string[] {
    const suggestions: string[] = [];

    // AI 建议优先
    if (aiSuggestions?.length) {
      suggestions.push(...aiSuggestions.slice(0, 3));
    }

    // 补充通用建议
    if (tier === 'reach') {
      if (!suggestions.some((s) => s.includes('文书'))) {
        suggestions.push(
          '作为冲刺校，建议在文书中充分展示独特性和对该校的了解',
        );
      }
      if (!suggestions.some((s) => s.includes('早申'))) {
        suggestions.push('考虑通过ED/EA早申请增加录取机会');
      }
    } else if (tier === 'match') {
      if (!suggestions.some((s) => s.includes('优势'))) {
        suggestions.push('作为匹配校，保持现有优势的同时完善申请材料');
      }
    } else {
      if (!suggestions.some((s) => s.includes('兴趣'))) {
        suggestions.push(
          '作为保底校，确保展示对该校的真诚兴趣（Why School文书）',
        );
      }
    }

    // 数据不足时的建议
    if (confidence === 'low') {
      suggestions.push(
        '当前预测数据不足，建议完善个人档案以获得更准确的预测结果',
      );
    }

    // Profile 缺失项建议
    if (!profile.testScores.some((s) => s.type === 'SAT' || s.type === 'ACT')) {
      if (!suggestions.some((s) => s.includes('标化'))) {
        suggestions.push('添加标化成绩（SAT/ACT）可大幅提高预测准确性');
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
