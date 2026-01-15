import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EssayType, SourceType } from '../../../common/types/enums';

export class CreateEssayPromptDto {
  @ApiProperty({ description: '学校ID' })
  @IsString()
  schoolId: string;

  @ApiProperty({ description: '申请年份', example: 2025 })
  @IsInt()
  @Min(2020)
  @Max(2030)
  year: number;

  @ApiProperty({ enum: EssayType, description: '文书类型' })
  @IsEnum(EssayType)
  type: EssayType;

  @ApiProperty({ description: '英文原文' })
  @IsString()
  prompt: string;

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

  @ApiPropertyOptional({ description: '是否必填', default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: '排序顺序', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ enum: SourceType, description: '数据来源' })
  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;

  @ApiPropertyOptional({ description: '来源URL' })
  @IsOptional()
  @IsString()
  sourceUrl?: string;
}
