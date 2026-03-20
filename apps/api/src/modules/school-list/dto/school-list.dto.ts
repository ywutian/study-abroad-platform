import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { SchoolTier } from '@prisma/client';

export { SchoolTier };

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  round?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
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
    testOptional?: boolean;
    hasEarlyDecision?: boolean;
    acceptsCommonApp?: boolean;
    logoUrl?: string;
  };

  @ApiProperty({ enum: SchoolTier })
  tier: SchoolTier;

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
    updatedAt: Date;
  };

  @ApiProperty({ description: 'Number of verified essay prompts' })
  essayPromptCount: number;

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
