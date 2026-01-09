import { Controller, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles, CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';
import { UpdateReportDto, UpdateUserRoleDto, ReportQueryDto, UserQueryDto } from './dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Stats
  @Get('stats')
  @ApiOperation({ summary: '获取统计数据' })
  async getStats() {
    return this.adminService.getStats();
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
    return this.adminService.updateReportStatus(admin.id, id, data.status, data.resolution);
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

  @Put('users/:id/role')
  @ApiOperation({ summary: '更新用户角色' })
  async updateUserRole(
    @CurrentUser() admin: CurrentUserPayload,
    @Param('id') id: string, 
    @Body() data: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(admin.id, id, data.role);
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
    return this.adminService.getAuditLogs(
      page || 1, 
      pageSize || 50, 
      { adminId, action, resource }
    );
  }
}
