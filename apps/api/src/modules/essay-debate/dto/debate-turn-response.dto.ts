import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * A single evidence quote the AI cites when arguing back. Required by the
 * red-team verdict so the model can't just assert opinions — it must point
 * at concrete text in the essay (or surrounding context) for every claim.
 */
export class DebateEvidenceDto {
  @ApiProperty({ description: 'Verbatim quote from the essay or context.' })
  quote!: string;

  @ApiProperty({
    description:
      'Which of the 6 context classes the quote was taken from. PR2 emits one of these four; future classes may extend the union.',
    enum: ['essay', 'prior_commentary', 'profile', 'school'],
  })
  source!: 'essay' | 'prior_commentary' | 'profile' | 'school';

  @ApiPropertyOptional({
    description: '0-indexed paragraph in the essay (if source = essay).',
  })
  paragraphIndex?: number;
}

/**
 * One turn in a debate. Both user turns and AI turns share this shape; the
 * `role` field disambiguates.
 *
 * Red-team verdict: the AI side has `rebuttal` + `evidence` + `openQuestion`
 * — explicitly NO `concedes` field. The model is never allowed to capitulate.
 */
export class DebateTurnDto {
  @ApiProperty() id!: string;

  @ApiProperty({ enum: ['user', 'ai'] })
  role!: 'user' | 'ai';

  @ApiProperty({
    description:
      'For user turns this is the raw argument; for AI turns this is the rebuttal text.',
  })
  text!: string;

  @ApiPropertyOptional({ type: [DebateEvidenceDto] })
  evidence?: DebateEvidenceDto[];

  @ApiPropertyOptional({
    description:
      'An open question the AI throws back at the user to keep the debate honest.',
  })
  openQuestion?: string;

  @ApiPropertyOptional()
  tokensUsed?: number;

  @ApiPropertyOptional({
    description:
      'PR4 marker: when set to `chatgpt-control`, this turn was authored by the OpenAI-only control generator (`scripts/generate-chatgpt-control-turns.ts`) for the blind A/B eval, NOT by the lumni debate engine. The blind-eval queue uses this to label sessions in the pool without depending on the placeholder text matching trick used in PR3.',
    enum: ['chatgpt-control'],
  })
  source?: 'chatgpt-control';

  @ApiProperty()
  createdAt!: string;
}

/**
 * Response shape for `POST /essay-debate/turn` — the just-appended user
 * turn + the AI's response turn + session metadata.
 */
export class DebateTurnResponseDto {
  @ApiProperty()
  sessionId!: string;

  @ApiProperty({ type: DebateTurnDto })
  userTurn!: DebateTurnDto;

  @ApiProperty({ type: DebateTurnDto })
  aiTurn!: DebateTurnDto;

  @ApiProperty({
    description:
      'Remaining turns the user can spend today (per-user 30/day cap).',
  })
  remainingTurnsToday!: number;
}

/**
 * Response shape for `GET /essay-debate/:sessionId/latest`.
 */
export class DebateSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: 'ACTIVE' | 'CLOSED';
  @ApiProperty() totalTurns!: number;
  @ApiProperty() totalTokens!: number;
  @ApiPropertyOptional() admissionCaseId?: string;
  @ApiPropertyOptional() essayId?: string;
  @ApiPropertyOptional() paragraphIndex?: number;

  @ApiProperty({ type: [DebateTurnDto] })
  turns!: DebateTurnDto[];

  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
