import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TeamVisibility, TeamJoinPolicy } from '@prisma/client';

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
  @IsString()
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Filter by visibility',
    enum: TeamVisibility,
  })
  @IsOptional()
  @IsEnum(TeamVisibility)
  visibility?: TeamVisibility;

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
  sort?: 'newest' | 'members';
}
