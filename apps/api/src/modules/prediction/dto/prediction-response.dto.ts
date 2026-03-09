import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PredictionFactor {
  @ApiProperty({ description: '因素名称', example: 'GPA' })
  name: string;

  @ApiProperty({
    description: '影响类型',
    enum: ['positive', 'negative', 'neutral'],
    example: 'positive',
  })
  impact: 'positive' | 'negative' | 'neutral';

  @ApiProperty({ description: '权重 (0-1)', example: 0.3 })
  weight: number;

  @ApiProperty({
    description: '详细说明',
    example: 'GPA 3.85 高于该校平均录取学生水平',
  })
  detail: string;

  @ApiPropertyOptional({
    description: '改进建议（仅 negative 时有值）',
  })
  improvement?: string;
}

export class PredictionComparison {
  @ApiProperty({ description: 'GPA 百分位排名', example: 75 })
  gpaPercentile: number;

  @ApiProperty({ description: '标化成绩百分位排名', example: 60 })
  testScorePercentile: number;

  @ApiProperty({
    description: '活动强度',
    enum: ['weak', 'average', 'strong'],
    example: 'average',
  })
  activityStrength: 'weak' | 'average' | 'strong';
}

/** 多引擎分数明细 */
export class EngineScores {
  @ApiProperty({ description: '统计引擎概率 (0-1)', example: 0.35 })
  stats: number;

  @ApiPropertyOptional({ description: 'AI 引擎概率 (0-1)', example: 0.28 })
  ai?: number;

  @ApiPropertyOptional({ description: '历史数据引擎概率 (0-1)', example: 0.32 })
  historical?: number;

  @ApiPropertyOptional({ description: 'ML 模型引擎概率 (0-1)', example: 0.31 })
  ml?: number;

  @ApiPropertyOptional({ description: '记忆增强调整值 (-0.1 to 0.1)' })
  memoryAdjustment?: number;

  @ApiProperty({
    description: '各引擎权重',
    example: { stats: 0.1, ai: 0.25, historical: 0.25, ml: 0.4 },
  })
  weights: Record<string, number>;

  @ApiProperty({
    description: '最终融合方法',
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
  @ApiProperty({ description: '学校ID' })
  schoolId: string;

  @ApiProperty({ description: '学校名称' })
  schoolName: string;

  @ApiProperty({ description: '录取概率 (0-1)', example: 0.35 })
  probability: number;

  @ApiPropertyOptional({ description: '置信区间下界 (0-1)', example: 0.25 })
  probabilityLow?: number;

  @ApiPropertyOptional({ description: '置信区间上界 (0-1)', example: 0.45 })
  probabilityHigh?: number;

  @ApiProperty({
    description: '预测置信度',
    enum: ['low', 'medium', 'high'],
    example: 'medium',
  })
  confidence: 'low' | 'medium' | 'high';

  @ApiProperty({
    description: '学校分类',
    enum: ['reach', 'match', 'safety'],
    example: 'reach',
  })
  tier: 'reach' | 'match' | 'safety';

  @ApiProperty({ description: '影响因素列表', type: [PredictionFactor] })
  factors: PredictionFactor[];

  @ApiProperty({ description: '改进建议列表', type: [String] })
  suggestions: string[];

  @ApiProperty({ description: '对比数据', type: PredictionComparison })
  comparison: PredictionComparison;

  @ApiPropertyOptional({ description: '多引擎分数明细', type: EngineScores })
  engineScores?: EngineScores;

  @ApiPropertyOptional({ description: '是否来自缓存' })
  fromCache?: boolean;

  @ApiPropertyOptional({ description: '缓存时间 (ISO string)' })
  cachedAt?: string;

  @ApiPropertyOptional({ description: '模型版本', example: 'v3-enterprise' })
  modelVersion?: string;

  @ApiPropertyOptional({ description: '学校元数据' })
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

  @ApiPropertyOptional({ description: '专业竞争度分析' })
  majorBreakdown?: {
    majorName: string;
    majorNameZh?: string;
    cipCode: string;
    competitiveness: number;
    acceptanceRateEstimate?: number;
    modifier: number;
    adjustedProbability: number;
  };

  @ApiPropertyOptional({ description: '社区案例数据' })
  communityInsight?: {
    majorAdmitRate: number;
    totalCases: number;
    major: string;
  };

  @ApiPropertyOptional({ description: '跨引擎一致性 (0-1)' })
  crossEngineConsistency?: number;
}

export class PredictionResponseDto {
  @ApiProperty({ description: '预测结果列表', type: [PredictionResultDto] })
  results: PredictionResultDto[];

  @ApiPropertyOptional({ description: '处理耗时(ms)' })
  processingTime?: number;

  @ApiPropertyOptional({ description: '数据完整度评估 (0-100)' })
  dataCompleteness?: number;

  @ApiPropertyOptional({ description: '记忆增强信息' })
  memoryContext?: {
    previousPredictions: number;
    knownPreferences: string[];
    dataPoints: number;
  };

  @ApiPropertyOptional({ description: '验证摘要' })
  validationSummary?: {
    violations: string[];
    warnings: string[];
  };

  @ApiPropertyOptional({
    description:
      '当用户选择了任意 UC 校区时，已自动扩展为全部 9 所 UC 校区比较',
  })
  ucComparisonExpanded?: boolean;
}
