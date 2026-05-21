import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DebateEvidenceDto, DebateTurnDto } from './debate-turn-response.dto';

/**
 * Response shape for `GET /admin/debate-eval/queue?evaluatorId=...` —
 * the next un-rated turn this evaluator should see. Lumni turns and
 * ChatGPT control turns are interleaved randomly; the response does not
 * reveal which kind this turn is (the rating UI is blinded).
 *
 * When everything has been rated, `done: true` and `next` is undefined.
 */
export class BlindEvalQueueItemDto {
  @ApiProperty({ description: 'Session id this turn lives in.' })
  sessionId!: string;

  @ApiProperty({ description: '0-indexed turn within session.turns[].' })
  turnIndex!: number;

  /** Server-side flag — NOT shown to the evaluator. Re-submitted on rate. */
  @ApiProperty({
    description:
      'True if this is a ChatGPT control. Kept server-side so the rating POST can preserve the label without trusting the client; the admin UI should not render this field.',
  })
  isChatGptControl!: boolean;

  @ApiProperty({ type: DebateTurnDto })
  aiTurn!: DebateTurnDto;

  @ApiPropertyOptional({
    description:
      'The user turn that preceded this AI turn (context — what the user said before the rebuttal). Undefined if turnIndex is 0 or the prior turn is absent.',
    type: DebateTurnDto,
  })
  userTurn?: DebateTurnDto;

  @ApiProperty({
    description:
      "Essay text the debate is about. Shown collapsed by default in the admin UI so the evaluator isn't biased by reading the whole essay before judging the turn.",
  })
  essayText!: string;

  @ApiPropertyOptional({
    description:
      'Which paragraph (0-indexed) the debate was scoped to (may be null).',
  })
  paragraphIndex?: number;

  @ApiPropertyOptional({
    description:
      'School this essay was written for (display-only, helps the evaluator gauge context).',
  })
  schoolName?: string;

  @ApiPropertyOptional({
    description:
      "PR9: prior AI paragraph commentary for THIS turn's paragraph, loaded from `AdmissionCase.aiAnalysisCache` so blind raters can verify any `source: prior_commentary` quote in the AI rebuttal. Returns null when the case has no precomputed cache or the cached locale is missing. Absence means \"can't verify prior_commentary quotes\" — rater should fall back to essayText verification for those.",
  })
  priorCommentary?: {
    paragraphIndex: number;
    score: number;
    status: string;
    comment: string;
    highlights: string[];
    suggestions: string[];
  } | null;
}

export class BlindEvalQueueResponseDto {
  @ApiProperty({
    description: 'True when no more turns left for this evaluator.',
  })
  done!: boolean;

  @ApiProperty({
    description: 'Total turns in the eval pool (lumni + controls).',
  })
  totalInPool!: number;

  @ApiProperty({
    description: 'Turns this evaluator has already rated.',
  })
  rated!: number;

  @ApiPropertyOptional({ type: BlindEvalQueueItemDto })
  next?: BlindEvalQueueItemDto;
}

/**
 * Response shape for `POST /admin/debate-eval/rate` — confirms the rating
 * was stored and surfaces the unique-key id for traceability.
 */
export class RateDebateTurnResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sessionId!: string;

  @ApiProperty()
  turnIndex!: number;

  @ApiProperty()
  evaluatorId!: string;

  @ApiProperty({
    description: 'True if this row was an UPSERT (already existed).',
  })
  updated!: boolean;
}

// Re-export so the controller can import everything from one place.
export { DebateEvidenceDto, DebateTurnDto };
