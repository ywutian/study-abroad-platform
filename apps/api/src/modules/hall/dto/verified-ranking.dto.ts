import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export enum RankingFilter {
  ALL = 'all',
  ADMITTED = 'admitted',
  TOP20 = 'top20',
  IVY = 'ivy',
}

export class VerifiedRankingQueryDto {
  @ApiPropertyOptional({ enum: RankingFilter })
  @IsOptional()
  @IsEnum(RankingFilter)
  filter?: RankingFilter = RankingFilter.ALL;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number = 0;
}

export class VerifiedUserDto {
  @ApiProperty()
  rank: number;

  @ApiProperty()
  caseId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName?: string;

  @ApiProperty()
  gpaRange?: string;

  @ApiProperty()
  satRange?: string;

  @ApiProperty()
  actRange?: string;

  @ApiProperty()
  toeflRange?: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty()
  schoolNameZh?: string;

  @ApiProperty()
  schoolRank?: number;

  @ApiProperty()
  result: string;

  @ApiProperty()
  year: number;

  @ApiProperty()
  round?: string;

  @ApiProperty()
  major?: string;

  @ApiProperty()
  isVerified: boolean;

  @ApiProperty()
  verifiedAt?: Date;
}

export class VerifiedRankingStatsDto {
  @ApiProperty()
  totalVerified: number;

  @ApiProperty()
  totalAdmitted: number;

  @ApiProperty()
  topSchoolsCount: number;

  @ApiProperty()
  ivyCount: number;
}

export class VerifiedRankingResponseDto {
  @ApiProperty({ type: [VerifiedUserDto] })
  users: VerifiedUserDto[];

  @ApiProperty({ type: VerifiedRankingStatsDto })
  stats: VerifiedRankingStatsDto;

  @ApiProperty()
  total: number;

  @ApiProperty()
  hasMore: boolean;
}



