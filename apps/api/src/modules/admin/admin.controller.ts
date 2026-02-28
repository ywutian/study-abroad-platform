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
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
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
} from './dto';
import type { Response } from 'express';

@ApiTags('admin')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
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
  async broadcastNotification(
    @Body()
    body: {
      title: string;
      content: string;
      audience: 'ALL' | 'VERIFIED' | 'ADMIN';
    },
  ) {
    const roleFilter: any = {};
    if (body.audience === 'VERIFIED')
      roleFilter.role = { in: [Role.VERIFIED, Role.ADMIN] };
    if (body.audience === 'ADMIN') roleFilter.role = Role.ADMIN;

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
}
