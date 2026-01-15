import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationService } from '../../common/services/authorization.service';
import {
  Profile,
  TestScore,
  Activity,
  Award,
  Essay,
  Education,
  Prisma,
  Visibility,
  Role,
  MemoryType,
  EntityType,
} from '@prisma/client';
import {
  UpdateProfileDto,
  CreateTestScoreDto,
  UpdateTestScoreDto,
  CreateActivityDto,
  UpdateActivityDto,
  CreateAwardDto,
  UpdateAwardDto,
  CreateEssayDto,
  UpdateEssayDto,
  CreateEducationDto,
  UpdateEducationDto,
} from './dto';
import { MemoryManagerService } from '../ai-agent/memory/memory-manager.service';

// 嵌套实体类型（通过 profile 关联到 user）
interface ProfileOwnable {
  profile: { userId: string };
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    private auth: AuthorizationService,
    @Optional()
    @Inject(forwardRef(() => MemoryManagerService))
    private memoryManager?: MemoryManagerService,
  ) {}

  /**
   * 验证嵌套实体所有权（通过 profile.userId）
   */
  private verifyProfileOwnership<T extends ProfileOwnable>(
    entity: T | null,
    userId: string,
    entityName: string,
  ): T {
    return this.auth.verifyNestedOwnership(
      entity,
      userId,
      (e) => e.profile?.userId,
      { entityName },
    );
  }

  // ============================================
  // Profile CRUD
  // ============================================

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.prisma.profile.findUnique({
      where: { userId },
      include: {
        testScores: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { order: 'asc' } },
        awards: { orderBy: { order: 'asc' } },
        education: true,
        essays: true,
      },
    });
  }

  async findByIdWithVisibilityCheck(
    profileId: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<Profile | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      include: {
        testScores: true,
        activities: { orderBy: { order: 'asc' } },
        awards: { orderBy: { order: 'asc' } },
        user: { select: { id: true } },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    if (profile.userId === requesterId) {
      return profile;
    }

    if (requesterRole === Role.ADMIN) {
      return profile;
    }

    if (profile.visibility === Visibility.PRIVATE) {
      throw new ForbiddenException('This profile is private');
    }

    if (
      profile.visibility === Visibility.VERIFIED_ONLY &&
      requesterRole !== Role.VERIFIED
    ) {
      throw new ForbiddenException('Only verified users can view this profile');
    }

    if (profile.visibility === Visibility.ANONYMOUS) {
      return this.anonymizeProfile(profile);
    }

    return profile;
  }

  private anonymizeProfile(
    profile: Profile & {
      testScores?: unknown[];
      activities?: unknown[];
      awards?: unknown[];
    },
  ): Profile & {
    testScores?: unknown[];
    activities?: unknown[];
    awards?: unknown[];
  } {
    return {
      ...profile,
      realName: null,
      currentSchool: this.anonymizeSchool(profile.currentSchool),
      gpa: profile.gpa ? this.anonymizeGpa(Number(profile.gpa)) : null,
    };
  }

  private anonymizeSchool(school: string | null): string | null {
    if (!school) return null;
    return 'Private School';
  }

  private anonymizeGpa(gpa: number): Prisma.Decimal {
    if (gpa >= 3.9) return new Prisma.Decimal(3.9);
    if (gpa >= 3.7) return new Prisma.Decimal(3.7);
    if (gpa >= 3.5) return new Prisma.Decimal(3.5);
    if (gpa >= 3.3) return new Prisma.Decimal(3.3);
    if (gpa >= 3.0) return new Prisma.Decimal(3.0);
    return new Prisma.Decimal(2.5);
  }

  async create(
    userId: string,
    data: Prisma.ProfileCreateWithoutUserInput,
  ): Promise<Profile> {
    return this.prisma.profile.create({
      data: {
        ...data,
        user: { connect: { id: userId } },
      },
    });
  }

  async update(userId: string, data: UpdateProfileDto): Promise<Profile> {
    return this.prisma.profile.update({
      where: { userId },
      data: {
        ...data,
        gpa: data.gpa ? new Prisma.Decimal(data.gpa) : undefined,
        gpaScale: data.gpaScale ? new Prisma.Decimal(data.gpaScale) : undefined,
      },
    });
  }

  async upsert(userId: string, data: UpdateProfileDto): Promise<Profile> {
    const profileData = {
      ...data,
      gpa: data.gpa ? new Prisma.Decimal(data.gpa) : undefined,
      gpaScale: data.gpaScale ? new Prisma.Decimal(data.gpaScale) : undefined,
    };

    const profile = await this.prisma.profile.upsert({
      where: { userId },
      update: profileData,
      create: {
        ...profileData,
        user: { connect: { id: userId } },
      },
    });

    // 记录档案更新到记忆系统
    this.recordProfileUpdateToMemory(userId, data).catch((err) => {
      this.logger.warn('Failed to record profile update to memory', err);
    });

    return profile;
  }

  // ============================================
  // Test Scores CRUD
  // ============================================

  async getProfileId(userId: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!profile) {
      // Auto-create profile if not exists
      const newProfile = await this.prisma.profile.create({
        data: { user: { connect: { id: userId } } },
      });
      return newProfile.id;
    }

    return profile.id;
  }

  async createTestScore(
    userId: string,
    data: CreateTestScoreDto,
  ): Promise<TestScore> {
    const profileId = await this.getProfileId(userId);

    const testScore = await this.prisma.testScore.create({
      data: {
        profileId,
        type: data.type as any,
        score: data.score,
        subScores: data.subScores as any,
        testDate: data.testDate ? new Date(data.testDate) : null,
      },
    });

    // 记录成绩到记忆系统
    this.recordTestScoreToMemory(userId, data).catch((err) => {
      this.logger.warn('Failed to record test score to memory', err);
    });

    return testScore;
  }

  async updateTestScore(
    userId: string,
    scoreId: string,
    data: UpdateTestScoreDto,
  ): Promise<TestScore> {
    const score = this.verifyProfileOwnership(
      await this.prisma.testScore.findUnique({
        where: { id: scoreId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Test score',
    );

    return this.prisma.testScore.update({
      where: { id: scoreId },
      data: {
        type: data.type as any,
        score: data.score,
        subScores: data.subScores as any,
        testDate: data.testDate ? new Date(data.testDate) : undefined,
      },
    });
  }

  async deleteTestScore(userId: string, scoreId: string): Promise<void> {
    this.verifyProfileOwnership(
      await this.prisma.testScore.findUnique({
        where: { id: scoreId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Test score',
    );

    await this.prisma.testScore.delete({ where: { id: scoreId } });
  }

  async getTestScores(userId: string): Promise<TestScore[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { testScores: { orderBy: { createdAt: 'desc' } } },
    });

    return profile?.testScores || [];
  }

  // ============================================
  // Activities CRUD
  // ============================================

  async createActivity(
    userId: string,
    data: CreateActivityDto,
  ): Promise<Activity> {
    const profileId = await this.getProfileId(userId);

    const activity = await this.prisma.activity.create({
      data: {
        profileId,
        name: data.name,
        category: data.category as any,
        role: data.role,
        organization: data.organization,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        hoursPerWeek: data.hoursPerWeek,
        weeksPerYear: data.weeksPerYear,
        isOngoing: data.isOngoing ?? false,
        order: data.order ?? 0,
      },
    });

    // 记录活动到记忆系统
    this.recordActivityToMemory(userId, data).catch((err) => {
      this.logger.warn('Failed to record activity to memory', err);
    });

    return activity;
  }

  async updateActivity(
    userId: string,
    activityId: string,
    data: UpdateActivityDto,
  ): Promise<Activity> {
    const activity = this.verifyProfileOwnership(
      await this.prisma.activity.findUnique({
        where: { id: activityId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Activity',
    );

    return this.prisma.activity.update({
      where: { id: activityId },
      data: {
        name: data.name,
        category: data.category as any,
        role: data.role,
        organization: data.organization,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        hoursPerWeek: data.hoursPerWeek,
        weeksPerYear: data.weeksPerYear,
        isOngoing: data.isOngoing,
        order: data.order,
      },
    });
  }

  async deleteActivity(userId: string, activityId: string): Promise<void> {
    this.verifyProfileOwnership(
      await this.prisma.activity.findUnique({
        where: { id: activityId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Activity',
    );

    await this.prisma.activity.delete({ where: { id: activityId } });
  }

  async getActivities(userId: string): Promise<Activity[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { activities: { orderBy: { order: 'asc' } } },
    });

    return profile?.activities || [];
  }

  /**
   * 重新排序活动
   *
   * 安全设计：
   * - 先验证所有传入的 ID 都属于当前用户
   * - 如果有任何 ID 不属于当前用户，直接拒绝整个请求
   */
  async reorderActivities(
    userId: string,
    activityIds: string[],
  ): Promise<void> {
    const profileId = await this.getProfileId(userId);

    // 安全验证：确保所有 ID 都属于当前用户的 profile
    const ownedActivities = await this.prisma.activity.findMany({
      where: { id: { in: activityIds }, profileId },
      select: { id: true },
    });

    const ownedIds = new Set(ownedActivities.map((a) => a.id));
    const invalidIds = activityIds.filter((id) => !ownedIds.has(id));

    if (invalidIds.length > 0) {
      throw new ForbiddenException(
        'Cannot reorder activities that do not belong to you',
      );
    }

    await this.prisma.$transaction(
      activityIds.map((id, index) =>
        this.prisma.activity.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }

  // ============================================
  // Awards CRUD
  // ============================================

  async createAward(userId: string, data: CreateAwardDto): Promise<Award> {
    const profileId = await this.getProfileId(userId);

    const award = await this.prisma.award.create({
      data: {
        profileId,
        name: data.name,
        level: data.level as any,
        year: data.year,
        description: data.description,
        order: data.order ?? 0,
      },
    });

    // 记录奖项到记忆系统
    this.recordAwardToMemory(userId, data).catch((err) => {
      this.logger.warn('Failed to record award to memory', err);
    });

    return award;
  }

  async updateAward(
    userId: string,
    awardId: string,
    data: UpdateAwardDto,
  ): Promise<Award> {
    const award = this.verifyProfileOwnership(
      await this.prisma.award.findUnique({
        where: { id: awardId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Award',
    );

    return this.prisma.award.update({
      where: { id: awardId },
      data: {
        name: data.name,
        level: data.level as any,
        year: data.year,
        description: data.description,
        order: data.order,
      },
    });
  }

  async deleteAward(userId: string, awardId: string): Promise<void> {
    this.verifyProfileOwnership(
      await this.prisma.award.findUnique({
        where: { id: awardId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Award',
    );

    await this.prisma.award.delete({ where: { id: awardId } });
  }

  async getAwards(userId: string): Promise<Award[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { awards: { orderBy: { order: 'asc' } } },
    });

    return profile?.awards || [];
  }

  /**
   * 重新排序奖项
   *
   * 安全设计：同 reorderActivities
   */
  async reorderAwards(userId: string, awardIds: string[]): Promise<void> {
    const profileId = await this.getProfileId(userId);

    // 安全验证：确保所有 ID 都属于当前用户的 profile
    const ownedAwards = await this.prisma.award.findMany({
      where: { id: { in: awardIds }, profileId },
      select: { id: true },
    });

    const ownedIds = new Set(ownedAwards.map((a) => a.id));
    const invalidIds = awardIds.filter((id) => !ownedIds.has(id));

    if (invalidIds.length > 0) {
      throw new ForbiddenException(
        'Cannot reorder awards that do not belong to you',
      );
    }

    await this.prisma.$transaction(
      awardIds.map((id, index) =>
        this.prisma.award.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );
  }

  // ============================================
  // Essays CRUD
  // ============================================

  async createEssay(userId: string, data: CreateEssayDto): Promise<Essay> {
    const profileId = await this.getProfileId(userId);
    const wordCount = data.content.split(/\s+/).filter(Boolean).length;

    const essay = await this.prisma.essay.create({
      data: {
        profileId,
        title: data.title,
        prompt: data.prompt,
        content: data.content,
        wordCount,
        schoolId: data.schoolId,
      },
    });

    // 记录文书创建到记忆系统
    this.recordEssayToMemory(userId, data, wordCount).catch((err) => {
      this.logger.warn('Failed to record essay to memory', err);
    });

    return essay;
  }

  async updateEssay(
    userId: string,
    essayId: string,
    data: UpdateEssayDto,
  ): Promise<Essay> {
    this.verifyProfileOwnership(
      await this.prisma.essay.findUnique({
        where: { id: essayId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Essay',
    );

    const wordCount = data.content
      ? data.content.split(/\s+/).filter(Boolean).length
      : undefined;

    return this.prisma.essay.update({
      where: { id: essayId },
      data: {
        title: data.title,
        prompt: data.prompt,
        content: data.content,
        wordCount,
        schoolId: data.schoolId,
      },
    });
  }

  async deleteEssay(userId: string, essayId: string): Promise<void> {
    this.verifyProfileOwnership(
      await this.prisma.essay.findUnique({
        where: { id: essayId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Essay',
    );

    await this.prisma.essay.delete({ where: { id: essayId } });
  }

  async getEssays(userId: string): Promise<Essay[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { essays: { orderBy: { updatedAt: 'desc' } } },
    });

    return profile?.essays || [];
  }

  async getEssayById(userId: string, essayId: string): Promise<Essay> {
    const essay = this.verifyProfileOwnership(
      await this.prisma.essay.findUnique({
        where: { id: essayId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Essay',
    );

    return essay;
  }

  // ============================================
  // Education CRUD
  // ============================================

  async createEducation(
    userId: string,
    data: CreateEducationDto,
  ): Promise<Education> {
    const profileId = await this.getProfileId(userId);

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
      },
    });

    // 记录教育经历到记忆系统
    this.recordEducationToMemory(userId, data).catch((err) => {
      this.logger.warn('Failed to record education to memory', err);
    });

    return education;
  }

  async updateEducation(
    userId: string,
    educationId: string,
    data: UpdateEducationDto,
  ): Promise<Education> {
    const education = this.verifyProfileOwnership(
      await this.prisma.education.findUnique({
        where: { id: educationId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Education',
    );

    return this.prisma.education.update({
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
      },
    });
  }

  async deleteEducation(userId: string, educationId: string): Promise<void> {
    this.verifyProfileOwnership(
      await this.prisma.education.findUnique({
        where: { id: educationId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Education',
    );

    await this.prisma.education.delete({ where: { id: educationId } });
  }

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

  async setTargetSchools(
    userId: string,
    schoolIds: string[],
    priorities?: Record<string, number>,
  ) {
    const profileId = await this.getProfileId(userId);

    // Delete existing target schools
    await this.prisma.profileTargetSchool.deleteMany({
      where: { profileId },
    });

    // Create new target schools
    if (schoolIds.length > 0) {
      await this.prisma.profileTargetSchool.createMany({
        data: schoolIds.map((schoolId, index) => ({
          profileId,
          schoolId,
          priority: priorities?.[schoolId] ?? index + 1,
        })),
      });
    }

    const result = await this.getTargetSchools(userId);

    // 记录设置目标校列表到记忆系统
    this.recordSetTargetSchoolsToMemory(userId, result).catch((err) => {
      this.logger.warn('Failed to record set target schools to memory', err);
    });

    return result;
  }

  async addTargetSchool(userId: string, schoolId: string, priority?: number) {
    const profileId = await this.getProfileId(userId);

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

    // 记录添加目标校到记忆系统
    this.recordTargetSchoolAddToMemory(
      userId,
      schoolId,
      result.school?.nameEn || result.school?.nameCn,
    ).catch((err) => {
      this.logger.warn('Failed to record target school add to memory', err);
    });

    return result;
  }

  async removeTargetSchool(userId: string, schoolId: string) {
    const profileId = await this.getProfileId(userId);

    await this.prisma.profileTargetSchool.deleteMany({
      where: { profileId, schoolId },
    });

    // 记录移除目标校到记忆系统
    this.recordTargetSchoolRemovalToMemory(userId, schoolId).catch((err) => {
      this.logger.warn('Failed to record target school removal to memory', err);
    });
  }

  // ============================================
  // Memory Helper Methods
  // ============================================

  /**
   * 记录档案更新到记忆系统
   */
  private async recordProfileUpdateToMemory(
    userId: string,
    data: UpdateProfileDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    const updates: string[] = [];
    if (data.intendedMajor) updates.push(`意向专业: ${data.intendedMajor}`);
    if (data.gpa) updates.push(`GPA: ${data.gpa}`);
    if (data.targetCountry) updates.push(`目标国家: ${data.targetCountry}`);
    if (data.targetDegree) updates.push(`目标学位: ${data.targetDegree}`);

    if (updates.length === 0) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'profile_update',
      content: `用户更新了档案信息：${updates.join('，')}`,
      importance: 0.6,
      metadata: {
        action: 'profile_update',
        updates: Object.keys(data),
      },
    });
  }

  /**
   * 记录考试成绩到记忆系统
   */
  private async recordTestScoreToMemory(
    userId: string,
    data: CreateTestScoreDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'test_score',
      content: `用户添加了${data.type}成绩：${data.score}分${data.testDate ? '，考试日期' + data.testDate : ''}`,
      importance: 0.8,
      metadata: {
        scoreType: data.type,
        score: data.score,
        subScores: data.subScores,
        testDate: data.testDate,
      },
    });
  }

  /**
   * 记录活动经历到记忆系统
   */
  private async recordActivityToMemory(
    userId: string,
    data: CreateActivityDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'activity',
      content: `用户添加了活动经历：${data.name}（${data.category || '其他'}类别），担任${data.role || '成员'}${data.organization ? '，在' + data.organization : ''}`,
      importance: 0.6,
      metadata: {
        activityName: data.name,
        category: data.category,
        role: data.role,
        organization: data.organization,
        hoursPerWeek: data.hoursPerWeek,
        isOngoing: data.isOngoing,
      },
    });
  }

  /**
   * 记录奖项到记忆系统
   */
  private async recordAwardToMemory(
    userId: string,
    data: CreateAwardDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'award',
      content: `用户添加了奖项：${data.name}（${data.level || '其他'}级别${data.year ? '，' + data.year + '年' : ''}）`,
      importance: 0.7,
      metadata: {
        awardName: data.name,
        level: data.level,
        year: data.year,
      },
    });
  }

  /**
   * 记录教育经历到记忆系统
   */
  private async recordEducationToMemory(
    userId: string,
    data: CreateEducationDto,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'education',
      content: `用户添加了教育经历：${data.schoolName}${data.degree ? '，' + data.degree + '学位' : ''}${data.major ? '，' + data.major + '专业' : ''}${data.gpa ? '，GPA' + data.gpa : ''}`,
      importance: 0.7,
      metadata: {
        schoolName: data.schoolName,
        schoolType: data.schoolType,
        degree: data.degree,
        major: data.major,
        gpa: data.gpa,
        isCurrentSchool: data.isCurrentSchool,
      },
    });
  }

  /**
   * 记录文书创建到记忆系统
   */
  private async recordEssayToMemory(
    userId: string,
    data: CreateEssayDto,
    wordCount: number,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.FACT,
      category: 'essay',
      content: `用户创建了文书：标题"${data.title}"${data.prompt ? '，题目"' + data.prompt.slice(0, 50) + '..."' : ''}，共${wordCount}词`,
      importance: 0.6,
      metadata: {
        title: data.title,
        promptPreview: data.prompt?.slice(0, 100),
        wordCount,
        schoolId: data.schoolId,
      },
    });
  }

  /**
   * 记录添加目标校到记忆系统
   */
  private async recordTargetSchoolAddToMemory(
    userId: string,
    schoolId: string,
    schoolName?: string,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.PREFERENCE,
      category: 'target_school',
      content: `用户将${schoolName || schoolId}添加为目标学校`,
      importance: 0.8,
      metadata: {
        action: 'add_target_school',
        schoolId,
        schoolName,
      },
    });

    // 记录学校实体
    if (schoolName) {
      await this.memoryManager.recordEntity(userId, {
        type: EntityType.SCHOOL,
        name: schoolName,
        description: '用户的目标学校',
        attributes: { isTarget: true },
      });
    }
  }

  /**
   * 记录移除目标校到记忆系统
   */
  private async recordTargetSchoolRemovalToMemory(
    userId: string,
    schoolId: string,
  ): Promise<void> {
    if (!this.memoryManager) return;

    await this.memoryManager.remember(userId, {
      type: MemoryType.DECISION,
      category: 'target_school',
      content: `用户从目标学校列表中移除了一所学校`,
      importance: 0.5,
      metadata: {
        action: 'remove_target_school',
        schoolId,
      },
    });
  }

  /**
   * 记录设置目标校列表到记忆系统
   */
  private async recordSetTargetSchoolsToMemory(
    userId: string,
    targetSchools: any[],
  ): Promise<void> {
    if (!this.memoryManager || targetSchools.length === 0) return;

    const schoolNames = targetSchools
      .slice(0, 5)
      .map((ts) => ts.school?.nameEn || ts.school?.nameCn || ts.schoolId)
      .join('、');

    await this.memoryManager.remember(userId, {
      type: MemoryType.DECISION,
      category: 'target_school_list',
      content: `用户设置了${targetSchools.length}所目标学校：${schoolNames}${targetSchools.length > 5 ? '等' : ''}`,
      importance: 0.8,
      metadata: {
        action: 'set_target_schools',
        count: targetSchools.length,
        schoolIds: targetSchools.map((ts) => ts.schoolId),
      },
    });

    // 记录学校实体
    for (const ts of targetSchools) {
      const schoolName = ts.school?.nameEn || ts.school?.nameCn;
      if (schoolName) {
        await this.memoryManager.recordEntity(userId, {
          type: EntityType.SCHOOL,
          name: schoolName,
          description: `用户的目标学校，优先级${ts.priority}`,
          attributes: { isTarget: true, priority: ts.priority },
        });
      }
    }
  }

  /**
   * Calculate profile grade with scoring logic.
   * Extracted from controller for proper separation of concerns.
   */
  async calculateProfileGrade(userId: string): Promise<{
    overallScore: number;
    admissionPrediction: string;
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
    recommendedActivities: string[];
    timeline: Array<{ date: string; task: string }>;
    projectedImprovement: number;
  }> {
    const profile = await this.findByUserId(userId);

    let overallScore = 50; // Base score
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (profile) {
      // GPA contribution
      if (profile.gpa) {
        const gpaPercent =
          (Number(profile.gpa) / Number(profile.gpaScale ?? 4)) * 100;
        if (gpaPercent >= 90) {
          overallScore += 15;
          strengths.push('Excellent GPA above 3.6');
        } else if (gpaPercent >= 75) {
          overallScore += 10;
          strengths.push('Good GPA above 3.0');
        } else {
          weaknesses.push('GPA could be improved');
        }
      } else {
        weaknesses.push('GPA not recorded');
      }

      // Test scores
      const testScores = (profile as any).testScores || [];
      const satScore = testScores.find((t: any) => t.type === 'SAT');
      const toeflScore = testScores.find((t: any) => t.type === 'TOEFL');

      if (satScore && satScore.score >= 1400) {
        overallScore += 10;
        strengths.push(`Strong SAT score: ${satScore.score}`);
      } else if (satScore) {
        overallScore += 5;
      }

      if (toeflScore && toeflScore.score >= 100) {
        overallScore += 5;
        strengths.push(`TOEFL score above 100: ${toeflScore.score}`);
      }

      // Activities
      const activities = (profile as any).activities || [];
      if (activities.length >= 5) {
        overallScore += 10;
        strengths.push(
          `Diverse extracurricular involvement (${activities.length} activities)`,
        );
      } else if (activities.length > 0) {
        overallScore += activities.length * 2;
      } else {
        weaknesses.push('No extracurricular activities recorded');
      }

      // Awards
      const awards = (profile as any).awards || [];
      if (awards.length >= 3) {
        overallScore += 10;
        strengths.push(`Multiple awards and recognitions (${awards.length})`);
      } else if (awards.length > 0) {
        overallScore += awards.length * 3;
      }
    }

    // Cap score at 100
    overallScore = Math.min(100, overallScore);

    return {
      overallScore,
      admissionPrediction:
        overallScore >= 80
          ? 'Strong candidate for top universities'
          : overallScore >= 60
            ? 'Competitive applicant with room for improvement'
            : 'Building a strong profile - focus on key areas',
      strengths,
      weaknesses,
      improvements: [
        'Consider adding research experience',
        'Participate in leadership positions in your activities',
        'Pursue academic competitions in your field of interest',
      ],
      recommendedActivities: [
        'Join summer research programs at local universities',
        'Start a project or initiative related to your intended major',
        'Seek internship opportunities in your field',
      ],
      timeline: [
        { date: '3 months', task: 'Complete standardized testing' },
        { date: '6 months', task: 'Start college essays' },
        { date: '9 months', task: 'Finalize school list and applications' },
      ],
      projectedImprovement: Math.min(20, 100 - overallScore),
    };
  }
}
