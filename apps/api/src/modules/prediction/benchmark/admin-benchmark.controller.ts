import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { CurrentUser, Roles } from '../../../common/decorators';
import type { CurrentUserPayload } from '../../../common/decorators';
import {
  ThrottleRelaxed,
  ThrottleSensitive,
} from '../../../common/decorators/throttle.decorator';
import { PredictionBenchmarkService } from './benchmark.service';
import { CreateBenchmarkCommentDto, ListBenchmarkRunsDto } from './dto';

/**
 * Admin co-review surface for M3 prediction benchmark runs.
 *
 * Read-only display + free-form comment threads.
 *
 * Why no in-UI "run benchmark" button:
 *  - The benchmark scripts (m3-structural-benchmark + m3-benchmark) need
 *    a developer-facing console to interpret partial failures and tweak
 *    fixtures. Running them from a request handler would also block one
 *    Node worker for ~30s while the 5000-prediction distribution-health
 *    pass runs. Engineer seeds runs via scripts/seed-prediction-benchmark.ts.
 */
@ApiTags('Admin: Prediction Benchmark')
@ApiBearerAuth()
@Controller('admin/prediction-benchmarks')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminPredictionBenchmarkController {
  constructor(private readonly benchmarkService: PredictionBenchmarkService) {}

  @Get('runs')
  @ThrottleRelaxed()
  @ApiOperation({
    summary: 'List benchmark runs (most recent first)',
  })
  async listRuns(@Query() query: ListBenchmarkRunsDto) {
    return this.benchmarkService.listRuns(query);
  }

  @Get('runs/latest')
  @ThrottleRelaxed()
  @ApiOperation({
    summary: 'Get the latest benchmark run with comments',
  })
  async getLatest() {
    const latest = await this.benchmarkService.getLatestRun();
    if (!latest) {
      throw new NotFoundException(
        'No benchmark runs have been seeded yet. Run scripts/seed-prediction-benchmark.ts first.',
      );
    }
    return latest;
  }

  @Get('runs/:id')
  @ThrottleRelaxed()
  @ApiOperation({
    summary: 'Get a single benchmark run with full details + comments',
  })
  async getRun(@Param('id') id: string) {
    return this.benchmarkService.getRun(id);
  }

  @Post('runs/:id/comments')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Post a free-form review comment on a benchmark run',
  })
  async addComment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateBenchmarkCommentDto,
  ) {
    return this.benchmarkService.addComment(id, user.id, dto);
  }

  @Delete('comments/:commentId')
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Delete one of your own comments',
  })
  async deleteComment(
    @Param('commentId') commentId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.benchmarkService.deleteComment(commentId, user.id);
  }
}
