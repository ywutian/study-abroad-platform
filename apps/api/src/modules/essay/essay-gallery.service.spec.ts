import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EssayGalleryService } from './essay-gallery.service';
import { EssayAiService } from './essay-ai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/incentive.service';

jest.mock('../points/refund.helper', () => ({
  safeRefund: jest.fn().mockResolvedValue(undefined),
}));

import { safeRefund } from '../points/refund.helper';

describe('EssayGalleryService', () => {
  let service: EssayGalleryService;

  const mockPrisma = {
    admissionCase: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockEssayAiService = {
    analyzeEssayParagraphs: jest.fn(),
  };

  const mockIncentiveService = {
    charge: jest.fn().mockResolvedValue({ newBalance: 80 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayGalleryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EssayAiService, useValue: mockEssayAiService },
        { provide: PointsService, useValue: mockIncentiveService },
      ],
    }).compile();

    service = module.get<EssayGalleryService>(EssayGalleryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getGalleryEssays', () => {
    it('should return paginated gallery essays with stats', async () => {
      const mockCases = [
        {
          id: 'case-1',
          year: 2025,
          result: 'ADMITTED',
          essayType: 'COMMON_APP',
          promptNumber: 1,
          essayPrompt: 'Why this school?',
          essayContent:
            'I have always dreamed of attending this school because of its programs...',
          school: { id: 's1', name: 'MIT', nameZh: 'MIT', usNewsRank: 1 },
          tags: ['strong-essay'],
          isVerified: true,
        },
      ];

      mockPrisma.admissionCase.findMany.mockResolvedValue(mockCases);
      mockPrisma.admissionCase.count.mockResolvedValue(1);
      mockPrisma.admissionCase.groupBy.mockResolvedValue([
        { essayType: 'COMMON_APP', _count: 1 },
      ]);

      const result = await service.getGalleryEssays({
        page: 1,
        pageSize: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.items[0].id).toBe('case-1');
      expect(result.items[0].preview).toBeDefined();
      expect(result.items[0].wordCount).toBeGreaterThan(0);
      expect(result.stats).toBeDefined();
    });

    it('should apply filters correctly', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);
      mockPrisma.admissionCase.count.mockResolvedValue(0);
      mockPrisma.admissionCase.groupBy.mockResolvedValue([]);

      await service.getGalleryEssays({
        school: 'MIT',
        type: 'COMMON_APP',
        year: 2025,
        result: 'ADMITTED',
        isVerified: true,
        sortBy: 'popular',
        page: 1,
        pageSize: 20,
      });

      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: expect.arrayContaining([
            expect.objectContaining({ isVerified: 'desc' }),
          ]),
        }),
      );
    });

    it('should calculate totalPages correctly', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);
      mockPrisma.admissionCase.count.mockResolvedValue(25);
      mockPrisma.admissionCase.groupBy.mockResolvedValue([]);

      const result = await service.getGalleryEssays({
        page: 1,
        pageSize: 10,
      });

      expect(result.totalPages).toBe(3);
    });
  });

  describe('getGalleryEssayDetail', () => {
    it('should return essay detail for public case', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-1',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt text',
        essayContent: 'Full essay content here for reading',
        gpaRange: '3.8-4.0',
        satRange: '1500-1550',
        school: { id: 's1', name: 'MIT', usNewsRank: 1 },
        tags: ['verified'],
        isVerified: true,
        visibility: 'PUBLIC',
      });

      const result = await service.getGalleryEssayDetail('case-1');

      expect(result.id).toBe('case-1');
      expect(result.content).toBe('Full essay content here for reading');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.isAnonymous).toBe(false);
    });

    it('should throw NotFoundException when case not found', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue(null);

      await expect(
        service.getGalleryEssayDetail('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should mark essay as anonymous when visibility is ANONYMOUS', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-2',
        year: 2025,
        round: 'RD',
        result: 'ADMITTED',
        essayType: 'UC',
        promptNumber: 1,
        essayPrompt: null,
        essayContent: 'Anonymous content',
        gpaRange: null,
        satRange: null,
        school: null,
        tags: [],
        isVerified: false,
        visibility: 'ANONYMOUS',
      });

      const result = await service.getGalleryEssayDetail('case-2');
      expect(result.isAnonymous).toBe(true);
    });
  });

  describe('analyzeGalleryEssay', () => {
    it('should charge points and return analysis', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-1',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Why school?',
        essayContent: 'Full essay content here',
        gpaRange: null,
        satRange: null,
        school: { id: 's1', name: 'MIT', usNewsRank: 1 },
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
      });

      mockEssayAiService.analyzeEssayParagraphs.mockResolvedValue({
        paragraphs: [],
        overallScore: 80,
        structure: {
          hasStrongOpening: true,
          hasClarity: true,
          hasGoodConclusion: true,
          feedback: 'Good structure',
        },
        summary: 'Good essay',
      });

      const result = await service.analyzeGalleryEssay(
        'user-1',
        'case-1',
        undefined,
        'en',
      );

      expect(mockIncentiveService.charge).toHaveBeenCalledWith(
        'user-1',
        'AI_ESSAY_GALLERY',
      );
      expect(result.essayId).toBe('case-1');
      expect(result.overallScore).toBe(80);
      expect(result.tokenUsed).toBeGreaterThan(0);
    });

    it('should refund and throw when essay content is empty', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-2',
        year: 2025,
        round: 'RD',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: null,
        essayPrompt: null,
        essayContent: null,
        gpaRange: null,
        satRange: null,
        school: null,
        tags: [],
        isVerified: false,
        visibility: 'PUBLIC',
      });

      await expect(
        service.analyzeGalleryEssay('user-1', 'case-2'),
      ).rejects.toThrow(BadRequestException);
      expect(safeRefund).toHaveBeenCalled();
    });

    it('should refund and throw when AI analysis fails', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-3',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: null,
        essayPrompt: 'Prompt',
        essayContent: 'Some content',
        gpaRange: null,
        satRange: null,
        school: { id: 's1', name: 'MIT' },
        tags: [],
        isVerified: false,
        visibility: 'PUBLIC',
      });

      mockEssayAiService.analyzeEssayParagraphs.mockRejectedValue(
        new Error('AI failure'),
      );

      await expect(
        service.analyzeGalleryEssay('user-1', 'case-3'),
      ).rejects.toThrow(BadRequestException);
      expect(safeRefund).toHaveBeenCalled();
    });
  });
});
