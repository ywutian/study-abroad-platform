import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DistillationObservationPayload } from './types';

function clampProbability(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0.01, Math.min(0.99, value));
}

@Injectable()
export class DistillationObservationService {
  private readonly logger = new Logger(DistillationObservationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(payload: DistillationObservationPayload): Promise<void> {
    const common = {
      profileId: payload.profileId,
      schoolId: payload.schoolId,
      predictionResultId: payload.predictionResultId,
      predictionSnapshotId: payload.predictionSnapshotId,
      policyVersionId: payload.policyVersionId,
      cohortKey: payload.decision.cohortKey,
      round: payload.applicationRound,
      observationStage: payload.stage,
      status: 'RAW' as const,
      observedAt: payload.observedAt,
      selectivityBand: payload.selectivityBand,
    };

    const teacherRows = payload.decision.teacherSignals.map((signal) => {
      const probability = clampProbability(signal.probability);
      const deltaVsOur =
        probability != null ? probability - payload.ourProbPrePlatt : null;

      return {
        ...common,
        metricType: 'distillation_teacher',
        sourceType: signal.sourceType,
        sourceName: signal.sourceName,
        observedProbability: probability,
        observedWeight: signal.effectiveBlendWeight,
        confidenceLabel: signal.confidence,
        sampleCount: signal.sampleCount ?? null,
        metadata: {
          teacherKey: signal.key,
          teacherLabel: signal.label,
          configuredWeight: signal.configuredWeight,
          effectiveWeight: signal.effectiveBlendWeight,
          active: signal.active,
          teacherProbability: probability,
          deltaVsOur,
          cohortKey: payload.decision.cohortKey,
          applicationRound: payload.applicationRound,
          selectivityBand: payload.selectivityBand,
          bucketKey: signal.bucketKey ?? null,
          sampleCount: signal.sampleCount ?? null,
          missingReasons: signal.missingReasons,
          inputSummary: payload.inputSummary,
          ourProbPrePlatt: payload.ourProbPrePlatt,
          blendedPrePlatt: payload.decision.blendedPrePlatt,
          candidateServedProbability: payload.candidateServedProbability,
          servedProbability: payload.servedProbability,
          coverageTier: payload.coverageTier,
          ...signal.metadata,
        },
      };
    });

    const activeTeacherKeys = payload.decision.teacherSignals
      .filter((signal) => signal.active && signal.probability != null)
      .map((signal) => signal.key);

    const blendRow = {
      ...common,
      metricType: 'distillation_blend',
      sourceType: 'MANUAL_RESEARCH' as const,
      sourceName: 'distillation:blend-v1',
      observedProbability: clampProbability(payload.candidateServedProbability),
      observedWeight: payload.decision.totalEffectiveWeight,
      confidenceLabel: payload.decision.hasSignal ? 'medium' : 'low',
      sampleCount: null,
      metadata: {
        teacherKey: 'blend-v1',
        hasSignal: payload.decision.hasSignal,
        reason: payload.decision.hasSignal ? null : 'no_active_teachers',
        activeTeacherKeys,
        coverageTier: payload.coverageTier,
        cohortKey: payload.decision.cohortKey,
        applicationRound: payload.applicationRound,
        selectivityBand: payload.selectivityBand,
        totalConfiguredWeight: payload.decision.totalConfiguredWeight,
        totalEffectiveWeight: payload.decision.totalEffectiveWeight,
        ourProbPrePlatt: payload.ourProbPrePlatt,
        blendedPrePlatt: payload.decision.blendedPrePlatt,
        candidateServedProbability: payload.candidateServedProbability,
        servedProbability: payload.servedProbability,
        blendDelta:
          payload.candidateServedProbability - payload.servedProbability,
        inputSummary: payload.inputSummary,
        teacherSummaries: payload.decision.teacherSignals.map((signal) => ({
          key: signal.key,
          active: signal.active,
          probability: clampProbability(signal.probability),
          configuredWeight: signal.configuredWeight,
          effectiveWeight: signal.effectiveBlendWeight,
          confidence: signal.confidence,
          sampleCount: signal.sampleCount ?? null,
          bucketKey: signal.bucketKey ?? null,
          missingReasons: signal.missingReasons,
        })),
      },
    };

    try {
      await this.prisma.predictionSourceObservation.createMany({
        data: [...teacherRows, blendRow],
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist distillation observations for profile ${payload.profileId}, school ${payload.schoolId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
