import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BackfillDistillationRollupsDto {
  @ApiProperty({ required: false, description: 'ISO date string (inclusive)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  startDate?: string;

  @ApiProperty({ required: false, description: 'ISO date string (inclusive)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  endDate?: string;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolId?: string;

  @ApiProperty({ required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cohortKey?: string;
}

export class LoadCdsBandRowDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  schoolName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  schoolNameNorm?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  gpaBand: string;

  @ApiProperty()
  @IsString()
  @MaxLength(16)
  testType: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  testBand?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  admitRate: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sampleCount?: number;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  cycleYear: number;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  source: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;
}

export class LoadCdsBandsDto {
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiProperty({ type: [LoadCdsBandRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoadCdsBandRowDto)
  rows: LoadCdsBandRowDto[];
}

export class BackfillCaseAggregatesDto {
  @ApiProperty({
    required: false,
    default: true,
    description:
      'When true, compute aggregations and return counts/preview without writing to predictionSourceObservation.',
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiProperty({
    required: false,
    default: 5,
    minimum: 1,
    maximum: 100,
    description:
      'Minimum cases per (teacher, school, bucket) cell before an aggregate is emitted.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  minSamples?: number;

  @ApiProperty({
    required: false,
    description:
      'Custom setVersion (sourceVersion column). Defaults to "case-aggregate-teachers-YYYY-MM-DD".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  // Only allow setVersion strings that match the case-aggregate-teachers prefix —
  // prevents overwriting other source versions (e.g. cohort-prior backfill rows)
  // even if a typo'd name happens to collide.
  @Matches(/^case-aggregate-teachers(-[\w.-]+)?$/i)
  setVersion?: string;
}
