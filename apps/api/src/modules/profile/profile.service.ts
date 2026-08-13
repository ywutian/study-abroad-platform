import { Injectable, Logger } from '@nestjs/common';
import type { PredictionBlocker } from '@study-abroad/shared';
import {
  Profile,
  TestScore,
  Activity,
  Award,
  Essay,
  EssayRevision,
  EssaySuggestion,
  Education,
  Prisma,
  Role,
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
  CreateEssayRevisionDto,
  UpdateEssayDto,
  UpdateEssaySuggestionDto,
  CreateEducationDto,
  UpdateEducationDto,
  CreateRecommendationLetterDto,
  UpdateRecommendationLetterDto,
  CreateSemesterGpaDto,
  UpdateSemesterGpaDto,
} from './dto';
import { PrismaService } from '../../prisma/prisma.service';
import type { CachedProfile } from './profile-crud.service';
import { ProfileCrudService } from './profile-crud.service';
import { ProfileScoresService } from './profile-scores.service';
import { ProfileEducationService } from './profile-education.service';
import { ProfileAnalysisService } from './profile-analysis.service';
import { ProfileMemoryService } from './profile-memory.service';
import { ProfileHelpersService } from './profile-helpers.service';
import { fireAndForget } from '../../common/utils/async.util';

/**
 * Service managing user profiles and all nested entities (test scores, activities,
 * awards, essays, education, target schools).
 *
 * Delegates to sub-services for each domain area while maintaining the same public API.
 *
 * Key behaviors:
 * - All nested-entity mutations verify ownership via profile.userId before proceeding
 * - Profile auto-creation on first nested-entity write (via {@link getProfileId})
 * - Every mutation asynchronously syncs to the memory system for AI agent context
 * - Visibility checks enforce PRIVATE, ANONYMOUS, VERIFIED_ONLY, and PUBLIC access levels
 * - Reorder operations validate all IDs belong to the current user within a transaction
 */
@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private prisma: PrismaService,
    private crudService: ProfileCrudService,
    private scoresService: ProfileScoresService,
    private educationService: ProfileEducationService,
    private analysisService: ProfileAnalysisService,
    private memoryService: ProfileMemoryService,
    private helpers: ProfileHelpersService,
  ) {}

  // ============================================
  // Profile CRUD (delegated to ProfileCrudService)
  // ============================================

  async findByUserId(userId: string): Promise<CachedProfile | null> {
    return this.crudService.findByUserId(userId);
  }

  async findByIdWithVisibilityCheck(
    profileId: string,
    requesterId: string,
    requesterRole: Role,
  ): Promise<Profile | null> {
    return this.crudService.findByIdWithVisibilityCheck(
      profileId,
      requesterId,
      requesterRole,
    );
  }

  async create(
    userId: string,
    data: Prisma.ProfileCreateWithoutUserInput,
  ): Promise<Profile> {
    return this.crudService.create(userId, data);
  }

  async update(userId: string, data: UpdateProfileDto): Promise<Profile> {
    return this.crudService.update(userId, data);
  }

  async upsert(userId: string, data: UpdateProfileDto): Promise<Profile> {
    const profile = await this.crudService.upsert(userId, data);

    // 记录档案更新到记忆系统
    fireAndForget(
      this.memoryService.recordProfileUpdateToMemory(userId, data),
      this.logger,
      'Failed to record profile update to memory',
    );

    return profile;
  }

  // ============================================
  // Helper (delegated to ProfileHelpersService)
  // ============================================

  async getProfileId(userId: string): Promise<string> {
    return this.helpers.getProfileId(userId);
  }

  // ============================================
  // Test Scores CRUD (delegated to ProfileScoresService)
  // ============================================

  async createTestScore(
    userId: string,
    data: CreateTestScoreDto,
  ): Promise<TestScore> {
    const testScore = await this.scoresService.createTestScore(userId, data);

    // 记录成绩到记忆系统
    fireAndForget(
      this.memoryService.recordTestScoreToMemory(userId, data),
      this.logger,
      'Failed to record test score to memory',
    );

    return testScore;
  }

  async updateTestScore(
    userId: string,
    scoreId: string,
    data: UpdateTestScoreDto,
  ): Promise<TestScore> {
    return this.scoresService.updateTestScore(userId, scoreId, data);
  }

  async deleteTestScore(userId: string, scoreId: string): Promise<void> {
    return this.scoresService.deleteTestScore(userId, scoreId);
  }

  async getTestScores(userId: string): Promise<TestScore[]> {
    return this.scoresService.getTestScores(userId);
  }

  // ============================================
  // Activities CRUD (delegated to ProfileScoresService)
  // ============================================

  async createActivity(
    userId: string,
    data: CreateActivityDto,
  ): Promise<Activity> {
    const activity = await this.scoresService.createActivity(userId, data);

    // 记录活动到记忆系统
    fireAndForget(
      this.memoryService.recordActivityToMemory(userId, data),
      this.logger,
      'Failed to record activity to memory',
    );

    return activity;
  }

  async updateActivity(
    userId: string,
    activityId: string,
    data: UpdateActivityDto,
  ): Promise<Activity> {
    return this.scoresService.updateActivity(userId, activityId, data);
  }

  async deleteActivity(userId: string, activityId: string): Promise<void> {
    return this.scoresService.deleteActivity(userId, activityId);
  }

  async getActivities(userId: string): Promise<Activity[]> {
    return this.scoresService.getActivities(userId);
  }

  async reorderActivities(
    userId: string,
    activityIds: string[],
  ): Promise<void> {
    return this.scoresService.reorderActivities(userId, activityIds);
  }

  async aiSortActivities(
    userId: string,
    locale: string,
  ): Promise<{
    suggestedOrder: Array<{
      activityId: string;
      rank: number;
      reasoning: string;
    }>;
    summary: string;
  }> {
    return this.scoresService.aiSortActivities(userId, locale);
  }

  async refineActivityDescription(
    userId: string,
    activityId: string,
    locale: string,
  ) {
    return this.scoresService.refineActivityDescription(
      userId,
      activityId,
      locale,
    );
  }

  async generateCommonAppDescription(
    userId: string,
    activityId: string,
    locale: string,
  ) {
    return this.scoresService.generateCommonAppDescription(
      userId,
      activityId,
      locale,
    );
  }

  // ============================================
  // Awards CRUD (delegated to ProfileScoresService)
  // ============================================

  async createAward(userId: string, data: CreateAwardDto): Promise<Award> {
    const award = await this.scoresService.createAward(userId, data);

    // 记录奖项到记忆系统
    fireAndForget(
      this.memoryService.recordAwardToMemory(userId, data),
      this.logger,
      'Failed to record award to memory',
    );

    return award;
  }

  async updateAward(
    userId: string,
    awardId: string,
    data: UpdateAwardDto,
  ): Promise<Award> {
    return this.scoresService.updateAward(userId, awardId, data);
  }

  async deleteAward(userId: string, awardId: string): Promise<void> {
    return this.scoresService.deleteAward(userId, awardId);
  }

  async getAwards(userId: string): Promise<Award[]> {
    return this.scoresService.getAwards(userId);
  }

  async reorderAwards(userId: string, awardIds: string[]): Promise<void> {
    return this.scoresService.reorderAwards(userId, awardIds);
  }

  // ============================================
  // Semester GPAs (delegated to ProfileScoresService)
  // ============================================

  async getSemesterGpas(userId: string) {
    return this.scoresService.getSemesterGpas(userId);
  }

  async createSemesterGpa(userId: string, data: CreateSemesterGpaDto) {
    return this.scoresService.createSemesterGpa(userId, data);
  }

  async updateSemesterGpa(
    userId: string,
    id: string,
    data: UpdateSemesterGpaDto,
  ) {
    return this.scoresService.updateSemesterGpa(userId, id, data);
  }

  async deleteSemesterGpa(userId: string, id: string): Promise<void> {
    return this.scoresService.deleteSemesterGpa(userId, id);
  }

  // ============================================
  // GPA by Grade (delegated to ProfileScoresService)
  // ============================================

  async updateGpaByGrade(
    userId: string,
    data: { gpa9?: number; gpa10?: number; gpa11?: number; gpa12?: number },
  ) {
    return this.scoresService.updateGpaByGrade(userId, data);
  }

  // ============================================
  // Essays CRUD (delegated to ProfileEducationService)
  // ============================================

  async createEssay(userId: string, data: CreateEssayDto): Promise<Essay> {
    const wordCount = data.content.split(/\s+/).filter(Boolean).length;
    const essay = await this.educationService.createEssay(userId, data);

    // 记录文书创建到记忆系统
    fireAndForget(
      this.memoryService.recordEssayToMemory(userId, data, wordCount),
      this.logger,
      'Failed to record essay to memory',
    );

    return essay;
  }

  async updateEssay(
    userId: string,
    essayId: string,
    data: UpdateEssayDto,
  ): Promise<Essay> {
    return this.educationService.updateEssay(userId, essayId, data);
  }

  async deleteEssay(userId: string, essayId: string): Promise<void> {
    return this.educationService.deleteEssay(userId, essayId);
  }

  async getEssays(userId: string): Promise<Essay[]> {
    return this.educationService.getEssays(userId);
  }

  async getEssayById(userId: string, essayId: string): Promise<Essay> {
    return this.educationService.getEssayById(userId, essayId);
  }

  async createEssayRevision(
    userId: string,
    essayId: string,
    data: CreateEssayRevisionDto,
  ): Promise<EssayRevision> {
    return this.educationService.createEssayRevision(userId, essayId, data);
  }

  async getEssayRevisions(
    userId: string,
    essayId: string,
  ): Promise<EssayRevision[]> {
    return this.educationService.getEssayRevisions(userId, essayId);
  }

  async restoreEssayRevision(
    userId: string,
    essayId: string,
    revisionId: string,
  ): Promise<Essay> {
    return this.educationService.restoreEssayRevision(
      userId,
      essayId,
      revisionId,
    );
  }

  async getEssaySuggestions(
    userId: string,
    essayId: string,
    status?: string,
  ): Promise<EssaySuggestion[]> {
    return this.educationService.getEssaySuggestions(userId, essayId, status);
  }

  async updateEssaySuggestion(
    userId: string,
    essayId: string,
    suggestionId: string,
    data: UpdateEssaySuggestionDto,
  ): Promise<EssaySuggestion> {
    return this.educationService.updateEssaySuggestion(
      userId,
      essayId,
      suggestionId,
      data,
    );
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
    return this.educationService.applyEssaySuggestion(
      userId,
      essayId,
      suggestionId,
    );
  }

  // ============================================
  // Education CRUD (delegated to ProfileEducationService)
  // ============================================

  async createEducation(
    userId: string,
    data: CreateEducationDto,
  ): Promise<Education> {
    const education = await this.educationService.createEducation(userId, data);

    // 记录教育经历到记忆系统
    fireAndForget(
      this.memoryService.recordEducationToMemory(userId, data),
      this.logger,
      'Failed to record education to memory',
    );

    return education;
  }

  async updateEducation(
    userId: string,
    educationId: string,
    data: UpdateEducationDto,
  ): Promise<Education> {
    return this.educationService.updateEducation(userId, educationId, data);
  }

  async deleteEducation(userId: string, educationId: string): Promise<void> {
    return this.educationService.deleteEducation(userId, educationId);
  }

  async getEducation(userId: string): Promise<Education[]> {
    return this.educationService.getEducation(userId);
  }

  // ============================================
  // Target Schools CRUD (delegated to ProfileEducationService)
  // ============================================

  async getTargetSchools(userId: string) {
    return this.educationService.getTargetSchools(userId);
  }

  async setTargetSchools(
    userId: string,
    schoolIds: string[],
    priorities?: Record<string, number>,
  ) {
    const result = await this.educationService.setTargetSchools(
      userId,
      schoolIds,
      priorities,
    );

    // 记录设置目标校列表到记忆系统
    fireAndForget(
      this.memoryService.recordSetTargetSchoolsToMemory(userId, result),
      this.logger,
      'Failed to record set target schools to memory',
    );

    return result;
  }

  async addTargetSchool(userId: string, schoolId: string, priority?: number) {
    const result = await this.educationService.addTargetSchool(
      userId,
      schoolId,
      priority,
    );

    // 记录添加目标校到记忆系统
    fireAndForget(
      this.memoryService.recordTargetSchoolAddToMemory(
        userId,
        schoolId,
        result.school?.name ?? result.school?.nameZh ?? undefined,
      ),
      this.logger,
      'Failed to record target school add to memory',
    );

    return result;
  }

  async removeTargetSchool(userId: string, schoolId: string) {
    await this.educationService.removeTargetSchool(userId, schoolId);

    // 记录移除目标校到记忆系统
    fireAndForget(
      this.memoryService.recordTargetSchoolRemovalToMemory(userId, schoolId),
      this.logger,
      'Failed to record target school removal to memory',
    );
  }

  // ============================================
  // Profile Analysis (delegated to ProfileAnalysisService)
  // ============================================

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
    return this.analysisService.calculateProfileGrade(userId);
  }

  async calculateCompleteness(userId: string): Promise<{
    score: number;
    sections: Record<
      string,
      { score: number; maxScore: number; missing: string[] }
    >;
    canRunPrediction: boolean;
    predictionBlockers: PredictionBlocker[];
  }> {
    return this.analysisService.calculateCompleteness(userId);
  }

  // ============================================
  // Activity Templates
  // ============================================

  async searchActivityTemplates(query: string, limit = 10) {
    if (!query || query.length < 1) {
      // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
      return this.prisma.activityTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }],
        take: limit,
      });
    }

    // governance: system-scope — model has no userId/profileId column — platform config/experiment data, not user records
    return this.prisma.activityTemplate.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { nameZh: { contains: query, mode: 'insensitive' } },
          { aliases: { has: query } },
        ],
      },
      orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }],
      take: limit,
    });
  }

  // ============================================
  // Recommendation Letters (delegated to ProfileCrudService)
  // ============================================

  async getRecommendationLetters(userId: string) {
    return this.crudService.getRecommendationLetters(userId);
  }

  async createRecommendationLetter(
    userId: string,
    data: CreateRecommendationLetterDto,
  ) {
    return this.crudService.createRecommendationLetter(userId, data);
  }

  async updateRecommendationLetter(
    userId: string,
    id: string,
    data: UpdateRecommendationLetterDto,
  ) {
    return this.crudService.updateRecommendationLetter(userId, id, data);
  }

  async deleteRecommendationLetter(userId: string, id: string) {
    return this.crudService.deleteRecommendationLetter(userId, id);
  }
}
