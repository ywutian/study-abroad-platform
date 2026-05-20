import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ThrottleAI } from '../../common/decorators/throttle.decorator';
import { EssayDebateService } from './essay-debate.service';
import {
  CreateDebateTurnDto,
  DebateSessionDto,
  DebateTurnResponseDto,
} from './dto';

/**
 * Phase 2 V1 PR1 (skeleton). Two endpoints; both require auth:
 *
 *  - `POST /essay-debate/turn` — append a user argument + AI rebuttal.
 *  - `GET /essay-debate/:sessionId/latest` — full turn history for hydration.
 *
 * `@ThrottleAI()` gives us the project-standard 20/min cap on top of the
 * Redis daily budget enforced inside the service.
 */
@ApiTags('essay-debate')
@ApiBearerAuth()
@ThrottleAI()
@UseGuards(JwtAuthGuard)
@Controller('essay-debate')
export class EssayDebateController {
  constructor(private readonly essayDebateService: EssayDebateService) {}

  @Post('turn')
  @ApiOperation({
    summary:
      'Append one debate turn (user argument + AI rebuttal). Skeleton: mock AI response. PR2 wires Claude.',
  })
  @ApiResponse({ status: 200, type: DebateTurnResponseDto })
  @ApiResponse({ status: 429, description: 'Daily turn cap reached (30/day).' })
  @ApiResponse({
    status: 503,
    description: 'System-wide daily essay-debate budget exhausted.',
  })
  async createTurn(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateDebateTurnDto,
  ): Promise<DebateTurnResponseDto> {
    return this.essayDebateService.createOrContinueTurn(user.id, dto);
  }

  @Get(':sessionId/latest')
  @ApiOperation({
    summary: 'Return the full turn history for a debate session you own.',
  })
  @ApiResponse({ status: 200, type: DebateSessionDto })
  @ApiResponse({ status: 404, description: 'Session not found.' })
  async getLatest(
    @CurrentUser() user: CurrentUserPayload,
    @Param('sessionId') sessionId: string,
  ): Promise<DebateSessionDto> {
    return this.essayDebateService.getLatestSession(user.id, sessionId);
  }
}
