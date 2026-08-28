import type { StreamChunk } from './llm.service';
import type { AgentRunBudgetTracker } from './agent-run-context';

/** Harness callers require an explicit successful terminal, including non-routed calls. */
export async function* checkedWorkflowStream(
  stream: AsyncGenerator<StreamChunk>,
  budget?: AgentRunBudgetTracker,
): AsyncGenerator<StreamChunk> {
  let done = false;
  for await (const chunk of stream) {
    if (budget && chunk.type === 'error') {
      if (
        chunk.error === 'AGENT_TOKEN_BUDGET_EXCEEDED' ||
        chunk.error === 'AGENT_DURATION_BUDGET_EXCEEDED'
      )
        throw new Error(chunk.error);
      throw new Error(
        budget.limits.routing
          ? 'MODEL_ROUTING_STREAM_FAILED'
          : 'AGENT_STREAM_FAILED',
      );
    }
    if (chunk.type === 'done') done = true;
    yield chunk;
  }
  if (budget && !done) throw new Error('AGENT_STREAM_INCOMPLETE');
}
