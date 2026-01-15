import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EssayType } from '../../../common/types/enums';

export class UpdateEssayPromptDto {
  @ApiPropertyOptional({ enum: EssayType, description: '文书类型' })
  @IsOptional()
  @IsEnum(EssayType)
  type?: EssayType;

  @ApiPropertyOptional({ description: '英文原文' })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional({ description: '中文翻译' })
  @IsOptional()
  @IsString()
  promptZh?: string;

  @ApiPropertyOptional({ description: '字数限制' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  wordLimit?: number;

  @ApiPropertyOptional({ description: '是否必填' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: '排序顺序' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'AI 写作建议' })
  @IsOptional()
  @IsString()
  aiTips?: string;

  @ApiPropertyOptional({ description: 'AI 分类标签' })
  @IsOptional()
  @IsString()
  aiCategory?: string;
}
