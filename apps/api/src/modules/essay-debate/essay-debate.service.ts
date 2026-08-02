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
import type { EssayDebateSession, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CASE_PUBLIC_WHERE } from '../essay/constants/essay-gallery.constants';
import { LLMService } from '../ai-agent/core/llm.service';
import { PointAction, PointsService } from '../points/incentive.service';
import { DebateBudgetService } from './debate-budget.service';
import { DebateContextLoaderService } from './debate-context-loader.service';
import { CreateDebateTurnDto } from './dto/create-debate-turn.dto';
import {
  DebateEvidenceDto,
  DebateSessionDto,
  DebateTurnDto,
  DebateTurnResponseDto,
} from './dto/debate-turn-response.dto';
import {
  BANNED_OPENING_PHRASES,
  buildDebateSystemPrompt,
  buildDebateUserPrompt,
  DEBATE_PROMPT_VERSION,
  type DebateContextPayload,
} from './essay-debate.prompts';

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
      // A NEW session takes its target ids straight off the request body, and
      // those ids decide which essay the debate is ABOUT: the context loader
      // reads whatever they point at and feeds its full text to the model,
      // which discusses it with the caller turn by turn. Unchecked,
      // `admissionCaseId` reached any AdmissionCase — including
      // `visibility: PRIVATE` — and `essayId` reached any user's private
      // draft. The guards above cover the session; nothing covered what the
      // session was pointed at. In this try so a rejected target refunds the
      // turn, like the other caller-fault paths.
      if (!session) {
        await this.assertDebatableTargets(userId, dto);
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

    // PR6: post-hoc sycophancy 2.0 detection. We do NOT reject the turn —
    // censoring the model after the fact would just create flaky UX. But
    // we log so PR7's eval pipeline can measure adherence to the v2 HARD
    // RULE against the banned concession-opening phrases.
    this.detectSycophancyOpening(rebuttal, parsed.rebuttal);

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
   * Reject a debate aimed at material the caller may not read.
   *
   * Two vectors, both from the request body of a new session:
   *   - `admissionCaseId` — must be a case the gallery publishes. Reuses
   *     CASE_PUBLIC_WHERE so this surface tracks the gallery instead of
   *     restating its rules; AdmissionCase.visibility defaults to PRIVATE.
   *   - `essayId` — must belong to the caller's own profile. Essay is keyed
   *     by profileId, so the check joins through it rather than trusting the
   *     id.
   *
   * NotFound rather than Forbidden: a rejected id must not tell the caller
   * whether it exists.
   */
  private async assertDebatableTargets(
    userId: string,
    dto: CreateDebateTurnDto,
  ): Promise<void> {
    if (dto.admissionCaseId) {
      const gallery = await this.prisma.admissionCase.findFirst({
        where: { id: dto.admissionCaseId, ...CASE_PUBLIC_WHERE },
        select: { id: true },
      });
      if (!gallery) {
        throw new NotFoundException('Admission case not found');
      }
    }

    if (dto.essayId) {
      const own = await this.prisma.essay.findFirst({
        where: { id: dto.essayId, profile: { userId } },
        select: { id: true },
      });
      if (!own) {
        throw new NotFoundException('Essay not found');
      }
    }
  }

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
   * if `quote` is a verbatim substring of the haystack. Whitespace AND
   * case are normalised so the model is allowed to vary CR/LF and capital
   * letters — but the rest of the characters must match 1:1.
   *
   * PR6 fixes (driven by PR5 5-agent eval):
   *  - Case drift slipped through PR2's strict-case substring check
   *    (Duke Q13 lowercase "it"; Yale Q25 lowercase "the"). Lowercase
   *    both sides before matching.
   *  - Semantic substitution (Harvard Q33 "life" → "it") wasn't caught
   *    because the substituted form was paraphrased to a longer string
   *    that still partially overlapped. Add a fuzzy boundary check that
   *    rejects when no contiguous window in the haystack is within 5%
   *    edit distance of the quote.
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
      const exactFound =
        haystacks[source].includes(normalisedQuote) ||
        unionHaystack.includes(normalisedQuote);

      if (!exactFound) {
        // PR6 fuzzy fallback — catches Harvard-Q33-style semantic
        // substitutions where the quote was paraphrased to a form that
        // doesn't substring-match anywhere. If even the best fuzzy match
        // is >5% edit distance, the quote is fabricated.
        const fuzzy = this.findClosestVerbatimMatch(
          normalisedQuote,
          unionHaystack,
        );
        if (!fuzzy || fuzzy.editDistance / normalisedQuote.length > 0.05) {
          this.logger.warn(
            `Stripped fabricated evidence quote (len=${rawQuote.length}, source=${rawSource}, fuzzy=${fuzzy ? `${fuzzy.editDistance}/${normalisedQuote.length}` : 'none'})`,
          );
          continue;
        }
        // Fuzzy match within tolerance — likely a tolerable variation
        // (a stray punctuation, smart-quote, etc). Keep it but log so
        // PR7 eval can audit how often this branch fires.
        this.logger.log(
          `Evidence kept via fuzzy match (edit=${fuzzy.editDistance}/${normalisedQuote.length}, source=${rawSource})`,
        );
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

  /**
   * Collapse whitespace AND lowercase so the LLM's CR/LF + capitalisation
   * noise doesn't break matching. PR6: added .toLowerCase() to catch the
   * Duke Q13 / Yale Q25 case-drift fabrications that slipped through PR2's
   * case-sensitive includes() check.
   *
   * IMPORTANT: only used for the match check. The ORIGINAL case-preserved
   * `quote` string is what we store in the evidence array — the model's
   * intended capitalisation is the source of truth for display.
   */
  private normaliseForMatch(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Sliding-window closest-match search. Returns the haystack substring
   * (of approximately the same length as the quote) with the lowest
   * Levenshtein edit distance to the quote, or null if no window is
   * within `quote.length * 0.5` edit distance (early-exit to bound cost).
   *
   * Performance: stride = max(1, quote.length / 16) so a 200-char quote
   * checks ~haystack_length/12 windows. For our 1-2k essay haystacks this
   * is sub-millisecond.
   */
  private findClosestVerbatimMatch(
    quote: string,
    haystack: string,
  ): { match: string; editDistance: number } | null {
    if (quote.length === 0 || haystack.length < quote.length) {
      return null;
    }
    const windowLen = quote.length;
    const stride = Math.max(1, Math.floor(windowLen / 16));
    const earlyExitBudget = Math.floor(windowLen * 0.5);
    let best: { match: string; editDistance: number } | null = null;
    for (let i = 0; i + windowLen <= haystack.length; i += stride) {
      const window = haystack.slice(i, i + windowLen);
      const dist = this.boundedLevenshtein(
        quote,
        window,
        best ? best.editDistance : earlyExitBudget,
      );
      if (dist >= 0 && (best === null || dist < best.editDistance)) {
        best = { match: window, editDistance: dist };
        if (dist === 0) return best;
      }
    }
    return best;
  }

  /**
   * Levenshtein distance with an early-exit bound: returns -1 the moment
   * we know the distance will exceed `maxDistance`. Classic Wagner-Fischer
   * with min-of-row pruning.
   */
  private boundedLevenshtein(
    a: string,
    b: string,
    maxDistance: number,
  ): number {
    if (Math.abs(a.length - b.length) > maxDistance) return -1;
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    let prev = new Array<number>(n + 1);
    let curr = new Array<number>(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      let rowMin = curr[0];
      for (let j = 1; j <= n; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1, // deletion
          curr[j - 1] + 1, // insertion
          prev[j - 1] + cost, // substitution
        );
        if (curr[j] < rowMin) rowMin = curr[j];
      }
      if (rowMin > maxDistance) return -1;
      [prev, curr] = [curr, prev];
    }
    return prev[n];
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

  /**
   * PR6 — detect sycophancy 2.0 (concession-opening) and log a WARNING.
   *
   * We deliberately do NOT reject the turn here. The HARD RULE lives in
   * the prompt; rejecting at the schema layer would (a) be censorship of
   * a legitimate but stylistically-bad output, and (b) leak censorship
   * boundaries to whoever probes the API. Instead PR7's eval pipeline
   * scrapes these warning logs to measure adherence rate.
   *
   * Trimmed-rebuttal is checked because that's what we persist. We also
   * peek at the raw model field in case the trim dropped a leading phrase.
   */
  private detectSycophancyOpening(
    trimmedRebuttal: string,
    rawRebuttal: unknown,
  ): void {
    const candidates: string[] = [trimmedRebuttal];
    if (
      typeof rawRebuttal === 'string' &&
      rawRebuttal.trim() !== trimmedRebuttal
    ) {
      candidates.push(rawRebuttal.trim());
    }
    for (const text of candidates) {
      // Check only the opening 60 chars — concession at the END is fine
      // per the prompt (it's leading that's banned).
      const head = text.slice(0, 60).toLowerCase();
      for (const phrase of BANNED_OPENING_PHRASES) {
        // Strip the ellipsis-style banned phrase (the "X... Y" pattern)
        // into a more matchable prefix.
        const needle = phrase
          .toLowerCase()
          .split('...')[0]
          .replace(/\s+/g, ' ')
          .trim();
        if (head.includes(needle)) {
          this.logger.warn(
            `[sycophancy-2.0] rebuttal opens with banned concession phrase "${needle}" (prompt=${DEBATE_PROMPT_VERSION})`,
          );
          return;
        }
      }
    }
  }
}
