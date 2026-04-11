import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApplicationAnalysisExperimentCapability,
  ApplicationAnalysisFeedbackCategory,
  ApplicationAnalysisFeedbackSentiment,
} from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

const EXPERIMENT_CAPABILITIES = Object.values(
  ApplicationAnalysisExperimentCapability,
);
const FEEDBACK_CATEGORIES = Object.values(ApplicationAnalysisFeedbackCategory);
const FEEDBACK_SENTIMENTS = Object.values(ApplicationAnalysisFeedbackSentiment);

export class SubmitApplicationAnalysisFeedbackDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  exposureId: string;

  @ApiProperty({ enum: EXPERIMENT_CAPABILITIES })
  @IsEnum(EXPERIMENT_CAPABILITIES)
  capability: (typeof EXPERIMENT_CAPABILITIES)[number];

  @ApiProperty({ enum: FEEDBACK_SENTIMENTS })
  @IsEnum(FEEDBACK_SENTIMENTS)
  sentiment: (typeof FEEDBACK_SENTIMENTS)[number];

  @ApiPropertyOptional({ enum: FEEDBACK_CATEGORIES })
  @IsOptional()
  @IsEnum(FEEDBACK_CATEGORIES)
  category?: (typeof FEEDBACK_CATEGORIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
