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
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EssayType } from '../../../common/types/enums';

export class BatchImportEssayPromptItemDto {
  @ApiProperty({ description: '学校名称（支持缩写如 MIT, Stanford）' })
  @IsString()
  school: string;

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

  @ApiPropertyOptional({ description: '排序顺序' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '来源URL' })
  @IsOptional()
  @IsString()
  sourceUrl?: string;
}

export class BatchImportEssayPromptDto {
  @ApiProperty({
    type: [BatchImportEssayPromptItemDto],
    description: '批量导入数据',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchImportEssayPromptItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  items: BatchImportEssayPromptItemDto[];

  @ApiPropertyOptional({
    description: '是否自动标记为已审核',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoVerify?: boolean;
}
