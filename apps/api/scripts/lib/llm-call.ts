/**
 * Unified LLM caller: OpenAI Chat Completions OR Anthropic Messages API.
 *
 * Provider is auto-detected from model name:
 *  - "claude-..."  → Anthropic
 *  - everything else (gpt-*, o*) → OpenAI
 *
 * Both paths return parsed JSON from the model's response (for response_format
 * style usage). Caller passes a system + user prompt and gets back parsed JSON.
 */

interface CallArgs {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
}

export async function callLlm<T>(args: CallArgs): Promise<T> {
  const provider = args.model.startsWith('claude-') ? 'anthropic' : 'openai';
  if (provider === 'anthropic') {
    return callAnthropic(args);
  }
  return callOpenAi(args);
}

async function callOpenAi<T>(args: CallArgs): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  if (!apiKey) throw new Error('OPENAI_API_KEY required');

  const r = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: args.maxOutputTokens,
      messages: [
        { role: 'system', content: args.systemPrompt },
        { role: 'user', content: args.userPrompt },
      ],
    }),
  });
  const body = await r.text();
  if (!r.ok)
    throw new Error(`OpenAI failed ${r.status}: ${body.slice(0, 500)}`);
  const parsed = JSON.parse(body) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = parsed.choices?.[0]?.message?.content ?? '';
  return extractJson<T>(content);
}

async function callAnthropic<T>(args: CallArgs): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let baseUrl =
    process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1';
  // Normalize: ensure /v1 suffix (Claude Desktop sets ANTHROPIC_BASE_URL without /v1)
  baseUrl = baseUrl.replace(/\/$/, '');
  if (!/\/v\d+$/.test(baseUrl)) baseUrl += '/v1';
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');

  const url = `${baseUrl.replace(/\/$/, '')}/messages`;
  const reqBody = {
    model: args.model,
    max_tokens: args.maxOutputTokens ?? 4096,
    temperature: 0,
    system: args.systemPrompt,
    messages: [{ role: 'user', content: args.userPrompt }],
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(reqBody),
  });
  const body = await r.text();
  if (!r.ok) {
    throw new Error(
      `Anthropic ${r.status} url=${url} bodyLen=${body.length} body=${body.slice(0, 300)}`,
    );
  }
  const parsed = JSON.parse(body) as {
    content?: Array<{ type: string; text?: string }>;
  };
  // Anthropic returns content blocks; concat text blocks
  const text = (parsed.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  return extractJson<T>(text);
}

function extractJson<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error(`LLM did not return JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
