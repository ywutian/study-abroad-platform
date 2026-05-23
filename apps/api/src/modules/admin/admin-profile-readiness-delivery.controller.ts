import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RequirePermission, Roles } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { AdminProfileReadinessDeliveryService } from './admin-profile-readiness-delivery.service';

@ApiTags('Admin Profile Readiness Delivery')
@ApiBearerAuth()
@Controller('admin/profile-readiness')
@Roles(Role.OPERATOR)
export class AdminProfileReadinessDeliveryController {
  constructor(
    private readonly delivery: AdminProfileReadinessDeliveryService,
  ) {}

  @Get('delivery-package')
  @ThrottleRelaxed()
  @RequirePermission(Permission.DATA_HEALTH)
  @ApiOperation({
    summary:
      'Read-only admin surface for the latest anonymized profile-readiness delivery package.',
  })
  @ApiQuery({
    name: 'queue',
    required: false,
    enum: ['user_prompt', 'operator_review', 'system_generation'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [
      'ready_for_in_app_admin_delivery',
      'ready_for_operator_review',
      'ready_for_system_generation',
      'blocked_missing_copy',
    ],
  })
  @ApiQuery({
    name: 'severity',
    required: false,
    enum: ['critical', 'warning', 'info'],
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getDeliveryPackage(
    @Query('queue')
    queue?: 'user_prompt' | 'operator_review' | 'system_generation',
    @Query('status')
    status?:
      | 'ready_for_in_app_admin_delivery'
      | 'ready_for_operator_review'
      | 'ready_for_system_generation'
      | 'blocked_missing_copy',
    @Query('severity') severity?: 'critical' | 'warning' | 'info',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.delivery.getLatestPackage({
      queue,
      status,
      severity,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
