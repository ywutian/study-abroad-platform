import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsObject,
  IsInt,
  IsBoolean,
  MaxLength,
  ArrayMaxSize,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DataType, StagingStatus } from '@prisma/client';
import {
  CaseTestScoreDto,
  CaseActivityDto,
  CaseAwardDto,
} from '../../case/dto/create-case.dto';

export class ReviewApproveDto {
  @ApiPropertyOptional({ description: 'Optional note' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReviewRejectDto {
  @ApiProperty({ description: 'Rejection reason' })
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class CorrectedCaseDataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  round?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  major?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  gpa?: { range: string; scale?: number };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  sat?: { range: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  act?: { range: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  toefl?: { range: string };

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tags?: string[];

  // --- New enrichment fields ---

  @ApiPropertyOptional({ description: 'Detailed test scores' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseTestScoreDto)
  testScores?: CaseTestScoreDto[];

  @ApiPropertyOptional({ description: 'Extracurricular activities' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseActivityDto)
  activities?: CaseActivityDto[];

  @ApiPropertyOptional({ description: 'Awards and honors' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CaseAwardDto)
  awards?: CaseAwardDto[];

  @ApiPropertyOptional({ description: 'Number of AP courses taken' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  apCount?: number;

  @ApiPropertyOptional({ description: 'AP subject names' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  apSubjects?: string[];

  @ApiPropertyOptional({ description: 'IB total score (0-45)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(45)
  ibScore?: number;

  @ApiPropertyOptional({ description: 'Whether IB score is predicted' })
  @IsOptional()
  @IsBoolean()
  ibPredicted?: boolean;

  @ApiPropertyOptional({ description: 'Type of high school' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  highSchoolType?: string;

  @ApiPropertyOptional({
    description: 'Curriculum type (e.g., AP, IB, A-Level)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  curriculumType?: string;

  @ApiPropertyOptional({ description: 'Demographic tags' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  demographicTags?: string[];

  @ApiPropertyOptional({ description: 'Financial aid status' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  financialAid?: string;

  @ApiPropertyOptional({ description: 'Enrollment status' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  enrollmentStatus?: string;

  @ApiPropertyOptional({ description: 'Applicant narrative / essay context' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  narrative?: string;
}

export class ReviewEditAndApproveDto {
  @ApiProperty({ description: 'Corrected case data (whitelisted fields only)' })
  @IsObject()
  @ValidateNested()
  @Type(() => CorrectedCaseDataDto)
  correctedData: CorrectedCaseDataDto;

  @ApiPropertyOptional({ description: 'Optional note' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReviewBatchDto {
  @ApiProperty({ description: 'IDs to process (max 500)' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({ enum: ['approve', 'reject'], description: 'Batch action' })
  @IsEnum(['approve', 'reject'] as const)
  action: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'Reason (for reject)' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ReviewQueueQueryDto {
  @ApiPropertyOptional({ enum: DataType })
  @IsOptional()
  @IsEnum(DataType)
  type?: DataType;

  @ApiPropertyOptional({ enum: StagingStatus })
  @IsOptional()
  @IsEnum(StagingStatus)
  status?: StagingStatus;

  @ApiPropertyOptional({ description: 'Filter by source' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
