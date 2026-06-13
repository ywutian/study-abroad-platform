import {
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  IsBoolean,
  IsDateString,
  IsArray,
  ArrayMaxSize,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  MAX_ACTIVITY_GRADE_LEVELS,
  MAX_REORDER_IDS,
} from '@study-abroad/shared';

const ACTIVITY_CATEGORIES = [
  'ACADEMIC',
  'ARTS',
  'ATHLETICS',
  'COMMUNITY_SERVICE',
  'LEADERSHIP',
  'WORK',
  'RESEARCH',
  'INTERNSHIP',
  'CLUB',
  'HOBBY',
  'OTHER',
] as const;

const ACTIVITY_TIMING = ['SCHOOL_YEAR', 'SCHOOL_BREAK', 'ALL_YEAR'] as const;

export class CreateActivityDto {
  @ApiProperty({ description: 'Activity name', example: 'Robotics Club' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ACTIVITY_CATEGORIES, description: 'Activity category' })
  @IsIn(ACTIVITY_CATEGORIES)
  category: string;

  @ApiProperty({ description: 'Role/position', example: 'President' })
  @IsString()
  @MaxLength(100)
  role: string;

  @ApiPropertyOptional({ description: 'Organization name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  organization?: string;

  @ApiPropertyOptional({ description: 'Activity description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Hours per week' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(40)
  hoursPerWeek?: number;

  @ApiPropertyOptional({ description: 'Weeks per year' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(52)
  weeksPerYear?: number;

  @ApiPropertyOptional({ description: 'Whether ongoing' })
  @IsOptional()
  @IsBoolean()
  isOngoing?: boolean;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: 'Grade levels', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayMaxSize(MAX_ACTIVITY_GRADE_LEVELS)
  gradeLevels?: number[];

  @ApiPropertyOptional({ enum: ACTIVITY_TIMING, description: 'Time period' })
  @IsOptional()
  @IsIn(ACTIVITY_TIMING)
  timing?: string;

  @ApiPropertyOptional({ description: 'Activity template ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  activityTemplateId?: string;

  @ApiPropertyOptional({
    description: 'Common App activity description (max 150 chars)',
    example: 'Led team of 20 to design and build competition robot',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  commonAppDescription?: string;
}

export class UpdateActivityDto {
  @ApiPropertyOptional({ description: 'Activity name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ACTIVITY_CATEGORIES })
  @IsOptional()
  @IsIn(ACTIVITY_CATEGORIES)
  category?: string;

  @ApiPropertyOptional({ description: 'Role/position' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @ApiPropertyOptional({ description: 'Organization name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  organization?: string;

  @ApiPropertyOptional({ description: 'Activity description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Hours per week' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(40)
  hoursPerWeek?: number;

  @ApiPropertyOptional({ description: 'Weeks per year' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(52)
  weeksPerYear?: number;

  @ApiPropertyOptional({ description: 'Whether ongoing' })
  @IsOptional()
  @IsBoolean()
  isOngoing?: boolean;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: 'Grade levels', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @ArrayMaxSize(MAX_ACTIVITY_GRADE_LEVELS)
  gradeLevels?: number[];

  @ApiPropertyOptional({ enum: ACTIVITY_TIMING, description: 'Time period' })
  @IsOptional()
  @IsIn(ACTIVITY_TIMING)
  timing?: string;

  @ApiPropertyOptional({ description: 'Activity template ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  activityTemplateId?: string;

  @ApiPropertyOptional({
    description: 'Common App activity description (max 150 chars)',
    example: 'Led team of 20 to design and build competition robot',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  commonAppDescription?: string;
}

export class ReorderIdsDto {
  @ApiProperty({ description: 'Ordered array of IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMaxSize(MAX_REORDER_IDS)
  ids: string[];
}
