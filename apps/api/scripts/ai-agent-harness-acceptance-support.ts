import { createHash } from 'node:crypto';

export interface JsonRecord {
  [key: string]: unknown;
  accessToken?: string;
  agentType?: string;
  approval?: JsonRecord;
  approvalId?: string;
  approvalRequired?: JsonRecord;
  conversationId?: string;
  data?: JsonRecord;
  enableMemory?: boolean;
  errorCode?: string;
  fingerprint?: string;
  id?: string;
  memoryContext?: JsonRecord;
  messageCount?: number;
  runId?: string;
  runStatus?: string;
  status?: string;
  summary?: string;
  title?: string;
  totalEntities?: number;
  totalMemories?: number;
  totals?: Record<string, number>;
  type?: string;
  user?: JsonRecord;
}

interface AcceptanceHttpResult {
  ok: boolean;
  status: number;
  payload: unknown;
}

type AcceptanceRequest = (
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    auth?: 'admin' | 'synthetic' | 'none';
  },
) => Promise<AcceptanceHttpResult>;

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function unwrapAcceptancePayload(payload: unknown): JsonRecord | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const record = payload as JsonRecord;
  return record.data && typeof record.data === 'object' ? record.data : record;
}

export function parseAcceptanceSse(text: string): JsonRecord[] {
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

export async function verifyAndAcknowledgeHarnessAlert(options: {
  request: AcceptanceRequest;
  source: string;
  acknowledgementNote: string;
}): Promise<{
  persisted: boolean;
  acknowledged: boolean;
  unacknowledgedAlertId: string;
}> {
  let alertId = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    const active = await options.request(
      '/admin/ai-agent/harness/alerts?limit=100',
      { auth: 'admin' },
    );
    const alerts = Array.isArray(active.payload) ? active.payload : [];
    const alert = alerts.find(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        (entry as JsonRecord).source === options.source,
    ) as JsonRecord | undefined;
    if (!alert || typeof alert.alertId !== 'string') {
      await sleep(250);
      continue;
    }

    alertId = alert.alertId;
    const delivery = await options.request(
      `/admin/ai-agent/harness/alerts/${encodeURIComponent(alertId)}/delivery`,
      { auth: 'admin' },
    );
    const entries = Array.isArray(delivery.payload) ? delivery.payload : [];
    const persisted = entries.some(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        (entry as JsonRecord).channel === 'redis_queue' &&
        (entry as JsonRecord).status === 'persisted',
    );
    if (!persisted) {
      await sleep(250);
      continue;
    }

    const acknowledged = await options.request(
      `/admin/ai-agent/harness/alerts/${encodeURIComponent(alertId)}/acknowledge`,
      {
        method: 'POST',
        auth: 'admin',
        body: { notes: options.acknowledgementNote },
      },
    );
    if (
      !acknowledged.ok ||
      !isTrueField(acknowledged.payload, 'acknowledged')
    ) {
      return { persisted, acknowledged: false, unacknowledgedAlertId: alertId };
    }

    for (let poll = 0; poll < 10; poll++) {
      const remaining = await options.request(
        '/admin/ai-agent/harness/alerts?limit=100',
        { auth: 'admin' },
      );
      const remainingAlerts = Array.isArray(remaining.payload)
        ? remaining.payload
        : [];
      const stillActive = remainingAlerts.some(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          (entry as JsonRecord).alertId === alertId,
      );
      if (!stillActive) {
        return { persisted, acknowledged: true, unacknowledgedAlertId: '' };
      }
      await sleep(100);
    }
    return { persisted, acknowledged: false, unacknowledgedAlertId: alertId };
  }
  return {
    persisted: false,
    acknowledged: false,
    unacknowledgedAlertId: alertId,
  };
}

export async function pollTerminalAgentRun(options: {
  request: AcceptanceRequest;
  runId: string;
}): Promise<JsonRecord> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const response = await options.request(`/ai-agent/runs/${options.runId}`);
    if (
      response.ok &&
      response.payload &&
      typeof response.payload === 'object' &&
      !Array.isArray(response.payload) &&
      ['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(
        String((response.payload as JsonRecord).status ?? ''),
      )
    ) {
      return { ...(response.payload as JsonRecord) };
    }
    await sleep(1000);
  }
  throw new Error('run_terminal_timeout');
}

function isTrueField(payload: unknown, field: string): boolean {
  return (
    Boolean(payload) &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    (payload as JsonRecord)[field] === true
  );
}

export async function runUntilMetricObserved(options: {
  baseline: number;
  maxAttempts: number;
  runAttempt: (attempt: number) => Promise<void>;
  readMetric: () => Promise<number>;
}): Promise<{ attempts: number; metricAfter: number; observed: boolean }> {
  let metricAfter = options.baseline;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    await options.runAttempt(attempt);
    metricAfter = await options.readMetric();
    if (metricAfter - options.baseline === 1) {
      return { attempts: attempt, metricAfter, observed: true };
    }
  }
  return {
    attempts: options.maxAttempts,
    metricAfter,
    observed: false,
  };
}

export async function requestApprovalWithRetry(options: {
  maxAttempts: number;
  runAttempt: () => Promise<{ status: number; events: JsonRecord[] }>;
  readRun: (runId: string) => Promise<JsonRecord | null>;
}): Promise<{
  pending?: JsonRecord;
  runId: string;
  lastRun: JsonRecord | null;
  http: number;
  attempts: number;
}> {
  let pending: JsonRecord | undefined;
  let runId = '';
  let lastRun: JsonRecord | null = null;
  let http = 0;
  let attempts = 0;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    attempts = attempt;
    const probe = await options.runAttempt();
    http = probe.status;
    const start = probe.events.find((event) => event.type === 'start');
    const approvalEvent = probe.events.find(
      (event) => event.type === 'approval_required',
    );
    runId = typeof start?.runId === 'string' ? start.runId : '';
    if (
      approvalEvent?.approval &&
      typeof approvalEvent.approval === 'object' &&
      !Array.isArray(approvalEvent.approval)
    ) {
      pending = approvalEvent.approval;
    }
    if (runId) lastRun = await options.readRun(runId);
    if (pending?.approvalId && runId) break;
    await sleep(250);
  }
  return { pending, runId, lastRun, http, attempts };
}

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
