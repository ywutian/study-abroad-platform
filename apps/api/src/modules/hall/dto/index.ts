import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsBoolean,
  ArrayMinSize,
  ArrayMaxSize,
  IsEnum,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ReviewMethod } from '@prisma/client';

export class CreateReviewDto {
  @ApiProperty({ description: 'User ID of the profile being reviewed' })
  @IsString()
  profileUserId: string;

  @ApiProperty({
    description: 'Academic/GPA score (1-10)',
    minimum: 1,
    maximum: 10,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  academicScore: number;

  @ApiProperty({
    description: 'Standardized test score (1-10)',
    minimum: 1,
    maximum: 10,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  testScore: number;

  @ApiProperty({
    description: 'Activity score (1-10)',
    minimum: 1,
    maximum: 10,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  activityScore: number;

  @ApiProperty({
    description: 'Award score (1-10)',
    minimum: 1,
    maximum: 10,
    default: 5,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  awardScore: number;

  @ApiProperty({ description: 'Overall score (1-10)', minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  overallScore: number;

  @ApiPropertyOptional({ description: 'General comment (max 50000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  comment?: string;

  @ApiPropertyOptional({ description: 'Academic module comment (max 2000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  academicComment?: string;

  @ApiPropertyOptional({ description: 'Test scores module comment (max 2000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  testComment?: string;

  @ApiPropertyOptional({ description: 'Activities module comment (max 2000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  activityComment?: string;

  @ApiPropertyOptional({ description: 'Awards module comment (max 2000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  awardComment?: string;

  @ApiPropertyOptional({ description: 'Review tags', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Review status',
    enum: ['DRAFT', 'PUBLISHED'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: 'DRAFT' | 'PUBLISHED';

  // ===== Hall refactor Phase 1: Tinder-style swipe review fields (all optional, backward compatible) =====

  @ApiPropertyOptional({
    description: 'Review method: CLASSIC (legacy slider) or SWIPE (Tinder UI)',
    enum: ReviewMethod,
    default: ReviewMethod.CLASSIC,
  })
  @IsOptional()
  @IsEnum(ReviewMethod)
  reviewMethod?: ReviewMethod;

  @ApiPropertyOptional({
    description:
      'Swipe metadata: { directionsPerStep: { academic|test|activity|award: "left"|"right"|"up" }, ... }',
  })
  @IsOptional()
  @IsObject()
  swipeData?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Reviewer confidence 1-100 (derived from drag distance)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  reviewerConfidence?: number;

  @ApiPropertyOptional({
    description: 'Strength/weakness multi-select tags',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  quickTags?: string[];
}

export class CreateUserListDto {
  @ApiProperty({ description: 'List title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'List description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'List category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'List items', type: [Object] })
  @IsArray()
  items: unknown[];

  @ApiPropertyOptional({
    description: 'Whether the list is public',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateUserListDto {
  @ApiPropertyOptional({ description: 'List title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'List description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'List category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'List items', type: [Object] })
  @IsOptional()
  @IsArray()
  items?: unknown[];

  @ApiPropertyOptional({ description: 'Whether the list is public' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class VoteListDto {
  @ApiProperty({
    description: 'Vote value (1 for upvote, -1 for downvote)',
    enum: [1, -1],
  })
  @IsInt()
  @Min(-1)
  @Max(1)
  value: 1 | -1;
}

export class BatchRankingDto {
  @ApiProperty({ description: 'Array of school IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  schoolIds: string[];
}

/**
 * Hall refactor Stage 3 — Verified China Admit Dashboard query.
 * `schoolIds` accepts a comma-separated string (query param friendly);
 * empty → backend resolves to top-30 schools by US News rank.
 */
export class VerifiedDashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Comma-separated school IDs (empty → top 30)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : Array.isArray(value)
        ? value
        : [],
  )
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  @MaxLength(64, { each: true })
  schoolIds: string[] = [];

  @ApiPropertyOptional({
    description: 'Number of recent application cycles to include',
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  years?: number;

  @ApiPropertyOptional({ description: 'Application cycle year (ED/RD view)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export * from './verified-ranking.dto';
export * from './hall-reaction.dto';
