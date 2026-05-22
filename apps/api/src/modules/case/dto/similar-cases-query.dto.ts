import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Query for `GET /cases/similar` — find admission cases similar to the
 * current user's profile (GPA / major / nationality match).
 */
export class SimilarCasesQueryDto {
  @ApiPropertyOptional({
    description: 'Restrict to one school (by School id). Omit for any school.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolId?: string;

  @ApiPropertyOptional({
    description: 'Max cases to return (1–20)',
    default: 10,
    minimum: 1,
    maximum: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
