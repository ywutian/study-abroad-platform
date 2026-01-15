import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';

// ============ Request DTOs ============

export class CreatePeerReviewDto {
  @ApiPropertyOptional({ description: '是否匿名评价' })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}

export class SubmitReviewDto {
  @ApiProperty({ description: '背景真实性评分 (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  profileScore: number;

  @ApiProperty({ description: '帮助程度评分 (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  helpfulScore: number;

  @ApiProperty({ description: '回复及时性评分 (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  responseScore: number;

  @ApiProperty({ description: '总体评分 (1-5)', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  overallScore: number;

  @ApiPropertyOptional({ description: '评价内容' })
  @IsOptional()
  @IsString()
  comment?: string;
}

// ============ Response DTOs ============

export class UserBasicDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty()
  isVerified: boolean;
}

export class PeerReviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ type: UserBasicDto })
  reviewer: UserBasicDto;

  @ApiProperty({ type: UserBasicDto })
  reviewee: UserBasicDto;

  @ApiPropertyOptional()
  profileScore?: number;

  @ApiPropertyOptional()
  helpfulScore?: number;

  @ApiPropertyOptional()
  responseScore?: number;

  @ApiPropertyOptional()
  overallScore?: number;

  @ApiPropertyOptional()
  comment?: string;

  @ApiPropertyOptional()
  reverseProfileScore?: number;

  @ApiPropertyOptional()
  reverseHelpfulScore?: number;

  @ApiPropertyOptional()
  reverseResponseScore?: number;

  @ApiPropertyOptional()
  reverseOverallScore?: number;

  @ApiPropertyOptional()
  reverseComment?: string;

  @ApiProperty()
  isAnonymous: boolean;

  @ApiProperty()
  status: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class UserRatingDto {
  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  overall?: number;

  @ApiPropertyOptional()
  profile?: number;

  @ApiPropertyOptional()
  helpful?: number;

  @ApiPropertyOptional()
  response?: number;

  @ApiProperty()
  count: number;
}

export class PeerReviewListDto {
  @ApiProperty({ type: [PeerReviewDto] })
  reviews: PeerReviewDto[];

  @ApiProperty()
  total: number;
}
