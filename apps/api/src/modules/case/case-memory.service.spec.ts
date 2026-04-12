import { Test, TestingModule } from '@nestjs/testing';
import { CaseMemoryService } from './case-memory.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

describe('CaseMemoryService', () => {
  let service: CaseMemoryService;
  let memoryManager: MemoryManagerService;

  const mockMemoryManager = {
    remember: jest.fn().mockResolvedValue(undefined),
    recordEntity: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseMemoryService,
        { provide: MemoryManagerService, useValue: mockMemoryManager },
      ],
    }).compile();

    service = module.get<CaseMemoryService>(CaseMemoryService);
    memoryManager = module.get<MemoryManagerService>(MemoryManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordCreateCaseToMemory', () => {
    it('should record case creation to memory system', async () => {
      const admissionCase = {
        id: 'case-1',
        school: { name: 'MIT', nameZh: '麻省理工' },
        activities: [],
        awards: [],
        testScores: [],
      };
      const data = {
        schoolId: 's1',
        year: 2025,
        result: 'ADMITTED',
        gpaRange: '3.9',
      };

      await service.recordCreateCaseToMemory('user-1', admissionCase, data);

      expect(mockMemoryManager.remember).toHaveBeenCalled();
      expect(mockMemoryManager.recordEntity).toHaveBeenCalled();
    });

    it('should skip memory for bulk imports', async () => {
      await service.recordCreateCaseToMemory(
        'user-1',
        { id: 'case-1' },
        { source: 'csv_import' },
      );

      expect(mockMemoryManager.remember).not.toHaveBeenCalled();
    });
  });

  describe('recordViewCaseToMemory', () => {
    it('should record case view to memory', async () => {
      const caseItem = {
        id: 'case-1',
        schoolId: 's1',
        year: 2025,
        result: 'ADMITTED',
        school: { name: 'MIT', nameZh: '麻省理工' },
      };

      await service.recordViewCaseToMemory('user-1', caseItem);

      expect(mockMemoryManager.remember).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ importance: 0.3 }),
      );
    });
  });
});
