import {
  Injectable,
  Logger,
  Optional,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  SchoolMediaSourceType,
  SchoolMediaStatus,
  SchoolMediaType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { CASE_REVIEW_APPROVED_WHERE } from '../../common/constants/prisma-selects';
import { fireAndForget } from '../../common/utils/async.util';
import {
  toPublicSchoolMediaAsset,
  type PublicSchoolMediaAssetInput,
} from '../../common/utils/school-public-media.util';
import { CaseIncentiveService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';
import { PREDICTION_LOCK_TTL } from './prediction-error';

import { PredictionResultDto } from './dto';
import { InternalPredictionResult } from './prediction-persistence.service';
import { FeatureFlagService } from '../../common/feature-flags/feature-flag.service';
import { CounselorEngineService } from './counselor/counselor-engine.service';
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
  resolveContextualAcceptanceRate,
} from './utils/score-calculator';
import { resolveMajorToCip, CIP_NAMES } from '@study-abroad/shared/scoring';
// 2026-05-07: ML platform layer (ml/, prediction-ml-primary, ml.controller,
// diagnostic-ingest) deleted because counselor mode is at 100% rollout and
// ModelRegistry never had a CHAMPION. ShadowEvaluator/ModelMonitor/etc. are
// no longer wired. Restore via git history if real ML training resumes.
import { PredictionTransformerService } from './prediction-transformer.service';
import { PredictionStatisticalEngine } from './prediction-statistical-engine.service';
import { PredictionAiEngine } from './prediction-ai-engine.service';
import { PredictionFusionEngine } from './prediction-fusion-engine.service';
import { PredictionCacheService } from './prediction-cache.service';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionHistoricalService } from './prediction-historical.service';
import { PredictionMemoryService } from './prediction-memory.service';
import {
  PredictionPersistenceService,
  type SavedPredictionRefs,
} from './prediction-persistence.service';
import { PredictionReportingService } from './prediction-reporting.service';
import {
  PredictionPolicyService,
  type PredictionTracePayload,
} from './prediction-policy.service';
import { buildPredictionPublicExplanation } from './prediction-public-explanation';
// `DistillationService` (benchmark variant) removed 2026-05-07 with benchmark/
import { CompliantDistillationService } from './distillation/compliant-distillation.service';
import { DistillationObservationService } from './distillation/distillation-observation.service';
import {
  type DistillationBlendDecision,
  type DistillationEvaluationInput,
} from './distillation/types';
import { ROUND_MULTIPLIERS } from '@study-abroad/shared/scoring';
import type {
  SchoolPredictionDataQuality,
  SchoolPublicMedia,
  SchoolPublicMediaAsset,
} from '@study-abroad/shared';
import { buildNormalizedSchoolProvenance } from '../school/school-provenance.helpers';

// ============================================
// Constants
// ============================================

const MODEL_VERSION = 'v3-enterprise';
const COUNSELOR_ENGINE_MODE = 'counselor-v2';
const SCHOOL_META_QUALITY_FIELDS = [
  'acceptanceRate',
  'intlAcceptanceRate',
  'oosAcceptanceRate',
  'sat25',
  'sat75',
  'act25',
  'act75',
  'graduationRate',
] as const;
const TERMINAL_REAL_DATA_STATUSES = new Set([
  'OFFICIAL_BLANK',
  'OFFICIAL_BLOCKED',
  'NO_PUBLIC_REAL_DATA',
  'MANUAL_REVIEW',
  'PERMANENT_HEURISTIC',
]);

const PREDICTION_PUBLIC_MEDIA_SOURCE_TYPES: SchoolMediaSourceType[] = [
  SchoolMediaSourceType.OFFICIAL_WEBSITE,
  SchoolMediaSourceType.OFFICIAL_BRAND_PAGE,
  SchoolMediaSourceType.WIKIMEDIA_COMMONS,
  SchoolMediaSourceType.LOGO_API,
  SchoolMediaSourceType.FAVICON_FALLBACK,
  SchoolMediaSourceType.MANUAL_ADMIN,
];

const PREDICTION_PUBLIC_MEDIA_INCLUDE = {
  mediaAssets: {
    where: {
      status: SchoolMediaStatus.APPROVED,
      isPrimary: true,
      sourceType: { in: PREDICTION_PUBLIC_MEDIA_SOURCE_TYPES },
    },
    select: {
      type: true,
      sourceType: true,
      storageUrl: true,
      originalUrl: true,
      sourcePageUrl: true,
      license: true,
      attribution: true,
      width: true,
      height: true,
    },
  },
} as const;

function toPredictionPublicMediaAsset(
  asset: PublicSchoolMediaAssetInput | null | undefined,
): SchoolPublicMediaAsset | null {
  return toPublicSchoolMediaAsset(asset);
}

function mapPredictionSchoolMedia(assets?: any[] | null): SchoolPublicMedia {
  const list = assets ?? [];
  return {
    campusCover: toPredictionPublicMediaAsset(
      list.find((asset) => asset.type === SchoolMediaType.CAMPUS_COVER) as
        | PublicSchoolMediaAssetInput
        | undefined,
    ),
    logo: toPredictionPublicMediaAsset(
      list.find((asset) => asset.type === SchoolMediaType.LOGO) as
        | PublicSchoolMediaAssetInput
        | undefined,
    ),
  };
}

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
    private policyService: PredictionPolicyService,
    @Optional() private caseIncentiveService?: CaseIncentiveService,
    // ML platform services (modelRegistry, shadowEvaluator, modelMonitor,
    // mlPrimaryService, distillationService) deleted 2026-05-07.
    @Optional() private featureFlagService?: FeatureFlagService,
    @Optional()
    private compliantDistillationService?: CompliantDistillationService,
    @Optional()
    private distillationObservationService?: DistillationObservationService,
    // Cold-start counselor engine (PR-1). Optional so existing callers /
    // legacy module configurations don't break — when missing or when the
    // `prediction-counselor-mode-v1` feature flag is off, the prediction
    // path falls through to the existing fusion+distillation pipeline
    // with no behavior change.
    @Optional() private counselorEngine?: CounselorEngineService,
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

  private toPublicPredictionResult(
    result: PredictionResultDto,
  ): PredictionResultDto {
    const {
      servedTrace: _servedTrace,
      policyVersionId: _policyVersionId,
      applicationRound: _applicationRound,
      selectivityBand: _selectivityBand,
      ...publicResult
    } = result as PredictionResultDto & {
      servedTrace?: unknown;
      policyVersionId?: string;
      applicationRound?: string;
      selectivityBand?: string | null;
    };
    return publicResult;
  }

  /** @deprecated Use PredictionCacheService.getFromCache() directly */
  private async getFromCache(
    profileId: string,
    schoolId: string,
    profileHash?: string,
    policyVersionId?: string,
    engineMode?: string,
  ): Promise<PredictionResultDto | null> {
    return this.cacheService.getFromCache(
      profileId,
      schoolId,
      profileHash,
      policyVersionId,
      engineMode,
    );
  }

  /** @deprecated Use PredictionCacheService.saveToCache() directly */
  private async saveToCache(
    profileId: string,
    schoolId: string,
    result: PredictionResultDto,
    profileHash?: string,
    policyVersionId?: string,
    engineMode?: string,
  ): Promise<void> {
    return this.cacheService.saveToCache(
      profileId,
      schoolId,
      result,
      profileHash,
      policyVersionId,
      engineMode,
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

  private buildPredictionSchoolMeta(school: any) {
    return {
      usNewsRank: school.usNewsRank ?? undefined,
      rankings: school.rankings ?? undefined,
      media: mapPredictionSchoolMedia(school.mediaAssets),
      acceptanceRate: clampPercentRate(school.acceptanceRate),
      intlAcceptanceRate: clampPercentRate(school.intlAcceptanceRate),
      oosAcceptanceRate: clampPercentRate(school.oosAcceptanceRate),
      intlStudentPct: school.intlStudentPct
        ? Number(school.intlStudentPct)
        : undefined,
      needBlindInternational: school.needBlindInternational || undefined,
      graduationRate: clampPercentRate(school.graduationRate),
      satAvg: school.satAvg ?? undefined,
      sat25: school.sat25 ?? undefined,
      sat75: school.sat75 ?? undefined,
      dataQuality: this.buildSchoolDataQuality(school),
    };
  }

  private buildSchoolDataQuality(school: any): SchoolPredictionDataQuality {
    const provenance = buildNormalizedSchoolProvenance(school);
    const officialFields: string[] = [];
    const heuristicFields: string[] = [];
    const terminalFields: string[] = [];
    const staleFields: string[] = [];
    const missingFields: string[] = [];

    for (const field of SCHOOL_META_QUALITY_FIELDS) {
      const value = school[field];
      const isMissing = value == null;
      if (isMissing) missingFields.push(field);

      const source = provenance[field];
      if (!source) continue;
      const isTerminal =
        source.tier === 'UNAVAILABLE' ||
        Boolean(
          source.realDataStatus &&
          TERMINAL_REAL_DATA_STATUSES.has(source.realDataStatus),
        );
      const isHeuristic =
        source.tier === 'INFERRED' ||
        source.source.toUpperCase().includes('HEURISTIC');
      const isOfficial =
        source.tier === 'OFFICIAL' || source.tier === 'PARTNER';

      if (isTerminal) terminalFields.push(field);
      else if (isHeuristic) heuristicFields.push(field);
      else if (isOfficial) officialFields.push(field);

      if (source.staleness === 'STALE') staleFields.push(field);
    }

    const impactedFields = Array.from(
      new Set([
        ...missingFields,
        ...heuristicFields,
        ...terminalFields,
        ...staleFields,
      ]),
    );
    const summary: SchoolPredictionDataQuality['summary'] =
      impactedFields.length === 0 && officialFields.length >= 4
        ? 'strong'
        : impactedFields.length >= 4 || officialFields.length <= 1
          ? 'limited'
          : 'mixed';

    return {
      officialFields,
      heuristicFields,
      terminalFields,
      staleFields,
      impactedFields,
      summary,
    };
  }

  private probabilitySortValue(
    result: Pick<PredictionResultDto, 'probability'>,
  ): number {
    return result.probability == null ? -1 : result.probability;
  }

  private numericPredictionResults(
    results: PredictionResultDto[],
  ): Array<PredictionResultDto & { probability: number }> {
    return results.filter(
      (result): result is PredictionResultDto & { probability: number } =>
        result.probability != null && Number.isFinite(result.probability),
    );
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

  private async buildCounselorPrimaryResult(params: {
    profileId: string;
    profileInput: ProfileInput;
    school: any;
    schoolInput: SchoolInput;
    schoolMetrics: SchoolMetrics;
    locale: string;
    applicationRound?: string;
    policyVersionId?: string;
    profileHash?: string;
    persist: boolean;
  }): Promise<PredictionResultDto> {
    if (!this.counselorEngine) {
      throw new InternalServerErrorException(
        'Counselor engine is not available',
      );
    }

    const {
      profileId,
      profileInput,
      school,
      schoolInput,
      schoolMetrics,
      locale,
      applicationRound,
      policyVersionId,
      profileHash,
      persist,
    } = params;
    const resolvedPolicyVersionId = policyVersionId ?? MODEL_VERSION;
    const resolvedApplicationRound =
      applicationRound ?? schoolInput.applicationRound ?? 'RD';
    const counselorResult = await this.counselorEngine.compute(
      profileInput,
      schoolInput,
      resolvedApplicationRound,
    );
    const schoolName =
      locale === 'zh'
        ? school.nameZh || school.name
        : school.name || school.nameZh;

    const builtTrace = this.policyService.buildTracePayload({
      policyVersionId: resolvedPolicyVersionId,
      profile: profileInput,
      school: schoolInput,
      roundContext: resolvedApplicationRound,
      confidence: counselorResult.tier === 4 ? 'low' : 'medium',
      schoolMeta: {
        acceptanceRate: schoolInput.acceptanceRate,
        intlAcceptanceRate: schoolInput.intlAcceptanceRate,
        oosAcceptanceRate: schoolInput.oosAcceptanceRate,
        usNewsRank: schoolInput.usNewsRank,
        graduationRate: schoolInput.graduationRate,
      },
    });
    const baseTrace = builtTrace ?? {
      policyVersionId: resolvedPolicyVersionId,
      cohortKey: 'UNKNOWN',
      roundContext: resolvedApplicationRound,
      priorTier: 'counselor',
      driftSignalIds: [],
      relationshipSignalIds: [],
      calibrationPath: [],
      uncertaintyReasons: [],
      sourceSummary: [],
    };

    if (counselorResult.tier === 4) {
      const reason =
        counselorResult.insufficientData?.reason ??
        'Limited public data — predictions are not available for this school yet.';
      const sourceSummary = [
        {
          label: 'Insufficient data',
          detail: reason,
        },
      ];
      const uncertaintyReasons = [
        'Limited public data — predictions are not available for this school yet.',
        ...counselorResult.missingFields.map(
          (field) =>
            `Missing ${field}; this signal was skipped neutrally instead of penalized.`,
        ),
      ];
      const publicExplanation = buildPredictionPublicExplanation({
        locale,
        schoolName,
        probability: null,
        tier: 'unavailable',
        confidence: 'low',
        factors: [],
        suggestions: [],
        sourceSummary,
        uncertaintyReasons,
        predictionMethod: 'insufficient_data',
      });
      const result: InternalPredictionResult = {
        schoolId: school.id,
        schoolName,
        probability: null,
        probabilityLow: undefined,
        probabilityHigh: undefined,
        confidence: 'low',
        tier: 'unavailable',
        factors: [],
        suggestions: [],
        comparison: undefined,
        modelVersion: counselorResult.ruleVersion,
        servedPolicyVersionId: resolvedPolicyVersionId,
        cohortKey: baseTrace.cohortKey,
        roundContext: resolvedApplicationRound,
        predictionMethod: 'insufficient_data',
        sourceSummary,
        uncertaintyReasons,
        confidenceReason:
          'Public admission-rate data is too limited for a numeric estimate.',
        publicExplanation,
        insufficientData: {
          tier: 4,
          reason,
        },
        policyVersionId: resolvedPolicyVersionId,
        applicationRound: resolvedApplicationRound,
        selectivityBand: undefined,
        servedTrace: {
          ...baseTrace,
          engine: 'counselor',
          sourceSummary,
          uncertaintyReasons,
          counselor: {
            anchor: counselorResult.anchor,
            anchorSource: counselorResult.anchorSource,
            tier: counselorResult.tier,
            modifiers: counselorResult.modifierResults,
            missingFields: counselorResult.missingFields,
            profileSignals: counselorResult.profileSignals,
            sourceContributions: counselorResult.sourceContributions,
            ruleVersion: counselorResult.ruleVersion,
          },
          insufficientData: {
            tier: 4,
            reason,
          },
          publicExplanation: {
            rules: publicExplanation,
          },
        },
      };
      return persist ? this.toPublicPredictionResult(result) : result;
    }

    const tierContext = resolveContextualAcceptanceRate({
      schoolMeta: {
        acceptanceRate: schoolInput.acceptanceRate,
        intlAcceptanceRate: schoolInput.intlAcceptanceRate,
      },
      isInternational: Boolean(profileInput.isInternational),
      roundContext: resolvedApplicationRound,
    });
    const tierSchoolMetrics = tierContext
      ? { ...schoolMetrics, acceptanceRate: tierContext.rate }
      : schoolMetrics;
    const tier = calculateTier(counselorResult.probability, tierSchoolMetrics);
    const profileSignals = counselorResult.profileSignals;
    const sourceSummary = [
      {
        label: 'Counselor estimate',
        detail: `${counselorResult.anchorSource}; anchor ${(counselorResult.anchor * 100).toFixed(1)}%; Tier ${counselorResult.tier}; ${counselorResult.ruleVersion}`,
      },
      ...(profileSignals
        ? [
            {
              label: 'Profile signals used',
              detail:
                profileSignals.usedInProbability.length > 0
                  ? profileSignals.usedInProbability.join(', ')
                  : 'No additional profile context changed probability; neutral/missing signals were tracked.',
            },
          ]
        : []),
    ];
    const uncertaintyReasons = [
      'Cold-start rules-of-thumb estimate; essays, recommendations, and institutional priorities are not fully modeled.',
      ...baseTrace.uncertaintyReasons,
      ...counselorResult.missingFields.map(
        (field) =>
          `Missing ${field}; this signal was skipped neutrally instead of penalized.`,
      ),
      ...(profileSignals?.ignoredByPolicy?.length
        ? [
            `Policy-excluded signals not used in probability: ${profileSignals.ignoredByPolicy.join(', ')}.`,
          ]
        : []),
    ];
    const confidenceReason = this.generateConfidenceReason(
      'medium',
      profileInput,
      sourceSummary,
      uncertaintyReasons,
      locale,
    );
    const suggestions = this.generateSuggestions(
      tier,
      'medium',
      profileInput,
      schoolInput,
      undefined,
      locale,
    );
    const publicExplanation = buildPredictionPublicExplanation({
      locale,
      schoolName,
      probability: counselorResult.probability,
      probabilityLow: Math.max(0.02, counselorResult.probability - 0.05),
      probabilityHigh: Math.min(0.98, counselorResult.probability + 0.05),
      tier,
      confidence: 'medium',
      factors: counselorResult.factors,
      suggestions,
      sourceSummary,
      uncertaintyReasons,
      predictionMethod: 'counselor',
      schoolAcceptanceRate: schoolInput.acceptanceRate,
    });
    const result: InternalPredictionResult = {
      schoolId: school.id,
      schoolName,
      probability: counselorResult.probability,
      probabilityLow: Math.max(0.02, counselorResult.probability - 0.05),
      probabilityHigh: Math.min(0.98, counselorResult.probability + 0.05),
      confidence: 'medium',
      tier,
      factors: counselorResult.factors,
      suggestions,
      comparison: undefined,
      modelVersion: counselorResult.ruleVersion,
      servedPolicyVersionId: resolvedPolicyVersionId,
      cohortKey: baseTrace.cohortKey,
      roundContext: resolvedApplicationRound,
      predictionMethod: 'counselor',
      sourceSummary,
      uncertaintyReasons,
      confidenceReason,
      publicExplanation,
      policyVersionId: resolvedPolicyVersionId,
      applicationRound: resolvedApplicationRound,
      // selectivityBand was computed via ml/tier-strategy; analytics-only
      // metadata, not used by counselor. Removed with ml/ deletion 2026-05-07.
      selectivityBand: undefined,
      servedTrace: {
        ...baseTrace,
        engine: 'counselor',
        calibrationPath: ['counselor_anchor_clip'],
        sourceSummary,
        uncertaintyReasons,
        counselor: {
          anchor: counselorResult.anchor,
          anchorSource: counselorResult.anchorSource,
          tier: counselorResult.tier,
          modifiers: counselorResult.modifierResults,
          missingFields: counselorResult.missingFields,
          profileSignals: counselorResult.profileSignals,
          sourceContributions: counselorResult.sourceContributions,
          ruleVersion: counselorResult.ruleVersion,
        },
        publicExplanation: {
          rules: publicExplanation,
        },
      },
    };

    if (persist) {
      const savedRefs =
        (await this.savePrediction(profileId, school.id, result)) ?? {};
      if (savedRefs.predictionResultId) {
        result.id = savedRefs.predictionResultId;
      }
      await this.saveToCache(
        profileId,
        school.id,
        this.toPublicPredictionResult(result),
        profileHash,
        policyVersionId,
        COUNSELOR_ENGINE_MODE,
      );
    }

    return persist ? this.toPublicPredictionResult(result) : result;
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
    const numericResults = this.numericPredictionResults(results);

    // 为每个结果计算 selectivity index
    const withSel = numericResults
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
    for (const r of numericResults) {
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
    for (const r of numericResults) {
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
    return this.runPredictionWithLock(
      profileId,
      schoolIds,
      forceRefresh,
      locale,
      true,
    );
  }

  async predictForApplicationAnalysis(
    profileId: string,
    schoolIds: string[],
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
    return this.runPredictionWithLock(
      profileId,
      schoolIds,
      true,
      locale,
      false,
    );
  }

  /**
   * Preview prediction — run the full multi-engine pipeline against a
   * caller-supplied ProfileInput without touching any persistence layer.
   *
   * Skips: Redis lock, points charging, DB profile load, memory context,
   * Redis cache (read and write), PredictionResult upsert, memory recording.
   *
   * Keeps: statistical/AI/ML/historical/fusion engines, Platt calibration,
   * school-level calibration multipliers, monotonicity enforcement,
   * program-level competitiveness modifier, round multiplier.
   *
   * Intended for offline analysis flows (ablation, backtest). Never call
   * from a user-facing request path — it bypasses charging and auditing.
   *
   * Options:
   *   - `includeShadowDistillation`: run the compliant distillation evaluator
   *     in shadow mode and surface the resulting `servedTrace` per result.
   *     Used by the admin "synthetic prediction" endpoint to inspect which
   *     teachers fire for a given mock profile. Default false (keeps the
   *     deterministic served path the standard preview emits).
   *   - `includeServedTrace`: attach `servedTrace` to each result. Implied
   *     true when `includeShadowDistillation` is true (the trace would be
   *     uninteresting otherwise).
   *   - `counselorMode`: overlay counselor-engine output without checking the
   *     feature flag. Admin dry-run uses this to compare counselor vs legacy
   *     without a real userId or persistence.
   */
  async previewPredict(
    profileInput: ProfileInput,
    schoolIds: string[],
    options?: {
      locale?: string;
      includeShadowDistillation?: boolean;
      includeServedTrace?: boolean;
      applicationRound?: string;
      counselorMode?: boolean;
    },
  ): Promise<{
    results: Array<PredictionResultDto & { servedTrace?: unknown }>;
    dataCompleteness: number;
  }> {
    const locale = options?.locale ?? 'zh';
    const includeShadowDistillation =
      options?.includeShadowDistillation ?? false;
    const includeServedTrace =
      options?.includeServedTrace ?? includeShadowDistillation;
    const overrideApplicationRound = options?.applicationRound;
    const counselorMode =
      options?.counselorMode ?? Boolean(this.counselorEngine);

    if (schoolIds.length === 0) {
      return { results: [], dataCompleteness: 0 };
    }

    const schools = await this.prisma.school.findMany({
      where: { id: { in: schoolIds } },
      include: PREDICTION_PUBLIC_MEDIA_INCLUDE,
    });
    if (schools.length === 0) {
      return { results: [], dataCompleteness: 0 };
    }

    const profileMetrics = this.transformer.extractProfileMetrics(profileInput);
    const policyVersionId = this.policyService
      ? await this.policyService.resolveServedPolicyVersionId()
      : MODEL_VERSION;
    const plattParams = await this.getPlattCalibration();

    const emptyMemoryCtx = {
      previousPredictions: [] as any[],
      knownPreferences: [] as string[],
      profileInsights: [] as string[],
      memoryAdjustments: new Map<string, number>(),
    };

    const firstSchoolInput = this.schoolToInput(schools[0]);
    const dataCompleteness = this.evaluateDataCompleteness(
      profileInput,
      firstSchoolInput,
    );

    // Prefetch program competitiveness for the target major
    const programMap = new Map<string, any>();
    if (profileInput.targetMajor) {
      const targetCip = resolveMajorToCip(profileInput.targetMajor);
      if (targetCip) {
        const programs = await this.prisma.schoolProgram.findMany({
          where: {
            cipCode: targetCip,
            schoolId: { in: schools.map((s) => s.id) },
          },
        });
        for (const p of programs) programMap.set(p.schoolId, p);
      }
    }

    const schoolMetaMap = new Map<
      string,
      ReturnType<PredictionService['buildPredictionSchoolMeta']>
    >();
    for (const s of schools) {
      schoolMetaMap.set(s.id, this.buildPredictionSchoolMeta(s));
    }

    // Serial execution — preview is used by CLI tools where determinism
    // matters more than throughput; also avoids concurrent log interleaving.
    const results: Array<PredictionResultDto & { servedTrace?: unknown }> = [];
    for (const school of schools) {
      try {
        const result = await this.predictForSchool(
          '', // no profileId — persist=false gates all profileId reads
          profileInput,
          profileMetrics,
          school,
          emptyMemoryCtx,
          locale,
          plattParams,
          undefined, // profileHash unused when persist=false
          programMap.get(school.id),
          dataCompleteness,
          overrideApplicationRound, // applicationRound — admin diagnostic flow can inject a round
          policyVersionId,
          false, // v5MlPrimary — keep preview on the deterministic served path
          false, // v5Shadow
          false, // useDistillationBlend
          includeShadowDistillation, // compliantDistillationShadow
          false, // compliantDistillationLive — never live-blend on preview
          counselorMode,
          false, // persist
        );
        result.schoolMeta = schoolMetaMap.get(result.schoolId);
        // predictForSchool always populates `servedTrace` on its internal
        // return shape; expose it only when the caller asked. This keeps
        // the standard preview output (used by ablation harnesses) lean.
        const decoratedResult = result as PredictionResultDto & {
          servedTrace?: unknown;
        };
        if (!includeServedTrace) {
          delete decoratedResult.servedTrace;
        }
        results.push(decoratedResult);
      } catch (err) {
        this.logger.warn(
          `previewPredict: school ${school.id} failed`,
          err as any,
        );
      }
    }

    // Batch validation + monotonicity (same invariants as the live path)
    this.validateBatchResults(results);
    if (!counselorMode) {
      enforceMonotonicity(this.numericPredictionResults(results) as any);

      // School-level calibration multipliers (Platt happens inside predictForSchool)
      const calibrationMap = await this.getSchoolCalibrations();
      for (const r of results) {
        if (r.probability == null) continue;
        const adj = calibrationMap[r.schoolId];
        if (adj != null && adj > 0) {
          r.probability = Math.min(0.98, r.probability * adj);
          if (r.probabilityLow != null)
            r.probabilityLow = Math.min(0.98, r.probabilityLow * adj);
          if (r.probabilityHigh != null)
            r.probabilityHigh = Math.min(0.98, r.probabilityHigh * adj);
        }
      }
    }

    results.sort(
      (a, b) => this.probabilitySortValue(b) - this.probabilitySortValue(a),
    );
    return { results, dataCompleteness };
  }

  private async runPredictionWithLock(
    profileId: string,
    schoolIds: string[],
    forceRefresh: boolean,
    locale: string,
    chargePoints: boolean,
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
      chargePoints,
    });

    // 扣除积分
    let chargedUserId: string | undefined;
    if (chargePoints && this.caseIncentiveService) {
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
        semesterGpas: { orderBy: { order: 'asc' } },
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
      include: PREDICTION_PUBLIC_MEDIA_INCLUDE,
    });

    // Load user's application round per school (ED, EA, RD, etc.)
    const schoolListItems = await this.prisma.schoolListItem.findMany({
      where: { userId: profile.userId, schoolId: { in: schoolIds } },
      select: { schoolId: true, round: true },
    });
    const roundMap = new Map(
      schoolListItems.map((item) => [item.schoolId, item.round]),
    );
    const defaultApplicationRound = profile.applicationRound ?? undefined;

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
    const policyVersionId = this.policyService
      ? await this.policyService.resolveServedPolicyVersionId()
      : MODEL_VERSION;

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
      ReturnType<PredictionService['buildPredictionSchoolMeta']>
    >();
    for (const s of schools) {
      schoolMetaMap.set(s.id, this.buildPredictionSchoolMeta(s));
    }

    // Pre-compute feature flags once per prediction request. `profileId` is a
    // Profile.id, not a User.id, so use the already-loaded profile.userId for
    // deterministic rollout hashing.
    // ML primary path deleted 2026-05-07; flags retained as always-false
    // locals so downstream signatures (predictForSchool params) are unchanged.
    const v5MlPrimary = false;
    const v5Shadow = false;
    const useDistillationBlend = false;
    let compliantDistillationShadow = false;
    let compliantDistillationLive = false;
    let counselorModeEnabled = false;
    if (this.featureFlagService && profile.userId) {
      try {
        // ML primary + benchmark distillation feature flags removed
        // 2026-05-07 (services deleted). Only counselor + compliant
        // distillation flags remain.
        [
          compliantDistillationShadow,
          compliantDistillationLive,
          counselorModeEnabled,
        ] = await Promise.all([
          this.compliantDistillationService
            ? this.featureFlagService.isEnabled(
                'prediction-compliant-distillation-shadow',
                { userId: profile.userId },
              )
            : Promise.resolve(false),
          this.compliantDistillationService
            ? this.featureFlagService.isEnabled(
                'prediction-compliant-distillation-v1',
                { userId: profile.userId },
              )
            : Promise.resolve(false),
          this.counselorEngine
            ? this.featureFlagService.isEnabled(
                'prediction-counselor-mode-v1',
                {
                  userId: profile.userId,
                },
              )
            : Promise.resolve(false),
        ]);
      } catch {
        // Feature flag check failed, stay on legacy served behavior.
        compliantDistillationShadow = false;
        compliantDistillationLive = false;
        counselorModeEnabled = false;
      }
    }
    counselorModeEnabled = Boolean(this.counselorEngine);
    const predictionEngineMode = counselorModeEnabled
      ? COUNSELOR_ENGINE_MODE
      : 'v4';

    if (!forceRefresh) {
      for (const school of schools) {
        const cached = await this.getFromCache(
          profileId,
          school.id,
          profileHash,
          policyVersionId,
          predictionEngineMode,
        );
        if (cached) {
          // Attach schoolMeta to cached results too
          const publicCached = this.toPublicPredictionResult(cached);
          publicCached.schoolMeta = schoolMetaMap.get(school.id);
          results.push(publicCached);
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
            roundMap.get(school.id) ?? defaultApplicationRound,
            policyVersionId,
            v5MlPrimary,
            v5Shadow,
            useDistillationBlend,
            compliantDistillationShadow,
            compliantDistillationLive,
            counselorModeEnabled,
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

    if (!counselorModeEnabled) {
      // 单调性约束: 保证 selectivity 更高的学校 probability 更低.
      // Counselor mode skips this legacy post-processing so its hard
      // [anchor × 0.3, anchor × 2.5] clamp cannot be mutated after compute().
      enforceMonotonicity(this.numericPredictionResults(results) as any);

      // 学校级校准：从 DB 加载 SchoolCalibration 乘数（如 BU 过严时可设 >1）
      const calibrationMap = await this.getSchoolCalibrations();
      for (const r of results) {
        if (r.probability == null) continue;
        const adj = calibrationMap[r.schoolId];
        if (adj != null && adj > 0) {
          r.probability = Math.min(0.98, r.probability * adj);
          if (r.probabilityLow != null)
            r.probabilityLow = Math.min(0.98, r.probabilityLow * adj);
          if (r.probabilityHigh != null)
            r.probabilityHigh = Math.min(0.98, r.probabilityHigh * adj);
        }
      }
    }

    // 按概率降序排序
    results.sort(
      (a, b) => this.probabilitySortValue(b) - this.probabilitySortValue(a),
    );

    const cachedCount = results.filter((r) => r.fromCache).length;
    const numericResults = this.numericPredictionResults(results);
    this.logger.log('Prediction completed', {
      profileId,
      totalSchools: results.length,
      cachedResults: cachedCount,
      freshResults: results.length - cachedCount,
      dataCompleteness,
      avgProbability:
        numericResults.length > 0
          ? Math.round(
              (numericResults.reduce((s, r) => s + r.probability, 0) /
                numericResults.length) *
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
    policyVersionId?: string,
    v5MlPrimary = false,
    v5Shadow = false,
    useDistillationBlend = false,
    compliantDistillationShadow = false,
    compliantDistillationLive = false,
    counselorModeEnabled = false,
    persist = true,
  ): Promise<PredictionResultDto> {
    // v5 ML-Primary branch removed 2026-05-07 along with the ML platform layer.
    // Counselor mode is the served path when enabled; otherwise the legacy
    // statistical/AI/historical fusion path below runs without ML overlay.

    const schoolInput = this.schoolToInput(school);

    // Inject application round from user's school list
    if (applicationRound) {
      schoolInput.applicationRound = applicationRound;
    }
    const schoolMetrics = this.extractSchoolMetrics(schoolInput);

    if (counselorModeEnabled && this.counselorEngine) {
      return this.buildCounselorPrimaryResult({
        profileId,
        profileInput,
        school,
        schoolInput,
        schoolMetrics,
        locale,
        applicationRound,
        policyVersionId,
        profileHash,
        persist,
      });
    }

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

    // === 引擎 4: ML Model — REMOVED 2026-05-07 ===
    // The ModelRegistry/champion model path was archived along with the ML
    // platform layer (no CHAMPION model was ever trained; counselor mode is
    // 100% rollout). Fusion now blends only stats/AI/historical signals.
    type MlResult = {
      probability: number;
      modelTier: number;
      contributions?: Array<{
        feature: string;
        contribution: number;
        direction: 'positive' | 'negative';
      }>;
    } | null;
    // Use `as` cast to prevent TS narrowing the const type to literal null —
    // downstream code still references `mlResult?.probability` etc. for now.
    const mlResult = null as MlResult;
    const selectivityBand: string | null = null;

    // 记忆增强调整
    const memoryAdjustment =
      memoryContext.memoryAdjustments.get(school.id) || 0;

    // 计算置信度
    const confidenceLevel = this.transformer.adjustConfidenceForSchoolTrust(
      calculateConfidence(profileMetrics, schoolMetrics),
      schoolInput,
    );

    // === 融合 ===
    const fusedResult = this.fusePredictions(
      statsResult.probability,
      aiResult?.probability ?? null,
      historicalResult,
      memoryAdjustment,
      confidenceLevel,
      mlResult?.probability ?? null,
    );

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

    // Re-apply round context to the served probability so favorable rounds remain
    // directionally better even when AI/fusion noise under-reacts to application round.
    const roundMultiplier = schoolInput.applicationRound
      ? (ROUND_MULTIPLIERS[schoolInput.applicationRound] ?? 1.0)
      : 1.0;
    if (roundMultiplier !== 1.0) {
      fusedResult.probability = Math.max(
        0.05,
        Math.min(0.95, fusedResult.probability * roundMultiplier),
      );
      fusedResult.probabilityLow = Math.max(
        0.01,
        Math.min(0.95, fusedResult.probabilityLow * roundMultiplier),
      );
      fusedResult.probabilityHigh = Math.max(
        fusedResult.probability,
        Math.min(0.99, fusedResult.probabilityHigh * roundMultiplier),
      );
    }

    const preDistillationProbability = fusedResult.probability;
    const baselineServedProbability =
      plattParams && !mlResult
        ? this.applyPlattCalibration(preDistillationProbability, plattParams)
        : preDistillationProbability;
    const compliantEvaluation = await this.evaluateCompliantDistillation(
      {
        profileId,
        profileInput,
        profileMetrics,
        school,
        schoolInput,
        ourProbPrePlatt: preDistillationProbability,
        servedProbability: baselineServedProbability,
        applicationRound:
          schoolInput.applicationRound ?? applicationRound ?? 'RD',
        selectivityBand,
      },
      {
        shadowEnabled: compliantDistillationShadow,
        liveEnabled: compliantDistillationLive,
      },
    );
    const compliantCandidateServedProbability = compliantEvaluation
      ? this.computeDistillationCandidateServedProbability(
          compliantEvaluation.decision,
          baselineServedProbability,
          plattParams,
          false,
          compliantEvaluation.applyLiveBlend,
        )
      : baselineServedProbability;

    if (compliantEvaluation?.applyLiveBlend) {
      this.applyProbabilityDelta(
        fusedResult,
        compliantEvaluation.decision.liveBlendedPrePlatt ??
          compliantEvaluation.decision.blendedPrePlatt,
      );
    }

    // Legacy benchmark distillation blend removed 2026-05-07 with the
    // benchmark/ folder. Compliant distillation (above) remains the only
    // blending path when its feature flags are enabled.

    // Platt scaling 校准（当有足够历史数据时）
    // Apply after deterministic modifiers so calibration operates on the
    // final served score instead of being overwritten by later adjustments.
    // Skip Platt when ML champion is active — ML logistic output is already calibrated.
    if (plattParams && !mlResult) {
      fusedResult.probability = this.applyPlattCalibration(
        fusedResult.probability,
        plattParams,
      );
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
    const tierContext = resolveContextualAcceptanceRate({
      schoolMeta: {
        acceptanceRate: schoolInput.acceptanceRate,
        intlAcceptanceRate: schoolInput.intlAcceptanceRate,
      },
      isInternational: Boolean(profileInput.isInternational),
      roundContext: schoolInput.applicationRound,
    });
    const tierSchoolMetrics = tierContext
      ? { ...schoolMetrics, acceptanceRate: tierContext.rate }
      : schoolMetrics;
    const tier = calculateTier(fusedResult.probability, tierSchoolMetrics);

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

    const servedTrace = this.withCompliantDistillationTrace(
      this.policyService.buildTracePayload({
        policyVersionId: policyVersionId ?? MODEL_VERSION,
        profile: profileInput,
        school: schoolInput,
        roundContext: schoolInput.applicationRound,
        confidence: confidenceLevel,
        schoolMeta: {
          acceptanceRate: schoolInput.acceptanceRate,
          intlAcceptanceRate: schoolInput.intlAcceptanceRate,
          oosAcceptanceRate: schoolInput.oosAcceptanceRate,
          usNewsRank: schoolInput.usNewsRank,
          graduationRate: schoolInput.graduationRate,
        },
      }),
      compliantEvaluation,
      compliantCandidateServedProbability,
      fusedResult.probability,
    );

    const resolvedPolicyVersionId =
      servedTrace?.policyVersionId ?? policyVersionId ?? MODEL_VERSION;
    const resolvedApplicationRound =
      servedTrace?.roundContext ?? schoolInput.applicationRound ?? 'RD';
    const confidenceReason = this.generateConfidenceReason(
      confidenceLevel,
      profileInput,
      servedTrace?.sourceSummary,
      servedTrace?.uncertaintyReasons,
      locale,
    );
    const publicExplanation = buildPredictionPublicExplanation({
      locale,
      schoolName:
        locale === 'zh'
          ? school.nameZh || school.name
          : school.name || school.nameZh,
      probability: fusedResult.probability,
      probabilityLow: fusedResult.probabilityLow,
      probabilityHigh: fusedResult.probabilityHigh,
      tier,
      confidence: confidenceLevel,
      factors,
      suggestions,
      sourceSummary: servedTrace?.sourceSummary,
      uncertaintyReasons: servedTrace?.uncertaintyReasons,
      predictionMethod: 'fusion',
      schoolAcceptanceRate: schoolInput.acceptanceRate,
    });

    const result: InternalPredictionResult = {
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
      // Public API field names
      servedPolicyVersionId: resolvedPolicyVersionId,
      cohortKey: servedTrace?.cohortKey,
      roundContext: resolvedApplicationRound,
      predictionMethod: 'fusion',
      sourceSummary: servedTrace?.sourceSummary,
      uncertaintyReasons: servedTrace?.uncertaintyReasons,
      confidenceReason,
      publicExplanation,
      majorBreakdown: majorBreakdownResult,
      // Internal fields for DB persistence (not in public DTO)
      policyVersionId: resolvedPolicyVersionId,
      applicationRound: resolvedApplicationRound,
      selectivityBand: selectivityBand ?? undefined,
      servedTrace: servedTrace
        ? {
            ...servedTrace,
            publicExplanation: {
              rules: publicExplanation,
            },
          }
        : undefined,
    };

    if (compliantEvaluation) {
      result.cohortKey = compliantEvaluation.decision.cohortKey;
    }

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

    // ==================== Counselor mode override (PR-2) ====================
    // When the `prediction-counselor-mode-v1` feature flag is on for this user,
    // override the served probability + factors with the counselor engine's
    // deterministic CDS-anchored output. The fusion / distillation results that
    // already computed above are preserved in `servedTrace.shadow.fusion` so
    // we can retroactively compare counselor accuracy vs blend once outcome
    // labels accumulate (~Feb 2027 estimate).
    //
    // Skipped when counselor module is missing, flag is disabled for this
    // request, or counselor returns Tier 4. Production Tier 4 falls back to
    // fusion so users still see the legacy prediction.
    if (counselorModeEnabled && this.counselorEngine) {
      try {
        const counselorResult = await this.counselorEngine.compute(
          profileInput,
          schoolInput,
          resolvedApplicationRound,
        );

        if (counselorResult.tier !== 4) {
          const counselorMissingFields = counselorResult.missingFields ?? [];
          const counselorSourceContributions =
            counselorResult.sourceContributions ?? [];

          // Stash fusion's pre-counselor output for shadow comparison
          const shadowFusion = {
            probability: result.probability,
            probabilityLow: result.probabilityLow,
            probabilityHigh: result.probabilityHigh,
            factors: result.factors,
            engineScores: result.engineScores,
            confidence: result.confidence,
          };

          // Override served output with counselor's
          result.probability = counselorResult.probability;
          // Tight ±5pp CI (counselor is deterministic; CI reflects rules-of-thumb
          // uncertainty, not statistical noise)
          result.probabilityLow = Math.max(
            0.02,
            counselorResult.probability - 0.05,
          );
          result.probabilityHigh = Math.min(
            0.98,
            counselorResult.probability + 0.05,
          );
          result.tier = calculateTier(
            counselorResult.probability,
            tierSchoolMetrics,
          );
          result.factors = counselorResult.factors;
          result.engineScores = undefined;
          result.confidence = 'medium';
          result.confidenceReason =
            "Cold-start rules-of-thumb estimate anchored on the school's published CDS admit rate. Will become more precise as we collect outcome data from your reports.";
          result.predictionMethod = 'counselor';
          result.sourceSummary = [
            {
              label: 'Counselor estimate',
              detail: `${counselorResult.anchorSource}; anchor ${(counselorResult.anchor * 100).toFixed(1)}%; Tier ${counselorResult.tier}`,
            },
          ];
          result.uncertaintyReasons = [
            'Cold-start rules-of-thumb estimate; essays, recommendations, and institutional priorities are not fully modeled.',
            ...counselorMissingFields.map(
              (field) =>
                `Missing ${field}; this signal was skipped neutrally instead of penalized.`,
            ),
          ];
          result.publicExplanation = buildPredictionPublicExplanation({
            locale,
            schoolName: result.schoolName,
            probability: result.probability,
            probabilityLow: result.probabilityLow,
            probabilityHigh: result.probabilityHigh,
            tier: result.tier,
            confidence: result.confidence,
            factors: result.factors,
            suggestions: result.suggestions,
            sourceSummary: result.sourceSummary,
            uncertaintyReasons: result.uncertaintyReasons,
            predictionMethod: 'counselor',
            schoolAcceptanceRate: schoolInput.acceptanceRate,
          });

          // Annotate trace — engine label + counselor metadata + shadow fusion
          result.servedTrace = {
            ...(result.servedTrace ?? {}),
            engine: 'counselor',
            counselor: {
              anchor: counselorResult.anchor,
              anchorSource: counselorResult.anchorSource,
              tier: counselorResult.tier,
              modifiers: counselorResult.modifierResults,
              missingFields: counselorMissingFields,
              sourceContributions: counselorSourceContributions,
              ruleVersion: counselorResult.ruleVersion,
            },
            shadow: {
              ...(((result.servedTrace as any)?.shadow ?? {}) as object),
              fusion: shadowFusion,
            },
            publicExplanation: {
              ...(((result.servedTrace as any)?.publicExplanation ??
                {}) as object),
              rules: result.publicExplanation,
            },
          };
        } else {
          result.servedTrace = {
            ...(result.servedTrace ?? {}),
            counselorSkipped: {
              reason: counselorResult.insufficientData?.reason ?? 'tier_4',
              tier: counselorResult.tier,
            },
          };
        }
      } catch (err) {
        // Counselor failure should never block a prediction. Log + fall back
        // to fusion result. This is the third safety net (after Tier 4 sentinel
        // and Optional injection).
        this.logger.warn(
          `Counselor compute failed for profile=${profileId} school=${school.id}; falling back to fusion`,
          err as any,
        );
      }
    }

    if (persist) {
      // 保存到数据库 first so the public response/cache can expose the
      // PredictionResult row id used by prediction-quality feedback.
      const savedRefs =
        (await this.savePrediction(profileId, school.id, result)) ?? {};
      if (savedRefs.predictionResultId) {
        result.id = savedRefs.predictionResultId;
      }
      if (result.probability != null) {
        await this.recordCompliantDistillationObservation({
          savedRefs,
          policyVersionId: resolvedPolicyVersionId,
          evaluation: compliantEvaluation,
          servedProbability: result.probability,
          candidateServedProbability: compliantEvaluation?.applyLiveBlend
            ? result.probability
            : compliantCandidateServedProbability,
          applicationRound: resolvedApplicationRound,
          selectivityBand,
        });
      }

      // 保存到缓存 after persistence so feedback widgets can use result.id on
      // subsequent cache hits too.
      await this.saveToCache(
        profileId,
        school.id,
        this.toPublicPredictionResult(result),
        profileHash,
        policyVersionId,
        counselorModeEnabled ? COUNSELOR_ENGINE_MODE : 'v4',
      );
    }

    return persist ? this.toPublicPredictionResult(result) : result;
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

  private async evaluateCompliantDistillation(
    params: {
      profileId: string;
      profileInput: ProfileInput;
      profileMetrics: ProfileMetrics;
      school: any;
      schoolInput: SchoolInput;
      ourProbPrePlatt: number;
      servedProbability: number;
      applicationRound: string;
      selectivityBand: string | null;
    },
    options: {
      shadowEnabled: boolean;
      liveEnabled: boolean;
    },
  ) {
    if (
      !this.compliantDistillationService ||
      (!options.shadowEnabled && !options.liveEnabled)
    ) {
      return null;
    }

    const inputSummary = this.compliantDistillationService.buildInputSummary(
      params.profileInput,
      params.profileMetrics,
    );
    const cohortKey = this.compliantDistillationService.resolveCohortKey(
      params.profileInput,
    );

    const input: DistillationEvaluationInput = {
      profileId: params.profileId,
      schoolId: params.school.id,
      schoolCountry: params.school.country ?? null,
      profile: params.profileInput,
      profileMetrics: params.profileMetrics,
      school: params.schoolInput,
      ourProbPrePlatt: params.ourProbPrePlatt,
      servedProbability: params.servedProbability,
      cohortKey,
      applicationRound: params.applicationRound,
      selectivityBand: params.selectivityBand,
      inputSummary,
    };

    const evaluated =
      await this.compliantDistillationService.evaluatePrediction(
        input,
        options,
      );

    if (!evaluated) return null;
    return {
      ...evaluated,
      input,
    };
  }

  private computeDistillationCandidateServedProbability(
    decision: DistillationBlendDecision,
    baselineServedProbability: number,
    plattParams: { a: number; b: number } | null | undefined,
    mlPrimaryPath: boolean,
    applyLiveBlend = false,
  ): number {
    if (!decision.hasSignal) return baselineServedProbability;
    const prePlatt = applyLiveBlend
      ? (decision.liveBlendedPrePlatt ?? decision.blendedPrePlatt)
      : decision.blendedPrePlatt;
    if (mlPrimaryPath || !plattParams) return prePlatt;
    return this.applyPlattCalibration(prePlatt, plattParams);
  }

  private applyProbabilityDelta(
    current: {
      probability: number;
      probabilityLow?: number;
      probabilityHigh?: number;
    },
    nextProbability: number,
  ): void {
    const delta = nextProbability - current.probability;
    current.probability = nextProbability;
    if (current.probabilityLow != null) {
      current.probabilityLow = Math.max(
        0.01,
        Math.min(current.probability, current.probabilityLow + delta),
      );
    }
    if (current.probabilityHigh != null) {
      current.probabilityHigh = Math.max(
        current.probability,
        Math.min(0.99, current.probabilityHigh + delta),
      );
    }
  }

  private async recordCompliantDistillationObservation(payload: {
    savedRefs: SavedPredictionRefs;
    policyVersionId?: string;
    evaluation: Awaited<
      ReturnType<PredictionService['evaluateCompliantDistillation']>
    >;
    servedProbability: number;
    candidateServedProbability: number;
    applicationRound: string;
    selectivityBand: string | null;
  }): Promise<void> {
    if (
      !this.distillationObservationService ||
      !payload.evaluation?.stage ||
      !payload.savedRefs.predictionSnapshotId
    ) {
      return;
    }

    await this.distillationObservationService.record({
      profileId: payload.evaluation.input.profileId,
      schoolId: payload.evaluation.input.schoolId,
      predictionResultId: payload.savedRefs.predictionResultId,
      predictionSnapshotId: payload.savedRefs.predictionSnapshotId,
      policyVersionId: payload.policyVersionId,
      observedAt: new Date(),
      stage: payload.evaluation.stage,
      applicationRound: payload.applicationRound,
      selectivityBand: payload.selectivityBand,
      ourProbPrePlatt: payload.evaluation.input.ourProbPrePlatt,
      candidateServedProbability: payload.candidateServedProbability,
      servedProbability: payload.servedProbability,
      coverageTier: payload.evaluation.decision.coverageTier,
      inputSummary: payload.evaluation.input.inputSummary,
      decision: payload.evaluation.decision,
    });
  }

  private withCompliantDistillationTrace<T extends object>(
    trace: T,
    evaluation: Awaited<
      ReturnType<PredictionService['evaluateCompliantDistillation']>
    >,
    candidateServedProbability: number,
    servedProbability: number,
  ): T & { distillation?: PredictionTracePayload['distillation'] } {
    if (!evaluation) return trace;

    const teacherSummaries = evaluation.decision.teacherSignals.map(
      (signal) => ({
        key: signal.key,
        active: signal.active,
        probability: signal.probability,
        effectiveWeight: signal.effectiveBlendWeight,
        confidence: signal.confidence,
        sampleCount: signal.sampleCount ?? null,
        bucketKey: signal.bucketKey ?? null,
        missingReasons: signal.missingReasons,
      }),
    );

    return {
      ...trace,
      distillation: {
        stage: evaluation.stage,
        applyLiveBlend: evaluation.applyLiveBlend,
        liveEligible: evaluation.decision.liveEligible,
        coverageTier: evaluation.decision.coverageTier,
        cohortKey: evaluation.decision.cohortKey,
        activeTeacherKeys: teacherSummaries
          .filter((signal) => signal.active && signal.probability != null)
          .map((signal) => signal.key),
        totalConfiguredWeight: evaluation.decision.totalConfiguredWeight,
        totalEffectiveWeight: evaluation.decision.totalEffectiveWeight,
        totalLiveEffectiveWeight: evaluation.decision.totalLiveEffectiveWeight,
        blendedPrePlatt: evaluation.decision.blendedPrePlatt,
        liveBlendedPrePlatt: evaluation.decision.liveBlendedPrePlatt,
        candidateServedProbability,
        servedProbability,
        teacherSummaries,
      },
    };
  }

  // ==================== 辅助方法 ====================

  /**
   * Turn the raw low/medium/high confidence key into a short user-facing explanation.
   */
  private generateConfidenceReason(
    confidence: 'low' | 'medium' | 'high',
    profile: ProfileInput,
    sourceSummary?: Array<{ label: string; detail?: string }>,
    uncertaintyReasons?: string[],
    locale = 'zh',
  ): string {
    const isZh = locale === 'zh';
    const hasScores = (profile.testScores?.length ?? 0) > 0;
    const hasActivities = (profile.activities?.length ?? 0) > 0;
    const hasAwards = (profile.awards?.length ?? 0) > 0;
    const hasRoundSignal = (sourceSummary ?? []).some((item) =>
      /round-aware adjustment/i.test(item.label),
    );
    const hasMatchedSignals = (sourceSummary ?? []).some((item) =>
      /(cohort|historical|international|feeder)/i.test(
        `${item.label} ${item.detail ?? ''}`,
      ),
    );
    const missingSignals = [
      !hasScores ? (isZh ? '标化成绩' : 'test scores') : null,
      !hasActivities ? (isZh ? '活动经历' : 'activities') : null,
      !hasAwards ? (isZh ? '奖项信息' : 'awards') : null,
    ].filter(Boolean) as string[];

    if (confidence === 'high') {
      if (isZh) {
        return `这份预测使用了较完整的成绩与经历信息${
          hasMatchedSignals ? '，并结合了更贴近你背景的历史信号' : ''
        }${hasRoundSignal ? '，申请轮次也已纳入计算' : ''}，所以参考程度较高。`;
      }
      return `This estimate uses a fairly complete academic and profile record${
        hasMatchedSignals
          ? ' and incorporates historical signals that are closer to your background'
          : ''
      }${
        hasRoundSignal
          ? ', with your application round included in the calculation'
          : ''
      }, so the data support level is high.`;
    }

    if (confidence === 'medium') {
      if (isZh) {
        return `这份预测已经结合了你的核心成绩信息和学校背景数据${
          hasRoundSignal ? '，申请轮次也已纳入计算' : ''
        }${
          missingSignals.length || (uncertaintyReasons?.length ?? 0) > 0
            ? `，但${missingSignals.length ? `${missingSignals.join('、')}和` : ''}更细的匹配信号仍然有限`
            : '，但个体化信号还不算充分'
        }，所以参考程度为中。`;
      }
      return `This estimate combines your core academic record with school-level context${
        hasRoundSignal ? ', including your application round' : ''
      }${
        missingSignals.length || (uncertaintyReasons?.length ?? 0) > 0
          ? `, but ${missingSignals.length ? `${missingSignals.join(', ')} and ` : ''}more tailored matching signals are still limited`
          : ', though the personalized signal depth is still moderate'
      }, so the data support level is medium.`;
    }

    if (isZh) {
      return `这份预测目前更多依赖学校整体数据${
        hasRoundSignal ? '和轮次修正' : ''
      }，因为${missingSignals.length ? missingSignals.join('、') : '个人档案要素'}或可匹配历史样本还不够完整，所以参考程度偏低。`;
    }
    return `This estimate currently leans more on broad school-level data${
      hasRoundSignal ? ' and round-based adjustment' : ''
    } because ${
      missingSignals.length ? missingSignals.join(', ') : 'key profile details'
    } or matched historical cohorts are still incomplete, so the data support level is low.`;
  }

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
    result: InternalPredictionResult,
  ): Promise<SavedPredictionRefs> {
    return this.persistenceService.savePrediction(profileId, schoolId, result);
  }

  /** @deprecated Use PredictionReportingService.getPredictionHistory() directly */
  async getPredictionHistory(
    profileId: string,
    page?: number,
    pageSize?: number,
    locale: 'zh' | 'en' = 'zh',
  ) {
    return this.reportingService.getPredictionHistory(
      profileId,
      page,
      pageSize,
      locale,
    );
  }

  /** @deprecated Use PredictionReportingService.reportActualResult() directly */
  async reportActualResult(
    profileId: string,
    schoolId: string,
    actualResult:
      | 'ADMITTED'
      | 'REJECTED'
      | 'WAITLISTED'
      | 'DEFERRED'
      | 'WITHDRAWN',
    options?: {
      notes?: string;
      evidenceUrl?: string;
      round?: string;
      isFinal?: boolean;
    },
  ): Promise<void> {
    return this.reportingService.reportActualResult(
      profileId,
      schoolId,
      actualResult,
      options,
    );
  }

  /** @deprecated Use PredictionReportingService.getCalibrationData() directly */
  async getCalibrationData() {
    return this.reportingService.getCalibrationData();
  }
}
