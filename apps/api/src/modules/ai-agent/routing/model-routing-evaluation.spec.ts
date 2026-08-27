import { evaluateModelRouting } from './model-routing-evaluation';
import { ROUTING_CASES } from './model-routing.fixtures';
import type { LLMService } from '../core/llm.service';

it('compares identical task inputs without recording raw outputs or inventing quality metrics', async () => {
  const call = jest.fn().mockResolvedValue({ content: 'SYNTHETIC_A' });
  const client = { call } as Pick<LLMService, 'call'>;
  const result = await evaluateModelRouting(client, client);
  expect(result.rows).toHaveLength(ROUTING_CASES.length);
  for (let i = 0; i < ROUTING_CASES.length; i++) {
    expect(call.mock.calls[i * 2]).toEqual(call.mock.calls[i * 2 + 1]);
    expect(result.rows[i].results.every((r) => r.passed)).toBe(true);
  }
  expect(JSON.stringify(result)).not.toContain('SYNTHETIC_A');
  expect(result.scope).toBe('synthetic_contract_not_business_accuracy');
});
