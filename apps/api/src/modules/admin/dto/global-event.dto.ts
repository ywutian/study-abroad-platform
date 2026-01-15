import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  IsEnum,
  Min,
} from 'class-validator';
import { GlobalEventCategory } from '@prisma/client';

export class CreateGlobalEventDto {
  @ApiProperty({ description: '事件标题（英文）' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: '事件标题（中文）' })
  @IsString()
  @IsOptional()
  titleZh?: string;

  @ApiProperty({ enum: GlobalEventCategory })
  @IsEnum(GlobalEventCategory)
  category: GlobalEventCategory;

  @ApiProperty({ description: '事件日期' })
  @IsDateString()
  eventDate: string;

  @ApiPropertyOptional({ description: '报名截止' })
  @IsDateString()
  @IsOptional()
  registrationDeadline?: string;

  @ApiPropertyOptional({ description: '晚报名截止' })
  @IsDateString()
  @IsOptional()
  lateDeadline?: string;

  @ApiPropertyOptional({ description: '出分日期' })
  @IsDateString()
  @IsOptional()
  resultDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descriptionZh?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  url?: string;

  @ApiProperty({ description: '年份' })
  @IsInt()
  @Min(2020)
  year: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;
}

export class UpdateGlobalEventDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  titleZh?: string;

  @ApiPropertyOptional({ enum: GlobalEventCategory })
  @IsEnum(GlobalEventCategory)
  @IsOptional()
  category?: GlobalEventCategory;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  eventDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  registrationDeadline?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  lateDeadline?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  resultDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descriptionZh?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  year?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
