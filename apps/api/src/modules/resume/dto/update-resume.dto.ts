import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  MaxLength,
} from 'class-validator';

export class UpdateResumeDto {
  @ApiPropertyOptional({ description: 'Resume title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Resume status',
    enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'ARCHIVED'] as const)
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

  @ApiPropertyOptional({ description: 'Template ID' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Language', enum: ['en', 'zh'] })
  @IsOptional()
  @IsEnum(['en', 'zh'] as const)
  language?: 'en' | 'zh';

  @ApiPropertyOptional({
    description: 'Template settings (fontSize, fontFamily, margins, etc.)',
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
