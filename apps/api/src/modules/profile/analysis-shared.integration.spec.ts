import { ConfigService } from '@nestjs/config';
import { LLMService } from '../ai-agent/core/llm.service';
import { OpenAIProvider } from '../ai-agent/providers/openai.provider';
import { ModelRouterService } from '../ai-agent/routing/model-router.service';
import { routingFixture } from '../ai-agent/routing/model-routing.fixtures';
import {
  routingPolicySchema,
  routingHash,
} from '../ai-agent/routing/model-routing.policy';
import { ProfileApplicationAnalysisV2Service } from './profile-application-analysis-v2.service';
import {
  segmentExamples as ex,
  syntheticAnalysisSnapshot,
} from './analysis-segments.fixtures';

function sharedPolicy() {
  const policy = routingFixture();
  policy.models['gpt-5.5'].maxOutputTokens = 3000;
  for (const task of ['analysis.school', 'analysis.portfolio'] as const) {
    policy.routes[task] = {
      ...policy.routes[task]!,
      execution: 'single',
      analysisOptimization:
        task === 'analysis.school' ? 'shared-v1' : 'compact-v1',
      timeoutMs: 30000,
      maxOutputTokens: task === 'analysis.school' ? 3000 : 1500,
    };
  }
  return policy;
}
describe('shared school analysis real service integration', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  function setup(
    failFirst = false,
    maxTokens = 24000,
    delayedPersistence = false,
  ) {
    const config = new ConfigService({
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: 'synthetic',
      OPENAI_BASE_URL: 'https://relay.example/v1',
      AI_AGENT_MODEL_ROUTING_V1: 'true',
      AI_AGENT_MODEL_ROUTING_CONFIG: JSON.stringify(sharedPolicy()),
      AI_AGENT_MAX_TOKENS_PER_RUN: maxTokens,
      AI_AGENT_MAX_DURATION_MS: 120000,
    });
    const provider = new OpenAIProvider(config),
      router = new ModelRouterService(config, provider);
    const llm = new LLMService(
      config,
      provider,
      undefined,
      undefined,
      undefined,
      router,
    );
    const prisma = {
      applicationAnalysisSchoolCard: {
        create: jest.fn().mockResolvedValue({}),
      },
      applicationAnalysisRun: {
        create: jest.fn().mockResolvedValue({ id: 'SYN_RUN' }),
        update: jest.fn().mockResolvedValue({}),
      },
      applicationAnalysisStepRun: {
        create: jest.fn(
          async ({
            data,
          }: {
            data: { stepName: string; latencyMs: number };
          }) => {
            if (
              delayedPersistence &&
              data.stepName.startsWith('school_analyst:')
            )
              await new Promise((resolve) =>
                setTimeout(resolve, data.stepName.endsWith('_1') ? 35 : 1),
              );
            return {
              id: `SYN_STEP_${data.stepName}`,
              latencyMs: data.latencyMs,
            };
          },
        ),
      },
    };
    const service = new ProfileApplicationAnalysisV2Service(
      prisma as never,
      {} as never,
      {} as never,
      llm,
      {} as never,
    );
    let n = 0;
    const fetchMock = jest.fn(async (_url: unknown, init: RequestInit) => {
      if (typeof init.body !== 'string') throw new Error('Expected JSON body');
      const body = JSON.parse(init.body),
        input = JSON.parse(body.messages[1].content);
      n++;
      const isShared =
        body.response_format.json_schema.name === 'analysis_school_shared';
      const value =
        failFirst && n === 1
          ? {}
          : isShared
            ? {
                schools: [...input.schools]
                  .reverse()
                  .map(
                    (s: {
                      schoolId: string;
                      allowedEvidenceIds: string[];
                    }) => ({
                      schoolId: s.schoolId,
                      analysis: {
                        ...ex.schoolAssessment,
                        ...ex.schoolActions,
                        evidenceIds: s.allowedEvidenceIds,
                      },
                    }),
                  ),
              }
            : body.response_format.json_schema.name ===
                'analysis_school_complete'
              ? {
                  ...ex.schoolAssessment,
                  ...ex.schoolActions,
                  evidenceIds: input.allowedEvidenceIds,
                }
              : { ...ex.portfolioAssessment, ...ex.portfolioActions };
      return new Response(
        `data: ${JSON.stringify({ model: body.model, choices: [{ index: 0, delta: { content: JSON.stringify(value) }, finish_reason: 'stop' }], usage: { prompt_tokens: 3600, completion_tokens: 800, total_tokens: 4400 } })}\n\ndata: [DONE]\n\n`,
      );
    });
    global.fetch = fetchMock as typeof fetch;
    return { service, fetchMock, prisma };
  }
  it.each([1, 2, 3, 5])(
    'completes %i schools preserving order, probabilities and per-school evidence within 24k',
    async (count) => {
      const { service, fetchMock } = setup();
      const result = await service['generateFromSnapshot'](
        syntheticAnalysisSnapshot(count),
        { mode: 'live', persistRun: false, debug: true },
      );
      expect(result.status).toBe('fresh');
      expect(result.debug?.validationErrors).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(Math.ceil(count / 2) + 1);
      expect(result.schools.map((s) => s.schoolId)).toEqual(
        Array.from({ length: count }, (_, i) => `SYN_SCHOOL_${i}`),
      );
      expect(
        result.schools.every((s) => s.prediction?.probability === 0.18),
      ).toBe(true);
      expect(
        result.schools.every((s, i) =>
          s.evidenceIds.every((e) => e === `SYN_E_${i}`),
        ),
      ).toBe(true);
    },
  );
  it('degrades only the failing pair, preserves later valid schools and never retries the pair', async () => {
    const { service, fetchMock } = setup(true);
    const result = await service['generateFromSnapshot'](
      syntheticAnalysisSnapshot(5),
      { mode: 'live', persistRun: false, debug: true },
    );
    expect(result.status).toBe('degraded');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.schools[2].assessment.summary).toBe(
      ex.schoolAssessment.summary,
    );
    expect(
      result.schools.every((s) => s.prediction?.probability === 0.18),
    ).toBe(true);
  });
  it('keeps exactly 2/2/1 groups with persisted steps completing at different times', async () => {
    const { service, fetchMock, prisma } = setup(false, 24000, true);
    const result = await service['generateFromSnapshot'](
      syntheticAnalysisSnapshot(5),
      { mode: 'live', persistRun: true, debug: true },
    );
    expect(result.status).toBe('fresh');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(prisma.applicationAnalysisRun.update).toHaveBeenCalled();
    const sharedInputs = fetchMock.mock.calls
      .map(([, init]) => JSON.parse(String(init.body)))
      .filter(
        (body) =>
          body.response_format.json_schema.name === 'analysis_school_shared',
      )
      .map((body) =>
        JSON.parse(body.messages[1].content).schools.map(
          (school: { schoolId: string }) => school.schoolId,
        ),
      );
    expect(sharedInputs).toEqual([
      ['SYN_SCHOOL_0', 'SYN_SCHOOL_1'],
      ['SYN_SCHOOL_2', 'SYN_SCHOOL_3'],
      ['SYN_SCHOOL_4'],
    ]);
  });
  it('fails closed before HTTP for insufficient shared budget', async () => {
    const { service, fetchMock } = setup(false, 1);
    const result = await service['generateFromSnapshot'](
      syntheticAnalysisSnapshot(5),
      { mode: 'live', persistRun: false },
    );
    expect(result.status).toBe('degraded');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rejects unsupported shared modes and preserves legacy policy hash', () => {
    const legacy = routingFixture();
    expect(routingHash(routingPolicySchema.parse(legacy))).toBe(
      routingHash(legacy),
    );
    const policy = sharedPolicy();
    expect(routingPolicySchema.safeParse(policy).success).toBe(true);
    policy.routes['analysis.school']!.execution = 'segmented';
    expect(routingPolicySchema.safeParse(policy).success).toBe(false);
    policy.routes['analysis.school']!.execution = 'single';
    policy.routes['analysis.school']!.maxOutputTokens = 1500;
    expect(routingPolicySchema.safeParse(policy).success).toBe(false);
  });
});
