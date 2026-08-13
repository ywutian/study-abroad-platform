import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsIn,
  Min,
  MaxLength,
} from 'class-validator';
import { APPLICATION_ROUND_VALUES } from '@study-abroad/shared';

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

  @ApiProperty({
    description: 'Round',
    enum: APPLICATION_ROUND_VALUES,
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([...APPLICATION_ROUND_VALUES])
  @MaxLength(20)
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

  @ApiPropertyOptional({
    description: 'Interview format (e.g. ALUMNI, INITIALVIEW, VERICANT)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  interviewFormat?: string;

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

  @ApiPropertyOptional({
    description: 'Interview format (e.g. ALUMNI, INITIALVIEW, VERICANT)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  interviewFormat?: string;

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
