import {
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  IsBoolean,
  IsDateString,
  IsArray,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
  @ApiProperty({ description: '活动名称', example: '机器人社' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ACTIVITY_CATEGORIES, description: '活动类别' })
  @IsIn(ACTIVITY_CATEGORIES)
  category: string;

  @ApiProperty({ description: '角色/职位', example: '社长' })
  @IsString()
  @MaxLength(100)
  role: string;

  @ApiPropertyOptional({ description: '组织名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  organization?: string;

  @ApiPropertyOptional({ description: '活动描述' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '每周小时数' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(40)
  hoursPerWeek?: number;

  @ApiPropertyOptional({ description: '每年周数' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(52)
  weeksPerYear?: number;

  @ApiPropertyOptional({ description: '是否持续中' })
  @IsOptional()
  @IsBoolean()
  isOngoing?: boolean;

  @ApiPropertyOptional({ description: '排序顺序' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: '年级', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  gradeLevels?: number[];

  @ApiPropertyOptional({ enum: ACTIVITY_TIMING, description: '时间段' })
  @IsOptional()
  @IsIn(ACTIVITY_TIMING)
  timing?: string;

  @ApiPropertyOptional({ description: '活动模板ID' })
  @IsOptional()
  @IsString()
  activityTemplateId?: string;
}

export class UpdateActivityDto {
  @ApiPropertyOptional({ description: '活动名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ACTIVITY_CATEGORIES })
  @IsOptional()
  @IsIn(ACTIVITY_CATEGORIES)
  category?: string;

  @ApiPropertyOptional({ description: '角色/职位' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @ApiPropertyOptional({ description: '组织名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  organization?: string;

  @ApiPropertyOptional({ description: '活动描述' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '每周小时数' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(40)
  hoursPerWeek?: number;

  @ApiPropertyOptional({ description: '每年周数' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(52)
  weeksPerYear?: number;

  @ApiPropertyOptional({ description: '是否持续中' })
  @IsOptional()
  @IsBoolean()
  isOngoing?: boolean;

  @ApiPropertyOptional({ description: '排序顺序' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  order?: number;

  @ApiPropertyOptional({ description: '年级', type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  gradeLevels?: number[];

  @ApiPropertyOptional({ enum: ACTIVITY_TIMING, description: '时间段' })
  @IsOptional()
  @IsIn(ACTIVITY_TIMING)
  timing?: string;

  @ApiPropertyOptional({ description: '活动模板ID' })
  @IsOptional()
  @IsString()
  activityTemplateId?: string;
}

export class ReorderIdsDto {
  @ApiProperty({ description: 'Ordered array of IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
