import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { SchoolListService } from '../school-list/school-list.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { ThrottleAI } from '../../common/decorators/throttle.decorator';
import { Role } from '@prisma/client';
import {
  UpdateProfileDto,
  CreateTestScoreDto,
  UpdateTestScoreDto,
  CreateActivityDto,
  UpdateActivityDto,
  ReorderIdsDto,
  CreateAwardDto,
  UpdateAwardDto,
  CreateEssayDto,
  UpdateEssayDto,
  CreateEducationDto,
  UpdateEducationDto,
  OnboardingDto,
  ProfileGradeResponseDto,
  SetTargetSchoolsDto,
  AddTargetSchoolDto,
  CreateRecommendationLetterDto,
  UpdateRecommendationLetterDto,
  CreateSemesterGpaDto,
  UpdateSemesterGpaDto,
  UpdateGpaByGradeDto,
  SubmitApplicationAnalysisFeedbackDto,
} from './dto';
import { ProfileApplicationAnalysisService } from './profile-application-analysis.service';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly profileApplicationAnalysisService: ProfileApplicationAnalysisService,
    private readonly schoolListService: SchoolListService,
  ) {}

  // ============================================
  // Profile
  // ============================================

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMyProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.findByUserId(user.id);
  }

  @Get('me/completeness')
  @ApiOperation({ summary: 'Get current user profile completeness' })
  async getMyProfileCompleteness(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.calculateCompleteness(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMyProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: UpdateProfileDto,
  ) {
    return this.profileService.upsert(user.id, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific profile (with permission check)' })
  async getProfile(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.profileService.findByIdWithVisibilityCheck(
      id,
      user.id,
      user.role as Role,
    );
  }

  // ============================================
  // AI Analysis (P0: 红黄绿评分系统)
  // ============================================

  @Get('me/ai-analysis')
  @ThrottleAI()
  @ApiOperation({
    summary: 'Get structured application analysis with school-level strategy',
  })
  async getAIAnalysis(@CurrentUser() user: CurrentUserPayload) {
    return this.profileApplicationAnalysisService.getAnalysisForUser(
      user.id,
      user.locale,
    );
  }

  @Post('me/ai-analysis/feedback')
  @ApiOperation({
    summary:
      'Submit applicant feedback for experimental application-analysis guidance',
  })
  async submitAIAnalysisFeedback(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitApplicationAnalysisFeedbackDto,
  ) {
    return this.profileApplicationAnalysisService.submitFeedback(user.id, dto);
  }

  // ============================================
  // Onboarding
  // ============================================

  @Post('onboarding')
  @ApiOperation({ summary: 'Complete onboarding after registration' })
  async completeOnboarding(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: OnboardingDto,
  ) {
    // Update profile with onboarding data
    const profileData: any = {
      realName: data.realName,
      onboardingCompleted: true,
    };

    if (data.birthday) {
      profileData.birthday = new Date(data.birthday);
    }
    if (data.graduationDate) {
      profileData.graduationDate = new Date(data.graduationDate);
    }

    await this.profileService.upsert(user.id, profileData);

    // Add test scores if provided
    if (data.testScores && data.testScores.length > 0) {
      for (const score of data.testScores) {
        await this.profileService.createTestScore(user.id, {
          type: score.type,
          score: score.score,
        });
      }
    }

    return { success: true, message: 'Onboarding completed' };
  }

  // ============================================
  // Profile Grade (Legacy compatibility only)
  // ============================================

  @Get('me/grade')
  @ApiOperation({
    summary:
      'Get legacy profile grade (compatibility path; use /profiles/me/ai-analysis for school-aware analysis)',
  })
  async getProfileGrade(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ProfileGradeResponseDto> {
    return this.profileService.calculateProfileGrade(user.id);
  }

  // ============================================
  // Test Scores
  // ============================================

  @Get('me/test-scores')
  @ApiOperation({ summary: 'Get my test scores' })
  async getMyTestScores(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getTestScores(user.id);
  }

  @Post('me/test-scores')
  @ApiOperation({ summary: 'Add test score' })
  async createTestScore(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateTestScoreDto,
  ) {
    return this.profileService.createTestScore(user.id, data);
  }

  @Put('me/test-scores/:id')
  @ApiOperation({ summary: 'Update test score' })
  async updateTestScore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateTestScoreDto,
  ) {
    return this.profileService.updateTestScore(user.id, id, data);
  }

  @Delete('me/test-scores/:id')
  @ApiOperation({ summary: 'Delete test score' })
  async deleteTestScore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteTestScore(user.id, id);
    return { message: 'Test score deleted' };
  }

  // ============================================
  // Activities
  // ============================================

  @Get('me/activities')
  @ApiOperation({ summary: 'Get my activities' })
  async getMyActivities(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getActivities(user.id);
  }

  @Post('me/activities')
  @ApiOperation({ summary: 'Add activity' })
  async createActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateActivityDto,
  ) {
    return this.profileService.createActivity(user.id, data);
  }

  @Post('me/activities/ai-sort')
  @ThrottleAI()
  @ApiOperation({ summary: 'AI smart sort activities' })
  async aiSortActivities(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.aiSortActivities(user.id, user.locale);
  }

  @Post('me/activities/:id/refine')
  @ThrottleAI()
  @ApiOperation({ summary: 'AI refine activity description to ≤150 chars' })
  async refineActivityDescription(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') activityId: string,
  ) {
    return this.profileService.refineActivityDescription(
      user.id,
      activityId,
      user.locale,
    );
  }

  @Post('me/activities/:id/generate-common-app-description')
  @ThrottleAI()
  @ApiOperation({
    summary: 'AI generate Common App activity description (≤150 chars)',
  })
  async generateCommonAppDescription(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') activityId: string,
  ) {
    return this.profileService.generateCommonAppDescription(
      user.id,
      activityId,
      user.locale,
    );
  }

  @Put('me/activities/reorder')
  @ApiOperation({ summary: 'Reorder activities' })
  async reorderActivities(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: ReorderIdsDto,
  ) {
    await this.profileService.reorderActivities(user.id, data.ids);
    return { success: true };
  }

  @Put('me/activities/:id')
  @ApiOperation({ summary: 'Update activity' })
  async updateActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateActivityDto,
  ) {
    return this.profileService.updateActivity(user.id, id, data);
  }

  @Delete('me/activities/:id')
  @ApiOperation({ summary: 'Delete activity' })
  async deleteActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteActivity(user.id, id);
    return { message: 'Activity deleted' };
  }

  // ============================================
  // Awards
  // ============================================

  @Get('me/awards')
  @ApiOperation({ summary: 'Get my awards' })
  async getMyAwards(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getAwards(user.id);
  }

  @Post('me/awards')
  @ApiOperation({ summary: 'Add award' })
  async createAward(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateAwardDto,
  ) {
    return this.profileService.createAward(user.id, data);
  }

  @Put('me/awards/reorder')
  @ApiOperation({ summary: 'Reorder awards' })
  async reorderAwards(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: ReorderIdsDto,
  ) {
    await this.profileService.reorderAwards(user.id, data.ids);
    return { success: true };
  }

  @Put('me/awards/:id')
  @ApiOperation({ summary: 'Update award' })
  async updateAward(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateAwardDto,
  ) {
    return this.profileService.updateAward(user.id, id, data);
  }

  @Delete('me/awards/:id')
  @ApiOperation({ summary: 'Delete award' })
  async deleteAward(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteAward(user.id, id);
    return { message: 'Award deleted' };
  }

  // ============================================
  // Essays
  // ============================================

  @Get('me/essays')
  @ApiOperation({ summary: 'Get my essays' })
  async getMyEssays(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getEssays(user.id);
  }

  @Get('me/essays/:id')
  @ApiOperation({ summary: 'Get single essay' })
  async getEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.getEssayById(user.id, id);
  }

  @Post('me/essays')
  @ApiOperation({ summary: 'Create essay' })
  async createEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateEssayDto,
  ) {
    return this.profileService.createEssay(user.id, data);
  }

  @Put('me/essays/:id')
  @ApiOperation({ summary: 'Update essay' })
  async updateEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateEssayDto,
  ) {
    return this.profileService.updateEssay(user.id, id, data);
  }

  @Delete('me/essays/:id')
  @ApiOperation({ summary: 'Delete essay' })
  async deleteEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteEssay(user.id, id);
    return { message: 'Essay deleted' };
  }

  // ============================================
  // Education
  // ============================================

  @Get('me/education')
  @ApiOperation({ summary: 'Get my education history' })
  async getMyEducation(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getEducation(user.id);
  }

  @Post('me/education')
  @ApiOperation({ summary: 'Add education entry' })
  async createEducation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateEducationDto,
  ) {
    return this.profileService.createEducation(user.id, data);
  }

  @Put('me/education/:id')
  @ApiOperation({ summary: 'Update education entry' })
  async updateEducation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateEducationDto,
  ) {
    return this.profileService.updateEducation(user.id, id, data);
  }

  @Delete('me/education/:id')
  @ApiOperation({ summary: 'Delete education entry' })
  async deleteEducation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteEducation(user.id, id);
    return { message: 'Education deleted' };
  }

  // ============================================
  // Target Schools (proxied to SchoolListService)
  // ============================================

  @Get('me/target-schools')
  @ApiOperation({
    summary: 'Get my target schools (proxied to SchoolListItem)',
    description:
      'This endpoint proxies to SchoolListService. Use /school-lists for direct access.',
  })
  async getMyTargetSchools(@CurrentUser() user: CurrentUserPayload) {
    return this.schoolListService.getUserSchoolList(user.id);
  }

  @Put('me/target-schools')
  @ApiOperation({ summary: 'Batch set target school list' })
  async setTargetSchools(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: SetTargetSchoolsDto,
  ) {
    // 兼容旧接口：先清空现有列表，再逐个添加
    const existing = await this.schoolListService.getUserSchoolList(user.id);
    for (const item of existing) {
      await this.schoolListService.removeItem(user.id, item.id);
    }

    const results = [];
    for (const schoolId of data.schoolIds) {
      const priority = data.priorities?.[schoolId] ?? 2;
      const tier =
        priority === 1 ? 'REACH' : priority === 3 ? 'SAFETY' : 'TARGET';
      try {
        const item = await this.schoolListService.addSchool(user.id, {
          schoolId,
          tier: tier as any,
        });
        results.push(item);
      } catch {
        // 跳过已存在或不存在的学校
      }
    }
    return results;
  }

  @Post('me/target-schools/:schoolId')
  @ApiOperation({ summary: 'Add target school' })
  async addTargetSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Param('schoolId') schoolId: string,
    @Body() data: AddTargetSchoolDto,
  ) {
    const priority = data?.priority ?? 2;
    const tier =
      priority === 1 ? 'REACH' : priority === 3 ? 'SAFETY' : 'TARGET';
    return this.schoolListService.addSchool(user.id, {
      schoolId,
      tier: tier as any,
    });
  }

  @Delete('me/target-schools/:schoolId')
  @ApiOperation({ summary: 'Remove target school' })
  async removeTargetSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Param('schoolId') schoolId: string,
  ) {
    // 根据 schoolId 查找对应的 SchoolListItem
    const items = await this.schoolListService.getUserSchoolList(user.id);
    const item = items.find((i) => i.schoolId === schoolId);
    if (item) {
      await this.schoolListService.removeItem(user.id, item.id);
    }
    return { message: 'Target school removed' };
  }

  // ============================================
  // Activity Templates (search for autocomplete)
  // ============================================

  @Get('activity-templates/search')
  @ApiOperation({ summary: 'Search activity templates for autocomplete' })
  async searchActivityTemplates(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.profileService.searchActivityTemplates(
      query,
      limit ? parseInt(limit) : 10,
    );
  }

  // ============================================
  // Semester GPAs
  // ============================================

  @Get('me/semester-gpas')
  @ApiOperation({ summary: 'Get my semester GPAs' })
  async getMySemesterGpas(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getSemesterGpas(user.id);
  }

  @Post('me/semester-gpas')
  @ApiOperation({ summary: 'Add semester GPA' })
  async createSemesterGpa(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateSemesterGpaDto,
  ) {
    return this.profileService.createSemesterGpa(user.id, data);
  }

  @Put('me/semester-gpas/:id')
  @ApiOperation({ summary: 'Update semester GPA' })
  async updateSemesterGpa(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateSemesterGpaDto,
  ) {
    return this.profileService.updateSemesterGpa(user.id, id, data);
  }

  @Delete('me/semester-gpas/:id')
  @ApiOperation({ summary: 'Delete semester GPA' })
  async deleteSemesterGpa(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteSemesterGpa(user.id, id);
    return { message: 'Semester GPA deleted' };
  }

  // ============================================
  // GPA by Grade
  // ============================================

  @Patch('me/gpa-by-grade')
  @ApiOperation({ summary: 'Update GPA by grade level (9-12)' })
  async updateGpaByGrade(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: UpdateGpaByGradeDto,
  ) {
    return this.profileService.updateGpaByGrade(user.id, data);
  }

  // ============================================
  // Recommendation Letters CRUD
  // ============================================

  @Get('me/recommendation-letters')
  @ApiOperation({ summary: 'Get recommendation letters' })
  async getRecommendationLetters(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getRecommendationLetters(user.id);
  }

  @Post('me/recommendation-letters')
  @ApiOperation({ summary: 'Create recommendation letter' })
  async createRecommendationLetter(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateRecommendationLetterDto,
  ) {
    return this.profileService.createRecommendationLetter(user.id, data);
  }

  @Put('me/recommendation-letters/:id')
  @ApiOperation({ summary: 'Update recommendation letter' })
  async updateRecommendationLetter(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateRecommendationLetterDto,
  ) {
    return this.profileService.updateRecommendationLetter(user.id, id, data);
  }

  @Delete('me/recommendation-letters/:id')
  @ApiOperation({ summary: 'Delete recommendation letter' })
  async deleteRecommendationLetter(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.deleteRecommendationLetter(user.id, id);
  }
}
