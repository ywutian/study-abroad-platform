import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const EVIDENCE_KINDS = [
  'EDUCATION',
  'TEST_SCORE',
  'RESEARCH',
  'WORK_EXPERIENCE',
  'PROJECT',
  'ACTIVITY',
  'COMMUNITY_SERVICE',
  'AWARD',
  'SKILL',
  'PUBLICATION',
  'TEACHING',
  'CERTIFICATION',
  'CUSTOM',
] as const;

const TARGET_TYPES = [
  'COLLEGE_APPLICATION',
  'GRADUATE_PROGRAM',
  'INTERNSHIP',
  'FULL_TIME_JOB',
] as const;

const RESUME_SECTION_TYPES = [
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

export class CreateResumeEvidenceDto {
  @ApiProperty({ enum: EVIDENCE_KINDS })
  @IsEnum(EVIDENCE_KINDS)
  kind: (typeof EVIDENCE_KINDS)[number];

  @ApiProperty({ description: 'Reusable evidence title' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organization?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skills?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metrics?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1000, { each: true })
  proofLinks?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: ['PRIVATE', 'COUNSELOR_VISIBLE', 'PUBLIC_SHAREABLE'],
  })
  @IsOptional()
  @IsEnum(['PRIVATE', 'COUNSELOR_VISIBLE', 'PUBLIC_SHAREABLE'] as const)
  privacyLevel?: 'PRIVATE' | 'COUNSELOR_VISIBLE' | 'PUBLIC_SHAREABLE';
}

export class CreateResumeTargetDto {
  @ApiProperty({ enum: TARGET_TYPES })
  @IsEnum(TARGET_TYPES)
  type: (typeof TARGET_TYPES)[number];

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'ACTIVE', 'SUBMITTED', 'ARCHIVED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'ACTIVE', 'SUBMITTED', 'ARCHIVED'] as const)
  status?: 'DRAFT' | 'ACTIVE' | 'SUBMITTED' | 'ARCHIVED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  school?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  program?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  major?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  applicationRound?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  advisorName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  researchArea?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  labName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  jobDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keywords?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  requirements?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class TailorResumeDto {
  @ApiPropertyOptional({ description: 'Existing target ID' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  targetId?: string;

  @ApiPropertyOptional({ description: 'New tailored resume title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Override resume type for the tailored resume',
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

  @ApiPropertyOptional({ description: 'Optional target context override' })
  @IsOptional()
  @IsObject()
  targetContext?: Record<string, unknown>;
}

export class ApplyProfileImportDto {
  @ApiPropertyOptional({ description: 'Only apply these section IDs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  sectionIds?: string[];

  @ApiPropertyOptional({ description: 'Snapshot label before import' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  snapshotDescription?: string;
}

export class ApplyResumeAIIssueDto {
  @ApiPropertyOptional({ description: 'Expected base content hash' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  expectedContentHash?: string;
}

export class CreateResumeExportDto {
  @ApiPropertyOptional({ enum: ['PDF', 'DOCX', 'TXT', 'JSON'] })
  @IsOptional()
  @IsEnum(['PDF', 'DOCX', 'TXT', 'JSON'] as const)
  format?: 'PDF' | 'DOCX' | 'TXT' | 'JSON';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  pageSize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  pageCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  textExtractable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

class ResumeUploadSectionDto {
  @ApiPropertyOptional({ description: 'Existing section ID if replacing' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sectionId?: string;

  @ApiProperty({ enum: RESUME_SECTION_TYPES })
  @IsString()
  @MaxLength(100)
  sectionType: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty()
  @IsObject()
  content: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}

class ResumeUploadEvidenceDto {
  @ApiProperty({ enum: EVIDENCE_KINDS })
  @IsEnum(EVIDENCE_KINDS)
  kind: (typeof EVIDENCE_KINDS)[number];

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organization?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  skills?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

export class ApplyResumeUploadImportDto {
  @ApiPropertyOptional({ type: [ResumeUploadSectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResumeUploadSectionDto)
  sections?: ResumeUploadSectionDto[];

  @ApiPropertyOptional({ type: [ResumeUploadEvidenceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResumeUploadEvidenceDto)
  evidence?: ResumeUploadEvidenceDto[];

  @ApiPropertyOptional({ description: 'Snapshot label before import' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  snapshotDescription?: string;
}

export class CreateResumeCommentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  sectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  itemId?: string;

  @ApiPropertyOptional({ enum: ['STUDENT', 'COUNSELOR', 'ADMIN'] })
  @IsOptional()
  @IsIn(['STUDENT', 'COUNSELOR', 'ADMIN'])
  role?: 'STUDENT' | 'COUNSELOR' | 'ADMIN';

  @ApiProperty()
  @IsString()
  @MaxLength(3000)
  body: string;
}

export class UpdateResumeCommentDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'RESOLVED'] })
  @IsOptional()
  @IsIn(['OPEN', 'RESOLVED'])
  status?: 'OPEN' | 'RESOLVED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  body?: string;
}
