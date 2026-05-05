import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min, Max } from 'class-validator';

/**
 * Weights for the four numeric ranking dimensions plus four Niche
 * lifestyle/fit dimensions. Each weight is a percentage 0-100 and the
 * server normalizes the total to 100 before scoring.
 *
 * Niche grades are qualitative fit signals (lifestyle / wellbeing),
 * not predictors of admission probability — they only affect ranking.
 */
export class CalculateRankingDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  usNewsRank!: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  acceptanceRate!: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  tuition!: number;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  avgSalary!: number;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    required: false,
    description: 'Niche overall composite grade weight',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  nicheOverall?: number;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    required: false,
    description: 'Niche campus safety grade weight',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  safetyGrade?: number;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    required: false,
    description: 'Niche student life grade weight',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  studentLifeGrade?: number;

  @ApiProperty({
    minimum: 0,
    maximum: 100,
    required: false,
    description: 'Niche campus food grade weight',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  campusFoodGrade?: number;
}
