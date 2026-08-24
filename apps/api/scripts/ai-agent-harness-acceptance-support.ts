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

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
