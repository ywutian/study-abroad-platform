import { IsOptional, IsString, IsInt, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AdmissionResult } from '@prisma/client';

export class CaseQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @ApiPropertyOptional({ enum: AdmissionResult })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  highSchoolId?: string;

  @ApiPropertyOptional({
    description: 'Filter by application round (ED/EA/RD/UC etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  round?: string;

  @ApiPropertyOptional({ description: 'Filter by major' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  major?: string;

  @ApiPropertyOptional({ description: 'Filter by nationality' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;
}
