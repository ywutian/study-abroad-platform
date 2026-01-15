import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsArray,
  IsEnum,
  Min,
} from 'class-validator';

export class CreateSchoolDeadlineDto {
  @ApiProperty({ description: '学校ID' })
  @IsString()
  @IsNotEmpty()
  schoolId: string;

  @ApiProperty({ description: '申请季年份，如 2026 表示 Fall 2026 入学' })
  @IsInt()
  @Min(2020)
  year: number;

  @ApiProperty({ description: '轮次: ED, ED2, EA, REA, RD, Rolling' })
  @IsString()
  @IsNotEmpty()
  round: string;

  @ApiProperty({ description: '申请截止日期' })
  @IsDateString()
  applicationDeadline: string;

  @ApiPropertyOptional({ description: '助学金截止日期' })
  @IsDateString()
  @IsOptional()
  financialAidDeadline?: string;

  @ApiPropertyOptional({ description: '放榜日期' })
  @IsDateString()
  @IsOptional()
  decisionDate?: string;

  @ApiPropertyOptional({
    description: '文书题目 JSON [{prompt, wordLimit, required}]',
  })
  @IsOptional()
  essayPrompts?: any;

  @ApiPropertyOptional({ description: '文书数量' })
  @IsInt()
  @IsOptional()
  essayCount?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  interviewRequired?: boolean;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  interviewDeadline?: string;

  @ApiPropertyOptional({ description: '申请费（美元）' })
  @IsInt()
  @IsOptional()
  applicationFee?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateSchoolDeadlineDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  applicationDeadline?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  financialAidDeadline?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  decisionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  essayPrompts?: any;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  essayCount?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  interviewRequired?: boolean;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  interviewDeadline?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  applicationFee?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
