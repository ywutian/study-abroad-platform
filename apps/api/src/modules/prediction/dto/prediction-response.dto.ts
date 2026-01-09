import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ description: '详细说明', example: 'GPA 3.85 高于该校平均录取学生水平' })
  detail: string;

  @ApiProperty({ description: '改进建议（仅 negative 时有值）', required: false })
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

export class PredictionResultDto {
  @ApiProperty({ description: '学校ID' })
  schoolId: string;

  @ApiProperty({ description: '学校名称' })
  schoolName: string;

  @ApiProperty({ description: '录取概率 (0-1)', example: 0.35 })
  probability: number;

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

  @ApiProperty({ description: '是否来自缓存' })
  fromCache?: boolean;
}

export class PredictionResponseDto {
  @ApiProperty({ description: '预测结果列表', type: [PredictionResultDto] })
  results: PredictionResultDto[];

  @ApiProperty({ description: '处理耗时(ms)' })
  processingTime?: number;
}



