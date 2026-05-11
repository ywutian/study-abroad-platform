import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import {
  Education,
  Essay,
  EssayRevision,
  EssaySuggestion,
  Prisma,
} from '@prisma/client';
import {
  CreateEducationDto,
  UpdateEducationDto,
  CreateEssayDto,
  CreateEssayRevisionDto,
  UpdateEssayDto,
  UpdateEssaySuggestionDto,
} from './dto';
import { ProfileHelpersService } from './profile-helpers.service';

/**
 * Handles education records, essays, and target schools CRUD operations.
 */
@Injectable()
export class ProfileEducationService {
  private readonly logger = new Logger(ProfileEducationService.name);

  constructor(
    private prisma: PrismaService,
    private cacheInvalidation: CacheInvalidationService,
    private helpers: ProfileHelpersService,
  ) {}

  private isHighSchoolType(schoolType?: string | null): boolean {
    return (schoolType ?? '').toUpperCase().includes('HIGH_SCHOOL');
  }

  private inferSuggestionCountry(
    schoolName: string,
    schoolType?: string | null,
  ): string {
    const type = (schoolType ?? '').toUpperCase();
    if (/[\u3400-\u9fff]/.test(schoolName) || type.includes('CN')) return 'CN';
    if (type.includes('US')) return 'US';
    if (type.includes('INTL')) return 'UNKNOWN';
    return 'US';
  }

  private normalizeName(value: string): string {
    return value
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private countWords(content?: string | null): number {
    return (content ?? '').split(/\s+/).filter(Boolean).length;
  }

  private revisionPayload(
    essay: Pick<Essay, 'id' | 'title' | 'prompt' | 'content' | 'wordCount'>,
    data?: CreateEssayRevisionDto,
  ) {
    return {
      essayId: essay.id,
      title: essay.title,
      prompt: essay.prompt,
      content: essay.content,
      wordCount: essay.wordCount ?? this.countWords(essay.content),
      reason: data?.reason,
      source: data?.source ?? 'manual',
    };
  }

  private highSchoolNameCandidates(raw: string): string[] {
    const candidates = new Set<string>();
    const trimmed = raw.trim();
    if (!trimmed) return [];
    candidates.add(trimmed);
    const knownAliases: Record<string, string[]> = {
      北京人大附中: [
        'RDFZ',
        'The High School Affiliated to Renmin University of China',
      ],
      上海中学: ['SHSID', 'Shanghai High School International Division'],
      上海世界外国语中学: ['WFLA', 'Shanghai World Foreign Language Academy'],
      南京外国语学校: ['NFLS', 'Nanjing Foreign Language School'],
      成都七中: ['Chengdu No.7 High School'],
      广州外国语学校: ['GZFLS', 'Guangzhou Foreign Language School'],
      北京四中: ['BJ4', 'Beijing No. 4 High School'],
      深圳外国语学校: ['SZFLS', 'Shenzhen Foreign Languages School'],
      深圳中学: ['SZMS Intl', 'Shenzhen Middle School International System'],
      深圳国际交流学院: ['SCIE', 'Shenzhen College of International Education'],
      'Lowell High School': ['LOWELL', 'Lowell'],
      'Shanghai Pinghe School': ['Pinghe', 'Shanghai Pinghe Bilingual School'],
    };
    for (const [alias, values] of Object.entries(knownAliases)) {
      if (trimmed.includes(alias)) {
        values.forEach((value) => candidates.add(value));
      }
    }

    const parentheticalMatches = [...trimmed.matchAll(/\(([^)]+)\)/g)];
    for (const match of parentheticalMatches) {
      const inner = match[1]?.trim();
      if (inner) candidates.add(inner);
    }

    const withoutParenthetical = trimmed
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .trim();
    if (withoutParenthetical) candidates.add(withoutParenthetical);

    for (const value of [...candidates]) {
      if (/high school/i.test(value)) {
        candidates.add(value.replace(/high school/gi, 'Middle School'));
      }
      if (/middle school/i.test(value)) {
        candidates.add(value.replace(/middle school/gi, 'High School'));
      }
    }

    return [...candidates].filter(Boolean);
  }

  private async findHighSchoolIdByName(
    schoolName: string,
  ): Promise<string | null> {
    const candidates = this.highSchoolNameCandidates(schoolName);
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const normalized = this.normalizeName(candidate);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      const canUseBroadNameContains = normalized.replace(/\s/g, '').length > 4;
      const broadNameFilters: Prisma.HighSchoolWhereInput[] =
        canUseBroadNameContains
          ? [
              {
                name: {
                  contains: candidate,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ]
          : [];

      const match = await this.prisma.highSchool.findFirst({
        where: {
          OR: [
            { name: { equals: candidate, mode: Prisma.QueryMode.insensitive } },
            {
              abbreviation: {
                equals: candidate,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            ...broadNameFilters,
            {
              abbreviation: {
                contains: candidate,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        },
        orderBy: [{ tier: 'desc' }, { recognition: 'desc' }],
        select: { id: true },
      });
      if (match?.id) return match.id;
    }
    return null;
  }

  private async ensureHighSchoolSuggestion(
    userId: string,
    schoolName: string,
    schoolType?: string | null,
  ): Promise<void> {
    const country = this.inferSuggestionCountry(schoolName, schoolType);
    const existing = await this.prisma.highSchoolSuggestion.findUnique({
      where: { name_country: { name: schoolName, country } },
    });
    if (!existing) {
      await this.prisma.highSchoolSuggestion.create({
        data: {
          name: schoolName,
          country,
          submittedBy: [userId],
        },
      });
      return;
    }
    if (!existing.submittedBy.includes(userId)) {
      await this.prisma.highSchoolSuggestion.update({
        where: { id: existing.id },
        data: { submittedBy: { set: [...existing.submittedBy, userId] } },
      });
    }
  }

  private async resolveHighSchoolId(
    userId: string,
    schoolName: string,
    schoolType?: string | null,
    explicitHighSchoolId?: string | null,
  ): Promise<string | null> {
    if (explicitHighSchoolId !== undefined) {
      return explicitHighSchoolId || null;
    }
    if (!this.isHighSchoolType(schoolType)) return null;

    const matchedId = await this.findHighSchoolIdByName(schoolName);
    if (matchedId) return matchedId;

    await this.ensureHighSchoolSuggestion(userId, schoolName, schoolType);
    return null;
  }

  // ============================================
  // Education CRUD
  // ============================================

  /**
   * Create an education record for the user's profile. Auto-creates the profile if needed.
   *
   * @param userId - The user identifier
   * @param data - Education creation DTO
   * @returns The created Education record
   */
  async createEducation(
    userId: string,
    data: CreateEducationDto,
  ): Promise<Education> {
    const profileId = await this.helpers.getProfileId(userId);
    const highSchoolId = await this.resolveHighSchoolId(
      userId,
      data.schoolName,
      data.schoolType,
      data.highSchoolId,
    );

    const education = await this.prisma.education.create({
      data: {
        profileId,
        schoolName: data.schoolName,
        schoolType: data.schoolType,
        degree: data.degree,
        major: data.major,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        gpa: data.gpa ? new Prisma.Decimal(data.gpa) : null,
        gpaScale: data.gpaScale ? new Prisma.Decimal(data.gpaScale) : null,
        description: data.description,
        highSchoolId,
        gpaSystem: data.gpaSystem || null,
      },
    });

    await this.cacheInvalidation.onProfileChange(userId);

    return education;
  }

  /**
   * Update an existing education record after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param educationId - The education record ID to update
   * @param data - Partial education update DTO
   * @returns The updated Education record
   * @throws {NotFoundException} When the education record does not exist
   * @throws {ForbiddenException} When the education record does not belong to the user
   */
  async updateEducation(
    userId: string,
    educationId: string,
    data: UpdateEducationDto,
  ): Promise<Education> {
    const _education = this.helpers.verifyProfileOwnership(
      await this.prisma.education.findUnique({
        where: { id: educationId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Education',
    );
    const autoHighSchoolId =
      data.highSchoolId === undefined &&
      !(_education as any).highSchoolId &&
      (data.schoolName !== undefined || data.schoolType !== undefined)
        ? await this.resolveHighSchoolId(
            userId,
            data.schoolName ?? (_education as any).schoolName,
            data.schoolType ?? (_education as any).schoolType,
            undefined,
          )
        : undefined;

    const updated = await this.prisma.education.update({
      where: { id: educationId },
      data: {
        schoolName: data.schoolName,
        schoolType: data.schoolType,
        degree: data.degree,
        major: data.major,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        gpa: data.gpa !== undefined ? new Prisma.Decimal(data.gpa) : undefined,
        gpaScale:
          data.gpaScale !== undefined
            ? new Prisma.Decimal(data.gpaScale)
            : undefined,
        description: data.description,
        highSchoolId:
          data.highSchoolId !== undefined
            ? data.highSchoolId || null
            : autoHighSchoolId || undefined,
        gpaSystem:
          data.gpaSystem !== undefined ? data.gpaSystem || null : undefined,
      },
    });

    await this.cacheInvalidation.onProfileChange(userId);

    return updated;
  }

  /**
   * Delete an education record by ID after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param educationId - The education record ID to delete
   * @throws {NotFoundException} When the education record does not exist
   * @throws {ForbiddenException} When the education record does not belong to the user
   */
  async deleteEducation(userId: string, educationId: string): Promise<void> {
    this.helpers.verifyProfileOwnership(
      await this.prisma.education.findUnique({
        where: { id: educationId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Education',
    );

    await this.prisma.education.delete({ where: { id: educationId } });

    await this.cacheInvalidation.onProfileChange(userId);
  }

  /**
   * Get all education records for a user, ordered by startDate descending.
   *
   * @param userId - The user identifier
   * @returns Array of Education records, or empty array if no profile exists
   */
  async getEducation(userId: string): Promise<Education[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { education: { orderBy: { startDate: 'desc' } } },
    });

    return profile?.education || [];
  }

  // ============================================
  // Target Schools CRUD
  // ============================================

  /**
   * Get all target schools for a user with school details, ordered by priority ascending.
   *
   * @param userId - The user identifier
   * @returns Array of ProfileTargetSchool records with included school relation
   */
  async getTargetSchools(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) return [];

    return this.prisma.profileTargetSchool.findMany({
      where: { profileId: profile.id },
      include: { school: true },
      orderBy: { priority: 'asc' },
    });
  }

  /**
   * Replace all target schools for a user. Deletes existing entries and creates new ones.
   *
   * @param userId - The user identifier
   * @param schoolIds - Array of school IDs to set as targets
   * @param priorities - Optional map of schoolId to priority number
   * @returns The newly created target school records with school details
   */
  async setTargetSchools(
    userId: string,
    schoolIds: string[],
    priorities?: Record<string, number>,
  ) {
    const profileId = await this.helpers.getProfileId(userId);

    // Wrap delete + create in a transaction for atomicity
    await this.prisma.$transaction(async (tx) => {
      // Delete existing target schools
      await tx.profileTargetSchool.deleteMany({
        where: { profileId },
      });

      // Create new target schools
      if (schoolIds.length > 0) {
        await tx.profileTargetSchool.createMany({
          data: schoolIds.map((schoolId, index) => ({
            profileId,
            schoolId,
            priority: priorities?.[schoolId] ?? index + 1,
          })),
        });
      }
    });

    const result = await this.getTargetSchools(userId);

    await this.cacheInvalidation.onProfileChange(userId);

    return result;
  }

  /**
   * Add a single target school (idempotent). Returns the existing record if already present.
   *
   * @param userId - The user identifier
   * @param schoolId - The school ID to add as a target
   * @param priority - Optional priority value (defaults to 0)
   * @returns The created or existing ProfileTargetSchool record with school details
   */
  async addTargetSchool(userId: string, schoolId: string, priority?: number) {
    const profileId = await this.helpers.getProfileId(userId);

    // Check if already exists
    const existing = await this.prisma.profileTargetSchool.findUnique({
      where: { profileId_schoolId: { profileId, schoolId } },
    });

    if (existing) {
      return existing;
    }

    const result = await this.prisma.profileTargetSchool.create({
      data: { profileId, schoolId, priority: priority ?? 0 },
      include: { school: true },
    });

    await this.cacheInvalidation.onProfileChange(userId);

    return result;
  }

  /**
   * Remove a target school from the user's list.
   *
   * @param userId - The user identifier
   * @param schoolId - The school ID to remove
   */
  async removeTargetSchool(userId: string, schoolId: string) {
    const profileId = await this.helpers.getProfileId(userId);

    await this.prisma.profileTargetSchool.deleteMany({
      where: { profileId, schoolId },
    });

    await this.cacheInvalidation.onProfileChange(userId);
  }

  // ============================================
  // Essays CRUD
  // ============================================

  /**
   * Create a new essay for the user's profile. Auto-creates the profile if needed.
   * Computes word count from the content.
   *
   * @param userId - The user identifier
   * @param data - Essay creation DTO (title, prompt, content, schoolId)
   * @returns The created Essay record with computed wordCount
   */
  async createEssay(userId: string, data: CreateEssayDto): Promise<Essay> {
    const profileId = await this.helpers.getProfileId(userId);
    const wordCount = this.countWords(data.content);

    const essay = await this.prisma.essay.create({
      data: {
        profileId,
        title: data.title,
        prompt: data.prompt,
        content: data.content,
        wordCount,
        schoolId: data.schoolId,
        essayPromptId: data.essayPromptId,
      },
    });

    await this.cacheInvalidation.onProfileChange(userId);

    return essay;
  }

  /**
   * Update an existing essay after verifying ownership. Recomputes word count
   * if content is provided.
   *
   * @param userId - The requesting user's ID
   * @param essayId - The essay ID to update
   * @param data - Partial essay update DTO
   * @returns The updated Essay record
   * @throws {NotFoundException} When the essay does not exist
   * @throws {ForbiddenException} When the essay does not belong to the user
   */
  async updateEssay(
    userId: string,
    essayId: string,
    data: UpdateEssayDto,
  ): Promise<Essay> {
    this.helpers.verifyProfileOwnership(
      await this.prisma.essay.findUnique({
        where: { id: essayId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Essay',
    );

    const wordCount =
      data.content !== undefined ? this.countWords(data.content) : undefined;

    const result = await this.prisma.essay.update({
      where: { id: essayId },
      data: {
        title: data.title,
        prompt: data.prompt,
        content: data.content,
        wordCount,
        schoolId: data.schoolId,
        essayPromptId: data.essayPromptId,
      },
    });
    await this.cacheInvalidation.onProfileChange(userId);
    return result;
  }

  /**
   * Delete an essay by ID after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param essayId - The essay ID to delete
   * @throws {NotFoundException} When the essay does not exist
   * @throws {ForbiddenException} When the essay does not belong to the user
   */
  async deleteEssay(userId: string, essayId: string): Promise<void> {
    this.helpers.verifyProfileOwnership(
      await this.prisma.essay.findUnique({
        where: { id: essayId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Essay',
    );

    await this.prisma.essay.delete({ where: { id: essayId } });
    await this.cacheInvalidation.onProfileChange(userId);
  }

  /**
   * Get all essays for a user, ordered by updatedAt descending.
   *
   * @param userId - The user identifier
   * @returns Array of Essay records, or empty array if no profile exists
   */
  async getEssays(userId: string): Promise<Essay[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        essays: {
          include: {
            linkedPrompt: {
              select: {
                id: true,
                type: true,
                prompt: true,
                promptZh: true,
                wordLimit: true,
                isRequired: true,
                school: { select: { id: true, name: true, nameZh: true } },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    return profile?.essays || [];
  }

  /**
   * Get a single essay by ID after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param essayId - The essay ID to retrieve
   * @returns The Essay record
   * @throws {NotFoundException} When the essay does not exist
   * @throws {ForbiddenException} When the essay does not belong to the user
   */
  async getEssayById(userId: string, essayId: string): Promise<Essay> {
    const essay = this.helpers.verifyProfileOwnership(
      await this.prisma.essay.findUnique({
        where: { id: essayId },
        include: {
          profile: { select: { userId: true } },
          linkedPrompt: {
            select: {
              id: true,
              type: true,
              prompt: true,
              promptZh: true,
              wordLimit: true,
              isRequired: true,
              school: { select: { id: true, name: true, nameZh: true } },
            },
          },
        },
      }),
      userId,
      'Essay',
    );

    return essay;
  }

  async createEssayRevision(
    userId: string,
    essayId: string,
    data: CreateEssayRevisionDto = {},
  ): Promise<EssayRevision> {
    const essay = this.helpers.verifyProfileOwnership(
      await this.prisma.essay.findUnique({
        where: { id: essayId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Essay',
    );

    return this.prisma.essayRevision.create({
      data: this.revisionPayload(essay, data),
    });
  }

  async getEssayRevisions(
    userId: string,
    essayId: string,
  ): Promise<EssayRevision[]> {
    this.helpers.verifyProfileOwnership(
      await this.prisma.essay.findUnique({
        where: { id: essayId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Essay',
    );

    return this.prisma.essayRevision.findMany({
      where: { essayId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async restoreEssayRevision(
    userId: string,
    essayId: string,
    revisionId: string,
  ): Promise<Essay> {
    const revision = await this.prisma.essayRevision.findUnique({
      where: { id: revisionId },
      include: {
        essay: { include: { profile: { select: { userId: true } } } },
      },
    });

    const essay = this.helpers.verifyProfileOwnership(
      revision?.essay ?? null,
      userId,
      'Essay',
    );

    if (essay.id !== essayId) {
      throw new BadRequestException('Revision does not belong to this essay');
    }

    const restored = await this.prisma.$transaction(async (tx) => {
      await tx.essayRevision.create({
        data: this.revisionPayload(essay, {
          reason: 'Before restoring revision',
          source: 'restore',
        }),
      });

      return tx.essay.update({
        where: { id: essayId },
        data: {
          title: revision!.title,
          prompt: revision!.prompt,
          content: revision!.content,
          wordCount: revision!.wordCount,
        },
      });
    });

    await this.cacheInvalidation.onProfileChange(userId);
    return restored;
  }

  async getEssaySuggestions(
    userId: string,
    essayId: string,
    status?: string,
  ): Promise<EssaySuggestion[]> {
    this.helpers.verifyProfileOwnership(
      await this.prisma.essay.findUnique({
        where: { id: essayId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Essay',
    );

    return this.prisma.essaySuggestion.findMany({
      where: { essayId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async updateEssaySuggestion(
    userId: string,
    essayId: string,
    suggestionId: string,
    data: UpdateEssaySuggestionDto,
  ): Promise<EssaySuggestion> {
    const suggestion = await this.prisma.essaySuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        essay: { include: { profile: { select: { userId: true } } } },
      },
    });

    const essay = this.helpers.verifyProfileOwnership(
      suggestion?.essay ?? null,
      userId,
      'Essay',
    );

    if (essay.id !== essayId) {
      throw new BadRequestException('Suggestion does not belong to this essay');
    }

    return this.prisma.essaySuggestion.update({
      where: { id: suggestionId },
      data: { status: data.status },
    });
  }

  async applyEssaySuggestion(
    userId: string,
    essayId: string,
    suggestionId: string,
  ): Promise<{
    essay: Essay;
    suggestion: EssaySuggestion;
    revision: EssayRevision;
  }> {
    const suggestion = await this.prisma.essaySuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        essay: { include: { profile: { select: { userId: true } } } },
      },
    });

    const essay = this.helpers.verifyProfileOwnership(
      suggestion?.essay ?? null,
      userId,
      'Essay',
    );

    if (essay.id !== essayId) {
      throw new BadRequestException('Suggestion does not belong to this essay');
    }

    if (suggestion!.status !== 'PENDING') {
      throw new BadRequestException('Suggestion has already been handled');
    }

    const original = suggestion!.originalText ?? '';
    const replacement = suggestion!.replacementText;
    let nextContent = essay.content;

    if (suggestion!.insertMode === 'append' || !original.trim()) {
      nextContent = `${essay.content}${essay.content.trim() ? '\n\n' : ''}${replacement}`;
    } else if (suggestion!.insertMode === 'prepend') {
      nextContent = `${replacement}${essay.content.trim() ? '\n\n' : ''}${essay.content}`;
    } else {
      if (!essay.content.includes(original)) {
        throw new BadRequestException(
          'Original text no longer exists in the current draft',
        );
      }
      nextContent = essay.content.replace(original, replacement);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const revision = await tx.essayRevision.create({
        data: this.revisionPayload(essay, {
          reason: 'Before applying AI suggestion',
          source: 'ai_apply',
        }),
      });

      const updatedEssay = await tx.essay.update({
        where: { id: essayId },
        data: {
          content: nextContent,
          wordCount: this.countWords(nextContent),
        },
      });

      const updatedSuggestion = await tx.essaySuggestion.update({
        where: { id: suggestionId },
        data: { status: 'APPLIED' },
      });

      return {
        essay: updatedEssay,
        suggestion: updatedSuggestion,
        revision,
      };
    });

    await this.cacheInvalidation.onProfileChange(userId);
    return result;
  }
}
