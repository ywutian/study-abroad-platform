import { Test, TestingModule } from '@nestjs/testing';
import { MemoryCompactionService } from './memory-compaction.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { EmbeddingService } from './embedding.service';
import { SummarizerService } from './summarizer.service';

describe('MemoryCompactionService', () => {
  let service: MemoryCompactionService;
  let prisma: {
    memory: { findMany: jest.Mock; count: jest.Mock; update: jest.Mock };
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryCompactionService,
        {
          provide: PrismaService,
          useValue: {
            memory: {
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
              update: jest.fn(),
              groupBy: jest.fn().mockResolvedValue([]),
            },
            $executeRaw: jest.fn().mockResolvedValue(0),
            $transaction: jest.fn((cb: any) => cb()),
            $queryRaw: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(null),
            connected: false,
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            embed: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
            cosineSimilarity: jest.fn().mockReturnValue(0.5),
          },
        },
        {
          provide: SummarizerService,
          useValue: {
            summarizeConversation: jest.fn().mockResolvedValue('summary'),
          },
        },
      ],
    }).compile();

    service = module.get(MemoryCompactionService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty results when no users have memories', async () => {
    prisma.memory.groupBy.mockResolvedValue([]);
    const results = await service.compactAll();
    expect(Array.isArray(results)).toBe(true);
  });
});
