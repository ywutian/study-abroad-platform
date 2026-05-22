import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  APPLICATION_ROUND_VALUES,
  normalizeApplicationRound,
  type SchoolPublicMedia,
} from '@study-abroad/shared';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsIn,
  MaxLength,
} from 'class-validator';
import { SchoolTier, TierSource } from '@prisma/client';

export { SchoolTier, TierSource };

function applicationRoundTransform({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return normalizeApplicationRound(value) ?? value;
}

export class CreateSchoolListItemDto {
  @ApiProperty({ description: 'School ID to add to list' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  schoolId: string;

  @ApiPropertyOptional({ enum: SchoolTier, default: 'TARGET' })
  @IsOptional()
  @IsEnum(SchoolTier)
  tier?: SchoolTier;

  @ApiPropertyOptional({ enum: APPLICATION_ROUND_VALUES })
  @IsOptional()
  @Transform(applicationRoundTransform)
  @IsIn(APPLICATION_ROUND_VALUES)
  @MaxLength(200)
  round?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Whether AI recommended' })
  @IsOptional()
  @IsBoolean()
  isAIRecommended?: boolean;
}

export class UpdateSchoolListItemDto {
  @ApiPropertyOptional({ enum: SchoolTier })
  @IsOptional()
  @IsEnum(SchoolTier)
  tier?: SchoolTier;

  @ApiPropertyOptional({ enum: APPLICATION_ROUND_VALUES })
  @IsOptional()
  @Transform(applicationRoundTransform)
  @IsIn(APPLICATION_ROUND_VALUES)
  @MaxLength(200)
  round?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Drop a previous manual tier override and let the tier follow the live prediction again',
  })
  @IsOptional()
  @IsBoolean()
  resetTierToPredicted?: boolean;
}

export class SchoolListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
    satAvg?: number;
    sat25?: number;
    sat75?: number;
    actAvg?: number;
    act25?: number;
    act75?: number;
    tuition?: number;
    city?: string;
    state?: string;
    testingPolicy?: 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN';
    testOptional?: boolean;
    hasEarlyDecision?: boolean;
    acceptsCommonApp?: boolean;
    logoUrl?: string;
    media?: SchoolPublicMedia;
  };

  @ApiProperty({
    enum: SchoolTier,
    description:
      'Effective tier: the live prediction-derived tier when tierSource=PREDICTED, the user-set tier when MANUAL',
  })
  tier: SchoolTier;

  @ApiProperty({
    enum: TierSource,
    description:
      'Whether `tier` follows the prediction or is a manual override',
  })
  tierSource: TierSource;

  @ApiPropertyOptional({
    enum: SchoolTier,
    description:
      'The tier the latest prediction would assign. Lets the UI show a "predicted: 冲刺" hint when tierSource=MANUAL and it differs from `tier`. Null when there is no usable prediction.',
  })
  predictedTier?: SchoolTier;

  @ApiProperty({
    description:
      'True when `tier` is an unverified default (tierSource=PREDICTED but no usable prediction yet) — the UI should render a neutral "not assessed" state instead of a confident badge',
  })
  tierIsEstimated: boolean;

  @ApiPropertyOptional()
  round?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  isAIRecommended: boolean;

  @ApiPropertyOptional({ description: 'Prediction data (if available)' })
  prediction?: {
    probability: number;
    tier?: string;
    confidence?: string;
    source?: string;
    authority?: 'AUTHORITATIVE' | 'PREVIEW';
    updatedAt: Date;
  };

  @ApiProperty({ description: 'Number of verified essay prompts' })
  essayPromptCount: number;

  @ApiPropertyOptional({
    description: 'School deadlines for current application year',
  })
  deadlines?: Array<{
    round: string;
    applicationDeadline: string;
    financialAidDeadline?: string;
    interviewRequired: boolean;
    interviewDeadline?: string;
    interviewFormat?: string;
  }>;

  @ApiProperty()
  createdAt: Date;
}

export class AIRecommendationsResponseDto {
  @ApiProperty({ type: [SchoolListItemResponseDto] })
  safety: SchoolListItemResponseDto[];

  @ApiProperty({ type: [SchoolListItemResponseDto] })
  target: SchoolListItemResponseDto[];

  @ApiProperty({ type: [SchoolListItemResponseDto] })
  reach: SchoolListItemResponseDto[];
}
