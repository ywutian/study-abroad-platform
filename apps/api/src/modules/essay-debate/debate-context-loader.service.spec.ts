import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DebateContextLoaderService } from './debate-context-loader.service';

/**
 * PR2 spec for the 6-context loader. Each test isolates one of the 6
 * classes documented in `CONTEXT_AUDIT.md` and verifies the loader maps
 * the Prisma row into the right slot in the prompt-payload shape.
 */
describe('DebateContextLoaderService', () => {
  let loader: DebateContextLoaderService;

  const mockPrisma = {
    admissionCase: { findUnique: jest.fn() },
    essay: { findUnique: jest.fn() },
    essayPrompt: { findUnique: jest.fn() },
    school: { findUnique: jest.fn() },
    profile: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebateContextLoaderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    loader = module.get(DebateContextLoaderService);
  });

  afterEach(() => jest.clearAllMocks());

  const baseGalleryRow = {
    year: 2022,
    round: 'RD',
    result: 'ADMITTED',
    essayPrompt: 'Tell us about something you love.',
    essayContent:
      'I love rain.\n\nAt six I learned the violin.\n\nNow I teach my sister.',
    aiAnalysisCache: {
      zh: {
        promptVersion: 'v1',
        generatedAt: '2026-05-19T00:00:00.000Z',
        payload: {
          paragraphs: [
            {
              paragraphIndex: 0,
              score: 6,
              status: 'good',
              comment: 'Opening could use more sensory detail.',
              highlights: [],
              suggestions: ['add a smell or sound'],
            },
            {
              paragraphIndex: 1,
              score: 8,
              status: 'excellent',
              comment: 'Strong physical detail; transition is abrupt.',
              highlights: ['violin grounding'],
              suggestions: [],
            },
          ],
        },
      },
    },
    school: {
      name: 'Harvard University',
      nameZh: '哈佛大学',
      usNewsRank: 3,
      acceptanceRate: 3.4, // Decimal-as-number in the mock
    },
  };

  it('assembles all 6 classes for a gallery session', async () => {
    mockPrisma.admissionCase.findUnique
      .mockResolvedValueOnce(baseGalleryRow) // first call: essay+result+school+cache
      .mockResolvedValueOnce({
        gpaRange: '3.9-4.0',
        gpa11: 3.95,
        gpa12: null,
        gpaScale: 4.0,
        satRange: '1530-1570',
        actRange: null,
        activities: [
          { category: 'Music', description: 'Concertmaster, school orchestra' },
        ],
        awards: [{ name: 'AIME', level: 'National' }],
        activityList: null,
      });

    const session = {
      id: 'sess-1',
      userId: 'user-1',
      admissionCaseId: 'case-1',
      essayId: null,
      paragraphIndex: 1,
      turns: [],
      status: 'ACTIVE',
      totalTurns: 0,
      totalTokens: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    const ctx = await loader.loadContext(session, 'zh');

    // Class 1: school
    expect(ctx.school?.name).toBe('Harvard University');
    expect(ctx.school?.acceptanceRate).toBe(3.4);
    // Class 2: profile
    expect(ctx.profile?.gpa).toBe(3.95);
    expect(ctx.profile?.topActivities?.length).toBeGreaterThan(0);
    expect(ctx.profile?.topAward).toContain('AIME');
    // Class 3: essay
    expect(ctx.essay.paragraphs.length).toBe(3);
    expect(ctx.essay.targetedParagraphIndex).toBe(1);
    expect(ctx.essay.wordCount).toBeGreaterThan(0);
    // Class 4: prompt
    expect(ctx.prompt).toContain('Tell us about');
    // Class 5: result
    expect(ctx.result?.result).toBe('ADMITTED');
    expect(ctx.result?.year).toBe(2022);
    // Class 6: prior commentary, picking the targeted paragraph
    expect(ctx.priorCommentary?.paragraphIndex).toBe(1);
    expect(ctx.priorCommentary?.comment).toContain('Strong physical detail');
  });

  it('returns an empty context gracefully when the gallery row is missing', async () => {
    mockPrisma.admissionCase.findUnique.mockResolvedValue(null);
    const session = {
      id: 'sess-2',
      userId: 'user-1',
      admissionCaseId: 'missing-case',
      essayId: null,
      paragraphIndex: null,
      turns: [],
      status: 'ACTIVE',
      totalTurns: 0,
      totalTokens: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    const ctx = await loader.loadContext(session, 'zh');
    expect(ctx.school).toBeNull();
    expect(ctx.profile).toBeNull();
    expect(ctx.essay.paragraphs).toEqual([]);
    expect(ctx.prompt).toBeNull();
    expect(ctx.result).toBeNull();
    expect(ctx.priorCommentary).toBeNull();
  });

  it('loads a user-owned essay via the Essay path and ignores Class 5', async () => {
    mockPrisma.essay.findUnique.mockResolvedValue({
      content: 'My draft. \n\nSecond paragraph.',
      prompt: 'Common App #1',
      essayPromptId: null,
      schoolId: null,
    });
    mockPrisma.profile.findUnique.mockResolvedValue({
      gpa: 3.8,
      gpaScale: 4.0,
      targetMajor: 'Computer Science',
      activities: [
        { name: 'Robotics Club', role: 'President', hoursPerWeek: 5 },
      ],
      awards: [],
    });

    const session = {
      id: 'sess-3',
      userId: 'user-1',
      admissionCaseId: null,
      essayId: 'essay-1',
      paragraphIndex: null,
      turns: [
        { id: 't1', role: 'user', text: 'prior', createdAt: '2026-05-19' },
      ],
      status: 'ACTIVE',
      totalTurns: 1,
      totalTokens: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    const ctx = await loader.loadContext(session, 'zh');
    expect(ctx.essay.paragraphs.length).toBe(2);
    expect(ctx.prompt).toBe('Common App #1');
    expect(ctx.result).toBeNull();
    expect(ctx.profile?.gpa).toBe(3.8);
    expect(ctx.profile?.topActivities?.[0]).toContain('Robotics Club');
    expect(ctx.debateHistory.length).toBe(1);
  });

  it('caps debate history to the last 6 entries', async () => {
    mockPrisma.essay.findUnique.mockResolvedValue({
      content: 'Body.',
      prompt: null,
      essayPromptId: null,
      schoolId: null,
    });
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    const many = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      role: i % 2 === 0 ? 'user' : 'ai',
      text: `turn ${i}`,
      createdAt: '2026-05-19',
    }));
    const session = {
      id: 'sess-4',
      userId: 'user-1',
      admissionCaseId: null,
      essayId: 'essay-2',
      paragraphIndex: null,
      turns: many,
      status: 'ACTIVE',
      totalTurns: 10,
      totalTokens: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never;

    const ctx = await loader.loadContext(session, 'zh');
    expect(ctx.debateHistory.length).toBe(6);
    // Must be the LAST 6 turns, not the first.
    expect(ctx.debateHistory[0].text).toBe('turn 4');
    expect(ctx.debateHistory[5].text).toBe('turn 9');
  });
});
