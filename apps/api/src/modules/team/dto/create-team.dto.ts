import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsArray,
  ArrayMaxSize,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TeamVisibility, TeamJoinPolicy } from '@prisma/client';

export class CreateTeamDto {
  @ApiProperty({ description: 'Team name', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Team description', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Visibility', enum: TeamVisibility })
  @IsEnum(TeamVisibility)
  visibility: TeamVisibility;

  @ApiProperty({ description: 'Join policy', enum: TeamJoinPolicy })
  @IsEnum(TeamJoinPolicy)
  joinPolicy: TeamJoinPolicy;

  @ApiPropertyOptional({ description: 'Max members (2-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  maxMembers?: number;

  @ApiPropertyOptional({ description: 'School ID' })
  @IsOptional()
  @MaxLength(500)
  @IsString()
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Tags (max 10, each max 50 chars)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @ArrayMaxSize(10)
  tags?: string[];
}
