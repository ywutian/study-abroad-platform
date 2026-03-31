import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { MemoryType } from '@prisma/client';
import { fireAndForget } from '../../common/utils/async.util';
import { createPaginatedResponse } from '../../common/dto/pagination.dto';

/**
 * Reporting and calibration data service for predictions.
 *
 * Provides prediction history retrieval, actual result reporting for
 * calibration feedback loops, and bucket-level calibration statistics.
 */
@Injectable()
export class PredictionReportingService {
  private readonly logger = new Logger(PredictionReportingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly memoryManager?: MemoryManagerService,
  ) {}

  /**
   * Retrieve the prediction history for a profile, ordered by most recent first.
   *
   * @param profileId - The profile identifier
   * @param page - Page number (default: 1)
   * @param pageSize - Items per page (default: 20)
   */
  async getPredictionHistory(profileId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.predictionResult.findMany({
        where: { profileId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.predictionResult.count({ where: { profileId } }),
    ]);
    return createPaginatedResponse(items, total, page, pageSize);
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

      // Write prediction feedback to memory system
      if (this.memoryManager) {
        const [prediction, school] = await Promise.all([
          this.prisma.predictionResult.findFirst({
            where: { profileId, schoolId },
          }),
          this.prisma.school.findUnique({
            where: { id: schoolId },
            select: { name: true },
          }),
        ]);

        if (prediction) {
          const probability = Number(prediction.probability);
          const isCorrect = (actualResult === 'ADMITTED') === probability > 0.5;

          fireAndForget(
            this.memoryManager.remember(profileId, {
              type: MemoryType.FACT,
              category: 'prediction_feedback',
              content: `预测结果反馈：${school?.name ?? schoolId} 预测概率 ${Math.round(probability * 100)}%，实际结果 ${actualResult}${isCorrect ? '（预测准确）' : '（预测偏差）'}`,
              importance: 0.7,
              metadata: {
                schoolId,
                predicted: probability,
                actual: actualResult,
                isCorrect,
              },
            }),
            this.logger,
            'Failed to record prediction feedback to memory',
          );
        }
      }
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
