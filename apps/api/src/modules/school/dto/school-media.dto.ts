import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  SchoolMediaSourceType,
  SchoolMediaStatus,
  SchoolMediaType,
} from '@prisma/client';

function commaList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.flatMap((item) => commaList(item) ?? []);
  }
  if (typeof value !== 'string') return undefined;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class SchoolMediaDiscoverDto {
  @ApiPropertyOptional({
    description: 'Maximum schools to process',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Comma-separated sources: official,wikimedia',
    default: 'official,wikimedia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;

  @ApiPropertyOptional({ description: 'Process a single school id' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  schoolId?: string;

  @ApiPropertyOptional({ description: 'Preview only; do not write database' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  dryRun?: boolean;
}

export class SchoolMediaListQueryDto {
  @ApiPropertyOptional({ enum: SchoolMediaType })
  @IsOptional()
  @IsEnum(SchoolMediaType)
  type?: SchoolMediaType;

  @ApiPropertyOptional({ enum: SchoolMediaStatus })
  @IsOptional()
  @IsEnum(SchoolMediaStatus)
  status?: SchoolMediaStatus;

  @ApiPropertyOptional({ enum: SchoolMediaSourceType })
  @IsOptional()
  @IsEnum(SchoolMediaSourceType)
  sourceType?: SchoolMediaSourceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  schoolId?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class SchoolMediaActionDto {
  @ApiPropertyOptional({ description: 'Optional admin reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export function parseSchoolMediaSources(
  value?: string,
): Array<'official' | 'wikimedia'> {
  const parsed = commaList(value) ?? ['official', 'wikimedia'];
  return parsed.filter(
    (source): source is 'official' | 'wikimedia' =>
      source === 'official' || source === 'wikimedia',
  );
}
