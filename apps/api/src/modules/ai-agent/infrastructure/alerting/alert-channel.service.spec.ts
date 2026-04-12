import { Test, TestingModule } from '@nestjs/testing';
import { AlertChannelService, AlertSeverity } from './alert-channel.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../../common/redis/redis.service';

describe('AlertChannelService', () => {
  let service: AlertChannelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertChannelService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((_key: string, defaultValue?: any) => {
                return defaultValue ?? undefined;
              }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(null),
            connected: false,
          },
        },
      ],
    }).compile();

    service = module.get(AlertChannelService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should accept alert payloads without throwing', async () => {
    await service.send({
      title: 'Test Alert',
      message: 'Something happened',
      severity: AlertSeverity.INFO,
      source: 'test',
    });
  });

  it('should return alert stats', async () => {
    const stats = await service.getStats();
    expect(stats).toHaveProperty('configuredChannels');
    expect(stats).toHaveProperty('pendingAlerts');
  });
});
