import { AgentRunBudgetTracker } from '../ai-agent/core/agent-run-context';
import type { LLMResponse } from '../ai-agent/core/llm.service';
import { routingFixture } from '../ai-agent/routing/model-routing.fixtures';
import { routingHash } from '../ai-agent/routing/model-routing.policy';
import {
  AnalysisSegmentError,
  callApplicationAnalysis,
  isSegmentedAnalysis,
} from './analysis-segments';
import {
  mergeAnalysisSegments,
  parseAnalysisSegment,
} from './analysis-segments.contract';
import {
  segmentExamples as ex,
  syntheticAnalysisSnapshot,
} from './analysis-segments.fixtures';
import { analysisAcademicFacts } from './analysis-segments.input';

function budget() {
  const policy = routingFixture();
  for (const task of ['analysis.school', 'analysis.portfolio'] as const) {
    policy.routes[task]!.execution = 'segmented';
    policy.routes[task]!.timeoutMs = 30000;
  }
  return new AgentRunBudgetTracker({
    version: 1,
    maxTokens: 24000,
    maxDurationMs: 120000,
    maxToolCalls: 16,
    maxSupplementalRounds: 2,
    routing: { version: 1, policy, hash: routingHash(policy) },
  });
}
const input = {
  schoolId: 'SYN_SCHOOL_0',
  allowedEvidenceIds: ['SYN_E_0'],
  prediction: { probability: 0.18 },
};
function response(value: unknown): LLMResponse {
  return {
    content: JSON.stringify(value),
    finishReason: 'stop',
    usage: {
      model: 'gpt-5.5',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      estimatedCost: 0.001,
    },
  };
}

describe('Analysis segment contracts and orchestration', () => {
  it('limits segmentation using the frozen school count policy and rejects unknown counts', async () => {
    const runBudget = budget();
    runBudget.limits.routing!.policy.routes[
      'analysis.school'
    ]!.segmentationMaxSchools = 1;
    expect(isSegmentedAnalysis(runBudget, 'analysis.school', 1)).toBe(true);
    for (const count of [undefined, 0, 2, 5, NaN])
      expect(isSegmentedAnalysis(runBudget, 'analysis.school', count)).toBe(
        false,
      );
    const llm = {
      call: jest.fn().mockResolvedValue(response({ summary: 'legacy' })),
    };
    const result = await callApplicationAnalysis(
      llm,
      'analysis.school',
      input,
      'en',
      { runBudget, timeoutMs: 12000 },
      3,
    );
    expect(llm.call).toHaveBeenCalledTimes(1);
    expect(llm.call.mock.calls[0][2].timeoutMs).toBeLessThanOrEqual(30000);
    expect(llm.call.mock.calls[0][2].timeoutMs).toBeGreaterThan(12000);
    expect(result.segments).toBeUndefined();
  });
  it('allows four distinct recourse constraints but still rejects a fifth', () => {
    const value = {
      ...ex.schoolActions,
      recourse: {
        ...ex.schoolActions.recourse,
        constraints: ['International', 'Aid needed', 'Reach', 'Test blind'],
      },
    };
    expect(
      parseAnalysisSegment(
        'analysis.school',
        'actions',
        JSON.stringify(value),
        ['SYN_E_0'],
      ),
    ).toBeDefined();
    value.recourse.constraints.push('Fifth');
    expect(
      parseAnalysisSegment(
        'analysis.school',
        'actions',
        JSON.stringify(value),
        ['SYN_E_0'],
      ),
    ).toBeUndefined();
  });
  it('splits a smaller caller output budget without increasing it', async () => {
    const llm = {
      call: jest
        .fn()
        .mockResolvedValueOnce(response(ex.schoolAssessment))
        .mockResolvedValueOnce(response(ex.schoolActions)),
    };
    await callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
      runBudget: budget(),
      maxTokens: 600,
    });
    expect(llm.call.mock.calls.map((c) => c[2].maxTokens)).toEqual([320, 280]);
  });
  it.each([1, 500, 511])(
    'rejects output budget %s before calling a model',
    async (maxTokens) => {
      const llm = { call: jest.fn() };
      await expect(
        callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
          runBudget: budget(),
          maxTokens,
        }),
      ).rejects.toThrow('ANALYSIS_SEGMENT_OUTPUT_BUDGET_INVALID');
      expect(llm.call).not.toHaveBeenCalled();
    },
  );
  it('splits the smallest valid budget into two router-compatible reservations', async () => {
    const llm = {
      call: jest
        .fn()
        .mockResolvedValueOnce(response(ex.schoolAssessment))
        .mockResolvedValueOnce(response(ex.schoolActions)),
    };
    await callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
      runBudget: budget(),
      maxTokens: 512,
    });
    expect(llm.call.mock.calls.map((c) => c[2].maxTokens)).toEqual([256, 256]);
  });
  it.each([
    ['analysis.school', 'assessment', ex.schoolAssessment],
    ['analysis.school', 'actions', ex.schoolActions],
    ['analysis.portfolio', 'assessment', ex.portfolioAssessment],
    ['analysis.portfolio', 'actions', ex.portfolioActions],
  ] as const)('accepts the exact %s %s schema', (task, stage, value) => {
    expect(
      parseAnalysisSegment(task, stage, JSON.stringify(value), ['SYN_E_0']),
    ).toEqual(value);
  });
  it.each([
    ['malformed', 'bad JSON'],
    ['missing fields', '{}'],
    [
      'invented probability field',
      JSON.stringify({ ...ex.schoolAssessment, probability: 0.99 }),
    ],
    [
      'invented evidence',
      JSON.stringify({ ...ex.schoolAssessment, evidenceIds: ['FAKE'] }),
    ],
    [
      'missing binding',
      JSON.stringify({ ...ex.schoolAssessment, evidenceIds: [] }),
    ],
    [
      'new prose probability',
      JSON.stringify({ ...ex.schoolAssessment, summary: 'You have 99% odds.' }),
    ],
    [
      'Chinese prose probability',
      JSON.stringify({
        ...ex.schoolAssessment,
        summary: '录取概率百分之九十九。',
      }),
    ],
    [
      'additional tool',
      JSON.stringify({ ...ex.schoolAssessment, toolCalls: [] }),
    ],
    [
      'oversized list',
      JSON.stringify({ ...ex.schoolAssessment, topGaps: ['a', 'b', 'c', 'd'] }),
    ],
  ])('rejects %s', (_name, content) => {
    expect(
      parseAnalysisSegment('analysis.school', 'assessment', content, [
        'SYN_E_0',
      ]),
    ).toBeUndefined();
  });
  it('deduplicates evidence and unknowns without overwriting assessment fields', () => {
    expect(
      mergeAnalysisSegments(ex.schoolAssessment, ex.schoolActions),
    ).toMatchObject({
      summary: ex.schoolAssessment.summary,
      nextActions: ex.schoolActions.nextActions,
      evidenceIds: ['SYN_E_0'],
      unknowns: ['Aid policy is unknown.'],
    });
  });
  it('preserves the legacy one-call path', async () => {
    const llm = {
      call: jest.fn().mockResolvedValue(response({ summary: 'legacy' })),
    };
    const result = await callApplicationAnalysis(
      llm,
      'analysis.school',
      input,
      'en',
      { timeoutMs: 12000 },
    );
    expect(llm.call).toHaveBeenCalledTimes(1);
    expect(llm.call.mock.calls[0][2]).toMatchObject({ timeoutMs: 12000 });
    expect(result.segments).toBeUndefined();
  });
  it('runs sequential stages with a shared deadline, bounded output, usage and audit', async () => {
    jest.useFakeTimers();
    try {
      const llm = {
        call: jest
          .fn()
          .mockImplementationOnce(async () => {
            jest.advanceTimersByTime(7000);
            return response(ex.schoolAssessment);
          })
          .mockResolvedValueOnce(response(ex.schoolActions)),
      };
      const runBudget = budget();
      const result = await callApplicationAnalysis(
        llm,
        'analysis.school',
        input,
        'en',
        { runBudget },
      );
      expect(llm.call.mock.calls[0][2]).toMatchObject({
        segment: 'assessment',
        timeoutMs: 30000,
        maxTokens: 800,
        runBudget,
      });
      expect(llm.call.mock.calls[1][2]).toMatchObject({
        segment: 'actions',
        timeoutMs: 23000,
        maxTokens: 700,
        runBudget,
      });
      expect(
        JSON.parse(llm.call.mock.calls[1][1][0].content).priorStage,
      ).toEqual(ex.schoolAssessment);
      expect(result.usage).toMatchObject({
        promptTokens: 20,
        completionTokens: 40,
        totalTokens: 60,
        estimatedCost: 0.002,
      });
      expect(result.segments).toHaveLength(2);
      expect(
        result.segments?.every((s) => /^[a-f0-9]{64}$/.test(s.promptHash)),
      ).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
  it.each([0, 1])(
    'retains failure at stage %i and never replays successful work',
    async (failed) => {
      const llm = { call: jest.fn() };
      if (failed) llm.call.mockResolvedValueOnce(response(ex.schoolAssessment));
      llm.call.mockRejectedValueOnce(new Error('PRIVATE upstream detail'));
      let error: AnalysisSegmentError | undefined;
      try {
        await callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
          runBudget: budget(),
        });
      } catch (e) {
        error = e as AnalysisSegmentError;
      }
      expect(error?.code).toBe('ANALYSIS_SEGMENT_FAILED');
      expect(error?.segments).toHaveLength(failed + 1);
      expect(error?.segments.at(-1)?.status).toBe('failed');
      expect(JSON.stringify(error)).not.toContain('PRIVATE');
      expect(llm.call).toHaveBeenCalledTimes(failed + 1);
    },
  );
  it('does not launch the second stage after its shared deadline', async () => {
    jest.useFakeTimers();
    try {
      const llm = {
        call: jest.fn().mockImplementation(async () => {
          jest.advanceTimersByTime(30001);
          return response(ex.schoolAssessment);
        }),
      };
      await expect(
        callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
          runBudget: budget(),
        }),
      ).rejects.toThrow('DEADLINE_EXCEEDED');
      expect(llm.call).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
  it('enforces final business validation instead of trusting two valid fragments', async () => {
    const llm = {
      call: jest
        .fn()
        .mockResolvedValueOnce(response(ex.schoolAssessment))
        .mockResolvedValueOnce(response(ex.schoolActions)),
    };
    await expect(
      callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
        runBudget: budget(),
        validateOutput: () => false,
      }),
    ).rejects.toThrow('MERGE_INVALID');
  });
  it('rejects length or tool output even when the transport mock skips its validator', async () => {
    const llm = {
      call: jest.fn().mockResolvedValue({
        ...response(ex.schoolAssessment),
        finishReason: 'length',
      }),
    };
    await expect(
      callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
        runBudget: budget(),
      }),
    ).rejects.toThrow('OUTPUT_INVALID');
    expect(llm.call).toHaveBeenCalledTimes(1);
  });
  it('projects existing academic facts without names, essays, IDs or raw metadata', () => {
    const snap = syntheticAnalysisSnapshot();
    const facts = analysisAcademicFacts(snap.profile!, snap.focusSchools[0]);
    expect(facts.applicantFacts).toMatchObject({
      gpa: 3.7,
      testScores: [{ type: 'SAT', score: 1420 }],
    });
    expect(facts.schoolFacts.sat25).toBe(1480);
    expect(JSON.stringify(facts)).not.toMatch(
      /SYN_USER|SYN_PROFILE|essays|metadata/,
    );
  });
});
