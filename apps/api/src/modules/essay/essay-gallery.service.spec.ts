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
      // Cache write-through in analyzeGalleryEssay (PR 1 fix #4) calls
      // `admissionCase.update` after a fresh LLM analysis lands.
      update: jest.fn().mockResolvedValue({}),
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

    // ── PR 2 · §B — Provenance backfill from `tags` ──────────────────
    //
    // The harvest pipeline stamps `source:<url>#<author>` on each case;
    // legacy rows pre-date the dedicated `sourceArchive/Url/Author`
    // columns. On read, the service resolves provenance from the column
    // first, falls back to parsing the tag — and write-backs into the
    // columns so the next read hits the hot path. We verify both the
    // resolution AND the write-back here.
    it('should resolve provenance from tags and write-back into the dedicated columns', async () => {
      const mockCases = [
        {
          id: 'case-1',
          year: 2025,
          result: 'ADMITTED',
          essayType: 'COMMON_APP',
          promptNumber: 1,
          essayPrompt: 'Prompt',
          essayContent: 'Words words words.',
          school: { id: 's1', name: 'JHU', nameZh: 'JHU', usNewsRank: 9 },
          tags: [
            'source:https://apply.jhu.edu/hopkins-insider/korean-sticky-notes/#Nancy',
            'jhu',
            'essays-that-worked',
          ],
          isVerified: true,
          sourceArchive: null,
          sourceUrl: null,
          sourceAuthor: null,
        },
      ];
      mockPrisma.admissionCase.findMany.mockResolvedValue(mockCases);
      mockPrisma.admissionCase.count.mockResolvedValue(1);
      mockPrisma.admissionCase.groupBy.mockResolvedValue([]);

      const result = await service.getGalleryEssays({
        page: 1,
        pageSize: 10,
      });

      // Resolved provenance is on the response without requiring the
      // dedicated columns to already be populated.
      expect(result.items[0].sourceArchive).toBe('apply.jhu.edu');
      expect(result.items[0].sourceUrl).toBe(
        'https://apply.jhu.edu/hopkins-insider/korean-sticky-notes/',
      );
      expect(result.items[0].sourceAuthor).toBe('Nancy');

      // Write-back fires on the next event-loop tick because we
      // `void`-ignore the promise. Yield once before asserting.
      await new Promise((r) => setImmediate(r));
      expect(mockPrisma.admissionCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'case-1' },
          data: expect.objectContaining({
            sourceArchive: 'apply.jhu.edu',
            sourceAuthor: 'Nancy',
          }),
        }),
      );
    });

    it('should leave provenance null when no source tag is present', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([
        {
          id: 'case-anon',
          year: 2024,
          result: 'ADMITTED',
          essayType: 'COMMON_APP',
          promptNumber: 1,
          essayPrompt: 'Prompt',
          essayContent: 'Self-uploaded.',
          school: { id: 's2', name: 'Yale', nameZh: 'Yale' },
          tags: ['stem', 'research'],
          isVerified: false,
          sourceArchive: null,
          sourceUrl: null,
          sourceAuthor: null,
        },
      ]);
      mockPrisma.admissionCase.count.mockResolvedValue(1);
      mockPrisma.admissionCase.groupBy.mockResolvedValue([]);

      const result = await service.getGalleryEssays({
        page: 1,
        pageSize: 10,
      });

      expect(result.items[0].sourceArchive).toBeNull();
      expect(result.items[0].sourceUrl).toBeNull();
      expect(result.items[0].sourceAuthor).toBeNull();
    });
  });

  // ── PR 2 · §C — Rejected-essay tab ───────────────────────────────────
  describe('getRejectedEssays', () => {
    it('should filter to REJECTED / WAITLISTED only', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);
      mockPrisma.admissionCase.count.mockResolvedValue(0);

      await service.getRejectedEssays({ page: 1, pageSize: 20 });

      expect(mockPrisma.admissionCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            result: { in: ['REJECTED', 'WAITLISTED'] },
          }),
        }),
      );
    });

    it('should return empty items + total 0 for the launch case', async () => {
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);
      mockPrisma.admissionCase.count.mockResolvedValue(0);

      const result = await service.getRejectedEssays({
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
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

      const result = (await service.analyzeGalleryEssay(
        'user-1',
        'case-1',
        undefined,
        'en',
      )) as {
        essayId: string;
        overallScore: number;
        tokenUsed: number;
        cached: boolean;
      };

      expect(mockIncentiveService.charge).toHaveBeenCalledWith(
        'user-1',
        'AI_ESSAY_GALLERY',
      );
      expect(result.essayId).toBe('case-1');
      expect(result.overallScore).toBe(80);
      expect(result.tokenUsed).toBeGreaterThan(0);
      // First-time analysis: cache miss → fresh LLM round-trip + write-through.
      expect(result.cached).toBe(false);
      expect(mockPrisma.admissionCase.update).toHaveBeenCalled();
    });

    it('should return cached payload on cache hit without calling LLM', async () => {
      // Canonical run (no schoolName override) + cache hit + version matches
      // → must bypass LLM and serve cached payload. Points still charged
      // (per spec — see mama-persona feedback).
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-cache',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Why?',
        essayContent: 'Cached essay content',
        gpaRange: null,
        satRange: null,
        school: { id: 's1', name: 'MIT', usNewsRank: 1 },
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: {
          en: {
            promptVersion: 'v1',
            generatedAt: '2026-05-01T00:00:00.000Z',
            payload: {
              paragraphs: [],
              overallScore: 88,
              structure: {
                hasStrongOpening: true,
                hasClarity: true,
                hasGoodConclusion: true,
                feedback: 'Solid',
              },
              summary: 'Cached summary',
            },
          },
        },
      });

      const result = (await service.analyzeGalleryEssay(
        'user-1',
        'case-cache',
        undefined,
        'en',
      )) as {
        essayId: string;
        overallScore: number;
        cached: boolean;
        tokenUsed: number;
      };

      expect(result.essayId).toBe('case-cache');
      expect(result.overallScore).toBe(88);
      expect(result.cached).toBe(true);
      // LLM must NOT have been called on a cache hit.
      expect(mockEssayAiService.analyzeEssayParagraphs).not.toHaveBeenCalled();
      // Points are still charged on cache hit — spec keeps cost at 20.
      expect(mockIncentiveService.charge).toHaveBeenCalled();
    });

    it('should bypass cache when caller supplies a custom schoolName', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-custom',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Why?',
        essayContent: 'Custom-fit essay content',
        gpaRange: null,
        satRange: null,
        school: { id: 's1', name: 'MIT', usNewsRank: 1 },
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: {
          en: {
            promptVersion: 'v1',
            generatedAt: '2026-05-01T00:00:00.000Z',
            payload: { overallScore: 88 },
          },
        },
      });
      mockEssayAiService.analyzeEssayParagraphs.mockResolvedValue({
        paragraphs: [],
        overallScore: 70,
        structure: {
          hasStrongOpening: true,
          hasClarity: true,
          hasGoodConclusion: false,
          feedback: 'Custom fit',
        },
        summary: 'Custom run',
      });

      // schoolName !== canonical 'MIT' → custom-fit path → fresh LLM, no cache
      // write, cached: false.
      const result = (await service.analyzeGalleryEssay(
        'user-1',
        'case-custom',
        'Stanford',
        'en',
      )) as { overallScore: number; cached: boolean };

      expect(result.overallScore).toBe(70);
      expect(result.cached).toBe(false);
      expect(mockEssayAiService.analyzeEssayParagraphs).toHaveBeenCalled();
      // Custom-fit run MUST NOT write to the cache (would poison canonical
      // entries with a school-specific take).
      expect(mockPrisma.admissionCase.update).not.toHaveBeenCalled();
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
