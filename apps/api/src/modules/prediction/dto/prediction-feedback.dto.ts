import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PredictionFeedbackCategory,
  PredictionFeedbackSentiment,
} from '@prisma/client';

export class SubmitPredictionFeedbackDto {
  @ApiProperty({
    enum: PredictionFeedbackSentiment,
    description: 'User perception of the prediction quality.',
  })
  @IsEnum(PredictionFeedbackSentiment)
  sentiment: PredictionFeedbackSentiment;

  @ApiPropertyOptional({
    enum: PredictionFeedbackCategory,
    description: 'Optional reason bucket for unsure or negative feedback.',
  })
  @IsOptional()
  @IsEnum(PredictionFeedbackCategory)
  category?: PredictionFeedbackCategory;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Optional short note for admin review.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListPredictionFeedbackDto {
  @ApiPropertyOptional({ enum: PredictionFeedbackSentiment })
  @IsOptional()
  @IsEnum(PredictionFeedbackSentiment)
  sentiment?: PredictionFeedbackSentiment;

  @ApiPropertyOptional({ enum: PredictionFeedbackCategory })
  @IsOptional()
  @IsEnum(PredictionFeedbackCategory)
  category?: PredictionFeedbackCategory;

  @ApiPropertyOptional({ description: 'Engine snapshot, e.g. counselor.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  engineSnapshot?: string;

  @ApiPropertyOptional({ description: 'Filter by PredictionResult.schoolId.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  daysAgo?: number;

  @ApiPropertyOptional({
    description: 'Cursor returned by the prior list response.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}
