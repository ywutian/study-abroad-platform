import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsArray,
  IsString,
  IsNumber,
  IsEnum,
  ArrayMaxSize,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export enum BudgetRange {
  LOW = 'low', // < $30k/年
  MEDIUM = 'medium', // $30k - $60k/年
  HIGH = 'high', // $60k - $80k/年
  UNLIMITED = 'unlimited', // 不限
}

export class SchoolRecommendationRequestDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Preferred regions (e.g. California, New York)',
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMaxSize(10)
  preferredRegions?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Intended major',
    maxItems: 10,
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  preferredMajors?: string[];

  @ApiPropertyOptional({ enum: BudgetRange, description: 'Budget range' })
  @IsEnum(BudgetRange)
  @IsOptional()
  budget?: BudgetRange;

  @ApiPropertyOptional({
    description: 'Target school count (default 15, max 30)',
    minimum: 5,
    maximum: 30,
  })
  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(30)
  schoolCount?: number;

  @ApiPropertyOptional({
    description: 'Additional preference notes (max 500 characters)',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  additionalPreferences?: string;
}

export class RecommendedSchoolDto {
  @ApiProperty()
  schoolId?: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty({ enum: ['reach', 'match', 'safety'] })
  tier: 'reach' | 'match' | 'safety';

  @ApiProperty({ description: 'Estimated admission probability 0-100' })
  estimatedProbability: number;

  @ApiProperty({ description: 'Fit score 0-100' })
  fitScore: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Recommended majors at this school based on student profile',
  })
  recommendedMajors?: string[];

  @ApiProperty({ type: [String], description: 'Recommendation reasons' })
  reasons: string[];

  @ApiProperty({
    type: [String],
    description: 'Points of concern',
    required: false,
  })
  concerns?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Data points supporting the recommendation (e.g., "US News #12", "5.2% acceptance rate")',
  })
  dataPoints?: string[];

  @ApiPropertyOptional({ description: 'Matched school metadata' })
  schoolMeta?: {
    nameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
    city?: string;
    state?: string;
    tuition?: number;
    isPrivate?: boolean;
    testOptional?: boolean;
    hasEarlyDecision?: boolean;
    retentionRate?: number;
    logoUrl?: string;
    website?: string;
    sourceUrls?: {
      collegeScorecardUrl?: string;
      ipedsUrl?: string;
      websiteUrl?: string;
    };
  };

  @ApiPropertyOptional({ description: 'Number of verified essay prompts' })
  essayPromptCount?: number;

  @ApiPropertyOptional({
    description: 'Whether the school has a Why School essay prompt',
  })
  hasWhySchool?: boolean;
}

export class RecommendationAnalysisDto {
  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  weaknesses: string[];

  @ApiProperty({ type: [String] })
  improvementTips: string[];
}

export class SummerProgramDto {
  @ApiProperty({ description: 'Program name' })
  name: string;

  @ApiProperty({ description: 'Why this program is recommended' })
  reason: string;
}

export class SchoolRecommendationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: [RecommendedSchoolDto] })
  recommendations: RecommendedSchoolDto[];

  @ApiProperty({ type: RecommendationAnalysisDto })
  analysis: RecommendationAnalysisDto;

  @ApiPropertyOptional({
    type: [SummerProgramDto],
    description: 'Recommended summer programs based on student profile',
  })
  summerPrograms?: SummerProgramDto[];

  @ApiProperty()
  summary: string;

  @ApiProperty()
  tokenUsed: number;

  @ApiProperty()
  createdAt: Date;
}
