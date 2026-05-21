import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EssayDebateRating } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Body for `POST /admin/debate-eval/rate` — one counsellor rating of one
 * AI turn within a debate session. Idempotent on
 * (sessionId, turnIndex, evaluatorId) — re-posting overwrites the rating.
 *
 * Phase 2 V1 PR3 Day-6 capture endpoint. Used by the blind-eval admin page
 * (`/admin/debate-eval`); evaluator identity comes from a URL query param,
 * not from auth — the eval tool is admin-role gated upstream and the
 * counsellor handle is just a label, not a security boundary.
 */
export class RateDebateTurnDto {
  @ApiProperty({ description: 'Debate session that contains the turn.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sessionId!: string;

  @ApiProperty({
    description:
      '0-indexed turn inside session.turns[]. The AI turn being rated.',
  })
  @IsInt()
  @Min(0)
  turnIndex!: number;

  @ApiProperty({
    description:
      "Free-form evaluator handle (e.g. 'counselor-sarah-001'). Not a User FK.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  evaluatorId!: string;

  @ApiProperty({ enum: EssayDebateRating })
  @IsEnum(EssayDebateRating)
  rating!: EssayDebateRating;

  @ApiPropertyOptional({
    description:
      "True if the session's turns are ChatGPT control placeholders. The blind-eval queue surfaces this server-side so the admin UI doesn't have to reason about it.",
  })
  @IsOptional()
  @IsBoolean()
  isChatGptControl?: boolean;

  @ApiPropertyOptional({
    description:
      'Did the evaluator confirm the evidence[] quotes are actually present in the source? Null when the turn had no evidence.',
  })
  @IsOptional()
  @IsBoolean()
  evidenceIntegrity?: boolean;

  @ApiPropertyOptional({ description: 'Free-form evaluator notes.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
