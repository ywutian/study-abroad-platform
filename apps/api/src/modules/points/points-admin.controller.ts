import {
  Controller,
  Get,
  Put,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
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
import { PointsRedemptionService } from './points-redemption.service';
import {
  TogglePointsDto,
  UpdatePointActionDto,
  BatchUpdatePointActionsDto,
} from './dto/points-config.dto';
import {
  CancelRedemptionDto,
  FulfillRedemptionDto,
  RecordConsultationOutcomeDto,
} from './redeem.dto';

@ApiTags('admin/points')
@ApiBearerAuth()
@ThrottleRelaxed()
@Controller('admin/points')
@Roles(Role.ADMIN)
@RequirePermission(Permission.SYSTEM_SETTINGS)
export class PointsAdminController {
  constructor(
    private readonly pointsConfigService: PointsConfigService,
    private readonly redemptionService: PointsRedemptionService,
  ) {}

  // ── Redemption fulfilment queue ──────────────────────────────────────────
  // Every RedemptionType is delivered by a person, so these three routes are
  // the whole fulfilment mechanism. Before they existed `markFulfilled` and
  // `cancel` had no caller in the repo and a redemption could only ever sit
  // PENDING: the user's points were spent and there was no way to deliver the
  // benefit or give them back.

  @Get('redemptions/pending')
  @ApiOperation({
    summary: 'Redemptions awaiting fulfilment, oldest first (the work queue)',
  })
  @ApiResponse({ status: 200, description: 'Pending redemptions' })
  async listPendingRedemptions(@Query('limit') limit?: string) {
    return this.redemptionService.listPending(
      limit ? Number(limit) : undefined,
    );
  }

  @Patch('redemptions/:id/fulfil')
  @ApiOperation({
    summary: 'Mark a redemption delivered (records what was delivered)',
  })
  @ApiResponse({ status: 200, description: 'Redemption marked fulfilled' })
  async fulfilRedemption(
    @Param('id') id: string,
    @Body() dto: FulfillRedemptionDto,
  ) {
    await this.redemptionService.markFulfilled(id, dto.fulfillment);
    return { success: true, id, status: 'FULFILLED' };
  }

  @Patch('redemptions/:id/outcome')
  @ApiOperation({
    summary:
      'Record what came of a fulfilled consultation (attendance, intent, conversion)',
  })
  @ApiResponse({ status: 200, description: 'Outcome recorded' })
  async recordRedemptionOutcome(
    @Param('id') id: string,
    @Body() dto: RecordConsultationOutcomeDto,
  ) {
    await this.redemptionService.recordConsultationOutcome(id, { ...dto });
    return { success: true, id };
  }

  @Patch('redemptions/:id/cancel')
  @ApiOperation({
    summary: 'Cancel a redemption and refund the points spent',
  })
  @ApiResponse({
    status: 200,
    description: 'Redemption cancelled, points refunded',
  })
  async cancelRedemption(
    @Param('id') id: string,
    @Body() dto: CancelRedemptionDto,
  ) {
    await this.redemptionService.cancel(id, dto.reason);
    return { success: true, id, status: 'CANCELLED' };
  }

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
