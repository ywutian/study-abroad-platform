import { Controller, Get, Put, Post, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Roles, RequirePermission } from '../../common/decorators';
import { Permission } from '../../common/constants/permissions';
import { Role } from '@prisma/client';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { PointsConfigService, PointAction } from './points-config.service';
import {
  TogglePointsDto,
  UpdatePointActionDto,
  BatchUpdatePointActionsDto,
} from './dto/points-config.dto';

@ApiTags('admin/points')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/points')
@Roles(Role.ADMIN)
@RequirePermission(Permission.SYSTEM_SETTINGS)
export class PointsAdminController {
  constructor(private readonly pointsConfigService: PointsConfigService) {}

  @Get('config')
  @ApiOperation({
    summary: 'Get points system config (toggle + all action values)',
  })
  @ApiResponse({ status: 200, description: 'Points configuration' })
  async getConfig() {
    return this.pointsConfigService.getFullConfig();
  }

  @Put('toggle')
  @ApiOperation({ summary: 'Enable/disable points system' })
  async togglePoints(@Body() dto: TogglePointsDto) {
    await this.pointsConfigService.setEnabled(dto.enabled);
    return { success: true, enabled: dto.enabled };
  }

  @Put('actions/:action')
  @ApiOperation({ summary: 'Update points value for a single action' })
  async updateAction(
    @Param('action') action: string,
    @Body() dto: UpdatePointActionDto,
  ) {
    const pointAction = action as PointAction;
    if (!Object.values(PointAction).includes(pointAction)) {
      return { success: false, message: `Unknown action: ${action}` };
    }
    await this.pointsConfigService.setPointValue(pointAction, dto.points);
    return { success: true, action, points: dto.points };
  }

  @Put('actions')
  @ApiOperation({ summary: 'Batch update points values' })
  async updateActions(@Body() dto: BatchUpdatePointActionsDto) {
    const results: Array<{
      action: string;
      success: boolean;
      message?: string;
    }> = [];
    for (const item of dto.actions) {
      const pointAction = item.action as PointAction;
      if (!Object.values(PointAction).includes(pointAction)) {
        results.push({
          action: item.action,
          success: false,
          message: 'Unknown action',
        });
        continue;
      }
      await this.pointsConfigService.setPointValue(pointAction, item.points);
      results.push({ action: item.action, success: true });
    }
    return { results };
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset all points config to defaults' })
  async resetToDefaults() {
    await this.pointsConfigService.resetToDefaults();
    return { success: true, message: 'Points config reset to defaults' };
  }
}
