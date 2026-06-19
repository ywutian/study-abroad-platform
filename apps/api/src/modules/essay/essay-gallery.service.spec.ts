import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { EssayGalleryService } from './essay-gallery.service';
import { EssayAiService, PARAGRAPH_PROMPT_VERSION } from './essay-ai.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService } from '../points/incentive.service';
import { LLMService } from '../ai-agent/core/llm.service';

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
    essay: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    essayAIResult: {
      create: jest.fn(),
    },
    galleryEssayAIInteraction: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    galleryEssayAIInteractionFeedback: {
      upsert: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const mockEssayAiService = {
    analyzeEssayParagraphs: jest.fn(),
  };

  const mockIncentiveService = {
    charge: jest.fn().mockResolvedValue({
      newBalance: 80,
      pointHistoryId: 'point-history-1',
      points: -5,
    }),
  };

  const mockLLMService = {
    chatSimpleGuarded: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayGalleryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EssayAiService, useValue: mockEssayAiService },
        { provide: PointsService, useValue: mockIncentiveService },
        { provide: LLMService, useValue: mockLLMService },
      ],
    }).compile();

    service = module.get<EssayGalleryService>(EssayGalleryService);
    mockIncentiveService.charge.mockResolvedValue({
      newBalance: 80,
      pointHistoryId: 'point-history-1',
      points: -5,
    });
    (safeRefund as jest.Mock).mockResolvedValue({
      newBalance: 85,
      pointHistoryId: 'refund-history-1',
      points: 5,
    });
    mockPrisma.galleryEssayAIInteraction.create.mockResolvedValue({
      id: 'interaction-1',
    });
    mockPrisma.galleryEssayAIInteraction.findFirst.mockResolvedValue(null);
    mockPrisma.galleryEssayAIInteraction.update.mockResolvedValue({});
    mockPrisma.galleryEssayAIInteraction.findMany.mockResolvedValue([]);
    mockPrisma.galleryEssayAIInteraction.count.mockResolvedValue(0);
    mockPrisma.galleryEssayAIInteraction.aggregate.mockResolvedValue({
      _avg: { tokensUsed: 0 },
    });
    mockPrisma.galleryEssayAIInteractionFeedback.groupBy.mockResolvedValue([]);
    mockPrisma.galleryEssayAIInteractionFeedback.upsert.mockResolvedValue({
      id: 'feedback-1',
      interactionId: 'interaction-1',
      sentiment: 'HELPFUL',
      category: null,
      notes: null,
      createdAt: new Date('2026-06-18T00:00:00.000Z'),
      updatedAt: new Date('2026-06-18T00:00:00.000Z'),
    });
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

  describe('getGalleryLearningNotes', () => {
    it('should return cached notes without charging points or calling LLM', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-notes',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt',
        essayContent: 'Paragraph one.\n\nParagraph two.',
        gpaRange: null,
        satRange: null,
        school: { id: 's1', name: 'MIT', usNewsRank: 1 },
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: {
          en: {
            promptVersion: PARAGRAPH_PROMPT_VERSION,
            generatedAt: '2026-05-01T00:00:00.000Z',
            payload: {
              paragraphs: [
                {
                  paragraphIndex: 0,
                  paragraphText: 'Paragraph one.',
                  score: 8,
                  status: 'good',
                  comment: 'Clear setup',
                  highlights: [{ text: 'specific', dimension: 'detail' }],
                  suggestions: [],
                },
              ],
              overallScore: 86,
              structure: {
                hasStrongOpening: true,
                hasClarity: true,
                hasGoodConclusion: true,
                feedback: 'Solid structure',
              },
              summary: 'Shared learning note',
            },
          },
        },
      });

      const result = await service.getGalleryLearningNotes('case-notes', 'en');

      expect(result.status).toBe('ready');
      expect(result.cached).toBe(true);
      expect(result.requestedLocale).toBe('en');
      expect(result.sourceLocale).toBe('en');
      expect(result.fallbackUsed).toBe(false);
      expect(result.payload?.overallScore).toBe(86);
      expect(mockIncentiveService.charge).not.toHaveBeenCalled();
      expect(mockLLMService.chatSimpleGuarded).not.toHaveBeenCalled();
    });

    it('should fallback to the alternate locale when current locale cache is missing', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-fallback',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt',
        essayContent: 'Paragraph one.',
        gpaRange: null,
        satRange: null,
        school: null,
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: {
          zh: {
            promptVersion: PARAGRAPH_PROMPT_VERSION,
            generatedAt: '2026-05-01T00:00:00.000Z',
            payload: {
              paragraphs: [],
              overallScore: 90,
              structure: {
                hasStrongOpening: true,
                hasClarity: true,
                hasGoodConclusion: true,
                feedback: '结构清楚',
              },
              summary: '共享拆解',
            },
          },
        },
      });

      const result = await service.getGalleryLearningNotes(
        'case-fallback',
        'en',
      );

      expect(result.status).toBe('ready');
      expect(result.requestedLocale).toBe('en');
      expect(result.sourceLocale).toBe('zh');
      expect(result.fallbackUsed).toBe(true);
      expect(result.payload?.overallScore).toBe(90);
    });

    it('should return unavailable when no current cache exists', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-miss',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt',
        essayContent: 'Essay content',
        gpaRange: null,
        satRange: null,
        school: null,
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: null,
      });

      const result = await service.getGalleryLearningNotes('case-miss', 'en');

      expect(result).toEqual({
        essayId: 'case-miss',
        status: 'unavailable',
        promptVersion: PARAGRAPH_PROMPT_VERSION,
        cached: false,
        requestedLocale: 'en',
        fallbackUsed: false,
      });
      expect(mockIncentiveService.charge).not.toHaveBeenCalled();
      expect(mockLLMService.chatSimpleGuarded).not.toHaveBeenCalled();
    });
  });

  describe('askGalleryEssay', () => {
    it('should charge points and return a grounded answer with evidence', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-ask',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt',
        essayContent: 'A vivid opening.\n\nA reflective ending.',
        gpaRange: null,
        satRange: null,
        school: { id: 's1', name: 'MIT', usNewsRank: 1 },
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: null,
      });
      mockLLMService.chatSimpleGuarded.mockResolvedValue(
        JSON.stringify({
          answer: 'The opening works because it starts with a concrete scene.',
          evidence: [
            {
              source: 'essay',
              quote: 'A vivid opening.',
              paragraphIndex: 0,
              note: 'Concrete opening signal',
            },
          ],
          followUps: ['How can I write a similar opening without copying?'],
        }),
      );

      const result = await service.askGalleryEssay(
        'user-1',
        'case-ask',
        { question: 'Why does the opening work?' },
        'en',
      );

      expect(mockIncentiveService.charge).toHaveBeenCalledWith(
        'user-1',
        'AI_ESSAY_GALLERY_ASK',
        expect.objectContaining({
          galleryEssayId: 'case-ask',
          interactionType: 'question',
        }),
      );
      expect(result.answer).toContain('opening');
      expect(result.evidence).toHaveLength(1);
      expect(result.evidence[0].source).toBe('essay');
      expect(result.interactionId).toBe('interaction-1');
      expect(mockPrisma.galleryEssayAIInteraction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            admissionCaseId: 'case-ask',
            type: 'question',
            status: 'PENDING',
          }),
        }),
      );
      expect(mockPrisma.galleryEssayAIInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'interaction-1' },
          data: expect.objectContaining({
            status: 'SUCCEEDED',
            refundStatus: 'NOT_NEEDED',
          }),
        }),
      );
    });

    it('should reuse a succeeded interaction for the same client request id without charging again', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-ask',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt',
        essayContent: 'A vivid opening.',
        gpaRange: null,
        satRange: null,
        school: null,
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: null,
      });
      mockPrisma.galleryEssayAIInteraction.findFirst.mockResolvedValue({
        id: 'interaction-existing',
        admissionCaseId: 'case-ask',
        type: 'question',
        status: 'SUCCEEDED',
        locale: 'en',
        question: 'Why does this work?',
        paragraphIndex: null,
        selectedText: null,
        focus: null,
        userEssayId: null,
        essayAIResultId: null,
        output: {
          answer: 'Because it opens with a concrete detail.',
          followUps: ['How can I adapt the structure?'],
        },
        evidence: [
          {
            source: 'essay',
            quote: 'A vivid opening.',
            verified: true,
          },
        ],
        tokensUsed: 88,
        pointsAction: 'AI_ESSAY_GALLERY_ASK',
        pointsCharged: 5,
        pointsHistoryId: 'point-history-1',
        refundPointHistoryId: null,
        refundStatus: 'NOT_NEEDED',
        errorMessage: null,
        feedback: null,
        createdAt: new Date('2026-06-18T00:00:00.000Z'),
        updatedAt: new Date('2026-06-18T00:00:00.000Z'),
      });

      const result = await service.askGalleryEssay(
        'user-1',
        'case-ask',
        {
          question: 'Why does this work?',
          clientRequestId: 'request-1',
        },
        'en',
      );

      expect(result.interactionId).toBe('interaction-existing');
      expect(result.answer).toContain('concrete detail');
      expect(mockIncentiveService.charge).not.toHaveBeenCalled();
      expect(mockLLMService.chatSimpleGuarded).not.toHaveBeenCalled();
      expect(
        mockPrisma.galleryEssayAIInteraction.create,
      ).not.toHaveBeenCalled();
    });

    it('should refund and mark interaction failed when the LLM call fails', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-ask-fail',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt',
        essayContent: 'A vivid opening.',
        gpaRange: null,
        satRange: null,
        school: null,
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: null,
      });
      mockPrisma.galleryEssayAIInteraction.create.mockResolvedValue({
        id: 'interaction-failed',
      });
      mockLLMService.chatSimpleGuarded.mockRejectedValue(new Error('LLM down'));

      await expect(
        service.askGalleryEssay(
          'user-1',
          'case-ask-fail',
          { question: 'Why does this work?' },
          'en',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(safeRefund).toHaveBeenCalledWith(
        mockIncentiveService,
        'user-1',
        'AI_ESSAY_GALLERY_ASK',
        expect.anything(),
        expect.objectContaining({
          galleryEssayId: 'case-ask-fail',
          interactionId: 'interaction-failed',
        }),
      );
      expect(mockPrisma.galleryEssayAIInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'interaction-failed' },
          data: expect.objectContaining({
            status: 'FAILED',
            refundStatus: 'REFUNDED',
          }),
        }),
      );
    });
  });

  describe('compareGalleryEssay', () => {
    it('should enforce ownership before comparing', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-compare',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt',
        essayContent: 'Reference essay content',
        gpaRange: null,
        satRange: null,
        school: null,
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: null,
      });
      mockPrisma.essay.findFirst.mockResolvedValue(null);

      await expect(
        service.compareGalleryEssay(
          'user-1',
          'case-compare',
          { userEssayId: 'essay-other' },
          'en',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockIncentiveService.charge).not.toHaveBeenCalled();
      expect(mockLLMService.chatSimpleGuarded).not.toHaveBeenCalled();
      expect(safeRefund).not.toHaveBeenCalled();
    });

    it('should create gallery_compare history without modifying the user essay', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-compare',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt',
        essayContent: 'Reference essay content',
        gpaRange: null,
        satRange: null,
        school: { id: 's1', name: 'MIT', usNewsRank: 1 },
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: null,
      });
      mockPrisma.essay.findFirst.mockResolvedValue({
        id: 'essay-1',
        title: 'My draft',
        prompt: 'Prompt',
        content: 'My essay draft content',
        wordCount: 4,
        schoolId: null,
      });
      mockLLMService.chatSimpleGuarded.mockResolvedValue(
        JSON.stringify({
          referenceSignals: ['Uses a concrete narrative arc'],
          gapAnalysis: ['Your draft needs a clearer turning point'],
          overlapWarnings: ['Low wording overlap; keep your own examples'],
          overlapRisk: 'high',
          overlapRiskReason: 'Several near-identical phrases detected',
          revisionActions: ['Add one specific scene', 'Clarify the reflection'],
          evidence: [
            {
              source: 'essay',
              quote: 'Reference essay content',
              paragraphIndex: 0,
              note: 'Reference signal',
            },
            {
              source: 'user_essay',
              quote: 'My essay draft content',
              note: 'User draft signal',
            },
          ],
        }),
      );
      mockPrisma.essayAIResult.create.mockResolvedValue({ id: 'ai-result-1' });
      mockPrisma.galleryEssayAIInteraction.create.mockResolvedValue({
        id: 'interaction-compare-1',
      });

      const result = await service.compareGalleryEssay(
        'user-1',
        'case-compare',
        { userEssayId: 'essay-1', focus: 'structure' },
        'en',
      );

      expect(mockIncentiveService.charge).toHaveBeenCalledWith(
        'user-1',
        'AI_ESSAY_COMPARE',
        expect.objectContaining({
          galleryEssayId: 'case-compare',
          userEssayId: 'essay-1',
          interactionType: 'compare',
          focus: 'structure',
        }),
      );
      expect(mockPrisma.essayAIResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            essayId: 'essay-1',
            type: 'gallery_compare',
          }),
        }),
      );
      expect(mockPrisma.essay.update).not.toHaveBeenCalled();
      expect(result.resultId).toBe('ai-result-1');
      expect(result.interactionId).toBe('interaction-compare-1');
      expect(result.revisionActions).toContain('Add one specific scene');
      expect(result.overlapRisk).toBe('high');
      expect(result.overlapRiskReason).toContain('near-identical');
      expect(mockPrisma.galleryEssayAIInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'interaction-compare-1' },
          data: expect.objectContaining({
            status: 'SUCCEEDED',
            essayAIResultId: 'ai-result-1',
          }),
        }),
      );
    });

    it('should default overlapRisk to low when the LLM omits or garbles it', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({
        id: 'case-compare',
        year: 2025,
        round: 'EA',
        result: 'ADMITTED',
        essayType: 'COMMON_APP',
        promptNumber: 1,
        essayPrompt: 'Prompt',
        essayContent: 'Reference essay content',
        gpaRange: null,
        satRange: null,
        school: { id: 's1', name: 'MIT', usNewsRank: 1 },
        tags: [],
        isVerified: true,
        visibility: 'PUBLIC',
        aiAnalysisCache: null,
      });
      mockPrisma.essay.findFirst.mockResolvedValue({
        id: 'essay-1',
        title: 'My draft',
        prompt: 'Prompt',
        content: 'My essay draft content',
        wordCount: 4,
        schoolId: null,
      });
      mockLLMService.chatSimpleGuarded.mockResolvedValue(
        JSON.stringify({
          referenceSignals: ['Uses a concrete narrative arc'],
          gapAnalysis: ['Needs a clearer turning point'],
          overlapWarnings: [],
          overlapRisk: 'catastrophic', // invalid band → must fall back to low
          revisionActions: ['Add one specific scene'],
          evidence: [
            {
              source: 'essay',
              quote: 'Reference essay content',
              paragraphIndex: 0,
              note: 'Reference signal',
            },
          ],
        }),
      );
      mockPrisma.essayAIResult.create.mockResolvedValue({ id: 'ai-result-2' });
      mockPrisma.galleryEssayAIInteraction.create.mockResolvedValue({
        id: 'interaction-compare-2',
      });

      const result = await service.compareGalleryEssay(
        'user-1',
        'case-compare',
        { userEssayId: 'essay-1' },
        'en',
      );

      expect(result.overlapRisk).toBe('low');
      expect(result.overlapRiskReason).toBeUndefined();
    });
  });

  describe('gallery AI interactions history and feedback', () => {
    it('should list current user interactions with stored outputs and feedback', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue({ id: 'case-1' });
      mockPrisma.galleryEssayAIInteraction.findMany.mockResolvedValue([
        {
          id: 'interaction-1',
          userId: 'user-1',
          admissionCaseId: 'case-1',
          type: 'question',
          status: 'SUCCEEDED',
          locale: 'en',
          question: 'Why does the opening work?',
          paragraphIndex: 0,
          selectedText: null,
          focus: null,
          userEssayId: null,
          essayAIResultId: null,
          output: {
            answer: 'Because it opens with a concrete scene.',
            followUps: ['How can I avoid copying?'],
          },
          evidence: [
            {
              source: 'essay',
              quote: 'A vivid opening.',
              paragraphIndex: 0,
            },
          ],
          tokensUsed: 123,
          pointsAction: 'AI_ESSAY_GALLERY_ASK',
          refundStatus: 'NOT_NEEDED',
          errorMessage: null,
          createdAt: new Date('2026-06-18T00:00:00.000Z'),
          updatedAt: new Date('2026-06-18T00:01:00.000Z'),
          feedback: {
            id: 'feedback-1',
            interactionId: 'interaction-1',
            userId: 'user-1',
            sentiment: 'HELPFUL',
            category: null,
            notes: null,
            createdAt: new Date('2026-06-18T00:02:00.000Z'),
            updatedAt: new Date('2026-06-18T00:02:00.000Z'),
          },
        },
      ]);
      mockPrisma.galleryEssayAIInteraction.count.mockResolvedValue(1);

      const result = await service.listGalleryEssayInteractions(
        'user-1',
        'case-1',
        { type: 'question', limit: 10 },
      );

      expect(result.total).toBe(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'interaction-1',
          essayId: 'case-1',
          type: 'question',
          status: 'SUCCEEDED',
          answer: 'Because it opens with a concrete scene.',
          tokensUsed: 123,
          feedback: expect.objectContaining({ sentiment: 'HELPFUL' }),
        }),
      );
      expect(result.items[0].evidence).toHaveLength(1);
    });

    it('should upsert helpful feedback for the owner of an interaction', async () => {
      mockPrisma.galleryEssayAIInteraction.findFirst.mockResolvedValue({
        id: 'interaction-1',
      });
      mockPrisma.galleryEssayAIInteractionFeedback.upsert.mockResolvedValue({
        id: 'feedback-1',
        interactionId: 'interaction-1',
        userId: 'user-1',
        sentiment: 'NOT_HELPFUL',
        category: 'too_generic',
        notes: 'Needs more specific evidence',
        createdAt: new Date('2026-06-18T00:00:00.000Z'),
        updatedAt: new Date('2026-06-18T00:00:00.000Z'),
      });

      const result = await service.submitGalleryInteractionFeedback(
        'user-1',
        'interaction-1',
        {
          sentiment: 'NOT_HELPFUL',
          category: 'too_generic',
          notes: 'Needs more specific evidence',
        },
      );

      expect(
        mockPrisma.galleryEssayAIInteractionFeedback.upsert,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { interactionId: 'interaction-1' },
          create: expect.objectContaining({
            userId: 'user-1',
            sentiment: 'NOT_HELPFUL',
            category: 'too_generic',
          }),
          update: expect.objectContaining({
            sentiment: 'NOT_HELPFUL',
            category: 'too_generic',
          }),
        }),
      );
      expect(result.sentiment).toBe('NOT_HELPFUL');
      expect(result.category).toBe('too_generic');
    });

    it('should aggregate admin metrics for usage, feedback, tokens, and learning-note coverage', async () => {
      mockPrisma.galleryEssayAIInteraction.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      mockPrisma.galleryEssayAIInteraction.aggregate.mockResolvedValue({
        _avg: { tokensUsed: 322 },
      });
      mockPrisma.galleryEssayAIInteractionFeedback.groupBy.mockResolvedValue([
        { sentiment: 'HELPFUL', _count: 3 },
        { sentiment: 'NOT_HELPFUL', _count: 1 },
      ]);
      mockPrisma.admissionCase.findMany.mockResolvedValue([
        {
          aiAnalysisCache: {
            en: {
              promptVersion: PARAGRAPH_PROMPT_VERSION,
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
                summary: 'Ready',
              },
            },
          },
        },
        {
          aiAnalysisCache: {
            zh: {
              promptVersion: 'old',
              generatedAt: '2026-05-01T00:00:00.000Z',
              payload: {},
            },
          },
        },
        { aiAnalysisCache: null },
      ]);

      const result = await service.getAdminGalleryAiMetrics();

      expect(result.totals).toEqual(
        expect.objectContaining({
          interactions: 10,
          questions: 6,
          compares: 4,
          succeeded: 8,
          failed: 2,
          refunded: 1,
          feedback: 4,
          helpful: 3,
          notHelpful: 1,
        }),
      );
      expect(result.rates.helpfulRate).toBe(0.75);
      expect(result.rates.failureRate).toBe(0.2);
      expect(result.tokens.average).toBe(322);
      expect(result.learningNotes).toEqual(
        expect.objectContaining({
          publicEssayCount: 3,
          readyCount: 1,
          missingCount: 2,
        }),
      );
    });

    it('should apply the admin metrics date window to interaction and feedback queries', async () => {
      mockPrisma.galleryEssayAIInteraction.count.mockResolvedValue(0);
      mockPrisma.galleryEssayAIInteraction.aggregate.mockResolvedValue({
        _avg: { tokensUsed: 0 },
      });
      mockPrisma.galleryEssayAIInteractionFeedback.groupBy.mockResolvedValue(
        [],
      );
      mockPrisma.admissionCase.findMany.mockResolvedValue([]);

      const result = await service.getAdminGalleryAiMetrics({
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30T23:59:59.000Z',
      });

      expect(result.period).toEqual({
        from: '2026-06-01T00:00:00.000Z',
        to: '2026-06-30T23:59:59.000Z',
      });
      expect(
        mockPrisma.galleryEssayAIInteraction.count,
      ).toHaveBeenNthCalledWith(1, {
        where: {
          createdAt: {
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T23:59:59.000Z'),
          },
        },
      });
      expect(
        mockPrisma.galleryEssayAIInteractionFeedback.groupBy,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: new Date('2026-06-01T00:00:00.000Z'),
              lte: new Date('2026-06-30T23:59:59.000Z'),
            },
          },
        }),
      );
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
            promptVersion: PARAGRAPH_PROMPT_VERSION,
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
            promptVersion: PARAGRAPH_PROMPT_VERSION,
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
