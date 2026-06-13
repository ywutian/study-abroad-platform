import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SourceType } from '../../../common/types/enums';

export class ScrapeSchoolDto {
  @ApiProperty({ description: 'School name to scrape' })
  @IsString()
  @MaxLength(500)
  schoolName: string;

  @ApiPropertyOptional({ description: 'Application year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({
    description: 'Source types to scrape from',
    enum: SourceType,
    isArray: true,
  })
  @IsOptional()
  // @arraysize-uncapped-allowed: POST /admin/essay-scraper/scrape is @Roles-gated admin tooling;
  // sources is the small fixed SourceType enum set.
  @IsArray()
  @IsEnum(SourceType, { each: true })
  sources?: SourceType[];
}

export class StartPipelineDto {
  @ApiPropertyOptional({ description: 'Application year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;
}
