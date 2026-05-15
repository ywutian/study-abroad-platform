import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsIn,
  MaxLength,
  Min,
  Max,
  Matches,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ResumeTargetContextDto } from './create-resume.dto';

// ─── Nested DTOs for Resume Settings validation ───

class ResumeColorSettingsDto {
  @IsOptional()
  @MaxLength(7)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  primary?: string;
  @IsOptional()
  @MaxLength(7)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  text?: string;
  @IsOptional()
  @MaxLength(7)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  textLight?: string;
  @IsOptional()
  @MaxLength(7)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  background?: string;
  @IsOptional()
  @MaxLength(7)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  border?: string;
  @IsOptional()
  @MaxLength(7)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  sidebarBg?: string;
  @IsOptional()
  @MaxLength(7)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  sidebarText?: string;
  @IsOptional()
  @MaxLength(7)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  headerBg?: string;
  @IsOptional()
  @MaxLength(7)
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  headerText?: string;
}

class ResumeFontSettingsDto {
  @IsOptional() @MaxLength(100) @IsString() heading?: string;
  @IsOptional() @MaxLength(100) @IsString() body?: string;
}

class ResumeFontSizeSettingsDto {
  @IsOptional() @IsNumber() @Min(16) @Max(32) name?: number;
  @IsOptional() @IsNumber() @Min(8) @Max(18) sectionTitle?: number;
  @IsOptional() @IsNumber() @Min(8) @Max(14) body?: number;
  @IsOptional() @IsNumber() @Min(7) @Max(12) small?: number;
}

class ResumeSpacingSettingsDto {
  @IsOptional() @IsNumber() @Min(18) @Max(72) pageMarginX?: number;
  @IsOptional() @IsNumber() @Min(18) @Max(72) pageMarginY?: number;
  @IsOptional() @IsNumber() @Min(4) @Max(24) sectionGap?: number;
  @IsOptional() @IsNumber() @Min(2) @Max(12) itemGap?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(2) lineHeight?: number;
}

class ResumeDecorationSettingsDto {
  @IsOptional()
  @IsIn(['line', 'double-line', 'dots', 'none'])
  sectionDivider?: string;
  @IsOptional()
  @IsIn(['underline', 'background', 'border-left', 'uppercase', 'plain'])
  headingStyle?: string;
  @IsOptional() @IsIn(['disc', 'dash', 'arrow', 'square']) bulletStyle?: string;
  @IsOptional() @IsIn(['LETTER', 'A4']) pageSize?: string;
  @IsOptional() @IsIn(['MMM YYYY', 'MM/YYYY', 'YYYY']) dateFormat?: string;
}

class ResumeSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ResumeColorSettingsDto)
  colors?: ResumeColorSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ResumeFontSettingsDto)
  fonts?: ResumeFontSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ResumeFontSizeSettingsDto)
  fontSize?: ResumeFontSizeSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ResumeSpacingSettingsDto)
  spacing?: ResumeSpacingSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ResumeDecorationSettingsDto)
  decorations?: ResumeDecorationSettingsDto;
}

// ─── Main DTO ───

export class UpdateResumeDto {
  @ApiPropertyOptional({ description: 'Resume title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Resume status',
    enum: ['DRAFT', 'ACTIVE', 'REVIEWED', 'APPROVED', 'EXPORTED', 'ARCHIVED'],
  })
  @IsOptional()
  @IsEnum([
    'DRAFT',
    'ACTIVE',
    'REVIEWED',
    'APPROVED',
    'EXPORTED',
    'ARCHIVED',
  ] as const)
  status?:
    | 'DRAFT'
    | 'ACTIVE'
    | 'REVIEWED'
    | 'APPROVED'
    | 'EXPORTED'
    | 'ARCHIVED';

  @ApiPropertyOptional({ description: 'Template ID' })
  @IsOptional()
  @MaxLength(100)
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Language', enum: ['en', 'zh'] })
  @IsOptional()
  @IsEnum(['en', 'zh'] as const)
  language?: 'en' | 'zh';

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

  @ApiPropertyOptional({ description: 'Target ID' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  targetId?: string;

  @ApiPropertyOptional({ description: 'Base resume ID' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseResumeId?: string;

  @ApiPropertyOptional({
    description:
      'Template customization settings (colors, fonts, spacing, etc.)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResumeSettingsDto)
  settings?: ResumeSettingsDto;

  @ApiPropertyOptional({
    description: 'Target school, major, role, JD, or research context',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ResumeTargetContextDto)
  targetContext?: ResumeTargetContextDto;
}
