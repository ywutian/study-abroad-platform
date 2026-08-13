import { Test, TestingModule } from '@nestjs/testing';
import { EssayToolsService } from './essay-tools.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService } from '../core/llm.service';
import { EssayAiService } from '../../essay/essay-ai.service';

describe('EssayToolsService', () => {
  let service: EssayToolsService;
  let prisma: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayToolsService,
        {
          provide: PrismaService,
          useValue: {
            profile: { findUnique: jest.fn().mockResolvedValue(null) },
            school: { findFirst: jest.fn().mockResolvedValue(null) },
            essay: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
            },
            essayPrompt: {
              findMany: jest.fn().mockResolvedValue([]),
              findFirst: jest.fn().mockResolvedValue(null),
            },
          },
        },
        {
          provide: LLMService,
          useValue: {
            chatSimple: jest.fn().mockResolvedValue('{"outline":[]}'),
            chatSimpleGuarded: jest.fn().mockResolvedValue('{"outline":[]}'),
          },
        },
        {
          provide: EssayAiService,
          useValue: {
            polish: jest.fn().mockResolvedValue({ result: 'polished' }),
            review: jest.fn().mockResolvedValue({ result: 'reviewed' }),
            brainstorm: jest.fn().mockResolvedValue({ ideas: [] }),
            polishEssayDirect: jest
              .fn()
              .mockResolvedValue({ result: 'polished' }),
            reviewEssayDirect: jest
              .fn()
              .mockResolvedValue({ result: 'reviewed' }),
            brainstormDirect: jest.fn().mockResolvedValue({ ideas: [] }),
          },
        },
      ],
    }).compile();

    service = module.get(EssayToolsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register tool handlers', () => {
    const handlers = service.getHandlers();
    expect(handlers.has('get_essays')).toBe(true);
    expect(handlers.has('review_essay')).toBe(true);
    expect(handlers.has('polish_essay')).toBe(true);
    expect(handlers.has('generate_outline')).toBe(true);
    expect(handlers.has('brainstorm_ideas')).toBe(true);
    expect(handlers.has('search_essay_prompts')).toBe(true);
  });

  it('should return no-essay message when profile has no essays', async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    const result = await service.getEssays('user-1', 'en');
    expect(result).toHaveProperty('message');
  });

  it('should return essays when profile has them', async () => {
    prisma.profile.findUnique.mockResolvedValue({
      essays: [
        {
          id: 'e1',
          title: 'Why MIT',
          prompt: 'Describe...',
          content: 'My passion for technology',
          updatedAt: new Date(),
        },
      ],
    });
    const result = await service.getEssays('user-1', 'en');
    expect(result).toHaveProperty('count', 1);
    expect(result).toHaveProperty('essays');
  });

  it('should require source-backed verified prompts in AI prompt search', async () => {
    prisma.essayPrompt.findMany.mockResolvedValue([]);

    await service.searchEssayPrompts(
      { schoolId: 'school-1', type: 'SUPPLEMENTAL', year: 2026 },
      'en',
    );

    expect(prisma.essayPrompt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          status: 'VERIFIED',
          schoolId: 'school-1',
          type: 'SUPPLEMENTAL',
          year: 2026,
          sources: { some: { sourceUrl: { not: null } } },
        }),
      }),
    );
  });

  it('should expose source summary without raw sources in AI prompt search results', async () => {
    prisma.essayPrompt.findMany.mockResolvedValue([
      {
        id: 'p1',
        school: { name: 'MIT', nameZh: '麻省理工' },
        type: 'SUPPLEMENTAL',
        year: 2026,
        prompt: 'Describe the world you come from.',
        promptZh: null,
        wordLimit: 250,
        isRequired: true,
        aiTips: 'Be specific.',
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

    const result = await service.searchEssayPrompts(
      { schoolId: 'school-1' },
      'en',
    );

    expect(result.count).toBe(1);
    expect(result.prompts?.[0]).not.toHaveProperty('sources');
    expect(result.prompts?.[0]?.sourceSummary).toEqual(
      expect.objectContaining({
        hasSourceEvidence: true,
        sourceUrls: ['https://mit.edu/apply/essays'],
        sourceTypes: ['OFFICIAL'],
        sourceQuality: 'official',
        minConfidence: 0.92,
      }),
    );
  });
});
