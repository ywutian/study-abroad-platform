import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CASE_VISIBILITY_ALLOWED } from '../../../common/constants/prisma-selects';

export class BatchImportCaseItemDto {
  @ApiProperty({
    description: 'School name (supports abbreviations like MIT, Stanford)',
  })
  @IsString()
  @MaxLength(200)
  school: string;

  @ApiPropertyOptional({ description: 'Applied major' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  major?: string;

  @ApiProperty({ description: 'Application year', example: 2025 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({ description: 'Application round (ED/EA/RD, etc.)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  round?: string;

  @ApiProperty({
    description:
      'Admission result (supports Chinese and English abbreviations)',
  })
  @IsString()
  @MaxLength(200)
  result: string;

  @ApiPropertyOptional({ description: 'GPA or range', example: '3.9-4.0' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  gpa?: string;

  @ApiPropertyOptional({
    description: 'SAT score or range',
    example: '1550-1600',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sat?: string;

  @ApiPropertyOptional({ description: 'ACT score or range' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  act?: string;

  @ApiPropertyOptional({ description: 'TOEFL score or range' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  toefl?: string;

  @ApiPropertyOptional({
    description: 'Tags, semicolon-separated',
    example: 'research;olympiad',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;

  @ApiPropertyOptional({ description: 'Essay type' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  essayType?: string;

  @ApiPropertyOptional({ description: 'Essay prompt' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  essayPrompt?: string;

  @ApiPropertyOptional({ description: 'Essay content' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  essayContent?: string;

  // ============ Enrichment fields (structured JSON or semicolon-separated text) ============

  @ApiPropertyOptional({ description: 'AP course count' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  apCount?: number;

  @ApiPropertyOptional({
    description: 'AP subjects, semicolon-separated',
    example: 'Calculus BC;Physics C;Chemistry',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apSubjects?: string;

  @ApiPropertyOptional({ description: 'IB total score' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(45)
  ibScore?: number;

  @ApiPropertyOptional({
    description: 'High school type',
    example: 'PUBLIC_US',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  highSchoolType?: string;

  @ApiPropertyOptional({ description: 'Curriculum system', example: 'AP' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  curriculum?: string;

  @ApiPropertyOptional({
    description: 'Demographic tags, semicolon-separated',
    example: 'international;first_gen',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  demographicTags?: string;

  @ApiPropertyOptional({
    description: 'Activities list, semicolon-separated',
    example: 'Research - MIT PRIMES; Club - Debate Captain',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  activities?: string;

  @ApiPropertyOptional({
    description: 'Awards list, semicolon-separated',
    example: 'USAMO Qualifier; Intel ISEF Finalist',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  awards?: string;

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
}

export class BatchImportCaseDto {
  @ApiProperty({
    type: [BatchImportCaseItemDto],
    description: 'Batch import data',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchImportCaseItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  items: BatchImportCaseItemDto[];

  @ApiPropertyOptional({
    enum: CASE_VISIBILITY_ALLOWED,
    description: '默认Visibility',
    default: 'ANONYMOUS',
  })
  @IsOptional()
  // See create-case.dto.ts: PUBLIC is retired for cases, and the enum keeps it
  // for `Profile.visibility`, so validating against the enum would still let it
  // through here.
  @IsIn(CASE_VISIBILITY_ALLOWED as readonly string[])
  visibility?: (typeof CASE_VISIBILITY_ALLOWED)[number];

  @ApiPropertyOptional({
    description: 'Whether to auto-mark as verified',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoVerify?: boolean;
}

export class ReviewCaseEssayDto {
  @ApiProperty({
    enum: ['APPROVE', 'REJECT'],
    description: 'Review action',
  })
  @IsString()
  @MaxLength(200)
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ description: 'Rejection reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BatchVerifyCaseDto {
  @ApiProperty({ description: 'Case ID list' })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMinSize(1)
  ids: string[];

  @ApiProperty({
    enum: ['APPROVE', 'REJECT'],
    description: 'Review action',
  })
  @IsString()
  @MaxLength(200)
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ description: 'Reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
