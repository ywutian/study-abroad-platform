import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class SwipeBatchQueryDto {
  @ApiPropertyOptional({
    description: '获取案例数量',
    default: 5,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  count?: number;
}

export class LeaderboardQueryDto {
  @ApiPropertyOptional({
    description: '排行榜条目数量',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
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

  @ApiPropertyOptional({ description: '学校所在州' })
  schoolState?: string;

  @ApiPropertyOptional({ description: '学校所在城市' })
  schoolCity?: string;

  @ApiPropertyOptional({ description: '毕业率 (%)' })
  graduationRate?: number;

  @ApiPropertyOptional({ description: '学生总数' })
  totalEnrollment?: number;

  @ApiPropertyOptional({ description: '年学费 (USD)' })
  tuition?: number;

  @ApiPropertyOptional({ description: '文书类型' })
  essayType?: string;

  @ApiPropertyOptional({ description: '是否为私立学校' })
  isPrivateSchool?: boolean;

  // 申请者档案聚合信息 (匿名化)
  @ApiPropertyOptional({ description: '申请者年级' })
  applicantGrade?: string;

  @ApiPropertyOptional({
    description: '申请者学校类型 (PUBLIC_US / PRIVATE_US / INTERNATIONAL)',
  })
  applicantSchoolType?: string;

  @ApiPropertyOptional({ description: '课外活动数量' })
  activityCount?: number;

  @ApiPropertyOptional({
    description: '活动类别摘要 (前3个去重类别)',
    type: [String],
  })
  activityHighlights?: string[];

  @ApiPropertyOptional({ description: '奖项数量' })
  awardCount?: number;

  @ApiPropertyOptional({ description: '最高奖项级别' })
  highestAwardLevel?: string;

  @ApiPropertyOptional({ description: 'AP/IB 课程数量' })
  apCount?: number;
}

export class SwipeBatchMetaDto {
  @ApiProperty({ description: '总可用案例数（未滑动的公开案例）' })
  totalAvailable: number;

  @ApiProperty({ description: '用户已滑动总数' })
  totalSwiped: number;

  @ApiProperty({ description: '是否还有更多可用案例' })
  hasMore: boolean;
}

export class SwipeBatchResultDto {
  @ApiProperty({ type: [SwipeCaseDto], description: '案例列表' })
  cases: SwipeCaseDto[];

  @ApiProperty({ type: SwipeBatchMetaDto, description: '元信息' })
  meta: SwipeBatchMetaDto;
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
