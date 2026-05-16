import { Test, TestingModule } from '@nestjs/testing';

import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlagController', () => {
  let controller: FeatureFlagController;
  let service: { isEnabled: jest.Mock };

  const user = { id: 'user-1', role: 'USER', email: 'a@b.com', locale: 'zh' };

  beforeEach(async () => {
    service = {
      isEnabled: jest.fn(),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagController],
      providers: [{ provide: FeatureFlagService, useValue: service }],
    }).compile();
    controller = moduleRef.get(FeatureFlagController);
  });

  it('evaluates a single flag for the current user', async () => {
    service.isEnabled.mockResolvedValueOnce(true);

    const result = await controller.evaluate(user, 'flag-a');

    expect(result).toEqual({ flags: { 'flag-a': true } });
    expect(service.isEnabled).toHaveBeenCalledWith('flag-a', {
      userId: 'user-1',
      role: 'USER',
    });
  });

  it('evaluates multiple flags in parallel', async () => {
    service.isEnabled
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await controller.evaluate(user, 'flag-a,flag-b,flag-c');

    expect(result).toEqual({
      flags: { 'flag-a': true, 'flag-b': false, 'flag-c': true },
    });
    expect(service.isEnabled).toHaveBeenCalledTimes(3);
  });

  it('trims whitespace and dedupes empties from the keys list', async () => {
    service.isEnabled.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await controller.evaluate(user, '  flag-a , , flag-b  ');

    expect(result).toEqual({ flags: { 'flag-a': true, 'flag-b': false } });
    expect(service.isEnabled).toHaveBeenCalledTimes(2);
  });

  it('returns an empty map when no keys are supplied', async () => {
    const result = await controller.evaluate(user, '');
    expect(result).toEqual({ flags: {} });
    expect(service.isEnabled).not.toHaveBeenCalled();
  });

  it('caps a runaway request at 20 flag keys', async () => {
    const keys = Array.from({ length: 30 }, (_, i) => `flag-${i}`).join(',');
    service.isEnabled.mockResolvedValue(false);

    const result = await controller.evaluate(user, keys);

    expect(Object.keys(result.flags)).toHaveLength(20);
    expect(service.isEnabled).toHaveBeenCalledTimes(20);
  });

  it('handles undefined keys param without throwing (graceful empty)', async () => {
    const result = await controller.evaluate(
      user,
      undefined as unknown as string,
    );
    expect(result).toEqual({ flags: {} });
    expect(service.isEnabled).not.toHaveBeenCalled();
  });
});
