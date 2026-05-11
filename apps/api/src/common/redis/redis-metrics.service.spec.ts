import {
  RedisMetricsCollector,
  categorizeError,
} from './redis-metrics.service';

describe('categorizeError', () => {
  it('detects Upstash quota error', () => {
    const err = new Error(
      'ERR max requests limit exceeded. Limit: 500000, Usage: 500000.',
    );
    expect(categorizeError(err).kind).toBe('quota_exceeded');
  });

  it('detects local circuit breaker skips', () => {
    expect(categorizeError(new Error('Redis circuit open')).kind).toBe(
      'circuit_open',
    );
  });

  it('detects timeout', () => {
    expect(categorizeError(new Error('Command timed out')).kind).toBe(
      'timeout',
    );
    expect(categorizeError(new Error('ETIMEDOUT')).kind).toBe('timeout');
  });

  it('detects connection issues', () => {
    expect(categorizeError(new Error('ECONNRESET')).kind).toBe('connection');
    expect(categorizeError(new Error('Connection is closed')).kind).toBe(
      'connection',
    );
  });

  it('detects auth failures', () => {
    expect(categorizeError(new Error('WRONGPASS invalid password')).kind).toBe(
      'auth',
    );
  });

  it('falls back to other for unknown errors', () => {
    expect(categorizeError(new Error('Something weird')).kind).toBe('other');
    expect(categorizeError('not an error object').kind).toBe('other');
  });
});

describe('RedisMetricsCollector', () => {
  let collector: RedisMetricsCollector;

  beforeEach(() => {
    collector = new RedisMetricsCollector();
  });

  it('records read hits and misses separately', () => {
    collector.record({ op: 'read', key: 'foo:bar', latencyMs: 5, hit: true });
    collector.record({ op: 'read', key: 'foo:baz', latencyMs: 7, hit: false });
    const snap = collector.snapshot();
    expect(snap.totals.totalHits).toBe(1);
    expect(snap.totals.totalMisses).toBe(1);
    expect(snap.totals.overallHitRatio).toBe(0.5);
  });

  it('groups hot keys by second-colon prefix', () => {
    collector.record({ op: 'read', key: 'school:detail:abc', latencyMs: 1 });
    collector.record({ op: 'read', key: 'school:detail:xyz', latencyMs: 1 });
    collector.record({ op: 'read', key: 'user:123:profile', latencyMs: 1 });
    const snap = collector.snapshot();
    const prefixes = snap.hotKeys.map((k) => k.prefix).sort();
    expect(prefixes).toEqual(['school:detail:*', 'user:123:*']);
    const schoolPrefix = snap.hotKeys.find(
      (k) => k.prefix === 'school:detail:*',
    );
    expect(schoolPrefix?.count).toBe(2);
  });

  it('records errors with categorization', () => {
    collector.record({
      op: 'read',
      key: 'foo:bar',
      latencyMs: 100,
      error: new Error('ERR max requests limit exceeded'),
    });
    const snap = collector.snapshot();
    expect(snap.errorsByKind.quota_exceeded).toBe(1);
    expect(snap.recentErrors).toHaveLength(1);
    expect(snap.recentErrors[0].kind).toBe('quota_exceeded');
    expect(snap.recentErrors[0].op).toBe('read');
  });

  it('tracks per-op latency percentiles', () => {
    for (let i = 1; i <= 100; i++) {
      collector.record({ op: 'read', key: `k:${i}`, latencyMs: i, hit: true });
    }
    const snap = collector.snapshot();
    const readOp = snap.ops.find((o) => o.kind === 'read');
    expect(readOp).toBeDefined();
    expect(readOp!.count).toBe(100);
    // p50 should be around 50, p95 around 95
    expect(readOp!.p50LatencyMs).toBeGreaterThanOrEqual(45);
    expect(readOp!.p50LatencyMs).toBeLessThanOrEqual(55);
    expect(readOp!.p95LatencyMs).toBeGreaterThanOrEqual(90);
    expect(readOp!.maxLatencyMs).toBe(100);
  });

  it('caps recent errors at 50', () => {
    for (let i = 0; i < 60; i++) {
      collector.record({
        op: 'read',
        key: `k:${i}`,
        latencyMs: 1,
        error: new Error('ECONNRESET'),
      });
    }
    const snap = collector.snapshot();
    expect(snap.recentErrors).toHaveLength(50);
    // Newest first — last recorded should be at index 0
    expect(snap.recentErrors[0].key).toBe('k:59');
  });

  it('reset clears all counters', () => {
    collector.record({ op: 'read', key: 'foo', latencyMs: 1, hit: true });
    collector.record({
      op: 'write',
      key: 'bar',
      latencyMs: 2,
      error: new Error('ETIMEDOUT'),
    });
    collector.reset();
    const snap = collector.snapshot();
    expect(snap.totals.totalOps).toBe(0);
    expect(snap.totals.totalErrors).toBe(0);
    expect(snap.hotKeys).toHaveLength(0);
    expect(snap.recentErrors).toHaveLength(0);
    expect(snap.errorsByKind).toEqual({});
  });
});
