import {
  IsString,
  IsInt,
  IsOptional,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const AWARD_LEVELS = ['SCHOOL', 'REGIONAL', 'STATE', 'NATIONAL', 'INTERNATIONAL'] as const;

export class CreateAwardDto {
  @ApiProperty({ description: '奖项名称', example: 'AMC 12 满分' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: AWARD_LEVELS, description: '奖项级别' })
  @IsIn(AWARD_LEVELS)
  level: string;

  @ApiPropertyOptional({ description: '获奖年份', example: 2025 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @Max(2030)
  year?: number;

  @ApiPropertyOptional({ description: '奖项描述' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '排序顺序' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  order?: number;
}

export class UpdateAwardDto {
  @ApiPropertyOptional({ description: '奖项名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: AWARD_LEVELS })
  @IsOptional()
  @IsIn(AWARD_LEVELS)
  level?: string;

  @ApiPropertyOptional({ description: '获奖年份' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @Max(2030)
  year?: number;

  @ApiPropertyOptional({ description: '奖项描述' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '排序顺序' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  order?: number;
}




