import { createHash } from 'crypto';
import type { LLMService } from '../core/llm.service';
import { ROUTING_CASES } from './model-routing.fixtures';
import { ModelRoutingError } from './model-router.service';

/** Same-input transport/routing smoke comparison, deliberately not an admissions-quality score. */
export async function evaluateModelRouting(
  baseline: Pick<LLMService, 'call'>,
  candidate: Pick<LLMService, 'call'>,
  cases = ROUTING_CASES,
) {
  const rows = [];
  for (const item of cases) {
    const inputHash = createHash('sha256').update(item.prompt).digest('hex');
    const results = [];
    for (const [name, client] of [
      ['baseline', baseline],
      ['candidate', candidate],
    ] as const) {
      const start = Date.now();
      try {
        const result = await client.call(
          'Synthetic routing contract test. Follow the exact output constraint.',
          [
            {
              id: 'synthetic-eval',
              role: 'user',
              content: item.prompt,
              timestamp: new Date(0),
            },
          ],
          { taskType: item.task, maxTokens: 1000 },
        );
        results.push({
          name,
          passed: result.content.trim() === item.expected,
          model: result.routing?.model ?? result.usage?.model,
          policyHash: result.routing?.policyHash,
          attempts: result.routing?.attempt,
          returnedTokens: result.usage?.totalTokens,
          estimatedResponseCostUsd: result.usage?.estimatedCost,
          latencyMs: Date.now() - start,
        });
      } catch (error) {
        const failure = error instanceof ModelRoutingError ? error : undefined;
        results.push({
          name,
          passed: false,
          latencyMs: Date.now() - start,
          errorCode:
            failure?.code && /^[A-Z_]{1,80}$/.test(failure.code)
              ? failure.code
              : 'EVALUATION_FAILED',
          model: failure?.routing?.model,
          policyHash: failure?.routing?.policyHash,
          attempts: failure?.routing?.attempt,
        });
      }
    }
    rows.push({ task: item.task, inputHash, results });
  }
  return {
    datasetVersion: 'task-routing-contract-v1',
    scope: 'synthetic_contract_not_business_accuracy',
    rows,
  };
}
