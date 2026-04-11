import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import {
  ApplicationAnalysisEvaluationMode,
  ApplicationAnalysisExperimentCapability,
  ApplicationAnalysisExperimentEvaluationMode,
  ApplicationAnalysisExperimentIncidentStatus,
  ApplicationAnalysisExperimentSweepMode,
  ApplicationAnalysisExperimentSweepStatus,
  ApplicationAnalysisExperimentStatus,
  ApplicationAnalysisFeedbackCategory,
  ApplicationAnalysisFeedbackSentiment,
  ApplicationAnalysisPolicyStatus,
  SchoolPolicyDimension,
  SchoolPolicyEvidenceStatus,
} from '@prisma/client';

const EVIDENCE_STATUSES = Object.values(SchoolPolicyEvidenceStatus);
const POLICY_DIMENSIONS = Object.values(SchoolPolicyDimension);
const POLICY_STATUSES = Object.values(ApplicationAnalysisPolicyStatus);
const EVALUATION_MODES = Object.values(ApplicationAnalysisEvaluationMode);
const EXPERIMENT_CAPABILITIES = Object.values(
  ApplicationAnalysisExperimentCapability,
);
const EXPERIMENT_STATUSES = Object.values(ApplicationAnalysisExperimentStatus);
const EXPERIMENT_EVALUATION_MODES = Object.values(
  ApplicationAnalysisExperimentEvaluationMode,
);
const FEEDBACK_CATEGORIES = Object.values(ApplicationAnalysisFeedbackCategory);
const FEEDBACK_SENTIMENTS = Object.values(ApplicationAnalysisFeedbackSentiment);
const EXPERIMENT_SWEEP_MODES = Object.values(
  ApplicationAnalysisExperimentSweepMode,
);
const EXPERIMENT_SWEEP_STATUSES = Object.values(
  ApplicationAnalysisExperimentSweepStatus,
);
const INCIDENT_STATUSES = Object.values(
  ApplicationAnalysisExperimentIncidentStatus,
);

export class ApplicationAnalysisEvidenceQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EVIDENCE_STATUSES })
  @IsOptional()
  @IsEnum(EVIDENCE_STATUSES)
  status?: (typeof EVIDENCE_STATUSES)[number];

  @ApiPropertyOptional({ enum: POLICY_DIMENSIONS })
  @IsOptional()
  @IsEnum(POLICY_DIMENSIONS)
  policyDimension?: (typeof POLICY_DIMENSIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;
}

export class CreateSchoolPolicyEvidenceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  schoolId: string;

  @ApiProperty({ enum: POLICY_DIMENSIONS })
  @IsEnum(POLICY_DIMENSIONS)
  policyDimension: (typeof POLICY_DIMENSIONS)[number];

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  policyValue: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  sourceName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  sourcePublishedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  sourceQuality?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class ReviewSchoolPolicyEvidenceDto {
  @ApiProperty({ enum: EVIDENCE_STATUSES })
  @IsEnum(EVIDENCE_STATUSES)
  status: (typeof EVIDENCE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reviewedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class ApplicationAnalysisPolicyQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: POLICY_STATUSES })
  @IsOptional()
  @IsEnum(POLICY_STATUSES)
  status?: (typeof POLICY_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  policyKey?: string;
}

export class CreateApplicationAnalysisPolicyVersionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  policyKey?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  version: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  analysisVersion: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  promptVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ruleBundleVersion?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  thresholds?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  rolloutConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  monitoringConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class RollbackApplicationAnalysisPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  policyKey?: string;
}

export class ApplicationAnalysisEvaluationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EVALUATION_MODES })
  @IsOptional()
  @IsEnum(EVALUATION_MODES)
  mode?: (typeof EVALUATION_MODES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  policyVersionId?: string;
}

export class ApplicationAnalysisRecoursePreviewDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  policyVersionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  experimentVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  profileId?: string;
}

export class ApplicationAnalysisUncertaintyPreviewDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  policyVersionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  experimentVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;
}

export class ApplicationAnalysisFairnessReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  policyVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  experimentVersionId?: string;
}

export class ApplicationAnalysisExperimentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EXPERIMENT_CAPABILITIES })
  @IsOptional()
  @IsEnum(EXPERIMENT_CAPABILITIES)
  capability?: (typeof EXPERIMENT_CAPABILITIES)[number];

  @ApiPropertyOptional({ enum: EXPERIMENT_STATUSES })
  @IsOptional()
  @IsEnum(EXPERIMENT_STATUSES)
  status?: (typeof EXPERIMENT_STATUSES)[number];
}

export class CreateApplicationAnalysisExperimentVersionDto {
  @ApiProperty({ enum: EXPERIMENT_CAPABILITIES })
  @IsEnum(EXPERIMENT_CAPABILITIES)
  capability: (typeof EXPERIMENT_CAPABILITIES)[number];

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  version: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  methodVersion: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  policyVersionId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  gateConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  rolloutConfig?: Record<string, unknown>;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  monitoringConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class ApplicationAnalysisExperimentEvaluationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EXPERIMENT_EVALUATION_MODES })
  @IsOptional()
  @IsEnum(EXPERIMENT_EVALUATION_MODES)
  mode?: (typeof EXPERIMENT_EVALUATION_MODES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  experimentVersionId?: string;
}

export class RefreshApplicationAnalysisExperimentEvaluationDto {
  @ApiPropertyOptional({ enum: EXPERIMENT_EVALUATION_MODES })
  @IsOptional()
  @IsEnum(EXPERIMENT_EVALUATION_MODES)
  mode?: (typeof EXPERIMENT_EVALUATION_MODES)[number];
}

export class RetireApplicationAnalysisExperimentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  reason?: string;
}

export class UpdateApplicationAnalysisExperimentConfigDto {
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  rolloutPercentages?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  minStageHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoPromote?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoRetire?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  automationPaused?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  monitoringThresholds?: Record<string, number>;
}

export class ApplicationAnalysisExperimentSweepQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EXPERIMENT_SWEEP_MODES })
  @IsOptional()
  @IsEnum(EXPERIMENT_SWEEP_MODES)
  mode?: (typeof EXPERIMENT_SWEEP_MODES)[number];

  @ApiPropertyOptional({ enum: EXPERIMENT_SWEEP_STATUSES })
  @IsOptional()
  @IsEnum(EXPERIMENT_SWEEP_STATUSES)
  status?: (typeof EXPERIMENT_SWEEP_STATUSES)[number];
}

export class ApplicationAnalysisExperimentIncidentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EXPERIMENT_CAPABILITIES })
  @IsOptional()
  @IsEnum(EXPERIMENT_CAPABILITIES)
  capability?: (typeof EXPERIMENT_CAPABILITIES)[number];

  @ApiPropertyOptional({ enum: INCIDENT_STATUSES })
  @IsOptional()
  @IsEnum(INCIDENT_STATUSES)
  status?: (typeof INCIDENT_STATUSES)[number];
}

export class ApplicationAnalysisExperimentFeedbackQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EXPERIMENT_CAPABILITIES })
  @IsOptional()
  @IsEnum(EXPERIMENT_CAPABILITIES)
  capability?: (typeof EXPERIMENT_CAPABILITIES)[number];

  @ApiPropertyOptional({ enum: FEEDBACK_CATEGORIES })
  @IsOptional()
  @IsEnum(FEEDBACK_CATEGORIES)
  category?: (typeof FEEDBACK_CATEGORIES)[number];

  @ApiPropertyOptional({ enum: FEEDBACK_SENTIMENTS })
  @IsOptional()
  @IsEnum(FEEDBACK_SENTIMENTS)
  sentiment?: (typeof FEEDBACK_SENTIMENTS)[number];
}

export class AcknowledgeApplicationAnalysisExperimentIncidentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
