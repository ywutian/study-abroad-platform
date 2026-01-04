import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Profile, TestScore, Activity, Award, Essay, Education, Prisma, Visibility, Role } from '@prisma/client';
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

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

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
    requesterRole: Role
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

    if (profile.visibility === Visibility.VERIFIED_ONLY && requesterRole !== Role.VERIFIED) {
      throw new ForbiddenException('Only verified users can view this profile');
    }

    if (profile.visibility === Visibility.ANONYMOUS) {
      return this.anonymizeProfile(profile);
    }

    return profile;
  }

  private anonymizeProfile(
    profile: Profile & { testScores?: unknown[]; activities?: unknown[]; awards?: unknown[] }
  ): Profile & { testScores?: unknown[]; activities?: unknown[]; awards?: unknown[] } {
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

  async create(userId: string, data: Prisma.ProfileCreateWithoutUserInput): Promise<Profile> {
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

    return this.prisma.profile.upsert({
      where: { userId },
      update: profileData,
      create: {
        ...profileData,
        user: { connect: { id: userId } },
      },
    });
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

  async createTestScore(userId: string, data: CreateTestScoreDto): Promise<TestScore> {
    const profileId = await this.getProfileId(userId);

    return this.prisma.testScore.create({
      data: {
        profileId,
        type: data.type as any,
        score: data.score,
        subScores: data.subScores as any,
        testDate: data.testDate ? new Date(data.testDate) : null,
      },
    });
  }

  async updateTestScore(userId: string, scoreId: string, data: UpdateTestScoreDto): Promise<TestScore> {
    const score = await this.prisma.testScore.findUnique({
      where: { id: scoreId },
      include: { profile: { select: { userId: true } } },
    });

    if (!score || score.profile.userId !== userId) {
      throw new NotFoundException('Test score not found');
    }

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
    const score = await this.prisma.testScore.findUnique({
      where: { id: scoreId },
      include: { profile: { select: { userId: true } } },
    });

    if (!score || score.profile.userId !== userId) {
      throw new NotFoundException('Test score not found');
    }

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

  async createActivity(userId: string, data: CreateActivityDto): Promise<Activity> {
    const profileId = await this.getProfileId(userId);

    return this.prisma.activity.create({
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
  }

  async updateActivity(userId: string, activityId: string, data: UpdateActivityDto): Promise<Activity> {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { profile: { select: { userId: true } } },
    });

    if (!activity || activity.profile.userId !== userId) {
      throw new NotFoundException('Activity not found');
    }

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
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
      include: { profile: { select: { userId: true } } },
    });

    if (!activity || activity.profile.userId !== userId) {
      throw new NotFoundException('Activity not found');
    }

    await this.prisma.activity.delete({ where: { id: activityId } });
  }

  async getActivities(userId: string): Promise<Activity[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { activities: { orderBy: { order: 'asc' } } },
    });

    return profile?.activities || [];
  }

  async reorderActivities(userId: string, activityIds: string[]): Promise<void> {
    const profileId = await this.getProfileId(userId);

    await this.prisma.$transaction(
      activityIds.map((id, index) =>
        this.prisma.activity.updateMany({
          where: { id, profileId },
          data: { order: index },
        })
      )
    );
  }

  // ============================================
  // Awards CRUD
  // ============================================

  async createAward(userId: string, data: CreateAwardDto): Promise<Award> {
    const profileId = await this.getProfileId(userId);

    return this.prisma.award.create({
      data: {
        profileId,
        name: data.name,
        level: data.level as any,
        year: data.year,
        description: data.description,
        order: data.order ?? 0,
      },
    });
  }

  async updateAward(userId: string, awardId: string, data: UpdateAwardDto): Promise<Award> {
    const award = await this.prisma.award.findUnique({
      where: { id: awardId },
      include: { profile: { select: { userId: true } } },
    });

    if (!award || award.profile.userId !== userId) {
      throw new NotFoundException('Award not found');
    }

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
    const award = await this.prisma.award.findUnique({
      where: { id: awardId },
      include: { profile: { select: { userId: true } } },
    });

    if (!award || award.profile.userId !== userId) {
      throw new NotFoundException('Award not found');
    }

    await this.prisma.award.delete({ where: { id: awardId } });
  }

  async getAwards(userId: string): Promise<Award[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { awards: { orderBy: { order: 'asc' } } },
    });

    return profile?.awards || [];
  }

  async reorderAwards(userId: string, awardIds: string[]): Promise<void> {
    const profileId = await this.getProfileId(userId);

    await this.prisma.$transaction(
      awardIds.map((id, index) =>
        this.prisma.award.updateMany({
          where: { id, profileId },
          data: { order: index },
        })
      )
    );
  }

  // ============================================
  // Essays CRUD
  // ============================================

  async createEssay(userId: string, data: CreateEssayDto): Promise<Essay> {
    const profileId = await this.getProfileId(userId);
    const wordCount = data.content.split(/\s+/).filter(Boolean).length;

    return this.prisma.essay.create({
      data: {
        profileId,
        title: data.title,
        prompt: data.prompt,
        content: data.content,
        wordCount,
        schoolId: data.schoolId,
      },
    });
  }

  async updateEssay(userId: string, essayId: string, data: UpdateEssayDto): Promise<Essay> {
    const essay = await this.prisma.essay.findUnique({
      where: { id: essayId },
      include: { profile: { select: { userId: true } } },
    });

    if (!essay || essay.profile.userId !== userId) {
      throw new NotFoundException('Essay not found');
    }

    const wordCount = data.content ? data.content.split(/\s+/).filter(Boolean).length : undefined;

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
    const essay = await this.prisma.essay.findUnique({
      where: { id: essayId },
      include: { profile: { select: { userId: true } } },
    });

    if (!essay || essay.profile.userId !== userId) {
      throw new NotFoundException('Essay not found');
    }

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
    const essay = await this.prisma.essay.findUnique({
      where: { id: essayId },
      include: { profile: { select: { userId: true } } },
    });

    if (!essay || essay.profile.userId !== userId) {
      throw new NotFoundException('Essay not found');
    }

    return essay;
  }

  // ============================================
  // Education CRUD
  // ============================================

  async createEducation(userId: string, data: CreateEducationDto): Promise<Education> {
    const profileId = await this.getProfileId(userId);

    return this.prisma.education.create({
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
  }

  async updateEducation(userId: string, educationId: string, data: UpdateEducationDto): Promise<Education> {
    const education = await this.prisma.education.findUnique({
      where: { id: educationId },
      include: { profile: { select: { userId: true } } },
    });

    if (!education || education.profile.userId !== userId) {
      throw new NotFoundException('Education not found');
    }

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
        gpaScale: data.gpaScale !== undefined ? new Prisma.Decimal(data.gpaScale) : undefined,
        description: data.description,
      },
    });
  }

  async deleteEducation(userId: string, educationId: string): Promise<void> {
    const education = await this.prisma.education.findUnique({
      where: { id: educationId },
      include: { profile: { select: { userId: true } } },
    });

    if (!education || education.profile.userId !== userId) {
      throw new NotFoundException('Education not found');
    }

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

  async setTargetSchools(userId: string, schoolIds: string[], priorities?: Record<string, number>) {
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

    return this.getTargetSchools(userId);
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

    return this.prisma.profileTargetSchool.create({
      data: { profileId, schoolId, priority: priority ?? 0 },
      include: { school: true },
    });
  }

  async removeTargetSchool(userId: string, schoolId: string) {
    const profileId = await this.getProfileId(userId);

    await this.prisma.profileTargetSchool.deleteMany({
      where: { profileId, schoolId },
    });
  }
}
