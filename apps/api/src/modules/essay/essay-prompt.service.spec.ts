import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EssayPromptService } from './essay-prompt.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('EssayPromptService', () => {
  let service: EssayPromptService;

  const mockPrisma = {
    school: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    essayPrompt: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    essayPromptAudit: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayPromptService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<EssayPromptService>(EssayPromptService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an essay prompt successfully', async () => {
      const dto = {
        schoolId: 'school-1',
        year: 2025,
        type: 'COMMON_APP' as any,
        prompt: 'Tell us about yourself',
        sourceType: 'OFFICIAL' as any,
        sourceUrl: 'https://example.com',
      };

      mockPrisma.school.findUnique.mockResolvedValue({ id: 'school-1' });
      mockPrisma.essayPrompt.create.mockResolvedValue({
        id: 'prompt-1',
        ...dto,
        school: { name: 'MIT' },
        sources: [{ sourceType: 'OFFICIAL' }],
      });

      const result = await service.create(dto, 'admin-1');

      expect(result.id).toBe('prompt-1');
      expect(mockPrisma.school.findUnique).toHaveBeenCalledWith({
        where: { id: 'school-1' },
      });
      expect(mockPrisma.essayPromptAudit.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when school not found', async () => {
      mockPrisma.school.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            schoolId: 'nonexistent',
            year: 2025,
            type: 'COMMON_APP' as any,
            prompt: 'Test',
          },
          'admin-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated essay prompts', async () => {
      const mockData = [
        { id: 'p1', prompt: 'Prompt 1', school: { name: 'MIT' } },
        { id: 'p2', prompt: 'Prompt 2', school: { name: 'Stanford' } },
      ];
      mockPrisma.essayPrompt.findMany.mockResolvedValue(mockData);
      mockPrisma.essayPrompt.count.mockResolvedValue(2);

      const result = await service.findAll({
        page: 1,
        pageSize: 20,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should apply search filter', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockPrisma.essayPrompt.count.mockResolvedValue(0);

      await service.findAll({ search: 'MIT', page: 1, pageSize: 10 });

      expect(mockPrisma.essayPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              expect.objectContaining({
                prompt: { contains: 'MIT', mode: 'insensitive' },
              }),
            ]),
          }),
        }),
      );
    });

    it('should apply year and type filters', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([]);
      mockPrisma.essayPrompt.count.mockResolvedValue(0);

      await service.findAll({
        year: 2025,
        type: 'COMMON_APP' as any,
        page: 1,
        pageSize: 10,
      });

      expect(mockPrisma.essayPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            year: 2025,
            type: 'COMMON_APP',
          }),
        }),
      );
    });

    it('should return only source-backed verified prompts for public queries', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([
        {
          id: 'p1',
          prompt: 'Prompt 1',
          status: 'VERIFIED',
          school: { name: 'MIT' },
          sources: [
            {
              sourceType: 'OFFICIAL',
              sourceUrl: 'https://mit.edu/apply/essays',
              scrapedAt: new Date('2026-01-01T00:00:00Z'),
              confidence: 0.92,
            },
          ],
        },
      ]);
      mockPrisma.essayPrompt.count.mockResolvedValue(1);

      const result = await service.findAllPublic({
        page: 1,
        pageSize: 20,
      });

      expect(mockPrisma.essayPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            status: 'VERIFIED',
            sources: { some: { sourceUrl: { not: null } } },
          }),
        }),
      );
      const publicPrompt = result.data[0] as any;
      expect(publicPrompt).not.toHaveProperty('sources');
      expect(publicPrompt.sourceSummary).toEqual(
        expect.objectContaining({
          hasSourceEvidence: true,
          sourceUrls: ['https://mit.edu/apply/essays'],
          sourceQuality: 'official',
          minConfidence: 0.92,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return essay prompt by id', async () => {
      mockPrisma.essayPrompt.findUnique.mockResolvedValue({
        id: 'p1',
        prompt: 'Test prompt',
        school: { name: 'MIT' },
        sources: [],
        auditLogs: [],
      });

      const result = await service.findOne('p1');

      expect(result.id).toBe('p1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockPrisma.essayPrompt.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOnePublic', () => {
    it('should return essay prompt without auditLogs and sources', async () => {
      mockPrisma.essayPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        schoolId: 'school-1',
        type: 'COMMON_APP',
        prompt: 'Tell us about yourself',
        promptZh: '请介绍你自己',
        wordLimit: 650,
        isRequired: true,
        year: 2025,
        school: {
          id: 'school-1',
          name: 'MIT',
          nameZh: '麻省理工',
          usNewsRank: 1,
        },
        sources: [
          {
            sourceType: 'OFFICIAL',
            sourceUrl: 'https://mit.edu/apply/essays',
            scrapedAt: new Date('2026-01-01T00:00:00Z'),
            confidence: 0.9,
          },
        ],
      });

      const result = await service.findOnePublic('p1');

      expect(result.id).toBe('p1');
      expect(result.prompt).toBe('Tell us about yourself');
      expect(result.year).toBe(2025);
      // Must NOT contain auditLogs or sources
      expect(result).not.toHaveProperty('auditLogs');
      expect(result).not.toHaveProperty('sources');
      expect(result.sourceSummary).toEqual(
        expect.objectContaining({
          hasSourceEvidence: true,
          sourceUrls: ['https://mit.edu/apply/essays'],
        }),
      );
    });

    it('should throw NotFoundException when essay prompt does not exist', async () => {
      mockPrisma.essayPrompt.findFirst.mockResolvedValue(null);

      await expect(service.findOnePublic('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use select (not include) to exclude sensitive fields at query level', async () => {
      mockPrisma.essayPrompt.findFirst.mockResolvedValue({
        id: 'p1',
        schoolId: 'school-1',
        type: 'COMMON_APP',
        prompt: 'Test',
        promptZh: null,
        wordLimit: null,
        isRequired: true,
        year: 2025,
        school: {
          id: 'school-1',
          name: 'MIT',
          nameZh: '麻省理工',
          usNewsRank: 1,
        },
        sources: [{ sourceType: 'OFFICIAL', sourceUrl: 'https://example.com' }],
      });

      await service.findOnePublic('p1');

      // Verify the query uses select (not include) and only exposes
      // public-safe source metadata needed for provenance.
      const callArgs = mockPrisma.essayPrompt.findFirst.mock.calls[0][0];
      expect(callArgs).toHaveProperty('select');
      expect(callArgs.select).not.toHaveProperty('auditLogs');
      expect(callArgs.select.sources).toEqual({
        select: {
          sourceType: true,
          sourceUrl: true,
          scrapedAt: true,
          confidence: true,
        },
      });
      expect(callArgs.where).toEqual(
        expect.objectContaining({
          id: 'p1',
          isActive: true,
          status: 'VERIFIED',
          sources: { some: { sourceUrl: { not: null } } },
        }),
      );
    });
  });

  describe('findBySchool', () => {
    it('should return verified prompts for a school', async () => {
      mockPrisma.essayPrompt.findMany.mockResolvedValue([
        { id: 'p1', prompt: 'Prompt 1', status: 'VERIFIED' },
      ]);

      const result = await service.findBySchool('school-1', 2025);

      expect(result).toHaveLength(1);
      expect(mockPrisma.essayPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId: 'school-1',
            isActive: true,
            status: 'VERIFIED',
            year: 2025,
            sources: { some: { sourceUrl: { not: null } } },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update essay prompt', async () => {
      mockPrisma.essayPrompt.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'PENDING',
        school: { name: 'MIT' },
        sources: [],
        auditLogs: [],
      });
      mockPrisma.essayPrompt.update.mockResolvedValue({
        id: 'p1',
        prompt: 'Updated prompt',
        school: { name: 'MIT' },
        sources: [],
      });

      const result = await service.update(
        'p1',
        { prompt: 'Updated prompt' },
        'admin-1',
      );

      expect(result.prompt).toBe('Updated prompt');
      expect(mockPrisma.essayPromptAudit.create).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should verify essay prompt', async () => {
      mockPrisma.essayPrompt.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'PENDING',
        school: { name: 'MIT' },
        sources: [],
        auditLogs: [],
      });
      mockPrisma.essayPrompt.update.mockResolvedValue({
        id: 'p1',
        status: 'VERIFIED',
        school: { name: 'MIT' },
      });

      const result = await service.verify(
        'p1',
        { status: 'VERIFIED' as any },
        'admin-1',
      );

      expect(result.status).toBe('VERIFIED');
    });

    it('should throw BadRequestException when rejecting without reason', async () => {
      mockPrisma.essayPrompt.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'PENDING',
        school: { name: 'MIT' },
        sources: [],
        auditLogs: [],
      });

      await expect(
        service.verify('p1', { status: 'REJECTED' as any }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft-delete essay prompt', async () => {
      mockPrisma.essayPrompt.findUnique.mockResolvedValue({
        id: 'p1',
        status: 'PENDING',
        school: { name: 'MIT' },
        sources: [],
        auditLogs: [],
      });
      mockPrisma.essayPrompt.update.mockResolvedValue({ id: 'p1' });

      const result = await service.remove('p1', 'admin-1');

      expect(result.message).toBe('删除成功');
      expect(mockPrisma.essayPrompt.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isActive: false },
      });
    });
  });

  describe('countBySchoolIds', () => {
    it('should return counts grouped by school id', async () => {
      mockPrisma.essayPrompt.groupBy.mockResolvedValue([
        { schoolId: 'school-1', _count: 5 },
        { schoolId: 'school-2', _count: 3 },
      ]);

      const result = await service.countBySchoolIds([
        'school-1',
        'school-2',
        'school-3',
      ]);

      expect(result.get('school-1')).toBe(5);
      expect(result.get('school-2')).toBe(3);
      expect(result.get('school-3')).toBeUndefined();
    });

    it('should return empty map for empty input', async () => {
      const result = await service.countBySchoolIds([]);

      expect(result.size).toBe(0);
      expect(mockPrisma.essayPrompt.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return review statistics', async () => {
      mockPrisma.essayPrompt.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(10) // verified
        .mockResolvedValueOnce(2) // rejected
        .mockResolvedValueOnce(17); // total
      mockPrisma.essayPrompt.groupBy.mockResolvedValue([
        { type: 'COMMON_APP', _count: 8 },
        { type: 'UC', _count: 2 },
      ]);

      const result = await service.getStats(2025);

      expect(result.pending).toBe(5);
      expect(result.verified).toBe(10);
      expect(result.rejected).toBe(2);
      expect(result.total).toBe(17);
      expect(result.byType).toEqual({ COMMON_APP: 8, UC: 2 });
    });
  });
});
