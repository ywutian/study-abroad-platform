import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EssayType } from '../../../common/types/enums';

export class BatchImportEssayPromptItemDto {
  @ApiProperty({
    description: 'School name (supports abbreviations like MIT, Stanford)',
  })
  @IsString()
  @MaxLength(200)
  school: string;

  @ApiProperty({ description: 'Application year', example: 2025 })
  @IsInt()
  @Min(2020)
  @Max(2030)
  year: number;

  @ApiProperty({ enum: EssayType, description: 'Essay type' })
  @IsEnum(EssayType)
  type: EssayType;

  @ApiProperty({ description: 'English original text' })
  @IsString()
  @MaxLength(5000)
  prompt: string;

  @ApiPropertyOptional({ description: 'Chinese translation' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  promptZh?: string;

  @ApiPropertyOptional({ description: 'Word limit' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  wordLimit?: number;

  @ApiPropertyOptional({ description: 'Whether required', default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Source URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;
}

export class BatchImportEssayPromptDto {
  @ApiProperty({
    type: [BatchImportEssayPromptItemDto],
    description: 'Batch import data',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchImportEssayPromptItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  items: BatchImportEssayPromptItemDto[];

  @ApiPropertyOptional({
    description: 'Whether to auto-mark as verified',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoVerify?: boolean;
}
