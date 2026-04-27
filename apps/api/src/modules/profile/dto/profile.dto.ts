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
  @ApiPropertyOptional({ description: 'Real name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  realName?: string;

  @ApiPropertyOptional({ description: 'GPA', example: 3.85 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  @Max(100)
  gpa?: number;

  @ApiPropertyOptional({ description: 'GPA scale maximum', example: 4.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @IsIn([4.0, 5.0, 6, 45, 100])
  gpaScale?: number;

  @ApiPropertyOptional({ description: 'Current school' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentSchool?: string;

  @ApiPropertyOptional({ description: 'School type' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentSchoolType?: string;

  @ApiPropertyOptional({ enum: GRADES, description: 'Grade levels' })
  @IsOptional()
  @IsIn(GRADES)
  grade?: string;

  @ApiPropertyOptional({ description: 'Target major' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetMajor?: string;

  @ApiPropertyOptional({ description: 'Region preference', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regionPref?: string[];

  @ApiPropertyOptional({ enum: BudgetTier, description: 'Budget tier' })
  @IsOptional()
  @IsEnum(BudgetTier)
  budgetTier?: BudgetTier;

  @ApiPropertyOptional({ enum: APP_ROUNDS, description: 'Application round' })
  @IsOptional()
  @IsIn(APP_ROUNDS)
  applicationRound?: string;

  @ApiPropertyOptional({ enum: Visibility, description: 'Visibility' })
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

  @ApiPropertyOptional({
    enum: EducationSystem,
    description: 'Education system',
  })
  @IsOptional()
  @IsEnum(EducationSystem)
  educationSystem?: EducationSystem;

  @ApiPropertyOptional({ description: 'Whether financial aid is needed' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  needsFinancialAid?: boolean;

  @ApiPropertyOptional({
    description: 'Whether first-generation college student',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  firstGeneration?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the student is a recruited athlete',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  recruitedAthlete?: boolean;

  @ApiPropertyOptional({
    description: 'Legacy (alumni children)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  legacy?: string[];

  @ApiPropertyOptional({ description: 'Intended major' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  intendedMajor?: string;

  @ApiPropertyOptional({ description: 'Second major' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  secondMajor?: string;
}
