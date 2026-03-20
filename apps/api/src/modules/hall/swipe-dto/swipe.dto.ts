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
  @ApiProperty({ description: 'Case ID' })
  @IsString()
  @IsNotEmpty()
  caseId: string;

  @ApiProperty({ enum: SwipePrediction, description: 'User prediction' })
  @IsEnum(SwipePrediction)
  prediction: SwipePrediction;
}

export class SwipeBatchQueryDto {
  @ApiPropertyOptional({
    description: 'Number of cases to fetch',
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
    description: 'Number of leaderboard entries',
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

  @ApiProperty({ description: 'School US News ranking' })
  usNewsRank?: number;

  @ApiProperty({ description: 'School acceptance rate' })
  acceptanceRate?: number;

  @ApiPropertyOptional({ description: 'School state' })
  schoolState?: string;

  @ApiPropertyOptional({ description: 'School city' })
  schoolCity?: string;

  @ApiPropertyOptional({ description: 'Graduation rate (%)' })
  graduationRate?: number;

  @ApiPropertyOptional({ description: 'Total enrollment' })
  totalEnrollment?: number;

  @ApiPropertyOptional({ description: 'Annual tuition (USD)' })
  tuition?: number;

  @ApiPropertyOptional({ description: 'Essay type' })
  essayType?: string;

  @ApiPropertyOptional({ description: 'Whether private school' })
  isPrivateSchool?: boolean;

  // 申请者档案聚合信息 (匿名化)
  @ApiPropertyOptional({ description: 'Applicant grade' })
  applicantGrade?: string;

  @ApiPropertyOptional({
    description: '申请者School type (PUBLIC_US / PRIVATE_US / INTERNATIONAL)',
  })
  applicantSchoolType?: string;

  @ApiPropertyOptional({ description: 'Extracurricular activity count' })
  activityCount?: number;

  @ApiPropertyOptional({
    description: 'Activity category摘要 (前3个去重类别)',
    type: [String],
  })
  activityHighlights?: string[];

  @ApiPropertyOptional({ description: 'Award count' })
  awardCount?: number;

  @ApiPropertyOptional({ description: 'Highest award level' })
  highestAwardLevel?: string;

  @ApiPropertyOptional({ description: 'AP/IB course count' })
  apCount?: number;
}

export class SwipeBatchMetaDto {
  @ApiProperty({
    description: 'Total available cases (public cases not yet swiped)',
  })
  totalAvailable: number;

  @ApiProperty({ description: 'Total cases swiped by user' })
  totalSwiped: number;

  @ApiProperty({ description: 'Whether more cases are available' })
  hasMore: boolean;
}

export class SwipeBatchResultDto {
  @ApiProperty({ type: [SwipeCaseDto], description: 'Case list' })
  cases: SwipeCaseDto[];

  @ApiProperty({ type: SwipeBatchMetaDto, description: 'Metadata' })
  meta: SwipeBatchMetaDto;
}

export class SwipeResultDto {
  @ApiProperty()
  caseId: string;

  @ApiProperty({ enum: SwipePrediction })
  prediction: SwipePrediction;

  @ApiProperty({ description: 'Actual result' })
  actualResult: string;

  @ApiProperty()
  isCorrect: boolean;

  @ApiProperty({ description: 'Current streak' })
  currentStreak: number;

  @ApiProperty({ description: 'Points earned' })
  pointsEarned: number;

  @ApiProperty({ description: 'Whether badge was upgraded' })
  badgeUpgraded: boolean;

  @ApiProperty({ enum: SwipeBadge, description: 'Current badge' })
  currentBadge: SwipeBadge;
}

export class SwipeStatsDto {
  @ApiProperty()
  totalSwipes: number;

  @ApiProperty()
  correctCount: number;

  @ApiProperty({ description: 'Accuracy 0-100' })
  accuracy: number;

  @ApiProperty()
  currentStreak: number;

  @ApiProperty()
  bestStreak: number;

  @ApiProperty({ enum: SwipeBadge })
  badge: SwipeBadge;

  @ApiProperty({ description: 'Correct answers needed for next badge' })
  toNextBadge: number;

  @ApiProperty({ description: 'Daily challenge completions' })
  dailyChallengeCount: number;

  @ApiProperty({ description: 'Daily challenge target' })
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

  @ApiProperty({
    type: LeaderboardEntryDto,
    description: 'Current user ranking',
  })
  currentUserEntry?: LeaderboardEntryDto;
}
