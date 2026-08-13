import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsObject,
  IsArray,
  MaxLength,
  ArrayMaxSize,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSchoolEssaySourceDto {
  @ApiProperty({ description: 'School ID' })
  @IsString()
  @MaxLength(200)
  schoolId: string;

  @ApiProperty({ description: 'Source type', example: 'OFFICIAL' })
  @IsString()
  @MaxLength(200)
  sourceType: string;

  @ApiProperty({ description: 'Scraping URL' })
  @IsString()
  @MaxLength(2048)
  url: string;

  @ApiPropertyOptional({ description: 'CollegeVine slug' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Scrape group',
    default: 'GENERIC',
    example: 'COMMON_APP',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  scrapeGroup?: string;

  @ApiPropertyOptional({
    description: 'Priority (higher = preferred)',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({
    description: 'Targeted scraping configuration',
    example: {
      cssSelectors: ['.essay-prompt'],
      llmHint: 'Essays listed under h3 headings',
    },
  })
  @IsOptional()
  @IsObject()
  scrapeConfig?: Record<string, unknown>;
}

export class UpdateSchoolEssaySourceDto {
  @ApiPropertyOptional({ description: 'Scraping URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional({ description: 'CollegeVine slug' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @ApiPropertyOptional({ description: 'Scrape group' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  scrapeGroup?: string;

  @ApiPropertyOptional({ description: 'Whether enabled' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Priority' })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ description: 'Targeted scraping configuration' })
  @IsOptional()
  @IsObject()
  scrapeConfig?: Record<string, any>;
}

export class TestScrapeDto {
  @ApiProperty({ description: 'School name' })
  @IsString()
  @MaxLength(200)
  schoolName: string;

  @ApiPropertyOptional({ description: 'Target year' })
  @IsOptional()
  @IsInt()
  year?: number;
}

export class ConfirmSaveDto {
  @ApiProperty({ description: 'Full data returned from test scrape' })
  @IsObject()
  data: import('../essay-scraper.service').TestScrapeResult;

  @ApiPropertyOptional({
    description: 'Selected prompt indices (saves all if not provided)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  // @arraysize-literal-allowed: admin essay-source confirm, bounded by the fetched candidate list
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(0, { each: true })
  selectedIndices?: number[];
}
