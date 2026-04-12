import { Test, TestingModule } from '@nestjs/testing';
import { PredictionMemoryService } from './prediction-memory.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

describe('PredictionMemoryService', () => {
  let service: PredictionMemoryService;
  let memoryManager: MemoryManagerService;

  const mockMemoryManager = {
    recall: jest.fn().mockResolvedValue([]),
    remember: jest.fn().mockResolvedValue(undefined),
    recordEntity: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictionMemoryService,
        { provide: MemoryManagerService, useValue: mockMemoryManager },
      ],
    }).compile();

    service = module.get<PredictionMemoryService>(PredictionMemoryService);
    memoryManager = module.get<MemoryManagerService>(MemoryManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMemoryContext', () => {
    it('should return empty context when no memories exist', async () => {
      const result = await service.getMemoryContext('user-1');

      expect(result.previousPredictions).toEqual([]);
      expect(result.knownPreferences).toEqual([]);
      expect(result.profileInsights).toEqual([]);
    });

    it('should extract previous predictions from memory', async () => {
      mockMemoryManager.recall.mockResolvedValueOnce([
        {
          content: 'prediction',
          metadata: {
            topSchools: [
              { name: 'MIT', probability: 0.3, timestamp: '2025-01-01' },
            ],
          },
        },
      ]);

      const result = await service.getMemoryContext('user-1');

      expect(result.previousPredictions).toHaveLength(1);
      expect(result.previousPredictions[0].schoolName).toBe('MIT');
    });
  });

  describe('recordPredictionToMemory', () => {
    it('should not record when no results', async () => {
      await service.recordPredictionToMemory('user-1', [], {
        previousPredictions: [],
        knownPreferences: [],
      });

      expect(mockMemoryManager.remember).not.toHaveBeenCalled();
    });

    it('should record prediction and school entities', async () => {
      const results = [
        {
          schoolId: 's1',
          schoolName: 'MIT',
          probability: 0.3,
          probabilityLow: 0.2,
          probabilityHigh: 0.4,
          tier: 'reach',
          confidence: 'medium',
        },
      ] as any;

      await service.recordPredictionToMemory('user-1', results, {
        previousPredictions: [],
        knownPreferences: [],
      });

      expect(mockMemoryManager.remember).toHaveBeenCalled();
      expect(mockMemoryManager.recordEntity).toHaveBeenCalled();
    });
  });

  describe('getMemoryFeatures', () => {
    it('should return default features when no memories', async () => {
      const result = await service.getMemoryFeatures('user-1', 'school-1');

      expect(result.previousPredictionForSchool).toBeNull();
      expect(result.predictionCount).toBe(0);
      expect(result.memoryInsightCount).toBe(0);
    });
  });
});
