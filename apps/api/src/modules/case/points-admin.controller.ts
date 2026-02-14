import { Controller, Get, Put, Post, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators';
import { Role } from '@prisma/client';
import { PointsConfigService, PointAction } from './points-config.service';
import {
  TogglePointsDto,
  UpdatePointActionDto,
  BatchUpdatePointActionsDto,
} from './dto/points-config.dto';

@ApiTags('admin/points')
@ApiBearerAuth()
@Controller('admin/points')
@Roles(Role.ADMIN)
export class PointsAdminController {
  constructor(private readonly pointsConfigService: PointsConfigService) {}

  @Get('config')
  @ApiOperation({ summary: '获取积分系统配置（开关 + 所有动作值）' })
  @ApiResponse({ status: 200, description: '积分配置' })
  async getConfig() {
    return this.pointsConfigService.getFullConfig();
  }

  @Put('toggle')
  @ApiOperation({ summary: '启用/禁用积分系统' })
  async togglePoints(@Body() dto: TogglePointsDto) {
    await this.pointsConfigService.setEnabled(dto.enabled);
    return { success: true, enabled: dto.enabled };
  }

  @Put('actions/:action')
  @ApiOperation({ summary: '修改单个动作的积分值' })
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
  @ApiOperation({ summary: '批量修改积分值' })
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
  @ApiOperation({ summary: '重置所有积分配置为默认值' })
  async resetToDefaults() {
    await this.pointsConfigService.resetToDefaults();
    return { success: true, message: 'Points config reset to defaults' };
  }
}
