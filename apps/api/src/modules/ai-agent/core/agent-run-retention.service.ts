import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentApprovalStatus, AgentRunStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { MetricsService } from '../infrastructure/observability/metrics.service';

@Injectable()
export class AgentRunRetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async expireIfNeeded(userId: string, runId: string): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.findFirst({
        where: {
          id: runId,
          userId,
          status: {
            in: [AgentRunStatus.RUNNING, AgentRunStatus.WAITING_APPROVAL],
          },
          expiresAt: { lte: now },
        },
      });
      if (!run) return false;
      if (run.status === AgentRunStatus.WAITING_APPROVAL) {
        await tx.agentApproval.updateMany({
          where: {
            runId,
            status: {
              in: [AgentApprovalStatus.PENDING, AgentApprovalStatus.APPROVED],
            },
          },
          data: { status: AgentApprovalStatus.EXPIRED, decidedAt: now },
        });
      }
      const updated = await tx.agentRun.updateMany({
        where: {
          id: runId,
          userId,
          status: run.status,
          expiresAt: { lte: now },
        },
        data: {
          status: AgentRunStatus.EXPIRED,
          errorCode:
            run.status === AgentRunStatus.WAITING_APPROVAL
              ? 'APPROVAL_EXPIRED'
              : 'RUN_EXPIRED',
          errorMessage:
            run.status === AgentRunStatus.WAITING_APPROVAL
              ? 'Approval expired before execution'
              : 'Agent run expired before reaching a terminal state',
          completedAt: now,
          version: { increment: 1 },
        },
      });
      return updated.count === 1;
    });
    if (expired) this.metrics?.recordHarnessEvent('run_expired');
  }

  async expireStaleRuns(): Promise<void> {
    const candidates = await this.prisma.agentRun.findMany({
      where: {
        status: {
          in: [AgentRunStatus.RUNNING, AgentRunStatus.WAITING_APPROVAL],
        },
        expiresAt: { lte: new Date() },
      },
      select: { id: true, userId: true },
      take: 100,
    });
    for (const candidate of candidates) {
      await this.expireIfNeeded(candidate.userId, candidate.id);
    }
  }

  async cleanupRetainedData(): Promise<void> {
    const now = Date.now();
    const traceCutoff = new Date(
      now - this.retentionDays('AI_AGENT_TRACE_RETENTION_DAYS', 30) * 86400000,
    );
    const runCutoff = new Date(
      now - this.retentionDays('AI_AGENT_RUN_RETENTION_DAYS', 90) * 86400000,
    );

    // governance: system-scope — retention cleanup spans redacted platform traces and never reads user content
    const traceIds = await this.prisma.agentEvaluationTrace.findMany({
      where: { createdAt: { lt: traceCutoff } },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: { id: true },
    });
    if (traceIds.length > 0) {
      // governance: system-scope — IDs come only from the bounded retention query above
      const deleted = await this.prisma.agentEvaluationTrace.deleteMany({
        where: { id: { in: traceIds.map(({ id }) => id) } },
      });
      this.metrics?.recordHarnessCleanup('traces', deleted.count);
    }

    // governance: system-scope — retention cleanup is restricted to terminal runs older than the configured cutoff
    const runIds = await this.prisma.agentRun.findMany({
      where: {
        status: {
          in: [
            AgentRunStatus.COMPLETED,
            AgentRunStatus.FAILED,
            AgentRunStatus.CANCELLED,
            AgentRunStatus.EXPIRED,
          ],
        },
        completedAt: { lt: runCutoff },
      },
      orderBy: { completedAt: 'asc' },
      take: 200,
      select: { id: true },
    });
    if (runIds.length > 0) {
      // governance: system-scope — IDs come only from the bounded terminal-run retention query above
      const deleted = await this.prisma.agentRun.deleteMany({
        where: { id: { in: runIds.map(({ id }) => id) } },
      });
      this.metrics?.recordHarnessCleanup('runs', deleted.count);
    }
  }

  private retentionDays(key: string, fallback: number): number {
    const value = Number(this.config.get<number | string>(key, fallback));
    return Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
  }
}
