import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsIn,
  IsObject,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import {
  BudgetTier,
  EducationSystem,
  SchoolTier,
  TestType,
} from '@prisma/client';

const GRADES = [
  'FRESHMAN',
  'SOPHOMORE',
  'JUNIOR',
  'SENIOR',
  'GAP_YEAR',
] as const;
const APP_ROUNDS = ['ED', 'ED2', 'EA', 'REA', 'RD'] as const;
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

export class OnboardingProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  realName?: string;

  @ApiPropertyOptional({ enum: GRADES })
  @IsOptional()
  @IsIn(GRADES)
  grade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentSchool?: string;

  @ApiPropertyOptional({ enum: EducationSystem })
  @IsOptional()
  @IsEnum(EducationSystem)
  educationSystem?: EducationSystem;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  nationality?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  countryOfResidence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  citizenship?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetMajor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  intendedMajor?: string;

  @ApiPropertyOptional({ enum: APP_ROUNDS })
  @IsOptional()
  @IsIn(APP_ROUNDS)
  applicationRound?: string;

  @ApiPropertyOptional({ enum: BudgetTier })
  @IsOptional()
  @IsEnum(BudgetTier)
  budgetTier?: BudgetTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  needsFinancialAid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  applyingTestOptional?: boolean;

  @ApiPropertyOptional({ example: 3.85 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @Min(0)
  @Max(100)
  gpa?: number;

  @ApiPropertyOptional({ example: 4.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  @IsIn([4.0, 5.0, 6, 45, 100])
  gpaScale?: number;
}

export class OnboardingTestScoreDto {
  @ApiProperty({ enum: TestType })
  @IsEnum(TestType)
  type: TestType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  score: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  subScores?: Record<string, number | string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  testDate?: string;
}

export class OnboardingActivityDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: ACTIVITY_CATEGORIES })
  @IsIn(ACTIVITY_CATEGORIES)
  category: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  role: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(40)
  hoursPerWeek?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(52)
  weeksPerYear?: number;
}

export class OnboardingAwardDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: AWARD_LEVELS })
  @IsIn(AWARD_LEVELS)
  level: string;

  @ApiPropertyOptional({ enum: AWARD_CATEGORIES })
  @IsOptional()
  @IsIn(AWARD_CATEGORIES)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(2000)
  @Max(2030)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class OnboardingTargetSchoolDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  schoolId: string;

  @ApiPropertyOptional({ enum: APP_ROUNDS })
  @IsOptional()
  @IsIn(APP_ROUNDS)
  round?: string;

  @ApiPropertyOptional({ enum: SchoolTier, default: SchoolTier.TARGET })
  @IsOptional()
  @IsEnum(SchoolTier)
  tier?: SchoolTier;
}

export class OnboardingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingProfileDto)
  profile?: OnboardingProfileDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  realName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthday?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @ApiPropertyOptional({ type: [OnboardingTestScoreDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => OnboardingTestScoreDto)
  testScores?: OnboardingTestScoreDto[];

  @ApiPropertyOptional({ type: [OnboardingActivityDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => OnboardingActivityDto)
  activities?: OnboardingActivityDto[];

  @ApiPropertyOptional({ type: [OnboardingAwardDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => OnboardingAwardDto)
  awards?: OnboardingAwardDto[];

  @ApiPropertyOptional({ type: [OnboardingTargetSchoolDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OnboardingTargetSchoolDto)
  targetSchools?: OnboardingTargetSchoolDto[];
}

export class ProfileGradeResponseDto {
  @ApiProperty()
  overallScore: number;

  @ApiProperty()
  admissionPrediction: string;

  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  weaknesses: string[];

  @ApiProperty({ type: [String] })
  improvements: string[];

  @ApiProperty({ type: [String] })
  recommendedActivities: string[];

  @ApiProperty()
  timeline: Array<{ date: string; task: string }>;

  @ApiProperty()
  projectedImprovement: number;
}
