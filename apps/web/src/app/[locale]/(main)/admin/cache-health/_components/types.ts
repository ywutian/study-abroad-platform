/**
 * Frontend types for the M1 Cache Health admin page.
 *
 * Mirrors the response shape of `GET /admin/cache-health` from the API.
 * Kept here (not in @study-abroad/shared) because this is an admin-only
 * surface that doesn't need to be consumed by mobile.
 */

export type RedisOpKind = 'read' | 'write' | 'delete' | 'atomic' | 'admin' | 'pipeline' | 'unknown';

export type RedisErrorKind =
  'quota_exceeded' | 'timeout' | 'connection' | 'auth' | 'reply_error' | 'other';

export interface RedisOpSnapshot {
  kind: RedisOpKind;
  count: number;
  errorCount: number;
  hitCount: number;
  missCount: number;
  hitRatio: number | null;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
}

export interface RedisHotKeySnapshot {
  prefix: string;
  count: number;
  lastSeen: string;
}

export interface RedisErrorRecord {
  timestamp: number;
  op: RedisOpKind;
  key: string;
  kind: RedisErrorKind;
  message: string;
}

export interface CacheHealthSnapshot {
  connection: {
    connected: boolean;
    status: 'ok' | 'error';
    latencyMs?: number;
    message?: string;
  };
  podStartedAt: string;
  uptimeMs: number;
  totals: {
    totalOps: number;
    totalErrors: number;
    totalHits: number;
    totalMisses: number;
    overallHitRatio: number | null;
    errorRate: number;
  };
  ops: RedisOpSnapshot[];
  hotKeys: Array<{ prefix: string; count: number; lastSeen: string }>;
  errorsByKind: Partial<Record<RedisErrorKind, number>>;
  recentErrors: RedisErrorRecord[];
}

/** Format a 0-1 ratio as a percentage string with 1 decimal. */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Format a milliseconds duration as a human-readable relative time. */
export function formatRelativeTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
