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
