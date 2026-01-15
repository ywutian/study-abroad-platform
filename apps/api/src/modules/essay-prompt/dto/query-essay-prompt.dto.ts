import { IsString, IsInt, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { EssayType, EssayStatus } from '../../../common/types/enums';

export class QueryEssayPromptDto {
  @ApiPropertyOptional({ description: '学校ID' })
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiPropertyOptional({ description: '申请年份' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ enum: EssayType, description: '文书类型' })
  @IsOptional()
  @IsEnum(EssayType)
  type?: EssayType;

  @ApiPropertyOptional({ enum: EssayStatus, description: '审核状态' })
  @IsOptional()
  @IsEnum(EssayStatus)
  status?: EssayStatus;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
