import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { HighSchoolService } from './high-school.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

jest.mock('@study-abroad/shared/scoring', () => ({
  computeTierFromPartial: jest.fn().mockReturnValue(3),
  computeHsQualityScore: jest.fn().mockReturnValue({
    score: 60,
    grade: 'B',
    missingCritical: [],
  }),
}));

describe('HighSchoolService', () => {
  let service: HighSchoolService;

  const mockPrisma = {
    highSchool: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    highSchoolSuggestion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockHighSchool = {
    id: 'hs-1',
    name: 'Phillips Academy Andover',
    nameZh: '安多佛菲利普斯学院',
    country: 'US',
    state: 'MA',
    city: 'Andover',
    type: 'PRIVATE',
    tier: 5,
    isActive: true,
    evaluatedAt: new Date(),
    evaluatedBy: 'admin-1',
    qualityScore: 85,
    qualityGrade: 'A',
    hsImpactEnabled: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HighSchoolService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<HighSchoolService>(HighSchoolService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should return schools matching search term', async () => {
      mockPrisma.highSchool.findMany.mockResolvedValue([mockHighSchool]);

      const result = await service.search({ search: 'Phillips' });

      expect(result).toHaveLength(1);
      expect(mockPrisma.highSchool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              expect.objectContaining({
                name: { contains: 'Phillips', mode: 'insensitive' },
              }),
            ]),
          }),
        }),
      );
    });

    it('should filter by country and type', async () => {
      mockPrisma.highSchool.findMany.mockResolvedValue([]);

      await service.search({ country: 'US', type: 'PRIVATE' as any });

      expect(mockPrisma.highSchool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country: 'US',
            type: 'PRIVATE',
          }),
        }),
      );
    });

    it('should cap pageSize at 100', async () => {
      mockPrisma.highSchool.findMany.mockResolvedValue([]);

      await service.search({ pageSize: 500 });

      expect(mockPrisma.highSchool.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('findById', () => {
    it('should return high school by id', async () => {
      mockPrisma.highSchool.findUnique.mockResolvedValue(mockHighSchool);

      const result = await service.findById('hs-1');

      expect(result).toEqual(mockHighSchool);
      expect(mockPrisma.highSchool.findUnique).toHaveBeenCalledWith({
        where: { id: 'hs-1' },
      });
    });

    it('should return null for non-existent id', async () => {
      mockPrisma.highSchool.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a high school with quality gate processing', async () => {
      mockPrisma.highSchool.create.mockResolvedValue(mockHighSchool);

      const result = await service.create(
        {
          name: 'Phillips Academy Andover',
          country: 'US',
          type: 'PRIVATE',
        },
        'admin-1',
      );

      expect(result).toEqual(mockHighSchool);
      expect(mockPrisma.highSchool.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update an existing high school', async () => {
      mockPrisma.highSchool.findUnique.mockResolvedValue(mockHighSchool);
      mockPrisma.highSchool.update.mockResolvedValue({
        ...mockHighSchool,
        nameZh: '更新后的名称',
      });

      const result = await service.update(
        'hs-1',
        { nameZh: '更新后的名称' },
        'admin-1',
      );

      expect(result.nameZh).toBe('更新后的名称');
    });

    it('should throw NotFoundException for non-existent school', async () => {
      mockPrisma.highSchool.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { nameZh: 'test' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitSuggestion', () => {
    it('should create a new suggestion', async () => {
      mockPrisma.highSchoolSuggestion.findUnique.mockResolvedValue(null);
      mockPrisma.highSchoolSuggestion.create.mockResolvedValue({
        id: 'sug-1',
        name: 'New High School',
        country: 'US',
        submittedBy: ['user-1'],
      });

      const result = await service.submitSuggestion(
        { name: 'New High School', country: 'US' },
        'user-1',
      );

      expect(result.name).toBe('New High School');
      expect(mockPrisma.highSchoolSuggestion.create).toHaveBeenCalledWith({
        data: {
          name: 'New High School',
          country: 'US',
          submittedBy: ['user-1'],
        },
      });
    });

    it('should add userId to existing suggestion if not already present', async () => {
      mockPrisma.highSchoolSuggestion.findUnique.mockResolvedValue({
        id: 'sug-1',
        name: 'Existing School',
        country: 'US',
        submittedBy: ['user-1'],
      });
      mockPrisma.highSchoolSuggestion.update.mockResolvedValue({
        id: 'sug-1',
        submittedBy: ['user-1', 'user-2'],
      });

      const result = await service.submitSuggestion(
        { name: 'Existing School', country: 'US' },
        'user-2',
      );

      expect(mockPrisma.highSchoolSuggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: { submittedBy: { push: 'user-2' } },
      });
    });

    it('should return existing suggestion if user already submitted', async () => {
      const existing = {
        id: 'sug-1',
        name: 'Existing School',
        country: 'US',
        submittedBy: ['user-1'],
      };
      mockPrisma.highSchoolSuggestion.findUnique.mockResolvedValue(existing);

      const result = await service.submitSuggestion(
        { name: 'Existing School', country: 'US' },
        'user-1',
      );

      expect(result).toEqual(existing);
      expect(mockPrisma.highSchoolSuggestion.update).not.toHaveBeenCalled();
    });
  });

  describe('approveSuggestion', () => {
    it('should create high school from approved suggestion', async () => {
      mockPrisma.highSchoolSuggestion.findUnique.mockResolvedValue({
        id: 'sug-1',
        name: 'New School',
        country: 'US',
        state: 'CA',
        city: 'LA',
        status: 'pending',
        submittedBy: ['user-1'],
      });
      mockPrisma.highSchool.create.mockResolvedValue({
        id: 'hs-new',
        name: 'New School',
      });
      mockPrisma.highSchoolSuggestion.update.mockResolvedValue({
        id: 'sug-1',
        status: 'approved',
      });

      const result = await service.approveSuggestion('sug-1', 'PUBLIC');

      expect(result.name).toBe('New School');
      expect(mockPrisma.highSchool.create).toHaveBeenCalled();
      expect(mockEventEmitter.emit).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent suggestion', async () => {
      mockPrisma.highSchoolSuggestion.findUnique.mockResolvedValue(null);

      await expect(
        service.approveSuggestion('nonexistent', 'PUBLIC'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for already-processed suggestion', async () => {
      mockPrisma.highSchoolSuggestion.findUnique.mockResolvedValue({
        id: 'sug-1',
        status: 'approved',
      });

      await expect(
        service.approveSuggestion('sug-1', 'PUBLIC'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should merge into existing school when mergeIntoId is provided', async () => {
      mockPrisma.highSchoolSuggestion.findUnique.mockResolvedValue({
        id: 'sug-1',
        name: 'Duplicate School',
        status: 'pending',
        submittedBy: ['user-1'],
      });
      mockPrisma.highSchoolSuggestion.update.mockResolvedValue({
        id: 'sug-1',
        status: 'merged',
      });

      const result = await service.approveSuggestion(
        'sug-1',
        'PUBLIC',
        'hs-existing',
      );

      expect(mockPrisma.highSchoolSuggestion.update).toHaveBeenCalledWith({
        where: { id: 'sug-1' },
        data: { status: 'merged', mergedInto: 'hs-existing' },
      });
      expect(mockPrisma.highSchool.create).not.toHaveBeenCalled();
    });
  });

  describe('batchImport', () => {
    it('should create new schools and return counts', async () => {
      mockPrisma.highSchool.findFirst.mockResolvedValue(null);
      mockPrisma.highSchool.create.mockResolvedValue({
        id: 'hs-new',
        name: 'Test School',
      });

      const result = await service.batchImport(
        [{ name: 'Test School', country: 'US', type: 'PUBLIC' }],
        'admin-1',
      );

      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should skip schools missing required fields', async () => {
      const result = await service.batchImport(
        [{ name: 'Missing Country' }],
        'admin-1',
      );

      expect(result.created).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('Missing required fields');
    });

    it('should update existing schools with new evaluation dimensions', async () => {
      mockPrisma.highSchool.findFirst.mockResolvedValue({
        ...mockHighSchool,
        recognition: null,
      });
      mockPrisma.highSchool.update.mockResolvedValue(mockHighSchool);

      const result = await service.batchImport(
        [
          {
            name: 'Phillips Academy Andover',
            country: 'US',
            type: 'PRIVATE',
            recognition: 5,
          },
        ],
        'admin-1',
      );

      expect(result.updated).toBe(1);
      expect(mockPrisma.highSchool.update).toHaveBeenCalled();
    });

    it('should skip existing schools without new evaluation data', async () => {
      mockPrisma.highSchool.findFirst.mockResolvedValue(mockHighSchool);

      const result = await service.batchImport(
        [{ name: 'Phillips Academy Andover', country: 'US', type: 'PRIVATE' }],
        'admin-1',
      );

      expect(result.skipped).toBe(1);
      expect(mockPrisma.highSchool.update).not.toHaveBeenCalled();
    });
  });
});
