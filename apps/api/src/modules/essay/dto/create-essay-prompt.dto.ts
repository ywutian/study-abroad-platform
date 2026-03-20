import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EssayType, SourceType } from '../../../common/types/enums';

export class CreateEssayPromptDto {
  @ApiProperty({ description: 'School ID' })
  @IsString()
  @MaxLength(200)
  schoolId: string;

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

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: SourceType, description: 'Data source' })
  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;

  @ApiPropertyOptional({ description: 'Source URL' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string;
}
