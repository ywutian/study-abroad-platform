import {
  IsInt,
  IsOptional,
  IsIn,
  IsObject,
  IsDateString,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const TEST_TYPES = [
  'SAT',
  'ACT',
  'TOEFL',
  'IELTS',
  'AP',
  'IB',
  'A_LEVEL',
  'IGCSE',
  'DUOLINGO',
] as const;

export class CreateTestScoreDto {
  @ApiProperty({ enum: TEST_TYPES, description: 'Test type' })
  @IsIn(TEST_TYPES)
  type: string;

  @ApiProperty({ description: 'Total score', example: 1500 })
  @IsInt()
  @Type(() => Number)
  @Min(0)
  @Max(2000)
  score: number;

  @ApiPropertyOptional({
    description:
      'Subject name for subject-based scores such as AP / IB / A-Level',
    example: 'Calculus BC',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({
    description: 'Sub-scores',
    example: { reading: 750, math: 750 },
  })
  @IsOptional()
  @IsObject()
  subScores?: Record<string, number | string>;

  @ApiPropertyOptional({ description: 'Test date' })
  @IsOptional()
  @IsDateString()
  testDate?: string;
}

export class UpdateTestScoreDto {
  @ApiPropertyOptional({ enum: TEST_TYPES })
  @IsOptional()
  @IsIn(TEST_TYPES)
  type?: string;

  @ApiPropertyOptional({ description: 'Total score' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  @Max(2000)
  score?: number;

  @ApiPropertyOptional({
    description:
      'Subject name for subject-based scores such as AP / IB / A-Level',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'Sub-scores' })
  @IsOptional()
  @IsObject()
  subScores?: Record<string, number | string>;

  @ApiPropertyOptional({ description: 'Test date' })
  @IsOptional()
  @IsDateString()
  testDate?: string;
}
