import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role, GlobalEventCategory } from '@prisma/client';
import {
  ThrottleRelaxed,
  ThrottleSensitive,
} from '../../common/decorators/throttle.decorator';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateReportDto,
  UpdateUserRoleDto,
  ReportQueryDto,
  UserQueryDto,
  CreateSchoolDeadlineDto,
  UpdateSchoolDeadlineDto,
  CreateGlobalEventDto,
  UpdateGlobalEventDto,
  BanUserDto,
  TriggerDataSyncDto,
  CreateActivityTemplateDto,
  UpdateActivityTemplateDto,
  ActivityTemplateQueryDto,
  BroadcastNotificationDto,
  BroadcastAudience,
  CreateSchoolCalibrationDto,
  UpdateSchoolCalibrationDto,
} from './dto';
import { AdminDataSyncService } from './admin-data-sync.service';
import { PredictionService } from '../prediction/prediction.service';
import type { Response } from 'express';

@ApiTags('admin')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminDataSyncService: AdminDataSyncService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
    private readonly predictionService: PredictionService,
  ) {}

  // Stats
  @Get('stats')
  @ApiOperation({ summary: '获取统计数据（增强版）' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('stats/trends')
  @ApiOperation({ summary: '获取 30 天趋势数据' })
  async getTrends() {
    return this.adminService.getTrends();
  }

  // Reports
  @Get('reports')
  @ApiOperation({ summary: '获取举报列表' })
  async getReports(@Query() query: ReportQueryDto) {
    const { status, targetType, page = 1, pageSize = 20 } = query;
    return this.adminService.getReports(status, targetType, page, pageSize);
  }

  @Put('reports/:id')
  @ApiOperation({ summary: '更新举报状态' })
  async updateReport(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateReportDto,
  ) {
    return this.adminService.updateReportStatus(
      admin.id,
      id,
      data.status,
      data.resolution,
    );
  }

  @Delete('reports/:id')
  @ApiOperation({ summary: '删除举报' })
  async deleteReport(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.adminService.deleteReport(admin.id, id);
    return { message: 'Report deleted' };
  }

  // Users
  @Get('users')
  @ApiOperation({ summary: '获取用户列表' })
  async getUsers(@Query() query: UserQueryDto) {
    const { search, role, page = 1, pageSize = 20 } = query;
    return this.adminService.getUsers(search, role, page, pageSize);
  }

  @Get('users/:id')
  @ApiOperation({ summary: '获取用户详情' })
  async getUser(@Param('id') id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        isBanned: true,
        bannedUntil: true,
        banReason: true,
        createdAt: true,
        locale: true,
        _count: {
          select: {
            admissionCases: true,
            reviewsGiven: true,
          },
        },
      },
    });
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: '更新用户角色' })
  async updateUserRole(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(admin.id, id, data.role);
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: '封禁用户' })
  async banUser(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: BanUserDto,
  ) {
    return this.adminService.banUser(
      admin.id,
      id,
      data.reason,
      data.durationHours,
      data.permanent,
    );
  }

  @Post('users/:id/unban')
  @ApiOperation({ summary: '解除封禁' })
  async unbanUser(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.adminService.unbanUser(admin.id, id);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: '删除用户' })
  async deleteUser(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.adminService.deleteUser(admin.id, id);
    return { message: 'User deleted' };
  }

  // Audit Logs
  @Get('audit-logs')
  @ApiOperation({ summary: '获取审计日志' })
  async getAuditLogs(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('adminId') adminId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
  ) {
    return this.adminService.getAuditLogs(page || 1, pageSize || 50, {
      adminId,
      action,
      resource,
    });
  }

  // ============ Data Sync (admin update mechanism) ============

  @Get('data-sync/jobs')
  @ApiOperation({ summary: 'List data-sync jobs with last run status' })
  async getDataSyncJobs() {
    return this.adminDataSyncService.getDataSyncJobs();
  }

  @Post('data-sync/trigger')
  @ApiOperation({ summary: 'Trigger a data-sync job (e.g. COLLEGE_SCORECARD)' })
  async triggerDataSync(
    @CurrentUser() admin: CurrentUserPayload,
    @Body() dto: TriggerDataSyncDto,
  ) {
    return this.adminDataSyncService.triggerDataSync(
      dto.job,
      dto.params,
      admin.id,
    );
  }

  // ============ School Deadlines ============

  @Get('school-deadlines')
  @ApiOperation({ summary: '获取学校截止日期列表' })
  async getSchoolDeadlines(
    @Query('schoolId') schoolId?: string,
    @Query('year') year?: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getSchoolDeadlines(
      schoolId,
      year ? Number(year) : undefined,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 50,
    );
  }

  @Post('school-deadlines')
  @ApiOperation({ summary: '创建学校截止日期' })
  async createSchoolDeadline(@Body() dto: CreateSchoolDeadlineDto) {
    return this.adminService.createSchoolDeadline(dto);
  }

  @Put('school-deadlines/:id')
  @ApiOperation({ summary: '更新学校截止日期' })
  async updateSchoolDeadline(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolDeadlineDto,
  ) {
    return this.adminService.updateSchoolDeadline(id, dto);
  }

  @Delete('school-deadlines/:id')
  @ApiOperation({ summary: '删除学校截止日期' })
  async deleteSchoolDeadline(@Param('id') id: string) {
    await this.adminService.deleteSchoolDeadline(id);
    return { message: 'Deadline deleted' };
  }

  // ============ Global Events ============

  @Get('global-events')
  @ApiOperation({ summary: '获取全局事件列表' })
  async getGlobalEvents(
    @Query('category') category?: GlobalEventCategory,
    @Query('year') year?: number,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.adminService.getGlobalEvents(
      category,
      year ? Number(year) : undefined,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 50,
    );
  }

  @Post('global-events')
  @ApiOperation({ summary: '创建全局事件' })
  async createGlobalEvent(@Body() dto: CreateGlobalEventDto) {
    return this.adminService.createGlobalEvent(dto);
  }

  @Put('global-events/:id')
  @ApiOperation({ summary: '更新全局事件' })
  async updateGlobalEvent(
    @Param('id') id: string,
    @Body() dto: UpdateGlobalEventDto,
  ) {
    return this.adminService.updateGlobalEvent(id, dto);
  }

  @Delete('global-events/:id')
  @ApiOperation({ summary: '删除全局事件' })
  async deleteGlobalEvent(@Param('id') id: string) {
    await this.adminService.deleteGlobalEvent(id);
    return { message: 'Event deleted' };
  }

  // ============ Broadcast Notifications ============

  @Post('notifications/broadcast')
  @ApiOperation({ summary: '广播通知' })
  async broadcastNotification(@Body() body: BroadcastNotificationDto) {
    const roleFilter: any = {};
    if (body.audience === BroadcastAudience.VERIFIED)
      roleFilter.role = { in: [Role.VERIFIED, Role.ADMIN] };
    if (body.audience === BroadcastAudience.ADMIN) roleFilter.role = Role.ADMIN;

    const users = await this.prisma.user.findMany({
      where: { ...roleFilter, isBanned: false },
      select: { id: true },
    });

    // Batch notifications to avoid blocking the event loop with large user sets.
    // Process in chunks of 100 to balance throughput and connection pool usage.
    const BATCH_SIZE = 100;
    let sent = 0;
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((user) =>
          this.notificationService.createNotification(
            user.id,
            NotificationType.SYSTEM_BROADCAST,
            {
              customTitle: body.title,
              customContent: body.content,
            },
          ),
        ),
      );
      sent += batch.length;
    }

    return { sent, total: users.length, audience: body.audience };
  }

  // ============ CSV Export ============

  @Get('export/:resource')
  @ApiOperation({ summary: 'CSV 数据导出' })
  async exportCsv(@Param('resource') resource: string, @Res() res: Response) {
    let rows: string[][] = [];
    let headers: string[] = [];

    switch (resource) {
      case 'users': {
        headers = ['ID', 'Email', 'Role', 'Verified', 'Banned', 'Created'];
        const users = await this.prisma.user.findMany({
          select: {
            id: true,
            email: true,
            role: true,
            emailVerified: true,
            isBanned: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        rows = users.map((u) => [
          u.id,
          u.email,
          u.role,
          String(u.emailVerified),
          String(u.isBanned),
          u.createdAt.toISOString(),
        ]);
        break;
      }
      case 'payments': {
        headers = ['ID', 'User ID', 'Amount', 'Currency', 'Status', 'Created'];
        const payments = await this.prisma.payment.findMany({
          select: {
            id: true,
            userId: true,
            amount: true,
            currency: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        rows = payments.map((p) => [
          p.id,
          p.userId,
          String(p.amount),
          p.currency,
          p.status,
          p.createdAt.toISOString(),
        ]);
        break;
      }
      case 'audit-logs': {
        headers = [
          'ID',
          'Admin ID',
          'Action',
          'Resource',
          'Resource ID',
          'Created',
        ];
        const logs = await this.prisma.auditLog.findMany({
          select: {
            id: true,
            userId: true,
            action: true,
            resource: true,
            resourceId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        });
        rows = logs.map((l) => [
          l.id,
          l.userId || '',
          l.action,
          l.resource,
          l.resourceId || '',
          l.createdAt.toISOString(),
        ]);
        break;
      }
      default:
        res.status(400).json({ message: `Unknown resource: ${resource}` });
        return;
    }

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resource}-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    // Inform the client about truncation so admins know if data was cut off
    res.setHeader('X-Exported-Rows', String(rows.length));
    res.setHeader('X-Max-Rows', '10000');
    res.send(csv);
  }

  // ============================================
  // User Profile Viewing
  // ============================================

  @Get('users/:id/profile')
  @ApiOperation({
    summary: 'Get full user profile with activities, awards, education',
  })
  async getUserProfile(@Param('id') userId: string) {
    const profile = await this.prisma.profile.findFirst({
      where: { userId },
      include: {
        testScores: true,
        activities: {
          orderBy: { order: 'asc' },
          include: { activityTemplate: true },
        },
        awards: {
          orderBy: { order: 'asc' },
          include: { competition: true },
        },
        education: { include: { highSchool: true } },
      },
    });

    if (!profile) return { profile: null };

    return { profile };
  }

  // ============================================
  // Activity Stats
  // ============================================

  @Get('stats/activities')
  @ApiOperation({ summary: 'Get activity statistics across all students' })
  async getActivityStats() {
    const [totalActivities, categoryDist, avgPerStudent, tierDist] =
      await Promise.all([
        this.prisma.activity.count(),
        this.prisma.activity.groupBy({
          by: ['category'],
          _count: true,
          orderBy: { _count: { category: 'desc' } },
        }),
        this.prisma.profile.findMany({
          select: { _count: { select: { activities: true } } },
        }),
        this.prisma.activityTemplate.groupBy({
          by: ['tier'],
          _count: true,
          orderBy: { tier: 'asc' },
        }),
      ]);

    const activityCounts = avgPerStudent.map((p) => p._count.activities);
    const avg =
      activityCounts.length > 0
        ? activityCounts.reduce((s, c) => s + c, 0) / activityCounts.length
        : 0;

    return {
      totalActivities,
      categoryDistribution: categoryDist.map((c) => ({
        category: c.category,
        count: c._count,
      })),
      avgActivitiesPerStudent: Math.round(avg * 10) / 10,
      templateTierDistribution: tierDist.map((t) => ({
        tier: t.tier,
        count: t._count,
      })),
    };
  }

  // ============================================
  // ActivityTemplate CRUD
  // ============================================

  @Get('activity-templates')
  @ApiOperation({
    summary: 'List activity templates with pagination and filters',
  })
  async listActivityTemplates(@Query() query: ActivityTemplateQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: any = {};

    if (query.tier) where.tier = query.tier;
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { nameZh: { contains: query.search, mode: 'insensitive' } },
        { aliases: { has: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.activityTemplate.findMany({
        where,
        orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityTemplate.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  @Get('activity-templates/:id')
  @ApiOperation({ summary: 'Get single activity template' })
  async getActivityTemplate(@Param('id') id: string) {
    return this.prisma.activityTemplate.findUniqueOrThrow({ where: { id } });
  }

  @Post('activity-templates')
  @ApiOperation({ summary: 'Create activity template' })
  async createActivityTemplate(@Body() dto: CreateActivityTemplateDto) {
    return this.prisma.activityTemplate.create({
      data: {
        name: dto.name,
        nameZh: dto.nameZh,
        aliases: dto.aliases ?? [],
        category: dto.category,
        tier: dto.tier ?? 4,
        description: dto.description,
      },
    });
  }

  @Put('activity-templates/:id')
  @ApiOperation({ summary: 'Update activity template' })
  async updateActivityTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateActivityTemplateDto,
  ) {
    return this.prisma.activityTemplate.update({
      where: { id },
      data: dto,
    });
  }

  @Delete('activity-templates/:id')
  @ApiOperation({ summary: 'Soft-delete activity template' })
  async deleteActivityTemplate(@Param('id') id: string) {
    return this.prisma.activityTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ============================================
  // Competition Management
  // ============================================

  @Get('competitions')
  @ApiOperation({ summary: 'List all competitions with tier info' })
  async listCompetitions(@Query('page') page = 1, @Query('limit') limit = 50) {
    const [items, total] = await Promise.all([
      this.prisma.competition.findMany({
        orderBy: [{ tier: 'desc' }, { name: 'asc' }],
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      this.prisma.competition.count(),
    ]);

    return { items, total, page: Number(page), limit: Number(limit) };
  }

  // ============================================
  // School Calibration Management
  // ============================================

  @Get('calibrations')
  @ApiOperation({ summary: 'List all school calibrations' })
  async getCalibrations() {
    return this.adminService.getCalibrations();
  }

  @Post('calibrations')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Create a school calibration' })
  async createCalibration(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSchoolCalibrationDto,
  ) {
    const result = await this.adminService.createCalibration(user.id, dto);
    await this.predictionService.invalidateCalibrationCache();
    return result;
  }

  @Put('calibrations/:id')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Update a school calibration' })
  async updateCalibration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSchoolCalibrationDto,
  ) {
    const result = await this.adminService.updateCalibration(user.id, id, dto);
    await this.predictionService.invalidateCalibrationCache();
    return result;
  }

  @Delete('calibrations/:id')
  @ThrottleSensitive()
  @ApiOperation({ summary: 'Delete a school calibration' })
  async deleteCalibration(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.adminService.deleteCalibration(user.id, id);
    await this.predictionService.invalidateCalibrationCache();
  }
}
