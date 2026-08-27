import { AgentRunBudgetTracker } from '../ai-agent/core/agent-run-context';
import { routingFixture } from '../ai-agent/routing/model-routing.fixtures';
import {
  routingHash,
  routingPolicySchema,
} from '../ai-agent/routing/model-routing.policy';
import {
  compactAnalysisInput,
  compactSchoolResult,
  usesCompactAnalysis,
  withPortfolioReserve,
} from './analysis-compact';
import {
  analysisResponseFormat,
  analysisSchema,
  parseAnalysisSegment,
} from './analysis-segments.contract';
import { segmentExamples as ex } from './analysis-segments.fixtures';
import { callApplicationAnalysis } from './analysis-segments';
import type { ApplicationAnalysisSchoolResult } from '@study-abroad/shared';

function budget(maxTokens = 24000) {
  const policy = routingFixture();
  for (const task of ['analysis.school', 'analysis.portfolio'] as const) {
    policy.routes[task]!.execution = 'segmented';
    policy.routes[task]!.analysisOptimization = 'compact-v1';
  }
  return new AgentRunBudgetTracker({
    version: 1,
    maxTokens,
    maxDurationMs: 120000,
    maxToolCalls: 16,
    maxSupplementalRounds: 2,
    routing: { version: 1, policy, hash: routingHash(policy) },
  });
}

const input = {
  schoolId: 'SYN_SCHOOL',
  schoolName: 'Synthetic School',
  tier: 'REACH',
  round: 'ED',
  profileSummary: { applicantType: 'international', constraints: ['Need aid'] },
  applicantFacts: {
    gpa: 3.7,
    gpaScale: 4,
    testScores: [{ type: 'SAT', score: 1420 }],
    needsFinancialAid: true,
  },
  schoolFacts: { sat25: 1480, sat75: 1550 },
  policyCard: {
    testingPolicy: 'BLIND',
    intlAidPolicy: 'UNKNOWN',
    roundContext: 'ED',
    standardDeadline: '2026-12-01',
    policySourceQuality: 'official',
    evidenceIds: ['SYN_E_0'],
    unknowns: ['Costs unknown'],
    sources: [{ value: 'duplicate'.repeat(1000) }],
  },
  prediction: { probability: 0.18, confidence: 'low' },
  allowedEvidenceIds: ['SYN_E_0'],
  deterministicAssessment: { summary: 'duplicate'.repeat(1000) },
};

describe('compact analysis inputs and strict contracts', () => {
  it('preserves facts/constraints/IDs without repetitive display fields or raw probabilities', () => {
    const compact = compactAnalysisInput(
      'analysis.school',
      input,
      'assessment',
    );
    expect(compact).toMatchObject({
      profileSummary: input.profileSummary,
      applicantFacts: input.applicantFacts,
      schoolFacts: input.schoolFacts,
      round: 'ED',
      allowedEvidenceIds: ['SYN_E_0'],
      policyCard: {
        testingPolicy: 'BLIND',
        standardDeadline: '2026-12-01',
        unknowns: ['Costs unknown'],
      },
    });
    expect(JSON.stringify(compact)).not.toMatch(/duplicate|probability/);
    expect(JSON.stringify(compact).length).toBeLessThan(
      JSON.stringify(input).length / 2,
    );
    expect(compactAnalysisInput('analysis.school', input, 'complete')).toEqual(
      compact,
    );
    const action = compactAnalysisInput(
      'analysis.school',
      input,
      'actions',
      ex.schoolAssessment,
    );
    expect(action).toMatchObject({
      priorStage: {
        topGaps: ex.schoolAssessment.topGaps,
        uncertainty: ex.schoolAssessment.uncertainty,
      },
    });
    expect(action).not.toHaveProperty('priorStage.summary');
  });
  it('retains complete risk and action arrays in portfolio digest without raw sources or duplicate prose', () => {
    const school = {
      schoolId: 'SYN_SCHOOL',
      schoolName: 'Synthetic',
      tier: 'REACH',
      round: 'ED',
      policyCard: { ...input.policyCard, sources: [] },
      assessment: {
        ...ex.schoolAssessment,
        ...ex.schoolActions,
        historicalSignals: [],
      },
      recourse: ex.schoolActions.recourse,
      uncertainty: ex.schoolAssessment.uncertainty,
      unknowns: ex.schoolAssessment.unknowns,
      evidenceIds: ['SYN_E_0'],
    } as ApplicationAnalysisSchoolResult;
    const digest = compactSchoolResult(school);
    expect(digest).toMatchObject({
      tier: 'REACH',
      round: 'ED',
      topGaps: school.assessment.topGaps,
      nextActions: school.assessment.nextActions,
      constraints: school.recourse!.constraints,
      evidenceIds: ['SYN_E_0'],
      unknowns: school.unknowns,
    });
    expect(JSON.stringify(digest)).not.toMatch(
      /duplicate|whyThisIsHard|recommendedChanges/,
    );
  });
  it.each(['analysis.school', 'analysis.portfolio'] as const)(
    'uses a strict same-source schema for %s stages',
    (task) => {
      for (const stage of ['complete', 'assessment', 'actions'] as const) {
        const format = analysisResponseFormat(task, stage);
        expect(format.type).toBe('json_schema');
        expect(format.json_schema.strict).toBe(true);
        expect(format.json_schema.schema).toMatchObject({
          type: 'object',
          additionalProperties: false,
        });
        const value =
          task === 'analysis.school'
            ? stage === 'complete'
              ? { ...ex.schoolAssessment, ...ex.schoolActions }
              : stage === 'actions'
                ? ex.schoolActions
                : ex.schoolAssessment
            : stage === 'complete'
              ? { ...ex.portfolioAssessment, ...ex.portfolioActions }
              : stage === 'actions'
                ? ex.portfolioActions
                : ex.portfolioAssessment;
        expect(analysisSchema(task, stage).safeParse(value).success).toBe(true);
        expect(
          parseAnalysisSegment(task, stage, JSON.stringify(value), ['SYN_E_0']),
        ).toBeDefined();
        expect(
          parseAnalysisSegment(
            task,
            stage,
            JSON.stringify({ ...value, extra: true }),
            ['SYN_E_0'],
          ),
        ).toBeUndefined();
      }
    },
  );
  it('rejects incorrectly nested unknowns and percentage prose even in a complete response', () => {
    expect(
      analysisResponseFormat('analysis.school', 'complete').json_schema.schema,
    ).toMatchObject({
      properties: { summary: { pattern: '^[^%％]*$' } },
    });
    expect(
      parseAnalysisSegment(
        'analysis.portfolio',
        'complete',
        JSON.stringify({
          ...ex.portfolioAssessment,
          actionPlan: { ...ex.portfolioActions.actionPlan, unknowns: [] },
        }),
        [],
      ),
    ).toBeUndefined();
    expect(
      parseAnalysisSegment(
        'analysis.school',
        'complete',
        JSON.stringify({
          ...ex.schoolAssessment,
          ...ex.schoolActions,
          summary: '99% guaranteed',
        }),
        ['SYN_E_0'],
      ),
    ).toBeUndefined();
  });
  it('sets strict schema on both calls and independently validates even a stubbed transport', async () => {
    const llm = {
      call: jest
        .fn()
        .mockResolvedValueOnce({
          content: JSON.stringify(ex.schoolAssessment),
          finishReason: 'stop',
        })
        .mockResolvedValueOnce({
          content: JSON.stringify(ex.schoolActions),
          finishReason: 'stop',
        }),
    };
    await callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
      runBudget: budget(),
    });
    expect(llm.call).toHaveBeenCalledTimes(2);
    for (const call of llm.call.mock.calls) {
      expect(call[2].providerOptions.response_format.json_schema.strict).toBe(
        true,
      );
      expect(call[1][0].content).not.toContain('duplicate');
    }
  });
  it('compact single refuses malformed or truncated output without fallback retries', async () => {
    const b = budget();
    b.limits.routing!.policy.routes['analysis.school']!.execution = 'single';
    const llm = {
      call: jest
        .fn()
        .mockResolvedValue({ content: '{}', finishReason: 'length' }),
    };
    await expect(
      callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
        runBudget: b,
      }),
    ).rejects.toThrow('OUTPUT_INVALID');
    expect(llm.call).toHaveBeenCalledTimes(1);
  });
  it('binds complete-call audit hashes to the actual compact prompt and schema, including failures', async () => {
    const b = budget();
    b.limits.routing!.policy.routes['analysis.school']!.execution = 'single';
    const value = { ...ex.schoolAssessment, ...ex.schoolActions };
    const llm = {
      call: jest.fn().mockResolvedValue({
        content: JSON.stringify(value),
        finishReason: 'stop',
      }),
    };
    const result = await callApplicationAnalysis(
      llm,
      'analysis.school',
      input,
      'en',
      { runBudget: b },
    );
    expect(result.segments?.[0]).toMatchObject({
      segment: 'complete',
      status: 'completed',
    });
    const hash = result.segments![0].promptHash;
    const changed = await callApplicationAnalysis(
      llm,
      'analysis.school',
      { ...input, round: 'RD' },
      'en',
      { runBudget: b },
    );
    expect(changed.segments![0].promptHash).not.toBe(hash);
    llm.call.mockRejectedValueOnce(new Error('private upstream payload'));
    await expect(
      callApplicationAnalysis(llm, 'analysis.school', input, 'en', {
        runBudget: b,
      }),
    ).rejects.toMatchObject({
      code: 'ANALYSIS_SEGMENT_FAILED',
      segments: [{ segment: 'complete', status: 'failed', promptHash: hash }],
    });
  });
});

describe('future token holds', () => {
  it('holds within the original budget, settles consumption, and releases exactly once', () => {
    const b = budget(2000),
      release = b.holdTokensForLater(1000);
    const first = b.reserveLlmCall('', [], 2000);
    expect(first.outputTokens).toBe(1000);
    expect(() => b.reserveLlmCall('', [], 256)).toThrow('TOKEN_BUDGET');
    b.settleLlmCall(first, '', { totalTokens: 800 });
    expect(b.snapshot(0, 0).estimatedTokens).toBe(800);
    release();
    release();
    expect(b.reserveLlmCall('', [], 2000).outputTokens).toBe(1200);
    expect(() => b.reserveLlmCall('', [], 256)).toThrow('TOKEN_BUDGET');
  });
  it('handles nested holds, invalid amounts and over-requesting without increasing limits', () => {
    const b = budget(1000),
      a = b.holdTokensForLater(600),
      c = b.holdTokensForLater(9999);
    expect(() => b.reserveLlmCall('', [], 256)).toThrow('TOKEN_BUDGET');
    c();
    expect(b.reserveLlmCall('', [], 1000).outputTokens).toBe(400);
    a();
    expect(b.reserveLlmCall('', [], 1000).outputTokens).toBe(600);
    for (const bad of [-1, NaN, Infinity, 1.5])
      expect(() => b.holdTokensForLater(bad)).toThrow('HOLD_INVALID');
  });
  it('releases on failure and never persists holds as consumed tokens', async () => {
    const b = budget(24000);
    await expect(
      withPortfolioReserve(b, async () => {
        expect(b.snapshot(0, 0).estimatedTokens).toBe(0);
        expect(b.reserveLlmCall('', [], 24000).outputTokens).toBe(18000);
        throw Error('synthetic failure');
      }),
    ).rejects.toThrow('synthetic failure');
    expect(b.reserveLlmCall('', [], 10000).outputTokens).toBe(6000);
  });
  it('legacy policy has no hold and optimization is legal only on explicit analysis routes', async () => {
    const policy = routingFixture(),
      hash = routingHash(policy);
    expect(routingHash(routingPolicySchema.parse(policy))).toBe(hash);
    expect(usesCompactAnalysis(undefined, 'analysis.school')).toBe(false);
    policy.routes.general!.analysisOptimization = 'compact-v1';
    expect(routingPolicySchema.safeParse(policy).success).toBe(false);
    delete policy.routes.general!.analysisOptimization;
    policy.routes['analysis.school']!.analysisOptimization = 'compact-v1';
    expect(routingPolicySchema.safeParse(policy).success).toBe(false);
    const b = budget();
    delete b.limits.routing!.policy.routes['analysis.portfolio']!
      .analysisOptimization;
    await withPortfolioReserve(b, async () =>
      expect(b.reserveLlmCall('', [], 24000).outputTokens).toBe(24000),
    );
  });
});
