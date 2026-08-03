import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TeamJoinPolicy } from '@prisma/client';

export class TeamQueryDto {
  @ApiPropertyOptional({ description: 'Page (1-based)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by school ID' })
  @IsOptional()
  @MaxLength(500)
  @IsString()
  schoolId?: string;

  // `visibility` was a filter here and must not come back. This DTO feeds only
  // GET /teams, which is @Public(): accepting the value let an unauthenticated
  // caller ask for `?visibility=PRIVATE` and receive every private team, with
  // creators and member counts. discover() pins PUBLIC itself now — the fix is
  // the absence of this field, not a check somewhere downstream.

  @ApiPropertyOptional({
    description: 'Filter by join policy',
    enum: TeamJoinPolicy,
  })
  @IsOptional()
  @IsEnum(TeamJoinPolicy)
  joinPolicy?: TeamJoinPolicy;

  @ApiPropertyOptional({ description: 'Sort: newest | members' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sort?: 'newest' | 'members';
}
