import { Test, TestingModule } from '@nestjs/testing';
import { UserDataService } from './user-data.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SanitizerService } from './sanitizer.service';

describe('UserDataService', () => {
  let service: UserDataService;
  let prisma: {
    memory: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      deleteMany: jest.Mock;
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserDataService,
        {
          provide: PrismaService,
          useValue: {
            memory: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              count: jest.fn().mockResolvedValue(0),
            },
            conversation: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
            },
            entity: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
            },
            message: {
              count: jest.fn().mockResolvedValue(0),
            },
            userPreference: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: SanitizerService,
          useValue: {
            sanitize: jest.fn((text: string) => text),
            sanitizeObject: jest.fn((obj: any) => obj),
          },
        },
      ],
    }).compile();

    service = module.get(UserDataService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return paginated memories', async () => {
    prisma.memory.findMany.mockResolvedValue([]);
    prisma.memory.count.mockResolvedValue(0);

    const result = await service.getMemories('user-1', {
      page: 1,
      limit: 10,
    });
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('hasMore');
  });

  it('should delete a memory using deleteMany', async () => {
    prisma.memory.deleteMany.mockResolvedValue({ count: 1 });
    const result = await service.deleteMemory('user-1', 'mem-1');
    expect(result).toBe(true);
    expect(prisma.memory.deleteMany).toHaveBeenCalledWith({
      where: { id: 'mem-1', userId: 'user-1' },
    });
  });

  it('should return false when no memory deleted', async () => {
    prisma.memory.deleteMany.mockResolvedValue({ count: 0 });
    const result = await service.deleteMemory('user-1', 'nonexistent');
    expect(result).toBe(false);
  });
});
