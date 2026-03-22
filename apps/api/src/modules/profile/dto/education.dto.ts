import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEducationDto {
  @ApiProperty({ description: 'School name' })
  @IsString()
  @MaxLength(200)
  schoolName: string;

  @ApiPropertyOptional({
    description: 'School type (HIGH_SCHOOL / COLLEGE / etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolType?: string;

  @ApiPropertyOptional({ description: 'Degree' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  degree?: string;

  @ApiPropertyOptional({ description: 'Major' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  major?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa?: number;

  @ApiPropertyOptional({ description: 'GPA scale maximum' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  gpaScale?: number;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Associated high school reference data ID',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  highSchoolId?: string;

  @ApiPropertyOptional({
    description:
      'GPA system (SCALE_4_UW, SCALE_4_W, SCALE_5, PCT_100, IB_45, A_LEVEL)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gpaSystem?: string;
}

export class UpdateEducationDto {
  @ApiPropertyOptional({ description: 'School name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;

  @ApiPropertyOptional({ description: 'School type' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolType?: string;

  @ApiPropertyOptional({ description: 'Degree' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  degree?: string;

  @ApiPropertyOptional({ description: 'Major' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  major?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa?: number;

  @ApiPropertyOptional({ description: 'GPA scale maximum' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  gpaScale?: number;

  @ApiPropertyOptional({ description: 'Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Associated high school reference data ID',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  highSchoolId?: string;

  @ApiPropertyOptional({
    description:
      'GPA system (SCALE_4_UW, SCALE_4_W, SCALE_5, PCT_100, IB_45, A_LEVEL)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gpaSystem?: string;
}
