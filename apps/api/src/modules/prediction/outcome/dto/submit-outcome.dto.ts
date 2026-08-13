import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PredictionOutcomeLabel,
  PredictionOutcomeLabelStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * POST /predictions/outcomes — user reports their admission outcome
 *
 * The user provides `predictionResultId` (which prediction this outcome is for)
 * and `result` (the actual admission decision). Defaults to SELF_REPORTED tier
 * unless evidence is also attached.
 */
export class SubmitOutcomeDto {
  @ApiProperty({ description: 'PredictionResult id this outcome resolves' })
  @IsString()
  @MaxLength(50)
  predictionResultId: string;

  @ApiProperty({
    enum: PredictionOutcomeLabel,
    description: 'Actual admission decision',
  })
  @IsEnum(PredictionOutcomeLabel)
  result: PredictionOutcomeLabel;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Optional short note (e.g. waitlist context, deferred reason)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Optional URL to an acceptance letter / portal screenshot for DOCUMENT_VERIFIED upgrade',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  evidenceUrl?: string;

  @ApiPropertyOptional({
    description:
      'Round override (ED/EA/RD/REA). If null, uses PredictionResult.applicationRound',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  round?: string;

  @ApiPropertyOptional({
    description:
      'Whether this is the final decision (true) or a preliminary (waitlisted/deferred) status',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;

  @ApiPropertyOptional({
    description:
      'If true, opt-in to share this anonymized outcome with future applicants via AdmissionCase pool',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  shareWithFutureApplicants?: boolean;
}

/**
 * GET /predictions/outcomes/me — query params
 */
export class ListMyOutcomesDto {
  @ApiPropertyOptional({ enum: PredictionOutcomeLabel })
  @IsOptional()
  @IsEnum(PredictionOutcomeLabel)
  result?: PredictionOutcomeLabel;

  @ApiPropertyOptional({ enum: PredictionOutcomeLabelStatus })
  @IsOptional()
  @IsEnum(PredictionOutcomeLabelStatus)
  status?: PredictionOutcomeLabelStatus;
}

/**
 * POST /admin/predictions/outcomes/:id/verify — admin verifies an outcome
 */
export class VerifyOutcomeDto {
  @ApiProperty({
    enum: PredictionOutcomeLabelStatus,
    description:
      'New verification status (COUNSELOR_VERIFIED / DOCUMENT_VERIFIED / CONFLICTED / REJECTED)',
  })
  @IsEnum(PredictionOutcomeLabelStatus)
  status: PredictionOutcomeLabelStatus;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Admin note explaining the verification decision',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
