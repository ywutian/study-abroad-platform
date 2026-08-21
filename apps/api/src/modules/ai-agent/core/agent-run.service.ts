import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AgentApprovalStatus, AgentRunStatus, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AgentResponse, AgentType, ToolCall } from '../types';
import { SanitizerService } from '../memory/sanitizer.service';
import { AgentEvaluationTraceService } from './agent-evaluation-trace.service';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { AgentRunRetentionService } from './agent-run-retention.service';
import { AgentHarnessOperationsService } from './agent-harness-operations.service';
import {
  completeAgentRun,
  failAgentRun,
  markApprovalExecutionSucceeded,
} from './agent-run-terminal';
import {
  approvalTtlMs,
  executionLeaseMs,
  formatApprovalRequest,
  getConfiguredRunBudget,
  isRunContextEnabled,
  readPersistedRunBudget,
  runTtlMs,
} from './agent-run-settings';
import {
  AgentRunBudgetV1,
  AgentRunCheckpoint,
  AgentRunUsageV1,
  ApprovalRequest,
  getApprovalFingerprint,
  normalizeToolArguments,
  toInputJson,
} from './agent-run-state';

export * from './agent-run-state';

@Injectable()
export class AgentRunService {
  private readonly evaluationTrace: AgentEvaluationTraceService;
  private readonly retention: AgentRunRetentionService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() sanitizer?: SanitizerService,
    @Optional() evaluationTrace?: AgentEvaluationTraceService,
    @Optional() private readonly metrics?: MetricsService,
    @Optional() retention?: AgentRunRetentionService,
    @Optional()
    private readonly harnessOperations?: AgentHarnessOperationsService,
  ) {
    this.evaluationTrace =
      evaluationTrace ??
      new AgentEvaluationTraceService(prisma, config, sanitizer);
    this.retention =
      retention ?? new AgentRunRetentionService(prisma, config, metrics);
  }

  isEnabled(): boolean {
    return (
      this.config.get<string>('AI_AGENT_HARNESS_V1') === 'true' &&
      this.config.get<string>('AI_AGENT_APPROVALS_V1') === 'true'
    );
  }

  async createRun(input: {
    userId: string;
    conversationId: string;
    agentType: AgentType;
  }) {
    const acceptanceBudget =
      await this.harnessOperations?.consumeBudgetOverride(input.userId);
    const budget = isRunContextEnabled(this.config)
      ? (acceptanceBudget ?? getConfiguredRunBudget(this.config))
      : undefined;
    return this.prisma.agentRun.create({
      data: {
        ...input,
        ...(budget ? { budget: toInputJson(budget) } : {}),
        ...(budget
          ? {
              usage: toInputJson({
                version: 1,
                estimatedTokens: 0,
                toolCalls: 0,
                supplementalRounds: 0,
                elapsedMs: 0,
              } satisfies AgentRunUsageV1),
            }
          : {}),
        expiresAt: new Date(Date.now() + runTtlMs(this.config)),
      },
    });
  }

  @Cron('*/1 * * * *')
  async expireStaleApprovals(): Promise<void> {
    if (!this.isEnabled()) return;
    await this.retention.expireStaleRuns();
  }

  @Cron('17 3 * * *')
  async cleanupRetainedData(): Promise<void> {
    await this.retention.cleanupRetainedData();
  }

  async requestApproval(input: {
    runId: string;
    userId: string;
    toolCall: ToolCall;
    checkpoint: AgentRunCheckpoint;
  }): Promise<ApprovalRequest> {
    const fingerprint = getApprovalFingerprint(input.toolCall);
    const existing = await this.prisma.agentApproval.findUnique({
      where: {
        runId_fingerprint: { runId: input.runId, fingerprint },
      },
    });
    if (existing) return formatApprovalRequest(existing);

    const expiresAt = new Date(Date.now() + approvalTtlMs(this.config));
    try {
      const approval = await this.prisma.$transaction(async (tx) => {
        const run = await tx.agentRun.findFirst({
          where: {
            id: input.runId,
            userId: input.userId,
            status: AgentRunStatus.RUNNING,
          },
        });
        if (!run) throw new ConflictException('Agent run cannot be paused');

        const created = await tx.agentApproval.create({
          data: {
            runId: input.runId,
            userId: input.userId,
            toolName: input.toolCall.name,
            arguments: normalizeToolArguments(
              input.toolCall.arguments,
            ) as Prisma.InputJsonValue,
            fingerprint,
            idempotencyKey: `${input.runId}:${fingerprint}`,
            expiresAt,
          },
        });

        const updated = await tx.agentRun.updateMany({
          where: {
            id: input.runId,
            userId: input.userId,
            status: AgentRunStatus.RUNNING,
          },
          data: {
            status: AgentRunStatus.WAITING_APPROVAL,
            checkpoint: toInputJson(input.checkpoint),
            ...(input.checkpoint.version === 2
              ? {
                  budget: toInputJson(input.checkpoint.budget),
                  usage: toInputJson(input.checkpoint.usage),
                  contextSummary: toInputJson(input.checkpoint.context),
                }
              : {}),
            currentApprovalId: created.id,
            expiresAt,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Agent run state changed while pausing');
        }
        return created;
      });
      void this.harnessOperations?.recordEvent('approval_required');
      return formatApprovalRequest(approval);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.agentApproval.findUnique({
          where: {
            runId_fingerprint: { runId: input.runId, fingerprint },
          },
        });
        if (duplicate) return formatApprovalRequest(duplicate);
      }
      throw error;
    }
  }

  async getRun(userId: string, runId: string) {
    await this.retention.expireIfNeeded(userId, runId);
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, userId },
      include: {
        approvals: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!run) throw new NotFoundException('Agent run not found');
    return run;
  }

  async getRunSummary(userId: string, runId: string) {
    const run = await this.getRun(userId, runId);
    const approval = run.approvals[0];
    return {
      id: run.id,
      conversationId: run.conversationId,
      agentType: run.agentType,
      status: run.status,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      expiresAt: run.expiresAt?.toISOString() ?? null,
      budget: run.budget,
      usage: run.usage,
      contextSummary: run.contextSummary,
      result: run.result,
      approval: approval ? formatApprovalRequest(approval) : undefined,
    };
  }

  async approve(userId: string, runId: string, approvalId: string) {
    await this.retention.expireIfNeeded(userId, runId);
    const approval = await this.prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.findFirst({
        where: {
          id: runId,
          userId,
          status: AgentRunStatus.WAITING_APPROVAL,
          currentApprovalId: approvalId,
        },
      });
      const existing = await tx.agentApproval.findFirst({
        where: { id: approvalId, runId, userId },
      });
      if (!existing) throw new NotFoundException('Approval not found');

      if (!run) {
        if (
          existing.status === AgentApprovalStatus.APPROVED ||
          existing.status === AgentApprovalStatus.EXECUTING ||
          existing.status === AgentApprovalStatus.EXECUTED
        ) {
          return existing;
        }
        throw new ConflictException(
          'Agent run is not waiting for this approval',
        );
      }

      const updated = await tx.agentApproval.updateMany({
        where: {
          id: approvalId,
          runId,
          userId,
          status: AgentApprovalStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        data: {
          status: AgentApprovalStatus.APPROVED,
          decidedAt: new Date(),
        },
      });
      if (updated.count === 1) {
        return {
          ...existing,
          status: AgentApprovalStatus.APPROVED,
          decidedAt: new Date(),
        };
      }

      // Another request may have approved the same action after our initial
      // read. Re-read inside the transaction so concurrent retries are also
      // idempotent instead of observing stale PENDING state.
      const latest = await tx.agentApproval.findFirst({
        where: { id: approvalId, runId, userId },
      });
      if (!latest) throw new NotFoundException('Approval not found');
      if (
        latest.status === AgentApprovalStatus.APPROVED ||
        latest.status === AgentApprovalStatus.EXECUTING ||
        latest.status === AgentApprovalStatus.EXECUTED
      ) {
        return latest;
      }
      if (latest.status === AgentApprovalStatus.EXPIRED) {
        throw new GoneException('Approval expired');
      }
      throw new ConflictException(`Approval is ${latest.status.toLowerCase()}`);
    });
    return formatApprovalRequest(approval);
  }

  async reject(
    userId: string,
    runId: string,
    approvalId: string,
    reason?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.agentApproval.updateMany({
        where: {
          id: approvalId,
          runId,
          userId,
          status: AgentApprovalStatus.PENDING,
        },
        data: {
          status: AgentApprovalStatus.REJECTED,
          decisionReason: reason?.slice(0, 500),
          decidedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        const existing = await tx.agentApproval.findFirst({
          where: { id: approvalId, runId, userId },
        });
        if (!existing) throw new NotFoundException('Approval not found');
        if (existing.status === AgentApprovalStatus.REJECTED) return;
        throw new ConflictException(
          `Approval is ${existing.status.toLowerCase()}`,
        );
      }
      const runUpdated = await tx.agentRun.updateMany({
        where: {
          id: runId,
          userId,
          status: AgentRunStatus.WAITING_APPROVAL,
          currentApprovalId: approvalId,
        },
        data: {
          status: AgentRunStatus.CANCELLED,
          errorCode: 'APPROVAL_REJECTED',
          errorMessage: reason?.slice(0, 1000) || 'User rejected the action',
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (runUpdated.count !== 1) {
        throw new ConflictException(
          'Agent run is not waiting for this approval',
        );
      }
    });
    await this.evaluationTrace.persist(userId, runId, 'CANCELLED', undefined, {
      errorCode: 'APPROVAL_REJECTED',
    });
    return this.getRunSummary(userId, runId);
  }

  async cancel(userId: string, runId: string) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.agentRun.findFirst({
        where: { id: runId, userId },
        include: { approvals: true },
      });
      if (!current) throw new NotFoundException('Agent run not found');

      const activeApproval = current.approvals.find(
        (approval) => approval.id === current.currentApprovalId,
      );
      if (
        current.status === AgentRunStatus.RUNNING &&
        (activeApproval?.status === AgentApprovalStatus.EXECUTING ||
          activeApproval?.status === AgentApprovalStatus.EXECUTED)
      ) {
        throw new ConflictException(
          'Approved action is already executing or has executed',
        );
      }

      const updated = await tx.agentRun.updateMany({
        where: {
          id: runId,
          userId,
          status: {
            in: [AgentRunStatus.RUNNING, AgentRunStatus.WAITING_APPROVAL],
          },
        },
        data: {
          status: AgentRunStatus.CANCELLED,
          errorCode: 'USER_CANCELLED',
          errorMessage: 'User cancelled the run',
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count > 0) {
        await tx.agentApproval.updateMany({
          where: {
            runId,
            userId,
            status: {
              in: [AgentApprovalStatus.PENDING, AgentApprovalStatus.APPROVED],
            },
          },
          data: {
            status: AgentApprovalStatus.CANCELLED,
            decidedAt: new Date(),
          },
        });
        return;
      }
    });
    await this.evaluationTrace.persist(userId, runId, 'CANCELLED', undefined, {
      errorCode: 'USER_CANCELLED',
    });
    void this.harnessOperations?.recordEvent('run_cancelled');
    return this.getRunSummary(userId, runId);
  }

  async claimApproved(userId: string, runId: string) {
    await this.retention.expireIfNeeded(userId, runId);
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.findFirst({
        where: { id: runId, userId },
        include: { approvals: { orderBy: { createdAt: 'desc' } } },
      });
      if (!run) throw new NotFoundException('Agent run not found');

      if (
        run.status === AgentRunStatus.COMPLETED ||
        run.status === AgentRunStatus.FAILED ||
        run.status === AgentRunStatus.CANCELLED ||
        run.status === AgentRunStatus.EXPIRED
      ) {
        return {
          run,
          approval: run.approvals[0],
          claimed: false as const,
        };
      }

      const approval = run.approvals.find(
        (item) => item.id === run.currentApprovalId,
      );
      if (!approval) throw new ConflictException('No pending approval');

      if (
        approval.status === AgentApprovalStatus.EXECUTING ||
        approval.status === AgentApprovalStatus.EXECUTED
      ) {
        if (
          approval.status === AgentApprovalStatus.EXECUTING &&
          approval.executionStartedAt &&
          approval.executionStartedAt.getTime() +
            executionLeaseMs(this.config) <=
            Date.now()
        ) {
          const failedApproval = await tx.agentApproval.updateMany({
            where: {
              id: approval.id,
              runId,
              userId,
              status: AgentApprovalStatus.EXECUTING,
              executionStartedAt: approval.executionStartedAt,
            },
            data: {
              status: AgentApprovalStatus.FAILED,
              errorCode: 'EXECUTION_OUTCOME_UNKNOWN',
            },
          });
          if (failedApproval.count === 0) {
            const currentApproval = await tx.agentApproval.findFirst({
              where: { id: approval.id, runId, userId },
            });
            const currentRun = await tx.agentRun.findFirst({
              where: { id: runId, userId },
              include: { approvals: true },
            });
            if (!currentApproval || !currentRun) {
              throw new ConflictException('Agent run state changed');
            }
            return {
              run: currentRun,
              approval: currentApproval,
              claimed: false as const,
            };
          }

          const failedRun = await tx.agentRun.updateMany({
            where: {
              id: runId,
              userId,
              status: AgentRunStatus.RUNNING,
              currentApprovalId: approval.id,
            },
            data: {
              status: AgentRunStatus.FAILED,
              errorCode: 'EXECUTION_OUTCOME_UNKNOWN',
              errorMessage:
                'The service restarted while a protected action was executing; it was not replayed.',
              completedAt: new Date(),
              version: { increment: 1 },
            },
          });
          if (failedRun.count !== 1) {
            throw new ConflictException('Agent run state changed');
          }
          return {
            run: {
              ...run,
              status: AgentRunStatus.FAILED,
              errorCode: 'EXECUTION_OUTCOME_UNKNOWN',
              errorMessage:
                'The service restarted while a protected action was executing; it was not replayed.',
            },
            approval: { ...approval, status: AgentApprovalStatus.FAILED },
            claimed: false as const,
          };
        }
        return { run, approval, claimed: false as const };
      }
      if (approval.status !== AgentApprovalStatus.APPROVED) {
        throw new ConflictException('Approval has not been granted');
      }

      const claimed = await tx.agentApproval.updateMany({
        where: { id: approval.id, status: AgentApprovalStatus.APPROVED },
        data: {
          status: AgentApprovalStatus.EXECUTING,
          executionStartedAt: new Date(),
        },
      });
      const resumed = await tx.agentRun.updateMany({
        where: {
          id: runId,
          userId,
          status: AgentRunStatus.WAITING_APPROVAL,
          currentApprovalId: approval.id,
        },
        data: { status: AgentRunStatus.RUNNING, version: { increment: 1 } },
      });
      if (claimed.count !== 1 || resumed.count !== 1) {
        throw new ConflictException('Run was already resumed');
      }
      return {
        run: { ...run, status: AgentRunStatus.RUNNING },
        approval: { ...approval, status: AgentApprovalStatus.EXECUTING },
        claimed: true as const,
      };
    });
  }

  async markExecutionSucceeded(
    userId: string,
    runId: string,
    approvalId: string,
  ) {
    return markApprovalExecutionSucceeded(
      this.terminalDependencies(),
      userId,
      runId,
      approvalId,
    );
  }

  async completeRun(userId: string, runId: string, result?: AgentResponse) {
    return completeAgentRun(this.terminalDependencies(), userId, runId, result);
  }

  async failRun(
    userId: string,
    runId: string,
    errorCode: string,
    message: string,
  ) {
    return failAgentRun(
      this.terminalDependencies(),
      userId,
      runId,
      errorCode,
      message,
    );
  }

  private terminalDependencies() {
    return {
      prisma: this.prisma,
      evaluationTrace: this.evaluationTrace,
      metrics: this.metrics,
      harnessOperations: this.harnessOperations,
    };
  }

  async getPersistedBudget(
    userId: string,
    runId: string,
  ): Promise<AgentRunBudgetV1 | undefined> {
    return readPersistedRunBudget(this.prisma, userId, runId);
  }
}
