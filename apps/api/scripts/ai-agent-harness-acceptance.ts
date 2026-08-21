import { createHash, randomBytes } from 'node:crypto';
import {
  JsonRecord,
  runUntilMetricObserved,
} from './ai-agent-harness-acceptance-support';

const args = new Set(process.argv.slice(2));
if (!args.has('--production')) {
  throw new Error('Refusing to run without --production');
}

const apiBase = required('HARNESS_API_BASE').replace(/\/$/, '');
const adminEmail = required('HARNESS_ADMIN_EMAIL');
const adminPassword = required('HARNESS_ADMIN_PASSWORD');
const expectedRevision = required('HARNESS_EXPECTED_REVISION');
const stamp = new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, '')
  .slice(0, 14);
const syntheticEmail = `agent-harness-${stamp}@example.invalid`;
const syntheticPassword = `Harness9!${randomBytes(8).toString('hex')}`;
const eventTitle = `Harness synthetic event ${stamp}`;
let adminToken = '';
let token = '';
let userId = '';
let conversationId = '';
let eventId = '';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function unwrap(payload: unknown): JsonRecord | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const record = payload as JsonRecord;
  return record.data && typeof record.data === 'object' ? record.data : record;
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: 'admin' | 'synthetic' | 'none';
  } = {},
) {
  const auth = options.auth ?? 'synthetic';
  const bearer =
    auth === 'admin' ? adminToken : auth === 'synthetic' ? token : '';
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
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
  return { ok: response.ok, status: response.status, payload: unwrap(payload) };
}

function parseSse(text: string): JsonRecord[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6))
    .filter((value) => value !== '[DONE]')
    .map((value) => {
      try {
        return JSON.parse(value) as JsonRecord;
      } catch {
        return null;
      }
    })
    .filter((value): value is JsonRecord => value !== null);
}

async function streamChat(
  message: string,
  existingConversationId?: string,
  agentHint?: string,
) {
  const response = await fetch(`${apiBase}/ai-agent/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      ...(existingConversationId
        ? { conversationId: existingConversationId }
        : {}),
      ...(agentHint ? { agentHint } : {}),
      locale: 'en',
      stream: true,
    }),
  });
  return { status: response.status, events: parseSse(await response.text()) };
}

async function evidenceTotals(): Promise<Record<string, number>> {
  const response = await request('/admin/ai-agent/harness/evidence?days=1', {
    auth: 'admin',
  });
  if (!response.ok) throw new Error(`evidence_http_${response.status}`);
  const totals = response.payload?.totals as unknown;
  if (!totals || typeof totals !== 'object' || Array.isArray(totals)) return {};
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, Number(value) || 0]),
  );
}

function emit(record: JsonRecord): void {
  process.stdout.write(
    `${JSON.stringify({
      utc: new Date().toISOString(),
      revision: expectedRevision,
      ...record,
    })}\n`,
  );
}

async function pollRun(runId: string): Promise<JsonRecord> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await request(`/ai-agent/runs/${runId}`);
    if (
      response.ok &&
      ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(
        String(response.payload?.status ?? ''),
      )
    ) {
      return { ...(response.payload as JsonRecord) };
    }
    await sleep(1000);
  }
  throw new Error('run_terminal_timeout');
}

async function createGrant(
  scenario: 'context_compression_failure' | 'budget_exhaustion',
  extra: JsonRecord = {},
): Promise<void> {
  const response = await request('/admin/ai-agent/harness/acceptance-grants', {
    method: 'POST',
    auth: 'admin',
    body: { targetUserId: userId, scenario, ...extra },
  });
  if (!response.ok) throw new Error(`grant_${scenario}_${response.status}`);
}

async function main(): Promise<void> {
  const admin = await request('/auth/login', {
    method: 'POST',
    auth: 'none',
    body: { email: adminEmail, password: adminPassword },
  });
  if (!admin.ok || !admin.payload?.accessToken) {
    throw new Error(`admin_login_${admin.status}`);
  }
  adminToken = admin.payload.accessToken;

  const registration = await request('/auth/register', {
    method: 'POST',
    auth: 'none',
    body: { email: syntheticEmail, password: syntheticPassword, locale: 'en' },
  });
  if (!registration.ok) throw new Error(`register_${registration.status}`);
  const registeredToken = registration.payload?.accessToken;
  const registeredUserId = registration.payload?.user?.id;
  if (!registeredToken || !registeredUserId) {
    throw new Error('register_contract_missing');
  }
  token = registeredToken;
  userId = registeredUserId;
  emit({
    scenario: 'setup',
    http: registration.status,
    userHash: fingerprint(userId),
  });

  const preference = await request('/ai-agent/user-data/preferences', {
    method: 'PUT',
    body: { enableMemory: false },
  });
  const beforeStats = await request('/ai-agent/user-data/stats');
  const memoryRun = await streamChat(
    'Discuss a synthetic application plan. Do not perform any write action.',
    undefined,
    'profile',
  );
  const memoryStart = memoryRun.events.find((event) => event.type === 'start');
  const memoryDone = memoryRun.events.find((event) => event.type === 'done');
  const startedConversationId = memoryStart?.conversationId;
  if (!startedConversationId) throw new Error('conversation_contract_missing');
  conversationId = startedConversationId;
  await sleep(3000);
  const afterStats = await request('/ai-agent/user-data/stats');
  const memoryContext = memoryStart?.memoryContext ?? {};
  const memoryPass =
    preference.payload?.enableMemory === false &&
    beforeStats.payload?.totalMemories === 0 &&
    afterStats.payload?.totalMemories === 0 &&
    beforeStats.payload?.totalEntities === 0 &&
    afterStats.payload?.totalEntities === 0 &&
    Number(memoryContext.recentMemories ?? 0) === 0 &&
    Number(memoryContext.relevantFacts ?? 0) === 0 &&
    Array.isArray(memoryContext.entities) &&
    memoryContext.entities.length === 0 &&
    Boolean(memoryDone && conversationId);
  emit({
    scenario: 'memory_disabled',
    http: memoryRun.status,
    runStatus: memoryDone?.runStatus ?? 'COMPLETED',
    memoriesBefore: beforeStats.payload?.totalMemories,
    memoriesAfter: afterStats.payload?.totalMemories,
    entitiesBefore: beforeStats.payload?.totalEntities,
    entitiesAfter: afterStats.payload?.totalEntities,
    pass: memoryPass,
    reasonCode: memoryPass
      ? 'MEMORY_DISABLED_BOUNDARY_CONFIRMED'
      : 'MEMORY_DISABLED_BOUNDARY_FAILED',
  });

  for (let index = 0; index < 10; index++) {
    await streamChat(index % 2 === 0 ? 'Hello' : 'Thanks', conversationId);
    await sleep(200);
  }
  await streamChat('Hello', conversationId);
  const compressed = await request(
    `/ai-agent/user-data/conversations/${encodeURIComponent(conversationId)}`,
  );
  const summary = compressed.payload?.summary;
  const summaryHash = typeof summary === 'string' ? fingerprint(summary) : '';
  const messageCount = compressed.payload?.messageCount ?? 0;
  const compressionPass =
    compressed.ok && summaryHash.length > 0 && messageCount > 20;
  emit({
    scenario: 'context_compression',
    http: compressed.status,
    runStatus: 'COMPLETED',
    summaryHash,
    messageCount,
    pass: compressionPass,
    reasonCode: compressionPass
      ? 'STRUCTURED_SUMMARY_PERSISTED'
      : 'SUMMARY_NOT_OBSERVED',
  });

  const fallbackBefore = await evidenceTotals();
  await createGrant('context_compression_failure');
  // Stop on the request that consumes the grant; later requests may perform a
  // valid compression and would no longer measure the failure-time fallback.
  const fallbackProbe = await runUntilMetricObserved({
    baseline: fallbackBefore.context_compression_fallback ?? 0,
    maxAttempts: 6,
    runAttempt: async (attempt) => {
      await streamChat(attempt % 2 === 1 ? 'Hello' : 'Thanks', conversationId);
      await sleep(200);
    },
    readMetric: async () => {
      const totals = await evidenceTotals();
      return totals.context_compression_fallback ?? 0;
    },
  });
  const afterFallback = await request(
    `/ai-agent/user-data/conversations/${encodeURIComponent(conversationId)}`,
  );
  const retainedHash =
    typeof afterFallback.payload?.summary === 'string'
      ? fingerprint(afterFallback.payload.summary)
      : '';
  const fallbackDelta =
    fallbackProbe.metricAfter -
    (fallbackBefore.context_compression_fallback ?? 0);
  const fallbackPass =
    fallbackProbe.observed &&
    summaryHash === retainedHash &&
    fallbackDelta === 1;
  emit({
    scenario: 'context_compression_fallback',
    http: afterFallback.status,
    runStatus: 'COMPLETED',
    previousSummaryHash: summaryHash,
    retainedSummaryHash: retainedHash,
    metric: 'context_compression_fallback',
    metricBefore: fallbackBefore.context_compression_fallback ?? 0,
    metricAfter: fallbackProbe.metricAfter,
    attempts: fallbackProbe.attempts,
    pass: fallbackPass,
    reasonCode: fallbackPass
      ? 'LAST_VALID_SUMMARY_RETAINED'
      : 'COMPRESSION_FALLBACK_FAILED',
  });

  const approval = await request('/ai-agent/chat', {
    method: 'POST',
    body: {
      message: `Create one personal event titled exactly "${eventTitle}" in category OTHER. Do not create anything else.`,
      stream: false,
      locale: 'en',
      agentHint: 'timeline',
    },
  });
  const pending = approval.payload?.approvalRequired;
  const rawRunId: unknown = approval.payload?.runId;
  const runId = typeof rawRunId === 'string' ? rawRunId : '';
  if (!pending?.approvalId || !runId) throw new Error('approval_not_requested');
  const approved = await request(
    `/ai-agent/runs/${runId}/approvals/${pending.approvalId}/approve`,
    { method: 'POST' },
  );
  if (!approved.ok) throw new Error(`approve_${approved.status}`);

  const abort = new AbortController();
  const firstResume = await fetch(`${apiBase}/ai-agent/runs/${runId}/resume`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    signal: abort.signal,
  });
  const reader = firstResume.body?.getReader();
  let observedResume = false;
  let buffer = '';
  if (reader) {
    for (let attempt = 0; attempt < 8 && !observedResume; attempt++) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += new TextDecoder().decode(chunk.value);
      observedResume = buffer.includes('run_resumed');
    }
  }
  abort.abort();
  const approvalRun = await pollRun(runId);
  const reconnect = await fetch(`${apiBase}/ai-agent/runs/${runId}/resume`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  const reconnectEvents = parseSse(await reconnect.text());
  const events = await request('/timelines/personal-events');
  const matches = Array.isArray(events.payload)
    ? events.payload.filter((item: JsonRecord) => item.title === eventTitle)
    : [];
  eventId = matches[0]?.id ?? '';
  const approvalPass =
    observedResume &&
    approvalRun.status === 'COMPLETED' &&
    approvalRun.approval?.status === 'EXECUTED' &&
    matches.length === 1 &&
    reconnectEvents.some(
      (event) => event.type === 'done' && event.runStatus === 'COMPLETED',
    );
  emit({
    scenario: 'approval_disconnect_recovery',
    http: reconnect.status,
    runStatus: approvalRun.status,
    approvalStatus: approvalRun.approval?.status,
    approvalFingerprint: String(pending.fingerprint).slice(0, 16),
    sideEffectCount: matches.length,
    pass: approvalPass,
    reasonCode: approvalPass
      ? 'APPROVED_SIDE_EFFECT_AT_MOST_ONCE'
      : 'APPROVAL_RECOVERY_FAILED',
  });

  const budgetBefore = await evidenceTotals();
  await createGrant('budget_exhaustion', {
    maxTokens: 1,
    maxDurationMs: 10000,
  });
  const budgetStream = await streamChat(
    'Provide a detailed synthetic comparison of application planning strategies.',
    undefined,
    'school',
  );
  const budgetStart = budgetStream.events.find(
    (event) => event.type === 'start',
  );
  const budgetRunId =
    typeof budgetStart?.runId === 'string' ? budgetStart.runId : '';
  if (!budgetRunId) throw new Error('budget_run_missing');
  const budgetRun = await pollRun(budgetRunId);
  const budgetAfter = await evidenceTotals();
  const tokenDelta =
    (budgetAfter.token_budget_exceeded ?? 0) -
    (budgetBefore.token_budget_exceeded ?? 0);
  const durationDelta =
    (budgetAfter.duration_budget_exceeded ?? 0) -
    (budgetBefore.duration_budget_exceeded ?? 0);
  const budgetPass =
    budgetRun.status === 'FAILED' && tokenDelta + durationDelta === 1;
  emit({
    scenario: 'budget_exhaustion',
    http: budgetStream.status,
    runStatus: budgetRun.status,
    reason: budgetRun.errorCode,
    tokenMetricDelta: tokenDelta,
    durationMetricDelta: durationDelta,
    pass: budgetPass,
    reasonCode: budgetPass
      ? 'BUDGET_EXHAUSTION_TERMINAL'
      : 'BUDGET_EXHAUSTION_FAILED',
  });

  if (
    !memoryPass ||
    !compressionPass ||
    !fallbackPass ||
    !approvalPass ||
    !budgetPass
  ) {
    process.exitCode = 1;
  }
}

async function cleanup(): Promise<void> {
  const result = {
    eventDeleted: !eventId,
    aiDataCleared: false,
    accountSoftDeleted: false,
  };
  try {
    if (token && eventId) {
      result.eventDeleted = (
        await request(
          `/timelines/personal-events/${encodeURIComponent(eventId)}`,
          {
            method: 'DELETE',
          },
        )
      ).ok;
    }
    if (token) {
      result.aiDataCleared = (
        await request('/ai-agent/user-data/all', { method: 'DELETE' })
      ).ok;
      result.accountSoftDeleted = (
        await request('/users/me', {
          method: 'DELETE',
          body: { password: syntheticPassword },
        })
      ).ok;
    }
  } finally {
    emit({
      scenario: 'cleanup',
      ...result,
      userHash: userId ? fingerprint(userId) : null,
      pass:
        result.eventDeleted &&
        result.aiDataCleared &&
        result.accountSoftDeleted,
      reasonCode:
        result.eventDeleted && result.aiDataCleared && result.accountSoftDeleted
          ? 'SYNTHETIC_STATE_REMOVED'
          : 'SYNTHETIC_CLEANUP_FAILED',
    });
    if (
      !result.eventDeleted ||
      !result.aiDataCleared ||
      !result.accountSoftDeleted
    ) {
      process.exitCode = 1;
    }
  }
}

main()
  .catch((error) => {
    emit({
      scenario: 'runner',
      pass: false,
      reasonCode:
        error instanceof Error ? error.message.slice(0, 120) : 'UNKNOWN_ERROR',
    });
    process.exitCode = 1;
  })
  .finally(cleanup);
