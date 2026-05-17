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
import { SwipeService } from './swipe.service';
import {
  HallOverviewService,
  type HallOverviewPayload,
} from './hall-overview.service';
import {
  HallReviewAggregatorService,
  type AggregatedReviewPayload,
} from './hall-review-aggregator.service';
import {
  ReviewerQualificationService,
  type QualificationQuestion,
  type QualificationResult,
} from './reviewer-qualification.service';
import { ReviewCoachService } from './review-coach.service';
import { HallVerifiedDashboardService } from './hall-verified-dashboard.service';
import type { ReviewerInsight } from './review-coach.prompts';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportTargetType } from '@prisma/client';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Role } from '@prisma/client';
import {
  ThrottleRelaxed,
  ThrottleAI,
} from '../../common/decorators/throttle.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  CreateReviewDto,
  CreateUserListDto,
  UpdateUserListDto,
  VoteListDto,
  BatchRankingDto,
  VerifiedRankingQueryDto,
  VerifiedDashboardQueryDto,
  VerifiedRankingResponseDto,
  HallReactionDto,
  RankingAnalysisDto,
  ChallengeGuessesDto,
  ReportReviewDto,
  SubmitQualificationDto,
  ReviewCoachRequestDto,
} from './dto';
import {
  SwipeActionDto,
  SwipeBatchQueryDto,
  SwipeBatchResultDto,
  SwipeResultDto,
  SwipeStatsDto,
  LeaderboardDto,
  LeaderboardQueryDto,
} from './swipe-dto';

@ApiTags('hall')
@ThrottleRelaxed()
@Controller('halls')
export class HallController {
  constructor(
    private readonly hallService: HallService,
    private readonly swipeService: SwipeService,
    private readonly hallOverviewService: HallOverviewService,
    private readonly aggregatorService: HallReviewAggregatorService,
    private readonly qualificationService: ReviewerQualificationService,
    private readonly reviewCoachService: ReviewCoachService,
    private readonly verifiedDashboardService: HallVerifiedDashboardService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================
  // Hall refactor Phase 1: aggregated BFF endpoint
  // ============================================

  @Get('me/overview')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Aggregated overview for Hall hero bar (points, swipe, daily challenge, reviewer, activity)',
  })
  async getOverview(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<HallOverviewPayload> {
    return this.hallOverviewService.getOverview(user.id);
  }

  // ============================================
  // Stage 2: Review aggregation, reporting, reviewer qualification
  // ============================================

  @Get('reviews/:profileUserId/aggregate')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Aggregate of reviews for an applicant (returns inProgress=true below 7-review threshold)',
  })
  async aggregateReviews(
    @Param('profileUserId') profileUserId: string,
  ): Promise<AggregatedReviewPayload | null> {
    return this.aggregatorService.aggregateForApplicant(profileUserId);
  }

  @Post('reviews/:reviewId/report')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Report a review (reuses central Report queue for admin triage)',
  })
  async reportReview(
    @CurrentUser() user: CurrentUserPayload,
    @Param('reviewId') reviewId: string,
    @Body() body: ReportReviewDto,
  ) {
    // Sanity: don't allow reporting your own review
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, reviewerId: true },
    });
    if (!review) {
      return { success: false, message: 'Review not found' };
    }
    if (review.reviewerId === user.id) {
      return { success: false, message: 'Cannot report your own review' };
    }
    const report = await this.prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: ReportTargetType.REVIEW,
        targetId: reviewId,
        reason: body.reason?.slice(0, 200) ?? 'unspecified',
        detail: body.detail?.slice(0, 5000),
      },
    });
    return { success: true, reportId: report.id };
  }

  @Get('reviewer/qualification')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the L1→L2 reviewer qualification quiz (3 questions)',
  })
  async getReviewerQualificationQuiz(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<QualificationQuestion[]> {
    return this.qualificationService.getQuestions(user.id);
  }

  @Post('reviewer/qualification')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Submit qualification quiz answers (60% to promote L1→L2)',
  })
  async submitReviewerQualification(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: SubmitQualificationDto,
  ): Promise<QualificationResult> {
    return this.qualificationService.submitAnswers(user.id, body.answers ?? []);
  }

  // ============================================
  // Stage 5: AI Review Coach (gentle reflective feedback)
  // ============================================

  @Post('reviewer/coach')
  @ThrottleAI()
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'AI Review Coach: reflective insight on reviewer style (gated by reviewer aiCoachConsent)',
  })
  async getReviewerCoachInsight(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: ReviewCoachRequestDto,
  ): Promise<{ insight: ReviewerInsight | null; fallback: boolean }> {
    const insight = await this.reviewCoachService.generateInsight(
      user.id,
      (body?.locale ?? user.locale === 'en') ? 'en' : 'zh',
    );
    // Graceful degradation: AI failures never block the review flow.
    return { insight, fallback: insight === null };
  }

  // ============================================
  // Public Profiles
  // ============================================

  @Get('public-profiles')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get public profiles for review' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getPublicProfiles(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.hallService.getPublicProfiles(
      search,
      page ? parseInt(page) : undefined,
      pageSize ? parseInt(pageSize) : undefined,
    );
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
    return this.hallService.getBatchRanking(
      user.id,
      data.schoolIds,
      user.locale,
    );
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

  @Get('reviews/me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reviews I have written' })
  async getMyReviews(@CurrentUser() user: CurrentUserPayload) {
    return this.hallService.getMyReviews(user.id);
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
    @Body() body: HallReactionDto,
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
  @ThrottleAI()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AI analysis for ranking at a specific school' })
  async getRankingAnalysis(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: RankingAnalysisDto,
  ) {
    return this.hallService.getRankingAnalysis(
      user.id,
      data.schoolId,
      user.locale,
    );
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

  // Hall refactor Phase 2: Lists are transitioning to ADMIN-curated expert lists.
  // Mutations are restricted to OPERATOR/ADMIN/SUPER_ADMIN; voting is restricted
  // similarly until the new "expert curated" UX ships in Stage 3.
  @Post('lists')
  @Roles(Role.OPERATOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a curated list (admin/editor only)' })
  async createList(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateUserListDto,
  ) {
    return this.hallService.createList(user.id, data);
  }

  @Put('lists/:id')
  @Roles(Role.OPERATOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a curated list (admin/editor only)' })
  async updateList(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateUserListDto,
  ) {
    return this.hallService.updateList(id, user.id, data);
  }

  @Delete('lists/:id')
  @Roles(Role.OPERATOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a curated list (admin/editor only)' })
  async deleteList(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    await this.hallService.deleteList(id, user.id);
    return { success: true };
  }

  @Post('lists/:id/vote')
  @Roles(Role.OPERATOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vote on a list (deprecated — admin tooling only)' })
  async voteList(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: VoteListDto,
  ) {
    return this.hallService.voteList(id, user.id, data.value);
  }

  @Delete('lists/:id/vote')
  @Roles(Role.OPERATOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove vote from list (deprecated — admin tooling only)',
  })
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
  // Verified — China Admit Dashboard (Stage 3)
  // ============================================

  @Get('verified/china-admit-trend')
  @Public()
  @ApiOperation({ summary: 'Per-school China-mainland admit count over time' })
  async getChinaAdmitTrend(@Query() query: VerifiedDashboardQueryDto) {
    return this.verifiedDashboardService.getChinaAdmitTrend(
      query.schoolIds,
      query.years ?? 4,
    );
  }

  @Get('verified/difficulty-signal')
  @Public()
  @ApiOperation({ summary: 'Year-over-year admission difficulty signal' })
  async getDifficultySignal(@Query() query: VerifiedDashboardQueryDto) {
    return this.verifiedDashboardService.getDifficultySignal(query.schoolIds);
  }

  @Get('verified/ed-rd-comparison')
  @Public()
  @ApiOperation({ summary: 'ED vs RD admit comparison for one cycle' })
  async getEdRdComparison(@Query() query: VerifiedDashboardQueryDto) {
    return this.verifiedDashboardService.getEdRdComparison(
      query.schoolIds,
      query.year ?? new Date().getFullYear() - 1,
    );
  }

  // ============================================
  // Swipe Game (Tinder Mode)
  // ============================================

  @Get('swipe/batch')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Batch get cases (preload)' })
  @ApiResponse({ status: 200, type: SwipeBatchResultDto })
  async getNextCases(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: SwipeBatchQueryDto,
  ): Promise<SwipeBatchResultDto> {
    return this.swipeService.getNextCases(user.id, query.count ?? 5);
  }

  @Post('swipe/predict')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit swipe prediction' })
  @ApiResponse({ status: 200, type: SwipeResultDto })
  async submitSwipe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SwipeActionDto,
  ): Promise<SwipeResultDto> {
    return this.swipeService.submitSwipe(user.id, dto);
  }

  @Get('swipe/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user swipe statistics' })
  @ApiResponse({ status: 200, type: SwipeStatsDto })
  async getSwipeStats(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SwipeStatsDto> {
    return this.swipeService.getStats(user.id);
  }

  @Get('swipe/leaderboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get leaderboard' })
  @ApiResponse({ status: 200, type: LeaderboardDto })
  async getLeaderboard(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: LeaderboardQueryDto,
  ): Promise<LeaderboardDto> {
    return this.swipeService.getLeaderboard(user.id, query.limit ?? 20);
  }

  // ============================================
  // Community Challenge
  // ============================================

  @Get('swipe/challenge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a community challenge case' })
  async getChallengeCase(@CurrentUser() user: CurrentUserPayload) {
    return this.swipeService.getChallengeCase(user.id);
  }

  @Post('swipe/challenge')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit challenge guesses' })
  async submitChallenge(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: ChallengeGuessesDto,
  ) {
    return this.swipeService.submitChallenge(user.id, body.guesses);
  }
}
