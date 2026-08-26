import { randomBytes } from 'node:crypto';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { AGENT_SEMANTIC_EVAL_CASES } from '../src/modules/ai-agent/semantic-eval/agent-semantic-eval.dataset';
import {
  assertPrivateTemporaryCapturePath,
  renderProductionCaseInput,
  summarizeExpectedInputRejection,
  summarizeProductionEvents,
  type SemanticCaptureEvent,
  type SemanticCaptureItem,
} from '../src/modules/ai-agent/semantic-eval/agent-semantic-production-capture';
import { SEMANTIC_EVAL_DATASET_VERSION } from '../src/modules/ai-agent/semantic-eval/agent-semantic-eval.types';
import {
  fingerprint,
  parseAcceptanceSse,
  requiredEnv,
  sleep,
  unwrapAcceptancePayload,
} from './ai-agent-harness-acceptance-support';

const args = process.argv.slice(2);
if (!args.includes('--production'))
  throw new Error('Refusing to run without --production');

function option(name: string): string | undefined {
  const inline = args.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const apiBase = requiredEnv('SEMANTIC_API_BASE').replace(/\/$/, '');
const revision = requiredEnv('SEMANTIC_EXPECTED_REVISION');
const outputPath = assertPrivateTemporaryCapturePath(
  requiredEnv('SEMANTIC_CAPTURE_OUTPUT'),
);
const repetition = Number(option('--repetition') ?? '1');
if (!Number.isInteger(repetition) || repetition < 1 || repetition > 10) {
  throw new Error('Repetition must be an integer between 1 and 10');
}
const minimumIntervalMs = Number(option('--interval-ms') ?? '6200');
if (!Number.isInteger(minimumIntervalMs) || minimumIntervalMs < 6000) {
  throw new Error('Production capture interval must be at least 6000ms');
}
const casesPerAccount = Number(option('--cases-per-account') ?? '60');
if (
  !Number.isInteger(casesPerAccount) ||
  casesPerAccount < 10 ||
  casesPerAccount > 80
) {
  throw new Error('Cases per account must be an integer between 10 and 80');
}

const stamp = new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, '')
  .slice(0, 14);
let token = '';
let refreshToken = '';
let userId = '';
let password = '';
let accountCount = 0;
let cleanupCount = 0;
let cleanupFailed = false;
let refreshCount = 0;
const items: SemanticCaptureItem[] = [];

async function rawRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    authenticated?: boolean;
    headers?: Record<string, string>;
  } = {},
) {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(options.authenticated !== false && token
        ? { authorization: `Bearer ${token}` }
        : {}),
      ...options.headers,
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return {
    ok: response.ok,
    status: response.status,
    payload: unwrapAcceptancePayload(payload),
  };
}

async function refreshSyntheticSession(): Promise<boolean> {
  if (!refreshToken) return false;
  const refreshed = await rawRequest('/auth/refresh', {
    method: 'POST',
    authenticated: false,
    headers: { 'x-client-type': 'mobile' },
    body: { refreshToken },
  });
  if (
    !refreshed.ok ||
    typeof refreshed.payload?.accessToken !== 'string' ||
    typeof refreshed.payload?.refreshToken !== 'string'
  ) {
    return false;
  }
  token = refreshed.payload.accessToken;
  refreshToken = refreshed.payload.refreshToken;
  refreshCount += 1;
  return true;
}

async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    authenticated?: boolean;
    headers?: Record<string, string>;
  } = {},
) {
  const response = await rawRequest(path, options);
  if (
    response.status === 401 &&
    options.authenticated !== false &&
    (await refreshSyntheticSession())
  ) {
    return rawRequest(path, options);
  }
  return response;
}

async function writeCapture(complete: boolean): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        datasetVersion: SEMANTIC_EVAL_DATASET_VERSION,
        candidate: {
          id: `production-${revision}-r${repetition}`,
          source: 'production_agent',
          version: revision,
        },
        repetition,
        complete,
        capturedCases: items.length,
        items,
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  await chmod(outputPath, 0o600);
}

async function createSyntheticAccount(): Promise<void> {
  accountCount += 1;
  const email = `agent-semantic-${stamp}-r${repetition}-s${accountCount}@example.invalid`;
  password = `Semantic9!${randomBytes(8).toString('hex')}`;
  const registration = await request('/auth/register', {
    method: 'POST',
    body: { email, password, locale: 'en' },
  });
  if (
    !registration.ok ||
    !registration.payload?.accessToken ||
    !registration.payload.user?.id
  ) {
    throw new Error(`semantic_register_${registration.status}`);
  }
  token = String(registration.payload.accessToken);
  userId = String(registration.payload.user.id);
  const login = await rawRequest('/auth/login', {
    method: 'POST',
    authenticated: false,
    headers: { 'x-client-type': 'mobile' },
    body: { email, password },
  });
  if (
    !login.ok ||
    typeof login.payload?.accessToken !== 'string' ||
    typeof login.payload?.refreshToken !== 'string'
  ) {
    throw new Error(`semantic_login_${login.status}`);
  }
  token = login.payload.accessToken;
  refreshToken = login.payload.refreshToken;
}

async function retireSyntheticAccount(): Promise<void> {
  if (!token) return;
  const aiDataCleared = (
    await request('/ai-agent/user-data/all', { method: 'DELETE' })
  ).ok;
  const accountSoftDeleted = (
    await request('/users/me', { method: 'DELETE', body: { password } })
  ).ok;
  cleanupCount += 1;
  cleanupFailed ||= !aiDataCleared || !accountSoftDeleted;
  token = '';
  refreshToken = '';
  userId = '';
  password = '';
  if (!aiDataCleared || !accountSoftDeleted) {
    throw new Error('synthetic_cleanup_failed');
  }
}

async function captureCase(index: number): Promise<void> {
  const evalCase = AGENT_SEMANTIC_EVAL_CASES[index];
  for (let attempt = 1; attempt <= 4; attempt++) {
    const started = Date.now();
    const response = await fetch(`${apiBase}/ai-agent/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: renderProductionCaseInput(evalCase),
        locale: evalCase.locale,
        agentHint: evalCase.agentType,
        stream: true,
      }),
    });
    const text = await response.text();
    if (response.status === 401 && attempt < 4) {
      if (!(await refreshSyntheticSession())) {
        throw new Error(`capture_refresh_failed_case_${index + 1}`);
      }
      continue;
    }
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Math.max(
        Number(response.headers.get('retry-after') ?? 60),
        1,
      );
      await sleep(retryAfter * 1000 + 250);
      continue;
    }
    const expectedRejection = summarizeExpectedInputRejection({
      evalCase,
      repetition,
      latencyMs: Date.now() - started,
      httpStatus: response.status,
    });
    if (expectedRejection) {
      items.push(expectedRejection);
      await writeCapture(false);
      return;
    }
    if (!response.ok)
      throw new Error(`capture_http_${response.status}_case_${index + 1}`);
    const events = parseAcceptanceSse(text) as SemanticCaptureEvent[];
    items.push(
      summarizeProductionEvents(events, {
        caseId: evalCase.id,
        repetition,
        latencyMs: Date.now() - started,
        httpStatus: response.status,
        hashRunId: fingerprint,
      }),
    );
    await writeCapture(false);
    return;
  }
}

async function main(): Promise<void> {
  for (let index = 0; index < AGENT_SEMANTIC_EVAL_CASES.length; index++) {
    if (index % casesPerAccount === 0) {
      await retireSyntheticAccount();
      await createSyntheticAccount();
    }
    const loopStarted = Date.now();
    await captureCase(index);
    const remaining = minimumIntervalMs - (Date.now() - loopStarted);
    if (remaining > 0 && index + 1 < AGENT_SEMANTIC_EVAL_CASES.length) {
      await sleep(remaining);
    }
  }
  await writeCapture(true);
}

async function cleanup(): Promise<void> {
  const finalUserHash = userId ? fingerprint(userId) : null;
  try {
    await retireSyntheticAccount();
  } catch {
    cleanupFailed = true;
  }
  process.stdout.write(
    `${JSON.stringify({
      datasetVersion: SEMANTIC_EVAL_DATASET_VERSION,
      revision,
      repetition,
      capturedCases: items.length,
      expectedCases: AGENT_SEMANTIC_EVAL_CASES.length,
      finalUserHash,
      outputPath,
      accountCount,
      cleanupCount,
      cleanupFailed,
      refreshCount,
      pass:
        items.length === AGENT_SEMANTIC_EVAL_CASES.length &&
        cleanupCount === accountCount &&
        !cleanupFailed,
    })}\n`,
  );
  if (cleanupCount !== accountCount || cleanupFailed) process.exitCode = 1;
}

main()
  .catch(async (error: unknown) => {
    await writeCapture(false);
    process.stderr.write(
      `${error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN_ERROR'}\n`,
    );
    process.exitCode = 1;
  })
  .finally(cleanup);
