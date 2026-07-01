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
  ArrayMaxSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { BudgetTier, EducationSystem, Visibility } from '@prisma/client';
import {
  APPLICATION_ROUND_VALUES,
  normalizeApplicationRound,
  MAX_LEGACY_AFFILIATIONS,
  MAX_REGION_PREFERENCES,
} from '@study-abroad/shared';

const GRADES = [
  'FRESHMAN',
  'SOPHOMORE',
  'JUNIOR',
  'SENIOR',
  'GAP_YEAR',
] as const;
function nullableNumberTransform({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  return Number(value);
}

function applicationRoundTransform({ value }: { value: unknown }) {
  if (typeof value !== 'string') return value;
  return normalizeApplicationRound(value) ?? value;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Real name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  realName?: string;

  @ApiPropertyOptional({
    description: 'GPA (unweighted)',
    example: 3.85,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Transform(nullableNumberTransform)
  @Min(0)
  @Max(100)
  gpa?: number | null;

  @ApiPropertyOptional({
    description: 'Weighted GPA (AP/Honors bonus, may exceed the scale)',
    example: 4.32,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Transform(nullableNumberTransform)
  @Min(0)
  @Max(110)
  weightedGpa?: number | null;

  @ApiPropertyOptional({ description: 'GPA scale maximum', example: 4.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @IsIn([4.0, 5.0, 6, 45, 100])
  gpaScale?: number;

  @ApiPropertyOptional({
    description: 'Grade 9 GPA',
    example: 3.85,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Transform(nullableNumberTransform)
  @Min(0)
  @Max(100)
  gpa9?: number | null;

  @ApiPropertyOptional({
    description: 'Grade 10 GPA',
    example: 3.9,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Transform(nullableNumberTransform)
  @Min(0)
  @Max(100)
  gpa10?: number | null;

  @ApiPropertyOptional({
    description: 'Grade 11 GPA',
    example: 3.95,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Transform(nullableNumberTransform)
  @Min(0)
  @Max(100)
  gpa11?: number | null;

  @ApiPropertyOptional({
    description: 'Grade 12 GPA',
    example: 4.0,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Transform(nullableNumberTransform)
  @Min(0)
  @Max(100)
  gpa12?: number | null;

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
  @ArrayMaxSize(MAX_REGION_PREFERENCES)
  regionPref?: string[];

  @ApiPropertyOptional({ enum: BudgetTier, description: 'Budget tier' })
  @IsOptional()
  @IsEnum(BudgetTier)
  budgetTier?: BudgetTier;

  @ApiPropertyOptional({
    enum: APPLICATION_ROUND_VALUES,
    description: 'Application round',
  })
  @IsOptional()
  @Transform(applicationRoundTransform)
  @IsIn(APPLICATION_ROUND_VALUES)
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
    description:
      'Whether the student is applying test-optional (no SAT/ACT submitted). Used by counselor to apply 0.85× modifier at <20% admit schools per Common App data.',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  applyingTestOptional?: boolean;

  @ApiPropertyOptional({
    description: 'Legacy (alumni children)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMaxSize(MAX_LEGACY_AFFILIATIONS)
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
