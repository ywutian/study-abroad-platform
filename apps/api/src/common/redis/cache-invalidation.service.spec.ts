import { CacheInvalidationService } from './cache-invalidation.service';

describe('CacheInvalidationService', () => {
  const mockRedis = {
    del: jest.fn().mockResolvedValue(1),
    delByPrefix: jest.fn().mockResolvedValue(2),
  };

  const mockPrisma = {
    profile: {
      findUnique: jest.fn(),
    },
    education: {
      findMany: jest.fn(),
    },
    schoolListItem: {
      findMany: jest.fn(),
    },
  };

  let service: CacheInvalidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CacheInvalidationService(mockRedis as any, mockPrisma as any);
  });

  it('invalidates application-analysis prefixes on profile change', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ id: 'profile-1' });

    await service.onProfileChange('user-1');

    expect(mockRedis.del).toHaveBeenCalledWith('profile:user-1');
    expect(mockRedis.del).toHaveBeenCalledWith('ai:recommend:user-1');
    expect(mockRedis.del).toHaveBeenCalledWith('ai:profile-analysis:user-1');
    expect(mockRedis.delByPrefix).toHaveBeenCalledWith(
      'ai:profile-analysis:user-1:',
    );
    expect(mockRedis.delByPrefix).toHaveBeenCalledWith('prediction:profile-1:');
  });

  it('invalidates affected users application-analysis caches on school change', async () => {
    mockPrisma.schoolListItem.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
      { userId: 'user-1' },
    ]);

    await service.onSchoolChange('school-1');

    expect(mockRedis.del).toHaveBeenCalledWith('school:detail:school-1');
    expect(mockRedis.delByPrefix).toHaveBeenCalledWith('school:list:');
    expect(mockRedis.del).toHaveBeenCalledWith('ai:profile-analysis:user-1');
    expect(mockRedis.delByPrefix).toHaveBeenCalledWith(
      'ai:profile-analysis:user-1:',
    );
    expect(mockRedis.del).toHaveBeenCalledWith('ai:profile-analysis:user-2');
    expect(mockRedis.delByPrefix).toHaveBeenCalledWith(
      'ai:profile-analysis:user-2:',
    );
  });

  it('invalidates affected users application-analysis caches on high-school change', async () => {
    mockPrisma.education.findMany.mockResolvedValue([
      { profile: { userId: 'user-1' } },
      { profile: { userId: 'user-2' } },
      { profile: { userId: 'user-1' } },
    ]);
    mockPrisma.profile.findUnique
      .mockResolvedValueOnce({ id: 'profile-1' })
      .mockResolvedValueOnce({ id: 'profile-2' });

    await service.onHighSchoolChange('hs-1');

    expect(mockRedis.delByPrefix).toHaveBeenCalledWith('prediction:profile-1:');
    expect(mockRedis.delByPrefix).toHaveBeenCalledWith('prediction:profile-2:');
    expect(mockRedis.del).toHaveBeenCalledWith('ai:profile-analysis:user-1');
    expect(mockRedis.delByPrefix).toHaveBeenCalledWith(
      'ai:profile-analysis:user-1:',
    );
    expect(mockRedis.del).toHaveBeenCalledWith('ai:profile-analysis:user-2');
    expect(mockRedis.delByPrefix).toHaveBeenCalledWith(
      'ai:profile-analysis:user-2:',
    );
  });
});
