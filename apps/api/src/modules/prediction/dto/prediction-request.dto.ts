import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsString,
  IsOptional,
  IsNotEmpty,
  ArrayMaxSize,
  ArrayMinSize,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MAX_SCHOOLS_PER_BATCH } from '@study-abroad/shared';

export class PredictionRequestDto {
  @ApiProperty({
    description: '目标学校ID列表',
    example: ['school-id-1', 'school-id-2'],
    type: [String],
    minItems: 1,
    maxItems: MAX_SCHOOLS_PER_BATCH,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SCHOOLS_PER_BATCH)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsNotEmpty({ each: true })
  schoolIds: string[];

  @ApiProperty({
    description: '是否强制刷新缓存',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class PredictionPreviewScenarioDto {
  @ApiProperty({
    description: 'Simulated GPA value',
    required: false,
    minimum: 0,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa?: number;

  @ApiProperty({
    description: 'Simulated GPA scale',
    required: false,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  gpaScale?: number;

  @ApiProperty({
    description: 'Simulated SAT total score',
    required: false,
    minimum: 400,
    maximum: 1600,
  })
  @IsOptional()
  @IsNumber()
  @Min(400)
  @Max(1600)
  satScore?: number;

  @ApiProperty({
    description: 'Simulated ACT composite score',
    required: false,
    minimum: 1,
    maximum: 36,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(36)
  actScore?: number;

  @ApiProperty({ description: 'Simulated target major', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetMajor?: string;

  @ApiProperty({ description: 'Simulated applicant grade', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  grade?: string;

  @ApiProperty({
    description: 'Whether the simulated run should apply test optional',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  applyingTestOptional?: boolean;

  @ApiProperty({
    description: 'Simulated application round',
    required: false,
    enum: ['RD', 'ED', 'ED2', 'EA', 'REA', 'SCEA', 'ROLLING'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['RD', 'ED', 'ED2', 'EA', 'REA', 'SCEA', 'ROLLING'])
  @MaxLength(20)
  applicationRound?: string;
}

export class PredictionPreviewRequestDto {
  @ApiProperty({
    description: 'School IDs to simulate against',
    type: [String],
    minItems: 1,
    maxItems: MAX_SCHOOLS_PER_BATCH,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SCHOOLS_PER_BATCH)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @IsNotEmpty({ each: true })
  schoolIds: string[];

  @ApiProperty({
    description: 'Optional what-if scenario. This does not mutate the profile.',
    required: false,
    type: () => PredictionPreviewScenarioDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PredictionPreviewScenarioDto)
  scenario?: PredictionPreviewScenarioDto;
}

export class PredictionExplanationStreamRequestDto {
  @ApiProperty({
    description: 'Whether to ignore any cached explanation and regenerate',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  refresh?: boolean;
}

export class PredictionPortfolioSummaryStreamRequestDto {
  @ApiProperty({
    description: 'Prediction result IDs to summarize',
    required: false,
    type: [String],
    maxItems: MAX_SCHOOLS_PER_BATCH,
  })
  @IsOptional()
  @IsArray()
  // Single-sourced with the batch roster cap (same constant as schoolIds above):
  // the FE portfolio roster is derived from the MAX_SCHOOLS_PER_BATCH-bounded
  // results list, so the two caps must not drift (the #396/#397 silent-400 class).
  @ArrayMaxSize(MAX_SCHOOLS_PER_BATCH)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  predictionResultIds?: string[];

  @ApiProperty({
    description: 'Whether to ignore any cached summary and regenerate',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  refresh?: boolean;
}
