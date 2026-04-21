import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  MatchPoolEntryType,
  RecruitmentContextModerationStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateMatchPoolDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameZh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMatchPoolDto extends PartialType(CreateMatchPoolDto) {}

export class CreateMatchPoolEntryDto {
  @ApiProperty({ enum: MatchPoolEntryType })
  @IsEnum(MatchPoolEntryType)
  entryType: MatchPoolEntryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  competitionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recruitmentContextId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMatchPoolEntryDto extends PartialType(
  CreateMatchPoolEntryDto,
) {}

export class ReviewCommunityRecruitmentContextDto {
  @ApiProperty({ enum: RecruitmentContextModerationStatus })
  @IsEnum(RecruitmentContextModerationStatus)
  status: RecruitmentContextModerationStatus;
}

export class PromoteCommunityRecruitmentContextDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  matchPoolId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CommunityRecruitmentContextQueryDto {
  @ApiPropertyOptional({ enum: RecruitmentContextModerationStatus })
  @IsOptional()
  @IsEnum(RecruitmentContextModerationStatus)
  status?: RecruitmentContextModerationStatus;
}
