/**
 * ML-Primary Prediction Pipeline (v5)
 *
 * Core orchestrator for the new prediction architecture that replaces
 * the 4-engine ensemble approach. Uses a tiered strategy:
 *
 *   Tier 0: Heuristic fused with base rate (cold start)
 *   Tier 1+: ML model from registry (Platt / LR / GBDT)
 *
 * All probability adjustments (hooks, calibration) operate in log-odds
 * space to maintain mathematical correctness.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { InternalPredictionResult } from './prediction-persistence.service';
import { PredictionHookModifiersService } from './prediction-hook-modifiers.service';
import type { HookShift } from './prediction-hook-modifiers.service';
import { ModelRegistryService } from './ml/model-registry.service';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { PredictionTransformerService } from './prediction-transformer.service';
import { PredictionMemoryService } from './prediction-memory.service';
import { resolveContextualAcceptanceRate } from '../../common/utils/scoring';
import { determineTier, getSelectivityBand } from './ml/tier-strategy';
import type { TierConfig } from './ml/tier-strategy';
import type { ProfileInput, SchoolInput } from './prediction.prompts';
import {
  type ProfileMetrics,
  type SchoolMetrics,
  calculateOverallScore,
  calculateProbability,
  calculateTier,
  calculateConfidence,
  calculateSelectivityIndex,
  logit,
  invLogit,
  extractFeatureVector,
  imputeFeatures,
  featureVectorToArray,
  predict as mlPredict,
  predictGBDT,
  resolveCanonicalPredictionOutcome,
  resolveMajorToCip,
  VERIFIED_OUTCOME_STATUSES,
} from '@study-abroad/shared/scoring';
import type { TrainedModel, GBDTModel } from '@study-abroad/shared/scoring';

// ============================================
// Types
// ============================================

const MODEL_VERSION = 'v5-ml-primary';

/** Confidence interval half-widths by confidence level */
const CI_HALF_WIDTH: Record<string, number> = {
  high: 0.04,
  medium: 0.07,
  low: 0.11,
};

/** Result type extending InternalPredictionResult with v5 pipeline metadata */
export interface MlPrimaryResult extends InternalPredictionResult {
  /** Which tier of the ML pipeline was used (0 = heuristic, 1-4 = ML) */
  pipelineTier: number;
  /** Calibration method applied ('platt' | 'beta' | 'none') */
  calibrationMethod: string;
  /** Base rate used for this school+round+profile combination */
  baseRate: number;
  /** Hook shifts applied in log-odds space */
  hookShifts: HookShift[];
}

// ============================================
// Service
// ============================================

@Injectable()
export class PredictionMlPrimaryService {
  private readonly logger = new Logger(PredictionMlPrimaryService.name);

  constructor(
    private readonly hookModifiers: PredictionHookModifiersService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly calibration: PredictionCalibrationService,
    private readonly transformer: PredictionTransformerService,
    private readonly memory: PredictionMemoryService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Predict admission probability for a single school using the v5 ML-Primary pipeline.
   *
   * Pipeline steps:
   *   1. Compute base rate (school rate + round + intl + China + major adjustments)
   *   2. Determine tier from labeled data count
   *   3. Tier 0 → fuse heuristic with base rate; Tier 1+ → ML model from registry
   *   4. Apply hook shifts in log-odds space
   *   5. Apply calibration (Platt or school-level)
   *   6. Calculate tier (reach/match/safety) and confidence
   *   7. Calculate confidence interval
   */
  async predictForSchool(
    profileId: string,
    school: any,
    profileInput: ProfileInput,
    schoolInput: SchoolInput,
    profileMetrics: ProfileMetrics,
    schoolMetrics: SchoolMetrics,
    round: string,
    locale: string,
  ): Promise<MlPrimaryResult> {
    // Step 1: Base rate (school-level acceptance rate adjusted for round, intl, China, major)
    const majorCompetitiveness = await this.resolveMajorCompetitiveness(
      school.id,
      profileMetrics.targetMajorCategory,
    );
    const baseRate = await this.hookModifiers.getBaseRate(
      school,
      profileInput,
      round,
      majorCompetitiveness,
    );

    // Step 2: Determine tier from labeled data count
    const labeledCount = await this.countLabeledData(school.id);
    const tierConfig = determineTier(labeledCount);
    const selectivityBand = getSelectivityBand(
      calculateSelectivityIndex(schoolMetrics),
    );

    // Step 3: Compute raw probability
    let rawProbability: number;
    let engineDetail: string;

    if (tierConfig.tier === 0) {
      // Cold start: fuse base rate and heuristic
      const overallScore = calculateOverallScore(profileMetrics, schoolMetrics);
      const heuristicProb = calculateProbability(overallScore, schoolMetrics);
      rawProbability = this.fuseBaseRateAndHeuristic(baseRate, heuristicProb);
      engineDetail = 'heuristic_fused_base_rate';
    } else {
      // Tier 1+: use ML model from registry
      rawProbability = await this.predictWithModel(
        tierConfig,
        profileMetrics,
        schoolMetrics,
        school,
        selectivityBand,
        round,
        baseRate,
      );
      engineDetail = `ml_tier_${tierConfig.tier}_${tierConfig.modelType}`;
    }

    // Step 4: Apply hook shifts in log-odds space
    const hookShifts = this.hookModifiers.computeHookShifts(
      profileInput,
      schoolInput as any,
    );
    const postHookProbability = this.hookModifiers.applyHooks(
      rawProbability,
      hookShifts,
    );

    // Step 5: Apply calibration
    const { calibratedProbability, calibrationMethod } =
      await this.applyCalibration(postHookProbability, school.id, labeledCount);

    // Step 6: Calculate tier classification and confidence
    const probability = Math.max(0.05, Math.min(0.95, calibratedProbability));
    const tierContext = resolveContextualAcceptanceRate({
      schoolMeta: {
        acceptanceRate: schoolInput.acceptanceRate,
        intlAcceptanceRate: schoolInput.intlAcceptanceRate,
      },
      isInternational: Boolean(profileInput.isInternational),
      roundContext: round,
    });
    const tierSchoolMetrics = tierContext
      ? { ...schoolMetrics, acceptanceRate: tierContext.rate }
      : schoolMetrics;
    const tier = calculateTier(probability, tierSchoolMetrics);
    const confidence = calculateConfidence(profileMetrics, schoolMetrics);

    // Step 7: Confidence interval
    const { probabilityLow, probabilityHigh } =
      this.calculateConfidenceInterval(probability, confidence, tierConfig);

    // Generate deterministic factors from hook shifts (Fix 7: no empty factors)
    // Note: explicit `let impact: 'positive' | 'negative'` narrows the literal type,
    // surviving eslint --fix passes that strip inline `as` casts.
    const factors = hookShifts
      .filter((h) => Math.abs(h.logOddsShift) > 0.05)
      .map((h) => {
        const impact: 'positive' | 'negative' =
          h.logOddsShift > 0 ? 'positive' : 'negative';
        return {
          name: this.humanizeHookType(h.hookType),
          impact,
          weight: Math.min(1, Math.abs(h.logOddsShift) / 3),
          detail: `${h.source} (${h.logOddsShift > 0 ? '+' : ''}${h.logOddsShift.toFixed(2)} log-odds)`,
        };
      });

    // Redact hookShifts for public API (Fix 8: no model coefficient leakage)
    const redactedHookShifts = hookShifts.map((h) => ({
      hookType: this.humanizeHookType(h.hookType),
      logOddsShift: 0, // Redacted — exact values are admin-only
      source: h.logOddsShift > 0 ? 'positive' : 'negative',
    }));

    // Build served trace for audit (Fix 6: traceability)
    const servedTrace = {
      pipeline: 'ml-primary',
      pipelineTier: tierConfig.tier,
      calibrationMethod,
      baseRate,
      hookShifts, // Full precision in trace (DB only, not public API)
      labeledCount,
      engineDetail,
    };

    // Build result
    const result: MlPrimaryResult = {
      schoolId: school.id,
      schoolName: school.name ?? '',
      probability,
      probabilityLow,
      probabilityHigh,
      confidence,
      tier,
      factors,
      suggestions: [],
      comparison: {
        gpaPercentile: 50,
        testScorePercentile: 50,
        activityStrength: 'average' as const,
      },
      engineScores: {
        stats: rawProbability,
        ml: tierConfig.tier > 0 ? rawProbability : undefined,
        weights: {
          ml: tierConfig.tier > 0 ? 1.0 : 0,
          heuristic: tierConfig.tier === 0 ? 1.0 : 0,
        },
        fusionMethod: engineDetail,
        mlModelTier: tierConfig.tier > 0 ? tierConfig.tier : undefined,
      },
      modelVersion: MODEL_VERSION,
      policyVersionId: MODEL_VERSION,
      applicationRound: round,
      selectivityBand,
      servedTrace: servedTrace as any,
      pipelineTier: tierConfig.tier,
      calibrationMethod,
      baseRate,
      hookShifts: redactedHookShifts,
    };

    return result;
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Fuse base rate and heuristic probability in log-odds space.
   * Anchors prediction to the school's actual acceptance rate while
   * incorporating the heuristic's student-specific signal.
   */
  private fuseBaseRateAndHeuristic(
    baseRate: number,
    heuristicProb: number,
  ): number {
    const baseLogOdds = logit(baseRate);
    const heuristicLogOdds = logit(heuristicProb);
    // Weight base rate more (0.6) than heuristic (0.4) — base rate is real data
    return invLogit(baseLogOdds * 0.6 + heuristicLogOdds * 0.4);
  }

  /**
   * Run prediction through the ML model appropriate for the tier.
   * Falls back to heuristic fusion if the model is unavailable.
   */
  private async predictWithModel(
    tierConfig: TierConfig,
    profileMetrics: ProfileMetrics,
    schoolMetrics: SchoolMetrics,
    school: any,
    selectivityBand: string,
    round: string,
    baseRate: number,
  ): Promise<number> {
    // Try band-specific model first (Tier 3+), then global
    const bandToQuery = tierConfig.bandModels ? selectivityBand : null;
    const model = await this.modelRegistry.getChampionModel(bandToQuery);

    if (!model) {
      // No model available — fallback to Tier 0 heuristic fusion
      this.logger.warn(
        `No champion model for band=${bandToQuery ?? 'global'}, falling back to heuristic fusion`,
      );
      const overallScore = calculateOverallScore(profileMetrics, schoolMetrics);
      const heuristicProb = calculateProbability(overallScore, schoolMetrics);
      return this.fuseBaseRateAndHeuristic(baseRate, heuristicProb);
    }

    // Extract feature vector
    const featureVector = extractFeatureVector(profileMetrics, schoolMetrics, {
      round,
      isPrivateSchool: school.isPrivate ?? false,
      tuition: school.tuition != null ? Number(school.tuition) : undefined,
      usNewsRank: school.usNewsRank ?? undefined,
    });

    // Impute missing values using model's training medians
    const medians = (model as TrainedModel).featureMedians ?? {};
    const imputedVector = imputeFeatures(featureVector, medians);

    // Convert to array matching model's feature order
    const featureNames = (model as TrainedModel).featureNames;
    if (!featureNames) {
      this.logger.warn('Model has no featureNames, falling back to heuristic');
      const overallScore = calculateOverallScore(profileMetrics, schoolMetrics);
      const heuristicProb = calculateProbability(overallScore, schoolMetrics);
      return this.fuseBaseRateAndHeuristic(baseRate, heuristicProb);
    }

    const featureArray = featureVectorToArray(
      imputedVector,
      featureNames as (keyof typeof imputedVector)[],
    );

    // Run inference based on model type
    if (tierConfig.modelType === 'gbdt') {
      return predictGBDT(model as GBDTModel, featureArray);
    }

    return mlPredict(model as TrainedModel, featureArray);
  }

  /**
   * Apply calibration to the raw probability.
   * Platt scaling when available (from calibration service),
   * school-level multiplier as final adjustment.
   */
  private async applyCalibration(
    probability: number,
    schoolId: string,
    labeledCount: number,
  ): Promise<{ calibratedProbability: number; calibrationMethod: string }> {
    let calibratedProbability = probability;
    let calibrationMethod = 'none';

    // Platt scaling (global, requires 50+ labeled outcomes)
    if (labeledCount >= 50) {
      const plattParams = await this.calibration.getPlattCalibration();
      if (plattParams) {
        calibratedProbability = this.calibration.applyPlattCalibration(
          calibratedProbability,
          plattParams,
        );
        calibrationMethod = 'platt';
      }
    }

    // School-level calibration multiplier (from admin-curated SchoolCalibration table)
    const schoolCalibrations = await this.calibration.getSchoolCalibrations();
    const schoolMultiplier = schoolCalibrations[schoolId];
    if (schoolMultiplier != null && schoolMultiplier > 0) {
      calibratedProbability = Math.min(
        0.95,
        calibratedProbability * schoolMultiplier,
      );
      if (calibrationMethod === 'none') {
        calibrationMethod = 'school_multiplier';
      } else {
        calibrationMethod += '+school_multiplier';
      }
    }

    return { calibratedProbability, calibrationMethod };
  }

  /**
   * Calculate confidence interval based on confidence level and pipeline tier.
   *
   * Half-widths: high ±4%, medium ±7%, low ±11%.
   * Tier 0 (heuristic only) widens interval by 30% to reflect higher uncertainty.
   */
  private calculateConfidenceInterval(
    probability: number,
    confidence: 'low' | 'medium' | 'high',
    tierConfig: TierConfig,
  ): { probabilityLow: number; probabilityHigh: number } {
    let halfWidth = CI_HALF_WIDTH[confidence] ?? CI_HALF_WIDTH.medium;

    // Widen for cold-start tier (no ML model backing the prediction)
    if (tierConfig.tier === 0) {
      halfWidth *= 1.3;
    }

    const probabilityLow = Math.max(0.01, probability - halfWidth);
    const probabilityHigh = Math.min(0.99, probability + halfWidth);

    return { probabilityLow, probabilityHigh };
  }

  /**
   * Count labeled (outcome-verified) prediction records for a school.
   * Used to determine which ML tier is appropriate.
   */
  private async countLabeledData(schoolId: string): Promise<number> {
    const records = await this.prisma.predictionResult.findMany({
      where: {
        schoolId,
        outcomeLabelRecords: {
          some: {
            status: { in: VERIFIED_OUTCOME_STATUSES },
            result: { in: ['ADMITTED', 'REJECTED'] },
          },
        },
      },
      select: {
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

    return records.reduce((count, record) => {
      const canonical = resolveCanonicalPredictionOutcome(
        record.outcomeLabelRecords,
      );
      return canonical.eligibleForCalibration && canonical.canonicalRecord
        ? count + 1
        : count;
    }, 0);
  }

  /**
   * Resolve major competitiveness for a school+major combination.
   * Returns the competitiveness score (1-5) or undefined if no data.
   */
  private async resolveMajorCompetitiveness(
    schoolId: string,
    targetMajorCategory?: string,
  ): Promise<number | undefined> {
    if (!targetMajorCategory) return undefined;

    // Resolve free-text major to CIP code for precise lookup
    const cipCode = resolveMajorToCip(targetMajorCategory);

    const program = await this.prisma.schoolProgram.findFirst({
      where: cipCode
        ? { schoolId, cipCode } // Exact CIP match
        : {
            schoolId,
            programName: { contains: targetMajorCategory, mode: 'insensitive' },
          }, // Fallback text search
      select: { competitiveness: true },
    });

    return program?.competitiveness ?? undefined;
  }

  /** Convert internal hook type enum to user-friendly label */
  private humanizeHookType(hookType: string): string {
    const labels: Record<string, string> = {
      LEGACY_PRIMARY: 'Legacy Advantage',
      LEGACY_SECONDARY: 'Family Connection',
      FIRST_GEN: 'First-Generation Status',
      NEED_AWARE_PARTIAL: 'Financial Aid Impact',
      NEED_AWARE_FULL: 'Full Financial Aid Impact',
      ROUND_BONUS: 'Application Round',
      CHINA_ADJUSTMENT: 'International Competitiveness',
      MAJOR_SELECTIVITY: 'Major Competitiveness',
    };
    return labels[hookType] || hookType.replace(/_/g, ' ').toLowerCase();
  }
}
