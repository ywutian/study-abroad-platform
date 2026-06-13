import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
  ArrayMaxSize,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';
import {
  MAX_RESUME_SECTION_EVIDENCE_REFS,
  MAX_RESUME_SECTION_IDS,
} from '@study-abroad/shared';

const SECTION_TYPES = [
  'HEADER',
  'EDUCATION',
  'TEST_SCORES',
  'RESEARCH',
  'WORK_EXPERIENCE',
  'PROJECTS',
  'ACTIVITIES',
  'COMMUNITY_SERVICE',
  'AWARDS',
  'SKILLS',
  'PUBLICATIONS',
  'TEACHING',
  'CERTIFICATIONS',
  'CUSTOM',
] as const;

export class CreateSectionDto {
  @ApiProperty({ description: 'Section type', enum: SECTION_TYPES })
  @IsEnum(SECTION_TYPES)
  type: (typeof SECTION_TYPES)[number];

  @ApiPropertyOptional({ description: 'Custom section title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: 'Section content (JSON)' })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Section content schema version' })
  @IsOptional()
  @IsInt()
  @Min(1)
  contentSchemaVersion?: number;

  @ApiPropertyOptional({ description: 'Evidence references for this section' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_RESUME_SECTION_EVIDENCE_REFS)
  evidenceRefs?: Array<Record<string, unknown>>;
}

export class UpdateSectionDto {
  @ApiPropertyOptional({ description: 'Section title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: 'Section content (JSON)' })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Section content schema version' })
  @IsOptional()
  @IsInt()
  @Min(1)
  contentSchemaVersion?: number;

  @ApiPropertyOptional({ description: 'Evidence references for this section' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_RESUME_SECTION_EVIDENCE_REFS)
  evidenceRefs?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ description: 'Section visibility' })
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

export class ReorderSectionsDto {
  @ApiProperty({ description: 'Ordered array of section IDs' })
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  @ArrayMaxSize(MAX_RESUME_SECTION_IDS)
  sectionIds: string[];
}
