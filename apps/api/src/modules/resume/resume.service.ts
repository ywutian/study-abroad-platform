import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import mammoth from 'mammoth';
import type { ResumeReviewResult } from '@study-abroad/shared';
import {
  asArray,
  contentAsRecord,
  enumOrUndefined,
  numberOrUndefined,
  stringOrUndefined,
  toJsonInput,
  toMonth,
} from './resume-content.helpers';
import {
  Prisma,
  ResumeTarget,
  ResumeFamily,
  ResumeVariantKind,
} from '@prisma/client';
import type { MaybeSerialized } from '../../common/redis/redis-json.types';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import {
  Resume,
  ResumeSection,
  ResumeSnapshot,
  ResumeType,
  ResumeSectionType,
  Activity,
  ActivityCategory,
} from '@prisma/client';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import {
  CreateSectionDto,
  UpdateSectionDto,
  ReorderSectionsDto,
} from './dto/section.dto';
import {
  ApplyProfileImportDto,
  ApplyResumeAIIssueDto,
  ApplyResumeUploadImportDto,
  CreateResumeCommentDto,
  CreateResumeEvidenceDto,
  CreateResumeExportDto,
  CreateResumeTargetDto,
  TailorResumeDto,
  UpdateResumeCommentDto,
} from './dto/resume-v2.dto';
import { ProfileService } from '../profile/profile.service';
import { ResumeAiService } from '../ai/resume-ai.service';

type ResumeWithSections = Resume & { sections: ResumeSection[] };

const DEFAULT_SECTIONS: Record<
  ResumeType,
  Array<{
    type: ResumeSectionType;
    title: string;
    content: Prisma.InputJsonValue;
  }>
> = {
  COLLEGE_APPLICATION: [
    {
      type: 'HEADER',
      title: 'Contact Information',
      content: { name: '', email: '', phone: '', address: '' },
    },
    {
      type: 'EDUCATION',
      title: 'Education',
      content: { items: [] },
    },
    {
      type: 'TEST_SCORES',
      title: 'Standardized Test Scores',
      content: { items: [], displayFormat: 'inline' },
    },
    {
      type: 'ACTIVITIES',
      title: 'Extracurricular Activities',
      content: { items: [] },
    },
    {
      type: 'AWARDS',
      title: 'Honors & Awards',
      content: { items: [], displayFormat: 'list' },
    },
    {
      type: 'COMMUNITY_SERVICE',
      title: 'Community Service',
      content: { items: [] },
    },
    {
      type: 'SKILLS',
      title: 'Skills & Interests',
      content: { categories: [] },
    },
  ],
  INTERNSHIP: [
    {
      type: 'HEADER',
      title: 'Contact Information',
      content: { name: '', email: '', phone: '', linkedIn: '', github: '' },
    },
    {
      type: 'EDUCATION',
      title: 'Education',
      content: { items: [] },
    },
    {
      type: 'WORK_EXPERIENCE',
      title: 'Experience',
      content: { items: [] },
    },
    {
      type: 'PROJECTS',
      title: 'Projects',
      content: { items: [] },
    },
    {
      type: 'SKILLS',
      title: 'Technical Skills',
      content: {
        categories: [
          { name: 'Languages', items: [] },
          { name: 'Frameworks', items: [] },
          { name: 'Tools', items: [] },
        ],
      },
    },
    {
      type: 'ACTIVITIES',
      title: 'Leadership & Activities',
      content: { items: [] },
    },
  ],
  FULL_TIME_JOB: [
    {
      type: 'HEADER',
      title: 'Contact Information',
      content: {
        name: '',
        email: '',
        phone: '',
        linkedIn: '',
        github: '',
        website: '',
      },
    },
    {
      type: 'WORK_EXPERIENCE',
      title: 'Professional Experience',
      content: { items: [] },
    },
    {
      type: 'PROJECTS',
      title: 'Selected Projects',
      content: { items: [] },
    },
    {
      type: 'SKILLS',
      title: 'Skills',
      content: {
        categories: [
          { name: 'Core Skills', items: [] },
          { name: 'Tools', items: [] },
        ],
      },
    },
    {
      type: 'EDUCATION',
      title: 'Education',
      content: { items: [] },
    },
    {
      type: 'CERTIFICATIONS',
      title: 'Certifications',
      content: { items: [] },
    },
  ],
  GRADUATE_CV: [
    {
      type: 'HEADER',
      title: 'Contact Information',
      content: { name: '', email: '', phone: '', website: '' },
    },
    {
      type: 'EDUCATION',
      title: 'Education',
      content: { items: [] },
    },
    {
      type: 'RESEARCH',
      title: 'Research Experience',
      content: { items: [] },
    },
    {
      type: 'PUBLICATIONS',
      title: 'Publications',
      content: { items: [], citationStyle: 'apa' },
    },
    {
      type: 'WORK_EXPERIENCE',
      title: 'Professional Experience',
      content: { items: [] },
    },
    {
      type: 'TEACHING',
      title: 'Teaching Experience',
      content: { items: [] },
    },
    {
      type: 'AWARDS',
      title: 'Awards & Fellowships',
      content: { items: [], displayFormat: 'list' },
    },
    {
      type: 'SKILLS',
      title: 'Skills',
      content: { categories: [] },
    },
  ],
};

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    private prisma: PrismaService,
    private auth: AuthorizationService,
    private profileService: ProfileService,
    private resumeAiService: ResumeAiService,
  ) {}

  private verifyOwnership(resume: Resume | null, userId: string): Resume {
    return this.auth.verifyOwnership(resume, userId, {
      entityName: 'Resume',
    });
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`,
      );
    return `{${entries.join(',')}}`;
  }

  private contentHash(content: unknown): string {
    return createHash('sha256')
      .update(this.stableStringify(content))
      .digest('hex');
  }

  private familyForType(type: ResumeType | string): 'STUDY_ABROAD' | 'CAREER' {
    return type === 'INTERNSHIP' || type === 'FULL_TIME_JOB'
      ? 'CAREER'
      : 'STUDY_ABROAD';
  }

  private normalizeJsonArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private sectionTitleForType(type: ResumeSectionType | string): string {
    const titles: Record<string, string> = {
      HEADER: 'Contact Information',
      EDUCATION: 'Education',
      TEST_SCORES: 'Test Scores',
      RESEARCH: 'Research Experience',
      WORK_EXPERIENCE: 'Work Experience',
      PROJECTS: 'Projects',
      ACTIVITIES: 'Activities',
      COMMUNITY_SERVICE: 'Community Service',
      AWARDS: 'Honors & Awards',
      SKILLS: 'Skills',
      PUBLICATIONS: 'Publications',
      TEACHING: 'Teaching Experience',
      CERTIFICATIONS: 'Certifications',
      CUSTOM: 'Imported Content',
    };
    return titles[type] ?? String(type).replace(/_/g, ' ');
  }

  private evidenceKindForSectionType(type: string) {
    const map: Record<string, string> = {
      EDUCATION: 'EDUCATION',
      TEST_SCORES: 'TEST_SCORE',
      RESEARCH: 'RESEARCH',
      WORK_EXPERIENCE: 'WORK_EXPERIENCE',
      PROJECTS: 'PROJECT',
      ACTIVITIES: 'ACTIVITY',
      COMMUNITY_SERVICE: 'COMMUNITY_SERVICE',
      AWARDS: 'AWARD',
      SKILLS: 'SKILL',
      PUBLICATIONS: 'PUBLICATION',
      TEACHING: 'TEACHING',
      CERTIFICATIONS: 'CERTIFICATION',
    };
    return map[type] ?? 'CUSTOM';
  }

  private contentItemCount(content: Record<string, unknown>) {
    if (Array.isArray(content.items)) return content.items.length;
    if (Array.isArray(content.categories)) {
      return asArray(content.categories).reduce<number>(
        (sum, category) =>
          sum + asArray(contentAsRecord(category).items).length,
        0,
      );
    }
    return Object.values(content).filter(Boolean).length;
  }

  // ============================================
  // Resume CRUD
  // ============================================

  async findAll(userId: string) {
    return this.prisma.resume.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        type: true,
        family: true,
        variantKind: true,
        templateId: true,
        language: true,
        targetId: true,
        baseResumeId: true,
        targetContext: true,
        qualitySummary: true,
        version: true,
        updatedAt: true,
        createdAt: true,
        _count: { select: { sections: true } },
      },
    });
  }

  async findById(userId: string, id: string): Promise<ResumeWithSections> {
    const resume = await this.prisma.resume.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { order: 'asc' } },
      },
    });

    return this.verifyOwnership(resume, userId) as ResumeWithSections;
  }

  async create(
    userId: string,
    dto: CreateResumeDto,
  ): Promise<ResumeWithSections> {
    const resumeType = dto.type ?? 'COLLEGE_APPLICATION';
    const defaultSections = DEFAULT_SECTIONS[resumeType];

    const resume = await this.prisma.resume.create({
      data: {
        userId,
        title: dto.title,
        type: resumeType,
        family: dto.family ?? this.familyForType(resumeType),
        variantKind: dto.variantKind ?? 'MASTER',
        targetId: dto.targetId,
        baseResumeId: dto.baseResumeId,
        templateId: dto.templateId ?? 'jake-classic',
        language: dto.language ?? 'en',
        targetContext: (dto.targetContext ?? {}) as Prisma.InputJsonValue,
        sections: {
          create: defaultSections.map((s, i) => ({
            type: s.type,
            title: s.title,
            content: s.content,
            contentHash: this.contentHash(s.content),
            order: i,
          })),
        },
      },
      include: {
        sections: { orderBy: { order: 'asc' } },
      },
    });

    if (dto.importFromProfile) {
      return this.importFromProfile(userId, resume.id);
    }

    return resume;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateResumeDto,
  ): Promise<Resume> {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id } }),
      userId,
    );

    return this.prisma.resume.update({
      where: { id },
      data: {
        title: dto.title,
        status: dto.status,
        templateId: dto.templateId,
        language: dto.language,
        family: dto.family,
        variantKind: dto.variantKind,
        targetId: dto.targetId,
        baseResumeId: dto.baseResumeId,
        settings: dto.settings as Prisma.InputJsonValue,
        targetContext: dto.targetContext as Prisma.InputJsonValue,
      },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id } }),
      userId,
    );

    await this.prisma.resume.delete({ where: { id } });
  }

  async duplicate(userId: string, id: string): Promise<ResumeWithSections> {
    const original = await this.findById(userId, id);

    return this.prisma.resume.create({
      data: {
        userId,
        title: `${original.title} (Copy)`,
        type: original.type,
        family: original.family ?? this.familyForType(original.type),
        variantKind: original.variantKind ?? 'MASTER',
        targetId: original.targetId,
        baseResumeId: original.baseResumeId,
        templateId: original.templateId,
        language: original.language,
        settings: original.settings as Prisma.InputJsonValue,
        targetContext: original.targetContext as Prisma.InputJsonValue,
        qualitySummary: original.qualitySummary ?? {},
        sections: {
          create: original.sections.map((s) => ({
            type: s.type,
            title: s.title,
            content: s.content as Prisma.InputJsonValue,
            contentSchemaVersion: s.contentSchemaVersion ?? 1,
            contentHash: s.contentHash ?? this.contentHash(s.content),
            evidenceRefs: s.evidenceRefs ?? [],
            isVisible: s.isVisible,
            order: s.order,
          })),
        },
      },
      include: {
        sections: { orderBy: { order: 'asc' } },
      },
    });
  }

  async tailorResume(
    userId: string,
    baseResumeId: string,
    dto: TailorResumeDto,
  ): Promise<ResumeWithSections> {
    const base = await this.findById(userId, baseResumeId);
    let target: ResumeTarget | null = null;

    if (dto.targetId) {
      target = await this.prisma.resumeTarget.findFirst({
        where: { id: dto.targetId, userId },
      });
      if (!target) throw new NotFoundException('Resume target not found');
    }

    const resumeType = dto.type ?? base.type;
    const targetContext = {
      ...((base.targetContext as Record<string, unknown> | null) ?? {}),
      ...(target
        ? {
            targetSchool: target.school ?? undefined,
            targetMajor: target.major ?? undefined,
            applicationRound: target.applicationRound ?? undefined,
            programName: target.program ?? undefined,
            researchArea: target.researchArea ?? undefined,
            advisorName: target.advisorName ?? undefined,
            labName: target.labName ?? undefined,
            targetRole: target.role ?? undefined,
            company: target.company ?? undefined,
            jobDescription: target.jobDescription ?? undefined,
            keywords: this.normalizeJsonArray(target.keywords),
          }
        : {}),
      ...(dto.targetContext ?? {}),
    };

    return this.prisma.resume.create({
      data: {
        userId,
        title: dto.title ?? `${base.title} - ${target?.title ?? 'Tailored'}`,
        type: resumeType,
        family: this.familyForType(resumeType),
        variantKind: 'TAILORED',
        targetId: target?.id,
        baseResumeId: base.id,
        templateId: base.templateId,
        language: base.language,
        settings: base.settings as Prisma.InputJsonValue,
        targetContext: targetContext as Prisma.InputJsonValue,
        sections: {
          create: base.sections
            .filter((section) => section.isVisible)
            .map((section, index) => ({
              type: section.type,
              title: section.title,
              content: section.content as Prisma.InputJsonValue,
              contentSchemaVersion: section.contentSchemaVersion ?? 1,
              contentHash:
                section.contentHash ?? this.contentHash(section.content),
              evidenceRefs: section.evidenceRefs ?? [],
              isVisible: true,
              order: index,
            })),
        },
      },
      include: {
        sections: { orderBy: { order: 'asc' } },
      },
    });
  }

  // ============================================
  // Resume 2.0: Evidence Library & Targets
  // ============================================

  async listEvidence(userId: string) {
    return this.prisma.resumeEvidence.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createEvidence(userId: string, dto: CreateResumeEvidenceDto) {
    return this.prisma.resumeEvidence.create({
      data: {
        userId,
        kind: dto.kind,
        source: 'MANUAL',
        title: dto.title,
        organization: dto.organization,
        role: dto.role,
        description: dto.description,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isCurrent: dto.isCurrent ?? false,
        tags: dto.tags ?? [],
        skills: dto.skills ?? [],
        metrics: (dto.metrics ?? {}) as Prisma.InputJsonValue,
        proofLinks: dto.proofLinks ?? [],
        content: (dto.content ?? {}) as Prisma.InputJsonValue,
        privacyLevel: dto.privacyLevel ?? 'PRIVATE',
      },
    });
  }

  async deleteEvidence(userId: string, id: string) {
    const evidence = await this.prisma.resumeEvidence.findUnique({
      where: { id },
    });
    this.auth.verifyOwnership(evidence, userId, {
      entityName: 'Resume evidence',
    });
    await this.prisma.resumeEvidence.delete({ where: { id } });
    return { message: 'Evidence deleted' };
  }

  async listTargets(userId: string) {
    return this.prisma.resumeTarget.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async createTarget(userId: string, dto: CreateResumeTargetDto) {
    return this.prisma.resumeTarget.create({
      data: {
        userId,
        type: dto.type,
        status: dto.status ?? 'DRAFT',
        title: dto.title,
        school: dto.school,
        program: dto.program,
        major: dto.major,
        applicationRound: dto.applicationRound,
        advisorName: dto.advisorName,
        researchArea: dto.researchArea,
        labName: dto.labName,
        company: dto.company,
        role: dto.role,
        jobDescription: dto.jobDescription,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        keywords: dto.keywords ?? [],
        requirements: (dto.requirements ?? {}) as Prisma.InputJsonValue,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async deleteTarget(userId: string, id: string) {
    const target = await this.prisma.resumeTarget.findUnique({ where: { id } });
    this.auth.verifyOwnership(target, userId, { entityName: 'Resume target' });
    await this.prisma.resumeTarget.delete({ where: { id } });
    return { message: 'Target deleted' };
  }

  // ============================================
  // Section CRUD
  // ============================================

  async addSection(
    userId: string,
    resumeId: string,
    dto: CreateSectionDto,
  ): Promise<ResumeSection> {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id: resumeId } }),
      userId,
    );

    const maxOrder = await this.prisma.resumeSection.aggregate({
      where: { resumeId },
      _max: { order: true },
    });

    return this.prisma.resumeSection.create({
      data: {
        resumeId,
        type: dto.type,
        title: dto.title ?? dto.type.replace(/_/g, ' '),
        content: (dto.content ?? {}) as Prisma.InputJsonValue,
        contentSchemaVersion: dto.contentSchemaVersion ?? 1,
        contentHash: this.contentHash(dto.content ?? {}),
        evidenceRefs: (dto.evidenceRefs ?? []) as Prisma.InputJsonValue,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
  }

  async updateSection(
    userId: string,
    resumeId: string,
    sectionId: string,
    dto: UpdateSectionDto,
  ): Promise<ResumeSection> {
    const section = await this.prisma.resumeSection.findUnique({
      where: { id: sectionId },
      include: { resume: { select: { userId: true } } },
    });

    if (!section || section.resume.userId !== userId) {
      throw new NotFoundException('Section not found');
    }

    if (section.resumeId !== resumeId) {
      throw new BadRequestException('Section does not belong to this resume');
    }

    return this.prisma.resumeSection.update({
      where: { id: sectionId },
      data: {
        title: dto.title,
        content: dto.content as Prisma.InputJsonValue,
        ...(dto.content !== undefined
          ? {
              contentHash: this.contentHash(dto.content),
              contentSchemaVersion:
                dto.contentSchemaVersion ?? section.contentSchemaVersion ?? 1,
            }
          : {}),
        evidenceRefs: dto.evidenceRefs as Prisma.InputJsonValue,
        isVisible: dto.isVisible,
      },
    });
  }

  async deleteSection(
    userId: string,
    resumeId: string,
    sectionId: string,
  ): Promise<void> {
    const section = await this.prisma.resumeSection.findUnique({
      where: { id: sectionId },
      include: { resume: { select: { userId: true } } },
    });

    if (!section || section.resume.userId !== userId) {
      throw new NotFoundException('Section not found');
    }

    if (section.resumeId !== resumeId) {
      throw new BadRequestException('Section does not belong to this resume');
    }

    await this.prisma.resumeSection.delete({ where: { id: sectionId } });
  }

  async reorderSections(
    userId: string,
    resumeId: string,
    dto: ReorderSectionsDto,
  ): Promise<void> {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id: resumeId } }),
      userId,
    );

    const owned = await this.prisma.resumeSection.findMany({
      where: { id: { in: dto.sectionIds }, resumeId },
      select: { id: true },
    });

    const ownedIds = new Set(owned.map((s) => s.id));
    const invalid = dto.sectionIds.filter((id) => !ownedIds.has(id));

    if (invalid.length > 0) {
      throw new ForbiddenException(
        'Cannot reorder sections that do not belong to this resume',
      );
    }

    await this.prisma.$transaction(
      dto.sectionIds.map((id, index) =>
        this.prisma.resumeSection.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }

  // ============================================
  // Import from Profile
  // ============================================

  async importFromProfile(
    userId: string,
    resumeId: string,
  ): Promise<ResumeWithSections> {
    const resume = await this.findById(userId, resumeId);
    const updates = await this.buildProfileImportUpdates(userId, resume);

    if (updates.length === 0) {
      return resume;
    }

    await this.applySectionContentUpdates(resumeId, updates);

    return this.findById(userId, resumeId);
  }

  async previewProfileImport(userId: string, resumeId: string) {
    const resume = await this.findById(userId, resumeId);
    const updates = await this.buildProfileImportUpdates(userId, resume);
    const sectionMap = new Map(
      resume.sections.map((section) => [section.id, section]),
    );

    return {
      resumeId,
      sections: updates.map((update) => {
        const section = sectionMap.get(update.id);
        return {
          sectionId: update.id,
          sectionType: section?.type ?? 'CUSTOM',
          title: section?.title ?? '',
          currentContent: (section?.content ?? {}) as Record<string, unknown>,
          proposedContent: update.content as Record<string, unknown>,
          changeType: 'replace',
          itemCount: Array.isArray(contentAsRecord(update.content).items)
            ? (contentAsRecord(update.content).items as Prisma.JsonArray).length
            : Object.keys(contentAsRecord(update.content)).length,
        };
      }),
      warnings:
        updates.length === 0
          ? ['No profile data matched the current resume sections.']
          : [],
    };
  }

  async applyProfileImport(
    userId: string,
    resumeId: string,
    dto: ApplyProfileImportDto,
  ): Promise<ResumeWithSections> {
    const resume = await this.findById(userId, resumeId);
    const allowedIds = dto.sectionIds?.length ? new Set(dto.sectionIds) : null;
    const updates = (
      await this.buildProfileImportUpdates(userId, resume)
    ).filter((update) => !allowedIds || allowedIds.has(update.id));

    if (updates.length === 0) return resume;

    await this.createSnapshot(
      userId,
      resumeId,
      dto.snapshotDescription ?? 'Before profile import',
    );
    await this.applySectionContentUpdates(resumeId, updates);
    return this.findById(userId, resumeId);
  }

  async previewResumeUploadImport(
    userId: string,
    resumeId: string,
    file?: Express.Multer.File,
  ) {
    const resume = await this.findById(userId, resumeId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('No resume file uploaded');
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new BadRequestException('Resume file must be under 8MB');
    }

    const text = await this.extractTextFromResumeUpload(file);
    if (text.trim().length < 30) {
      throw new BadRequestException(
        'Could not extract enough text from resume file',
      );
    }

    return this.buildUploadImportPreview(resume, text, file.originalname);
  }

  async applyResumeUploadImport(
    userId: string,
    resumeId: string,
    dto: ApplyResumeUploadImportDto,
  ): Promise<ResumeWithSections> {
    const resume = await this.findById(userId, resumeId);
    const sections = dto.sections ?? [];
    const evidence = dto.evidence ?? [];
    if (sections.length === 0 && evidence.length === 0) {
      return resume;
    }

    await this.createSnapshot(
      userId,
      resumeId,
      dto.snapshotDescription ?? 'Before uploaded resume import',
    );

    const existingById = new Map(
      resume.sections.map((section) => [section.id, section]),
    );
    const maxOrder = await this.prisma.resumeSection.aggregate({
      where: { resumeId },
      _max: { order: true },
    });
    let nextOrder = (maxOrder._max.order ?? resume.sections.length - 1) + 1;

    await this.prisma.$transaction(async (tx) => {
      for (const section of sections) {
        const type = this.normalizeSectionType(section.sectionType);
        const contentHash = this.contentHash(section.content);
        if (section.sectionId && existingById.has(section.sectionId)) {
          await tx.resumeSection.update({
            where: { id: section.sectionId },
            data: {
              type,
              title: section.title,
              content: section.content as Prisma.InputJsonValue,
              contentHash,
              contentSchemaVersion: 1,
              isVisible: section.isVisible ?? true,
            },
          });
        } else {
          await tx.resumeSection.create({
            data: {
              resumeId,
              type,
              title: section.title || this.sectionTitleForType(type),
              content: section.content as Prisma.InputJsonValue,
              contentHash,
              contentSchemaVersion: 1,
              isVisible: section.isVisible ?? true,
              order: nextOrder++,
            },
          });
        }
      }

      if (evidence.length > 0) {
        await tx.resumeEvidence.createMany({
          data: evidence.map((item) => ({
            userId,
            kind: item.kind,
            source: 'RESUME_IMPORT',
            title: item.title,
            organization: item.organization,
            role: item.role,
            description: item.description,
            tags: item.tags ?? [],
            skills: item.skills ?? [],
            content: (item.content ?? {}) as Prisma.InputJsonValue,
            metrics: {},
            proofLinks: [],
            privacyLevel: 'PRIVATE',
            confidence: 0.7,
          })),
        });
      }

      await tx.resume.update({
        where: { id: resumeId },
        data: { lastImportedAt: new Date(), version: { increment: 1 } },
      });
    });

    return this.findById(userId, resumeId);
  }

  private async extractTextFromResumeUpload(file: Express.Multer.File) {
    const name = file.originalname.toLowerCase();
    const mime = file.mimetype.toLowerCase();
    try {
      if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value;
      }
      if (name.endsWith('.pdf') || mime.includes('pdf')) {
        // pdf-parse loads a native canvas binding. Keep it off the application
        // startup path so non-PDF requests and test discovery do not retain the
        // binding's CustomGC handle.
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: file.buffer });
        try {
          const result = await parser.getText();
          return result.text;
        } finally {
          await parser.destroy();
        }
      }
      if (name.endsWith('.txt') || mime.includes('text/plain')) {
        return file.buffer.toString('utf8');
      }
    } catch (error) {
      this.logger.warn(
        `Resume upload parse failed for ${file.originalname}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    throw new BadRequestException(
      'Only PDF, DOCX, or TXT resume files are supported',
    );
  }

  private buildUploadImportPreview(
    resume: ResumeWithSections,
    text: string,
    sourceFileName: string,
  ) {
    const parsedSections = this.parseResumeTextIntoSections(text);
    const existingByType = new Map(
      resume.sections.map((section) => [section.type, section]),
    );
    const sections = parsedSections.map((section) => {
      const existing = existingByType.get(
        section.sectionType as ResumeSectionType,
      );
      return {
        sectionId: existing?.id,
        sectionType: section.sectionType,
        title: existing?.title ?? this.sectionTitleForType(section.sectionType),
        currentContent: (existing?.content ?? {}) as Record<string, unknown>,
        proposedContent: section.content,
        changeType: existing ? 'replace' : 'create',
        itemCount: this.contentItemCount(section.content),
      };
    });
    const evidence = this.buildEvidenceFromParsedSections(parsedSections);

    return {
      resumeId: resume.id,
      sourceFileName,
      rawTextPreview: text.replace(/\s+/g, ' ').slice(0, 600),
      sections,
      evidence,
      warnings:
        sections.length === 0
          ? [
              'No structured sections were detected. Try a text-selectable PDF or DOCX.',
            ]
          : [],
    };
  }

  private parseResumeTextIntoSections(text: string) {
    const segments = new Map<string, string[]>();
    let currentType = 'HEADER';
    const pushLine = (type: string, line: string) => {
      const list = segments.get(type) ?? [];
      list.push(line);
      segments.set(type, list);
    };

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim().replace(/\s+/g, ' ');
      if (!line) continue;
      const headingType = this.detectResumeSectionHeading(line);
      if (headingType) {
        currentType = headingType;
        if (!segments.has(currentType)) segments.set(currentType, []);
        continue;
      }
      pushLine(currentType, line);
    }

    return Array.from(segments.entries())
      .map(([sectionType, lines]) => ({
        sectionType,
        content: this.buildContentFromLines(sectionType, lines),
      }))
      .filter((section) => this.contentItemCount(section.content) > 0);
  }

  private detectResumeSectionHeading(line: string) {
    const normalized = line
      .toUpperCase()
      .replace(/[^A-Z\s&]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const map: Array<[RegExp, string]> = [
      [/^(CONTACT|PROFILE|SUMMARY|HEADER)$/, 'HEADER'],
      [/^(EDUCATION|ACADEMIC BACKGROUND)$/, 'EDUCATION'],
      [/^(STANDARDIZED TESTS?|TEST SCORES?)$/, 'TEST_SCORES'],
      [/^(RESEARCH|RESEARCH EXPERIENCE)$/, 'RESEARCH'],
      [
        /^(EXPERIENCE|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT)$/,
        'WORK_EXPERIENCE',
      ],
      [/^(PROJECTS|SELECTED PROJECTS|PROJECT EXPERIENCE)$/, 'PROJECTS'],
      [
        /^(ACTIVITIES|LEADERSHIP|LEADERSHIP & ACTIVITIES|EXTRACURRICULAR ACTIVITIES)$/,
        'ACTIVITIES',
      ],
      [
        /^(COMMUNITY SERVICE|VOLUNTEERING|VOLUNTEER EXPERIENCE)$/,
        'COMMUNITY_SERVICE',
      ],
      [/^(AWARDS|HONORS|HONORS & AWARDS|AWARDS & HONORS)$/, 'AWARDS'],
      [/^(SKILLS|TECHNICAL SKILLS|SKILLS & INTERESTS)$/, 'SKILLS'],
      [/^(PUBLICATIONS|PAPERS)$/, 'PUBLICATIONS'],
      [/^(TEACHING|TEACHING EXPERIENCE)$/, 'TEACHING'],
      [/^(CERTIFICATIONS|CERTIFICATES|LICENSES)$/, 'CERTIFICATIONS'],
    ];
    return map.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
  }

  private buildContentFromLines(
    sectionType: string,
    lines: string[],
  ): Record<string, unknown> {
    if (sectionType === 'HEADER') return this.buildHeaderContent(lines);
    if (sectionType === 'SKILLS') {
      const skills = lines
        .flatMap((line) => line.split(/[,;|•]/))
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 80);
      return {
        categories: skills.length ? [{ name: 'Skills', items: skills }] : [],
      };
    }
    return { items: this.buildGenericItems(sectionType, lines) };
  }

  private buildHeaderContent(lines: string[]) {
    const joined = lines.join(' ');
    const email =
      joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
    const phone =
      joined
        .match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]
        ?.replace(/\s+/g, ' ')
        .trim() ?? '';
    const linkedIn =
      joined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s]+/i)?.[0] ??
      '';
    const github =
      joined.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s]+/i)?.[0] ?? '';
    const website =
      joined.match(
        /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?/i,
      )?.[0] ?? '';
    const name =
      lines.find(
        (line) =>
          !line.includes('@') &&
          !/\d{3}/.test(line) &&
          !/linkedin|github|http/i.test(line) &&
          line.length <= 80,
      ) ?? '';
    return { name, email, phone, linkedIn, github, website };
  }

  private buildGenericItems(sectionType: string, lines: string[]) {
    const items: Array<Record<string, unknown>> = [];
    let current: Record<string, unknown> | null = null;
    const bulletPattern = /^[-*•·]\s*/;
    const pushCurrent = () => {
      if (current) items.push(current);
      current = null;
    };

    for (const line of lines) {
      if (bulletPattern.test(line)) {
        if (!current)
          current = this.createImportedItem(sectionType, 'Imported detail');
        const bullets = Array.isArray(current.bullets)
          ? (current.bullets as string[])
          : [];
        current.bullets = [...bullets, line.replace(bulletPattern, '').trim()];
        continue;
      }
      pushCurrent();
      current = this.createImportedItem(sectionType, line);
    }
    pushCurrent();
    return items.slice(0, 30);
  }

  private createImportedItem(sectionType: string, line: string) {
    const id = `upload-${this.contentHash(`${sectionType}:${line}`).slice(0, 12)}`;
    if (sectionType === 'EDUCATION')
      return { id, schoolName: line, bullets: [] };
    if (sectionType === 'PROJECTS') return { id, name: line, bullets: [] };
    if (sectionType === 'AWARDS' || sectionType === 'CERTIFICATIONS') {
      return { id, name: line, description: '' };
    }
    if (sectionType === 'PUBLICATIONS') return { id, title: line, bullets: [] };
    if (sectionType === 'ACTIVITIES' || sectionType === 'COMMUNITY_SERVICE') {
      return { id, name: line, bullets: [] };
    }
    return { id, title: line, bullets: [] };
  }

  private buildEvidenceFromParsedSections(
    sections: Array<{ sectionType: string; content: Record<string, unknown> }>,
  ): Array<Record<string, unknown>> {
    return sections.flatMap((section): Array<Record<string, unknown>> => {
      const kind = this.evidenceKindForSectionType(section.sectionType);
      if (section.sectionType === 'HEADER') return [];
      const items = Array.isArray(section.content.items)
        ? section.content.items
        : [];
      if (section.sectionType === 'SKILLS') {
        const skills = asArray(section.content.categories).flatMap((category) =>
          asArray(contentAsRecord(category).items),
        );
        return skills.length
          ? [
              {
                kind,
                title: 'Imported skills',
                organization: undefined,
                role: undefined,
                description: undefined,
                skills,
                tags: ['resume-import'],
                content: section.content,
              },
            ]
          : [];
      }
      return items.slice(0, 20).map((raw) => {
        const item = contentAsRecord(raw);
        const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
        return {
          kind,
          title:
            str(item.name) ??
            str(item.schoolName) ??
            str(item.title) ??
            str(item.role) ??
            this.sectionTitleForType(section.sectionType),
          organization:
            str(item.company) ??
            str(item.organization) ??
            str(item.institution),
          role: str(item.role) ?? str(item.title),
          description: Array.isArray(item.bullets)
            ? asArray(item.bullets).join('\n')
            : str(item.description),
          tags: ['resume-import'],
          skills: [],
          content: item,
        };
      });
    });
  }

  private normalizeSectionType(type: string): ResumeSectionType {
    const allowed = Object.values(ResumeSectionType);
    if (allowed.includes(type as ResumeSectionType))
      return type as ResumeSectionType;
    return ResumeSectionType.CUSTOM;
  }

  private async applySectionContentUpdates(
    resumeId: string,
    updates: Array<{ id: string; content: Prisma.InputJsonValue }>,
  ) {
    await this.prisma.$transaction([
      ...updates.map((u) =>
        this.prisma.resumeSection.update({
          where: { id: u.id },
          data: {
            content: u.content,
            contentHash: this.contentHash(u.content),
          },
        }),
      ),
      this.prisma.resume.update({
        where: { id: resumeId },
        data: { lastImportedAt: new Date(), version: { increment: 1 } },
      }),
    ]);
  }

  private async buildProfileImportUpdates(
    userId: string,
    resume: ResumeWithSections,
  ): Promise<Array<{ id: string; content: Prisma.InputJsonValue }>> {
    const profile = await this.profileService.findByUserId(userId);
    if (!profile) return [];

    const profileData = profile;
    const sectionMap = new Map(resume.sections.map((s) => [s.type, s]));
    const updates: Array<{ id: string; content: Prisma.InputJsonValue }> = [];

    const headerSection = sectionMap.get('HEADER');
    if (headerSection) {
      updates.push({
        id: headerSection.id,
        content: {
          ...contentAsRecord(headerSection.content),
          name: profile.realName ?? '',
          targetMajor: profile.targetMajor ?? '',
        },
      });
    }

    const eduSection = sectionMap.get('EDUCATION');
    if (eduSection && profileData.education?.length > 0) {
      updates.push({
        id: eduSection.id,
        content: {
          items: profileData.education.map((e) => ({
            id: e.id,
            schoolName: e.schoolName,
            degree: e.degree ?? '',
            major: e.major ?? '',
            gpa: e.gpa ? Number(e.gpa) : undefined,
            gpaScale: e.gpaScale ? Number(e.gpaScale) : undefined,
            startDate: toMonth(e.startDate),
            endDate: toMonth(e.endDate),
            coursework: [],
            honors: [],
          })),
        },
      });
    }

    const testSection = sectionMap.get('TEST_SCORES');
    if (testSection && profileData.testScores?.length > 0) {
      updates.push({
        id: testSection.id,
        content: {
          items: profileData.testScores.map((t) => ({
            id: t.id,
            type: t.type,
            score: t.score,
            subScores: t.subScores ?? {},
            testDate: toMonth(t.testDate),
          })),
          displayFormat: 'inline',
        },
      });
    }

    const awardsSection = sectionMap.get('AWARDS');
    if (awardsSection && profileData.awards?.length > 0) {
      updates.push({
        id: awardsSection.id,
        content: {
          items: profileData.awards.map((a) => ({
            id: a.id,
            name: a.name,
            level: a.level,
            year: a.year,
            description: a.description ?? '',
          })),
          displayFormat: 'list',
        },
      });
    }

    const activities = profileData.activities ?? [];
    if (resume.type === 'COLLEGE_APPLICATION') {
      this.mapCollegeActivities(sectionMap, activities, updates);
    } else if (
      resume.type === 'INTERNSHIP' ||
      resume.type === 'FULL_TIME_JOB'
    ) {
      this.mapInternshipActivities(sectionMap, activities, updates);
    } else if (resume.type === 'GRADUATE_CV') {
      this.mapGraduateCVActivities(sectionMap, activities, updates);
    }

    return updates;
  }

  private mapCollegeActivities(
    sectionMap: Map<string, ResumeSection>,
    activities: MaybeSerialized<Activity>[],
    updates: Array<{ id: string; content: Prisma.InputJsonValue }>,
  ) {
    const communityService = activities.filter(
      (a) => a.category === ActivityCategory.COMMUNITY_SERVICE,
    );
    const otherActivities = activities.filter(
      (a) => a.category !== ActivityCategory.COMMUNITY_SERVICE,
    );

    const activitiesSection = sectionMap.get('ACTIVITIES');
    if (activitiesSection && otherActivities.length > 0) {
      updates.push({
        id: activitiesSection.id,
        content: {
          items: otherActivities.map((a) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            organization: a.organization ?? '',
            category: a.category,
            startDate: toMonth(a.startDate),
            endDate: toMonth(a.endDate),
            isOngoing: a.isOngoing,
            bullets: a.description ? [a.description] : [],
            hoursPerWeek: a.hoursPerWeek,
            weeksPerYear: a.weeksPerYear,
          })),
        },
      });
    }

    const csSection = sectionMap.get('COMMUNITY_SERVICE');
    if (csSection && communityService.length > 0) {
      updates.push({
        id: csSection.id,
        content: {
          items: communityService.map((a) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            organization: a.organization ?? '',
            startDate: toMonth(a.startDate),
            endDate: toMonth(a.endDate),
            bullets: a.description ? [a.description] : [],
          })),
        },
      });
    }
  }

  private mapInternshipActivities(
    sectionMap: Map<string, ResumeSection>,
    activities: MaybeSerialized<Activity>[],
    updates: Array<{ id: string; content: Prisma.InputJsonValue }>,
  ) {
    const workActivities = activities.filter(
      (a) => a.category === ActivityCategory.WORK,
    );
    const researchActivities = activities.filter(
      (a) => a.category === ActivityCategory.RESEARCH,
    );
    const otherActivities = activities.filter(
      (a) =>
        a.category !== ActivityCategory.WORK &&
        a.category !== ActivityCategory.RESEARCH,
    );

    const workSection = sectionMap.get('WORK_EXPERIENCE');
    if (workSection && workActivities.length > 0) {
      updates.push({
        id: workSection.id,
        content: {
          items: workActivities.map((a) => ({
            id: a.id,
            title: a.role,
            company: a.organization ?? a.name,
            startDate: toMonth(a.startDate),
            endDate: toMonth(a.endDate),
            isCurrent: a.isOngoing,
            bullets: a.description ? [a.description] : [],
          })),
        },
      });
    }

    const projectsSection = sectionMap.get('PROJECTS');
    if (projectsSection && researchActivities.length > 0) {
      updates.push({
        id: projectsSection.id,
        content: {
          items: researchActivities.map((a) => ({
            id: a.id,
            name: a.name,
            techStack: [],
            startDate: toMonth(a.startDate),
            endDate: toMonth(a.endDate),
            bullets: a.description ? [a.description] : [],
          })),
        },
      });
    }

    const activitiesSection = sectionMap.get('ACTIVITIES');
    if (activitiesSection && otherActivities.length > 0) {
      updates.push({
        id: activitiesSection.id,
        content: {
          items: otherActivities.slice(0, 3).map((a) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            organization: a.organization ?? '',
            bullets: a.description ? [a.description] : [],
          })),
        },
      });
    }
  }

  private mapGraduateCVActivities(
    sectionMap: Map<string, ResumeSection>,
    activities: MaybeSerialized<Activity>[],
    updates: Array<{ id: string; content: Prisma.InputJsonValue }>,
  ) {
    const researchActivities = activities.filter(
      (a) => a.category === ActivityCategory.RESEARCH,
    );
    const workActivities = activities.filter(
      (a) => a.category === ActivityCategory.WORK,
    );

    const researchSection = sectionMap.get('RESEARCH');
    if (researchSection && researchActivities.length > 0) {
      updates.push({
        id: researchSection.id,
        content: {
          items: researchActivities.map((a) => ({
            id: a.id,
            title: a.name,
            institution: a.organization ?? '',
            startDate: toMonth(a.startDate),
            endDate: toMonth(a.endDate),
            bullets: a.description ? [a.description] : [],
          })),
        },
      });
    }

    const workSection = sectionMap.get('WORK_EXPERIENCE');
    if (workSection && workActivities.length > 0) {
      updates.push({
        id: workSection.id,
        content: {
          items: workActivities.map((a) => ({
            id: a.id,
            title: a.role,
            company: a.organization ?? a.name,
            startDate: toMonth(a.startDate),
            endDate: toMonth(a.endDate),
            isCurrent: a.isOngoing,
            bullets: a.description ? [a.description] : [],
          })),
        },
      });
    }
  }

  // ============================================
  // Snapshots
  // ============================================

  async createSnapshot(
    userId: string,
    resumeId: string,
    description?: string,
  ): Promise<ResumeSnapshot> {
    const resume = await this.findById(userId, resumeId);

    return this.prisma.resumeSnapshot.create({
      data: {
        resumeId,
        version: resume.version,
        data: {
          title: resume.title,
          type: resume.type,
          family: resume.family,
          variantKind: resume.variantKind,
          targetId: resume.targetId,
          baseResumeId: resume.baseResumeId,
          templateId: resume.templateId,
          language: resume.language,
          settings: resume.settings,
          targetContext: resume.targetContext,
          qualitySummary: resume.qualitySummary,
          sections: resume.sections.map((s) => ({
            type: s.type,
            title: s.title,
            content: s.content,
            contentSchemaVersion: s.contentSchemaVersion ?? 1,
            contentHash: s.contentHash ?? this.contentHash(s.content),
            evidenceRefs: s.evidenceRefs ?? [],
            isVisible: s.isVisible,
            order: s.order,
          })),
        },
        description,
      },
    });
  }

  async getSnapshots(userId: string, resumeId: string) {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id: resumeId } }),
      userId,
    );

    return this.prisma.resumeSnapshot.findMany({
      where: { resumeId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        description: true,
        createdAt: true,
      },
    });
  }

  async restoreSnapshot(
    userId: string,
    resumeId: string,
    snapshotId: string,
  ): Promise<ResumeWithSections> {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id: resumeId } }),
      userId,
    );

    const snapshot = await this.prisma.resumeSnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot || snapshot.resumeId !== resumeId) {
      throw new NotFoundException('Snapshot not found');
    }

    const data = contentAsRecord(snapshot.data);

    // Delete existing sections and recreate from snapshot
    await this.prisma.$transaction(async (tx) => {
      await tx.resumeSection.deleteMany({ where: { resumeId } });

      await tx.resume.update({
        where: { id: resumeId },
        // A snapshot's `data` is a Json column, so every field here is a
        // JsonValue. The old `as any` fed them straight into typed columns —
        // including two enums, where a snapshot written by an older schema (or
        // hand-edited) would reach Postgres unvalidated. Undefined fields are
        // omitted by Prisma, so a snapshot missing one leaves the column as-is,
        // which is the same behaviour the cast produced for `undefined`.
        data: {
          title: stringOrUndefined(data.title),
          family: enumOrUndefined(data.family, ResumeFamily),
          variantKind: enumOrUndefined(data.variantKind, ResumeVariantKind),
          targetId: stringOrUndefined(data.targetId) ?? null,
          baseResumeId: stringOrUndefined(data.baseResumeId) ?? null,
          templateId: stringOrUndefined(data.templateId),
          language: stringOrUndefined(data.language),
          settings: contentAsRecord(data.settings),
          targetContext: contentAsRecord(data.targetContext),
          qualitySummary: contentAsRecord(data.qualitySummary),
          version: { increment: 1 },
        },
      });

      const snapshotSections = asArray(data.sections);
      if (snapshotSections.length > 0) {
        await tx.resumeSection.createMany({
          data: snapshotSections.map(contentAsRecord).map((s) => ({
            resumeId,
            type:
              enumOrUndefined(s.type, ResumeSectionType) ??
              ResumeSectionType.CUSTOM,
            title: stringOrUndefined(s.title) ?? '',
            content: contentAsRecord(s.content),
            contentSchemaVersion:
              numberOrUndefined(s.contentSchemaVersion) ?? 1,
            contentHash:
              stringOrUndefined(s.contentHash) ?? this.contentHash(s.content),
            evidenceRefs: asArray(s.evidenceRefs).filter(
              (r): r is string => typeof r === 'string',
            ),
            isVisible: typeof s.isVisible === 'boolean' ? s.isVisible : true,
            order: numberOrUndefined(s.order) ?? 0,
          })),
        });
      }
    });

    return this.findById(userId, resumeId);
  }

  // ============================================
  // AI Features
  // ============================================

  // ── AI Review Retrieval ──

  async getLatestReview(userId: string, resumeId: string) {
    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
    });
    this.verifyOwnership(resume, userId);

    return this.prisma.resumeAIReview.findFirst({
      where: { resumeId, type: 'full_review' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        output: true,
        overallScore: true,
        input: true,
        createdAt: true,
      },
    });
  }

  async getReviewHistory(userId: string, resumeId: string) {
    const resume = await this.prisma.resume.findUnique({
      where: { id: resumeId },
    });
    this.verifyOwnership(resume, userId);

    return this.prisma.resumeAIReview.findMany({
      where: { resumeId, type: 'full_review' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        overallScore: true,
        input: true,
        createdAt: true,
      },
    });
  }

  // ── AI Review Execution ──

  async aiReview(
    userId: string,
    resumeId: string,
    targetSchool?: string,
    targetMajor?: string,
    targetContext?: Record<string, unknown>,
  ) {
    const resume = await this.findById(userId, resumeId);
    const effectiveTargetContext = {
      ...((resume.targetContext as Record<string, unknown> | null) ?? {}),
      ...(targetContext ?? {}),
      ...(targetSchool ? { targetSchool } : {}),
      ...(targetMajor ? { targetMajor } : {}),
    };

    const resumeData = {
      sections: resume.sections
        .filter((s) => s.isVisible)
        .map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          content: s.content,
        })),
      templateId: resume.templateId,
      resumeType: resume.type,
      targetContext: effectiveTargetContext,
    };

    const result = await this.resumeAiService.reviewResume(
      resumeData,
      effectiveTargetContext,
    );

    const record = await this.prisma.resumeAIReview.create({
      data: {
        resumeId,
        type: 'full_review',
        input: effectiveTargetContext,
        // Typed shape into a Json column — unlike `as any`, this still
        // type-checks every field that builds `result`.
        output: result as unknown as Prisma.InputJsonValue,
        overallScore: result.overallScore,
        resumeVersion: resume.version,
        rubricVersion:
          this.familyForType(resume.type) === 'CAREER'
            ? 'career-resume-v2'
            : 'study-abroad-resume-v2',
      },
      select: {
        id: true,
        output: true,
        overallScore: true,
        createdAt: true,
      },
    });

    const issues = this.buildReviewIssues(
      resumeId,
      record.id,
      resume.sections,
      result,
    );
    if (issues.length > 0) {
      await this.prisma.resumeAIIssue.createMany({ data: issues });
    }

    await this.prisma.resume.update({
      where: { id: resumeId },
      data: {
        lastReviewAt: new Date(),
        status: 'REVIEWED',
        qualitySummary: await this.computeQualitySummary(resume),
      },
    });

    return record;
  }

  private buildReviewIssues(
    resumeId: string,
    reviewId: string,
    sections: ResumeSection[],
    result: ResumeReviewResult,
  ) {
    const sectionById = new Map(
      sections.map((section) => [section.id, section]),
    );
    return (result.sectionFeedback ?? []).flatMap((feedback) => {
      const sectionId = feedback.sectionId as string | undefined;
      const section = sectionId ? sectionById.get(sectionId) : undefined;
      return (feedback.issues ?? []).map((issue) => ({
        resumeId,
        reviewId,
        sectionId,
        type: issue.type ?? 'resume_review',
        severity: issue.severity ?? 'medium',
        title: `${feedback.sectionTitle ?? feedback.sectionType ?? 'Section'}: ${issue.type ?? 'Issue'}`,
        original: issue.original ?? null,
        suggestion: issue.suggestion ?? null,
        reason: issue.reason ?? null,
        patch: {
          kind: 'replace_text',
          sectionId,
          original: issue.original,
          suggestion: issue.suggestion,
          bulletIndex: issue.bulletIndex,
        },
        confidence: 0.75,
        source: 'AI_REVIEW',
        baseContentHash: section
          ? (section.contentHash ?? this.contentHash(section.content))
          : null,
      }));
    });
  }

  async listAiIssues(userId: string, resumeId: string) {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id: resumeId } }),
      userId,
    );

    return this.prisma.resumeAIIssue.findMany({
      where: { resumeId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async applyAiIssue(
    userId: string,
    resumeId: string,
    issueId: string,
    dto: ApplyResumeAIIssueDto,
  ) {
    const issue = await this.prisma.resumeAIIssue.findUnique({
      where: { id: issueId },
      include: { resume: { select: { userId: true } } },
    });

    if (
      !issue ||
      issue.resume.userId !== userId ||
      issue.resumeId !== resumeId
    ) {
      throw new NotFoundException('AI issue not found');
    }

    if (!issue.sectionId || !issue.original || !issue.suggestion) {
      throw new BadRequestException(
        'Issue does not contain an applicable text patch',
      );
    }

    const section = await this.prisma.resumeSection.findUnique({
      where: { id: issue.sectionId },
    });
    if (!section || section.resumeId !== resumeId) {
      throw new NotFoundException('Section not found');
    }

    const currentHash =
      section.contentHash ?? this.contentHash(section.content);
    const expectedHash = dto.expectedContentHash ?? issue.baseContentHash;
    if (expectedHash && expectedHash !== currentHash) {
      await this.prisma.resumeAIIssue.update({
        where: { id: issue.id },
        data: { status: 'STALE' },
      });
      throw new BadRequestException(
        'Resume section changed since this issue was generated',
      );
    }

    const nextContent = this.applyTextPatch(
      section.content as Prisma.InputJsonValue,
      issue.original,
      issue.suggestion,
    );
    if (!nextContent.applied) {
      await this.prisma.resumeAIIssue.update({
        where: { id: issue.id },
        data: { status: 'STALE' },
      });
      throw new BadRequestException(
        'Original text no longer exists in this section',
      );
    }

    const contentHash = this.contentHash(nextContent.content);
    await this.prisma.$transaction([
      this.prisma.resumeSection.update({
        where: { id: section.id },
        data: { content: nextContent.content, contentHash },
      }),
      this.prisma.resumeAIIssue.update({
        where: { id: issue.id },
        data: { status: 'APPLIED', appliedAt: new Date() },
      }),
      this.prisma.resume.update({
        where: { id: resumeId },
        data: { version: { increment: 1 } },
      }),
    ]);

    return this.findById(userId, resumeId);
  }

  private applyTextPatch(
    content: Prisma.InputJsonValue,
    original: string,
    suggestion: string,
  ) {
    const next = contentAsRecord(structuredClone(content ?? {}));
    const items = Array.isArray(next.items) ? next.items : [];
    for (const raw of items) {
      const item = contentAsRecord(raw);
      const bullets = item.bullets;
      if (!Array.isArray(bullets)) continue;
      const index = bullets.findIndex(
        (bullet) => typeof bullet === 'string' && bullet.includes(original),
      );
      if (index >= 0) {
        bullets[index] = String(bullets[index]).replace(original, suggestion);
        return { applied: true, content: next };
      }
    }
    return { applied: false, content: next };
  }

  async getQualitySummary(userId: string, resumeId: string) {
    const resume = await this.findById(userId, resumeId);
    const summary = await this.computeQualitySummary(resume);
    await this.prisma.resume.update({
      where: { id: resumeId },
      data: { qualitySummary: summary },
    });
    return summary;
  }

  private async computeQualitySummary(resume: ResumeWithSections) {
    const family = this.familyForType(resume.type);
    const visible = resume.sections.filter((section) => section.isVisible);
    const sectionTypes = new Set(visible.map((section) => section.type));
    const targetContext =
      (resume.targetContext as Record<string, unknown> | null) ?? {};
    const bullets = visible.flatMap((section) => {
      return asArray(contentAsRecord(section.content).items).flatMap((item) =>
        asArray(contentAsRecord(item).bullets),
      );
    });
    const metricBullets = bullets.filter((bullet) =>
      /\d/.test(String(bullet)),
    ).length;
    const header = visible.find((section) => section.type === 'HEADER');
    const headerContent = (header?.content ?? {}) as Record<string, unknown>;
    const hasContact = Boolean(headerContent.email || headerContent.phone);

    const dimensions = [
      {
        key: 'completeness',
        label: 'Completeness',
        score: Math.round(
          (visible.filter((section) => {
            const content = contentAsRecord(section.content);
            if (Array.isArray(content.items)) return content.items.length > 0;
            if (Array.isArray(content.categories))
              return content.categories.length > 0;
            return Object.values(content).some(Boolean);
          }).length /
            Math.max(1, visible.length)) *
            100,
        ),
        checks: ['visible_sections', 'non_empty_content'],
      },
      {
        key: family === 'CAREER' ? 'job_alignment' : 'application_alignment',
        label: family === 'CAREER' ? 'Job Alignment' : 'Application Alignment',
        score: this.scoreTargetContext(targetContext, family),
        checks:
          family === 'CAREER'
            ? [
                'target_role',
                'company_or_industry',
                'job_description_or_keywords',
              ]
            : [
                'target_school_or_program',
                'major_or_research_area',
                'application_round',
              ],
      },
      {
        key: 'impact',
        label: 'Impact',
        score:
          bullets.length === 0
            ? 0
            : Math.round((metricBullets / bullets.length) * 100),
        checks: ['quantified_bullets', 'achievement_language'],
      },
      {
        key: family === 'CAREER' ? 'ats_compatibility' : 'academic_signal',
        label:
          family === 'CAREER' ? 'ATS Compatibility Signals' : 'Academic Signal',
        score:
          family === 'CAREER'
            ? this.scoreCareerStructure(sectionTypes, hasContact)
            : this.scoreStudyAbroadStructure(sectionTypes, hasContact),
        checks:
          family === 'CAREER'
            ? ['contact', 'experience', 'skills', 'education']
            : [
                'contact',
                'education',
                'research_or_activities',
                'awards_or_publications',
              ],
      },
    ].map((dimension) => ({
      ...dimension,
      status:
        dimension.score >= 70
          ? 'green'
          : dimension.score >= 40
            ? 'yellow'
            : 'red',
    }));

    const score = Math.round(
      dimensions.reduce((sum, dimension) => sum + dimension.score, 0) /
        Math.max(1, dimensions.length),
    );

    const gaps = dimensions
      .filter((dimension) => dimension.score < 70)
      .map((dimension) => ({
        key: dimension.key,
        label: dimension.label,
        severity: dimension.score < 40 ? 'high' : 'medium',
      }));

    return {
      score,
      family,
      rubricVersion:
        family === 'CAREER' ? 'career-resume-v2' : 'study-abroad-resume-v2',
      dimensions,
      gaps,
      updatedAt: new Date().toISOString(),
    };
  }

  private scoreTargetContext(
    context: Record<string, unknown>,
    family: 'STUDY_ABROAD' | 'CAREER',
  ) {
    const checks =
      family === 'CAREER'
        ? [
            context.targetRole,
            context.company,
            context.jobDescription ||
              (Array.isArray(context.keywords) && context.keywords.length),
          ]
        : [
            context.targetSchool || context.programName,
            context.targetMajor || context.researchArea,
            context.applicationRound || context.advisorName || context.labName,
          ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  private scoreCareerStructure(sectionTypes: Set<string>, hasContact: boolean) {
    const checks = [
      hasContact,
      sectionTypes.has('WORK_EXPERIENCE'),
      sectionTypes.has('SKILLS'),
      sectionTypes.has('EDUCATION'),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  private scoreStudyAbroadStructure(
    sectionTypes: Set<string>,
    hasContact: boolean,
  ) {
    const checks = [
      hasContact,
      sectionTypes.has('EDUCATION'),
      sectionTypes.has('RESEARCH') || sectionTypes.has('ACTIVITIES'),
      sectionTypes.has('AWARDS') || sectionTypes.has('PUBLICATIONS'),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  async listExports(userId: string, resumeId: string) {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id: resumeId } }),
      userId,
    );
    return this.prisma.resumeExport.findMany({
      where: { resumeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async createExportRecord(
    userId: string,
    resumeId: string,
    dto: CreateResumeExportDto,
  ) {
    const resume = await this.findById(userId, resumeId);
    const visibleSections = resume.sections.filter(
      (section) => section.isVisible,
    );
    const exportRecord = await this.prisma.$transaction(async (tx) => {
      const record = await tx.resumeExport.create({
        data: {
          resumeId,
          format: dto.format ?? 'PDF',
          status: 'COMPLETED',
          templateId: dto.templateId ?? resume.templateId,
          pageSize:
            dto.pageSize ??
            stringOrUndefined(
              contentAsRecord(contentAsRecord(resume.settings).decorations)
                .pageSize,
            ) ??
            'LETTER',
          pageCount: dto.pageCount,
          textExtractable: dto.textExtractable ?? true,
          metadata: {
            ...(dto.metadata ?? {}),
            visibleSectionCount: visibleSections.length,
            hasHeader: visibleSections.some(
              (section) => section.type === 'HEADER',
            ),
            // qualitySummary is a Json column, so Prisma types it as
            // JsonValue. Narrow all the way to a number: this value is being
            // written straight back into another Json column, and `unknown`
            // is not writable there — the old `as any` on this object was
            // what let a non-serialisable score through.
            qualityScore: numberOrUndefined(
              contentAsRecord(resume.qualitySummary).score,
            ),
            note: 'Client-side artifact record; server-side rendering can attach artifactUrl later.',
          },
          completedAt: new Date(),
        },
      });
      await tx.resume.update({
        where: { id: resumeId },
        data: { status: 'EXPORTED' },
      });
      return record;
    });
    return exportRecord;
  }

  async listComments(userId: string, resumeId: string) {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id: resumeId } }),
      userId,
    );
    return this.prisma.resumeComment.findMany({
      where: { resumeId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        author: { select: { id: true, email: true, role: true } },
      },
    });
  }

  async createComment(
    userId: string,
    resumeId: string,
    dto: CreateResumeCommentDto,
  ) {
    const resume = await this.findById(userId, resumeId);
    if (
      dto.sectionId &&
      !resume.sections.some((section) => section.id === dto.sectionId)
    ) {
      throw new BadRequestException('Section does not belong to this resume');
    }
    return this.prisma.resumeComment.create({
      data: {
        resumeId,
        sectionId: dto.sectionId,
        itemId: dto.itemId,
        authorId: userId,
        role: dto.role ?? 'STUDENT',
        body: dto.body,
      },
      include: {
        author: { select: { id: true, email: true, role: true } },
      },
    });
  }

  async updateComment(
    userId: string,
    resumeId: string,
    commentId: string,
    dto: UpdateResumeCommentDto,
  ) {
    this.verifyOwnership(
      await this.prisma.resume.findUnique({ where: { id: resumeId } }),
      userId,
    );
    const comment = await this.prisma.resumeComment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.resumeId !== resumeId) {
      throw new NotFoundException('Resume comment not found');
    }

    return this.prisma.resumeComment.update({
      where: { id: commentId },
      data: {
        body: dto.body,
        status: dto.status,
        resolvedAt: dto.status === 'RESOLVED' ? new Date() : undefined,
      },
      include: {
        author: { select: { id: true, email: true, role: true } },
      },
    });
  }

  async aiOptimizeBullets(
    userId: string,
    resumeId: string,
    sectionId: string,
    itemId?: string,
    targetSchool?: string,
    targetMajor?: string,
    targetContext?: Record<string, unknown>,
  ) {
    const resume = await this.findById(userId, resumeId);
    const section = resume.sections.find((s) => s.id === sectionId);

    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const content = contentAsRecord(section.content);
    let bullets: string[] = [];
    // Built field by field against optimizeResumeBullets' declared parameter
    // rather than spreading the stored Json in: targetContext is a Json column,
    // so a spread makes every one of these `unknown` and the old `as any` was
    // the only thing letting that reach a typed signature.
    const merged = {
      ...contentAsRecord(resume.targetContext),
      ...(targetContext ?? {}),
    };
    const context: {
      sectionType: string;
      role?: string;
      organization?: string;
      targetSchool?: string;
      targetMajor?: string;
      resumeType?: string;
      targetContext?: Record<string, unknown>;
      targetRole?: string;
      company?: string;
      jobDescription?: string;
      keywords?: string[];
    } = {
      sectionType: section.type,
      resumeType: resume.type,
      targetContext: merged,
      targetSchool: targetSchool ?? stringOrUndefined(merged.targetSchool),
      targetMajor: targetMajor ?? stringOrUndefined(merged.targetMajor),
      targetRole: stringOrUndefined(merged.targetRole),
      company: stringOrUndefined(merged.company),
      jobDescription: stringOrUndefined(merged.jobDescription),
      keywords: asArray(merged.keywords).filter(
        (k): k is string => typeof k === 'string',
      ),
    };

    const contentItems = asArray(content.items);
    if (contentItems.length > 0) {
      const item = contentAsRecord(
        itemId
          ? contentItems.find((i) => contentAsRecord(i).id === itemId)
          : contentItems[0],
      );

      if (item) {
        bullets = asArray(item.bullets).filter(
          (b): b is string => typeof b === 'string',
        );
        context.role =
          stringOrUndefined(item.role) ?? stringOrUndefined(item.title);
        context.organization =
          stringOrUndefined(item.organization) ??
          stringOrUndefined(item.company) ??
          stringOrUndefined(item.institution);
      }
    }

    if (bullets.length === 0) {
      throw new BadRequestException('No bullets to optimize');
    }

    const result = await this.resumeAiService.optimizeResumeBullets(
      bullets,
      context,
    );

    await this.prisma.resumeAIReview.create({
      data: {
        resumeId,
        type: 'bullet_optimize',
        input: toJsonInput({
          sectionId,
          itemId,
          bullets,
          targetContext: context,
        }),
        output: result,
      },
    });

    return result;
  }

  async aiSuggestContent(
    userId: string,
    resumeId: string,
    sectionType: string,
    targetMajor?: string,
    targetContext?: Record<string, unknown>,
  ) {
    const resume = await this.findById(userId, resumeId);
    const section = resume.sections.find((s) => s.type === sectionType);

    const profile = await this.profileService.findByUserId(userId);
    const profileData = profile;
    const effectiveTargetContext = {
      ...((resume.targetContext as Record<string, unknown> | null) ?? {}),
      ...(targetContext ?? {}),
      ...(targetMajor ? { targetMajor } : {}),
    };

    const result = await this.resumeAiService.suggestSectionContent(
      sectionType,
      {
        existingContent: section?.content ?? {},
        resumeType: resume.type,
        targetMajor: effectiveTargetContext.targetMajor,
        targetContext: effectiveTargetContext,
        grade: profileData?.grade ?? undefined,
        profileActivities: profileData?.activities,
        profileAwards: profileData?.awards,
      },
    );

    await this.prisma.resumeAIReview.create({
      data: {
        resumeId,
        type: 'content_suggest',
        input: { sectionType, targetContext: effectiveTargetContext },
        output: result,
      },
    });

    return result;
  }
}
