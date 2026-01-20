import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsObject,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSchoolEssaySourceDto {
  @ApiProperty({ description: '学校 ID' })
  @IsString()
  schoolId: string;

  @ApiProperty({ description: '来源类型', example: 'OFFICIAL' })
  @IsString()
  sourceType: string;

  @ApiProperty({ description: '采集 URL' })
  @IsString()
  url: string;

  @ApiPropertyOptional({ description: 'CollegeVine slug' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description: '采集分组',
    default: 'GENERIC',
    example: 'COMMON_APP',
  })
  @IsOptional()
  @IsString()
  scrapeGroup?: string;

  @ApiPropertyOptional({ description: '优先级 (高=优先)', default: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({
    description: '针对性采集配置',
    example: {
      cssSelectors: ['.essay-prompt'],
      llmHint: 'Essays listed under h3 headings',
    },
  })
  @IsOptional()
  @IsObject()
  scrapeConfig?: Record<string, any>;
}

export class UpdateSchoolEssaySourceDto {
  @ApiPropertyOptional({ description: '采集 URL' })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'CollegeVine slug' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ description: '采集分组' })
  @IsOptional()
  @IsString()
  scrapeGroup?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '优先级' })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ description: '针对性采集配置' })
  @IsOptional()
  @IsObject()
  scrapeConfig?: Record<string, any>;
}

export class TestScrapeDto {
  @ApiProperty({ description: '学校名称' })
  @IsString()
  schoolName: string;

  @ApiPropertyOptional({ description: '目标年份' })
  @IsOptional()
  @IsInt()
  year?: number;
}

export class ConfirmSaveDto {
  @ApiProperty({ description: '测试采集返回的完整数据' })
  @IsObject()
  data: any;

  @ApiPropertyOptional({
    description: '选中的题目索引（不传则全部保存）',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  selectedIndices?: number[];
}
