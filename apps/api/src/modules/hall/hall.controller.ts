import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { HallService } from './hall.service';
import { SwipeService } from '../swipe/swipe.service';
import { CurrentUser, Public } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  CreateReviewDto,
  CreateUserListDto,
  UpdateUserListDto,
  VoteListDto,
  BatchRankingDto,
  VerifiedRankingQueryDto,
  VerifiedRankingResponseDto,
} from './dto';
import {
  SwipeActionDto,
  SwipeBatchQueryDto,
  SwipeBatchResultDto,
  SwipeResultDto,
  SwipeStatsDto,
  LeaderboardDto,
  LeaderboardQueryDto,
} from '../swipe/dto';

@ApiTags('hall')
@Controller('hall')
export class HallController {
  constructor(
    private readonly hallService: HallService,
    private readonly swipeService: SwipeService,
  ) {}

  // ============================================
  // Public Profiles
  // ============================================

  @Get('public-profiles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get public profiles for review' })
  @ApiQuery({ name: 'search', required: false })
  async getPublicProfiles(@Query('search') search?: string) {
    return this.hallService.getPublicProfiles(search);
  }

  // ============================================
  // Batch Ranking
  // ============================================

  @Post('ranking')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ranking for multiple schools' })
  async getBatchRanking(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: BatchRankingDto,
  ) {
    return this.hallService.getBatchRanking(user.id, data.schoolIds);
  }

  // ============================================
  // Reviews (锐评模式)
  // ============================================

  @Post('reviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update a review' })
  async createReview(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateReviewDto,
  ) {
    return this.hallService.createReview(user.id, data);
  }

  @Patch('reviews/:reviewId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing review' })
  async updateReview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('reviewId') reviewId: string,
    @Body() data: CreateReviewDto,
  ) {
    return this.hallService.updateReview(reviewId, user.id, data);
  }

  @Delete('reviews/:reviewId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review' })
  async deleteReview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('reviewId') reviewId: string,
  ) {
    return this.hallService.deleteReview(reviewId, user.id);
  }

  @Get('reviews/:profileUserId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reviews for a user profile (paginated)' })
  async getReviewsForUser(
    @Param('profileUserId') profileUserId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: 'createdAt' | 'overallScore' | 'helpfulCount',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.hallService.getReviewsForUser(profileUserId, {
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get('reviews/:profileUserId/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get review statistics for a user' })
  async getReviewStats(@Param('profileUserId') profileUserId: string) {
    return this.hallService.getReviewStats(profileUserId);
  }

  @Post('reviews/:reviewId/react')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'React to a review (helpful/insightful)' })
  async reactToReview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('reviewId') reviewId: string,
    @Body() body: { type: string },
  ) {
    return this.hallService.reactToReview(reviewId, user.id, body.type);
  }

  @Delete('reviews/:reviewId/react')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove reaction from a review' })
  async removeReaction(
    @CurrentUser() user: CurrentUserPayload,
    @Param('reviewId') reviewId: string,
    @Query('type') type: string,
  ) {
    return this.hallService.removeReaction(reviewId, user.id, type);
  }

  @Get('reviews/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reviews I have written' })
  async getMyReviews(@CurrentUser() user: CurrentUserPayload) {
    return this.hallService.getMyReviews(user.id);
  }

  // ============================================
  // Ranking
  // ============================================

  @Get('target-ranking')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get ranking for all my target schools (auto-read from SchoolListItem)',
  })
  async getTargetSchoolRanking(@CurrentUser() user: CurrentUserPayload) {
    return this.hallService.getTargetSchoolRanking(user.id);
  }

  @Get('ranking/:schoolId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my ranking for a target school' })
  async getProfileRanking(
    @CurrentUser() user: CurrentUserPayload,
    @Param('schoolId') schoolId: string,
  ) {
    return this.hallService.getProfileRanking(user.id, schoolId);
  }

  @Post('ranking-analysis')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI analysis for ranking at a specific school' })
  async getRankingAnalysis(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: { schoolId: string },
  ) {
    return this.hallService.getRankingAnalysis(user.id, data.schoolId);
  }

  // ============================================
  // User Lists
  // ============================================

  @Get('lists')
  @Public()
  @ApiOperation({ summary: 'Get public user lists' })
  @ApiQuery({ name: 'category', required: false })
  async getPublicLists(
    @Query() pagination: PaginationDto,
    @Query('category') category?: string,
  ) {
    return this.hallService.getPublicLists(pagination, category);
  }

  @Get('lists/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my lists' })
  async getMyLists(@CurrentUser() user: CurrentUserPayload) {
    return this.hallService.getMyLists(user.id);
  }

  @Get('lists/:id')
  @Public()
  @ApiOperation({ summary: 'Get list by ID' })
  async getListById(@Param('id') id: string) {
    return this.hallService.getListById(id);
  }

  @Post('lists')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create user list' })
  async createList(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateUserListDto,
  ) {
    return this.hallService.createList(user.id, data);
  }

  @Put('lists/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my list' })
  async updateList(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateUserListDto,
  ) {
    return this.hallService.updateList(id, user.id, data);
  }

  @Delete('lists/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my list' })
  async deleteList(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.hallService.deleteList(id, user.id);
    return { success: true };
  }

  @Post('lists/:id/vote')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vote on a list' })
  async voteList(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: VoteListDto,
  ) {
    return this.hallService.voteList(id, user.id, data.value);
  }

  @Delete('lists/:id/vote')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove vote from list' })
  async removeVote(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.hallService.removeVote(id, user.id);
    return { success: true };
  }

  // ============================================
  // Verified User Ranking
  // ============================================

  @Get('verified-ranking')
  @Public()
  @ApiOperation({ summary: 'Get verified user ranking' })
  async getVerifiedRanking(
    @Query() query: VerifiedRankingQueryDto,
  ): Promise<VerifiedRankingResponseDto> {
    return this.hallService.getVerifiedRanking(query);
  }

  @Get('verified-ranking/years')
  @Public()
  @ApiOperation({ summary: 'Get available years for filtering' })
  async getAvailableYears(): Promise<number[]> {
    return this.hallService.getAvailableYears();
  }

  // ============================================
  // Swipe Game (Tinder Mode)
  // ============================================

  @Get('swipe/batch')
  @ApiBearerAuth()
  @ApiOperation({ summary: '批量获取案例（预加载）' })
  @ApiResponse({ status: 200, type: SwipeBatchResultDto })
  async getNextCases(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SwipeBatchQueryDto,
  ): Promise<SwipeBatchResultDto> {
    return this.swipeService.getNextCases(user.id, query.count ?? 5);
  }

  @Post('swipe/predict')
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交滑动预测' })
  @ApiResponse({ status: 200, type: SwipeResultDto })
  async submitSwipe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SwipeActionDto,
  ): Promise<SwipeResultDto> {
    return this.swipeService.submitSwipe(user.id, dto);
  }

  @Get('swipe/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取用户滑动统计' })
  @ApiResponse({ status: 200, type: SwipeStatsDto })
  async getSwipeStats(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SwipeStatsDto> {
    return this.swipeService.getStats(user.id);
  }

  @Get('swipe/leaderboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取排行榜' })
  @ApiResponse({ status: 200, type: LeaderboardDto })
  async getLeaderboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardDto> {
    return this.swipeService.getLeaderboard(user.id, query.limit ?? 20);
  }
}
