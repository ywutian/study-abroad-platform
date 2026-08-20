import type { AgentType, ConversationState } from '../types';
import type { AgentRunCheckpoint } from './agent-run-state';
import {
  AgentRunBudgetTracker,
  buildAgentRunContextSummary,
} from './agent-run-context';
import type { ExecutionPlan, WorkflowResult } from './workflow-contract';

export function buildWorkflowResult(params: {
  message: string;
  plan: ExecutionPlan;
  timing: WorkflowResult['timing'];
  delegation?: ExecutionPlan['delegation'];
  budgetTracker?: AgentRunBudgetTracker;
  scheduledCalls?: number;
  supplementalRounds?: number;
  conversation?: ConversationState;
}): WorkflowResult {
  const toolsUsed = params.plan.steps
    .filter((step) => step.status === 'success')
    .map((step) => step.toolCall.name);
  const contextSummary = params.conversation
    ? buildAgentRunContextSummary({
        messages: params.conversation.messages,
        steps: params.plan.steps,
        pendingStepIndex: params.plan.steps.length,
        approvalState: 'none',
      })
    : undefined;

  return {
    message: params.message,
    toolsUsed: [...new Set(toolsUsed)],
    delegation: params.delegation,
    plan: params.plan,
    timing: params.timing,
    ...(params.budgetTracker
      ? {
          usage: params.budgetTracker.snapshot(
            params.scheduledCalls ?? 0,
            params.supplementalRounds ?? 0,
          ),
        }
      : {}),
    ...(contextSummary ? { contextSummary } : {}),
  };
}

export function buildRunCheckpoint(input: {
  agentType: AgentType;
  locale: string;
  plan: ExecutionPlan;
  pendingStepIndex: number;
  successfulCalls: Set<string>;
  scheduledCalls: number;
  supplementalRounds: number;
  planMs: number;
  executeMs: number;
  startedAt: Date;
  conversation: ConversationState;
  budgetTracker?: AgentRunBudgetTracker;
  approvalState: 'none' | 'waiting' | 'approved';
}): AgentRunCheckpoint {
  const base = {
    version: 1,
    agentType: input.agentType,
    locale: input.locale,
    planningContent: input.plan.planningContent,
    steps: input.plan.steps.map((step) => ({
      toolCall: step.toolCall,
      status: step.status === 'running' ? 'pending' : step.status,
      ...(step.error ? { error: step.error } : {}),
    })),
    pendingStepIndex: input.pendingStepIndex,
    successfulFingerprints: [...input.successfulCalls],
    scheduledCalls: input.scheduledCalls,
    supplementalRounds: input.supplementalRounds,
    planMs: input.planMs,
    executeMs: input.executeMs,
    startedAt: input.startedAt.toISOString(),
  };
  if (!input.budgetTracker) return base as AgentRunCheckpoint;

  return {
    ...base,
    version: 2,
    context: buildAgentRunContextSummary({
      messages: input.conversation.messages,
      steps: input.plan.steps,
      pendingStepIndex: input.pendingStepIndex,
      approvalState: input.approvalState,
    }),
    budget: input.budgetTracker.limits,
    usage: input.budgetTracker.snapshot(
      input.scheduledCalls,
      input.supplementalRounds,
    ),
  };
}
