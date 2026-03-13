import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';

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
    enum: ['COLLEGE_APPLICATION', 'INTERNSHIP', 'GRADUATE_CV'],
  })
  @IsOptional()
  @IsEnum(['COLLEGE_APPLICATION', 'INTERNSHIP', 'GRADUATE_CV'] as const)
  type?: 'COLLEGE_APPLICATION' | 'INTERNSHIP' | 'GRADUATE_CV';

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
}
