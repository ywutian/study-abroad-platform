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
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';

// 积分规则说明
const POINT_RULES = [
  {
    action: 'SUBMIT_CASE',
    points: 50,
    description: '提交录取案例',
    type: 'earn',
  },
  {
    action: 'CASE_VERIFIED',
    points: 100,
    description: '案例通过验证',
    type: 'earn',
  },
  {
    action: 'CASE_HELPFUL',
    points: 10,
    description: '案例被标记有帮助',
    type: 'earn',
  },
  {
    action: 'COMPLETE_PROFILE',
    points: 30,
    description: '完善个人档案',
    type: 'earn',
  },
  {
    action: 'REFER_USER',
    points: 50,
    description: '成功邀请新用户',
    type: 'earn',
  },
  {
    action: 'VERIFICATION_APPROVED',
    points: 100,
    description: '身份认证通过',
    type: 'earn',
  },
  {
    action: 'VIEW_CASE_DETAIL',
    points: -20,
    description: '查看案例详情',
    type: 'spend',
  },
  {
    action: 'AI_ANALYSIS',
    points: -30,
    description: 'AI智能分析',
    type: 'spend',
  },
  {
    action: 'MESSAGE_VERIFIED',
    points: -10,
    description: '私信认证用户',
    type: 'spend',
  },
  {
    action: 'ESSAY_POLISH',
    points: -20,
    description: '文书润色服务',
    type: 'spend',
  },
  {
    action: 'ESSAY_REVIEW',
    points: -30,
    description: '文书评审服务',
    type: 'spend',
  },
];

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly dashboardService: DashboardService,
    private readonly caseIncentiveService: CaseIncentiveService,
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

    // 为每条记录添加中文描述
    const enrichedHistory = history.map((item) => {
      const rule = POINT_RULES.find((r) => r.action === item.action);
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
    return {
      earn: POINT_RULES.filter((r) => r.type === 'earn'),
      spend: POINT_RULES.filter((r) => r.type === 'spend'),
    };
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
