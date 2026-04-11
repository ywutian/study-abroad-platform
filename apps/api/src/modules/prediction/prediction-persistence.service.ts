import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionResultDto } from './dto';
import {
  LEGACY_PREDICTION_POLICY_DESCRIPTION,
  LEGACY_PREDICTION_POLICY_KEY,
  LEGACY_PREDICTION_POLICY_NAME,
  LEGACY_PREDICTION_POLICY_VERSION,
} from './prediction-policy.constants';

const DEFAULT_MODEL_VERSION = 'v3-enterprise';

class MissingPredictionPolicyVersionError extends Error {
  constructor(policyVersionId: string) {
    super(`Prediction policy version ${policyVersionId} not found`);
    this.name = 'MissingPredictionPolicyVersionError';
  }
}

/**
 * Internal result type that extends the public DTO with DB column names
 * used only for persistence. This avoids unsafe type casts.
 */
export interface InternalPredictionResult extends PredictionResultDto {
  /** Maps to DB column `policyVersionId` (public API uses `servedPolicyVersionId`) */
  policyVersionId?: string;
  /** Maps to DB column `applicationRound` (public API uses `roundContext`) */
  applicationRound?: string;
  /** Full audit trace envelope for DB storage */
  servedTrace?: unknown;
}

/**
 * Database persistence layer for prediction results.
 *
 * Handles upsert of PredictionResult records and creation of
 * PredictionSnapshot entries for historical trend tracking.
 */
@Injectable()
export class PredictionPersistenceService {
  private readonly logger = new Logger(PredictionPersistenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async ensureLegacyPolicyVersion(): Promise<string> {
    const policy = await this.prisma.predictionPolicyVersion.upsert({
      where: { id: LEGACY_PREDICTION_POLICY_VERSION },
      update: {},
      create: {
        id: LEGACY_PREDICTION_POLICY_VERSION,
        policyKey: LEGACY_PREDICTION_POLICY_KEY,
        version: LEGACY_PREDICTION_POLICY_VERSION,
        name: LEGACY_PREDICTION_POLICY_NAME,
        status: 'RETIRED',
        description: LEGACY_PREDICTION_POLICY_DESCRIPTION,
        notes: '[system-backfill:legacy-policy-lineage]',
        retiredAt: new Date(),
      },
      select: { id: true },
    });

    return policy.id;
  }

  private async resolvePersistedPolicyVersionId(
    policyVersionId?: string,
  ): Promise<string | undefined> {
    if (!policyVersionId) {
      return undefined;
    }

    const existing = await this.prisma.predictionPolicyVersion.findUnique({
      where: { id: policyVersionId },
      select: { id: true },
    });

    if (existing?.id) {
      return existing.id;
    }

    if (policyVersionId === LEGACY_PREDICTION_POLICY_VERSION) {
      return this.ensureLegacyPolicyVersion();
    }

    this.logger.error(
      `Prediction policy version ${policyVersionId} not found; refusing to persist unresolved lineage`,
    );
    throw new MissingPredictionPolicyVersionError(policyVersionId);
  }

  /**
   * Persist a prediction result to the database using upsert.
   *
   * Creates a new PredictionResult row or updates an existing one keyed by
   * the (profileId, schoolId) compound unique constraint. Stores probability,
   * confidence interval, engine scores, factors, suggestions, and model version.
   * Also writes a PredictionSnapshot for trend tracking.
   * Failures are logged but do not propagate.
   *
   * @param profileId - The profile identifier
   * @param schoolId - The school identifier
   * @param result - The fully computed prediction result
   */
  async savePrediction(
    profileId: string,
    schoolId: string,
    result: InternalPredictionResult,
  ): Promise<void> {
    try {
      const modelVersion = result.modelVersion ?? DEFAULT_MODEL_VERSION;
      const policyVersionId = await this.resolvePersistedPolicyVersionId(
        result.policyVersionId,
      );

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
          modelVersion,
          policyVersionId,
          servedTrace: result.servedTrace as any,
          cohortKey: result.cohortKey,
          applicationRound: result.applicationRound,
          sourceSummary: result.sourceSummary as any,
          uncertaintyReasons: result.uncertaintyReasons as any,
          confidenceReason: result.confidenceReason,
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
          modelVersion,
          policyVersionId,
          servedTrace: result.servedTrace as any,
          cohortKey: result.cohortKey,
          applicationRound: result.applicationRound,
          sourceSummary: result.sourceSummary as any,
          uncertaintyReasons: result.uncertaintyReasons as any,
          confidenceReason: result.confidenceReason,
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
          modelVersion,
          policyVersionId,
          servedTrace: result.servedTrace as any,
          cohortKey: result.cohortKey,
          applicationRound: result.applicationRound,
          sourceSummary: result.sourceSummary as any,
          uncertaintyReasons: result.uncertaintyReasons as any,
          confidenceReason: result.confidenceReason,
        },
      });
    } catch (error) {
      if (error instanceof MissingPredictionPolicyVersionError) {
        this.logger.error(error.message);
        return;
      }
      this.logger.warn('Failed to save prediction to database', error);
    }
  }
}
