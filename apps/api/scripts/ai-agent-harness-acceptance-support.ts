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
