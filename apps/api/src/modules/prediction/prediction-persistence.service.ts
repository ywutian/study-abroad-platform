import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionResultDto } from './dto';

const MODEL_VERSION = 'v3-enterprise';

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
}
