import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService, PointAction } from '../points/incentive.service';
import { DebateBudgetService } from './debate-budget.service';
import { EssayDebateService } from './essay-debate.service';

/**
 * Skeleton spec — covers the four critical behaviours for PR1:
 *  1. New session creates a row + appends one user+ai turn pair.
 *  2. Continue session appends without creating a new row.
 *  3. Per-user 30/day cap surfaces as 429.
 *  4. System-wide $40/day cap surfaces as 503.
 *
 * PR2 will add coverage for the 6 context classes + the real Claude call.
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
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EssayDebateService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PointsService, useValue: mockPoints },
        { provide: DebateBudgetService, useValue: mockBudget },
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
      remaining: 3999,
    });
  }

  it('creates a new session and writes one user + one ai turn', async () => {
    happyBudget();
    mockPrisma.essayDebateSession.create.mockResolvedValue({
      id: 'sess-1',
      userId: 'user-1',
      turns: [],
      totalTurns: 0,
      totalTokens: 0,
      status: 'ACTIVE',
      admissionCaseId: 'case-1',
      essayId: null,
      paragraphIndex: 0,
    });
    mockPrisma.essayDebateSession.update.mockImplementation(
      ({ data }: { data: { turns: unknown } }) => ({
        id: 'sess-1',
        totalTurns: 1,
        totalTokens: 100,
        turns: data.turns,
      }),
    );

    const result = await service.createOrContinueTurn('user-1', {
      admissionCaseId: 'case-1',
      paragraphIndex: 0,
      userText: 'I disagree with the AI — paragraph 2 is the strongest hook.',
    });

    expect(mockPrisma.essayDebateSession.create).toHaveBeenCalledTimes(1);
    expect(result.sessionId).toBe('sess-1');
    expect(result.userTurn.role).toBe('user');
    expect(result.aiTurn.role).toBe('ai');
    // Red-team guardrail: no `concedes` anywhere in the response.
    expect(result.aiTurn).not.toHaveProperty('concedes');
    expect(result.aiTurn.evidence).toEqual([]);
    expect(typeof result.aiTurn.openQuestion).toBe('string');
    expect(mockPoints.charge).toHaveBeenCalledWith(
      'user-1',
      PointAction.AI_ESSAY_DEBATE_TURN,
      expect.objectContaining({ sessionId: 'sess-1' }),
    );
  });

  it('continues an existing session and appends a turn pair', async () => {
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
        totalTokens: 200,
        turns: data.turns,
      }),
    );

    const result = await service.createOrContinueTurn('user-1', {
      sessionId: 'sess-2',
      admissionCaseId: 'case-1',
      userText: 'follow-up argument',
    });

    expect(mockPrisma.essayDebateSession.create).not.toHaveBeenCalled();
    expect(mockPrisma.essayDebateSession.update).toHaveBeenCalledTimes(1);
    const updateArgs = mockPrisma.essayDebateSession.update.mock.calls[0][0];
    // After append the persisted array must have 3 entries (prev + user + ai).
    expect((updateArgs.data.turns as unknown[]).length).toBe(3);
    expect(result.remainingTurnsToday).toBe(15);
  });

  it('throws 429 when per-user daily cap is exhausted', async () => {
    mockBudget.incrementUserTurn.mockResolvedValue({
      ok: false,
      reason: 'user_daily_cap',
      remaining: 0,
    });

    await expect(
      service.createOrContinueTurn('user-1', {
        admissionCaseId: 'case-1',
        userText: 'one more please',
      }),
    ).rejects.toMatchObject({
      getStatus: expect.any(Function),
    });

    try {
      await service.createOrContinueTurn('user-1', {
        admissionCaseId: 'case-1',
        userText: 'one more please',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    expect(mockBudget.incrementGlobalSpend).not.toHaveBeenCalled();
    expect(mockPrisma.essayDebateSession.create).not.toHaveBeenCalled();
  });

  it('throws 503 when system-wide daily spend cap is exhausted', async () => {
    mockBudget.incrementUserTurn.mockResolvedValue({ ok: true, remaining: 29 });
    mockBudget.incrementGlobalSpend.mockResolvedValue({
      ok: false,
      reason: 'system_daily_cap',
      remaining: 0,
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
    expect(mockPrisma.essayDebateSession.create).not.toHaveBeenCalled();
  });

  it('rejects a sessionId that belongs to another user', async () => {
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
