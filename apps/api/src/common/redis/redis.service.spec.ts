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

  beforeEach(() => {
    metrics = new RedisMetricsCollector();
  });

  it('treats quota exhaustion as a cache miss and opens the circuit', async () => {
    const service = new RedisService(
      createConfig({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 }),
      metrics,
    );
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
    const service = new RedisService(
      createConfig({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 }),
      metrics,
    );
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
    const service = new RedisService(
      createConfig({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 }),
      metrics,
    );

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
    const service = new RedisService(
      createConfig({ REDIS_CIRCUIT_BREAKER_COOLDOWN_MS: 60000 }),
      metrics,
    );
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
});
