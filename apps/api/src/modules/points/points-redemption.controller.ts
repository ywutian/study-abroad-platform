import {
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RedemptionType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { ThrottleSensitive } from '../../common/decorators/throttle.decorator';
import { PointsRedemptionService } from './points-redemption.service';

/**
 * Hall refactor Stage 7 — Points redemption (cross-module spend outlet).
 *
 * Sensitive throttle (5 req/min) because each redemption mutates user.points
 * and creates a ledger row; bursts of POSTs indicate either a UI bug or abuse.
 */
@ApiTags('points')
@ThrottleSensitive()
@Controller('points/redemptions')
export class PointsRedemptionController {
  constructor(private readonly redemptionService: PointsRedemptionService) {}

  @Get('catalog')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List available redemption types + costs' })
  getCatalog() {
    return this.redemptionService.getCatalog();
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'My redemption history (paginated)' })
  async getMyHistory(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: string,
  ) {
    return this.redemptionService.getHistory(
      user.id,
      limit ? Math.min(100, Math.max(1, Number(limit))) : 20,
    );
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Redeem points for a specific reward type' })
  async redeem(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { type: RedemptionType; metadata?: Record<string, unknown> },
  ) {
    return this.redemptionService.redeem(user.id, body.type, body.metadata);
  }
}
