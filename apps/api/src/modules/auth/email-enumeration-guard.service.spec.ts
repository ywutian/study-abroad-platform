import { Test } from '@nestjs/testing';
import { EmailEnumerationGuardService } from './email-enumeration-guard.service';
import { RedisService } from '../../common/redis/redis.service';

describe('EmailEnumerationGuardService', () => {
  let service: EmailEnumerationGuardService;
  let redis: { withClient: jest.Mock };

  beforeEach(async () => {
    redis = { withClient: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        EmailEnumerationGuardService,
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    service = module.get(EmailEnumerationGuardService);
  });

  it('allows checks at or under the window limit', async () => {
    redis.withClient.mockResolvedValue(20);
    await expect(service.hit('1.2.3.4')).resolves.toEqual({
      allowed: true,
      count: 20,
    });
  });

  it('blocks once the window limit is exceeded', async () => {
    redis.withClient.mockResolvedValue(21);
    await expect(service.hit('1.2.3.4')).resolves.toEqual({
      allowed: false,
      count: 21,
    });
  });

  it('fails open when Redis is unavailable', async () => {
    redis.withClient.mockRejectedValue(new Error('redis down'));
    await expect(service.hit('1.2.3.4')).resolves.toEqual({
      allowed: true,
      count: 0,
    });
  });
});
