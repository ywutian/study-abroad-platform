import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class PaginatedResponseDto<T, M = undefined> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  meta?: M;
}

export function createPaginatedResponse<T, M = undefined>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  meta?: M,
): PaginatedResponseDto<T, M> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    ...(meta !== undefined && { meta }),
  };
}
