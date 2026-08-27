import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { routingFixture } from './model-routing.fixtures';
import {
  parseRoutingSnapshot,
  routingHash,
  routingPolicySchema,
} from './model-routing.policy';
import { ModelRouterService } from './model-router.service';
import type { ILLMProvider } from '../providers/llm-provider.interface';
import type { LLMChatRequest } from '../providers/llm-provider.types';

describe('Frozen reasoning and execution policy', () => {
  it('validates the recommended server policy without expanding the model allowlist', () => {
    const policy = routingPolicySchema.parse(
      JSON.parse(
        readFileSync(
          resolve(
            __dirname,
            '../../../../../../docs/examples/ai-task-routing.recommended.json',
          ),
          'utf8',
        ),
      ),
    );
    expect(Object.keys(policy.models)).toEqual(['gpt-5.4', 'gpt-5.5']);
    expect(policy.routes['analysis.school']!.execution).toBe('single');
    expect(
      policy.routes['analysis.school']!.segmentationMaxSchools,
    ).toBeUndefined();
    const candidate = routingPolicySchema.parse(
      JSON.parse(
        readFileSync(
          resolve(
            __dirname,
            '../../../../../../docs/examples/ai-task-routing.segmented-candidate.json',
          ),
          'utf8',
        ),
      ),
    );
    expect(candidate.routes['analysis.school']!.segmentationMaxSchools).toBe(1);
    expect(policy.routes['memory.extract']!.models).toEqual(['gpt-5.4']);
  });
  it('rejects detached, zero or excessive segmentation limits', () => {
    const policy = routingFixture();
    policy.routes['analysis.school']!.segmentationMaxSchools = 1;
    expect(routingPolicySchema.safeParse(policy).success).toBe(false);
    policy.routes['analysis.school']!.execution = 'segmented';
    for (const count of [0, 6]) {
      policy.routes['analysis.school']!.segmentationMaxSchools = count;
      expect(routingPolicySchema.safeParse(policy).success).toBe(false);
    }
  });
  it('does not add defaults to or change old snapshot hashes', () => {
    const policy = routingFixture(),
      hash = routingHash(policy);
    expect(parseRoutingSnapshot({ version: 1, policy, hash })).toEqual({
      version: 1,
      policy,
      hash,
    });
  });
  it.each(['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const)(
    'accepts explicitly supported %s',
    (effort) => {
      const policy = routingFixture();
      policy.models['gpt-5.5'].reasoningEfforts = [effort];
      policy.routes['analysis.school']!.reasoningEffort = effort;
      expect(routingPolicySchema.safeParse(policy).success).toBe(true);
    },
  );
  it('rejects unsupported reasoning and execution outside analysis', () => {
    const policy = routingFixture();
    policy.routes['analysis.school']!.reasoningEffort = 'low';
    expect(routingPolicySchema.safeParse(policy).success).toBe(false);
    delete policy.routes['analysis.school']!.reasoningEffort;
    policy.routes.general!.execution = 'segmented';
    expect(routingPolicySchema.safeParse(policy).success).toBe(false);
  });
  it('uses frozen effort, records it, denies arbitrary overrides and revoked capability', async () => {
    const policy = routingFixture();
    policy.models['gpt-5.5'].reasoningEfforts = ['none', 'low'];
    policy.routes['analysis.school']!.reasoningEffort = 'none';
    const cfg = new ConfigService({
      LLM_PROVIDER: 'openai',
      AI_AGENT_MODEL_ROUTING_V1: 'true',
      AI_AGENT_MODEL_ROUTING_CONFIG: JSON.stringify(policy),
    });
    const chat = jest
      .fn()
      .mockImplementation(async (request: LLMChatRequest) => ({
        model: request.model,
        content: '{}',
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      }));
    const provider = {
      providerId: 'openai',
      supportsModel: () => true,
      chat,
    } as unknown as ILLMProvider;
    const router = new ModelRouterService(cfg, provider),
      budget = router.createBudget();
    const request: LLMChatRequest = {
      model: 'ignored',
      systemPrompt: 'Synthetic',
      messages: [],
      reasoningEffort: 'max',
    };
    policy.routes['analysis.school']!.reasoningEffort = 'low';
    cfg.set('AI_AGENT_MODEL_ROUTING_CONFIG', JSON.stringify(policy));
    const result = await router.call(request, {
      taskType: 'analysis.school',
      segment: 'assessment',
      runBudget: budget,
    });
    expect(chat.mock.calls[0][0].reasoningEffort).toBe('none');
    expect(result.routing).toMatchObject({
      segment: 'assessment',
      reasoningEffort: 'none',
    });
    await expect(
      router.call(
        { ...request, providerOptions: { reasoning_effort: 'max' } },
        { taskType: 'analysis.school' },
      ),
    ).rejects.toThrow('OPTIONS_DENIED');
    policy.models['gpt-5.5'].reasoningEfforts = ['low'];
    cfg.set('AI_AGENT_MODEL_ROUTING_CONFIG', JSON.stringify(policy));
    await expect(
      router.call(request, { taskType: 'analysis.school', runBudget: budget }),
    ).rejects.toThrow('CAPABILITY_DENIED');
    expect(chat).toHaveBeenCalledTimes(1);
  });
});
