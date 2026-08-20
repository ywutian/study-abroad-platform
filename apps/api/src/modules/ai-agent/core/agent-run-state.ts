import { AgentApprovalStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import type { AgentType, ToolCall } from '../types';

export interface AgentRunBudgetV1 {
  version: 1;
  maxTokens: number;
  maxToolCalls: number;
  maxSupplementalRounds: number;
  maxDurationMs: number;
}

export interface AgentRunUsageV1 {
  version: 1;
  estimatedTokens: number;
  toolCalls: number;
  supplementalRounds: number;
  elapsedMs: number;
}

export interface AgentRunContextSummaryV1 {
  version: 1;
  taskGoal: string;
  constraints: string[];
  toolResultRefs: Array<{
    toolCallId: string;
    toolName: string;
    status: 'success' | 'failed';
  }>;
  approvalState: 'none' | 'waiting' | 'approved';
  lastFailure?: { toolName: string; reason: string };
  unfinishedSteps: string[];
}

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

export interface AgentRunCheckpointV2 extends Omit<
  AgentRunCheckpointV1,
  'version'
> {
  version: 2;
  context: AgentRunContextSummaryV1;
  budget: AgentRunBudgetV1;
  usage: AgentRunUsageV1;
}

export type AgentRunCheckpoint = AgentRunCheckpointV1 | AgentRunCheckpointV2;

export interface ApprovalRequest {
  runId: string;
  approvalId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  fingerprint: string;
  expiresAt: string;
  status: AgentApprovalStatus;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function isAgentRunCheckpointV1(
  value: unknown,
): value is AgentRunCheckpointV1 {
  if (!isRecord(value) || value.version !== 1) return false;
  if (
    typeof value.agentType !== 'string' ||
    typeof value.locale !== 'string' ||
    typeof value.planningContent !== 'string' ||
    !Array.isArray(value.steps) ||
    !Array.isArray(value.successfulFingerprints) ||
    !Number.isInteger(value.pendingStepIndex) ||
    !Number.isInteger(value.scheduledCalls) ||
    !Number.isInteger(value.supplementalRounds) ||
    typeof value.planMs !== 'number' ||
    typeof value.executeMs !== 'number' ||
    typeof value.startedAt !== 'string'
  ) {
    return false;
  }
  if (!value.successfulFingerprints.every((item) => typeof item === 'string')) {
    return false;
  }
  return value.steps.every((step) => {
    if (!isRecord(step) || !isRecord(step.toolCall)) return false;
    return (
      typeof step.toolCall.id === 'string' &&
      typeof step.toolCall.name === 'string' &&
      isRecord(step.toolCall.arguments) &&
      ['pending', 'success', 'failed'].includes(String(step.status))
    );
  });
}

export function isAgentRunCheckpoint(
  value: unknown,
): value is AgentRunCheckpoint {
  if (isAgentRunCheckpointV1(value)) return true;
  if (!isRecord(value) || value.version !== 2) return false;
  if (!isAgentRunCheckpointV1({ ...value, version: 1 })) return false;
  if (!isRecord(value.context) || !isRecord(value.budget)) return false;
  if (!isRecord(value.usage)) return false;
  return (
    value.context.version === 1 &&
    typeof value.context.taskGoal === 'string' &&
    Array.isArray(value.context.constraints) &&
    Array.isArray(value.context.toolResultRefs) &&
    Array.isArray(value.context.unfinishedSteps) &&
    ['none', 'waiting', 'approved'].includes(
      String(value.context.approvalState),
    ) &&
    value.budget.version === 1 &&
    Number.isInteger(value.budget.maxTokens) &&
    Number.isInteger(value.budget.maxToolCalls) &&
    Number.isInteger(value.budget.maxSupplementalRounds) &&
    Number.isInteger(value.budget.maxDurationMs) &&
    value.usage.version === 1 &&
    Number.isInteger(value.usage.estimatedTokens) &&
    Number.isInteger(value.usage.toolCalls) &&
    Number.isInteger(value.usage.supplementalRounds) &&
    Number.isInteger(value.usage.elapsedMs)
  );
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
