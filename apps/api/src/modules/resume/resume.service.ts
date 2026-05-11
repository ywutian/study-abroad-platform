import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import {
  Resume,
  ResumeSection,
  ResumeSnapshot,
  ResumeType,
  ResumeSectionType,
  ActivityCategory,
} from '@prisma/client';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import {
  CreateSectionDto,
  UpdateSectionDto,
  ReorderSectionsDto,
} from './dto/section.dto';
import { ProfileService } from '../profile/profile.service';
import { ResumeAiService } from '../ai/resume-ai.service';

type ResumeWithSections = Resume & { sections: ResumeSection[] };

const DEFAULT_SECTIONS: Record<
  ResumeType,
  Array<{ type: ResumeSectionType; title: string; content: any }>
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
        templateId: true,
        language: true,
        targetContext: true,
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
        templateId: dto.templateId ?? 'jake-classic',
        language: dto.language ?? 'en',
        targetContext: (dto.targetContext ?? {}) as any,
        sections: {
          create: defaultSections.map((s, i) => ({
            type: s.type,
            title: s.title,
            content: s.content,
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
        status: dto.status as any,
        templateId: dto.templateId,
        language: dto.language,
        settings: dto.settings as any,
        targetContext: dto.targetContext as any,
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
        templateId: original.templateId,
        language: original.language,
        settings: original.settings as any,
        targetContext: original.targetContext as any,
        sections: {
          create: original.sections.map((s) => ({
            type: s.type,
            title: s.title,
            content: s.content as any,
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
        content: (dto.content ?? {}) as any,
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
        content: dto.content as any,
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
    const profile = await this.profileService.findByUserId(userId);

    if (!profile) {
      return resume;
    }

    const profileData = profile as any;
    const sectionMap = new Map(resume.sections.map((s) => [s.type, s]));

    const updates: Array<{ id: string; content: any }> = [];

    // HEADER — common for all types
    const headerSection = sectionMap.get('HEADER');
    if (headerSection) {
      updates.push({
        id: headerSection.id,
        content: {
          ...(headerSection.content as any),
          name: profile.realName ?? '',
          targetMajor: profile.targetMajor ?? '',
        },
      });
    }

    // EDUCATION
    const eduSection = sectionMap.get('EDUCATION');
    if (eduSection && profileData.education?.length > 0) {
      updates.push({
        id: eduSection.id,
        content: {
          items: profileData.education.map((e: any) => ({
            id: e.id,
            schoolName: e.schoolName,
            degree: e.degree ?? '',
            major: e.major ?? '',
            gpa: e.gpa ? Number(e.gpa) : undefined,
            gpaScale: e.gpaScale ? Number(e.gpaScale) : undefined,
            startDate: e.startDate?.toISOString().slice(0, 7) ?? '',
            endDate: e.endDate?.toISOString().slice(0, 7) ?? '',
            coursework: [],
            honors: [],
          })),
        },
      });
    }

    // TEST_SCORES — for COLLEGE_APPLICATION and (embedded in education for GRADUATE_CV)
    const testSection = sectionMap.get('TEST_SCORES');
    if (testSection && profileData.testScores?.length > 0) {
      updates.push({
        id: testSection.id,
        content: {
          items: profileData.testScores.map((t: any) => ({
            id: t.id,
            type: t.type,
            score: t.score,
            subScores: t.subScores ?? {},
            testDate: t.testDate?.toISOString().slice(0, 7) ?? '',
          })),
          displayFormat: 'inline',
        },
      });
    }

    // AWARDS
    const awardsSection = sectionMap.get('AWARDS');
    if (awardsSection && profileData.awards?.length > 0) {
      updates.push({
        id: awardsSection.id,
        content: {
          items: profileData.awards.map((a: any) => ({
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

    // Activities — mapped differently per resume type
    const activities = profileData.activities ?? [];
    const resumeType = resume.type;

    if (resumeType === 'COLLEGE_APPLICATION') {
      this.mapCollegeActivities(sectionMap, activities, updates);
    } else if (resumeType === 'INTERNSHIP') {
      this.mapInternshipActivities(sectionMap, activities, updates);
    } else if (resumeType === 'GRADUATE_CV') {
      this.mapGraduateCVActivities(sectionMap, activities, updates);
    }

    // Apply all updates
    if (updates.length > 0) {
      await this.prisma.$transaction(
        updates.map((u) =>
          this.prisma.resumeSection.update({
            where: { id: u.id },
            data: { content: u.content },
          }),
        ),
      );

      await this.prisma.resume.update({
        where: { id: resumeId },
        data: { lastImportedAt: new Date() },
      });
    }

    return this.findById(userId, resumeId);
  }

  private mapCollegeActivities(
    sectionMap: Map<string, ResumeSection>,
    activities: any[],
    updates: Array<{ id: string; content: any }>,
  ) {
    const communityService = activities.filter(
      (a: any) => a.category === ActivityCategory.COMMUNITY_SERVICE,
    );
    const otherActivities = activities.filter(
      (a: any) => a.category !== ActivityCategory.COMMUNITY_SERVICE,
    );

    const activitiesSection = sectionMap.get('ACTIVITIES');
    if (activitiesSection && otherActivities.length > 0) {
      updates.push({
        id: activitiesSection.id,
        content: {
          items: otherActivities.map((a: any) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            organization: a.organization ?? '',
            category: a.category,
            startDate: a.startDate?.toISOString().slice(0, 7) ?? '',
            endDate: a.endDate?.toISOString().slice(0, 7) ?? '',
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
          items: communityService.map((a: any) => ({
            id: a.id,
            name: a.name,
            role: a.role,
            organization: a.organization ?? '',
            startDate: a.startDate?.toISOString().slice(0, 7) ?? '',
            endDate: a.endDate?.toISOString().slice(0, 7) ?? '',
            bullets: a.description ? [a.description] : [],
          })),
        },
      });
    }
  }

  private mapInternshipActivities(
    sectionMap: Map<string, ResumeSection>,
    activities: any[],
    updates: Array<{ id: string; content: any }>,
  ) {
    const workActivities = activities.filter(
      (a: any) => a.category === ActivityCategory.WORK,
    );
    const researchActivities = activities.filter(
      (a: any) => a.category === ActivityCategory.RESEARCH,
    );
    const otherActivities = activities.filter(
      (a: any) =>
        a.category !== ActivityCategory.WORK &&
        a.category !== ActivityCategory.RESEARCH,
    );

    const workSection = sectionMap.get('WORK_EXPERIENCE');
    if (workSection && workActivities.length > 0) {
      updates.push({
        id: workSection.id,
        content: {
          items: workActivities.map((a: any) => ({
            id: a.id,
            title: a.role,
            company: a.organization ?? a.name,
            startDate: a.startDate?.toISOString().slice(0, 7) ?? '',
            endDate: a.endDate?.toISOString().slice(0, 7) ?? '',
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
          items: researchActivities.map((a: any) => ({
            id: a.id,
            name: a.name,
            techStack: [],
            startDate: a.startDate?.toISOString().slice(0, 7) ?? '',
            endDate: a.endDate?.toISOString().slice(0, 7) ?? '',
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
          items: otherActivities.slice(0, 3).map((a: any) => ({
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
    activities: any[],
    updates: Array<{ id: string; content: any }>,
  ) {
    const researchActivities = activities.filter(
      (a: any) => a.category === ActivityCategory.RESEARCH,
    );
    const workActivities = activities.filter(
      (a: any) => a.category === ActivityCategory.WORK,
    );

    const researchSection = sectionMap.get('RESEARCH');
    if (researchSection && researchActivities.length > 0) {
      updates.push({
        id: researchSection.id,
        content: {
          items: researchActivities.map((a: any) => ({
            id: a.id,
            title: a.name,
            institution: a.organization ?? '',
            startDate: a.startDate?.toISOString().slice(0, 7) ?? '',
            endDate: a.endDate?.toISOString().slice(0, 7) ?? '',
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
          items: workActivities.map((a: any) => ({
            id: a.id,
            title: a.role,
            company: a.organization ?? a.name,
            startDate: a.startDate?.toISOString().slice(0, 7) ?? '',
            endDate: a.endDate?.toISOString().slice(0, 7) ?? '',
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
          templateId: resume.templateId,
          language: resume.language,
          settings: resume.settings,
          targetContext: resume.targetContext,
          sections: resume.sections.map((s) => ({
            type: s.type,
            title: s.title,
            content: s.content,
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

    const data = snapshot.data as any;

    // Delete existing sections and recreate from snapshot
    await this.prisma.$transaction(async (tx) => {
      await tx.resumeSection.deleteMany({ where: { resumeId } });

      await tx.resume.update({
        where: { id: resumeId },
        data: {
          title: data.title,
          templateId: data.templateId,
          language: data.language,
          settings: data.settings,
          targetContext: data.targetContext ?? {},
          version: { increment: 1 },
        },
      });

      if (data.sections?.length > 0) {
        await tx.resumeSection.createMany({
          data: data.sections.map((s: any) => ({
            resumeId,
            type: s.type,
            title: s.title,
            content: s.content,
            isVisible: s.isVisible ?? true,
            order: s.order,
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
        input: effectiveTargetContext as any,
        output: result as any,
        overallScore: result.overallScore,
      },
      select: {
        id: true,
        output: true,
        overallScore: true,
        createdAt: true,
      },
    });

    return record;
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

    const content = section.content as any;
    let bullets: string[] = [];
    const context: any = {
      sectionType: section.type,
      ...((resume.targetContext as Record<string, unknown> | null) ?? {}),
      ...(targetContext ?? {}),
      ...(targetSchool ? { targetSchool } : {}),
      ...(targetMajor ? { targetMajor } : {}),
      resumeType: resume.type,
    };

    if (content.items) {
      const item = itemId
        ? content.items.find((i: any) => i.id === itemId)
        : content.items[0];

      if (item) {
        bullets = item.bullets ?? [];
        context.role = item.role ?? item.title;
        context.organization =
          item.organization ?? item.company ?? item.institution;
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
        input: { sectionId, itemId, bullets, targetContext: context } as any,
        output: result as any,
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
    const profileData = profile as any;
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
        grade: profileData?.grade,
        profileActivities: profileData?.activities,
        profileAwards: profileData?.awards,
      },
    );

    await this.prisma.resumeAIReview.create({
      data: {
        resumeId,
        type: 'content_suggest',
        input: { sectionType, targetContext: effectiveTargetContext } as any,
        output: result as any,
      },
    });

    return result;
  }
}
