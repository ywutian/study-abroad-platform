import {
  IsArray,
  IsBoolean,
  IsString,
  IsOptional,
  IsNotEmpty,
  ArrayMaxSize,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
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
