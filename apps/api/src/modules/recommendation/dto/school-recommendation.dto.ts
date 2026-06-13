import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  SchoolFieldSource,
  SchoolPublicMedia,
} from '@study-abroad/shared';
import {
  MAX_PREFERRED_REGIONS,
  MAX_PREFERRED_MAJORS,
} from '@study-abroad/shared';
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

export enum CampusPreference {
  SAFETY = 'safety',
  LIFE = 'life',
  FOOD = 'food',
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
  @ArrayMaxSize(MAX_PREFERRED_REGIONS)
  preferredRegions?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Intended major',
    maxItems: MAX_PREFERRED_MAJORS,
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMaxSize(MAX_PREFERRED_MAJORS)
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

  @ApiPropertyOptional({
    enum: CampusPreference,
    isArray: true,
    description:
      'Campus lifestyle preferences used for fit/tie-breakers, not admission probability',
  })
  @IsArray()
  @IsOptional()
  @IsEnum(CampusPreference, { each: true })
  @ArrayMaxSize(3)
  campusPreferences?: CampusPreference[];
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
    description: 'Recommended majors at this school based on student profile',
  })
  recommendedMajors?: (string | { name: string; reason: string })[];

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
      'Data points supporting the recommendation (e.g., "US News verified list #12", "5.2% acceptance rate")',
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
    testingPolicy?: 'REQUIRED' | 'OPTIONAL' | 'BLIND' | 'UNKNOWN';
    testOptional?: boolean;
    hasEarlyDecision?: boolean;
    retentionRate?: number;
    roomAndBoard?: number;
    studentOrgsCount?: number;
    countriesRepresented?: number;
    nicheSafetyGrade?: string;
    nicheLifeGrade?: string;
    nicheFoodGrade?: string;
    nicheOverallGrade?: string;
    logoUrl?: string;
    media?: SchoolPublicMedia;
    website?: string;
    fieldSources?: Record<string, SchoolFieldSource | null>;
    weakFields?: Record<string, string>;
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

  @ApiPropertyOptional({
    description: 'Admitted vs rejected case comparison data',
  })
  caseComparison?: {
    schoolId: string;
    totalCases: number;
    admitted: CohortStatsDto;
    rejected: CohortStatsDto;
    waitlisted?: CohortStatsDto;
    nationalitySubset?: {
      nationality: string;
      admitted: CohortStatsDto;
      rejected: CohortStatsDto;
    };
  };
}

export class CohortStatsDto {
  @ApiProperty()
  count: number;

  @ApiPropertyOptional()
  gpaMedian?: number;

  @ApiPropertyOptional()
  gpaP25?: number;

  @ApiPropertyOptional()
  gpaP75?: number;

  @ApiPropertyOptional()
  satMedian?: number;

  @ApiPropertyOptional()
  satP25?: number;

  @ApiPropertyOptional()
  satP75?: number;

  @ApiPropertyOptional({ type: [String] })
  topTags?: string[];
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
