import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { createPaginatedResponse } from '../../common/dto/pagination.dto';
import {
  AuditAction,
  AuditLogService,
} from '../../common/services/audit-log.service';
import {
  BuildPredictionSignalsDto,
  CreatePredictionObservationDto,
  CreatePredictionPolicyVersionDto,
  PredictionOutcomeQueryDto,
  PredictionObservationQueryDto,
  PredictionSignalQueryDto,
  PredictionPolicyQueryDto,
  ReviewPredictionOutcomeDto,
  ReviewPredictionObservationDto,
} from '../admin/dto';
import { PredictionHistoricalService } from './prediction-historical.service';
import { PredictionReportingService } from './prediction-reporting.service';
import {
  parseGpaRange,
  parseTestScoreRange,
  toTestScoreEntry,
  type NormalizedTestScoreEntry,
} from './utils/legacy-case-parser';
import {
  deriveCohortKeyFromCase,
  wilsonInterval,
  confidenceTier,
} from './utils/cohort-key';

const DEFAULT_POLICY_THRESHOLDS = {
  minShadowPredictions: 1000,
  minResolvedLabels: 200,
  minCohortResolvedLabels: 50,
  minAucDelta: 0.01,
  maxBrierDelta: -0.01,
  maxEceRegression: 0.02,
};

const DEFAULT_RELATIONSHIP_MAX_IMPACT_CAP = 0.08;
const RELATIONSHIP_STRONG_HS_REDUCTION = 0.35;
const RELATIONSHIP_FEEDER_REDUCTION = 0.5;

type ObservationStatus =
  | 'RAW'
  | 'UNDER_REVIEW'
  | 'APPROVED_FOR_SIGNAL'
  | 'APPROVED_FOR_PRIOR'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'LICENSE_BLOCKED'
  | 'CONFLICT_FLAGGED';

type PolicyStatus = 'DRAFT' | 'CANDIDATE' | 'SHADOW' | 'ACTIVE' | 'RETIRED';

@Injectable()
export class PredictionWorkflowService {
  private readonly logger = new Logger(PredictionWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditLog: AuditLogService,
    private readonly historicalService: PredictionHistoricalService,
    private readonly reportingService: PredictionReportingService,
  ) {}

  private normalizeDate(value?: string | null): Date | undefined {
    return value ? new Date(value) : undefined;
  }

  private normalizeThresholds(raw?: Record<string, unknown> | null) {
    return {
      ...DEFAULT_POLICY_THRESHOLDS,
      ...(raw ?? {}),
    };
  }

  private clampSigned(value: number, maxAbs: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.max(-maxAbs, Math.min(maxAbs, value));
  }

  private summarizeObservation(observation: {
    sourceName: string;
    sourceType: string;
    sourceUrl: string | null;
    year: number | null;
  }) {
    return [
      {
        label: observation.sourceName,
        detail: [observation.sourceType, observation.year]
          .filter(Boolean)
          .join(' · '),
        url: observation.sourceUrl ?? undefined,
      },
    ];
  }

  private resolvePriorRate(observation: {
    rate: unknown;
    admitCount: number | null;
    applyCount: number | null;
  }): number | null {
    if (observation.rate != null) {
      return Number(observation.rate);
    }
    if (
      observation.admitCount != null &&
      observation.applyCount != null &&
      observation.applyCount > 0
    ) {
      return observation.admitCount / observation.applyCount;
    }
    return null;
  }

  private classifyObservationTarget(observation: {
    status: ObservationStatus;
    sourceType: string;
    observationStage: string;
    metricType: string;
  }): 'prior' | 'drift' | 'relationship' | null {
    if (observation.status === 'APPROVED_FOR_PRIOR') {
      return 'prior';
    }
    if (observation.status !== 'APPROVED_FOR_SIGNAL') {
      return null;
    }
    if (this.isRelationshipObservation(observation)) {
      return 'relationship';
    }
    if (this.isDriftObservation(observation)) {
      return 'drift';
    }
    return null;
  }

  private validateObservationForReview(
    observation: {
      id: string;
      schoolId: string | null;
      cohortKey: string | null;
      round: string | null;
      rate: Prisma.Decimal | null;
      admitCount: number | null;
      applyCount: number | null;
    },
    targetStatus: ObservationStatus,
  ) {
    if (targetStatus === 'APPROVED_FOR_PRIOR') {
      if (
        !observation.schoolId ||
        !observation.cohortKey ||
        !observation.round
      ) {
        throw new BadRequestException(
          'Prior observations require schoolId, cohortKey, and round',
        );
      }
      if (this.resolvePriorRate(observation) == null) {
        throw new BadRequestException(
          'Prior observations require a direct rate or both admitCount and applyCount',
        );
      }
    }
  }

  private validateObservationForActivation(observation: {
    id: string;
    status: ObservationStatus;
    schoolId: string | null;
    cohortKey: string | null;
    round: string | null;
    reviewAt: Date | null;
    expiresAt: Date | null;
    rate: Prisma.Decimal | null;
    admitCount: number | null;
    applyCount: number | null;
    sourceType: string;
    observationStage: string;
    metricType: string;
    metadata: Prisma.JsonValue | null;
  }): 'prior' | 'drift' | 'relationship' | null {
    if (
      ['EXPIRED', 'SUPERSEDED', 'LICENSE_BLOCKED', 'CONFLICT_FLAGGED'].includes(
        observation.status,
      )
    ) {
      return null;
    }

    const target = this.classifyObservationTarget(observation);
    if (!target) return null;

    if (!observation.schoolId) {
      throw new ConflictException(
        `Observation ${observation.id} cannot activate without schoolId`,
      );
    }

    if (target === 'prior') {
      if (!observation.cohortKey || !observation.round) {
        throw new ConflictException(
          `Observation ${observation.id} cannot activate as prior without cohortKey and round`,
        );
      }
      if (this.resolvePriorRate(observation) == null) {
        throw new ConflictException(
          `Observation ${observation.id} cannot activate as prior without denominator or direct rate`,
        );
      }
    }

    if (target === 'relationship') {
      const metadata =
        (observation.metadata as Record<string, unknown> | null) ?? {};
      if (!observation.reviewAt || !observation.expiresAt) {
        throw new ConflictException(
          `Relationship observation ${observation.id} requires reviewAt and expiresAt`,
        );
      }
      const maxImpactCap =
        typeof metadata.maxImpactCap === 'number'
          ? metadata.maxImpactCap
          : DEFAULT_RELATIONSHIP_MAX_IMPACT_CAP;
      if (!Number.isFinite(maxImpactCap) || maxImpactCap <= 0) {
        throw new ConflictException(
          `Relationship observation ${observation.id} requires a valid maxImpactCap`,
        );
      }
    }

    return target;
  }

  private async writeAuditLog(
    actorId: string,
    action: string,
    resource: string,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.auditLog.log({
      userId: actorId,
      action: AuditAction.ADMIN_ACTION,
      resource,
      resourceId,
      metadata: {
        action,
        ...metadata,
      },
    });
  }

  private normalizeSourceSummary(
    summary: Prisma.JsonValue | null | undefined,
  ): Array<{ label: string; detail?: string; url?: string }> {
    if (!summary || !Array.isArray(summary)) return [];
    return summary.filter(Boolean) as Array<{
      label: string;
      detail?: string;
      url?: string;
    }>;
  }

  private async getEligibleOutcomeCounts(policyVersionId: string) {
    const results = await this.prisma.predictionResult.findMany({
      where: { policyVersionId },
      select: {
        id: true,
        cohortKey: true,
        outcomeLabelRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const cohorts = {
      CN__CHINA_LOCAL: 0,
      CN__CHINA_INTL: 0,
      CN__OVERSEAS_HS: 0,
    };
    let resolvedLabels = 0;

    for (const result of results) {
      const canonical = this.reportingService.resolveCanonicalOutcome(
        result.outcomeLabelRecords,
      );
      if (!canonical.eligibleForCalibration) continue;
      resolvedLabels += 1;
      if (result.cohortKey && result.cohortKey in cohorts) {
        cohorts[result.cohortKey as keyof typeof cohorts] += 1;
      }
    }

    return { resolvedLabels, cohorts };
  }

  private async buildRelationshipAdjustment(observation: {
    highSchoolId: string | null;
    schoolId: string | null;
    observedWeight: Prisma.Decimal | null;
    metadata: Prisma.JsonValue | null;
  }) {
    const metadata =
      (observation.metadata as Record<string, unknown> | null) ?? {};
    const configuredCap =
      typeof metadata.maxImpactCap === 'number'
        ? metadata.maxImpactCap
        : DEFAULT_RELATIONSHIP_MAX_IMPACT_CAP;
    const rawSignalStrength =
      typeof metadata.signalStrength === 'number'
        ? metadata.signalStrength
        : observation.observedWeight != null
          ? Number(observation.observedWeight)
          : 0.04;

    let cap = configuredCap;
    const deductions: string[] = [];

    if (observation.highSchoolId && observation.schoolId) {
      const [highSchool, school, feederSignal] = await Promise.all([
        this.prisma.highSchool.findUnique({
          where: { id: observation.highSchoolId },
          select: {
            recognition: true,
            placementRecord: true,
            resources: true,
          },
        }),
        this.prisma.school.findUnique({
          where: { id: observation.schoolId },
          select: { acceptanceRate: true },
        }),
        this.historicalService.getFeederSignal(
          observation.highSchoolId,
          observation.schoolId,
          undefined,
        ),
      ]);

      const acceptanceRate =
        school?.acceptanceRate != null ? Number(school.acceptanceRate) : null;

      const schoolStrength =
        (highSchool?.recognition ?? 0) +
        (highSchool?.placementRecord ?? 0) +
        (highSchool?.resources ?? 0);

      if (schoolStrength >= 11) {
        cap = cap * (1 - RELATIONSHIP_STRONG_HS_REDUCTION);
        deductions.push('high-school-quality');
      }

      if (feederSignal?.isFeeder) {
        cap = cap * (1 - RELATIONSHIP_FEEDER_REDUCTION);
        deductions.push('historical-feeder');
      }

      if (
        acceptanceRate != null &&
        feederSignal?.isFeeder &&
        acceptanceRate > 0
      ) {
        const feederRatio = feederSignal.admitRate / (acceptanceRate / 100);
        if (feederRatio > 1) {
          cap = cap * 0.85;
          deductions.push('placement-overlap');
        }
      }
    }

    const signalStrength = this.clampSigned(rawSignalStrength, cap);

    return {
      maxImpactCap: cap,
      signalStrength,
      deductions,
    };
  }

  private isDriftObservation(observation: {
    sourceType: string;
    observationStage: string;
    metricType: string;
  }) {
    const stage = observation.observationStage.toUpperCase();
    const metric = observation.metricType.toLowerCase();
    return (
      stage === 'DRIFT' ||
      stage === 'REGIME' ||
      metric.includes('drift') ||
      metric.includes('regime')
    );
  }

  private isRelationshipObservation(observation: {
    sourceType: string;
    observationStage: string;
    metricType: string;
  }) {
    const stage = observation.observationStage.toUpperCase();
    const metric = observation.metricType.toLowerCase();
    return (
      observation.sourceType === 'RELATIONSHIP_EVIDENCE' ||
      stage === 'RELATIONSHIP' ||
      metric.includes('relationship') ||
      metric.includes('feeder') ||
      metric.includes('partnership')
    );
  }

  /**
   * Invalidate prediction caches for specific policy versions.
   * Falls back to full invalidation if no versions specified.
   */
  private async invalidatePredictionCaches(policyVersionIds?: string[]) {
    if (policyVersionIds?.length) {
      await Promise.all(
        policyVersionIds.map((vid) =>
          this.redis.delByPrefix(`prediction:*:*:${vid}`),
        ),
      );
      // Also invalidate legacy (unversioned) cache entries
      await this.redis.delByPrefix('prediction:*:*:legacy');
    } else {
      await this.redis.delByPrefix('prediction:');
    }
  }

  async listObservations(query: PredictionObservationQueryDto) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.schoolId ? { schoolId: query.schoolId } : {}),
      ...(query.policyVersionId
        ? { policyVersionId: query.policyVersionId }
        : {}),
    };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.predictionSourceObservation.findMany({
        where,
        orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          school: {
            select: { id: true, name: true, nameZh: true, usNewsRank: true },
          },
          highSchool: {
            select: { id: true, name: true, tier: true },
          },
        },
      }),
      this.prisma.predictionSourceObservation.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async createObservation(
    actorId: string,
    dto: CreatePredictionObservationDto,
  ) {
    const created = await this.prisma.predictionSourceObservation.create({
      data: {
        profileId: dto.profileId,
        schoolId: dto.schoolId,
        highSchoolId: dto.highSchoolId,
        policyVersionId: dto.policyVersionId,
        cohortKey: dto.cohortKey,
        round: dto.round,
        metricType: dto.metricType,
        rate: dto.rate,
        admitCount: dto.admitCount,
        applyCount: dto.applyCount,
        year: dto.year,
        sourceType: dto.sourceType,
        sourceName: dto.sourceName,
        sourceVersion: dto.sourceVersion,
        sourceUrl: dto.sourceUrl,
        license: dto.license,
        qualityScore: dto.qualityScore,
        observationStage: dto.observationStage ?? 'SERVE',
        observedProbability: dto.observedProbability,
        observedProbabilityLow: dto.observedProbabilityLow,
        observedProbabilityHigh: dto.observedProbabilityHigh,
        observedWeight: dto.observedWeight,
        confidenceLabel: dto.confidenceLabel,
        sampleCount: dto.sampleCount,
        selectivityBand: dto.selectivityBand,
        reviewAt: this.normalizeDate(dto.reviewAt),
        observedAt: this.normalizeDate(dto.observedAt) ?? new Date(),
        effectiveFromCycle: dto.effectiveFromCycle,
        expiresAt: this.normalizeDate(dto.expiresAt),
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        notes: dto.notes
          ? `${dto.notes}\n\n[created-by:${actorId}]`
          : `[created-by:${actorId}]`,
      },
    });

    await this.writeAuditLog(
      actorId,
      'PREDICTION_OBSERVATION_CREATE',
      'prediction_observation',
      created.id,
      {
        sourceType: created.sourceType,
        metricType: created.metricType,
      },
    );

    return created;
  }

  async reviewObservation(
    actorId: string,
    id: string,
    dto: ReviewPredictionObservationDto,
  ) {
    const observation =
      await this.prisma.predictionSourceObservation.findUnique({
        where: { id },
        select: {
          id: true,
          notes: true,
          schoolId: true,
          cohortKey: true,
          round: true,
          rate: true,
          admitCount: true,
          applyCount: true,
        },
      });

    if (!observation) {
      throw new NotFoundException('Prediction observation not found');
    }

    this.validateObservationForReview(observation, dto.status);

    const updated = await this.prisma.predictionSourceObservation.update({
      where: { id },
      data: {
        status: dto.status,
        reviewAt: this.normalizeDate(dto.reviewAt),
        expiresAt: this.normalizeDate(dto.expiresAt),
        reviewedBy: actorId,
        notes: dto.notes
          ? `${observation.notes ? `${observation.notes}\n\n` : ''}${dto.notes}`
          : observation.notes,
      },
    });

    await this.writeAuditLog(
      actorId,
      'PREDICTION_OBSERVATION_REVIEW',
      'prediction_observation',
      id,
      {
        status: dto.status,
      },
    );

    return updated;
  }

  async getActiveSignals(query: PredictionSignalQueryDto) {
    const limit = query.limit ?? 10;
    const where = { policyVersionId: query.policyVersionId };

    const [priors, drifts, relationships, counts] = await Promise.all([
      this.prisma.schoolCohortRoundPrior.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        include: {
          school: {
            select: { id: true, name: true, nameZh: true, usNewsRank: true },
          },
        },
      }),
      this.prisma.schoolCohortRegimeSignal.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        include: {
          school: {
            select: { id: true, name: true, nameZh: true, usNewsRank: true },
          },
        },
      }),
      this.prisma.schoolRelationshipSignal.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        include: {
          targetSchool: {
            select: { id: true, name: true, nameZh: true, usNewsRank: true },
          },
          sourceHighSchool: {
            select: { id: true, name: true, tier: true },
          },
        },
      }),
      Promise.all([
        this.prisma.schoolCohortRoundPrior.count({ where }),
        this.prisma.schoolCohortRegimeSignal.count({ where }),
        this.prisma.schoolRelationshipSignal.count({ where }),
      ]),
    ]);

    return {
      priors,
      drifts,
      relationships,
      counts: {
        priors: counts[0],
        drifts: counts[1],
        relationships: counts[2],
      },
    };
  }

  async listOutcomeLabels(query: PredictionOutcomeQueryDto) {
    return this.reportingService.getOutcomeReviewQueue(query);
  }

  async reviewOutcomeLabel(
    actorId: string,
    id: string,
    dto: ReviewPredictionOutcomeDto,
  ) {
    const updated = await this.reportingService.reviewOutcomeLabel(
      actorId,
      id,
      dto,
    );

    await this.writeAuditLog(
      actorId,
      'PREDICTION_OUTCOME_REVIEW',
      'prediction_outcome_label',
      id,
      {
        status: dto.status,
      },
    );

    return updated;
  }

  async buildActiveSignals(actorId: string, dto: BuildPredictionSignalsDto) {
    const policy = await this.prisma.predictionPolicyVersion.findUnique({
      where: { id: dto.policyVersionId },
    });

    if (!policy) {
      throw new NotFoundException('Prediction policy version not found');
    }

    const observations = await this.prisma.predictionSourceObservation.findMany(
      {
        where: {
          status: { in: ['APPROVED_FOR_PRIOR', 'APPROVED_FOR_SIGNAL'] },
          OR: [
            { policyVersionId: null },
            { policyVersionId: dto.policyVersionId },
          ],
        },
        orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
      },
    );

    const priorSetVersion = `${policy.policyKey}:${policy.version}:prior`;
    const driftSetVersion = `${policy.policyKey}:${policy.version}:drift`;
    const relationshipSetVersion = `${policy.policyKey}:${policy.version}:relationship`;

    const classifiedObservations = observations
      .map((observation) => ({
        observation,
        target: this.validateObservationForActivation(observation),
      }))
      .filter(
        (
          entry,
        ): entry is {
          observation: (typeof observations)[number];
          target: 'prior' | 'drift' | 'relationship';
        } => entry.target != null,
      );

    const priorObservations = classifiedObservations
      .filter((entry) => entry.target === 'prior')
      .map((entry) => entry.observation);
    const driftObservations = classifiedObservations
      .filter((entry) => entry.target === 'drift')
      .map((entry) => entry.observation);
    const relationshipObservations = classifiedObservations
      .filter((entry) => entry.target === 'relationship')
      .map((entry) => entry.observation);

    const defaultReviewAt = this.normalizeDate(dto.reviewAt);
    const defaultExpiresAt = this.normalizeDate(dto.expiresAt);
    const owner = dto.owner ?? actorId;

    await this.prisma.$transaction(async (tx) => {
      await tx.schoolCohortRoundPrior.deleteMany({
        where: {
          policyVersionId: dto.policyVersionId,
          setVersion: priorSetVersion,
        },
      });
      await tx.schoolCohortRegimeSignal.deleteMany({
        where: {
          policyVersionId: dto.policyVersionId,
          setVersion: driftSetVersion,
        },
      });
      await tx.schoolRelationshipSignal.deleteMany({
        where: {
          policyVersionId: dto.policyVersionId,
          setVersion: relationshipSetVersion,
        },
      });

      for (const observation of priorObservations) {
        const priorRate = this.resolvePriorRate(observation);
        if (priorRate == null) continue;

        await tx.schoolCohortRoundPrior.create({
          data: {
            schoolId: observation.schoolId!,
            policyVersionId: dto.policyVersionId,
            cohortKey: observation.cohortKey!,
            round: observation.round!,
            applicationYear: observation.year ?? undefined,
            setVersion: priorSetVersion,
            priorRate,
            sampleCount:
              observation.sampleCount ?? observation.applyCount ?? undefined,
            confidence:
              observation.confidenceLabel ??
              (observation.qualityScore != null &&
              observation.qualityScore >= 80
                ? 'high'
                : 'medium'),
            sourceSummary: this.summarizeObservation(observation),
            sourceObservationIds: [observation.id],
            effectiveFromCycle:
              dto.effectiveFromCycle ??
              observation.effectiveFromCycle ??
              undefined,
            metadata: observation.metadata as Prisma.InputJsonValue | undefined,
            reviewAt: defaultReviewAt ?? observation.reviewAt ?? undefined,
            expiresAt: defaultExpiresAt ?? observation.expiresAt ?? undefined,
            owner,
            notes: observation.notes,
          },
        });
      }

      for (const observation of driftObservations) {
        const metadata =
          (observation.metadata as Record<string, unknown> | null) ?? {};
        const driftMultiplier =
          typeof metadata.driftMultiplier === 'number'
            ? metadata.driftMultiplier
            : observation.observedWeight != null
              ? Number(observation.observedWeight)
              : 1;

        await tx.schoolCohortRegimeSignal.create({
          data: {
            schoolId: observation.schoolId!,
            policyVersionId: dto.policyVersionId,
            cohortKey: observation.cohortKey ?? undefined,
            round: observation.round ?? undefined,
            applicationYear: observation.year ?? undefined,
            setVersion: driftSetVersion,
            regimeKey:
              (typeof metadata.regimeKey === 'string' && metadata.regimeKey) ||
              `${observation.schoolId}:${observation.cohortKey ?? 'all'}:${observation.round ?? 'ALL'}`,
            signalType:
              (typeof metadata.signalType === 'string' &&
                metadata.signalType) ||
              observation.metricType,
            direction: driftMultiplier >= 1 ? 'positive' : 'negative',
            driftMultiplier,
            strength:
              typeof metadata.strength === 'number'
                ? metadata.strength
                : Math.abs(driftMultiplier - 1),
            confidence: observation.confidenceLabel ?? 'medium',
            sourceSummary: this.summarizeObservation(observation),
            sourceObservationIds: [observation.id],
            sampleCount:
              observation.sampleCount ?? observation.applyCount ?? undefined,
            effectiveFromCycle:
              dto.effectiveFromCycle ??
              observation.effectiveFromCycle ??
              undefined,
            effectiveFrom: observation.observedAt,
            effectiveTo: defaultExpiresAt ?? observation.expiresAt ?? undefined,
            metadata: observation.metadata as Prisma.InputJsonValue | undefined,
            reviewAt: defaultReviewAt ?? observation.reviewAt ?? undefined,
            expiresAt: defaultExpiresAt ?? observation.expiresAt ?? undefined,
            owner,
            notes: observation.notes,
          },
        });
      }

      for (const observation of relationshipObservations) {
        const metadata =
          (observation.metadata as Record<string, unknown> | null) ?? {};
        const adjustment = await this.buildRelationshipAdjustment(observation);
        const relationshipType =
          typeof metadata.relationshipType === 'string'
            ? metadata.relationshipType
            : 'OTHER_VERIFIED';

        await tx.schoolRelationshipSignal.create({
          data: {
            sourceHighSchoolId: observation.highSchoolId ?? undefined,
            sourceInstitutionName:
              (typeof metadata.sourceInstitutionName === 'string' &&
                metadata.sourceInstitutionName) ||
              undefined,
            targetSchoolId: observation.schoolId!,
            policyVersionId: dto.policyVersionId,
            cohortKey: observation.cohortKey ?? undefined,
            round: observation.round ?? undefined,
            applicationYear: observation.year ?? undefined,
            setVersion: relationshipSetVersion,
            relationshipType: relationshipType as
              | 'FORMAL_PARTNERSHIP'
              | 'EXCHANGE_PIPELINE'
              | 'SUMMER_PROGRAM_PIPELINE'
              | 'LONG_TERM_FEEDER'
              | 'COUNSELOR_CHANNEL'
              | 'ARTICULATION_OR_MOU'
              | 'OTHER_VERIFIED',
            relationshipKey:
              (typeof metadata.relationshipKey === 'string' &&
                metadata.relationshipKey) ||
              `${observation.highSchoolId ?? 'external'}:${observation.schoolId}`,
            admitRate:
              typeof metadata.admitRate === 'number'
                ? metadata.admitRate
                : undefined,
            baselineRate:
              typeof metadata.baselineRate === 'number'
                ? metadata.baselineRate
                : undefined,
            strength: adjustment.signalStrength,
            signalStrength: adjustment.signalStrength,
            maxImpactCap: adjustment.maxImpactCap,
            sampleCount:
              observation.sampleCount ?? observation.applyCount ?? undefined,
            confidence: observation.confidenceLabel ?? 'medium',
            sourceSummary: this.summarizeObservation(observation),
            sourceObservationIds: [observation.id],
            effectiveFromCycle:
              dto.effectiveFromCycle ??
              observation.effectiveFromCycle ??
              undefined,
            metadata: {
              ...metadata,
              antiDoubleCounted: true,
              antiDoubleCountAdjustments: adjustment.deductions,
            },
            reviewAt: defaultReviewAt ?? observation.reviewAt ?? undefined,
            expiresAt: defaultExpiresAt ?? observation.expiresAt ?? undefined,
            owner,
            notes: observation.notes,
          },
        });
      }

      await tx.predictionPolicyVersion.update({
        where: { id: dto.policyVersionId },
        data: {
          priorSetVersion,
          driftSetVersion,
          relationshipSetVersion,
          notes: policy.notes
            ? `${policy.notes}\n\n[signal-build:${new Date().toISOString()} by ${actorId}]`
            : `[signal-build:${new Date().toISOString()} by ${actorId}]`,
        },
      });
    });

    await this.writeAuditLog(
      actorId,
      'PREDICTION_SIGNALS_BUILD',
      'prediction_policy',
      dto.policyVersionId,
      {
        priorSetVersion,
        driftSetVersion,
        relationshipSetVersion,
        priorsBuilt: priorObservations.length,
        driftSignalsBuilt: driftObservations.length,
        relationshipSignalsBuilt: relationshipObservations.length,
      },
    );

    return {
      success: true,
      priorSetVersion,
      driftSetVersion,
      relationshipSetVersion,
      priorsBuilt: priorObservations.length,
      driftSignalsBuilt: driftObservations.length,
      relationshipSignalsBuilt: relationshipObservations.length,
    };
  }

  async listPolicyVersions(query: PredictionPolicyQueryDto) {
    const where = {
      ...(query.policyKey ? { policyKey: query.policyKey } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.predictionPolicyVersion.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.predictionPolicyVersion.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async createPolicyVersion(
    actorId: string,
    dto: CreatePredictionPolicyVersionDto,
  ) {
    const created = await this.prisma.predictionPolicyVersion.create({
      data: {
        policyKey: dto.policyKey ?? 'default',
        version: dto.version,
        name: dto.name,
        description: dto.description,
        status: 'DRAFT',
        thresholds: this.normalizeThresholds(dto.thresholds ?? null),
        rolloutConfig: (dto.rolloutConfig ?? {}) as Prisma.InputJsonValue,
        monitoringConfig: (dto.monitoringConfig ?? {}) as Prisma.InputJsonValue,
        fairnessConfig: (dto.fairnessConfig ?? {}) as Prisma.InputJsonValue,
        calibrationVersion: dto.calibrationVersion,
        numericCoreVersion: dto.numericCoreVersion,
        explanationSchemaVersion: dto.explanationSchemaVersion,
        effectiveFrom: this.normalizeDate(dto.effectiveFrom),
        notes: dto.notes
          ? `${dto.notes}\n\n[created-by:${actorId}]`
          : `[created-by:${actorId}]`,
      },
    });

    await this.writeAuditLog(
      actorId,
      'PREDICTION_POLICY_CREATE',
      'prediction_policy',
      created.id,
      {
        policyKey: created.policyKey,
        version: created.version,
      },
    );

    return created;
  }

  async promotePolicyToCandidate(actorId: string, id: string) {
    const policy = await this.prisma.predictionPolicyVersion.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new NotFoundException('Prediction policy version not found');
    }
    if (policy.status !== 'DRAFT') {
      throw new ConflictException(
        'Only DRAFT policy versions can become CANDIDATE',
      );
    }
    if (
      !policy.priorSetVersion ||
      !policy.driftSetVersion ||
      !policy.relationshipSetVersion
    ) {
      throw new ConflictException(
        'Active priors, drift signals, and relationship signals must be built before candidate freeze',
      );
    }

    const updated = await this.prisma.predictionPolicyVersion.update({
      where: { id },
      data: {
        status: 'CANDIDATE',
        notes: policy.notes
          ? `${policy.notes}\n\n[candidate-freeze:${new Date().toISOString()} by ${actorId}]`
          : `[candidate-freeze:${new Date().toISOString()} by ${actorId}]`,
      },
    });

    await this.writeAuditLog(
      actorId,
      'PREDICTION_POLICY_CANDIDATE',
      'prediction_policy',
      id,
      {
        policyKey: policy.policyKey,
        version: policy.version,
      },
    );

    return updated;
  }

  async promotePolicyToShadow(actorId: string, id: string) {
    const policy = await this.prisma.predictionPolicyVersion.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new NotFoundException('Prediction policy version not found');
    }
    if (policy.status !== 'CANDIDATE') {
      throw new ConflictException(
        'Only CANDIDATE policy versions can enter SHADOW',
      );
    }

    const updated = await this.prisma.predictionPolicyVersion.update({
      where: { id },
      data: {
        status: 'SHADOW',
        shadowStartedAt: new Date(),
        notes: policy.notes
          ? `${policy.notes}\n\n[shadow-start:${new Date().toISOString()} by ${actorId}]`
          : `[shadow-start:${new Date().toISOString()} by ${actorId}]`,
      },
    });

    await this.writeAuditLog(
      actorId,
      'PREDICTION_POLICY_SHADOW',
      'prediction_policy',
      id,
      {
        policyKey: policy.policyKey,
        version: policy.version,
      },
    );

    return updated;
  }

  async updatePolicyShadowMetrics(
    actorId: string,
    id: string,
    metrics: Record<string, unknown>,
  ) {
    const policy = await this.prisma.predictionPolicyVersion.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new NotFoundException('Prediction policy version not found');
    }

    const monitoringConfig =
      (policy.monitoringConfig as Record<string, unknown> | null) ?? {};

    const updated = await this.prisma.predictionPolicyVersion.update({
      where: { id },
      data: {
        monitoringConfig: {
          ...monitoringConfig,
          shadowMetrics: metrics,
          shadowMetricsUpdatedAt: new Date().toISOString(),
          shadowMetricsUpdatedBy: actorId,
        } as Prisma.InputJsonValue,
      },
    });

    await this.writeAuditLog(
      actorId,
      'PREDICTION_POLICY_SHADOW_METRICS_UPDATE',
      'prediction_policy',
      id,
      {
        keys: Object.keys(metrics),
      },
    );

    return updated;
  }

  async getPolicyGateSummary(id: string) {
    const policy = await this.prisma.predictionPolicyVersion.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new NotFoundException('Prediction policy version not found');
    }

    const thresholds = this.normalizeThresholds(
      (policy.thresholds as Record<string, unknown> | null) ?? null,
    );
    const [predictionCount, eligibleCounts] = await Promise.all([
      this.prisma.predictionResult.count({
        where: { policyVersionId: id },
      }),
      this.getEligibleOutcomeCounts(id),
    ]);

    const monitoringConfig =
      (policy.monitoringConfig as Record<string, unknown> | null) ?? {};
    const shadowMetrics = ((monitoringConfig.shadowMetrics as
      | Record<string, unknown>
      | undefined) ?? {}) as Record<string, number | boolean>;

    const cohortSummary = eligibleCounts.cohorts;
    const resolvedCount = eligibleCounts.resolvedLabels;

    const failures: string[] = [];
    if (predictionCount < Number(thresholds.minShadowPredictions)) {
      failures.push('Not enough shadow predictions for promotion');
    }
    if (resolvedCount < Number(thresholds.minResolvedLabels)) {
      failures.push('Not enough resolved labels for promotion');
    }
    for (const [cohortKey, count] of Object.entries(cohortSummary)) {
      if (count < Number(thresholds.minCohortResolvedLabels)) {
        failures.push(`Resolved label count for ${cohortKey} is below gate`);
      }
    }

    if (typeof shadowMetrics.aucDelta !== 'number') {
      failures.push('AUC delta is missing from shadow metrics');
    } else if (shadowMetrics.aucDelta < Number(thresholds.minAucDelta)) {
      failures.push('AUC gate failed');
    }

    if (typeof shadowMetrics.brierDelta !== 'number') {
      failures.push('Brier delta is missing from shadow metrics');
    } else if (shadowMetrics.brierDelta > Number(thresholds.maxBrierDelta)) {
      failures.push('Brier gate failed');
    }

    if (typeof shadowMetrics.eceDelta !== 'number') {
      failures.push('ECE delta is missing from shadow metrics');
    } else if (shadowMetrics.eceDelta > Number(thresholds.maxEceRegression)) {
      failures.push('ECE gate failed');
    }

    if (shadowMetrics.fairnessBlocked === true) {
      failures.push('Fairness gate failed');
    }

    return {
      ready: failures.length === 0,
      thresholds,
      counts: {
        shadowPredictions: predictionCount,
        resolvedLabels: resolvedCount,
        cohorts: cohortSummary,
      },
      shadowMetrics,
      failures,
    };
  }

  async activatePolicy(actorId: string, id: string) {
    const policy = await this.prisma.predictionPolicyVersion.findUnique({
      where: { id },
    });

    if (!policy) {
      throw new NotFoundException('Prediction policy version not found');
    }
    if (policy.status !== 'SHADOW') {
      throw new ConflictException(
        'Only SHADOW policy versions can become ACTIVE',
      );
    }

    const gateSummary = await this.getPolicyGateSummary(id);
    if (!gateSummary.ready) {
      throw new ConflictException(
        `Policy promotion blocked: ${gateSummary.failures.join('; ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.predictionPolicyVersion.updateMany({
        where: { policyKey: policy.policyKey, status: 'ACTIVE' },
        data: {
          status: 'RETIRED',
          retiredAt: new Date(),
        },
      });
      await tx.predictionPolicyVersion.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          promotedAt: new Date(),
          activatedBy: actorId,
        },
      });
    });

    await this.invalidatePredictionCaches([id]);
    await this.writeAuditLog(
      actorId,
      'PREDICTION_POLICY_ACTIVATE',
      'prediction_policy',
      id,
      {
        policyKey: policy.policyKey,
        version: policy.version,
      },
    );
    return {
      success: true,
      policyVersionId: id,
      activatedBy: actorId,
    };
  }

  async rollbackPolicy(actorId: string, policyKey = 'default') {
    const [currentActive, previousRetired] = await Promise.all([
      this.prisma.predictionPolicyVersion.findFirst({
        where: { policyKey, status: 'ACTIVE' },
        orderBy: [{ activatedAt: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.predictionPolicyVersion.findFirst({
        where: { policyKey, status: 'RETIRED' },
        orderBy: [{ retiredAt: 'desc' }, { activatedAt: 'desc' }],
      }),
    ]);

    if (!currentActive) {
      throw new NotFoundException('No active prediction policy to rollback');
    }
    if (!previousRetired) {
      throw new NotFoundException(
        'No retired prediction policy available for rollback',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.predictionPolicyVersion.update({
        where: { id: currentActive.id },
        data: {
          status: 'RETIRED',
          retiredAt: new Date(),
          notes: currentActive.notes
            ? `${currentActive.notes}\n\n[rollback-retired:${new Date().toISOString()} by ${actorId}]`
            : `[rollback-retired:${new Date().toISOString()} by ${actorId}]`,
        },
      });
      await tx.predictionPolicyVersion.update({
        where: { id: previousRetired.id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          promotedAt: new Date(),
          activatedBy: actorId,
          retiredAt: null,
          notes: previousRetired.notes
            ? `${previousRetired.notes}\n\n[rollback-restore:${new Date().toISOString()} by ${actorId}]`
            : `[rollback-restore:${new Date().toISOString()} by ${actorId}]`,
        },
      });
    });

    await this.invalidatePredictionCaches([
      currentActive.id,
      previousRetired.id,
    ]);
    await this.writeAuditLog(
      actorId,
      'PREDICTION_POLICY_ROLLBACK',
      'prediction_policy',
      previousRetired.id,
      {
        policyKey,
        rolledBackFrom: currentActive.id,
        restoredPolicyVersionId: previousRetired.id,
      },
    );
    return {
      success: true,
      policyKey,
      rolledBackFrom: currentActive.id,
      restoredPolicyVersionId: previousRetired.id,
    };
  }

  /**
   * Authority distribution across PredictionResult + PredictionSnapshot.
   *
   * Used to verify the PredictionAuthority invariant in prod: every row should
   * declare AUTHORITATIVE (full pipeline) or PREVIEW (school-list quick-match),
   * with no NULLs after the backfill migration. NULLs here indicate a writer
   * that bypassed both the application check and the lint rule.
   *
   * See apps/api/src/modules/prediction/BRIEF.md "Authority invariant".
   */
  async getAuthorityStats() {
    const [resultGroups, snapshotGroups, previewWithOutcome] =
      await Promise.all([
        this.prisma.predictionResult.groupBy({
          by: ['authority'],
          _count: { _all: true },
        }),
        this.prisma.predictionSnapshot.groupBy({
          by: ['authority'],
          _count: { _all: true },
        }),
        // Canary: a PREVIEW row should never carry an outcome label. If this is
        // non-zero, we've somehow labeled a quick-match row as an admission
        // result — investigate before relying on calibration inputs.
        this.prisma.predictionResult.count({
          where: {
            authority: 'PREVIEW',
            outcomeLabelRecords: { some: {} },
          },
        }),
      ]);

    type AuthorityBuckets = {
      total: number;
      AUTHORITATIVE: number;
      PREVIEW: number;
      NULL: number;
    };
    const toBuckets = (
      groups: Array<{ authority: string | null; _count: { _all: number } }>,
    ): AuthorityBuckets => {
      const bucket: AuthorityBuckets = {
        total: 0,
        AUTHORITATIVE: 0,
        PREVIEW: 0,
        NULL: 0,
      };
      for (const row of groups) {
        const key = (row.authority ?? 'NULL') as keyof AuthorityBuckets;
        if (key === 'total') continue;
        bucket[key] += row._count._all;
        bucket.total += row._count._all;
      }
      return bucket;
    };

    const resultBuckets = toBuckets(resultGroups);
    const snapshotBuckets = toBuckets(snapshotGroups);

    return {
      result: resultBuckets,
      snapshot: snapshotBuckets,
      invariantChecks: {
        // NULLs should be zero after the backfill migration in PR #45. Any non-
        // zero value means a writer is silently inserting rows without an
        // authority — the lint rule should have caught this in CI.
        resultNullCount: resultBuckets.NULL,
        snapshotNullCount: snapshotBuckets.NULL,
        previewRowsWithOutcomeLabel: previewWithOutcome,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Row-count inventory across every table that feeds a prediction teacher.
   *
   * Purpose: answer "where is the data bottleneck?" before committing to
   * distillation work. A teacher is only as strong as its input coverage —
   * e.g. a CohortPriorTeacher needs `SchoolCohortRoundPrior` populated, which
   * in turn needs verified `AdmissionCase` rows to aggregate from.
   *
   * Every count is cheap (index-only) so this can be polled freely.
   */
  async getDataInventory() {
    const [
      schools,
      schoolsWithSat,
      schoolsWithAdmitRate,
      schoolsWithBoth,
      schoolPrograms,
      schoolProgramsWithRate,
      schoolCalibrations,
      cohortRoundPriors,
      cohortRegimeSignals,
      relationshipSignals,
      admissionCasesTotal,
      admissionCasesVerified,
      admissionCasesApproved,
      admissionCasesByResult,
      admissionCasesWithGpa11,
      admissionCasesWithTestScores,
      schoolMetrics,
      schoolMetricsDistinctKeys,
    ] = await Promise.all([
      this.prisma.school.count(),
      this.prisma.school.count({ where: { satAvg: { not: null } } }),
      this.prisma.school.count({ where: { acceptanceRate: { not: null } } }),
      this.prisma.school.count({
        where: {
          satAvg: { not: null },
          acceptanceRate: { not: null },
        },
      }),
      this.prisma.schoolProgram.count(),
      this.prisma.schoolProgram.count({
        where: { acceptanceRateEstimate: { not: null } },
      }),
      this.prisma.schoolCalibration.count(),
      this.prisma.schoolCohortRoundPrior.count(),
      this.prisma.schoolCohortRegimeSignal.count(),
      this.prisma.schoolRelationshipSignal.count(),
      this.prisma.admissionCase.count(),
      this.prisma.admissionCase.count({ where: { isVerified: true } }),
      this.prisma.admissionCase.count({
        where: { reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] } },
      }),
      this.prisma.admissionCase.groupBy({
        by: ['result'],
        _count: { _all: true },
      }),
      this.prisma.admissionCase.count({
        where: { gpa11: { not: null } },
      }),
      this.prisma.admissionCase.count({
        where: { testScores: { not: Prisma.JsonNull } },
      }),
      this.prisma.schoolMetric.count(),
      this.prisma.schoolMetric.findMany({
        select: { metricKey: true },
        distinct: ['metricKey'],
      }),
    ]);

    const casesByResult: Record<string, number> = {};
    for (const row of admissionCasesByResult) {
      casesByResult[row.result] = row._count._all;
    }

    return {
      schools: {
        total: schools,
        withSat: schoolsWithSat,
        withAdmitRate: schoolsWithAdmitRate,
        withBoth: schoolsWithBoth,
        scorecardReady: schoolsWithBoth, // Scorecard teacher requires both
      },
      schoolPrograms: {
        total: schoolPrograms,
        withAcceptanceRateEstimate: schoolProgramsWithRate,
      },
      schoolCalibrations: { total: schoolCalibrations },
      teacherSignalTables: {
        cohortRoundPriors,
        cohortRegimeSignals,
        relationshipSignals,
      },
      admissionCases: {
        total: admissionCasesTotal,
        verified: admissionCasesVerified,
        approvedForTeacher: admissionCasesApproved,
        byResult: casesByResult,
        withGpa11: admissionCasesWithGpa11,
        withTestScores: admissionCasesWithTestScores,
      },
      schoolMetrics: {
        total: schoolMetrics,
        distinctKeys: schoolMetricsDistinctKeys.map((r) => r.metricKey),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * ML training readiness diagnostic.
   *
   * Compares total available labeled samples (verified user outcomes +
   * approved admission cases) against the tier thresholds in
   * `apps/api/src/modules/prediction/ml/tier-strategy.ts`:
   *   Tier 0: 0        (heuristic only — no ML)
   *   Tier 1: 50       (Platt calibration)
   *   Tier 2: 200      (basic LR, 20 features)
   *   Tier 3: 1000     (full LR, 44 features + per-band)
   *   Tier 4: 5000     (GBDT + per-band)
   *
   * Also breaks samples down by selectivity band (for per-band model
   * thresholds) and by school — a model is only useful for a school once
   * it has enough per-school samples, which is why band-level aggregation
   * matters more than total count in sparse-data regimes.
   */
  async getTrainingReadiness() {
    const VERIFIED_OUTCOME_STATUSES = [
      'COUNSELOR_VERIFIED',
      'DOCUMENT_VERIFIED',
    ];

    const [
      verifiedOutcomeLabels,
      selfReportedOutcomeLabels,
      outcomeStatusBreakdown,
      outcomeResultBreakdown,
      recentOutcomeLabels,
      caseCount,
      casesWithStructuredScores,
      casesByYear,
      casesBySchool,
    ] = await Promise.all([
      this.prisma.predictionOutcomeLabelRecord.count({
        where: {
          status: { in: VERIFIED_OUTCOME_STATUSES as never[] },
          result: { in: ['ADMITTED', 'REJECTED'] },
        },
      }),
      this.prisma.predictionOutcomeLabelRecord.count({
        where: { status: 'SELF_REPORTED' },
      }),
      this.prisma.predictionOutcomeLabelRecord.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.predictionOutcomeLabelRecord.groupBy({
        by: ['result'],
        _count: { _all: true },
      }),
      this.prisma.predictionOutcomeLabelRecord.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          result: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          predictionResult: {
            select: {
              schoolId: true,
              probability: true,
            },
          },
        },
      }),
      this.prisma.admissionCase.count({
        where: {
          reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
          result: { in: ['ADMITTED', 'REJECTED'] },
        },
      }),
      this.prisma.admissionCase.count({
        where: {
          reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
          result: { in: ['ADMITTED', 'REJECTED'] },
          testScores: { not: Prisma.JsonNull },
        },
      }),
      this.prisma.admissionCase.groupBy({
        by: ['year'],
        where: {
          reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
          result: { in: ['ADMITTED', 'REJECTED'] },
        },
        _count: { _all: true },
      }),
      this.prisma.admissionCase.groupBy({
        by: ['schoolId'],
        where: {
          reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
          result: { in: ['ADMITTED', 'REJECTED'] },
        },
        _count: { _all: true },
      }),
    ]);

    const totalLabeled = verifiedOutcomeLabels + caseCount;
    const outcomeStatusCounts = Object.fromEntries(
      outcomeStatusBreakdown.map((row) => [row.status, row._count._all]),
    );
    const outcomeResultCounts = Object.fromEntries(
      outcomeResultBreakdown.map((row) => [row.result, row._count._all]),
    );

    const TIER_THRESHOLDS: Array<{ tier: number; min: number; label: string }> =
      [
        { tier: 0, min: 0, label: 'Heuristic only' },
        { tier: 1, min: 50, label: 'Platt calibration' },
        { tier: 2, min: 200, label: 'Basic LR (20 features)' },
        { tier: 3, min: 1000, label: 'Full LR (44 features) + per-band' },
        { tier: 4, min: 5000, label: 'GBDT + per-band' },
      ];

    let currentTier = 0;
    for (const t of TIER_THRESHOLDS) {
      if (totalLabeled >= t.min) currentTier = t.tier;
    }
    const nextTierInfo =
      currentTier < 4 ? TIER_THRESHOLDS[currentTier + 1] : null;

    const schoolsWithMinSamples: Record<string, number> = {};
    for (const threshold of [10, 20, 50, 100]) {
      schoolsWithMinSamples[`schoolsWithAtLeast${threshold}Samples`] =
        casesBySchool.filter((s) => s._count._all >= threshold).length;
    }

    const yearBreakdown: Record<string, number> = {};
    for (const row of casesByYear) {
      yearBreakdown[String(row.year)] = row._count._all;
    }

    // Surface a clear next-step recommendation so operators don't have to
    // mentally map counts → action.
    let recommendedNextAction: string;
    if (totalLabeled < 50) {
      recommendedNextAction =
        'INSUFFICIENT: import more AdmissionCase rows (CSV import script) before attempting ML.';
    } else if (totalLabeled < 200) {
      recommendedNextAction =
        'Tier 1 viable (Platt calibration). Can train a calibrator but not a feature-based model. Keep accumulating cases.';
    } else if (totalLabeled < 1000) {
      recommendedNextAction =
        'Tier 2 viable (basic LR, 20 features). Train a global XGBoost champion for top schools with ≥20 per-school samples.';
    } else if (totalLabeled < 5000) {
      recommendedNextAction =
        'Tier 3 viable (full LR + per-band models). Promote per-selectivity-band champions.';
    } else {
      recommendedNextAction = 'Tier 4 viable (GBDT). Full ensemble deployable.';
    }

    return {
      totalLabeled,
      breakdown: {
        verifiedOutcomeLabels,
        selfReportedOutcomeLabels,
        approvedAdmissionCases: caseCount,
        casesWithStructuredTestScores: casesWithStructuredScores,
      },
      outcomeLoop: {
        verifiedCount: verifiedOutcomeLabels,
        selfReportedCount: selfReportedOutcomeLabels,
        calibrationPromotionAllowed: verifiedOutcomeLabels >= 50,
        externalAccuracyClaimAllowed: verifiedOutcomeLabels >= 200,
        statusCounts: outcomeStatusCounts,
        resultCounts: outcomeResultCounts,
        recent: recentOutcomeLabels.map((label) => ({
          id: label.id,
          result: label.result,
          status: label.status,
          schoolId: label.predictionResult.schoolId,
          probability:
            label.predictionResult.probability == null
              ? null
              : Number(label.predictionResult.probability),
          createdAt: label.createdAt.toISOString(),
          updatedAt: label.updatedAt.toISOString(),
        })),
      },
      tier: {
        current: currentTier,
        currentLabel:
          TIER_THRESHOLDS.find((t) => t.tier === currentTier)?.label ??
          'unknown',
        next: nextTierInfo
          ? {
              tier: nextTierInfo.tier,
              label: nextTierInfo.label,
              samplesNeeded: nextTierInfo.min - totalLabeled,
            }
          : null,
        thresholds: TIER_THRESHOLDS,
      },
      perSchoolCoverage: {
        ...schoolsWithMinSamples,
        totalSchoolsWithAnySample: casesBySchool.length,
      },
      yearBreakdown,
      recommendedNextAction,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Normalize legacy range-string fields on AdmissionCase into the
   * structured columns the training pipeline and teachers need.
   *
   * Context
   * -------
   * /admin/prediction-workflow/data-inventory currently reports:
   *   casesWithGpa11 = 0
   *   casesWithTestScores = 0
   * ...despite 1,235 approved cases existing. Historical imports populate
   * `gpaRange` / `satRange` / `actRange` / `toeflRange` strings but never
   * `gpa11` or the `testScores` JSON array. That leaves the ML feature
   * vector and Scorecard teacher working with string fallbacks that get
   * parsed lossily at serve-time rather than at import-time.
   *
   * Behavior
   * --------
   *   - Only writes fields that are currently NULL — never overwrites
   *     counselor-entered structured data.
   *   - GPA range-midpoint writes to `gpa11` (the "highest weight" grade
   *     per schema comment; ML feature vector uses this).
   *   - Sets `gpaScale` when we can detect it and the column is NULL.
   *   - Test-score parsers build a CaseTestScore[] array tagged with
   *     source='legacy_range_parse' + confidence ('exact' |
   *     'range-midpoint' | 'lower-bound-only'). Downstream consumers can
   *     down-weight midpoints.
   *   - dryRun returns counts + a 20-row preview without touching the DB.
   */
  async normalizeLegacyCases(
    options: { dryRun?: boolean; limit?: number } = {},
  ) {
    const dryRun = options.dryRun ?? false;

    // Only touch cases where at least one legacy field is set AND the
    // corresponding structured field is empty. Prisma can't express "any
    // of {satRange,actRange,...} non-null AND matching target null" in
    // one clause cleanly; the OR-of-ANDs below covers the four pairs.
    const cases = await this.prisma.admissionCase.findMany({
      where: {
        reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
        OR: [
          // GPA pair
          {
            gpaRange: { not: null },
            gpa11: null,
          },
          // Test-score pairs — testScores JSON is DB NULL (unset column).
          // Prisma uses `{ equals: DbNull }` for nullable JSON WHERE filters;
          // `JsonNull` refers to the stored JSON literal `null`, not DB NULL.
          {
            satRange: { not: null },
            testScores: { equals: Prisma.DbNull },
          },
          {
            actRange: { not: null },
            testScores: { equals: Prisma.DbNull },
          },
          {
            toeflRange: { not: null },
            testScores: { equals: Prisma.DbNull },
          },
        ],
      },
      select: {
        id: true,
        gpaRange: true,
        gpa11: true,
        gpaScale: true,
        satRange: true,
        actRange: true,
        toeflRange: true,
        testScores: true,
      },
      take: options.limit,
    });

    let gpaWritten = 0;
    let gpaScaleWritten = 0;
    let testScoresWritten = 0;
    let scanned = 0;
    const preview: Array<{
      caseId: string;
      gpa11?: number;
      gpaScale?: number;
      testScores?: NormalizedTestScoreEntry[];
    }> = [];
    const parseFailures: Array<{
      caseId: string;
      field: string;
      value: string;
    }> = [];

    for (const c of cases) {
      scanned++;
      const updates: {
        gpa11?: number;
        gpaScale?: number;
        testScores?: NormalizedTestScoreEntry[];
      } = {};

      // ----- GPA -----
      if (c.gpaRange && c.gpa11 == null) {
        const parsedGpa = parseGpaRange(c.gpaRange);
        if (parsedGpa) {
          updates.gpa11 = parsedGpa.gpa;
          if (c.gpaScale == null) updates.gpaScale = parsedGpa.scale;
        } else {
          parseFailures.push({
            caseId: c.id,
            field: 'gpaRange',
            value: c.gpaRange,
          });
        }
      }

      // ----- Test scores -----
      // Only build a new testScores array if the existing one is null;
      // if it's already a (possibly empty) array, an import already
      // touched it and we refuse to second-guess the import decision.
      if (c.testScores === null) {
        const entries: NormalizedTestScoreEntry[] = [];
        const tryAdd = (raw: string | null, type: 'SAT' | 'ACT' | 'TOEFL') => {
          if (!raw) return;
          const parsed = parseTestScoreRange(raw, type);
          if (parsed) {
            entries.push(toTestScoreEntry(parsed));
          } else {
            parseFailures.push({
              caseId: c.id,
              field: `${type.toLowerCase()}Range`,
              value: raw,
            });
          }
        };
        tryAdd(c.satRange, 'SAT');
        tryAdd(c.actRange, 'ACT');
        tryAdd(c.toeflRange, 'TOEFL');
        if (entries.length > 0) {
          updates.testScores = entries;
        }
      }

      if (!updates.gpa11 && !updates.gpaScale && !updates.testScores) {
        continue;
      }

      if (updates.gpa11 != null) gpaWritten++;
      if (updates.gpaScale != null) gpaScaleWritten++;
      if (updates.testScores) testScoresWritten++;

      if (preview.length < 20) {
        preview.push({
          caseId: c.id,
          gpa11: updates.gpa11,
          gpaScale: updates.gpaScale,
          testScores: updates.testScores,
        });
      }

      if (!dryRun) {
        await this.prisma.admissionCase.update({
          where: { id: c.id },
          data: {
            ...(updates.gpa11 != null ? { gpa11: updates.gpa11 } : {}),
            ...(updates.gpaScale != null ? { gpaScale: updates.gpaScale } : {}),
            ...(updates.testScores
              ? {
                  testScores:
                    updates.testScores as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
      }
    }

    if (!dryRun) {
      this.logger.log(
        `Normalized legacy cases: scanned=${scanned}, gpa11=${gpaWritten}, gpaScale=${gpaScaleWritten}, testScores=${testScoresWritten}, parseFailures=${parseFailures.length}`,
      );
    }

    return {
      dryRun,
      scanned,
      gpaWritten,
      gpaScaleWritten,
      testScoresWritten,
      parseFailures: parseFailures.slice(0, 50), // cap to keep response bounded
      parseFailuresTruncatedAt: parseFailures.length > 50 ? 50 : null,
      preview,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Backfill SchoolCohortRoundPrior from approved AdmissionCase rows.
   *
   * Reads verified cases → derives cohortKey via `deriveCohortKeyFromCase`
   * (mirror of runtime PredictionPolicyService.resolveCohortKey, adapted
   * for AdmissionCase's field set) → groups by (schoolId, cohortKey, round)
   * → computes priorRate + Wilson 95% CI → writes to SchoolCohortRoundPrior.
   *
   * Unlocks the `CohortPriorTeacher` distillation signal, which has been
   * reading an empty table. Cells with fewer than MIN_SAMPLES (5) cases are
   * dropped — a prior with too-wide CI is worse than falling back to
   * school-level admit rate.
   *
   * Idempotent: re-running overwrites existing priors for the same
   * (schoolId, cohortKey, round, policyVersionId=NULL, setVersion) key.
   * setVersion encodes today's date, so re-running on a different day
   * writes a new set rather than overwriting history.
   *
   * Uses find-first + branch instead of upsert because Postgres treats
   * NULLs as distinct in unique constraints, so an upsert with a NULL
   * policyVersionId would always CREATE and never UPDATE.
   */
  async backfillCohortPriors(
    options: {
      dryRun?: boolean;
      setVersion?: string;
      minSamples?: number;
    } = {},
  ) {
    const dryRun = options.dryRun ?? false;
    const minSamples = options.minSamples ?? 5;
    const setVersion =
      options.setVersion ??
      `backfill-admission-cases-${new Date().toISOString().slice(0, 10)}`;

    const cases = await this.prisma.admissionCase.findMany({
      where: {
        reviewStatus: { in: ['AUTO_APPROVED', 'APPROVED'] },
        result: { in: ['ADMITTED', 'REJECTED'] },
        round: { not: null },
      },
      select: {
        id: true,
        schoolId: true,
        round: true,
        result: true,
        nationality: true,
        curriculumType: true,
        highSchoolType: true,
        demographicTags: true,
        highSchool: { select: { country: true } },
      },
    });

    type Bucket = {
      schoolId: string;
      cohortKey: string;
      round: string;
      admits: number;
      rejects: number;
      caseIds: string[];
    };
    const buckets = new Map<string, Bucket>();
    let skippedNoCohort = 0;
    let skippedNoRound = 0;

    for (const c of cases) {
      const cohortKey = deriveCohortKeyFromCase({
        nationality: c.nationality,
        curriculumType: c.curriculumType,
        highSchoolType: c.highSchoolType,
        demographicTags: c.demographicTags,
        highSchool: c.highSchool,
      });
      if (!cohortKey) {
        skippedNoCohort++;
        continue;
      }
      if (!c.round) {
        skippedNoRound++;
        continue;
      }

      const round = c.round.toUpperCase();
      const key = `${c.schoolId}|${cohortKey}|${round}`;
      const bucket: Bucket = buckets.get(key) ?? {
        schoolId: c.schoolId,
        cohortKey,
        round,
        admits: 0,
        rejects: 0,
        caseIds: [],
      };
      if (c.result === 'ADMITTED') bucket.admits++;
      else if (c.result === 'REJECTED') bucket.rejects++;
      bucket.caseIds.push(c.id);
      buckets.set(key, bucket);
    }

    const eligible = Array.from(buckets.values()).filter(
      (b) => b.admits + b.rejects >= minSamples,
    );
    const droppedLowSample = buckets.size - eligible.length;

    // Return a preview for dry-run so the operator can inspect the output
    // shape before committing. We only surface the first 20 rows — the
    // full set would bloat response bodies for schools with many cohorts.
    const previewRows = eligible.slice(0, 20).map((b) => {
      const total = b.admits + b.rejects;
      const rate = b.admits / total;
      const { lower, upper } = wilsonInterval(b.admits, total);
      return {
        schoolId: b.schoolId,
        cohortKey: b.cohortKey,
        round: b.round,
        admits: b.admits,
        rejects: b.rejects,
        priorRate: rate,
        ciLower: lower,
        ciUpper: upper,
        confidence: confidenceTier(total),
      };
    });

    if (dryRun) {
      return {
        dryRun: true,
        scanned: cases.length,
        skippedNoCohort,
        skippedNoRound,
        bucketsTotal: buckets.size,
        eligibleBuckets: eligible.length,
        droppedLowSample,
        written: 0,
        updated: 0,
        setVersion,
        minSamples,
        preview: previewRows,
        generatedAt: new Date().toISOString(),
      };
    }

    let written = 0;
    let updated = 0;
    for (const b of eligible) {
      const total = b.admits + b.rejects;
      const rate = b.admits / total;
      const { lower, upper } = wilsonInterval(b.admits, total);

      const payload = {
        priorRate: new Prisma.Decimal(rate),
        lowerBound: new Prisma.Decimal(lower),
        upperBound: new Prisma.Decimal(upper),
        sampleCount: total,
        smoothingMethod: 'wilson-95',
        confidence: confidenceTier(total),
        sourceSummary: {
          origin: 'admission_case_aggregate',
          admits: b.admits,
          rejects: b.rejects,
          caseIds: b.caseIds.slice(0, 50),
          caseIdsTruncatedAt: b.caseIds.length > 50 ? 50 : null,
        } as Prisma.InputJsonValue,
        sourceObservationIds: [] as string[],
        notes: `Derived from ${total} verified AdmissionCase rows; see sourceSummary.caseIds.`,
      };

      const existing = await this.prisma.schoolCohortRoundPrior.findFirst({
        where: {
          schoolId: b.schoolId,
          cohortKey: b.cohortKey,
          round: b.round,
          policyVersionId: null,
          setVersion,
        },
        select: { id: true },
      });

      if (existing) {
        await this.prisma.schoolCohortRoundPrior.update({
          where: { id: existing.id },
          data: payload,
        });
        updated++;
      } else {
        await this.prisma.schoolCohortRoundPrior.create({
          data: {
            schoolId: b.schoolId,
            cohortKey: b.cohortKey,
            round: b.round,
            policyVersionId: null,
            setVersion,
            ...payload,
          },
        });
        written++;
      }
    }

    this.logger.log(
      `Backfilled cohort priors: ${written} new + ${updated} updated from ${cases.length} cases, setVersion=${setVersion}`,
    );

    return {
      dryRun: false,
      scanned: cases.length,
      skippedNoCohort,
      skippedNoRound,
      bucketsTotal: buckets.size,
      eligibleBuckets: eligible.length,
      droppedLowSample,
      written,
      updated,
      setVersion,
      minSamples,
      preview: previewRows,
      generatedAt: new Date().toISOString(),
    };
  }
}
