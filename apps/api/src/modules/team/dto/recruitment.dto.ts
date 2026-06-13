import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  CollaborationMode,
  LocationMode,
  RecruitmentContextSourceType,
  RecruitmentAvailabilityBand,
  RecruitmentIntentMode,
  TeamRecruitmentSwipeAction,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  MAX_RECRUITMENT_ROLES,
  MAX_RECRUITMENT_SKILL_TAGS,
  MAX_TEAM_LANGUAGES,
  MAX_ROLE_PRESETS,
  MAX_TEAM_INVITEES,
} from '@study-abroad/shared';

export class CreateRecruitmentDto {
  @ApiPropertyOptional({ description: 'Existing backing team id' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  teamId?: string;

  @ApiPropertyOptional({
    description: 'Team name when creating a solo backing team',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  teamName?: string;

  @ApiProperty({
    description: 'Recruitment context id (official or community)',
  })
  @IsString()
  @MaxLength(200)
  recruitmentContextId: string;

  @ApiPropertyOptional({
    description: 'Deprecated competition track id for compatibility',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  competitionTrackId?: string;

  @ApiProperty({ description: 'Card headline shown on the front of the card' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  headline: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  detailNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  highlightTitle?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @ArrayMaxSize(MAX_RECRUITMENT_ROLES)
  offerRoles?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @ArrayMaxSize(MAX_RECRUITMENT_ROLES)
  needRoles?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @ArrayMaxSize(MAX_RECRUITMENT_SKILL_TAGS)
  skillTags?: string[];

  @ApiPropertyOptional({ enum: RecruitmentAvailabilityBand })
  @IsOptional()
  @IsEnum(RecruitmentAvailabilityBand)
  availabilityBand?: RecruitmentAvailabilityBand;

  @ApiPropertyOptional({ enum: CollaborationMode })
  @IsOptional()
  @IsEnum(CollaborationMode)
  collaborationMode?: CollaborationMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @ArrayMaxSize(MAX_TEAM_LANGUAGES)
  languages?: string[];

  @ApiPropertyOptional({ enum: RecruitmentIntentMode })
  @IsOptional()
  @IsEnum(RecruitmentIntentMode)
  intentMode?: RecruitmentIntentMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Team target size / Team.maxMembers override',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  targetTeamSize?: number;
}

export class UpdateRecruitmentDto extends PartialType(CreateRecruitmentDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean;
}

export class RecruitmentContextQueryDto {
  @ApiPropertyOptional({ enum: RecruitmentContextSourceType })
  @IsOptional()
  @IsEnum(RecruitmentContextSourceType)
  sourceType?: RecruitmentContextSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  competitionId?: string;
}

export class CreateCommunityContextDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  titleZh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  registrationCloseAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  eventStartAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  eventEndAt?: string;

  @ApiPropertyOptional({ enum: LocationMode })
  @IsOptional()
  @IsEnum(LocationMode)
  locationMode?: LocationMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationText?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @ArrayMaxSize(MAX_ROLE_PRESETS)
  rolePresets?: string[];

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  minTeamSize: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  maxTeamSize: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @ArrayMaxSize(MAX_TEAM_LANGUAGES)
  languages?: string[];
}

export class UpdateCommunityContextDto extends PartialType(
  CreateCommunityContextDto,
) {}

export class UpdateRecruitmentMemberProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  selectedResumeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  introLine?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showSchool?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showGrade?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showAwards?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showAcademics?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showExperiences?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showPersonality?: boolean;

  @ApiPropertyOptional({
    description: 'Confirm current display settings for publishing',
  })
  @IsOptional()
  @IsBoolean()
  consentConfirmed?: boolean;
}

export class RecruitmentDeckQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  teamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class RecruitmentDeckPreviewQueryDto {
  @ApiPropertyOptional({
    description:
      'Recruitment context to browse. Omit for a cross-context sample.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  recruitmentContextId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class CreateRecruitmentSwipeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  targetCardId: string;

  @ApiProperty({ enum: TeamRecruitmentSwipeAction })
  @IsEnum(TeamRecruitmentSwipeAction)
  action: TeamRecruitmentSwipeAction;
}

export class MatchQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  teamId?: string;
}

export class InviteMatchMembersDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  @ArrayMaxSize(MAX_TEAM_INVITEES)
  inviteeIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourceTeamId?: string;
}
