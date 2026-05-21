import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DebateBlindEvalService } from './debate-blind-eval.service';
import {
  BlindEvalQueueResponseDto,
  RateDebateTurnDto,
  RateDebateTurnResponseDto,
} from './dto';

/**
 * Phase 2 V1 PR3 — Day-6 blind-eval admin endpoints.
 *
 *  - `GET /admin/debate-eval/queue?evaluatorId=...` → next un-rated turn.
 *  - `POST /admin/debate-eval/rate` → upsert one rating.
 *  - `GET /admin/debate-eval/stats` → counts per evaluator (for the
 *    admin progress UI; the decision-gate math lives in the
 *    `scripts/debate-eval-gate.ts` CLI, NOT in this controller).
 *
 * Gated to `Role.ADMIN`. The evaluator handle (e.g. `counselor-sarah-001`)
 * is a label, not auth — the admin in front of the screen is responsible
 * for setting it consistently per counsellor.
 */
@ApiTags('admin · debate-eval')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
@ThrottleRelaxed()
@Controller('admin/debate-eval')
export class AdminDebateEvalController {
  constructor(private readonly service: DebateBlindEvalService) {}

  @Get('queue')
  @ApiOperation({
    summary:
      "Return the next AI turn this evaluator hasn't rated yet. Order is deterministic per evaluatorId (Fisher-Yates seeded on the id).",
  })
  async getQueue(
    @Query('evaluatorId') evaluatorId?: string,
  ): Promise<BlindEvalQueueResponseDto> {
    if (!evaluatorId || evaluatorId.trim().length === 0) {
      throw new BadRequestException('evaluatorId query param is required');
    }
    if (evaluatorId.length > 120) {
      throw new BadRequestException('evaluatorId must be ≤120 chars');
    }
    return this.service.getNextForEvaluator(evaluatorId.trim());
  }

  @Post('rate')
  @ApiOperation({
    summary:
      'Upsert one (sessionId, turnIndex, evaluatorId) rating. Re-posting overwrites; the controller is idempotent.',
  })
  async rate(
    @Body() dto: RateDebateTurnDto,
  ): Promise<RateDebateTurnResponseDto> {
    return this.service.rate(dto);
  }
}
