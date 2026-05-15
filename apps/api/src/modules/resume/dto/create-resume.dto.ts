import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  IsObject,
  IsArray,
} from 'class-validator';

export class ResumeTargetContextDto {
  @IsOptional() @IsString() @MaxLength(500) targetSchool?: string;
  @IsOptional() @IsString() @MaxLength(500) targetMajor?: string;
  @IsOptional() @IsString() @MaxLength(100) applicationRound?: string;
  @IsOptional() @IsString() @MaxLength(500) programName?: string;
  @IsOptional() @IsString() @MaxLength(500) researchArea?: string;
  @IsOptional() @IsString() @MaxLength(500) advisorName?: string;
  @IsOptional() @IsString() @MaxLength(500) labName?: string;
  @IsOptional() @IsString() @MaxLength(500) targetRole?: string;
  @IsOptional() @IsString() @MaxLength(500) company?: string;
  @IsOptional() @IsString() @MaxLength(6000) jobDescription?: string;
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keywords?: string[];
}

export class CreateResumeDto {
  @ApiProperty({
    description: 'Resume title',
    example: 'MIT Application Resume',
  })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({
    description: 'Resume type',
    enum: ['COLLEGE_APPLICATION', 'INTERNSHIP', 'GRADUATE_CV', 'FULL_TIME_JOB'],
  })
  @IsOptional()
  @IsEnum([
    'COLLEGE_APPLICATION',
    'INTERNSHIP',
    'GRADUATE_CV',
    'FULL_TIME_JOB',
  ] as const)
  type?: 'COLLEGE_APPLICATION' | 'INTERNSHIP' | 'GRADUATE_CV' | 'FULL_TIME_JOB';

  @ApiPropertyOptional({
    description: 'Resume family',
    enum: ['STUDY_ABROAD', 'CAREER'],
  })
  @IsOptional()
  @IsEnum(['STUDY_ABROAD', 'CAREER'] as const)
  family?: 'STUDY_ABROAD' | 'CAREER';

  @ApiPropertyOptional({
    description: 'Resume variant kind',
    enum: ['MASTER', 'TAILORED'],
  })
  @IsOptional()
  @IsEnum(['MASTER', 'TAILORED'] as const)
  variantKind?: 'MASTER' | 'TAILORED';

  @ApiPropertyOptional({ description: 'Target ID for tailored resume' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  targetId?: string;

  @ApiPropertyOptional({ description: 'Base resume ID for tailored resume' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseResumeId?: string;

  @ApiPropertyOptional({ description: 'Template ID', example: 'jake-classic' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  templateId?: string;

  @ApiPropertyOptional({ description: 'Language', enum: ['en', 'zh'] })
  @IsOptional()
  @IsEnum(['en', 'zh'] as const)
  language?: 'en' | 'zh';

  @ApiPropertyOptional({ description: 'Import data from profile on creation' })
  @IsOptional()
  @IsBoolean()
  importFromProfile?: boolean;

  @ApiPropertyOptional({
    description: 'Target school, major, role, JD, or research context',
  })
  @IsOptional()
  @IsObject()
  targetContext?: ResumeTargetContextDto;
}
