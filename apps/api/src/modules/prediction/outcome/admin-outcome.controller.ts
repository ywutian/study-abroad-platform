import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../../common/decorators';
import type { CurrentUserPayload } from '../../../common/decorators';
import {
  ThrottleRelaxed,
  ThrottleSensitive,
} from '../../../common/decorators/throttle.decorator';
import { VerifyOutcomeDto } from './dto';
import { OutcomeService } from './outcome.service';

/**
 * Admin queue for verifying user-reported outcomes.
 *
 * Split into its own file (separate from OutcomeController in
 * outcome.controller.ts) so `lint:integration` route-helper-sync rule
 * detects both controllers' `@Controller(prefix)` decorators — the rule
 * only matches the first @Controller() in a given file.
 */
@ApiTags('Admin: Prediction Outcomes')
@ApiBearerAuth()
@Controller('admin/predictions/outcomes')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminOutcomeController {
  constructor(private readonly outcomeService: OutcomeService) {}

  @Get('pending-verification')
  @ThrottleRelaxed()
  @ApiOperation({
    summary: 'Admin queue: outcomes pending COUNSELOR/DOCUMENT verification',
  })
  async pendingVerification() {
    return this.outcomeService.listPendingVerification();
  }

  @Post(':id/verify')
  @ThrottleSensitive()
  @ApiOperation({
    summary:
      'Admin upgrades an outcome to COUNSELOR_VERIFIED or DOCUMENT_VERIFIED',
  })
  async verify(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: VerifyOutcomeDto,
  ) {
    return this.outcomeService.verify(id, user.id, dto);
  }
}
