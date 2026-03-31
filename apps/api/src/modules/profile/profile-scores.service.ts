import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheInvalidationService } from '../../common/redis/cache-invalidation.service';
import { LLMService, ChatSimpleMessage } from '../ai-agent/core/llm.service';
import { extractJsonFromLlm } from '../../common/utils/llm-json.util';
import { TestScore, Activity, Award } from '@prisma/client';
import {
  CreateTestScoreDto,
  UpdateTestScoreDto,
  CreateActivityDto,
  UpdateActivityDto,
  CreateAwardDto,
  UpdateAwardDto,
  CreateSemesterGpaDto,
  UpdateSemesterGpaDto,
} from './dto';
import { ProfileHelpersService } from './profile-helpers.service';
import { CaseIncentiveService, PointAction } from '../points/incentive.service';
import { safeRefund } from '../points/refund.helper';
import {
  buildActivityRefineSystemPrompt,
  buildActivityRefineUserPrompt,
  buildGenerateCommonAppSystemPrompt,
  buildGenerateCommonAppUserPrompt,
} from '../ai/profile-ai.prompts';

/**
 * Handles test scores, activities, and awards CRUD operations.
 * Includes AI-powered activity sorting.
 */
@Injectable()
export class ProfileScoresService {
  private readonly logger = new Logger(ProfileScoresService.name);

  constructor(
    private prisma: PrismaService,
    private cacheInvalidation: CacheInvalidationService,
    private llmService: LLMService,
    private helpers: ProfileHelpersService,
    private caseIncentiveService: CaseIncentiveService,
  ) {}

  // ============================================
  // Test Scores CRUD
  // ============================================

  /**
   * Create a new test score record for the user's profile.
   *
   * Auto-creates the profile if it does not exist.
   *
   * @param userId - The user identifier
   * @param data - Test score data (type, score, subScores, testDate)
   * @returns The created TestScore record
   */
  async createTestScore(
    userId: string,
    data: CreateTestScoreDto,
  ): Promise<TestScore> {
    const profileId = await this.helpers.getProfileId(userId);

    const testScore = await this.prisma.testScore.create({
      data: {
        profileId,
        type: data.type as any,
        score: data.score,
        subScores: data.subScores as any,
        testDate: data.testDate ? new Date(data.testDate) : null,
      },
    });

    await this.cacheInvalidation.onProfileChange(userId);

    return testScore;
  }

  /**
   * Update an existing test score after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param scoreId - The test score ID to update
   * @param data - Partial test score update DTO
   * @returns The updated TestScore record
   * @throws {NotFoundException} When the test score does not exist
   * @throws {ForbiddenException} When the test score does not belong to the user
   */
  async updateTestScore(
    userId: string,
    scoreId: string,
    data: UpdateTestScoreDto,
  ): Promise<TestScore> {
    const _score = this.helpers.verifyProfileOwnership(
      await this.prisma.testScore.findUnique({
        where: { id: scoreId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Test score',
    );

    const result = await this.prisma.testScore.update({
      where: { id: scoreId },
      data: {
        type: data.type as any,
        score: data.score,
        subScores: data.subScores as any,
        testDate: data.testDate ? new Date(data.testDate) : undefined,
      },
    });
    await this.cacheInvalidation.onProfileChange(userId);
    return result;
  }

  /**
   * Delete a test score by ID after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param scoreId - The test score ID to delete
   * @throws {NotFoundException} When the test score does not exist
   * @throws {ForbiddenException} When the test score does not belong to the user
   */
  async deleteTestScore(userId: string, scoreId: string): Promise<void> {
    this.helpers.verifyProfileOwnership(
      await this.prisma.testScore.findUnique({
        where: { id: scoreId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Test score',
    );

    await this.prisma.testScore.delete({ where: { id: scoreId } });
    await this.cacheInvalidation.onProfileChange(userId);
  }

  /**
   * Get all test scores for a user, ordered by createdAt descending.
   *
   * @param userId - The user identifier
   * @returns Array of TestScore records, or empty array if no profile exists
   */
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

  /**
   * Create a new activity for the user's profile. Auto-creates the profile if needed.
   *
   * @param userId - The user identifier
   * @param data - Activity creation DTO
   * @returns The created Activity record
   */
  async createActivity(
    userId: string,
    data: CreateActivityDto,
  ): Promise<Activity> {
    const profileId = await this.helpers.getProfileId(userId);

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
        gradeLevels: data.gradeLevels ?? [],
        timing: data.timing as any,
        activityTemplateId: data.activityTemplateId || null,
        commonAppDescription: data.commonAppDescription,
      },
      include: { activityTemplate: true },
    });

    await this.cacheInvalidation.onProfileChange(userId);

    return activity;
  }

  /**
   * Update an existing activity after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param activityId - The activity ID to update
   * @param data - Partial activity update DTO
   * @returns The updated Activity record
   * @throws {NotFoundException} When the activity does not exist
   * @throws {ForbiddenException} When the activity does not belong to the user
   */
  async updateActivity(
    userId: string,
    activityId: string,
    data: UpdateActivityDto,
  ): Promise<Activity> {
    const _activity = this.helpers.verifyProfileOwnership(
      await this.prisma.activity.findUnique({
        where: { id: activityId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Activity',
    );

    const result = await this.prisma.activity.update({
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
        gradeLevels: data.gradeLevels,
        timing: data.timing as any,
        activityTemplateId: data.activityTemplateId,
        commonAppDescription: data.commonAppDescription,
      },
      include: { activityTemplate: true },
    });
    await this.cacheInvalidation.onProfileChange(userId);
    return result;
  }

  /**
   * Delete an activity by ID after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param activityId - The activity ID to delete
   * @throws {NotFoundException} When the activity does not exist
   * @throws {ForbiddenException} When the activity does not belong to the user
   */
  async deleteActivity(userId: string, activityId: string): Promise<void> {
    this.helpers.verifyProfileOwnership(
      await this.prisma.activity.findUnique({
        where: { id: activityId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Activity',
    );

    await this.prisma.activity.delete({ where: { id: activityId } });
    await this.cacheInvalidation.onProfileChange(userId);
  }

  /**
   * Get all activities for a user, ordered by order ascending.
   *
   * @param userId - The user identifier
   * @returns Array of Activity records, or empty array if no profile exists
   */
  async getActivities(userId: string): Promise<Activity[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: {
        activities: {
          orderBy: { order: 'asc' },
          include: { activityTemplate: true },
        },
      },
    });

    return profile?.activities || [];
  }

  /**
   * Reorder activities by setting each activity's `order` field to its array index.
   *
   * Runs all updates in a Prisma transaction. Validates that every provided ID
   * belongs to the current user's profile before applying.
   *
   * @param userId - The user identifier
   * @param activityIds - Ordered array of activity IDs defining the new order
   * @throws {ForbiddenException} When any activity ID does not belong to the user
   */
  async reorderActivities(
    userId: string,
    activityIds: string[],
  ): Promise<void> {
    const profileId = await this.helpers.getProfileId(userId);

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
    await this.cacheInvalidation.onProfileChange(userId);
  }

  /**
   * Use AI to suggest an optimal activity ordering based on college admissions strategy.
   */
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
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: {
        targetMajor: true,
        grade: true,
        activities: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            category: true,
            role: true,
            description: true,
            hoursPerWeek: true,
            weeksPerYear: true,
            isOngoing: true,
          },
        },
      },
    });

    const activities = profile?.activities ?? [];
    if (activities.length === 0) {
      throw new BadRequestException('No activities to sort');
    }

    if (activities.length === 1) {
      return {
        suggestedOrder: [
          {
            activityId: activities[0].id,
            rank: 1,
            reasoning:
              locale === 'zh'
                ? '只有一项活动，无需排序'
                : 'Only one activity, no sorting needed',
          },
        ],
        summary:
          locale === 'zh'
            ? '只有一项活动，无需排序。'
            : 'Only one activity, no sorting needed.',
      };
    }

    const isZh = locale === 'zh';
    const activitiesJson = activities.map((a, i) => ({
      index: i + 1,
      id: a.id,
      name: a.name,
      category: a.category,
      role: a.role || undefined,
      description: a.description || undefined,
      hoursPerWeek: a.hoursPerWeek ?? undefined,
      weeksPerYear: a.weeksPerYear ?? undefined,
      isOngoing: a.isOngoing,
    }));

    const systemPrompt = isZh
      ? `你是一位经验丰富的美国大学申请顾问。请根据以下标准为学生的课外活动排序：
1. 与目标专业的关联度
2. 领导力和角色重要性
3. 时间投入和持续性
4. 独特性和差异化
5. 影响力和成就

请返回JSON格式：{"suggestedOrder": [{"activityId": "...", "rank": 1, "reasoning": "简短理由"}], "summary": "整体排序策略总结"}`
      : `You are an experienced US college admissions counselor. Rank the student's extracurricular activities by:
1. Relevance to intended major
2. Leadership and role significance
3. Time commitment and consistency
4. Uniqueness and differentiation
5. Impact and achievement

Return JSON: {"suggestedOrder": [{"activityId": "...", "rank": 1, "reasoning": "brief reason"}], "summary": "overall sorting strategy summary"}`;

    const userPrompt = isZh
      ? `目标专业：${profile?.targetMajor || '未指定'}
年级：${profile?.grade || '未指定'}

活动列表：
${JSON.stringify(activitiesJson, null, 2)}`
      : `Intended major: ${profile?.targetMajor || 'Not specified'}
Grade: ${profile?.grade || 'Not specified'}

Activities:
${JSON.stringify(activitiesJson, null, 2)}`;

    const messages: ChatSimpleMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    try {
      const result = await this.llmService.chatSimpleGuarded(messages, {
        temperature: 0.3,
      });
      const parsed = extractJsonFromLlm<{
        suggestedOrder?: Array<{
          activityId: string;
          rank: number;
          reasoning: string;
        }>;
        summary?: string;
      }>(result);

      if (!parsed?.suggestedOrder || !Array.isArray(parsed.suggestedOrder)) {
        return this.buildFallbackSort(activities, isZh);
      }

      // Filter out invalid activityIds (prevent AI hallucination)
      const validIds = new Set(activities.map((a) => a.id));
      const validOrder = parsed.suggestedOrder.filter((item) =>
        validIds.has(item.activityId),
      );

      if (validOrder.length === 0) {
        return this.buildFallbackSort(activities, isZh);
      }

      return {
        suggestedOrder: validOrder,
        summary:
          parsed.summary ||
          (isZh ? 'AI排序建议已生成' : 'AI sorting suggestion generated'),
      };
    } catch (error) {
      this.logger.warn('AI activity sort failed, returning fallback', error);
      return this.buildFallbackSort(activities, isZh);
    }
  }

  private buildFallbackSort(
    activities: Array<{ id: string; name: string }>,
    isZh: boolean,
  ) {
    return {
      suggestedOrder: activities.map((a, i) => ({
        activityId: a.id,
        rank: i + 1,
        reasoning: isZh ? '保持当前顺序' : 'Keeping current order',
      })),
      summary: isZh
        ? 'AI分析暂不可用，保持当前排序。'
        : 'AI analysis temporarily unavailable, keeping current order.',
    };
  }

  /**
   * Use AI to refine an activity description to fit Common App's 150-char limit.
   */
  async refineActivityDescription(
    userId: string,
    activityId: string,
    locale: string,
  ): Promise<{
    refined: string;
    tips: string;
    originalLength: number;
    refinedLength: number;
  }> {
    // Charge points before performing AI call
    await this.caseIncentiveService.charge(
      userId,
      PointAction.AI_ACTIVITY_REFINE,
    );

    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, profile: { userId } },
      select: { name: true, role: true, description: true },
    });

    if (!activity) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ACTIVITY_REFINE,
        this.logger,
      );
      throw new BadRequestException('Activity not found');
    }

    if (!activity.description || activity.description.length <= 150) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ACTIVITY_REFINE,
        this.logger,
      );
      throw new BadRequestException(
        locale === 'zh'
          ? '描述已在150字符以内，无需精简'
          : 'Description is already within 150 characters',
      );
    }

    const messages: ChatSimpleMessage[] = [
      { role: 'system', content: buildActivityRefineSystemPrompt(locale) },
      {
        role: 'user',
        content: buildActivityRefineUserPrompt(
          activity.name,
          activity.role,
          activity.description,
          locale,
        ),
      },
    ];

    const response = await this.llmService.chatSimpleGuarded(messages, {
      temperature: 0.7,
      maxTokens: 300,
    });

    const parsed = extractJsonFromLlm<{ refined: string; tips: string }>(
      response,
    );

    if (!parsed?.refined) {
      throw new BadRequestException('AI refinement failed');
    }

    return {
      refined: parsed.refined.slice(0, 150),
      tips: parsed.tips || '',
      originalLength: activity.description.length,
      refinedLength: parsed.refined.length,
    };
  }

  /**
   * Use AI to generate a Common App activity description (≤150 chars) from detailed description.
   */
  async generateCommonAppDescription(
    userId: string,
    activityId: string,
    locale: string,
  ): Promise<{ commonAppDescription: string }> {
    await this.caseIncentiveService.charge(
      userId,
      PointAction.AI_ACTIVITY_REFINE,
    );

    const activity = await this.prisma.activity.findFirst({
      where: { id: activityId, profile: { userId } },
      select: { id: true, name: true, role: true, description: true },
    });

    if (!activity) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ACTIVITY_REFINE,
        this.logger,
      );
      throw new BadRequestException('Activity not found');
    }

    if (!activity.description || activity.description.length <= 150) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ACTIVITY_REFINE,
        this.logger,
      );
      throw new BadRequestException(
        locale === 'zh'
          ? '描述已在150字符以内，无需生成'
          : 'Description is already within 150 characters',
      );
    }

    const messages: ChatSimpleMessage[] = [
      {
        role: 'system',
        content: buildGenerateCommonAppSystemPrompt(locale),
      },
      {
        role: 'user',
        content: buildGenerateCommonAppUserPrompt(
          activity.name,
          activity.role || '',
          activity.description,
          locale,
        ),
      },
    ];

    let response: string;
    try {
      response = await this.llmService.chatSimpleGuarded(messages, {
        temperature: 0.7,
        maxTokens: 300,
      });
    } catch (error) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ACTIVITY_REFINE,
        this.logger,
      );
      throw error;
    }

    const parsed = extractJsonFromLlm<{ commonAppDescription: string }>(
      response,
    );

    if (!parsed?.commonAppDescription) {
      await safeRefund(
        this.caseIncentiveService,
        userId,
        PointAction.AI_ACTIVITY_REFINE,
        this.logger,
      );
      throw new BadRequestException('AI generation failed');
    }

    const commonAppDescription = parsed.commonAppDescription.slice(0, 150);

    await this.prisma.activity.update({
      where: { id: activityId },
      data: { commonAppDescription },
    });

    await this.cacheInvalidation.onProfileChange(userId);

    return { commonAppDescription };
  }

  // ============================================
  // Awards CRUD
  // ============================================

  /**
   * Create a new award for the user's profile. Auto-creates the profile if needed.
   *
   * @param userId - The user identifier
   * @param data - Award creation DTO
   * @returns The created Award record
   */
  async createAward(userId: string, data: CreateAwardDto): Promise<Award> {
    const profileId = await this.helpers.getProfileId(userId);

    const award = await this.prisma.award.create({
      data: {
        profileId,
        name: data.name,
        level: data.level as any,
        year: data.year,
        description: data.description,
        category: data.category as any,
        order: data.order ?? 0,
      },
    });

    await this.cacheInvalidation.onProfileChange(userId);

    return award;
  }

  /**
   * Update an existing award after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param awardId - The award ID to update
   * @param data - Partial award update DTO
   * @returns The updated Award record
   * @throws {NotFoundException} When the award does not exist
   * @throws {ForbiddenException} When the award does not belong to the user
   */
  async updateAward(
    userId: string,
    awardId: string,
    data: UpdateAwardDto,
  ): Promise<Award> {
    const _award = this.helpers.verifyProfileOwnership(
      await this.prisma.award.findUnique({
        where: { id: awardId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Award',
    );

    const result = await this.prisma.award.update({
      where: { id: awardId },
      data: {
        name: data.name,
        level: data.level as any,
        year: data.year,
        description: data.description,
        category: data.category as any,
        order: data.order,
      },
    });
    await this.cacheInvalidation.onProfileChange(userId);
    return result;
  }

  /**
   * Delete an award by ID after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param awardId - The award ID to delete
   * @throws {NotFoundException} When the award does not exist
   * @throws {ForbiddenException} When the award does not belong to the user
   */
  async deleteAward(userId: string, awardId: string): Promise<void> {
    this.helpers.verifyProfileOwnership(
      await this.prisma.award.findUnique({
        where: { id: awardId },
        include: { profile: { select: { userId: true } } },
      }),
      userId,
      'Award',
    );

    await this.prisma.award.delete({ where: { id: awardId } });
    await this.cacheInvalidation.onProfileChange(userId);
  }

  /**
   * Get all awards for a user, ordered by order ascending.
   *
   * @param userId - The user identifier
   * @returns Array of Award records, or empty array if no profile exists
   */
  async getAwards(userId: string): Promise<Award[]> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { awards: { orderBy: { order: 'asc' } } },
    });

    return profile?.awards || [];
  }

  /**
   * Reorder awards by setting each award's `order` field to its array index.
   *
   * Uses the same ownership validation and transaction pattern as
   * {@link reorderActivities}.
   *
   * @param userId - The user identifier
   * @param awardIds - Ordered array of award IDs defining the new order
   * @throws {ForbiddenException} When any award ID does not belong to the user
   */
  async reorderAwards(userId: string, awardIds: string[]): Promise<void> {
    const profileId = await this.helpers.getProfileId(userId);

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
    await this.cacheInvalidation.onProfileChange(userId);
  }

  // ============================================
  // Semester GPA CRUD
  // ============================================

  /**
   * Get all semester GPAs for a user, ordered by order ascending.
   *
   * @param userId - The user identifier
   * @returns Array of SemesterGpa records
   */
  async getSemesterGpas(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { semesterGpas: { orderBy: { order: 'asc' } } },
    });

    return profile?.semesterGpas || [];
  }

  /**
   * Create a new semester GPA record. Auto-creates profile if needed.
   *
   * @param userId - The user identifier
   * @param data - Semester GPA creation DTO
   * @returns The created SemesterGpa record
   */
  async createSemesterGpa(userId: string, data: CreateSemesterGpaDto) {
    const profileId = await this.helpers.getProfileId(userId);

    const semesterGpa = await this.prisma.semesterGpa.create({
      data: {
        profileId,
        semester: data.semester,
        year: data.year,
        gpa: data.gpa,
        gpaScale: data.gpaScale,
        credits: data.credits,
        order: data.order ?? 0,
      },
    });

    await this.recalculateGpa(profileId);
    await this.cacheInvalidation.onProfileChange(userId);

    return semesterGpa;
  }

  /**
   * Update an existing semester GPA after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param id - The semester GPA ID to update
   * @param data - Partial semester GPA update DTO
   * @returns The updated SemesterGpa record
   * @throws {NotFoundException} When the semester GPA does not exist
   * @throws {ForbiddenException} When the semester GPA does not belong to the user
   */
  async updateSemesterGpa(
    userId: string,
    id: string,
    data: UpdateSemesterGpaDto,
  ) {
    const existing = await this.prisma.semesterGpa.findUnique({
      where: { id },
      include: { profile: { select: { id: true, userId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Semester GPA not found');
    }

    if (existing.profile.userId !== userId) {
      throw new ForbiddenException(
        'Cannot update semester GPA that does not belong to you',
      );
    }

    const result = await this.prisma.semesterGpa.update({
      where: { id },
      data: {
        semester: data.semester,
        year: data.year,
        gpa: data.gpa,
        gpaScale: data.gpaScale,
        credits: data.credits,
        order: data.order,
      },
    });

    await this.recalculateGpa(existing.profile.id);
    await this.cacheInvalidation.onProfileChange(userId);

    return result;
  }

  /**
   * Delete a semester GPA by ID after verifying ownership.
   *
   * @param userId - The requesting user's ID
   * @param id - The semester GPA ID to delete
   * @throws {NotFoundException} When the semester GPA does not exist
   * @throws {ForbiddenException} When the semester GPA does not belong to the user
   */
  async deleteSemesterGpa(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.semesterGpa.findUnique({
      where: { id },
      include: { profile: { select: { id: true, userId: true } } },
    });

    if (!existing) {
      throw new NotFoundException('Semester GPA not found');
    }

    if (existing.profile.userId !== userId) {
      throw new ForbiddenException(
        'Cannot delete semester GPA that does not belong to you',
      );
    }

    await this.prisma.semesterGpa.delete({ where: { id } });

    await this.recalculateGpa(existing.profile.id);
    await this.cacheInvalidation.onProfileChange(userId);
  }

  // ============================================
  // GPA by Grade
  // ============================================

  /**
   * Update per-grade GPA values and recalculate overall GPA.
   *
   * @param userId - The user identifier
   * @param data - Grade-level GPA values (gpa9, gpa10, gpa11, gpa12)
   * @returns The updated Profile record
   */
  async updateGpaByGrade(
    userId: string,
    data: { gpa9?: number; gpa10?: number; gpa11?: number; gpa12?: number },
  ) {
    const profileId = await this.helpers.getProfileId(userId);

    const profile = await this.prisma.profile.update({
      where: { id: profileId },
      data: {
        gpa9: data.gpa9,
        gpa10: data.gpa10,
        gpa11: data.gpa11,
        gpa12: data.gpa12,
      },
    });

    await this.recalculateGpa(profileId);
    await this.cacheInvalidation.onProfileChange(userId);

    return profile;
  }

  /**
   * Recalculate overall GPA as a weighted average.
   * Priority 1: grade-level GPAs (gpa9-12) with weights 0.15/0.25/0.35/0.25.
   * Priority 2: semester GPAs aggregated to grade level, then weighted.
   * If neither exists, does not overwrite manually entered GPA.
   */
  private async recalculateGpa(profileId: string): Promise<void> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        gpa9: true,
        gpa10: true,
        gpa11: true,
        gpa12: true,
        semesterGpas: { orderBy: { order: 'asc' } },
      },
    });

    if (!profile) return;

    const GRADE_WEIGHTS: Record<string, number> = {
      '9': 0.15,
      '10': 0.25,
      '11': 0.35,
      '12': 0.25,
    };

    // Priority 1: grade-level GPAs
    const gradeEntries = [
      { grade: '9', gpa: profile.gpa9 },
      { grade: '10', gpa: profile.gpa10 },
      { grade: '11', gpa: profile.gpa11 },
      { grade: '12', gpa: profile.gpa12 },
    ].filter((e) => e.gpa != null);

    if (gradeEntries.length > 0) {
      const totalWeight = gradeEntries.reduce(
        (s, e) => s + GRADE_WEIGHTS[e.grade],
        0,
      );
      const weightedSum = gradeEntries.reduce(
        (s, e) => s + Number(e.gpa) * GRADE_WEIGHTS[e.grade],
        0,
      );
      await this.prisma.profile.update({
        where: { id: profileId },
        data: { gpa: Math.round((weightedSum / totalWeight) * 100) / 100 },
      });
      return;
    }

    // Priority 2: semester GPAs → aggregate to grade → weighted average
    if (profile.semesterGpas.length > 0) {
      const gradeGpas = this.aggregateSemesterToGrade(profile.semesterGpas);
      if (gradeGpas.size === 0) return;

      let totalWeight = 0;
      let weightedSum = 0;
      for (const [grade, gpa] of gradeGpas) {
        const w = GRADE_WEIGHTS[grade] || 0.25;
        totalWeight += w;
        weightedSum += gpa * w;
      }
      await this.prisma.profile.update({
        where: { id: profileId },
        data: { gpa: Math.round((weightedSum / totalWeight) * 100) / 100 },
      });
    }
    // Neither grade-level nor semester GPAs → don't overwrite manual GPA
  }

  /**
   * Aggregate semester GPAs to grade-level GPAs.
   * Semester name format: g9fall, g9spring, g10fall, etc.
   * Uses credit-weighted average when all semesters have credits, simple average otherwise.
   * All values normalized to 4.0 scale.
   */
  private aggregateSemesterToGrade(
    semesterGpas: Array<{
      semester: string;
      gpa: any;
      gpaScale: any;
      credits: any;
    }>,
  ): Map<string, number> {
    const gradeMap = new Map<
      string,
      Array<{ gpa: number; scale: number; credits: number | null }>
    >();

    for (const sg of semesterGpas) {
      const match = sg.semester.match(/^g(\d+)/i);
      if (!match) continue;
      const grade = match[1];
      if (!gradeMap.has(grade)) gradeMap.set(grade, []);
      gradeMap.get(grade)!.push({
        gpa: Number(sg.gpa),
        scale: Number(sg.gpaScale),
        credits: sg.credits != null ? Number(sg.credits) : null,
      });
    }

    const result = new Map<string, number>();
    for (const [grade, semesters] of gradeMap) {
      const hasAllCredits = semesters.every(
        (s) => s.credits != null && s.credits > 0,
      );
      if (hasAllCredits) {
        // Credit-weighted average (normalized to 4.0 scale)
        const totalCredits = semesters.reduce((s, v) => s + v.credits!, 0);
        const wSum = semesters.reduce(
          (s, v) => s + (v.gpa / v.scale) * 4.0 * v.credits!,
          0,
        );
        result.set(grade, wSum / totalCredits);
      } else {
        // Simple average (normalized to 4.0 scale)
        const sum = semesters.reduce((s, v) => s + (v.gpa / v.scale) * 4.0, 0);
        result.set(grade, sum / semesters.length);
      }
    }
    return result;
  }
}
