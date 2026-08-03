import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { PointAction, PointsService } from '../points/incentive.service';
import { DebateBudgetService } from './debate-budget.service';
import { DebateContextLoaderService } from './debate-context-loader.service';
import { buildDebateUserPrompt } from './essay-debate.prompts';
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
    // A new session's target ids are validated before it is created — see
    // assertDebatableTargets. Default to "found" so the existing turn tests
    // exercise the happy path; the guard's own tests override these.
    admissionCase: { findFirst: jest.fn().mockResolvedValue({ id: 'case-1' }) },
    essay: { findFirst: jest.fn().mockResolvedValue({ id: 'essay-1' }) },
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
      expect.objectContaining({ sessionId: 'sess-1', promptVersion: 'v2' }),
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

  // ─── PR6 regression tests ────────────────────────────────────────────────

  describe('PR6 — sycophancy 2.0 + evidence normalize', () => {
    it('passes through but WARN-logs when rebuttal opens with a banned concession phrase ("你说得对")', async () => {
      happyBudget();
      newSessionStub();
      mockLLM.chatSimple.mockResolvedValue(
        JSON.stringify({
          rebuttal:
            '你说得对，我之前忽略了这一点。但其实段落 1 已经埋了线索 — "My hands trembled when I first picked up the violin at age six" 这句已经预告了后面的张力。',
          evidence: [
            {
              quote:
                'My hands trembled when I first picked up the violin at age six.',
              source: 'essay',
            },
          ],
          openQuestion:
            'If the tension is already foreshadowed, why do you still read the transition as abrupt?',
        }),
      );

      const warnSpy = jest
        .spyOn(
          (service as unknown as { logger: { warn: jest.Mock } }).logger,
          'warn',
        )
        .mockImplementation();

      const result = await service.createOrContinueTurn('user-1', {
        admissionCaseId: 'case-1',
        paragraphIndex: 1,
        userText: '段落 1 到段落 2 的过渡太突兀。',
      });

      // The turn is still persisted — we never censor at the schema layer.
      expect(result.aiTurn.role).toBe('ai');
      expect(result.aiTurn.text.startsWith('你说得对')).toBe(true);
      // But we logged the violation for PR7 to measure adherence.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[sycophancy-2.0]'),
      );
      warnSpy.mockRestore();
    });

    it('builds the user prompt with the prior-commentary structural requirement when priorCommentary is non-null', () => {
      // Direct prompt-builder unit check — guards against the structural
      // block silently disappearing.
      const zhPrompt = buildDebateUserPrompt(
        {
          school: null,
          profile: null,
          essay: {
            fullText: ESSAY_TEXT,
            paragraphs: ESSAY_TEXT.split(/\n\n+/),
            wordCount: 55,
            targetedParagraphIndex: 1,
          },
          prompt: null,
          result: null,
          priorCommentary: {
            paragraphIndex: 1,
            score: 7,
            status: 'good',
            comment: 'Sensory hook works but the transition feels abrupt.',
            highlights: ['sensory hook'],
            suggestions: ['smooth the transition'],
          },
          debateHistory: [],
        },
        '段落 1 写得很有力。',
        'zh',
      );
      expect(zhPrompt).toContain('[必读 — 反驳结构要求]');
      expect(zhPrompt).toContain('不可商量');
      expect(zhPrompt).toContain('quote a SPECIFIC phrase');

      // English variant
      const enPrompt = buildDebateUserPrompt(
        {
          school: null,
          profile: null,
          essay: {
            fullText: ESSAY_TEXT,
            paragraphs: ESSAY_TEXT.split(/\n\n+/),
            wordCount: 55,
            targetedParagraphIndex: 1,
          },
          prompt: null,
          result: null,
          priorCommentary: {
            paragraphIndex: 1,
            score: 7,
            status: 'good',
            comment: 'Sensory hook works but the transition feels abrupt.',
            highlights: ['sensory hook'],
            suggestions: ['smooth the transition'],
          },
          debateHistory: [],
        },
        'Paragraph 1 reads strongly.',
        'en',
      );
      expect(enPrompt).toContain(
        '[REQUIRED — rebuttal structural requirement]',
      );
      expect(enPrompt).toContain('non-negotiable');
    });

    it('omits the structural requirement when priorCommentary is null', () => {
      const prompt = buildDebateUserPrompt(
        {
          school: null,
          profile: null,
          essay: {
            fullText: ESSAY_TEXT,
            paragraphs: ESSAY_TEXT.split(/\n\n+/),
            wordCount: 55,
            targetedParagraphIndex: null,
          },
          prompt: null,
          result: null,
          priorCommentary: null,
          debateHistory: [],
        },
        '段落 1 写得很有力。',
        'zh',
      );
      expect(prompt).not.toContain('[必读 — 反驳结构要求]');
      expect(prompt).not.toContain('quote a SPECIFIC phrase');
    });

    it('accepts case-different verbatim quotes ("it is a profession" vs essay "It is a profession")', async () => {
      // Yale Q25 / Duke Q13 regression — case drift in the model's quote
      // string slipped through PR2's case-sensitive substring check.
      happyBudget();
      const essayWithCapital =
        'It is a profession. The last three doctors in our village retired the same winter.';
      mockContextLoader.loadContext.mockResolvedValueOnce({
        school: {
          name: 'Yale University',
          nameZh: '耶鲁大学',
          usNewsRank: 5,
          acceptanceRate: 4.4,
        },
        profile: null,
        essay: {
          fullText: essayWithCapital,
          paragraphs: essayWithCapital.split(/\n\n+/),
          wordCount: 18,
          targetedParagraphIndex: 0,
        },
        prompt: null,
        result: null,
        priorCommentary: null,
        debateHistory: [],
      });
      newSessionStub();
      mockLLM.chatSimple.mockResolvedValue(
        JSON.stringify({
          rebuttal:
            'The opening framing in "it is a profession" carries the entire moral stake — note also "the last three doctors" which grounds it specifically.',
          evidence: [
            { quote: 'it is a profession', source: 'essay' },
            { quote: 'the last three doctors', source: 'essay' },
          ],
          openQuestion:
            'If the moral stake is in the framing, what part of the paragraph do you read as filler?',
        }),
      );

      const result = await service.createOrContinueTurn('user-1', {
        admissionCaseId: 'case-1',
        paragraphIndex: 0,
        userText:
          'The opening line is generic — anyone could say "it is a profession".',
      });

      expect(result.aiTurn.evidence?.length).toBe(2);
      expect(result.aiTurn.evidence?.[0].quote).toBe('it is a profession');
      expect(result.aiTurn.evidence?.[1].quote).toBe('the last three doctors');
    });

    it('rejects a Harvard Q33-style semantic-substitution fabrication ("life" → "it")', async () => {
      // Harvard Q33 regression — Chen the verbatim-grep counsellor caught
      // a real fabrication where the model paraphrased the essay's "it can
      // disappear..." into "life can disappear..." (subject swapped). The
      // PR2 substring check should have caught this but didn't — re-test
      // and confirm PR6's normalisation + fuzzy fallback catches it.
      happyBudget();
      const essayWithIt =
        'My grandfather taught me that it can disappear or change at any time. We never assume tomorrow.';
      mockContextLoader.loadContext.mockResolvedValueOnce({
        school: {
          name: 'Harvard University',
          nameZh: '哈佛大学',
          usNewsRank: 3,
          acceptanceRate: 3.4,
        },
        profile: null,
        essay: {
          fullText: essayWithIt,
          paragraphs: essayWithIt.split(/\n\n+/),
          wordCount: 18,
          targetedParagraphIndex: 0,
        },
        prompt: null,
        result: null,
        priorCommentary: null,
        debateHistory: [],
      });
      newSessionStub();
      mockLLM.chatSimple.mockResolvedValue(
        JSON.stringify({
          rebuttal:
            'The paragraph turns on impermanence — the line "life can disappear or change at any time" is the thematic spine.',
          evidence: [
            {
              quote: 'life can disappear or change at any time',
              source: 'essay',
            },
          ],
          openQuestion:
            'If the spine is impermanence, where does the resolution come from?',
        }),
      );

      const result = await service.createOrContinueTurn('user-1', {
        admissionCaseId: 'case-1',
        paragraphIndex: 0,
        userText: 'The paragraph has no thematic spine.',
      });

      // The fabricated quote ("life can disappear...") doesn't exist in
      // the essay (which has "it can disappear..."). After PR6's
      // normalisation + fuzzy fallback, it must be stripped.
      expect(result.aiTurn.evidence?.length).toBe(0);
    });
  });
  describe('debate target authorisation', () => {
    // The two ids below come off the request body and decide which essay the
    // debate is about — the context loader reads whatever they point at and
    // feeds its text to the model. Neither was checked before creating a
    // session, so `admissionCaseId` reached PRIVATE cases and `essayId`
    // reached other users' drafts.

    beforeEach(() => {
      happyBudget();
      newSessionStub();
      // jest.clearAllMocks() keeps implementations, so a `null` set by one
      // test would leak into the next — reset both to "found" per test.
      mockPrisma.admissionCase.findFirst.mockResolvedValue({ id: 'case-1' });
      mockPrisma.essay.findFirst.mockResolvedValue({ id: 'essay-1' });
    });

    it('refuses an admission case the gallery does not publish', async () => {
      // findFirst applies CASE_PUBLIC_WHERE, so a private case matches nothing
      mockPrisma.admissionCase.findFirst.mockResolvedValue(null);

      await expect(
        service.createOrContinueTurn('user-1', {
          admissionCaseId: 'private-case',
          userText: 'let me read this',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.essayDebateSession.create).not.toHaveBeenCalled();
      expect(mockLLM.chatSimple).not.toHaveBeenCalled();
    });

    it('refuses an essay draft belonging to someone else', async () => {
      mockPrisma.essay.findFirst.mockResolvedValue(null);

      await expect(
        service.createOrContinueTurn('user-1', {
          essayId: 'someone-elses-draft',
          userText: 'let me read this',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.essayDebateSession.create).not.toHaveBeenCalled();
    });

    it('scopes the essay lookup through the profile owner, not the id alone', async () => {
      await service.createOrContinueTurn('user-1', {
        essayId: 'essay-1',
        userText: 'my own draft',
      });

      expect(mockPrisma.essay.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'essay-1', profile: { userId: 'user-1' } },
        }),
      );
    });

    it('refunds the turn when a target is rejected', async () => {
      mockPrisma.admissionCase.findFirst.mockResolvedValue(null);

      await expect(
        service.createOrContinueTurn('user-1', {
          admissionCaseId: 'private-case',
          userText: 'x',
        }),
      ).rejects.toThrow(NotFoundException);

      // same treatment as the other caller-fault paths — a bad id must not
      // cost one of the 30 daily turns
      expect(mockBudget.decrementUserTurn).toHaveBeenCalledWith('user-1');
    });
  });
});
