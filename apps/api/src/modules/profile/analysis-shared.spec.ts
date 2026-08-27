import { AgentRunBudgetTracker } from '../ai-agent/core/agent-run-context';
import { routingFixture } from '../ai-agent/routing/model-routing.fixtures';
import { routingHash } from '../ai-agent/routing/model-routing.policy';
import { SharedSchoolAnalysis, allocateUsage } from './analysis-shared';
import { parseSharedSchools } from './analysis-shared.contract';
import { segmentExamples as ex } from './analysis-segments.fixtures';

const inputs = ['a', 'b'].map((schoolId) => ({
  schoolId,
  profileSummary: {},
  applicantFacts: { gpa: null },
  allowedEvidenceIds: [`e-${schoolId}`],
}));
const response = (ids = ['a', 'b']) =>
  JSON.stringify({
    schools: ids.map((schoolId) => ({
      schoolId,
      analysis: {
        ...ex.schoolAssessment,
        ...ex.schoolActions,
        evidenceIds: [`e-${schoolId}`],
      },
    })),
  });
function setup() {
  const policy = routingFixture();
  policy.models['gpt-5.5'].maxOutputTokens = 3000;
  policy.routes['analysis.school'] = {
    ...policy.routes['analysis.school']!,
    execution: 'single',
    analysisOptimization: 'shared-v1',
    maxOutputTokens: 3000,
  };
  const budget = new AgentRunBudgetTracker({
    version: 1,
    maxTokens: 24000,
    maxDurationMs: 120000,
    maxToolCalls: 16,
    maxSupplementalRounds: 2,
    routing: { version: 1, policy, hash: routingHash(policy) },
  });
  const call = jest.fn().mockImplementation(async (_system, messages) => {
    const data = JSON.parse(messages[0].content);
    return {
      content: response(
        data.schools.map((s: { schoolId: string }) => s.schoolId),
      ),
      finishReason: 'stop',
      usage: {
        model: 'gpt-5.5',
        promptTokens: 301,
        completionTokens: 203,
        totalTokens: 504,
      },
    };
  });
  const shared = new SharedSchoolAnalysis({ call }, budget, 'en');
  const options = {
    userId: 'synthetic-user',
    runBudget: budget,
    maxTokens: 1500,
  };
  return { call, shared, budget, options };
}

describe('shared school request boundary', () => {
  it('coalesces two schools with one common context, strict schema and one usage allocation', async () => {
    const { shared, options, call } = setup();
    const results = await Promise.all(
      inputs.map((input) => shared.call(input, options)),
    );
    expect(call).toHaveBeenCalledTimes(1);
    const [, messages, opts] = call.mock.calls[0];
    const input = JSON.parse(messages[0].content);
    expect(input.applicantFacts).toEqual({ gpa: null });
    expect(input.schools.every((s: object) => !('applicantFacts' in s))).toBe(
      true,
    );
    expect(opts.maxTokens).toBe(3000);
    expect(opts.providerOptions.response_format.json_schema.strict).toBe(true);
    expect(results.reduce((sum, r) => sum + r.usage!.totalTokens, 0)).toBe(504);
    expect(results[0].segments![0].promptHash).toBe(
      results[1].segments![0].promptHash,
    );
    expect(results.map((r) => r.segments![0].batch)).toEqual([
      { size: 2, index: 0 },
      { size: 2, index: 1 },
    ]);
  });
  it('flushes a single school without a timer or waiting for another request', async () => {
    const { shared, options, call } = setup();
    await expect(shared.call(inputs[0], options)).resolves.toMatchObject({
      finishReason: 'stop',
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0][2].maxTokens).toBe(1500);
  });
  it('flushes five synchronous callers in bounded 2/2/1 groups', async () => {
    const { shared, options, call } = setup();
    const result = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        shared.call(
          { ...inputs[0], schoolId: String(i), allowedEvidenceIds: [`e-${i}`] },
          options,
        ),
      ),
    );
    expect(result).toHaveLength(5);
    expect(call).toHaveBeenCalledTimes(3);
    expect(
      call.mock.calls.map(
        ([, messages]) => JSON.parse(messages[0].content).schools.length,
      ),
    ).toEqual([2, 2, 1]);
  });
  it('does not mix users or budgets', async () => {
    const { shared, options, call } = setup();
    const first = shared.call(inputs[0], options);
    await expect(
      shared.call(inputs[1], { ...options, userId: 'other' }),
    ).rejects.toThrow('SCOPE_INVALID');
    await expect(
      shared.call(inputs[1], { ...options, runBudget: undefined }),
    ).rejects.toThrow('SCOPE_INVALID');
    await first;
    expect(call).toHaveBeenCalledTimes(1);
  });
  it.each(['duplicate', 'facts'] as const)(
    'rejects %s before network',
    async (kind) => {
      const { shared, options, call } = setup();
      const second =
        kind === 'duplicate'
          ? inputs[0]
          : { ...inputs[1], applicantFacts: { gpa: 4 } };
      const results = await Promise.allSettled([
        shared.call(inputs[0], options),
        shared.call(second, options),
      ]);
      expect(results.every((r) => r.status === 'rejected')).toBe(true);
      expect(call).not.toHaveBeenCalled();
    },
  );
  it.each(['length', 'content_filter', 'stop'] as const)(
    'fails closed on %s/invalid output without split retry',
    async (finishReason) => {
      const { shared, options, call } = setup();
      call.mockResolvedValue({ content: '{}', finishReason });
      const result = await Promise.allSettled(
        inputs.map((input) => shared.call(input, options)),
      );
      expect(result.every((r) => r.status === 'rejected')).toBe(true);
      expect(call).toHaveBeenCalledTimes(1);
    },
  );
  it('requires each school business validator, even when the mock bypasses provider validation', async () => {
    const { shared, options, call } = setup();
    const result = await Promise.allSettled(
      inputs.map((input) =>
        shared.call(input, { ...options, validateOutput: () => false }),
      ),
    );
    expect(result.every((r) => r.status === 'rejected')).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('settles every caller after timeout/rejection', async () => {
    const { shared, options, call } = setup();
    call.mockRejectedValue(new Error('timeout'));
    const result = await Promise.allSettled(
      inputs.map((input) => shared.call(input, options)),
    );
    expect(result.every((r) => r.status === 'rejected')).toBe(true);
  });
  it('accepts reversed order but rejects unknown, duplicate, missing and crossed evidence', () => {
    expect(parseSharedSchools(response(['b', 'a']), inputs)?.size).toBe(2);
    for (const ids of [['a', 'c'], ['a', 'a'], ['a']])
      expect(parseSharedSchools(response(ids), inputs)).toBeUndefined();
    expect(
      parseSharedSchools(response().replace('"e-a"', '"e-b"'), inputs),
    ).toBeUndefined();
  });
  it('preserves component totals even with odd usage counts', () => {
    const usage = {
      model: 'gpt-5.4',
      promptTokens: 101,
      completionTokens: 33,
      totalTokens: 134,
      estimatedCost: 0.01,
    };
    const parts = [0, 1].map((i) => allocateUsage(usage, 2, i)!);
    expect(parts.reduce((s, p) => s + p.totalTokens, 0)).toBe(134);
    expect(
      parts.every((p) => p.promptTokens + p.completionTokens === p.totalTokens),
    ).toBe(true);
  });
});
