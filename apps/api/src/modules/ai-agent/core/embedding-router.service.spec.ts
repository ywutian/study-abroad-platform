import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingRouterService } from './embedding-router.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingService } from '../memory/embedding.service';
import { ConfigService } from '@nestjs/config';

describe('EmbeddingRouterService', () => {
  let service: EmbeddingRouterService;
  let prisma: { $queryRawUnsafe: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingRouterService,
        {
          provide: PrismaService,
          useValue: {
            $queryRawUnsafe: jest.fn().mockResolvedValue([]),
            $queryRaw: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: EmbeddingService,
          useValue: {
            embed: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('shadow'),
          },
        },
      ],
    }).compile();

    service = module.get(EmbeddingRouterService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return shouldUseLLM=true when no matches found', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);
    const result = await service.route('hello');
    expect(result.shouldUseLLM).toBe(true);
    expect(result.agent).toBeNull();
  });
});
