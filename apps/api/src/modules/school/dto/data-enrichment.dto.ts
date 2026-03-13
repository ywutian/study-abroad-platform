import {
  IsInt,
  IsOptional,
  Min,
  Max,
  MaxLength,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DataEnrichmentDto {
  @ApiPropertyOptional({
    description: 'Maximum number of schools to process (1-2000, default 100)',
    minimum: 1,
    maximum: 2000,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Year for data sync (defaults to previous year)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class ScrapeEnrichmentDto {
  @ApiPropertyOptional({
    description: 'Maximum number of schools to scrape (1-500, default 100)',
    minimum: 1,
    maximum: 500,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class EnrichmentRunDto {
  @ApiPropertyOptional({
    description:
      'Data sources to run (comma-separated: urban,bigfuture,appily). Default: all',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sources?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of schools per source (1-500, default 100)',
    minimum: 1,
    maximum: 500,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
