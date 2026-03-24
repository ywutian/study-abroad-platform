import {
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const AWARD_LEVELS = [
  'SCHOOL',
  'REGIONAL',
  'STATE',
  'NATIONAL',
  'INTERNATIONAL',
] as const;

const AWARD_CATEGORIES = [
  'STEM',
  'MATH',
  'SCIENCE',
  'COMPUTER_SCIENCE',
  'ENGINEERING',
  'BUSINESS',
  'ARTS',
  'HUMANITIES',
  'SOCIAL_SCIENCE',
  'LANGUAGE',
  'SPORTS',
  'COMMUNITY_SERVICE',
  'LEADERSHIP',
  'OTHER',
] as const;

export class CreateAwardDto {
  @ApiProperty({ description: 'Award name', example: 'AMC 12 Perfect Score' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: AWARD_LEVELS, description: 'Award level' })
  @IsIn(AWARD_LEVELS)
  level: string;

  @ApiPropertyOptional({ description: 'Award year', example: 2025 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @Max(2030)
  year?: number;

  @ApiPropertyOptional({ description: 'Award description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Associated competition ID (Competition.id)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  competitionId?: string;

  @ApiPropertyOptional({
    enum: AWARD_CATEGORIES,
    description: 'Award category',
  })
  @IsOptional()
  @IsIn(AWARD_CATEGORIES)
  category?: string;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  order?: number;
}

export class UpdateAwardDto {
  @ApiPropertyOptional({ description: 'Award name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: AWARD_LEVELS })
  @IsOptional()
  @IsIn(AWARD_LEVELS)
  level?: string;

  @ApiPropertyOptional({ description: 'Award year' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @Max(2030)
  year?: number;

  @ApiPropertyOptional({ description: 'Award description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Associated competition ID (Competition.id)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  competitionId?: string;

  @ApiPropertyOptional({
    enum: AWARD_CATEGORIES,
    description: 'Award category',
  })
  @IsOptional()
  @IsIn(AWARD_CATEGORIES)
  category?: string;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  order?: number;
}
