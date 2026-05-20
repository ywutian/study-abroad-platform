import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { EssayDebateSession, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PointsService, PointAction } from '../points/incentive.service';
import { LLMService } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import { DebateBudgetService } from './debate-budget.service';
import { DebateContextLoaderService } from './debate-context-loader.service';
import {
  buildDebateSystemPrompt,
  buildDebateUserPrompt,
  DEBATE_PROMPT_VERSION,
  type DebateContextPayload,
} from './essay-debate.prompts';
import { CreateDebateTurnDto } from './dto/create-debate-turn.dto';
import {
  DebateEvidenceDto,
  DebateSessionDto,
  DebateTurnDto,
  DebateTurnResponseDto,
} from './dto/debate-turn-response.dto';

/**
 * Phase 2 V1 PR2 — real Claude integration + 6 context classes.
 *
 * What this service does:
 *  1. Daily cap + per-user cap (Redis, PR1).
 *  2. Resolve / create session.
 *  3. Load 6 context classes via DebateContextLoaderService.
 *  4. Call LLMService.chatSimple with the project-conventional model
 *     (configured via env) at temperature 0.3 for a grounded rebuttal.
 *  5. Extract JSON, validate shape, then verify every `evidence.quote`
 *     is a verbatim substring of the essay / prior commentary / profile
 *     concatenation. Fabricated quotes are stripped (the "evidence
 *     integrity" metric the Day 7 decision gate measures).
 *  6. Persist user + AI turn, charge AI_ESSAY_DEBATE_TURN, return.
 *
 * If Claude fails (5xx, parse-error, schema-violation) we decrement the
 * user's daily-cap counter so they don't burn a turn on a backend error.
 *
 * Red-team rule baked in here: the AI turn shape has NO `concedes` field
 * — the prompt forbids it and we strip it defensively if it sneaks in.
 */
@Injectable()
export class EssayDebateService {
  private readonly logger = new Logger(EssayDebateService.name);

  /** Rough Sonnet-class pricing in cents: $3/M input, $15/M output. */
  private static readonly CENT_PER_INPUT_TOKEN = 0.0003; // 3¢ per 100 tokens
  private static readonly CENT_PER_OUTPUT_TOKEN = 0.0015; // 15¢ per 100 tokens
  /** Hard upper bound on the rebuttal length we keep, defensive. */
  private static readonly MAX_REBUTTAL_CHARS = 600;
  private static readonly MAX_OPEN_QUESTION_CHARS = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly points: PointsService,
    private readonly budget: DebateBudgetService,
    private readonly contextLoader: DebateContextLoaderService,
    private readonly llm: LLMService,
  ) {}

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

    // ── Per-user 30/day ──────────────────────────────────────────────────
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

    // ── Resolve or create the session BEFORE checking global spend, so a
    //    NotFound / Forbidden doesn't burn budget. We also refund the
    //    user-turn counter if any of these checks fail.
    let session: EssayDebateSession | null = dto.sessionId
      ? await this.prisma.essayDebateSession.findUnique({
          where: { id: dto.sessionId },
        })
      : null;

    try {
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
    } catch (err) {
      // Caller's fault — don't penalise them with a lost turn.
      await this.refundUserTurn(userId);
      throw err;
    }

    if (!session) {
      session = await this.prisma.essayDebateSession.create({
        data: {
          userId,
          admissionCaseId: dto.admissionCaseId ?? null,
          essayId: dto.essayId ?? null,
          paragraphIndex: dto.paragraphIndex ?? null,
          turns: [],
        },
      });
    } else if (
      dto.paragraphIndex != null &&
      dto.paragraphIndex !== session.paragraphIndex
    ) {
      // The user pivoted to a different paragraph mid-session. We update
      // the session's paragraphIndex so the loader scopes context to the
      // new target, but we keep the same session row — that's the whole
      // point of a "debate session per essay" model.
      session = await this.prisma.essayDebateSession.update({
        where: { id: session.id },
        data: { paragraphIndex: dto.paragraphIndex },
      });
    }

    // ── 6-class context ──────────────────────────────────────────────────
    let context: DebateContextPayload;
    try {
      context = await this.contextLoader.loadContext(session, 'zh');
    } catch (err) {
      this.logger.error(
        `Context load failed for session ${session.id}: ${(err as Error).message}`,
      );
      await this.refundUserTurn(userId);
      throw new BadGatewayException('Failed to assemble debate context');
    }

    // ── Build the prompt ────────────────────────────────────────────────
    const systemPrompt = buildDebateSystemPrompt('zh');
    const userPrompt = buildDebateUserPrompt(context, dto.userText, 'zh');

    // ── Reserve global spend BEFORE the LLM call. We estimate based on
    //    a worst-case 4,500 input + 600 output token bound; if the actual
    //    usage comes back lower the cap is slightly conservative which is
    //    the side we want to err on.
    const estCents = this.estimateCostCents(
      systemPrompt.length + userPrompt.length,
      800,
    );
    const globalBudget = await this.budget.incrementGlobalSpend(estCents);
    if (!globalBudget.ok) {
      await this.refundUserTurn(userId);
      throw new HttpException(
        {
          message:
            'System-wide essay-debate budget exhausted for today; please retry tomorrow.',
          reason: globalBudget.reason,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // ── Real LLM call ────────────────────────────────────────────────────
    let rawLlm: string;
    try {
      rawLlm = await this.llm.chatSimple(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.3,
          maxTokens: 800,
          userId,
          providerOptions: {
            model: process.env.ANTHROPIC_MODEL || undefined,
          },
        },
      );
    } catch (err) {
      this.logger.error(
        `Debate LLM call failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      await this.refundUserTurn(userId);
      throw new BadGatewayException(
        'AI is temporarily unavailable; please retry in a moment.',
      );
    }

    // ── Parse JSON output ────────────────────────────────────────────────
    let parsed: {
      rebuttal?: unknown;
      evidence?: unknown;
      openQuestion?: unknown;
      concedes?: unknown;
    };
    try {
      parsed = extractJsonFromLlm(rawLlm);
    } catch (err) {
      this.logger.warn(
        `extractJsonFromLlm failed; raw len=${rawLlm.length}; first 120 chars=${rawLlm.slice(0, 120)}`,
      );
      await this.refundUserTurn(userId);
      throw new BadGatewayException(
        'AI returned an unparseable response; please retry.',
      );
    }
    if (!parsed || typeof parsed !== 'object') {
      await this.refundUserTurn(userId);
      throw new BadGatewayException('AI returned an invalid response shape.');
    }

    // ── Schema-validate + evidence-integrity strip ───────────────────────
    const rebuttal = this.coerceString(
      parsed.rebuttal,
      EssayDebateService.MAX_REBUTTAL_CHARS,
    );
    if (!rebuttal) {
      await this.refundUserTurn(userId);
      throw new BadGatewayException(
        'AI returned an empty rebuttal; please retry.',
      );
    }
    const openQuestion = this.coerceString(
      parsed.openQuestion,
      EssayDebateService.MAX_OPEN_QUESTION_CHARS,
    );
    const evidenceArray = Array.isArray(parsed.evidence) ? parsed.evidence : [];
    const verifiedEvidence = this.verifyEvidence(evidenceArray, context);
    // Defensive: even if the model leaked `concedes`, never surface it.
    // (The DTO type already forbids it; this just makes the strip explicit.)

    // ── Persist user + ai turns ──────────────────────────────────────────
    const now = new Date().toISOString();
    const tokensUsed = Math.round(
      (systemPrompt.length + userPrompt.length + rawLlm.length) / 4,
    );
    const userTurn: DebateTurnDto = {
      id: randomUUID(),
      role: 'user',
      text: dto.userText,
      createdAt: now,
    };
    const aiTurn: DebateTurnDto = {
      id: randomUUID(),
      role: 'ai',
      text: rebuttal,
      evidence: verifiedEvidence,
      openQuestion: openQuestion || undefined,
      tokensUsed,
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
        totalTokens: { increment: tokensUsed },
      },
    });

    // Charge the user — at PR2 cost is still 0 (the config will be tuned in
    // PR3 after dogfood). If the cost is non-zero in the future and charge
    // fails, we log but don't revert the AI turn write — the user already
    // got the response.
    try {
      await this.points.charge(userId, PointAction.AI_ESSAY_DEBATE_TURN, {
        sessionId: updated.id,
        turnIndex: updated.totalTurns,
        promptVersion: DEBATE_PROMPT_VERSION,
      });
    } catch (err) {
      this.logger.warn(
        `Points charge failed for debate turn ${aiTurn.id}: ${(err as Error).message}`,
      );
    }

    return {
      sessionId: updated.id,
      userTurn,
      aiTurn,
      remainingTurnsToday: userBudget.remaining,
    };
  }

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

  // ── Helpers ────────────────────────────────────────────────────────────

  /**
   * Refund the per-user daily cap counter when the request fails on a
   * code path that the user didn't cause. We don't track Redis decrements
   * as a typed result — best-effort. The skeleton's `incrementUserTurn`
   * never throws, so this is safe to await without a try/catch.
   */
  private async refundUserTurn(userId: string): Promise<void> {
    try {
      await (
        this.budget as unknown as {
          decrementUserTurn?: (userId: string) => Promise<unknown>;
        }
      ).decrementUserTurn?.(userId);
    } catch {
      // ignore — the day counter naturally expires in 24h.
    }
  }

  /** Cost estimate using approximate token count from chars/4 heuristic. */
  private estimateCostCents(
    inputChars: number,
    expectedOutputTokens: number,
  ): number {
    const inputTokens = Math.ceil(inputChars / 4);
    const raw =
      inputTokens * EssayDebateService.CENT_PER_INPUT_TOKEN +
      expectedOutputTokens * EssayDebateService.CENT_PER_OUTPUT_TOKEN;
    // Round up so the cap stays conservative; minimum 1 cent.
    return Math.max(1, Math.ceil(raw));
  }

  /** Coerce a possibly-undefined value to a trimmed string ≤ maxLen. */
  private coerceString(value: unknown, maxLen: number): string {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
  }

  /**
   * Evidence-integrity strip — Day 7 decision gate metric.
   *
   * Build a single haystack from essay + prior commentary + profile +
   * school text. For each evidence entry the LLM returned, keep it only
   * if `quote` is a verbatim substring of the haystack. Whitespace is
   * normalised so the model is allowed to vary CR/LF — but characters
   * are matched 1:1.
   *
   * The structured `source` label is preserved if it's one of the four
   * known values; otherwise we normalise to `essay` (the safest default
   * because the haystack is dominated by essay text).
   */
  private verifyEvidence(
    rawEvidence: unknown[],
    ctx: DebateContextPayload,
  ): DebateEvidenceDto[] {
    const haystacks: Record<DebateEvidenceDto['source'], string> = {
      essay: this.normaliseForMatch(ctx.essay.fullText),
      prior_commentary: ctx.priorCommentary
        ? this.normaliseForMatch(
            [
              ctx.priorCommentary.comment,
              ...ctx.priorCommentary.highlights,
              ...ctx.priorCommentary.suggestions,
            ].join(' '),
          )
        : '',
      profile: ctx.profile
        ? this.normaliseForMatch(
            [
              ctx.profile.targetMajor ?? '',
              ...(ctx.profile.topActivities ?? []),
              ctx.profile.topAward ?? '',
            ].join(' '),
          )
        : '',
      school: ctx.school
        ? this.normaliseForMatch(
            [ctx.school.name, ctx.school.nameZh ?? ''].join(' '),
          )
        : '',
    };
    const unionHaystack = Object.values(haystacks).join(' ');

    const verified: DebateEvidenceDto[] = [];
    for (const entry of rawEvidence) {
      if (!entry || typeof entry !== 'object') continue;
      const obj = entry as Record<string, unknown>;
      const rawQuote = typeof obj.quote === 'string' ? obj.quote.trim() : '';
      if (rawQuote.length < 4) continue; // junk filter
      const normalisedQuote = this.normaliseForMatch(rawQuote);
      const rawSource = typeof obj.source === 'string' ? obj.source : '';
      const source = this.coerceSource(rawSource);
      // Prefer the per-source haystack but fall back to the union — the
      // model sometimes labels essay-text as `prior_commentary` and we
      // want the integrity check to be lenient about source labels but
      // strict about the quote actually appearing.
      const found =
        haystacks[source].includes(normalisedQuote) ||
        unionHaystack.includes(normalisedQuote);
      if (!found) {
        this.logger.warn(
          `Stripped fabricated evidence quote (len=${rawQuote.length}, source=${rawSource})`,
        );
        continue;
      }
      const paragraphIndex =
        typeof obj.paragraphIndex === 'number' ? obj.paragraphIndex : undefined;
      verified.push({
        quote: rawQuote.length > 240 ? `${rawQuote.slice(0, 240)}…` : rawQuote,
        source,
        ...(paragraphIndex !== undefined ? { paragraphIndex } : {}),
      });
    }
    return verified;
  }

  /** Collapse whitespace so the LLM's CR/LF noise doesn't break matching. */
  private normaliseForMatch(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /** Normalise a free-form `source` label to the canonical enum. */
  private coerceSource(raw: string): DebateEvidenceDto['source'] {
    const lower = raw.toLowerCase();
    if (lower === 'profile') return 'profile';
    if (lower === 'school') return 'school';
    if (lower.includes('prior') || lower.includes('commentary')) {
      return 'prior_commentary';
    }
    return 'essay';
  }
}
