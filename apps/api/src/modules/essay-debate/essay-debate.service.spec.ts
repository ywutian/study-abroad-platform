import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService, PointAction } from '../points/incentive.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { DebateBudgetService } from './debate-budget.service';
import { DebateContextLoaderService } from './debate-context-loader.service';
import { EssayDebateService } from './essay-debate.service';

/**
 * PR2 spec — covers PR1 behaviours plus Claude integration:
 *
 *  1. Happy path: valid JSON → turn persists with evidence intact.
 *  2. Invalid JSON → 502, user-turn counter refunded.
 *  3. Fabricated evidence quote → stripped, response still returns.
 *  4. System cap overflow → 503 BEFORE LLM call; session not mutated.
 *  5. Per-user cap → 429 (PR1 still passes).
 *  6. LLMService receives temperature: 0.3 + the configured model.
 */
describe('EssayDebateService', () => {
  let service: EssayDebateService;

  const mockPrisma = {
    essayDebateSession: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockPoints = {
    charge: jest.fn().mockResolvedValue({ newBalance: 100 }),
  };

  const mockBudget = {
    incrementUserTurn: jest.fn(),
    incrementGlobalSpend: jest.fn(),
    decrementUserTurn: jest.fn().mockResolvedValue(undefined),
  };

  const mockLLM = {
    chatSimple: jest.fn(),
  };

  const ESSAY_TEXT =
    'I grew up in Beijing, where the smell of rain on hot pavement still pulls me back to summer afternoons.\n\nMy hands trembled when I first picked up the violin at age six. The teacher told me to relax my grip.\n\nYears later, I taught my younger sister the same lesson — relax, the bow will sing if you let it.';

  const mockContextLoader = {
    loadContext: jest.fn().mockResolvedValue({
      school: {
        name: 'Harvard University',
        nameZh: '哈佛大学',
        usNewsRank: 3,
        acceptanceRate: 3.4,
      },
      profile: {
        gpa: 3.95,
        gpaScale: 4.0,
        satRange: '1530-1570',
        actRange: null,
        targetMajor: null,
        topActivities: ['Violin — Concertmaster', 'Math Olympiad'],
        topAward: 'AIME · National',
      },
      essay: {
        fullText: ESSAY_TEXT,
        paragraphs: ESSAY_TEXT.split(/\n\n+/),
        wordCount: 55,
        targetedParagraphIndex: 1,
      },
      prompt: 'Tell us about a time you grew.',
      result: { result: 'ADMITTED', year: 2022, round: 'RD' },
      priorCommentary: {
        paragraphIndex: 1,
        score: 7,
        status: 'good',
        comment:
          'Sensory hook works but the transition to the violin scene feels abrupt.',
        highlights: ['sensory hook'],
        suggestions: ['smooth the transition'],
      },
      debateHistory: [],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayDebateService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PointsService, useValue: mockPoints },
        { provide: DebateBudgetService, useValue: mockBudget },
        { provide: DebateContextLoaderService, useValue: mockContextLoader },
        { provide: LLMService, useValue: mockLLM },
      ],
    }).compile();
    service = module.get(EssayDebateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function happyBudget(remaining = 29) {
    mockBudget.incrementUserTurn.mockResolvedValue({ ok: true, remaining });
    mockBudget.incrementGlobalSpend.mockResolvedValue({
      ok: true,
      remaining: 3950,
    });
  }

  function newSessionStub() {
    mockPrisma.essayDebateSession.create.mockResolvedValue({
      id: 'sess-1',
      userId: 'user-1',
      turns: [],
      totalTurns: 0,
      totalTokens: 0,
      status: 'ACTIVE',
      admissionCaseId: 'case-1',
      essayId: null,
      paragraphIndex: 1,
    });
    mockPrisma.essayDebateSession.update.mockImplementation(
      ({ data }: { data: { turns: unknown } }) => ({
        id: 'sess-1',
        totalTurns: 1,
        totalTokens: 200,
        turns: data.turns,
      }),
    );
  }

  it('writes the AI turn with verified evidence on a valid Claude response', async () => {
    happyBudget();
    newSessionStub();
    mockLLM.chatSimple.mockResolvedValue(
      JSON.stringify({
        rebuttal:
          "The transition you call abrupt actually mirrors the essay's structural rhythm — note how each paragraph begins with a physical detail.",
        evidence: [
          {
            quote:
              'My hands trembled when I first picked up the violin at age six.',
            source: 'essay',
            paragraphIndex: 1,
          },
          {
            quote: 'sensory hook',
            source: 'prior_commentary',
          },
        ],
        openQuestion:
          'Which other transition in the essay do you read as similarly abrupt, and why?',
      }),
    );

    const result = await service.createOrContinueTurn('user-1', {
      admissionCaseId: 'case-1',
      paragraphIndex: 1,
      userText:
        'I think the abrupt transition is the strongest part of the essay.',
    });

    expect(mockLLM.chatSimple).toHaveBeenCalledTimes(1);
    expect(result.aiTurn.role).toBe('ai');
    expect(result.aiTurn).not.toHaveProperty('concedes');
    expect(result.aiTurn.evidence?.length).toBe(2);
    expect(result.aiTurn.evidence?.[0].quote).toContain('violin');
    expect(typeof result.aiTurn.openQuestion).toBe('string');
    expect(mockPoints.charge).toHaveBeenCalledWith(
      'user-1',
      PointAction.AI_ESSAY_DEBATE_TURN,
      expect.objectContaining({ sessionId: 'sess-1', promptVersion: 'v1' }),
    );
  });

  it('passes temperature 0.3 and the configured ANTHROPIC_MODEL to LLMService', async () => {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-6';
    happyBudget();
    newSessionStub();
    mockLLM.chatSimple.mockResolvedValue(
      JSON.stringify({
        rebuttal: 'Holding the line.',
        evidence: [],
        openQuestion: 'What evidence supports your view?',
      }),
    );

    await service.createOrContinueTurn('user-1', {
      admissionCaseId: 'case-1',
      userText: 'I disagree.',
    });

    expect(mockLLM.chatSimple).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        temperature: 0.3,
        providerOptions: expect.objectContaining({
          model: 'claude-sonnet-4-6',
        }),
      }),
    );
  });

  it('strips a fabricated evidence quote rather than echoing it', async () => {
    happyBudget();
    newSessionStub();
    mockLLM.chatSimple.mockResolvedValue(
      JSON.stringify({
        rebuttal: 'See the haystack — only one of these quotes exists.',
        evidence: [
          {
            quote: 'Years later, I taught my younger sister the same lesson',
            source: 'essay',
          },
          {
            quote:
              'Then a dragon swooped from the clouds and devoured Beijing.',
            source: 'essay',
          },
        ],
        openQuestion:
          'Which fabricated detail do you think most undermines your argument?',
      }),
    );

    const result = await service.createOrContinueTurn('user-1', {
      admissionCaseId: 'case-1',
      paragraphIndex: 1,
      userText: 'Prove me wrong.',
    });

    expect(result.aiTurn.evidence?.length).toBe(1);
    expect(result.aiTurn.evidence?.[0].quote).toContain('younger sister');
  });

  it('returns 502 + refunds the user turn when Claude returns unparseable JSON', async () => {
    happyBudget();
    newSessionStub();
    mockLLM.chatSimple.mockResolvedValue('This is not JSON. Sorry.');

    await expect(
      service.createOrContinueTurn('user-1', {
        admissionCaseId: 'case-1',
        userText: 'foo',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);

    expect(mockBudget.decrementUserTurn).toHaveBeenCalledWith('user-1');
    expect(mockPrisma.essayDebateSession.update).not.toHaveBeenCalled();
  });

  it('returns 503 + skips the LLM when the system daily cap is exhausted', async () => {
    mockBudget.incrementUserTurn.mockResolvedValue({ ok: true, remaining: 29 });
    mockBudget.incrementGlobalSpend.mockResolvedValue({
      ok: false,
      reason: 'system_daily_cap',
      remaining: 0,
    });
    mockPrisma.essayDebateSession.create.mockResolvedValue({
      id: 'sess-1',
      userId: 'user-1',
      turns: [],
      totalTurns: 0,
      totalTokens: 0,
      status: 'ACTIVE',
      admissionCaseId: 'case-1',
      essayId: null,
      paragraphIndex: null,
    });

    try {
      await service.createOrContinueTurn('user-1', {
        admissionCaseId: 'case-1',
        userText: 'try me',
      });
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    expect(mockLLM.chatSimple).not.toHaveBeenCalled();
    expect(mockBudget.decrementUserTurn).toHaveBeenCalledWith('user-1');
  });

  it('returns 429 when per-user daily cap is exhausted and never touches budget/LLM', async () => {
    mockBudget.incrementUserTurn.mockResolvedValue({
      ok: false,
      reason: 'user_daily_cap',
      remaining: 0,
    });

    try {
      await service.createOrContinueTurn('user-1', {
        admissionCaseId: 'case-1',
        userText: 'too late',
      });
      fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    expect(mockBudget.incrementGlobalSpend).not.toHaveBeenCalled();
    expect(mockLLM.chatSimple).not.toHaveBeenCalled();
    expect(mockPrisma.essayDebateSession.create).not.toHaveBeenCalled();
  });

  it('continues an existing session, appending one turn pair', async () => {
    happyBudget(15);
    mockPrisma.essayDebateSession.findUnique.mockResolvedValue({
      id: 'sess-2',
      userId: 'user-1',
      turns: [
        {
          id: 't-prev',
          role: 'user',
          text: 'earlier',
          createdAt: new Date().toISOString(),
        },
      ],
      totalTurns: 0,
      totalTokens: 0,
      status: 'ACTIVE',
      admissionCaseId: 'case-1',
      essayId: null,
      paragraphIndex: null,
    });
    mockPrisma.essayDebateSession.update.mockImplementation(
      ({ data }: { data: { turns: unknown } }) => ({
        id: 'sess-2',
        totalTurns: 2,
        totalTokens: 400,
        turns: data.turns,
      }),
    );
    mockLLM.chatSimple.mockResolvedValue(
      JSON.stringify({
        rebuttal: 'Holding the line again.',
        evidence: [],
        openQuestion: 'What changed in your reasoning?',
      }),
    );

    const result = await service.createOrContinueTurn('user-1', {
      sessionId: 'sess-2',
      admissionCaseId: 'case-1',
      userText: 'follow-up argument',
    });

    expect(mockPrisma.essayDebateSession.create).not.toHaveBeenCalled();
    // Find the final update — the very last call mutates `turns`. (One
    // earlier call may have run to set paragraphIndex when the user
    // pivoted; this test doesn't pivot so we expect a single call.)
    const updateArgs = mockPrisma.essayDebateSession.update.mock.calls.at(
      -1,
    )?.[0] as {
      data: { turns: unknown };
    };
    expect((updateArgs.data.turns as unknown[]).length).toBe(3);
    expect(result.remainingTurnsToday).toBe(15);
  });

  it('rejects a sessionId that belongs to another user and refunds the turn', async () => {
    happyBudget();
    mockPrisma.essayDebateSession.findUnique.mockResolvedValue({
      id: 'sess-3',
      userId: 'someone-else',
      turns: [],
      totalTurns: 0,
      totalTokens: 0,
      status: 'ACTIVE',
      admissionCaseId: 'case-1',
      essayId: null,
      paragraphIndex: null,
    });

    await expect(
      service.createOrContinueTurn('user-1', {
        sessionId: 'sess-3',
        admissionCaseId: 'case-1',
        userText: 'sneaky',
      }),
    ).rejects.toThrow(/belongs to someone else/);
    expect(mockBudget.decrementUserTurn).toHaveBeenCalledWith('user-1');
  });

  it('returns the latest session for the owning user', async () => {
    mockPrisma.essayDebateSession.findUnique.mockResolvedValue({
      id: 'sess-4',
      userId: 'user-1',
      status: 'ACTIVE',
      totalTurns: 1,
      totalTokens: 100,
      admissionCaseId: 'case-1',
      essayId: null,
      paragraphIndex: 0,
      turns: [
        {
          id: 't1',
          role: 'user',
          text: 'hello',
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.getLatestSession('user-1', 'sess-4');
    expect(result.id).toBe('sess-4');
    expect(result.turns).toHaveLength(1);
  });

  it('throws NotFoundException for unknown sessions', async () => {
    mockPrisma.essayDebateSession.findUnique.mockResolvedValue(null);
    await expect(service.getLatestSession('user-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
