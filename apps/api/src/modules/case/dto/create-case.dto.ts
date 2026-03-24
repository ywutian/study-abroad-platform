import {
  IsString,
  IsInt,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  IsObject,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdmissionResult,
  Visibility,
  EssayType,
  HighSchoolType,
  EducationSystem,
} from '@prisma/client';

// ============ Nested Validation Classes ============

export class CaseTestScoreDto {
  @ApiProperty({ enum: ['SAT', 'ACT', 'TOEFL', 'IELTS', 'AP', 'IB'] })
  @IsEnum(['SAT', 'ACT', 'TOEFL', 'IELTS', 'AP', 'IB'] as const, {
    message: 'type must be one of: SAT, ACT, TOEFL, IELTS, AP, IB',
  })
  type: 'SAT' | 'ACT' | 'TOEFL' | 'IELTS' | 'AP' | 'IB';

  @ApiProperty({ description: 'Test score', example: 1550 })
  @IsInt()
  @Min(0)
  @Max(2000)
  score: number;

  @ApiPropertyOptional({
    description: 'Sub-scores',
    example: { math: 800, reading: 750 },
  })
  @IsOptional()
  @IsObject()
  subscores?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Test date (ISO8601)' })
  @IsOptional()
  @IsDateString()
  testDate?: string;
}

export class CaseActivityDto {
  @ApiPropertyOptional({ description: 'Activity category' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiProperty({ description: 'Activity description' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({ description: 'Role in activity' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string;

  @ApiPropertyOptional({ description: 'Activity tier (1=highest)', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  tier?: 1 | 2 | 3 | 4;

  @ApiPropertyOptional({ description: 'Hours per week' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(80)
  hoursPerWeek?: number;

  @ApiPropertyOptional({ description: 'Weeks per year' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(52)
  weeksPerYear?: number;
}

export class CaseAwardDto {
  @ApiProperty({ description: 'Award name' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    enum: ['school', 'regional', 'state', 'national', 'international'],
  })
  @IsEnum(['school', 'regional', 'state', 'national', 'international'] as const)
  level: 'school' | 'regional' | 'state' | 'national' | 'international';

  @ApiPropertyOptional({ description: 'Competition name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  competition?: string;

  @ApiPropertyOptional({
    description: 'Competition tier (1=highest)',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tier?: 1 | 2 | 3 | 4 | 5;

  @ApiPropertyOptional({ description: 'Award year' })
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

// ============ Main DTO ============

export class CreateCaseDto {
  @ApiProperty({ description: 'School ID' })
  @IsString()
  @MaxLength(200)
  schoolId: string;

  @ApiProperty({ description: 'Application year', example: 2025 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({ description: 'Application round', example: 'ED' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  round?: string;

  @ApiProperty({ enum: AdmissionResult, description: 'Admission result' })
  @IsEnum(AdmissionResult)
  result: AdmissionResult;

  @ApiPropertyOptional({ description: 'Major applied to' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  major?: string;

  @ApiPropertyOptional({ description: 'GPA range', example: '3.7-3.9' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+\.?\d*-\d+\.?\d*$/, {
    message: 'GPA range must be in format "X.X-X.X"',
  })
  gpaRange?: string;

  @ApiPropertyOptional({ description: 'Grade 9 GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa9?: number;

  @ApiPropertyOptional({ description: 'Grade 10 GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa10?: number;

  @ApiPropertyOptional({ description: 'Grade 11 GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa11?: number;

  @ApiPropertyOptional({ description: 'Grade 12 GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa12?: number;

  @ApiPropertyOptional({ description: 'UC capped weighted GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  ucCappedGpa?: number;

  @ApiPropertyOptional({ description: 'UC uncapped weighted GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  ucUncappedGpa?: number;

  @ApiPropertyOptional({ description: 'GPA scale (4.0, 5.0, or 100)' })
  @IsOptional()
  @IsNumber()
  gpaScale?: number;

  @ApiPropertyOptional({ description: 'SAT score range', example: '1500-1550' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+-\d+$/, { message: 'SAT range must be in format "XXXX-XXXX"' })
  satRange?: string;

  @ApiPropertyOptional({ description: 'ACT score range' })
  @IsOptional()
  @MaxLength(100)
  @IsString()
  @Matches(/^\d+-\d+$/, { message: 'ACT range must be in format "XX-XX"' })
  actRange?: string;

  @ApiPropertyOptional({ description: 'TOEFL score range' })
  @IsOptional()
  @MaxLength(100)
  @IsString()
  @Matches(/^\d+-\d+$/, { message: 'TOEFL range must be in format "XXX-XXX"' })
  toeflRange?: string;

  @ApiPropertyOptional({
    description: 'Tags for the case',
    example: ['strong_research', 'legacy'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description:
      'Activity list, one per line (e.g. "Research - XX Lab", "Contest - AMC 12")',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  activityList?: string;

  // ============ Structured Enrichment Fields ============

  @ApiPropertyOptional({
    type: [CaseTestScoreDto],
    description: 'Structured test scores',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseTestScoreDto)
  testScores?: CaseTestScoreDto[];

  @ApiPropertyOptional({
    type: [CaseActivityDto],
    description: 'Structured activities',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseActivityDto)
  activities?: CaseActivityDto[];

  @ApiPropertyOptional({
    type: [CaseAwardDto],
    description: 'Structured awards',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseAwardDto)
  awards?: CaseAwardDto[];

  @ApiPropertyOptional({ description: 'AP course count' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  apCount?: number;

  @ApiPropertyOptional({
    description: 'AP subjects taken',
    example: ['Calculus BC', 'Physics C'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  apSubjects?: string[];

  @ApiPropertyOptional({ description: 'IB total score' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(45)
  ibScore?: number;

  @ApiPropertyOptional({ description: 'IB predicted score' })
  @IsOptional()
  @IsBoolean()
  ibPredicted?: boolean;

  @ApiPropertyOptional({
    description: 'High school ID (from HighSchool database)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  highSchoolId?: string;

  @ApiPropertyOptional({
    enum: HighSchoolType,
    description: 'High school type',
  })
  @IsOptional()
  @IsEnum(HighSchoolType)
  highSchoolType?: HighSchoolType;

  @ApiPropertyOptional({
    enum: EducationSystem,
    description: 'Curriculum type',
  })
  @IsOptional()
  @IsEnum(EducationSystem)
  curriculumType?: EducationSystem;

  @ApiPropertyOptional({
    description: 'Demographic tags',
    example: ['international', 'first_gen'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  demographicTags?: string[];

  @ApiPropertyOptional({
    description: 'Applicant nationality',
    example: 'China',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @ApiPropertyOptional({
    description: 'Financial aid status',
    example: 'full_ride',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  financialAid?: string;

  @ApiPropertyOptional({
    description: 'Enrollment status',
    example: 'enrolled',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  enrollmentStatus?: string;

  @ApiPropertyOptional({ description: 'Application narrative/story' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  narrative?: string;

  @ApiPropertyOptional({ enum: Visibility, default: Visibility.PRIVATE })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  // ============ Essay Fields ============
  @ApiPropertyOptional({ enum: EssayType, description: 'Essay type' })
  @IsOptional()
  @IsEnum(EssayType)
  essayType?: EssayType;

  @ApiPropertyOptional({ description: 'Essay prompt/question' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  essayPrompt?: string;

  @ApiPropertyOptional({ description: 'Essay content' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  essayContent?: string;

  @ApiPropertyOptional({
    description: 'Prompt number (for Common App 1-7, UC PIQ 1-4)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  promptNumber?: number;
}
