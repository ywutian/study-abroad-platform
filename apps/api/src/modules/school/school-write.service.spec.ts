import { SchoolWriteService } from './school-write.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

describe('SchoolWriteService cache invalidation', () => {
  let service: SchoolWriteService;
  let redis: {
    del: jest.Mock;
    delByPrefix: jest.Mock;
  };

  beforeEach(() => {
    redis = {
      del: jest.fn().mockResolvedValue(1),
      delByPrefix: jest.fn().mockResolvedValue(1),
    };
    service = new SchoolWriteService(
      {} as PrismaService,
      redis as unknown as RedisService,
    );
  });

  it('throttles expensive school list prefix invalidation bursts', async () => {
    await service.invalidateSchoolCaches('school-1');
    await service.invalidateSchoolCaches('school-2');

    expect(redis.del).toHaveBeenCalledWith('school:detail:school-1');
    expect(redis.del).toHaveBeenCalledWith('school:detail:school-2');
    expect(redis.del).toHaveBeenCalledWith('school:data-quality');
    expect(redis.delByPrefix).toHaveBeenCalledTimes(1);
    expect(redis.delByPrefix).toHaveBeenCalledWith('school:list:');
  });
});
