import { AgentRunBudgetTracker } from './agent-run-context';
import { checkedWorkflowStream } from './workflow-stream';
import type { StreamChunk } from './llm.service';
import { routingFixture } from '../routing/model-routing.fixtures';
import { routingHash } from '../routing/model-routing.policy';

const limits = {
  version: 1 as const,
  maxTokens: 24000,
  maxToolCalls: 16,
  maxSupplementalRounds: 2,
  maxDurationMs: 120000,
};

async function consume(stream: AsyncGenerator<StreamChunk>) {
  for await (const event of stream) if (event.type === 'done') break;
}

describe('Workflow stream completion', () => {
  it('propagates final settlement failure even when the consumer stops at done', async () => {
    const budget = new AgentRunBudgetTracker(limits);
    const reservation = budget.reserveLlmCall('', [], 4000);
    const source = async function* (): AsyncGenerator<StreamChunk> {
      try {
        yield { type: 'content', content: 'synthetic' };
        yield { type: 'done' };
      } finally {
        budget.settleLlmCall(reservation, '', { totalTokens: 24001 });
      }
    };
    await expect(
      consume(checkedWorkflowStream(source(), budget)),
    ).rejects.toThrow('AGENT_TOKEN_BUDGET_EXCEEDED');
  });

  it.each(['AGENT_TOKEN_BUDGET_EXCEEDED', 'AGENT_DURATION_BUDGET_EXCEEDED'])(
    'preserves the stable %s reason',
    async (error) => {
      const source = async function* (): AsyncGenerator<StreamChunk> {
        yield { type: 'error', error };
      };
      await expect(
        consume(
          checkedWorkflowStream(source(), new AgentRunBudgetTracker(limits)),
        ),
      ).rejects.toThrow(error);
    },
  );

  it('retains the existing routed stream failure contract', async () => {
    const policy = routingFixture();
    const source = async function* (): AsyncGenerator<StreamChunk> {
      yield { type: 'error', error: 'MODEL_MISMATCH' };
    };
    await expect(
      consume(
        checkedWorkflowStream(
          source(),
          new AgentRunBudgetTracker({
            ...limits,
            routing: { version: 1, policy, hash: routingHash(policy) },
          }),
        ),
      ),
    ).rejects.toThrow('MODEL_ROUTING_STREAM_FAILED');
  });
});
