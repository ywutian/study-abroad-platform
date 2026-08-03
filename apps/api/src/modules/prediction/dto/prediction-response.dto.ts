import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SchoolPublicMedia } from '@study-abroad/shared';
import type { SchoolTestingPolicy } from '@study-abroad/shared';

export class PredictionFactor {
  @ApiProperty({ description: 'Factor name', example: 'GPA' })
  name: string;

  @ApiProperty({
    description: 'Impact type',
    enum: ['positive', 'negative', 'neutral'],
    example: 'positive',
  })
  impact: 'positive' | 'negative' | 'neutral';

  @ApiPropertyOptional({ description: 'Weight (0-1)', example: 0.3 })
  weight?: number;

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

export class PredictionSourceSummaryDto {
  @ApiProperty({ description: 'User-facing source label' })
  label: string;

  @ApiPropertyOptional({ description: 'Additional source detail' })
  detail?: string;
}

export class PredictionInsufficientDataDto {
  @ApiProperty({ description: 'Counselor data tier sentinel', example: 4 })
  tier: 4;

  @ApiProperty({
    description: 'Why a numeric prediction is unavailable',
    example:
      'Limited public data — predictions are not available for this school yet.',
  })
  reason: string;
}

export class PredictionPublicExplanationDto {
  @ApiProperty({ description: 'Short user-facing explanation headline' })
  headline: string;

  @ApiProperty({
    description: 'Top human-readable reasons for this estimate',
    type: [String],
  })
  reasons: string[];

  @ApiPropertyOptional({ description: 'Most useful next action' })
  nextAction?: string;

  @ApiProperty({
    description: 'User-facing data support label',
    example: '信息有限',
  })
  dataSupportLabel: string;

  @ApiProperty({
    description: 'Normalized data support level',
    enum: ['strong', 'moderate', 'limited'],
  })
  dataSupportLevel: 'strong' | 'moderate' | 'limited';

  @ApiProperty({
    description: 'Plain-language caveats for this estimate',
    type: [String],
  })
  caveats: string[];

  @ApiProperty({
    description: 'Explanation source',
    enum: ['rules', 'llm'],
  })
  source: 'rules' | 'llm';

  @ApiPropertyOptional({ description: 'When this explanation was generated' })
  generatedAt?: string;
}

export class PredictionOutcomeLabelDto {
  @ApiProperty({ description: 'Outcome label ID' })
  id: string;

  @ApiProperty({
    description: 'Outcome result',
    enum: [
      'ADMITTED',
      'REJECTED',
      'WAITLISTED',
      'DEFERRED',
      'WITHDRAWN',
      'UNKNOWN',
      'CENSORED',
    ],
  })
  result: string;

  @ApiProperty({
    description: 'Outcome label trust state',
    enum: [
      'SELF_REPORTED',
      'COUNSELOR_VERIFIED',
      'DOCUMENT_VERIFIED',
      'REQUEST_EVIDENCE',
      'REJECTED',
      'CONFLICTED',
      'CENSORED',
    ],
  })
  status:
    | 'SELF_REPORTED'
    | 'COUNSELOR_VERIFIED'
    | 'DOCUMENT_VERIFIED'
    | 'REQUEST_EVIDENCE'
    | 'REJECTED'
    | 'CONFLICTED'
    | 'CENSORED';

  @ApiPropertyOptional({ description: 'Optional note supplied with the label' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'Optional evidence URL attached to the label',
  })
  evidenceUrl?: string;

  @ApiProperty({
    description: 'When the label was reported',
    example: '2026-04-03T12:00:00.000Z',
  })
  reportedAt: string;

  @ApiPropertyOptional({
    description: 'When the label was resolved or verified',
  })
  resolvedAt?: string;

  @ApiPropertyOptional({
    description: 'Application round attached to this label',
  })
  round?: string;
}

export class PredictionResultDto {
  @ApiPropertyOptional({
    description:
      'PredictionResult row ID. Present for persisted predictions; omitted for dry-run previews.',
  })
  id?: string;

  @ApiProperty({ description: 'School ID' })
  schoolId: string;

  @ApiProperty({ description: 'School name' })
  schoolName: string;

  @ApiProperty({
    description:
      'Admission probability (0-1). Null when predictionMethod=insufficient_data.',
    example: 0.35,
    nullable: true,
  })
  probability: number | null;

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
    enum: ['reach', 'match', 'safety', 'unavailable'],
    example: 'reach',
  })
  tier: 'reach' | 'match' | 'safety' | 'unavailable';

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

  @ApiPropertyOptional({
    description: 'Comparison data',
    type: PredictionComparison,
  })
  comparison?: PredictionComparison;

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
    description: 'Counselor engine rule version that produced this prediction',
    example: 'counselor-cold-start-v1.12-substitute-cap-act-concordance',
  })
  modelVersion?: string;

  @ApiPropertyOptional({
    description:
      'Served policy version — equals the counselor engine rule version (the served path is counselor-only)',
    example: 'counselor-cold-start-v1.12-substitute-cap-act-concordance',
  })
  servedPolicyVersionId?: string;

  @ApiPropertyOptional({
    description: 'Resolved applicant cohort for this prediction',
    example: 'CN__CHINA_INTL',
  })
  cohortKey?: string;

  @ApiPropertyOptional({
    description: 'Application round context used in prediction',
    example: 'ED',
  })
  roundContext?: string;

  @ApiPropertyOptional({
    description: 'Public served prediction method',
    enum: ['fusion', 'counselor', 'insufficient_data'],
    example: 'counselor',
  })
  predictionMethod?: 'fusion' | 'counselor' | 'insufficient_data';

  @ApiPropertyOptional({
    description: 'Primary source summary shown to the user',
    type: [PredictionSourceSummaryDto],
  })
  sourceSummary?: PredictionSourceSummaryDto[];

  @ApiPropertyOptional({
    description: 'Why this prediction still carries uncertainty',
    type: [String],
  })
  uncertaintyReasons?: string[];

  @ApiPropertyOptional({
    description: 'Human-readable confidence explanation',
  })
  confidenceReason?: string;

  @ApiPropertyOptional({
    description: 'User-friendly explanation and next action',
    type: PredictionPublicExplanationDto,
  })
  publicExplanation?: PredictionPublicExplanationDto;

  @ApiPropertyOptional({
    description: 'Insufficient data details when tier=unavailable',
    type: PredictionInsufficientDataDto,
  })
  insufficientData?: PredictionInsufficientDataDto;

  @ApiPropertyOptional({
    description: 'Most recent outcome label attached to this prediction',
    type: PredictionOutcomeLabelDto,
  })
  latestOutcomeLabel?: PredictionOutcomeLabelDto;

  @ApiPropertyOptional({ description: 'School metadata' })
  schoolMeta?: {
    usNewsRank?: number;
    rankings?: Array<{
      source: string;
      list: string;
      rank: number;
      year: number;
      sourceUrl?: string | null;
    }>;
    media?: SchoolPublicMedia;
    acceptanceRate?: number;
    intlAcceptanceRate?: number;
    oosAcceptanceRate?: number;
    intlStudentPct?: number;
    needBlindInternational?: boolean | null;
    graduationRate?: number;
    satAvg?: number;
    sat25?: number;
    sat75?: number;
    act25?: number;
    act75?: number;
    testingPolicy?: SchoolTestingPolicy;
    dataQuality?: {
      officialFields: string[];
      heuristicFields: string[];
      terminalFields: string[];
      staleFields: string[];
      impactedFields: string[];
      summary: 'strong' | 'mixed' | 'limited';
    };
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
