import { ConfigService } from '@nestjs/config';
import { LLMService } from '../ai-agent/core/llm.service';
import { OpenAIProvider } from '../ai-agent/providers/openai.provider';
import { ModelRouterService } from '../ai-agent/routing/model-router.service';
import { routingFixture } from '../ai-agent/routing/model-routing.fixtures';
import { ProfileApplicationAnalysisV2Service } from './profile-application-analysis-v2.service';
import {
  segmentExamples as ex,
  syntheticAnalysisSnapshot,
} from './analysis-segments.fixtures';

function setup(segmentationMaxSchools?: number, compact = false) {
  const policy = routingFixture();
  for (const model of Object.values(policy.models))
    model.reasoningEfforts = ['none', 'low'];
  for (const task of ['analysis.school', 'analysis.portfolio'] as const) {
    policy.routes[task] = {
      ...policy.routes[task]!,
      execution: 'segmented',
      ...(compact ? { analysisOptimization: 'compact-v1' as const } : {}),
      reasoningEffort: 'none',
      maxOutputTokens: 1500,
      timeoutMs: 30000,
      ...(segmentationMaxSchools === undefined
        ? {}
        : { segmentationMaxSchools }),
    };
  }
  const config = new ConfigService({
    LLM_PROVIDER: 'openai',
    AI_AGENT_MODEL_ROUTING_V1: 'true',
    AI_AGENT_MODEL_ROUTING_CONFIG: JSON.stringify(policy),
    OPENAI_API_KEY: 'synthetic',
    OPENAI_BASE_URL: 'https://relay.example/v1',
  });
  const provider = new OpenAIProvider(config);
  const router = new ModelRouterService(config, provider);
  const llm = new LLMService(
    config,
    provider,
    undefined,
    undefined,
    undefined,
    router,
  );
  const service = new ProfileApplicationAnalysisV2Service(
    {} as never,
    {} as never,
    {} as never,
    llm,
    {} as never,
  );
  return { service, llm, router, config, policy };
}
function streamResponse(model: string, content: string) {
  return new Response(
    `data: ${JSON.stringify({
      model,
      choices: [{ index: 0, delta: { content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    })}\n\ndata: [DONE]\n\n`,
  );
}

describe('Profile → LLMService → router → OpenAI SSE segmented integration', () => {
  const originalFetch = global.fetch;
  const originalTokenLimit = process.env.AI_AGENT_MAX_TOKENS_PER_RUN;
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalTokenLimit === undefined)
      delete process.env.AI_AGENT_MAX_TOKENS_PER_RUN;
    else process.env.AI_AGENT_MAX_TOKENS_PER_RUN = originalTokenLimit;
  });
  function fakeProvider(
    failStage?: 'assessment' | 'actions',
    single = false,
    failSchool?: string,
  ) {
    let active = 0,
      peak = 0;
    const fetchMock = jest
      .fn()
      .mockImplementation(async (_url: unknown, init: RequestInit) => {
        if (typeof init.body !== 'string') throw Error('Expected JSON body');
        const body = JSON.parse(init.body);
        const prompt = body.messages[1].content as string;
        const input = JSON.parse(prompt.slice(prompt.indexOf('{')));
        const school = !Array.isArray(input.schools);
        const actions = !!input.priorStage;
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        if (
          school &&
          (!failSchool || input.schoolId === failSchool) &&
          failStage === (actions ? 'actions' : 'assessment')
        )
          return streamResponse(body.model, '{}');
        const value = school
          ? {
              ...(single
                ? { ...ex.schoolAssessment, ...ex.schoolActions }
                : actions
                  ? ex.schoolActions
                  : ex.schoolAssessment),
              evidenceIds: input.allowedEvidenceIds,
            }
          : single
            ? { ...ex.portfolioAssessment, ...ex.portfolioActions }
            : actions
              ? ex.portfolioActions
              : ex.portfolioAssessment;
        return streamResponse(body.model, JSON.stringify(value));
      });
    global.fetch = fetchMock as typeof fetch;
    return { fetchMock, peak: () => peak };
  }
  it('uses single calls for multi-school runs under the recommended segmentation limit', async () => {
    const { service } = setup(1);
    const { fetchMock } = fakeProvider(undefined, true);
    const result = await service['generateFromSnapshot'](
      syntheticAnalysisSnapshot(3),
      { mode: 'live', persistRun: false, debug: true },
    );
    expect(result.status).toBe('fresh');
    expect(result.debug?.validationErrors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it('retains valid schools but marks partial segmented failures degraded', async () => {
    const { service } = setup();
    const { fetchMock } = fakeProvider('actions', false, 'SYN_SCHOOL_0');
    const result = await service['generateFromSnapshot'](
      syntheticAnalysisSnapshot(3),
      { mode: 'live', persistRun: false, debug: true },
    );
    expect(result.status).toBe('degraded');
    expect(result.meta.degradedReason).toBe('partialAnalysisFailed');
    expect(result.debug?.validationErrors.length).toBeGreaterThan(0);
    expect(result.schools[1].assessment.summary).toBe(
      ex.schoolAssessment.summary,
    );
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });
  it('serves five schools with twelve bounded calls, preserving probability and response shape', async () => {
    const { service } = setup();
    const { fetchMock, peak } = fakeProvider();
    const response = await service['generateFromSnapshot'](
      syntheticAnalysisSnapshot(5),
      { mode: 'live', persistRun: false, debug: true },
    );
    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(peak()).toBeLessThanOrEqual(5);
    expect(response.status).toBe('fresh');
    expect(response.schools).toHaveLength(5);
    expect(
      response.schools.every((s) => s.prediction?.probability === 0.18),
    ).toBe(true);
    expect(response.schools[0].assessment.summary).toBe(
      ex.schoolAssessment.summary,
    );
    expect(response.schools[0].recourse?.recommendedChanges).toHaveLength(1);
    expect(response.portfolioSummary.balance).toBe('reachHeavy');
    const bodies = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse(String(init.body)),
    );
    expect(bodies.every((body) => body.reasoning_effort === 'none')).toBe(true);
    expect(bodies.every((body) => body.model === 'gpt-5.5')).toBe(true);
    expect(bodies.map((body) => body.max_completion_tokens).sort()).toEqual([
      500, 500, 700, 700, 700, 700, 700, 800, 800, 800, 800, 800,
    ]);
  });
  it.each(['assessment', 'actions'] as const)(
    'exposes %s failure, skips downstream synthesis and preserves deterministic facts',
    async (stage) => {
      const { service } = setup();
      const { fetchMock } = fakeProvider(stage);
      const response = await service['generateFromSnapshot'](
        syntheticAnalysisSnapshot(),
        { mode: 'live', persistRun: false },
      );
      expect(fetchMock).toHaveBeenCalledTimes(stage === 'assessment' ? 1 : 2);
      expect(response.status).toBe('degraded');
      expect(response.meta.degradedReason).toBe('llmUnavailable');
      expect(response.schools[0].prediction?.probability).toBe(0.18);
    },
  );
  it('prevents provider access after the shared token budget is exhausted', async () => {
    const { llm, config } = setup();
    config.set('AI_AGENT_MAX_TOKENS_PER_RUN', 1);
    const { fetchMock } = fakeProvider();
    await expect(
      llm.call('Synthetic', [], {
        taskType: 'analysis.school',
        runBudget: llm.createRoutingBudget(),
      }),
    ).rejects.toThrow('TOKEN_BUDGET');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['single', 'segmented'] as const)(
    'compact %s preserves five-school facts through real serialization and normalization',
    async (execution) => {
      const { service, policy, config } = setup(undefined, true);
      for (const task of ['analysis.school', 'analysis.portfolio'] as const)
        policy.routes[task]!.execution = execution;
      config.set('AI_AGENT_MODEL_ROUTING_CONFIG', JSON.stringify(policy));
      const { fetchMock, peak } = fakeProvider(
        undefined,
        execution === 'single',
      );
      const result = await service['generateFromSnapshot'](
        syntheticAnalysisSnapshot(5),
        {
          mode: 'live',
          persistRun: false,
          debug: true,
        },
      );
      expect(result.debug?.validationErrors).toEqual([]);
      expect(result.status).toBe('fresh');
      expect(fetchMock).toHaveBeenCalledTimes(execution === 'single' ? 6 : 12);
      expect(peak()).toBeLessThanOrEqual(5);
      for (const [, init] of fetchMock.mock.calls) {
        const body = JSON.parse(String(init.body)),
          input = JSON.parse(body.messages[1].content);
        expect(body.response_format.json_schema.strict).toBe(true);
        expect(input.applicantFacts.gpa).toBe(3.7);
        expect(input.applicantFacts.needsFinancialAid).toBe(true);
        expect(input.deterministicAssessment).toBeUndefined();
        if (input.schools) {
          expect(input.schools).toHaveLength(5);
          expect(input.schools[0].assessment).toBeUndefined();
          expect(input.schools[0].policyCard.testingPolicy).toBe('REQUIRED');
        }
      }
      expect(
        result.schools.every((s) => s.prediction?.probability === 0.18),
      ).toBe(true);
    },
  );
  it.each(['unsupported', 'refusal'] as const)(
    'does not strip strict schema or rerun after %s',
    async (failure) => {
      const { service } = setup(undefined, true);
      const mock = jest
        .fn()
        .mockImplementation(async () =>
          failure === 'unsupported'
            ? new Response('{}', { status: 400 })
            : new Response(
                `data: ${JSON.stringify({ model: 'gpt-5.5', choices: [{ index: 0, delta: { refusal: 'refused' }, finish_reason: 'stop' }] })}\n\n`,
              ),
        );
      global.fetch = mock;
      const result = await service['generateFromSnapshot'](
        syntheticAnalysisSnapshot(),
        {
          mode: 'live',
          persistRun: false,
          debug: true,
        },
      );
      expect(result.status).toBe('degraded');
      expect(mock).toHaveBeenCalledTimes(1);
      expect(result.schools[0].prediction?.probability).toBe(0.18);
    },
  );
});
