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
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

// Hall §7 Decision B: CreateReviewDto, ReportReviewDto, QualificationAnswerDto,
// SubmitQualificationDto and ReviewCoachRequestDto were removed when the
// peer-review subsystem was retired.

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
  // @arraysize-literal-allowed: optional dashboard filter (default empty → top-30); current
  // consumers send an empty list, and a populated source would be the bounded compare picker — a
  // deliberate generous 50 cap, not a user-curated free-form list.
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
export * from './hall-misc.dto';
