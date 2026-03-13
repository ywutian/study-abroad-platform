import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsArray,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BudgetTier, EducationSystem, Visibility } from '@prisma/client';

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
  @MaxLength(200)
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
  @MaxLength(200)
  currentSchool?: string;

  @ApiPropertyOptional({ description: '学校类型' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentSchoolType?: string;

  @ApiPropertyOptional({ enum: GRADES, description: '年级' })
  @IsOptional()
  @IsIn(GRADES)
  grade?: string;

  @ApiPropertyOptional({ description: '目标专业' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
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

  @ApiPropertyOptional({
    description: '国籍 (ISO 3166-1 alpha-2)',
    example: 'CN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  nationality?: string;

  @ApiPropertyOptional({
    description: '居住国 (ISO 3166-1 alpha-2)',
    example: 'CN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryOfResidence?: string;

  @ApiPropertyOptional({
    description: '公民身份 (ISO 3166-1 alpha-2)',
    example: 'CN',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  citizenship?: string;

  @ApiPropertyOptional({ enum: EducationSystem, description: '教育体系' })
  @IsOptional()
  @IsEnum(EducationSystem)
  educationSystem?: EducationSystem;

  @ApiPropertyOptional({ description: '是否需要助学金' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  needsFinancialAid?: boolean;

  @ApiPropertyOptional({ description: '是否第一代大学生' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  firstGeneration?: boolean;

  @ApiPropertyOptional({ description: 'Legacy 校友子女', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  legacy?: string[];

  @ApiPropertyOptional({ description: '意向专业' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  intendedMajor?: string;

  @ApiPropertyOptional({ description: '第二专业' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  secondMajor?: string;
}
