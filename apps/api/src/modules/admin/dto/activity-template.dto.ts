import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  IsEnum,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ActivityCategory } from '@prisma/client';

export class CreateActivityTemplateDto {
  @ApiProperty()
  @MaxLength(200)
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @MaxLength(200)
  @IsString()
  nameZh?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  aliases?: string[];

  @ApiProperty({ enum: ActivityCategory })
  @IsEnum(ActivityCategory)
  category: ActivityCategory;

  @ApiProperty({ minimum: 1, maximum: 4, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  tier?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @MaxLength(2000)
  @IsString()
  description?: string;
}

export class UpdateActivityTemplateDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @MaxLength(200)
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @MaxLength(200)
  @IsString()
  nameZh?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  aliases?: string[];

  @ApiProperty({ enum: ActivityCategory, required: false })
  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;

  @ApiProperty({ minimum: 1, maximum: 4, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  tier?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @MaxLength(2000)
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ActivityTemplateQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @MaxLength(500)
  @IsString()
  search?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  tier?: number;

  @ApiProperty({ enum: ActivityCategory, required: false })
  @IsOptional()
  @IsEnum(ActivityCategory)
  category?: ActivityCategory;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
