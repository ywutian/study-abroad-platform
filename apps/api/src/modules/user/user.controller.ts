import { Controller, Get, Delete, Post, Res, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { UserService } from './user.service';
import { DashboardService } from './dashboard.service';
import {
  CaseIncentiveService,
  PointAction,
} from '../case/case-incentive.service';
import { PointsConfigService } from '../case/points-config.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly dashboardService: DashboardService,
    private readonly caseIncentiveService: CaseIncentiveService,
    private readonly pointsConfigService: PointsConfigService,
  ) {}

  @Get('me/dashboard')
  @ApiOperation({ summary: '获取用户仪表盘数据' })
  async getDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.dashboardService.getDashboardSummary(user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user info' })
  async getCurrentUser(@CurrentUser() user: CurrentUserPayload) {
    const fullUser = await this.userService.findByIdOrThrow(user.id);
    const { passwordHash, ...result } = fullUser;
    return result;
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete current user account (soft delete)' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  async deleteAccount(@CurrentUser() user: CurrentUserPayload) {
    await this.userService.softDelete(user.id);
    return {
      success: true,
      message:
        'Account deleted successfully. Your data will be permanently removed within 30 days.',
    };
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Export user data (GDPR compliance)' })
  @ApiResponse({ status: 200, description: 'Returns all user data as JSON' })
  async exportData(
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.userService.exportUserData(user.id);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="user-data-${user.id}.json"`,
    );

    return data;
  }

  // ============ 积分系统 API ============

  @Get('me/points')
  @ApiOperation({ summary: '获取当前用户积分' })
  async getMyPoints(@CurrentUser() user: CurrentUserPayload) {
    const points = await this.caseIncentiveService.getUserPoints(user.id);
    return { points };
  }

  @Get('me/points/history')
  @ApiOperation({ summary: '获取积分变动历史' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '返回记录数量，默认20',
  })
  async getPointHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
  ) {
    const history = await this.caseIncentiveService.getPointHistory(
      user.id,
      limit ? parseInt(limit, 10) : 20,
    );

    // 为每条记录添加中文描述（从动态配置读取）
    const rules = await this.pointsConfigService.getAllRules();
    const enrichedHistory = history.map((item) => {
      const rule = rules.find((r) => r.action === item.action);
      return {
        ...item,
        description: rule?.description || item.action,
        type: item.points > 0 ? 'earn' : 'spend',
      };
    });

    return enrichedHistory;
  }

  @Get('me/points/rules')
  @ApiOperation({ summary: '获取积分规则说明' })
  async getPointRules() {
    const rules = await this.pointsConfigService.getAllRules();
    return {
      earn: rules.filter((r) => r.type === 'earn'),
      spend: rules.filter((r) => r.type === 'spend'),
    };
  }

  // ============ Referral System API ============

  @Get('me/referral')
  @ApiOperation({ summary: 'Get or generate referral code and stats' })
  @ApiResponse({ status: 200, description: 'Referral code and statistics' })
  async getReferral(@CurrentUser() user: CurrentUserPayload) {
    const [referralCode, stats] = await Promise.all([
      this.userService.getOrCreateReferralCode(user.id),
      this.userService.getReferralStats(user.id),
    ]);

    const baseUrl = process.env.WEB_URL || 'https://studyabroad.example.com';
    return {
      referralCode,
      referralLink: `${baseUrl}/register?ref=${referralCode}`,
      referralCount: stats.referralCount,
      totalPointsEarned: stats.totalPointsEarned,
    };
  }

  @Get('me/referrals')
  @ApiOperation({ summary: 'List users referred by current user' })
  @ApiResponse({ status: 200, description: 'List of referred users' })
  async getReferralList(@CurrentUser() user: CurrentUserPayload) {
    return this.userService.getReferralList(user.id);
  }

  @Get('me/points/summary')
  @ApiOperation({ summary: '获取积分汇总统计' })
  async getPointSummary(@CurrentUser() user: CurrentUserPayload) {
    const [points, history] = await Promise.all([
      this.caseIncentiveService.getUserPoints(user.id),
      this.caseIncentiveService.getPointHistory(user.id, 100),
    ]);

    // 计算统计数据
    const totalEarned = history
      .filter((h) => h.points > 0)
      .reduce((sum, h) => sum + h.points, 0);

    const totalSpent = history
      .filter((h) => h.points < 0)
      .reduce((sum, h) => sum + Math.abs(h.points), 0);

    // 按action分组统计
    const actionStats = history.reduce(
      (acc, h) => {
        acc[h.action] = (acc[h.action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      currentPoints: points,
      totalEarned,
      totalSpent,
      transactionCount: history.length,
      actionStats,
    };
  }
}
