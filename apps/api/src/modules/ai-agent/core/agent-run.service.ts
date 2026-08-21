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
import {
  AgentRunBudgetV1,
  AgentRunCheckpoint,
  AgentRunUsageV1,
  ApprovalRequest,
  getApprovalFingerprint,
  isRecord,
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
    const budget = this.contextEnabled() ? this.getRunBudget() : undefined;
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
        expiresAt: new Date(Date.now() + this.runTtlMs()),
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
    if (existing) return this.toApprovalRequest(existing);

    const expiresAt = new Date(Date.now() + this.approvalTtlMs());
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
      return this.toApprovalRequest(approval);
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
        if (duplicate) return this.toApprovalRequest(duplicate);
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
      approval: approval ? this.toApprovalRequest(approval) : undefined,
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
    return this.toApprovalRequest(approval);
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
      const existing = await tx.agentRun.findFirst({
        where: { id: runId, userId },
      });
      if (!existing) throw new NotFoundException('Agent run not found');
    });
    await this.evaluationTrace.persist(userId, runId, 'CANCELLED', undefined, {
      errorCode: 'USER_CANCELLED',
    });
    return this.getRunSummary(userId, runId);
  }

  async claimApproved(userId: string, runId: string) {
    await this.retention.expireIfNeeded(userId, runId);
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.findFirst({
        where: { id: runId, userId },
        include: { approvals: true },
      });
      if (!run) throw new NotFoundException('Agent run not found');
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
          approval.executionStartedAt.getTime() + this.executionLeaseMs() <=
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
    await this.prisma.agentApproval.updateMany({
      where: {
        id: approvalId,
        runId,
        userId,
        status: AgentApprovalStatus.EXECUTING,
      },
      data: { status: AgentApprovalStatus.EXECUTED, executedAt: new Date() },
    });
  }

  async completeRun(userId: string, runId: string, result?: AgentResponse) {
    const workflow = isRecord(result?.data?.workflow)
      ? result.data.workflow
      : undefined;
    const usage = workflow && isRecord(workflow.usage) ? workflow.usage : null;
    const contextSummary =
      workflow && isRecord(workflow.contextSummary)
        ? workflow.contextSummary
        : null;
    await this.prisma.agentRun.updateMany({
      where: { id: runId, userId, status: AgentRunStatus.RUNNING },
      data: {
        status: AgentRunStatus.COMPLETED,
        checkpoint: Prisma.JsonNull,
        ...(result ? { result: toInputJson(result) } : {}),
        ...(usage ? { usage: toInputJson(usage) } : {}),
        ...(contextSummary
          ? { contextSummary: toInputJson(contextSummary) }
          : {}),
        currentApprovalId: null,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await this.evaluationTrace.persist(userId, runId, 'COMPLETED', result);
  }

  async failRun(
    userId: string,
    runId: string,
    errorCode: string,
    message: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.agentApproval.updateMany({
        where: {
          runId,
          userId,
          status: AgentApprovalStatus.EXECUTING,
        },
        data: { status: AgentApprovalStatus.FAILED, errorCode },
      }),
      this.prisma.agentRun.updateMany({
        where: {
          id: runId,
          userId,
          status: AgentRunStatus.RUNNING,
        },
        data: {
          status: AgentRunStatus.FAILED,
          errorCode,
          errorMessage: message.slice(0, 2000),
          completedAt: new Date(),
          version: { increment: 1 },
        },
      }),
    ]);
    await this.evaluationTrace.persist(userId, runId, 'FAILED', undefined, {
      errorCode,
    });
    const budgetEvent = message.includes('AGENT_TOKEN_BUDGET_EXCEEDED')
      ? 'token_budget_exceeded'
      : message.includes('AGENT_DURATION_BUDGET_EXCEEDED')
        ? 'duration_budget_exceeded'
        : undefined;
    if (budgetEvent) this.metrics?.recordHarnessEvent(budgetEvent);
  }

  private toApprovalRequest(approval: {
    id: string;
    runId: string;
    toolName: string;
    arguments: Prisma.JsonValue;
    fingerprint: string;
    expiresAt: Date;
    status: AgentApprovalStatus;
  }): ApprovalRequest {
    return {
      runId: approval.runId,
      approvalId: approval.id,
      toolName: approval.toolName,
      arguments: approval.arguments as Record<string, unknown>,
      fingerprint: approval.fingerprint,
      expiresAt: approval.expiresAt.toISOString(),
      status: approval.status,
    };
  }

  private approvalTtlMs(): number {
    return this.config.get<number>('AI_AGENT_APPROVAL_TTL_MS', 15 * 60 * 1000);
  }

  private runTtlMs(): number {
    return this.config.get<number>('AI_AGENT_RUN_TTL_MS', 24 * 60 * 60 * 1000);
  }

  private executionLeaseMs(): number {
    return this.config.get<number>(
      'AI_AGENT_EXECUTION_LEASE_MS',
      2 * 60 * 1000,
    );
  }

  getRunBudget(): AgentRunBudgetV1 {
    return {
      version: 1,
      maxTokens: this.config.get<number>('AI_AGENT_MAX_TOKENS_PER_RUN', 24000),
      maxToolCalls: 16,
      maxSupplementalRounds: 2,
      maxDurationMs: this.config.get<number>(
        'AI_AGENT_MAX_DURATION_MS',
        120000,
      ),
    };
  }

  contextEnabled(): boolean {
    return (
      this.config.get<string>('AI_AGENT_HARNESS_V1') === 'true' &&
      this.config.get<string>('AI_AGENT_CONTEXT_V1') === 'true'
    );
  }
}
