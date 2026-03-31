import {
  Injectable,
  Logger,
  Optional,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CASE_REVIEW_APPROVED_WHERE } from '../../common/constants/prisma-selects';
import { fireAndForget } from '../../common/utils/async.util';
import { CaseIncentiveService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';
import { PREDICTION_LOCK_TTL } from './prediction-error';

import { PredictionResultDto } from './dto';
import { clampPercentRate } from '../../common/utils/percent.util';
import { ProfileInput, SchoolInput } from './prediction.prompts';
import { classifyMajor, MAJOR_CATEGORY_PROGRAMS } from './prediction.constants';
import {
  ProfileMetrics,
  SchoolMetrics,
  HistoricalDistribution,
  calculateTier,
  calculateConfidence,
  enforceMonotonicity,
  calculateSelectivityIndex,
} from './utils/score-calculator';
import {
  extractFeatureVector,
  imputeFeatures,
  featureVectorToArray,
  predict as mlPredict,
  predictGBDT,
  explainPrediction,
  resolveMajorToCip,
  CIP_NAMES,
} from '@study-abroad/shared/scoring';
import type { TrainedModel } from '@study-abroad/shared/scoring';
import { ModelRegistryService } from './ml/model-registry.service';
import { ShadowEvaluatorService } from './ml/shadow-evaluator.service';
import { ModelMonitorService } from './ml/model-monitor.service';
import { getSelectivityBand } from './ml/tier-strategy';
import { PredictionTransformerService } from './prediction-transformer.service';
import { PredictionStatisticalEngine } from './prediction-statistical-engine.service';
import { PredictionAiEngine } from './prediction-ai-engine.service';
import { PredictionFusionEngine } from './prediction-fusion-engine.service';
import { PredictionCacheService } from './prediction-cache.service';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionHistoricalService } from './prediction-historical.service';
import { PredictionMemoryService } from './prediction-memory.service';
import { PredictionPersistenceService } from './prediction-persistence.service';
import { PredictionReportingService } from './prediction-reporting.service';

// ============================================
// Constants
// ============================================

const MODEL_VERSION = 'v3-enterprise';

/** 置信区间宽度 (根据 confidence level) — kept locally for Platt recalibration */
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
    private redis: RedisService,
    private transformer: PredictionTransformerService,
    private statisticalEngine: PredictionStatisticalEngine,
    private aiEngine: PredictionAiEngine,
    private fusionEngine: PredictionFusionEngine,
    private cacheService: PredictionCacheService,
    private calibrationService: PredictionCalibrationService,
    private historicalService: PredictionHistoricalService,
    private memoryService: PredictionMemoryService,
    private persistenceService: PredictionPersistenceService,
    private reportingService: PredictionReportingService,
    @Optional() private caseIncentiveService?: CaseIncentiveService,
    @Optional() private modelRegistry?: ModelRegistryService,
    @Optional() private shadowEvaluator?: ShadowEvaluatorService,
    @Optional() private modelMonitor?: ModelMonitorService,
  ) {}

  // ==================== School Calibration (delegated to PredictionCalibrationService) ====================

  /** @deprecated Use PredictionCalibrationService.getSchoolCalibrations() directly */
  private async getSchoolCalibrations(): Promise<Record<string, number>> {
    return this.calibrationService.getSchoolCalibrations();
  }

  /** @deprecated Use PredictionCalibrationService.invalidateCalibrationCache() directly */
  async invalidateCalibrationCache(): Promise<void> {
    return this.calibrationService.invalidateCalibrationCache();
  }

  // ==================== 缓存管理 (delegated to PredictionCacheService) ====================

  /** @deprecated Use PredictionCacheService.hashProfileData() directly */
  private hashProfileData(profile: any): string {
    return this.cacheService.hashProfileData(profile);
  }

  /** @deprecated Use PredictionCacheService.getFromCache() directly */
  private async getFromCache(
    profileId: string,
    schoolId: string,
    profileHash?: string,
  ): Promise<PredictionResultDto | null> {
    return this.cacheService.getFromCache(profileId, schoolId, profileHash);
  }

  /** @deprecated Use PredictionCacheService.saveToCache() directly */
  private async saveToCache(
    profileId: string,
    schoolId: string,
    result: PredictionResultDto,
    profileHash?: string,
  ): Promise<void> {
    return this.cacheService.saveToCache(
      profileId,
      schoolId,
      result,
      profileHash,
    );
  }

  /**
   * Invalidate all cached prediction results for a given profile.
   */
  async invalidateUserCache(profileId: string): Promise<void> {
    try {
      const predictions = await this.prisma.predictionResult.findMany({
        where: { profileId },
        select: { schoolId: true },
      });
      await this.cacheService.invalidateUserCache(
        profileId,
        predictions.map((p) => p.schoolId),
      );
    } catch (error) {
      this.logger.warn(`Cache invalidation failed`, error);
    }
  }

  // ==================== 数据准备 (delegated to PredictionHistoricalService) ====================

  /** @deprecated Use PredictionHistoricalService.getSchoolDistribution() directly */
  private async getSchoolDistribution(schoolId: string) {
    return this.historicalService.getSchoolDistribution(schoolId);
  }

  /** @deprecated Use PredictionHistoricalService.getHistoricalProbability() directly */
  private async getHistoricalProbability(
    profileMetrics: any,
    schoolId: string,
  ) {
    return this.historicalService.getHistoricalProbability(
      profileMetrics,
      schoolId,
    );
  }

  // ==================== 记忆系统集成 (delegated to PredictionMemoryService) ====================

  /** @deprecated Use PredictionMemoryService.getMemoryContext() directly */
  private async getMemoryContext(userId: string) {
    return this.memoryService.getMemoryContext(userId);
  }

  /** @deprecated Use PredictionMemoryService.recordPredictionToMemory() directly */
  private async recordPredictionToMemory(
    userId: string,
    results: PredictionResultDto[],
    memoryContext: { previousPredictions: any[]; knownPreferences: string[] },
  ): Promise<void> {
    return this.memoryService.recordPredictionToMemory(
      userId,
      results,
      memoryContext,
    );
  }

  /** @deprecated Use PredictionMemoryService.recordBridgePredictionToMemory() directly */
  async recordBridgePredictionToMemory(
    userId: string,
    schools: Array<{ name: string; probability: number; tier: string }>,
    source: string,
  ): Promise<void> {
    return this.memoryService.recordBridgePredictionToMemory(
      userId,
      schools,
      source,
    );
  }

  // ==================== 数据转换 (delegated to PredictionTransformerService) ====================

  /** @deprecated Use PredictionTransformerService.profileToInput() directly */
  private profileToInput(
    profile: any,
    assessmentData?: { mbtiType?: string; hollandCodes?: string[] },
  ): ProfileInput {
    return this.transformer.profileToInput(profile, assessmentData);
  }

  /** @deprecated Use PredictionTransformerService.schoolToInput() directly */
  private schoolToInput(school: any): SchoolInput {
    return this.transformer.schoolToInput(school);
  }

  /** @deprecated Use PredictionTransformerService.extractProfileMetrics() directly */
  private extractProfileMetrics(profile: ProfileInput): ProfileMetrics {
    return this.transformer.extractProfileMetrics(profile);
  }

  /** @deprecated Use PredictionTransformerService.extractSchoolMetrics() directly */
  private extractSchoolMetrics(school: SchoolInput): SchoolMetrics {
    return this.transformer.extractSchoolMetrics(school);
  }

  /** @deprecated Use PredictionTransformerService.evaluateDataCompleteness() directly */
  private evaluateDataCompleteness(
    profile: ProfileInput,
    school: SchoolInput,
  ): number {
    return this.transformer.evaluateDataCompleteness(profile, school);
  }

  // ==================== 引擎 1: 统计算法 (delegated to PredictionStatisticalEngine) ====================

  /** @deprecated Use PredictionStatisticalEngine.predictWithStats() directly */
  private predictWithStats(
    profile: ProfileInput,
    school: SchoolInput,
    historicalDistribution?: HistoricalDistribution,
    locale = 'zh',
  ) {
    return this.statisticalEngine.predictWithStats(
      profile,
      school,
      historicalDistribution,
      locale,
    );
  }

  // ==================== 引擎 2: AI 预测 (delegated to PredictionAiEngine) ====================

  /** @deprecated Use PredictionAiEngine.predictWithAI() directly */
  private async predictWithAI(
    profile: ProfileInput,
    school: SchoolInput,
    statsResult: { probability: number },
    memoryInsights: string[],
    locale = 'zh',
    profileId?: string,
    nationalityStats?: import('./prediction.prompts').NationalityStats,
    dataCompleteness?: number,
  ) {
    return this.aiEngine.predictWithAI(
      profile,
      school,
      statsResult,
      memoryInsights,
      locale,
      profileId,
      nationalityStats,
      dataCompleteness,
    );
  }

  // ==================== 引擎融合 (delegated to PredictionFusionEngine) ====================

  /** @deprecated Use PredictionFusionEngine.fusePredictions() directly */
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
    mlProbability: number | null = null,
  ) {
    return this.fusionEngine.fusePredictions(
      statsProbability,
      aiProbability,
      historicalResult,
      memoryAdjustment,
      confidenceLevel,
      mlProbability,
    );
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

    // Check 3: 概率碰撞 (精度 0.01 + 0.1 双重检测)
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
    // Coarse collision detection (1 decimal place)
    const coarseMap = new Map<string, string[]>();
    for (const r of results) {
      const key = r.probability.toFixed(1);
      if (!coarseMap.has(key)) coarseMap.set(key, []);
      coarseMap.get(key)!.push(r.schoolName);
    }
    for (const [prob, schools] of coarseMap) {
      if (schools.length > 2) {
        warnings.push(
          `P≈${prob} cluster (${schools.length} schools): ${schools.join(', ')}`,
        );
      }
    }

    return { violations, warnings };
  }

  // ==================== 校准 (delegated to PredictionCalibrationService) ====================

  /** @deprecated Use PredictionCalibrationService.getPlattCalibration() directly */
  private async getPlattCalibration() {
    return this.calibrationService.getPlattCalibration();
  }

  /** @deprecated Use PredictionCalibrationService.applyPlattCalibration() directly */
  private applyPlattCalibration(
    probability: number,
    params: { a: number; b: number },
  ): number {
    return this.calibrationService.applyPlattCalibration(probability, params);
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
   * 6. Cache result in Redis (24h TTL), persist to DB via upsert
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

    // 扣除积分
    let chargedUserId: string | undefined;
    if (this.caseIncentiveService) {
      const profile = await this.prisma.profile.findUnique({
        where: { id: profileId },
        select: { userId: true },
      });
      if (profile?.userId) {
        await this.caseIncentiveService.charge(
          profile.userId,
          PointAction.AI_ANALYSIS,
        );
        chargedUserId = profile.userId;
      }
    }

    // Idempotency lock — prevent concurrent identical requests
    const lockKey = `prediction:lock:${profileId}`;
    const acquired = await this.redis.setNX(lockKey, '1', PREDICTION_LOCK_TTL);
    if (!acquired) {
      // 退还积分（被锁定说明有并发请求）
      if (chargedUserId) {
        await safeRefund(
          this.caseIncentiveService!,
          chargedUserId,
          PointAction.AI_ANALYSIS,
          this.logger,
        );
      }
      throw new ConflictException('Prediction already in progress');
    }

    try {
      return await this.predictInternal(
        profileId,
        schoolIds,
        forceRefresh,
        locale,
      );
    } catch (error) {
      // 退还积分
      if (chargedUserId) {
        await safeRefund(
          this.caseIncentiveService!,
          chargedUserId,
          PointAction.AI_ANALYSIS,
          this.logger,
        );
      }
      throw error;
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
        activities: {
          orderBy: { order: 'asc' },
          include: { activityTemplate: true },
        },
        awards: { include: { competition: true } },
        education: { include: { highSchool: true } },
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

    // Load user's application round per school (ED, EA, RD, etc.)
    const schoolListItems = await this.prisma.schoolListItem.findMany({
      where: { userId: profile.userId, schoolId: { in: schoolIds } },
      select: { schoolId: true, round: true },
    });
    const roundMap = new Map(
      schoolListItems.map((item) => [item.schoolId, item.round]),
    );

    // Fetch latest MBTI and Holland assessment results for profile enrichment
    const assessmentResults = await this.prisma.assessmentResult.findMany({
      where: { userId: profile.userId },
      include: { assessment: { select: { type: true } } },
      orderBy: { completedAt: 'desc' },
    });
    const mbtiResult = assessmentResults.find(
      (r) => r.assessment.type === 'MBTI',
    );
    const hollandResult = assessmentResults.find(
      (r) => r.assessment.type === 'HOLLAND',
    );
    const assessmentData =
      mbtiResult || hollandResult
        ? {
            mbtiType: (mbtiResult?.result as any)?.mbtiType,
            hollandCodes: (hollandResult?.result as any)?.hollandCodes,
          }
        : undefined;

    const profileInput = this.profileToInput(profile, assessmentData);

    // Enrich with essay quality score (G8) — non-blocking optional enrichment
    await this.transformer.enrichWithEssayQuality(profileInput, profile.id);

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
        intlAcceptanceRate?: number;
        intlStudentPct?: number;
        needBlindInternational?: boolean;
        graduationRate?: number;
        satAvg?: number;
        sat25?: number;
        sat75?: number;
      }
    >();
    for (const s of schools) {
      schoolMetaMap.set(s.id, {
        usNewsRank: s.usNewsRank ?? undefined,
        acceptanceRate: clampPercentRate(s.acceptanceRate),
        intlAcceptanceRate: clampPercentRate((s as any).intlAcceptanceRate),
        intlStudentPct: (s as any).intlStudentPct
          ? Number((s as any).intlStudentPct)
          : undefined,
        needBlindInternational: (s as any).needBlindInternational || undefined,
        graduationRate: clampPercentRate(s.graduationRate),
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

    // Batch prefetch SchoolProgram data for user's target major
    const targetCip = profileInput.targetMajor
      ? resolveMajorToCip(profileInput.targetMajor)
      : null;
    const programMap = new Map<string, any>();
    if (targetCip) {
      const allSchoolIds = schools.map((s) => s.id);
      const programs = await this.prisma.schoolProgram.findMany({
        where: { cipCode: targetCip, schoolId: { in: allSchoolIds } },
      });
      for (const p of programs) programMap.set(p.schoolId, p);
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
            programMap.get(school.id),
            dataCompleteness,
            roundMap.get(school.id) || undefined,
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

    // 学校级校准：从 DB 加载 SchoolCalibration 乘数（如 BU 过严时可设 >1）
    const calibrationMap = await this.getSchoolCalibrations();
    for (const r of results) {
      const adj = calibrationMap[r.schoolId];
      if (adj != null && adj > 0) {
        r.probability = Math.min(0.98, r.probability * adj);
        if (r.probabilityLow != null)
          r.probabilityLow = Math.min(0.98, r.probabilityLow * adj);
        if (r.probabilityHigh != null)
          r.probabilityHigh = Math.min(0.98, r.probabilityHigh * adj);
      }
    }

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
    if (profile.userId) {
      fireAndForget(
        this.recordPredictionToMemory(profile.userId, results, rawMemoryCtx),
        this.logger,
        'Failed to record prediction to memory',
      );
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
    programData?: any,
    dataCompleteness?: number,
    applicationRound?: string,
  ): Promise<PredictionResultDto> {
    const schoolInput = this.schoolToInput(school);

    // Inject application round from user's school list
    if (applicationRound) {
      schoolInput.applicationRound = applicationRound;
    }
    const schoolMetrics = this.extractSchoolMetrics(schoolInput);

    // Inject major competitiveness into profileInput for prompt builder
    if (programData) {
      const cipInfo = CIP_NAMES[programData.cipCode];
      profileInput = {
        ...profileInput,
        majorCompetitiveness: {
          name: cipInfo?.en || programData.programName,
          level: programData.competitiveness,
          schoolEstimate: programData.acceptanceRateEstimate
            ? Number(programData.acceptanceRateEstimate)
            : undefined,
        },
      };
    }

    // 获取历史分布数据
    const historicalDist = await this.getSchoolDistribution(school.id);

    // === 引擎 1: 统计算法 (always runs) ===
    const statsResult = this.predictWithStats(
      profileInput,
      schoolInput,
      historicalDist ?? undefined,
      locale,
    );

    // === Nationality-specific historical stats (for international students) ===
    const nationalityStats =
      profileInput.isInternational && profileInput.nationality
        ? await this.historicalService.getNationalityStats(
            school.id,
            profileInput.nationality,
          )
        : null;

    // === 引擎 2: AI 预测 (may fail → null, resilience handled by LLMService) ===
    let aiResult: Awaited<ReturnType<typeof this.predictWithAI>> = null;
    try {
      aiResult = await this.predictWithAI(
        profileInput,
        schoolInput,
        { probability: statsResult.probability },
        memoryContext.profileInsights,
        locale,
        profileId,
        nationalityStats ?? undefined,
        dataCompleteness,
      );
    } catch (err: any) {
      this.logger.warn(
        `AI prediction failed for school ${school.id}: ${err?.message}`,
      );
      aiResult = null;
    }

    // === 引擎 3: 历史案例匹配 ===
    const historicalResult = await this.getHistoricalProbability(
      profileMetrics,
      school.id,
    );

    // === Feeder 信号 ===
    const feederSignal =
      profileInput.highSchoolId && schoolInput.acceptanceRate
        ? await this.historicalService.getFeederSignal(
            profileInput.highSchoolId,
            school.id,
            schoolInput.acceptanceRate,
          )
        : null;

    // === 引擎 4: ML Model (Tier 2+) ===
    let mlResult: {
      probability: number;
      modelTier: number;
      contributions?: Array<{
        feature: string;
        contribution: number;
        direction: 'positive' | 'negative';
      }>;
    } | null = null;

    if (this.modelRegistry) {
      try {
        const selectivityBand = getSelectivityBand(
          calculateSelectivityIndex(schoolMetrics),
        );
        // Try band-specific model first, fall back to global
        const championModel =
          (await this.modelRegistry.getChampionModel(selectivityBand)) ??
          (await this.modelRegistry.getChampionModel(null));

        if (championModel) {
          const fv = extractFeatureVector(profileMetrics, schoolMetrics, {
            activityDetails: profileMetrics.activityDetails,
            isPrivateSchool: school.isPrivate,
            tuition: school.tuition,
            usNewsRank: school.usNewsRank,
          });

          const modelTyped = championModel;
          const featureMedians =
            'featureMedians' in modelTyped ? modelTyped.featureMedians : {};
          const imputed = imputeFeatures(fv, featureMedians);

          let prob: number;
          let contributions:
            | Array<{
                feature: string;
                contribution: number;
                direction: 'positive' | 'negative';
              }>
            | undefined;

          if ('trees' in modelTyped) {
            // GBDT model
            const featureArray = featureVectorToArray(
              imputed,
              modelTyped.featureNames as any,
            );
            prob = predictGBDT(modelTyped, featureArray);
          } else {
            // Logistic regression model
            const lrModel = modelTyped;
            const featureArray = featureVectorToArray(
              imputed,
              lrModel.featureNames as any,
            );
            prob = mlPredict(lrModel, featureArray);
            contributions = explainPrediction(lrModel, featureArray).map(
              (c: any) => ({
                feature: c.feature,
                contribution: c.contribution,
                direction: c.direction,
              }),
            );
          }

          const tier =
            'metadata' in modelTyped
              ? (modelTyped as TrainedModel).metadata.tier
              : 4;
          mlResult = {
            probability: Math.max(0.05, Math.min(0.95, prob)),
            modelTier: tier,
            contributions,
          };

          // Shadow evaluation (non-blocking)
          if (this.shadowEvaluator) {
            const featureArray = featureVectorToArray(
              imputed,
              ('featureNames' in modelTyped
                ? modelTyped.featureNames
                : []) as any,
            );
            this.shadowEvaluator
              .runIfActive(featureArray, mlResult.probability, selectivityBand)
              .catch(() => {
                /* swallow */
              });
          }

          // Record prediction for drift monitoring (non-blocking)
          if (this.modelMonitor) {
            this.modelMonitor
              .recordPrediction(mlResult.probability)
              .catch(() => {
                /* swallow */
              });
          }
        }
      } catch (err) {
        this.logger.debug(
          `ML prediction skipped: ${String(err instanceof Error ? err.message : err)}`,
        );
      }
    }

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
      mlResult?.probability ?? null,
    );

    // Platt scaling 校准（当有足够历史数据时）
    // Skip Platt when ML champion is active — ML logistic output is already calibrated
    if (plattParams && !mlResult) {
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

    // Apply major competitiveness modifier (softened — intl selectivity already accounts
    // for competition; aggressive modifiers double-penalize international applicants)
    const MAJOR_MODIFIERS: Record<number, number> = {
      5: 0.82,
      4: 0.92,
      3: 1.0,
      2: 1.05,
      1: 1.1,
    };
    let majorBreakdownResult: any = undefined;
    if (programData) {
      const modifier = MAJOR_MODIFIERS[programData.competitiveness] ?? 1.0;
      const _preMajorProb = fusedResult.probability;
      fusedResult.probability = Math.max(
        0.05,
        Math.min(0.95, fusedResult.probability * modifier),
      );
      fusedResult.probabilityLow = Math.max(
        0.01,
        fusedResult.probabilityLow * modifier,
      );
      fusedResult.probabilityHigh = Math.min(
        0.99,
        fusedResult.probabilityHigh * modifier,
      );
      const cipInfo = CIP_NAMES[programData.cipCode];
      majorBreakdownResult = {
        majorName: cipInfo?.en || programData.programName,
        majorNameZh: cipInfo?.zh || programData.programNameZh,
        cipCode: programData.cipCode,
        competitiveness: programData.competitiveness,
        acceptanceRateEstimate: programData.acceptanceRateEstimate
          ? Number(programData.acceptanceRateEstimate)
          : undefined,
        modifier,
        adjustedProbability: fusedResult.probability,
      };
    }

    // Feeder signal → adjust probability + add factor
    if (feederSignal?.isFeeder) {
      // Feeder schools have a demonstrably higher admit rate for their students.
      // Boost scales with confidence (sample count) and strength of feeder signal.
      // admitRate / schoolRate ratio capped at 2x → max boost ~6%
      const feederRatio = Math.min(
        feederSignal.admitRate / (schoolInput.acceptanceRate! / 100),
        2.0,
      );
      const confidenceFactor = Math.min(feederSignal.sampleCount / 20, 1.0);
      const feederBoost = (feederRatio - 1) * 0.06 * confidenceFactor;
      if (feederBoost > 0) {
        fusedResult.probability = Math.min(
          0.95,
          fusedResult.probability + feederBoost,
        );
        fusedResult.probabilityLow = Math.min(
          fusedResult.probability,
          fusedResult.probabilityLow + feederBoost * 0.5,
        );
        fusedResult.probabilityHigh = Math.min(
          0.99,
          fusedResult.probabilityHigh + feederBoost,
        );
      }
    }

    // 确定 tier
    const tier = calculateTier(fusedResult.probability, schoolMetrics);

    // 选择最佳 factors (优先 AI，回退 stats)
    const factors = aiResult?.factors?.length
      ? aiResult.factors
      : statsResult.factors;

    // Feeder signal → 追加 factor
    if (feederSignal?.isFeeder) {
      const isZh = locale === 'zh';
      factors.push({
        name: isZh ? 'Feeder 学校优势' : 'Feeder School Advantage',
        impact: 'positive' as const,
        weight: 0.05,
        detail: isZh
          ? `你的高中历史上有 ${feederSignal.sampleCount} 人申请此校，录取率 ${Math.round(feederSignal.admitRate * 100)}%，高于学校整体录取率`
          : `Your high school has ${feederSignal.sampleCount} historical applicants to this university with a ${Math.round(feederSignal.admitRate * 100)}% admit rate, above the school average`,
      });
    }

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
      engineScores: {
        ...fusedResult.engineScores,
        mlModelTier: mlResult?.modelTier,
        mlContributions: mlResult?.contributions,
      },
      crossEngineConsistency: fusedResult.crossEngineConsistency,
      modelVersion: MODEL_VERSION,
      majorBreakdown: majorBreakdownResult,
    };

    // Attach community insight if target major exists
    if (profileInput.targetMajor) {
      try {
        const caseStats = await this.getMajorCaseStats(
          school.id,
          profileInput.targetMajor,
        );
        if (caseStats) {
          (result as any).communityInsight = {
            majorAdmitRate: caseStats.admitRate,
            totalCases: caseStats.totalCases,
            major: profileInput.targetMajor,
          };
        }
      } catch {
        // Non-critical — skip community data on error
      }
    }

    // 保存到缓存
    await this.saveToCache(profileId, school.id, result, profileHash);

    // 保存到数据库
    await this.savePrediction(profileId, school.id, result);

    return result;
  }

  // ==================== Community Insights ====================

  /**
   * Aggregate admission case data for a specific school + major combination.
   * Returns admit rate only when at least 5 verified cases exist (statistical threshold).
   */
  private async getMajorCaseStats(
    schoolId: string,
    major: string,
  ): Promise<{ admitRate: number; totalCases: number } | null> {
    const cases = await this.prisma.admissionCase.groupBy({
      by: ['result'],
      where: {
        schoolId,
        isVerified: true,
        ...CASE_REVIEW_APPROVED_WHERE,
        major: { contains: major, mode: 'insensitive' },
      },
      _count: true,
    });

    const total = cases.reduce((sum, c) => sum + c._count, 0);
    if (total < 5) return null;

    const admitted = cases.find((c) => c.result === 'ADMITTED')?._count ?? 0;
    return { admitRate: admitted / total, totalCases: total };
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
   * 生成智能建议 — 基于专业分类的个性化推荐
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

    // AI 建议优先 — 如果 AI 给出了足够多的具体建议，不再补充通用建议
    if (aiSuggestions?.length) {
      suggestions.push(...aiSuggestions.slice(0, 5));
    }

    // 仅在 AI 建议不足时补充通用建议
    if (suggestions.length >= 3) {
      return suggestions.slice(0, 5);
    }

    // 专业分类 + 活动去重
    const majorCategory = classifyMajor(profile.targetMajor);
    const programs = MAJOR_CATEGORY_PROGRAMS[majorCategory];
    const existingNames = new Set(
      (profile.activities || []).map((a) => (a.name || '').toLowerCase()),
    );
    const relevantSummer = programs.summer
      .filter((p) => !existingNames.has(p.name.toLowerCase()))
      .slice(0, 3);
    const relevantCompetitions = programs.competition
      .filter((p) => !existingNames.has(p.name.toLowerCase()))
      .slice(0, 3);

    const summerNames = relevantSummer
      .map((p) => (isZh ? p.zh : p.name))
      .join(isZh ? '、' : ', ');
    const competitionNames = relevantCompetitions
      .map((p) => (isZh ? p.zh : p.name))
      .join(isZh ? '、' : ', ');

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
            ? `考虑通过ED/EA早申请以最大化录取机会${summerNames ? `，同时利用暑期参加 ${summerNames} 等学术项目增强竞争力` : ''}`
            : `Consider applying Early Decision to maximize admission chances${summerNames ? `, and strengthen your profile through summer programs like ${summerNames}` : ''}`,
        );
      }
    } else if (tier === 'match') {
      const matchKw = isZh ? '优势' : 'strength';
      if (!suggestions.some((s) => s.toLowerCase().includes(matchKw))) {
        const parts: string[] = [];
        if (competitionNames)
          parts.push(
            isZh
              ? `竞赛项目（如 ${competitionNames}）`
              : `competitions (e.g., ${competitionNames})`,
          );
        if (summerNames)
          parts.push(
            isZh
              ? `暑期项目（如 ${summerNames}）`
              : `summer programs (e.g., ${summerNames})`,
          );
        const programText =
          parts.length > 0
            ? isZh
              ? `，通过${parts.join('或')}进一步提升竞争力`
              : `, while boosting competitiveness through ${parts.join(' or ')}`
            : '';
        suggestions.push(
          isZh
            ? `作为匹配校，保持现有优势的同时${programText}`
            : `As a match school, maintain your strengths${programText}`,
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
            ? `添加标化成绩（SAT/ACT）可大幅提高预测准确性${summerNames ? `。同时考虑参加 ${summerNames} 等暑期学术项目来增强学术背景` : ''}`
            : `Adding SAT/ACT scores can significantly improve prediction accuracy${summerNames ? `. Also consider summer academic programs like ${summerNames} to strengthen your academic profile` : ''}`,
        );
      }
    }

    return suggestions.slice(0, 5); // 最多5条
  }

  // ==================== Persistence & Reporting (delegated) ====================

  /** @deprecated Use PredictionPersistenceService.savePrediction() directly */
  private async savePrediction(
    profileId: string,
    schoolId: string,
    result: PredictionResultDto,
  ): Promise<void> {
    return this.persistenceService.savePrediction(profileId, schoolId, result);
  }

  /** @deprecated Use PredictionReportingService.getPredictionHistory() directly */
  async getPredictionHistory(
    profileId: string,
    page?: number,
    pageSize?: number,
  ) {
    return this.reportingService.getPredictionHistory(
      profileId,
      page,
      pageSize,
    );
  }

  /** @deprecated Use PredictionReportingService.reportActualResult() directly */
  async reportActualResult(
    profileId: string,
    schoolId: string,
    actualResult: 'ADMITTED' | 'REJECTED' | 'WAITLISTED',
  ): Promise<void> {
    return this.reportingService.reportActualResult(
      profileId,
      schoolId,
      actualResult,
    );
  }

  /** @deprecated Use PredictionReportingService.getCalibrationData() directly */
  async getCalibrationData() {
    return this.reportingService.getCalibrationData();
  }
}
