import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsArray,
  IsString,
  IsNumber,
  IsEnum,
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
    description: '偏好地区（如：California, New York）',
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  preferredRegions?: string[];

  @ApiPropertyOptional({ type: [String], description: '意向专业' })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  preferredMajors?: string[];

  @ApiPropertyOptional({ enum: BudgetRange, description: '预算范围' })
  @IsEnum(BudgetRange)
  @IsOptional()
  budget?: BudgetRange;

  @ApiPropertyOptional({ description: '目标学校数量（默认15）' })
  @IsNumber()
  @IsOptional()
  schoolCount?: number;

  @ApiPropertyOptional({ description: '其他偏好说明' })
  @IsString()
  @IsOptional()
  additionalPreferences?: string;
}

export class RecommendedSchoolDto {
  @ApiProperty()
  schoolId?: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty({ enum: ['reach', 'match', 'safety'] })
  tier: 'reach' | 'match' | 'safety';

  @ApiProperty({ description: '预估录取概率 0-100' })
  estimatedProbability: number;

  @ApiProperty({ description: '契合度评分 0-100' })
  fitScore: number;

  @ApiProperty({ type: [String], description: '推荐理由' })
  reasons: string[];

  @ApiProperty({ type: [String], description: '需要注意的点', required: false })
  concerns?: string[];

  @ApiPropertyOptional({ description: '匹配到的学校元数据' })
  schoolMeta?: {
    nameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
    city?: string;
    state?: string;
    tuition?: number;
    isPrivate?: boolean;
  };
}

export class RecommendationAnalysisDto {
  @ApiProperty({ type: [String] })
  strengths: string[];

  @ApiProperty({ type: [String] })
  weaknesses: string[];

  @ApiProperty({ type: [String] })
  improvementTips: string[];
}

export class SchoolRecommendationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: [RecommendedSchoolDto] })
  recommendations: RecommendedSchoolDto[];

  @ApiProperty({ type: RecommendationAnalysisDto })
  analysis: RecommendationAnalysisDto;

  @ApiProperty()
  summary: string;

  @ApiProperty()
  tokenUsed: number;

  @ApiProperty()
  createdAt: Date;
}
