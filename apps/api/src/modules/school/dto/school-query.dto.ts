import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Type, Transform } from 'class-transformer';

export enum SchoolType {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export class SchoolQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Country code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ description: 'State/province' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  state?: string;

  @ApiPropertyOptional({ description: 'Region (northeast/midwest/south/west)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  region?: string;

  @ApiPropertyOptional({ description: 'Minimum rank' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  rankMin?: number;

  @ApiPropertyOptional({ description: 'Maximum rank' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(500)
  rankMax?: number;

  @ApiPropertyOptional({ description: 'Minimum acceptance rate (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acceptanceMin?: number;

  @ApiPropertyOptional({ description: 'Maximum acceptance rate (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  acceptanceMax?: number;

  @ApiPropertyOptional({ description: 'Minimum tuition (USD)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tuitionMin?: number;

  @ApiPropertyOptional({ description: 'Maximum tuition (USD)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tuitionMax?: number;

  @ApiPropertyOptional({ description: 'Minimum student count' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sizeMin?: number;

  @ApiPropertyOptional({ description: 'Maximum student count' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sizeMax?: number;

  @ApiPropertyOptional({
    description: 'School type (public/private)',
    enum: SchoolType,
  })
  @IsOptional()
  @IsEnum(SchoolType)
  schoolType?: SchoolType;

  @ApiPropertyOptional({ description: 'Whether test optional' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  testOptional?: boolean;

  @ApiPropertyOptional({ description: 'Whether need-blind' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  needBlind?: boolean;

  @ApiPropertyOptional({ description: 'Whether Early Decision is offered' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasEarlyDecision?: boolean;
}
