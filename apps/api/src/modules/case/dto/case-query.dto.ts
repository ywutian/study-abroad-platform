import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AdmissionResult } from '@prisma/client';

export class CaseQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ enum: AdmissionResult })
  @IsOptional()
  @IsString()
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}



