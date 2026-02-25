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
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Nested DTOs for Resume Settings validation ───

class ResumeColorSettingsDto {
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) primary?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) text?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) textLight?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) background?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) border?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) sidebarBg?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) sidebarText?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) headerBg?: string;
  @IsOptional() @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) headerText?: string;
}

class ResumeFontSettingsDto {
  @IsOptional() @IsString() heading?: string;
  @IsOptional() @IsString() body?: string;
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
    description:
      'Template customization settings (colors, fonts, spacing, etc.)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResumeSettingsDto)
  settings?: ResumeSettingsDto;
}
