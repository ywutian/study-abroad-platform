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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EssayType } from '../../../common/types/enums';

export class UpdateEssayPromptDto {
  @ApiPropertyOptional({ enum: EssayType, description: 'Essay type' })
  @IsOptional()
  @IsEnum(EssayType)
  type?: EssayType;

  @ApiPropertyOptional({ description: 'English original text' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  prompt?: string;

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

  @ApiPropertyOptional({ description: 'Whether required' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'AI writing tips' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  aiTips?: string;

  @ApiPropertyOptional({ description: 'AI category tag' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  aiCategory?: string;
}
