import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BlindEvalQueueItemDto,
  BlindEvalQueueResponseDto,
  RateDebateTurnDto,
  RateDebateTurnResponseDto,
} from './dto';
import { DebateTurnDto } from './dto/debate-turn-response.dto';

/**
 * Phase 2 V1 PR3 — Day-6 blind-eval data layer.
 *
 * Two responsibilities:
 *
 *  1. **Queue** — given an `evaluatorId`, return the next AI turn this
 *     evaluator hasn't rated yet. Pool covers every session marked for
 *     blind-eval (lumni dogfood + ChatGPT control placeholders seeded by
 *     `scripts/seed-chatgpt-control-turns.ts`). Order is deterministic per
 *     evaluator (seeded shuffle on evaluatorId) so the same person sees a
 *     stable sequence across reloads.
 *
 *  2. **Rate** — upsert one EssayDebateEvaluation row keyed on
 *     (sessionId, turnIndex, evaluatorId). Re-submission overwrites — the
 *     admin UI's "Next" button replays the previous body on accidental
 *     double-click.
 *
 * Identity model: the evaluator is gated upstream (`@Roles(Role.ADMIN)` on
 * the controller). The `evaluatorId` is purely a label so we can group
 * results by counsellor; it's not a security boundary.
 */
@Injectable()
export class DebateBlindEvalService {
  private readonly logger = new Logger(DebateBlindEvalService.name);

  /**
   * The blind-eval pool. PR3 ships with a placeholder marker: any session
   * whose oldest turn's text starts with `BLIND_EVAL_POOL_MARKER` is
   * considered in the pool. Operations will seed both the 20 lumni
   * dogfood sessions and the 20 ChatGPT control sessions before Day 6;
   * see scripts/seed-chatgpt-control-turns.ts for the control side.
   *
   * The marker lives in a turn's metadata-less area (a fenced string) so
   * we don't need a schema column for "in eval pool" — additive table
   * design, no ALTER on EssayDebateSession.
   */
  static readonly BLIND_EVAL_POOL_TAG = '[blind-eval-pool]';
  static readonly CHATGPT_CONTROL_PLACEHOLDER =
    'PR3 PLACEHOLDER — OpenAI control turn to be filled by ops-team before Day 6 blind-eval. See CONTEXT_AUDIT.md.';

  constructor(private readonly prisma: PrismaService) {}

  // ── Queue ────────────────────────────────────────────────────────────────

  async getNextForEvaluator(
    evaluatorId: string,
  ): Promise<BlindEvalQueueResponseDto> {
    // 1. Load every session in the eval pool. We filter in memory because the
    //    pool is bounded at ~40 rows (20 lumni + 20 control) and the marker
    //    lives inside the JSON turns blob — Postgres can do this with `@>`
    //    but the pool is small enough that the simpler in-app filter is fine
    //    and survives schema evolution.
    // governance: admin-scope — the blind-eval queue and rating live only on admin-debate-eval.controller (@Roles(Role.ADMIN), enforced by the global RolesGuard APP_GUARD); the ~40-row pool is curated for evaluation, and an evaluator seeing every session is the point
    const allSessions = await this.prisma.essayDebateSession.findMany({
      include: {
        admissionCase: {
          select: {
            essayContent: true,
            essayPrompt: true,
            school: { select: { name: true, nameZh: true } },
          },
        },
        essay: { select: { content: true } },
      },
    });

    const pool: Array<{
      sessionId: string;
      turnIndex: number;
      isChatGptControl: boolean;
      aiTurn: DebateTurnDto;
      userTurn?: DebateTurnDto;
      essayText: string;
      paragraphIndex?: number;
      schoolName?: string;
    }> = [];

    for (const session of allSessions) {
      const turns = this.parseTurns(session.turns);
      if (turns.length === 0) continue;

      // Pool gating — any turn carrying the BLIND_EVAL_POOL_TAG marker, or
      // any session whose first AI turn is the ChatGPT placeholder. The
      // placeholder seed always lands in the pool by design.
      const firstAiTurn = turns.find((t) => t.role === 'ai');
      // PR4: detect control sessions via two signals (in priority order):
      //  1. Explicit `source === 'chatgpt-control'` marker on the AI
      //     turn. This is the canonical marker after
      //     scripts/generate-chatgpt-control-turns.ts replaces the
      //     placeholder with real OpenAI output — the placeholder text
      //     check below would no longer match.
      //  2. Legacy: the AI turn text still carries the PR3 placeholder
      //     prefix. This keeps pre-PR4 seeded rows discoverable in case
      //     the generator hasn't run yet (e.g. fresh dev DB).
      const isControl =
        (firstAiTurn as { source?: string } | undefined)?.source ===
          'chatgpt-control' ||
        (firstAiTurn?.text?.startsWith(
          DebateBlindEvalService.CHATGPT_CONTROL_PLACEHOLDER.slice(0, 30),
        ) ??
          false);
      const isInPool =
        isControl ||
        turns.some((t) =>
          t.text?.includes(DebateBlindEvalService.BLIND_EVAL_POOL_TAG),
        );
      if (!isInPool) continue;

      const essayText =
        session.admissionCase?.essayContent ?? session.essay?.content ?? '';
      const schoolName = session.admissionCase?.school?.name ?? undefined;

      for (let i = 0; i < turns.length; i++) {
        const t = turns[i];
        if (t.role !== 'ai') continue;
        const userTurn =
          i > 0 && turns[i - 1].role === 'user' ? turns[i - 1] : undefined;
        pool.push({
          sessionId: session.id,
          turnIndex: i,
          isChatGptControl: isControl,
          aiTurn: t,
          userTurn,
          essayText,
          paragraphIndex: session.paragraphIndex ?? undefined,
          schoolName,
        });
      }
    }

    // 2. Load already-rated tuples for this evaluator.
    // governance: admin-scope — the blind-eval queue and rating live only on admin-debate-eval.controller (@Roles(Role.ADMIN), enforced by the global RolesGuard APP_GUARD); the ~40-row pool is curated for evaluation, and an evaluator seeing every session is the point
    const rated = await this.prisma.essayDebateEvaluation.findMany({
      where: { evaluatorId },
      select: { sessionId: true, turnIndex: true },
    });
    const ratedKey = new Set(rated.map((r) => `${r.sessionId}#${r.turnIndex}`));

    // 3. Shuffle deterministically per evaluator so reloads are stable AND
    //    different counsellors see different orders.
    const shuffled = this.deterministicShuffle(pool, evaluatorId);
    const next = shuffled.find(
      (item) => !ratedKey.has(`${item.sessionId}#${item.turnIndex}`),
    );

    if (!next) {
      return {
        done: true,
        totalInPool: pool.length,
        rated: rated.length,
      };
    }

    const item: BlindEvalQueueItemDto = {
      sessionId: next.sessionId,
      turnIndex: next.turnIndex,
      isChatGptControl: next.isChatGptControl,
      aiTurn: next.aiTurn,
      userTurn: next.userTurn,
      essayText: next.essayText,
      paragraphIndex: next.paragraphIndex,
      schoolName: next.schoolName,
    };

    return {
      done: false,
      totalInPool: pool.length,
      rated: rated.length,
      next: item,
    };
  }

  // ── Rate ─────────────────────────────────────────────────────────────────

  async rate(dto: RateDebateTurnDto): Promise<RateDebateTurnResponseDto> {
    // Verify the session + turnIndex actually exist before writing — the
    // FK only guards sessionId; turnIndex bounds are app-layer.
    // governance: admin-scope — the blind-eval queue and rating live only on admin-debate-eval.controller (@Roles(Role.ADMIN), enforced by the global RolesGuard APP_GUARD); the ~40-row pool is curated for evaluation, and an evaluator seeing every session is the point
    const session = await this.prisma.essayDebateSession.findUnique({
      where: { id: dto.sessionId },
      select: { id: true, turns: true },
    });
    if (!session) {
      throw new NotFoundException('Debate session not found');
    }
    const turns = this.parseTurns(session.turns);
    if (dto.turnIndex < 0 || dto.turnIndex >= turns.length) {
      throw new NotFoundException(
        `turnIndex ${dto.turnIndex} out of range (session has ${turns.length} turns)`,
      );
    }

    // governance: admin-scope — the blind-eval queue and rating live only on admin-debate-eval.controller (@Roles(Role.ADMIN), enforced by the global RolesGuard APP_GUARD); the ~40-row pool is curated for evaluation, and an evaluator seeing every session is the point
    const existing = await this.prisma.essayDebateEvaluation.findUnique({
      where: {
        sessionId_turnIndex_evaluatorId: {
          sessionId: dto.sessionId,
          turnIndex: dto.turnIndex,
          evaluatorId: dto.evaluatorId,
        },
      },
      select: { id: true },
    });

    // governance: admin-scope — the blind-eval queue and rating live only on admin-debate-eval.controller (@Roles(Role.ADMIN), enforced by the global RolesGuard APP_GUARD); the ~40-row pool is curated for evaluation, and an evaluator seeing every session is the point
    const row = await this.prisma.essayDebateEvaluation.upsert({
      where: {
        sessionId_turnIndex_evaluatorId: {
          sessionId: dto.sessionId,
          turnIndex: dto.turnIndex,
          evaluatorId: dto.evaluatorId,
        },
      },
      create: {
        sessionId: dto.sessionId,
        turnIndex: dto.turnIndex,
        evaluatorId: dto.evaluatorId,
        rating: dto.rating,
        isChatGptControl: dto.isChatGptControl ?? false,
        evidenceIntegrity: dto.evidenceIntegrity ?? null,
        notes: dto.notes ?? null,
      },
      update: {
        rating: dto.rating,
        isChatGptControl: dto.isChatGptControl ?? false,
        evidenceIntegrity: dto.evidenceIntegrity ?? null,
        notes: dto.notes ?? null,
      },
    });

    return {
      id: row.id,
      sessionId: row.sessionId,
      turnIndex: row.turnIndex,
      evaluatorId: row.evaluatorId,
      updated: existing !== null,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private parseTurns(blob: Prisma.JsonValue): DebateTurnDto[] {
    if (!Array.isArray(blob)) return [];
    return blob as unknown as DebateTurnDto[];
  }

  /**
   * Deterministic Fisher-Yates using a 32-bit FNV-1a hash of evaluatorId
   * as the seed. Same evaluator → same order across reloads; different
   * evaluators → different orders (so counsellors don't coordinate by
   * mistake on the first item).
   */
  private deterministicShuffle<T>(items: T[], seedKey: string): T[] {
    const arr = [...items];
    let state = this.fnv1a(seedKey);
    for (let i = arr.length - 1; i > 0; i--) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const j = state % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private fnv1a(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h;
  }
}
