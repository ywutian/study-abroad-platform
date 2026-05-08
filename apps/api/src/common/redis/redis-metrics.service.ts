import { Injectable, Logger } from '@nestjs/common';

/**
 * RedisMetricsCollector — Per-pod observability for Redis operations.
 *
 * M1 deliverable for the long-term cache architecture roadmap (see
 * docs/CACHE_ARCHITECTURE.md). Records every Redis operation in-process
 * (no external store) so that:
 *
 *  - The metrics endpoint stays available even when Redis itself is down
 *    or quota-exhausted (the failure mode we're trying to detect).
 *  - There's no chicken-and-egg between "Redis is broken" and "show me
 *    Redis health."
 *
 * Counters reset on pod restart. Cloud Run typically keeps a pod alive
 * for hours-to-days, so a snapshot already represents a meaningful
 * window without persistence. M4+ will optionally periodically flush
 * to Postgres for trend analysis.
 *
 * Memory budget: ~150 KB max (1000 hot keys × ~80 bytes + ~20 op
 * histograms × ~2 KB samples). Negligible vs Cloud Run instance memory.
 */

/**
 * High-level operation categories. Maps many-to-one from the underlying
 * Redis verbs (e.g. both `get` and `getJSON` map to `read`) so the
 * dashboard tells you intent rather than implementation.
 */
export type RedisOpKind =
  | 'read' // get, getJSON, exists, lrange, smembers
  | 'write' // set, setJSON, lpush, lset, ltrim, sadd, srem, expire
  | 'delete' // del, delByPrefix, lrem
  | 'atomic' // incr, decr, setNX (correctness-critical)
  | 'admin' // ping, scan, healthCheck (low-volume infra ops)
  | 'pipeline' // multi/exec/eval (M3+; placeholder)
  | 'unknown';

/**
 * Error categories. Driven by message-pattern matching on the underlying
 * driver error so we don't depend on ioredis internals.
 */
export type RedisErrorKind =
  | 'quota_exceeded' // Upstash "max requests limit"
  | 'timeout' // command timeout (RedisService default 5s)
  | 'connection' // ECONNRESET, ENOTFOUND, ECONNREFUSED, "connection is closed"
  | 'auth' // WRONGPASS, NOAUTH
  | 'reply_error' // generic ReplyError that's not the above
  | 'other'; // unknown thrown value

interface OpStats {
  count: number;
  errorCount: number;
  hitCount: number; // only meaningful for `read`
  missCount: number; // only meaningful for `read`
  totalLatencyMs: number;
  maxLatencyMs: number;
  /**
   * Reservoir sample of recent latencies for percentile estimation.
   * Capped to avoid unbounded growth; evictions are FIFO.
   */
  latencySamples: number[];
}

interface KeyStats {
  count: number;
  lastSeenAt: number;
}

export interface RedisErrorRecord {
  timestamp: number;
  op: RedisOpKind;
  key: string;
  kind: RedisErrorKind;
  message: string;
}

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
  lastSeenAt: string;
}

export interface RedisMetricsSnapshot {
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
  hotKeys: RedisHotKeySnapshot[];
  errorsByKind: Record<string, number>;
  recentErrors: RedisErrorRecord[];
}

const LATENCY_SAMPLE_CAP = 256;
const HOT_KEYS_CAP = 1000;
const RECENT_ERRORS_CAP = 50;

/** Reduce a key like `user:123:profile` to its prefix `user:*` for grouping. */
function keyPrefix(key: string): string {
  // Strip past the second colon (e.g. `school:detail:abc123` -> `school:detail:*`).
  const firstColon = key.indexOf(':');
  if (firstColon === -1) return key;
  const secondColon = key.indexOf(':', firstColon + 1);
  if (secondColon === -1) return `${key.slice(0, firstColon + 1)}*`;
  return `${key.slice(0, secondColon + 1)}*`;
}

/** Categorize a thrown error from the ioredis driver. */
export function categorizeError(err: unknown): {
  kind: RedisErrorKind;
  message: string;
} {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes('max requests limit')) {
    return { kind: 'quota_exceeded', message };
  }
  if (lower.includes('command timed out') || lower.includes('etimedout')) {
    return { kind: 'timeout', message };
  }
  if (
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('connection is closed')
  ) {
    return { kind: 'connection', message };
  }
  if (lower.includes('wrongpass') || lower.includes('noauth')) {
    return { kind: 'auth', message };
  }
  if (lower.includes('replyerror') || err?.constructor?.name === 'ReplyError') {
    return { kind: 'reply_error', message };
  }
  return { kind: 'other', message };
}

@Injectable()
export class RedisMetricsCollector {
  private readonly logger = new Logger(RedisMetricsCollector.name);
  private readonly startedAt = Date.now();

  private readonly ops: Map<RedisOpKind, OpStats> = new Map();
  private readonly hotKeys: Map<string, KeyStats> = new Map();
  private readonly recentErrors: RedisErrorRecord[] = [];
  private readonly errorsByKind: Map<RedisErrorKind, number> = new Map();

  /**
   * Record one Redis operation. Call from inside RedisService AFTER the
   * operation completes (success or fail). Latency is wall-clock from
   * just before the driver call to just after.
   *
   * `hit` is only meaningful for `read` ops. Pass `undefined` for other
   * kinds so the snapshot doesn't double-count writes as hits.
   */
  record(args: {
    op: RedisOpKind;
    key: string;
    latencyMs: number;
    hit?: boolean;
    error?: unknown;
  }): void {
    const stats = this.getOrCreateOpStats(args.op);
    stats.count += 1;
    stats.totalLatencyMs += args.latencyMs;
    if (args.latencyMs > stats.maxLatencyMs) {
      stats.maxLatencyMs = args.latencyMs;
    }
    stats.latencySamples.push(args.latencyMs);
    if (stats.latencySamples.length > LATENCY_SAMPLE_CAP) {
      stats.latencySamples.shift();
    }
    if (args.error) {
      stats.errorCount += 1;
      this.recordError(args.op, args.key, args.error);
    } else if (args.hit === true) {
      stats.hitCount += 1;
    } else if (args.hit === false) {
      stats.missCount += 1;
    }
    this.touchKey(args.key);
  }

  /** Snapshot for the admin endpoint. Pure read, no allocation in hot path. */
  snapshot(): RedisMetricsSnapshot {
    const ops = Array.from(this.ops.entries()).map(([kind, s]) => {
      const samples = [...s.latencySamples].sort((a, b) => a - b);
      return {
        kind,
        count: s.count,
        errorCount: s.errorCount,
        hitCount: s.hitCount,
        missCount: s.missCount,
        hitRatio:
          s.hitCount + s.missCount > 0
            ? s.hitCount / (s.hitCount + s.missCount)
            : null,
        avgLatencyMs:
          s.count > 0
            ? Math.round((s.totalLatencyMs / s.count) * 100) / 100
            : 0,
        p50LatencyMs: percentile(samples, 0.5),
        p95LatencyMs: percentile(samples, 0.95),
        p99LatencyMs: percentile(samples, 0.99),
        maxLatencyMs: s.maxLatencyMs,
      };
    });

    const totals = ops.reduce(
      (acc, op) => {
        acc.totalOps += op.count;
        acc.totalErrors += op.errorCount;
        acc.totalHits += op.hitCount;
        acc.totalMisses += op.missCount;
        return acc;
      },
      { totalOps: 0, totalErrors: 0, totalHits: 0, totalMisses: 0 },
    );

    const hotKeys = Array.from(this.hotKeys.entries())
      .map(([prefix, k]) => ({
        prefix,
        count: k.count,
        lastSeenAt: new Date(k.lastSeenAt).toISOString(),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const errorsByKind = Object.fromEntries(this.errorsByKind);

    return {
      podStartedAt: new Date(this.startedAt).toISOString(),
      uptimeMs: Date.now() - this.startedAt,
      totals: {
        ...totals,
        overallHitRatio:
          totals.totalHits + totals.totalMisses > 0
            ? totals.totalHits / (totals.totalHits + totals.totalMisses)
            : null,
        errorRate:
          totals.totalOps > 0 ? totals.totalErrors / totals.totalOps : 0,
      },
      ops,
      hotKeys,
      errorsByKind,
      recentErrors: [...this.recentErrors].reverse(), // newest first
    };
  }

  /** Reset all counters (admin action; useful for after a deploy). */
  reset(): void {
    this.ops.clear();
    this.hotKeys.clear();
    this.recentErrors.length = 0;
    this.errorsByKind.clear();
  }

  // ---- internal helpers ------------------------------------------------

  private getOrCreateOpStats(kind: RedisOpKind): OpStats {
    let stats = this.ops.get(kind);
    if (!stats) {
      stats = {
        count: 0,
        errorCount: 0,
        hitCount: 0,
        missCount: 0,
        totalLatencyMs: 0,
        maxLatencyMs: 0,
        latencySamples: [],
      };
      this.ops.set(kind, stats);
    }
    return stats;
  }

  private touchKey(key: string): void {
    const prefix = keyPrefix(key);
    const existing = this.hotKeys.get(prefix);
    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = Date.now();
      return;
    }
    if (this.hotKeys.size >= HOT_KEYS_CAP) {
      // Evict oldest (by lastSeenAt) — cheap O(n) scan, runs only when
      // we exceed the cap which is rare given the tight prefix grouping.
      let oldestKey: string | null = null;
      let oldestTs = Infinity;
      for (const [k, v] of this.hotKeys) {
        if (v.lastSeenAt < oldestTs) {
          oldestTs = v.lastSeenAt;
          oldestKey = k;
        }
      }
      if (oldestKey) this.hotKeys.delete(oldestKey);
    }
    this.hotKeys.set(prefix, { count: 1, lastSeenAt: Date.now() });
  }

  private recordError(op: RedisOpKind, key: string, err: unknown): void {
    const { kind, message } = categorizeError(err);
    this.errorsByKind.set(kind, (this.errorsByKind.get(kind) ?? 0) + 1);
    this.recentErrors.push({
      timestamp: Date.now(),
      op,
      key,
      kind,
      message: message.slice(0, 500),
    });
    if (this.recentErrors.length > RECENT_ERRORS_CAP) {
      this.recentErrors.shift();
    }
    if (kind === 'quota_exceeded') {
      // Quota exhaustion is the failure we built this service to catch —
      // log it loudly so it shows up in Cloud Run alerting too.
      this.logger.error(
        `Redis quota exceeded on op=${op} key=${key} — see /admin/cache-health`,
      );
    }
  }
}

/** Estimate p-th percentile from a pre-sorted samples array. */
function percentile(sortedSamples: number[], p: number): number {
  if (sortedSamples.length === 0) return 0;
  const idx = Math.min(
    sortedSamples.length - 1,
    Math.floor(p * sortedSamples.length),
  );
  return sortedSamples[idx];
}
