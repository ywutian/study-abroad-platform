import { ConfigService } from '@nestjs/config';
import { AgentApprovalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AgentRunBudgetV1, ApprovalRequest } from './agent-run-state';
import { isRecord } from './agent-run-state';
import {
  configuredRoutingSnapshot,
  parseRoutingSnapshot,
} from '../routing/model-routing.policy';

export function approvalTtlMs(config: ConfigService): number {
  return config.get<number>('AI_AGENT_APPROVAL_TTL_MS', 15 * 60 * 1000);
}

export function runTtlMs(config: ConfigService): number {
  return config.get<number>('AI_AGENT_RUN_TTL_MS', 24 * 60 * 60 * 1000);
}

export function executionLeaseMs(config: ConfigService): number {
  return config.get<number>('AI_AGENT_EXECUTION_LEASE_MS', 2 * 60 * 1000);
}

export function getConfiguredRunBudget(
  config: ConfigService,
): AgentRunBudgetV1 {
  const routing = configuredRoutingSnapshot((key) => config.get(key));
  return {
    version: 1,
    maxTokens: config.get<number>('AI_AGENT_MAX_TOKENS_PER_RUN', 24000),
    maxToolCalls: 16,
    maxSupplementalRounds: 2,
    maxDurationMs: config.get<number>('AI_AGENT_MAX_DURATION_MS', 120000),
    ...(routing ? { routing } : {}),
  };
}

export function isRunContextEnabled(config: ConfigService): boolean {
  return (
    config.get<string>('AI_AGENT_HARNESS_V1') === 'true' &&
    config.get<string>('AI_AGENT_CONTEXT_V1') === 'true'
  );
}

export async function readPersistedRunBudget(
  prisma: PrismaService,
  userId: string,
  runId: string,
): Promise<AgentRunBudgetV1 | undefined> {
  const run = await prisma.agentRun.findFirst({
    where: { id: runId, userId },
    select: { budget: true },
  });
  if (!run || !isRecord(run.budget)) return undefined;
  const budget = run.budget;
  if (
    budget.version !== 1 ||
    typeof budget.maxTokens !== 'number' ||
    typeof budget.maxToolCalls !== 'number' ||
    typeof budget.maxSupplementalRounds !== 'number' ||
    typeof budget.maxDurationMs !== 'number'
  ) {
    return undefined;
  }
  return {
    version: 1,
    maxTokens: budget.maxTokens,
    maxToolCalls: budget.maxToolCalls,
    maxSupplementalRounds: budget.maxSupplementalRounds,
    maxDurationMs: budget.maxDurationMs,
    ...(budget.routing !== undefined
      ? { routing: parseRoutingSnapshot(budget.routing) }
      : {}),
  };
}

export function formatApprovalRequest(approval: {
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
