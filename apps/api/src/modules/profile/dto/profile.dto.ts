import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BudgetTier, Visibility } from '@prisma/client';

const GRADES = [
  'FRESHMAN',
  'SOPHOMORE',
  'JUNIOR',
  'SENIOR',
  'GAP_YEAR',
] as const;
const APP_ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'RD'] as const;

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: '真实姓名' })
  @IsOptional()
  @IsString()
  realName?: string;

  @ApiPropertyOptional({ description: 'GPA', example: 3.85 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  @Max(5)
  gpa?: number;

  @ApiPropertyOptional({ description: 'GPA 满分', example: 4.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @IsIn([4.0, 5.0, 100])
  gpaScale?: number;

  @ApiPropertyOptional({ description: '当前学校' })
  @IsOptional()
  @IsString()
  currentSchool?: string;

  @ApiPropertyOptional({ description: '学校类型' })
  @IsOptional()
  @IsString()
  currentSchoolType?: string;

  @ApiPropertyOptional({ enum: GRADES, description: '年级' })
  @IsOptional()
  @IsIn(GRADES)
  grade?: string;

  @ApiPropertyOptional({ description: '目标专业' })
  @IsOptional()
  @IsString()
  targetMajor?: string;

  @ApiPropertyOptional({ description: '地区偏好', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionPref?: string[];

  @ApiPropertyOptional({ enum: BudgetTier, description: '预算档次' })
  @IsOptional()
  @IsEnum(BudgetTier)
  budgetTier?: BudgetTier;

  @ApiPropertyOptional({ enum: APP_ROUNDS, description: '申请轮次' })
  @IsOptional()
  @IsIn(APP_ROUNDS)
  applicationRound?: string;

  @ApiPropertyOptional({ enum: Visibility, description: '可见性' })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;
}
