import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PredictionFactor {
  @ApiProperty({ description: 'Factor name', example: 'GPA' })
  name: string;

  @ApiProperty({
    description: 'Impact type',
    enum: ['positive', 'negative', 'neutral'],
    example: 'positive',
  })
  impact: 'positive' | 'negative' | 'neutral';

  @ApiProperty({ description: 'Weight (0-1)', example: 0.3 })
  weight: number;

  @ApiProperty({
    description: 'Detailed description',
    example: 'GPA 3.85 高于该校平均录取学生水平',
  })
  detail: string;

  @ApiPropertyOptional({
    description: 'Improvement suggestion (only present for negative impact)',
  })
  improvement?: string;
}

export class PredictionComparison {
  @ApiProperty({ description: 'GPA percentile ranking', example: 75 })
  gpaPercentile: number;

  @ApiProperty({
    description: 'Standardized test score percentile ranking',
    example: 60,
  })
  testScorePercentile: number;

  @ApiProperty({
    description: 'Activity strength',
    enum: ['weak', 'average', 'strong'],
    example: 'average',
  })
  activityStrength: 'weak' | 'average' | 'strong';
}

/** Multi-engine score breakdown */
export class EngineScores {
  @ApiProperty({
    description: 'Statistical engine probability (0-1)',
    example: 0.35,
  })
  stats: number;

  @ApiPropertyOptional({
    description: 'AI engine probability (0-1)',
    example: 0.28,
  })
  ai?: number;

  @ApiPropertyOptional({
    description: 'Historical data engine probability (0-1)',
    example: 0.32,
  })
  historical?: number;

  @ApiPropertyOptional({
    description: 'ML model engine probability (0-1)',
    example: 0.31,
  })
  ml?: number;

  @ApiPropertyOptional({
    description: 'Memory enhancement adjustment (-0.1 to 0.1)',
  })
  memoryAdjustment?: number;

  @ApiProperty({
    description: 'Engine weights',
    example: { stats: 0.1, ai: 0.25, historical: 0.25, ml: 0.4 },
  })
  weights: Record<string, number>;

  @ApiProperty({
    description: 'Final fusion method',
    example: 'weighted_ensemble_4_stats_ai_hist_ml',
  })
  fusionMethod: string;

  @ApiPropertyOptional({
    description: 'ML 模型 Tier (1=Platt, 2=LR-basic, 3=LR-full, 4=GBDT)',
  })
  mlModelTier?: number;

  @ApiPropertyOptional({
    description: 'ML 模型各特征贡献度',
    type: 'array',
    items: { type: 'object' },
  })
  mlContributions?: Array<{
    feature: string;
    contribution: number;
    direction: 'positive' | 'negative';
  }>;
}

export class PredictionResultDto {
  @ApiProperty({ description: 'School ID' })
  schoolId: string;

  @ApiProperty({ description: 'School name' })
  schoolName: string;

  @ApiProperty({ description: 'Admission probability (0-1)', example: 0.35 })
  probability: number;

  @ApiPropertyOptional({
    description: 'Confidence interval lower bound (0-1)',
    example: 0.25,
  })
  probabilityLow?: number;

  @ApiPropertyOptional({
    description: 'Confidence interval upper bound (0-1)',
    example: 0.45,
  })
  probabilityHigh?: number;

  @ApiProperty({
    description: 'Prediction confidence',
    enum: ['low', 'medium', 'high'],
    example: 'medium',
  })
  confidence: 'low' | 'medium' | 'high';

  @ApiProperty({
    description: 'School tier classification',
    enum: ['reach', 'match', 'safety'],
    example: 'reach',
  })
  tier: 'reach' | 'match' | 'safety';

  @ApiProperty({
    description: 'List of impact factors',
    type: [PredictionFactor],
  })
  factors: PredictionFactor[];

  @ApiProperty({
    description: 'List of improvement suggestions',
    type: [String],
  })
  suggestions: string[];

  @ApiProperty({ description: 'Comparison data', type: PredictionComparison })
  comparison: PredictionComparison;

  @ApiPropertyOptional({
    description: 'Multi-engine score breakdown',
    type: EngineScores,
  })
  engineScores?: EngineScores;

  @ApiPropertyOptional({ description: 'Whether from cache' })
  fromCache?: boolean;

  @ApiPropertyOptional({ description: 'Cache time (ISO string)' })
  cachedAt?: string;

  @ApiPropertyOptional({
    description: 'Model version',
    example: 'v3-enterprise',
  })
  modelVersion?: string;

  @ApiPropertyOptional({ description: 'School metadata' })
  schoolMeta?: {
    usNewsRank?: number;
    acceptanceRate?: number;
    intlAcceptanceRate?: number;
    intlStudentPct?: number;
    needBlindInternational?: boolean;
    graduationRate?: number;
    satAvg?: number;
    sat25?: number;
    sat75?: number;
  };

  @ApiPropertyOptional({ description: 'Major competitiveness analysis' })
  majorBreakdown?: {
    majorName: string;
    majorNameZh?: string;
    cipCode: string;
    competitiveness: number;
    acceptanceRateEstimate?: number;
    modifier: number;
    adjustedProbability: number;
  };

  @ApiPropertyOptional({ description: 'Community case data' })
  communityInsight?: {
    majorAdmitRate: number;
    totalCases: number;
    major: string;
  };

  @ApiPropertyOptional({ description: 'Cross-engine consistency (0-1)' })
  crossEngineConsistency?: number;

  @ApiPropertyOptional({
    description: 'High school data confidence assessment',
  })
  hsConfidence?: {
    level: 'high' | 'medium' | 'low' | 'none';
    dimensionsAvailable: number;
    improvementTip?: string;
  };
}

export class PredictionResponseDto {
  @ApiProperty({
    description: 'Prediction results list',
    type: [PredictionResultDto],
  })
  results: PredictionResultDto[];

  @ApiPropertyOptional({ description: 'Processing time (ms)' })
  processingTime?: number;

  @ApiPropertyOptional({ description: 'Data completeness assessment (0-100)' })
  dataCompleteness?: number;

  @ApiPropertyOptional({ description: 'Memory enhancement info' })
  memoryContext?: {
    previousPredictions: number;
    knownPreferences: string[];
    dataPoints: number;
  };

  @ApiPropertyOptional({ description: 'Validation summary' })
  validationSummary?: {
    violations: string[];
    warnings: string[];
  };

  @ApiPropertyOptional({
    description:
      'When the user selects any UC campus, it is automatically expanded to a comparison of all 9 UC campuses',
  })
  ucComparisonExpanded?: boolean;
}
