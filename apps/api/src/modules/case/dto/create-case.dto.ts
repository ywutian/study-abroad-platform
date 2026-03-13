import {
  IsString,
  IsInt,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  Min,
  Max,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdmissionResult, Visibility, EssayType } from '@prisma/client';

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
