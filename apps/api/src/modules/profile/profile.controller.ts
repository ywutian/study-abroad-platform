import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { AiService } from '../ai/ai.service';
import { SchoolListService } from '../school-list/school-list.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';
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
  OnboardingDto,
  ProfileGradeResponseDto,
} from './dto';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly aiService: AiService,
    private readonly schoolListService: SchoolListService,
  ) {}

  // ============================================
  // Profile
  // ============================================

  @Get('me')
  @ApiOperation({ summary: '获取当前用户档案' })
  async getMyProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.findByUserId(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: '更新当前用户档案' })
  async updateMyProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: UpdateProfileDto,
  ) {
    return this.profileService.upsert(user.id, data);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取指定档案（需权限检查）' })
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
  @ApiOperation({ summary: '获取AI档案分析（红黄绿评分）' })
  async getAIAnalysis(@CurrentUser() user: CurrentUserPayload) {
    const profile = await this.profileService.findByUserId(user.id);

    if (!profile) {
      return this.aiService.analyzeProfileDetailed({});
    }

    // 构建分析请求
    const request = {
      gpa: profile.gpa ? Number(profile.gpa) : undefined,
      gpaScale: profile.gpaScale ? Number(profile.gpaScale) : 4.0,
      testScores:
        (profile as any).testScores?.map((s: any) => ({
          type: s.type,
          score: s.score,
        })) || [],
      activities:
        (profile as any).activities?.map((a: any) => ({
          name: a.name,
          category: a.category,
          role: a.role,
        })) || [],
      awards:
        (profile as any).awards?.map((a: any) => ({
          name: a.name,
          level: a.level,
        })) || [],
      targetMajor: profile.targetMajor || undefined,
    };

    return this.aiService.analyzeProfileDetailed(request);
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

    const profile = await this.profileService.upsert(user.id, profileData);

    // Add test scores if provided
    if (data.testScores && data.testScores.length > 0) {
      for (const score of data.testScores) {
        await this.profileService.createTestScore(profile.id, {
          type: score.type,
          score: score.score,
        });
      }
    }

    return { success: true, message: 'Onboarding completed' };
  }

  // ============================================
  // Profile Grade (AI Analysis for Uncommon App)
  // ============================================

  @Get('me/grade')
  @ApiOperation({ summary: 'Get AI profile grade for Uncommon App' })
  async getProfileGrade(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<ProfileGradeResponseDto> {
    return this.profileService.calculateProfileGrade(user.id);
  }

  // ============================================
  // Test Scores
  // ============================================

  @Get('me/test-scores')
  @ApiOperation({ summary: '获取我的标化成绩' })
  async getMyTestScores(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getTestScores(user.id);
  }

  @Post('me/test-scores')
  @ApiOperation({ summary: '添加标化成绩' })
  async createTestScore(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateTestScoreDto,
  ) {
    return this.profileService.createTestScore(user.id, data);
  }

  @Put('me/test-scores/:id')
  @ApiOperation({ summary: '更新标化成绩' })
  async updateTestScore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateTestScoreDto,
  ) {
    return this.profileService.updateTestScore(user.id, id, data);
  }

  @Delete('me/test-scores/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除标化成绩' })
  async deleteTestScore(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteTestScore(user.id, id);
  }

  // ============================================
  // Activities
  // ============================================

  @Get('me/activities')
  @ApiOperation({ summary: '获取我的活动' })
  async getMyActivities(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getActivities(user.id);
  }

  @Post('me/activities')
  @ApiOperation({ summary: '添加活动' })
  async createActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateActivityDto,
  ) {
    return this.profileService.createActivity(user.id, data);
  }

  @Put('me/activities/:id')
  @ApiOperation({ summary: '更新活动' })
  async updateActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateActivityDto,
  ) {
    return this.profileService.updateActivity(user.id, id, data);
  }

  @Delete('me/activities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除活动' })
  async deleteActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteActivity(user.id, id);
  }

  @Put('me/activities/reorder')
  @ApiOperation({ summary: '重排活动顺序' })
  async reorderActivities(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: { ids: string[] },
  ) {
    await this.profileService.reorderActivities(user.id, data.ids);
    return { success: true };
  }

  // ============================================
  // Awards
  // ============================================

  @Get('me/awards')
  @ApiOperation({ summary: '获取我的奖项' })
  async getMyAwards(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getAwards(user.id);
  }

  @Post('me/awards')
  @ApiOperation({ summary: '添加奖项' })
  async createAward(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateAwardDto,
  ) {
    return this.profileService.createAward(user.id, data);
  }

  @Put('me/awards/:id')
  @ApiOperation({ summary: '更新奖项' })
  async updateAward(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateAwardDto,
  ) {
    return this.profileService.updateAward(user.id, id, data);
  }

  @Delete('me/awards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除奖项' })
  async deleteAward(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteAward(user.id, id);
  }

  @Put('me/awards/reorder')
  @ApiOperation({ summary: '重排奖项顺序' })
  async reorderAwards(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: { ids: string[] },
  ) {
    await this.profileService.reorderAwards(user.id, data.ids);
    return { success: true };
  }

  // ============================================
  // Essays
  // ============================================

  @Get('me/essays')
  @ApiOperation({ summary: '获取我的文书' })
  async getMyEssays(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getEssays(user.id);
  }

  @Get('me/essays/:id')
  @ApiOperation({ summary: '获取单个文书' })
  async getEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.profileService.getEssayById(user.id, id);
  }

  @Post('me/essays')
  @ApiOperation({ summary: '创建文书' })
  async createEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateEssayDto,
  ) {
    return this.profileService.createEssay(user.id, data);
  }

  @Put('me/essays/:id')
  @ApiOperation({ summary: '更新文书' })
  async updateEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateEssayDto,
  ) {
    return this.profileService.updateEssay(user.id, id, data);
  }

  @Delete('me/essays/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除文书' })
  async deleteEssay(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteEssay(user.id, id);
  }

  // ============================================
  // Education
  // ============================================

  @Get('me/education')
  @ApiOperation({ summary: '获取我的教育经历' })
  async getMyEducation(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getEducation(user.id);
  }

  @Post('me/education')
  @ApiOperation({ summary: '添加教育经历' })
  async createEducation(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateEducationDto,
  ) {
    return this.profileService.createEducation(user.id, data);
  }

  @Put('me/education/:id')
  @ApiOperation({ summary: '更新教育经历' })
  async updateEducation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateEducationDto,
  ) {
    return this.profileService.updateEducation(user.id, id, data);
  }

  @Delete('me/education/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除教育经历' })
  async deleteEducation(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteEducation(user.id, id);
  }

  // ============================================
  // Target Schools (proxied to SchoolListService)
  // ============================================

  @Get('me/target-schools')
  @ApiOperation({
    summary: '获取我的目标学校（代理到 SchoolListItem）',
    description:
      'This endpoint proxies to SchoolListService. Use /school-lists for direct access.',
  })
  async getMyTargetSchools(@CurrentUser() user: CurrentUserPayload) {
    return this.schoolListService.getUserSchoolList(user.id);
  }

  @Put('me/target-schools')
  @ApiOperation({ summary: '批量设置目标学校列表' })
  async setTargetSchools(
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    data: {
      schoolIds: string[];
      priorities?: Record<string, number>;
    },
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
  @ApiOperation({ summary: '添加目标学校' })
  async addTargetSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Param('schoolId') schoolId: string,
    @Body() data?: { priority?: number },
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '移除目标学校' })
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
  }
}
