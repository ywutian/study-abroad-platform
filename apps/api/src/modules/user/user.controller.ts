import {
  Body,
  Controller,
  Get,
  Delete,
  Patch,
  Put,
  Res,
  Query,
} from '@nestjs/common';
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
import { PointsService } from '../points/incentive.service';
import { PointsConfigService } from '../points/points-config.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { UpdateUserLocaleDto } from './dto/update-user-locale.dto';
import { UpdatePeerReviewSettingDto } from './dto/update-peer-review-setting.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly dashboardService: DashboardService,
    private readonly pointsService: PointsService,
    private readonly pointsConfigService: PointsConfigService,
  ) {}

  @Get('me/dashboard')
  @ApiOperation({ summary: 'Get user dashboard data' })
  async getDashboard(@CurrentUser() user: CurrentUserPayload) {
    return this.dashboardService.getDashboardSummary(user.id, user.locale);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user info' })
  async getCurrentUser(@CurrentUser() user: CurrentUserPayload) {
    const fullUser = await this.userService.findByIdOrThrow(user.id);
    const { passwordHash: _passwordHash, ...result } = fullUser;
    return result;
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user language preference' })
  async updateCurrentUser(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateUserLocaleDto,
  ) {
    const updatedUser = await this.userService.update(user.id, {
      locale: dto.locale,
    });
    const { passwordHash: _passwordHash, ...result } = updatedUser;
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

  @Get('me/peer-review-setting')
  @ApiOperation({
    summary: 'Get Alumni Square peer-review opt-in state (and derived age)',
  })
  async getPeerReviewSetting(@CurrentUser() user: CurrentUserPayload) {
    return this.userService.getPeerReviewSetting(user.id);
  }

  @Patch('me/peer-review-setting')
  @ApiOperation({ summary: 'Toggle Alumni Square peer-review opt-in' })
  @ApiResponse({
    status: 403,
    description: 'Users under 16 cannot enable peer reviews',
  })
  async updatePeerReviewSetting(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdatePeerReviewSettingDto,
  ) {
    return this.userService.updatePeerReviewSetting(
      user.id,
      dto.acceptPeerReview,
    );
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
  @ApiOperation({ summary: 'Get current user points' })
  async getMyPoints(@CurrentUser() user: CurrentUserPayload) {
    const points = await this.pointsService.getUserPoints(user.id);
    return { points };
  }

  @Get('me/points/history')
  @ApiOperation({ summary: 'Get points history' })
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
    const history = await this.pointsService.getPointHistory(
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
  @ApiOperation({ summary: 'Get points rules' })
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
  @ApiOperation({ summary: 'Get points summary statistics' })
  async getPointSummary(@CurrentUser() user: CurrentUserPayload) {
    const [points, history] = await Promise.all([
      this.pointsService.getUserPoints(user.id),
      this.pointsService.getPointHistory(user.id, 100),
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
