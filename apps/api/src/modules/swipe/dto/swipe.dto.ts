import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

export enum SwipePrediction {
  ADMIT = 'admit',
  REJECT = 'reject',
  WAITLIST = 'waitlist',
}

export enum SwipeBadge {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
  DIAMOND = 'diamond',
}

// ============ Request DTOs ============

export class SwipeActionDto {
  @ApiProperty({ description: '案例ID' })
  @IsString()
  @IsNotEmpty()
  caseId: string;

  @ApiProperty({ enum: SwipePrediction, description: '用户预测' })
  @IsEnum(SwipePrediction)
  prediction: SwipePrediction;
}

// ============ Response DTOs ============

export class SwipeCaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty()
  schoolNameZh?: string;

  @ApiProperty()
  year: number;

  @ApiProperty()
  round?: string;

  @ApiProperty()
  major?: string;

  @ApiProperty()
  gpaRange?: string;

  @ApiProperty()
  satRange?: string;

  @ApiProperty()
  actRange?: string;

  @ApiProperty()
  toeflRange?: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty({ description: '学校US News排名' })
  usNewsRank?: number;

  @ApiProperty({ description: '学校录取率' })
  acceptanceRate?: number;
}

export class SwipeResultDto {
  @ApiProperty()
  caseId: string;

  @ApiProperty({ enum: SwipePrediction })
  prediction: SwipePrediction;

  @ApiProperty({ description: '真实结果' })
  actualResult: string;

  @ApiProperty()
  isCorrect: boolean;

  @ApiProperty({ description: '当前连胜' })
  currentStreak: number;

  @ApiProperty({ description: '获得积分' })
  pointsEarned: number;

  @ApiProperty({ description: '是否升级徽章' })
  badgeUpgraded: boolean;

  @ApiProperty({ enum: SwipeBadge, description: '当前徽章' })
  currentBadge: SwipeBadge;
}

export class SwipeStatsDto {
  @ApiProperty()
  totalSwipes: number;

  @ApiProperty()
  correctCount: number;

  @ApiProperty({ description: '准确率 0-100' })
  accuracy: number;

  @ApiProperty()
  currentStreak: number;

  @ApiProperty()
  bestStreak: number;

  @ApiProperty({ enum: SwipeBadge })
  badge: SwipeBadge;

  @ApiProperty({ description: '距离下一徽章还需正确数' })
  toNextBadge: number;

  @ApiProperty({ description: '今日挑战完成数' })
  dailyChallengeCount: number;

  @ApiProperty({ description: '今日挑战目标' })
  dailyChallengeTarget: number;
}

export class LeaderboardEntryDto {
  @ApiProperty()
  rank: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName?: string;

  @ApiProperty()
  accuracy: number;

  @ApiProperty()
  totalSwipes: number;

  @ApiProperty()
  correctCount: number;

  @ApiProperty({ enum: SwipeBadge })
  badge: SwipeBadge;

  @ApiProperty()
  isCurrentUser: boolean;
}

export class LeaderboardDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries: LeaderboardEntryDto[];

  @ApiProperty({ type: LeaderboardEntryDto, description: '当前用户排名' })
  currentUserEntry?: LeaderboardEntryDto;
}



