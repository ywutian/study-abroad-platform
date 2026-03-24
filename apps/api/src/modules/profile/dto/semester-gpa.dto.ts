import {
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSemesterGpaDto {
  @ApiProperty({ description: 'Semester name', example: 'Fall' })
  @IsString()
  @MaxLength(50)
  semester: string;

  @ApiProperty({ description: 'Academic year', example: 2025 })
  @IsInt()
  @Type(() => Number)
  @Min(2000)
  @Max(2035)
  year: number;

  @ApiProperty({ description: 'GPA value', example: 3.8 })
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  gpa: number;

  @ApiProperty({ description: 'GPA scale', example: 4.0 })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  gpaScale: number;

  @ApiPropertyOptional({ description: 'Number of credits', example: 15 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  credits?: number;

  @ApiPropertyOptional({ description: 'Sort order' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  order?: number;
}

export class UpdateSemesterGpaDto extends PartialType(CreateSemesterGpaDto) {}

export class UpdateGpaByGradeDto {
  @ApiPropertyOptional({ description: 'Grade 9 GPA', example: 3.5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  gpa9?: number;

  @ApiPropertyOptional({ description: 'Grade 10 GPA', example: 3.6 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  gpa10?: number;

  @ApiPropertyOptional({ description: 'Grade 11 GPA', example: 3.8 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  gpa11?: number;

  @ApiPropertyOptional({ description: 'Grade 12 GPA', example: 3.9 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  gpa12?: number;
}
