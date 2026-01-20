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
import { Visibility, EssayType } from '@prisma/client';

export class BatchImportCaseItemDto {
  @ApiProperty({ description: '学校名称（支持缩写如 MIT, Stanford）' })
  @IsString()
  school: string;

  @ApiPropertyOptional({ description: '申请专业' })
  @IsOptional()
  @IsString()
  major?: string;

  @ApiProperty({ description: '申请年份', example: 2025 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({ description: '申请轮次 ED/EA/RD 等' })
  @IsOptional()
  @IsString()
  round?: string;

  @ApiProperty({ description: '录取结果（支持中英文缩写）' })
  @IsString()
  result: string;

  @ApiPropertyOptional({ description: 'GPA 或范围', example: '3.9-4.0' })
  @IsOptional()
  @IsString()
  gpa?: string;

  @ApiPropertyOptional({ description: 'SAT 成绩或范围', example: '1550-1600' })
  @IsOptional()
  @IsString()
  sat?: string;

  @ApiPropertyOptional({ description: 'ACT 成绩或范围' })
  @IsOptional()
  @IsString()
  act?: string;

  @ApiPropertyOptional({ description: 'TOEFL 成绩或范围' })
  @IsOptional()
  @IsString()
  toefl?: string;

  @ApiPropertyOptional({
    description: '标签，分号分隔',
    example: 'research;olympiad',
  })
  @IsOptional()
  @IsString()
  tags?: string;

  @ApiPropertyOptional({ description: '文书类型' })
  @IsOptional()
  @IsString()
  essayType?: string;

  @ApiPropertyOptional({ description: '文书题目' })
  @IsOptional()
  @IsString()
  essayPrompt?: string;

  @ApiPropertyOptional({ description: '文书内容' })
  @IsOptional()
  @IsString()
  essayContent?: string;
}

export class BatchImportCaseDto {
  @ApiProperty({
    type: [BatchImportCaseItemDto],
    description: '批量导入数据',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchImportCaseItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  items: BatchImportCaseItemDto[];

  @ApiPropertyOptional({
    enum: Visibility,
    description: '默认可见性',
    default: 'ANONYMOUS',
  })
  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @ApiPropertyOptional({
    description: '是否自动标记为已验证',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoVerify?: boolean;
}

export class ReviewCaseEssayDto {
  @ApiProperty({
    enum: ['APPROVE', 'REJECT'],
    description: '审核操作',
  })
  @IsString()
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ description: '拒绝原因' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BatchVerifyCaseDto {
  @ApiProperty({ description: '案例 ID 列表' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  ids: string[];

  @ApiProperty({
    enum: ['APPROVE', 'REJECT'],
    description: '审核操作',
  })
  @IsString()
  action: 'APPROVE' | 'REJECT';

  @ApiPropertyOptional({ description: '原因' })
  @IsOptional()
  @IsString()
  reason?: string;
}
