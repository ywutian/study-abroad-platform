import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentApprovalStatus, AgentRunStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AgentType, ToolCall } from '../types';

export interface AgentRunCheckpointV1 {
  version: 1;
  agentType: AgentType;
  locale: string;
  planningContent: string;
  steps: Array<{
    toolCall: ToolCall;
    status: 'pending' | 'success' | 'failed';
    error?: string;
  }>;
  pendingStepIndex: number;
  successfulFingerprints: string[];
  scheduledCalls: number;
  supplementalRounds: number;
  planMs: number;
  executeMs: number;
  startedAt: string;
}

export interface ApprovalRequest {
  runId: string;
  approvalId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  fingerprint: string;
  expiresAt: string;
  status: AgentApprovalStatus;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function normalizeToolArguments(
  args: Record<string, unknown>,
): Record<string, unknown> {
  return canonicalize(args) as Record<string, unknown>;
}

export function getApprovalFingerprint(toolCall: ToolCall): string {
  const canonical = JSON.stringify({
    tool: toolCall.name,
    arguments: normalizeToolArguments(toolCall.arguments),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

@Injectable()
export class AgentRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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
    return this.prisma.agentRun.create({
      data: {
        ...input,
        expiresAt: new Date(Date.now() + this.runTtlMs()),
      },
    });
  }

  @Cron('*/1 * * * *')
  async expireStaleApprovals(): Promise<void> {
    if (!this.isEnabled()) return;

    const candidates = await this.prisma.agentRun.findMany({
      where: {
        status: AgentRunStatus.WAITING_APPROVAL,
        expiresAt: { lte: new Date() },
      },
      select: { id: true, userId: true },
      take: 100,
    });
    for (const candidate of candidates) {
      await this.expireIfNeeded(candidate.userId, candidate.id);
    }
  }

  async requestApproval(input: {
    runId: string;
    userId: string;
    toolCall: ToolCall;
    checkpoint: AgentRunCheckpointV1;
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
            checkpoint: input.checkpoint as unknown as Prisma.InputJsonValue,
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
    await this.expireIfNeeded(userId, runId);
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
      result: run.result,
      approval: approval ? this.toApprovalRequest(approval) : undefined,
    };
  }

  async approve(userId: string, runId: string, approvalId: string) {
    await this.expireIfNeeded(userId, runId);
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
    return this.getRunSummary(userId, runId);
  }

  async claimApproved(userId: string, runId: string) {
    await this.expireIfNeeded(userId, runId);
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

  async markExecutionSucceeded(runId: string, approvalId: string) {
    await this.prisma.agentApproval.updateMany({
      where: {
        id: approvalId,
        runId,
        status: AgentApprovalStatus.EXECUTING,
      },
      data: { status: AgentApprovalStatus.EXECUTED, executedAt: new Date() },
    });
  }

  async completeRun(runId: string, result?: Record<string, unknown>) {
    await this.prisma.agentRun.updateMany({
      where: { id: runId, status: AgentRunStatus.RUNNING },
      data: {
        status: AgentRunStatus.COMPLETED,
        checkpoint: Prisma.JsonNull,
        ...(result ? { result: result as Prisma.InputJsonValue } : {}),
        currentApprovalId: null,
        completedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async failRun(
    runId: string,
    errorCode: string,
    message: string,
    userId?: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.agentApproval.updateMany({
        where: {
          runId,
          ...(userId ? { userId } : {}),
          status: AgentApprovalStatus.EXECUTING,
        },
        data: { status: AgentApprovalStatus.FAILED, errorCode },
      }),
      this.prisma.agentRun.updateMany({
        where: {
          id: runId,
          ...(userId ? { userId } : {}),
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
  }

  private async expireIfNeeded(userId: string, runId: string) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const run = await tx.agentRun.findFirst({
        where: {
          id: runId,
          userId,
          status: AgentRunStatus.WAITING_APPROVAL,
          expiresAt: { lte: now },
        },
      });
      if (!run) return;
      await tx.agentApproval.updateMany({
        where: {
          runId,
          status: {
            in: [AgentApprovalStatus.PENDING, AgentApprovalStatus.APPROVED],
          },
        },
        data: { status: AgentApprovalStatus.EXPIRED, decidedAt: now },
      });
      await tx.agentRun.updateMany({
        where: {
          id: runId,
          userId,
          status: AgentRunStatus.WAITING_APPROVAL,
          expiresAt: { lte: now },
        },
        data: {
          status: AgentRunStatus.EXPIRED,
          errorCode: 'APPROVAL_EXPIRED',
          errorMessage: 'Approval expired before execution',
          completedAt: now,
          version: { increment: 1 },
        },
      });
    });
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
}
