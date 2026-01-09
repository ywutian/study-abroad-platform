import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { HallService } from './hall.service';
import { CurrentUser, Public } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { CreateReviewDto, CreateUserListDto, UpdateUserListDto, VoteListDto, BatchRankingDto, VerifiedRankingQueryDto, VerifiedRankingResponseDto } from './dto';

@ApiTags('hall')
@Controller('hall')
export class HallController {
  constructor(private readonly hallService: HallService) {}

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
    @Body() data: BatchRankingDto
  ) {
    return this.hallService.getBatchRanking(user.id, data.schoolIds);
  }

  // ============================================
  // Reviews
  // ============================================

  @Post('reviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit review for a profile' })
  async createReview(
    @CurrentUser() user: CurrentUserPayload,
    @Body() data: CreateReviewDto
  ) {
    return this.hallService.createReview(user.id, data);
  }

  @Get('reviews/user/:userId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reviews for a user' })
  async getReviewsForUser(@Param('userId') userId: string) {
    return this.hallService.getReviewsForUser(userId);
  }

  @Get('reviews/user/:userId/average')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get average scores for a user' })
  async getAverageScores(@Param('userId') userId: string) {
    return this.hallService.getAverageScores(userId);
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

  @Get('ranking/:schoolId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my ranking for a target school' })
  async getProfileRanking(@CurrentUser() user: CurrentUserPayload, @Param('schoolId') schoolId: string) {
    return this.hallService.getProfileRanking(user.id, schoolId);
  }

  // ============================================
  // User Lists
  // ============================================

  @Get('lists')
  @Public()
  @ApiOperation({ summary: 'Get public user lists' })
  @ApiQuery({ name: 'category', required: false })
  async getPublicLists(@Query() pagination: PaginationDto, @Query('category') category?: string) {
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
    @Body() data: CreateUserListDto
  ) {
    return this.hallService.createList(user.id, data);
  }

  @Put('lists/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my list' })
  async updateList(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() data: UpdateUserListDto
  ) {
    return this.hallService.updateList(id, user.id, data);
  }

  @Delete('lists/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete my list' })
  async deleteList(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    await this.hallService.deleteList(id, user.id);
    return { success: true };
  }

  @Post('lists/:id/vote')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vote on a list' })
  async voteList(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() data: VoteListDto) {
    return this.hallService.voteList(id, user.id, data.value);
  }

  @Delete('lists/:id/vote')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove vote from list' })
  async removeVote(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    await this.hallService.removeVote(id, user.id);
    return { success: true };
  }

  // ============================================
  // Verified User Ranking
  // ============================================

  @Get('verified-ranking')
  @Public()
  @ApiOperation({ summary: 'Get verified user ranking' })
  async getVerifiedRanking(@Query() query: VerifiedRankingQueryDto): Promise<VerifiedRankingResponseDto> {
    return this.hallService.getVerifiedRanking(query);
  }

  @Get('verified-ranking/years')
  @Public()
  @ApiOperation({ summary: 'Get available years for filtering' })
  async getAvailableYears(): Promise<number[]> {
    return this.hallService.getAvailableYears();
  }
}

