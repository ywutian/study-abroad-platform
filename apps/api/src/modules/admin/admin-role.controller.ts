import { Controller, Get, Put, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles, RequirePermission, CurrentUser } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { AdminRoleService } from './admin-role.service';
import { AdminOperatorService } from './admin-operator.service';
import {
  UpdateRolePermissionsDto,
  CreateOperatorInviteDto,
  UpdateUserRoleDto,
  SearchUserQueryDto,
  PromoteUserByEmailDto,
} from './dto';

@ApiTags('Admin Roles')
@ApiBearerAuth()
@Controller('admin/roles')
@Roles(Role.ADMIN)
export class AdminRoleController {
  constructor(
    private readonly roleService: AdminRoleService,
    private readonly operatorService: AdminOperatorService,
  ) {}

  @Get('permissions')
  @ApiOperation({ summary: 'Get all role permissions' })
  @RequirePermission(Permission.SYSTEM_ROLES)
  async getPermissions() {
    return this.roleService.getAllPermissions();
  }

  @Put('permissions')
  @ApiOperation({ summary: 'Update permissions for a role' })
  @RequirePermission(Permission.SYSTEM_ROLES)
  async updatePermissions(
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.roleService.updatePermissions(
      dto.role,
      dto.permissions,
      user.id,
    );
  }

  @Post('users/:id/role')
  @ApiOperation({ summary: 'Set a user role (with escalation protection)' })
  @RequirePermission(Permission.USER_MANAGE)
  async setUserRole(
    @Param('id') userId: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.roleService.setUserRole(userId, dto.role, user.id, user.role);
  }

  @Get('users/search')
  @ApiOperation({ summary: 'Search user by email for promotion' })
  @RequirePermission(Permission.SYSTEM_ROLES)
  async searchUser(@Query() dto: SearchUserQueryDto) {
    return this.roleService.findUserByEmail(dto.email);
  }

  @Post('users/promote')
  @ApiOperation({ summary: 'Promote a registered user by email' })
  @RequirePermission(Permission.SYSTEM_ROLES)
  async promoteUser(
    @Body() dto: PromoteUserByEmailDto,
    @CurrentUser() user: { id: string; role: Role },
  ) {
    return this.roleService.promoteUserByEmail(
      dto.email,
      dto.role,
      user.id,
      user.role,
    );
  }

  @Get('operators')
  @ApiOperation({ summary: 'List operators with stats' })
  async getOperators() {
    return this.roleService.getOperators();
  }

  @Get('operators/:id/stats')
  @ApiOperation({ summary: 'Get operator work stats' })
  async getOperatorStats(@Param('id') operatorId: string) {
    return this.operatorService.getOperatorStats(operatorId);
  }

  @Post('operators/invite')
  @ApiOperation({ summary: 'Create operator invite link' })
  @RequirePermission(Permission.SYSTEM_ROLES)
  async createInvite(
    @Body() dto: CreateOperatorInviteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.operatorService.createInvite(user.id, dto.email, dto.role);
  }

  @Get('invites')
  @ApiOperation({ summary: 'List all operator invites' })
  @RequirePermission(Permission.SYSTEM_ROLES)
  async listInvites() {
    return this.operatorService.listInvites();
  }
}
