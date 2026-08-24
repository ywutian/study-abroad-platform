import type { AgentApproval, AgentRun } from '@prisma/client';
import { formatApprovalRequest } from './agent-run-settings';

type RunWithApproval = AgentRun & { approvals: AgentApproval[] };

export function formatAgentRunSummary(run: RunWithApproval) {
  const approval = run.approvals[0];
  return {
    id: run.id,
    conversationId: run.conversationId,
    agentType: run.agentType,
    skillVersionId: run.skillVersionId,
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
