import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { TestType } from '@prisma/client';

export class OnboardingTestScoreDto {
  @ApiProperty({ enum: TestType })
  @IsEnum(TestType)
  type: TestType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  score: number;
}

export class OnboardingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  realName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  birthday?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  graduationDate?: string;

  @ApiPropertyOptional({ type: [OnboardingTestScoreDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingTestScoreDto)
  testScores?: OnboardingTestScoreDto[];
}

export class ProfileGradeResponseDto {
  @ApiProperty()
  overallScore: number;

  @ApiProperty()
  admissionPrediction: string;

  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  weaknesses: string[];

  @ApiProperty({ type: [String] })
  improvements: string[];

  @ApiProperty({ type: [String] })
  recommendedActivities: string[];

  @ApiProperty()
  timeline: Array<{ date: string; task: string }>;

  @ApiProperty()
  projectedImprovement: number;
}
