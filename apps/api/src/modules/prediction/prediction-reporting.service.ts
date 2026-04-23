import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';
import { PredictionCalibrationService } from './prediction-calibration.service';
import { MemoryType } from '@prisma/client';
import { fireAndForget } from '../../common/utils/async.util';
import { createPaginatedResponse } from '../../common/dto/pagination.dto';
import {
  computeBrierScore,
  computeECE,
  type CanonicalOutcomeLabel,
  type OutcomeLabelRecordShape,
  isCalibrationEligibleOutcomeRecord,
  resolveCanonicalPredictionOutcome,
} from '@study-abroad/shared/scoring';
import type {
  PredictionOutcomeQueryDto,
  ReviewPredictionOutcomeDto,
} from '../admin/dto';
import { ShadowEvaluatorService } from './ml/shadow-evaluator.service';
import { DistillationStatsRollupService } from './distillation/distillation-stats-rollup.service';

type ReportedOutcomeResult =
  | 'ADMITTED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'DEFERRED';

const CALIBRATION_EXCLUDED_SOURCES = ['quick-match'] as const;

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
    @Optional()
    private readonly calibrationService?: PredictionCalibrationService,
    @Optional() private readonly shadowEvaluator?: ShadowEvaluatorService,
    @Optional()
    private readonly distillationRollups?: DistillationStatsRollupService,
  ) {}

  public mapLatestOutcomeLabel(record?: OutcomeLabelRecordShape | null) {
    if (!record) return undefined;
    return {
      id: record.id,
      result: record.result,
      status: record.status,
      notes: record.notes ?? undefined,
      evidenceUrl: record.evidenceUrl ?? undefined,
      round: record.round ?? undefined,
      reportedAt: record.createdAt.toISOString(),
      resolvedAt: record.resolvedAt?.toISOString(),
    };
  }

  public isCalibrationEligible(
    record?: OutcomeLabelRecordShape | null,
  ): boolean {
    return isCalibrationEligibleOutcomeRecord(record);
  }

  public resolveCanonicalOutcome(records?: OutcomeLabelRecordShape[] | null): {
    canonicalRecord: OutcomeLabelRecordShape | null;
    displayRecord: OutcomeLabelRecordShape | null;
    canonicalOutcomeLabel: CanonicalOutcomeLabel;
    eligibleForCalibration: boolean;
  } {
    return resolveCanonicalPredictionOutcome(records);
  }

  private getStoredActualResult(
    canonical: ReturnType<
      PredictionReportingService['resolveCanonicalOutcome']
    >,
  ): ReportedOutcomeResult | null {
    if (!canonical.eligibleForCalibration || !canonical.canonicalRecord) {
      return null;
    }
    return canonical.canonicalRecord.result as Extract<
      ReportedOutcomeResult,
      'ADMITTED' | 'REJECTED'
    >;
  }

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
        include: {
          outcomeLabelRecords: {
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.predictionResult.count({ where: { profileId } }),
    ]);
    const normalizedItems = items.map((item) => {
      const canonical = this.resolveCanonicalOutcome(item.outcomeLabelRecords);
      return {
        ...item,
        servedPolicyVersionId: item.policyVersionId ?? undefined,
        roundContext: item.applicationRound ?? undefined,
        latestOutcomeLabel: this.mapLatestOutcomeLabel(canonical.displayRecord),
        calibrationEligible: canonical.eligibleForCalibration,
      };
    });

    return createPaginatedResponse(normalizedItems, total, page, pageSize);
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
    actualResult: ReportedOutcomeResult,
    options?: {
      notes?: string;
      evidenceUrl?: string;
      round?: string;
      isFinal?: boolean;
    },
  ): Promise<void> {
    try {
      const now = new Date();
      const prediction = await this.prisma.predictionResult.findUnique({
        where: { profileId_schoolId: { profileId, schoolId } },
        select: {
          id: true,
          probability: true,
          cohortKey: true,
          schoolId: true,
          profileId: true,
        },
      });

      if (!prediction) {
        this.logger.warn(
          `Prediction not found while reporting actual result for profile ${profileId}, school ${schoolId}`,
        );
        return;
      }

      // Dedup: skip if a SELF_REPORTED record already exists for this prediction
      const existingSelfReport =
        await this.prisma.predictionOutcomeLabelRecord.findFirst({
          where: {
            predictionResultId: prediction.id,
            status: 'SELF_REPORTED',
          },
        });

      if (existingSelfReport) {
        // Update existing record instead of creating duplicate
        await this.prisma.$transaction(async (tx) => {
          await tx.predictionOutcomeLabelRecord.update({
            where: { id: existingSelfReport.id },
            data: {
              result: actualResult,
              notes: options?.notes,
              evidenceUrl: options?.evidenceUrl,
              round: options?.round,
              isFinal: options?.isFinal ?? false,
            },
          });

          const allLabels = await tx.predictionOutcomeLabelRecord.findMany({
            where: { predictionResultId: prediction.id },
            orderBy: { createdAt: 'desc' },
          });
          const canonical = this.resolveCanonicalOutcome(allLabels);

          await tx.predictionResult.update({
            where: { id: prediction.id },
            data: {
              actualResult: this.getStoredActualResult(canonical),
              reportedAt: now,
              outcomeLabel: canonical.canonicalOutcomeLabel,
              outcomeLabeledAt: now,
            },
          });

          const latestSnapshot = await tx.predictionSnapshot.findFirst({
            where: {
              profileId: prediction.profileId,
              schoolId: prediction.schoolId,
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });

          if (latestSnapshot) {
            await tx.predictionSnapshot.update({
              where: { id: latestSnapshot.id },
              data: {
                outcomeLabel: canonical.canonicalOutcomeLabel,
                outcomeLabeledAt: now,
              },
            });
          }
        });
      } else {
        await this.prisma.$transaction(async (tx) => {
          await tx.predictionOutcomeLabelRecord.create({
            data: {
              predictionResultId: prediction.id,
              result: actualResult,
              status: 'SELF_REPORTED',
              notes: options?.notes,
              evidenceUrl: options?.evidenceUrl,
              round: options?.round,
              isFinal: options?.isFinal ?? false,
              reportedBy: profileId,
            },
          });

          const allLabels = await tx.predictionOutcomeLabelRecord.findMany({
            where: { predictionResultId: prediction.id },
            orderBy: { createdAt: 'desc' },
          });
          const canonical = this.resolveCanonicalOutcome(allLabels);

          await tx.predictionResult.update({
            where: { id: prediction.id },
            data: {
              actualResult: this.getStoredActualResult(canonical),
              reportedAt: now,
              outcomeLabel: canonical.canonicalOutcomeLabel,
              outcomeLabeledAt: now,
            },
          });

          const latestSnapshot = await tx.predictionSnapshot.findFirst({
            where: {
              profileId: prediction.profileId,
              schoolId: prediction.schoolId,
            },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
          });

          if (latestSnapshot) {
            await tx.predictionSnapshot.update({
              where: { id: latestSnapshot.id },
              data: {
                outcomeLabel: canonical.canonicalOutcomeLabel,
                outcomeLabeledAt: now,
              },
            });
          }
        });
      }

      this.logger.log(
        `Recorded actual result ${actualResult} for profile ${profileId}, school ${schoolId}`,
      );

      // Write prediction feedback to memory system
      if (this.memoryManager) {
        const [prediction, school, profile] = await Promise.all([
          this.prisma.predictionResult.findUnique({
            where: { profileId_schoolId: { profileId, schoolId } },
          }),
          this.prisma.school.findUnique({
            where: { id: schoolId },
            select: { name: true },
          }),
          this.prisma.profile.findUnique({
            where: { id: profileId },
            select: { userId: true },
          }),
        ]);

        if (prediction && profile?.userId) {
          const probability = Number(prediction.probability);
          const calibrationEligible =
            actualResult === 'ADMITTED' || actualResult === 'REJECTED';
          const predictedAdmit = probability > 0.5;
          const isCorrect = calibrationEligible
            ? (actualResult === 'ADMITTED') === predictedAdmit
            : undefined;
          const accuracyLabel = calibrationEligible
            ? isCorrect
              ? '（预测方向准确）'
              : '（预测方向偏差）'
            : '（仅记录结果，不计入校准准确性）';

          fireAndForget(
            this.memoryManager.remember(profile.userId, {
              type: MemoryType.FACT,
              category: 'prediction_feedback',
              content: `预测结果反馈：${school?.name ?? schoolId} 预测概率 ${Math.round(probability * 100)}%，实际结果 ${actualResult}${accuracyLabel}`,
              importance: 0.7,
              metadata: {
                schoolId,
                predicted: probability,
                actual: actualResult,
                isCorrect,
                calibrationEligible,
              },
            }),
            this.logger,
            'Failed to record prediction feedback to memory',
          );
        }
      }
      // Invalidate calibration cache so next prediction uses fresh Platt/Beta params
      if (this.calibrationService) {
        fireAndForget(
          this.calibrationService.invalidateCalibrationCache(),
          this.logger,
          'Failed to invalidate calibration cache after outcome report',
        );
      }
      if (this.distillationRollups) {
        fireAndForget(
          this.distillationRollups.refreshForOutcomeChange({
            schoolId,
            cohortKey: prediction.cohortKey ?? undefined,
            asOf: now,
          }),
          this.logger,
          'Failed to refresh distillation rollups after outcome report',
        );
      }
    } catch (error) {
      this.logger.warn('Failed to report actual result', error);
    }
  }

  async getOutcomeReviewQueue(query: PredictionOutcomeQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.result ? { result: query.result } : {}),
      predictionResult: {
        ...(query.schoolId ? { schoolId: query.schoolId } : {}),
        ...(query.policyVersionId
          ? { policyVersionId: query.policyVersionId }
          : {}),
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.predictionOutcomeLabelRecord.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          predictionResult: {
            select: {
              id: true,
              schoolId: true,
              profileId: true,
              policyVersionId: true,
              applicationRound: true,
              applicationYear: true,
              cohortKey: true,
              outcomeLabel: true,
              outcomeLabeledAt: true,
              outcomeLabelRecords: {
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      }),
      this.prisma.predictionOutcomeLabelRecord.count({ where }),
    ]);

    const schoolIds = [
      ...new Set(
        items.map((item) => item.predictionResult.schoolId).filter(Boolean),
      ),
    ];
    const schools = schoolIds.length
      ? await this.prisma.school.findMany({
          where: { id: { in: schoolIds } },
          select: { id: true, name: true, nameZh: true, usNewsRank: true },
        })
      : [];
    const schoolMap = new Map(schools.map((school) => [school.id, school]));

    const normalizedItems = items
      .map((item) => {
        const canonical = this.resolveCanonicalOutcome(
          item.predictionResult.outcomeLabelRecords,
        );
        return {
          id: item.id,
          result: item.result,
          status: item.status,
          notes: item.notes ?? undefined,
          evidenceUrl: item.evidenceUrl ?? undefined,
          round: item.round ?? undefined,
          isFinal: item.isFinal,
          reportedAt: item.createdAt.toISOString(),
          resolvedAt: item.resolvedAt?.toISOString(),
          predictionResultId: item.predictionResult.id,
          schoolId: item.predictionResult.schoolId,
          school: schoolMap.get(item.predictionResult.schoolId) ?? null,
          profileId: item.predictionResult.profileId,
          policyVersionId: item.predictionResult.policyVersionId ?? undefined,
          applicationRound: item.predictionResult.applicationRound ?? undefined,
          applicationYear: item.predictionResult.applicationYear ?? undefined,
          cohortKey: item.predictionResult.cohortKey ?? undefined,
          latestOutcomeLabel: this.mapLatestOutcomeLabel(
            canonical.displayRecord,
          ),
          canonicalOutcomeLabel:
            item.predictionResult.outcomeLabel ?? undefined,
          calibrationEligible: canonical.eligibleForCalibration,
        };
      })
      .filter((item) => (query.eligibleOnly ? item.calibrationEligible : true));

    return createPaginatedResponse(normalizedItems, total, page, pageSize);
  }

  async reviewOutcomeLabel(
    actorId: string,
    id: string,
    dto: ReviewPredictionOutcomeDto,
  ) {
    const existing = await this.prisma.predictionOutcomeLabelRecord.findUnique({
      where: { id },
      include: {
        predictionResult: {
          select: {
            id: true,
            probability: true,
            selectivityBand: true,
            schoolId: true,
            profileId: true,
            cohortKey: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Prediction outcome label not found');
    }

    const reviewed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.predictionOutcomeLabelRecord.update({
        where: { id },
        data: {
          status: dto.status,
          notes:
            dto.notes != null
              ? existing.notes
                ? `${existing.notes}\n\n${dto.notes}`
                : dto.notes
              : existing.notes,
          evidenceUrl: dto.evidenceUrl ?? existing.evidenceUrl,
          round: dto.round ?? existing.round,
          isFinal: dto.isFinal ?? existing.isFinal,
          resolvedBy: actorId,
          resolvedAt: new Date(),
        },
      });

      const allLabels = await tx.predictionOutcomeLabelRecord.findMany({
        where: { predictionResultId: existing.predictionResultId },
        orderBy: { createdAt: 'desc' },
      });

      const canonical = this.resolveCanonicalOutcome(allLabels);

      await tx.predictionResult.update({
        where: { id: existing.predictionResultId },
        data: {
          actualResult: this.getStoredActualResult(canonical),
          outcomeLabel: canonical.canonicalOutcomeLabel,
          outcomeLabeledAt: new Date(),
        },
      });

      const latestSnapshot = await tx.predictionSnapshot.findFirst({
        where: {
          profileId: existing.predictionResult.profileId,
          schoolId: existing.predictionResult.schoolId,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (latestSnapshot) {
        await tx.predictionSnapshot.update({
          where: { id: latestSnapshot.id },
          data: {
            outcomeLabel: canonical.canonicalOutcomeLabel,
            outcomeLabeledAt: new Date(),
          },
        });
      }

      return {
        ...updated,
        latestOutcomeLabel: this.mapLatestOutcomeLabel(canonical.displayRecord),
        calibrationEligible: canonical.eligibleForCalibration,
        canonicalRecord: canonical.canonicalRecord,
      };
    });

    if (this.calibrationService) {
      fireAndForget(
        this.calibrationService.invalidateCalibrationCache(),
        this.logger,
        'Failed to invalidate calibration cache after outcome review',
      );
    }

    if (
      this.shadowEvaluator &&
      reviewed.calibrationEligible &&
      reviewed.canonicalRecord &&
      ['ADMITTED', 'REJECTED'].includes(reviewed.canonicalRecord.result)
    ) {
      const predictedProb = Number(existing.predictionResult.probability);
      const actualResult = reviewed.canonicalRecord.result === 'ADMITTED';
      fireAndForget(
        this.shadowEvaluator.onOutcomeReported(
          existing.predictionResult.selectivityBand ?? null,
          predictedProb,
          actualResult,
        ),
        this.logger,
        'Failed to record shadow outcome feedback',
      );
    }

    if (this.distillationRollups) {
      fireAndForget(
        this.distillationRollups.refreshForOutcomeChange({
          schoolId: existing.predictionResult.schoolId,
          cohortKey: existing.predictionResult.cohortKey ?? undefined,
          asOf: new Date(),
        }),
        this.logger,
        'Failed to refresh distillation rollups after outcome review',
      );
    }

    return {
      ...reviewed,
      canonicalRecord: undefined,
    };
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
    verifiedSampleCount: number;
    brierScore: number | null;
    ece: number | null;
    sourceBreakdown: Record<string, number>;
    calibrationBuckets: Array<{
      predictedRange: string;
      actualAdmitRate: number;
      count: number;
    }>;
  }> {
    const total = await this.prisma.predictionResult.count();
    const results = await this.prisma.predictionResult.findMany({
      where: {
        OR: [
          { source: null },
          { source: { notIn: [...CALIBRATION_EXCLUDED_SOURCES] } },
        ],
      },
      select: {
        probability: true,
        source: true,
        outcomeLabelRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const eligibleResults = results
      .map((result) => {
        const canonical = this.resolveCanonicalOutcome(
          result.outcomeLabelRecords,
        );
        return canonical.eligibleForCalibration && canonical.canonicalRecord
          ? {
              probability: Number(result.probability),
              result: canonical.canonicalRecord.result,
              source: result.source ?? 'prediction',
            }
          : null;
      })
      .filter(Boolean) as Array<{
      probability: number;
      result: string;
      source: string;
    }>;

    const withResults = eligibleResults.length;
    const probabilities = eligibleResults.map((item) => item.probability);
    const labels = eligibleResults.map((item) =>
      item.result === 'ADMITTED' ? 1 : 0,
    );
    const sourceBreakdown = eligibleResults.reduce<Record<string, number>>(
      (acc, item) => {
        acc[item.source] = (acc[item.source] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const buckets = [
      { min: 0, max: 0.2, label: '0-20%' },
      { min: 0.2, max: 0.4, label: '20-40%' },
      { min: 0.4, max: 0.6, label: '40-60%' },
      { min: 0.6, max: 0.8, label: '60-80%' },
      { min: 0.8, max: 1.0, label: '80-100%' },
    ];

    const calibrationBuckets = buckets.map((bucket) => {
      const inBucket = eligibleResults.filter((r) => {
        const p = r.probability;
        return p >= bucket.min && p < bucket.max;
      });
      const admitted = inBucket.filter((r) => r.result === 'ADMITTED');

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
      verifiedSampleCount: withResults,
      brierScore:
        withResults > 0
          ? Number(computeBrierScore(probabilities, labels).toFixed(6))
          : null,
      ece:
        withResults > 0
          ? Number(computeECE(probabilities, labels, 10).toFixed(6))
          : null,
      sourceBreakdown,
      calibrationBuckets,
    };
  }
}
