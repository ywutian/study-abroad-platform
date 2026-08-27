/** Dedicated chat settings are atomic; never mix a new endpoint with an old key. */
export function resolveOpenAIChatConfig(
  get: (key: string) => string | undefined,
): {
  apiKey: string;
  baseUrl: string;
  streamOnly: boolean;
  reasoningEffort?: 'none';
} {
  const keys = [
    'OPENAI_CHAT_API_KEY',
    'OPENAI_CHAT_BASE_URL',
    'OPENAI_CHAT_MODEL',
    'OPENAI_CHAT_TRANSPORT',
    'OPENAI_CHAT_REASONING_EFFORT',
  ];
  if (!keys.some((key) => get(key) !== undefined)) {
    return {
      apiKey: get('OPENAI_API_KEY') || '',
      baseUrl: get('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
      streamOnly: false,
      reasoningEffort: undefined,
    };
  }
  const [apiKey, baseUrl, model] = keys.map((key) => get(key)?.trim());
  const transport = get('OPENAI_CHAT_TRANSPORT') ?? 'json';
  const reasoningEffort = get('OPENAI_CHAT_REASONING_EFFORT');
  const invalid = () =>
    new Error('OPENAI_CHAT configuration is incomplete or invalid');
  if (!apiKey || !baseUrl || !model || !/^gpt-[a-z0-9.-]+$/.test(model))
    throw invalid();
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw invalid();
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['json', 'sse'].includes(transport) ||
    (reasoningEffort !== undefined && reasoningEffort !== 'none')
  )
    throw invalid();
  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    streamOnly: transport === 'sse',
    reasoningEffort,
  };
}
