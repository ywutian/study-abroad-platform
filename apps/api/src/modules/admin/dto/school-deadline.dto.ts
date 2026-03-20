import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateSchoolDeadlineDto {
  @ApiProperty({ description: 'School ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  schoolId: string;

  @ApiProperty({
    description: 'Application cycle year, e.g. 2026 means Fall 2026 enrollment',
  })
  @IsInt()
  @Min(2020)
  year: number;

  @ApiProperty({ description: 'Round: ED, ED2, EA, REA, RD, Rolling' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  round: string;

  @ApiProperty({ description: 'Application deadline' })
  @IsDateString()
  applicationDeadline: string;

  @ApiPropertyOptional({ description: 'Financial aid deadline' })
  @IsDateString()
  @IsOptional()
  financialAidDeadline?: string;

  @ApiPropertyOptional({ description: 'Decision release date' })
  @IsDateString()
  @IsOptional()
  decisionDate?: string;

  @ApiPropertyOptional({
    description: 'Essay prompt JSON [{prompt, wordLimit, required}]',
  })
  @IsOptional()
  essayPrompts?: any;

  @ApiPropertyOptional({ description: 'Number of essays' })
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

  @ApiPropertyOptional({ description: 'Application fee (USD)' })
  @IsInt()
  @IsOptional()
  applicationFee?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MaxLength(5000)
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
  @MaxLength(5000)
  notes?: string;
}
