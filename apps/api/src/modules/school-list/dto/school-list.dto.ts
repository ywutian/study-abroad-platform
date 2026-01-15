import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

// Define locally until Prisma client is regenerated
export enum SchoolTier {
  SAFETY = 'SAFETY',
  TARGET = 'TARGET',
  REACH = 'REACH',
}

export class CreateSchoolListItemDto {
  @ApiProperty({ description: 'School ID to add to list' })
  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @ApiPropertyOptional({ enum: SchoolTier, default: 'TARGET' })
  @IsOptional()
  @IsEnum(SchoolTier)
  tier?: SchoolTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  round?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSchoolListItemDto {
  @ApiPropertyOptional({ enum: SchoolTier })
  @IsOptional()
  @IsEnum(SchoolTier)
  tier?: SchoolTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  round?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
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
  };

  @ApiProperty({ enum: SchoolTier })
  tier: SchoolTier;

  @ApiPropertyOptional()
  round?: string;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  isAIRecommended: boolean;

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
