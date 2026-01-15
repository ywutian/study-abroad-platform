import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsUrl,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSchoolDto {
  @ApiProperty({ description: 'School name in English' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'School name in Chinese' })
  @IsOptional()
  @IsString()
  nameZh?: string;

  @ApiPropertyOptional({ description: 'Country code', default: 'US' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'State/Province' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'US News ranking' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usNewsRank?: number;

  @ApiPropertyOptional({ description: 'QS World ranking' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qsRank?: number;

  @ApiPropertyOptional({ description: 'Acceptance rate (0-100)', example: 5.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  acceptanceRate?: number;

  @ApiPropertyOptional({ description: 'Annual tuition in USD' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tuition?: number;

  @ApiPropertyOptional({ description: 'Average salary after graduation' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  avgSalary?: number;

  @ApiPropertyOptional({ description: 'Total enrollment' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalEnrollment?: number;

  @ApiPropertyOptional({ description: 'Average SAT score' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(400)
  @Max(1600)
  satAvg?: number;

  @ApiPropertyOptional({ description: 'SAT 25th percentile (combined)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(400)
  @Max(1600)
  sat25?: number;

  @ApiPropertyOptional({ description: 'SAT 75th percentile (combined)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(400)
  @Max(1600)
  sat75?: number;

  @ApiPropertyOptional({ description: 'SAT Math 25th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(800)
  satMath25?: number;

  @ApiPropertyOptional({ description: 'SAT Math 75th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(800)
  satMath75?: number;

  @ApiPropertyOptional({ description: 'SAT ERW 25th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(800)
  satReading25?: number;

  @ApiPropertyOptional({ description: 'SAT ERW 75th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(800)
  satReading75?: number;

  @ApiPropertyOptional({ description: 'Average ACT score' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  actAvg?: number;

  @ApiPropertyOptional({ description: 'ACT 25th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  act25?: number;

  @ApiPropertyOptional({ description: 'ACT 75th percentile' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  act75?: number;

  @ApiPropertyOptional({ description: 'Total student population' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  studentCount?: number;

  @ApiPropertyOptional({ description: 'Graduation rate (0-100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  graduationRate?: number;

  @ApiPropertyOptional({ description: 'Is private institution' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPrivate?: boolean;

  @ApiPropertyOptional({ description: 'Niche safety grade (e.g., A+, A, B+)' })
  @IsOptional()
  @IsString()
  nicheSafetyGrade?: string;

  @ApiPropertyOptional({ description: 'Niche campus life grade' })
  @IsOptional()
  @IsString()
  nicheLifeGrade?: string;

  @ApiPropertyOptional({ description: 'Niche food grade' })
  @IsOptional()
  @IsString()
  nicheFoodGrade?: string;

  @ApiPropertyOptional({ description: 'Niche overall grade' })
  @IsOptional()
  @IsString()
  nicheOverallGrade?: string;

  @ApiPropertyOptional({ description: 'School website URL' })
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional({ description: 'School logo URL' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Description in English' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Description in Chinese' })
  @IsOptional()
  @IsString()
  descriptionZh?: string;
}
