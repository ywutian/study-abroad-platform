import {
  Injectable,
  BadRequestException,
  ForbiddenException,
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
} from './dto';
import { ProfileHelpersService } from './profile-helpers.service';

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
      const result = await this.llmService.chatSimple(messages, {
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
}
