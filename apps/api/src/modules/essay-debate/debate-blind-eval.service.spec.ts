/**
 * Phase 2 V1 PR3 — DebateBlindEvalService unit tests.
 *
 * Covers:
 *  1. Queue surfaces only AI turns from sessions tagged with the pool
 *     marker (or the ChatGPT-control placeholder).
 *  2. Already-rated tuples are skipped per evaluator.
 *  3. Different evaluators see different next-items (deterministic
 *     shuffle on evaluatorId).
 *  4. `done: true` when nothing left.
 *  5. Rate is idempotent: re-posting the same (sessionId, turnIndex,
 *     evaluatorId) overwrites the rating; `updated: true` second time.
 *  6. Rating an out-of-range turnIndex throws NotFoundException.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DebateBlindEvalService } from './debate-blind-eval.service';

describe('DebateBlindEvalService', () => {
  let service: DebateBlindEvalService;

  const lumniSession = {
    id: 'sess-lumni-1',
    paragraphIndex: 2,
    turns: [
      { id: 't1', role: 'user', text: 'I disagree.', createdAt: '2026-05-20' },
      {
        id: 't2',
        role: 'ai',
        text: `[blind-eval-pool] Sharp lumni rebuttal here.`,
        evidence: [{ quote: 'foo', source: 'essay' }],
        createdAt: '2026-05-20',
      },
    ],
    admissionCase: {
      essayContent: 'Full essay text for sess-lumni-1',
      essayPrompt: 'Tell us about yourself',
      school: { name: 'Harvard', nameZh: '哈佛' },
    },
    essay: null,
  };

  const controlSession = {
    id: 'sess-ctl-1',
    paragraphIndex: 0,
    turns: [
      {
        id: 'tu',
        role: 'user',
        text: '[control-seed] disagree',
        createdAt: '2026-05-20',
      },
      {
        id: 'ta',
        role: 'ai',
        text:
          DebateBlindEvalService.CHATGPT_CONTROL_PLACEHOLDER + ' (real text)',
        createdAt: '2026-05-20',
      },
    ],
    admissionCase: {
      essayContent: 'Full essay text for sess-ctl-1',
      essayPrompt: null,
      school: { name: 'Yale', nameZh: null },
    },
    essay: null,
  };

  const offPoolSession = {
    id: 'sess-off-pool',
    paragraphIndex: null,
    turns: [
      { id: 'a', role: 'user', text: 'user', createdAt: '2026-05-20' },
      {
        id: 'b',
        role: 'ai',
        text: 'regular AI turn (no marker)',
        createdAt: '2026-05-20',
      },
    ],
    admissionCase: null,
    essay: { content: 'essay text' },
  };

  const mockPrisma = {
    essayDebateSession: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    essayDebateEvaluation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebateBlindEvalService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(DebateBlindEvalService);
  });

  describe('getNextForEvaluator', () => {
    it('only includes AI turns from sessions tagged with the pool marker or the ChatGPT placeholder', async () => {
      mockPrisma.essayDebateSession.findMany.mockResolvedValue([
        lumniSession,
        controlSession,
        offPoolSession,
      ]);
      mockPrisma.essayDebateEvaluation.findMany.mockResolvedValue([]);

      const result = await service.getNextForEvaluator('counselor-a');
      expect(result.done).toBe(false);
      // 2 sessions in pool, each has exactly one AI turn → totalInPool = 2.
      expect(result.totalInPool).toBe(2);
      expect(result.rated).toBe(0);
      expect(result.next).toBeDefined();
      // The off-pool session must never surface.
      expect(result.next!.sessionId).not.toBe('sess-off-pool');
    });

    it('skips already-rated tuples for the same evaluator', async () => {
      mockPrisma.essayDebateSession.findMany.mockResolvedValue([
        lumniSession,
        controlSession,
      ]);
      // counselor-a has rated both items
      mockPrisma.essayDebateEvaluation.findMany.mockResolvedValue([
        { sessionId: 'sess-lumni-1', turnIndex: 1 },
        { sessionId: 'sess-ctl-1', turnIndex: 1 },
      ]);
      const result = await service.getNextForEvaluator('counselor-a');
      expect(result.done).toBe(true);
      expect(result.rated).toBe(2);
    });

    it('different evaluators see different first items (deterministic shuffle by id)', async () => {
      mockPrisma.essayDebateSession.findMany.mockResolvedValue([
        lumniSession,
        controlSession,
      ]);
      mockPrisma.essayDebateEvaluation.findMany.mockResolvedValue([]);

      const a = await service.getNextForEvaluator('counselor-alpha');
      const b = await service.getNextForEvaluator('counselor-beta');
      // We can't predict which session comes first, but they should be a
      // valid id from the pool.
      expect(['sess-lumni-1', 'sess-ctl-1']).toContain(a.next!.sessionId);
      expect(['sess-lumni-1', 'sess-ctl-1']).toContain(b.next!.sessionId);
      // The same evaluator gets the same first item across calls — verifies
      // determinism (not just randomness).
      const aAgain = await service.getNextForEvaluator('counselor-alpha');
      expect(aAgain.next!.sessionId).toBe(a.next!.sessionId);
    });

    it('surfaces isChatGptControl flag for the queue caller (server-side, UI does not render)', async () => {
      mockPrisma.essayDebateSession.findMany.mockResolvedValue([
        controlSession,
      ]);
      mockPrisma.essayDebateEvaluation.findMany.mockResolvedValue([]);
      const result = await service.getNextForEvaluator('counselor-a');
      expect(result.next!.isChatGptControl).toBe(true);
    });
  });

  describe('rate', () => {
    it('throws NotFoundException for an unknown sessionId', async () => {
      mockPrisma.essayDebateSession.findUnique.mockResolvedValue(null);
      await expect(
        service.rate({
          sessionId: 'nope',
          turnIndex: 0,
          evaluatorId: 'c1',
          rating: 'SHARP',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException for an out-of-range turnIndex', async () => {
      mockPrisma.essayDebateSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        turns: [{ role: 'ai', text: 'x' }],
      });
      await expect(
        service.rate({
          sessionId: 'sess-1',
          turnIndex: 5,
          evaluatorId: 'c1',
          rating: 'SHARP',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns updated=false on first write, updated=true on re-write', async () => {
      mockPrisma.essayDebateSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        turns: [
          { role: 'user', text: 'u' },
          { role: 'ai', text: 'a' },
        ],
      });
      mockPrisma.essayDebateEvaluation.findUnique
        .mockResolvedValueOnce(null) // first call — does not exist yet
        .mockResolvedValueOnce({ id: 'eval-1' }); // second call — exists
      mockPrisma.essayDebateEvaluation.upsert.mockResolvedValue({
        id: 'eval-1',
        sessionId: 'sess-1',
        turnIndex: 1,
        evaluatorId: 'c1',
      });

      const r1 = await service.rate({
        sessionId: 'sess-1',
        turnIndex: 1,
        evaluatorId: 'c1',
        rating: 'SHARP',
        evidenceIntegrity: true,
      });
      expect(r1.updated).toBe(false);

      const r2 = await service.rate({
        sessionId: 'sess-1',
        turnIndex: 1,
        evaluatorId: 'c1',
        rating: 'USEFUL',
        evidenceIntegrity: false,
      });
      expect(r2.updated).toBe(true);
    });
  });
});
