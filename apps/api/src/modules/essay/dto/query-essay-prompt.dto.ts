import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { EssayType, EssayStatus } from '../../../common/types/enums';

function parseOptionalInteger(value: unknown): number {
  return Number.parseInt(String(value), 10);
}

export class QueryEssayPromptDto {
  @ApiPropertyOptional({ description: 'School ID' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Application year' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ enum: EssayType, description: 'Essay type' })
  @IsOptional()
  @IsEnum(EssayType)
  type?: EssayType;

  @ApiPropertyOptional({ enum: EssayStatus, description: 'Review status' })
  @IsOptional()
  @IsEnum(EssayStatus)
  status?: EssayStatus;

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseOptionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
