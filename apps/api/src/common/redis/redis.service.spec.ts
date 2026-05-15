import { ConfigService } from '@nestjs/config';
import { RedisMetricsCollector } from './redis-metrics.service';
import { RedisService } from './redis.service';

function createConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string) => overrides[key]),
  } as unknown as ConfigService;
}

function attachClient(
  service: RedisService,
  client: Record<string, unknown>,
  endpointCount = 1,
) {
  (service as any).endpointSpecs = Array.from(
    { length: endpointCount },
    (_, index) => ({
      label: `url:${index + 1}`,
      url: `redis://endpoint-${index + 1}`,
    }),
  );
  (service as any).activeEndpointIndex = 0;
  (service as any).client = {
    disconnect: jest.fn(),
    quit: jest.fn(),
    ...client,
  };
  (service as any).isConnected = true;
}

describe('RedisService resilience', () => {
  let metrics: RedisMetricsCollector;
  let activeServices: RedisService[];

  function createService(overrides: Record<string, unknown> = {}) {
    const service = new RedisService(createConfig(overrides), metrics);
    activeServices.push(service);
    return service;
  }

  beforeEach(() => {
    metrics = new RedisMetricsCollector();
    activeServices = [];
  });

  afterEach(async () => {
    await Promise.all(
      activeServices.map((service) => service.onModuleDestroy()),
    );
    jest.useRealTimers();
  });

  it('treats quota exhaustion as a cache miss and opens the circuit', async () => {
    const service = createService({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 });
    attachClient(service, {
      get: jest
        .fn()
        .mockRejectedValue(
          new Error(
            'ERR max requests limit exceeded. Limit: 500000, Usage: 500000.',
          ),
        ),
    });

    await expect(
      service.get('schools:available-countries'),
    ).resolves.toBeNull();

    expect(service.connected).toBe(false);
    expect(service.getClient()).toBeNull();
    expect(service.getRuntimeState()).toMatchObject({
      circuitOpen: true,
      circuitReason: 'quota_exceeded',
      availableEndpointCount: 0,
    });
    expect(metrics.snapshot().errorsByKind.quota_exceeded).toBe(1);
  });

  it('attempts failover to the next configured Redis URL after a quota error', async () => {
    const service = createService({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 });
    attachClient(
      service,
      {
        get: jest
          .fn()
          .mockRejectedValue(new Error('ERR max requests limit exceeded')),
      },
      2,
    );
    const connect = jest.fn().mockResolvedValue(undefined);
    (service as any).connect = connect;

    await expect(service.get('school:list:abc')).resolves.toBeNull();

    expect(connect).toHaveBeenCalledWith(1);
    expect(service.getRuntimeState()).toMatchObject({
      availableEndpointCount: 1,
    });
  });

  it('fails open for non-critical setNX and fails closed for strict automation locks', async () => {
    const service = createService({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 });

    attachClient(service, {
      set: jest.fn().mockRejectedValue(new Error('ECONNRESET')),
    });
    await expect(service.setNX('lock:prediction:1', '1', 60)).resolves.toBe(
      true,
    );

    attachClient(service, {
      set: jest.fn().mockRejectedValue(new Error('ECONNRESET')),
    });
    await expect(
      service.setNXStrict(
        'lock:application-analysis-experiments:hourly',
        '1',
        60,
      ),
    ).resolves.toBe(false);
  });

  it('reports health from the local circuit without spending another Redis command', async () => {
    const service = createService({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 });
    const ping = jest.fn();
    attachClient(service, {
      get: jest
        .fn()
        .mockRejectedValue(new Error('ERR max requests limit exceeded')),
      ping,
    });

    await service.get('profile:user-1');
    await expect(service.healthCheck()).resolves.toMatchObject({
      status: 'error',
      message: 'Redis circuit open: quota_exceeded',
    });
    expect(ping).not.toHaveBeenCalled();
  });

  it('reconnects in the background after Redis becomes disconnected', async () => {
    jest.useFakeTimers();
    const service = createService({ REDIS_RECONNECT_INTERVAL_MS: 25 });
    (service as any).endpointSpecs = [
      { label: 'url:1', url: 'redis://endpoint-1' },
    ];
    const connect = jest.fn().mockImplementation(async () => {
      (service as any).activeEndpointIndex = 0;
      (service as any).client = { disconnect: jest.fn(), quit: jest.fn() };
      (service as any).isConnected = true;
      (service as any).reconnectAttempts = 0;
    });
    (service as any).connect = connect;

    (service as any).scheduleReconnectIfNeeded();

    expect(service.getRuntimeState().nextReconnectAt).not.toBeNull();
    await jest.advanceTimersByTimeAsync(25);

    expect(connect).toHaveBeenCalledWith(0);
    expect(service.getRuntimeState()).toMatchObject({
      connected: true,
    });
    expect(service.getRuntimeState().lastReconnectAttemptAt).not.toBeNull();
  });

  it('does not schedule another reconnect while one is already in flight', () => {
    jest.useFakeTimers();
    const service = createService({ REDIS_RECONNECT_INTERVAL_MS: 25 });
    (service as any).endpointSpecs = [
      { label: 'url:1', url: 'redis://endpoint-1' },
    ];
    (service as any).reconnectInFlight = true;

    (service as any).scheduleReconnectIfNeeded();

    expect(service.getRuntimeState().nextReconnectAt).toBeNull();
  });

  it('clears pending reconnect timers on destroy', async () => {
    jest.useFakeTimers();
    const service = createService({ REDIS_RECONNECT_INTERVAL_MS: 25 });
    (service as any).endpointSpecs = [
      { label: 'url:1', url: 'redis://endpoint-1' },
    ];
    const connect = jest.fn();
    (service as any).connect = connect;

    (service as any).scheduleReconnectIfNeeded();
    await service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(25);

    expect(connect).not.toHaveBeenCalled();
    expect(service.getRuntimeState().nextReconnectAt).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2026-05: with multiple Redis URLs configured, a single endpoint's
  // quota exhaustion must NOT mark the whole subsystem as degraded. The
  // RuntimeState surface exposes per-endpoint detail so operators can
  // see which provider is healthy.
  // ─────────────────────────────────────────────────────────────────────

  it('reports circuitOpen=false on the subsystem when at least one endpoint stays healthy', async () => {
    const service = createService({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 });
    attachClient(
      service,
      {
        get: jest
          .fn()
          .mockRejectedValue(new Error('ERR max requests limit exceeded')),
      },
      3,
    );
    // Pretend the failover-target connect succeeds, so the subsystem
    // remains healthy on a different endpoint.
    (service as any).connect = jest.fn().mockImplementation(async () => {
      (service as any).activeEndpointIndex = 1;
      (service as any).client = { disconnect: jest.fn(), quit: jest.fn() };
      (service as any).isConnected = true;
    });

    await expect(service.get('schools:list')).resolves.toBeNull();

    const runtime = service.getRuntimeState();
    expect(runtime.endpointCount).toBe(3);
    // Subsystem-wide circuit is NOT open — at least 2 endpoints still available.
    expect(runtime.circuitOpen).toBe(false);
    expect(runtime.availableEndpointCount).toBe(2);
    expect(runtime.activeEndpoint).toBe('url:2');
    // Per-endpoint detail tells operators exactly which one tripped.
    expect(runtime.endpoints).toHaveLength(3);
    expect(runtime.endpoints[0]).toMatchObject({
      label: 'url:1',
      active: false,
      circuitOpen: true,
      circuitReason: 'quota_exceeded',
    });
    expect(runtime.endpoints[1]).toMatchObject({
      label: 'url:2',
      active: true,
      circuitOpen: false,
    });
  });

  it('reports subsystem circuitOpen=true only when every endpoint tripped', async () => {
    const service = createService({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 });
    attachClient(service, {
      get: jest
        .fn()
        .mockRejectedValue(new Error('ERR max requests limit exceeded')),
    });

    await service.get('key');

    const runtime = service.getRuntimeState();
    // Single-endpoint config: when it trips, the whole subsystem is down.
    expect(runtime.circuitOpen).toBe(true);
    expect(runtime.endpoints[0].circuitOpen).toBe(true);
  });

  it('uses short circuit cooldowns for transient connection errors', async () => {
    const service = createService({
      REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000,
      REDIS_TRANSIENT_CIRCUIT_COOLDOWN_MS: 1000,
    });
    attachClient(service, {
      set: jest.fn().mockRejectedValue(new Error('ECONNRESET')),
    });

    await expect(service.setNXStrict('lock:transient', '1', 60)).resolves.toBe(
      false,
    );

    const runtime = service.getRuntimeState();
    expect(runtime).toMatchObject({
      circuitOpen: true,
      circuitReason: 'connection',
    });
    expect(Date.parse(runtime.circuitOpenUntil!) - Date.now()).toBeLessThan(
      2000,
    );
  });
});
