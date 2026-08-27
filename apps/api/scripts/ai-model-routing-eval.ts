/** Synthetic transport/routing comparison only. Never connects to application DB. */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { LLMService } from '../src/modules/ai-agent/core/llm.service';
import { OpenAIProvider } from '../src/modules/ai-agent/providers/openai.provider';
import { ModelRouterService } from '../src/modules/ai-agent/routing/model-router.service';
import { evaluateModelRouting } from '../src/modules/ai-agent/routing/model-routing-evaluation';
import {
  routingPolicySchema,
  ModelRoutingPolicy,
} from '../src/modules/ai-agent/routing/model-routing.policy';
import { MODEL_TASKS } from '../src/modules/ai-agent/routing/model-routing.policy';

async function main() {
  const { values } = parseArgs({
    options: {
      live: { type: 'boolean', default: false },
      baseline: { type: 'string' },
      candidate: { type: 'string' },
    },
  });
  if (!values.live) {
    console.log(
      JSON.stringify({
        mode: 'dry_run',
        tasks: MODEL_TASKS,
        calls: 24,
        maxAttemptsPerCall: 2,
        maxOutputTokensPerAttempt: 1000,
        scope: 'synthetic_contract_not_business_accuracy',
      }),
    );
    return;
  }
  if (
    !values.baseline ||
    !values.candidate ||
    !process.env.OPENAI_API_KEY ||
    !process.env.OPENAI_BASE_URL
  )
    throw new Error('MODEL_EVAL_CONFIGURATION_REQUIRED');
  const baseline = routingPolicySchema.parse(
    JSON.parse(readFileSync(values.baseline, 'utf8')),
  );
  const candidate = routingPolicySchema.parse(
    JSON.parse(readFileSync(values.candidate, 'utf8')),
  );
  Logger.overrideLogger(false);
  function client(policy: ModelRoutingPolicy) {
    const config = new ConfigService({
      LLM_PROVIDER: 'openai',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
      OPENAI_MODEL: 'gpt-5.4',
      AI_AGENT_MODEL_ROUTING_V1: 'true',
      AI_AGENT_MODEL_ROUTING_CONFIG: JSON.stringify(policy),
    });
    const provider = new OpenAIProvider(config);
    return new LLMService(
      config,
      provider,
      undefined,
      undefined,
      undefined,
      new ModelRouterService(config, provider),
    );
  }
  const result = await evaluateModelRouting(
    client(baseline),
    client(candidate),
  );
  console.log(JSON.stringify(result, null, 2));
  if (result.rows.some((row) => row.results.some((value) => !value.passed)))
    process.exitCode = 1;
}
main().catch(() => {
  // Configuration/provider failures must not echo environment or request payloads.
  console.error(
    'MODEL_EVAL_FAILED: check non-secret policy and credential availability',
  );
  process.exitCode = 1;
});
