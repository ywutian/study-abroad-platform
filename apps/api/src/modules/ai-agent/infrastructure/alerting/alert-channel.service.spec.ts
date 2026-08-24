import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../../../common/email/email.service';
import { RedisService } from '../../../../common/redis/redis.service';
import { AlertChannelService, AlertSeverity } from './alert-channel.service';

const ALERT_ID = 'alert-0123456789abcdef01234567';

describe('AlertChannelService durable delivery', () => {
  let service: AlertChannelService;
  let redis: Record<string, jest.Mock>;
  let client: Record<string, jest.Mock>;
  let config: Record<string, unknown>;
  let email: { sendEmail: jest.Mock };

  beforeEach(async () => {
    config = {};
    const multi = {
      set: jest.fn().mockReturnThis(),
      zrem: jest.fn().mockReturnThis(),
      hset: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    client = {
      eval: jest
        .fn()
        .mockImplementation((script: string) =>
          script.includes('ZCARD') ? 1 : [1, 1],
        ),
      zrangebyscore: jest.fn().mockResolvedValue([]),
      multi: jest.fn().mockReturnValue(multi),
    };
    redis = {
      withClient: jest.fn(
        async (
          _op: string,
          _key: string,
          action: (value: typeof client) => Promise<unknown>,
        ) => action(client),
      ),
      lpush: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(undefined),
      zcard: jest.fn().mockResolvedValue(0),
      zrange: jest.fn().mockResolvedValue([]),
      zrem: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      hgetall: jest.fn().mockResolvedValue({}),
      hget: jest.fn().mockResolvedValue(null),
      hincrby: jest.fn().mockResolvedValue(1),
      hset: jest.fn().mockResolvedValue(1),
      lrange: jest.fn().mockResolvedValue([]),
      tryAcquireLock: jest.fn().mockResolvedValue({ acquired: true }),
    };
    email = { sendEmail: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertChannelService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) =>
              key in config ? config[key] : fallback,
            ),
          },
        },
        { provide: RedisService, useValue: redis },
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    service = module.get(AlertChannelService);
  });

  it('persists only an opaque envelope before delivery', async () => {
    await service.send({
      alertId: 'context-compression-failure',
      title: 'private title 418-555-0100',
      message: 'secret tool argument=never-persist-me',
      severity: AlertSeverity.WARNING,
      source: 'ConversationContextService',
      userId: 'private-user',
      traceId: 'private-trace',
      metadata: { token: 'never-persist-me' },
    });

    const serializedEvalCalls = JSON.stringify(client.eval.mock.calls);
    expect(serializedEvalCalls).not.toContain('never-persist-me');
    expect(serializedEvalCalls).not.toContain('418-555-0100');
    expect(redis.lpush).toHaveBeenCalledWith(
      expect.stringMatching(/^ai-agent:alert:v1:delivery:alert-/),
      expect.not.stringContaining('never-persist-me'),
    );
  });

  it('defaults to Redis and reports email as unavailable without a real provider', async () => {
    config = {
      ALERT_EMAIL_ENABLED: 'true',
      ALERT_EMAIL_RECIPIENTS: 'not-a-real-inbox@example.invalid',
    };
    // Construct after config change; the provider credential is intentionally absent.
    const module = await Test.createTestingModule({
      providers: [
        AlertChannelService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, fallback?: unknown) => config[key] ?? fallback,
            ),
          },
        },
        { provide: RedisService, useValue: redis },
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    const configured = module.get(AlertChannelService);

    await expect(configured.getStats()).resolves.toEqual({
      pendingAlerts: 0,
      activeAlerts: 0,
      configuredChannels: ['redis_queue'],
      unavailableChannels: ['email'],
    });
  });

  it('delivers a due envelope through the configured channel without its original body', async () => {
    config = { ALERT_SLACK_WEBHOOK: 'https://alert.example.invalid/webhook' };
    const module = await Test.createTestingModule({
      providers: [
        AlertChannelService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, fallback?: unknown) => config[key] ?? fallback,
            ),
          },
        },
        { provide: RedisService, useValue: redis },
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    const configured = module.get(AlertChannelService);
    client.zrangebyscore.mockResolvedValue([ALERT_ID]);
    redis.hgetall.mockResolvedValue({
      alertId: ALERT_ID,
      severity: 'warning',
      source: 'agent-runner',
      firstSeenAt: '2026-01-01T00:00:00.000Z',
      lastSeenAt: '2026-01-01T00:01:00.000Z',
      count: '3',
      attempts: '0',
      deliveryStatus: 'pending',
    });
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 200 }));

    await configured.deliverPendingAlerts();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://alert.example.invalid/webhook',
      expect.objectContaining({ method: 'POST' }),
    );
    const request = fetchSpy.mock.calls[0][1] as RequestInit;
    const requestBody = request.body as string;
    expect(requestBody).not.toContain('private');
    expect(requestBody).toContain(ALERT_ID);
    expect(redis.hset).toHaveBeenCalledWith(
      expect.stringContaining(ALERT_ID),
      'delivered:slack',
      '1',
    );
    fetchSpy.mockRestore();
  });

  it('records a retry rather than dropping a failed external delivery', async () => {
    config = { ALERT_SLACK_WEBHOOK: 'https://alert.example.invalid/webhook' };
    const module = await Test.createTestingModule({
      providers: [
        AlertChannelService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, fallback?: unknown) => config[key] ?? fallback,
            ),
          },
        },
        { provide: RedisService, useValue: redis },
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    const configured = module.get(AlertChannelService);
    client.zrangebyscore.mockResolvedValue([ALERT_ID]);
    redis.hgetall.mockResolvedValue({
      alertId: ALERT_ID,
      severity: 'warning',
      source: 'agent-runner',
      lastSeenAt: '2026-01-01T00:01:00.000Z',
      count: '1',
      attempts: '0',
    });
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));

    await configured.deliverPendingAlerts();

    expect(redis.lpush).toHaveBeenCalledWith(
      expect.stringContaining(ALERT_ID),
      expect.stringContaining('failed'),
    );
    expect(client.multi).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('acknowledges without retaining the admin id or notes in Redis', async () => {
    await service.acknowledgeAlert(
      ALERT_ID,
      'admin-private-id',
      'private note',
    );

    const setCall = client.multi.mock.results[0].value.set.mock.calls[0];
    expect(JSON.stringify(setCall)).not.toContain('admin-private-id');
    expect(JSON.stringify(setCall)).not.toContain('private note');
    expect(client.multi.mock.results[0].value.zrem).toHaveBeenCalledWith(
      'ai-agent:alert:v1:due',
      ALERT_ID,
    );
  });
});
