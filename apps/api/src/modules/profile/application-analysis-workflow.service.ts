import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ApplicationAnalysisExperimentCapability,
  ApplicationAnalysisExperimentEvaluationMode,
  ApplicationAnalysisExperimentStatus,
  ApplicationAnalysisEvaluationMode,
  ApplicationAnalysisFeedbackCategory,
  ApplicationAnalysisFeedbackSentiment,
  ApplicationAnalysisExperimentIncidentSeverity,
  ApplicationAnalysisExperimentIncidentStatus,
  ApplicationAnalysisExperimentSweepMode,
  ApplicationAnalysisExperimentSweepStatus,
  Prisma,
  SchoolPolicyDimension,
} from '@prisma/client';
import { FeatureFlagService } from '../../common/feature-flags/feature-flag.service';
import { createPaginatedResponse } from '../../common/dto/pagination.dto';
import { RedisService } from '../../common/redis/redis.service';
import {
  AuditAction,
  AuditLogService,
} from '../../common/services/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveCanonicalPredictionOutcome } from '@study-abroad/shared/scoring';
import {
  ApplicationAnalysisEvaluationQueryDto,
  ApplicationAnalysisExperimentEvaluationQueryDto,
  ApplicationAnalysisExperimentFeedbackQueryDto,
  ApplicationAnalysisExperimentIncidentQueryDto,
  ApplicationAnalysisExperimentQueryDto,
  ApplicationAnalysisExperimentSweepQueryDto,
  ApplicationAnalysisFairnessReportQueryDto,
  ApplicationAnalysisRecoursePreviewDto,
  AcknowledgeApplicationAnalysisExperimentIncidentDto,
  CreateApplicationAnalysisExperimentVersionDto,
  ApplicationAnalysisUncertaintyPreviewDto,
  ApplicationAnalysisEvidenceQueryDto,
  ApplicationAnalysisPolicyQueryDto,
  CreateApplicationAnalysisPolicyVersionDto,
  CreateSchoolPolicyEvidenceDto,
  ReviewSchoolPolicyEvidenceDto,
  UpdateApplicationAnalysisExperimentConfigDto,
} from '../admin/dto';
import {
  APPLICATION_ANALYSIS_DEFAULT_THRESHOLDS,
  APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION,
  APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS,
  APPLICATION_ANALYSIS_EXPERIMENT_DEFAULT_THRESHOLDS,
  APPLICATION_ANALYSIS_EXPERIMENT_LIVE_THRESHOLDS,
  APPLICATION_ANALYSIS_EXPERIMENT_ROLLOUT_STAGES,
} from './application-analysis-workflow.constants';

const WORKFLOW_SCHOOL_SELECT = {
  id: true,
  name: true,
  nameZh: true,
  usNewsRank: true,
} satisfies Prisma.SchoolSelect;

type PolicyStatus = 'DRAFT' | 'CANDIDATE' | 'SHADOW' | 'ACTIVE' | 'RETIRED';
type ExperimentCapability = 'RECOURSE' | 'UNCERTAINTY' | 'FAIRNESS';
type ExperimentStatus = 'DRAFT' | 'SHADOW' | 'CANARY' | 'ACTIVE' | 'RETIRED';
type FeedbackCategory =
  | 'UNSAFE_RECOURSE'
  | 'POLICY_MISMATCH'
  | 'MISLEADING_UNCERTAINTY'
  | 'FAIRNESS_CONCERN'
  | 'LOW_ACTIONABILITY';
type FeedbackSentiment = 'HELPFUL' | 'NOT_HELPFUL';
type SweepMode = 'HOURLY_ROLLOUT' | 'NIGHTLY_SHADOW' | 'MANUAL_FULL';

type EvidenceStatus =
  'DRAFT' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
type GovernanceEvidenceMode = 'fixture' | 'real' | 'mixed' | 'none';

/**
 * Application-analysis governance + experiment platform.
 *
 * STATUS (2026-06): part grounded, part premature infrastructure.
 *  - GROUNDED + LIVE: evidence management (createEvidence / reviewEvidence /
 *    listApprovedEvidenceBySchool) and policy versioning (getActivePolicyVersion
 *    / activatePolicy / rollbackPolicy). These manage the REVIEWED policy data
 *    that feeds the live policy cards in the V2 analysis. Keep working.
 *  - AWAITING OUTCOME DATA (not yet grounded): the experiment lifecycle
 *    (shadow → canary → activate), gate evaluations, fairnessReport,
 *    uncertaintyPreview (conformal) and recoursePreview all require admission
 *    OUTCOMES we do not yet collect. They are admin-only (@Roles(OPERATOR)) and
 *    are NOT surfaced on the live user path, so this is internal-hygiene, not a
 *    user-facing data-integrity issue.
 *
 * The cron automation (ApplicationAnalysisExperimentScheduler) is therefore
 * OPT-IN / default-off (APPLICATION_ANALYSIS_AUTOMATION_ENABLED) so it does not
 * run on absent data. Revisit grounding once an admission-outcome pipeline exists.
 */
@Injectable()
export class ApplicationAnalysisWorkflowService {
  private readonly logger = new Logger(ApplicationAnalysisWorkflowService.name);
  private readonly localAutomationLocks = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auditLog: AuditLogService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  private normalizeDate(value?: string | null): Date | undefined {
    return value ? new Date(value) : undefined;
  }

  private normalizeThresholds(raw?: Record<string, unknown> | null) {
    return {
      ...APPLICATION_ANALYSIS_DEFAULT_THRESHOLDS,
      ...(raw ?? {}),
    };
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

  private appendNote(current: string | null | undefined, next: string): string {
    return current ? `${current}\n\n${next}` : next;
  }

  private async invalidateApplicantCaches() {
    await this.redis.delByPrefix('ai:profile-analysis:');
  }

  private normalizeExperimentThresholds(
    capability: ExperimentCapability,
    raw?: Record<string, unknown> | null,
  ) {
    return {
      ...APPLICATION_ANALYSIS_EXPERIMENT_DEFAULT_THRESHOLDS[capability],
      ...(raw ?? {}),
    };
  }

  private normalizeExperimentRolloutConfig(
    capability: ExperimentCapability,
    raw?: Record<string, unknown> | null,
  ) {
    const stages = APPLICATION_ANALYSIS_EXPERIMENT_ROLLOUT_STAGES[capability];
    const configuredStages = Array.isArray(raw?.rolloutPercentages)
      ? (raw?.rolloutPercentages as unknown[])
          .map((value) =>
            typeof value === 'number' && Number.isFinite(value)
              ? Math.max(1, Math.min(100, Math.round(value)))
              : null,
          )
          .filter((value): value is number => value != null)
      : Array.isArray(raw?.stages)
        ? (raw?.stages as unknown[])
            .map((value) =>
              typeof value === 'number' && Number.isFinite(value)
                ? Math.max(1, Math.min(100, Math.round(value)))
                : null,
            )
            .filter((value): value is number => value != null)
        : [];
    const normalizedStages =
      configuredStages.length > 0
        ? [...new Set(configuredStages)]
        : [...stages];
    const currentPercentage = Math.max(
      0,
      Math.min(
        100,
        Number(
          raw?.currentPercentage ??
            raw?.canaryPercentage ??
            (raw?.currentStagePercentage as number | undefined) ??
            0,
        ) || 0,
      ),
    );
    const inferredStageIndex =
      typeof raw?.stageIndex === 'number'
        ? Math.max(-1, Math.min(normalizedStages.length - 1, raw.stageIndex))
        : currentPercentage > 0
          ? Math.max(0, normalizedStages.indexOf(currentPercentage))
          : -1;
    return {
      autoPromoteToCanary: true,
      autoPromoteStages: true,
      autoPromoteToActive: true,
      autoRetireOnFailure: true,
      automationPaused: false,
      stages: normalizedStages,
      rolloutPercentages: normalizedStages,
      currentPercentage,
      stageIndex: inferredStageIndex,
      minStageHours: APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.minStageHours,
      lastSweepAt: null,
      lastPromotedAt: null,
      nextEligiblePromotionAt: null,
      ...(raw ?? {}),
    };
  }

  private normalizeExperimentMonitoringConfig(
    raw?: Record<string, unknown> | null,
  ) {
    return {
      ...APPLICATION_ANALYSIS_EXPERIMENT_LIVE_THRESHOLDS,
      ...(raw ?? {}),
      latestSweepMode:
        typeof raw?.latestSweepMode === 'string' ? raw.latestSweepMode : null,
      latestSweepAt:
        typeof raw?.latestSweepAt === 'string' ? raw.latestSweepAt : null,
      latestSweepRunId:
        typeof raw?.latestSweepRunId === 'string' ? raw.latestSweepRunId : null,
      latestLiveSignals:
        raw?.latestLiveSignals && typeof raw.latestLiveSignals === 'object'
          ? raw.latestLiveSignals
          : {},
      latestIncidentId:
        typeof raw?.latestIncidentId === 'string' ? raw.latestIncidentId : null,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private asBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private asString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private getEvidenceModeFromMetadata(
    metadata: Prisma.JsonValue | Record<string, unknown> | null | undefined,
  ): Exclude<GovernanceEvidenceMode, 'mixed' | 'none'> {
    const raw = this.asRecord(metadata);
    const directMode = this.asString(raw.governanceSourceMode);
    if (directMode === 'fixture') {
      return 'fixture';
    }

    const provenance = this.asRecord(raw.provenance);
    const nestedMode = this.asString(provenance.mode);
    if (nestedMode === 'fixture') {
      return 'fixture';
    }

    return 'real';
  }

  private summarizeEvidenceModes(
    records: Array<{
      metadata?: Prisma.JsonValue | Record<string, unknown> | null;
    }>,
  ) {
    let fixtureCount = 0;
    let realCount = 0;
    for (const record of records) {
      if (this.getEvidenceModeFromMetadata(record.metadata) === 'fixture') {
        fixtureCount += 1;
      } else {
        realCount += 1;
      }
    }

    const evidenceMode: GovernanceEvidenceMode =
      fixtureCount > 0 && realCount > 0
        ? 'mixed'
        : fixtureCount > 0
          ? 'fixture'
          : realCount > 0
            ? 'real'
            : 'none';

    return {
      evidenceMode,
      fixtureEvidenceCount: fixtureCount,
      realEvidenceCount: realCount,
      totalEvidenceCount: fixtureCount + realCount,
    };
  }

  private getReplayScopeSummary(
    replay?: {
      summary?: Prisma.JsonValue | null;
      dataset?: string | null;
      id?: string | null;
    } | null,
  ): Record<string, unknown> {
    const summary = this.asRecord(replay?.summary);
    return {
      ...summary,
      dataset: this.asString(summary.dataset) ?? replay?.dataset ?? null,
      totalCases:
        this.asNumber(summary.totalCases) ??
        this.asNumber(summary.caseCount) ??
        0,
      caseIds: this.asStringArray(summary.caseIds),
      commitSha: this.asString(summary.commitSha),
      reportPath: this.asString(summary.reportPath),
      reportJsonPath: this.asString(summary.reportJsonPath),
    };
  }

  private getReplayCaseCount(
    replay?: {
      summary?: Prisma.JsonValue | null;
    } | null,
  ): number {
    const summary = this.asRecord(replay?.summary);
    return (
      this.asNumber(summary.totalCases) ??
      this.asNumber(summary.caseCount) ??
      this.asStringArray(summary.caseIds).length
    );
  }

  private roundMetric(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private dedupeStrings(values: Array<string | null | undefined>): string[] {
    return [
      ...new Set(
        values.filter((value): value is string => Boolean(value?.trim())),
      ),
    ];
  }

  private async findPreferredPolicyVersionForAnalysisVersion(
    analysisVersion: string,
  ) {
    const policies =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisPolicyVersion.findMany({
        where: {
          analysisVersion,
          status: { in: ['ACTIVE', 'SHADOW', 'CANDIDATE', 'DRAFT'] },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 20,
      });
    const statusOrder: Record<PolicyStatus, number> = {
      ACTIVE: 0,
      SHADOW: 1,
      CANDIDATE: 2,
      DRAFT: 3,
      RETIRED: 4,
    };

    return (
      [...policies].sort((left, right) => {
        const statusDelta =
          statusOrder[left.status] - statusOrder[right.status];
        if (statusDelta !== 0) {
          return statusDelta;
        }
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      })[0] ?? null
    );
  }

  private async findLatestGoldReplayRun(analysisVersion: string) {
    const deterministicReplay =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisReplayRun.findFirst({
        where: {
          analysisVersion,
          dataset: { startsWith: 'gold:deterministic' },
          status: { in: ['COMPLETED', 'FAILED'] },
        },
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
      });

    if (deterministicReplay) {
      return deterministicReplay;
    }

    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    return this.prisma.applicationAnalysisReplayRun.findFirst({
      where: {
        analysisVersion,
        dataset: { startsWith: 'gold:' },
        status: { in: ['COMPLETED', 'FAILED'] },
      },
      orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private summarizeApplicantFeedbackRecords(
    records: Array<{
      applicationAnalysisRunId?: string | null;
      sentiment: ApplicationAnalysisFeedbackSentiment;
      category: ApplicationAnalysisFeedbackCategory | null;
    }>,
  ) {
    const total = records.length;
    const helpfulCount = records.filter(
      (record) => record.sentiment === 'HELPFUL',
    ).length;
    const notHelpfulCount = total - helpfulCount;
    const distinctRunCount = new Set(
      records
        .map((record) => record.applicationAnalysisRunId)
        .filter((value): value is string => Boolean(value)),
    ).size;
    const countByCategory = (category: ApplicationAnalysisFeedbackCategory) =>
      records.filter((record) => record.category === category).length;

    return {
      applicantFeedbackCount: total,
      helpfulFeedbackCount: helpfulCount,
      notHelpfulFeedbackCount: notHelpfulCount,
      helpfulFeedbackRate:
        total > 0 ? this.roundMetric(helpfulCount / total) : 0,
      negativeFeedbackRate:
        total > 0 ? this.roundMetric(notHelpfulCount / total) : 0,
      lowActionabilityFeedbackRate:
        total > 0
          ? this.roundMetric(countByCategory('LOW_ACTIONABILITY') / total)
          : 0,
      policyMismatchFeedbackRate:
        total > 0
          ? this.roundMetric(countByCategory('POLICY_MISMATCH') / total)
          : 0,
      fairnessConcernFeedbackRate:
        total > 0
          ? this.roundMetric(countByCategory('FAIRNESS_CONCERN') / total)
          : 0,
      misleadingUncertaintyFeedbackRate:
        total > 0
          ? this.roundMetric(countByCategory('MISLEADING_UNCERTAINTY') / total)
          : 0,
      distinctRunCount,
    };
  }

  private async syncRunFeedbackMetrics(runId: string) {
    // governance: admin-scope — operator surface (admin/application-analysis-workflow: @Roles(OPERATOR) + SYSTEM_CALIBRATION); cross-user aggregation is the purpose
    const run = await this.prisma.applicationAnalysisRun.findUnique({
      where: { id: runId },
      select: {
        id: true,
        metrics: true,
      },
    });
    if (!run) return;

    const feedback =
      // governance: admin-scope — operator surface (admin/application-analysis-workflow: @Roles(OPERATOR) + SYSTEM_CALIBRATION); cross-user aggregation is the purpose
      await this.prisma.applicationAnalysisFeedbackRecord.findMany({
        where: { applicationAnalysisRunId: runId },
        select: {
          applicationAnalysisRunId: true,
          sentiment: true,
          category: true,
        },
      });

    // governance: admin-scope — operator surface (admin/application-analysis-workflow: @Roles(OPERATOR) + SYSTEM_CALIBRATION); cross-user aggregation is the purpose
    await this.prisma.applicationAnalysisRun.update({
      where: { id: runId },
      data: {
        metrics: {
          ...this.asRecord(run.metrics),
          ...this.summarizeApplicantFeedbackRecords(feedback),
        },
      },
    });
  }

  private async computeApplicantFeedbackSignals(analysisVersion: string) {
    const feedback =
      // governance: admin-scope — operator surface (admin/application-analysis-workflow: @Roles(OPERATOR) + SYSTEM_CALIBRATION); cross-user aggregation is the purpose
      await this.prisma.applicationAnalysisFeedbackRecord.findMany({
        where: {
          applicationAnalysisRunId: { not: null },
          applicationAnalysisRun: {
            analysisVersion,
          },
        },
        select: {
          applicationAnalysisRunId: true,
          sentiment: true,
          category: true,
        },
      });

    return this.summarizeApplicantFeedbackRecords(feedback);
  }

  private capabilityFlagKey(capability: ExperimentCapability) {
    switch (capability) {
      case 'RECOURSE':
        return APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS.recourse;
      case 'UNCERTAINTY':
        return APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS.conformal;
      case 'FAIRNESS':
        return APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS.fairness;
    }
  }

  private async upsertFeatureFlag(
    key: string,
    enabled: boolean,
    rules: Prisma.InputJsonValue | null,
    description: string,
  ) {
    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const existing = await this.prisma.featureFlag.findUnique({
      where: { key },
      select: { id: true },
    });

    if (existing) {
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.featureFlag.update({
        where: { id: existing.id },
        data: {
          enabled,
          description,
          rules: rules ?? Prisma.JsonNull,
        },
      });
      await this.featureFlagService.invalidateCache(key);
      return;
    }

    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    await this.prisma.featureFlag.create({
      data: {
        key,
        enabled,
        description,
        rules: rules ?? undefined,
      },
    });
    await this.featureFlagService.invalidateCache(key);
  }

  private async syncExperimentFeatureFlags() {
    const experiments =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findMany({
        where: { status: { in: ['ACTIVE', 'CANARY'] } },
        orderBy: [{ updatedAt: 'desc' }],
      });

    const selected = new Map<
      ExperimentCapability,
      Prisma.ApplicationAnalysisExperimentVersionGetPayload<
        Record<string, never>
      >
    >();
    for (const experiment of experiments) {
      const current = selected.get(experiment.capability);
      if (!current) {
        selected.set(experiment.capability, experiment);
        continue;
      }
      if (current.status !== 'ACTIVE' && experiment.status === 'ACTIVE') {
        selected.set(experiment.capability, experiment);
      }
    }

    for (const capability of ['RECOURSE', 'UNCERTAINTY', 'FAIRNESS'] as const) {
      const experiment = selected.get(capability);
      const key = this.capabilityFlagKey(capability);
      if (!experiment) {
        await this.upsertFeatureFlag(
          key,
          false,
          null,
          `Application analysis ${capability.toLowerCase()} capability`,
        );
        continue;
      }

      const rolloutConfig = this.normalizeExperimentRolloutConfig(
        capability,
        this.asRecord(experiment.rolloutConfig),
      );
      const currentPercentage = Math.max(
        1,
        Math.min(
          100,
          Number(rolloutConfig.currentPercentage) ||
            APPLICATION_ANALYSIS_EXPERIMENT_ROLLOUT_STAGES[capability][0],
        ),
      );

      await this.upsertFeatureFlag(
        key,
        true,
        experiment.status === 'CANARY'
          ? { percentage: currentPercentage }
          : null,
        `Application analysis ${capability.toLowerCase()} capability`,
      );
    }

    await this.upsertFeatureFlag(
      APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS.experimental,
      selected.size > 0,
      null,
      'Master switch for application-analysis experimental capabilities',
    );
  }

  private getSweepLockKey(mode: SweepMode) {
    return `lock:application-analysis-experiments:${mode.toLowerCase()}`;
  }

  private async acquireAutomationLock(
    mode: SweepMode,
    ttlSeconds: number,
  ): Promise<(() => Promise<void>) | null> {
    const key = this.getSweepLockKey(mode);
    if (this.redis.connected) {
      try {
        const acquired = await this.redis.setNXStrict(
          key,
          `${process.pid}:${Date.now()}`,
          ttlSeconds,
        );
        if (!acquired) return null;
        return async () => {
          try {
            await this.redis.del(key);
          } catch {
            // Best-effort unlock.
          }
        };
      } catch (error) {
        this.logger.warn(
          `Redis automation lock degraded for ${mode}: ${String(
            error instanceof Error ? error.message : error,
          )}`,
        );
      }
    }

    if (this.localAutomationLocks.has(key)) {
      return null;
    }
    this.localAutomationLocks.add(key);
    return async () => {
      this.localAutomationLocks.delete(key);
    };
  }

  private nextRolloutPercentage(rolloutConfig: Record<string, unknown>) {
    const stages = this.asStringArray(
      Array.isArray(rolloutConfig.stages)
        ? rolloutConfig.stages.map((value) => String(value))
        : Array.isArray(rolloutConfig.rolloutPercentages)
          ? rolloutConfig.rolloutPercentages.map((value) => String(value))
          : [],
    )
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.max(1, Math.min(100, Math.round(value))));
    const normalizedStages =
      stages.length > 0 ? [...new Set(stages)] : [5, 25, 100];
    const stageIndex =
      typeof rolloutConfig.stageIndex === 'number'
        ? rolloutConfig.stageIndex
        : -1;
    const nextIndex = stageIndex + 1;
    return {
      stages: normalizedStages,
      currentIndex: stageIndex,
      nextIndex,
      nextPercentage:
        nextIndex >= 0 && nextIndex < normalizedStages.length
          ? normalizedStages[nextIndex]
          : null,
    };
  }

  private isPromotionEligible(
    rolloutConfig: Record<string, unknown>,
    referenceDate = new Date(),
  ) {
    const minStageHours = Math.max(
      1,
      this.asNumber(rolloutConfig.minStageHours) ??
        APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.minStageHours,
    );
    const nextEligiblePromotionAt = this.asString(
      rolloutConfig.nextEligiblePromotionAt,
    );
    if (!nextEligiblePromotionAt) {
      return true;
    }
    const nextEligibleDate = new Date(nextEligiblePromotionAt);
    if (Number.isNaN(nextEligibleDate.getTime())) {
      return true;
    }
    return (
      nextEligibleDate.getTime() <= referenceDate.getTime() &&
      minStageHours >= 0
    );
  }

  private buildNextPromotionAt(
    rolloutConfig: Record<string, unknown>,
    referenceDate = new Date(),
  ) {
    const minStageHours = Math.max(
      1,
      this.asNumber(rolloutConfig.minStageHours) ??
        APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.minStageHours,
    );
    return new Date(
      referenceDate.getTime() + minStageHours * 60 * 60 * 1000,
    ).toISOString();
  }

  private async createExperimentIncident(input: {
    experimentVersionId?: string | null;
    capability?: ExperimentCapability | null;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    message: string;
    details?: Record<string, unknown>;
  }) {
    const incident =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentIncident.create({
        data: {
          experimentVersionId: input.experimentVersionId ?? undefined,
          capability: input.capability as
            ApplicationAnalysisExperimentCapability | undefined,
          type: input.type,
          severity: input.severity,
          title: input.title,
          message: input.message,
          details: input.details as Prisma.InputJsonValue | undefined,
        },
      });

    if (input.experimentVersionId) {
      const experiment =
        // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
        await this.prisma.applicationAnalysisExperimentVersion.findUnique({
          where: { id: input.experimentVersionId },
          select: { monitoringConfig: true },
        });
      if (experiment) {
        const monitoringConfig = this.normalizeExperimentMonitoringConfig(
          this.asRecord(experiment.monitoringConfig),
        );
        // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
        await this.prisma.applicationAnalysisExperimentVersion.update({
          where: { id: input.experimentVersionId },
          data: {
            monitoringConfig: {
              ...monitoringConfig,
              latestIncidentId: incident.id,
            },
          },
        });
      }
    }

    return incident;
  }

  private async getLatestReplaySnapshot(analysisVersion?: string | null) {
    if (!analysisVersion) {
      return {
        replay: null,
        metrics: {} as Record<string, unknown>,
        failures: [
          'No application-analysis policy version is linked to this experiment.',
        ],
      };
    }

    const replay = await this.findLatestGoldReplayRun(analysisVersion);

    const failures: string[] = [];
    if (!replay) {
      failures.push(
        `No replay-backed evaluation exists for analysis version ${analysisVersion}.`,
      );
    } else if (replay.status === 'FAILED') {
      failures.push('Latest replay-backed evaluation failed.');
    }

    return {
      replay,
      metrics: this.asRecord(replay?.metrics),
      failures,
    };
  }

  private async buildExperimentMetrics(experiment: {
    id: string;
    capability: ExperimentCapability;
    policyVersionId?: string | null;
  }): Promise<{
    metrics: Record<string, number | boolean>;
    failures: string[];
    counts: Record<string, number | string | null>;
    latestReplayId: string | null;
  }> {
    const [policy, liveSignals, openIncidents] = await Promise.all([
      experiment.policyVersionId
        ? // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
          this.prisma.applicationAnalysisPolicyVersion.findUnique({
            where: { id: experiment.policyVersionId },
            select: { analysisVersion: true },
          })
        : Promise.resolve(null),
      this.computeExperimentLiveSignals(experiment.id),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisExperimentIncident.findMany({
        where: {
          experimentVersionId: experiment.id,
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        },
        select: {
          type: true,
          severity: true,
          status: true,
        },
      }),
    ]);

    const replaySnapshot = await this.getLatestReplaySnapshot(
      policy?.analysisVersion ?? null,
    );
    const replayMetrics = replaySnapshot.metrics;
    const failures = [...replaySnapshot.failures];
    const metrics: Record<string, number | boolean> = {};

    const contractParityPass = this.asBoolean(replayMetrics.contractParityPass);
    if (contractParityPass != null) {
      metrics.contractParityPass = contractParityPass;
    } else {
      failures.push(
        'Contract parity result is missing from the replay metrics.',
      );
    }

    const webRenderPass = this.asBoolean(replayMetrics.webRenderPass);
    if (webRenderPass != null) {
      metrics.webRenderPass = webRenderPass;
    } else {
      failures.push('Web render result is missing from the replay metrics.');
    }

    const mobileRenderPass = this.asBoolean(replayMetrics.mobileRenderPass);
    if (mobileRenderPass != null) {
      metrics.mobileRenderPass = mobileRenderPass;
    } else {
      failures.push('Mobile render result is missing from the replay metrics.');
    }

    const journeyPassRate = this.asNumber(replayMetrics.journeyPassRate);
    if (journeyPassRate != null) {
      metrics.journeyPassRate = journeyPassRate;
    } else {
      failures.push('Journey pass rate is missing from the replay metrics.');
    }

    if (experiment.capability === 'RECOURSE') {
      if (liveSignals.exposureCount > 0) {
        metrics.unsafeSuggestionRate =
          liveSignals.unsafeRecourseCount / liveSignals.exposureCount;
      } else {
        failures.push(
          'Unsafe recourse rate cannot be measured before the experiment has live exposures.',
        );
      }

      const actionabilityMean = this.asNumber(replayMetrics.actionabilityMean);
      if (actionabilityMean != null) {
        metrics.actionabilityMean = actionabilityMean;
      } else {
        failures.push(
          'Recourse actionability is missing from the replay-backed evaluation.',
        );
      }

      const schoolPolicyConsistency = this.asNumber(
        replayMetrics.policyCorrectnessRate,
      );
      if (schoolPolicyConsistency != null) {
        metrics.schoolPolicyConsistency = schoolPolicyConsistency;
      } else {
        failures.push(
          'School policy consistency is missing from the replay-backed evaluation.',
        );
      }

      const immutableIncidents = openIncidents.filter((incident) =>
        incident.type.toUpperCase().includes('IMMUTABLE'),
      ).length;
      if (immutableIncidents > 0) {
        metrics.immutableFeatureViolation = immutableIncidents;
      } else {
        failures.push(
          'Immutable-feature violations are not instrumented in replay/live data yet.',
        );
      }
    } else if (experiment.capability === 'UNCERTAINTY') {
      if (liveSignals.outcomeSampleCount > 0) {
        metrics.outcomeRegressionDelta = liveSignals.outcomeRegressionDelta;
        metrics.outcomeSampleCount = liveSignals.outcomeSampleCount;
      }
      failures.push(
        'Replay-backed empirical uncertainty coverage metrics are not instrumented yet.',
      );
    } else {
      const fabricatedInsightCount = this.asNumber(
        replayMetrics.fabricatedInsightCount,
      );
      if (fabricatedInsightCount != null) {
        metrics.fabricatedInsightCount = fabricatedInsightCount;
      } else {
        failures.push(
          'Fabricated-insight count is missing from the replay-backed evaluation.',
        );
      }

      const fairnessIncidents = openIncidents.filter(
        (incident) =>
          incident.type.toUpperCase().includes('FAIRNESS') ||
          incident.severity === 'CRITICAL',
      ).length;
      metrics.blockedSubgroupCount = fairnessIncidents;
      if (fairnessIncidents === 0 && fabricatedInsightCount === 0) {
        metrics.disclosurePass = true;
      }

      failures.push(
        'Fairness subgroup delta metrics are not instrumented in replay/live data yet.',
      );
    }

    return {
      metrics,
      failures: [...new Set(failures)],
      counts: {
        exposureCount: liveSignals.exposureCount,
        feedbackCount: liveSignals.feedbackCount,
        negativeFeedbackCount: liveSignals.negativeFeedbackCount,
        outcomeSampleCount: liveSignals.outcomeSampleCount,
        openIncidentCount: openIncidents.length,
      },
      latestReplayId: replaySnapshot.replay?.id ?? null,
    };
  }

  async getActivePolicyVersion() {
    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    return this.prisma.applicationAnalysisPolicyVersion.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: [{ activatedAt: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async runGovernanceEvaluationForAnalysisVersion(
    actorId: string,
    analysisVersion: string,
    options:
      | ApplicationAnalysisEvaluationMode
      | {
          mode?: ApplicationAnalysisEvaluationMode;
          allowFixtureEvidence?: boolean;
        } = 'GOLD_SET',
  ) {
    const policy =
      await this.findPreferredPolicyVersionForAnalysisVersion(analysisVersion);

    if (!policy) {
      throw new NotFoundException(
        `No application-analysis policy version found for ${analysisVersion}.`,
      );
    }

    const normalizedOptions =
      typeof options === 'string'
        ? { mode: options, allowFixtureEvidence: false }
        : {
            mode: options.mode ?? 'GOLD_SET',
            allowFixtureEvidence: options.allowFixtureEvidence ?? false,
          };

    return this.runEvaluation(policy.id, normalizedOptions.mode, actorId, {
      allowFixtureEvidence: normalizedOptions.allowFixtureEvidence,
    });
  }

  async getRuntimeExperiments(userId: string) {
    const masterEnabled = await this.featureFlagService.isEnabled(
      APPLICATION_ANALYSIS_EXPERIMENTAL_FLAGS.experimental,
      { userId },
    );

    if (!masterEnabled) {
      return [];
    }

    const experiments =
      await this.prisma.applicationAnalysisExperimentVersion.findMany({
        where: { status: { in: ['ACTIVE', 'CANARY'] } },
        include: {
          policyVersion: {
            select: {
              id: true,
              policyKey: true,
              version: true,
              status: true,
              analysisVersion: true,
            },
          },
          evaluationRuns: {
            where: { status: 'COMPLETED' },
            orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
            take: 1,
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
      });

    const selected = new Map<
      ExperimentCapability,
      (typeof experiments)[number]
    >();
    for (const experiment of experiments) {
      const capability = experiment.capability;
      const existing = selected.get(capability);
      if (!existing) {
        selected.set(capability, experiment);
        continue;
      }
      if (existing.status !== 'ACTIVE' && experiment.status === 'ACTIVE') {
        selected.set(capability, experiment);
      }
    }

    const enabled: Array<(typeof experiments)[number]> = [];
    for (const capability of ['RECOURSE', 'UNCERTAINTY', 'FAIRNESS'] as const) {
      const experiment = selected.get(capability);
      if (!experiment) continue;
      const allowed = await this.featureFlagService.isEnabled(
        this.capabilityFlagKey(capability),
        { userId },
      );
      if (allowed) {
        enabled.push(experiment);
      }
    }

    return enabled;
  }

  async listApprovedEvidenceBySchool(schoolIds: string[]) {
    if (schoolIds.length === 0) return [];
    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    return this.prisma.schoolPolicyEvidence.findMany({
      where: {
        schoolId: { in: schoolIds },
        status: 'APPROVED',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ reviewedAt: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async listEvidence(query: ApplicationAnalysisEvidenceQueryDto) {
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.policyDimension
        ? {
            policyDimension: query.policyDimension,
          }
        : {}),
      ...(query.schoolId ? { schoolId: query.schoolId } : {}),
      ...(query.evidenceMode === 'fixture'
        ? {
            metadata: {
              path: ['governanceSourceMode'],
              equals: 'fixture',
            } satisfies Prisma.JsonFilter,
          }
        : {}),
      ...(query.evidenceMode === 'real'
        ? {
            NOT: {
              metadata: {
                path: ['governanceSourceMode'],
                equals: 'fixture',
              } satisfies Prisma.JsonFilter,
            },
          }
        : {}),
    };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.schoolPolicyEvidence.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          school: {
            select: WORKFLOW_SCHOOL_SELECT,
          },
        },
      }),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.schoolPolicyEvidence.count({ where }),
    ]);

    return createPaginatedResponse(
      items.map((item) => ({
        ...item,
        evidenceMode: this.getEvidenceModeFromMetadata(item.metadata),
      })),
      total,
      page,
      pageSize,
    );
  }

  async createEvidence(actorId: string, dto: CreateSchoolPolicyEvidenceDto) {
    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const created = await this.prisma.schoolPolicyEvidence.create({
      data: {
        schoolId: dto.schoolId,
        policyDimension: dto.policyDimension,
        policyValue: dto.policyValue,
        sourceName: dto.sourceName,
        sourceUrl: dto.sourceUrl,
        sourcePublishedAt: this.normalizeDate(dto.sourcePublishedAt),
        sourceQuality: dto.sourceQuality,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        expiresAt: this.normalizeDate(dto.expiresAt),
        notes: dto.notes
          ? `${dto.notes}\n\n[created-by:${actorId}]`
          : `[created-by:${actorId}]`,
      },
      include: {
        school: {
          select: WORKFLOW_SCHOOL_SELECT,
        },
      },
    });

    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EVIDENCE_CREATE',
      'application_analysis_evidence',
      created.id,
      {
        schoolId: created.schoolId,
        policyDimension: created.policyDimension,
        policyValue: created.policyValue,
      },
    );

    return created;
  }

  async reviewEvidence(
    actorId: string,
    id: string,
    dto: ReviewSchoolPolicyEvidenceDto,
  ) {
    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const evidence = await this.prisma.schoolPolicyEvidence.findUnique({
      where: { id },
      select: {
        id: true,
        notes: true,
        status: true,
      },
    });

    if (!evidence) {
      throw new NotFoundException('Application-analysis evidence not found');
    }

    const reviewedAt = this.normalizeDate(dto.reviewedAt) ?? new Date();
    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const updated = await this.prisma.schoolPolicyEvidence.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedAt,
        reviewedBy: actorId,
        expiresAt: this.normalizeDate(dto.expiresAt),
        notes: dto.notes
          ? this.appendNote(evidence.notes, dto.notes)
          : evidence.notes,
      },
      include: {
        school: {
          select: WORKFLOW_SCHOOL_SELECT,
        },
      },
    });

    if (
      evidence.status !== updated.status &&
      ['APPROVED', 'REJECTED', 'EXPIRED'].includes(updated.status)
    ) {
      await this.invalidateApplicantCaches();
    }

    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EVIDENCE_REVIEW',
      'application_analysis_evidence',
      id,
      {
        status: updated.status,
      },
    );

    return updated;
  }

  async listPolicyVersions(query: ApplicationAnalysisPolicyQueryDto) {
    const where = {
      ...(query.policyKey ? { policyKey: query.policyKey } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisPolicyVersion.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisPolicyVersion.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async createPolicyVersion(
    actorId: string,
    dto: CreateApplicationAnalysisPolicyVersionDto,
  ) {
    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const created = await this.prisma.applicationAnalysisPolicyVersion.create({
      data: {
        policyKey: dto.policyKey ?? 'default',
        version: dto.version,
        name: dto.name,
        description: dto.description,
        status: 'DRAFT',
        analysisVersion: dto.analysisVersion,
        promptVersion: dto.promptVersion,
        ruleBundleVersion: dto.ruleBundleVersion,
        thresholds: this.normalizeThresholds(dto.thresholds ?? null),
        rolloutConfig: (dto.rolloutConfig ?? {}) as Prisma.InputJsonValue,
        monitoringConfig: (dto.monitoringConfig ?? {}) as Prisma.InputJsonValue,
        effectiveFrom: this.normalizeDate(dto.effectiveFrom),
        notes: dto.notes
          ? `${dto.notes}\n\n[created-by:${actorId}]`
          : `[created-by:${actorId}]`,
      },
    });

    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_POLICY_CREATE',
      'application_analysis_policy',
      created.id,
      {
        policyKey: created.policyKey,
        version: created.version,
      },
    );

    return created;
  }

  async promotePolicyToCandidate(actorId: string, id: string) {
    const policy =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisPolicyVersion.findUnique({
        where: { id },
      });

    if (!policy) {
      throw new NotFoundException(
        'Application-analysis policy version not found',
      );
    }
    if (policy.status !== 'DRAFT') {
      throw new ConflictException(
        'Only DRAFT policy versions can become CANDIDATE',
      );
    }

    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const updated = await this.prisma.applicationAnalysisPolicyVersion.update({
      where: { id },
      data: {
        status: 'CANDIDATE',
        notes: this.appendNote(
          policy.notes,
          `[candidate-freeze:${new Date().toISOString()} by ${actorId}]`,
        ),
      },
    });

    await this.runEvaluation(id, 'GOLD_SET', actorId);
    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_POLICY_CANDIDATE',
      'application_analysis_policy',
      id,
      {
        policyKey: policy.policyKey,
        version: policy.version,
      },
    );

    return updated;
  }

  async promotePolicyToShadow(actorId: string, id: string) {
    const policy =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisPolicyVersion.findUnique({
        where: { id },
      });

    if (!policy) {
      throw new NotFoundException(
        'Application-analysis policy version not found',
      );
    }
    if (policy.status !== 'CANDIDATE') {
      throw new ConflictException(
        'Only CANDIDATE policy versions can enter SHADOW',
      );
    }

    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const updated = await this.prisma.applicationAnalysisPolicyVersion.update({
      where: { id },
      data: {
        status: 'SHADOW',
        shadowStartedAt: new Date(),
        notes: this.appendNote(
          policy.notes,
          `[shadow-start:${new Date().toISOString()} by ${actorId}]`,
        ),
      },
    });

    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_POLICY_SHADOW',
      'application_analysis_policy',
      id,
      {
        policyKey: policy.policyKey,
        version: policy.version,
      },
    );

    return updated;
  }

  private async runEvaluation(
    policyVersionId: string,
    mode: ApplicationAnalysisEvaluationMode,
    actorId: string,
    options: {
      allowFixtureEvidence?: boolean;
    } = {},
  ) {
    const policy =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisPolicyVersion.findUnique({
        where: { id: policyVersionId },
      });

    if (!policy) {
      throw new NotFoundException(
        'Application-analysis policy version not found',
      );
    }

    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const approvedEvidence = await this.prisma.schoolPolicyEvidence.findMany({
      where: {
        status: 'APPROVED',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        metadata: true,
      },
    });
    const evidenceCounts = this.summarizeEvidenceModes(approvedEvidence);
    const latestReplay = await this.findLatestGoldReplayRun(
      policy.analysisVersion,
    );

    const replayMetrics =
      latestReplay?.metrics && typeof latestReplay.metrics === 'object'
        ? (latestReplay.metrics as Record<string, unknown>)
        : {};
    const replayFailures = this.asStringArray(latestReplay?.failures);
    const replayScopeSummary = this.getReplayScopeSummary(latestReplay);
    const goldReplayCaseCount = this.getReplayCaseCount(latestReplay);
    const applicantFeedbackSignals = await this.computeApplicantFeedbackSignals(
      policy.analysisVersion,
    );
    const metrics = {
      ...replayMetrics,
      ...applicantFeedbackSignals,
    };

    const failures: string[] = [...replayFailures];
    if (!latestReplay) {
      failures.push('No replay-backed gold evaluation is available yet.');
    }
    if (options.allowFixtureEvidence) {
      if (evidenceCounts.totalEvidenceCount === 0) {
        failures.push(
          'No approved school policy evidence is available yet, including governance fixtures.',
        );
      }
    } else if (evidenceCounts.realEvidenceCount === 0) {
      failures.push(
        'No approved real school policy evidence is available yet.',
      );
    }
    if (latestReplay?.status === 'FAILED') {
      failures.push('Latest replay-backed evaluation did not pass.');
    }
    if (
      applicantFeedbackSignals.applicantFeedbackCount >= 5 &&
      applicantFeedbackSignals.helpfulFeedbackRate < 0.6
    ) {
      failures.push('Applicant helpfulness signal is below the operating bar.');
    }
    if (
      applicantFeedbackSignals.applicantFeedbackCount >= 5 &&
      applicantFeedbackSignals.lowActionabilityFeedbackRate > 0.35
    ) {
      failures.push(
        'Applicant feedback indicates the structured next actions are not actionable enough.',
      );
    }

    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const run = await this.prisma.applicationAnalysisEvaluationRun.create({
      data: {
        policyVersionId,
        mode,
        status: failures.length === 0 ? 'COMPLETED' : 'FAILED',
        scopeSummary: replayScopeSummary as Prisma.InputJsonValue,
        counts: {
          approvedEvidenceCount: evidenceCounts.totalEvidenceCount,
          fixtureApprovedEvidenceCount: evidenceCounts.fixtureEvidenceCount,
          realApprovedEvidenceCount: evidenceCounts.realEvidenceCount,
          evidenceMode: evidenceCounts.evidenceMode,
          latestReplayId: latestReplay?.id ?? null,
          goldReplayCaseCount,
          replayDataset: this.asString(replayScopeSummary.dataset),
          replayMode: this.asString(replayScopeSummary.mode),
          replayCommitSha: this.asString(replayScopeSummary.commitSha),
          replayReportPath: this.asString(replayScopeSummary.reportPath),
          replayReportJsonPath: this.asString(
            replayScopeSummary.reportJsonPath,
          ),
          mode,
          workflowMode: options.allowFixtureEvidence
            ? 'governance'
            : 'production',
          applicantFeedbackCount:
            applicantFeedbackSignals.applicantFeedbackCount,
          runsWithApplicantFeedback: applicantFeedbackSignals.distinctRunCount,
        },
        metrics: metrics,
        failures: this.dedupeStrings(failures),
        startedAt: new Date(),
        finishedAt: new Date(),
        createdBy: actorId,
      },
      include: {
        policyVersion: {
          select: {
            id: true,
            policyKey: true,
            version: true,
            status: true,
            analysisVersion: true,
          },
        },
      },
    });

    const monitoringConfig =
      (policy.monitoringConfig as Record<string, unknown> | null) ?? {};
    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    await this.prisma.applicationAnalysisPolicyVersion.update({
      where: { id: policyVersionId },
      data: {
        monitoringConfig: {
          ...monitoringConfig,
          latestEvaluationId: run.id,
          latestEvaluationMode: mode,
          latestEvaluationMetrics: metrics,
          latestEvaluationAt: new Date().toISOString(),
          latestEvaluationBy: actorId,
        },
      },
    });

    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EVALUATION_RUN',
      'application_analysis_policy',
      policyVersionId,
      {
        mode,
        runId: run.id,
      },
    );

    return run;
  }

  async refreshShadowEvaluation(actorId: string, id: string) {
    const policy =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisPolicyVersion.findUnique({
        where: { id },
      });

    if (!policy) {
      throw new NotFoundException(
        'Application-analysis policy version not found',
      );
    }
    if (policy.status !== 'SHADOW') {
      throw new ConflictException(
        'Only SHADOW policy versions can refresh shadow evaluation',
      );
    }

    return this.runEvaluation(id, 'SHADOW', actorId);
  }

  async listEvaluations(query: ApplicationAnalysisEvaluationQueryDto) {
    const where = {
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.policyVersionId
        ? { policyVersionId: query.policyVersionId }
        : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisEvaluationRun.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          policyVersion: {
            select: {
              id: true,
              policyKey: true,
              version: true,
              status: true,
              analysisVersion: true,
            },
          },
        },
      }),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisEvaluationRun.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async listExperimentVersions(query: ApplicationAnalysisExperimentQueryDto) {
    const where = {
      ...(query.capability
        ? {
            capability: query.capability,
          }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisExperimentVersion.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          policyVersion: {
            select: {
              id: true,
              policyKey: true,
              version: true,
              status: true,
              analysisVersion: true,
            },
          },
        },
      }),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisExperimentVersion.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async createExperimentVersion(
    actorId: string,
    dto: CreateApplicationAnalysisExperimentVersionDto,
  ) {
    const capability = dto.capability;
    const created =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.create({
        data: {
          capability: capability,
          version: dto.version,
          policyVersionId: dto.policyVersionId,
          status: 'DRAFT',
          methodVersion: dto.methodVersion,
          gateConfig: this.normalizeExperimentThresholds(
            capability,
            dto.gateConfig ?? null,
          ),
          rolloutConfig: this.normalizeExperimentRolloutConfig(
            capability,
            dto.rolloutConfig ?? null,
          ),
          monitoringConfig: this.normalizeExperimentMonitoringConfig(
            dto.monitoringConfig ?? null,
          ),
          notes: dto.notes
            ? `${dto.notes}\n\n[created-by:${actorId}]`
            : `[created-by:${actorId}]`,
          createdBy: actorId,
        },
        include: {
          policyVersion: {
            select: {
              id: true,
              policyKey: true,
              version: true,
              status: true,
              analysisVersion: true,
            },
          },
        },
      });

    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EXPERIMENT_CREATE',
      'application_analysis_experiment',
      created.id,
      {
        capability: created.capability,
        version: created.version,
      },
    );

    return created;
  }

  private async runExperimentEvaluation(
    experimentVersionId: string,
    mode: ApplicationAnalysisExperimentEvaluationMode,
    actorId: string,
  ) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id: experimentVersionId },
      });

    if (!experiment) {
      throw new NotFoundException(
        'Application-analysis experiment version not found',
      );
    }

    const { metrics, failures, counts, latestReplayId } =
      await this.buildExperimentMetrics({
        id: experiment.id,
        capability: experiment.capability,
        policyVersionId: experiment.policyVersionId,
      });
    const latestReplay =
      latestReplayId != null
        ? // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
          await this.prisma.applicationAnalysisReplayRun.findUnique({
            where: { id: latestReplayId },
          })
        : null;
    const replayScopeSummary = this.getReplayScopeSummary(latestReplay);
    const goldReplayCaseCount = this.getReplayCaseCount(latestReplay);

    const run =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentEvaluationRun.create({
        data: {
          experimentVersionId,
          mode,
          status: failures.length === 0 ? 'COMPLETED' : 'FAILED',
          scopeSummary: {
            ...replayScopeSummary,
            capability: experiment.capability,
          },
          counts: {
            ...counts,
            latestReplayId,
            goldReplayCaseCount,
            replayDataset: this.asString(replayScopeSummary.dataset),
            replayMode: this.asString(replayScopeSummary.mode),
            replayCommitSha: this.asString(replayScopeSummary.commitSha),
            replayReportPath: this.asString(replayScopeSummary.reportPath),
            mode,
          },
          metrics: metrics,
          failures,
          startedAt: new Date(),
          finishedAt: new Date(),
          createdBy: actorId,
        },
        include: {
          experimentVersion: {
            select: {
              id: true,
              capability: true,
              version: true,
              status: true,
              methodVersion: true,
            },
          },
        },
      });

    const monitoringConfig = this.asRecord(experiment.monitoringConfig);
    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    await this.prisma.applicationAnalysisExperimentVersion.update({
      where: { id: experimentVersionId },
      data: {
        monitoringConfig: {
          ...this.normalizeExperimentMonitoringConfig(monitoringConfig),
          latestEvaluationId: run.id,
          latestEvaluationMode: mode,
          latestEvaluationMetrics: metrics,
          latestEvaluationAt: new Date().toISOString(),
          latestEvaluationBy: actorId,
        },
      },
    });

    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EXPERIMENT_EVALUATION_RUN',
      'application_analysis_experiment',
      experimentVersionId,
      {
        mode,
        runId: run.id,
      },
    );

    return run;
  }

  async promoteExperimentToShadow(actorId: string, id: string) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id },
      });

    if (!experiment) {
      throw new NotFoundException(
        'Application-analysis experiment version not found',
      );
    }
    if (experiment.status !== 'DRAFT') {
      throw new ConflictException(
        'Only DRAFT experiment versions can enter SHADOW',
      );
    }

    const updated =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.update({
        where: { id },
        data: {
          status: 'SHADOW',
          shadowStartedAt: new Date(),
          notes: this.appendNote(
            experiment.notes,
            `[shadow-start:${new Date().toISOString()} by ${actorId}]`,
          ),
        },
      });

    await this.runExperimentEvaluation(id, 'GOLD_SET', actorId);
    await this.runExperimentEvaluation(id, 'SHADOW', actorId);
    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EXPERIMENT_SHADOW',
      'application_analysis_experiment',
      id,
      {
        capability: experiment.capability,
        version: experiment.version,
      },
    );

    return updated;
  }

  async refreshExperimentEvaluation(
    actorId: string,
    id: string,
    mode?: ApplicationAnalysisExperimentEvaluationMode,
  ) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id },
      });

    if (!experiment) {
      throw new NotFoundException(
        'Application-analysis experiment version not found',
      );
    }

    const resolvedMode =
      mode ??
      (experiment.status === 'CANARY' || experiment.status === 'ACTIVE'
        ? 'CANARY'
        : 'SHADOW');

    return this.runExperimentEvaluation(id, resolvedMode, actorId);
  }

  async promoteExperimentToCanary(actorId: string, id: string) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id },
      });

    if (!experiment) {
      throw new NotFoundException(
        'Application-analysis experiment version not found',
      );
    }
    if (experiment.status !== 'SHADOW') {
      throw new ConflictException(
        'Only SHADOW experiment versions can enter CANARY',
      );
    }

    const gateSummary = await this.getExperimentGateSummary(id);
    if (!gateSummary.ready) {
      throw new ConflictException(
        `Experiment promotion blocked: ${gateSummary.failures.join('; ')}`,
      );
    }

    const updated =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.update({
        where: { id },
        data: {
          status: 'CANARY',
          canaryStartedAt: new Date(),
          rolloutConfig: {
            ...this.normalizeExperimentRolloutConfig(
              experiment.capability,
              this.asRecord(experiment.rolloutConfig),
            ),
            currentPercentage: this.normalizeExperimentRolloutConfig(
              experiment.capability,
              this.asRecord(experiment.rolloutConfig),
            ).stages[0],
            stageIndex: 0,
            lastPromotedAt: new Date().toISOString(),
            nextEligiblePromotionAt: this.buildNextPromotionAt(
              this.normalizeExperimentRolloutConfig(
                experiment.capability,
                this.asRecord(experiment.rolloutConfig),
              ),
            ),
          },
          notes: this.appendNote(
            experiment.notes,
            `[canary-start:${new Date().toISOString()} by ${actorId}]`,
          ),
        },
      });

    await this.runExperimentEvaluation(id, 'CANARY', actorId);
    await this.syncExperimentFeatureFlags();
    await this.invalidateApplicantCaches();
    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EXPERIMENT_CANARY',
      'application_analysis_experiment',
      id,
      {
        capability: experiment.capability,
        version: experiment.version,
      },
    );

    return updated;
  }

  async listExperimentEvaluations(
    query: ApplicationAnalysisExperimentEvaluationQueryDto,
  ) {
    const where = {
      ...(query.mode
        ? {
            mode: query.mode,
          }
        : {}),
      ...(query.experimentVersionId
        ? { experimentVersionId: query.experimentVersionId }
        : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisExperimentEvaluationRun.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          experimentVersion: {
            select: {
              id: true,
              capability: true,
              version: true,
              status: true,
              methodVersion: true,
            },
          },
        },
      }),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisExperimentEvaluationRun.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async listExperimentSweeps(
    query: ApplicationAnalysisExperimentSweepQueryDto,
  ) {
    const where = {
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisExperimentSweepRun.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisExperimentSweepRun.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async listExperimentIncidents(
    query: ApplicationAnalysisExperimentIncidentQueryDto,
  ) {
    const where = {
      ...(query.capability
        ? {
            capability: query.capability,
          }
        : {}),
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisExperimentIncident.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisExperimentIncident.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async acknowledgeExperimentIncident(
    actorId: string,
    id: string,
    dto?: AcknowledgeApplicationAnalysisExperimentIncidentDto,
  ) {
    const incident =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentIncident.findUnique({
        where: { id },
      });

    if (!incident) {
      throw new NotFoundException(
        'Application-analysis experiment incident not found',
      );
    }

    const updated =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentIncident.update({
        where: { id },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: new Date(),
          acknowledgedBy: actorId,
          details: {
            ...this.asRecord(incident.details),
            acknowledgeNote: dto?.note ?? null,
          },
        },
      });

    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EXPERIMENT_INCIDENT_ACKNOWLEDGE',
      'application_analysis_experiment_incident',
      id,
      {
        capability: incident.capability,
        type: incident.type,
      },
    );

    return updated;
  }

  async listExperimentFeedback(
    query: ApplicationAnalysisExperimentFeedbackQueryDto,
  ) {
    const where = {
      exposureRecord: { isNot: null },
      ...(query.capability
        ? {
            capability: query.capability,
          }
        : {}),
      ...(query.category
        ? {
            category: query.category,
          }
        : {}),
      ...(query.sentiment
        ? {
            sentiment: query.sentiment,
          }
        : {}),
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      // governance: admin-scope — operator surface (admin/application-analysis-workflow: @Roles(OPERATOR) + SYSTEM_CALIBRATION); cross-user aggregation is the purpose
      this.prisma.applicationAnalysisFeedbackRecord.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      // governance: admin-scope — operator surface (admin/application-analysis-workflow: @Roles(OPERATOR) + SYSTEM_CALIBRATION); cross-user aggregation is the purpose
      this.prisma.applicationAnalysisFeedbackRecord.count({ where }),
    ]);

    return createPaginatedResponse(items, total, page, pageSize);
  }

  async updateExperimentConfig(
    actorId: string,
    id: string,
    dto: UpdateApplicationAnalysisExperimentConfigDto,
  ) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id },
      });

    if (!experiment) {
      throw new NotFoundException(
        'Application-analysis experiment version not found',
      );
    }

    const rolloutConfig = this.normalizeExperimentRolloutConfig(
      experiment.capability,
      this.asRecord(experiment.rolloutConfig),
    );
    const monitoringConfig = this.normalizeExperimentMonitoringConfig(
      this.asRecord(experiment.monitoringConfig),
    );
    const nextRolloutConfig: Record<string, unknown> = {
      ...rolloutConfig,
    };

    if (dto.rolloutPercentages?.length) {
      const normalized = [
        ...new Set(
          dto.rolloutPercentages
            .map((value) => Math.max(1, Math.min(100, Math.round(value))))
            .sort((a, b) => a - b),
        ),
      ];
      nextRolloutConfig.stages = normalized;
      nextRolloutConfig.rolloutPercentages = normalized;
      const currentPercentage =
        this.asNumber(nextRolloutConfig.currentPercentage) ?? 0;
      nextRolloutConfig.stageIndex = Math.max(
        -1,
        normalized.findIndex((value) => value === currentPercentage),
      );
    }
    if (dto.minStageHours != null) {
      nextRolloutConfig.minStageHours = dto.minStageHours;
    }
    if (dto.autoPromote != null) {
      nextRolloutConfig.autoPromoteToCanary = dto.autoPromote;
      nextRolloutConfig.autoPromoteStages = dto.autoPromote;
      nextRolloutConfig.autoPromoteToActive = dto.autoPromote;
    }
    if (dto.autoRetire != null) {
      nextRolloutConfig.autoRetireOnFailure = dto.autoRetire;
    }
    if (dto.automationPaused != null) {
      nextRolloutConfig.automationPaused = dto.automationPaused;
    }

    const updated =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.update({
        where: { id },
        data: {
          rolloutConfig: nextRolloutConfig as Prisma.InputJsonValue,
          monitoringConfig: {
            ...monitoringConfig,
            ...(dto.monitoringThresholds ?? {}),
          },
        },
      });

    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EXPERIMENT_CONFIG_UPDATE',
      'application_analysis_experiment',
      id,
      {
        capability: experiment.capability,
        version: experiment.version,
        config: dto,
      },
    );

    await this.syncExperimentFeatureFlags();

    return updated;
  }

  async recordRuntimeExposure(input: {
    userId: string;
    profileId: string;
    locale: string;
    analysisVersion: string;
    experiments: Array<{
      id: string;
      capability: ExperimentCapability;
      version: string;
      status: 'CANARY' | 'ACTIVE';
    }>;
    focusSchools: Array<{
      schoolId: string;
      schoolName: string;
      round?: string;
      predictionSnapshot?: {
        probability?: number;
        probabilityLow?: number;
        probabilityHigh?: number;
      };
      policyContext?: Record<string, unknown>;
      recourseGuidance?: Record<string, unknown>;
      strategyUncertainty?: Record<string, unknown>;
    }>;
    fairnessDisclosure?: Record<string, unknown>;
  }) {
    if (input.experiments.length === 0) {
      return null;
    }

    const exposureId = randomUUID();
    const schoolIds = [
      ...new Set(input.focusSchools.map((school) => school.schoolId)),
    ];

    await Promise.all(
      input.experiments.map((experiment) =>
        this.prisma.applicationAnalysisExposureRecord.create({
          data: {
            exposureId,
            experimentVersionId: experiment.id,
            capability: experiment.capability,
            userId: input.userId,
            profileId: input.profileId,
            schoolIds,
            locale: input.locale,
            exposurePayload: {
              analysisVersion: input.analysisVersion,
              capability: experiment.capability,
              experimentVersion: experiment.version,
              schools: input.focusSchools.map((school) => ({
                schoolId: school.schoolId,
                schoolName: school.schoolName,
                round: school.round,
                predictionSnapshot: school.predictionSnapshot,
                policyContext: school.policyContext,
                hasRecourse: Boolean(school.recourseGuidance),
                hasStrategyUncertainty: Boolean(school.strategyUncertainty),
              })),
              fairnessDisclosure:
                experiment.capability === 'FAIRNESS'
                  ? (input.fairnessDisclosure ?? null)
                  : undefined,
            } as Prisma.InputJsonValue,
          },
        }),
      ),
    );

    return exposureId;
  }

  async submitApplicantFeedback(
    userId: string,
    dto: {
      runId?: string;
      exposureId?: string;
      capability?: ExperimentCapability;
      sentiment: FeedbackSentiment;
      schoolId?: string;
      category?: FeedbackCategory;
      notes?: string;
    },
  ) {
    if (dto.sentiment === 'NOT_HELPFUL' && !dto.category) {
      throw new ConflictException(
        'A negative application-analysis feedback item requires a category.',
      );
    }

    const normalizedCategory =
      dto.sentiment === 'NOT_HELPFUL'
        ? (dto.category ?? 'LOW_ACTIONABILITY')
        : dto.category;

    if (dto.runId) {
      const run = await this.prisma.applicationAnalysisRun.findFirst({
        where: {
          id: dto.runId,
          userId,
        },
        select: {
          id: true,
          analysisVersion: true,
        },
      });

      if (!run) {
        throw new NotFoundException(
          'Application-analysis run not found for this feedback submission.',
        );
      }

      const feedback =
        await this.prisma.applicationAnalysisFeedbackRecord.create({
          data: {
            applicationAnalysisRunId: run.id,
            exposureId: dto.exposureId ?? run.id,
            userId,
            ...(dto.capability
              ? {
                  capability: dto.capability,
                }
              : {}),
            schoolId: dto.schoolId,
            category: normalizedCategory,
            sentiment: dto.sentiment,
            notes: dto.notes,
          },
        });

      await this.syncRunFeedbackMetrics(run.id);

      await this.writeAuditLog(
        userId,
        'APPLICATION_ANALYSIS_RUN_FEEDBACK_SUBMIT',
        'application_analysis_feedback',
        feedback.id,
        {
          runId: run.id,
          analysisVersion: run.analysisVersion,
          sentiment: dto.sentiment,
          category: dto.category,
          schoolId: dto.schoolId,
        },
      );

      return feedback;
    }

    if (!dto.exposureId || !dto.capability) {
      throw new ConflictException(
        'Experiment feedback requires both exposureId and capability.',
      );
    }

    const exposure =
      await this.prisma.applicationAnalysisExposureRecord.findFirst({
        where: {
          exposureId: dto.exposureId,
          capability: dto.capability,
          userId,
        },
        orderBy: [{ generatedAt: 'desc' }, { createdAt: 'desc' }],
      });

    if (!exposure) {
      throw new NotFoundException(
        'Application-analysis exposure record not found for this feedback submission.',
      );
    }

    const feedback = await this.prisma.applicationAnalysisFeedbackRecord.create(
      {
        data: {
          exposureRecordId: exposure.id,
          exposureId: dto.exposureId,
          userId,
          capability: dto.capability,
          schoolId: dto.schoolId,
          category: normalizedCategory,
          sentiment: dto.sentiment,
          notes: dto.notes,
        },
      },
    );

    await this.writeAuditLog(
      userId,
      'APPLICATION_ANALYSIS_FEEDBACK_SUBMIT',
      'application_analysis_feedback',
      feedback.id,
      {
        exposureId: dto.exposureId,
        capability: dto.capability,
        sentiment: dto.sentiment,
        category: dto.category,
      },
    );

    if (dto.sentiment === 'NOT_HELPFUL' && dto.category === 'UNSAFE_RECOURSE') {
      await this.createExperimentIncident({
        experimentVersionId: exposure.experimentVersionId,
        capability: dto.capability,
        type: 'LIVE_HARD_GATE',
        severity: 'CRITICAL',
        title: 'Unsafe recourse feedback detected',
        message:
          'An applicant flagged recourse guidance as unsafe. The capability was auto-retired immediately.',
        details: {
          exposureId: dto.exposureId,
          schoolId: dto.schoolId ?? null,
          feedbackId: feedback.id,
        },
      });
      await this.retireExperiment(
        APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.systemActorId,
        exposure.experimentVersionId,
        'auto-retire after unsafe recourse feedback',
      );
    }

    return feedback;
  }

  private async computeExperimentLiveSignals(experimentVersionId: string) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id: experimentVersionId },
      });
    if (!experiment) {
      throw new NotFoundException(
        'Application-analysis experiment version not found',
      );
    }

    const exposures =
      // governance: admin-scope — operator surface (admin/application-analysis-workflow: @Roles(OPERATOR) + SYSTEM_CALIBRATION); cross-user aggregation is the purpose
      await this.prisma.applicationAnalysisExposureRecord.findMany({
        where: { experimentVersionId },
        orderBy: [{ generatedAt: 'desc' }],
      });
    const feedback =
      // governance: admin-scope — operator surface (admin/application-analysis-workflow: @Roles(OPERATOR) + SYSTEM_CALIBRATION); cross-user aggregation is the purpose
      await this.prisma.applicationAnalysisFeedbackRecord.findMany({
        where: {
          exposureRecord: {
            experimentVersionId,
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      });

    const exposureCount = exposures.length;
    const negativeFeedback = feedback.filter(
      (item) => item.sentiment === 'NOT_HELPFUL',
    );
    const categoryCount = (category: FeedbackCategory) =>
      negativeFeedback.filter((item) => item.category === category).length;
    const negativeFeedbackRate =
      exposureCount > 0 ? negativeFeedback.length / exposureCount : 0;
    const policyMismatchRate =
      exposureCount > 0 ? categoryCount('POLICY_MISMATCH') / exposureCount : 0;
    const misleadingUncertaintyRate =
      exposureCount > 0
        ? categoryCount('MISLEADING_UNCERTAINTY') / exposureCount
        : 0;
    const fairnessConcernRate =
      exposureCount > 0 ? categoryCount('FAIRNESS_CONCERN') / exposureCount : 0;
    const lowActionabilityRate =
      exposureCount > 0
        ? categoryCount('LOW_ACTIONABILITY') / exposureCount
        : 0;
    const unsafeRecourseCount = categoryCount('UNSAFE_RECOURSE');

    const pairKeys = new Set<string>();
    for (const exposure of exposures) {
      for (const schoolId of exposure.schoolIds) {
        pairKeys.add(`${exposure.profileId}:${schoolId}`);
      }
    }

    const profileIds = [...new Set(exposures.map((item) => item.profileId))];
    const schoolIds = [...new Set(exposures.flatMap((item) => item.schoolIds))];

    let outcomeRegressionDelta = 0;
    let outcomeSampleCount = 0;
    if (profileIds.length > 0 && schoolIds.length > 0) {
      // governance: admin-scope — operator surface (admin/application-analysis-workflow: @Roles(OPERATOR) + SYSTEM_CALIBRATION); cross-user aggregation is the purpose
      const predictionResults = await this.prisma.predictionResult.findMany({
        where: {
          profileId: { in: profileIds },
          schoolId: { in: schoolIds },
          authority: 'AUTHORITATIVE',
        },
        select: {
          profileId: true,
          schoolId: true,
          probability: true,
          outcomeLabelRecords: {
            orderBy: [{ createdAt: 'desc' }],
            select: {
              id: true,
              result: true,
              status: true,
              createdAt: true,
              resolvedAt: true,
              isFinal: true,
            },
          },
        },
      });

      const matched = predictionResults.filter((item) =>
        pairKeys.has(`${item.profileId}:${item.schoolId}`),
      );
      const resolved = matched
        .map((item) => ({
          probability: Number(item.probability),
          canonical: resolveCanonicalPredictionOutcome(
            item.outcomeLabelRecords,
          ),
        }))
        .filter((item) => item.canonical.eligibleForCalibration);

      if (resolved.length > 0) {
        outcomeSampleCount = resolved.length;
        const actualAdmitRate =
          resolved.filter(
            (item) => item.canonical.canonicalOutcomeLabel === 'ADMITTED',
          ).length / resolved.length;
        const avgProbability =
          resolved.reduce((sum, item) => sum + item.probability, 0) /
          resolved.length;
        outcomeRegressionDelta = Math.abs(actualAdmitRate - avgProbability);
      }
    }

    return {
      exposureCount,
      feedbackCount: feedback.length,
      negativeFeedbackCount: negativeFeedback.length,
      negativeFeedbackRate,
      unsafeRecourseCount,
      policyMismatchRate,
      misleadingUncertaintyRate,
      fairnessConcernRate,
      lowActionabilityRate,
      outcomeRegressionDelta,
      outcomeSampleCount,
    };
  }

  private evaluateLiveHardGate(
    experiment: {
      capability: ExperimentCapability;
      monitoringConfig: Prisma.JsonValue | null;
    },
    liveSignals: Record<string, number>,
  ) {
    const thresholds = this.normalizeExperimentMonitoringConfig(
      this.asRecord(experiment.monitoringConfig),
    );
    const failures: string[] = [];
    let immediateRetire = false;

    if (
      Number(liveSignals.unsafeRecourseCount ?? 0) >
      Number(thresholds.unsafeRecourseCount)
    ) {
      immediateRetire = true;
      failures.push('Unsafe recourse feedback triggered an immediate retire.');
    }

    if (
      Number(liveSignals.exposureCount ?? 0) >=
        Number(thresholds.policyMismatchMinSamples) &&
      Number(liveSignals.policyMismatchRate ?? 0) >
        Number(thresholds.policyMismatchRate)
    ) {
      failures.push('Policy mismatch live gate failed.');
    }

    if (
      experiment.capability === 'UNCERTAINTY' &&
      Number(liveSignals.exposureCount ?? 0) >=
        Number(thresholds.misleadingUncertaintyMinSamples) &&
      Number(liveSignals.misleadingUncertaintyRate ?? 0) >
        Number(thresholds.misleadingUncertaintyRate)
    ) {
      failures.push('Misleading uncertainty live gate failed.');
    }

    if (
      experiment.capability === 'FAIRNESS' &&
      Number(liveSignals.exposureCount ?? 0) >=
        Number(thresholds.fairnessConcernMinSamples) &&
      Number(liveSignals.fairnessConcernRate ?? 0) >
        Number(thresholds.fairnessConcernRate)
    ) {
      failures.push('Fairness concern live gate failed.');
    }

    if (
      Number(liveSignals.exposureCount ?? 0) >=
        Number(thresholds.negativeFeedbackMinSamples) &&
      Number(liveSignals.negativeFeedbackRate ?? 0) >
        Number(thresholds.negativeFeedbackRate)
    ) {
      failures.push('Overall negative feedback live gate failed.');
    }

    if (
      Number(liveSignals.outcomeSampleCount ?? 0) >=
        Number(thresholds.outcomeRegressionMinSamples) &&
      Number(liveSignals.outcomeRegressionDelta ?? 0) >
        Number(thresholds.outcomeRegressionDelta)
    ) {
      failures.push('Outcome regression live gate failed.');
    }

    return {
      ready: failures.length === 0,
      immediateRetire,
      failures,
      thresholds,
    };
  }

  private async updateExperimentMonitoringState(
    experimentId: string,
    monitoringPatch: Record<string, unknown>,
    rolloutPatch?: Record<string, unknown>,
  ) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id: experimentId },
        select: {
          monitoringConfig: true,
          rolloutConfig: true,
          capability: true,
        },
      });
    if (!experiment) return;

    const monitoringConfig = this.normalizeExperimentMonitoringConfig(
      this.asRecord(experiment.monitoringConfig),
    );
    const rolloutConfig = this.normalizeExperimentRolloutConfig(
      experiment.capability,
      this.asRecord(experiment.rolloutConfig),
    );

    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    await this.prisma.applicationAnalysisExperimentVersion.update({
      where: { id: experimentId },
      data: {
        monitoringConfig: {
          ...monitoringConfig,
          ...monitoringPatch,
        },
        ...(rolloutPatch
          ? {
              rolloutConfig: {
                ...rolloutConfig,
                ...rolloutPatch,
              },
            }
          : {}),
      },
    });
  }

  private async maybeAdvanceCanaryStage(
    actorId: string,
    experiment: Prisma.ApplicationAnalysisExperimentVersionGetPayload<
      Record<string, never>
    >,
    summary: {
      stageAdvanced: string[];
      skipped: Array<{ id: string; reason: string }>;
    },
  ) {
    const capability = experiment.capability;
    const rolloutConfig = this.normalizeExperimentRolloutConfig(
      capability,
      this.asRecord(experiment.rolloutConfig),
    );
    if (this.asBoolean(rolloutConfig.automationPaused) === true) {
      summary.skipped.push({
        id: experiment.id,
        reason: 'Automation is paused for this experiment.',
      });
      return false;
    }
    if ((this.asBoolean(rolloutConfig.autoPromoteStages) ?? true) === false) {
      summary.skipped.push({
        id: experiment.id,
        reason: 'autoPromoteStages is disabled in rolloutConfig.',
      });
      return false;
    }
    if (!this.isPromotionEligible(rolloutConfig)) {
      summary.skipped.push({
        id: experiment.id,
        reason:
          'Current canary stage has not reached its minimum observation window yet.',
      });
      return false;
    }

    const nowIso = new Date().toISOString();
    const currentPercentage =
      this.asNumber(rolloutConfig.currentPercentage) ?? 0;
    const { stages } = this.nextRolloutPercentage(rolloutConfig);
    const currentIndex = Math.max(
      0,
      typeof rolloutConfig.stageIndex === 'number'
        ? rolloutConfig.stageIndex
        : stages.findIndex((value) => value === currentPercentage),
    );

    if (currentPercentage < 100) {
      const nextIndex = Math.min(currentIndex + 1, stages.length - 1);
      const nextPercentage = stages[nextIndex];
      if (nextPercentage === currentPercentage) {
        return false;
      }
      await this.updateExperimentMonitoringState(
        experiment.id,
        {
          latestSweepAt: nowIso,
        },
        {
          currentPercentage: nextPercentage,
          stageIndex: nextIndex,
          lastPromotedAt: nowIso,
          nextEligiblePromotionAt: this.buildNextPromotionAt(rolloutConfig),
        },
      );
      await this.syncExperimentFeatureFlags();
      await this.invalidateApplicantCaches();
      summary.stageAdvanced.push(experiment.id);
      await this.writeAuditLog(
        actorId,
        'APPLICATION_ANALYSIS_EXPERIMENT_STAGE_ADVANCE',
        'application_analysis_experiment',
        experiment.id,
        {
          capability: experiment.capability,
          version: experiment.version,
          percentage: nextPercentage,
        },
      );
      return false;
    }

    if ((this.asBoolean(rolloutConfig.autoPromoteToActive) ?? true) === false) {
      summary.skipped.push({
        id: experiment.id,
        reason: 'autoPromoteToActive is disabled in rolloutConfig.',
      });
      return false;
    }

    await this.activateExperiment(actorId, experiment.id);
    return true;
  }

  private async runSweepMode(
    mode: SweepMode,
    actorId: string = APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.systemActorId,
  ) {
    const ttlSeconds =
      mode === 'HOURLY_ROLLOUT'
        ? APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.hourlyLockTtlSeconds
        : mode === 'NIGHTLY_SHADOW'
          ? APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.nightlyLockTtlSeconds
          : APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.manualLockTtlSeconds;
    const release = await this.acquireAutomationLock(mode, ttlSeconds);
    const lockKey = this.getSweepLockKey(mode);

    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    const run = await this.prisma.applicationAnalysisExperimentSweepRun.create({
      data: {
        mode: mode,
        status: 'RUNNING',
        actorId,
        lockKey,
      },
    });

    if (!release) {
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentSweepRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          failures: [
            'Automation lock not acquired. Another sweep is already running.',
          ],
          finishedAt: new Date(),
        },
      });
      return {
        runId: run.id,
        mode,
        total: 0,
        checked: 0,
        promotedToCanary: [] as string[],
        stageAdvanced: [] as string[],
        activated: [] as string[],
        retired: [] as string[],
        skipped: [
          {
            id: 'lock',
            reason:
              'Automation lock not acquired. Another sweep is already running.',
          },
        ],
        incidents: [] as string[],
      };
    }

    const statuses: ExperimentStatus[] =
      mode === 'HOURLY_ROLLOUT'
        ? ['CANARY', 'ACTIVE']
        : mode === 'NIGHTLY_SHADOW'
          ? ['SHADOW']
          : ['SHADOW', 'CANARY', 'ACTIVE'];

    const experiments =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findMany({
        where: {
          status: { in: statuses },
        },
        orderBy: [{ updatedAt: 'asc' }],
      });

    const summary = {
      runId: run.id,
      mode,
      total: experiments.length,
      checked: 0,
      promotedToCanary: [] as string[],
      stageAdvanced: [] as string[],
      activated: [] as string[],
      retired: [] as string[],
      skipped: [] as Array<{ id: string; reason: string }>,
      incidents: [] as string[],
    };

    try {
      for (const experiment of experiments) {
        summary.checked += 1;
        const capability = experiment.capability;
        const rolloutConfig = this.normalizeExperimentRolloutConfig(
          capability,
          this.asRecord(experiment.rolloutConfig),
        );
        const monitoringConfig = this.normalizeExperimentMonitoringConfig(
          this.asRecord(experiment.monitoringConfig),
        );
        const nowIso = new Date().toISOString();

        if (this.asBoolean(rolloutConfig.automationPaused) === true) {
          summary.skipped.push({
            id: experiment.id,
            reason: 'Automation paused for this experiment.',
          });
          continue;
        }

        try {
          if (experiment.status === 'SHADOW') {
            const evaluation = await this.refreshExperimentEvaluation(
              actorId,
              experiment.id,
              'SHADOW',
            );

            await this.updateExperimentMonitoringState(experiment.id, {
              latestSweepMode: mode,
              latestSweepAt: nowIso,
              latestSweepRunId: run.id,
            });

            if (evaluation.status === 'FAILED') {
              summary.skipped.push({
                id: experiment.id,
                reason:
                  'Shadow evaluation failed; experiment remains in SHADOW.',
              });
              continue;
            }

            const gates = await this.getExperimentGateSummary(experiment.id);
            if (!gates.ready) {
              summary.skipped.push({
                id: experiment.id,
                reason: `Shadow gates blocked promotion: ${gates.failures.join('; ')}`,
              });
              continue;
            }
            if (
              (this.asBoolean(rolloutConfig.autoPromoteToCanary) ?? true) ===
              false
            ) {
              summary.skipped.push({
                id: experiment.id,
                reason: 'autoPromoteToCanary is disabled in rolloutConfig.',
              });
              continue;
            }

            await this.promoteExperimentToCanary(actorId, experiment.id);
            summary.promotedToCanary.push(experiment.id);
            continue;
          }

          const evaluation = await this.refreshExperimentEvaluation(
            actorId,
            experiment.id,
            'CANARY',
          );
          const gates =
            evaluation.status === 'FAILED'
              ? null
              : await this.getExperimentGateSummary(experiment.id);
          const liveSignals = await this.computeExperimentLiveSignals(
            experiment.id,
          );
          const liveGate = this.evaluateLiveHardGate(
            {
              capability,
              monitoringConfig: experiment.monitoringConfig,
            },
            liveSignals,
          );

          await this.updateExperimentMonitoringState(
            experiment.id,
            {
              ...monitoringConfig,
              latestSweepMode: mode,
              latestSweepAt: nowIso,
              latestSweepRunId: run.id,
              latestLiveSignals: liveSignals,
            },
            {
              lastSweepAt: nowIso,
            },
          );

          const shouldRetire =
            (this.asBoolean(rolloutConfig.autoRetireOnFailure) ?? true) &&
            (evaluation.status === 'FAILED' ||
              (gates != null && !gates.ready) ||
              !liveGate.ready ||
              liveGate.immediateRetire);

          if (shouldRetire) {
            const incident = await this.createExperimentIncident({
              experimentVersionId: experiment.id,
              capability,
              type: liveGate.immediateRetire
                ? 'LIVE_HARD_GATE'
                : gates && !gates.ready
                  ? 'GATE_REGRESSION'
                  : evaluation.status === 'FAILED'
                    ? 'EVALUATION_FAILURE'
                    : 'LIVE_HARD_GATE',
              severity: liveGate.immediateRetire ? 'CRITICAL' : 'HIGH',
              title: `Auto-retired ${experiment.capability.toLowerCase()} capability`,
              message: [
                evaluation.status === 'FAILED' ? 'Evaluation failed.' : null,
                gates && !gates.ready
                  ? `Gate regression: ${gates.failures.join('; ')}`
                  : null,
                ...liveGate.failures,
              ]
                .filter(Boolean)
                .join(' '),
              details: {
                liveSignals,
                gateFailures: gates?.failures ?? [],
                latestEvaluationStatus: evaluation.status,
                sweepMode: mode,
              },
            });
            summary.incidents.push(incident.id);
            await this.retireExperiment(
              actorId,
              experiment.id,
              incident.message,
            );
            summary.retired.push(experiment.id);
            continue;
          }

          if (experiment.status === 'ACTIVE') {
            summary.skipped.push({
              id: experiment.id,
              reason:
                'ACTIVE experiment remains healthy after automated sweep.',
            });
            continue;
          }

          if (!gates?.ready) {
            summary.skipped.push({
              id: experiment.id,
              reason: 'CANARY gates are not yet ready for rollout progression.',
            });
            continue;
          }

          const activated = await this.maybeAdvanceCanaryStage(
            actorId,
            experiment,
            summary,
          );
          if (activated) {
            summary.activated.push(experiment.id);
          }
        } catch (error) {
          const message = String(
            error instanceof Error ? error.message : error,
          );
          this.logger.warn(
            `Automated experiment sweep skipped ${experiment.id}: ${message}`,
          );
          summary.skipped.push({
            id: experiment.id,
            reason: message,
          });
        }
      }

      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentSweepRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          summary: summary,
          failures: [],
          finishedAt: new Date(),
        },
      });

      return summary;
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error);
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentSweepRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          failures: [message],
          finishedAt: new Date(),
        },
      });
      throw error;
    } finally {
      await release();
    }
  }

  async runHourlyExperimentMonitor(
    actorId: string = APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.systemActorId,
  ) {
    return this.runSweepMode('HOURLY_ROLLOUT', actorId);
  }

  async runNightlyShadowRefresh(
    actorId: string = APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.systemActorId,
  ) {
    return this.runSweepMode('NIGHTLY_SHADOW', actorId);
  }

  async runAutomatedExperimentSweep(
    actorId: string = APPLICATION_ANALYSIS_EXPERIMENT_AUTOMATION.systemActorId,
  ) {
    return this.runSweepMode('MANUAL_FULL', actorId);
  }

  async getExperimentGateSummary(id: string) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id },
      });

    if (!experiment) {
      throw new NotFoundException(
        'Application-analysis experiment version not found',
      );
    }

    const capability = experiment.capability;
    const thresholds = this.normalizeExperimentThresholds(
      capability,
      this.asRecord(experiment.gateConfig),
    ) as Record<string, number | boolean>;

    const latestEvaluation =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentEvaluationRun.findFirst({
        where: {
          experimentVersionId: id,
          status: 'COMPLETED',
        },
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          experimentVersion: {
            select: {
              id: true,
              capability: true,
              version: true,
              status: true,
              methodVersion: true,
            },
          },
        },
      });

    const metrics = this.asRecord(latestEvaluation?.metrics);
    const failures: string[] = [];

    if (!latestEvaluation) {
      failures.push(
        'A completed experiment evaluation is required before promotion.',
      );
    }

    if (capability === 'RECOURSE') {
      if (
        this.asNumber(metrics.unsafeSuggestionRate) == null ||
        Number(metrics.unsafeSuggestionRate) >
          Number(thresholds['unsafeSuggestionRate'])
      ) {
        failures.push('Unsafe suggestion gate failed.');
      }
      if (
        this.asNumber(metrics.immutableFeatureViolation) == null ||
        Number(metrics.immutableFeatureViolation) >
          Number(thresholds['immutableFeatureViolation'])
      ) {
        failures.push('Immutable feature violation gate failed.');
      }
      if (
        this.asNumber(metrics.actionabilityMean) == null ||
        Number(metrics.actionabilityMean) <
          Number(thresholds['actionabilityMean'])
      ) {
        failures.push('Recourse actionability gate failed.');
      }
      if (
        this.asNumber(metrics.schoolPolicyConsistency) == null ||
        Number(metrics.schoolPolicyConsistency) <
          Number(thresholds['schoolPolicyConsistency'])
      ) {
        failures.push('School policy consistency gate failed.');
      }
    } else if (capability === 'UNCERTAINTY') {
      if (
        this.asNumber(metrics.empiricalCoverageOverall) == null ||
        Number(metrics.empiricalCoverageOverall) <
          Number(thresholds['empiricalCoverageOverall'])
      ) {
        failures.push('Overall uncertainty coverage gate failed.');
      }
      if (
        this.asNumber(metrics.empiricalCoverageKeySubgroup) == null ||
        Number(metrics.empiricalCoverageKeySubgroup) <
          Number(thresholds['empiricalCoverageKeySubgroup'])
      ) {
        failures.push('Key subgroup uncertainty coverage gate failed.');
      }
      if (
        this.asNumber(metrics.medianIntervalWidthDelta) == null ||
        Number(metrics.medianIntervalWidthDelta) >
          Number(thresholds['medianIntervalWidthDelta'])
      ) {
        failures.push('Interval width drift gate failed.');
      }
    } else {
      if (
        this.asNumber(metrics.fabricatedInsightCount) == null ||
        Number(metrics.fabricatedInsightCount) >
          Number(thresholds['fabricatedInsightCount'])
      ) {
        failures.push('Fabricated insight gate failed.');
      }
      if (
        this.asNumber(metrics.unknownPolicyRateDelta) == null ||
        Number(metrics.unknownPolicyRateDelta) >
          Number(thresholds['unknownPolicyRateDelta'])
      ) {
        failures.push('Unknown policy subgroup delta gate failed.');
      }
      if (
        this.asNumber(metrics.actionabilityMeanDelta) == null ||
        Number(metrics.actionabilityMeanDelta) >
          Number(thresholds['actionabilityMeanDelta'])
      ) {
        failures.push('Fairness actionability delta gate failed.');
      }
      if (
        this.asNumber(metrics.blockedSubgroupCount) == null ||
        Number(metrics.blockedSubgroupCount) >
          Number(thresholds['blockedSubgroupCount'])
      ) {
        failures.push('Blocked subgroup gate failed.');
      }
      if (metrics.disclosurePass !== thresholds['disclosurePass']) {
        failures.push('Fairness disclosure gate failed.');
      }
    }

    if (metrics.contractParityPass !== thresholds['contractParityPass']) {
      failures.push('Contract parity gate failed.');
    }
    if (metrics.webRenderPass !== thresholds['webRenderPass']) {
      failures.push('Web render gate failed.');
    }
    if (metrics.mobileRenderPass !== thresholds['mobileRenderPass']) {
      failures.push('Mobile render gate failed.');
    }
    if (
      this.asNumber(metrics.journeyPassRate) == null ||
      Number(metrics.journeyPassRate) < Number(thresholds['journeyPassRate'])
    ) {
      failures.push('Journey pass gate failed.');
    }

    return {
      ready: failures.length === 0,
      thresholds,
      latestEvaluation,
      metrics,
      failures,
    };
  }

  async activateExperiment(actorId: string, id: string) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id },
      });

    if (!experiment) {
      throw new NotFoundException(
        'Application-analysis experiment version not found',
      );
    }
    if (experiment.status !== 'CANARY') {
      throw new ConflictException(
        'Only CANARY experiment versions can become ACTIVE',
      );
    }

    const gateSummary = await this.getExperimentGateSummary(id);
    if (!gateSummary.ready) {
      throw new ConflictException(
        `Experiment activation blocked: ${gateSummary.failures.join('; ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.applicationAnalysisExperimentVersion.updateMany({
        where: { capability: experiment.capability, status: 'ACTIVE' },
        data: {
          status: 'RETIRED',
          retiredAt: new Date(),
        },
      });
      await tx.applicationAnalysisExperimentVersion.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
        },
      });
    });

    await this.syncExperimentFeatureFlags();
    await this.invalidateApplicantCaches();
    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EXPERIMENT_ACTIVATE',
      'application_analysis_experiment',
      id,
      {
        capability: experiment.capability,
        version: experiment.version,
      },
    );

    return {
      success: true,
      experimentVersionId: id,
      activatedBy: actorId,
    };
  }

  async retireExperiment(actorId: string, id: string, reason?: string) {
    const experiment =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.findUnique({
        where: { id },
      });

    if (!experiment) {
      throw new NotFoundException(
        'Application-analysis experiment version not found',
      );
    }

    const updated =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentVersion.update({
        where: { id },
        data: {
          status: 'RETIRED',
          retiredAt: new Date(),
          notes: this.appendNote(
            experiment.notes,
            `[retired:${new Date().toISOString()} by ${actorId}]${
              reason ? ` ${reason}` : ''
            }`,
          ),
        },
      });

    await this.syncExperimentFeatureFlags();
    await this.invalidateApplicantCaches();
    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_EXPERIMENT_RETIRE',
      'application_analysis_experiment',
      id,
      {
        capability: experiment.capability,
        version: experiment.version,
        reason,
      },
    );

    return updated;
  }

  async getPolicyGateSummary(id: string) {
    const policy =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisPolicyVersion.findUnique({
        where: { id },
      });

    if (!policy) {
      throw new NotFoundException(
        'Application-analysis policy version not found',
      );
    }

    const thresholds = this.normalizeThresholds(
      (policy.thresholds as Record<string, unknown> | null) ?? null,
    );

    const [latestShadow, latestGoldSet] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisEvaluationRun.findFirst({
        where: {
          policyVersionId: id,
          mode: 'SHADOW',
          status: 'COMPLETED',
        },
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          policyVersion: {
            select: {
              id: true,
              policyKey: true,
              version: true,
              status: true,
              analysisVersion: true,
            },
          },
        },
      }),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisEvaluationRun.findFirst({
        where: {
          policyVersionId: id,
          mode: 'GOLD_SET',
          status: 'COMPLETED',
        },
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          policyVersion: {
            select: {
              id: true,
              policyKey: true,
              version: true,
              status: true,
              analysisVersion: true,
            },
          },
        },
      }),
    ]);

    const latestEvaluation = latestShadow ?? latestGoldSet;
    const metrics =
      (latestEvaluation?.metrics as Record<string, number | boolean> | null) ??
      {};

    const failures: string[] = this.asStringArray(latestEvaluation?.failures);
    if (!latestShadow) {
      failures.push(
        'A completed shadow evaluation is required before activation.',
      );
    }

    const numericGate = (
      key: keyof typeof APPLICATION_ANALYSIS_DEFAULT_THRESHOLDS,
    ) => (typeof metrics[key] === 'number' ? Number(metrics[key]) : null);

    const policyCorrectnessRate = numericGate('policyCorrectnessRate');
    if (
      policyCorrectnessRate == null ||
      policyCorrectnessRate < Number(thresholds.policyCorrectnessRate)
    ) {
      failures.push('Policy correctness gate failed.');
    }

    const weakStateCorrectnessRate = numericGate('weakStateCorrectnessRate');
    if (
      weakStateCorrectnessRate == null ||
      weakStateCorrectnessRate < Number(thresholds.weakStateCorrectnessRate)
    ) {
      failures.push('Weak-state correctness gate failed.');
    }

    const fabricatedInsightCount = numericGate('fabricatedInsightCount');
    if (
      fabricatedInsightCount == null ||
      fabricatedInsightCount > Number(thresholds.fabricatedInsightCount)
    ) {
      failures.push('Fabricated insight gate failed.');
    }

    const actionabilityMean = numericGate('actionabilityMean');
    if (
      actionabilityMean == null ||
      actionabilityMean < Number(thresholds.actionabilityMean)
    ) {
      failures.push('Actionability gate failed.');
    }

    if (metrics.contractParityPass !== true) {
      failures.push('Contract parity gate failed.');
    }
    if (metrics.webRenderPass !== true) {
      failures.push('Web render gate failed.');
    }
    if (metrics.mobileRenderPass !== true) {
      failures.push('Mobile render gate failed.');
    }
    const journeyPassRate = numericGate('journeyPassRate');
    if (
      journeyPassRate == null ||
      journeyPassRate < Number(thresholds.journeyPassRate)
    ) {
      failures.push('Journey pass gate failed.');
    }

    const maxUnknownPolicyRate =
      typeof thresholds.maxUnknownPolicyRate === 'number'
        ? Number(thresholds.maxUnknownPolicyRate)
        : null;
    const measuredUnknownPolicyRate =
      typeof metrics.unknownPolicyRate === 'number'
        ? Number(metrics.unknownPolicyRate)
        : null;
    if (
      maxUnknownPolicyRate != null &&
      measuredUnknownPolicyRate != null &&
      measuredUnknownPolicyRate > maxUnknownPolicyRate
    ) {
      failures.push('Unknown policy rate gate failed.');
    }

    return {
      ready: this.dedupeStrings(failures).length === 0,
      thresholds,
      latestEvaluation,
      metrics,
      failures: this.dedupeStrings(failures),
    };
  }

  async activatePolicy(actorId: string, id: string) {
    const policy =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisPolicyVersion.findUnique({
        where: { id },
      });

    if (!policy) {
      throw new NotFoundException(
        'Application-analysis policy version not found',
      );
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

    // Bind the served label to a deployed engine. The gate above only proves the
    // analysisVersion has a passing gold replay — but a replay can be generated
    // under ANY label by the same engine, so without this an admin could activate
    // a policy whose analysisVersion has no deployed engine, mislabelling every
    // served meta.analysisVersion (the prediction v5-ml-primary class of bug, see
    // ADR-0022). DEPLOYED_ANALYSIS_VERSIONS must stay in sync with the v1/v2
    // services' DEFAULT_ANALYSIS_VERSION.
    const DEPLOYED_ANALYSIS_VERSIONS = [
      'application-analysis-v1',
      'application-analysis-v2',
    ];
    if (!DEPLOYED_ANALYSIS_VERSIONS.includes(policy.analysisVersion)) {
      throw new ConflictException(
        `Policy promotion blocked: analysisVersion "${policy.analysisVersion}" has no deployed engine (expected one of ${DEPLOYED_ANALYSIS_VERSIONS.join(', ')})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.applicationAnalysisPolicyVersion.updateMany({
        where: { policyKey: policy.policyKey, status: 'ACTIVE' },
        data: {
          status: 'RETIRED',
          retiredAt: new Date(),
        },
      });
      await tx.applicationAnalysisPolicyVersion.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          activatedBy: actorId,
        },
      });
    });

    await this.invalidateApplicantCaches();
    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_POLICY_ACTIVATE',
      'application_analysis_policy',
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
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisPolicyVersion.findFirst({
        where: { policyKey, status: 'ACTIVE' },
        orderBy: [{ activatedAt: 'desc' }, { updatedAt: 'desc' }],
      }),
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisPolicyVersion.findFirst({
        where: { policyKey, status: 'RETIRED' },
        orderBy: [{ retiredAt: 'desc' }, { activatedAt: 'desc' }],
      }),
    ]);

    if (!currentActive) {
      throw new NotFoundException(
        'No active application-analysis policy to rollback',
      );
    }
    if (!previousRetired) {
      throw new NotFoundException(
        'No retired application-analysis policy available for rollback',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.applicationAnalysisPolicyVersion.update({
        where: { id: currentActive.id },
        data: {
          status: 'RETIRED',
          retiredAt: new Date(),
          notes: this.appendNote(
            currentActive.notes,
            `[rollback-retired:${new Date().toISOString()} by ${actorId}]`,
          ),
        },
      });
      await tx.applicationAnalysisPolicyVersion.update({
        where: { id: previousRetired.id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          activatedBy: actorId,
          retiredAt: null,
          notes: this.appendNote(
            previousRetired.notes,
            `[rollback-restore:${new Date().toISOString()} by ${actorId}]`,
          ),
        },
      });
    });

    await this.invalidateApplicantCaches();
    await this.writeAuditLog(
      actorId,
      'APPLICATION_ANALYSIS_POLICY_ROLLBACK',
      'application_analysis_policy',
      previousRetired.id,
      {
        policyKey,
        restoredVersion: previousRetired.version,
        retiredVersion: currentActive.version,
      },
    );

    return {
      success: true,
      restoredPolicyVersionId: previousRetired.id,
      retiredPolicyVersionId: currentActive.id,
    };
  }

  async recoursePreview(dto: ApplicationAnalysisRecoursePreviewDto) {
    const [policy, experiment] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisPolicyVersion.findUnique({
        where: { id: dto.policyVersionId },
      }),
      dto.experimentVersionId
        ? // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
          this.prisma.applicationAnalysisExperimentVersion.findUnique({
            where: { id: dto.experimentVersionId },
          })
        : // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
          this.prisma.applicationAnalysisExperimentVersion.findFirst({
            where: {
              capability: 'RECOURSE',
              status: { in: ['ACTIVE', 'CANARY'] },
            },
            orderBy: [{ updatedAt: 'desc' }],
          }),
    ]);
    if (!policy) {
      throw new NotFoundException(
        'Application-analysis policy version not found',
      );
    }

    return {
      goal:
        dto.schoolId != null
          ? `Improve school-specific readiness for ${dto.schoolId}`
          : 'Improve application-analysis readiness for the next strategy run',
      recommendedChanges: [
        {
          action:
            'Lock the intended application round before re-running strategy.',
          rationale:
            'Round context changes both the prediction snapshot and the school-level strategic interpretation.',
          effort: 'low' as const,
          timeHorizon: 'now' as const,
          blockedBy: [],
        },
        {
          action:
            'Add one verifiable, major-aligned outcome that can be surfaced in school-level guidance.',
          rationale:
            'Recourse should improve the underlying evidence package, not just the wording of the application.',
          effort: 'medium' as const,
          timeHorizon: 'next90Days' as const,
          blockedBy: [],
        },
        {
          action:
            'Clarify whether testing will be submitted for schools that are not test-blind.',
          rationale:
            'Testing strategy is a school-specific lever and should be settled before the next analysis run.',
          effort: 'low' as const,
          timeHorizon: 'beforeSubmission' as const,
          blockedBy: ['Requires school-specific testing policy context'],
        },
      ],
      estimatedDirection: 'upside' as const,
      constraints: [
        'Do not modify immutable traits or fabricate extracurricular depth.',
        'Recommendations are school-aware strategy suggestions, not admissions guarantees.',
      ],
      whyNotGuaranteed:
        'This preview is advisory only and does not replace school-specific prediction uncertainty or institutional review.',
      policyVersion: {
        id: policy.id,
        policyKey: policy.policyKey,
        version: policy.version,
        analysisVersion: policy.analysisVersion,
      },
      experimentVersion: experiment
        ? {
            id: experiment.id,
            capability: experiment.capability,
            version: experiment.version,
            status: experiment.status,
            methodVersion: experiment.methodVersion,
          }
        : undefined,
    };
  }

  async uncertaintyPreview(dto: ApplicationAnalysisUncertaintyPreviewDto) {
    const [policy, experiment] = await Promise.all([
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      this.prisma.applicationAnalysisPolicyVersion.findUnique({
        where: { id: dto.policyVersionId },
      }),
      dto.experimentVersionId
        ? // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
          this.prisma.applicationAnalysisExperimentVersion.findUnique({
            where: { id: dto.experimentVersionId },
          })
        : // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
          this.prisma.applicationAnalysisExperimentVersion.findFirst({
            where: {
              capability: 'UNCERTAINTY',
              status: { in: ['ACTIVE', 'CANARY'] },
            },
            orderBy: [{ updatedAt: 'desc' }],
          }),
    ]);
    if (!policy) {
      throw new NotFoundException(
        'Application-analysis policy version not found',
      );
    }

    const latestEvaluation =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentEvaluationRun.findFirst({
        where: {
          experimentVersionId: experiment?.id ?? '',
          status: 'COMPLETED',
        },
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
      });

    const metrics =
      (latestEvaluation?.metrics as Record<string, number | boolean> | null) ??
      {};
    const coverage =
      typeof metrics.empiricalCoverageOverall === 'number'
        ? Number(metrics.empiricalCoverageOverall)
        : null;
    const widthDelta =
      typeof metrics.medianIntervalWidthDelta === 'number'
        ? Number(metrics.medianIntervalWidthDelta)
        : null;
    const intervalLabel =
      widthDelta == null
        ? ('wide' as const)
        : widthDelta <= 0.09
          ? ('tight' as const)
          : widthDelta <= 0.13
            ? ('balanced' as const)
            : ('wide' as const);

    return {
      probabilityLow:
        coverage != null && widthDelta != null
          ? Math.max(0.12, coverage - 0.22 - widthDelta / 2)
          : undefined,
      probabilityHigh:
        coverage != null && widthDelta != null
          ? Math.min(0.92, coverage + 0.08 + widthDelta / 2)
          : undefined,
      intervalLabel,
      reasons:
        coverage != null && widthDelta != null
          ? [
              'Show strategy uncertainty alongside prediction probability, never instead of it.',
              'Wider intervals usually mean school-policy coverage or subgroup evidence is still thinner than desired.',
            ]
          : [
              'Uncertainty preview is blocked until replay-backed empirical coverage metrics are available.',
              'Keep uncertainty intervals hidden from rollout decisions until dedicated coverage evaluation is instrumented.',
            ],
      policyVersion: {
        id: policy.id,
        policyKey: policy.policyKey,
        version: policy.version,
      },
      experimentVersion: experiment
        ? {
            id: experiment.id,
            capability: experiment.capability,
            version: experiment.version,
            status: experiment.status,
            methodVersion: experiment.methodVersion,
          }
        : undefined,
    };
  }

  async fairnessReport(query: ApplicationAnalysisFairnessReportQueryDto) {
    const [policy, experiment] = await Promise.all([
      query.policyVersionId
        ? // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
          this.prisma.applicationAnalysisPolicyVersion.findUnique({
            where: { id: query.policyVersionId },
          })
        : this.getActivePolicyVersion(),
      query.experimentVersionId
        ? // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
          this.prisma.applicationAnalysisExperimentVersion.findUnique({
            where: { id: query.experimentVersionId },
          })
        : // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
          this.prisma.applicationAnalysisExperimentVersion.findFirst({
            where: {
              capability: 'FAIRNESS',
              status: { in: ['ACTIVE', 'CANARY'] },
            },
            orderBy: [{ updatedAt: 'desc' }],
          }),
    ]);

    if (!policy) {
      throw new NotFoundException(
        'Application-analysis policy version not found',
      );
    }

    const latestEvaluation =
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      await this.prisma.applicationAnalysisExperimentEvaluationRun.findFirst({
        where: { experimentVersionId: experiment?.id ?? '' },
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
      });
    const metrics =
      (latestEvaluation?.metrics as Record<string, number | boolean> | null) ??
      {};
    const blockedSubgroupCount =
      typeof metrics.blockedSubgroupCount === 'number'
        ? Number(metrics.blockedSubgroupCount)
        : null;
    const disclosurePass =
      typeof metrics.disclosurePass === 'boolean'
        ? metrics.disclosurePass
        : null;

    return {
      status:
        blockedSubgroupCount == null || disclosurePass == null
          ? 'limited'
          : blockedSubgroupCount > 0
            ? 'blocked'
            : disclosurePass
              ? 'clear'
              : 'limited',
      notes:
        blockedSubgroupCount == null || disclosurePass == null
          ? [
              'Fairness disclosure is limited because subgroup-delta metrics are not instrumented yet.',
              'Keep this capability off for public rollout until replay-backed subgroup evaluation is available.',
            ]
          : blockedSubgroupCount > 0
            ? [
                'One or more key subgroups still fail the current fairness disclosure gate.',
                'Keep this capability off for public rollout until subgroup evidence and policy coverage improve.',
              ]
            : disclosurePass
              ? [
                  'Current fairness disclosure checks are passing for the tracked rollout cohorts.',
                  'Continue monitoring subgroup deltas during canary and active rollout.',
                ]
              : [
                  'Fairness disclosure is still limited because evaluation coverage is incomplete.',
                ],
      appliesTo: [
        'international',
        'need-aid',
        'first-gen',
        'uc-test-blind',
        'round-aware',
      ],
      metrics,
      policyVersion: {
        id: policy.id,
        policyKey: policy.policyKey,
        version: policy.version,
      },
      experimentVersion: experiment
        ? {
            id: experiment.id,
            capability: experiment.capability,
            version: experiment.version,
            status: experiment.status,
            methodVersion: experiment.methodVersion,
          }
        : undefined,
    };
  }
}
