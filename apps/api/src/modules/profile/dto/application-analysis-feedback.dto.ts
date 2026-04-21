import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ApplicationAnalysisExperimentCapability,
  ApplicationAnalysisFeedbackCategory,
  ApplicationAnalysisFeedbackSentiment,
} from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const EXPERIMENT_CAPABILITIES = Object.values(
  ApplicationAnalysisExperimentCapability,
);
const FEEDBACK_CATEGORIES = Object.values(ApplicationAnalysisFeedbackCategory);
const FEEDBACK_SENTIMENTS = Object.values(ApplicationAnalysisFeedbackSentiment);

export class SubmitApplicationAnalysisFeedbackDto {
  @ApiPropertyOptional({
    description:
      'Application-analysis run identifier for applicant-facing feedback on the main structured analysis',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  runId?: string;

  @ApiPropertyOptional({
    description:
      'Exposure identifier for experiment-specific feedback; required when runId is not provided',
  })
  @ValidateIf((object: SubmitApplicationAnalysisFeedbackDto) => !object.runId)
  @IsString()
  @MaxLength(200)
  exposureId?: string;

  @ApiPropertyOptional({
    enum: EXPERIMENT_CAPABILITIES,
    description:
      'Experiment capability for experiment-specific feedback; required when runId is not provided',
  })
  @ValidateIf((object: SubmitApplicationAnalysisFeedbackDto) => !object.runId)
  @IsEnum(EXPERIMENT_CAPABILITIES)
  capability?: (typeof EXPERIMENT_CAPABILITIES)[number];

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
