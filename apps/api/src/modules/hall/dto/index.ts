import {
  IsString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsBoolean,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ description: 'General comment' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Academic module comment' })
  @IsOptional()
  @IsString()
  academicComment?: string;

  @ApiPropertyOptional({ description: 'Test scores module comment' })
  @IsOptional()
  @IsString()
  testComment?: string;

  @ApiPropertyOptional({ description: 'Activities module comment' })
  @IsOptional()
  @IsString()
  activityComment?: string;

  @ApiPropertyOptional({ description: 'Awards module comment' })
  @IsOptional()
  @IsString()
  awardComment?: string;

  @ApiPropertyOptional({ description: 'Review tags', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Review status',
    enum: ['DRAFT', 'PUBLISHED'],
  })
  @IsOptional()
  @IsString()
  status?: 'DRAFT' | 'PUBLISHED';
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

export * from './verified-ranking.dto';
