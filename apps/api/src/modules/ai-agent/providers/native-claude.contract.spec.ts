import { LLMChatRequest } from './llm-provider.types';
import {
  buildNativeRequest,
  nativeUsage,
  parseNativeResponse,
  updateNativeUsage,
} from './native-claude.contract';
import { NativeClaudeStream } from './native-claude.stream';

const request: LLMChatRequest = {
  model: 'claude-sonnet-5',
  systemPrompt: 'Synthetic',
  messages: [{ role: 'user', content: 'Synthetic' }],
  toolChoice: 'required',
};
const response = {
  type: 'message',
  role: 'assistant',
  model: request.model,
  content: [],
  stop_reason: 'end_turn',
  usage: { input_tokens: 1, output_tokens: 1 },
};

describe('Native Claude strict contract edge cases', () => {
  it.each(['required', { name: 'lookup_school' }] as const)(
    'rejects a normal stop without the required tool (%s)',
    (toolChoice) => {
      expect(() =>
        parseNativeResponse(response, { ...request, toolChoice }),
      ).toThrow('INVALID_RESPONSE');
    },
  );

  it('rejects a required-tool stream with no tool and never emits done', () => {
    const stream = new NativeClaudeStream(request);
    expect(
      stream.consume({ type: 'message_start', message: response }),
    ).toEqual([]);
    expect(
      stream.consume({
        type: 'message_delta',
        delta: { stop_reason: 'end_turn' },
        usage: { output_tokens: 1 },
      }),
    ).toEqual([]);
    expect(() => stream.consume({ type: 'message_stop' })).toThrow(
      'INVALID_RESPONSE',
    );
    expect(stream.complete).toBe(false);
  });

  it.each(['max_tokens', 'refusal'])(
    'preserves explicit failure/limit finish %s even with required tools',
    (stop_reason) => {
      expect(
        parseNativeResponse({ ...response, stop_reason }, request).finishReason,
      ).toBe(stop_reason === 'refusal' ? 'content_filter' : 'length');
    },
  );

  it.each([
    { input_tokens: Number.MAX_SAFE_INTEGER, output_tokens: 1 },
    {
      input_tokens: Number.MAX_SAFE_INTEGER,
      cache_read_input_tokens: 1,
      output_tokens: 0,
    },
  ])('rejects token count overflow', (usage) => {
    expect(() => nativeUsage(usage)).toThrow('INVALID_RESPONSE');
  });

  it('rejects overflow and backwards stream usage', () => {
    const current = { promptTokens: 1, completionTokens: 1, totalTokens: 2 };
    for (const output_tokens of [0, Number.MAX_SAFE_INTEGER]) {
      expect(() => updateNativeUsage(current, { output_tokens })).toThrow(
        'INVALID_RESPONSE',
      );
    }
  });

  it.each([
    null,
    [],
    { type: 'json_schema', json_schema: null },
    { type: 'json_schema', json_schema: { schema: [] } },
  ])(
    'reports malformed request JSON configuration as INVALID_REQUEST',
    (format) => {
      expect(() =>
        buildNativeRequest(
          { ...request, providerOptions: { response_format: format } },
          false,
        ),
      ).toThrow('INVALID_REQUEST');
    },
  );
});
