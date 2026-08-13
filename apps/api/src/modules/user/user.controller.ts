import { Body, Controller, Delete, Get, Put, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { CurrentUserPayload } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import { PointsService } from '../points/incentive.service';
import { PointsConfigService } from '../points/points-config.service';
import { DashboardService } from './dashboard.service';
import { UpdateUserLocaleDto } from './dto/update-user-locale.dto';
import { UserService } from './user.service';

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
    const {
      passwordHash: _passwordHash,
      points: _points,
      ...result
    } = fullUser;
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
    const {
      passwordHash: _passwordHash,
      points: _points,
      ...result
    } = updatedUser;
    return result;
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete current user account (soft delete)' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  async deleteAccount(@CurrentUser() user: CurrentUserPayload) {
    await this.userService.softDelete(user.id);
    return {
      success: true,
      // This used to promise "Your data will be permanently removed within 30
      // days." Nothing ever did that: `hardDelete` has no caller anywhere in
      // the repo outside its own definition, and the only deletedAt-aware job
      // is token-cleanup, which deletes refresh tokens. The sentence was a
      // commitment about deleting personal data that the system did not keep.
      //
      // What softDelete actually does: disables login, anonymises the email,
      // clears the profile identifiers (realName / nickname / avatar / bio /
      // birthday), redacts sent messages, sets the user's cases to PRIVATE and
      // deletes follows and blocks. The rows stay.
      //
      // Do not re-add a retention promise here without the job that honours it.
      message: 'Account deleted successfully.',
    };
  }

  // Hall §7 Decision B: the `me/peer-review-setting` GET/PATCH endpoints were
  // removed — they toggled the dropped `User.acceptPeerReview` opt-in column.

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
    const points = await this.pointsService.getVisibleUserPoints(user.id);
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
    const history = await this.pointsService.getVisiblePointHistory(
      user.id,
      limit ? parseInt(limit, 10) : 20,
    );

    // 为每条记录添加中文描述（从动态配置读取）
    if (history.length === 0) return [];
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
    const enabled = await this.pointsConfigService.isEnabled();
    if (!enabled) return { enabled: false, earn: [], spend: [] };
    const rules = await this.pointsConfigService.getAllRules();
    return {
      enabled,
      earn: rules.filter((r) => r.type === 'earn'),
      spend: rules.filter((r) => r.type === 'spend'),
    };
  }

  // ============ Referral System API ============

  @Get('me/referral')
  @ApiOperation({ summary: 'Get or generate referral code and stats' })
  @ApiResponse({ status: 200, description: 'Referral code and statistics' })
  async getReferral(@CurrentUser() user: CurrentUserPayload) {
    const [referralCode, stats, pointsEnabled] = await Promise.all([
      this.userService.getOrCreateReferralCode(user.id),
      this.userService.getReferralStats(user.id),
      this.pointsConfigService.isEnabled(),
    ]);

    const baseUrl = process.env.WEB_URL || 'https://studyabroad.example.com';
    return {
      referralCode,
      referralLink: `${baseUrl}/register?ref=${referralCode}`,
      referralCount: stats.referralCount,
      totalPointsEarned: pointsEnabled ? stats.totalPointsEarned : 0,
    };
  }

  @Get('me/referrals')
  @ApiOperation({ summary: 'List users referred by current user' })
  @ApiResponse({ status: 200, description: 'List of referred users' })
  async getReferralList(@CurrentUser() user: CurrentUserPayload) {
    const [result, pointsEnabled] = await Promise.all([
      this.userService.getReferralList(user.id),
      this.pointsConfigService.isEnabled(),
    ]);
    if (pointsEnabled) return result;
    return {
      ...result,
      referrals: result.referrals.map((referral) => ({
        ...referral,
        pointsEarned: 0,
      })),
    };
  }

  @Get('me/points/summary')
  @ApiOperation({ summary: 'Get points summary statistics' })
  async getPointSummary(@CurrentUser() user: CurrentUserPayload) {
    if (!(await this.pointsConfigService.isEnabled())) {
      return {
        currentPoints: 0,
        totalEarned: 0,
        totalSpent: 0,
        transactionCount: 0,
        actionStats: {},
      };
    }
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
