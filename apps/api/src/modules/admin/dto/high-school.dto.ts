import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { HighSchoolType } from '@prisma/client';

export class CreateHighSchoolDto {
  @ApiProperty({ description: 'School name in English', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'School name in Chinese',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameZh?: string;

  @ApiPropertyOptional({
    description: 'Abbreviation or short name',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  abbreviation?: string;

  @ApiProperty({
    description: 'Country where the school is located',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

  @ApiPropertyOptional({ description: 'State or province', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'City', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ description: 'High school type', enum: HighSchoolType })
  @IsEnum(HighSchoolType)
  type: HighSchoolType;

  @ApiPropertyOptional({
    description: 'Overall tier rating (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tier?: number;

  @ApiPropertyOptional({
    description: 'Recognition score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  recognition?: number;

  @ApiPropertyOptional({
    description: 'Academic rigor score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  academicRigor?: number;

  @ApiPropertyOptional({
    description: 'Placement record score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  placementRecord?: number;

  @ApiPropertyOptional({
    description: 'Student quality score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  studentQuality?: number;

  @ApiPropertyOptional({
    description: 'Resources score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  resources?: number;

  @ApiPropertyOptional({
    description: 'Grade inflation tendency',
    maxLength: 50,
    example: 'neutral',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gradeInflation?: string;

  @ApiPropertyOptional({
    description: 'Average SAT score',
    minimum: 400,
    maximum: 1600,
  })
  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(1600)
  avgSatScore?: number;

  @ApiPropertyOptional({
    description: 'Average IB score',
    minimum: 1,
    maximum: 45,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(45)
  avgIbScore?: number;

  @ApiPropertyOptional({
    description: 'Annual number of students admitted to top 30 universities',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  annualTop30Count?: number;

  @ApiPropertyOptional({
    description: 'Annual number of college applicants',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  annualApplicants?: number;

  @ApiPropertyOptional({ description: 'School website URL', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ description: 'School description', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Admin evaluation notes',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  evaluationNotes?: string;
}

export class UpdateHighSchoolDto {
  @ApiPropertyOptional({
    description: 'School name in English',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'School name in Chinese',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nameZh?: string;

  @ApiPropertyOptional({
    description: 'Abbreviation or short name',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  abbreviation?: string;

  @ApiPropertyOptional({
    description: 'Country where the school is located',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ description: 'State or province', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'City', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'High school type',
    enum: HighSchoolType,
  })
  @IsOptional()
  @IsEnum(HighSchoolType)
  type?: HighSchoolType;

  @ApiPropertyOptional({
    description: 'Overall tier rating (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tier?: number;

  @ApiPropertyOptional({
    description: 'Recognition score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  recognition?: number;

  @ApiPropertyOptional({
    description: 'Academic rigor score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  academicRigor?: number;

  @ApiPropertyOptional({
    description: 'Placement record score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  placementRecord?: number;

  @ApiPropertyOptional({
    description: 'Student quality score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  studentQuality?: number;

  @ApiPropertyOptional({
    description: 'Resources score (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  resources?: number;

  @ApiPropertyOptional({
    description: 'Grade inflation tendency',
    maxLength: 50,
    example: 'neutral',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gradeInflation?: string;

  @ApiPropertyOptional({
    description: 'Average SAT score',
    minimum: 400,
    maximum: 1600,
  })
  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(1600)
  avgSatScore?: number;

  @ApiPropertyOptional({
    description: 'Average IB score',
    minimum: 1,
    maximum: 45,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(45)
  avgIbScore?: number;

  @ApiPropertyOptional({
    description: 'Annual number of students admitted to top 30 universities',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  annualTop30Count?: number;

  @ApiPropertyOptional({
    description: 'Annual number of college applicants',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  annualApplicants?: number;

  @ApiPropertyOptional({ description: 'School website URL', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ description: 'School description', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Admin evaluation notes',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  evaluationNotes?: string;
}

export class HighSchoolQueryDto {
  @ApiPropertyOptional({
    description: 'Search by name or abbreviation',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by country', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by state or province',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    description: 'Filter by high school type',
    enum: HighSchoolType,
  })
  @IsOptional()
  @IsEnum(HighSchoolType)
  type?: HighSchoolType;

  @ApiPropertyOptional({
    description: 'Filter by tier (1–5)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  tier?: number;

  @ApiPropertyOptional({
    description: 'Filter for schools needing re-evaluation',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needsReview?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;
}

export class SuggestHighSchoolDto {
  @ApiProperty({ description: 'Suggested school name', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Country where the school is located',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country: string;

  @ApiPropertyOptional({ description: 'State or province', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'City', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}

export class BatchImportHighSchoolDto {
  @ApiProperty({
    description: 'Array of high school data to import',
    type: [CreateHighSchoolDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateHighSchoolDto)
  schools: CreateHighSchoolDto[];
}

export class ApproveSuggestionDto {
  @ApiProperty({
    description: 'High school type to assign',
    enum: HighSchoolType,
  })
  @IsEnum(HighSchoolType)
  type: HighSchoolType;

  @ApiPropertyOptional({
    description:
      'If set, merge the suggestion into an existing high school instead of creating a new one',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  mergeIntoId?: string;
}
