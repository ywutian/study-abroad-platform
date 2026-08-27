import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { LLMService } from '../core/llm.service';
import { ModelRouterService } from './model-router.service';
import { routingFixture } from './model-routing.fixtures';
import { OpenAIProvider } from '../providers/openai.provider';
import { validateEnv } from '../../../common/config/env.validation';
import { AgentRunService } from '../core/agent-run.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AgentType } from '../types';
import { LLMProvidersModule } from '../providers/provider.module';
import { TokenTrackerService } from '../core/token-tracker.service';
import { ResilienceService } from '../core/resilience.service';

const values = {
  NODE_ENV: 'test',
  LLM_PROVIDER: 'openai',
  AI_AGENT_MODEL_ROUTING_V1: 'true',
  AI_AGENT_HARNESS_V1: 'true',
  AI_AGENT_CONTEXT_V1: 'true',
  AI_AGENT_MODEL_ROUTING_CONFIG: JSON.stringify(routingFixture()),
  DATABASE_URL: 'postgresql://synthetic:synthetic@localhost:5432/synthetic',
  JWT_SECRET: 'synthetic-only-jwt-secret-for-unit-tests',
  JWT_REFRESH_SECRET: 'synthetic-only-refresh-secret-for-unit-tests',
};
function config(overrides: Record<string, unknown> = {}) {
  const all: Record<string, unknown> = {
    ...values,
    OPENAI_API_KEY: 'synthetic',
    OPENAI_BASE_URL: 'https://relay.example/v1',
    ...overrides,
  };
  return {
    get: (key: string, fallback?: unknown) => all[key] ?? fallback,
  } as ConfigService;
}
describe('Task router integration', () => {
  it('wires the router into the real global LLM module, not an optional undefined dependency', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        LLMProvidersModule.forRoot(),
      ],
    })
      .overrideProvider(ConfigService)
      .useValue(config())
      .overrideProvider(TokenTrackerService)
      .useValue({})
      .overrideProvider(ResilienceService)
      .useValue({})
      .compile();
    try {
      const service = module.get(LLMService);
      expect(
        service.createRoutingBudget()?.limits.routing?.policy.revision,
      ).toBe('synthetic-v1');
      expect(service.routingPolicyHash()).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await module.close();
    }
  });
  it('validates explicit enablement and rejects incomplete or cross-provider settings', () => {
    expect(validateEnv(values).AI_AGENT_MODEL_ROUTING_V1).toBe('true');
    expect(() =>
      validateEnv({ ...values, AI_AGENT_MODEL_ROUTING_CONFIG: '{}' }),
    ).toThrow('CONFIG_INVALID');
    expect(() =>
      validateEnv({ ...values, AI_AGENT_CONTEXT_V1: 'false' }),
    ).toThrow('requires Harness and Context');
    expect(() =>
      validateEnv({
        ...values,
        LLM_PROVIDER: 'anthropic',
        AI_AGENT_NATIVE_CLAUDE_V1: 'true',
        ANTHROPIC_MODEL: 'claude-sonnet-5',
        ANTHROPIC_API_KEY: 'synthetic',
      }),
    ).toThrow('CONFIG_INVALID');
  });
  it('persists the routing policy at AgentRun creation without a database migration', async () => {
    const create = jest.fn().mockImplementation(async (arg) => arg.data);
    const service = new AgentRunService(
      { agentRun: { create } } as unknown as PrismaService,
      config(),
    );
    const run = await service.createRun({
      userId: 'synthetic',
      conversationId: 'synthetic',
      agentType: AgentType.ORCHESTRATOR,
    });
    expect(run.budget).toMatchObject({
      routing: {
        policy: { revision: 'synthetic-v1' },
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    });
  });
  it('routes a business call through LLMService and the actual OpenAI stream aggregator', async () => {
    const cfg = config();
    const provider = new OpenAIProvider(cfg);
    const router = new ModelRouterService(cfg, provider);
    const service = new LLMService(
      cfg,
      provider,
      undefined,
      undefined,
      undefined,
      router,
    );
    const original = global.fetch;
    const fetchMock = jest
      .fn()
      .mockImplementation(async (_url, init: RequestInit) => {
        const body = JSON.parse(init.body as string);
        const stream =
          [
            {
              model: body.model,
              choices: [
                {
                  index: 0,
                  delta: { content: 'SYNTHETIC' },
                  finish_reason: 'stop',
                },
              ],
            },
            {
              choices: [],
              usage: {
                prompt_tokens: 2,
                completion_tokens: 2,
                total_tokens: 4,
              },
            },
          ]
            .map((v) => `data: ${JSON.stringify(v)}\n\n`)
            .join('') + 'data: [DONE]\n\n';
        return new Response(stream);
      });
    global.fetch = fetchMock as typeof fetch;
    try {
      const result = await service.call('Synthetic', [], {
        taskType: 'analysis.school',
      });
      expect(result.routing).toMatchObject({
        task: 'analysis.school',
        model: 'gpt-5.5',
      });
      expect(result.usage?.model).toBe('gpt-5.5');
      await expect(
        service.chatSimple([{ role: 'user', content: 'Synthetic' }], {
          taskType: 'memory.summary',
        }),
      ).resolves.toBe('SYNTHETIC');
      expect(
        fetchMock.mock.calls.map(
          ([, init]) => JSON.parse(init.body as string).model,
        ),
      ).toEqual(['gpt-5.5', 'gpt-5.4-mini']);
    } finally {
      global.fetch = original;
    }
  });
});
