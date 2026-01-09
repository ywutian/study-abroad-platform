import { IsString, IsOptional, IsNumber, IsDateString, Min, Max, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEducationDto {
  @ApiProperty({ description: '学校名称' })
  @IsString()
  @MaxLength(200)
  schoolName: string;

  @ApiPropertyOptional({ description: '学校类型 (HIGH_SCHOOL / COLLEGE / etc.)' })
  @IsOptional()
  @IsString()
  schoolType?: string;

  @ApiPropertyOptional({ description: '学位' })
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional({ description: '专业' })
  @IsOptional()
  @IsString()
  major?: string;

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa?: number;

  @ApiPropertyOptional({ description: 'GPA满分' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  gpaScale?: number;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateEducationDto {
  @ApiPropertyOptional({ description: '学校名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  schoolName?: string;

  @ApiPropertyOptional({ description: '学校类型' })
  @IsOptional()
  @IsString()
  schoolType?: string;

  @ApiPropertyOptional({ description: '学位' })
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional({ description: '专业' })
  @IsOptional()
  @IsString()
  major?: string;

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'GPA' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  gpa?: number;

  @ApiPropertyOptional({ description: 'GPA满分' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  gpaScale?: number;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;
}









