/** Synthetic live smoke: no business tools, raw responses, or credentials in output. */
import { ConfigService } from '@nestjs/config';
import { OpenAIProvider } from '../src/modules/ai-agent/providers/openai.provider';
import { runtimeModel } from '../src/modules/ai-agent/providers/runtime-model';
import {
  LLMChatRequest,
  LLMProviderError,
} from '../src/modules/ai-agent/providers/llm-provider.types';

async function main() {
  if (!process.argv.includes('--live')) throw Error('LIVE_OPT_IN_REQUIRED');
  if (!process.env.OPENAI_CHAT_API_KEY)
    throw Error('DEDICATED_CHAT_CONFIG_REQUIRED');
  const provider = new OpenAIProvider(
    new ConfigService({ ...process.env, AI_REQUEST_TIMEOUT_MS: 30000 }),
  );
  const model = runtimeModel((key) => process.env[key]);
  const common: LLMChatRequest = {
    model,
    systemPrompt:
      'Synthetic interface acceptance. Follow the requested output exactly.',
    messages: [{ role: 'user', content: 'Reply exactly OK.' }],
    maxTokens: 1000,
    timeoutMs: 30000,
  };
  let failures = 0;
  for (const scenario of [
    'ordinary',
    'stream',
    'structured',
    'tool',
  ] as const) {
    const start = Date.now();
    try {
      let pass = false,
        totalTokens = 0;
      if (scenario === 'stream') {
        let text = '',
          done = false;
        for await (const chunk of provider.chatStream(common)) {
          if (chunk.type === 'content') text += chunk.content;
          if (chunk.type === 'done') {
            done = chunk.model === model;
            totalTokens = chunk.usage?.totalTokens ?? 0;
          }
        }
        pass = done && text.trim() === 'OK' && totalTokens > 0;
      } else {
        const request: LLMChatRequest = { ...common };
        if (scenario === 'structured') {
          request.messages = [
            {
              role: 'user',
              content: 'Return JSON with ok=true and label="synthetic".',
            },
          ];
          request.providerOptions = {
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'synthetic_contract',
                strict: true,
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    label: { type: 'string' },
                  },
                  required: ['ok', 'label'],
                  additionalProperties: false,
                },
              },
            },
          };
        }
        if (scenario === 'tool') {
          request.messages = [
            {
              role: 'user',
              content:
                'Call synthetic_echo with value="synthetic". Do not write an answer.',
            },
          ];
          request.tools = [
            {
              name: 'synthetic_echo',
              description: 'Inert contract fixture, never executed.',
              parameters: {
                type: 'object',
                properties: { value: { type: 'string' } },
                required: ['value'],
              },
            },
          ];
          request.toolChoice = { name: 'synthetic_echo' };
        }
        const result = await provider.chat(request);
        totalTokens = result.usage?.totalTokens ?? 0;
        pass = result.model === model && totalTokens > 0;
        if (scenario === 'ordinary')
          pass &&=
            result.finishReason === 'stop' && result.content.trim() === 'OK';
        if (scenario === 'structured') {
          const parsed = JSON.parse(result.content);
          pass &&=
            result.finishReason === 'stop' &&
            parsed.ok === true &&
            parsed.label === 'synthetic' &&
            Object.keys(parsed).length === 2;
        }
        if (scenario === 'tool')
          pass &&=
            result.finishReason === 'tool_calls' &&
            result.toolCalls?.length === 1 &&
            result.toolCalls[0].name === 'synthetic_echo' &&
            result.toolCalls[0].arguments.value === 'synthetic';
      }
      if (!pass) failures++;
      console.log(
        JSON.stringify({
          scenario,
          pass,
          totalTokens,
          durationMs: Date.now() - start,
        }),
      );
    } catch (error) {
      failures++;
      console.log(
        JSON.stringify({
          scenario,
          pass: false,
          reason:
            error instanceof LLMProviderError ? error.code : 'CONTRACT_INVALID',
          durationMs: Date.now() - start,
        }),
      );
    }
  }
  if (failures) process.exitCode = 1;
}
void main().catch(() => {
  console.log(JSON.stringify({ pass: false, reason: 'PROBE_CONFIG_INVALID' }));
  process.exitCode = 1;
});
