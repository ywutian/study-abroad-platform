import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  computeAucRoc,
  computeBrierScore,
  computeECE,
  computeLogLoss,
} from '@study-abroad/shared/scoring';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictionWorkflowService } from './prediction-workflow.service';
import { PredictionReportingService } from './prediction-reporting.service';

type NormalizedPrediction = {
  probability: number;
  label: 0 | 1;
  cohortKey: string;
  round: string;
  selectivityBand: string;
};

@Injectable()
export class PredictionPolicyShadowService {
  private readonly logger = new Logger(PredictionPolicyShadowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: PredictionWorkflowService,
    private readonly reportingService: PredictionReportingService,
  ) {}

  @Cron('30 3 * * *')
  async refreshAllShadowPolicies() {
    const policies = await this.prisma.predictionPolicyVersion.findMany({
      where: { status: 'SHADOW' },
      select: { id: true },
    });

    for (const policy of policies) {
      try {
        await this.refreshPolicyShadowMetrics(policy.id);
      } catch (error) {
        this.logger.warn(
          `Failed to refresh policy shadow metrics for ${policy.id}: ${String(
            error instanceof Error ? error.message : error,
          )}`,
        );
      }
    }
  }

  private async loadPolicyPredictions(policyVersionId: string): Promise<{
    totalPredictions: number;
    normalized: NormalizedPrediction[];
    cohorts: Record<string, number>;
    buckets: Array<{
      cohortKey: string;
      round: string;
      selectivityBand: string;
      predictionCount: number;
      resolvedLabels: number;
      meanProbability: number;
      actualAdmitRate: number;
      brier: number | null;
      ece: number | null;
    }>;
  }> {
    const results = await this.prisma.predictionResult.findMany({
      where: { policyVersionId, authority: 'AUTHORITATIVE' },
      take: 5000,
      orderBy: { createdAt: 'desc' },
      select: {
        probability: true,
        cohortKey: true,
        applicationRound: true,
        selectivityBand: true,
        outcomeLabelRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const normalized: NormalizedPrediction[] = [];
    const cohorts = {
      CN__CHINA_LOCAL: 0,
      CN__CHINA_INTL: 0,
      CN__OVERSEAS_HS: 0,
    };
    const bucketMap = new Map<
      string,
      {
        cohortKey: string;
        round: string;
        selectivityBand: string;
        probabilities: number[];
        labels: number[];
      }
    >();

    for (const result of results) {
      const canonical = this.reportingService.resolveCanonicalOutcome(
        result.outcomeLabelRecords,
      );
      if (!canonical.eligibleForCalibration || !canonical.canonicalRecord) {
        continue;
      }

      const normalizedRecord: NormalizedPrediction = {
        probability: Number(result.probability),
        label: canonical.canonicalRecord.result === 'ADMITTED' ? 1 : 0,
        cohortKey: result.cohortKey ?? 'UNKNOWN',
        round: result.applicationRound ?? 'RD',
        selectivityBand: result.selectivityBand ?? 'unknown',
      };
      normalized.push(normalizedRecord);

      if (normalizedRecord.cohortKey in cohorts) {
        cohorts[normalizedRecord.cohortKey as keyof typeof cohorts] += 1;
      }

      const bucketKey = [
        normalizedRecord.cohortKey,
        normalizedRecord.round,
        normalizedRecord.selectivityBand,
      ].join('|');
      const existing = bucketMap.get(bucketKey) ?? {
        cohortKey: normalizedRecord.cohortKey,
        round: normalizedRecord.round,
        selectivityBand: normalizedRecord.selectivityBand,
        probabilities: [],
        labels: [],
      };
      existing.probabilities.push(normalizedRecord.probability);
      existing.labels.push(normalizedRecord.label);
      bucketMap.set(bucketKey, existing);
    }

    const buckets = Array.from(bucketMap.values()).map((bucket) => {
      const meanProbability =
        bucket.probabilities.reduce((sum, value) => sum + value, 0) /
        bucket.probabilities.length;
      const actualAdmitRate =
        bucket.labels.reduce((sum, value) => sum + value, 0) /
        bucket.labels.length;
      return {
        cohortKey: bucket.cohortKey,
        round: bucket.round,
        selectivityBand: bucket.selectivityBand,
        predictionCount: bucket.probabilities.length,
        resolvedLabels: bucket.labels.length,
        meanProbability,
        actualAdmitRate,
        brier:
          bucket.labels.length >= 1
            ? computeBrierScore(bucket.probabilities, bucket.labels)
            : null,
        ece:
          bucket.labels.length >= 5
            ? computeECE(bucket.probabilities, bucket.labels, 5)
            : null,
      };
    });

    return {
      totalPredictions: results.length,
      normalized,
      cohorts,
      buckets,
    };
  }

  private computeOverallMetrics(records: NormalizedPrediction[]) {
    if (!records.length) {
      return {
        resolvedLabels: 0,
        auc: null,
        brier: null,
        ece: null,
        logLoss: null,
      };
    }

    const probabilities = records.map((record) => record.probability);
    const labels = records.map((record) => record.label);
    const hasPositive = labels.some((label) => label === 1);
    const hasNegative = labels.some((label) => label === 0);

    return {
      resolvedLabels: labels.length,
      auc:
        hasPositive && hasNegative
          ? computeAucRoc(probabilities, labels)
          : null,
      brier: computeBrierScore(probabilities, labels),
      ece: computeECE(probabilities, labels, 10),
      logLoss: computeLogLoss(probabilities, labels),
    };
  }

  async refreshPolicyShadowMetrics(policyVersionId: string, actorId?: string) {
    const policy = await this.prisma.predictionPolicyVersion.findUnique({
      where: { id: policyVersionId },
    });

    if (!policy) {
      throw new NotFoundException('Prediction policy version not found');
    }

    const baselinePolicy = await this.prisma.predictionPolicyVersion.findFirst({
      where: {
        policyKey: policy.policyKey,
        status: 'ACTIVE',
        id: { not: policyVersionId },
      },
      orderBy: [{ activatedAt: 'desc' }, { updatedAt: 'desc' }],
    });

    const [policyData, baselineData] = await Promise.all([
      this.loadPolicyPredictions(policyVersionId),
      baselinePolicy
        ? this.loadPolicyPredictions(baselinePolicy.id)
        : Promise.resolve(null),
    ]);

    const currentMetrics = this.computeOverallMetrics(policyData.normalized);
    const baselineMetrics = baselineData
      ? this.computeOverallMetrics(baselineData.normalized)
      : null;

    const metrics = {
      refreshedAt: new Date().toISOString(),
      refreshedBy: actorId ?? 'system',
      predictionCount: policyData.totalPredictions,
      resolvedLabels: currentMetrics.resolvedLabels,
      cohorts: policyData.cohorts,
      overall: currentMetrics,
      baseline: baselinePolicy
        ? {
            policyVersionId: baselinePolicy.id,
            metrics: baselineMetrics,
          }
        : null,
      aucDelta:
        currentMetrics.auc != null && baselineMetrics?.auc != null
          ? currentMetrics.auc - baselineMetrics.auc
          : null,
      brierDelta:
        currentMetrics.brier != null && baselineMetrics?.brier != null
          ? currentMetrics.brier - baselineMetrics.brier
          : null,
      eceDelta:
        currentMetrics.ece != null && baselineMetrics?.ece != null
          ? currentMetrics.ece - baselineMetrics.ece
          : null,
      fairnessBlocked: false,
      buckets: policyData.buckets,
    };

    if (actorId) {
      await this.workflowService.updatePolicyShadowMetrics(
        actorId,
        policyVersionId,
        metrics,
      );
    } else {
      const monitoringConfig =
        (policy.monitoringConfig as Record<string, unknown> | null) ?? {};
      await this.prisma.predictionPolicyVersion.update({
        where: { id: policyVersionId },
        data: {
          monitoringConfig: {
            ...monitoringConfig,
            shadowMetrics: metrics,
            shadowMetricsUpdatedAt: metrics.refreshedAt,
            shadowMetricsUpdatedBy: metrics.refreshedBy,
          },
        },
      });
    }

    return metrics;
  }
}
