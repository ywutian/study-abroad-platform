import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../common/redis/redis.service';
import { ResilienceService } from '../core/resilience.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'OPENAI_API_KEY') return undefined; // No API key
              return undefined;
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
        {
          provide: ResilienceService,
          useValue: {
            execute: jest.fn(),
            withRetry: jest.fn(),
            withCircuitBreaker: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(EmbeddingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return empty vector when API key is missing', async () => {
    const result = await service.embed('test text');
    expect(Array.isArray(result)).toBe(true);
    // Without API key, should return empty/zero vector
    expect(result.length).toBe(0);
  });

  it('should calculate cosine similarity', () => {
    const a = [1, 0, 0];
    const b = [1, 0, 0];
    expect(service.cosineSimilarity(a, b)).toBeCloseTo(1);
  });

  it('should return 0 similarity for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(service.cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it('should handle empty vectors in similarity', () => {
    expect(service.cosineSimilarity([], [])).toBe(0);
  });
});
