import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RankingService } from './ranking.service';
import { sanitizeRankingWeights } from './ranking-score.util';
import { CalculateRankingDto, SaveRankingDto } from './dto';
import { CurrentUser, Public } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';

@ApiTags('rankings')
@ThrottleRelaxed()
@Controller('rankings')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Post('calculate')
  @Public()
  @ApiOperation({ summary: 'Calculate custom ranking' })
  async calculateRanking(@Body() weights: CalculateRankingDto) {
    return this.rankingService.calculateRanking(sanitizeRankingWeights(weights));
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save custom ranking' })
  async saveRanking(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: SaveRankingDto,
  ) {
    const { name, isPublic = false, ...weights } = data;
    return this.rankingService.saveRanking(
      user.id,
      name,
      sanitizeRankingWeights(weights),
      isPublic,
    );
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my saved rankings' })
  async getMyRankings(@CurrentUser() user: CurrentUserPayload) {
    return this.rankingService.getUserRankings(user.id);
  }

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Get public rankings' })
  async getPublicRankings() {
    return this.rankingService.getPublicRankings();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get ranking by ID' })
  async getRanking(@Param('id') id: string) {
    return this.rankingService.findById(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my ranking' })
  async deleteRanking(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.rankingService.deleteRanking(id, user.id);
    return { message: 'Ranking deleted successfully' };
  }
}
