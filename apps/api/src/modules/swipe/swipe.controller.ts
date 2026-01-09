import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SwipeService } from './swipe.service';
import {
  SwipeActionDto,
  SwipeCaseDto,
  SwipeResultDto,
  SwipeStatsDto,
  LeaderboardDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('swipe')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('swipe')
export class SwipeController {
  constructor(private readonly swipeService: SwipeService) {}

  @Get('next')
  @ApiOperation({ summary: '获取下一个待滑动的案例' })
  @ApiResponse({ status: 200, type: SwipeCaseDto })
  async getNextCase(@CurrentUser() user: CurrentUserPayload): Promise<SwipeCaseDto | null> {
    return this.swipeService.getNextCase(user.id);
  }

  @Get('batch')
  @ApiOperation({ summary: '批量获取案例（预加载）' })
  @ApiQuery({ name: 'count', required: false, type: Number })
  @ApiResponse({ status: 200, type: [SwipeCaseDto] })
  async getNextCases(
    @CurrentUser() user: CurrentUserPayload,
    @Query('count') count?: number,
  ): Promise<SwipeCaseDto[]> {
    return this.swipeService.getNextCases(user.id, count || 5);
  }

  @Post()
  @ApiOperation({ summary: '提交滑动预测' })
  @ApiResponse({ status: 200, type: SwipeResultDto })
  async submitSwipe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SwipeActionDto,
  ): Promise<SwipeResultDto> {
    return this.swipeService.submitSwipe(user.id, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: '获取用户滑动统计' })
  @ApiResponse({ status: 200, type: SwipeStatsDto })
  async getStats(@CurrentUser() user: CurrentUserPayload): Promise<SwipeStatsDto> {
    return this.swipeService.getStats(user.id);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: '获取排行榜' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: LeaderboardDto })
  async getLeaderboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit') limit?: number,
  ): Promise<LeaderboardDto> {
    return this.swipeService.getLeaderboard(user.id, limit || 20);
  }
}



