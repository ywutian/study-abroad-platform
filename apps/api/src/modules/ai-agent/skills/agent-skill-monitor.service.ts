import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AgentSkillSignalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentType } from '../types';
import { isRecord } from '../core/agent-run-state';
import { AgentSkillService } from './agent-skill.service';
import {
  AlertChannelService,
  AlertSeverity,
} from '../infrastructure/alerting/alert-channel.service';

const SAFETY_CODES = ['PERMISSION', 'PRIVACY', 'APPROVAL_BYPASS', 'SECRET'];
export function isSkillSafetyFailure(code: unknown): boolean {
  return (
    typeof code === 'string' && SAFETY_CODES.some((part) => code.includes(part))
  );
}

@Injectable()
export class AgentSkillMonitorService {
  private readonly logger = new Logger(AgentSkillMonitorService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly skills: AgentSkillService,
    private readonly alerts: AlertChannelService,
  ) {}

  // Separate from generation/evaluation so a slow model cannot delay recovery.
  @Cron('* * * * *', { name: 'agent-skill-monitor' })
  async scheduledMonitor(): Promise<number> {
    return this.checkSafely(undefined, true);
  }

  async onSafetyTrace(agentType: string, versionId: string): Promise<void> {
    await this.checkSafely({ agentType, versionId });
  }

  private async checkSafely(
    target?: { agentType: string; versionId: string },
    failJob = false,
  ): Promise<number> {
    try {
      return await this.monitorAndRollback(target);
    } catch {
      this.logger.warn('SKILL_MONITOR_FAILED');
      // Persisted traces remain discoverable by the next HTTP scheduler tick.
      try {
        await this.alerts.send({
          alertId: 'ai-agent-skill-monitor-failed',
          title: 'Skill safety monitor failed',
          message: 'A persisted Skill safety check requires retry.',
          severity: AlertSeverity.CRITICAL,
          source: AgentSkillMonitorService.name,
        });
      } catch {
        this.logger.warn('SKILL_MONITOR_ALERT_FAILED');
      }
      // Mark the scheduled job failed so HTTP Cron records/retries the failure.
      // The in-request hook must not turn a durably completed Run into a failure.
      if (failJob)
        throw new ServiceUnavailableException('SKILL_MONITOR_FAILED');
      return 0;
    }
  }

  private async findSafetyFailure(deployment: {
    agentType: string;
    activeVersionId: string;
    activatedAt: Date;
  }) {
    // Unlike statistical sampling, hard safety checks must inspect the entire
    // active deployment interval, including failures beyond the first 500 rows.
    return this.prisma.agentEvaluationTrace.findFirst({
      where: {
        agentType: deployment.agentType,
        skillVersionId: deployment.activeVersionId,
        createdAt: { gte: deployment.activatedAt },
        OR: SAFETY_CODES.map((code) => ({
          payload: { path: ['failure', 'errorCode'], string_contains: code },
        })),
      },
      select: { id: true },
    });
  }

  // governance: batch-operation — compares aggregate production version metrics.
  async monitorAndRollback(target?: {
    agentType: string;
    versionId: string;
  }): Promise<number> {
    if (!this.skills.isEvolutionEnabled()) return 0;
    const deployments = await this.prisma.agentSkillDeployment.findMany({
      where: {
        previousVersionId: { not: null },
        status: 'ACTIVE',
        ...(target
          ? { agentType: target.agentType, activeVersionId: target.versionId }
          : {}),
      },
    });
    let rolledBack = 0;
    for (const deployment of deployments) {
      const safetyFailure = await this.findSafetyFailure(deployment);
      const current = safetyFailure
        ? this.aggregate([])
        : await this.aggregateWindow(
            deployment.agentType,
            deployment.activeVersionId,
            deployment.activatedAt,
          );
      if (current.count === 0 && !safetyFailure) continue;
      const immediateSafetyFailure = Boolean(safetyFailure);
      const previous = safetyFailure
        ? this.aggregate([])
        : await this.aggregatePreviousWindow(
            deployment.agentType,
            deployment.previousVersionId!,
            deployment.activatedAt,
            current.count,
          );
      const statisticalRegression =
        current.count >= 10 &&
        previous.count >= 10 &&
        (current.successRate < previous.successRate - 0.02 ||
          current.failureRate > previous.failureRate * 1.1 ||
          (previous.averageTokens > 0 &&
            current.averageTokens > previous.averageTokens * 1.1) ||
          (previous.p95LatencyMs > 0 &&
            current.p95LatencyMs > previous.p95LatencyMs * 1.1));
      if (!immediateSafetyFailure && !statisticalRegression) continue;

      const reason = immediateSafetyFailure
        ? 'Automatic rollback: production safety invariant failed'
        : 'Automatic rollback: production metrics regressed beyond protected thresholds';
      const rolled = await this.skills
        .rollback(deployment.agentType as AgentType, reason, 'AUTO_MONITOR', {
          versionId: deployment.activeVersionId,
          activatedAt: deployment.activatedAt,
        })
        .catch((error: unknown) => {
          // Another monitor/publisher may win the serializable transaction.
          // Re-read on the next tick rather than rolling back a different version.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2034'
          )
            return null;
          throw error;
        });
      if (!rolled) continue;
      await this.pauseAfterRepeatedRollback(deployment.agentType);
      rolledBack += 1;
    }
    return rolledBack;
  }

  // governance: aggregate-only — version metrics have no small-sample publication surface.
  private async aggregateWindow(
    agentType: string,
    versionId: string,
    since: Date,
  ) {
    const traces = await this.prisma.agentEvaluationTrace.findMany({
      where: {
        agentType,
        skillVersionId: versionId,
        createdAt: { gte: since },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { outcome: true, payload: true },
      take: 500,
    });
    return this.aggregate(traces);
  }

  // governance: aggregate-only — version metrics have no small-sample publication surface.
  private async aggregatePreviousWindow(
    agentType: string,
    versionId: string,
    before: Date,
    take: number,
  ) {
    const traces = await this.prisma.agentEvaluationTrace.findMany({
      where: {
        agentType,
        skillVersionId: versionId,
        createdAt: { lt: before },
      },
      orderBy: { createdAt: 'desc' },
      select: { outcome: true, payload: true },
      take: Math.min(500, Math.max(10, take)),
    });
    return this.aggregate(traces);
  }

  private aggregate(
    traces: Array<{ outcome: string; payload: Prisma.JsonValue }>,
  ) {
    const tokens: number[] = [];
    const latencies: number[] = [];
    let failures = 0;
    let safetyFailures = 0;
    for (const trace of traces) {
      if (trace.outcome !== 'COMPLETED') failures += 1;
      if (!isRecord(trace.payload)) continue;
      const usage = isRecord(trace.payload.usage)
        ? trace.payload.usage
        : undefined;
      if (typeof usage?.estimatedTokens === 'number')
        tokens.push(usage.estimatedTokens);
      if (typeof trace.payload.elapsedMs === 'number')
        latencies.push(trace.payload.elapsedMs);
      const failure = isRecord(trace.payload.failure)
        ? trace.payload.failure
        : undefined;
      if (
        typeof failure?.errorCode === 'string' &&
        isSkillSafetyFailure(failure.errorCode)
      ) {
        safetyFailures += 1;
      }
    }
    latencies.sort((a, b) => a - b);
    const count = traces.length;
    return {
      count,
      successRate: count === 0 ? 1 : (count - failures) / count,
      failureRate: count === 0 ? 0 : failures / count,
      averageTokens:
        tokens.reduce((sum, value) => sum + value, 0) /
        Math.max(1, tokens.length),
      p95LatencyMs:
        latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? 0,
      safetyFailures,
    };
  }

  // governance: batch-operation — pauses global evolution signals after repeated rollback.
  private async pauseAfterRepeatedRollback(agentType: string): Promise<void> {
    const rollbacks = await this.prisma.agentSkillAudit.count({
      where: {
        agentType,
        action: 'ROLLED_BACK',
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
    });
    if (rollbacks < 2) return;
    await this.prisma.agentSkillSignal.updateMany({
      where: { agentType, status: AgentSkillSignalStatus.PENDING },
      data: { status: AgentSkillSignalStatus.PAUSED },
    });
  }
}
