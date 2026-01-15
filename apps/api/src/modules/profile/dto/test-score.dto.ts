import {
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  IsObject,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const TEST_TYPES = ['SAT', 'ACT', 'TOEFL', 'IELTS', 'AP', 'IB'] as const;

export class CreateTestScoreDto {
  @ApiProperty({ enum: TEST_TYPES, description: '考试类型' })
  @IsIn(TEST_TYPES)
  type: string;

  @ApiProperty({ description: '总分', example: 1500 })
  @IsInt()
  @Type(() => Number)
  @Min(0)
  @Max(2000)
  score: number;

  @ApiPropertyOptional({
    description: '分项成绩',
    example: { reading: 750, math: 750 },
  })
  @IsOptional()
  @IsObject()
  subScores?: Record<string, number>;

  @ApiPropertyOptional({ description: '考试日期' })
  @IsOptional()
  @IsDateString()
  testDate?: string;
}

export class UpdateTestScoreDto {
  @ApiPropertyOptional({ enum: TEST_TYPES })
  @IsOptional()
  @IsIn(TEST_TYPES)
  type?: string;

  @ApiPropertyOptional({ description: '总分' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  @Max(2000)
  score?: number;

  @ApiPropertyOptional({ description: '分项成绩' })
  @IsOptional()
  @IsObject()
  subScores?: Record<string, number>;

  @ApiPropertyOptional({ description: '考试日期' })
  @IsOptional()
  @IsDateString()
  testDate?: string;
}
