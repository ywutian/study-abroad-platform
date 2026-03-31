import { Test, TestingModule } from '@nestjs/testing';
import {
  ProfileEnrichmentService,
  EnrichmentSuggestion,
} from './profile-enrichment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

describe('ProfileEnrichmentService', () => {
  let service: ProfileEnrichmentService;

  const mockPrisma = {
    profile: {
      findUnique: jest.fn(),
    },
  };

  const mockMemoryManager = {
    recall: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileEnrichmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MemoryManagerService, useValue: mockMemoryManager },
      ],
    }).compile();

    service = module.get<ProfileEnrichmentService>(ProfileEnrichmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSuggestions', () => {
    it('should return empty array when profile not found', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue(null);

      const result = await service.getSuggestions('user-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when no memories exist', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        gpa: null,
        targetMajor: null,
        currentSchool: null,
        nationality: null,
        testScores: [],
      });
      mockMemoryManager.recall.mockResolvedValue([]);

      const result = await service.getSuggestions('user-1');

      expect(result).toEqual([]);
    });

    it('should extract GPA suggestion from academic memory', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        gpa: null,
        targetMajor: 'CS',
        currentSchool: 'Some School',
        nationality: 'Chinese',
        testScores: [],
      });
      mockMemoryManager.recall.mockResolvedValue([
        {
          content: 'GPA: 3.8/4.0 in computer science',
          category: 'academic',
          type: 'FACT',
        },
      ]);

      const result = await service.getSuggestions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].field).toBe('gpa');
      expect(result[0].suggestedValue).toBe('3.8');
      expect(result[0].confidence).toBe(0.7);
    });

    it('should extract target major suggestion from profile_update memory', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        gpa: 3.8,
        targetMajor: null,
        currentSchool: 'School',
        nationality: 'Chinese',
        testScores: [],
      });
      mockMemoryManager.recall.mockResolvedValue([
        {
          content: '目标专业：Computer Science，准备申请',
          category: 'profile_update',
          type: 'FACT',
        },
      ]);

      const result = await service.getSuggestions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].field).toBe('targetMajor');
      expect(result[0].suggestedValue).toBe('Computer Science');
      expect(result[0].confidence).toBe(0.8);
    });

    it('should extract nationality suggestion', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        gpa: 3.8,
        targetMajor: 'CS',
        currentSchool: 'School',
        nationality: null,
        testScores: [],
      });
      mockMemoryManager.recall.mockResolvedValue([
        {
          content: '国籍：Chinese，准备申请美国大学',
          category: 'profile_update',
          type: 'FACT',
        },
      ]);

      const result = await service.getSuggestions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].field).toBe('nationality');
      expect(result[0].suggestedValue).toBe('Chinese');
    });

    it('should deduplicate and keep highest confidence per field', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        gpa: null,
        targetMajor: null,
        currentSchool: null,
        nationality: null,
        testScores: [],
      });
      mockMemoryManager.recall.mockResolvedValue([
        {
          content: 'GPA: 3.5/4.0',
          category: 'academic',
          type: 'FACT',
        },
        {
          content: 'GPA: 3.8/4.0',
          category: 'academic',
          type: 'FACT',
        },
      ]);

      const result = await service.getSuggestions('user-1');

      // Should only have one GPA suggestion (the last one wins if same confidence)
      const gpaSuggestions = result.filter(
        (s: EnrichmentSuggestion) => s.field === 'gpa',
      );
      expect(gpaSuggestions).toHaveLength(1);
    });

    it('should not suggest for fields already filled in profile', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        gpa: 3.9,
        targetMajor: 'Physics',
        currentSchool: 'Harvard High',
        nationality: 'American',
        testScores: [],
      });
      mockMemoryManager.recall.mockResolvedValue([
        {
          content: 'GPA: 3.5/4.0',
          category: 'academic',
          type: 'FACT',
        },
        {
          content: '目标专业：Computer Science',
          category: 'profile_update',
          type: 'FACT',
        },
      ]);

      const result = await service.getSuggestions('user-1');

      // All fields are filled, so no suggestions
      expect(result).toEqual([]);
    });

    it('should extract school suggestion from education memory', async () => {
      mockPrisma.profile.findUnique.mockResolvedValue({
        userId: 'user-1',
        gpa: 3.8,
        targetMajor: 'CS',
        currentSchool: null,
        nationality: 'Chinese',
        testScores: [],
      });
      mockMemoryManager.recall.mockResolvedValue([
        {
          content: '就读：北京四中，准备申请',
          category: 'education',
          type: 'FACT',
        },
      ]);

      const result = await service.getSuggestions('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].field).toBe('currentSchool');
      expect(result[0].suggestedValue).toBe('北京四中');
      expect(result[0].confidence).toBe(0.6);
    });
  });
});
