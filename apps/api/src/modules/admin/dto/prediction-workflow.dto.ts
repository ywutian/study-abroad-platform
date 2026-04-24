import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
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
  PredictionObservationSourceType,
  PredictionObservationStatus,
  PredictionPolicyStatus,
  PredictionOutcomeLabelStatus,
} from '@prisma/client';

const OBSERVATION_SOURCE_TYPES = Object.values(PredictionObservationSourceType);
const OBSERVATION_STATUSES = Object.values(PredictionObservationStatus);
const POLICY_STATUSES = Object.values(PredictionPolicyStatus);
const OUTCOME_LABEL_STATUSES = Object.values(PredictionOutcomeLabelStatus);

const OUTCOME_RESULTS = [
  'ADMITTED',
  'REJECTED',
  'WAITLISTED',
  'DEFERRED',
] as const;

export class PredictionObservationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OBSERVATION_STATUSES })
  @IsOptional()
  @IsEnum(OBSERVATION_STATUSES)
  status?: (typeof OBSERVATION_STATUSES)[number];

  @ApiPropertyOptional({ enum: OBSERVATION_SOURCE_TYPES })
  @IsOptional()
  @IsEnum(OBSERVATION_SOURCE_TYPES)
  sourceType?: (typeof OBSERVATION_SOURCE_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  policyVersionId?: string;
}

export class CreatePredictionObservationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  profileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  highSchoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  policyVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cohortKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  round?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  metricType: string;

  @ApiPropertyOptional({ description: '0-1 normalized rate' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  admitCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  applyCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  year?: number;

  @ApiProperty({ enum: OBSERVATION_SOURCE_TYPES })
  @IsEnum(OBSERVATION_SOURCE_TYPES)
  sourceType: (typeof OBSERVATION_SOURCE_TYPES)[number];

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  sourceName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  license?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  qualityScore?: number;

  @ApiPropertyOptional({ description: 'SERVE | DRIFT | RELATIONSHIP | PRIOR' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  observationStage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  observedProbability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  observedProbabilityLow?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  observedProbabilityHigh?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  observedWeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  confidenceLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sampleCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  selectivityBand?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reviewAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  observedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  effectiveFromCycle?: string;

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

export class ReviewPredictionObservationDto {
  @ApiProperty({ enum: OBSERVATION_STATUSES })
  @IsEnum(OBSERVATION_STATUSES)
  status: (typeof OBSERVATION_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reviewAt?: string;

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

export class BuildPredictionSignalsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  policyVersionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  effectiveFromCycle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reviewAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  owner?: string;
}

export class PredictionSignalQueryDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  policyVersionId: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PredictionPolicyQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  policyKey?: string;

  @ApiPropertyOptional({ enum: POLICY_STATUSES })
  @IsOptional()
  @IsEnum(POLICY_STATUSES)
  status?: (typeof POLICY_STATUSES)[number];
}

export class CreatePredictionPolicyVersionDto {
  @ApiPropertyOptional({ default: 'default' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  policyKey?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  version: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

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

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  fairnessConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  calibrationVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  numericCoreVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  explanationSchemaVersion?: string;

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

export class UpdatePredictionPolicyShadowMetricsDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  metrics: Record<string, unknown>;
}

export class PredictionOutcomeQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: OUTCOME_LABEL_STATUSES })
  @IsOptional()
  @IsEnum(OUTCOME_LABEL_STATUSES)
  status?: (typeof OUTCOME_LABEL_STATUSES)[number];

  @ApiPropertyOptional({ enum: OUTCOME_RESULTS })
  @IsOptional()
  @IsEnum(OUTCOME_RESULTS)
  result?: (typeof OUTCOME_RESULTS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  policyVersionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  eligibleOnly?: boolean;
}

export class ReviewPredictionOutcomeDto {
  @ApiProperty({ enum: OUTCOME_LABEL_STATUSES })
  @IsEnum(OUTCOME_LABEL_STATUSES)
  status: (typeof OUTCOME_LABEL_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  evidenceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  round?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}

export class RollbackPredictionPolicyDto {
  @ApiPropertyOptional({ default: 'default' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  policyKey?: string;
}

export class NormalizeLegacyCasesDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'When true, parse cases and return preview + counts but do not write to the DB.',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 10000,
    description:
      'Cap how many cases to process in one call. Defaults to processing all cases with unparsed legacy fields.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number;
}

export class BackfillCohortPriorsDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'When true, compute the aggregation and return a preview but do not write to SchoolCohortRoundPrior.',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    default: 5,
    minimum: 1,
    maximum: 100,
    description:
      'Minimum cases per (school, cohort, round) cell before a prior is emitted.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  minSamples?: number;

  @ApiPropertyOptional({
    description:
      'Custom setVersion tag; defaults to `backfill-admission-cases-YYYY-MM-DD`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  setVersion?: string;
}
