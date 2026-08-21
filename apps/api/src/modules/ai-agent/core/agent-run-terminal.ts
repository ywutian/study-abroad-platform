import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentApprovalStatus, AgentRunStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AgentResponse } from '../types';
import { MetricsService } from '../infrastructure/observability/metrics.service';
import { AgentEvaluationTraceService } from './agent-evaluation-trace.service';
import { AgentHarnessOperationsService } from './agent-harness-operations.service';
import { isRecord, toInputJson } from './agent-run-state';

interface TerminalDependencies {
  prisma: PrismaService;
  evaluationTrace: AgentEvaluationTraceService;
  metrics?: MetricsService;
  harnessOperations?: AgentHarnessOperationsService;
}

export async function markApprovalExecutionSucceeded(
  deps: TerminalDependencies,
  userId: string,
  runId: string,
  approvalId: string,
): Promise<void> {
  const updated = await deps.prisma.agentApproval.updateMany({
    where: {
      id: approvalId,
      runId,
      userId,
      status: AgentApprovalStatus.EXECUTING,
    },
    data: { status: AgentApprovalStatus.EXECUTED, executedAt: new Date() },
  });
  if (updated.count === 1) {
    void deps.harnessOperations?.recordEvent('approval_executed');
    return;
  }
  const existing = await deps.prisma.agentApproval.findFirst({
    where: { id: approvalId, runId, userId },
  });
  if (existing?.status === AgentApprovalStatus.EXECUTED) return;
  throw new ConflictException('Approval execution state changed');
}

export async function completeAgentRun(
  deps: TerminalDependencies,
  userId: string,
  runId: string,
  result?: AgentResponse,
): Promise<boolean> {
  const workflow = isRecord(result?.data?.workflow)
    ? result.data.workflow
    : undefined;
  const usage = workflow && isRecord(workflow.usage) ? workflow.usage : null;
  const contextSummary =
    workflow && isRecord(workflow.contextSummary)
      ? workflow.contextSummary
      : null;
  const updated = await deps.prisma.agentRun.updateMany({
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
  if (updated.count !== 1) {
    const existing = await deps.prisma.agentRun.findFirst({
      where: { id: runId, userId },
    });
    if (!existing) throw new NotFoundException('Agent run not found');
    return false;
  }
  await deps.evaluationTrace.persist(userId, runId, 'COMPLETED', result);
  void deps.harnessOperations?.recordEvent('run_completed');
  return true;
}

export async function failAgentRun(
  deps: TerminalDependencies,
  userId: string,
  runId: string,
  errorCode: string,
  message: string,
): Promise<boolean> {
  const [, updated] = await deps.prisma.$transaction([
    deps.prisma.agentApproval.updateMany({
      where: { runId, userId, status: AgentApprovalStatus.EXECUTING },
      data: { status: AgentApprovalStatus.FAILED, errorCode },
    }),
    deps.prisma.agentRun.updateMany({
      where: { id: runId, userId, status: AgentRunStatus.RUNNING },
      data: {
        status: AgentRunStatus.FAILED,
        errorCode,
        errorMessage: message.slice(0, 2000),
        completedAt: new Date(),
        version: { increment: 1 },
      },
    }),
  ]);
  if (updated.count !== 1) return false;
  await deps.evaluationTrace.persist(userId, runId, 'FAILED', undefined, {
    errorCode,
  });
  void deps.harnessOperations?.recordEvent('run_failed');
  const budgetEvent = message.includes('AGENT_TOKEN_BUDGET_EXCEEDED')
    ? 'token_budget_exceeded'
    : message.includes('AGENT_DURATION_BUDGET_EXCEEDED')
      ? 'duration_budget_exceeded'
      : undefined;
  if (budgetEvent) deps.metrics?.recordHarnessEvent(budgetEvent);
  if (budgetEvent) await deps.harnessOperations?.recordEvent(budgetEvent);
  return true;
}
