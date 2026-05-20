import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService, PointAction } from '../points/incentive.service';
import { DebateBudgetService } from './debate-budget.service';
import { CreateDebateTurnDto } from './dto/create-debate-turn.dto';
import {
  DebateEvidenceDto,
  DebateSessionDto,
  DebateTurnDto,
  DebateTurnResponseDto,
} from './dto/debate-turn-response.dto';

/**
 * Phase 2 V1 PR1 — skeleton.
 *
 * What this service does today:
 *  - Validates the inbound DTO (exactly one of admissionCaseId/essayId).
 *  - Enforces the Redis-backed daily caps (per-user 30 turns, $40/day system).
 *  - Creates or continues an `EssayDebateSession`, appending two turns
 *    (user + mock AI response) to the JSON `turns` column.
 *  - Charges `AI_ESSAY_DEBATE_TURN` via PointsService (cost 0 in PR1).
 *
 * What it does NOT do yet (deferred to PR2):
 *  - Actually call Claude. The AI turn's text is a hardcoded TODO marker.
 *  - Inject any of the 6 context classes — see CONTEXT_AUDIT.md.
 *  - Compute token cost from real usage; the budget bumps a fixed 1 cent.
 *
 * Red-team rule enforced here: the mock response shape has rebuttal +
 * evidence[] + openQuestion — NO `concedes` field.
 */
@Injectable()
export class EssayDebateService {
  private readonly logger = new Logger(EssayDebateService.name);

  // 1 cent per turn placeholder — PR2 will derive this from real token cost.
  private static readonly EST_CENTS_PER_TURN = 1;
  // Mock token count — PR2 will pull this from the LLM provider response.
  private static readonly MOCK_TOKENS_PER_TURN = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
    private readonly budget: DebateBudgetService,
  ) {}

  /**
   * Create a new debate session or append the next pair of turns to an
   * existing one. Returns the just-written user + AI turns.
   */
  async createOrContinueTurn(
    userId: string,
    dto: CreateDebateTurnDto,
  ): Promise<DebateTurnResponseDto> {
    if (!dto.admissionCaseId && !dto.essayId && !dto.sessionId) {
      throw new BadRequestException(
        'Provide admissionCaseId or essayId (or sessionId of an existing session).',
      );
    }
    if (dto.admissionCaseId && dto.essayId) {
      throw new BadRequestException(
        'Pass exactly one of admissionCaseId / essayId, not both.',
      );
    }

    // Per-user 30/day cap — check FIRST so we don't burn budget then 429.
    const userBudget = await this.budget.incrementUserTurn(userId);
    if (!userBudget.ok) {
      throw new HttpException(
        {
          message: 'Daily essay-debate turn limit reached (30/day).',
          reason: userBudget.reason,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // System-wide $40/day cap — fail-closed with 503 so the client can show
    // a "AI 评审今天太忙，请明天再试" message rather than a generic error.
    const globalBudget = await this.budget.incrementGlobalSpend(
      EssayDebateService.EST_CENTS_PER_TURN,
    );
    if (!globalBudget.ok) {
      throw new HttpException(
        {
          message:
            'System-wide essay-debate budget exhausted for today; please retry tomorrow.',
          reason: globalBudget.reason,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Resolve or create the session.
    let session = dto.sessionId
      ? await this.prisma.essayDebateSession.findUnique({
          where: { id: dto.sessionId },
        })
      : null;

    if (dto.sessionId && !session) {
      throw new NotFoundException('Debate session not found');
    }
    if (session && session.userId !== userId) {
      throw new ForbiddenException(
        'This debate session belongs to someone else',
      );
    }
    if (session && session.status === 'CLOSED') {
      throw new BadRequestException('This debate session is closed');
    }

    if (!session) {
      session = await this.prisma.essayDebateSession.create({
        data: {
          userId,
          admissionCaseId: dto.admissionCaseId ?? null,
          essayId: dto.essayId ?? null,
          paragraphIndex: dto.paragraphIndex ?? null,
          turns: [] as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const now = new Date().toISOString();
    const userTurn: DebateTurnDto = {
      id: randomUUID(),
      role: 'user',
      text: dto.userText,
      createdAt: now,
    };
    const aiTurn: DebateTurnDto = {
      id: randomUUID(),
      role: 'ai',
      // Red-team verdict: rebuttal + evidence[] + openQuestion, never `concedes`.
      text: 'TODO PR2: integrate Claude with 6 context classes (see CONTEXT_AUDIT.md).',
      evidence: [] as DebateEvidenceDto[],
      openQuestion:
        'PR2 will replace this with a real follow-up question from Claude.',
      tokensUsed: EssayDebateService.MOCK_TOKENS_PER_TURN,
      createdAt: now,
    };

    const existingTurns = Array.isArray(session.turns)
      ? (session.turns as unknown as DebateTurnDto[])
      : [];
    const nextTurns = [...existingTurns, userTurn, aiTurn];

    const updated = await this.prisma.essayDebateSession.update({
      where: { id: session.id },
      data: {
        turns: nextTurns as unknown as Prisma.InputJsonValue,
        totalTurns: { increment: 1 },
        totalTokens: { increment: EssayDebateService.MOCK_TOKENS_PER_TURN },
      },
    });

    // Charge the user. Cost is 0 in PR1; PR2 will tune the setting.
    try {
      await this.points.charge(userId, PointAction.AI_ESSAY_DEBATE_TURN, {
        sessionId: updated.id,
        turnIndex: updated.totalTurns,
      });
    } catch (err) {
      // At cost=0 this is unreachable. We log but don't roll back the turn —
      // PR2 will introduce a refund helper once cost is non-zero.
      this.logger.warn(
        `Skeleton charge raised (expected to be zero-cost): ${(err as Error).message}`,
      );
    }

    return {
      sessionId: updated.id,
      userTurn,
      aiTurn,
      remainingTurnsToday: userBudget.remaining,
    };
  }

  /**
   * Read-only view of a session. Used by the dialog to hydrate on open.
   */
  async getLatestSession(
    userId: string,
    sessionId: string,
  ): Promise<DebateSessionDto> {
    const session = await this.prisma.essayDebateSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Debate session not found');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException(
        'This debate session belongs to someone else',
      );
    }
    return {
      id: session.id,
      status: session.status,
      totalTurns: session.totalTurns,
      totalTokens: session.totalTokens,
      admissionCaseId: session.admissionCaseId ?? undefined,
      essayId: session.essayId ?? undefined,
      paragraphIndex: session.paragraphIndex ?? undefined,
      turns: Array.isArray(session.turns)
        ? (session.turns as unknown as DebateTurnDto[])
        : [],
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }
}
