import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Type, Transform } from 'class-transformer';

export enum SchoolType {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export class SchoolQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: '国家代码' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '州/省' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: '地区 (northeast/midwest/south/west)' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ description: '最低排名' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  rankMin?: number;

  @ApiPropertyOptional({ description: '最高排名' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(500)
  rankMax?: number;

  @ApiPropertyOptional({ description: '最低录取率 (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acceptanceMin?: number;

  @ApiPropertyOptional({ description: '最高录取率 (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  acceptanceMax?: number;

  @ApiPropertyOptional({ description: '最低学费 (美元)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tuitionMin?: number;

  @ApiPropertyOptional({ description: '最高学费 (美元)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tuitionMax?: number;

  @ApiPropertyOptional({ description: '最少学生人数' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sizeMin?: number;

  @ApiPropertyOptional({ description: '最多学生人数' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sizeMax?: number;

  @ApiPropertyOptional({
    description: '学校类型 (public/private)',
    enum: SchoolType,
  })
  @IsOptional()
  @IsEnum(SchoolType)
  schoolType?: SchoolType;

  @ApiPropertyOptional({ description: '是否 Test Optional' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  testOptional?: boolean;

  @ApiPropertyOptional({ description: '是否 Need Blind' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  needBlind?: boolean;

  @ApiPropertyOptional({ description: '是否提供 Early Decision' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasEarlyDecision?: boolean;
}
