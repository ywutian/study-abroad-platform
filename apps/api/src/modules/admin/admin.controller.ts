import { Controller, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, ReportStatus } from '@prisma/client';

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
  @ApiQuery({ name: 'status', required: false, enum: ReportStatus })
  @ApiQuery({ name: 'targetType', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getReports(
    @Query('status') status?: ReportStatus,
    @Query('targetType') targetType?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number
  ) {
    return this.adminService.getReports(status, targetType, page || 1, pageSize || 20);
  }

  @Put('reports/:id')
  @ApiOperation({ summary: '更新举报状态' })
  async updateReport(
    @Param('id') id: string,
    @Body() data: { status: ReportStatus; resolution?: string }
  ) {
    return this.adminService.updateReportStatus(id, data.status, data.resolution);
  }

  @Delete('reports/:id')
  @ApiOperation({ summary: '删除举报' })
  async deleteReport(@Param('id') id: string) {
    await this.adminService.deleteReport(id);
    return { message: 'Report deleted' };
  }

  // Users
  @Get('users')
  @ApiOperation({ summary: '获取用户列表' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async getUsers(
    @Query('search') search?: string,
    @Query('role') role?: Role,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number
  ) {
    return this.adminService.getUsers(search, role, page || 1, pageSize || 20);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: '更新用户角色' })
  async updateUserRole(@Param('id') id: string, @Body() data: { role: Role }) {
    return this.adminService.updateUserRole(id, data.role);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: '删除用户' })
  async deleteUser(@Param('id') id: string) {
    await this.adminService.deleteUser(id);
    return { message: 'User deleted' };
  }
}




