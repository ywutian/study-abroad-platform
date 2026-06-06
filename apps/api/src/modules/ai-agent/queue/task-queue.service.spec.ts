import { Test, TestingModule } from '@nestjs/testing';
import { TaskQueueService, TaskType, TaskStatus } from './task-queue.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';

describe('TaskQueueService', () => {
  let service: TaskQueueService;
  let prisma: { $executeRaw: jest.Mock; $queryRaw: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskQueueService,
        {
          provide: PrismaService,
          useValue: {
            $executeRaw: jest.fn().mockResolvedValue(1),
            $queryRaw: jest.fn().mockResolvedValue([]),
            $queryRawUnsafe: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(null),
            connected: false,
            zadd: jest.fn().mockResolvedValue(1),
            zrange: jest.fn().mockResolvedValue([]),
            zrangebyscore: jest.fn().mockResolvedValue([]),
            zrem: jest.fn().mockResolvedValue(0),
            del: jest.fn().mockResolvedValue(undefined),
            withClient: jest
              .fn()
              .mockRejectedValue(new Error('Redis unavailable')),
          },
        },
      ],
    }).compile();

    service = module.get(TaskQueueService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    service.stop();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should add a task and return task id', async () => {
    const taskId = await service.add(TaskType.MEMORY_DECAY, {
      userId: 'user-1',
    });
    expect(typeof taskId).toBe('string');
    expect(taskId.length).toBeGreaterThan(0);
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('should add a delayed task', async () => {
    const taskId = await service.add(
      TaskType.CLEANUP_EXPIRED,
      {},
      { delay: 60000 },
    );
    expect(typeof taskId).toBe('string');
  });

  it('should get queue stats', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { status: 'PENDING', count: BigInt(5) },
    ]);
    const stats = await service.getStats();
    expect(stats).toBeDefined();
  });
});
