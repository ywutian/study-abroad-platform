import { Test, TestingModule } from '@nestjs/testing';
import { MemoryType } from '@prisma/client';
import { MemoryScorerService } from './memory-scorer.service';

describe('MemoryScorerService', () => {
  let service: MemoryScorerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MemoryScorerService],
    }).compile();

    service = module.get(MemoryScorerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should score a memory and return result with tier', () => {
    const result = service.score({
      type: MemoryType.FACT,
      content: 'GPA is 3.9',
      importance: 0.8,
      confidence: 0.9,
      createdAt: new Date(),
      accessCount: 5,
    });

    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.totalScore).toBeLessThanOrEqual(1);
    expect(result).toHaveProperty('tier');
    expect(result).toHaveProperty('components');
    expect(result.components).toHaveProperty('importanceScore');
    expect(result.components).toHaveProperty('freshnessScore');
  });

  it('should return higher score for recent memories', () => {
    const recent = service.score({
      type: MemoryType.FACT,
      content: 'test',
      importance: 0.5,
      confidence: 0.5,
      createdAt: new Date(),
    });
    const old = service.score({
      type: MemoryType.FACT,
      content: 'test',
      importance: 0.5,
      confidence: 0.5,
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    });
    expect(recent.totalScore).toBeGreaterThan(old.totalScore);
  });

  it('should batch score multiple memories', () => {
    const results = service.scoreBatch([
      {
        type: MemoryType.FACT,
        content: 'a',
        importance: 0.5,
        confidence: 0.5,
        createdAt: new Date(),
      },
      {
        type: MemoryType.PREFERENCE,
        content: 'b',
        importance: 0.9,
        confidence: 0.8,
        createdAt: new Date(),
      },
    ]);
    expect(results).toHaveLength(2);
  });

  it('should calculate freshness correctly', () => {
    const freshness = service.getFreshness(new Date());
    expect(freshness).toBeGreaterThan(0.9);

    const oldFreshness = service.getFreshness(
      new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
    );
    expect(oldFreshness).toBeLessThan(freshness);
  });

  it('should allow config updates', () => {
    const original = service.getConfig();
    service.updateConfig({ decayRate: 0.05 });
    expect(service.getConfig().decayRate).toBe(0.05);
    // Restore
    service.updateConfig({ decayRate: original.decayRate });
  });
});
